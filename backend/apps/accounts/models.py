from django.db import models
from django.contrib.auth.models import User
from django.db.models.signals import post_save
from django.dispatch import receiver


class ConfigurationConnexion(models.Model):
    """
    Paramètres de connexion configurables par l'administrateur.
    Modèle "singleton" : une seule ligne doit exister en base (pk=1).

    Règle métier :
    - `domaine_email_autorise` peut contenir un ou plusieurs domaines,
      séparés par des virgules (ex: '@dta-alliance.com,@gmail.com').
      Seuls les emails se terminant par l'un de ces domaines peuvent tenter de se connecter.
    - Si le champ est vide, n'importe quel domaine est accepté (mais l'utilisateur
      doit tout de même correspondre à un compte existant, créé par un admin).
    """
    domaine_email_autorise = models.CharField(
        max_length=255,
        blank=True,
        default='@dta-alliance.com,@gmail.com',
        help_text="Domaines séparés par des virgules, ex: '@dta-alliance.com,@gmail.com' — laisser vide pour accepter n'importe quel domaine"
    )
    modifie_par = models.ForeignKey(
        User, null=True, blank=True, on_delete=models.SET_NULL,
        help_text="Dernier administrateur ayant modifié cette configuration"
    )
    derniere_modification = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        # Garantit qu'il n'existe jamais qu'une seule ligne de configuration (singleton)
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get_configuration(cls):
        """Récupère la configuration actuelle, en la créant avec les valeurs par défaut si besoin."""
        config, _ = cls.objects.get_or_create(pk=1)
        return config

    def domaines_liste(self):
        """Renvoie la liste des domaines autorisés, nettoyée (sans espaces, sans entrées vides)."""
        if not self.domaine_email_autorise:
            return []
        return [d.strip() for d in self.domaine_email_autorise.split(',') if d.strip()]

    def email_est_autorise(self, email):
        """
        Vérifie si un email respecte la règle de domaine.
        Renvoie True si aucun domaine n'est configuré (accès libre),
        ou si l'email se termine par l'un des domaines autorisés.
        """
        domaines = self.domaines_liste()
        if not domaines:
            return True
        return any(email.lower().endswith(d.lower()) for d in domaines)

    def __str__(self):
        return f"Configuration connexion (domaines autorisés : {self.domaine_email_autorise or 'tous'})"

    class Meta:
        verbose_name = "Configuration de connexion"
        verbose_name_plural = "Configuration de connexion"


class ProfilUtilisateur(models.Model):
    """
    Informations complémentaires liées à un utilisateur,
    non gérées par le modèle User natif de Django (ex: photo de profil).
    """
    utilisateur = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profil')
    photo = models.ImageField(upload_to='profils/', null=True, blank=True)

    def __str__(self):
        return f"Profil de {self.utilisateur.username}"


@receiver(post_save, sender=User)
def creer_profil_utilisateur(sender, instance, created, **kwargs):
    if created:
        ProfilUtilisateur.objects.create(utilisateur=instance)