from rest_framework import serializers
from .models import Document


class DocumentSerializer(serializers.ModelSerializer):
    deletable = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = ["id", "title", "content", "created_at", "indexed_at", "chunk_count", "deletable"]
        read_only_fields = ["id", "created_at", "indexed_at", "chunk_count", "deletable"]

    def get_deletable(self, obj):
        request = self.context.get("request")
        token = getattr(request, "demo_token", None) if request else None
        return (
            obj.demo_token_id is not None
            and token is not None
            and obj.demo_token_id == token.id
        )


class QuerySerializer(serializers.Serializer):
    query = serializers.CharField(min_length=1, max_length=2000)
