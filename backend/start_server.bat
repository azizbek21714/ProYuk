@echo off
cd /d "%~dp0"
echo Django server ishga tushmoqda... http://127.0.0.1:8000/
venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
pause
