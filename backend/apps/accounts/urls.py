from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    VerifierEmailView, 
    LoginView, 
    Verify2FAView,          # ← AJOUTÉ
    ConfigurationConnexionView, 
    ProfilView, 
    ChangerMotDePasseView,
    AdminUserListView,
    AdminUserToggleActiveView,
    AdminUserToggleAdminView,
    DomaineEmailViewSet,
    DomaineEmailBulkView,
)

# Routeur DRF
router = DefaultRouter()
router.register(r'domaines-email', DomaineEmailViewSet, basename='domaines-email')

urlpatterns = [
    path('verifier-email/', VerifierEmailView.as_view(), name='verifier-email'),
    path('connexion/', LoginView.as_view(), name='connexion'),
    path('verify-2fa/', Verify2FAView.as_view(), name='verify-2fa'),  # ← AJOUTÉ
    path('configuration/', ConfigurationConnexionView.as_view(), name='configuration-connexion'),
    path('profil/', ProfilView.as_view(), name='profil'),
    path('changer-mot-de-passe/', ChangerMotDePasseView.as_view(), name='changer-mot-de-passe'),
    path('admin/utilisateurs/', AdminUserListView.as_view(), name='admin-utilisateurs'),
    path('admin/utilisateurs/<int:pk>/toggle-active/', AdminUserToggleActiveView.as_view(), name='admin-toggle-active'),
    path('admin/utilisateurs/<int:pk>/toggle-admin/', AdminUserToggleAdminView.as_view(), name='admin-toggle-admin'),
    path('domaines-email-bulk/', DomaineEmailBulkView.as_view(), name='domaines-email-bulk'),
]

urlpatterns += router.urls