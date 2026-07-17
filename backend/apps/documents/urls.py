from django.urls import path
from .views import (
    DocumentListCreateView, DocumentDetailView, CategorieListView, TagListView,
    RenommerDocumentView, CorbeilleDocumentView, RestaurerDocumentView,
    SupprimerDefinitivementView, CorbeilleListeView,
)

urlpatterns = [
    path('', DocumentListCreateView.as_view(), name='documents-liste'),
    path('corbeille/', CorbeilleListeView.as_view(), name='corbeille-liste'),
    path('categories/', CategorieListView.as_view(), name='categories-liste'),
    path('tags/', TagListView.as_view(), name='tags-liste'),
    path('<int:pk>/', DocumentDetailView.as_view(), name='document-detail'),
    path('<int:pk>/renommer/', RenommerDocumentView.as_view(), name='document-renommer'),
    path('<int:pk>/corbeille/', CorbeilleDocumentView.as_view(), name='document-corbeille'),
    path('<int:pk>/restaurer/', RestaurerDocumentView.as_view(), name='document-restaurer'),
    path('<int:pk>/supprimer-definitivement/', SupprimerDefinitivementView.as_view(), name='document-supprimer-def'),
]