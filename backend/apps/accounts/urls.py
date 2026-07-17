from django.urls import path
from .views import VerifierEmailView, LoginView, ConfigurationConnexionView, ProfilView, ChangerMotDePasseView

urlpatterns = [
    path('verifier-email/', VerifierEmailView.as_view(), name='verifier-email'),
    path('connexion/', LoginView.as_view(), name='connexion'),
    path('configuration/', ConfigurationConnexionView.as_view(), name='configuration-connexion'),
    path('profil/', ProfilView.as_view(), name='profil'),
    path('changer-mot-de-passe/', ChangerMotDePasseView.as_view(), name='changer-mot-de-passe'),
]