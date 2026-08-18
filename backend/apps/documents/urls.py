from django.urls import path
from .views import (
    DocumentListCreateView,
    DocumentDetailView,
    DocumentToggleFavoriView,
    DocumentArchiverView,
    DocumentDesarchiverView,
    LogActionListView,
    MinioStatsView,
    ServerStatsView,
    PartagerDocumentView,
    ExtraireTexteView,
)

urlpatterns = [
    path('', DocumentListCreateView.as_view(), name='documents-liste'),
    path('corbeille/', DocumentListCreateView.as_view(), name='corbeille-liste'),
    path('logs/', LogActionListView.as_view(), name='logs-list'),
    path('serveur/', ServerStatsView.as_view(), name='serveur-stats'),
    path('<int:pk>/', DocumentDetailView.as_view(), name='document-detail'),
    path('<int:pk>/favori/', DocumentToggleFavoriView.as_view(), name='document-favori'),
    path('<int:pk>/archiver/', DocumentArchiverView.as_view(), name='document-archiver'),
    path('<int:pk>/desarchiver/', DocumentDesarchiverView.as_view(), name='document-desarchiver'),
    path('<int:pk>/partager/', PartagerDocumentView.as_view(), name='partager-document'),
    path('<int:pk>/extraire-texte/', ExtraireTexteView.as_view(), name='extraire-texte'),
    path('minio-stats/', MinioStatsView.as_view(), name='minio-stats'),
]