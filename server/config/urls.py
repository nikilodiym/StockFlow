"""
Root URLs: every app plugs its own urls.py in.

/api/v1/...  — versioned API (documented in Swagger). New clients use this.
/api/...     — the same endpoints without a version, kept so existing web/mobile builds keep working.
"""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularRedocView, SpectacularSwaggerView

api_patterns = [
    path("", include("core.urls")),
    path("", include("accounts.urls")),
    path("", include("catalog.urls")),
    path("", include("inventory.urls")),
    path("", include("sync.urls")),
]

urlpatterns = [
    path("django-admin/", admin.site.urls),
    path("api/v1/", include(api_patterns)),
    # Swagger / OpenAPI
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/redoc/", SpectacularRedocView.as_view(url_name="schema"), name="redoc"),
    # Legacy unversioned alias (after the docs, so /api/docs/ is not shadowed)
    path("api/", include(api_patterns)),
    # Login/Logout buttons for the DRF Browsable API
    path("api-auth/", include("rest_framework.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
