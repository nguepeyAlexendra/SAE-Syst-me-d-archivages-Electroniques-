import os
from collections import defaultdict

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand

from apps.documents.models import Document, groupe_de


class Command(BaseCommand):
    help = "Range chaque fichier dans <type>/AAAA/MM/ (documents, images, medias)."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true")

    def handle(self, *args, **options):
        dry = options["dry_run"]

        par_cle = defaultdict(list)
        for doc in Document.objects.exclude(fichier=""):
            par_cle[doc.fichier.name].append(doc)

        for cle, docs in par_cle.items():
            if not default_storage.exists(cle):
                continue  # fiche cassée connue, on saute
            premiere = min(d.date_depot for d in docs)
            nouvelle = f"{groupe_de(cle)}/{premiere:%Y/%m}/{os.path.basename(cle)}"
            if cle == nouvelle:
                continue
            self.stdout.write(f"→ {cle} ⇒ {nouvelle}")
            if not dry:
                if not default_storage.exists(nouvelle):
                    contenu = default_storage.open(cle, "rb").read()
                    default_storage.save(nouvelle, ContentFile(contenu))
                for doc in docs:
                    doc.fichier = nouvelle
                    doc.save(update_fields=["fichier"])
                default_storage.delete(cle)

        self.stdout.write(self.style.SUCCESS("✅ Rangement terminé."))