"""Cross-cutting API rules: versioning, error format, throttling, pagination."""
import pytest

from conftest import PASSWORD

pytestmark = pytest.mark.django_db


def test_versioned_and_legacy_urls_both_work(client_for, worker, make_product):
    make_product()
    client = client_for(worker)
    assert client.get("/api/v1/products/").status_code == 200
    assert client.get("/api/products/").status_code == 200


def test_swagger_documents_only_v1(api):
    schema = api.get("/api/schema/?format=json").json()
    assert schema["paths"], "schema is not empty"
    assert all(path.startswith("/api/v1/") for path in schema["paths"])


def test_domain_errors_have_detail_and_code(client_for, manager, warehouse, make_document):
    doc = make_document("receipt", warehouse, manager)  # empty document cannot be posted
    response = client_for(manager).post(f"/api/v1/documents/{doc.pk}/post/")
    assert response.status_code == 400
    assert response.data["code"] == "document_error"
    assert "товару" in response.data["detail"]


def test_access_denied_is_403_with_code(client_for, worker, warehouse2, make_product):
    response = client_for(worker).post(
        "/api/v1/documents/", {"type": "receipt", "warehouse": warehouse2.pk, "lines": []}, format="json"
    )
    assert response.status_code == 403 and response.data["code"] == "access_denied"


def test_drf_errors_also_get_a_code(api):
    response = api.get("/api/v1/products/")
    assert response.status_code == 401 and response.data["code"]


def test_login_is_throttled(api, worker, settings):
    from rest_framework.settings import api_settings

    rates = {**api_settings.DEFAULT_THROTTLE_RATES, "login": "3/min"}
    settings.REST_FRAMEWORK = {**settings.REST_FRAMEWORK, "DEFAULT_THROTTLE_RATES": rates}
    from rest_framework.throttling import ScopedRateThrottle

    ScopedRateThrottle.THROTTLE_RATES = rates
    try:
        codes = [api.post("/api/v1/auth/login/", {"email": worker.email, "password": "wrong"}, format="json").status_code for _ in range(4)]
    finally:
        ScopedRateThrottle.THROTTLE_RATES = api_settings.DEFAULT_THROTTLE_RATES
    assert codes == [401, 401, 401, 429]


def test_login_still_works_with_correct_password(api, worker):
    response = api.post("/api/v1/auth/login/", {"email": worker.email, "password": PASSWORD}, format="json")
    assert response.status_code == 200


def test_pagination_is_opt_in(client_for, worker, make_product):
    for i in range(3):
        make_product(name=f"Товар {i}")
    client = client_for(worker)
    assert isinstance(client.get("/api/v1/products/").data, list)
    page = client.get("/api/v1/products/?page_size=2").data
    assert page["count"] == 3 and len(page["results"]) == 2 and page["next"]
