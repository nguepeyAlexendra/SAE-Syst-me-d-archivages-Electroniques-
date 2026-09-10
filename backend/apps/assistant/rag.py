import io, requests, json, re
from elasticsearch import Elasticsearch

ES = Elasticsearch("http://localhost:9200")
OLLAMA = "http://localhost:11434"
INDEX = "sae_chunks"

MODELS_DISPONIBLES = ["qwen3-4b:latest", "llama3.2:3b", "mistral:7b-instruct"]
MODEL_DEFAUT = "qwen3-4b:latest"


# ===========================================================================
# INDEXATION ET RECHERCHE ELASTICSEARCH
# ===========================================================================

def assurer_index():
    if not ES.indices.exists(index=INDEX):
        ES.indices.create(index=INDEX, mappings={"properties": {
            "document_id": {"type": "integer"},
            "titre": {"type": "text"},
            "texte": {"type": "text"},
            "vecteur": {"type": "dense_vector", "dims": 768, "index": True, "similarity": "cosine"},
            "departement_id": {"type": "integer"},
            "confidentiel": {"type": "boolean"},
            "groupe_id": {"type": "integer"},
        }})


def extraire_texte(contenu, type_mime):
    texte = ""
    try:
        if type_mime == 'application/pdf':
            import fitz
            doc = fitz.open(stream=contenu, filetype='pdf')
            texte = "\n".join(p.get_text() for p in doc)
        elif 'wordprocessing' in type_mime or type_mime == 'application/msword':
            import docx
            texte = "\n".join(p.text for p in docx.Document(io.BytesIO(contenu)).paragraphs)
        elif 'spreadsheet' in type_mime or 'excel' in type_mime:
            import openpyxl
            wb = openpyxl.load_workbook(io.BytesIO(contenu))
            texte = "\n".join(str(c.value) for ws in wb for row in ws.iter_rows() for c in row if c.value)
        elif 'presentation' in type_mime or 'powerpoint' in type_mime:
            from pptx import Presentation
            texte = "\n".join(sh.text for s in Presentation(io.BytesIO(contenu)).slides for sh in s.shapes if sh.has_text_frame)
        elif type_mime.startswith('text/'):
            texte = contenu.decode('utf-8', errors='ignore')
    except Exception:
        texte = ""
    return texte.strip()


def decouper(texte, taille=800):
    mots = texte.split()
    chunks, cur = [], []
    for m in mots:
        cur.append(m)
        if len(" ".join(cur)) >= taille:
            chunks.append(" ".join(cur))
            cur = cur[-50:]
    if cur:
        chunks.append(" ".join(cur))
    return [c for c in chunks if len(c) > 40]


def embedder(textes, est_requete=False):
    """Génère les vecteurs avec les préfixes obligatoires de nomic-embed-text."""
    prefixe = "search_query: " if est_requete else "search_document: "
    textes_prefixes = [prefixe + t for t in textes]
    try:
        r = requests.post(f"{OLLAMA}/api/embed",
                          json={"model": "nomic-embed-text", "input": textes_prefixes},
                          timeout=120)
        return r.json()["embeddings"]
    except Exception:
        r = requests.post(f"{OLLAMA}/api/embeddings",
                          json={"model": "nomic-embed-text", "prompt": textes_prefixes[0]},
                          timeout=120)
        return [r.json()["embedding"]]


def indexer_document(document):
    """Indexe un document (idempotent : supprime d'abord les anciens chunks)."""
    assurer_index()
    try:
        ES.delete_by_query(index=INDEX, body={"query": {"term": {"document_id": document.id}}})
    except Exception:
        pass

    document.fichier.open('rb')
    contenu = document.fichier.read()
    document.fichier.close()

    texte = document.contenu_texte or extraire_texte(contenu, document.type_mime)
    if not texte:
        return 0

    chunks = decouper(texte)
    if not chunks:
        return 0

    vecs = embedder(chunks)
    departement_id = getattr(document, 'departement_id', None)
    confidentiel = getattr(document, 'est_confidentiel', False)
    groupe_id = getattr(document, 'groupe_id', None)

    for i, chunk in enumerate(chunks):
        ES.index(index=INDEX, document={
            "document_id": document.id,
            "titre": document.titre,
            "texte": chunk,
            "vecteur": vecs[i] if i < len(vecs) else vecs[0],
            "departement_id": departement_id,
            "confidentiel": confidentiel,
            "groupe_id": groupe_id,
        })
    return len(chunks)


def _filtres_permissions(user):
    """Construit les filtres Elasticsearch selon les permissions de l'utilisateur."""
    if not user or not user.is_authenticated:
        return [{"term": {"confidentiel": False}}]
    if user.is_staff:
        return []
    profil = getattr(user, 'profil', None)
    if not profil or not profil.departement_id:
        return [{"term": {"departement_id": -999}}]
    dept_ids = [profil.departement_id] + list(profil.departements_autorises.values_list('id', flat=True))
    return [
        {"terms": {"departement_id": dept_ids}},
        {"term": {"confidentiel": False}},
    ]


