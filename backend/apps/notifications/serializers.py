from rest_framework import serializers
from .models import Notification

# Import du serializer de document
from apps.documents.serializers import DocumentSerializer

class NotificationSerializer(serializers.ModelSerializer):
    # Inclut les informations complètes du document
    document = DocumentSerializer(read_only=True)
    
    class Meta:
        model = Notification
        fields = [
            'id', 'destinataire', 'titre', 'message', 'type',
            'document', 'lue', 'date_creation', 'date_lecture',
            'email_envoye'
        ]
        read_only_fields = ['destinataire', 'date_creation']

class NotificationListSerializer(serializers.ModelSerializer):
    """Version allégée pour la liste - inclut le document complet"""
    document = DocumentSerializer(read_only=True)
    
    class Meta:
        model = Notification
        fields = [
            'id', 'titre', 'message', 'type', 'lue',
            'date_creation', 'document'
        ]