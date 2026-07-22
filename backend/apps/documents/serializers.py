from rest_framework import serializers
from .models import Categorie, Departement, Tag, Document, LogAction, ConnexionLog


class CategorieSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categorie
        fields = ['id', 'nom', 'description']


class DepartementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Departement
        fields = ['id', 'nom', 'description']


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'nom', 'couleur']


class DocumentSerializer(serializers.ModelSerializer):
    depose_par_nom = serializers.CharField(source='depose_par.username', read_only=True)
    categorie_nom = serializers.CharField(source='categorie.nom', read_only=True, default=None)
    departement_nom = serializers.CharField(source='departement.nom', read_only=True, default=None)

    class Meta:
        model = Document
        fields = [
            'id', 'titre', 'fichier', 'type_source',
            'depose_par', 'depose_par_nom', 'date_depot', 'date_derniere_modification',
            'taille_fichier', 'type_mime', 'groupe', 'auteur_document',
            'largeur_px', 'hauteur_px', 'duree',
            'categorie', 'categorie_nom', 'departement', 'departement_nom', 'tags',
            'contenu_texte', 'statut', 'log_pipeline', 'cause_rejet',
            'est_confidentiel', 'utilisateurs_autorises',
            'est_epingle', 'tentative_count', 'favoris',
            'est_supprime', 'date_suppression',
        ]
        read_only_fields = [
            'depose_par', 'taille_fichier', 'type_mime', 'groupe', 'contenu_texte',
            'statut', 'log_pipeline', 'cause_rejet', 'largeur_px', 'hauteur_px', 'duree',
            'date_derniere_modification', 'est_supprime', 'date_suppression', 'tentative_count',
        ]

    def validate_est_confidentiel(self, value):
        request = self.context.get('request')
        if value and request and not request.user.is_staff:
            raise serializers.ValidationError("Seul un administrateur peut rendre un document confidentiel.")
        return value


class LogActionSerializer(serializers.ModelSerializer):
    document_titre = serializers.CharField(source='document.titre', read_only=True, default=None)
    effectue_par_nom = serializers.CharField(source='effectue_par.username', read_only=True, default=None)

    class Meta:
        model = LogAction
        fields = ['id', 'document', 'document_titre', 'type_action', 'cause', 'effectue_par', 'effectue_par_nom', 'date_action']


class ConnexionLogSerializer(serializers.ModelSerializer):
    utilisateur_nom = serializers.CharField(source='utilisateur.username', read_only=True)

    class Meta:
        model = ConnexionLog
        fields = ['id', 'utilisateur', 'utilisateur_nom', 'ip_address', 'user_agent', 'date_connexion']
