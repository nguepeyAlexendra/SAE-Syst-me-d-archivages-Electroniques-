import io
import magic
from datetime import datetime
from .models import Document, LogAction
from django.core.files.base import ContentFile

# ✅ Support des images HEIC/HEIF (iPhone)
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
    HEIF_DISPONIBLE = True
except ImportError:
    HEIF_DISPONIBLE = False  # Les autres formats fonctionneront quand même


# ---------------------------------------------------------------------------
# GROUPES_MIME est la SEULE source de vérité. MIME_TYPES_AUTORISES en est
# dérivé automatiquement pour qu'il soit IMPOSSIBLE que les deux se
# désynchronisent.
# ---------------------------------------------------------------------------
GROUPES_MIME = {
    'documents': [
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
        'text/plain', 'text/csv',
        'application/rtf', 'text/rtf',
        'application/vnd.oasis.opendocument.text',
        'application/vnd.oasis.opendocument.spreadsheet',
        'application/vnd.oasis.opendocument.presentation',
        'application/zip',
        'application/x-zip-compressed',
    ],
    'images': [
        'image/jpeg', 'image/png', 'image/heic', 'image/heif',
        'image/webp', 'image/gif', 'image/bmp', 'image/tiff', 'image/tif',
    ],
    'medias': [
        'video/mp4', 'video/quicktime',
        'video/x-matroska',
        'video/x-msvideo',
        'audio/mpeg', 'audio/wav', 'audio/wave', 'audio/x-wav',
        'audio/mp4', 'audio/x-m4a',
        'audio/ogg',
    ],
}

MIME_TYPES_AUTORISES = [m for groupe in GROUPES_MIME.values() for m in groupe]
EXTENSIONS_HEIC = ('.heic', '.heif')
SIGNATURE_EICAR = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"


def determiner_groupe(type_mime):
    """Renvoie 'documents', 'images' ou 'medias' selon le type MIME."""
    for groupe, types in GROUPES_MIME.items():
        if type_mime in types:
            return groupe
    return None


def _horodatage():
    return datetime.now().isoformat()


def _tesseract_disponible():
    """Renvoie True si le moteur Tesseract est installé et joignable, sinon False."""
    try:
        import pytesseract
    except ImportError:
        return False
    from django.conf import settings
    cmd = getattr(settings, 'TESSERACT_CMD', None)
    if cmd:
        pytesseract.pytesseract.tesseract_cmd = cmd
    try:
        pytesseract.get_tesseract_version()
        return True
    except Exception:
        return False


def _extraire_texte_ocr(contenu_fichier):
    """Extrait le texte d'une image (octets) via Tesseract OCR.
    Lève une RuntimeError si Tesseract est absent ; sinon renvoie le texte (str)."""
    if not _tesseract_disponible():
        raise RuntimeError("Tesseract (moteur OCR) n'est pas installé sur le serveur.")

    import pytesseract
    from django.conf import settings
    from PIL import Image, ImageFilter, ImageOps

    try:
        langue = getattr(settings, 'TESSERACT_LANGS', 'fra+eng')
        with Image.open(io.BytesIO(contenu_fichier)) as img:
            img = img.convert('L').filter(ImageFilter.SHARPEN)
            largeur, hauteur = img.size
            if min(largeur, hauteur) < 2000:
                facteur = max(2, int(2000 / min(largeur, hauteur)))
                img = img.resize((largeur * facteur, hauteur * facteur), Image.LANCZOS)
            texte = pytesseract.image_to_string(img, lang=langue, config='--psm 6')
    except pytesseract.TesseractError:
        texte = ""
    except Exception:
        texte = ""
    return (texte or "").strip()


def extraire_texte_ocr_document(document):
    """Lit le fichier MinIO du document, exécute l'OCR et persiste le texte
    dans document.contenu_texte. Renvoie le texte extrait."""
    if not _tesseract_disponible():
        raise RuntimeError("Tesseract (moteur OCR) n'est pas installé sur le serveur.")

    document.fichier.open('rb')
    try:
        contenu_fichier = document.fichier.read()
    finally:
        document.fichier.close()

    texte = _extraire_texte_ocr(contenu_fichier)
    document.contenu_texte = texte
    document.save(update_fields=['contenu_texte'])
    return texte


