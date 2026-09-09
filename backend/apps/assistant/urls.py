from django.urls import path
from . import views

urlpatterns = [
    # Conversations
    path('conversations/', views.ConversationListView.as_view(), name='conversation-list'),
    path('conversations/<int:pk>/', views.ConversationDetailView.as_view(), name='conversation-detail'),
    path('conversations/<int:conv_id>/messages/', views.MessageListView.as_view(), name='message-list'),
    path('conversations/<int:conv_id>/question/', views.QuestionView.as_view(), name='question'),

    # Recherche dans l'historique des conversations
    path('recherche/', views.RechercheView.as_view(), name='assistant-recherche'),

    # 🆕 Recherche sémantique dans le contenu des documents (mode onglet)
    path('recherche-semantique/', views.RechercheSemantiqueView.as_view(), name='recherche-semantique'),
]