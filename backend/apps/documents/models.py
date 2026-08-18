import os

from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone


# 🆕 Types de fichiers → dossiers
EXTENSIONS_IMAGES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp"}
EXTENSIONS_MEDIAS = {".mp4", ".mp3", ".ogg", ".wav", ".mov", ".mkv", ".avi"}


def groupe_de(nom_fichier):
    """Renvoie le dossier (documents / images / medias) selon l'extension."""
    ext = os.path.splitext(nom_fichier)[1].lower()
    if ext in EXTENSIONS_IMAGES:
        return "images"
    if ext in EXTENSIONS_MEDIAS:
        return "medias"
    return "documents"


# Nom technique du fichier dans MinIO :
# même contenu (sha256 identique) => même nom => déduplication
# et rangement par type + mois : <type>/AAAA/MM/<hash>.<ext>
def document_upload_to(instance, filename):
    ext = os.path.splitext(filename)[1].lower()
    nom = instance.sha256 or os.path.splitext(filename)[0]
    return f"{groupe_de(filename)}/{timezone.now():%Y/%m}/{nom}{ext}"


class Categorie(models.Model):
    nom = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.nom

    class Meta:
        verbose_name = "Catégorie"
        verbose_name_plural = "Catégories"


class Departement(models.Model):
    nom = models.CharField(max_length=100, unique=True)
    nom_en = models.CharField(max_length=100, blank=True, default='')
    description = models.TextField(blank=True)

    def __str__(self):
        return self.nom

    class Meta:
        verbose_name = "Département"
        verbose_name_plural = "Départements"


class Tag(models.Model):
    nom = models.CharField(max_length=50, unique=True)
    couleur = models.CharField(max_length=7, blank=True, default='#6366f1')

    def __str__(self):
        return self.nom


class Document(models.Model):
    class TypeSource(models.TextChoices):
        NUMERIQUE = 'numerique', 'Fichier numérique'
        SCAN_PHYSIQUE = 'scan', 'Document papier scanné'

    class Statut(models.TextChoices):
        EN_ATTENTE = 'en_attente', 'En attente de traitement'
        EN_COURS = 'en_cours', 'Traitement en cours (ETL)'
        VALIDE = 'valide', 'Validé et indexé'
        REJETE = 'rejete', 'Rejeté'

    titre = models.CharField(max_length=255)

    # upload_to branché sur la fonction de nommage par empreinte + type + mois
    fichier = models.FileField(upload_to=document_upload_to)

    # Empreinte du contenu (déduplication)
    sha256 = models.CharField(
        max_length=64, blank=True, db_index=True,
        help_text="Empreinte du contenu : même contenu = 1 seul fichier dans MinIO"
    )

    miniature = models.ImageField(
        upload_to='miniatures/%Y/%m/',
        null=True,
        blank=True,
        help_text="Aperçu généré automatiquement (1ère page pour les PDF)"
    )

    apercu_pdf = models.FileField(
        upload_to='apercus/%Y/%m/',
        null=True, blank=True,
        help_text="Aperçu PDF généré automatiquement pour les fichiers Office (pptx, docx…)"
    )
    type_source = models.CharField(
        max_length=20, choices=TypeSource.choices, default=TypeSource.NUMERIQUE
    )
    depose_par = models.ForeignKey(User, on_delete=models.CASCADE, related_name='documents_deposes')
    date_depot = models.DateTimeField(auto_now_add=True)
    date_derniere_modification = models.DateTimeField(auto_now=True)

    taille_fichier = models.PositiveIntegerField(null=True, blank=True)
    type_mime = models.CharField(max_length=100, blank=True)
    groupe = models.CharField(max_length=20, blank=True, help_text="documents / images / medias")
    auteur_document = models.CharField(max_length=255, blank=True)

    categorie = models.ForeignKey(Categorie, on_delete=models.SET_NULL, null=True, blank=True, related_name='documents')
    departement = models.ForeignKey(Departement, on_delete=models.SET_NULL, null=True, blank=True, related_name='documents')
    tags = models.ManyToManyField(Tag, blank=True, related_name='documents')

    largeur_px = models.PositiveIntegerField(null=True, blank=True)
    hauteur_px = models.PositiveIntegerField(null=True, blank=True)
    duree = models.FloatField(null=True, blank=True)

    contenu_texte = models.TextField(blank=True)

    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.EN_ATTENTE)
    log_pipeline = models.JSONField(default=list, blank=True)
    cause_rejet = models.TextField(blank=True, help_text="Cause du rejet si statut=rejete")
    cause_rejet_en = models.TextField(blank=True, help_text="Cause du rejet en anglais si statut=rejete")

    est_confidentiel = models.BooleanField(default=False)
    utilisateurs_autorises = models.ManyToManyField(
        User, blank=True, related_name='documents_autorises'
    )
    departements_autorises = models.ManyToManyField(
        'Departement', blank=True, related_name='documents_autorises',
        help_text="Départements supplémentaires autorisés à voir ce document"
    )
   
    tentative_count = models.PositiveIntegerField(default=0)

    # ✅ Champ pour l'archivage
    est_archive = models.BooleanField(
        default=False,
        help_text="Indique si le document a été archivé par un administrateur."
    )

    favoris = models.ManyToManyField(
        User, blank=True, related_name='documents_favoris'
    )

    est_epingle = models.BooleanField(default=False)

    est_supprime = models.BooleanField(default=False)
    date_suppression = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        return f"{self.titre} ({self.get_statut_display()})"

    class Meta:
        ordering = ['-date_depot']
        verbose_name = "Document"


class LogAction(models.Model):
    class TypeAction(models.TextChoices):
        ARCHIVAGE = 'archivage', 'Archivage'
        REJET = 'rejet', 'Rejet ETL'
        VALIDATION = 'validation', 'Validation ETL'
        MODIFICATION = 'modification', 'Modification'
        PARTAGE = 'partage', 'Partage'

    document = models.ForeignKey(Document, on_delete=models.SET_NULL, null=True, blank=True, related_name='logs')
    type_action = models.CharField(max_length=20, choices=TypeAction.choices)
    cause = models.TextField(blank=True)
    cause_en = models.TextField(blank=True, help_text="Cause de l'action en anglais")
    effectue_par = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    date_action = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"[{self.get_type_action_display()}] {self.document}"

    class Meta:
        ordering = ['-date_action']
        verbose_name = "Log d'action"


class ConnexionLog(models.Model):
    utilisateur = models.ForeignKey(User, on_delete=models.CASCADE, related_name='connexions')
    ip_address = models.GenericIPAddressField()
    user_agent = models.TextField(blank=True)
    date_connexion = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-date_connexion']
        verbose_name = "Log de connexion"


class StorageSnapshot(models.Model):
    date = models.DateField(auto_now_add=True)
    disk_used_gb = models.FloatField()
    disk_total_gb = models.FloatField()
    minio_used_gb = models.FloatField(default=0)

    class Meta:
        ordering = ['-date']
        verbose_name = "Snapshot stockage"
        verbose_name_plural = "Snapshots stockage"