def recherche_hybride(question, k=8, user=None):
    """Recherche textuelle robuste. Résiliente si ES ou Ollama est indisponible."""
    try:
        assurer_index()
    except Exception as e:
        print(f"[RAG] Elasticsearch indisponible : {e}")
        return []

    filtres = _filtres_permissions(user)
    try:
        body = {
            "query": {
                "bool": {
                    "must": {
                        "multi_match": {
                            "query": question,
                            "fields": ["titre^5", "texte"],
                            "type": "best_fields",
                            "fuzziness": "AUTO",
                        }
                    },
                    "filter": filtres,
                }
            }
        }
        res = ES.search(index=INDEX, size=k * 3, body=body)
    except Exception as e:
        print(f"[RAG] Erreur ES : {e}")
        return []

    hits = res.get("hits", {}).get("hits", [])
    if not hits:
        print(f"[RAG] '{question[:40]}' → 0 chunks")
        return []

    score_max = hits[0].get("_score", 0) or 1
    seuil = score_max * 0.55

    chunks = []
    documents_vus = set()
    for hit in hits:
        score = hit.get("_score", 0)
        if score < seuil:
            continue
        src = hit.get("_source", {})
        doc_id = src.get("document_id")
        if doc_id in documents_vus:
            continue
        documents_vus.add(doc_id)
        src["score"] = round(score, 3)
        chunks.append(src)
        if len(chunks) >= k:
            break

    print(f"[RAG] '{question[:40]}' → {len(chunks)} chunks (seuil={round(seuil, 2)})")
    return chunks


# ===========================================================================
# GÉNÉRATION DE RÉPONSES (LLM)
# ===========================================================================

def generer(question, chunks, prenom, model=None, temperature=0.2):
    """Génère une réponse avec intro polie, dans la langue de la question."""
    model = model or MODEL_DEFAUT
    contexte = "\n\n---\n\n".join([
        f"[Document: {c.get('titre', 'Sans titre')}]\n{c.get('texte', '')}"
        for c in chunks
    ])
    prompt = f"""Tu es un assistant IA pour une plateforme de gestion documentaire (SAE).
L'utilisateur s'appelle {prenom}.

CONTEXTE (extraits de documents pertinents) :
{contexte}

QUESTION : {question}

INSTRUCTIONS :
1. Réponds UNIQUEMENT en te basant sur le contexte fourni
2. Si la réponse n'est pas dans le contexte, dis-le clairement
3. Cite les documents sources quand tu les utilises
4. IMPORTANT : Réponds DANS LA MÊME LANGUE que la question posée
5. Sois concis mais complet
6. Commence TOUJOURS par une courte phrase d'introduction polie dans la langue
   de la question (ex : « Bonjour {prenom}, d'après les documents, ... »),
   puis développe ta réponse de façon structurée.

RÉPONSE :
/no_think"""
    try:
        response = requests.post(
            f"{OLLAMA}/api/generate",
            json={"model": model, "prompt": prompt, "stream": False,
                  "options": {"temperature": temperature, "num_predict": 1024}},
            timeout=120,
        )
        response.raise_for_status()
        return response.json()["response"]
    except Exception as e:
        return f"⚠️ Erreur lors de la génération : {str(e)}"


def generer_stream(question, chunks, prenom, model=None, temperature=0.2):
    """Génère une réponse en streaming (token par token)."""
    model = model or MODEL_DEFAUT
    contexte = "\n---\n".join(f"[{c['titre']}] {c['texte']}" for c in chunks)
    prompt = (
        f"Tu es l'assistant du SAE. L'utilisateur s'appelle {prenom}. "
        f"Réponds UNIQUEMENT à partir des extraits, DANS LA MÊME LANGUE QUE LA QUESTION. "
        f"Si la réponse n'y est pas, dis-le poliment. "
        f"Commence TOUJOURS par une phrase d'introduction polie.\n\n"
        f"EXTRAITS :\n{contexte}\n\nQUESTION : {question}\n\nRÉPONSE :\n/no_think"
    )
    try:
        r = requests.post(
            f"{OLLAMA}/api/generate",
            json={"model": model, "prompt": prompt, "stream": True,
                  "options": {"temperature": temperature}},
            stream=True, timeout=180,
        )
        for line in r.iter_lines():
            if line:
                data = json.loads(line)
                if "response" in data:
                    yield data["response"]
                if data.get("done"):
                    break
    except requests.exceptions.ConnectionError:
        yield "⚠️ Ollama ne répond pas. Vérifie qu'il est lancé."
    except requests.exceptions.Timeout:
        yield "⚠️ Ollama a mis trop de temps à répondre (> 3 min)."
    except Exception as e:
        yield f"⚠️ Erreur inattendue : {e}"


# ===========================================================================
# ROUTEUR D'INTENTION : questions CONTENU (RAG) vs MÉTADONNÉES (BDD Django)
# ===========================================================================

