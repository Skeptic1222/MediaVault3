@echo off
REM MediaVault - Stop Server
REM This script stops all MediaVault server processes

title MediaVault - Stop Server
cd /d "%~dp0"

echo ========================================
echo       MediaVault Server Stopping
echo ========================================
echo.

echo Searching for MediaVault processes on port 3000...
echo.

REM Find and kill processes on port 3000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :3000') do (
    echo Found process with PID: %%a
    taskkill /PID %%a /F 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo Successfully stopped process %%a
    ) else (
        echo Failed to stop process %%a or already stopped
    )
)

echo.
echo All MediaVault processes stopped.
echo.
pause
