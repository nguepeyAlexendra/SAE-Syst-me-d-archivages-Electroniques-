from django.db.models.signals import post_save
from django.dispatch import receiver
from django.contrib.auth import get_user_model
from django.db import transaction
from apps.documents.models import Document, LogAction
from .models import Notification

User = get_user_model()

@receiver(post_save, sender=LogAction)
def creer_notification_log_action(sender, instance, created, **kwargs):
    if not created:
        return
    document = instance.document
    deposant = document.depose_par
    
    if instance.type_action == 'rejet':
        Notification.objects.get_or_create(
            destinataire=deposant, document=document, type='rejet',
            defaults={'titre': "Document rejeté", 'message': f"Votre document '{document.titre}' a été rejeté. Raison : {instance.cause}"}
        )
    elif instance.type_action == 'validation':
        Notification.objects.get_or_create(
            destinataire=deposant, document=document, type='validation',
            defaults={'titre': "Document validé", 'message': f"Votre document '{document.titre}' a été validé avec succès."}
        )

@receiver(post_save, sender=Document)
def notifier_nouveau_document_departement(sender, instance, created, **kwargs):
    if not created or not instance.departement:
        return
    
    def _creer_notifications():
        membres = User.objects.filter(
            profil__departement=instance.departement
        ).exclude(id=instance.depose_par.id)
        
        for u in membres:
            # ✅ get_or_create empêche les doublons si le signal se déclenche plusieurs fois
            Notification.objects.get_or_create(
                destinataire=u,
                document=instance,
                type='nouveau_document',
                defaults={
                    'titre': "Nouveau document dans votre département",
                    'message': f"{instance.depose_par.username} a déposé '{instance.titre}' dans le département {instance.departement.nom}."
                }
            )
        print(f"✅ Notifications sauvegardées (sans doublons) pour {instance.titre}")
    
    transaction.on_commit(_creer_notifications)