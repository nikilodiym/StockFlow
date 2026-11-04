from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView


class HealthView(APIView):
    """Liveness check used by the mobile 'Check connection' button."""

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        responses=inline_serializer(
            "Health",
            {"status": serializers.CharField(), "service": serializers.CharField(), "time": serializers.DateTimeField()},
        )
    )
    def get(self, request):
        return Response({"status": "ok", "service": "StockFlow API", "time": timezone.now()})
