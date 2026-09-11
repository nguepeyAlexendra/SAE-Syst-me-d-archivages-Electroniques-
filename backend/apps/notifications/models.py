from django.db import models
from django.conf import settings
from apps.documents.models import Document

class Notification(models.Model):
    # Choix pour le type de notification
    TYPE_CHOICES = [
        ('validation', 'Validation'),
        ('rejet', 'Rejet'),
        ('partage', 'Partage'),
        ('acces_accorde', 'Accès accordé'),
        ('nouveau_document', 'Nouveau document'),
    ]

    destinataire = models.ForeignKey(
        settings.AUTH_USER_MODEL, # Ou 'accounts.User' selon votre configuration
        on_delete=models.CASCADE,
        related_name='notifications'
    )
    
    titre = models.CharField(max_length=255)  # ✅ CHAMP AJOUTÉ
    message = models.TextField()
    type = models.CharField(max_length=20, choices=TYPE_CHOICES)  # ✅ CHAMP AJOUTÉ
    
    document = models.ForeignKey(
        Document, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='notifications_lien'
    )
    
    lue = models.BooleanField(default=False)
    date_creation = models.DateTimeField(auto_now_add=True)
    date_lecture = models.DateTimeField(null=True, blank=True)
    date_envoi_email = models.DateTimeField(null=True, blank=True)
    email_envoye = models.BooleanField(default=False)

    class Meta:
        ordering = ['-date_creation']
        verbose_name = "Notification"
        verbose_name_plural = "Notifications"

    def __str__(self):
        return f"[{self.get_type_display()}] {self.titre} pour {self.destinataire.username}"