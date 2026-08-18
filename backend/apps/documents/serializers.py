from rest_framework import serializers
from .models import Categorie, Departement, Tag, Document, LogAction, ConnexionLog
import json
from .utils import empreinte_sha256, purger_fichier_orphelin


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
    est_epingle = serializers.BooleanField(default=False)

    # ✅ Champ d'entrée RENOMMÉ pour éviter le conflit avec le ManyToMany 'tags' du modèle
    tags_input = serializers.CharField(required=False, write_only=True)

    # ✅ Champ de sortie pour l'affichage
    tags_detail = TagSerializer(many=True, read_only=True, source='tags')

    class Meta:
        model = Document
        fields = [
            'id', 'titre', 'fichier', 'miniature', 'apercu_pdf',
            'type_source', 'depose_par', 'depose_par_nom', 'date_depot', 'date_derniere_modification',
            'taille_fichier', 'type_mime', 'groupe', 'auteur_document',
            'largeur_px', 'hauteur_px', 'duree',
            'categorie', 'categorie_nom', 'departement', 'departement_nom', 'departement_nom_en',
            'tags_input', 'tags_detail',
            'contenu_texte', 'statut', 'log_pipeline', 'cause_rejet', 'cause_rejet_en',
            'est_confidentiel', 'utilisateurs_autorises',
            'departements_autorises', 'departements_autorises_noms',
            'est_epingle', 'tentative_count', 'favoris',
            'est_supprime', 'date_suppression',
            'est_departement_origine',
            'est_archive',
        ]
        read_only_fields = [
            'depose_par', 'taille_fichier', 'type_mime', 'groupe', 'contenu_texte',
            'statut', 'log_pipeline', 'cause_rejet', 'cause_rejet_en', 'largeur_px', 'hauteur_px', 'duree',
            'date_derniere_modification', 'est_supprime', 'date_suppression', 'tentative_count',
            'miniature', 'apercu_pdf',
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
        print("=" * 60)
        print("🔍 DONNÉES REÇUES (CLÉS) :", list(validated_data.keys()))

        fichier = validated_data.get("fichier")
        if fichier is not None:
            print("📄 FICHIER REÇU :")
            print(f"   - Nom : {fichier.name}")
            print(f"   - Taille : {fichier.size} octets")
            print(f"   - Content-Type : {getattr(fichier, 'content_type', 'INCONNU')}")
            fichier.seek(0)
            debut = fichier.read(5)
            fichier.seek(0)
            print(f"   - 5 premiers octets : {debut}")
            print(f"   - Est un PDF ? {debut == b'%PDF-'}")
        print("=" * 60)

        tags_json = validated_data.pop('tags_input', None)
        print(f"🚨 tags_input trouvé : {tags_json}")

        utilisateurs_autorises = validated_data.pop('utilisateurs_autorises', [])
        departements_autorises = validated_data.pop('departements_autorises', [])
        favoris = validated_data.pop('favoris', [])

        # 🆕 Déduplication : même contenu = un seul fichier dans MinIO
        fichier = validated_data.get("fichier")
        if fichier is not None:
            validated_data["sha256"] = empreinte_sha256(fichier)
            existant = (
                Document.objects
                .filter(sha256=validated_data["sha256"])
                .exclude(fichier="")
                .first()
            )
            if existant:
                validated_data["fichier"] = existant.fichier.name

        document = Document.objects.create(**validated_data)

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

        # 🆕 Déduplication si on remplace le fichier
        fichier = validated_data.get("fichier")
        ancienne_cle = instance.fichier.name if fichier is not None else None
        if fichier is not None:
            validated_data["sha256"] = empreinte_sha256(fichier)
            existant = (
                Document.objects
                .filter(sha256=validated_data["sha256"])
                .exclude(fichier="")
                .exclude(pk=instance.pk)
                .first()
            )
            if existant:
                validated_data["fichier"] = existant.fichier.name

        instance = super().update(instance, validated_data)

        # ✅ CRÉATION DU LOG DE MODIFICATION
        if validated_data:
            changements = []
            changements_en = []

            for champ, valeur in validated_data.items():
                if champ == 'fichier':
                    changements.append("fichier remplacé")
                    changements_en.append("file replaced")
                elif champ == 'miniature':
                    continue
                else:
                    changements.append(champ)
                    changements_en.append(champ)

            if changements:
                cause_fr = f"Modifié : {', '.join(changements)}"
                cause_en = f"Modified: {', '.join(changements_en)}"

                LogAction.objects.create(
                    document=instance,
                    type_action=LogAction.TypeAction.MODIFICATION,
                    cause=cause_fr,
                    cause_en=cause_en,
                    effectue_par=self.context['request'].user if 'request' in self.context else None,
                )

        # 🆑 Nettoie l'ancien fichier si plus personne ne le référence
        if ancienne_cle:
            purger_fichier_orphelin(ancienne_cle)

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

                if tags_list:
                    LogAction.objects.create(
                        document=instance,
                        type_action=LogAction.TypeAction.MODIFICATION,
                        cause=f"Tags modifiés : {', '.join(tags_list)}",
                        cause_en=f"Tags modified: {', '.join(tags_list)}",
                        effectue_par=self.context['request'].user if 'request' in self.context else None,
                    )
            except json.JSONDecodeError:
                pass

        if utilisateurs_autorises is not None:
            instance.utilisateurs_autorises.set(utilisateurs_autorises)
            LogAction.objects.create(
                document=instance,
                type_action=LogAction.TypeAction.MODIFICATION,
                cause="Utilisateurs autorisés modifiés",
                cause_en="Authorized users modified",
                effectue_par=self.context['request'].user if 'request' in self.context else None,
            )

        if departements_autorises is not None:
            instance.departements_autorises.set(departements_autorises)
            LogAction.objects.create(
                document=instance,
                type_action=LogAction.TypeAction.MODIFICATION,
                cause="Départements autorisés modifiés",
                cause_en="Authorized departments modified",
                effectue_par=self.context['request'].user if 'request' in self.context else None,
            )

        if favoris is not None:
            instance.favoris.set(favoris)

        return instance


class LogActionSerializer(serializers.ModelSerializer):
    document_titre = serializers.CharField(source='document.titre', read_only=True, default=None)
    effectue_par_nom = serializers.SerializerMethodField()

    class Meta:
        model = LogAction
        fields = ['id', 'document', 'document_titre', 'type_action', 'cause', 'cause_en', 'effectue_par', 'effectue_par_nom', 'date_action']

    def get_effectue_par_nom(self, obj):
        if obj.effectue_par:
            return obj.effectue_par.username
        return "Système (Pipeline ETL)"


class ConnexionLogSerializer(serializers.ModelSerializer):
    utilisateur_nom = serializers.CharField(source='utilisateur.username', read_only=True)

    class Meta:
        model = ConnexionLog
        fields = ['utilisateur', 'utilisateur_nom', 'ip_address', 'user_agent', 'date_connexion']