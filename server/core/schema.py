"""OpenAPI (Swagger) shows only the versioned API: /api/v1/... (the unversioned /api/... is a legacy alias)."""


def only_v1(endpoints, **kwargs):
    return [endpoint for endpoint in endpoints if endpoint[0].startswith("/api/v1/")]
