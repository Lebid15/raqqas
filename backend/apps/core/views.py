"""نقاط النهاية الأساسية — أهمّها /app-config التي يطلبها التطبيق عند كل إقلاع."""

from django.utils.http import quote_etag
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from django.utils import timezone

from . import contrast, defaults, money
from .models import AdminLog, AppConfig, DownloadEvent
from .permissions import IsAdminRole
from .serializers import (
    AppConfigSerializer,
    AppConfigWriteSerializer,
    DownloadEventSerializer,
    ThemePresetSerializer,
)


class AppConfigView(APIView):
    """
    GET /api/v1/app-config

    مفتوحة للجميع — التطبيق يطلبها قبل أي شاشة، وقبل تسجيل الدخول.
    تدعم ETag: إن لم تتغيّر النسخة يعود 304 بلا جسم (توفير حقيقي على إنترنت ضعيف).
    """

    permission_classes = [AllowAny]
    authentication_classes = []

    @extend_schema(
        summary="إعدادات التطبيق (التصميم · العملة · اللغات · المزايا)",
        responses=AppConfigSerializer,
    )
    def get(self, request):
        config = AppConfig.get_solo()
        etag = quote_etag(f"cfg-{config.version}-{getattr(request, 'lang', 'ar')}")

        if request.headers.get("If-None-Match") == etag:
            response = Response(status=status.HTTP_304_NOT_MODIFIED)
            response["ETag"] = etag
            return response

        data = AppConfigSerializer(config, context={"request": request}).data
        response = Response(data)
        response["ETag"] = etag
        response["Cache-Control"] = "public, max-age=60"
        return response


class AdminAppConfigView(APIView):
    """
    GET/PATCH /api/v1/admin/app-config — محرّر التصميم في لوحة الإدارة.

    الرد يحمل `warnings`: تحذيرات التباين قبل أن يرى المستخدم النتيجة (plan2 §4.3).
    """

    permission_classes = [IsAdminRole]

    def get(self, request):
        config = AppConfig.get_solo()
        return Response(self._payload(config, request))

    def patch(self, request):
        config = AppConfig.get_solo()
        serializer = AppConfigWriteSerializer(
            config, data=request.data, partial=True, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)

        rates_changed = "rates" in serializer.validated_data
        config = serializer.save(updated_by=request.user)
        if rates_changed:
            # ختم زمني تلقائي: اللوحة تعرضه ليعرف الأدمن متى آخر تحديث،
            # والتطبيق يخفي التحويل التقريبي حين يتقادم.
            AppConfig.objects.filter(pk=config.pk).update(rates_updated_at=timezone.now())
            config.refresh_from_db(fields=["rates_updated_at"])

        AdminLog.record(
            request.user, "config", config,
            note="تعديل إعدادات التطبيق",
            changed=sorted(serializer.validated_data.keys()),
        )

        payload = self._payload(config, request)
        return Response(payload)

    # ------------------------------------------------------------------

    @staticmethod
    def _payload(config, request) -> dict:
        return {
            "config": AppConfigSerializer(config, context={"request": request}).data,
            "editable": AppConfigWriteSerializer(config).data,
            "warnings": contrast.audit_both(config.theme_light, config.theme_dark),
            "meta": {
                "color_groups": defaults.THEME_COLOR_GROUPS,
                "fonts": defaults.BUNDLED_FONTS,
                "shadows": defaults.SHADOW_PRESETS,
                "densities": defaults.DENSITY_PRESETS,
                "currencies": money.catalogue(getattr(request, "lang", "ar")),
                "rate_codes": money.RATE_CODES,
                "base_currency": money.BASE_CURRENCY,
            },
        }


@extend_schema(
    summary="السمات الجاهزة (Presets)",
    responses=ThemePresetSerializer(many=True),
)
@api_view(["GET"])
@permission_classes([AllowAny])
def theme_presets(request):
    return Response(ThemePresetSerializer(defaults.THEME_PRESETS, many=True).data)


@extend_schema(
    summary="فحص تباين سمة قبل حفظها",
    parameters=[OpenApiParameter("mode", str, description="light | dark")],
)
@api_view(["POST"])
@permission_classes([IsAdminRole])
def theme_check(request):
    """يسمح للوحة بالفحص أثناء التحرير بلا حفظ."""
    light = request.data.get("light") or {}
    dark = request.data.get("dark") or {}
    warnings = contrast.audit_both(light, dark)
    return Response({"ok": not warnings, "warnings": warnings})


@extend_schema(summary="تسجيل تنزيل APK (عدّاد بديل عن المتجر)")
@api_view(["POST"])
@permission_classes([AllowAny])
def track_download(request):
    serializer = DownloadEventSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    DownloadEvent.objects.create(
        **serializer.validated_data,
        user_agent=request.headers.get("User-Agent", "")[:255],
    )
    return Response({"ok": True}, status=status.HTTP_201_CREATED)


@extend_schema(summary="فحص صحّة الخادم")
@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    from django.db import connection

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        database_ok = True
    except Exception:
        database_ok = False

    return Response(
        {"ok": database_ok, "database": database_ok, "lang": getattr(request, "lang", "ar")},
        status=status.HTTP_200_OK if database_ok else status.HTTP_503_SERVICE_UNAVAILABLE,
    )
