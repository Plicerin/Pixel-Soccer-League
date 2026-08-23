param(
  [string]$RunDir,
  [string]$RepoRoot,
  [string]$ArgsJsonPath,
  [string]$StdoutPath,
  [string]$StderrPath,
  [string]$PidPath,
  [string]$LauncherLogPath,
  [string]$ExitCodePath
)
$ErrorActionPreference = "Stop"
$exitCode = 997
try {
  $argsList = @(Get-Content -LiteralPath $ArgsJsonPath -Raw | ConvertFrom-Json)
  Set-Location -LiteralPath $RepoRoot
  [string]$PID | Set-Content -LiteralPath $PidPath -Encoding ASCII
  "pid=$PID" | Add-Content -LiteralPath $LauncherLogPath
  "workerStarted=$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Add-Content -LiteralPath $LauncherLogPath

  & node @argsList > $StdoutPath 2> $StderrPath
  $exitCode = $LASTEXITCODE
} catch {
  $exitCode = 998
  "workerException=$($_.Exception.Message)" | Add-Content -LiteralPath $LauncherLogPath
}
[string]$exitCode | Set-Content -LiteralPath $ExitCodePath -Encoding ASCII
"finished=$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') exitCode=$exitCode" | Add-Content -LiteralPath $LauncherLogPath
