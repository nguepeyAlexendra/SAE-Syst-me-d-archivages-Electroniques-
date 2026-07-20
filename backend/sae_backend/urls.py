from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

# ✅ 1. L'import doit être ici, en haut du fichier
from apps.documents.views import AdminConfigurationView, CategorieListView, TagListView, AdminStatsView

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/documents/', include('apps.documents.urls')),
    path('api/notifications/', include('apps.notifications.urls')),
    path('api-auth/', include('rest_framework.urls')),
    
    # ✅ 2. Ces 3 lignes doivent être AJOUTÉES ICI, dans le fichier principal
    path('api/categories/', CategorieListView.as_view(), name='categories-list'),
    path('api/tags/', TagListView.as_view(), name='tags-list'),
    path('api/admin/stats/', AdminStatsView.as_view(), name='admin-stats'), # <-- C'EST CELLE-CI
   path('api/admin/configuration/', AdminConfigurationView.as_view(), name='admin-configuration'),
 
] 

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)