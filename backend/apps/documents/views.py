import psutil
import platform
from datetime import datetime, timedelta
from minio import Minio
from minio.error import S3Error

from django.contrib.auth.models import User
from rest_framework import generics, permissions, parsers, filters, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, IsAdminUser
from django.db.models import Count, Q
from django.utils import timezone

from .models import Document, Categorie, Departement, Tag, LogAction, ConnexionLog
from apps.accounts.models import ProfilUtilisateur
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
        qs = Document.objects.filter(est_supprime=False).exclude(statut='rejete')

        if user.is_staff:
            dept_param = self.request.query_params.get('departement')
            if dept_param:
                qs = qs.filter(departement_id=dept_param)
            groupe = self.request.query_params.get('groupe')
            if groupe:
                qs = qs.filter(groupe=groupe)

        else:
            profil = getattr(user, 'profil', None)
            if not profil or not profil.departement_id:
                return Document.objects.none()

            user_dept_id = profil.departement_id
            extra_dept_ids = list(profil.departements_autorises.values_list('id', flat=True))
            dept_ids = [user_dept_id] + extra_dept_ids
            qs = qs.filter(
                Q(departement_id__in=dept_ids)
                | Q(departements_autorises=user_dept_id)
            )

            groupe = self.request.query_params.get('groupe')
            if groupe:
                qs = qs.filter(groupe=groupe)

            statut = self.request.query_params.get('statut')
            if statut:
                qs = qs.filter(statut=statut)

            favoris = self.request.query_params.get('favoris')
            if favoris == 'true':
                qs = qs.filter(favoris=user)

            qs = qs.filter(
                Q(est_confidentiel=False)
                | Q(est_confidentiel=True, depose_par=user)
                | Q(est_confidentiel=True, utilisateurs_autorises=user)
            )

        # Filtrage par date
        date_debut = self.request.query_params.get('date_debut')
        date_fin = self.request.query_params.get('date_fin')
        date_precise = self.request.query_params.get('date_precise')

        if date_precise:
            qs = qs.filter(date_depot__date=date_precise)
        else:
            if date_debut:
                qs = qs.filter(date_depot__date__gte=date_debut)
            if date_fin:
                qs = qs.filter(date_depot__date__lte=date_fin)

        # Ordre de tri
        ordre_date = self.request.query_params.get('ordre_date')
        ordre_nom = self.request.query_params.get('ordre_nom')

        if ordre_date == 'asc':
            qs = qs.order_by('date_depot')
        elif ordre_date == 'desc':
            qs = qs.order_by('-date_depot')
        elif ordre_nom == 'asc':
            qs = qs.order_by('titre')
        elif ordre_nom == 'desc':
            qs = qs.order_by('-titre')

        return qs.distinct()

    def perform_create(self, serializer):
        user = self.request.user
        profil = getattr(user, 'profil', None)
        if not user.is_staff and profil and serializer.validated_data.get('departement'):
            dept_id = serializer.validated_data['departement'].id
            if dept_id != profil.departement_id:
                raise permissions.PermissionDenied("Vous ne pouvez déposer que dans votre propre département.")
        groupe_attendu = self.request.data.get('groupe_attendu')
        document = serializer.save(depose_par=user)
        executer_pipeline(document, groupe_attendu=groupe_attendu)


class DocumentDetailView(generics.RetrieveUpdateAPIView):
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_staff:
            return Document.objects.all()

        profil = getattr(user, 'profil', None)
        if not profil or not profil.departement_id:
            return Document.objects.none()

        user_dept_id = profil.departement_id
        extra_dept_ids = list(profil.departements_autorises.values_list('id', flat=True))

        return Document.objects.filter(
            Q(departement_id__in=[user_dept_id] + extra_dept_ids)
            | Q(departements_autorises=user_dept_id)
        ).filter(
            Q(est_confidentiel=False)
            | Q(est_confidentiel=True, depose_par=user)
            | Q(est_confidentiel=True, utilisateurs_autorises=user)
        ).distinct()

    def perform_update(self, serializer):
        user = self.request.user
        if user.is_staff:
            return serializer.save()
        document = self.get_object()
        profil = getattr(user, 'profil', None)
        if not profil or document.departement_id != profil.departement_id:
            raise permissions.PermissionDenied("Vous n'avez pas les droits pour modifier ce document (accès en lecture seule).")
        serializer.save()


