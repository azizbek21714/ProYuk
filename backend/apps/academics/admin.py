from django.contrib import admin
from .models import Subject, Group, DlMd, Practise, Dak, SubjectGroup


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ('name', 'study_format', 'program_type', 'course', 'semester', 'study_language', 'hours', 'created_at')
    list_filter = ('study_format', 'program_type', 'course', 'semester', 'study_language')
    search_fields = ('name',)
    ordering = ('name',)


@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ('name', 'course', 'program_type', 'study_language', 'students', 'created_at')
    list_filter = ('course', 'program_type', 'study_language')
    search_fields = ('name',)
    ordering = ('name',)


@admin.register(DlMd)
class DlMdAdmin(admin.ModelAdmin):
    list_display = ('name', 'type', 'program_type', 'study_language', 'students', 'created_at')
    list_filter = ('type', 'program_type', 'study_language')
    search_fields = ('name',)
    ordering = ('name',)


@admin.register(Practise)
class PractiseAdmin(admin.ModelAdmin):
    list_display = ('type', 'course', 'program_type', 'study_language', 'students', 'created_at')
    list_filter = ('type', 'course', 'program_type', 'study_language')
    ordering = ('type',)


@admin.register(Dak)
class DakAdmin(admin.ModelAdmin):
    list_display = ('type', 'hours', 'created_at')
    list_filter = ('type',)
    ordering = ('type',)


@admin.register(SubjectGroup)
class SubjectGroupAdmin(admin.ModelAdmin):
    list_display = ('subject', 'group', 'created_at')
    list_filter = ('subject', 'group')
    search_fields = ('subject__name', 'group__name')
