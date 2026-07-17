from django.contrib import admin
from .models import Notification


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('destinataire', 'message', 'type_notification', 'lue', 'email_envoye', 'date_creation')
    list_filter = ('type_notification', 'lue', 'email_envoye')