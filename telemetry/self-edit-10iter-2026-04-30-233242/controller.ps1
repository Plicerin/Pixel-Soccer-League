$ErrorActionPreference = 'Continue'
Set-Location 'C:\Users\vrock\Documents\Pixel Soccer League'
$outDir = 'telemetry\self-edit-10iter-2026-04-30-233242'
$overnightDir = 'telemetry\self-edit-10iter-2026-04-30-233242\overnight'
$statusPath = Join-Path $outDir 'self-edit-status.json'
$runnerLog = Join-Path $outDir 'runner.out.log'
$editLog = Join-Path $outDir 'self-edit.out.log'
function Write-Status($state, $extra = @{}) {
  $payload = @{
    state = $state
    updatedAt = (Get-Date).ToString('o')
    outDir = $outDir
    overnightDir = $overnightDir
  }
  foreach ($key in $extra.Keys) { $payload[$key] = $extra[$key] }
  $payload | ConvertTo-Json -Depth 20 | Set-Content -Encoding UTF8 $statusPath
}
Write-Status 'running-overnight' @{ step = 'iterate-overnight'; cycles = 10; gamesPerCycle = 1 }
$iterateArgs = @('scripts\iterate-overnight.mjs','--cycles','10','--games-per-cycle','1','--mode','tuning','--speed','1','--half-seconds','150','--url','http://127.0.0.1:3002/?telemetryCoach=1&coachAggression=85&defenseAggression=55','--out-dir',$overnightDir)
& node @iterateArgs *>&1 | Tee-Object -FilePath $runnerLog -Append
$iterateExit = $LASTEXITCODE
$findingsPath = Join-Path $overnightDir 'overnight-findings.json'
if ($iterateExit -ne 0) {
  Write-Status 'failed' @{ step = 'iterate-overnight'; exitCode = $iterateExit; findingsPath = $findingsPath }
  exit $iterateExit
}
if (!(Test-Path $findingsPath)) {
  Write-Status 'failed' @{ step = 'iterate-overnight'; exitCode = 0; error = 'overnight-findings.json missing'; findingsPath = $findingsPath }
  exit 2
}
Write-Status 'running-self-edit' @{ step = 'self-edit-loop'; findingsPath = $findingsPath }
$editArgs = @('scripts\self-edit-loop.mjs','--findings',$findingsPath,'--out-dir',$outDir,'--apply','--validate')
& node @editArgs *>&1 | Tee-Object -FilePath $editLog -Append
$editExit = $LASTEXITCODE
if ($editExit -ne 0) {
  Write-Status 'failed' @{ step = 'self-edit-loop'; exitCode = $editExit; findingsPath = $findingsPath }
  exit $editExit
}
Write-Status 'completed' @{ step = 'done'; exitCode = 0; findingsPath = $findingsPath }
