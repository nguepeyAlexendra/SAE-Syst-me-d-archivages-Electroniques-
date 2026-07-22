import psutil
import platform
from datetime import datetime, timedelta
from minio import Minio
from minio.error import S3Error

from rest_framework import generics, permissions, parsers, filters, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.db.models import Count, Q
from django.utils import timezone

from .models import Document, Categorie, Departement, Tag, LogAction, ConnexionLog
from .serializers import (
    DocumentSerializer, CategorieSerializer, DepartementSerializer,
    TagSerializer, LogActionSerializer, ConnexionLogSerializer,
)
from .services import executer_pipeline
from django.core.mail import send_mail
from django.conf import settings

class DocumentListCreateView(generics.ListCreateAPIView):
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['titre', 'contenu_texte']
    ordering_fields = ['titre', 'date_depot', 'taille_fichier', 'statut', 'departement__nom']

    def get_queryset(self):
        user = self.request.user
        qs = Document.objects.filter(est_supprime=False)

        # Filtre par groupe (sidebar)
        groupe = self.request.query_params.get('groupe')
        if groupe:
            qs = qs.filter(groupe=groupe)

        # Filtre par département
        dept = self.request.query_params.get('departement')
        if dept:
            qs = qs.filter(departement_id=dept)

        # Filtre par statut
        statut = self.request.query_params.get('statut')
        if statut:
            qs = qs.filter(statut=statut)

        # Filtre par favoris
        favoris = self.request.query_params.get('favoris')
        if favoris == 'true':
            qs = qs.filter(favoris=user)

        if user.is_staff:
            return qs

        return qs.filter(
            Q(est_confidentiel=False)
            | Q(est_confidentiel=True, depose_par=user)
            | Q(est_confidentiel=True, utilisateurs_autorises=user)
        ).distinct()

    def perform_create(self, serializer):
        document = serializer.save(depose_par=self.request.user)
        executer_pipeline(document)


class DocumentDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Document.objects.all()
        return Document.objects.filter(
            Q(est_confidentiel=False)
            | Q(est_confidentiel=True, depose_par=user)
            | Q(est_confidentiel=True, utilisateurs_autorises=user)
        ).distinct()


class DocumentToggleFavoriView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        doc = Document.objects.filter(pk=pk).first()
        if not doc:
            return Response({"erreur": "Document introuvable."}, status=404)
        user = request.user
        if user in doc.favoris.all():
            doc.favoris.remove(user)
            return Response({"favori": False})
        else:
            doc.favoris.add(user)
            return Response({"favori": True})


class DocumentDeleteView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def delete(self, request, pk):
        doc = Document.objects.filter(pk=pk, est_supprime=False).first()
        if not doc:
            return Response({"erreur": "Document introuvable."}, status=404)
        titre = doc.titre
        doc.est_supprime = True
        doc.date_suppression = timezone.now()
        doc.save()

        LogAction.objects.create(
            document=doc, type_action=LogAction.TypeAction.SUPPRESSION,
            cause=f"Supprimé par {request.user.username}",
            effectue_par=request.user,
        )
        return Response({"succes": True, "message": f"Document '{titre}' supprimé."})


class LogActionListView(generics.ListAPIView):
    serializer_class = LogActionSerializer
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        type_action = self.request.query_params.get('type')
        qs = LogAction.objects.all()
        if type_action:
            qs = qs.filter(type_action=type_action)
        return qs


class ServerStatsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        boot = datetime.fromtimestamp(psutil.boot_time())
        uptime_seconds = (datetime.now() - boot).total_seconds()
        days, rem = divmod(uptime_seconds, 86400)
        hours, rem = divmod(rem, 3600)
        minutes, _ = divmod(rem, 60)
        uptime_str = f"{int(days)}j {int(hours)}h {int(minutes)}m"

        mem = psutil.virtual_memory()
        cpu_percent = psutil.cpu_percent(interval=0.5)

        connexions_recentes = ConnexionLog.objects.filter(
            date_connexion__gte=timezone.now() - timedelta(hours=24)
        ).count()

        return Response({
            "platform": platform.platform(),
            "python_version": platform.python_version(),
            "uptime": uptime_str,
            "cpu_percent": cpu_percent,
            "cpu_count": psutil.cpu_count(),
            "memory_total": round(mem.total / (1024**3), 2),
            "memory_used": round(mem.used / (1024**3), 2),
            "memory_percent": mem.percent,
            "disk_total": round(psutil.disk_usage('/').total / (1024**3), 2),
            "disk_used": round(psutil.disk_usage('/').used / (1024**3), 2),
            "disk_percent": psutil.disk_usage('/').percent,
            "connexions_24h": connexions_recentes,
        })


class AdminStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        base = Document.objects.filter(est_supprime=False)
        total = base.count()
        en_cours = base.filter(statut=Document.Statut.EN_COURS).count()
        valide = base.filter(statut=Document.Statut.VALIDE).count()
        rejete = base.filter(statut=Document.Statut.REJETE).count()

        par_dept = base.values('departement__nom').annotate(
            total=Count('id'), valide=Count('id', filter=Q(statut='valide')),
            rejete=Count('id', filter=Q(statut='rejete')),
        ).order_by('-total')

        par_categorie = base.values('categorie__nom').annotate(
            count=Count('id')
        ).order_by('-count')

        top_rejet = LogAction.objects.filter(
            type_action=LogAction.TypeAction.REJET
        ).values('cause').annotate(count=Count('id')).order_by('-count')[:5]

        hebdo = []
        for i in range(7, -1, -1):
            jour = timezone.now().date() - timedelta(days=i)
            count = base.filter(date_depot__date=jour).count()
            hebdo.append({"date": jour.isoformat(), "count": count})

        return Response({
            "total": total, "en_cours": en_cours, "valide": valide, "rejete": rejete,
            "par_departement": list(par_dept),
            "par_categorie": list(par_categorie),
            "top_causes_rejet": list(top_rejet),
            "activite_hebdo": hebdo,
        })


class AdminConfigurationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            "max_file_size_mb": 50,
            "allowed_mime_types": [
                "application/pdf", "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "image/jpeg", "image/png", "video/mp4", "audio/mpeg", "text/plain",
            ],
            "tags_proposes": [
                "urgent", "en_revision", "archive", "a_verifier", "confidentiel",
                "interne", "client", "fournisseur", "legal", "financier",
                "trimestriel", "annuel", "brouillon", "version_finale",
                "a_signer", "a_approuver", "en_attente_retour",
            ],
            "pipeline_active": True,
        })


class CategorieListView(generics.ListCreateAPIView):
    queryset = Categorie.objects.all()
    serializer_class = CategorieSerializer
    permission_classes = [permissions.IsAuthenticated]


class CategorieDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Categorie.objects.all()
    serializer_class = CategorieSerializer
    permission_classes = [permissions.IsAdminUser]


class DepartementListView(generics.ListCreateAPIView):
    queryset = Departement.objects.all()
    serializer_class = DepartementSerializer
    permission_classes = [permissions.IsAdminUser]


class TagListView(generics.ListCreateAPIView):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticated]


class TagDeleteView(generics.DestroyAPIView):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAdminUser]

