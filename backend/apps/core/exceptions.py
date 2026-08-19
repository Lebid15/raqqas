"""
شكل موحّد للأخطاء — التطبيق يعتمد عليه في عرض الرسائل.

    {
      "error": {
        "code": "validation_error",
        "message": "تحقّق من الحقول المطلوبة",
        "fields": {"price": ["هذا الحقل مطلوب."]}
      }
    }
"""

from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_handler

MESSAGES = {
    "ar": {
        "validation_error": "تحقّق من البيانات المُدخلة.",
        "not_authenticated": "يلزم تسجيل الدخول للمتابعة.",
        "permission_denied": "لا تملك صلاحية لهذا الإجراء.",
        "not_found": "العنصر غير موجود.",
        "throttled": "محاولات كثيرة — انتظر قليلًا ثم أعد المحاولة.",
        "server_error": "حدث خطأ غير متوقّع. حاول مرة أخرى.",
    },
    "tr": {
        "validation_error": "Girilen bilgileri kontrol edin.",
        "not_authenticated": "Devam etmek için giriş yapmalısınız.",
        "permission_denied": "Bu işlem için yetkiniz yok.",
        "not_found": "Kayıt bulunamadı.",
        "throttled": "Çok fazla deneme — biraz bekleyip tekrar deneyin.",
        "server_error": "Beklenmeyen bir hata oluştu. Tekrar deneyin.",
    },
    "en": {
        "validation_error": "Please check the submitted data.",
        "not_authenticated": "You need to sign in to continue.",
        "permission_denied": "You don't have permission for this action.",
        "not_found": "Not found.",
        "throttled": "Too many attempts — please wait and try again.",
        "server_error": "Something went wrong. Please try again.",
    },
}

CODE_BY_STATUS = {
    400: "validation_error",
    401: "not_authenticated",
    403: "permission_denied",
    404: "not_found",
    429: "throttled",
}


def _message(code: str, lang: str) -> str:
    return MESSAGES.get(lang, MESSAGES["ar"]).get(code, MESSAGES["ar"]["server_error"])


def _as_messages(value) -> list[str]:
    """
    يحوّل قيمة خطأ DRF إلى قائمة نصوص نظيفة.

    السبب: DRF يغلّف كل رسالة في ErrorDetail، و`str()` على قائمة منها ينتج
    `[ErrorDetail(string='...', code='invalid')]` — وهو ما كان يظهر للمستخدم
    حرفيًا في شاشة تسجيل الدخول بدل الرسالة العربية.
    """
    if isinstance(value, (list, tuple)):
        messages: list[str] = []
        for item in value:
            messages.extend(_as_messages(item))
        return messages
    if isinstance(value, dict):
        messages = []
        for item in value.values():
            messages.extend(_as_messages(item))
        return messages
    return [str(value)]


def _as_text(value) -> str:
    return " ".join(_as_messages(value)) or MESSAGES["ar"]["server_error"]


def api_exception_handler(exc, context):
    if isinstance(exc, DjangoValidationError):
        exc = exceptions.ValidationError(getattr(exc, "message_dict", None) or exc.messages)
    if isinstance(exc, Http404):
        exc = exceptions.NotFound()

    response = drf_handler(exc, context)
    if response is None:
        return None

    request = context.get("request")
    lang = getattr(request, "lang", "ar")
    code = CODE_BY_STATUS.get(response.status_code, "server_error")

    payload = {"code": code, "message": _message(code, lang)}

    detail = response.data
    if isinstance(detail, dict):
        # أخطاء التحقّق لكل حقل
        fields = {k: _as_messages(v) for k, v in detail.items() if k != "detail"}
        if fields:
            payload["fields"] = fields
        if "detail" in detail:
            payload["message"] = _as_text(detail["detail"])
    elif isinstance(detail, list):
        payload["message"] = _as_text(detail)

    if response.status_code == status.HTTP_429_TOO_MANY_REQUESTS:
        wait = getattr(exc, "wait", None)
        if wait:
            payload["retry_after"] = int(wait)

    # نحتفظ فقط بالترويسات التي لها معنى للعميل (Content-Type يُعاد بناؤه)
    keep = {"Retry-After", "WWW-Authenticate"}
    headers = {k: v for k, v in response.headers.items() if k in keep}

    return Response({"error": payload}, status=response.status_code, headers=headers or None)
