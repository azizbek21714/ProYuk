from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ('teachers', '0004_link_missing_signup_profiles'),
    ]

    operations = [
        migrations.AlterField(
            model_name='teacher',
            name='rate',
            field=models.CharField(
                choices=[
                    ('rate_1_5', '1.5 stavka'),
                    ('rate_1', '1 stavka'),
                    ('rate_0_5_ichki', '0.5 ichki stavka'),
                    ('rate_0_5_tashqi', '0.5 stavka tashqi'),
                    ('rate_0_25', '0.25 stavka'),
                ],
                default='rate_1',
                max_length=50,
            ),
        ),
    ]
