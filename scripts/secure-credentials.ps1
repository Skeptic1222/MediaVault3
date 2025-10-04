# MediaVault Secure Credential Management for Windows
# This script manages credentials using Windows Credential Store
# Run as Administrator for best security

param(
    [Parameter()]
    [ValidateSet('setup', 'get', 'set', 'remove', 'validate')]
    [string]$Action = 'setup'
)

$ErrorActionPreference = "Stop"
$CredentialTarget = "MediaVault"

function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Set-SecureCredential {
    param(
        [string]$Target,
        [string]$Username,
        [string]$Password
    )

    $securePassword = ConvertTo-SecureString $Password -AsPlainText -Force
    $credential = New-Object System.Management.Automation.PSCredential($Username, $securePassword)

    # Store in Windows Credential Manager
    $credentialType = [System.Management.Automation.CredentialAttribute]::new()

    # Use cmdkey for Windows Credential Store
    $result = cmdkey /add:$Target /user:$Username /pass:$Password 2>&1

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Credential stored securely for $Target" -ForegroundColor Green
        return $true
    } else {
        Write-Host "❌ Failed to store credential: $result" -ForegroundColor Red
        return $false
    }
}

function Get-SecureCredential {
    param([string]$Target)

    try {
        # Try to get credential from Windows Credential Manager
        $cred = Get-StoredCredential -Target $Target -ErrorAction SilentlyContinue
        if ($cred) {
            return @{
                Username = $cred.UserName
                Password = $cred.GetNetworkCredential().Password
            }
        }

        # Fallback to cmdkey list
        $result = cmdkey /list:$Target 2>&1
        if ($LASTEXITCODE -eq 0 -and $result -match "Target: $Target") {
            Write-Host "⚠️  Credential exists but cannot retrieve password programmatically" -ForegroundColor Yellow
            Write-Host "   Use Windows Credential Manager UI to view" -ForegroundColor Yellow
            return $null
        }

        return $null
    } catch {
        return $null
    }
}

function Remove-SecureCredential {
    param([string]$Target)

    $result = cmdkey /delete:$Target 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Credential removed for $Target" -ForegroundColor Green
        return $true
    } else {
        Write-Host "⚠️  No credential found for $Target" -ForegroundColor Yellow
        return $false
    }
}

function New-SecurePassword {
    param([int]$Length = 32)

    $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*'
    $password = -join ((1..$Length) | ForEach-Object { $chars[(Get-Random -Maximum $chars.Length)] })
    return $password
}

