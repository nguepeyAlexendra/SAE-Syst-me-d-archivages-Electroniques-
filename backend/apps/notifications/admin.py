from django.contrib import admin
from .models import Notification

@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    # ✅ Utilisation du nom exact du champ 'type' (et non 'type_notification')
    list_display = ('destinataire', 'titre', 'type', 'lue', 'date_creation', 'document')
    
    # ✅ Filtres basés sur les champs existants
    list_filter = ('type', 'lue', 'date_creation')
    
    # Champs recherchables
    search_fields = ('destinataire__username', 'destinataire__email', 'titre', 'message')
    
    # Champs en lecture seule
    readonly_fields = ('date_creation', 'date_lecture')
    
    # Tri par défaut (les plus récentes en premier)
    ordering = ('-date_creation',)

    # Action rapide pour marquer comme lu
    actions = ['marquer_comme_lue']

    @admin.action(description='Marquer les notifications sélectionnées comme lues')
    def marquer_comme_lue(self, request, queryset):
        queryset.update(lue=True)