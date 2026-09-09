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
    """Recherche textuelle robuste avec filtres de permissions et seuil de pertinence."""
    assurer_index()
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

    # Seuil relatif : garder seulement les hits >= 55% du meilleur score
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
    """Interroge la base Django selon les filtres détectés dans la question."""
    from django.db.models import Q
    from apps.documents.models import Departement, Document
    from django.contrib.auth.models import User as DjangoUser
    from datetime import date as _date, timedelta as _td

    q = _normaliser(question)
    mots = q.split()
    qs = _qs_docs_pour_user(user)
    filtres = {}

    auj = _date.today()

    # Périodes relatives (prioritaires sur les noms de mois)
    if 'ce mois' in q or 'mois courant' in q or 'this month' in q or 'current month' in q:
        qs = qs.filter(date_depot__month=auj.month, date_depot__year=auj.year)
        filtres['mois'] = NOMS_MOIS_FR[auj.month]
        filtres['annee'] = auj.year
        filtres['periode'] = 'ce_mois'
    elif 'mois dernier' in q or 'last month' in q:
        prec = auj.replace(day=1) - _td(days=1)
        qs = qs.filter(date_depot__month=prec.month, date_depot__year=prec.year)
        filtres['mois'] = NOMS_MOIS_FR[prec.month]
        filtres['annee'] = prec.year
        filtres['periode'] = 'mois_dernier'
    elif 'cette semaine' in q or 'this week' in q:
        debut = auj - _td(days=auj.weekday())
        qs = qs.filter(date_depot__date__gte=debut)
        filtres['periode'] = 'cette_semaine'
    elif 'aujourd hui' in q or 'today' in q:
        qs = qs.filter(date_depot__date=auj)
        filtres['periode'] = 'aujourd_hui'
    elif 'cette annee' in q or 'this year' in q:
        qs = qs.filter(date_depot__year=auj.year)
        filtres['annee'] = auj.year
        filtres['periode'] = 'cette_annee'
    else:
        # Noms de mois explicites (juillet, août...)
        for nom, num in MOIS.items():
            if nom in mots:
                qs = qs.filter(date_depot__month=num)
                filtres['mois'] = nom
                break

    # Année explicite (si pas déjà déduite de la période relative)
    if 'annee' not in filtres:
        m = re.search(r"\b(20\d{2})\b", q)
        if m:
            qs = qs.filter(date_depot__year=int(m.group(1)))
            filtres['annee'] = int(m.group(1))

    # Statut
    if 'rejet' in q:
        qs = qs.filter(statut='rejete'); filtres['statut'] = 'rejete'
    elif 'valid' in q or 'accept' in q:
        qs = qs.filter(statut='valide'); filtres['statut'] = 'valide'
    elif 'en cours' in q or 'attente' in q or 'pending' in q:
        qs = qs.filter(statut='en_cours'); filtres['statut'] = 'en_cours'

    # Format spécifique (PowerPoint, Excel, Word, PDF) — détection par racine
    if _contient(q, 'powerpoint') or 'pptx' in mots or _contient(q, 'presentation') or _contient(q, 'présentation'):
        qs = qs.filter(Q(type_mime__icontains='presentation') | Q(type_mime__icontains='powerpoint'))
        filtres['format'] = 'PowerPoint'
    elif _contient(q, 'excel') or 'xlsx' in mots or 'tableur' in mots or _contient(q, 'spreadsheet'):
        qs = qs.filter(Q(type_mime__icontains='spreadsheet') | Q(type_mime__icontains='excel'))
        filtres['format'] = 'Excel'
    elif _contient(q, 'word') or 'docx' in mots:
        qs = qs.filter(Q(type_mime__icontains='wordprocessing') | Q(type_mime__icontains='msword'))
        filtres['format'] = 'Word'
    elif re.search(r"\bpdf\b", q):
        qs = qs.filter(type_mime='application/pdf')
        filtres['format'] = 'PDF'
    # Groupe (images / scans / médias) — détection par racine (matche singulier ET pluriel)
    elif _contient(q, 'image') or _contient(q, 'photo') or _contient(q, 'scan'):
        qs = qs.filter(Q(groupe='images') | Q(type_source='scan'))
        filtres['groupe'] = 'images+scans'
    elif _contient(q, 'vidéo') or _contient(q, 'video') or _contient(q, 'audio') or _contient(q, 'média') or _contient(q, 'media'):
        qs = qs.filter(groupe='medias')
        filtres['groupe'] = 'medias'

    # Département
    for dept in Departement.objects.all():
        if dept.nom.lower() in q:
            qs = qs.filter(departement=dept)
            filtres['departement'] = dept.nom
            break

    # Auteur
    for u in DjangoUser.objects.filter(is_active=True):
        if u.username.lower() in q or (u.first_name and u.first_name.lower() in q):
            qs = qs.filter(depose_par=u)
            filtres['auteur'] = u.username
            break

    qs = qs.order_by('-date_depot')
    total = qs.count()
    type_question = 'comptage' if any(m in q for m in ['combien', 'nombre', 'how many', 'cuántos', 'cuantos']) else 'liste'

    documents = [{
        'document_id': d.id,
        'titre': d.titre,
        'auteur': d.depose_par.username if d.depose_par else 'Inconnu',
        'date': d.date_depot.strftime('%d/%m/%Y'),
        'departement': d.departement.nom if d.departement else 'N/A',
        'statut': d.statut,
        'groupe': d.groupe,
    } for d in qs[:100]]

    # Compter les documents masqués par les permissions (transparence sans fuite)
    try:
        qs_brut = Document.objects.filter(est_supprime=False)
        
        # Appliquer les mêmes filtres de période relative
        if 'periode' in filtres:
            periode = filtres['periode']
            if periode == 'ce_mois':
                qs_brut = qs_brut.filter(date_depot__month=auj.month, date_depot__year=auj.year)
            elif periode == 'mois_dernier':
                prec = auj.replace(day=1) - _td(days=1)
                qs_brut = qs_brut.filter(date_depot__month=prec.month, date_depot__year=prec.year)
            elif periode == 'cette_semaine':
                debut = auj - _td(days=auj.weekday())
                qs_brut = qs_brut.filter(date_depot__date__gte=debut)
            elif periode == 'aujourd_hui':
                qs_brut = qs_brut.filter(date_depot__date=auj)
            elif periode == 'cette_annee':
                qs_brut = qs_brut.filter(date_depot__year=auj.year)
        else:
            if 'mois' in filtres:
                qs_brut = qs_brut.filter(date_depot__month=MOIS[filtres['mois']])
            if 'annee' in filtres:
                qs_brut = qs_brut.filter(date_depot__year=filtres['annee'])
        
        if 'statut' in filtres:
            qs_brut = qs_brut.filter(statut=filtres['statut'])
        if 'format' in filtres:
            fmt = filtres['format']
            if fmt == 'PowerPoint':
                qs_brut = qs_brut.filter(Q(type_mime__icontains='presentation') | Q(type_mime__icontains='powerpoint'))
            elif fmt == 'Excel':
                qs_brut = qs_brut.filter(Q(type_mime__icontains='spreadsheet') | Q(type_mime__icontains='excel'))
            elif fmt == 'Word':
                qs_brut = qs_brut.filter(Q(type_mime__icontains='wordprocessing') | Q(type_mime__icontains='msword'))
            elif fmt == 'PDF':
                qs_brut = qs_brut.filter(type_mime='application/pdf')
        elif filtres.get('groupe') == 'images+scans':
            qs_brut = qs_brut.filter(Q(groupe='images') | Q(type_source='scan'))
        elif filtres.get('groupe') == 'medias':
            qs_brut = qs_brut.filter(groupe='medias')
        if 'auteur' in filtres:
            qs_brut = qs_brut.filter(depose_par__username=filtres['auteur'])
        if 'departement' in filtres:
            qs_brut = qs_brut.filter(departement__nom=filtres['departement'])
        non_accessibles = max(qs_brut.count() - total, 0)
    except Exception:
        non_accessibles = 0

    return {
        'type': type_question,
        'total': total,
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
    """Format vertical complet avec intro contextuelle et titres cliquables."""
    total = donnees['total']
    docs = donnees['documents']

    langue = _detecter_langue(question)
    labels = _get_labels(langue)

    intro = _generer_intro_contextuelle(question, donnees, prenom, labels, langue)
    blocs = [intro]

    # Liste avec titres cliquables (markdown link)
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