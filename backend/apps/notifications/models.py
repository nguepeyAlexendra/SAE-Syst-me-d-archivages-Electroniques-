from django.db import models
from django.contrib.auth.models import User


class Notification(models.Model):
    """
    Une notification in-app pour un utilisateur (icône cloche dans la barre de navigation).
    Créée automatiquement par le pipeline ETL (validation, rejet, accès accordé...).
    """

    class TypeNotification(models.TextChoices):
        VALIDATION = 'validation', 'Document validé'
        REJET = 'rejet', 'Document rejeté'
        ACCES_ACCORDE = 'acces_accorde', 'Accès à un document accordé'

    destinataire = models.ForeignKey(User, on_delete=models.CASCADE, related_name='notifications')
    message = models.CharField(max_length=255)
    type_notification = models.CharField(max_length=20, choices=TypeNotification.choices)

    # Référence croisée vers l'app documents, via chaîne 'app.Modele' pour éviter
    # un import circulaire entre les deux apps.
    document = models.ForeignKey(
        'documents.Document', on_delete=models.CASCADE, null=True, blank=True, related_name='notifications'
    )

    lue = models.BooleanField(default=False)
    date_creation = models.DateTimeField(auto_now_add=True)

    # --- Suivi de l'envoi email (complément à la notification in-app) ---
    email_envoye = models.BooleanField(default=False)
    date_envoi_email = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        statut = "lue" if self.lue else "non lue"
        return f"{self.destinataire.username} - {self.message} ({statut})"

    class Meta:
        ordering = ['-date_creation']
        verbose_name = "Notification"