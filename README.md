# ProYuk

Oliy ta'lim muassasalarida o'qituvchilar yuklamasini taqsimlash va shaxsiy ish rejasini shakllantirish platformasi.

## Tuzilishi

- `backend/` — Django va Django REST Framework API, migratsiyalar va testlar.
- `frontend/` — Next.js, React va TypeScript interfeysi.

## Lokal ishga tushirish

Python 3.10+ va Node.js 20.9+ kerak. Buyruqlar PowerShell uchun.

Backend uchun birinchi terminalda:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py createsuperuser
.\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Lokal rejimda `.env` bo'lmasa SQLite bazasi yaratiladi. PostgreSQL yoki production uchun `.env.example` asosida `.env` yarating va qiymatlarni o'zingiz sozlang. Productionda yangi maxfiy `SECRET_KEY`, `DEBUG=False`, ma'lumotlar bazasi va ruxsat etilgan hostlarni sozlash shart.

Frontend uchun ikkinchi terminalda:

```powershell
cd frontend
npm ci
npm run dev
```

Brauzer: http://localhost:3000. Backend standart manzili `http://127.0.0.1:8000`; zarur bo'lsa `frontend/.env.example` dagi `DJANGO_API_URL` orqali o'zgartiriladi.

## Tekshirish

```powershell
# backend papkasida
.\venv\Scripts\python.exe manage.py check
.\venv\Scripts\python.exe manage.py test config --noinput
# frontend papkasida
npm run lint
npm run typecheck
npm run build
```

## Ma'lumotlar va imkoniyatlar

XLS/XLSX importi, semestr va ta'lim shakllari bo'yicha yuklama, guruhlar bo'yicha mashg'ulot biriktirish, soatlarni hisoblash va shaxsiy reja saqlash mavjud. Qo'shimcha cheklovlar `backend/README.md` da ko'rsatilgan.

Maxfiy `.env` fayllari, lokal bazalar, foydalanuvchi ma'lumotlari, loglar va DGU hujjatlari repozitoriyga kiritilmagan. Yangi o'rnatishda administrator va kerakli ma'lumotlar alohida yaratiladi.
