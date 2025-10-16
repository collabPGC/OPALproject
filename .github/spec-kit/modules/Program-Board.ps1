# Digital Program Board for SAFe PI Planning

class ProgramBoard {
    [hashtable]$Board = @{}
    [array]$Teams = @()
    [array]$Iterations = @()
    [hashtable]$Dependencies = @{}
    [int]$PINumber
    
    # Constructor with 2 parameters
    ProgramBoard([int]$pi, [array]$teams) {
        $this.PINumber = $pi
        $this.Teams = $teams
        $this.Iterations = 1..5  # Default to 5 iterations
        $this.InitializeBoard()
    }
    
    # Constructor with 3 parameters
    ProgramBoard([int]$pi, [array]$teams, [int]$iterations) {
        $this.PINumber = $pi
        $this.Teams = $teams
        $this.Iterations = 1..$iterations
        $this.InitializeBoard()
    }
    
    [void] InitializeBoard() {
        foreach ($team in $this.Teams) {
            $this.Board[$team] = @{}
            foreach ($iteration in $this.Iterations) {
                $this.Board[$team]["I$iteration"] = @{
                    Features = @()
                    Capacity = 100
                    Committed = 0
                    Dependencies = @{
                        Incoming = @()
                        Outgoing = @()
                    }
                }
            }
        }
    }
    
    [hashtable] AddFeature([string]$team, [int]$iteration, [hashtable]$feature) {
        if (-not $this.Board.ContainsKey($team)) {
            throw "Team '$team' not found on board"
        }
        
        $iterationKey = "I$iteration"
        $teamIteration = $this.Board[$team][$iterationKey]
        
        # Check capacity
        if (($teamIteration.Committed + $feature.Points) -gt $teamIteration.Capacity) {
            return @{
                Success = $false
                Message = "Insufficient capacity. Available: $($teamIteration.Capacity - $teamIteration.Committed)"
            }
        }
        
        # Add feature
        $teamIteration.Features += $feature
        $teamIteration.Committed += $feature.Points
        
        return @{
            Success = $true
            Message = "Feature added successfully"
            RemainingCapacity = $teamIteration.Capacity - $teamIteration.Committed
        }
    }
    
    [hashtable] AddDependency([hashtable]$dependency) {
        # Dependency structure: Provider -> Consumer
        $dependencyId = [Guid]::NewGuid().ToString()
        
        $this.Dependencies[$dependencyId] = @{
            Provider = @{
                Team = $dependency.ProviderTeam
                Iteration = $dependency.ProviderIteration
                Deliverable = $dependency.Deliverable
            }
            Consumer = @{
                Team = $dependency.ConsumerTeam
                Iteration = $dependency.ConsumerIteration
                Feature = $dependency.ConsumerFeature
            }
            Status = "IDENTIFIED"  # IDENTIFIED, COMMITTED, AT_RISK, RESOLVED
            Risk = $dependency.Risk  # LOW, MEDIUM, HIGH
            CreatedDate = Get-Date
        }
        
        # Update board references
        $providerKey = "I$($dependency.ProviderIteration)"
        $consumerKey = "I$($dependency.ConsumerIteration)"
        
        $this.Board[$dependency.ProviderTeam][$providerKey].Dependencies.Outgoing += $dependencyId
        $this.Board[$dependency.ConsumerTeam][$consumerKey].Dependencies.Incoming += $dependencyId
        
        return @{
            DependencyId = $dependencyId
            Status = "Created"
            ValidationResult = $this.ValidateDependency($dependencyId)
        }
    }
    
    [hashtable] ValidateDependency([string]$dependencyId) {
        $dep = $this.Dependencies[$dependencyId]
        
        # Check timing constraint
        if ($dep.Provider.Iteration -ge $dep.Consumer.Iteration) {
            return @{
                Valid = $false
                Issue = "TIMING_CONFLICT"
                Message = "Provider must deliver before consumer needs it"
                Recommendation = "Adjust iterations or find alternative solution"
            }
        }
        
        # Check team capacity
        $providerTeam = $this.Board[$dep.Provider.Team]["I$($dep.Provider.Iteration)"]
        if ($providerTeam.Committed -gt ($providerTeam.Capacity * 0.8)) {
            return @{
                Valid = $true
                Issue = "CAPACITY_RISK"
                Message = "Provider team at high utilization"
                Recommendation = "Monitor closely or reduce scope"
            }
        }
        
        return @{
            Valid = $true
            Issue = "NONE"
            Message = "Dependency is valid"
        }
    }
    
