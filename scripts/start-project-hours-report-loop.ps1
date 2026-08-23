param(
  [int]$IntervalHours = 24
)

$ErrorActionPreference = "Stop"
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$pidPath = Join-Path $repoRoot "project-hours-report-loop.pid"
$stdoutPath = Join-Path $repoRoot "project-hours-report-stdout.log"
$stderrPath = Join-Path $repoRoot "project-hours-report-host-stderr.log"
$loopScriptPath = Join-Path $repoRoot "project-hours-report-loop.runner.ps1"

$script = @"
`$ErrorActionPreference = "Continue"
Set-Location "$repoRoot"
while (`$true) {
  `$stamp = Get-Date -Format o
  "[`$stamp] Updating project hours report" | Out-File -FilePath "$stdoutPath" -Append -Encoding utf8
  npm run hours:report *>> "$stdoutPath"
  if (`$LASTEXITCODE -ne 0) {
    "[`$stamp] hours:report exited with code `$LASTEXITCODE" | Out-File -FilePath "$stderrPath" -Append -Encoding utf8
  }
  Start-Sleep -Seconds ($IntervalHours * 3600)
}
"@

Set-Content -Path $loopScriptPath -Value $script -Encoding utf8
$process = Start-Process -FilePath "powershell.exe" `
  -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", $loopScriptPath) `
  -WorkingDirectory $repoRoot `
  -WindowStyle Hidden `
  -PassThru

Set-Content -Path $pidPath -Value $process.Id -Encoding ascii
Write-Output "Started project-hours report loop pid=$($process.Id)"
