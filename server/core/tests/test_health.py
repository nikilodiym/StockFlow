from unittest import mock

import pytest
from django.db import OperationalError

pytestmark = pytest.mark.django_db


def test_health_ok(api):
    response = api.get("/api/health/")
    assert response.status_code == 200
    assert response.data["status"] == "ok" and response.data["database"] == "ok"


def test_health_reports_database_down(api):
    with mock.patch("core.views.connection.cursor", side_effect=OperationalError("connection refused")):
        response = api.get("/api/health/")
    assert response.status_code == 503
    assert response.data["database"] == "unavailable"
    assert "docker compose up -d db" in response.data["detail"]