MOIS = {
    'janvier': 1, 'fevrier': 2, 'février': 2, 'mars': 3, 'avril': 4, 'mai': 5,
    'juin': 6, 'juillet': 7, 'aout': 8, 'août': 8, 'septembre': 9, 'octobre': 10,
    'novembre': 11, 'decembre': 12, 'décembre': 12,
    'january': 1, 'february': 2, 'march': 3, 'april': 4, 'may': 5, 'june': 6,
    'july': 7, 'august': 8, 'september': 9, 'october': 10, 'november': 11, 'december': 12,
}

NOMS_MOIS_FR = {
    1: 'janvier', 2: 'février', 3: 'mars', 4: 'avril', 5: 'mai', 6: 'juin',
    7: 'juillet', 8: 'août', 9: 'septembre', 10: 'octobre', 11: 'novembre', 12: 'décembre',
}

MOTS_CLES_METADATA = [
    'liste', 'lister', 'combien', 'nombre', 'statistique',
    'déposé', 'depose', 'déposés', 'deposés', 'dépôt', 'depot',
    'ajouté', 'ajoutes', 'upload', 'scan', 'scanné',
    'ce mois', 'mois courant', 'le mois', 'par mois', 'par département', 'par departement',
    'mois dernier', 'cette semaine', 'cette annee', 'aujourd hui',
    'this month', 'current month', 'last month', 'this week', 'this year', 'today',
    'par auteur', 'déposés par', 'deposes par', 'déposé par', 'depose par',
    'top', 'qui a', 'derniers documents', 'dernières', 'dernieres',
    'rejetés', 'rejete', 'validés', 'en cours', 'archivés',
    'tous les documents', 'toutes les images',
    'toutes les vidéos', 'tous les médias', 'tous les medias',
    'y a t il', 'ya til', 'ya t il',
    'existe t il', 'existe-t-il', 'existe til',
    'est ce qu il y a', 'il y a un', 'il y a des',
    'a t on', 'avons nous', 'avez vous',
    'is there', 'are there', 'how many', 'list', 'count',
    'hay', 'cuántos', 'cuantos', 'lista',
    'powerpoint', 'pptx', 'présentation', 'presentation',
    'excel', 'xlsx', 'tableur', 'spreadsheet',
    'word', 'docx',
    'pdf',
]

def resumer_documents(doc_ids, user, prenom, question="Résume ces documents", model=None):
    """Résume directement le contenu des documents sélectionnés (par ID)."""
    docs = list(_qs_docs_pour_user(user).filter(id__in=doc_ids))
    if not docs:
        langue = _detecter_langue(question)
        return ("Aucun document accessible parmi ceux sélectionnés." if langue == 'fr'
                else "No accessible document among the selected ones.")

    blocs_contexte = []
    for d in docs[:5]:
        texte = getattr(d, 'contenu_texte', '') or ''
        if not texte:
            try:
                d.fichier.open('rb')
                contenu = d.fichier.read()
                d.fichier.close()
                texte = extraire_texte(contenu, d.type_mime)
            except Exception:
                texte = ''
        if not texte:
            texte = f"(document sans texte extractible : {d.titre})"
        blocs_contexte.append(f"[Document : {d.titre}]\n{texte[:6000]}")

    contexte = "\n\n---\n\n".join(blocs_contexte)
    langue = _detecter_langue(question)

    if langue == 'en':
        consigne = f"Summarize the following documents clearly and structurally. User's name: {prenom}. Start with a short introduction."
    elif langue == 'es':
        consigne = f"Resume los siguientes documentos de forma clara y estructurada. Nombre del usuario: {prenom}. Empieza con una breve introducción."
    else:
        consigne = f"Résume les documents suivants de façon claire et structurée. L'utilisateur s'appelle {prenom}. Commence par une courte phrase d'introduction."

    prompt = f"""{consigne}
Donne un résumé par document (titre en gras), puis une synthèse globale si pertinent.

DOCUMENTS :
{contexte}

RÉSUMÉ :
/no_think"""

    try:
        r = requests.post(f"{OLLAMA}/api/generate",
                          json={"model": model or MODEL_DEFAUT, "prompt": prompt, "stream": False,
                                "options": {"temperature": 0.2, "num_predict": 1024}},
                          timeout=180)
        r.raise_for_status()
        return r.json()["response"]
    except Exception as e:
        return f"⚠️ Erreur lors du résumé : {e}"

def _normaliser(texte):
    """Normalise apostrophes, tirets, ponctuation pour les comparaisons."""
    return (texte.lower()
            .replace("'", " ").replace("'", " ").replace("-", " ")
            .replace("?", " ").replace("!", " ")
            .replace(",", " ").replace(".", " "))


def _contient(q, racine):
    """Match par racine de mot : 'image' matche 'images', 'word' matche 'words'..."""
    return re.search(rf"\b{racine}", q) is not None


def _mot_present(mot, texte_normalise):
    """Vérifie si un mot-clé est présent comme mot entier (pas substring)."""
    mots = texte_normalise.split()
    if ' ' in mot:
        return mot in texte_normalise
    return mot in mots


