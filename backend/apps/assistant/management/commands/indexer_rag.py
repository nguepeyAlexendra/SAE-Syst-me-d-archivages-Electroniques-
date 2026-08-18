from django.core.management.base import BaseCommand
from apps.documents.models import Document
from apps.assistant import rag


class Command(BaseCommand):
    help = "Indexe tous les documents valides dans Elasticsearch pour le RAG"

    def handle(self, *args, **options):
        docs = Document.objects.filter(statut=Document.Statut.VALIDE)
        total = docs.count()
        self.stdout.write(f"{total} document(s) valide(s) à indexer...")
        for doc in docs:
            try:
                n = rag.indexer_document(doc)
                self.stdout.write(self.style.SUCCESS(f"  OK {doc.id} {doc.titre} : {n} chunks"))
            except Exception as e:
                self.stdout.write(self.style.ERROR(f"  ERREUR {doc.id} {doc.titre} : {e}"))
        self.stdout.write(self.style.SUCCESS("Indexation RAG terminée."))