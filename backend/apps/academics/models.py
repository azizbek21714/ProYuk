from django.db import models
from django.db.models.functions import Lower


class StudyFormat(models.TextChoices):
    FULL_TIME = 'full_time', 'Full Time'
    PART_TIME = 'part_time', 'Part Time'
    EVENING = 'evening', 'Evening'
    DISTANCE = 'distance', 'Distance'


class ProgramType(models.TextChoices):
    BACHELOR = 'bachelor', 'Bachelor'
    MASTER = 'master', 'Master'
    PHD = 'phd', 'PhD'


class Course(models.TextChoices):
    COURSE_1 = 'course_1', 'Course 1'
    COURSE_2 = 'course_2', 'Course 2'
    COURSE_3 = 'course_3', 'Course 3'
    COURSE_4 = 'course_4', 'Course 4'
    COURSE_5 = 'course_5', 'Course 5'


class Semester(models.TextChoices):
    SEMESTER_1 = 'semester_1', 'Semester 1'
    SEMESTER_2 = 'semester_2', 'Semester 2'
    SEMESTER_3 = 'semester_3', 'Semester 3'
    SEMESTER_4 = 'semester_4', 'Semester 4'
    SEMESTER_5 = 'semester_5', 'Semester 5'
    SEMESTER_6 = 'semester_6', 'Semester 6'
    SEMESTER_7 = 'semester_7', 'Semester 7'
    SEMESTER_8 = 'semester_8', 'Semester 8'
    SEMESTER_9 = 'semester_9', 'Semester 9'
    SEMESTER_10 = 'semester_10', 'Semester 10'


class StudyLanguage(models.TextChoices):
    UZ = 'uz', 'Uzbek'
    RU = 'ru', 'Russian'
    EN = 'en', 'English'


class DlMdType(models.TextChoices):
    LECTURE = 'lecture', 'Lecture'
    SEMINAR = 'seminar', 'Seminar'
    LABORATORY = 'laboratory', 'Laboratory'
    INDEPENDENT_WORK = 'independent_work', 'Independent Work'


class PractiseType(models.TextChoices):
    EDUCATIONAL = 'educational', 'Educational'
    INDUSTRIAL = 'industrial', 'Industrial'
    PRE_DIPLOMA = 'pre_diploma', 'Pre-Diploma'


class DakType(models.TextChoices):
    FINAL_EXAM = 'final_exam', 'Final Exam'
    THESIS_DEFENSE = 'thesis_defense', 'Thesis Defense'


class Subject(models.Model):
    name = models.CharField(max_length=255)
    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.CASCADE,
        related_name='subjects',
        null=True,
        blank=True,
    )
    study_format = models.CharField(
        max_length=50,
        choices=StudyFormat.choices,
        default=StudyFormat.FULL_TIME,
    )
    program_type = models.CharField(
        max_length=50,
        choices=ProgramType.choices,
        default=ProgramType.BACHELOR,
    )
    course = models.CharField(
        max_length=50,
        choices=Course.choices,
        default=Course.COURSE_1,
    )
    semester = models.CharField(
        max_length=50,
        choices=Semester.choices,
        default=Semester.SEMESTER_1,
    )
    study_language = models.CharField(
        max_length=10,
        choices=StudyLanguage.choices,
        default=StudyLanguage.UZ,
    )
    # Comma-separated list of language codes (e.g. "uz,ru"). Allows a subject
    # to be taught in several languages. `study_language` kept for back-compat.
    study_languages = models.CharField(max_length=50, blank=True, default='')
    # Hours broken down per mashg'ulot shakli. `hours` stays as the total.
    maruza_hours = models.PositiveIntegerField(default=0)
    amaliyot_hours = models.PositiveIntegerField(default=0)
    laboratoriya_hours = models.PositiveIntegerField(default=0)
    seminar_hours = models.PositiveIntegerField(default=0)
    hours = models.PositiveIntegerField(default=0)
    edited_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        constraints = [
            models.UniqueConstraint(
                Lower('name'), 'department',
                condition=models.Q(department__isnull=False),
                name='academics_unique_subject_name_department_ci',
            ),
        ]

    def __str__(self):
        return f"{self.name} ({self.get_program_type_display()}, {self.get_course_display()})"


class Group(models.Model):
    name = models.CharField(max_length=255)
    department = models.ForeignKey(
        'departments.Department',
        on_delete=models.CASCADE,
        related_name='groups',
        null=True,
        blank=True,
    )
    course = models.CharField(
        max_length=50,
        choices=Course.choices,
        default=Course.COURSE_1,
    )
    program_type = models.CharField(
        max_length=50,
        choices=ProgramType.choices,
        default=ProgramType.BACHELOR,
    )
    study_format = models.CharField(
        max_length=50,
        choices=StudyFormat.choices,
        default=StudyFormat.FULL_TIME,
    )
    study_language = models.CharField(
        max_length=10,
        choices=StudyLanguage.choices,
        default=StudyLanguage.UZ,
    )
    oquv_yili = models.CharField(max_length=20, blank=True, default='')
    students = models.PositiveIntegerField(default=0)
    edited_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_course_display()})"


class DlMd(models.Model):
    name = models.CharField(max_length=255)
    type = models.CharField(
        max_length=50,
        choices=DlMdType.choices,
        default=DlMdType.LECTURE,
    )
    program_type = models.CharField(
        max_length=50,
        choices=ProgramType.choices,
        default=ProgramType.BACHELOR,
    )
    study_language = models.CharField(
        max_length=10,
        choices=StudyLanguage.choices,
        default=StudyLanguage.UZ,
    )
    students = models.PositiveIntegerField(default=0)
    edited_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'DlMd'
        verbose_name_plural = 'DlMds'
        ordering = ['name']

    def __str__(self):
        return f"{self.name} ({self.get_type_display()})"


class Practise(models.Model):
    type = models.CharField(
        max_length=50,
        choices=PractiseType.choices,
        default=PractiseType.EDUCATIONAL,
    )
    course = models.CharField(
        max_length=50,
        choices=Course.choices,
        default=Course.COURSE_1,
    )
    program_type = models.CharField(
        max_length=50,
        choices=ProgramType.choices,
        default=ProgramType.BACHELOR,
    )
    study_language = models.CharField(
        max_length=10,
        choices=StudyLanguage.choices,
        default=StudyLanguage.UZ,
    )
    students = models.PositiveIntegerField(default=0)
    edited_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Practise'
        verbose_name_plural = 'Practises'
        ordering = ['type']

    def __str__(self):
        return f"{self.get_type_display()} ({self.get_course_display()})"


class Dak(models.Model):
    type = models.CharField(
        max_length=50,
        choices=DakType.choices,
        default=DakType.FINAL_EXAM,
    )
    hours = models.PositiveIntegerField(default=0)
    body = models.TextField(blank=True)
    edited_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Dak'
        verbose_name_plural = 'Daks'
        ordering = ['type']

    def __str__(self):
        return f"{self.get_type_display()} ({self.hours} hours)"


class SubjectGroup(models.Model):
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name='subject_groups',
    )
    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name='subject_groups',
    )
    edited_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('subject', 'group')

    def __str__(self):
        return f"{self.subject.name} - {self.group.name}"
