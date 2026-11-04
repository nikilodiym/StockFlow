"""
GIN pg_trgm index for fast product search by name (10 000+ items).
Matches what DRF SearchFilter generates on PostgreSQL: UPPER(name::text) LIKE UPPER('%...%').
Skipped on SQLite (tests without Postgres).
"""
from django.db import migrations

CREATE = [
    "CREATE EXTENSION IF NOT EXISTS pg_trgm",
    "CREATE INDEX IF NOT EXISTS products_name_trgm ON products USING gin (UPPER(name::text) gin_trgm_ops)",
]
DROP = ["DROP INDEX IF EXISTS products_name_trgm"]


def run(statements):
    def apply(apps, schema_editor):
        if schema_editor.connection.vendor != "postgresql":
            return
        for sql in statements:
            schema_editor.execute(sql)

    return apply


class Migration(migrations.Migration):
    dependencies = [("catalog", "0001_initial")]

    operations = [migrations.RunPython(run(CREATE), run(DROP))]
