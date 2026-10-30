@echo off
title DataLab
cd /d "%~dp0"

REM 1. Try Python
python --version >nul 2>&1
if not errorlevel 1 (
    python server.py
    goto :eof
)

REM 2. Try py launcher
py -3 --version >nul 2>&1
if not errorlevel 1 (
    py -3 server.py
    goto :eof
)

REM 3. Try Node.js
node --version >nul 2>&1
if not errorlevel 1 (
    node server.js
    goto :eof
)

echo.
echo ========================================================
echo  [ERROR] Neither Python nor Node.js was found in PATH.
echo  Please install Python from https://www.python.org
echo ========================================================
echo.
pause
