from django.urls import path
from .views import NotificationListView, MarquerNotificationLueView

urlpatterns = [
    path('', NotificationListView.as_view(), name='notifications-liste'),
    path('<int:pk>/marquer-lue/', MarquerNotificationLueView.as_view(), name='notification-marquer-lue'),
]