class DocumentToggleFavoriView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        doc = Document.objects.filter(pk=pk, est_supprime=False).first()
        if not doc:
            return Response({"erreur": "Document introuvable."}, status=404)
        user = request.user
        
        if not user.is_staff:
            profil = getattr(user, 'profil', None)
            if not profil or not profil.departement_id:
                return Response({"erreur": "Document introuvable."}, status=404)

            user_dept_id = profil.departement_id
            extra_dept_ids = list(profil.departements_autorises.values_list('id', flat=True))
            allowed_ids = [user_dept_id] + extra_dept_ids

            if doc.departement_id not in allowed_ids and not doc.departements_autorises.filter(id=user_dept_id).exists():
                return Response({"erreur": "Document introuvable."}, status=404)
                
            if doc.est_confidentiel and user != doc.depose_par and user not in doc.utilisateurs_autorises.all():
                return Response({"erreur": "Document introuvable."}, status=404)
                
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
        qs = LogAction.objects.all()

        type_action = self.request.query_params.get('type')
        if type_action:
            qs = qs.filter(type_action=type_action)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(document__titre__icontains=search)
                | Q(cause__icontains=search)
                | Q(effectue_par__username__icontains=search)
            )

        date_debut = self.request.query_params.get('date_debut')
        date_fin = self.request.query_params.get('date_fin')
        date_precise = self.request.query_params.get('date_precise')

        if date_precise:
            qs = qs.filter(date_action__date=date_precise)
        else:
            if date_debut:
                qs = qs.filter(date_action__date__gte=date_debut)
            if date_fin:
                qs = qs.filter(date_action__date__lte=date_fin)

        ordre_date = self.request.query_params.get('ordre_date')
        if ordre_date == 'asc':
            qs = qs.order_by('date_action')
        elif ordre_date == 'desc':
            qs = qs.order_by('-date_action')

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

    def get_permissions(self):
        if self.request.method == 'GET':
            return [permissions.IsAuthenticated()]
        return [permissions.IsAdminUser()]


class DepartementDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Departement.objects.all()
    serializer_class = DepartementSerializer
    permission_classes = [permissions.IsAdminUser]


class DepartementUserListView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request, pk):
        try:
            dept = Departement.objects.get(pk=pk)
        except Departement.DoesNotExist:
            return Response({"erreur": "Département introuvable."}, status=404)

        profils = ProfilUtilisateur.objects.filter(departement=dept).select_related('utilisateur')
        users = []
        for p in profils:
            users.append({
                "id": p.utilisateur.id,
                "username": p.utilisateur.username,
                "email": p.utilisateur.email,
                "est_admin": p.utilisateur.is_staff,
                "est_actif": p.utilisateur.is_active,
            })
        return Response(users)


class DepartementAssignUserView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request, pk):
        user_id = request.data.get('user_id')
        action = request.data.get('action', 'assigner')

        if not user_id:
            return Response({"erreur": "user_id requis."}, status=400)

        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({"erreur": "Utilisateur introuvable."}, status=404)

        if action == 'assigner':
            try:
                dept = Departement.objects.get(pk=pk)
            except Departement.DoesNotExist:
                return Response({"erreur": "Département introuvable."}, status=404)

            profil, _ = ProfilUtilisateur.objects.get_or_create(utilisateur=user)
            profil.departement = dept
            profil.save()
            return Response({"succes": True, "departement": {"id": dept.id, "nom": dept.nom}})

        elif action == 'retirer':
            profil, _ = ProfilUtilisateur.objects.get_or_create(utilisateur=user)
            profil.departement = None
            profil.save()
            return Response({"succes": True, "departement": None})

        return Response({"erreur": "Action invalide."}, status=400)


