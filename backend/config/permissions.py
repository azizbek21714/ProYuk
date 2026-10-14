from rest_framework.permissions import SAFE_METHODS, BasePermission


def is_application_admin(user):
    """Application admins are superusers or members of the explicit admin group."""
    return bool(
        user
        and user.is_authenticated
        and (user.is_superuser or user.groups.filter(name='admin').exists())
    )


class IsApplicationAdmin(BasePermission):
    message = "Bu amal faqat administrator uchun ruxsat etilgan."

    def has_permission(self, request, view):
        return is_application_admin(request.user)


class IsApplicationAdminOrAuthenticatedReadOnly(BasePermission):
    """All reads require login; mutations require an application administrator."""
    message = "Bu amal faqat administrator uchun ruxsat etilgan."

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        return request.method in SAFE_METHODS or is_application_admin(request.user)
