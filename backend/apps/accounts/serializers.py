from rest_framework import serializers
from .models import ConfigurationConnexion
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from .models import ProfilUtilisateur


class VerificationEmailSerializer(serializers.Serializer):
    """Reçoit un email depuis React et vérifie s'il respecte le(s) domaine(s) autorisé(s)."""
    email = serializers.EmailField()

    def verifier(self):
        email = self.validated_data['email']
        config = ConfigurationConnexion.get_configuration()
        return config.email_est_autorise(email)
    
class LoginSerializer(serializers.Serializer):
    """Reçoit email + mot de passe, vérifie le domaine ET les identifiants."""
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def valider_connexion(self):
        email = self.validated_data['email']
        password = self.validated_data['password']

        # 1. On revérifie la règle de domaine, même si React l'a déjà fait avant
        #    (sécurité : ne jamais faire confiance uniquement au frontend)
        config = ConfigurationConnexion.get_configuration()
        if not config.email_est_autorise(email):
            return None, "Cet email n'est pas autorisé à se connecter."

        # 2. On cherche l'utilisateur correspondant à cet email
        try:
            utilisateur = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return None, "Identifiants incorrects."

        # 3. On vérifie le mot de passe via le système d'authentification de Django
        utilisateur_authentifie = authenticate(username=utilisateur.username, password=password)
        if utilisateur_authentifie is None:
            return None, "Identifiants incorrects."

        return utilisateur_authentifie, None
    
class ConfigurationConnexionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfigurationConnexion
        fields = ['domaine_email_autorise', 'modifie_par', 'derniere_modification']
        read_only_fields = ['modifie_par', 'derniere_modification']

    def validate_domaine_email_autorise(self, value):
        """Vérifie que chaque domaine (séparé par virgule) commence bien par '@'."""
        if not value.strip():
            return value  # champ vide = restriction désactivée, autorisé

        domaines = [d.strip() for d in value.split(',') if d.strip()]
        for domaine in domaines:
            if not domaine.startswith('@'):
                raise serializers.ValidationError(
                    f"Le domaine '{domaine}' doit commencer par '@' (ex: @gmail.com)."
                )
        # On renvoie une version "nettoyée" (espaces retirés, virgules normalisées)
        return ','.join(domaines)
        
class ProfilSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProfilUtilisateur
        fields = ['photo']


class ChangerMotDePasseSerializer(serializers.Serializer):
    ancien_mot_de_passe = serializers.CharField(write_only=True)
    nouveau_mot_de_passe = serializers.CharField(write_only=True, min_length=8)      