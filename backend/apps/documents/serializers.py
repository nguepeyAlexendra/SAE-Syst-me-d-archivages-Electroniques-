from rest_framework import serializers
from .models import Categorie, Departement, Tag, Document, LogAction, ConnexionLog
import json


class CategorieSerializer(serializers.ModelSerializer):
    class Meta:
        model = Categorie
        fields = ['id', 'nom', 'description']


class DepartementSerializer(serializers.ModelSerializer):
    class Meta:
        model = Departement
        fields = ['id', 'nom', 'nom_en', 'description']


class TagSerializer(serializers.ModelSerializer):
    class Meta:
        model = Tag
        fields = ['id', 'nom', 'couleur']


class DocumentSerializer(serializers.ModelSerializer):
    depose_par_nom = serializers.CharField(source='depose_par.username', read_only=True)
    categorie_nom = serializers.CharField(source='categorie.nom', read_only=True, default=None)
    departement_nom = serializers.CharField(source='departement.nom', read_only=True, default=None)
    departement_nom_en = serializers.CharField(source='departement.nom_en', read_only=True, default=None)
    departements_autorises_noms = serializers.SerializerMethodField()
    est_departement_origine = serializers.SerializerMethodField()
    
    # ✅ Champ d'entrée RENOMMÉ pour éviter le conflit avec le ManyToMany 'tags' du modèle
    tags_input = serializers.CharField(required=False, write_only=True)
    
    # ✅ Champ de sortie pour l'affichage
    tags_detail = TagSerializer(many=True, read_only=True, source='tags')

    class Meta:
        model = Document
        fields = [
            'id', 'titre', 'fichier', 'miniature',
            'type_source', 'depose_par', 'depose_par_nom', 'date_depot', 'date_derniere_modification',
            'taille_fichier', 'type_mime', 'groupe', 'auteur_document',
            'largeur_px', 'hauteur_px', 'duree',
            'categorie', 'categorie_nom', 'departement', 'departement_nom', 'departement_nom_en',
            'tags_input', 'tags_detail',
            'contenu_texte', 'statut', 'log_pipeline', 'cause_rejet',
            'est_confidentiel', 'utilisateurs_autorises',
            'departements_autorises', 'departements_autorises_noms',
            'est_epingle', 'tentative_count', 'favoris',
            'est_supprime', 'date_suppression',
            'est_departement_origine',
            'est_archive', 
        ]
        read_only_fields = [
            'depose_par', 'taille_fichier', 'type_mime', 'groupe', 'contenu_texte',
            'statut', 'log_pipeline', 'cause_rejet', 'largeur_px', 'hauteur_px', 'duree',
            'date_derniere_modification', 'est_supprime', 'date_suppression', 'tentative_count',
            'miniature',
        ]

    def get_departements_autorises_noms(self, obj):
        return [d.nom for d in obj.departements_autorises.all()]

    def get_est_departement_origine(self, obj):
        request = self.context.get('request')
        if request and request.user.is_authenticated:
            profil = getattr(request.user, 'profil', None)
            if profil and profil.departement_id:
                return obj.departement_id == profil.departement_id
        return True

    def validate_departement(self, value):
        if not value:
            raise serializers.ValidationError("Le département est obligatoire.")
        return value

    def validate_est_confidentiel(self, value):
        request = self.context.get('request')
        if value and request and not request.user.is_staff:
            raise serializers.ValidationError("Seul un administrateur peut rendre un document confidentiel.")
        return value

    def create(self, validated_data):
        # 🔥 DIAGNOSTIC : Afficher toutes les clés reçues
        print("=" * 60)
        print("🔍 DONNÉES REÇUES (CLÉS) :", list(validated_data.keys()))
        
        # Extraire tags_input (nom unique, pas de conflit)
        tags_json = validated_data.pop('tags_input', None)
        print(f"🚨 tags_input trouvé : {tags_json}")
        print("=" * 60)

        # Extraire les autres champs ManyToMany
        utilisateurs_autorises = validated_data.pop('utilisateurs_autorises', [])
        departements_autorises = validated_data.pop('departements_autorises', [])
        favoris = validated_data.pop('favoris', [])

        # Créer le document
        document = Document.objects.create(**validated_data)

        # Traiter les tags
        if tags_json:
            try:
                tags_list = json.loads(tags_json)
                print(f"✅ Tags décodés : {tags_list}")
                for tag_name in tags_list:
                    tag, _ = Tag.objects.get_or_create(
                        nom=tag_name.strip(),
                        defaults={'couleur': '#6366f1'}
                    )
                    document.tags.add(tag)
                    print(f"   -> Tag ajouté : {tag.nom}")
            except json.JSONDecodeError as e:
                print(f"❌ Erreur JSON : {e}")
                print(f"   -> Valeur reçue : {repr(tags_json)}")
        else:
            print("⚠️ Aucun tag_input reçu.")
        
        if utilisateurs_autorises:
            document.utilisateurs_autorises.set(utilisateurs_autorises)
        if departements_autorises:
            document.departements_autorises.set(departements_autorises)
        if favoris:
            document.favoris.set(favoris)

        return document

    def update(self, instance, validated_data):
        tags_json = validated_data.pop('tags_input', None)
        utilisateurs_autorises = validated_data.pop('utilisateurs_autorises', None)
        departements_autorises = validated_data.pop('departements_autorises', None)
        favoris = validated_data.pop('favoris', None)
        
        instance = super().update(instance, validated_data)
        
        if tags_json is not None:
            instance.tags.clear()
            try:
                tags_list = json.loads(tags_json)
                for tag_name in tags_list:
                    tag, _ = Tag.objects.get_or_create(
                        nom=tag_name.strip(),
                        defaults={'couleur': '#6366f1'}
                    )
                    instance.tags.add(tag)
            except json.JSONDecodeError:
                pass
                
        if utilisateurs_autorises is not None:
            instance.utilisateurs_autorises.set(utilisateurs_autorises)
        if departements_autorises is not None:
            instance.departements_autorises.set(departements_autorises)
        if favoris is not None:
            instance.favoris.set(favoris)
            
        return instance


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