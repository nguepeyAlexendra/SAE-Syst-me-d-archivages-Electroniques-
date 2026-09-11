from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
    VerifierEmailView, 
    LoginView, 
    Verify2FAView,
    Resend2FAView,
    ConfigurationConnexionView, 
    ProfilView, 
    ChangerMotDePasseView,
    AdminUserListView,
    AdminUserToggleActiveView,
    AdminUserToggleAdminView,
    AdminUserResetPasswordView,
    AdminUserDepartementsAutorisesView,
    DomaineEmailViewSet,
    DomaineEmailBulkView,
    DeconnexionView,        # 🆕
    MesSessionsView,        # 🆕
    MotDePasseOublieView,
    ConfirmerMotDePasseOublieView,
)

# Routeur DRF
router = DefaultRouter()
router.register(r'domaines-email', DomaineEmailViewSet, basename='domaines-email')

urlpatterns = [
    # Authentification publique
    path('verifier-email/', VerifierEmailView.as_view(), name='verifier-email'),
    path('connexion/', LoginView.as_view(), name='connexion'),
    path('verify-2fa/', Verify2FAView.as_view(), name='verify-2fa'),
    path('resend-2fa/', Resend2FAView.as_view(), name='resend-2fa'),
    path('mot-de-passe-oublie/', MotDePasseOublieView.as_view(), name='mot-de-passe-oublie'),
    path('confirmer-mot-de-passe-oublie/', ConfirmerMotDePasseOublieView.as_view(), name='confirmer-mot-de-passe-oublie'),

    # Utilisateur connecté
    path('configuration/', ConfigurationConnexionView.as_view(), name='configuration-connexion'),
    path('profil/', ProfilView.as_view(), name='profil'),
    path('changer-mot-de-passe/', ChangerMotDePasseView.as_view(), name='changer-mot-de-passe'),
    path('deconnexion/', DeconnexionView.as_view(), name='deconnexion'),                    # 🆕
    path('mes-sessions/', MesSessionsView.as_view(), name='mes-sessions'),                  # 🆕
    path('mes-sessions/<int:pk>/', MesSessionsView.as_view(), name='supprimer-session'),    # 🆕

    # Administration
    path('admin/utilisateurs/', AdminUserListView.as_view(), name='admin-utilisateurs'),
    path('admin/utilisateurs/<int:pk>/toggle-active/', AdminUserToggleActiveView.as_view(), name='admin-toggle-active'),
    path('admin/utilisateurs/<int:pk>/toggle-admin/', AdminUserToggleAdminView.as_view(), name='admin-toggle-admin'),
    path('admin/utilisateurs/<int:pk>/reset-password/', AdminUserResetPasswordView.as_view(), name='admin-reset-password'),
    path('admin/utilisateurs/<int:pk>/departements-autorises/', AdminUserDepartementsAutorisesView.as_view(), name='admin-departements-autorises'),
    path('domaines-email-bulk/', DomaineEmailBulkView.as_view(), name='domaines-email-bulk'),
]

urlpatterns += router.urls