from django.contrib import admin
from .models import ConfigurationConnexion


@admin.register(ConfigurationConnexion)
class ConfigurationConnexionAdmin(admin.ModelAdmin):
    list_display = ('domaine_email_autorise', 'modifie_par', 'derniere_modification')

    def has_add_permission(self, request):
        # Empêche de créer une deuxième ligne (singleton) : uniquement modification
        return not ConfigurationConnexion.objects.exists()