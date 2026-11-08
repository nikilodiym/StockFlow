"""
Opt-in pagination: lists stay plain JSON arrays (what the current web and mobile
clients expect) unless the client asks for a page with ?page= or ?page_size=.
Then the response is {"count", "next", "previous", "results"}.
"""
from rest_framework.pagination import PageNumberPagination


class OptionalPageNumberPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 500

    def paginate_queryset(self, queryset, request, view=None):
        if "page" not in request.query_params and self.page_size_query_param not in request.query_params:
            return None
        return super().paginate_queryset(queryset, request, view)
