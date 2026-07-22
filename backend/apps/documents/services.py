import io
import magic
from datetime import datetime
from .models import Document, LogAction

# Types de fichiers autorisés (vérifiés par leur contenu réel, pas leur extension)
MIME_TYPES_AUTORISES = [
    # --- Documents ---
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    # --- Images ---
    'image/jpeg',
    'image/png',
    # --- Média ---
    'video/mp4',
    'audio/mpeg',
]

# Regroupement par section de sidebar
GROUPES_MIME = {
    'documents': [
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv',
    ],
    'images': ['image/jpeg', 'image/png'],
    'medias': ['video/mp4', 'audio/mpeg'],
}


def determiner_groupe(type_mime):
    """Renvoie 'documents', 'images' ou 'medias' selon le type MIME."""
    for groupe, types in GROUPES_MIME.items():
        if type_mime in types:
            return groupe
    return None  # Type non autorisé


SIGNATURE_EICAR = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"


def _horodatage():
    return datetime.now().isoformat()


def _ajouter_etape(document, etape, libelle, statut_etape):
    document.log_pipeline.append({
        "etape": etape,
        "libelle": libelle,
        "statut": statut_etape,
        "horodatage": _horodatage() if statut_etape in ("termine", "echec") else None,
    })
    document.save()


def executer_pipeline(document):
    document.tentative_count += 1
    document.statut = Document.Statut.EN_COURS
    document.log_pipeline = []
    document.save()

    # =========================================================
    # LECTURE UNIQUE DU FICHIER DEPUIS LE STOCKAGE (MinIO/disque)
    # =========================================================
    document.fichier.open('rb')
    contenu_fichier = document.fichier.read()
    document.fichier.seek(0)

    # --- Étape 1 : vérification du format (MIME type réel) ---
    _ajouter_etape(document, "format", "Vérification du format", "en_cours")
    type_mime_reel = magic.from_buffer(contenu_fichier, mime=True)
    document.type_mime = type_mime_reel

    if type_mime_reel not in MIME_TYPES_AUTORISES:
        document.log_pipeline[-1]["statut"] = "echec"
        document.log_pipeline[-1]["horodatage"] = _horodatage()
        document.statut = Document.Statut.REJETE
        document.cause_rejet = f"Format non autorisé : {type_mime_reel}"
        document.save()
        LogAction.objects.create(
            document=document, type_action=LogAction.TypeAction.REJET,
            cause=document.cause_rejet,
        )
        return

    document.groupe = determiner_groupe(type_mime_reel)
    document.log_pipeline[-1]["statut"] = "termine"
    document.log_pipeline[-1]["horodatage"] = _horodatage()
    document.save()

    # --- Étape 2 : scan antivirus (signature EICAR pour la démo) ---
    _ajouter_etape(document, "antivirus", "Scan antivirus", "en_cours")
    if SIGNATURE_EICAR in contenu_fichier:
        document.log_pipeline[-1]["statut"] = "echec"
        document.log_pipeline[-1]["horodatage"] = _horodatage()
        document.statut = Document.Statut.REJETE
        document.cause_rejet = "Virus détecté (signature EICAR)"
        document.save()
        LogAction.objects.create(
            document=document, type_action=LogAction.TypeAction.REJET,
            cause=document.cause_rejet,
        )
        return
    document.log_pipeline[-1]["statut"] = "termine"
    document.log_pipeline[-1]["horodatage"] = _horodatage()
    document.save()

    # --- Étape 3 : extraction des métadonnées ---
    _ajouter_etape(document, "metadonnees", "Extraction des métadonnées", "en_cours")
    document.taille_fichier = document.fichier.size

    if type_mime_reel in ('image/jpeg', 'image/png'):
        from PIL import Image
        with Image.open(io.BytesIO(contenu_fichier)) as img:
            document.largeur_px, document.hauteur_px = img.size

    if type_mime_reel in ('video/mp4', 'audio/mpeg'):
        try:
            from mutagen import File as MutagenFile
            audio = MutagenFile(io.BytesIO(contenu_fichier))
            if audio and audio.info.length:
                document.duree = round(audio.info.length, 1)
        except Exception:
            pass

    document.log_pipeline[-1]["statut"] = "termine"
    document.log_pipeline[-1]["horodatage"] = _horodatage()
    document.save()

    # --- Étape 4 : classement automatique ---
    _ajouter_etape(document, "classement", "Classement automatique", "termine")
    # Règle simple : affecter une catégorie selon le groupe
    from .models import Categorie
    nom_categorie = {
        'documents': 'Documents',
        'images': 'Images',
        'medias': 'Médias',
    }.get(document.groupe)
    if nom_categorie:
        cat, _ = Categorie.objects.get_or_create(nom=nom_categorie)
        document.categorie = cat
    document.log_pipeline[-1]["horodatage"] = _horodatage()
    document.save()

    # --- Étape 5 : tagging automatique ---
    _ajouter_etape(document, "tagging", "Tagging automatique", "termine")
    from .models import Tag
    tags_auto = []
    if document.type_source == 'scan':
        t, _ = Tag.objects.get_or_create(nom='scanne')
        tags_auto.append(t)
    if document.groupe == 'images':
        sous_type = type_mime_reel.split('/')[-1].upper()
        t, _ = Tag.objects.get_or_create(nom=sous_type)
        tags_auto.append(t)
    if tags_auto:
        document.tags.add(*tags_auto)
    document.log_pipeline[-1]["horodatage"] = _horodatage()
    document.save()

    # --- Étape 6 : indexation du contenu ---
    _ajouter_etape(document, "indexation", "Indexation du contenu", "en_cours")
    if type_mime_reel == 'text/plain':
        document.contenu_texte = contenu_fichier.decode(errors='ignore')
    elif type_mime_reel == 'application/pdf':
        try:
            import PyPDF2
            reader = PyPDF2.PdfReader(io.BytesIO(contenu_fichier))
            text = ""
            for page in reader.pages:
                text += page.extract_text()
            document.contenu_texte = text
        except Exception:
            pass
    document.log_pipeline[-1]["statut"] = "termine"
    document.log_pipeline[-1]["horodatage"] = _horodatage()
    document.save()

    # --- Étape 7 : chargement final (stockage validé) ---
    _ajouter_etape(document, "chargement", "Chargement final (MinIO)", "termine")
    document.log_pipeline[-1]["horodatage"] = _horodatage()

    # --- Fin du pipeline : document validé ---
    document.statut = Document.Statut.VALIDE
    document.save()