class PartagerDocumentView(APIView):
    """
    POST /api/documents/<id>/partager/
    Envoie un email professionnel avec le lien du document.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        email_destinataire = request.data.get('email', '').strip()
        message_perso = request.data.get('message', '').strip()

        if not email_destinataire:
            return Response({"erreur": "L'email du destinataire est requis."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            document = Document.objects.get(pk=pk, est_supprime=False)
            
            # Vérification des droits (sécurisée)
            if not request.user.is_staff:
                if getattr(document, 'est_confidentiel', False):
                    if request.user != getattr(document, 'depose_par', None):
                        utilisateurs_autorises = getattr(document, 'utilisateurs_autorises', [])
                        if request.user not in utilisateurs_autorises:
                            return Response({"erreur": "Vous n'avez pas les droits pour partager ce document."}, status=status.HTTP_403_FORBIDDEN)

            site_url = getattr(settings, 'SITE_URL', 'http://localhost:5173')
            lien_document = f"{site_url}/documents/{document.id}"

            # Template HTML SOBRE ET PROFESSIONNEL (même style que l'email de création de compte)
            html_content = f"""
            <!DOCTYPE html>
            <html lang="fr">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Document partagé</title>
            </head>
            <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #334155;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 20px;">
                    <tr>
                        <td align="center">
                            <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border: 1px solid #e2e8f0;">
                                
                                <!-- EN-TÊTE SOBRE AVEC LOGO (FOND BLANC) -->
                                <tr>
                                    <td style="background-color: #ffffff; padding: 40px 30px 30px 30px; text-align: center; border-bottom: 2px solid #f1f5f9;">
                                        <img src="https://i.imgur.com/oXxC88s.png" 
                                             alt="Logo SAE" 
                                             style="display: block; margin: 0 auto 20px auto; max-width: 100px; height: auto;">
                                        <h1 style="margin: 0; color: #0f172a; font-size: 24px; font-weight: 600; letter-spacing: -0.3px;">
                                            Document partagé
                                        </h1>
                                        <p style="margin: 8px 0 0 0; color: #64748b; font-size: 14px; font-weight: 400;">
                                            Via la plateforme SAE
                                        </p>
                                    </td>
                                </tr>
                                
                                <tr>
                                    <td style="padding: 40px;">
                                        <p style="margin: 0 0 24px 0; color: #334155; font-size: 15px; line-height: 1.6;">
                                            Bonjour,<br><br>
                                            <strong style="color: #0f172a; font-weight: 600;">{request.user.username}</strong> vous a partagé le document suivant :
                                        </p>
                                        
                                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #0f172a; border-radius: 6px; padding: 24px; margin: 24px 0;">
                                            <p style="margin: 0 0 8px 0; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">
                                                Document
                                            </p>
                                            <p style="margin: 0; color: #0f172a; font-size: 16px; font-weight: 600;">
                                                📄 {document.titre}
                                            </p>
                                        </div>
                                        
                                        {f'<p style="margin: 0 0 24px 0; padding: 16px 20px; background-color: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px; color: #92400e; font-size: 13px; line-height: 1.5; font-style: italic;">"{message_perso}"</p>' if message_perso else ''}
                                        
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 32px 0;">
                                            <tr>
                                                <td align="center">
                                                    <a href="{lien_document}" style="display: inline-block; padding: 12px 32px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; letter-spacing: 0.3px;">
                                                        Voir le document
                                                    </a>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <p style="margin: 0; color: #94a3b8; font-size: 13px; line-height: 1.6; text-align: center;">
                                            Si vous n'êtes pas le destinataire de ce message, veuillez l'ignorer.
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="background-color: #f8fafc; padding: 24px 40px; text-align: center; border-top: 1px solid #e2e8f0;">
                                        <p style="margin: 0; color: #94a3b8; font-size: 11px; line-height: 1.6;">
                                            Cet e-mail a été envoyé automatiquement par la plateforme SAE.<br>
                                            © 2026 SAE. Tous droits réservés.
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

            texte_brut = (
                f"Bonjour,\n\n"
                f"{request.user.username} vous a partagé le document : {document.titre}\n\n"
                f"{f'Message : {message_perso}\n\n' if message_perso else ''}"
                f"Vous pouvez le consulter ici : {lien_document}\n\n"
                f"Cordialement,\nL'équipe SAE"
            )

            # Envoi de l'email
            send_mail(
                subject=f"{request.user.username} vous a partagé un document sur SAE",
                message=texte_brut,
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@sae.local'),
                recipient_list=[email_destinataire],
                html_message=html_content,
                fail_silently=False,
            )

            # Logging sécurisé
            try:
                type_action = getattr(LogAction.TypeAction, 'PARTAGE', 'partage')
                LogAction.objects.create(
                    document=document,
                    type_action=type_action,
                    cause=f"Partagé avec {email_destinataire}",
                    effectue_par=request.user,
                )
            except Exception:
                pass

            return Response({"succes": "Email de partage envoyé avec succès."}, status=status.HTTP_200_OK)

        except Document.DoesNotExist:
            return Response({"erreur": "Document introuvable."}, status=status.HTTP_404_NOT_FOUND)
        except Exception as e:
            return Response({"erreur": f"Erreur interne : {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

class MinioStatsView(APIView):
    """Renvoie les statistiques réelles du serveur MinIO"""
    permission_classes = [IsAdminUser]

    def get(self, request):
        try:
            # Récupérer les infos de connexion depuis settings.py
            minio_client = Minio(
                settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=False  # Mettre à True si vous utilisez HTTPS
            )

            # 1. Lister tous les buckets
            buckets = minio_client.list_buckets()
            bucket_names = [bucket.name for bucket in buckets]
            
            total_objects = 0
            total_size = 0

            # 2. Compter les objets et la taille totale pour chaque bucket
            for bucket in bucket_names:
                try:
                    objects = minio_client.list_objects(bucket, recursive=True)
                    for obj in objects:
                        total_objects += 1
                        total_size += obj.size if obj.size else 0
                except Exception:
                    pass  # Si un bucket est inaccessible, on continue

            # Convertir en Go
                        # ... (tout le code au-dessus reste identique) ...
            
            # On garde le calcul en Go au cas où, mais on envoie surtout les octets bruts
            total_size_gb = round(total_size / (1024 ** 3), 2)

            return Response({
                "buckets_count": len(bucket_names),
                "buckets": bucket_names,
                "total_objects": total_objects,
                "total_size_bytes": total_size, # ✅ AJOUTEZ CETTE LIGNE
                "total_size_gb": total_size_gb,
                "status": "connecté"
            })
        except Exception as e:
            return Response({
                "status": "déconnecté",
                "error": str(e),
                "buckets_count": 0,
                "total_objects": 0,
                "total_size_gb": 0
            }, status=503)