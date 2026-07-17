from rest_framework import serializers
from .models import Categorie, Tag, Document


class CategorieSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categorie
        fields = ['id', 'nom', 'description']


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'nom']


class DocumentSerializer(serializers.ModelSerializer):
    depose_par_nom = serializers.CharField(source='depose_par.username', read_only=True)
    categorie_nom = serializers.CharField(source='categorie.nom', read_only=True, default=None)

    class Meta:
        model = Document
        fields = [
            'id', 'titre', 'fichier', 'type_source',
            'depose_par', 'depose_par_nom', 'date_depot',
            'date_derniere_modification',
            'taille_fichier', 'type_mime', 'groupe', 'auteur_document',
            'largeur_px', 'hauteur_px',
            'categorie', 'categorie_nom', 'tags',
            'contenu_texte', 'statut', 'log_pipeline',
            'est_confidentiel', 'est_supprime',
        ]
        read_only_fields = [
            'depose_par', 'taille_fichier', 'type_mime', 'groupe', 'contenu_texte',
            'statut', 'log_pipeline', 'largeur_px', 'hauteur_px',
            'date_derniere_modification', 'est_supprime',
        ]