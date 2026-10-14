from django.contrib import admin
from .models import Yuklama, Monitoring


@admin.register(Yuklama)
class YuklamaAdmin(admin.ModelAdmin):
    list_display = ('name', 'department', 'group', 'subject', 'dak', 'dl_md', 'groups_count', 'thread_count', 'control', 'created_at')
    list_filter = ('department', 'group', 'subject', 'dak', 'dl_md')
    search_fields = ('name',)
    ordering = ('name',)


@admin.register(Monitoring)
class MonitoringAdmin(admin.ModelAdmin):
    list_display = ('id', 'user_id', 'department', 'group', 'subject', 'control', 'created_at')
    list_filter = ('department', 'group', 'subject')
    search_fields = ('user_id',)
    ordering = ('-created_at',)
