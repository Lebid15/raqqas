"""يضبط request.lang لكل طلب، ويعلن اللغة المختارة في ترويسة الرد."""

from . import i18n


class LanguageMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.lang = i18n.resolve(request)
        response = self.get_response(request)
        response["Content-Language"] = request.lang
        # التخزين الوسيط يجب أن يفرّق بين اللغات
        existing = response.get("Vary", "")
        parts = {p.strip() for p in existing.split(",") if p.strip()}
        parts.update({"Accept-Language", "X-Language"})
        response["Vary"] = ", ".join(sorted(parts))
        return response
