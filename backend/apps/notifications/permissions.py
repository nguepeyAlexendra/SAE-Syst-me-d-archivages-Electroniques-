from rest_framework import permissions

class IsDestinataireOrAdmin(permissions.BasePermission):
    """Seul le destinataire ou un admin peut voir/modifier la notification"""
    
    def has_object_permission(self, request, view, obj):
        if request.user.is_staff:
            return True
        return obj.destinataire == request.user