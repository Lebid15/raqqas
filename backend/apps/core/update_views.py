"""
نقطة البيان التي يطلبها expo-updates.

البروتوكول يقبل شكلين للردّ:
  · الإصدار 1 → multipart/mixed وجزء اسمه "manifest"
  · الإصدار 0 → JSON مباشر
نتعرّف على المطلوب من ترويسة `expo-protocol-version` ونردّ بما يفهمه العميل،
فتعمل النقطة مع نسخ expo-updates القديمة والجديدة معًا.
"""

from __future__ import annotations

import json
import secrets

from django.conf import settings
from django.http import HttpResponse
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .permissions import IsAdminRole
from .updates import OtaUpdate, build_manifest


def _base_url(request) -> str:
    configured = getattr(settings, "PUBLIC_SITE_URL", "")
    if configured:
        return configured.rstrip("/")
    return f"{request.scheme}://{request.get_host()}"


@extend_schema(summary="بيان التحديث عن بُعد (expo-updates)")
@api_view(["GET"])
@permission_classes([AllowAny])
def manifest(request):
    platform = (request.headers.get("expo-platform") or request.GET.get("platform") or "android").lower()
    runtime = request.headers.get("expo-runtime-version") or request.GET.get("runtime-version") or ""
    protocol = request.headers.get("expo-protocol-version", "0")
    current_id = request.headers.get("expo-current-update-id", "")

    if not runtime:
        return Response(
            {"error": {"code": "validation_error", "message": "expo-runtime-version مفقودة."}},
            status=status.HTTP_400_BAD_REQUEST,
        )

    update = OtaUpdate.current(runtime, platform)
    if update is None:
        # لا حزمة لهذه الطبقة الأصلية — التطبيق يكمل بنسخته المدمجة
        response = HttpResponse(status=status.HTTP_204_NO_CONTENT)
        response["expo-protocol-version"] = protocol
        response["expo-sfv-version"] = "0"
        response["cache-control"] = "private, max-age=0"
        return response

    # التطبيق يحمل النسخة نفسها — لا داعي لإرسال البيان كاملًا على إنترنت ضعيف
    if current_id and current_id == str(update.update_id):
        response = HttpResponse(status=status.HTTP_204_NO_CONTENT)
        response["expo-protocol-version"] = protocol
        response["expo-sfv-version"] = "0"
        response["cache-control"] = "private, max-age=0"
        return response

    try:
        payload = build_manifest(update, _base_url(request))
    except (FileNotFoundError, ValueError, KeyError) as error:
        return Response(
            {"error": {"code": "server_error", "message": f"حزمة التحديث تالفة: {error}"}},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    body = json.dumps(payload, ensure_ascii=False)

    if protocol == "0":
        response = HttpResponse(body, content_type="application/json")
    else:
        boundary = secrets.token_hex(16)
        response = HttpResponse(
            (
                f"--{boundary}\r\n"
                'Content-Disposition: form-data; name="manifest"\r\n'
                "Content-Type: application/json\r\n\r\n"
                f"{body}\r\n"
                f"--{boundary}--\r\n"
            ),
            content_type=f"multipart/mixed; boundary={boundary}",
        )

    response["expo-protocol-version"] = protocol
    response["expo-sfv-version"] = "0"
    response["cache-control"] = "private, max-age=0"
    return response


@extend_schema(summary="التحديثات المنشورة (للإدارة)")
@api_view(["GET"])
@permission_classes([IsAdminRole])
def update_list(request):
    updates = OtaUpdate.objects.all()[:50]
    return Response([
        {
            "id": item.id,
            "update_id": str(item.update_id),
            "runtime_version": item.runtime_version,
            "platform": item.platform,
            "is_active": item.is_active,
            "notes": item.notes,
            "created_at": item.created_at,
        }
        for item in updates
    ])


@extend_schema(summary="التراجع إلى حزمة سابقة")
@api_view(["POST"])
@permission_classes([IsAdminRole])
def activate_update(request, pk: int):
    """
    زرّ التراجع.

    وجوده أهم من وجود زر النشر: لو خرج تحديث فيه خطأ، الطريق الوحيد للرجوع
    بلا هذا الزر هو إعادة بناء APK ومطالبة الناس بتنزيله — وهو ما بنينا
    التحديث عن بُعد أصلًا لتجنّبه.
    """
    update = OtaUpdate.objects.filter(pk=pk).first()
    if not update:
        return Response(status=status.HTTP_404_NOT_FOUND)

    update.activate()
    from .models import AdminLog

    AdminLog.record(request.user, "config", update, note=f"تفعيل حزمة {update.update_id}")
    return Response({"ok": True, "active": str(update.update_id)})
