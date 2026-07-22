from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    VerifierEmailView, 
    LoginView, 
    ConfigurationConnexionView, 
    ProfilView, 
    ChangerMotDePasseView,
    AdminUserListView,
    AdminUserToggleActiveView,
    AdminUserToggleAdminView,
    DomaineEmailViewSet,       # ✅ Doit être ici
    DomaineEmailBulkView,      # ✅ Doit être ici
)

print("✅ ✅ ✅ LE FICHIER ACCOUNTS/URLS.PY EST BIEN LU PAR DJANGO ✅ ✅ ✅")
# 1. Création du routeur
router = DefaultRouter()
router.register(r'domaines-email', DomaineEmailViewSet, basename='domaines-email')

urlpatterns = [
    path('verifier-email/', VerifierEmailView.as_view(), name='verifier-email'),
    path('connexion/', LoginView.as_view(), name='connexion'),
    path('configuration/', ConfigurationConnexionView.as_view(), name='configuration-connexion'),
    path('profil/', ProfilView.as_view(), name='profil'),
    path('changer-mot-de-passe/', ChangerMotDePasseView.as_view(), name='changer-mot-de-passe'),
    path('admin/utilisateurs/', AdminUserListView.as_view(), name='admin-utilisateurs'),
    path('admin/utilisateurs/<int:pk>/toggle-active/', AdminUserToggleActiveView.as_view(), name='admin-toggle-active'),
    path('admin/utilisateurs/<int:pk>/toggle-admin/', AdminUserToggleAdminView.as_view(), name='admin-toggle-admin'),
    path('domaines-email-bulk/', DomaineEmailBulkView.as_view(), name='domaines-email-bulk'),
]

# 2. CETTE LIGNE EST OBLIGATOIRE pour ajouter les routes du routeur
urlpatterns += router.urls
print("🚨 🚨 🚨 LES ROUTES DU ROUTER ONT ÉTÉ AJOUTÉES AVEC SUCCÈS ! 🚨 🚨 🚨")