"""
Domain errors raised by the service layer and one place that turns them into HTTP responses.

Services never import DRF: they raise DomainError / AccessDenied, and
`api_exception_handler` maps them to a uniform JSON body:

    {"detail": "<message for the user>", "code": "<machine code>"}
"""
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


class DomainError(Exception):
    """A business rule was violated (shown to the user as-is)."""

    code = "domain_error"
    status_code = status.HTTP_400_BAD_REQUEST

    def __init__(self, message: str, code: str | None = None):
        super().__init__(message)
        self.message = message
        if code:
            self.code = code


class AccessDenied(DomainError):
    """The user is authenticated but not allowed to do this."""

    code = "access_denied"
    status_code = status.HTTP_403_FORBIDDEN


class NotFound(DomainError):
    code = "not_found"
    status_code = status.HTTP_404_NOT_FOUND


def api_exception_handler(exc, context):
    """DRF exception handler: domain errors + DRF's own errors in the same shape."""
    if isinstance(exc, DomainError):
        return Response({"detail": exc.message, "code": exc.code}, status=exc.status_code)

    response = exception_handler(exc, context)
    if response is not None and isinstance(response.data, dict) and "detail" in response.data:
        detail = response.data["detail"]
        response.data["code"] = getattr(detail, "code", None) or getattr(exc, "default_code", "error")
    return response
