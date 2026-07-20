import io
import magic
from datetime import datetime
from .models import Document

# Types de fichiers autorisés (vérifiés par leur contenu réel, pas leur extension)
MIME_TYPES_AUTORISES = [
    # --- Documents ---
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',  # PowerPoint
    'text/plain',
    'text/csv',
    # --- Images ---
    'image/jpeg',
    'image/png',
    # --- Média ---
    'video/mp4',
    'audio/mpeg',  # MP3
    # --- Autres ---
    'application/zip',
]

# Regroupement par section de sidebar, utilisé pour classer un document automatiquement
GROUPES_MIME = {
    'documents': [
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv',
    ],
    'images': ['image/jpeg', 'image/png'],
    'media': ['video/mp4', 'audio/mpeg'],
    'autres': ['application/zip'],
}


def determiner_groupe(type_mime):
    """Renvoie 'documents', 'images', 'media' ou 'autres' selon le type MIME."""
    for groupe, types in GROUPES_MIME.items():
        if type_mime in types:
            return groupe
    return 'autres'

# Signature du fichier de test EICAR (standard international, inoffensif,
# reconnu par tous les antivirus comme "menace de test")
SIGNATURE_EICAR = b"X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"


def _horodatage():
    return datetime.now().isoformat()


def _ajouter_etape(document, etape, libelle, statut_etape):
    """Ajoute une étape au log_pipeline du document et la sauvegarde immédiatement,
    pour que le frontend (qui interroge l'API régulièrement) voie la progression au fur et à mesure."""
    document.log_pipeline.append({
        "etape": etape,
        "libelle": libelle,
        "statut": statut_etape,
        "horodatage": _horodatage() if statut_etape in ("termine", "echec") else None,
    })
    document.save()


def executer_pipeline(document):
    """
    Fait passer un document par toutes les étapes du pipeline ETL.
    Pour l'instant, exécution directe (synchrone) — Kafka viendra rendre
    ce traitement asynchrone plus tard, sans changer cette logique.
    """
    document.statut = Document.Statut.EN_COURS
    document.log_pipeline = []
    document.save()

    # =========================================================
    # LECTURE UNIQUE DU FICHIER DEPUIS MINIO (en mémoire)
    # On évite ainsi de re-télécharger le fichier à chaque étape
    # =========================================================
    document.fichier.open('rb')
    contenu_fichier = document.fichier.read()
    document.fichier.seek(0)  # Remet le curseur au début pour la suite

    # --- Étape 1 : vérification du format (MIME type réel) ---
    _ajouter_etape(document, "format", "Format vérifié", "en_cours")
    type_mime_reel = magic.from_buffer(contenu_fichier, mime=True)
    document.type_mime = type_mime_reel

    if type_mime_reel not in MIME_TYPES_AUTORISES:
        document.log_pipeline[-1]["statut"] = "echec"
        document.log_pipeline[-1]["horodatage"] = _horodatage()
        document.statut = Document.Statut.REJETE
        document.save()
        return
    document.log_pipeline[-1]["statut"] = "termine"
    document.log_pipeline[-1]["horodatage"] = _horodatage()
    document.save()

    # --- Étape 2 : scan antivirus (détection de la signature EICAR pour la démo) ---
    _ajouter_etape(document, "antivirus", "Antivirus", "en_cours")
    # ✅ CORRECTION : on réutilise contenu_fichier au lieu de rouvrir le fichier
    if SIGNATURE_EICAR in contenu_fichier:
        document.log_pipeline[-1]["statut"] = "echec"
        document.log_pipeline[-1]["horodatage"] = _horodatage()
        document.statut = Document.Statut.REJETE
        document.save()
        return
    document.log_pipeline[-1]["statut"] = "termine"
    document.log_pipeline[-1]["horodatage"] = _horodatage()
    document.save()

    # --- Étape 3 : extraction des métadonnées ---
    _ajouter_etape(document, "metadonnees", "Extraction métadonnées", "en_cours")
    document.taille_fichier = document.fichier.size
    document.groupe = determiner_groupe(type_mime_reel)

    # Dimensions, uniquement pour les images
    # ✅ CORRECTION : on utilise io.BytesIO pour lire l'image depuis la mémoire
    if type_mime_reel in ('image/jpeg', 'image/png'):
        from PIL import Image
        with Image.open(io.BytesIO(contenu_fichier)) as img:
            document.largeur_px, document.hauteur_px = img.size

    document.log_pipeline[-1]["statut"] = "termine"
    document.log_pipeline[-1]["horodatage"] = _horodatage()
    document.save()

    # --- Étape 4 : classement automatique (règle simple pour l'instant) ---
    _ajouter_etape(document, "classement", "Classement automatique", "termine")

    # --- Étape 5 : indexation du contenu (l'OCR viendra enrichir cette étape) ---
    _ajouter_etape(document, "indexation", "Indexation du contenu", "en_cours")
    if type_mime_reel == 'text/plain':
        # ✅ CORRECTION : on réutilise contenu_fichier au lieu de contenu_brut
        document.contenu_texte = contenu_fichier.decode(errors='ignore')
    document.log_pipeline[-1]["statut"] = "termine"
    document.log_pipeline[-1]["horodatage"] = _horodatage()

    # --- Fin du pipeline : document validé ---
    document.statut = Document.Statut.VALIDE
    document.save()