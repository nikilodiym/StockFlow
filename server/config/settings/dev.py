"""Local development: Postgres in Docker, DEBUG, Browsable API and Swagger."""
from .base import *  # noqa: F401,F403
from .base import REST_FRAMEWORK

DEBUG = True
ALLOWED_HOSTS = ["*"]

# DRF Browsable API: open any /api/... URL in a browser to see and run requests.
# Log in via the "Log in" button (/api-auth/login/) — session auth is dev-only.
REST_FRAMEWORK = {
    **REST_FRAMEWORK,
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
        "rest_framework.renderers.BrowsableAPIRenderer",
    ],
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
        "rest_framework.authentication.SessionAuthentication",
    ],
}

# Serve static files from app dirs without collectstatic (dev only)
WHITENOISE_AUTOREFRESH = True
WHITENOISE_USE_FINDERS = True
