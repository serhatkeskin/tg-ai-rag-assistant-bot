import uuid
from django.db import models


class Document(models.Model):
    title = models.CharField(max_length=255)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    indexed_at = models.DateTimeField(null=True, blank=True)
    chunk_count = models.IntegerField(default=0)
    demo_token = models.ForeignKey(
        "DemoToken", null=True, blank=True,
        on_delete=models.SET_NULL, related_name="documents",
    )

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return self.title


class DemoToken(models.Model):
    token = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    label = models.CharField(max_length=100)
    expires_at = models.DateTimeField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    usage_limit = models.IntegerField(null=True, blank=True)  # None = unlimited
    usage_count = models.IntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.label} ({'active' if self.is_active else 'revoked'}, expires {self.expires_at.date()})"
