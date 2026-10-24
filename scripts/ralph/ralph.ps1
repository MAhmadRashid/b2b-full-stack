<#
.SYNOPSIS
  Ralph Autonomous Agent Loop Runner (PowerShell for Windows)
  Adapted from Geoffrey Huntley & Ryan Carson's Ralph pattern.

.DESCRIPTION
  Executes an autonomous AI coding agent loop iteratively until all user stories
  in prd.json are marked with passes: true.

.EXAMPLE
  .\scripts\ralph\ralph.ps1 -MaxIterations 5
  .\scripts\ralph\ralph.ps1 -Tool claude -MaxIterations 10
  .\scripts\ralph\ralph.ps1 -DryRun
#>

param (
    [string]$Tool = "claude",
    [int]$MaxIterations = 10,
    [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PrdPath = Join-Path $ScriptDir "prd.json"
$ProgressPath = Join-Path $ScriptDir "progress.txt"
$PromptPath = Join-Path $ScriptDir "prompt.md"

if (-not (Test-Path -LiteralPath $PrdPath)) {
    Write-Error "prd.json not found at $PrdPath. Create one first."
    exit 1
}

# Load PRD
$PrdContent = Get-Content -LiteralPath $PrdPath -Raw | ConvertFrom-Json
$ProjectName = $PrdContent.project
$BranchName = $PrdContent.branchName
$Stories = $PrdContent.userStories

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Ralph Autonomous Loop Runner - $ProjectName" -ForegroundColor Cyan
Write-Host " Target Branch : $BranchName" -ForegroundColor Cyan
Write-Host " Tool Engine   : $Tool" -ForegroundColor Cyan
Write-Host " Max Loops     : $MaxIterations" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Status check
$Pending = @($Stories | Where-Object { $_.passes -eq $false })
$Completed = @($Stories | Where-Object { $_.passes -eq $true })

Write-Host "Total Stories : $($Stories.Count)" -ForegroundColor White
Write-Host "Completed     : $($Completed.Count)" -ForegroundColor Green
Write-Host "Pending       : $($Pending.Count)" -ForegroundColor Yellow

if ($Pending.Count -eq 0) {
    Write-Host "`nAll user stories in prd.json are already completed! Nothing to run." -ForegroundColor Green
    exit 0
}

if ($DryRun) {
    Write-Host "`n[DRY RUN] Next pending story in queue:" -ForegroundColor Magenta
    $Next = $Pending | Sort-Object priority | Select-Object -First 1
    Write-Host "ID       : $($Next.id)"
    Write-Host "Title    : $($Next.title)"
    Write-Host "Priority : $($Next.priority)"
    Write-Host "Criteria :"
    $Next.acceptanceCriteria | ForEach-Object { Write-Host "  - $_" }
    exit 0
}

# Iteration Loop
for ($i = 1; $i -le $MaxIterations; $i++) {
    # Re-read PRD to get fresh state
    $PrdContent = Get-Content -LiteralPath $PrdPath -Raw | ConvertFrom-Json
    $Pending = @($PrdContent.userStories | Where-Object { $_.passes -eq $false })

    if ($Pending.Count -eq 0) {
        Write-Host "`nAll user stories completed successfully! Ralph finished." -ForegroundColor Green
        break
    }

    $CurrentStory = $Pending | Sort-Object priority | Select-Object -First 1

    Write-Host "`n----------------------------------------------------------" -ForegroundColor DarkCyan
    Write-Host " [Iteration $i / $MaxIterations] Executing: $($CurrentStory.id) - $($CurrentStory.title)" -ForegroundColor Yellow
    Write-Host " Priority: $($CurrentStory.priority)" -ForegroundColor Gray
    Write-Host "----------------------------------------------------------" -ForegroundColor DarkCyan

    $PromptText = Get-Content -LiteralPath $PromptPath -Raw

    try {
        if ($Tool -eq "claude") {
            Write-Host "Invoking Claude Code CLI..." -ForegroundColor Cyan
            & claude --dangerously-skip-permissions -p $PromptText
        } elseif ($Tool -eq "amp") {
            Write-Host "Invoking Amp CLI..." -ForegroundColor Cyan
            & amp --prompt $PromptText
        } elseif ($Tool -eq "cursor" -or $Tool -eq "agy") {
            Write-Host "Invoking Agent CLI ($Tool)..." -ForegroundColor Cyan
            & agy execute --prompt $PromptText
        } else {
            Write-Host "Custom tool '$Tool' execution mode." -ForegroundColor Yellow
            Write-Host "Please process the single story: $($CurrentStory.id) using prompt at $PromptPath"
            break
        }
    } catch {
        Write-Warning "Agent invocation error during iteration ${i}: $_"
    }

    # Verify if story was marked completed
    $UpdatedPrd = Get-Content -LiteralPath $PrdPath -Raw | ConvertFrom-Json
    $CheckStory = $UpdatedPrd.userStories | Where-Object { $_.id -eq $CurrentStory.id }

    if ($CheckStory.passes -eq $true) {
        Write-Host "Story $($CurrentStory.id) marked as PASSED." -ForegroundColor Green
    } else {
        Write-Host "Story $($CurrentStory.id) not marked as passed. Will retry or inspect in next iteration." -ForegroundColor Yellow
    }
}

Write-Host "`nRalph execution batch finished." -ForegroundColor Cyan
