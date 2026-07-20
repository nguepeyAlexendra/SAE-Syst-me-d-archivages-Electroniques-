from rest_framework import generics, permissions, parsers, filters
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count
from .models import Document

from django.utils import timezone
from django.db.models import Q
from datetime import timedelta

from .models import Document, Categorie, Tag
from .serializers import DocumentSerializer, CategorieSerializer, TagSerializer
from .services import executer_pipeline


class DocumentListCreateView(generics.ListCreateAPIView):
    """
    Route API : GET  /api/documents/          -> liste les documents
                POST /api/documents/          -> dépose un nouveau document
    """
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [parsers.MultiPartParser, parsers.FormParser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['titre', 'contenu_texte']
    ordering_fields = ['titre', 'date_depot', 'taille_fichier']

    # ✅ CORRECTION : Indentation de 4 espaces pour être DANS la classe
    def get_queryset(self):
        utilisateur = self.request.user
        base = Document.objects.filter(est_supprime=False)

        if utilisateur.is_staff:
            return base

        return base.filter(
            Q(est_confidentiel=False)
            | Q(est_confidentiel=True, depose_par=utilisateur)
            | Q(est_confidentiel=True, utilisateurs_autorises=utilisateur)
        ).distinct()
    
    # ✅ CORRECTION : Indentation de 4 espaces pour être DANS la classe
    def perform_create(self, serializer):
        # On force le "déposant" à être l'utilisateur connecté,
        # impossible pour React de tricher en envoyant un autre utilisateur.
        document = serializer.save(depose_par=self.request.user)

        # Déclenche immédiatement le pipeline ETL (version synchrone pour l'instant)
        executer_pipeline(document)


class CategorieListView(generics.ListCreateAPIView):
    queryset = Categorie.objects.all()
    serializer_class = CategorieSerializer
    permission_classes = [permissions.IsAuthenticated]


class TagListView(generics.ListCreateAPIView):
    queryset = Tag.objects.all()
    serializer_class = TagSerializer
    permission_classes = [permissions.IsAuthenticated]


class DocumentDetailView(generics.RetrieveAPIView):
    """GET /api/documents/<id>/ -> détail d'un document précis (utilisé pour le suivi du pipeline)"""
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        utilisateur = self.request.user
        if utilisateur.is_staff:
            return Document.objects.all()
        return Document.objects.filter(
            Q(est_confidentiel=False)
            | Q(est_confidentiel=True, depose_par=utilisateur)
            | Q(est_confidentiel=True, utilisateurs_autorises=utilisateur)
        ).distinct()


def _verifier_droit_modification(document, utilisateur):
    """Seuls le déposant, les utilisateurs autorisés, et l'admin peuvent modifier/supprimer."""
    if utilisateur.is_staff:
        return True
    if document.depose_par_id == utilisateur.id:
        return True
    return document.utilisateurs_autorises.filter(id=utilisateur.id).exists()


class RenommerDocumentView(APIView):
    """PATCH /api/documents/<id>/renommer/"""
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        document = Document.objects.filter(pk=pk, est_supprime=False).first()
        if not document:
            return Response({"erreur": "Document introuvable."}, status=404)
        if not _verifier_droit_modification(document, request.user):
            return Response({"erreur": "Action non autorisée."}, status=403)

        nouveau_titre = request.data.get('titre', '').strip()
        if not nouveau_titre:
            return Response({"erreur": "Le titre ne peut pas être vide."}, status=400)

        document.titre = nouveau_titre
        document.save()
        return Response(DocumentSerializer(document).data)


class CorbeilleDocumentView(APIView):
    """POST /api/documents/<id>/corbeille/ -> déplace vers la corbeille"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        document = Document.objects.filter(pk=pk, est_supprime=False).first()
        if not document:
            return Response({"erreur": "Document introuvable."}, status=404)
        if not _verifier_droit_modification(document, request.user):
            return Response({"erreur": "Action non autorisée."}, status=403)

        document.est_supprime = True
        document.date_suppression = timezone.now()
        document.save()
        return Response({"succes": True})


class RestaurerDocumentView(APIView):
    """POST /api/documents/<id>/restaurer/"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        document = Document.objects.filter(pk=pk, est_supprime=True).first()
        if not document:
            return Response({"erreur": "Document introuvable dans la corbeille."}, status=404)
        if not _verifier_droit_modification(document, request.user):
            return Response({"erreur": "Action non autorisée."}, status=403)

        document.est_supprime = False
        document.date_suppression = None
        document.save()
        return Response({"succes": True})


class SupprimerDefinitivementView(APIView):
    """DELETE /api/documents/<id>/supprimer-definitivement/"""
    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk):
        document = Document.objects.filter(pk=pk, est_supprime=True).first()
        if not document:
            return Response({"erreur": "Document introuvable dans la corbeille."}, status=404)
        if not _verifier_droit_modification(document, request.user):
            return Response({"erreur": "Action non autorisée."}, status=403)

        document.fichier.delete(save=False)  # supprime aussi le vrai fichier du disque
        document.delete()
        return Response({"succes": True})


class CorbeilleListeView(generics.ListAPIView):
    """GET /api/documents/corbeille/ -> liste les documents supprimés de l'utilisateur, purge les >30 jours"""
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Purge automatique des éléments de plus de 30 jours (purge "paresseuse")
        limite = timezone.now() - timedelta(days=30)
        Document.objects.filter(est_supprime=True, date_suppression__lt=limite).delete()

        utilisateur = self.request.user
        if utilisateur.is_staff:
            return Document.objects.filter(est_supprime=True)
        return Document.objects.filter(est_supprime=True, depose_par=utilisateur)
    

class AdminStatsView(APIView):
    """
    GET /api/admin/stats/
    Renvoie les statistiques globales pour le tableau de bord admin.
    """
    permission_classes = [IsAuthenticated] # Tu peux mettre IsAdminUser si réservé aux admins

    def get(self, request):
        # On exclut les documents supprimés (corbeille) des stats
        base_queryset = Document.objects.filter(est_supprime=False)

        # 1. Comptages globaux
        total_documents = base_queryset.count()
        en_cours = base_queryset.filter(statut=Document.Statut.EN_COURS).count()
        valide = base_queryset.filter(statut=Document.Statut.VALIDE).count()
        rejete = base_queryset.filter(statut=Document.Statut.REJETE).count()

        # 2. Répartition par groupe (documents, images, media, autres)
        stats_par_groupe = base_queryset.values('groupe').annotate(
            total=Count('groupe')
        ).order_by('-total')

        # 3. (Optionnel) Répartition par type MIME
        stats_par_mime = base_queryset.values('type_mime').annotate(
            total=Count('type_mime')
        ).order_by('-total')[:5] # Top 5 des types de fichiers

        return Response({
            "total": total_documents,
            "en_cours": en_cours,
            "valide": valide,
            "rejete": rejete,
            "par_groupe": list(stats_par_groupe),
            "top_types": list(stats_par_mime)
        })
class AdminConfigurationView(APIView):
    """
    GET /api/admin/configuration/
    Renvoie la configuration du système pour le dashboard admin.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Tu pourras remplir ceci avec de vraies données plus tard si besoin
        return Response({
            "max_file_size_mb": 50,
            "allowed_mime_types": [
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "image/jpeg",
                "image/png",
                "text/plain"
            ],
            "retention_days": 30,
            "pipeline_active": True
        })