# OCR (Extraction de texte par Tesseract)

L'extraction de texte OCR des images est assurée côté backend par
**Tesseract** via la bibliothèque Python **pytesseract**.

Elle se manifeste à deux endroits :

1. **Automatique au dépôt** : chaque image déposée est scannée lors du
   pipeline ETL (étape `ocr` du `log_pipeline`). Si Tesseract est absent,
   l'étape est marquée `indisponible` et le dépôt n'est **pas** bloqué.
2. **À la demande** : sur la page de détail d'une image, le menu `⋮` →
   « Extraire le texte » appelle `POST /api/documents/<id>/extraire-texte/`.

Le texte extrait est stocké dans `Document.contenu_texte` et est de fait
**recherchable** (champ inclus dans `search_fields` des documents).

---

## Installation de Tesseract

### Windows (développement local)

1. Télécharger l'installeur officiel :
   https://github.com/UB-Mannheim/tesseract/wiki
   URL directe (dernière version de la branche) :
   https://github.com/UB-Mannheim/tesseract/releases
2. Installer en cochant au minimum les langues **French** et **English**.
3. Installer le paquet Python dans le venv backend :

   ```bash
   cd backend
   venv\Scripts\python.exe -m pip install -r requirements.txt   # inclut pytesseract
   ```

4. Pointer Django vers le binaire (via le fichier `backend/.env`) :

   ```env
   TESSERACT_CMD=C:\Program Files\Tesseract-OCR\tesseract.exe
   ```

   Si Tesseract est déjà dans le `PATH`, cette variable n'est pas requise.

### Linux / serveur

```bash
sudo apt update
sudo apt install -y tesseract-ocr tesseract-ocr-fra tesseract-ocr-eng
```

Vérifier :

```bash
tesseract --version
tesseract --list-langs   # doit lister fra et eng
```

### Vérification de l'intégration

```python
from apps.documents.services import _tesseract_disponible
print(_tesseract_disponible())   # True si Tesseract est joignable
```

---

## Configuration

| Variable           | Fichier `.env` | Défaut       | Rôle                                              |
| ------------------ | -------------- | ------------ | ------------------------------------------------- |
| `TESSERACT_CMD`    | optionnel      | recherche    | Chemin du binaire `tesseract` (nécessaire si hors `PATH`) |
| `TESSERACT_LANGS`  | optionnel      | `fra+eng`    | Langues OCR séparées par `+` (ex. `eng`, `fra+eng`) |

## Comportement si Tesseract est absent

- Le dépôt d'image reste **accepté** (étape `ocr` = `indisponible`).
- La page de détail d'une image → « Extraire le texte » renvoie une erreur
  claire (« le moteur Tesseract n'est pas installé ») avec le statut HTTP **503**,
  affichée telle quelle dans l'interface au lieu d'un message générique.

## Endpoint associé

- `POST /api/documents/<id>/extraire-texte/` (authentifié)
  - Ruth: utilisateur authentifié (respecte les règles de visibilité
    des documents : département, confidentialité).
  - Réponse succès : `{ "texte": "...", "contenu_texte": "..." }`.
  - `400` : le document n'est pas une image.
  - `503` : Tesseract indisponible.