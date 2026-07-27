from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.documents.models import Departement


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
        ordering = ['-actif', 'domaine']  # Les domaines actifs apparaissent en premier

    def __str__(self):
        statut = "✓" if self.actif else "✗"
        return f"{statut} {self.domaine}"


class ConfigurationConnexion(models.Model):
    """
    Paramètres de connexion configurables par l'administrateur.
    Modèle "singleton" : une seule ligne doit exister en base (pk=1).
    """
    # On garde le champ pour la rétrocompatibilité, mais la logique utilisera le nouveau modèle
    domaine_email_autorise = models.CharField(
        max_length=255,
        blank=True,
        default='@dta-alliance.com,@gmail.com',
        help_text="Obsolète : Utilisez la gestion des domaines ci-dessous."
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
        """
        Vérifie si un email respecte la règle de domaine en utilisant le nouveau modèle.
        """
        if '@' not in email:
            return False
        
        # On extrait le domaine de l'email (ex: "test@gmail.com" -> "gmail.com")
        email_domain = email.split('@')[1].lower().strip()
        
        # On vérifie s'il existe un domaine actif correspondant dans la nouvelle table
        return DomaineEmail.objects.filter(domaine__iexact=email_domain, actif=True).exists()

    def __str__(self):
        return "Configuration de connexion"

    class Meta:
        verbose_name = "Configuration de connexion"
        verbose_name_plural = "Configuration de connexion"


def chemin_photo(instance, filename):
    ext = filename.rsplit('.', 1)[-1] if '.' in filename else 'jpg'
    return f'profils/{instance.utilisateur.id}/photo.{ext}'

from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver
from apps.documents.models import Departement

# ... (Garde les classes DomaineEmail et ConfigurationConnexion telles quelles) ...

class ProfilUtilisateur(models.Model):
    utilisateur = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profil')
    photo = models.ImageField(upload_to=chemin_photo, null=True, blank=True)
    changement_mdp_obligatoire = models.BooleanField(
        default=True,
        help_text="Si True, l'utilisateur doit changer son mot de passe à la prochaine connexion."
    )
    
    # 1. DÉPARTEMENT PRINCIPAL : optionnel (les admins peuvent ne pas en avoir)
    departement = models.ForeignKey(
        Departement, 
        on_delete=models.PROTECT,
        null=True, 
        blank=True,
        related_name='membres',
        help_text="Département principal de l'utilisateur (optionnel pour les admins)."
    )

    # 2. NOUVEAU : DÉPARTEMENTS SUPPLÉMENTAIRES AUTORISÉS
    departements_autorises = models.ManyToManyField(
        Departement, 
        blank=True, # Optionnel : un utilisateur peut n'avoir que son département principal
        related_name='acces_externe',
        help_text="Départements supplémentaires auxquels l'admin a donné accès à cet utilisateur."
    )

    def __str__(self):
        dept = self.departement.nom if self.departement else 'Aucun département'
        return f"Profil de {self.utilisateur.username} ({dept})"


@receiver(post_save, sender=User)
def creer_profil_utilisateur(sender, instance, created, **kwargs):
    if created:
        ProfilUtilisateur.objects.create(utilisateur=instance)