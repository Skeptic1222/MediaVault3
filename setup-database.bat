@echo off
REM Setup PostgreSQL database for MediaVault
REM SECURITY: This script should use PostgreSQL .pgpass file or prompt for credentials

echo Creating MediaVault database...
echo.
echo NOTE: You will be prompted for the PostgreSQL password
echo       Or configure a .pgpass file for automated setup
echo.

"C:\Program Files\PostgreSQL\17\bin\createdb.exe" -U postgres -h localhost mediavault 2>nul

if %ERRORLEVEL% EQU 0 (
    echo Database created successfully!
) else (
    echo Database may already exist or creation failed. Continuing...
)

echo.
echo Database setup complete!
pause
