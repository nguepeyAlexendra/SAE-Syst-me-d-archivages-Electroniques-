from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny
from rest_framework import permissions
from rest_framework import status

from .serializers import VerificationEmailSerializer
from rest_framework.authtoken.models import Token
from .serializers import LoginSerializer

from rest_framework import generics
from rest_framework.permissions import IsAdminUser
from .models import ConfigurationConnexion
from .serializers import ConfigurationConnexionSerializer

from rest_framework import parsers
from .models import ProfilUtilisateur
from .serializers import ProfilSerializer, ChangerMotDePasseSerializer





class VerifierEmailView(APIView):
    """
    Route API : POST /api/auth/verifier-email/
    Reçoit un email, renvoie si oui ou non le champ mot de passe doit s'afficher.
    """
    permission_classes = [AllowAny]  # Accessible sans être connecté (logique, c'est avant la connexion !)

    def post(self, request):
        serializer = VerificationEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email_valide = serializer.verifier()

        return Response({
            "email_valide": email_valide
        }, status=status.HTTP_200_OK)
    

class LoginView(APIView):
    """
    Route API : POST /api/auth/connexion/
    Reçoit email + mot de passe, renvoie un token si les identifiants sont valides.
    """
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        utilisateur, erreur = serializer.valider_connexion()

        if erreur:
            return Response({"erreur": erreur}, status=status.HTTP_401_UNAUTHORIZED)

        # Crée un token pour cet utilisateur (ou récupère celui qui existe déjà)
        token, _ = Token.objects.get_or_create(user=utilisateur)

        return Response({
            "token": token.key,
            "utilisateur": {
                "id": utilisateur.id,
                "username": utilisateur.username,
                "email": utilisateur.email,
                "est_admin": utilisateur.is_staff,
            }
        }, status=status.HTTP_200_OK)
    

class ConfigurationConnexionView(generics.RetrieveUpdateAPIView):
    """
    GET /api/auth/configuration/  -> consulter la configuration actuelle
    PUT/PATCH /api/auth/configuration/ -> la modifier (admin uniquement)
    """
    serializer_class = ConfigurationConnexionSerializer
    permission_classes = [IsAdminUser]

    def get_object(self):
        return ConfigurationConnexion.get_configuration()

    def perform_update(self, serializer):
        serializer.save(modifie_par=self.request.user)


class ProfilView(generics.RetrieveUpdateAPIView):
    """
    GET /api/auth/profil/  -> voir son profil (dont la photo)
    PATCH /api/auth/profil/ -> mettre à jour la photo
    """
    serializer_class = ProfilSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def get_object(self):
        profil, _ = ProfilUtilisateur.objects.get_or_create(utilisateur=self.request.user)
        return profil


class ChangerMotDePasseView(APIView):
    """POST /api/auth/changer-mot-de-passe/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangerMotDePasseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        utilisateur = request.user
        ancien = serializer.validated_data['ancien_mot_de_passe']
        nouveau = serializer.validated_data['nouveau_mot_de_passe']

        if not utilisateur.check_password(ancien):
            return Response({"erreur": "Ancien mot de passe incorrect."}, status=400)

        utilisateur.set_password(nouveau)
        utilisateur.save()
        return Response({"succes": True})
    
    