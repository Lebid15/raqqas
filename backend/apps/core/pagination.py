"""ترقيم بالمؤشّر لقوائم الإعلانات — أخفّ على الإنترنت الضعيف وأدقّ مع القوائم المتحرّكة."""

from collections import OrderedDict

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class DefaultPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 60

    def get_paginated_response(self, data):
        return Response(
            OrderedDict(
                [
                    ("count", self.page.paginator.count),
                    ("pages", self.page.paginator.num_pages),
                    ("page", self.page.number),
                    ("has_next", self.page.has_next()),
                    ("next", self.get_next_link()),
                    ("previous", self.get_previous_link()),
                    ("results", data),
                ]
            )
        )


class SmallPagination(DefaultPagination):
    page_size = 10
