"""Abstract base models shared by every app. No tables live here."""
from django.db import models


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    # Indexed: the phone pulls only rows with updated_at > last cursor.
    updated_at = models.DateTimeField(auto_now=True, db_index=True)

    class Meta:
        abstract = True


class SoftDeleteModel(models.Model):
    """Reference data is never DELETEd, otherwise phones never learn it is gone."""

    is_active = models.BooleanField(default=True)

    class Meta:
        abstract = True


class VersionedModel(models.Model):
    """`version` grows on every change; sync compares it to detect conflicts."""

    version = models.PositiveIntegerField(default=1)

    class Meta:
        abstract = True

    def bump_version(self):
        self.version += 1