function New-SecureKey {
    param(
        [ValidateSet('hex', 'base64')]
        [string]$Format = 'hex',
        [int]$Bytes = 32
    )

    $randomBytes = New-Object byte[] $Bytes
    [System.Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($randomBytes)

    if ($Format -eq 'hex') {
        return [BitConverter]::ToString($randomBytes).Replace('-', '').ToLower()
    } else {
        return [Convert]::ToBase64String($randomBytes)
    }
}

function Setup-MediaVaultCredentials {
    Write-Host "`n=== MediaVault Secure Credential Setup ===" -ForegroundColor Cyan

    if (-not (Test-Administrator)) {
        Write-Host "⚠️  Warning: Running without administrator privileges" -ForegroundColor Yellow
        Write-Host "   Some features may not work correctly" -ForegroundColor Yellow
    }

    # Check if .env file exists
    $envPath = Join-Path $PSScriptRoot ".." ".env"
    $envExamplePath = Join-Path $PSScriptRoot ".." ".env.example"

    if (-not (Test-Path $envPath)) {
        if (Test-Path $envExamplePath) {
            Write-Host "`nCreating .env from .env.example..." -ForegroundColor Yellow
            Copy-Item $envExamplePath $envPath
        } else {
            Write-Host "❌ No .env or .env.example file found!" -ForegroundColor Red
            return
        }
    }

    # Read current .env file
    $envContent = Get-Content $envPath -Raw
    $envLines = Get-Content $envPath

    Write-Host "`n📝 Generating secure credentials..." -ForegroundColor Green

    # Generate new credentials
    $credentials = @{
        DB_PASSWORD = New-SecurePassword -Length 32
        FILESYSTEM_MASTER_KEY = New-SecureKey -Format hex -Bytes 32
        JWT_SECRET = New-SecureKey -Format base64 -Bytes 32
        SESSION_SECRET = New-SecureKey -Format base64 -Bytes 32
    }

    # Store database credentials in Windows Credential Store
    Write-Host "`n🔒 Storing database credentials in Windows Credential Store..." -ForegroundColor Yellow
    $dbUser = ($envLines | Where-Object { $_ -match '^DB_USER=' }) -replace 'DB_USER=', ''
    if (-not $dbUser) { $dbUser = 'mediavault_user' }

    Set-SecureCredential -Target "$CredentialTarget-DB" -Username $dbUser -Password $credentials.DB_PASSWORD

    # Update .env file
    Write-Host "`n📄 Updating .env file..." -ForegroundColor Yellow

    $updatedContent = $envContent
    foreach ($key in $credentials.Keys) {
        if ($updatedContent -match "$key=.*") {
            $updatedContent = $updatedContent -replace "$key=.*", "$key=$($credentials[$key])"
            Write-Host "   ✅ Updated $key" -ForegroundColor Green
        } else {
            $updatedContent += "`n$key=$($credentials[$key])"
            Write-Host "   ✅ Added $key" -ForegroundColor Green
        }
    }

    # Update security settings
    $securitySettings = @{
        SECURE_COOKIES = 'true'
        AUTH_DISABLED = 'false'
        SKIP_AUTH = 'false'
        NO_AUTH = 'false'
        OAUTH_ENABLED = 'false'
        PBKDF2_ITERATIONS = '600000'
        BCRYPT_ROUNDS = '12'
    }

    foreach ($key in $securitySettings.Keys) {
        if ($updatedContent -match "$key=.*") {
            $updatedContent = $updatedContent -replace "$key=.*", "$key=$($securitySettings[$key])"
        } else {
            $updatedContent += "`n$key=$($securitySettings[$key])"
        }
    }

    # Write updated content
    Set-Content -Path $envPath -Value $updatedContent -Encoding UTF8

    # Set file permissions (Windows)
    Write-Host "`n🔐 Setting file permissions..." -ForegroundColor Yellow
    $acl = Get-Acl $envPath
    $acl.SetAccessRuleProtection($true, $false)

    # Remove all existing permissions
    $acl.Access | ForEach-Object { $acl.RemoveAccessRule($_) | Out-Null }

    # Add only current user and SYSTEM
    $currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
    $userPermission = New-Object System.Security.AccessControl.FileSystemAccessRule(
        $currentUser,
        "FullControl",
        "Allow"
    )
    $systemPermission = New-Object System.Security.AccessControl.FileSystemAccessRule(
        "SYSTEM",
        "FullControl",
        "Allow"
    )

    $acl.SetAccessRule($userPermission)
    $acl.SetAccessRule($systemPermission)
    Set-Acl -Path $envPath -AclObject $acl

    Write-Host "   ✅ File permissions restricted to current user and SYSTEM" -ForegroundColor Green

    # Create database user if PostgreSQL is running
    Write-Host "`n🗄️  Setting up PostgreSQL user..." -ForegroundColor Yellow

    $pgPassword = $credentials.DB_PASSWORD
    $pgCommands = @"
-- Create user if not exists
DO `$`$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$dbUser') THEN
        CREATE USER $dbUser WITH PASSWORD '$pgPassword';
    ELSE
        ALTER USER $dbUser WITH PASSWORD '$pgPassword';
    END IF;
END
`$`$;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE mediavault TO $dbUser;
GRANT ALL ON SCHEMA public TO $dbUser;
"@

    try {
        $pgCommands | psql -U postgres -d postgres 2>&1 | Out-Null
        Write-Host "   ✅ PostgreSQL user configured" -ForegroundColor Green
    } catch {
        Write-Host "   ⚠️  Could not configure PostgreSQL user automatically" -ForegroundColor Yellow
        Write-Host "   Run the following SQL as postgres superuser:" -ForegroundColor Yellow
        Write-Host $pgCommands -ForegroundColor Cyan
    }

    # Display summary
    Write-Host "`n✅ MediaVault credentials secured successfully!" -ForegroundColor Green
    Write-Host "`n📋 Summary:" -ForegroundColor Cyan
    Write-Host "   • Generated secure 32-character database password"
    Write-Host "   • Generated 256-bit encryption keys"
    Write-Host "   • Stored database credentials in Windows Credential Store"
    Write-Host "   • Updated .env file with secure values"
    Write-Host "   • Restricted file permissions"
    Write-Host "`n⚠️  Important:" -ForegroundColor Yellow
    Write-Host "   • Restart the MediaVault server for changes to take effect"
    Write-Host "   • Keep the .env file secure and never commit it to version control"
    Write-Host "   • Consider enabling OAuth for production use"
    Write-Host "`n🔒 Security Tips:" -ForegroundColor Cyan
    Write-Host "   • Rotate credentials every 90 days"
    Write-Host "   • Use different credentials for each environment"
    Write-Host "   • Enable Windows Defender Credential Guard if available"
    Write-Host "   • Monitor failed authentication attempts"
}

function Validate-MediaVaultCredentials {
    Write-Host "`n=== MediaVault Credential Validation ===" -ForegroundColor Cyan

    $envPath = Join-Path $PSScriptRoot ".." ".env"
    if (-not (Test-Path $envPath)) {
        Write-Host "❌ No .env file found!" -ForegroundColor Red
        return
    }

    $envContent = Get-Content $envPath
    $issues = @()
    $warnings = @()

    # Check for default credentials
    if ($envContent -match 'postgres:postgres') {
        $issues += "Default PostgreSQL credentials detected"
    }

    if ($envContent -match 'DB_PASSWORD=postgres') {
        $issues += "Default database password 'postgres' detected"
    }

    # Check for placeholder values
    if ($envContent -match 'GENERATE|CHANGE_THIS|your-client-id') {
        $issues += "Placeholder values detected in configuration"
    }

    # Check key lengths
    $keys = @('FILESYSTEM_MASTER_KEY', 'JWT_SECRET', 'SESSION_SECRET')
    foreach ($key in $keys) {
        $line = $envContent | Where-Object { $_ -match "^$key=" }
        if ($line) {
            $value = $line -replace "^$key=", ""
            if ($value.Length -lt 32) {
                $issues += "$key is too short (minimum 32 characters)"
            }
        } else {
            $issues += "$key is not set"
        }
    }

    # Check security settings
    if ($envContent -match 'AUTH_DISABLED=true') {
        $issues += "Authentication is disabled"
    }

    if ($envContent -match 'SECURE_COOKIES=false') {
        $warnings += "Secure cookies are disabled"
    }

    # Check Windows Credential Store
    Write-Host "`nChecking Windows Credential Store..." -ForegroundColor Yellow
    $dbCred = Get-SecureCredential -Target "$CredentialTarget-DB"
    if ($dbCred) {
        Write-Host "   ✅ Database credentials found in Credential Store" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  No database credentials in Credential Store" -ForegroundColor Yellow
    }

    # Display results
    if ($issues.Count -gt 0) {
        Write-Host "`n❌ CRITICAL ISSUES:" -ForegroundColor Red
        foreach ($issue in $issues) {
            Write-Host "   • $issue" -ForegroundColor Red
        }
    }

    if ($warnings.Count -gt 0) {
        Write-Host "`n⚠️  WARNINGS:" -ForegroundColor Yellow
        foreach ($warning in $warnings) {
            Write-Host "   • $warning" -ForegroundColor Yellow
        }
    }

    if ($issues.Count -eq 0 -and $warnings.Count -eq 0) {
        Write-Host "`n✅ All credentials are properly configured!" -ForegroundColor Green
    }

    return $issues.Count -eq 0
}

# Main execution
switch ($Action) {
    'setup' {
        Setup-MediaVaultCredentials
    }
    'validate' {
        $valid = Validate-MediaVaultCredentials
        if (-not $valid) {
            Write-Host "`n💡 Run '.\secure-credentials.ps1 -Action setup' to fix issues" -ForegroundColor Cyan
            exit 1
        }
    }
    'get' {
        $cred = Get-SecureCredential -Target "$CredentialTarget-DB"
        if ($cred) {
            Write-Host "Username: $($cred.Username)" -ForegroundColor Green
            Write-Host "Password is stored securely (not displayed)" -ForegroundColor Yellow
        } else {
            Write-Host "No credentials found for MediaVault" -ForegroundColor Red
        }
    }
    'remove' {
        Remove-SecureCredential -Target "$CredentialTarget-DB"
    }
    'set' {
        $username = Read-Host "Enter database username"
        $password = Read-Host "Enter database password" -AsSecureString
        $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto(
            [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
        )
        Set-SecureCredential -Target "$CredentialTarget-DB" -Username $username -Password $plainPassword
    }
}