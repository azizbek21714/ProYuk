from django.db import migrations


POSITION_NORMS = {
    'teacher': (750, 800),
    'assistant': (800, 850),
    'senior_teacher': (750, 800),
    'associate_professor': (700, 750),
    'professor': (650, 700),
}


def sync_position_norms(apps, schema_editor):
    AcademicYear = apps.get_model('workload', 'AcademicYear')
    PositionNorm = apps.get_model('workload', 'PositionNorm')
    for academic_year in AcademicYear.objects.all():
        for position, (minimum, maximum) in POSITION_NORMS.items():
            PositionNorm.objects.update_or_create(
                academic_year=academic_year,
                position=position,
                defaults={
                    'minimum_hours': minimum,
                    'maximum_hours': maximum,
                },
            )


class Migration(migrations.Migration):
    dependencies = [('workload', '0011_alter_assignment_lesson_type')]
    operations = [migrations.RunPython(sync_position_norms, migrations.RunPython.noop)]
