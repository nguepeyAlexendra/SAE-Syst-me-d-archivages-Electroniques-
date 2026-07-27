import os
from django.core.management.base import BaseCommand
from django.core.files.base import ContentFile
from apps.documents.models import Document

class Command(BaseCommand):
    help = 'Génère les miniatures pour tous les anciens documents PDF.'

    def handle(self, *args, **kwargs):
        self.stdout.write('🔍 Recherche des documents PDF sans miniature...')
        
        documents = Document.objects.filter(type_mime='application/pdf', miniature__isnull=True)
        if not documents.exists():
            documents = Document.objects.filter(type_mime='application/pdf', miniature='')

        if not documents.exists():
            self.stdout.write(self.style.SUCCESS('✅ Tous les documents PDF ont déjà une miniature !'))
            return

        self.stdout.write(f'📦 {documents.count()} document(s) à traiter.\n')
        
        succes = 0
        echecs = 0

        for doc in documents:
            try:
                if not doc.fichier:
                    echecs += 1
                    continue

                doc.fichier.open('rb')
                contenu = doc.fichier.read()
                doc.fichier.close()

                import fitz
                pdf = fitz.open(stream=contenu, filetype="pdf")
                premiere_page = pdf[0]
                pixmap = premiere_page.get_pixmap(matrix=fitz.Matrix(0.5, 0.5))
                image_bytes = pixmap.tobytes("png")
                pdf.close()

                nom_miniature = f"miniature_{doc.id}.png"
                doc.miniature.save(nom_miniature, ContentFile(image_bytes), save=True)
                
                succes += 1
                self.stdout.write(self.style.SUCCESS(f'✅ [{doc.id}] {doc.titre}'))

            except Exception as e:
                echecs += 1
                self.stdout.write(self.style.ERROR(f'❌ [{doc.id}] {doc.titre} : {str(e)}'))

        self.stdout.write(self.style.SUCCESS(f'\n🎉 Terminé ! Succès: {succes} | Échecs: {echecs}'))