def detecter_intention(question, model=None):
    """Classifie la question : 'METADONNEES' (BDD) ou 'CONTENU' (RAG)."""
    import requests as _req
    q = _normaliser(question)
        # Commandes de résumé → toujours CONTENU (jamais métadonnées)
    if q.startswith('resume ces documents') or q.startswith('summarize these documents') or q.startswith('resume los documentos'):
        return "CONTENU"

    if any(_mot_present(m, q) for m in MOTS_CLES_METADATA):
        print(f"[RAG] Routeur : mots-clés → METADONNEES")
        return "METADONNEES"

    model = model or MODEL_DEFAUT
    prompt = (
        "Tu es un routeur de questions. Classifie la question en UN SEUL mot.\n"
        "- METADONNEES : liste, comptage, dates de dépôt, auteurs, départements, statuts, statistiques sur les documents.\n"
        "- CONTENU : ce que DISENT les documents (résumés, informations, procédures).\n\n"
        f"Question : {question}\n\nRéponse (1 seul mot) :\n/no_think"
    )
    try:
        r = _req.post(f"{OLLAMA}/api/generate",
                      json={"model": model, "prompt": prompt, "stream": False,
                            "options": {"temperature": 0.0, "num_predict": 5}},
                      timeout=30)
        rep = r.json().get("response", "").strip().upper()
        if "CONTENU" in rep:
            return "CONTENU"
        if "METADONNEES" in rep or "MÉTADONNÉES" in rep or "METADATA" in rep:
            return "METADONNEES"
    except Exception as e:
        print(f"[RAG] Routeur LLM indisponible : {e}")

    return "CONTENU"


def _qs_docs_pour_user(user):
    """QuerySet des documents accessibles à l'utilisateur (mêmes règles que la GED)."""
    from django.db.models import Q
    from apps.documents.models import Document
    qs = Document.objects.filter(est_supprime=False)
    if user.is_staff:
        return qs
    profil = getattr(user, 'profil', None)
    if not profil or not profil.departement_id:
        return Document.objects.none()
    dept_ids = [profil.departement_id] + list(profil.departements_autorises.values_list('id', flat=True))
    qs = qs.filter(Q(departement_id__in=dept_ids) | Q(departements_autorises=profil.departement_id))
    qs = qs.filter(
        Q(est_confidentiel=False) |
        Q(utilisateurs_autorises=user)
    )
    return qs.distinct()