class DepartementGrantAccessView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def post(self, request):
        source_dept_id = request.data.get('source_departement_id')
        target_dept_ids = request.data.get('target_departement_ids', [])

        if not source_dept_id:
            return Response({"erreur": "source_departement_id requis."}, status=400)
        if not target_dept_ids:
            return Response({"erreur": "target_departement_ids requis (liste)."}, status=400)

        try:
            source_dept = Departement.objects.get(pk=source_dept_id)
        except Departement.DoesNotExist:
            return Response({"erreur": "Département source introuvable."}, status=404)

        profils = ProfilUtilisateur.objects.filter(departement_id__in=target_dept_ids)
        count = 0
        for profil in profils:
            if not profil.departements_autorises.filter(id=source_dept_id).exists():
                profil.departements_autorises.add(source_dept)
                count += 1

        return Response({
            "succes": True,
            "message": f"Accès accordé à {count} utilisateur(s) depuis {source_dept.nom}.",
            "utilisateurs_affectes": count,
        })

    def delete(self, request):
        source_dept_id = request.data.get('source_departement_id')
        target_dept_ids = request.data.get('target_departement_ids', [])

        if not source_dept_id or not target_dept_ids:
            return Response({"erreur": "Paramètres requis."}, status=400)

        profils = ProfilUtilisateur.objects.filter(departement_id__in=target_dept_ids)
        count = 0
        for profil in profils:
            if profil.departements_autorises.filter(id=source_dept_id).exists():
                profil.departements_autorises.remove(source_dept)
                count += 1

        return Response({
            "succes": True,
            "message": f"Accès révoqué pour {count} utilisateur(s).",
            "utilisateurs_affectes": count,
        })


class DocumentPermissionsView(APIView):
    permission_classes = [permissions.IsAdminUser]

    def get(self, request):
        documents = Document.objects.filter(est_supprime=False).order_by('-date_depot')
        data = []
        for doc in documents:
            data.append({
                'id': doc.id,
                'titre': doc.titre,
                'departement_id': doc.departement_id,
                'departement_nom': doc.departement.nom if doc.departement else None,
                'groupe': doc.groupe,
                'utilisateurs_autorises': [
                    {'id': u.id, 'username': u.username}
                    for u in doc.utilisateurs_autorises.all()
                ],
                'departements_autorises': [
                    {'id': d.id, 'nom': d.nom}
                    for d in doc.departements_autorises.all()
                ],
            })
        return Response(data)

    def patch(self, request):
        document_ids = request.data.get('document_ids', [])
        ajouter_utilisateurs = request.data.get('ajouter_utilisateurs', [])
        retirer_utilisateurs = request.data.get('retirer_utilisateurs', [])
        ajouter_departements = request.data.get('ajouter_departements', [])
        retirer_departements = request.data.get('retirer_departements', [])

        if not document_ids:
            return Response({"erreur": "document_ids requis."}, status=400)

        documents = Document.objects.filter(id__in=document_ids)
        count = documents.count()
        for doc in documents:
            if ajouter_utilisateurs:
                doc.utilisateurs_autorises.add(*ajouter_utilisateurs)
            if retirer_utilisateurs:
                doc.utilisateurs_autorises.remove(*retirer_utilisateurs)
            if ajouter_departements:
                doc.departements_autorises.add(*ajouter_departements)
            if retirer_departements:
                doc.departements_autorises.remove(*retirer_departements)

        return Response({
            "succes": True,
            "message": f"Permissions mises à jour pour {count} document(s).",
        })


class TagListView(generics.ListCreateAPIView):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticated]


class TagDeleteView(generics.DestroyAPIView):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAdminUser]


