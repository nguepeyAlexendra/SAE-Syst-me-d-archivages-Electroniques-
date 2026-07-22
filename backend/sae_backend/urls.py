from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

from apps.documents.views import (
    AdminConfigurationView, CategorieListView, CategorieDetailView,
    DepartementListView, TagListView, TagDeleteView, AdminStatsView,
)
from apps.accounts.views import AdminUserListView, AdminUserToggleActiveView, AdminUserToggleAdminView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/documents/', include('apps.documents.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api-auth/', include('rest_framework.urls')),

    path('api/categories/', CategorieListView.as_view(), name='categories-list'),
    path('api/categories/<int:pk>/', CategorieDetailView.as_view(), name='categories-detail'),
    path('api/departements/', DepartementListView.as_view(), name='departements-list'),
    path('api/tags/', TagListView.as_view(), name='tags-list'),
    path('api/tags/<int:pk>/', TagDeleteView.as_view(), name='tags-delete'),
    path('api/admin/stats/', AdminStatsView.as_view(), name='admin-stats'),
    path('api/admin/configuration/', AdminConfigurationView.as_view(), name='admin-configuration'),
    path('api/admin/utilisateurs/', AdminUserListView.as_view(), name='admin-utilisateurs'),
    path('api/admin/utilisateurs/<int:pk>/desactiver/', AdminUserToggleActiveView.as_view(), name='admin-utilisateur-desactiver'),
    path('api/admin/utilisateurs/<int:pk>/', AdminUserToggleAdminView.as_view(), name='admin-utilisateur-role'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
