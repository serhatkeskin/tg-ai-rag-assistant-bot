from datetime import timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import DemoToken


class Command(BaseCommand):
    help = "Create a demo token"

    def add_arguments(self, parser):
        parser.add_argument("label", type=str)
        parser.add_argument("--days", type=int, default=30)

    def handle(self, *args, **options):
        tok = DemoToken.objects.create(
            label=options["label"],
            expires_at=timezone.now() + timedelta(days=options["days"]),
        )
        self.stdout.write(f"Created: {tok.token} (expires {tok.expires_at.date()})")
