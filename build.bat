@echo off
REM ============================================================
REM  OpenVSP Agent - one-click Windows build
REM  Double-click this file to build the app and create a
REM  Desktop shortcut. Works from any folder.
REM ============================================================
setlocal
cd /d "%~dp0"

echo.
echo ===== OpenVSP Agent: build =====
echo.

REM Install dependencies if needed
if not exist "node_modules\" (
  echo [1/2] Installing dependencies ^(first run^)...
  call npm install
  if errorlevel 1 goto :error
) else (
  echo [1/2] Dependencies already installed.
)

echo.
echo [2/2] Building Windows app...
call npm run build:win
if errorlevel 1 goto :error

echo.
echo ============================================================
echo  DONE! A shortcut "OpenVSP Agent" was placed on your Desktop.
echo ============================================================
echo.
pause
exit /b 0

:error
echo.
echo ============================================================
echo  BUILD FAILED. Scroll up to see the error.
echo ============================================================
echo.
pause
exit /b 1
