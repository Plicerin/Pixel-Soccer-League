param(
  [string]$StatusPath = "",
  [string]$LogPath = "",
  [int]$IntervalSeconds = 300,
  [int]$Tail = 8,
  [switch]$Once
)

$ErrorActionPreference = "Stop"

function Resolve-LatestRunPath {
  $statusFiles = Get-ChildItem -LiteralPath "telemetry" -Recurse -Filter "overnight-status.json" -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -match '\\nightly-' } |
    Sort-Object LastWriteTime -Descending

  if ($statusFiles.Count -eq 0) {
    return $null
  }

  return $statusFiles[0].FullName
}

function Format-StatusLine {
  param([object]$Status)

  $cycle = if ($null -ne $Status.currentCycle) { $Status.currentCycle } else { "-" }
  $phase = if ($Status.currentPhase) { $Status.currentPhase } else { "-" }
  $score = if ($Status.lastCompletedScore) { $Status.lastCompletedScore } else { "-" }
  $updated = if ($Status.updatedAt) { $Status.updatedAt } else { "-" }
  $completed = "$($Status.completedCycles)/$($Status.totalCycles)"

  return "state=$($Status.state) cycles=$completed current=$cycle phase=$phase lastScore=$score updated=$updated"
}

function Format-Age {
  param([string]$Timestamp)

  if (-not $Timestamp) { return "unknown" }
  try {
    $updated = [DateTimeOffset]::Parse($Timestamp)
    $age = [DateTimeOffset]::Now - $updated
    if ($age.TotalSeconds -lt 90) { return "$([math]::Round($age.TotalSeconds))s" }
    if ($age.TotalMinutes -lt 90) { return "$([math]::Round($age.TotalMinutes, 1))m" }
    return "$([math]::Round($age.TotalHours, 1))h"
  } catch {
    return "unknown"
  }
}

if (-not $StatusPath) {
  $latestStatus = Resolve-LatestRunPath
  if ($latestStatus) {
    $StatusPath = $latestStatus
  }
}

if ($StatusPath -and -not $LogPath) {
  $runDir = Split-Path -Parent $StatusPath
  $LogPath = Join-Path $runDir "runner.out.log"
}

while ($true) {
  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  Write-Host ""
  Write-Host "[$stamp] Nightly status"
  if ($StatusPath) {
    Write-Host "statusPath=$StatusPath"
  }

  if (Test-Path -LiteralPath $StatusPath) {
    try {
      $status = Get-Content -LiteralPath $StatusPath -Raw | ConvertFrom-Json
      Write-Host (Format-StatusLine -Status $status)
      $statusAge = Format-Age -Timestamp $status.updatedAt
      Write-Host "statusAge=$statusAge"
      try {
        $updatedAt = [DateTimeOffset]::Parse($status.updatedAt)
        if (([DateTimeOffset]::Now - $updatedAt).TotalMinutes -gt 5 -and $status.state -eq "running") {
          Write-Host "warning=status has not updated in more than 5 minutes"
        }
      } catch {}

      if (-not $LogPath -and $status.runnerLogPath) {
        $LogPath = $status.runnerLogPath
      }

      if ($status.currentFixtures -and $status.currentFixtures.Count -gt 0) {
        $fixture = $status.currentFixtures[0]
        Write-Host "fixture=$($fixture.homeTeam) vs $($fixture.awayTeam)"
      }

      if ($status.error) {
        Write-Host "error=$($status.error)"
      }

      if ($status.state -in @("completed", "failed", "stopped")) {
        Write-Host "watcher stopping: run state is $($status.state)"
        break
      }
    } catch {
      Write-Host "status read failed: $($_.Exception.Message)"
    }
  } else {
    Write-Host "status file not found: $StatusPath"
  }

  if (Test-Path -LiteralPath $LogPath) {
      Write-Host "recent runner log:"
    Get-Content -LiteralPath $LogPath -Tail $Tail
  }

  if ($Once) {
    break
  }

  Start-Sleep -Seconds $IntervalSeconds
}
