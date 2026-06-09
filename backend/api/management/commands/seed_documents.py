"""Seed shared demo documents (demo_token=None) into the RAG index."""

from pathlib import Path

from django.core.management.base import BaseCommand

from api.models import Document

SEED_DOCS = [
    ("NovaTech Product Guide", "data/demo/novatech_product_guide.txt"),
    ("Engineering Handbook", "data/demo/engineering_handbook.txt"),
    ("API Reference", "data/demo/api_reference.txt"),
    ("HR Policies", "data/demo/hr_policies.txt"),
    ("Support Playbook", "data/demo/support_playbook.txt"),
]


class Command(BaseCommand):
    help = "Seed shared demo documents (visible to all tokens) into the RAG index."

    def add_arguments(self, parser):
        parser.add_argument(
            "--force",
            action="store_true",
            help="Re-index documents that already exist.",
        )

    def handle(self, *args, **options):
        force = options["force"]
        root = Path(__file__).parents[4]

        from api.views import _ingest_document

        seeded = 0
        skipped = 0

        for title, rel_path in SEED_DOCS:
            path = root / rel_path
            if not path.exists():
                self.stdout.write(self.style.WARNING(f"  WARN  {path} not found, skipping"))
                continue

            existing = Document.objects.filter(title=title, demo_token__isnull=True).first()
            if existing and not force:
                self.stdout.write(f"  SKIP  {title} (already seeded, id={existing.id})")
                skipped += 1
                continue

            content = path.read_text(encoding="utf-8")
            self.stdout.write(f"  INDEX {title} ({len(content):,} chars)...", ending="")
            self.stdout.flush()

            if existing and force:
                doc = existing
                doc.content = content
                doc.save()
            else:
                doc = Document.objects.create(
                    title=title,
                    content=content,
                    demo_token=None,
                )

            try:
                _ingest_document(doc)
                self.stdout.write(self.style.SUCCESS(f" done (id={doc.id})"))
                seeded += 1
            except Exception as exc:
                self.stdout.write(self.style.ERROR(f" FAILED: {exc}"))
                if not existing:
                    doc.delete()

        self.stdout.write(
            self.style.SUCCESS(f"\nDone. {seeded} seeded, {skipped} skipped.")
        )