class PartagerDocumentView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        email_destinataire = request.data.get('email', '').strip()
        message_perso = request.data.get('message', '').strip()

        if not email_destinataire:
            return Response({"erreur": "L'email du destinataire est requis."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            document = Document.objects.get(pk=pk, est_supprime=False)
            
            # Vérification des droits (sécurisée avec departements_autorises)
            if not request.user.is_staff:
                profil = getattr(request.user, 'profil', None)
                if not profil or not profil.departement_id:
                    return Response({"erreur": "Vous n'avez pas accès à ce document."}, status=status.HTTP_403_FORBIDDEN)

                user_dept_id = profil.departement_id
                extra_dept_ids = list(profil.departements_autorises.values_list('id', flat=True))
                allowed_ids = [user_dept_id] + extra_dept_ids

                if document.departement_id not in allowed_ids and not document.departements_autorises.filter(id=user_dept_id).exists():
                    return Response({"erreur": "Vous n'avez pas accès à ce document."}, status=status.HTTP_403_FORBIDDEN)

                if document.est_confidentiel:
                    if request.user != document.depose_par and request.user not in document.utilisateurs_autorises.all():
                        return Response({"erreur": "Vous n'avez pas les droits pour partager ce document."}, status=status.HTTP_403_FORBIDDEN)

            site_url = getattr(settings, 'SITE_URL', 'http://localhost:5173')
            lien_document = f"{site_url}/documents/{document.id}"

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
                                <tr>
                                    <td style="background-color: #ffffff; padding: 40px 30px 30px 30px; text-align: center; border-bottom: 2px solid #f1f5f9;">
                                        <img src="https://i.imgur.com/oXxC88s.png" alt="Logo SAE" style="display: block; margin: 0 auto 20px auto; max-width: 100px; height: auto;">
                                        <h1 style="margin: 0; color: #0f172a; font-size: 24px; font-weight: 600; letter-spacing: -0.3px;">Document partagé</h1>
                                        <p style="margin: 8px 0 0 0; color: #64748b; font-size: 14px; font-weight: 400;">Via la plateforme SAE</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 40px;">
                                        <p style="margin: 0 0 24px 0; color: #334155; font-size: 15px; line-height: 1.6;">
                                            Bonjour,<br><br>
                                            <strong style="color: #0f172a; font-weight: 600;">{request.user.username}</strong> vous a partagé le document suivant :
                                        </p>
                                        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #0f172a; border-radius: 6px; padding: 24px; margin: 24px 0;">
                                            <p style="margin: 0 0 8px 0; color: #64748b; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 600;">Document</p>
                                            <p style="margin: 0; color: #0f172a; font-size: 16px; font-weight: 600;">📄 {document.titre}</p>
                                        </div>
                                        {f'<p style="margin: 0 0 24px 0; padding: 16px 20px; background-color: #fffbeb; border-left: 3px solid #f59e0b; border-radius: 4px; color: #92400e; font-size: 13px; line-height: 1.5; font-style: italic;">"{message_perso}"</p>' if message_perso else ''}
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 32px 0;">
                                            <tr>
                                                <td align="center">
                                                    <a href="{lien_document}" style="display: inline-block; padding: 12px 32px; background-color: #0f172a; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 500; font-size: 14px; letter-spacing: 0.3px;">Voir le document</a>
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

            from django.core.mail import EmailMessage
            email_msg = EmailMessage(
                subject=f"{request.user.username} vous a partagé un document sur SAE",
                body=html_content,
                from_email=getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@sae.local'),
                to=[email_destinataire],
            )
            email_msg.content_subtype = 'html'
            try:
                fichier_content = document.fichier.read()
                email_msg.attach(document.fichier.name, fichier_content, document.type_mime or 'application/octet-stream')
            except Exception:
                pass
            email_msg.send(fail_silently=False)

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
            minio_client = Minio(
                settings.MINIO_ENDPOINT,
                access_key=settings.MINIO_ACCESS_KEY,
                secret_key=settings.MINIO_SECRET_KEY,
                secure=False
            )

            buckets = minio_client.list_buckets()
            bucket_names = [bucket.name for bucket in buckets]
            
            total_objects = 0
            total_size = 0

            for bucket in bucket_names:
                try:
                    objects = minio_client.list_objects(bucket, recursive=True)
                    for obj in objects:
                        total_objects += 1
                        total_size += obj.size if obj.size else 0
                except Exception:
                    pass

            total_size_gb = round(total_size / (1024 ** 3), 2)

            return Response({
                "buckets_count": len(bucket_names),
                "buckets": bucket_names,
                "total_objects": total_objects,
                "total_size_bytes": total_size,
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