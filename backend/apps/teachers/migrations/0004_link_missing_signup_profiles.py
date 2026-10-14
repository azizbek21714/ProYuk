from django.db import migrations


def repair_profiles(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    Teacher = apps.get_model('teachers', 'Teacher')
    alias = schema_editor.connection.alias
    for user in User.objects.using(alias).filter(is_superuser=False, is_staff=False).exclude(email=''):
        if Teacher.objects.using(alias).filter(user_id=user.pk).exists():
            continue
        email = user.email.strip().lower()
        teacher = Teacher.objects.using(alias).filter(email__iexact=email).first()
        if teacher:
            if teacher.user_id is None:
                teacher.user_id = user.pk
                teacher.save(using=alias, update_fields=['user'])
        else:
            Teacher.objects.using(alias).create(
                user_id=user.pk, email=email,
                full_name=f'{user.first_name} {user.last_name}'.strip() or email,
            )


class Migration(migrations.Migration):
    dependencies = [('teachers', '0003_teacher_user_teacher_teachers_unique_email_ci')]
    operations = [migrations.RunPython(repair_profiles, migrations.RunPython.noop)]
