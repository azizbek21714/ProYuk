from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from config.dashboard_urls import teacher_urlpatterns

urlpatterns = [
    path('admin/', admin.site.urls),

    # Authentication
    path('api/auth/', include('config.auth_urls')),

    # CRUD endpointlar
    path('api/crud/', include('config.crud_urls')),

    # Dashboard
    path('api/dashboard/', include('config.dashboard_urls')),
    path('api/teacher/', include((teacher_urlpatterns, 'teacher'))),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
