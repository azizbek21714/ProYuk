# ProYuk: lokal ishga tushirish

Backend: Django, `http://127.0.0.1:8000`. Frontend: Next.js, `http://localhost:3000`.

## Backend (PowerShell)

```powershell
cd D:\Desctop\Yuk_backend
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe manage.py migrate
.\venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
```

Yoki `start_server.bat` faylini oching. `.env` bo'lmasa lokal `db.sqlite3` ishlatiladi.
Mavjud bazani almashtirmang. Yangi o'rnatishda administrator yaratish uchun
`manage.py createsuperuser` buyrug'idan foydalaning.

## Frontend (alohida PowerShell)

```powershell
cd D:\Desctop\Yuk_frontend
npm.cmd install
npm.cmd run dev
```

Production build: `npm.cmd run build`, keyin `npm.cmd start`.
3000-port band bo'lsa, avval shu loyihaning ishlayotgan frontendini tekshiring.
Backend manzili frontend serverining `DJANGO_API_URL` muhit o'zgaruvchisi orqali
sozlanadi; standart qiymat `http://127.0.0.1:8000`.

## Tekshirish

```powershell
# Backend papkasida; testlar alohida vaqtinchalik bazadan foydalanadi.
.\venv\Scripts\python.exe manage.py check
.\venv\Scripts\python.exe manage.py test config --noinput

# Frontend papkasida
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run build
```

## Hisoblar va ma'lumotlar

- Kirish elektron pochta va parol orqali amalga oshiriladi. Ro'yxatdan o'tishda
  foydalanuvchi nomi talab qilinmaydi; hisob Django bazasida, parol xeshlangan
  holda saqlanadi. Email bosh/kichik harflardan qat'i nazar tekshiriladi va takrorlanmaydi.
- `is_staff` foydalanuvchilar administrator sifatida kiradi. Boshqa boshqaruv
  rollari Django guruhlari orqali belgilanadi: `kafedra_mudiri`, `dekan`, `oquv_bolimi`.
  Ochiq ro'yxatdan o'tish administrator huquqini bermaydi.
- O'qituvchi kabineti foydalanuvchi emaili bilan `Teacher.email` ni bog'laydi.
  Shaxsiy rejadagi biriktirilgan fanlar va o'sha o'quv yilining DL/MD soatlari ko'rsatiladi.
- Kirish, chiqish va parol almashtirish frontend API orqali HttpOnly cookie bilan ishlaydi.
  Unutilgan parolni administrator tiklaydi; email orqali tiklash hali sozlanmagan.
- CRUD ro'yxatlari odatda to'liq qaytadi. `?page=1` berilganda 20 tadan sahifalanadi.
- Normativlar, topshiriq CRUD va tasdiqlash endpointlaridagi eski bo'sh javoblar
  hali to'liq biznes jarayonini amalga oshirmaydi. Ularni tayyor funksiyalar deb hisoblamang.
