@echo off
cd /d "%~dp0"
python gerar-indice.py || py gerar-indice.py
echo.
pause
