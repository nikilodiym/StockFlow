from django.db import DatabaseError, connection
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

HealthSerializer = inline_serializer(
    "Health",
    {
        "status": serializers.CharField(),
        "service": serializers.CharField(),
        "database": serializers.CharField(),
        "time": serializers.DateTimeField(),
        "detail": serializers.CharField(required=False),
    },
)


class HealthView(APIView):
    """
    Used by the mobile 'Check connection' button and by server auto-discovery.
    Answers 503 when the database is down, so the phone shows the real reason
    instead of a confusing login error.
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(responses={200: HealthSerializer, 503: HealthSerializer})
    def get(self, request):
        body = {"status": "ok", "service": "StockFlow API", "database": "ok", "time": timezone.now()}
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
        except DatabaseError:
            body.update(
                status="error", database="unavailable",
                detail="API працює, але база даних недоступна. Запустіть її: docker compose up -d db",
            )
            return Response(body, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response(body)
