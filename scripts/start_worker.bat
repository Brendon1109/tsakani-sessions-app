@echo off
REM Tsakani Sessions Video Worker — double-click to start
REM Processes queued video merge jobs from the admin panel.

cd /d "%~dp0"

echo ========================================
echo  Tsakani Sessions Video Worker
echo ========================================
echo.

REM Check Python
where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python not found. Install from https://python.org
  pause
  exit /b 1
)

REM Check FFmpeg
where ffmpeg >nul 2>&1
if errorlevel 1 (
  echo [WARNING] FFmpeg not found in PATH.
  echo Install from: https://ffmpeg.org/download.html
  echo or: winget install Gyan.FFmpeg
  echo.
)

REM Install deps on first run
if not exist ".deps_installed" (
  echo [INFO] First run — installing Python dependencies...
  python -m pip install -r requirements.txt
  if errorlevel 1 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
  )
  type nul > .deps_installed
)

REM Check for .env file
if not exist ".env" (
  echo [SETUP] Creating .env file — edit it before rerunning.
  (
    echo SITE_URL=https://tsakani-sessions-app.vercel.app
    echo WORKER_SECRET=your_worker_secret_here
    echo FOOTAGE_DIR=C:\Tsakani Footage
    echo POLL_INTERVAL=30
  ) > .env
  echo.
  echo [ACTION REQUIRED] Open scripts\.env in Notepad and set:
  echo   WORKER_SECRET ^(get from Brendon^)
  echo   FOOTAGE_DIR ^(path to your event footage folder^)
  echo.
  notepad .env
  pause
  exit /b 0
)

echo [INFO] Starting worker — Ctrl+C to stop
echo.
python video_worker.py
pause