def requete_metadata(question, user):
    """Extraction LLM + requête BDD. Pour le COMPTAGE, compte TOUT (transparence)."""
    import requests as _req
    from django.db.models import Q, Count
    from apps.documents.models import Departement, Document
    from django.contrib.auth.models import User as DjangoUser
    from datetime import date as _date, timedelta as _td

    # 1. Extraction des filtres par le LLM
    prompt_extraction = f"""Tu es un extracteur de filtres. Analyse la question et retourne UNIQUEMENT un JSON :

{{
  "periode": "ce_mois" | "mois_dernier" | "cette_semaine" | "aujourd_hui" | "cette_annee" | null,
  "mois": "janvier" | ... | null,
  "annee": 2024 | 2025 | 2026 | null,
  "statut": "rejete" | "valide" | "en_cours" | null,
  "format": "PowerPoint" | "Excel" | "Word" | "PDF" | null,
  "groupe": "images" | "medias" | null,
  "departement": "nom exact" | null,
  "auteur": "username exact" | null,
  "confidentiel": true | false | null,
  "type_question": "classement_auteurs" | "liste" | "comptage"
}}

Règles :
- "qui a déposé le plus" / "top contributeurs" → classement_auteurs
- "combien de" / "nombre de" / "how many" → comptage
- "documents confidentiels" → confidentiel: true
- "ce mois" → periode: ce_mois
- Retourne UNIQUEMENT le JSON

Question : {question}

JSON :
/no_think"""

    try:
        r = _req.post(f"{OLLAMA}/api/generate",
                      json={"model": MODEL_DEFAUT, "prompt": prompt_extraction, "stream": False,
                            "options": {"temperature": 0.0, "num_predict": 200}},
                      timeout=30)
        reponse_brute = r.json().get("response", "").strip()
        if reponse_brute.startswith("```"):
            reponse_brute = reponse_brute.split("```")[1]
            if reponse_brute.startswith("json"):
                reponse_brute = reponse_brute[4:]
        filtres_llm = json.loads(reponse_brute)
        print(f"[RAG] Filtres extraits : {filtres_llm}")
    except Exception as e:
        print(f"[RAG] Erreur extraction : {e}")
        filtres_llm = {}

    # 2. Construire les QuerySets
    auj = _date.today()
    
    # qs_total = TOUS les documents (sans permissions) — pour le COMPTAGE
    # qs_user = documents accessibles — pour la LISTE
    qs_total = Document.objects.filter(est_supprime=False)
    qs_user = _qs_docs_pour_user(user)
    filtres = {}

    # Application des filtres sur les 2 querysets
    def appliquer_filtres(qs):
        periode = filtres_llm.get('periode')
        if periode == 'ce_mois':
            qs = qs.filter(date_depot__month=auj.month, date_depot__year=auj.year)
            filtres['periode'] = 'ce_mois'
            filtres['mois'] = NOMS_MOIS_FR[auj.month]
            filtres['annee'] = auj.year
        elif periode == 'mois_dernier':
            prec = auj.replace(day=1) - _td(days=1)
            qs = qs.filter(date_depot__month=prec.month, date_depot__year=prec.year)
            filtres['periode'] = 'mois_dernier'
            filtres['mois'] = NOMS_MOIS_FR[prec.month]
            filtres['annee'] = prec.year
        elif periode == 'cette_semaine':
            debut = auj - _td(days=auj.weekday())
            qs = qs.filter(date_depot__date__gte=debut)
            filtres['periode'] = 'cette_semaine'
        elif periode == 'aujourd_hui':
            qs = qs.filter(date_depot__date=auj)
            filtres['periode'] = 'aujourd_hui'
        elif periode == 'cette_annee':
            qs = qs.filter(date_depot__year=auj.year)
            filtres['annee'] = auj.year
            filtres['periode'] = 'cette_annee'

        if 'mois' in filtres_llm and filtres_llm['mois'] and 'periode' not in filtres:
            mois_nom = filtres_llm['mois']
            if mois_nom in MOIS:
                qs = qs.filter(date_depot__month=MOIS[mois_nom])
                filtres['mois'] = mois_nom

        if 'annee' in filtres_llm and filtres_llm['annee'] and 'annee' not in filtres:
            qs = qs.filter(date_depot__year=filtres_llm['annee'])
            filtres['annee'] = filtres_llm['annee']

        if filtres_llm.get('statut'):
            qs = qs.filter(statut=filtres_llm['statut'])
            filtres['statut'] = filtres_llm['statut']

        fmt = filtres_llm.get('format')
        if fmt:
            if fmt == 'PowerPoint':
                qs = qs.filter(Q(type_mime__icontains='presentation') | Q(type_mime__icontains='powerpoint'))
            elif fmt == 'Excel':
                qs = qs.filter(Q(type_mime__icontains='spreadsheet') | Q(type_mime__icontains='excel'))
            elif fmt == 'Word':
                qs = qs.filter(Q(type_mime__icontains='wordprocessing') | Q(type_mime__icontains='msword'))
            elif fmt == 'PDF':
                qs = qs.filter(type_mime='application/pdf')
            filtres['format'] = fmt

        groupe = filtres_llm.get('groupe')
        if groupe:
            if groupe == 'images':
                qs = qs.filter(Q(groupe='images') | Q(type_source='scan'))
                filtres['groupe'] = 'images+scans'
            elif groupe == 'medias':
                qs = qs.filter(groupe='medias')
                filtres['groupe'] = 'medias'

        if filtres_llm.get('departement'):
            try:
                dept = Departement.objects.get(nom=filtres_llm['departement'])
                qs = qs.filter(departement=dept)
                filtres['departement'] = dept.nom
            except Departement.DoesNotExist:
                pass

        if filtres_llm.get('auteur'):
            try:
                u = DjangoUser.objects.get(username=filtres_llm['auteur'])
                qs = qs.filter(depose_par=u)
                filtres['auteur'] = u.username
            except DjangoUser.DoesNotExist:
                pass

        # Confidentiel : important de l'appliquer (sinon ça fausse le comptage)
        if filtres_llm.get('confidentiel') is not None:
            qs = qs.filter(est_confidentiel=filtres_llm['confidentiel'])
            filtres['confidentiel'] = filtres_llm['confidentiel']
        
        return qs

    qs_total = appliquer_filtres(qs_total)
    qs_user = appliquer_filtres(qs_user)

    # 3. Type de question
    type_question = filtres_llm.get('type_question', 'liste')

    # ===== CLASSEMENT AUTEURS (toujours sur qs_total pour transparence) =====
    if type_question == 'classement_auteurs':
        classement = list(qs_user.values(
            'depose_par__username', 'depose_par__first_name',
        ).annotate(count=Count('id')).order_by('-count')[:10])
        
        documents = [{
            'rang': i + 1,
            'auteur': (a['depose_par__first_name'] or a['depose_par__username'] or 'Inconnu'),
            'username': a['depose_par__username'] or 'Inconnu',
            'count': a['count'],
        } for i, a in enumerate(classement)]
        
        return {
            'type': 'classement',
            'total': sum(a['count'] for a in classement),
            'non_accessibles': 0,
            'filtres': filtres,
            'documents': documents,
        }

    # ===== COMPTE TOTAL (sur qs_total pour transparence) =====
    total = qs_total.count()
    accessibles = qs_user.count()
    non_accessibles = max(total - accessibles, 0)

    if type_question == 'comptage':
        # Pour le comptage, on retourne juste le total + info accessibilité
        return {
            'type': 'comptage',
            'total': total,
            'non_accessibles': non_accessibles,
            'filtres': filtres,
            'documents': [],
        }

    # ===== LISTE (seulement les accessibles) =====
    qs_user = qs_user.order_by('-date_depot')
    documents = [{
        'document_id': d.id,
        'titre': d.titre,
        'auteur': d.depose_par.username if d.depose_par else 'Inconnu',
        'date': d.date_depot.strftime('%d/%m/%Y'),
        'departement': d.departement.nom if d.departement else 'N/A',
        'statut': d.statut,
        'groupe': d.groupe,
    } for d in qs_user[:100]]

    return {
        'type': 'liste',
        'total': accessibles,
        'non_accessibles': non_accessibles,
        'filtres': filtres,
        'documents': documents,
    }
