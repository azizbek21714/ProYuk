from django.db import models


class Yuklama(models.Model):
    name = models.CharField(max_length=255)
    file = models.FileField(upload_to='yuklama/', blank=True, null=True)
    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='yuklamalar',
    )
    group = models.ForeignKey(
        'academics.Group',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='yuklamalar',
    )
    subject = models.ForeignKey(
        'academics.Subject',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='yuklamalar',
    )
    dak = models.ForeignKey(
        'academics.Dak',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='yuklamalar',
    )
    dl_md = models.ForeignKey(
        'academics.DlMd',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='yuklamalar',
    )
    groups_count = models.PositiveIntegerField(default=0)
    thread_count = models.PositiveIntegerField(default=0)
    control = models.PositiveIntegerField(default=0)
    edited_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'Yuklama'
        verbose_name_plural = 'Yuklamalar'

    def __str__(self):
        return self.name


class Reja(models.Model):
    """O'qituvchining shaxsiy ish rejasi (yuklama shakllantirishda yaratiladi)."""
    teacher = models.ForeignKey(
        'teachers.Teacher',
        on_delete=models.CASCADE,
        related_name='rejalar',
        null=True,
        blank=True,
    )
    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.SET_NULL,
        related_name='rejalar',
        null=True,
        blank=True,
    )
    oquv_yili = models.CharField(max_length=20, blank=True, default='')
    jami_soat = models.PositiveIntegerField(default=0)
    status = models.CharField(max_length=30, default='loyiha')
    # Shakllantirilgan reja tafsilotlari (kafedra yuklama_data nusxasi)
    data = models.JSONField(default=dict, blank=True)
    edited_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        unique_together = ('teacher', 'oquv_yili')

    def __str__(self):
        return f"Reja #{self.pk} (teacher={self.teacher_id}, {self.oquv_yili})"


class AcademicYear(models.Model):
    name = models.CharField(max_length=20, unique=True)
    starts_on = models.DateField()
    ends_on = models.DateField()
    is_active = models.BooleanField(default=False)

    class Meta:
        ordering = ['-starts_on']

    def __str__(self):
        return self.name


class WorkloadType(models.Model):
    code = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    clause_number = models.PositiveIntegerField(default=1)
    formula_expression = models.CharField(max_length=255, blank=True)
    is_hourly = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['clause_number', 'name']

    def __str__(self):
        return f'{self.code} — {self.name}'


class WorkloadNorm(models.Model):
    workload_type = models.ForeignKey(WorkloadType, on_delete=models.CASCADE, related_name='norms')
    institution_profile = models.CharField(max_length=30, default='barcha')
    coefficient = models.DecimalField(max_digits=10, decimal_places=3, default=1)
    minimum = models.PositiveIntegerField(null=True, blank=True)
    maximum = models.PositiveIntegerField(null=True, blank=True)
    valid_from = models.DateField()
    valid_until = models.DateField(null=True, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    edited_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-valid_from', '-created_at']


class PositionNorm(models.Model):
    position = models.CharField(max_length=50)
    academic_year = models.ForeignKey(AcademicYear, on_delete=models.CASCADE, related_name='position_norms')
    minimum_hours = models.PositiveIntegerField()
    maximum_hours = models.PositiveIntegerField()

    class Meta:
        ordering = ['position']
        constraints = [
            models.UniqueConstraint(fields=['position', 'academic_year'], name='unique_position_norm_year'),
        ]


class Assignment(models.Model):
    lesson_type = models.CharField(max_length=32, blank=True, default='', choices=[
        ('maruza', "Ma'ruza"), ('amaliyot', 'Amaliyot'), ('laboratoriya', 'Laboratoriya'),
        ('maruza_amaliyot', "ma'ruza/amaliyot"),
        ('maruza_laboratoriya', "ma'ruza/laboratoriya"),
        ('amaliyot_laboratoriya', 'amaliyot/laboratoriya'),
        ('maruza_amaliyot_laboratoriya', "ma'ruza/amaliyot/laboratoriya"),
    ])
    reja = models.ForeignKey(Reja, on_delete=models.CASCADE, related_name='assignments')
    workload_type = models.ForeignKey(WorkloadType, on_delete=models.PROTECT, related_name='assignments')
    subject = models.ForeignKey('academics.Subject', on_delete=models.SET_NULL, null=True, blank=True)
    group = models.ForeignKey('academics.Group', on_delete=models.SET_NULL, null=True, blank=True)
    semester_number = models.PositiveSmallIntegerField(default=1)
    hours = models.DecimalField(max_digits=10, decimal_places=2)
    calculation_type = models.CharField(max_length=30, default='rejali')
    formula_input = models.JSONField(default=dict, blank=True)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['semester_number', 'id']


class Approval(models.Model):
    reja = models.ForeignKey(Reja, on_delete=models.CASCADE, related_name='approvals')
    stage = models.CharField(max_length=40)
    state = models.CharField(max_length=30, default='kutilmoqda')
    comment = models.TextField(blank=True)
    acted_by = models.ForeignKey('auth.User', on_delete=models.SET_NULL, null=True, blank=True)
    acted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['created_at']
        constraints = [
            models.UniqueConstraint(fields=['reja', 'stage'], name='unique_approval_stage_per_plan'),
        ]


class DlMdBiriktirma(models.Model):
    """O'qituvchiga biriktirilgan DL (diplom loyiha) / MD (magistrlik dissertatsiyasi)
    rahbarligi. Talabalar soni × soat birligi = jami soat. Shaxsiy ish rejaga chiqadi."""
    teacher = models.ForeignKey(
        'teachers.Teacher', on_delete=models.CASCADE, related_name='dlmd_biriktirmalar',
    )
    department = models.ForeignKey(
        'departments.Department', on_delete=models.CASCADE, related_name='dlmd_biriktirmalar',
    )
    tur = models.CharField(max_length=10, default='dl')  # 'dl' | 'md'
    talim_shakli = models.CharField(max_length=30, blank=True)
    semestr = models.CharField(max_length=10, default='bahorgi')  # 'kuzgi' | 'bahorgi'
    talaba_soni = models.PositiveIntegerField(default=0)
    soat_birligi = models.PositiveIntegerField(default=0)
    jami_soat = models.PositiveIntegerField(default=0)
    oquv_yili = models.CharField(max_length=20, blank=True)
    edited_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"DlMd #{self.pk} ({self.tur}, teacher={self.teacher_id}, {self.talaba_soni} ta)"


class Monitoring(models.Model):
    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='monitorings',
    )
    user_id = models.PositiveIntegerField()
    group = models.ForeignKey(
        'academics.Group',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='monitorings',
    )
    subject = models.ForeignKey(
        'academics.Subject',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='monitorings',
    )
    control = models.PositiveIntegerField(default=0)
    edited_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Monitoring #{self.pk} (user_id={self.user_id})"
