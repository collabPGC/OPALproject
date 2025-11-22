# WSJF (Weighted Shortest Job First) Calculator

class WSJFCalculator {
    # Fibonacci scale for consistency
    static [int[]] $FibScale = @(1, 2, 3, 5, 8, 13, 20)
    
    [hashtable] CalculateWSJF([hashtable]$feature) {
        # Components of Cost of Delay (CoD)
        $businessValue = $feature.BusinessValue  # 1-20 scale
        $timeCriticality = $feature.TimeCriticality  # 1-20 scale
        $riskReduction = $feature.RiskReduction  # 1-20 scale
        
        # Calculate Cost of Delay
        $costOfDelay = $businessValue + $timeCriticality + $riskReduction
        
        # Job Size (effort estimate)
        $jobSize = $feature.JobSize  # 1-20 scale
        
        # WSJF Score
        $wsjfScore = [math]::Round($costOfDelay / $jobSize, 2)
        
        # Determine priority tier
        $priorityTier = switch ($wsjfScore) {
            {$_ -gt 15} { "IMMEDIATE" }
            {$_ -gt 8}  { "CURRENT_PI" }
            {$_ -gt 3}  { "NEXT_PI" }
            default     { "BACKLOG" }
        }
        
        return @{
            FeatureId = $feature.Id
            FeatureName = $feature.Name
            BusinessValue = $businessValue
            TimeCriticality = $timeCriticality
            RiskReduction = $riskReduction
            CostOfDelay = $costOfDelay
            JobSize = $jobSize
            WSJFScore = $wsjfScore
            Priority = $priorityTier
            CalculatedAt = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        }
    }
    
    [array] BatchCalculate([array]$features) {
        $results = @()
        foreach ($feature in $features) {
            $results += $this.CalculateWSJF($feature)
        }
        # Sort by WSJF score descending
        return $results | Sort-Object -Property WSJFScore -Descending
    }
}

# Automated scoring algorithm based on feature attributes
function Get-AutomatedScores {
    param(
        [hashtable]$feature
    )
    
    $scores = @{}
    
    # Business Value auto-scoring
    $scores.BusinessValue = switch -Regex ($feature.Description) {
        "revenue|profit|sales" { 13 }
        "customer|user experience" { 8 }
        "efficiency|automation" { 5 }
        "maintenance|technical" { 3 }
        default { 5 }
    }
    
    # Time Criticality auto-scoring
    $scores.TimeCriticality = switch ($feature.Deadline) {
        {$_ -lt (Get-Date).AddDays(30)} { 20 }
        {$_ -lt (Get-Date).AddDays(60)} { 13 }
        {$_ -lt (Get-Date).AddDays(90)} { 8 }
        {$_ -lt (Get-Date).AddDays(180)} { 5 }
        default { 3 }
    }
    
    # Risk Reduction auto-scoring
    $scores.RiskReduction = switch -Regex ($feature.RiskType) {
        "security|compliance" { 20 }
        "performance|scalability" { 13 }
        "integration|dependency" { 8 }
        "usability" { 5 }
        default { 3 }
    }
    
    # Job Size estimation
    $scores.JobSize = switch ($feature.EstimatedPoints) {
        {$_ -le 13} { 3 }
        {$_ -le 40} { 8 }
        {$_ -le 100} { 13 }
        default { 20 }
    }
    
    return $scores
}

# Test the calculator
$calc = [WSJFCalculator]::new()

$testFeature = @{
    Id = "F-001"
    Name = "Mobile Payment Integration"
    Description = "Integrate mobile payment to increase revenue"
    Deadline = (Get-Date).AddDays(45)
    RiskType = "security"
    EstimatedPoints = 34
}

$autoScores = Get-AutomatedScores -feature $testFeature
$testFeature += $autoScores

$result = $calc.CalculateWSJF($testFeature)
$result | ConvertTo-Json
