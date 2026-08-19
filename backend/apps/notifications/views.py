from drf_spectacular.utils import extend_schema
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.core.pagination import DefaultPagination
from apps.core.timeutils import time_ago

from .models import Notification


class NotificationSerializer(serializers.ModelSerializer):
    title = serializers.SerializerMethodField()
    body = serializers.SerializerMethodField()
    time_text = serializers.SerializerMethodField()

    class Meta:
        model = Notification
        fields = ["id", "kind", "title", "body", "listing_id", "is_read",
                  "created_at", "time_text", "data"]

    def get_title(self, obj) -> str:
        return obj.title_for(self._lang())

    def get_body(self, obj) -> str:
        return obj.body_for(self._lang())

    def get_time_text(self, obj) -> str:
        return time_ago(obj.created_at, self._lang())

    def _lang(self) -> str:
        return getattr(self.context.get("request"), "lang", "ar")


@extend_schema(summary="إشعاراتي")
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def notification_list(request):
    queryset = Notification.objects.filter(user=request.user)
    paginator = DefaultPagination()
    page = paginator.paginate_queryset(queryset, request)
    serializer = NotificationSerializer(page, many=True, context={"request": request})
    response = paginator.get_paginated_response(serializer.data)
    response.data["unread"] = queryset.filter(is_read=False).count()
    return response


@extend_schema(summary="عدد غير المقروء")
@api_view(["GET"])
@permission_classes([IsAuthenticated])
def unread_count(request):
    count = Notification.objects.filter(user=request.user, is_read=False).count()
    return Response({"unread": count})


@extend_schema(summary="تعليم الإشعارات كمقروءة")
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def mark_read(request):
    ids = request.data.get("ids")
    queryset = Notification.objects.filter(user=request.user, is_read=False)
    if ids:
        queryset = queryset.filter(pk__in=ids)
    updated = queryset.update(is_read=True)
    return Response({"updated": updated})
