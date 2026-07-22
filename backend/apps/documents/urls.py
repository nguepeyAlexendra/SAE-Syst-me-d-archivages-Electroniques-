from django.urls import path
from .views import (
    DocumentListCreateView, DocumentDetailView, DocumentToggleFavoriView, DocumentDeleteView,
    LogActionListView, MinioStatsView, ServerStatsView, PartagerDocumentView,
)

urlpatterns = [
    path('', DocumentListCreateView.as_view(), name='documents-liste'),
    path('corbeille/', DocumentListCreateView.as_view(), name='corbeille-liste'),
    path('logs/', LogActionListView.as_view(), name='logs-list'),
    path('serveur/', ServerStatsView.as_view(), name='serveur-stats'),
    path('<int:pk>/', DocumentDetailView.as_view(), name='document-detail'),
    path('<int:pk>/favori/', DocumentToggleFavoriView.as_view(), name='document-favori'),
    path('<int:pk>/supprimer/', DocumentDeleteView.as_view(), name='document-supprimer'),
    path('<int:pk>/partager/', PartagerDocumentView.as_view(), name='partager-document'),  # ✅ Corrigé
    path('minio-stats/', MinioStatsView.as_view(), name='minio-stats'),
]