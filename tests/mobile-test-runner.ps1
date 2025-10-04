# Mobile UI Test Runner
# Comprehensive mobile testing script with reporting

param(
    [string]$Device = "all",
    [switch]$Headed,
    [switch]$Debug,
    [switch]$UpdateSnapshots,
    [switch]$SkipBuild
)

$ErrorActionPreference = "Continue"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  MediaVault Mobile UI Test Suite" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host ""

# Supported devices
$devices = @(
    "iphone-se",
    "iphone-12-pro",
    "iphone-12-pro-max",
    "pixel-5",
    "galaxy-s21",
    "ipad-portrait",
    "ipad-landscape"
)

# Test categories
$testCategories = @{
    "gestures" = "Touch Gestures in Lightbox"
    "controls" = "Lightbox Controls on Mobile"
    "music" = "Music Player Mobile Controls"
    "touch-targets" = "Touch Target Validation"
    "responsive" = "Responsive Layout"
    "performance" = "Performance"
    "visual" = "Visual Regression"
    "cross-device" = "Cross-Device Compatibility"
    "accessibility" = "Accessibility"
    "forms" = "Form Inputs"
}

# Build application if not skipped
if (-not $SkipBuild) {
    Write-Host "[1/4] Building application..." -ForegroundColor Yellow
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Build failed!" -ForegroundColor Red
        exit 1
    }
    Write-Host "Build completed successfully!" -ForegroundColor Green
    Write-Host ""
}

# Start development server in background
Write-Host "[2/4] Starting development server..." -ForegroundColor Yellow
$serverProcess = Start-Process -FilePath "npm" -ArgumentList "run", "start:dev" -PassThru -NoNewWindow
Start-Sleep -Seconds 10
Write-Host "Server started (PID: $($serverProcess.Id))" -ForegroundColor Green
Write-Host ""

# Prepare test command
Write-Host "[3/4] Preparing test execution..." -ForegroundColor Yellow
$testArgs = @("playwright", "test", "tests/e2e/mobile-ux.spec.ts")

if ($Device -ne "all") {
    if ($devices -contains $Device) {
        $testArgs += "--project=$Device"
        Write-Host "Testing on device: $Device" -ForegroundColor Cyan
    } else {
        Write-Host "Invalid device: $Device" -ForegroundColor Red
        Write-Host "Available devices: $($devices -join ', ')" -ForegroundColor Yellow
        Stop-Process -Id $serverProcess.Id -Force
        exit 1
    }
} else {
    Write-Host "Testing on all devices..." -ForegroundColor Cyan
}

if ($Headed) {
    $testArgs += "--headed"
}

if ($Debug) {
    $testArgs += "--debug"
}

if ($UpdateSnapshots) {
    $testArgs += "--update-snapshots"
}

$testArgs += "--reporter=html,json,list"
Write-Host ""

# Run tests
Write-Host "[4/4] Running mobile UI tests..." -ForegroundColor Yellow
Write-Host "Command: npx $($testArgs -join ' ')" -ForegroundColor Gray
Write-Host ""

$startTime = Get-Date
& npx $testArgs
$testExitCode = $LASTEXITCODE
$endTime = Get-Date
$duration = $endTime - $startTime

Write-Host ""
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "  Test Execution Complete" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Duration: $($duration.TotalSeconds) seconds" -ForegroundColor Cyan
Write-Host ""

# Clean up server process
Write-Host "Stopping development server..." -ForegroundColor Yellow
Stop-Process -Id $serverProcess.Id -Force
Write-Host ""

# Generate summary report
Write-Host "Generating test summary..." -ForegroundColor Yellow
if (Test-Path "test-results.json") {
    $results = Get-Content "test-results.json" | ConvertFrom-Json

    Write-Host ""
    Write-Host "==============================================" -ForegroundColor Green
    Write-Host "  TEST SUMMARY REPORT" -ForegroundColor Green
    Write-Host "==============================================" -ForegroundColor Green
    Write-Host ""

    $totalTests = $results.stats.expected + $results.stats.unexpected + $results.stats.skipped
    $passed = $results.stats.expected
    $failed = $results.stats.unexpected
    $skipped = $results.stats.skipped

    Write-Host "Total Tests:   $totalTests" -ForegroundColor White
    Write-Host "Passed:        $passed" -ForegroundColor Green
    Write-Host "Failed:        $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
    Write-Host "Skipped:       $skipped" -ForegroundColor Yellow
    Write-Host "Success Rate:  $([math]::Round(($passed / $totalTests) * 100, 2))%" -ForegroundColor Cyan
    Write-Host ""

    if ($failed -gt 0) {
        Write-Host "Failed Tests:" -ForegroundColor Red
        foreach ($suite in $results.suites) {
            foreach ($spec in $suite.specs) {
                if ($spec.tests[0].status -eq "unexpected") {
                    Write-Host "  - $($spec.title)" -ForegroundColor Red
                }
            }
        }
        Write-Host ""
    }
}

# Show report location
Write-Host "Full HTML report available at:" -ForegroundColor Cyan
Write-Host "  playwright-report/index.html" -ForegroundColor White
Write-Host ""

if ($testExitCode -eq 0) {
    Write-Host "All tests passed!" -ForegroundColor Green
} else {
    Write-Host "Some tests failed. Check the report for details." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "To view the report, run:" -ForegroundColor Cyan
Write-Host "  npx playwright show-report" -ForegroundColor White
Write-Host ""

exit $testExitCode
