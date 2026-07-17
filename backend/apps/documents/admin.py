from django.contrib import admin
from .models import Categorie, Tag, Document


@admin.register(Categorie)
class CategorieAdmin(admin.ModelAdmin):
    list_display = ('nom', 'description')


@admin.register(Tag)
class TagAdmin(admin.ModelAdmin):
    list_display = ('nom',)


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ('titre', 'type_source', 'statut', 'categorie', 'depose_par', 'date_depot')
    list_filter = ('statut', 'type_source', 'categorie', 'est_confidentiel')
    search_fields = ('titre', 'contenu_texte')
    readonly_fields = ('log_pipeline',)