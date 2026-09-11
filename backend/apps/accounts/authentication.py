from rest_framework.authentication import TokenAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.authtoken.models import Token
from django.utils import timezone
from .models import SessionAppareil


class TokenSessionAuthentication(TokenAuthentication):
    """
    Authentification par Token DRF avec vérification des sessions.
    Refuse les tokens dont la session est inactive (déconnectée ou dépassée).
    """
    
    def authenticate_credentials(self, key):
        result = super().authenticate_credentials(key)
        if result is None:
            return None
        
        user, token = result
        
        # Vérifier la session associée
        try:
            session = token.session
            if not session.est_active:
                raise AuthenticationFailed(
                    "Session révoquée : limite d'appareils atteinte ou déconnexion depuis un autre appareil."
                )
            # Met à jour la dernière activité
            session.save(update_fields=['derniere_activite'])
        except SessionAppareil.DoesNotExist:
            # Token ancien (créé avant cette fonctionnalité) : on crée une session
            SessionAppareil.objects.create(
                utilisateur=user,
                token=token,
                appareil='',
                ip=None,
            )
        
        return result