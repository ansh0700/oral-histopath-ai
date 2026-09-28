@echo off
title Oral Histopathology AI Analyzer Launcher
echo ====================================================================
echo      Starting Oral Histopathology AI Analyzer (OPMD / OSCC)
echo ====================================================================
echo.

set SCRIPT_DIR=%~dp0
set "PATH=%ProgramFiles%\Python312;%ProgramFiles%\Python312\Scripts;%LocalAppData%\Programs\Python\Python312;%LocalAppData%\Programs\Python\Python312\Scripts;%ProgramFiles%\nodejs;%PATH%"

:: 1. Auto-Detect Python
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

:: If Python is missing, run setup.bat automatically
if "%PYTHON_EXE%"=="" (
    echo [INFO] Python setup required. Launching setup.bat...
    call "%SCRIPT_DIR%setup.bat"
    if exist "%ProgramFiles%\Python312\python.exe" set PYTHON_EXE="%ProgramFiles%\Python312\python.exe"
    if "%PYTHON_EXE%"=="" set PYTHON_EXE=python
)

:: 2. Self-Healing Check: Verify Backend Python Dependencies
echo [CHECK] Verifying Python backend dependencies...
%PYTHON_EXE% -c "import uvicorn, fastapi, PIL, cv2, numpy" >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [AUTO-REPAIR] Missing Python packages detected. Installing backend dependencies...
    cd /d "%SCRIPT_DIR%backend"
    %PYTHON_EXE% -m pip install --upgrade pip
    %PYTHON_EXE% -m pip install -r requirements.txt
)

:: 3. Auto-Detect NPM
set NPM_CMD=

where npm >nul 2>nul
if %ERRORLEVEL% EQU 0 set NPM_CMD=npm

if "%NPM_CMD%"=="" (
    if exist "%ProgramFiles%\nodejs\npm.cmd" set NPM_CMD="%ProgramFiles%\nodejs\npm.cmd"
)

if "%NPM_CMD%"=="" (
    if exist "%ProgramFiles(x86)%\nodejs\npm.cmd" set NPM_CMD="%ProgramFiles(x86)%\nodejs\npm.cmd"
)

:: Self-Healing Check: If frontend node_modules is missing, install frontend dependencies
if not "%NPM_CMD%"=="" (
    if not exist "%SCRIPT_DIR%frontend\node_modules" (
        echo [AUTO-REPAIR] Installing frontend dependencies...
        cd /d "%SCRIPT_DIR%frontend"
        call %NPM_CMD% install
    )
)

:: 4. Start Backend Server with Auto-Restart Protection
echo.
echo [1/2] Starting Backend Server on http://127.0.0.1:8000 ...
cd /d "%SCRIPT_DIR%backend"
start "Backend Server (FastAPI :8000)" cmd /k ":loop & %PYTHON_EXE% -m uvicorn app.main:app --host 127.0.0.1 --port 8000 || (echo. & echo Backend stopped. Restarting in 3 seconds... & timeout /t 3 & goto loop)"

:: 5. Start Frontend Dev Server if NPM available
if not "%NPM_CMD%"=="" (
    echo [2/2] Starting Frontend Vite Dev Server on http://127.0.0.1:5173 ...
    cd /d "%SCRIPT_DIR%frontend"
    start "Frontend Server (Vite :5173)" cmd /k "%NPM_CMD% run dev -- --host 127.0.0.1 --port 5173"
)

echo.
echo Launching application in your browser...
timeout /t 5 >nul
start http://127.0.0.1:5173

echo.
echo ====================================================================
echo Application is running at http://127.0.0.1:5173
echo Direct Backup URL: http://127.0.0.1:8000
echo Keep these terminal windows open while using the application.
echo ====================================================================
pause
