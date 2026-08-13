import os
from pathlib import Path
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from apps.documents.models import Document

# Extensions supportées
EXTENSIONS_IMAGES = {".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".tiff", ".tif", ".heic", ".heif"}
EXTENSIONS_BUREAU = {
    ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
    ".odt", ".ods", ".odp", ".rtf", ".txt", ".csv"
}


class Command(BaseCommand):
    help = 'Génère les miniatures pour TOUS les documents (PDF, DOCX, XLSX, PPTX, TXT, images, etc.)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Régénère même si une miniature existe déjà',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Affiche ce qui serait fait sans rien modifier',
        )

    def handle(self, *args, **options):
        force = options['force']
        dry_run = options['dry_run']

        self.stdout.write('🔍 Recherche des documents sans miniature...\n')
        
        # Sélectionner les documents à traiter
        if force:
            documents = Document.objects.exclude(fichier='')
            self.stdout.write(f'🔄 Mode FORCE : régénération de toutes les miniatures')
        else:
            documents = Document.objects.filter(
                miniature__isnull=True
            ).exclude(fichier='') | Document.objects.filter(
                miniature=''
            ).exclude(fichier='')
            self.stdout.write(f'📸 Mode normal : génération des miniatures manquantes')

        if not documents.exists():
            self.stdout.write(self.style.SUCCESS('\n✅ Tous les documents ont déjà une miniature !'))
            return

        total = documents.count()
        self.stdout.write(f'📦 {total} document(s) à traiter\n')
        
        if dry_run:
            self.stdout.write(self.style.WARNING('⚠️  Mode DRY-RUN : aucune modification ne sera faite\n'))

        succes = 0
        echecs = 0
        ignores = 0

        for i, doc in enumerate(documents, 1):
            try:
                self.stdout.write(f'[{i}/{total}] {doc.titre}...', ending=' ')

                # Vérifier si le fichier existe
                if not doc.fichier:
                    self.stdout.write(self.style.WARNING('⏭️ pas de fichier'))
                    ignores += 1
                    continue

                # Ouvrir et lire le fichier
                doc.fichier.open('rb')
                contenu = doc.fichier.read()
                doc.fichier.close()

                # Générer la miniature selon le type
                jpeg_bytes = self.generer_miniature(contenu, doc.fichier.name)

                if not jpeg_bytes:
                    self.stdout.write(self.style.WARNING('⏭️ format non supporté'))
                    ignores += 1
                    continue

                if dry_run:
                    self.stdout.write(self.style.SUCCESS('✓ serait générée'))
                    succes += 1
                    continue

                # Sauvegarder la miniature
                nom_miniature = f"miniature_{doc.id}.jpg"
                doc.miniature.save(nom_miniature, ContentFile(jpeg_bytes), save=True)
                
                succes += 1
                self.stdout.write(self.style.SUCCESS('✓ générée'))

            except Exception as e:
                echecs += 1
                self.stdout.write(self.style.ERROR(f'❌ {str(e)}'))

        # Résumé final
        self.stdout.write('\n' + '='*60)
        self.stdout.write(self.style.SUCCESS(f'🎉 Terminé !'))
        self.stdout.write(f'   ✅ Succès : {succes}')
        self.stdout.write(f'   ❌ Échecs : {echecs}')
        self.stdout.write(f'   ⏭️  Ignorés : {ignores}')
        self.stdout.write('='*60)

    def generer_miniature(self, contenu: bytes, nom_fichier: str):
        """
        Génère une miniature JPEG pour n'importe quel format supporté.
        Renvoie les octets JPEG ou None si impossible.
        """
        suffixe = Path(nom_fichier).suffix.lower()

        # 1) Image → miniature directe
        if suffixe in EXTENSIONS_IMAGES:
            return self._image_vers_jpeg(contenu)

        # 2) PDF → 1ère page
        if suffixe == ".pdf":
            return self._pdf_vers_jpeg(contenu)

        # 3) Bureau / texte → LibreOffice → PDF → 1ère page
        if suffixe in EXTENSIONS_BUREAU:
            pdf = self._convertir_via_libreoffice(contenu, nom_fichier)
            if pdf:
                return self._pdf_vers_jpeg(pdf)
            return None

        return None

    def _image_vers_jpeg(self, contenu: bytes):
        """Redimensionne une image et la convertit en JPEG."""
        try:
            from PIL import Image
            import io
            
            img = Image.open(io.BytesIO(contenu))
            img.thumbnail((900, 900))
            buf = io.BytesIO()
            img.convert("RGB").save(buf, "JPEG", quality=85)
            return buf.getvalue()
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'⚠️ Image illisible: {e}'))
            return None

    def _pdf_vers_jpeg(self, contenu: bytes, dpi: int = 120):
        """Extrait la 1ère page d'un PDF en JPEG."""
        try:
            import fitz  # PyMuPDF
            doc = fitz.open(stream=contenu, filetype="pdf")
            if len(doc) == 0:
                return None
            pix = doc[0].get_pixmap(dpi=dpi)
            return pix.tobytes("jpeg")
        except Exception as e:
            self.stdout.write(self.style.WARNING(f'⚠️ PDF illisible: {e}'))
            return None
    def _convertir_via_libreoffice(self, contenu: bytes, nom_fichier: str):
        """Convertit un document bureau en PDF via LibreOffice headless."""
        import subprocess
        import sys
        import tempfile
        import shutil

        soffice = None
        for cmd in (
            "soffice",
            "libreoffice",
            r"C:\Program Files\LibreOffice\program\soffice.exe",
            r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
        ):
            if shutil.which(cmd) or Path(cmd).exists():
                soffice = cmd
                break

        if not soffice:
            self.stdout.write(self.style.WARNING('⚠️ LibreOffice non trouvé'))
            return None

        # ✅ CORRECTION : uniquement le nom du fichier, sans les dossiers
        # "documents/2026/07/" (qui n'existent pas dans le dossier temporaire)
        nom_simple = Path(nom_fichier).name

        with tempfile.TemporaryDirectory() as tmp:
            src = Path(tmp) / nom_simple
            src.write_bytes(contenu)

            kwargs = {}
            if sys.platform == "win32":
                si = subprocess.STARTUPINFO()
                si.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                kwargs["startupinfo"] = si

            try:
                subprocess.run(
                    [soffice, "--headless", "--convert-to", "pdf", "--outdir", tmp, str(src)],
                    capture_output=True,
                    timeout=90,
                    **kwargs,
                )
                pdf_path = Path(tmp) / (Path(nom_simple).stem + ".pdf")
                if pdf_path.exists():
                    return pdf_path.read_bytes()
                self.stdout.write(self.style.WARNING('⚠️ Conversion sans résultat'))
            except subprocess.TimeoutExpired:
                self.stdout.write(self.style.WARNING('⚠️ Conversion trop longue (>90s)'))
            except Exception as e:
                self.stdout.write(self.style.WARNING(f'⚠️ Conversion échouée: {e}'))

        return None