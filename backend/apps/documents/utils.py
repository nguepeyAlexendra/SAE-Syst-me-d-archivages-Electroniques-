import hashlib

def empreinte_sha256(f, chunk=65536):
    h = hashlib.sha256()
    for morceau in iter(lambda: f.read(chunk), b""):
        h.update(morceau)
    f.seek(0)
    return h.hexdigest()

def purger_fichier_orphelin(cle):
    """À appeler quand une fiche est VRAIMENT supprimée :
    n'efface le fichier MinIO que si plus personne ne le référence."""
    from django.core.files.storage import default_storage
    from .models import Document
    if cle and not Document.objects.filter(fichier=cle).exists():
        default_storage.delete(cle)