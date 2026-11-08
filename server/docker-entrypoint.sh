#!/bin/sh
# Prepare the database and static files, then run the container command (gunicorn / runserver / check_devices loop).
set -e
if [ "${SKIP_MIGRATE:-0}" != "1" ]; then
    python manage.py migrate --noinput
fi
python manage.py collectstatic --noinput >/dev/null
exec "$@"