def _ajouter_etape(document, etape, libelle, statut_etape):
    document.log_pipeline.append({
        "etape": etape,
        "libelle": libelle,
        "statut": statut_etape,
        "horodatage": _horodatage() if statut_etape in ("termine", "echec") else None,
    })
    document.save()


def _corriger_detection_heic(type_mime_reel, contenu_fichier, nom_fichier):
    if not HEIF_DISPONIBLE:
        return type_mime_reel

    if type_mime_reel in ('image/heic', 'image/heif'):
        return type_mime_reel

    ext = nom_fichier.lower()
    if not ext.endswith(EXTENSIONS_HEIC):
        return type_mime_reel

    try:
        from PIL import Image
        with Image.open(io.BytesIO(contenu_fichier)) as img:
            img.verify()
        return 'image/heic'
    except Exception:
        return type_mime_reel


def executer_pipeline(document, groupe_attendu=None):
    document.tentative_count += 1
    document.statut = Document.Statut.EN_COURS
    document.log_pipeline = []
    document.save()

    document.fichier.open('rb')
    try:
        contenu_fichier = document.fichier.read()
    finally:
        document.fichier.close()

    # --- Étape 1 : vérification du format ---
    _ajouter_etape(document, "format", "Vérification du format", "en_cours")
    type_mime_reel = magic.from_buffer(contenu_fichier, mime=True)
    type_mime_reel = _corriger_detection_heic(type_mime_reel, contenu_fichier, document.fichier.name)
    document.type_mime = type_mime_reel

    if type_mime_reel not in MIME_TYPES_AUTORISES:
        document.log_pipeline[-1]["statut"] = "echec"
        document.log_pipeline[-1]["horodatage"] = _horodatage()
        document.statut = Document.Statut.REJETE
        document.cause_rejet = f"Format non autorisé : {type_mime_reel}"
        document.cause_rejet_en = f"Unauthorized format: {type_mime_reel}"
        document.save()
        LogAction.objects.create(document=document, type_action=LogAction.TypeAction.REJET,
                                 cause=document.cause_rejet, cause_en=document.cause_rejet_en)
        return

    groupe_reel = determiner_groupe(type_mime_reel)
    if groupe_attendu and groupe_reel != groupe_attendu:
        document.log_pipeline[-1]["statut"] = "echec"
        document.log_pipeline[-1]["horodatage"] = _horodatage()
        document.statut = Document.Statut.REJETE
        document.cause_rejet = f"Format incorrect pour ce formulaire. Un fichier de type '{groupe_attendu}' était attendu."
        document.cause_rejet_en = f"Incorrect format for this form. A '{groupe_attendu}' type file was expected."
        document.save()
        LogAction.objects.create(document=document, type_action=LogAction.TypeAction.REJET,
                                 cause=document.cause_rejet, cause_en=document.cause_rejet_en)
        return

    document.groupe = groupe_reel
    document.log_pipeline[-1]["statut"] = "termine"
    document.log_pipeline[-1]["horodatage"] = _horodatage()
    document.save()

    # --- Étape 2 : scan antivirus (test EICAR) ---
    _ajouter_etape(document, "antivirus", "Scan antivirus", "en_cours")
    if SIGNATURE_EICAR in contenu_fichier:
        document.log_pipeline[-1]["statut"] = "echec"
        document.log_pipeline[-1]["horodatage"] = _horodatage()
        document.statut = Document.Statut.REJETE
        document.cause_rejet = "Fichier rejeté : signature virale détectée (test EICAR)."
        document.cause_rejet_en = "File rejected: viral signature detected (EICAR test)."
        document.save()
        LogAction.objects.create(document=document, type_action=LogAction.TypeAction.REJET,
                                 cause=document.cause_rejet, cause_en=document.cause_rejet_en)
        return
    document.log_pipeline[-1]["statut"] = "termine"
    document.log_pipeline[-1]["horodatage"] = _horodatage()
    document.save()

    # --- Étape 3 : extraction des métadonnées ---
    _ajouter_etape(document, "metadonnees", "Extraction des métadonnées", "en_cours")
    document.taille_fichier = document.fichier.size

    if type_mime_reel.startswith('image/'):
        try:
            from PIL import Image
            with Image.open(io.BytesIO(contenu_fichier)) as img:
                document.largeur_px, document.hauteur_px = img.size
        except Exception:
            pass

    if type_mime_reel.startswith(('video/', 'audio/')):
        try:
            from mutagen import File as MutagenFile
            media_info = MutagenFile(io.BytesIO(contenu_fichier))
            if media_info and hasattr(media_info.info, 'length') and media_info.info.length:
                document.duree = round(media_info.info.length, 1)
        except Exception:
            pass

    document.log_pipeline[-1]["statut"] = "termine"
    document.log_pipeline[-1]["horodatage"] = _horodatage()
    document.save()

    # --- Étape 3b : OCR automatique des images (best-effort, non bloquant) ---
    if groupe_reel == 'images':
        _ajouter_etape(document, "ocr", "Extraction de texte (OCR)", "en_cours")
        try:
            texte_ocr = _extraire_texte_ocr(contenu_fichier)
            if texte_ocr:
                document.contenu_texte = texte_ocr
            document.log_pipeline[-1]["statut"] = "termine"
        except RuntimeError:
            # Tesseract absent : on ne bloque pas le dépôt, l'étape est marquée comme indisponible
            document.log_pipeline[-1]["statut"] = "indisponible"
            document.log_pipeline[-1]["libelle"] += " (Tesseract non installé)"
        except Exception:
            document.log_pipeline[-1]["statut"] = "echec"
        document.log_pipeline[-1]["horodatage"] = _horodatage()
        document.save()

    # --- Étape 4 : tagging automatique contextuel ---
    _ajouter_etape(document, "tagging", "Tagging automatique", "en_cours")
    from .models import Tag
    from datetime import datetime

    tags_auto = []

   
   
    # 2. Format du fichier (Ajouté selon le type MIME réel)
    if document.groupe == 'images':
        sous_type = type_mime_reel.split('/')[-1].upper() # ex: JPEG, PNG
        t, _ = Tag.objects.get_or_create(nom=sous_type, defaults={'couleur': '#10b981'}) # Vert
        tags_auto.append(t)
    elif type_mime_reel == 'application/pdf':
        t, _ = Tag.objects.get_or_create(nom='PDF', defaults={'couleur': '#ef4444'}) # Rouge
        tags_auto.append(t)
    elif 'spreadsheet' in type_mime_reel or 'excel' in type_mime_reel:
        t, _ = Tag.objects.get_or_create(nom='Excel', defaults={'couleur': '#10b981'}) # Vert
        tags_auto.append(t)

    # 3. Source (Ajouté UNIQUEMENT si c'est un scan)
    if document.type_source == 'scan':
        t, _ = Tag.objects.get_or_create(nom='Scanné', defaults={'couleur': '#6b7280'}) # Gris
        tags_auto.append(t)

    # Ajouter tous les tags automatiques au document
    if tags_auto:
        document.tags.add(*tags_auto)

    document.log_pipeline[-1]["statut"] = "termine"
    document.log_pipeline[-1]["horodatage"] = _horodatage()
    document.save()

        # --- Étape 5b : génération de la miniature (TOUS formats) ---
    _ajouter_etape(document, "miniature", "Génération de la miniature", "en_cours")
    try:
        from .utils_miniatures import generer_miniature
        
        jpeg_bytes = generer_miniature(contenu_fichier, document.fichier.name)
        if jpeg_bytes:
            nom_miniature = f"miniature_{document.id}.jpg"
            document.miniature.save(nom_miniature, ContentFile(jpeg_bytes), save=False)
            document.log_pipeline[-1]["statut"] = "termine"
        else:
            document.log_pipeline[-1]["statut"] = "indisponible"
            document.log_pipeline[-1]["libelle"] += " (aperçu non disponible)"
    except Exception as e:
        print(f"Echec generation miniature {document.id}: {e}")
        document.log_pipeline[-1]["statut"] = "echec"
    
    document.log_pipeline[-1]["horodatage"] = _horodatage()
    document.save()

    # --- Étape 6 : chargement final (stockage validé) ---
    _ajouter_etape(document, "chargement", "Chargement final (MinIO)", "en_cours")
    document.log_pipeline[-1]["statut"] = "termine"
    document.log_pipeline[-1]["horodatage"] = _horodatage()
    document.save()

    # --- Fin du pipeline : document validé ---
    document.statut = Document.Statut.VALIDE
    document.save()
    LogAction.objects.create(document=document, type_action=LogAction.TypeAction.VALIDATION,
                             cause="Document validé et indexé avec succès",
                             cause_en="Document validated and indexed successfully")