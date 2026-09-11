from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone
from .models import Notification
from .serializers import NotificationSerializer, NotificationListSerializer

class NotificationViewSet(viewsets.ModelViewSet):
    serializer_class = NotificationSerializer
    permission_classes = [IsAuthenticated]
    
    def get_queryset(self):
        """Retourne uniquement les notifications de l'utilisateur connecté, 
        SAUF si c'est un admin (qui voit tout)"""
        user = self.request.user
        
        # ✅ Si l'utilisateur est admin ou superuser, il voit TOUTES les notifications
        if user.is_staff or user.is_superuser:
            queryset = Notification.objects.all().order_by('-date_creation')
        else:
            # Sinon, chacun voit seulement ses propres notifications
            queryset = Notification.objects.filter(destinataire=user).order_by('-date_creation')
        
        # Filtrage par type
        type_notification = self.request.query_params.get('type')
        if type_notification:
            queryset = queryset.filter(type=type_notification)
        
        # Filtrage par lu/non lu
        non_lues = self.request.query_params.get('non_lues')
        if non_lues and non_lues.lower() == 'true':
            queryset = queryset.filter(lue=False)
        
        return queryset
    
    def get_serializer_class(self):
        if self.action == 'list':
            return NotificationListSerializer
        return NotificationSerializer
    
    @action(detail=True, methods=['post'])
    def marquer_lue(self, request, pk=None):
        """Marque une notification comme lue"""
        notification = self.get_object()
        notification.lue = True
        notification.date_lecture = timezone.now()
        notification.save()
        return Response({'status': 'notification marquée comme lue'})
    
    @action(detail=False, methods=['post'])
    def tout_marquer_comme_lu(self, request):
        """Marque toutes les notifications de l'utilisateur comme lues"""
        Notification.objects.filter(
            destinataire=request.user,
            lue=False
        ).update(
            lue=True,
            date_lecture=timezone.now()
        )
        return Response({'status': 'toutes les notifications marquées comme lues'})
    
    @action(detail=False, methods=['get'])
    def non_lues_count(self, request):
        """Retourne le nombre de notifications non lues"""
        count = Notification.objects.filter(
            destinataire=request.user,
            lue=False
        ).count()
        return Response({'count': count})