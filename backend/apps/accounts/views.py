import secrets
import string

from django.conf import settings
from django.contrib.auth.models import User
from django.core.mail import send_mail
from django.db.models import Q

from rest_framework import generics, parsers, permissions, status, viewsets, filters
from rest_framework.authtoken.models import Token
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.documents.models import ConnexionLog

from .models import ConfigurationConnexion, ProfilUtilisateur, DomaineEmail, Departement
from .serializers import (
    ChangerMotDePasseSerializer,
    ConfigurationConnexionSerializer,
    LoginSerializer,
    ProfilSerializer,
    VerificationEmailSerializer,
    DomaineEmailSerializer,
)


EMAIL_HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenue sur SAE</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #334155;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); border: 1px solid #e2e8f0;">
                    <tr>
                        <td style="background-color: #ffffff; padding: 40px 30px 30px 30px; text-align: center; border-bottom: 1px solid #f1f5f9;">
                            <img src="https://i.imgur.com/oXxC88s.png" alt="Logo SAE" style="display: block; margin: 0 auto 20px auto; max-width: 90px; height: auto;">
                            <h1 style="margin: 0; color: #0f172a; font-size: 22px; font-weight: 600; letter-spacing: -0.3px; font-family: 'Segoe UI', sans-serif;">Bienvenue sur SAE</h1>
                            <p style="margin: 8px 0 0 0; color: #64748b; font-size: 13px; font-weight: 400; font-family: 'Segoe UI', sans-serif;">Votre compte a été créé avec succès</p>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 40px;">
                            <p style="margin: 0 0 28px 0; color: #334155; font-size: 16px; line-height: 1.7; font-family: 'Segoe UI', sans-serif;">
                                Bonjour <strong style="color: #0f172a; font-weight: 600;">{{ username }}</strong>,
                            </p>
                            <p style="margin: 0 0 32px 0; color: #475569; font-size: 15px; line-height: 1.7; font-family: 'Segoe UI', sans-serif;">
                                Votre compte sur la plateforme <strong style="color: #0f172a;">SAE</strong> a été créé par un administrateur. Vous trouverez ci-dessous vos identifiants de connexion temporaires.
                            </p>
                            <div style="background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%); border: 1px solid #e2e8f0; border-radius: 8px; padding: 28px; margin: 28px 0; box-shadow: 0 1px 4px rgba(0,0,0,0.05);">
                                <p style="margin: 0 0 12px 0; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; font-weight: 500; font-family: 'Segoe UI', sans-serif;">Adresse e-mail</p>
                                <p style="margin: 0 0 24px 0; color: #0f172a; font-size: 16px; font-weight: 500; font-family: 'Segoe UI', sans-serif;">{{ email }}</p>
                                <p style="margin: 0 0 12px 0; color: #64748b; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; font-weight: 500; font-family: 'Segoe UI', sans-serif;">Mot de passe temporaire</p>
                                <p style="margin: 0; padding: 12px 16px; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 6px; color: #0f172a; font-size: 18px; font-weight: 600; letter-spacing: 1.5px; font-family: 'Courier New', Courier, monospace; text-align: center;">{{ password }}</p>
                            </div>
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 32px 0;">
                                <tr>
                                    <td align="center">
                                        <a href="{{ site_url }}" style="display: inline-block; padding: 12px 36px; background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 15px; letter-spacing: 0.3px; font-family: 'Segoe UI', sans-serif; box-shadow: 0 2px 8px rgba(15, 23, 42, 0.2);">Accéder à mon espace</a>
                                    </td>
                                </tr>
                            </table>
                            <p style="margin: 0 0 24px 0; padding: 16px 20px; background-color: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px; color: #92400e; font-size: 14px; line-height: 1.6; font-style: italic; font-family: 'Segoe UI', sans-serif;">
                                <strong style="font-weight: 600;">Important :</strong> Pour des raisons de sécurité, vous serez invité à modifier ce mot de passe dès votre première connexion.
                            </p>
                            <p style="margin: 0; color: #94a3b8; font-size: 14px; line-height: 1.7; text-align: center; font-family: 'Segoe UI', sans-serif;">
                                Si vous n'êtes pas à l'origine de cette demande, veuillez ignorer cet e-mail.
                            </p>
                        </td>
                    </tr>
                    <tr>
                        <td style="background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                            <p style="margin: 0; color: #94a3b8; font-size: 12px; line-height: 1.6; font-family: 'Segoe UI', sans-serif;">
                                Cet e-mail a été envoyé automatiquement par la plateforme SAE.<br>© 2026 SAE. Tous droits réservés.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