# ===========================================================================
# RÉPONSES STRUCTURÉES POUR MÉTADONNÉES (listes, intros contextuelles)
# ===========================================================================

def _analyser_raisons_masquage(filtres, langue='fr'):
    """Analyse les filtres pour expliquer pourquoi des documents sont masqués (traduit)."""
    raisons_fr, raisons_en, raisons_es = [], [], []

    if 'departement' in filtres:
        dept = filtres['departement']
        raisons_fr.append(f"Les documents masqués appartiennent à d'autres départements que **{dept}**.")
        raisons_en.append(f"Hidden documents belong to departments other than **{dept}**.")
        raisons_es.append(f"Los documentos ocultos pertenecen a departamentos distintos de **{dept}**.")

    if 'auteur' in filtres:
        auteur = filtres['auteur']
        raisons_fr.append(f"Certains documents de **{auteur}** sont confidentiels et réservés à des utilisateurs spécifiques.")
        raisons_en.append(f"Some documents by **{auteur}** are confidential and reserved for specific users.")
        raisons_es.append(f"Algunos documentos de **{auteur}** son confidenciales.")

    if 'format' in filtres:
        fmt = filtres['format']
        raisons_fr.append(f"Certains fichiers **{fmt}** ne sont pas accessibles avec vos permissions.")
        raisons_en.append(f"Some **{fmt}** files are not accessible with your permissions.")
        raisons_es.append(f"Algunos archivos **{fmt}** no son accesibles con sus permisos.")

    if filtres.get('groupe') == 'images+scans':
        raisons_fr.append("Certains documents sont classés comme 'documents' (PDF, Word) plutôt que 'images', même s'il s'agit de scans.")
        raisons_en.append("Some documents are classified as 'documents' rather than 'images', even if they are scans.")
        raisons_es.append("Algunos documentos están clasificados como 'documentos' en lugar de 'imágenes', aunque sean escaneos.")

    if not (raisons_fr or raisons_en or raisons_es):
        raisons_fr.append("Ces documents sont soit dans un département auquel vous n'avez pas accès, soit marqués comme **confidentiels** par l'administrateur.")
        raisons_en.append("These documents are either in a department you don't have access to, or marked as **confidential** by the administrator.")
        raisons_es.append("Estos documentos están en un departamento inaccesible o son confidenciales.")

    if langue == 'en':
        return "\n".join(raisons_en)
    elif langue == 'es':
        return "\n".join(raisons_es)
    return "\n".join(raisons_fr)


def _detecter_langue(question):
    """Détection par mots forts (fonctionne même sans accents)."""
    q = _normaliser(question)
    mots = set(q.split())

    FR = {'les', 'des', 'du', 'une', 'est', 'sont', 'dans', 'pour', 'avec',
          'quel', 'quelle', 'quels', 'quelles', 'combien', 'mois', 'annee',
          'ici', 'tous', 'toutes', 'cette', 'cet', 'au', 'aux', 'liste',
          'departement', 'auteur', 'statut', 'rejete', 'valides',
          'depose', 'deposes', 'uploades', 'fichiers', 'images',
          'documents', 'a', 'ai', 'as', 'ont', 'avons', 'avez',
          'je', 'tu', 'il', 'elle', 'nous', 'vous', 'ils', 'elles',
          'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses',
          'notre', 'votre', 'leur', 'leurs'}
    EN = {'the', 'of', 'is', 'are', 'was', 'were', 'by', 'from', 'to', 'an',
          'there', 'here', 'my', 'your', 'our', 'their', 'uploaded', 'all',
          'any', 'some', 'show', 'give', 'which', 'what', 'how', 'many',
          'list', 'count', 'department', 'author', 'status', 'files',
          'this', 'that', 'please', 'can', 'you', 'me', 'i', 'we', 'they',
          'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would'}
    ES = {'los', 'las', 'del', 'una', 'uno', 'son', 'esta', 'estan', 'para',
          'con', 'cuanto', 'cuantos', 'cuantas', 'cual', 'cuales', 'hay',
          'aqui', 'todos', 'todas', 'por', 'favor', 'departamento', 'autor',
          'estado', 'archivos', 'imagenes', 'lista', 'yo', 'tu', 'el',
          'ella', 'nosotros', 'vosotros', 'ellos', 'ellas', 'mi', 'tu',
          'su', 'sus', 'nuestro', 'vuestro'}

    score = {'fr': len(mots & FR), 'en': len(mots & EN), 'es': len(mots & ES)}
    if re.search(r'[àâäéèêëïîôùûüÿçœ]', q):
        score['fr'] += 2
    if re.search(r'[áíóúñ¿¡]', q):
        score['es'] += 2

    best = max(score, key=score.get)
    return best if score[best] > 0 else 'fr'


