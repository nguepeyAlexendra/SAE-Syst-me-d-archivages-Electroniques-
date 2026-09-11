"""Agent scanner Canon iR-ADV — mode Scan-to-Folder (SMB)."""
import base64
import time
import threading
from pathlib import Path

import fitz  # PyMuPDF
from flask import Flask, jsonify
from flask_cors import CORS
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

app = Flask(__name__)
CORS(app)

SCAN_FOLDER = Path(r'C:\ScansSAE')
SCAN_FOLDER.mkdir(exist_ok=True)

EXTENSIONS = {'.jpg', '.jpeg', '.png', '.tif', '.tiff', '.pdf'}
DPI_APERCU = 150
FENETRE_LOT = 4.0   # secondes sans nouveau fichier = scan terminé

FILETYPE = {'.jpg': 'jpg', '.jpeg': 'jpg', '.png': 'png',
            '.tif': 'tif', '.tiff': 'tif', '.pdf': 'pdf'}

verrou = threading.Lock()
etat = {'scan': None, 'consomme_le': 0}
lot = {'images': [], 'dernier': 0.0}   # images en attente d'assemblage


def lire_avec_retry(chemin: Path, max_tentatives=15, delai=0.8):
    """Réessaie jusqu'à ce que Windows libère le fichier (verrou SMB)."""
    derniere_erreur = None
    for i in range(max_tentatives):
        try:
            return chemin.read_bytes()
        except PermissionError as e:
            derniere_erreur = e
            print(f'   🔒 Fichier verrouillé, tentative {i+1}/{max_tentatives}…')
            time.sleep(delai)
        except FileNotFoundError:
            return None
    raise derniere_erreur


def attendre_ecriture_stable(chemin: Path, checks=3, delai=0.7):
    prec, stables = -1, 0
    while stables < checks:
        try:
            taille = chemin.stat().st_size
        except OSError:
            taille = -1
        stables = stables + 1 if (taille == prec and taille > 0) else 0
        prec = taille
        time.sleep(delai)


def construire_pdf(entrees):
    """Convertit une liste de (contenu, suffixe) en UN PDF multi-pages."""
    doc = fitz.open()
    for contenu, suffixe in entrees:
        img = fitz.open(stream=contenu, filetype=FILETYPE[suffixe])
        pdf_part = img.convert_to_pdf()      # image/TIFF → PDF
        img.close()
        tmp = fitz.open(stream=pdf_part, filetype='pdf')
        doc.insert_pdf(tmp)                  # ajoute toutes les pages
        tmp.close()
    out = doc.tobytes()
    doc.close()
    return out


def extraire_pages(contenu_pdf):
    """Aperçus JPEG de TOUTES les pages du PDF final."""
    pages = []
    try:
        doc = fitz.open(stream=contenu_pdf, filetype='pdf')
        pages = [p.get_pixmap(dpi=DPI_APERCU).tobytes('jpeg') for p in doc]
        doc.close()
    except Exception as e:
        print(f'⚠️ Extraction aperçus impossible : {e}')
    if not pages:
        pages = [contenu_pdf]
    return pages


def finaliser_scan(contenu_pdf, chemins):
    pages = extraire_pages(contenu_pdf)
    with verrou:
        etat['scan'] = {
            'chemins': chemins,
            'format': 'pdf',
            'pages': pages,
            'original': contenu_pdf,
            'mime_original': 'application/pdf',
            'ts': time.time(),
        }
    print(f'✅ Scan prêt : {len(pages)} page(s) au format PDF')


class ScanHandler(FileSystemEventHandler):
    def on_created(self, event):
        if event.is_directory:
            return
        chemin = Path(event.src_path)
        suffixe = chemin.suffix.lower()
        if suffixe not in EXTENSIONS:
            return

        print(f'📥 Nouveau fichier détecté : {chemin.name}')
        attendre_ecriture_stable(chemin)
        try:
            contenu = lire_avec_retry(chemin)
            if contenu is None:
                return
        except Exception as e:
            print(f'❌ Impossible de lire {chemin.name} : {e}')
            return

        if suffixe == '.pdf':
            # La Canon envoie déjà un PDF → tel quel
            finaliser_scan(contenu, [chemin])
        else:
            # Image → ajoutée au lot, l'assembleur fera le PDF
            with verrou:
                lot['images'].append((contenu, suffixe))
                lot['chemins'] = lot.get('chemins', []) + [chemin]
                lot['dernier'] = time.time()
            print(f'🖼️ Image ajoutée au lot ({len(lot["images"])} page(s) pour l\'instant)')


def assembleur():
    """Thread qui attend la fin du lot puis assemble le PDF multi-pages."""
    while True:
        time.sleep(0.5)
        with verrou:
            pret = (lot['images'] and time.time() - lot['dernier'] > FENETRE_LOT)
            if pret:
                entrees = list(lot['images'])
                chemins = list(lot.get('chemins', []))
                lot['images'], lot['chemins'] = [], []
        if pret:
            try:
                print(f'📄 Assemblage de {len(entrees)} image(s) en un seul PDF…')
                pdf = construire_pdf(entrees)
                finaliser_scan(pdf, chemins)
            except Exception as e:
                print(f'❌ Erreur assemblage : {e}')


threading.Thread(target=assembleur, daemon=True).start()

observer = Observer()
observer.schedule(ScanHandler(), str(SCAN_FOLDER), recursive=False)
observer.daemon = True
observer.start()


def reponse_scan(s):
    for ch in s['chemins']:
        for _ in range(5):
            try:
                ch.unlink()
                break
            except PermissionError:
                time.sleep(0.5)
    return jsonify({
        'nom': s['chemins'][0].name,
        'format': s['format'],
        'nb_pages': len(s['pages']),
        'pages': [base64.b64encode(p).decode() for p in s['pages']],
        'original': base64.b64encode(s['original']).decode(),
        'mime_original': s['mime_original'],
    })


@app.route('/scan', methods=['POST'])
def scan():
    print('⏳ En attente d\'un scan depuis la Canon…')
    debut = time.time()
    while time.time() - debut < 3600:
        with verrou:
            s = etat['scan']
            if s and s['ts'] > etat['consomme_le']:
                etat['consomme_le'] = s['ts']
                return reponse_scan(s)
        time.sleep(0.5)
    return jsonify({'error': 'Aucun scan reçu en 60 minutes'}), 504


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok', 'scan_folder': str(SCAN_FOLDER)})


if __name__ == '__main__':
    print('🖨️  Agent scanner Canon iR-ADV démarré (conversion PDF auto)')
    print(f'   Dossier surveillé : {SCAN_FOLDER}')
    app.run(host='127.0.0.1', port=7777, debug=False, threaded=True)