from django.core.management.base import BaseCommand

from sync.services import notify_stale_devices


class Command(BaseCommand):
    help = "Notify managers about phones that have not synced for STALE_DEVICE_HOURS (run from cron/Task Scheduler)."

    def handle(self, *args, **options):
        count = notify_stale_devices()
        self.stdout.write(self.style.SUCCESS(f"Stale device notifications: {count}"))
