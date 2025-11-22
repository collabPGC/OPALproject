# SAFe Flow Metrics
class FlowMetrics {
    [hashtable]$Metrics = @{
        Velocity = @()
        CycleTime = @()
        FlowEfficiency = @()
        Predictability = @()
    }
    
    [void] RecordVelocity([string]$team, [int]$iteration, [int]$planned, [int]$actual) {
        $this.Metrics.Velocity += @{
            Team = $team
            Iteration = $iteration
            Planned = $planned
            Actual = $actual
            Percentage = [Math]::Round(($actual / $planned) * 100, 2)
            Date = Get-Date
        }
    }
    
    [hashtable] CalculateCycleTime([datetime]$start, [datetime]$end, [string]$feature) {
        $days = ($end - $start).TotalDays
        return @{
            Feature = $feature
            CycleTimeDays = $days
            Category = if ($days -le 14) {"Fast"} elseif ($days -le 30) {"Normal"} else {"Slow"}
        }
    }
    
    [double] GetAverageVelocity([string]$team) {
        $teamData = $this.Metrics.Velocity | Where-Object { $_.Team -eq $team }
        if ($teamData.Count -eq 0) { return 0 }
        return ($teamData.Percentage | Measure-Object -Average).Average
    }
    
    [hashtable] GetPredictability() {
        $allVelocity = $this.Metrics.Velocity
        if ($allVelocity.Count -eq 0) { return @{Score = 0; Status = "No Data"} }
        
        $avgPercentage = ($allVelocity.Percentage | Measure-Object -Average).Average
        
        return @{
            Score = [Math]::Round($avgPercentage, 2)
            Status = if ($avgPercentage -ge 80) {"Reliable"} elseif ($avgPercentage -ge 60) {"Improving"} else {"Unreliable"}
            TeamCount = ($allVelocity.Team | Select-Object -Unique).Count
            IterationCount = ($allVelocity.Iteration | Select-Object -Unique).Count
        }
    }
}

function Initialize-FlowMetrics {
    $metrics = [FlowMetrics]::new()
    
    # Sample data
    $metrics.RecordVelocity("Mobile", 1, 40, 35)
    $metrics.RecordVelocity("API", 1, 50, 48)
    $metrics.RecordVelocity("Web", 1, 35, 33)
    
    $predictability = $metrics.GetPredictability()
    Write-Host "`nPredictability Score: $($predictability.Score)% - $($predictability.Status)" -ForegroundColor Cyan
    
    return $metrics
}
