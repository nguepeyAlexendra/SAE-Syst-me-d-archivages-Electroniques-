from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from django.utils import timezone
from apps.documents.models import Departement


# Ajout du champ 'nom' (nom complet) via une propriété sur User
def user_nom(self):
    """Retourne le nom complet (prénom + nom) ou username si vide."""
    full_name = self.get_full_name().strip()
    return full_name if full_name else self.username

User.add_to_class('nom', property(user_nom))


class DomaineEmail(models.Model):
    """Modèle pour gérer les domaines d'email autorisés de manière individuelle."""
    domaine = models.CharField(
        max_length=100, 
        unique=True, 
        help_text="Ex: dta-alliance.com ou gmail.com (sans le @)"
    )
    actif = models.BooleanField(
        default=True, 
        help_text="Décochez pour désactiver ce domaine temporairement"
    )
    date_ajout = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Domaine email autorisé"
        verbose_name_plural = "Domaines emails autorisés"
        ordering = ['-actif', 'domaine']

    def __str__(self):
        statut = "✓" if self.actif else "✗"
        return f"{statut} {self.domaine}"


class ConfigurationConnexion(models.Model):
    """
    Paramètres de connexion configurables par l'administrateur.
    Modèle "singleton" : une seule ligne doit exister en base (pk=1).
    """
    domaine_email_autorise = models.CharField(
        max_length=255,
        blank=True,
        default='@dta-alliance.com,@gmail.com',
        help_text="Obsolète : Utilisez la gestion des domaines ci-dessous."
    )

        
    # ✅ NOUVEAU : Toggle global pour imposer le 2FA à tous les utilisateurs
    two_fa_obligatoire = models.BooleanField(
        default=False,
        help_text="Si True, tous les utilisateurs devront utiliser la double authentification à la connexion."
    ) 

    modifie_par = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL,
        help_text="Dernier administrateur ayant modifié cette configuration"
    )
    derniere_modification = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_configuration(cls):
        config, _ = cls.objects.get_or_create(pk=1)
        return config

    def email_est_autorise(self, email):
        """Vérifie si un email respecte la règle de domaine."""
        if '@' not in email:
            return False
        email_domain = email.split('@')[1].lower().strip()
        return DomaineEmail.objects.filter(domaine__iexact=email_domain, actif=True).exists()

    def __str__(self):
        return "Configuration de connexion"

    class Meta:
        verbose_name = "Configuration de connexion"
        verbose_name_plural = "Configuration de connexion"


def chemin_photo(instance, filename):
    ext = filename.rsplit('.', 1)[-1] if '.' in filename else 'jpg'
    return f'profils/{instance.utilisateur.id}/photo.{ext}'


class ProfilUtilisateur(models.Model):
    utilisateur = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profil')
    photo = models.ImageField(upload_to=chemin_photo, null=True, blank=True)
    telephone = models.CharField(
        max_length=30,
        blank=True,
        default='',
        help_text="Numéro de téléphone (optionnel)."
    )

    # ✅ NOUVEAU : L'utilisateur peut activer le 2FA lui-même
    two_fa_active = models.BooleanField(
        default=False,
        help_text="Si True, l'utilisateur a activé la double authentification pour son compte."
    )
    
    changement_mdp_obligatoire = models.BooleanField(
        default=True,
        help_text="Si True, l'utilisateur doit changer son mot de passe à la prochaine connexion."
    )
    
    # ==========================================
    # CHAMPS 2FA (Double Authentification)
    # ==========================================
    code_2fa = models.CharField(max_length=6, blank=True, null=True)
    code_2fa_expiration = models.DateTimeField(blank=True, null=True)
    token_2fa_temporaire = models.CharField(max_length=64, blank=True, null=True)
    tentatives_2fa_echouees = models.IntegerField(default=0)
    
    # Rate Limiting (max 3 codes par heure)
    date_derniere_demande_code = models.DateTimeField(blank=True, null=True)
    nb_codes_envoyes_heure = models.IntegerField(default=0)
    
    # 1. DÉPARTEMENT PRINCIPAL
    departement = models.ForeignKey(
        Departement, 
        on_delete=models.PROTECT,
        null=True, 
        blank=True,
        related_name='membres',
        help_text="Département principal de l'utilisateur (optionnel pour les admins)."
    )

    # 2. DÉPARTEMENTS SUPPLÉMENTAIRES AUTORISÉS
    departements_autorises = models.ManyToManyField(
        Departement, 
        blank=True,
        related_name='acces_externe',
        help_text="Départements supplémentaires auxquels l'admin a donné accès à cet utilisateur."
    )

    def __str__(self):
        dept = self.departement.nom if self.departement else 'Aucun département'
        return f"Profil de {self.utilisateur.username} ({dept})"


# ==========================================
# NOUVEAU MODÈLE : Appareils approuvés
# ==========================================
class AppareilApprouve(models.Model):
    """
    Stocke les appareils auxquels l'utilisateur a fait confiance.
    Permet d'éviter le 2FA pendant 30 jours sur un même appareil.
    """
    utilisateur = models.ForeignKey(
        User, 
        on_delete=models.CASCADE, 
        related_name='appareils_approuves'
    )
    token = models.CharField(max_length=64, unique=True, db_index=True)
    nom_appareil = models.CharField(max_length=255, blank=True, default='')
    date_creation = models.DateTimeField(auto_now_add=True)
    date_expiration = models.DateTimeField()

    def est_valide(self):
        return timezone.now() < self.date_expiration

    def __str__(self):
        return f"Appareil approuvé pour {self.utilisateur.username}"


@receiver(post_save, sender=User)
def creer_profil_utilisateur(sender, instance, created, **kwargs):
    if created:
        ProfilUtilisateur.objects.create(utilisateur=instance)

        # ==========================================
# MODÈLE : Limite de connexions simultanées (max 3 appareils)
# ==========================================
class SessionAppareil(models.Model):
    """
    Trace chaque appareil connecté avec son Token DRF.
    Limite : MAX_APPAREILS_PAR_UTILISATEUR connexions simultanées par user.
    Quand la limite est atteinte, la session la plus ancienne est déconnectée.
    """
    utilisateur = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='sessions_appareils'
    )
    token = models.OneToOneField(
        'authtoken.Token', on_delete=models.CASCADE, related_name='session'
    )
    appareil = models.CharField(max_length=255, blank=True, default='')
    ip = models.GenericIPAddressField(null=True, blank=True)
    cree_le = models.DateTimeField(auto_now_add=True)
    derniere_activite = models.DateTimeField(auto_now=True)
    est_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['-cree_le']
        verbose_name = "Session appareil"
        verbose_name_plural = "Sessions appareils"

    def __str__(self):
        return f"{self.utilisateur.username} — {self.appareil[:30] or 'Appareil inconnu'}"