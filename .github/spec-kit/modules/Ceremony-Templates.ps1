# SAFe Ceremony Templates
class CeremonyTemplates {
    [hashtable]$Templates = @{}
    
    CeremonyTemplates() {
        $this.InitializeTemplates()
    }
    
    [void] InitializeTemplates() {
        $this.Templates["PIPlanning"] = @{
            Duration = "2 days"
            Day1 = @{
                "08:00" = "Business Context"
                "09:00" = "Product Vision" 
                "10:45" = "Architecture Vision"
                "13:00" = "Team Breakouts"
                "17:00" = "Draft Plan Review"
            }
            Day2 = @{
                "08:00" = "Planning Adjustments"
                "10:00" = "Team Plan Reviews"
                "11:30" = "Confidence Vote"
                "14:00" = "Planning Retrospective"
            }
        }
        
        $this.Templates["SystemDemo"] = @{
            Frequency = "Every 2 weeks"
            Duration = "2 hours"
            Agenda = @{
                "00:00" = "PI Progress Update"
                "00:05" = "Team Demos (15 min each)"
                "01:30" = "Stakeholder Feedback"
                "01:50" = "Next Steps"
            }
        }
    }
    
    [string] GetAgenda([string]$ceremony) {
        if (-not $this.Templates.ContainsKey($ceremony)) {
            return "Template not found"
        }
        
        $template = $this.Templates[$ceremony]
        $output = "`n=== $ceremony Agenda ===`n"
        
        foreach ($key in $template.Keys) {
            if ($template[$key] -is [hashtable]) {
                $output += "`n$key :`n"
                foreach ($time in $template[$key].Keys | Sort-Object) {
                    $output += "  $time - $($template[$key][$time])`n"
                }
            } else {
                $output += "$key : $($template[$key])`n"
            }
        }
        
        return $output
    }
}

function Get-CeremonyTemplate {
    param([string]$Ceremony = "PIPlanning")
    
    $templates = [CeremonyTemplates]::new()
    Write-Host $templates.GetAgenda($Ceremony) -ForegroundColor Cyan
    
    return $templates
}
