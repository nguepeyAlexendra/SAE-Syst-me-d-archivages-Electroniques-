from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0002_profilutilisateur'),
    ]

    operations = [
        migrations.AddField(
            model_name='profilutilisateur',
            name='changement_mdp_obligatoire',
            field=models.BooleanField(default=True, help_text="Si True, l'utilisateur doit changer son mot de passe à la prochaine connexion."),
        ),
    ]
