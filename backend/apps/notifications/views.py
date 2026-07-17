from rest_framework import generics, permissions
from rest_framework.views import APIView
from rest_framework.response import Response

from .models import Notification
from .serializers import NotificationSerializer


class NotificationListView(generics.ListAPIView):
    """GET /api/notifications/ -> liste les notifications de l'utilisateur connecté"""
    serializer_class = NotificationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Notification.objects.filter(destinataire=self.request.user)


class MarquerNotificationLueView(APIView):
    """POST /api/notifications/<id>/marquer-lue/ -> marque une notification comme lue"""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        try:
            notification = Notification.objects.get(pk=pk, destinataire=request.user)
        except Notification.DoesNotExist:
            return Response({"erreur": "Notification introuvable."}, status=404)

        notification.lue = True
        notification.save()
        return Response({"succes": True})