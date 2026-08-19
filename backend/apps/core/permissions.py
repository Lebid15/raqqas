"""
صلاحيات مشتركة.

القاعدة العامة (قرار 17): القراءة مفتوحة للزائر — والكتابة والتواصل يحتاجان تسجيلًا.
"""

from rest_framework import permissions


class IsStaffRole(permissions.BasePermission):
    """مدير أو مشرف (plan2 §9 قرار 3)."""

    message = "هذا الإجراء متاح للإدارة فقط."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_staff_role)


class IsAdminRole(permissions.BasePermission):
    """المدير فقط — للإعدادات الحسّاسة كالعملة والتصميم."""

    message = "هذا الإجراء متاح للمدير فقط."

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role == "admin")


class IsOwnerOrReadOnly(permissions.BasePermission):
    message = "لا يمكنك تعديل عنصر لا تملكه."

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        owner = getattr(obj, "user", None) or getattr(obj, "owner", None)
        return owner is not None and owner == request.user


class IsOwner(permissions.BasePermission):
    message = "لا تملك هذا العنصر."

    def has_object_permission(self, request, view, obj):
        owner = getattr(obj, "user", None) or getattr(obj, "owner", None)
        return owner is not None and owner == request.user
