@echo off
title Oral Histopathology AI Analyzer - Installer & Setup
echo ====================================================================
echo      Oral Histopathology AI Analyzer (OPMD / OSCC) Setup
echo ====================================================================
echo.

set SCRIPT_DIR=%~dp0
set INSTALLERS_DIR=%~dp0installers

:: 1. Auto-detect or Auto-Install Python
set PYTHON_EXE=

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 set PYTHON_EXE=python

if "%PYTHON_EXE%"=="" (
    where py >nul 2>nul
    if %ERRORLEVEL% EQU 0 set PYTHON_EXE=py
)

if "%PYTHON_EXE%"=="" (
    if exist "%ProgramFiles%\Python312\python.exe" set PYTHON_EXE="%ProgramFiles%\Python312\python.exe"
)

if "%PYTHON_EXE%"=="" (
    if exist "%LocalAppData%\Programs\Python\Python312\python.exe" set PYTHON_EXE="%LocalAppData%\Programs\Python\Python312\python.exe"
)

if "%PYTHON_EXE%"=="" (
    if exist "%INSTALLERS_DIR%\python-3.12.2-amd64.exe" (
        echo.
        echo [AUTO-INSTALL] Python 3.12 is missing. Installing automatically...
        echo Please wait while Python 3.12 completes installation...
        start /wait "" "%INSTALLERS_DIR%\python-3.12.2-amd64.exe" /passive InstallAllUsers=1 PrependPath=1 Include_pip=1
        if exist "%ProgramFiles%\Python312\python.exe" (
            set PYTHON_EXE="%ProgramFiles%\Python312\python.exe"
        ) else (
            set PYTHON_EXE=python
        )
        echo [OK] Python 3.12 installed successfully!
    ) else (
        echo.
        echo [ERROR] Python is NOT installed on this PC!
        echo Please run 'installers\python-3.12.2-amd64.exe' manually.
        echo.
        pause
        exit /b 1
    )
)

echo [OK] Using Python: %PYTHON_EXE%
echo.

:: 2. Auto-detect or Auto-Install Node.js
set NPM_CMD=

where npm >nul 2>nul
if %ERRORLEVEL% EQU 0 set NPM_CMD=npm

if "%NPM_CMD%"=="" (
    if exist "%ProgramFiles%\nodejs\npm.cmd" set NPM_CMD="%ProgramFiles%\nodejs\npm.cmd"
)

if "%NPM_CMD%"=="" (
    if exist "%ProgramFiles(x86)%\nodejs\npm.cmd" set NPM_CMD="%ProgramFiles(x86)%\nodejs\npm.cmd"
)

if "%NPM_CMD%"=="" (
    if exist "%INSTALLERS_DIR%\node-v20.11.1-x64.msi" (
        echo.
        echo [AUTO-INSTALL] Node.js is missing. Installing automatically...
        echo Please wait while Node.js 20 LTS completes installation...
        start /wait msiexec /i "%INSTALLERS_DIR%\node-v20.11.1-x64.msi" /qb
        if exist "%ProgramFiles%\nodejs\npm.cmd" (
            set NPM_CMD="%ProgramFiles%\nodejs\npm.cmd"
        ) else (
            set NPM_CMD=npm
        )
        echo [OK] Node.js installed successfully!
    ) else (
        echo.
        echo [ERROR] Node.js is NOT installed on this PC!
        echo Please run 'installers\node-v20.11.1-x64.msi' manually.
        echo.
        pause
        exit /b 1
    )
)

echo [OK] Using NPM: %NPM_CMD%
echo.

:: 3. Install Backend Dependencies
echo ====================================================================
echo [1/2] Installing Backend Dependencies (FastAPI, OpenCV, NumPy, etc.)...
echo ====================================================================
cd /d "%SCRIPT_DIR%backend"
%PYTHON_EXE% -m pip install --upgrade pip
%PYTHON_EXE% -m pip install -r requirements.txt

echo.
:: 4. Install Frontend Dependencies
echo ====================================================================
echo [2/2] Installing Frontend Dependencies (React, Vite, Tailwind, etc.)...
echo ====================================================================
cd /d "%SCRIPT_DIR%frontend"
call %NPM_CMD% install

echo.
echo ====================================================================
echo [SUCCESS] Setup Completed Successfully!
echo You can now double-click 'start_app.bat' to launch the application.
echo ====================================================================
pause
