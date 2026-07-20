from django.urls import path
from .views import (
    DocumentListCreateView, DocumentDetailView, 
    RenommerDocumentView, CorbeilleDocumentView, RestaurerDocumentView,
    SupprimerDefinitivementView, CorbeilleListeView,
)

urlpatterns = [
    path('', DocumentListCreateView.as_view(), name='documents-liste'),
    path('recherche/', DocumentListCreateView.as_view(), name='document-recherche'),
    path('corbeille/', CorbeilleListeView.as_view(), name='corbeille-liste'),
    
    # Routes dynamiques avec ID (toujours à la fin)
    path('<int:pk>/', DocumentDetailView.as_view(), name='document-detail'),
    path('<int:pk>/renommer/', RenommerDocumentView.as_view(), name='document-renommer'),
    path('<int:pk>/corbeille/', CorbeilleDocumentView.as_view(), name='document-corbeille'),
    path('<int:pk>/restaurer/', RestaurerDocumentView.as_view(), name='document-restaurer'),
    path('<int:pk>/supprimer-definitivement/', SupprimerDefinitivementView.as_view(), name='document-supprimer-def'),
]