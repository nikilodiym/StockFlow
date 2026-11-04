"""pytest settings. Uses TEST_DATABASE_URL when set (e.g. Postgres in Docker), else SQLite in memory."""
from .base import *  # noqa: F401,F403
from .base import database_from_url, env

DEBUG = False
SECRET_KEY = "test-only-secret-key-that-is-long-enough-for-hs256"

_test_db = env("TEST_DATABASE_URL")
DATABASES = {
    "default": database_from_url(_test_db)
    if _test_db
    else {"ENGINE": "django.db.backends.sqlite3", "NAME": ":memory:"}
}

PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
EXPO_PUSH_ENABLED = False
