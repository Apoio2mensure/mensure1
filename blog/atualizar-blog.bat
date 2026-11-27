@echo off
cd /d "%~dp0"
python aplicar-cabecalho.py || py aplicar-cabecalho.py
python gerar-indice.py || py gerar-indice.py
echo.
pause
