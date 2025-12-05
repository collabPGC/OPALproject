# Test script to capture serial output
Set-Location "G:\Projects\OPALproject\ProjectWork\hardware\opalDevice\esp-adf-temp\examples\advanced_examples\aec"
$env:ADF_PATH = "G:\Projects\OPALproject\ProjectWork\hardware\opalDevice\esp-adf-temp"
$env:IDF_PATH = "C:\Users\huber\esp\v5.5.1\esp-idf"

Write-Host "=== ESP32-C6 OPAL AEC Test ==="
Write-Host ""
Write-Host "This will start the serial monitor."
Write-Host "Watch for:"
Write-Host "  1. Boot messages"
Write-Host "  2. AEC Example startup"
Write-Host "  3. Board initialization"
Write-Host "  4. Codec initialization"
Write-Host "  5. Audio pipeline creation"
Write-Host ""
Write-Host "Press Ctrl+] to exit monitor"
Write-Host ""
Start-Sleep -Seconds 2

# Start monitor (this will block until Ctrl+] is pressed)
idf.py -p COM4 monitor