def _get_labels(langue):
    """Retourne les labels traduits selon la langue."""
    labels = {
        'fr': {
            'total': 'Total de documents correspondants',
            'titre': 'Titre', 'auteur': 'Auteur', 'date': 'Date',
            'departement': 'Département',
            'et_autres': 'autre(s) document(s) plus ancien(s)',
            'non_accessibles': 'autre(s) document(s) correspondent mais ne sont pas accessibles',
            'conseil': 'Conseil',
            'conseil_texte': 'Si vous avez besoin d\'accéder à ces documents, contactez votre administrateur pour demander une extension de permissions.',
            'oui': 'Oui', 'non': 'Non',
            'aucun': 'aucun document de type',
            'accessible': 'n\'est accessible avec vos permissions',
        },
        'en': {
            'total': 'Total matching documents',
            'titre': 'Title', 'auteur': 'Author', 'date': 'Date',
            'departement': 'Department',
            'et_autres': 'other older document(s)',
            'non_accessibles': 'other document(s) match but are not accessible',
            'conseil': 'Tip',
            'conseil_texte': 'If you need access to these documents, contact your administrator to request extended permissions.',
            'oui': 'Yes', 'non': 'No',
            'aucun': 'no document of type',
            'accessible': 'is accessible with your permissions',
        },
        'es': {
            'total': 'Total de documentos correspondientes',
            'titre': 'Título', 'auteur': 'Autor', 'date': 'Fecha',
            'departement': 'Departamento',
            'et_autres': 'otro(s) documento(s) más antiguo(s)',
            'non_accessibles': 'otro(s) documento(s) coinciden pero no son accesibles',
            'conseil': 'Consejo',
            'conseil_texte': 'Si necesita acceder a estos documentos, contacte a su administrador para solicitar permisos extendidos.',
            'oui': 'Sí', 'non': 'No',
            'aucun': 'ningún documento de tipo',
            'accessible': 'es accesible con sus permisos',
        },
    }
    return labels.get(langue, labels['fr'])


def _generer_intro_contextuelle(question, donnees, prenom, labels, langue):
    """Génère une phrase d'intro intelligente selon les filtres appliqués, traduite."""
    filtres = donnees.get('filtres', {})
    total = donnees['total']

    q = _normaliser(question)
    est_existence = any(m in q for m in [
        'y a t il', 'existe t il', 'est ce qu il y a', 'il y a un', 'il y a des',
        'is there', 'are there', 'hay', 'existe',
    ])

    # Gestion des périodes relatives
    if 'periode' in filtres:
        libelles = {
            'fr': {
                'ce_mois': 'ce mois-ci',
                'mois_dernier': 'le mois dernier',
                'cette_semaine': 'cette semaine',
                'aujourd_hui': "aujourd'hui",
                'cette_annee': 'cette année'
            },
            'en': {
                'ce_mois': 'this month',
                'mois_dernier': 'last month',
                'cette_semaine': 'this week',
                'aujourd_hui': 'today',
                'cette_annee': 'this year'
            },
            'es': {
                'ce_mois': 'este mes',
                'mois_dernier': 'el mes pasado',
                'cette_semaine': 'esta semana',
                'aujourd_hui': 'hoy',
                'cette_annee': 'este año'
            },
        }
        lib = libelles.get(langue, libelles['fr']).get(filtres['periode'], '')
        if langue == 'en':
            return f"Here are the {total} document(s) uploaded {lib}:"
        if langue == 'es':
            return f"Aquí están los {total} documento(s) subido(s) {lib}:"
        return f"Voici les {total} document(s) déposé(s) {lib} :"

    intros = {
        'fr': {
            'existence_oui': f"✅ {labels['oui']}, {total}",
            'existence_non': f"❌ {labels['non']}, {labels['aucun']}",
            'auteur': f"{filtres.get('auteur', '')}, voici les {total} document(s) que vous avez uploadé(s) :",
            'departement': f"Voici les {total} document(s) du département {filtres.get('departement', '')} :",
            'format': f"Voici les {total} fichier(s) {filtres.get('format', '')} disponibles :",
            'periode': f"Voici les {total} document(s) déposé(s)",
            'statut': f"Voici les {total} document(s) avec le statut '{filtres.get('statut', '')}' :",
            'general': f"{prenom}, voici les {total} document(s) correspondant à votre recherche :",
        },
        'en': {
            'existence_oui': f"✅ {labels['oui']}, {total}",
            'existence_non': f"❌ {labels['non']}, {labels['aucun']}",
            'auteur': f"{filtres.get('auteur', '')}, here are the {total} document(s) you uploaded:",
            'departement': f"Here are the {total} document(s) from the {filtres.get('departement', '')} department:",
            'format': f"Here are the {total} {filtres.get('format', '')} file(s) available:",
            'periode': f"Here are the {total} document(s) uploaded",
            'statut': f"Here are the {total} document(s) with status '{filtres.get('statut', '')}':",
            'general': f"{prenom}, here are the {total} document(s) matching your search:",
        },
        'es': {
            'existence_oui': f"✅ {labels['oui']}, {total}",
            'existence_non': f"❌ {labels['non']}, {labels['aucun']}",
            'auteur': f"{filtres.get('auteur', '')}, aquí están los {total} documento(s) que ha subido:",
            'departement': f"Aquí están los {total} documento(s) del departamento {filtres.get('departement', '')}:",
            'format': f"Aquí están los {total} archivo(s) {filtres.get('format', '')} disponibles:",
            'periode': f"Aquí están los {total} documento(s) subido(s)",
            'statut': f"Aquí están los {total} documento(s) con estado '{filtres.get('statut', '')}':",
            'general': f"{prenom}, aquí están los {total} documento(s) que coinciden con su búsqueda:",
        },
    }
    i = intros.get(langue, intros['fr'])

    if est_existence:
        fmt = filtres.get('format') or filtres.get('groupe') or 'document'
        if total == 0:
            return f"{i['existence_non']} {fmt} {labels['accessible']}."
        return f"{i['existence_oui']} {fmt} :"

    if 'auteur' in filtres:
        return i['auteur']
    if 'departement' in filtres:
        return i['departement']
    if 'format' in filtres:
        return i['format']
    if 'mois' in filtres or 'annee' in filtres:
        periode = []
        if 'mois' in filtres:
            periode.append(filtres['mois'])
        if 'annee' in filtres:
            periode.append(str(filtres['annee']))
        return f"{i['periode']} {' '.join(periode)} :"
    if 'statut' in filtres:
        return i['statut']
    return i['general']


