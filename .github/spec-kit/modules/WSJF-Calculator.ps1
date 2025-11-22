# WSJF Calculator for SAFe
class WSJFCalculator {
    [hashtable]$FibonacciScale = @{
        "XS" = 1; "S" = 2; "M" = 3; "L" = 5; 
        "XL" = 8; "XXL" = 13; "XXXL" = 20
    }

    [double] CalculateWSJF([hashtable]$feature) {
        $businessValue = $this.NormalizeScore($feature.BusinessValue)
        $timeCriticality = $this.NormalizeScore($feature.TimeCriticality)
        $riskReduction = $this.NormalizeScore($feature.RiskReduction)
        $jobSize = $this.NormalizeScore($feature.JobSize)
        
        if ($jobSize -eq 0) { $jobSize = 1 }
        
        return [Math]::Round(($businessValue + $timeCriticality + $riskReduction) / $jobSize, 2)
    }

    [int] NormalizeScore([string]$size) {
        if ($this.FibonacciScale.ContainsKey($size)) {
            return $this.FibonacciScale[$size]
        }
        return 1
    }
    
    [array] RankFeatures([array]$features) {
        $rankedFeatures = @()
        
        foreach ($feature in $features) {
            $feature.WSJFScore = $this.CalculateWSJF($feature)
            $rankedFeatures += $feature
        }
        
        return $rankedFeatures | Sort-Object -Property WSJFScore -Descending
    }
}

function Test-WSJF {
    $calc = [WSJFCalculator]::new()
    
    $features = @(
        @{Name="Payment Gateway"; BusinessValue="XL"; TimeCriticality="XXL"; RiskReduction="L"; JobSize="L"}
        @{Name="User Dashboard"; BusinessValue="M"; TimeCriticality="S"; RiskReduction="M"; JobSize="M"}
        @{Name="API Security"; BusinessValue="L"; TimeCriticality="XL"; RiskReduction="XL"; JobSize="S"}
    )
    
    $ranked = $calc.RankFeatures($features)
    
    Write-Host "`nWSJF Rankings:" -ForegroundColor Cyan
    foreach ($feature in $ranked) {
        Write-Host "  $($feature.Name): $($feature.WSJFScore)" -ForegroundColor Green
    }
    
    return $ranked
}
