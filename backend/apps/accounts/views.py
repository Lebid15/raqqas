"""نقاط المصادقة — التسجيل والدخول والملف الشخصي."""

from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.generics import RetrieveUpdateAPIView
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from .models import Device, User
from .serializers import (
    ChangePasswordSerializer,
    DeviceSerializer,
    LoginSerializer,
    RegisterSerializer,
    UserSerializer,
    tokens_for,
)


class AuthThrottle(ScopedRateThrottle):
    scope = "auth"


class RegisterView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AuthThrottle]

    @extend_schema(summary="إنشاء حساب", request=RegisterSerializer)
    def post(self, request):
        serializer = RegisterSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(
            {"user": UserSerializer(user).data, "tokens": tokens_for(user)},
            status=status.HTTP_201_CREATED,
        )


class LoginView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [AuthThrottle]

    @extend_schema(summary="تسجيل الدخول", request=LoginSerializer)
    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        user = serializer.validated_data["user"]
        user.touch()
        return Response({"user": UserSerializer(user).data, "tokens": tokens_for(user)})


class MeView(RetrieveUpdateAPIView):
    """GET/PATCH /auth/me — الاسم واللغة ورقم واتساب."""

    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def perform_update(self, serializer):
        serializer.save()
        self.request.user.touch()


@extend_schema(summary="تغيير كلمة المرور", request=ChangePasswordSerializer)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([AuthThrottle])
def change_password(request):
    serializer = ChangePasswordSerializer(data=request.data, context={"request": request})
    serializer.is_valid(raise_exception=True)
    user = request.user
    user.set_password(serializer.validated_data["new_password"])
    user.save(update_fields=["password"])
    # الرموز القديمة تبقى صالحة حتى انتهائها — نعيد رموزًا جديدة للجهاز الحالي
    return Response({"ok": True, "tokens": tokens_for(user)})


@extend_schema(summary="تسجيل جهاز لاستقبال الإشعارات", request=DeviceSerializer)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def register_device(request):
    serializer = DeviceSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    data = serializer.validated_data
    device, _ = Device.objects.update_or_create(
        token=data["token"],
        defaults={
            "user": request.user,
            "platform": data.get("platform", Device.Platform.ANDROID),
            "app_version": data.get("app_version", ""),
            "language": data.get("language", request.user.language),
            "is_active": True,
        },
    )
    return Response({"ok": True, "id": device.id}, status=status.HTTP_201_CREATED)


@extend_schema(summary="إلغاء تسجيل الجهاز (تسجيل خروج)")
@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout(request):
    token = request.data.get("device_token")
    if token:
        Device.objects.filter(token=token, user=request.user).update(is_active=False)
    User.objects.filter(pk=request.user.pk).update(last_seen_at=timezone.now())
    return Response({"ok": True})


@extend_schema(summary="التحقّق من توفّر رقم قبل التسجيل")
@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def check_phone(request):
    from django.core.exceptions import ValidationError

    from .utils import normalize_phone

    try:
        phone = normalize_phone(request.data.get("phone", ""))
    except ValidationError as exc:
        return Response(
            {"error": {"code": "validation_error", "message": exc.messages[0]}},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return Response({"available": not User.objects.filter(phone=phone).exists()})
