# Run All Tests for ESP32-C6 OPAL Project
# Tests all components and integration

Write-Host "========================================"
Write-Host "ESP32-C6 OPAL Project - Complete Test Suite"
Write-Host "========================================"
Write-Host ""

$testResults = @()

# Test 1: Board Configuration
Write-Host "[TEST 1] Board Configuration"
Write-Host "----------------------------------------"
try {
    & "$PSScriptRoot\test_board_config.ps1"
    if ($LASTEXITCODE -eq 0) {
        $testResults += @{Test = "Board Configuration"; Status = "PASSED"}
    } else {
        $testResults += @{Test = "Board Configuration"; Status = "FAILED"}
    }
} catch {
    Write-Host "[ERROR] Board config test failed: $_" -ForegroundColor Red
    $testResults += @{Test = "Board Configuration"; Status = "ERROR"}
}
Write-Host ""

# Test 2: VoIP Integration
Write-Host "[TEST 2] VoIP Integration Files"
Write-Host "----------------------------------------"
try {
    & "$PSScriptRoot\test_voip_integration.ps1"
    if ($LASTEXITCODE -eq 0) {
        $testResults += @{Test = "VoIP Integration"; Status = "PASSED"}
    } else {
        $testResults += @{Test = "VoIP Integration"; Status = "FAILED"}
    }
} catch {
    Write-Host "[ERROR] VoIP test failed: $_" -ForegroundColor Red
    $testResults += @{Test = "VoIP Integration"; Status = "ERROR"}
}
Write-Host ""

# Test 3: AEC Project
Write-Host "[TEST 3] AEC Project Files"
Write-Host "----------------------------------------"
try {
    & "$PSScriptRoot\test_aec_build.ps1"
    if ($LASTEXITCODE -eq 0) {
        $testResults += @{Test = "AEC Project"; Status = "PASSED"}
    } else {
        $testResults += @{Test = "AEC Project"; Status = "FAILED"}
    }
} catch {
    Write-Host "[ERROR] AEC test failed: $_" -ForegroundColor Red
    $testResults += @{Test = "AEC Project"; Status = "ERROR"}
}
Write-Host ""

# Summary
Write-Host "========================================"
Write-Host "Test Summary"
Write-Host "========================================"
Write-Host ""

foreach ($result in $testResults) {
    $color = if ($result.Status -eq "PASSED") { "Green" } else { "Red" }
    Write-Host "$($result.Test): $($result.Status)" -ForegroundColor $color
}

$passed = ($testResults | Where-Object { $_.Status -eq "PASSED" }).Count
$total = $testResults.Count

Write-Host ""
Write-Host "Results: $passed/$total tests passed"
Write-Host ""

if ($passed -eq $total) {
    Write-Host "========================================"
    Write-Host "ALL TESTS PASSED!" -ForegroundColor Green
    Write-Host "========================================"
    Write-Host ""
    Write-Host "All components are ready for:"
    Write-Host "  1. Hardware fix (I2C pull-up resistors)"
    Write-Host "  2. Build and flash"
    Write-Host "  3. Testing on device"
    Write-Host ""
} else {
    Write-Host "========================================"
    Write-Host "SOME TESTS FAILED" -ForegroundColor Yellow
    Write-Host "========================================"
    Write-Host ""
    Write-Host "Please review the test output above."
    Write-Host ""
}

