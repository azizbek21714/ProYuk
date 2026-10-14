from django.contrib import admin
from .models import OTM, Faculty, Department


@admin.register(OTM)
class OTMAdmin(admin.ModelAdmin):
    list_display = ('name', 'short_name', 'created_at')
    search_fields = ('name', 'short_name')
    ordering = ('name',)


@admin.register(Faculty)
class FacultyAdmin(admin.ModelAdmin):
    list_display = ('name', 'otm', 'dean', 'created_at')
    list_filter = ('otm',)
    search_fields = ('name',)
    ordering = ('name',)


@admin.register(Department)
class DepartmentAdmin(admin.ModelAdmin):
    list_display = ('name', 'faculty', 'head_of_department', 'created_at')
    list_filter = ('faculty', 'faculty__otm')
    search_fields = ('name',)
    ordering = ('name',)
    filter_horizontal = ('teachers',)
