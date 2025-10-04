@echo off
REM Setup PostgreSQL database for MediaVault

echo Creating MediaVault database...
set PGPASSWORD=postgres
"C:\Program Files\PostgreSQL\17\bin\createdb.exe" -U postgres -h localhost mediavault 2>nul

if %ERRORLEVEL% EQU 0 (
    echo Database created successfully!
) else (
    echo Database may already exist or creation failed. Continuing...
)

echo.
echo Database setup complete!
pause