def generer_depuis_donnees(question, donnees, prenom, model=None):
    """Génère la réponse selon le type : classement, comptage, ou liste."""
    total = donnees['total']
    docs = donnees['documents']
    type_q = donnees.get('type', 'liste')

    langue = _detecter_langue(question)
    labels = _get_labels(langue)

    # ===== TYPE CLASSEMENT (top auteurs) =====
        # ===== TYPE COMPTE SIMPLE (combien de...) =====
    if type_q == 'comptage':
        intro = _generer_intro_contextuelle(question, donnees, prenom, labels, langue)
        if total == 0:
            msgs = {
                'fr': f"Il n'y a **aucun** document correspondant à votre recherche.",
                'en': f"There are **no** documents matching your search.",
                'es': f"No hay **ningún** documento que coincida con su búsqueda.",
            }
        else:
            msgs = {
                'fr': f"Il y a **{total}** document(s) correspondant à votre recherche.",
                'en': f"There are **{total}** document(s) matching your search.",
                'es': f"Hay **{total}** documento(s) que coinciden con su búsqueda.",
            }
        blocs = [intro, msgs.get(langue, msgs['fr'])]

        if non_accessibles := donnees.get('non_accessibles'):
            raisons = _analyser_raisons_masquage(donnees.get('filtres', {}), langue)
            blocs.append(
                f"- {non_accessibles} {labels['non_accessibles']} :\n\n{raisons}\n\n"
                f"**{labels['conseil']}** : {labels['conseil_texte']}"
            )
        return "\n\n".join(blocs)

    # ===== TYPE COMPTE SIMPLE (combien de...) =====
    if type_q == 'comptage':
        intro = _generer_intro_contextuelle(question, donnees, prenom, labels, langue)
        msgs = {
            'fr': f"Il y a **{total}** document(s) correspondant à votre recherche.",
            'en': f"There are **{total}** document(s) matching your search.",
            'es': f"Hay **{total}** documento(s) que coinciden con su búsqueda.",
        }
        blocs = [intro, msgs.get(langue, msgs['fr'])]

        if donnees.get('non_accessibles'):
            raisons = _analyser_raisons_masquage(donnees.get('filtres', {}), langue)
            blocs.append(
                f"- {donnees['non_accessibles']} {labels['non_accessibles']} :\n\n{raisons}\n\n"
                f"**{labels['conseil']}** : {labels['conseil_texte']}"
            )
        return "\n\n".join(blocs)

    # ===== TYPE LISTE (défaut) =====
    intro = _generer_intro_contextuelle(question, donnees, prenom, labels, langue)
    blocs = [intro]

    for d in docs:
        lien = f"/documents/{d['document_id']}"
        blocs.append(
            f"- {labels['titre']} : [{d['titre']}]({lien})\n"
            f"  {labels['auteur']} : {d['auteur']}\n"
            f"  {labels['date']} : {d['date']}\n"
            f"  {labels['departement']} : {d['departement']}"
        )

    if total > len(docs):
        blocs.append(f"- … + {total - len(docs)} {labels['et_autres']}.")

    if donnees.get('non_accessibles'):
        raisons = _analyser_raisons_masquage(donnees.get('filtres', {}), langue)
        blocs.append(
            f"- {donnees['non_accessibles']} {labels['non_accessibles']} :\n\n{raisons}\n\n"
            f"**{labels['conseil']}** : {labels['conseil_texte']}"
        )

    return "\n\n".join(blocs)