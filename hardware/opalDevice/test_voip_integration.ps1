# Test VoIP Integration for ESP32-C6 OPAL
# Verifies VoIP files are ready for integration

Write-Host "========================================"
Write-Host "Testing VoIP Integration Files"
Write-Host "ESP32-C6 OPAL Device"
Write-Host "========================================"
Write-Host ""

$voipDir = "$PSScriptRoot\voip_opal"

if (-not (Test-Path $voipDir)) {
    Write-Host "[ERROR] VoIP directory not found: $voipDir" -ForegroundColor Red
    exit 1
}

Write-Host "[OK] VoIP directory found: $voipDir"
Write-Host ""

# Check required files
$requiredFiles = @(
    "sip_service_opal.c",
    "sip_service_opal.h",
    "voip_app_opal.c",
    "voip_app_opal.h"
)

Write-Host "Checking VoIP files..."
$allFilesExist = $true
foreach ($file in $requiredFiles) {
    if (Test-Path "$voipDir\$file") {
        $size = (Get-Item "$voipDir\$file").Length
        Write-Host "  [OK] $file ($size bytes)"
    } else {
        Write-Host "  [FAIL] $file missing" -ForegroundColor Red
        $allFilesExist = $false
    }
}

if (-not $allFilesExist) {
    Write-Host ""
    Write-Host "[ERROR] Some VoIP files are missing" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Checking documentation..."
$docFiles = @(
    "README_SIP_RTP.md",
    "INTEGRATION_GUIDE.md",
    "QUICK_START.md",
    "COMPLETE_SUMMARY.md"
)

foreach ($file in $docFiles) {
    if (Test-Path "$voipDir\$file") {
        Write-Host "  [OK] $file"
    } else {
        Write-Host "  [WARN] $file missing" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host "VoIP Integration Test: PASSED"
Write-Host "========================================"
Write-Host ""
Write-Host "All VoIP files are ready for integration."
Write-Host "See voip_opal/INTEGRATION_GUIDE.md for details."
Write-Host ""

