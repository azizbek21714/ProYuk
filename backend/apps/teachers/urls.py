from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TeacherViewSet

router = DefaultRouter()
router.register(r'oqituvchilar', TeacherViewSet, basename='oqituvchilar')

urlpatterns = [
    path('', include(router.urls)),
]
