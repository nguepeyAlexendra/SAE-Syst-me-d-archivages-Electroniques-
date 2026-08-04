from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.models import User

from .models import ConfigurationConnexion, ProfilUtilisateur, DomaineEmail
from apps.documents.models import Departement


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

        config = ConfigurationConnexion.get_configuration()
        if not config.email_est_autorise(email):
            return None, "Cet email n'est pas autorisé à se connecter."

        try:
            utilisateur = User.objects.get(email__iexact=email)
        except User.DoesNotExist:
            return None, "Identifiants incorrects."

        utilisateur_authentifie = authenticate(username=utilisateur.username, password=password)
        if utilisateur_authentifie is None:
            return None, "Identifiants incorrects."

        return utilisateur_authentifie, None


# ✅ NOUVEAU : Ce sérialiseur prépare les données de l'utilisateur pour le frontend
class UserSerializer(serializers.ModelSerializer):
    est_admin = serializers.BooleanField(source='is_staff', read_only=True)
    departement = serializers.SerializerMethodField()

    class Meta:
        model = User
        # ⚠️ 'departement' est maintenant officiellement dans la réponse JSON
        fields = ['id', 'username', 'email', 'est_admin', 'departement']

    def get_departement(self, obj):
        if hasattr(obj, 'profil') and obj.profil.departement:
            return {"id": obj.profil.departement.id, "nom": obj.profil.departement.nom}
        return None
    
class ConfigurationConnexionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfigurationConnexion
        fields = ['domaine_email_autorise', 'two_fa_obligatoire', 'modifie_par', 'derniere_modification']
        read_only_fields = ['modifie_par', 'derniere_modification']

    def validate_domaine_email_autorise(self, value):
        if not value.strip():
            return value
        domaines = [d.strip() for d in value.split(',') if d.strip()]
        for domaine in domaines:
            if not domaine.startswith('@'):
                raise serializers.ValidationError(
                    f"Le domaine '{domaine}' doit commencer par '@' (ex: @gmail.com)."
                )
        return ','.join(domaines)
        

class ProfilSerializer(serializers.ModelSerializer):
    departement = serializers.SerializerMethodField()
    departement_nom = serializers.SerializerMethodField()
    departement_nom_en = serializers.SerializerMethodField()
    departements_autorises_noms = serializers.SerializerMethodField()
    
    departements_autorises = serializers.PrimaryKeyRelatedField(
        queryset=Departement.objects.all(), 
        many=True, 
        required=False,
        help_text="Départements supplémentaires auxquels l'utilisateur a accès."
    )

    class Meta:
        model = ProfilUtilisateur
        fields = [
            'photo', 
            'telephone',
            'two_fa_active',
            'changement_mdp_obligatoire', 
            'departement', 
            'departement_nom',
            'departement_nom_en',
            'departements_autorises', 
            'departements_autorises_noms'
        ]

    def get_departement(self, obj):
        if obj.departement:
            return {"id": obj.departement.id, "nom": obj.departement.nom, "nom_en": obj.departement.nom_en}
        return None

    def get_departement_nom(self, obj):
        return obj.departement.nom if obj.departement else None

    def get_departement_nom_en(self, obj):
        return obj.departement.nom_en if obj.departement else None

    def get_departements_autorises_noms(self, obj):
        return [{"id": dept.id, "nom": dept.nom, "nom_en": dept.nom_en} for dept in obj.departements_autorises.all()]

    def validate_departement(self, value):
        if not value and hasattr(self, 'initial_data') and 'departement' in self.initial_data:
            raise serializers.ValidationError("Un département principal est requis.")
        return value


class ChangerMotDePasseSerializer(serializers.Serializer):
    ancien_mot_de_passe = serializers.CharField(write_only=True)
    nouveau_mot_de_passe = serializers.CharField(write_only=True, min_length=8)    


class MotDePasseOublieSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        try:
            User.objects.get(email__iexact=value)
        except User.DoesNotExist:
            raise serializers.ValidationError("Aucun compte trouvé avec cet email.")
        return value.lower()


class ConfirmerMotDePasseOublieSerializer(serializers.Serializer):
    email = serializers.EmailField()
    code = serializers.CharField(max_length=6)
    nouveau_mot_de_passe = serializers.CharField(write_only=True, min_length=8)


class DomaineEmailSerializer(serializers.ModelSerializer):
    class Meta:
        model = DomaineEmail
        fields = ['id', 'domaine', 'actif', 'date_ajout']
        read_only_fields = ['date_ajout']

class Verify2FASerializer(serializers.Serializer):
    """Valide le token temporaire et le code 2FA saisi par l'utilisateur."""
    temp_token = serializers.CharField(max_length=64)
    code = serializers.CharField(max_length=6)