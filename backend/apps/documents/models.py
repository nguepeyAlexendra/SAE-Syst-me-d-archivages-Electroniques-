from django.db import models
from django.contrib.auth.models import User


class Categorie(models.Model):
    """
    Une catégorie de rangement (ex: Factures, Contrats, RH, Rapports techniques...).
    Utilisée par l'étape "Classement automatique" du pipeline ETL.
    """
    nom = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)

    def __str__(self):
        return self.nom

    class Meta:
        verbose_name = "Catégorie"
        verbose_name_plural = "Catégories"


class Tag(models.Model):
    """
    Une étiquette/mot-clé (ex: 'urgent', '2026', 'client-X').
    Un document peut avoir plusieurs tags. Utilisée par l'étape "Tagging".
    """
    nom = models.CharField(max_length=50, unique=True)

    def __str__(self):
        return self.nom


class Document(models.Model):
    """
    Le modèle central du SAE : représente un document déposé,
    qu'il soit numérique (PDF, Word...) ou issu d'un scan physique (photo/scan papier).
    """

    class TypeSource(models.TextChoices):
        NUMERIQUE = 'numerique', 'Fichier numérique'
        SCAN_PHYSIQUE = 'scan', 'Document papier scanné'

    class Statut(models.TextChoices):
        EN_ATTENTE = 'en_attente', 'En attente de traitement'
        EN_COURS = 'en_cours', 'Traitement en cours (ETL)'
        VALIDE = 'valide', 'Validé et indexé'
        REJETE = 'rejete', 'Rejeté'

    # --- Informations de base (étape "Extraction") ---
    titre = models.CharField(max_length=255)
    fichier = models.FileField(upload_to='documents/%Y/%m/')
    type_source = models.CharField(
        max_length=20, choices=TypeSource.choices, default=TypeSource.NUMERIQUE
    )
    depose_par = models.ForeignKey(User, on_delete=models.CASCADE, related_name='documents_deposes')
    date_depot = models.DateTimeField(auto_now_add=True)

    # --- Métadonnées extraites automatiquement ---
    taille_fichier = models.PositiveIntegerField(null=True, blank=True, help_text="Taille en octets")
    type_mime = models.CharField(max_length=100, blank=True)
    groupe = models.CharField(max_length=20, blank=True, help_text="documents / images / media / autres")
    auteur_document = models.CharField(max_length=255, blank=True, help_text="Auteur détecté dans les métadonnées du fichier")

    # --- Résultat du classement / tagging automatique ---
    categorie = models.ForeignKey(Categorie, on_delete=models.SET_NULL, null=True, blank=True, related_name='documents')
    tags = models.ManyToManyField(Tag, blank=True, related_name='documents')

    # --- Contenu extrait pour la recherche full-text ---
    contenu_texte = models.TextField(blank=True, help_text="Texte extrait (lecture directe ou OCR) pour l'indexation")

    # --- Suivi du pipeline ETL ---
    statut = models.CharField(max_length=20, choices=Statut.choices, default=Statut.EN_ATTENTE)
    log_pipeline = models.JSONField(default=list, blank=True, help_text="Historique des étapes ETL avec horodatage")

   # --- Corbeille (suppression douce, récupérable) ---
    est_supprime = models.BooleanField(default=False)
    date_suppression = models.DateTimeField(null=True, blank=True)

    # --- Suivi des modifications ---
    date_derniere_modification = models.DateTimeField(auto_now=True)

    # --- Dimensions (uniquement pertinent pour les images) ---
    largeur_px = models.PositiveIntegerField(null=True, blank=True)
    hauteur_px = models.PositiveIntegerField(null=True, blank=True)

    # --- Sécurité / droits d'accès ---
    est_confidentiel = models.BooleanField(default=False)
    utilisateurs_autorises = models.ManyToManyField(
        User, blank=True, related_name='documents_autorises',
        help_text="Si le document est confidentiel, liste des utilisateurs ayant accès en plus du déposant"
    )

    def __str__(self):
        return f"{self.titre} ({self.get_statut_display()})"

    class Meta:
        ordering = ['-date_depot']
        verbose_name = "Document"