    [string] GenerateBoard() {
        $boardDisplay = @"
╔════════════════════════════════════════════════════════════════╗
║                    PROGRAM BOARD - PI $($this.PINumber)                    ║
╠════════════════════════════════════════════════════════════════╣
"@
        
        # Header row with iterations
        $header = "║ TEAM         "
        foreach ($iteration in $this.Iterations) {
            $header += "│ ITER $iteration     "
        }
        $header += "║"
        $boardDisplay += "`n$header"
        $boardDisplay += "`n╠══════════════"
        foreach ($i in $this.Iterations) {
            $boardDisplay += "╪════════════"
        }
        $boardDisplay += "╣"
        
        # Team rows
        foreach ($team in $this.Teams) {
            $row = "`n║ {0,-12} " -f $team
            foreach ($iteration in $this.Iterations) {
                $iterData = $this.Board[$team]["I$iteration"]
                $capacity = "$($iterData.Committed)/$($iterData.Capacity)"
                $row += "│ {0,-10} " -f $capacity
            }
            $row += "║"
            $boardDisplay += $row
        }
        
        $boardDisplay += "`n╚════════════════════════════════════════════════════════════════╝"
        
        # Dependency summary
        $boardDisplay += "`n`nDEPENDENCIES:"
        foreach ($depId in $this.Dependencies.Keys) {
            $dep = $this.Dependencies[$depId]
            $status = switch ($dep.Status) {
                "AT_RISK" { "[!]" }
                "RESOLVED" { "[✓]" }
                default { "[ ]" }
            }
            $boardDisplay += "`n$status $($dep.Provider.Team) I$($dep.Provider.Iteration) → $($dep.Consumer.Team) I$($dep.Consumer.Iteration): $($dep.Deliverable)"
        }
        
        return $boardDisplay
    }
    
    [array] IdentifyRisks() {
        $risks = @()
        
        # Check for circular dependencies
        foreach ($depId in $this.Dependencies.Keys) {
            $dep = $this.Dependencies[$depId]
            
            # Look for reverse dependency
            $reverse = $this.Dependencies.Values | Where-Object {
                $_.Provider.Team -eq $dep.Consumer.Team -and
                $_.Consumer.Team -eq $dep.Provider.Team
            }
            
            if ($reverse) {
                $risks += @{
                    Type = "CIRCULAR_DEPENDENCY"
                    Severity = "HIGH"
                    Teams = @($dep.Provider.Team, $dep.Consumer.Team)
                    Message = "Circular dependency detected"
                }
            }
        }
        
        # Check for overcommitted teams
        foreach ($team in $this.Teams) {
            foreach ($iteration in $this.Iterations) {
                $iterData = $this.Board[$team]["I$iteration"]
                if ($iterData.Committed -gt $iterData.Capacity) {
                    $risks += @{
                        Type = "OVER_CAPACITY"
                        Severity = "HIGH"
                        Team = $team
                        Iteration = $iteration
                        Message = "Team overcommitted by $($iterData.Committed - $iterData.Capacity) points"
                    }
                }
            }
        }
        
        return $risks
    }
}

# Usage function
function Initialize-ProgramBoard {
    $teams = @("Mobile", "API", "Web", "Platform", "Data")
    # Now works with 2 parameters
    $boardObj = [ProgramBoard]::new(23, $teams)
    
    # Add sample features
    $boardObj.AddFeature("Mobile", 1, @{Name="Login UI"; Points=13})
    $boardObj.AddFeature("API", 1, @{Name="Auth Service"; Points=20})
    $boardObj.AddFeature("Web", 2, @{Name="Dashboard"; Points=8})
    
    # Add dependencies
    $boardObj.AddDependency(@{
        ProviderTeam = "API"
        ProviderIteration = 1
        Deliverable = "Auth API Endpoints"
        ConsumerTeam = "Mobile"
        ConsumerIteration = 2
        ConsumerFeature = "Login Integration"
        Risk = "MEDIUM"
    })
    
    # Display board
    Write-Host $boardObj.GenerateBoard() -ForegroundColor Cyan
    
    # Check risks
    $risks = $boardObj.IdentifyRisks()
    if ($risks.Count -gt 0) {
        Write-Host "`nIDENTIFIED RISKS:" -ForegroundColor Red
        foreach ($risk in $risks) {
            Write-Host "  [$($risk.Severity)] $($risk.Message)" -ForegroundColor Yellow
        }
    }
    
    # Save board state
    $boardObj | ConvertTo-Json -Depth 5 | Set-Content ".\.github\spec-kit\data\program-board-pi23.json"
    
    return $boardObj
}
