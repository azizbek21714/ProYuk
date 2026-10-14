from django.db import models


class OTM(models.Model):
    """Oliy ta'lim muassasasi — eng yuqori daraja"""
    name = models.CharField(max_length=255)
    short_name = models.CharField(max_length=100, blank=True)
    edited_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'OTM'
        verbose_name_plural = 'OTMlar'

    def __str__(self):
        return f"{self.name} ({self.short_name})" if self.short_name else self.name


class Faculty(models.Model):
    """Fakultet — OTM ga tegishli"""
    name = models.CharField(max_length=255)
    otm = models.ForeignKey(
        OTM,
        on_delete=models.CASCADE,
        related_name='faculties',
    )
    dean = models.ForeignKey(
        'teachers.Teacher',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deaned_faculties',
    )
    edited_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name_plural = 'Fakultetlar'

    def __str__(self):
        return self.name


class Department(models.Model):
    """Kafedra — Fakultet ga tegishli"""
    name = models.CharField(max_length=255)
    faculty = models.ForeignKey(
        Faculty,
        on_delete=models.CASCADE,
        related_name='departments',
    )
    head_of_department = models.ForeignKey(
        'teachers.Teacher',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='headed_departments',
    )
    teachers = models.ManyToManyField(
        'teachers.Teacher',
        blank=True,
        related_name='departments',
    )
    # Kafedraning yillik yuklamasi (soat) — yuklama Excel faylidan hisoblanadi
    yillik_yuklama = models.PositiveIntegerField(default=0)
    # Shakllantirilgan yuklama (qatorlar + o'quv yili) — ko'rish/tahrirlash uchun saqlanadi
    yuklama_data = models.JSONField(default=dict, blank=True)
    edited_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Kafedra'
        verbose_name_plural = 'Kafedralar'

    def __str__(self):
        return self.name
