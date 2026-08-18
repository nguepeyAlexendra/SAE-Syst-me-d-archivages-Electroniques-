import io
import subprocess
import sys
import tempfile
import shutil
from pathlib import Path

import fitz  # PyMuPDF (déjà installé)
from PIL import Image

EXTENSIONS_IMAGES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".tif", ".heic", ".heif"}
EXTENSIONS_BUREAU = {
    ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".odt", ".ods", ".odp", ".rtf", ".txt", ".csv"
}


def generer_miniature(contenu: bytes, nom_fichier: str):
    """
    Génère une miniature JPEG pour n'importe quel format supporté.
    - Images : redimensionne et convertit en JPEG
    - PDF : extrait la 1ère page
    - Bureau (docx, xlsx, pptx, txt, etc.) : convertit via LibreOffice en PDF, puis extrait la 1ère page
    Renvoie les octets JPEG ou None si impossible.
    """
    suffixe = Path(nom_fichier).suffix.lower()

    # 1) Image → miniature directe
    if suffixe in EXTENSIONS_IMAGES:
        try:
            img = Image.open(io.BytesIO(contenu))
            img.thumbnail((900, 900))
            buf = io.BytesIO()
            img.convert("RGB").save(buf, "JPEG", quality=85)
            return buf.getvalue()
        except Exception as e:
            print(f"⚠️ Miniature image impossible ({nom_fichier}) : {e}")
            return None

    # 2) PDF → 1ère page
    if suffixe == ".pdf":
        return _pdf_vers_jpeg(contenu)

    # 3) Bureau / texte → LibreOffice → PDF → 1ère page
    if suffixe in EXTENSIONS_BUREAU:
        pdf = _convertir_via_libreoffice(contenu, nom_fichier)
        if pdf:
            return _pdf_vers_jpeg(pdf)
        return None

    return None


def _pdf_vers_jpeg(contenu: bytes, dpi: int = 120):
    """Extrait la 1ère page d'un PDF en JPEG."""
    try:
        doc = fitz.open(stream=contenu, filetype="pdf")
        if len(doc) == 0:
            return None
        pix = doc[0].get_pixmap(dpi=dpi)
        return pix.tobytes("jpeg")
    except Exception as e:
        print(f"⚠️ Lecture PDF impossible : {e}")
        return None


def _trouver_libreoffice():
    """Cherche l'exécutable LibreOffice sur le système."""
    for cmd in (
        "soffice",
        "libreoffice",
        r"C:\Program Files\LibreOffice\program\soffice.exe",
        r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    ):
        if shutil.which(cmd) or Path(cmd).exists():
            return cmd
    return None


def _convertir_via_libreoffice(contenu: bytes, nom_fichier: str):
    """Convertit un document bureau en PDF via LibreOffice headless."""
    soffice = _trouver_libreoffice()
    if not soffice:
        print(f"⚠️ LibreOffice introuvable → pas de miniature pour {nom_fichier}")
        return None

    with tempfile.TemporaryDirectory() as tmp:
        nom_simple = Path(nom_fichier).name 
        src = Path(tmp) / nom_simple
        src.write_bytes(contenu)
        
        kwargs = {}
        if sys.platform == "win32":
            si = subprocess.STARTUPINFO()
            si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
            kwargs["startupinfo"] = si
        
        try:
            subprocess.run(
                [soffice, "--headless", "--convert-to", "pdf", "--outdir", tmp, str(src)],
                capture_output=True,
                timeout=90,
                **kwargs,
            )
            pdf_path = Path(tmp) / (Path(nom_simple).stem + ".pdf")
            if pdf_path.exists():
                return pdf_path.read_bytes()
            print(f"⚠️ Conversion LibreOffice sans résultat pour {nom_fichier}")
        except Exception as e:
            print(f"❌ Conversion LibreOffice échouée ({nom_fichier}) : {e}")
    
    return None

def generer_apercu_pdf(contenu: bytes, nom_fichier: str):
    """
    🆕 Renvoie les octets d'un PDF d'aperçu pour les fichiers Office
    (docx, pptx, xlsx, odt…), ou None pour les autres formats.
    """
    suffixe = Path(nom_fichier).suffix.lower()
    if suffixe not in EXTENSIONS_BUREAU:
        return None
    return _convertir_via_libreoffice(contenu, nom_fichier)