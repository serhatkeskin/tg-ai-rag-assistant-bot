from django.core.management.base import BaseCommand
from api.models import DemoToken


class Command(BaseCommand):
    help = "List all demo tokens"

    def handle(self, *args, **options):
        for tok in DemoToken.objects.all():
            status = "active" if tok.is_active else "revoked"
            self.stdout.write(f"{tok.id} | {tok.label} | {tok.token} | {status} | expires {tok.expires_at.date()}")
