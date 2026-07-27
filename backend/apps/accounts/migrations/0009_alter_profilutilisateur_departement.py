from django.db import migrations, models


def nettoyer_departement_admins(apps, schema_editor):
    ProfilUtilisateur = apps.get_model('accounts', 'ProfilUtilisateur')
    ProfilUtilisateur.objects.filter(utilisateur__is_staff=True).update(departement=None)


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0008_profilutilisateur_departements_autorises_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='profilutilisateur',
            name='departement',
            field=models.ForeignKey(blank=True, help_text="Département principal de l'utilisateur (optionnel pour les admins).", null=True, on_delete=models.PROTECT, related_name='membres', to='documents.departement'),
        ),
        migrations.RunPython(nettoyer_departement_admins),
    ]
