import re

from django.db import migrations, models


def _traduire_cause(cause):
    """Traduit une cause écrite en français vers l'anglais pour le backfill."""
    cause = cause or ''
    if cause.startswith('Format non autorisé'):
        reste = cause.split(':', 1)[1].strip() if ':' in cause else ''
        return f'Unauthorized format: {reste}'
    m = re.search(r"Un fichier de type '([^']+)' était attendu", cause)
    if m:
        return f"Incorrect format for this form. A '{m.group(1)}' type file was expected."
    if 'signature virale' in cause:
        return 'File rejected: viral signature detected (EICAR test).'
    if cause.startswith('Archivé par '):
        return 'Archived by ' + cause[len('Archivé par '):]
    if cause.startswith('Partagé avec '):
        return 'Shared with ' + cause[len('Partagé avec '):]
    if cause == 'Document validé et indexé avec succès':
        return 'Document validated and indexed successfully'
    return cause


def backfill(apps, schema_editor):
    Document = apps.get_model('documents', 'Document')
    LogAction = apps.get_model('documents', 'LogAction')

    for doc in Document.objects.exclude(cause_rejet=''):
        doc.cause_rejet_en = _traduire_cause(doc.cause_rejet)
        doc.save(update_fields=['cause_rejet_en'])

    for log in LogAction.objects.exclude(cause=''):
        log.cause_en = _traduire_cause(log.cause)
        log.save(update_fields=['cause_en'])


class Migration(migrations.Migration):

    dependencies = [
        ('documents', '0012_document_est_archive'),
    ]

    operations = [
        migrations.AddField(
            model_name='document',
            name='cause_rejet_en',
            field=models.TextField(blank=True, help_text='Cause du rejet en anglais si statut=rejete'),
        ),
        migrations.AddField(
            model_name='logaction',
            name='cause_en',
            field=models.TextField(blank=True, help_text="Cause de l'action en anglais"),
        ),
        migrations.AlterField(
            model_name='logaction',
            name='type_action',
            field=models.CharField(choices=[('archivage', 'Archivage'), ('rejet', 'Rejet ETL'), ('validation', 'Validation ETL'), ('modification', 'Modification'), ('partage', 'Partage')], max_length=20),
        ),
        migrations.RunPython(backfill, migrations.RunPython.noop),
    ]
