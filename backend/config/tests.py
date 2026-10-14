from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient

from apps.academics.models import Subject
from apps.departments.models import OTM, Faculty, Department
from apps.teachers.models import Teacher
from apps.workload.models import Reja, DlMdBiriktirma, WorkloadType, WorkloadNorm
from apps.workload.importer import import_rows_to_yuklama
from apps.workload.norms import POSITION_NORM_DEFAULTS, scaled_position_norm


class IntegrationRegressionTests(TestCase):
    def test_position_workload_norm_policy(self):
        self.assertEqual(POSITION_NORM_DEFAULTS, {
            'teacher': (750, 800),
            'assistant': (800, 850),
            'senior_teacher': (750, 800),
            'associate_professor': (700, 750),
            'professor': (650, 700),
        })

    def test_position_norm_is_scaled_by_teacher_rate(self):
        self.assertEqual(scaled_position_norm(800, 850, 'rate_0_5_ichki'), (400, 425))
        self.assertEqual(scaled_position_norm(800, 850, 'rate_0_5_tashqi'), (400, 425))
        self.assertEqual(scaled_position_norm(800, 850, 'rate_1_5'), (1200, 1275))
        self.assertEqual(scaled_position_norm(800, 850, 'rate_0_25'), (200, 212.5))

    def test_teacher_can_update_only_own_draft_lesson_type(self):
        from apps.workload.models import Assignment
        teacher = Teacher.objects.create(user=self.user, full_name='Teacher', email=self.user.email)
        plan = Reja.objects.create(teacher=teacher, oquv_yili='2026-2027')
        subject = Subject.objects.create(name='Algebra')
        task = Assignment.objects.create(reja=plan, subject=subject, hours=30,
                                         workload_type=WorkloadType.objects.first())
        self.client.force_authenticate(self.user)
        url = '/api/teacher/dashboard/'
        payload = {'id': task.pk, 'mashgulotTuri': 'laboratoriya'}
        self.assertEqual(self.client.patch(url, payload, format='json').status_code, 200)
        task.refresh_from_db()
        self.assertEqual(task.lesson_type, 'laboratoriya')
        dashboard = self.client.get(url).data
        self.assertEqual(dashboard['topshiriqlar'][0]['mashgulotTuri'], 'laboratoriya')
        for lesson_type in ('maruza_amaliyot', 'maruza_laboratoriya', 'amaliyot_laboratoriya',
                            'maruza_amaliyot_laboratoriya', ''):
            payload['mashgulotTuri'] = lesson_type
            self.assertEqual(self.client.patch(url, payload, format='json').status_code, 200)
            task.refresh_from_db()
            self.assertEqual(task.lesson_type, lesson_type)
            self.assertEqual(self.client.get(url).data['topshiriqlar'][0]['mashgulotTuri'], lesson_type)
        other = User.objects.create_user('other-lesson', email='other-lesson@example.test')
        self.client.force_authenticate(other)
        self.assertEqual(self.client.patch(url, payload, format='json').status_code, 404)
        self.client.force_authenticate(self.user)
        plan.status = 'tasdiqlangan'
        plan.save()
        self.assertEqual(self.client.patch(url, payload, format='json').status_code, 403)

    def test_teacher_personal_plan_update_preserves_admin_workload(self):
        teacher = Teacher.objects.create(user=self.user, full_name='Teacher', email=self.user.email)
        original_data = {
            'stavka': 'rate_1',
            'variants': {
                'rate_1': {
                    'fanlar': [{'id': '7', 'nomi': 'Algebra', 'soat': 72}],
                    'doc': {'adminMeta': 'keep', 'oquvIshlari': [{'id': 'admin-row', 'jami': '72'}]},
                },
            },
        }
        plan = Reja.objects.create(teacher=teacher, oquv_yili='2026-2027', data=original_data)
        self.client.force_authenticate(self.user)
        payload = {
            'action': 'save_personal_plan', 'rejaId': plan.pk, 'activeStavka': 'rate_1',
            'variants': {'rate_1': {
                'uslubiy': [{'id': 'u1', 'nomi': 'Qo\'llanma'}], 'ilmiy': [],
                'ustozShogird': [], 'reyting': {'reja_uslubiy': '10'}, 'dekan': 'Test Dekan',
                'oquvIshlari': [{'id': 'teacher-change', 'jami': '0'}],
            }},
        }
        response = self.client.patch('/api/teacher/dashboard/', payload, format='json')
        self.assertEqual(response.status_code, 200)
        plan.refresh_from_db()
        variant = plan.data['variants']['rate_1']
        self.assertEqual(variant['fanlar'], original_data['variants']['rate_1']['fanlar'])
        self.assertEqual(variant['doc']['adminMeta'], 'keep')
        self.assertEqual(variant['doc']['oquvIshlari'][0]['id'], 'admin-row')
        self.assertEqual(variant['doc']['uslubiy'][0]['nomi'], 'Qo\'llanma')
        self.assertEqual(variant['doc']['dekan'], 'Test Dekan')
        detail = self.client.get(f'/api/teacher/dashboard/?document=1&rejaId={plan.pk}')
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(str(detail.data['id']), str(plan.pk))
        other = User.objects.create_user('other-plan', email='other-plan@example.test')
        self.client.force_authenticate(other)
        self.assertEqual(self.client.get(f'/api/teacher/dashboard/?document=1&rejaId={plan.pk}').status_code, 404)

    def test_quarter_rate_teacher_gets_and_updates_quarter_plan(self):
        teacher = Teacher.objects.create(
            user=self.user, full_name='Quarter Teacher', email=self.user.email,
            rate='rate_0_25',
        )
        plan = Reja.objects.create(
            teacher=teacher, oquv_yili='2026-2027',
            data={'variants': {'rate_0_25': {'fanlar': [], 'doc': {}}}},
        )
        self.client.force_authenticate(self.user)

        dashboard = self.client.get('/api/teacher/dashboard/').data
        self.assertEqual(dashboard['oqituvchi']['stavka'], 0.25)
        self.assertEqual(dashboard['oqituvchi']['stavkaKodi'], 'rate_0_25')
        self.assertIn('rate_0_25', dashboard['reja']['shaxsiyReja']['variants'])

        response = self.client.patch('/api/teacher/dashboard/', {
            'action': 'save_personal_plan', 'rejaId': plan.pk,
            'activeStavka': 'rate_0_25',
            'variants': {'rate_0_25': {
                'uslubiy': [], 'ilmiy': [], 'ustozShogird': [], 'reyting': {},
            }},
        }, format='json')
        self.assertEqual(response.status_code, 200)

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user('teacher-test', email='teacher@example.test', password='Test-Access-7392!')

    def test_login_returns_teacher_role(self):
        response = self.client.post('/api/auth/login', {'email': '  TEACHER@example.test  ', 'password': 'Test-Access-7392!'})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['user']['role'], 'oqituvchi')

    def test_public_signup_cannot_assign_admin_role(self):
        response = self.client.post('/api/auth/signup', {'email': 'new-user@example.test', 'password': 'New-Access-8346!', 'role': 'admin'})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data['user']['role'], 'oqituvchi')
        self.assertFalse(User.objects.get(email='new-user@example.test').is_staff)

    def test_signup_persists_account_and_email_login_works(self):
        response = self.client.post('/api/auth/signup', {
            'email': '  NEW@example.test ', 'password': 'New-Access-8346!',
            'first_name': 'Test', 'last_name': 'Person',
        })
        self.assertEqual(response.status_code, 201)
        account = User.objects.get(email='new@example.test')
        self.assertEqual(account.first_name, 'Test')
        self.assertEqual(account.last_name, 'Person')
        self.assertNotEqual(account.password, 'New-Access-8346!')
        self.assertTrue(account.check_password('New-Access-8346!'))
        teacher = Teacher.objects.get(user=account)
        self.assertEqual(teacher.full_name, 'Test Person')
        self.assertEqual(teacher.email, 'new@example.test')
        self.client.force_authenticate(account)
        dashboard = self.client.get('/api/teacher/dashboard/')
        self.assertEqual(dashboard.status_code, 200)
        self.assertEqual(dashboard.data['oqituvchi']['id'], str(teacher.pk))
        self.assertIsNone(dashboard.data['reja'])
        self.client.force_authenticate(None)
        login = self.client.post('/api/auth/login', {'email': account.email, 'password': 'New-Access-8346!'})
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.data['user']['id'], account.pk)

    def test_signup_rejects_duplicate_email_ignoring_case(self):
        response = self.client.post('/api/auth/signup', {'email': 'TEACHER@example.test', 'password': 'New-Access-8346!'})
        self.assertEqual(response.status_code, 400)
        self.assertIn('email', response.data)
        self.assertEqual(User.objects.count(), 1)

    def test_signup_links_precreated_teacher_profile(self):
        teacher = Teacher.objects.create(full_name='Pending Teacher', email='pending@example.test')
        response = self.client.post('/api/auth/signup', {
            'email': 'pending@example.test', 'password': 'New-Access-8346!',
        })
        self.assertEqual(response.status_code, 201)
        teacher.refresh_from_db()
        self.assertEqual(teacher.user.email, 'pending@example.test')

    def test_signup_rejects_invalid_or_missing_email(self):
        for email in ['', 'invalid', None]:
            response = self.client.post('/api/auth/signup', {'email': email, 'password': 'New-Access-8346!'}, format='json')
            self.assertEqual(response.status_code, 400)
        self.assertEqual(User.objects.count(), 1)

    def test_login_rejects_username_wrong_password_and_inactive_account(self):
        response = self.client.post('/api/auth/login', {'username': self.user.username, 'password': 'Test-Access-7392!'})
        self.assertEqual(response.status_code, 400)
        for email in [self.user.email, 'missing@example.test']:
            response = self.client.post('/api/auth/login', {'email': email, 'password': 'Wrong-Access-8351!'})
            self.assertEqual(response.status_code, 401)
        self.user.is_active = False
        self.user.save(update_fields=['is_active'])
        response = self.client.post('/api/auth/login', {'email': self.user.email, 'password': 'Test-Access-7392!'})
        self.assertEqual(response.status_code, 401)

    def test_signin_alias_accepts_email(self):
        response = self.client.post('/api/auth/signin', {'email': self.user.email, 'password': 'Test-Access-7392!'})
        self.assertEqual(response.status_code, 200)

    def test_database_rejects_duplicate_email_ignoring_case(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            User.objects.create_superuser(
                'duplicate-email-admin', email=self.user.email.upper(),
                password='Admin-Access-6728!',
            )

    def test_password_reset_requires_admin(self):
        payload = {'username': self.user.username, 'new_password': 'Changed-Access-3259!'}
        self.assertEqual(self.client.post('/api/auth/reset-password', payload).status_code, 401)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.post('/api/auth/reset-password', payload).status_code, 403)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Test-Access-7392!'))

    def test_admin_can_reset_password_and_weak_password_is_rejected(self):
        admin = User.objects.create_superuser(
            'admin-test', email='admin@example.test', password='Admin-Access-6728!',
        )
        self.client.force_authenticate(admin)
        self.assertEqual(self.client.post('/api/auth/reset-password', {'username': self.user.username, 'new_password': '123'}).status_code, 400)
        response = self.client.post('/api/auth/reset-password', {'username': self.user.username, 'new_password': 'Changed-Access-3259!'})
        self.assertEqual(response.status_code, 200)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password('Changed-Access-3259!'))

    def test_empty_teacher_dashboard_is_null_not_empty_object(self):
        self.client.force_authenticate(self.user)
        response = self.client.get('/api/teacher/dashboard/')
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data['oqituvchi'])
        self.assertIsNone(response.data['reja'])

    def test_teacher_dashboard_uses_own_assignments_and_current_year(self):
        teacher = Teacher.objects.create(full_name='Test Teacher', email=self.user.email, user=self.user)
        other = Teacher.objects.create(full_name='Other Teacher', email='other@example.test')
        otm = OTM.objects.create(name='Test OTM')
        faculty = Faculty.objects.create(name='Test Faculty', otm=otm)
        department = Department.objects.create(name='Test Department', faculty=faculty)
        reja = Reja.objects.create(teacher=teacher, department=department, oquv_yili='2026-2027', data={
            'variants': {'rate_1': {'fanlar': [{'id': '1', 'nomi': 'Algebra', 'soat': 60, 'semestr': 'kuzgi'}]},
                         'rate_0_5': {'fanlar': [{'id': '2', 'nomi': 'Analysis', 'soat': 30, 'semestr': 'bahorgi'}]}},
            'kuzgi': [{'fan_nomi': 'Entire department', 'maruza_jami': 900}],
        })
        for year, hours in [('2026-2027', 25), ('2025-2026', 50)]:
            DlMdBiriktirma.objects.create(teacher=teacher, department=department, oquv_yili=year, jami_soat=hours)
        DlMdBiriktirma.objects.create(
            teacher=teacher, department=department, oquv_yili='',
            semestr='bahorgi', jami_soat=40,
        )
        self.client.force_authenticate(self.user)
        response = self.client.get('/api/teacher/dashboard/', {'profileId': other.pk})
        self.assertEqual(response.data['oqituvchi']['id'], str(teacher.pk))
        self.assertEqual(response.data['reja']['jamiSoat'], 155)
        self.assertEqual(len(response.data['reja']['topshiriqlar']), 4)
        self.assertEqual(response.data['reja']['topshiriqlar'][1]['semesterRaqami'], 2)
        self.assertEqual(self.client.get('/api/dashboard/stats/').status_code, 403)
        admin = User.objects.create_superuser(
            'stats-admin', 'stats-admin@example.test', 'Admin-Access-6728!',
        )
        self.client.force_authenticate(admin)
        stats = self.client.get('/api/dashboard/stats/').data['barChartData']
        self.assertEqual(next(row['jamiSoat'] for row in stats if row['id'] == str(reja.pk)), 155)

    def test_admin_workload_hour_edit_updates_assignments_and_dashboard(self):
        admin = User.objects.create_superuser(
            'workload-admin', 'workload-admin@example.test', 'Admin-Access-6728!',
        )
        teacher = Teacher.objects.create(full_name='Editable Teacher')
        subject = Subject.objects.create(name='Editable Subject')
        reja = Reja.objects.create(teacher=teacher, oquv_yili='2026-2027')
        self.client.force_authenticate(admin)

        response = self.client.patch(f'/api/crud/rejalar/{reja.pk}/', {
            'data': {
                'variants': {
                    'rate_1': {
                        'fanlar': [{
                            'id': str(subject.pk), 'nomi': subject.name,
                            'soat': 140, 'semestr': 'kuzgi',
                        }],
                        'doc': {'oquvIshlari': []},
                    },
                },
            },
        }, format='json')

        self.assertEqual(response.status_code, 200)
        reja.refresh_from_db()
        self.assertEqual(reja.jami_soat, 140)
        self.assertEqual(float(reja.assignments.get().hours), 140)
        stats = self.client.get('/api/dashboard/stats/').data['barChartData']
        self.assertEqual(next(row['jamiSoat'] for row in stats if row['id'] == str(reja.pk)), 140)

    def test_split_lesson_assignments_keep_subject_type_and_group(self):
        admin = User.objects.create_superuser(
            'split-workload-admin', 'split-workload-admin@example.test', 'Admin-Access-6728!',
        )
        teacher = Teacher.objects.create(full_name='Split Workload Teacher')
        subject = Subject.objects.create(name='Computer Vision')
        reja = Reja.objects.create(teacher=teacher, oquv_yili='2026-2027')
        self.client.force_authenticate(admin)

        fanlar = [{
            'id': f'lesson:{subject.pk}:kuzgi:1:maruza',
            'subjectId': str(subject.pk),
            'lessonType': 'maruza',
            'nomi': "Ma'ruza: Computer Vision",
            'soat': 42,
            'semestr': 'kuzgi',
        }]
        for group_index in range(1, 4):
            fanlar.append({
                'id': f'lesson:{subject.pk}:kuzgi:1:amaliyot:{group_index}',
                'subjectId': str(subject.pk),
                'lessonType': 'amaliyot',
                'groupIndex': group_index,
                'groupCount': 3,
                'nomi': 'Amaliyot: Computer Vision',
                'soat': 30,
                'semestr': 'kuzgi',
            })

        response = self.client.patch(f'/api/crud/rejalar/{reja.pk}/', {
            'data': {'variants': {'rate_1': {'fanlar': fanlar, 'doc': {}}}},
        }, format='json')

        self.assertEqual(response.status_code, 200)
        reja.refresh_from_db()
        assignments = list(reja.assignments.order_by('id'))
        self.assertEqual(reja.jami_soat, 132)
        self.assertEqual(len(assignments), 4)
        self.assertTrue(all(item.subject_id == subject.pk for item in assignments))
        self.assertEqual([item.lesson_type for item in assignments], [
            'maruza', 'amaliyot', 'amaliyot', 'amaliyot',
        ])
        self.assertEqual([item.formula_input['groupIndex'] for item in assignments[1:]], [1, 2, 3])

    def test_synthetic_lesson_key_without_subject_id_does_not_break_save(self):
        admin = User.objects.create_superuser(
            'synthetic-workload-admin', 'synthetic-workload-admin@example.test', 'Admin-Access-6728!',
        )
        teacher = Teacher.objects.create(full_name='Synthetic Workload Teacher')
        reja = Reja.objects.create(teacher=teacher, oquv_yili='2026-2027')
        self.client.force_authenticate(admin)

        response = self.client.patch(f'/api/crud/rejalar/{reja.pk}/', {
            'data': {'variants': {'rate_1': {'fanlar': [{
                'id': 'lesson:kuzgi-28:kuzgi:28:amaliyot',
                'workloadKind': 'amaliyot',
                'studentCount': 5,
                'hourPerStudent': 50,
                'nomi': 'Amaliyot: Ilmiy pedagogik ish',
                'soat': 250,
                'semestr': 'kuzgi',
            }], 'doc': {}}}},
        }, format='json')

        self.assertEqual(response.status_code, 200)
        assignment = reja.assignments.get()
        self.assertIsNone(assignment.subject_id)
        self.assertEqual(assignment.note, 'Amaliyot: Ilmiy pedagogik ish')
        self.assertEqual(float(assignment.hours), 250)
        self.assertEqual(assignment.formula_input['studentCount'], 5)
        self.assertEqual(assignment.formula_input['hourPerStudent'], 50)

    def test_saved_work_plan_rows_override_stale_assignments_in_all_totals(self):
        admin = User.objects.create_superuser(
            'consistent-admin', 'consistent-admin@example.test', 'Admin-Access-6728!',
        )
        teacher_user = User.objects.create_user('consistent-teacher')
        teacher = Teacher.objects.create(full_name='Abidova Test', user=teacher_user)
        otm = OTM.objects.create(name='Consistent OTM')
        faculty = Faculty.objects.create(name='Consistent Faculty', otm=otm)
        department = Department.objects.create(name='Consistent Department', faculty=faculty)
        reja = Reja.objects.create(teacher=teacher, department=department, oquv_yili='2026-2027', data={
            'variants': {
                'rate_1': {
                    'fanlar': [{'id': '1', 'nomi': 'Old workload', 'soat': 434}],
                    'doc': {'oquvIshlari': [
                        {'id': 'current-1', 'nomi': 'Current workload', 'jami': '398'},
                        {'id': 'dlmd-1', 'nomi': 'DL/MD', 'jami': '346'},
                    ]},
                },
            },
        })
        DlMdBiriktirma.objects.create(
            teacher=teacher, department=department, oquv_yili='', jami_soat=346,
        )

        self.client.force_authenticate(admin)
        stats = self.client.get('/api/dashboard/stats/').data['barChartData']
        self.assertEqual(next(row['jamiSoat'] for row in stats if row['id'] == str(reja.pk)), 744)

        self.client.force_authenticate(teacher_user)
        dashboard = self.client.get('/api/teacher/dashboard/').data
        self.assertEqual(dashboard['reja']['jamiSoat'], 744)

    def test_half_rate_assistant_dashboard_uses_half_norm(self):
        teacher = Teacher.objects.create(
            full_name='Half Rate Assistant', email=self.user.email, user=self.user,
            position='assistant', rate='rate_0_5_ichki',
        )
        reja = Reja.objects.create(teacher=teacher, oquv_yili='2026-2027')
        self.client.force_authenticate(self.user)
        dashboard = self.client.get('/api/teacher/dashboard/').data
        self.assertEqual(dashboard['reja']['minNorm'], 400)
        self.assertEqual(dashboard['reja']['maxNorm'], 425)

        admin = User.objects.create_superuser(
            'half-rate-admin', 'half-rate-admin@example.test', 'Admin-Access-6728!',
        )
        self.client.force_authenticate(admin)
        stats = self.client.get('/api/dashboard/stats/').data['barChartData']
        row = next(item for item in stats if item['id'] == str(reja.pk))
        self.assertEqual(row['minNorm'], 400)
        self.assertEqual(row['maxNorm'], 425)

    def test_full_list_and_explicit_pagination(self):
        Subject.objects.bulk_create([Subject(name=f'Subject {index}') for index in range(25)])
        self.client.force_authenticate(self.user)
        response = self.client.get('/api/crud/fanlar/')
        self.assertEqual(len(response.data), 25)
        page = self.client.get('/api/crud/fanlar/?page=1')
        self.assertEqual(page.data['count'], 25)
        self.assertEqual(len(page.data['results']), 20)
        self.assertIsNotNone(page.data['next'])

    def test_crud_requires_login_and_admin_for_mutations(self):
        self.assertEqual(self.client.get('/api/crud/fanlar/').status_code, 401)
        self.client.force_authenticate(self.user)
        self.assertEqual(self.client.get('/api/crud/fanlar/').status_code, 200)
        self.assertEqual(self.client.post('/api/crud/fanlar/', {'name': 'Blocked'}).status_code, 403)
        admin = User.objects.create_superuser(
            'crud-admin', 'crud-admin@example.test', 'Admin-Access-6728!',
        )
        self.client.force_authenticate(admin)
        self.assertEqual(self.client.post('/api/crud/fanlar/', {'name': 'Allowed'}).status_code, 201)

    def test_normativ_is_persisted_and_overlap_requires_force(self):
        admin = User.objects.create_superuser(
            'norm-admin', 'norm-admin@example.test', 'Admin-Access-6728!',
        )
        self.client.force_authenticate(admin)
        workload_type = WorkloadType.objects.first()
        payload = {
            'yuklamaTuriId': workload_type.pk, 'otmProfil': 'barcha',
            'koeffitsient': '1.000', 'limitMin': 700, 'limitMax': 780,
            'amalBoshi': '2026-09-01', 'amalOxiri': None,
        }
        self.assertEqual(self.client.post('/api/crud/normativlar/', payload, format='json').status_code, 201)
        overlap = self.client.post('/api/crud/normativlar/', {**payload, 'amalBoshi': '2027-01-01'}, format='json')
        self.assertTrue(overlap.data['overlap'])
        self.assertEqual(WorkloadNorm.objects.count(), 1)
        forced = self.client.post(
            '/api/crud/normativlar/', {**payload, 'amalBoshi': '2027-01-01', 'force': True}, format='json',
        )
        self.assertEqual(forced.status_code, 201)
        self.assertEqual(WorkloadNorm.objects.count(), 2)

    def test_workload_import_replaces_department_rows(self):
        otm = OTM.objects.create(name='Import OTM')
        faculty = Faculty.objects.create(name='Import Faculty', otm=otm)
        department = Department.objects.create(name='Import Department', faculty=faculty)
        parsed = {
            'kuzgi': [{'fan_nomi': 'Algebra', 'semestr': 1, 'maruza_reja': 30}],
            'bahorgi': [{'fan_nomi': 'Algebra', 'semestr': 2, 'amaliy_reja': 20}],
        }
        import_rows_to_yuklama(parsed, department)
        import_rows_to_yuklama(parsed, department)
        self.assertEqual(department.yuklamalar.count(), 2)
        self.assertEqual(Subject.objects.filter(department=department).count(), 1)
