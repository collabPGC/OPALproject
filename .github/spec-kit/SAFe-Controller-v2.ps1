[CmdletBinding()]
param(
  [ValidateSet('Status','Help','InitializeBoard','RankFeatures','GetMetrics','GetCeremony')]
  [string]$Action = 'Status',
  [string]$CeremonyName = 'PIPlanning',
  [int]$PINumber = 23,
  [string[]]$Teams = @('Mobile','API','Web','Platform','Data'),
  [string]$FeaturesFile = '.\.github\spec-kit\data\features.json'
)

$OutputEncoding = [System.Text.Encoding]::UTF8

# Load all modules
$modules = @(
    "Program-Board.ps1",
    "WSJF-Calculator.ps1",
    "Flow-Metrics.ps1",
    "Ceremony-Templates.ps1"
)

Write-Host "`nLoading SAFe modules..." -ForegroundColor Cyan
foreach ($module in $modules) {
    $modulePath = "$PSScriptRoot\modules\$module"
    if (Test-Path $modulePath) {
        . $modulePath
        Write-Host "  ✓ $module" -ForegroundColor Green
    } else {
        Write-Host "  • $module (not found at $modulePath)" -ForegroundColor Yellow
    }
}

try {
  switch ($Action) {
    'Status' {
      $boardFile = ".\.github\spec-kit\data\program-board-pi$PINumber.json"
      $featuresFileExists = Test-Path $FeaturesFile
      $boardFileExists    = Test-Path $boardFile

      Write-Host "`n╔════════════════════════════════════════╗" -ForegroundColor Cyan
      Write-Host   "║       SAFe PM SYSTEM STATUS            ║" -ForegroundColor Cyan
      Write-Host   "╠════════════════════════════════════════╣" -ForegroundColor Cyan

      if ($boardFileExists) {
        Write-Host "║ ✓ Program Board     : Ready            ║" -ForegroundColor Green
      } else {
        Write-Host "║ • Program Board     : Not Initialized  ║" -ForegroundColor Yellow
      }

      if ($featuresFileExists) {
        Write-Host "║ ✓ WSJF Calculator   : Ready            ║" -ForegroundColor Green
      } else {
        Write-Host "║ • WSJF Calculator   : features.json missing ║" -ForegroundColor Yellow
      }

      Write-Host "║ ✓ Flow Metrics      : Ready            ║" -ForegroundColor Green
      Write-Host "║ ✓ Ceremony Templates: Ready            ║" -ForegroundColor Green
      Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan

      Write-Host "`nRun .\SAFe-Controller-v2.ps1 -Action Help for more details."
      break
    }

    'Help' {
      Write-Host "`nAvailable Commands:" -ForegroundColor Yellow
      Write-Host "  .\SAFe-Controller-v2.ps1 -Action Status" -ForegroundColor White
      Write-Host "    - Shows the status of the SAFe PM System."
      Write-Host "  .\SAFe-Controller-v2.ps1 -Action InitializeBoard -PINumber [PI] -Teams [Array]" -ForegroundColor White
      Write-Host "    - Initializes the program board for a new PI."
      Write-Host "  .\SAFe-Controller-v2.ps1 -Action RankFeatures -FeaturesFile [Path]" -ForegroundColor White
      Write-Host "    - Ranks features from a JSON file using WSJF."
      Write-Host "  .\SAFe-Controller-v2.ps1 -Action GetMetrics" -ForegroundColor White
      Write-Host "    - Initializes and displays flow metrics."
      Write-Host "  .\SAFe-Controller-v2.ps1 -Action GetCeremony -CeremonyName [Name]" -ForegroundColor White
      Write-Host "    - Displays the agenda for a specific ceremony."
      break
    }

    'InitializeBoard' {
      Initialize-ProgramBoard -pi $PINumber -teams $Teams
      break
    }

    'RankFeatures' {
      if (Test-Path $FeaturesFile) {
        $features = Get-Content $FeaturesFile -Raw | ConvertFrom-Json
        $calc     = [WSJFCalculator]::new()
        $ranked   = $calc.RankFeatures($features)

        Write-Host "`nWSJF Rankings:" -ForegroundColor Cyan
        foreach ($feature in $ranked) {
          Write-Host ("  {0}: {1}" -f $feature.Name, $feature.WSJFScore) -ForegroundColor Green
        }
      } else {
        Write-Host "Features file not found: $FeaturesFile" -ForegroundColor Red
      }
      break
    }

    'GetMetrics' {
      Initialize-FlowMetrics
      break
    }

    'GetCeremony' {
      Get-CeremonyTemplate -Ceremony $CeremonyName
      break
    }

    default {
      Write-Host "Unknown action. Use 'Help' for a list of available commands." -ForegroundColor Yellow
      break
    }
  } # end switch
} catch {
  Write-Host "An error occurred:" -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host $_.ScriptStackTrace -ForegroundColor Red
}