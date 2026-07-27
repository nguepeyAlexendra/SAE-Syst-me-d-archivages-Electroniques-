from django.contrib import admin
from .models import ConfigurationConnexion, ProfilUtilisateur, DomaineEmail

# --- Configuration existante (Singleton) ---
@admin.register(ConfigurationConnexion)
class ConfigurationConnexionAdmin(admin.ModelAdmin):
    list_display = ('domaine_email_autorise', 'modifie_par', 'derniere_modification')

    def has_add_permission(self, request):
        # Empêche de créer une deuxième ligne (singleton) : uniquement modification
        return not ConfigurationConnexion.objects.exists()

# --- NOUVEAU : Gestion des Profils Utilisateurs ---
@admin.register(ProfilUtilisateur)
class ProfilUtilisateurAdmin(admin.ModelAdmin):
    list_display = ('utilisateur', 'departement', 'changement_mdp_obligatoire')
    list_filter = ('departement', 'changement_mdp_obligatoire')
    search_fields = ('utilisateur__username', 'utilisateur__email')
    raw_id_fields = ('utilisateur',) # Pour éviter de charger tous les users en dropdown

# --- NOUVEAU : Gestion des Domaines Email ---
@admin.register(DomaineEmail)
class DomaineEmailAdmin(admin.ModelAdmin):
    list_display = ('domaine', 'actif', 'date_ajout')
    list_filter = ('actif',)