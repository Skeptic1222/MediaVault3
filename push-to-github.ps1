# MediaVault - GitHub Push Script
# This script helps push all files to GitHub using git

param(
    [string]$Token = ""
)

$ErrorActionPreference = "Stop"
$REPO_URL = "https://github.com/sop1973/MediaVault.git"
$WORKING_DIR = "C:\inetpub\wwwroot\MediaVault"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  MediaVault GitHub Upload Script" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

cd $WORKING_DIR

# Check if git is configured
Write-Host "[1/5] Checking git configuration..." -ForegroundColor Yellow
$hasRemote = git remote -v | Select-String "origin"
if ($hasRemote) {
    Write-Host "✓ Git remote 'origin' is configured" -ForegroundColor Green
    git remote -v
} else {
    Write-Host "✗ No git remote found. Adding origin..." -ForegroundColor Red
    git remote add origin $REPO_URL
    Write-Host "✓ Added remote 'origin'" -ForegroundColor Green
}
Write-Host ""

# Check commit status
Write-Host "[2/5] Checking commit status..." -ForegroundColor Yellow
$commitHash = git log -1 --format="%H"
$commitMsg = git log -1 --format="%s"
Write-Host "Current commit: $commitHash" -ForegroundColor Cyan
Write-Host "Message: $commitMsg" -ForegroundColor Cyan
Write-Host ""

# Count files
Write-Host "[3/5] Counting files to upload..." -ForegroundColor Yellow
$fileCount = (git ls-files | Measure-Object).Count
Write-Host "Total files: $fileCount" -ForegroundColor Cyan
Write-Host ""

# Check if we need authentication
Write-Host "[4/5] Checking GitHub authentication..." -ForegroundColor Yellow
if ($Token) {
    Write-Host "Using provided Personal Access Token" -ForegroundColor Green
    $authUrl = $REPO_URL -replace "https://", "https://$Token@"
    git remote set-url origin $authUrl
    Write-Host "✓ Configured remote with token authentication" -ForegroundColor Green
} else {
    Write-Host "No token provided. Options:" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Option 1: Use GitHub CLI (if installed):" -ForegroundColor White
    Write-Host "  gh auth login" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 2: Use Personal Access Token:" -ForegroundColor White
    Write-Host "  .\push-to-github.ps1 -Token YOUR_GITHUB_TOKEN" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Option 3: Use Git Credential Manager:" -ForegroundColor White
    Write-Host "  git push -u origin main" -ForegroundColor Gray
    Write-Host "  (Will prompt for credentials)" -ForegroundColor Gray
    Write-Host ""

    $response = Read-Host "Do you want to try pushing with Credential Manager? (y/n)"
    if ($response -ne 'y') {
        Write-Host "Push cancelled. Please provide authentication." -ForegroundColor Yellow
        exit 0
    }
}
Write-Host ""

# Push to GitHub
Write-Host "[5/5] Pushing to GitHub..." -ForegroundColor Yellow
Write-Host "This may take a few minutes for $fileCount files..." -ForegroundColor Cyan
Write-Host ""

try {
    git push -u origin main --verbose
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Green
    Write-Host "  ✓ SUCCESS! Files uploaded to GitHub" -ForegroundColor Green
    Write-Host "================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Repository URL: https://github.com/sop1973/MediaVault" -ForegroundColor Cyan
    Write-Host "Total files uploaded: $fileCount" -ForegroundColor Cyan
} catch {
    Write-Host ""
    Write-Host "================================================" -ForegroundColor Red
    Write-Host "  ✗ PUSH FAILED" -ForegroundColor Red
    Write-Host "================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Common solutions:" -ForegroundColor Yellow
    Write-Host "1. Create a Personal Access Token at:" -ForegroundColor White
    Write-Host "   https://github.com/settings/tokens/new" -ForegroundColor Cyan
    Write-Host "   Scopes needed: repo (all)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Run this script with the token:" -ForegroundColor White
    Write-Host "   .\push-to-github.ps1 -Token YOUR_TOKEN_HERE" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "3. Or install GitHub CLI:" -ForegroundColor White
    Write-Host "   winget install GitHub.cli" -ForegroundColor Cyan
    Write-Host "   gh auth login" -ForegroundColor Cyan
    Write-Host "   git push -u origin main" -ForegroundColor Cyan
    exit 1
}
