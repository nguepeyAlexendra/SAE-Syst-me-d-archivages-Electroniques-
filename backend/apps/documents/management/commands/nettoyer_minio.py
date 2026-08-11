import hashlib
import os
from collections import defaultdict

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand

from apps.documents.models import Document


def empreinte(key):
    h = hashlib.sha256()
    with default_storage.open(key, "rb") as f:
        for morceau in iter(lambda: f.read(65536), b""):
            h.update(morceau)
    return h.hexdigest()


class Command(BaseCommand):
    help = "Remplit sha256, déduplique MinIO, supprime les vieilles copies."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        dry = options["dry_run"]
        groupes = defaultdict(list)

        # 1. Empreinte de CHAQUE fiche (y compris archivées/supprimées, pour ne casser aucun lien)
        for doc in Document.objects.exclude(fichier=""):
            try:
                doc.sha256 = empreinte(doc.fichier.name)
            except Exception:
                self.stdout.write(self.style.WARNING(
                    f"⚠️  Introuvable dans MinIO : {doc.titre} ({doc.fichier.name})"))
                continue
            if not dry:
                doc.save(update_fields=["sha256"])
            groupes[doc.sha256].append(doc)

        # 2. Un seul exemplaire par contenu
        for hash_, liste in groupes.items():
            premier = liste[0].fichier.name
            ext = os.path.splitext(premier)[1].lower()
            canon = f"documents/{hash_}{ext}"

            if not dry and not default_storage.exists(canon):
                contenu = default_storage.open(premier, "rb").read()
                default_storage.save(canon, ContentFile(contenu))

            anciennes = {d.fichier.name for d in liste}
            for doc in liste:
                if doc.fichier.name != canon:
                    self.stdout.write(f"→ {doc.titre} : {doc.fichier.name} ⇒ {canon}")
                    doc.fichier = canon
                    if not dry:
                        doc.save(update_fields=["fichier"])

            for cle in anciennes - {canon}:
                self.stdout.write(self.style.WARNING(f"🗑  suppression de {cle}"))
                if not dry:
                    default_storage.delete(cle)

        self.stdout.write(self.style.SUCCESS("✅ Ménage terminé."))