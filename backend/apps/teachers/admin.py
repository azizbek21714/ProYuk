from django.contrib import admin
from .models import Teacher, TeacherSubject, TeacherGroup


@admin.register(Teacher)
class TeacherAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'position', 'degree', 'academic_title', 'speciality', 'rate', 'email', 'phone_number', 'created_at')
    list_filter = ('position', 'degree', 'academic_title', 'speciality', 'rate')
    search_fields = ('full_name', 'email', 'phone_number')
    ordering = ('full_name',)


@admin.register(TeacherSubject)
class TeacherSubjectAdmin(admin.ModelAdmin):
    list_display = ('teacher', 'subject', 'created_at')
    list_filter = ('teacher', 'subject')
    search_fields = ('teacher__full_name', 'subject__name')


@admin.register(TeacherGroup)
class TeacherGroupAdmin(admin.ModelAdmin):
    list_display = ('teacher', 'group', 'created_at')
    list_filter = ('teacher', 'group')
    search_fields = ('teacher__full_name', 'group__name')
