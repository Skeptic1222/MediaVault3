@echo off
REM MediaVault - Start Server
REM This script starts the MediaVault server in production mode

title MediaVault Server
cd /d "%~dp0"

echo ========================================
echo       MediaVault Server Starting
echo ========================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed or not in PATH
    pause
    exit /b 1
)

REM Check if dist folder exists
if not exist "dist\index-production.js" (
    echo ERROR: Server not built. Run build.bat first.
    pause
    exit /b 1
)

REM Check if client is built
if not exist "dist\public\index.html" (
    echo WARNING: Client not built. Run build.bat first.
    pause
)

REM Load environment variables from .env
if exist ".env" (
    echo Loading environment variables...
    for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
        set "line=%%a"
        REM Skip comments and empty lines
        if not "!line:~0,1!"=="#" if not "%%a"=="" set "%%a=%%b"
    )
)

REM Set required environment variables
set NODE_ENV=production

echo Starting MediaVault server...
echo Server will run on http://localhost:3000
echo Press Ctrl+C to stop the server
echo.

node dist\index-production.js