"""


class VerifierEmailView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = VerificationEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        email_valide = serializer.verifier()
        return Response({"email_valide": email_valide}, status=status.HTTP_200_OK)
    

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        utilisateur, erreur = serializer.valider_connexion()

        if erreur:
            return Response({"erreur": erreur}, status=status.HTTP_401_UNAUTHORIZED)

        token, _ = Token.objects.get_or_create(user=utilisateur)

        try:
            ip = request.META.get('REMOTE_ADDR', '')
            ua = request.META.get('HTTP_USER_AGENT', '')
            ConnexionLog.objects.create(utilisateur=utilisateur, ip_address=ip, user_agent=ua)
        except Exception:
            pass

        changement_mdp_obligatoire = False
        photo_url = None
        departement_data = None

        try:
            profil = utilisateur.profil
            changement_mdp_obligatoire = profil.changement_mdp_obligatoire
            if profil.photo:
                photo_url = profil.photo.url
            if profil.departement:
                departement_data = {"id": profil.departement.id, "nom": profil.departement.nom}
        except Exception:
            pass

        return Response({
            "token": token.key,
            "changement_mdp_obligatoire": changement_mdp_obligatoire,
            "utilisateur": {
                "id": utilisateur.id,
                "username": utilisateur.username,
                "email": utilisateur.email,
                "est_admin": utilisateur.is_staff,
                "photo": photo_url,
                "departement": departement_data,
            }
        }, status=status.HTTP_200_OK)
    

class ConfigurationConnexionView(generics.RetrieveUpdateAPIView):
    serializer_class = ConfigurationConnexionSerializer
    permission_classes = [IsAdminUser]

    def get_object(self):
        return ConfigurationConnexion.get_configuration()

    def perform_update(self, serializer):
        serializer.save(modifie_par=self.request.user)


class ProfilView(generics.RetrieveUpdateAPIView):
    serializer_class = ProfilSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]

    def get_object(self):
        profil, _ = ProfilUtilisateur.objects.get_or_create(utilisateur=self.request.user)
        return profil


class ChangerMotDePasseView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = ChangerMotDePasseSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        utilisateur = request.user
        ancien = serializer.validated_data['ancien_mot_de_passe']
        nouveau = serializer.validated_data['nouveau_mot_de_passe']

        if not utilisateur.check_password(ancien):
            return Response({"erreur": "Ancien mot de passe incorrect."}, status=status.HTTP_400_BAD_REQUEST)

        utilisateur.set_password(nouveau)
        utilisateur.save()

        try:
            profil = utilisateur.profil
            profil.changement_mdp_obligatoire = False
            profil.save()
        except Exception:
            pass

        return Response({"succes": True}, status=status.HTTP_200_OK)


class AdminUserListView(generics.ListCreateAPIView):
    permission_classes = [IsAdminUser]

    def get_queryset(self):
        return User.objects.filter(is_superuser=False).order_by('username')

    def get(self, request):
        users = self.get_queryset()
        result = []
        for u in users:
            connexions = ConnexionLog.objects.filter(utilisateur=u).values('ip_address', 'user_agent', 'date_connexion')[:5]
            dept = None
            try:
                if hasattr(u, 'profil') and u.profil.departement:
                    dept = {"id": u.profil.departement.id, "nom": u.profil.departement.nom}
            except Exception:
                pass
            photo_url = None
            try:
                if hasattr(u, 'profil') and u.profil.photo:
                    photo_url = u.profil.photo.url
            except Exception:
                pass
            result.append({
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "est_admin": u.is_staff,
                "est_actif": u.is_active,
                "photo": photo_url,
                "appareils": list(connexions),
                "departement": dept,
            })
        return Response(result)

    def post(self, request):
        username = request.data.get('username', '').strip()
        email = request.data.get('email', '').strip()
        departement_id = request.data.get('departement_id')
        
        if not username or not email:
            return Response({"erreur": "Nom d'utilisateur et email requis."}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(Q(username__iexact=username) | Q(email__iexact=email)).exists():
            return Response({"erreur": "Nom d'utilisateur ou email déjà utilisé."}, status=status.HTTP_400_BAD_REQUEST)

        departement = None
        if departement_id:
            try:
                departement = Departement.objects.get(id=departement_id)
            except Departement.DoesNotExist:
                return Response({"erreur": "Département invalide."}, status=status.HTTP_400_BAD_REQUEST)

        alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
        password = ''.join(secrets.choice(alphabet) for _ in range(12))

        print("\n" + "="*60)
        print(f" NOUVEAU MOT DE PASSE GÉNÉRÉ pour {username} : {password}")
        print("="*60 + "\n")
        
        user = User.objects.create_user(username=username, email=email, password=password, is_active=True)
        
        profil, _ = ProfilUtilisateur.objects.get_or_create(utilisateur=user)
        if departement:
            profil.departement = departement
        profil.changement_mdp_obligatoire = True
        profil.save()

        html_content = EMAIL_HTML_TEMPLATE.replace("{{ username }}", username) \
                                          .replace("{{ email }}", email) \
                                          .replace("{{ password }}", password) \
                                          .replace("{{ site_url }}", getattr(settings, 'SITE_URL', 'http://localhost:5173'))
        
        texte_brut = (f"Bonjour {username},\n\n"
                      f"Votre compte SAE a été créé.\n\n"
                      f"Email : {email}\n"
                      f"Mot de passe : {password}\n\n"
                      f"Connectez-vous sur : {getattr(settings, 'SITE_URL', 'http://localhost:5173')}\n\n"
                      f"Vous devrez changer votre mot de passe à la première connexion.\n")

        try:
            send_mail(
                subject="Bienvenue sur SAE - Vos identifiants de connexion",
                message=texte_brut,
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@sae.local'),
                recipient_list=[email],
                html_message=html_content,
                fail_silently=False,
            )
            print(f"✅ SUCCÈS : Email envoyé à {email}")
        except Exception as e:
            print(f"❌ ERREUR CRITIQUE D'ENVOI D'EMAIL : {e}")

        return Response({
            "id": user.id, 
            "username": user.username, 
            "email": user.email,
            "est_admin": False, 
            "est_actif": True,
            "message": "Utilisateur créé avec succès. Un e-mail avec les identifiants a été envoyé."
        }, status=status.HTTP_201_CREATED)


class AdminUserToggleActiveView(APIView):
    permission_classes = [IsAdminUser]

    def post(self, request, pk):
        try:
            user = User.objects.get(pk=pk, is_superuser=False)
            user.is_active = not user.is_active
            user.save()
            return Response({"est_actif": user.is_active})
        except User.DoesNotExist:
            return Response({"erreur": "Utilisateur introuvable."}, status=status.HTTP_404_NOT_FOUND)


class AdminUserToggleAdminView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, pk):
        try:
            user = User.objects.get(pk=pk, is_superuser=False)
            est_admin = request.data.get('est_admin', False)
            user.is_staff = bool(est_admin)
            user.save()
            return Response({"est_admin": user.is_staff})
        except User.DoesNotExist:
            return Response({"erreur": "Utilisateur introuvable."}, status=status.HTTP_404_NOT_FOUND)


class AdminUserDepartementsAutorisesView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            profil, _ = ProfilUtilisateur.objects.get_or_create(utilisateur=user)
            return Response({
                "departements_autorises": list(profil.departements_autorises.values_list('id', flat=True)),
                "departements_autorises_noms": [d.nom for d in profil.departements_autorises.all()],
                "departement": profil.departement_id,
                "departement_nom": profil.departement.nom if profil.departement else None,
            })
        except User.DoesNotExist:
            return Response({"erreur": "Utilisateur introuvable."}, status=404)

    def patch(self, request, pk):
        try:
            user = User.objects.get(pk=pk)
            profil, _ = ProfilUtilisateur.objects.get_or_create(utilisateur=user)
            dept_ids = request.data.get('departements_autorises', [])
            if not isinstance(dept_ids, list):
                return Response({"erreur": "departements_autorises doit être une liste."}, status=400)
            profil.departements_autorises.set(dept_ids)
            return Response({
                "departements_autorises": list(profil.departements_autorises.values_list('id', flat=True)),
                "departements_autorises_noms": [d.nom for d in profil.departements_autorises.all()],
            })
        except User.DoesNotExist:
            return Response({"erreur": "Utilisateur introuvable."}, status=404)


class DomaineEmailViewSet(viewsets.ModelViewSet):
    queryset = DomaineEmail.objects.all()
    serializer_class = DomaineEmailSerializer
    permission_classes = [IsAdminUser]
    filter_backends = [filters.OrderingFilter]
    ordering_fields = ['domaine', 'actif']

    def perform_create(self, serializer):
        domaine_brut = serializer.validated_data.get('domaine', '').strip().lower()
        domaine_propre = domaine_brut.lstrip('@')
        
        if DomaineEmail.objects.filter(domaine__iexact=domaine_propre).exists():
            raise ValidationError({"domaine": "Ce domaine est déjà configuré."})
        
        serializer.save(domaine=domaine_propre)


class DomaineEmailBulkView(APIView):
    permission_classes = [IsAdminUser]
    
    def post(self, request):
        action = request.data.get('action')
        domaines_ids = request.data.get('domaines', [])
        
        if not domaines_ids:
            return Response({"erreur": "Aucun domaine sélectionné."}, status=status.HTTP_400_BAD_REQUEST)
        
        if action not in ['activer', 'desactiver']:
            return Response({"erreur": "Action invalide."}, status=status.HTTP_400_BAD_REQUEST)
        
        DomaineEmail.objects.filter(id__in=domaines_ids).update(actif=(action == 'activer'))
        return Response({"succes": f"Domaines {action}s avec succès."})