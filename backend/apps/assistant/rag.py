import io, requests
from elasticsearch import Elasticsearch

ES = Elasticsearch("http://localhost:9200")
OLLAMA = "http://localhost:11434"
INDEX = "sae_chunks"

def assurer_index():
    if not ES.indices.exists(index=INDEX):
        ES.indices.create(index=INDEX, mappings={"properties": {
            "document_id": {"type": "integer"},
            "titre": {"type": "text"},
            "texte": {"type": "text"},
            "vecteur": {"type": "dense_vector", "dims": 768, "index": True, "similarity": "cosine"},
        }})

def extraire_texte(contenu, type_mime):
    texte = ""
    try:
        if type_mime == 'application/pdf':
            import fitz
            doc = fitz.open(stream=contenu, filetype='pdf')
            texte = "\n".join(p.get_text() for p in doc)
        elif 'wordprocessing' in type_mime or type_mime=='application/msword':
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
            chunks.append(" ".join(cur)); cur = cur[-50:]
    if cur: chunks.append(" ".join(cur))
    return [c for c in chunks if len(c) > 40]

def embedder(textes):
    try:
        r = requests.post(f"{OLLAMA}/api/embed", json={"model":"nomic-embed-text","input":textes}, timeout=120)
        return r.json()["embeddings"]
    except Exception:
        r = requests.post(f"{OLLAMA}/api/embeddings", json={"model":"nomic-embed-text","prompt":textes[0]}, timeout=120)
        return [r.json()["embedding"]]

def indexer_document(document):
    assurer_index()
    document.fichier.open('rb'); contenu = document.fichier.read(); document.fichier.close()
    texte = document.contenu_texte or extraire_texte(contenu, document.type_mime)
    if not texte: return 0
    chunks = decouper(texte)
    if not chunks: return 0
    vecs = embedder(chunks)
    for i, chunk in enumerate(chunks):
        ES.index(index=INDEX, document={
            "document_id": document.id, "titre": document.titre,
            "texte": chunk, "vecteur": vecs[i] if i < len(vecs) else vecs[0],
        })
    return len(chunks)

def recherche(question, k=5):
    assurer_index()
    vec = embedder([question])[0]
    res = ES.search(index=INDEX, size=k,
        query={"match": {"texte": question}},
        knn={"field": "vecteur", "query_vector": vec, "k": k, "num_candidates": 20})
    return [h["_source"] for h in res["hits"]["hits"]]

def generer(question, chunks, prenom):
    contexte = "\n---\n".join(f"[{c['titre']}] {c['texte']}" for c in chunks)
    prompt = (f"Tu es l'assistant du SAE. L'utilisateur s'appelle {prenom}. "
              f"Réponds UNIQUEMENT à partir des extraits ci-dessous, de façon concise, "
              f"DANS LA MÊME LANGUE QUE LA QUESTION. "
              f"Si la réponse n'y est pas, dis-le poliment dans la langue de la question.\n\n"
              f"EXTRAITS :\n{contexte}\n\nQUESTION : {question}")
    try:
        r = requests.post(
            f"{OLLAMA}/api/generate",
            json={"model": "llama3.2:3b", "prompt": prompt, "stream": False},
            timeout=180
        )
        data = r.json()
        if "response" in data:
            return data["response"]
        elif "error" in data:
            return f"⚠️ Erreur Ollama : {data['error']}"
        else:
            return f"⚠️ Réponse Ollama inattendue : {str(data)[:200]}"
    except requests.exceptions.ConnectionError:
        return "⚠️ Ollama ne répond pas. Vérifie qu'il est lancé (icône dans la barre des tâches)."
    except requests.exceptions.Timeout:
        return "⚠️ Ollama a mis trop de temps à répondre (> 3 min)."
    except Exception as e:
        return f"⚠️ Erreur inattendue : {e}"