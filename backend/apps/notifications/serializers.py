from rest_framework import serializers
from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id', 'message', 'type_notification', 'document',
            'lue', 'date_creation',
        ]
        read_only_fields = ['message', 'type_notification', 'document', 'date_creation']