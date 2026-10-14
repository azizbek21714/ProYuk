from django.db import models
from django.db.models.functions import Lower


class TeacherPosition(models.TextChoices):
    PROFESSOR = 'professor', 'Professor'
    ASSOCIATE_PROFESSOR = 'associate_professor', 'Associate Professor'
    SENIOR_TEACHER = 'senior_teacher', 'Senior Teacher'
    TEACHER = 'teacher', 'Teacher'
    ASSISTANT = 'assistant', 'Assistant'


class TeacherDegree(models.TextChoices):
    PHD = 'phd', 'PhD'
    DSC = 'dsc', 'DSc'
    MASTER = 'master', 'Master'
    BACHELOR = 'bachelor', 'Bachelor'


class AcademicTitle(models.TextChoices):
    PROFESSOR = 'professor', 'Professor'
    DOCENT = 'docent', 'Docent'
    SENIOR_RESEARCHER = 'senior_researcher', 'Senior Researcher'
    NONE = 'none', 'None'


class Speciality(models.TextChoices):
    ECONOMICS = 'economics', 'Economics'
    MATHEMATICS = 'mathematics', 'Mathematics'
    COMPUTER_SCIENCE = 'computer_science', 'Computer Science'
    ENGINEERING = 'engineering', 'Engineering'
    OTHER = 'other', 'Other'


class TeacherRate(models.TextChoices):
    RATE_1_5 = 'rate_1_5', '1.5 stavka'
    RATE_1 = 'rate_1', '1 stavka'
    RATE_0_5_ICHKI = 'rate_0_5_ichki', '0.5 ichki stavka'
    RATE_0_5_TASHQI = 'rate_0_5_tashqi', '0.5 stavka tashqi'
    RATE_0_25 = 'rate_0_25', '0.25 stavka'


class Teacher(models.Model):
    user = models.OneToOneField(
        'auth.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='teacher_profile',
    )
    full_name = models.CharField(max_length=255)
    position = models.CharField(
        max_length=50,
        choices=TeacherPosition.choices,
        default=TeacherPosition.TEACHER,
    )
    degree = models.CharField(
        max_length=50,
        choices=TeacherDegree.choices,
        default=TeacherDegree.BACHELOR,
    )
    academic_title = models.CharField(
        max_length=50,
        choices=AcademicTitle.choices,
        default=AcademicTitle.NONE,
    )
    speciality = models.CharField(
        max_length=50,
        choices=Speciality.choices,
        default=Speciality.OTHER,
    )
    rate = models.CharField(
        max_length=50,
        choices=TeacherRate.choices,
        default=TeacherRate.RATE_1,
    )
    email = models.EmailField(max_length=255, blank=True)
    phone_number = models.CharField(max_length=50, blank=True)
    edited_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['full_name']
        constraints = [
            models.UniqueConstraint(
                Lower('email'), condition=~models.Q(email=''),
                name='teachers_unique_email_ci',
            ),
        ]

    def __str__(self):
        return f"{self.full_name} ({self.get_position_display()})"


class TeacherSubject(models.Model):
    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE,
        related_name='teacher_subjects',
    )
    subject = models.ForeignKey(
        'academics.Subject',
        on_delete=models.CASCADE,
        related_name='teacher_subjects',
    )
    edited_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('teacher', 'subject')

    def __str__(self):
        return f"{self.teacher.full_name} - {self.subject.name}"


class TeacherGroup(models.Model):
    teacher = models.ForeignKey(
        Teacher,
        on_delete=models.CASCADE,
        related_name='teacher_groups',
    )
    group = models.ForeignKey(
        'academics.Group',
        on_delete=models.CASCADE,
        related_name='teacher_groups',
    )
    edited_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('teacher', 'group')

    def __str__(self):
        return f"{self.teacher.full_name} - {self.group.name}"
