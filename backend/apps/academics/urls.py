from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SubjectViewSet, GroupViewSet, DlMdViewSet

router = DefaultRouter()
router.register(r'fanlar', SubjectViewSet, basename='fanlar')
router.register(r'guruhlar', GroupViewSet, basename='guruhlar')
router.register(r'dl-md', DlMdViewSet, basename='dl-md')

urlpatterns = [
    path('', include(router.urls)),
]
