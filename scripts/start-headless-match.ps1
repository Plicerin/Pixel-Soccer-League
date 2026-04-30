param(
  [int]$Games = 1,
  [double]$Speed = 1,
  [int]$TimeoutMs = 2400000,
  [string]$Prefix = "headless-match",
  [switch]$NoGpuHeadless,
  [switch]$NoVisualAudit,
  [int]$HalfSeconds = 0,
  [string]$Url = "",
  [string]$Query = ""
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Resolve-Path (Join-Path $scriptDir "..")
Set-Location -LiteralPath $repoRoot

$started = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$slug = Get-Date -Format "yyyy-MM-dd-HHmmss"
$safePrefix = $Prefix -replace '[^A-Za-z0-9_.-]', '-'
$runDir = Join-Path $repoRoot "telemetry\$safePrefix-$slug"
New-Item -ItemType Directory -Force -Path $runDir | Out-Null

$stdoutPath = Join-Path $runDir "runner.out.log"
$stderrPath = Join-Path $runDir "runner.err.log"
$launcherLogPath = Join-Path $runDir "launcher.log"
$reportPath = Join-Path $runDir "sim.json"
$visualAuditDir = Join-Path $runDir "visual-audit"
$pidPath = Join-Path $runDir "runner.pid"
$workerPidPath = Join-Path $runDir "worker.pid"
$exitCodePath = Join-Path $runDir "exit-code.txt"
$workerScriptPath = Join-Path $runDir "run-headless-match.ps1"
$argsJsonPath = Join-Path $runDir "args.json"
$manifestPath = Join-Path $runDir "start-manifest.json"
$commandPath = Join-Path $runDir "command.txt"

$argsList = @(
  "scripts\headless-sim.mjs",
  "--games", [string]$Games,
  "--speed", [string]$Speed,
  "--timeout-ms", [string]$TimeoutMs,
  "--report-json", $reportPath
)

if ($HalfSeconds -gt 0) {
  $argsList += @("--half-seconds", [string]$HalfSeconds)
}

if ($Url) {
  $argsList += @("--url", $Url)
}

if ($Query) {
  $argsList += @("--query", $Query)
}

if ($NoGpuHeadless) {
  $argsList += "--no-gpu-headless"
} else {
  $argsList += "--gpu-headless"
}

if (-not $NoVisualAudit) {
  $argsList += @("--visual-audit", "--visual-audit-dir", $visualAuditDir)
}

$commandLine = "node " + (($argsList | ForEach-Object {
  if ($_ -match '\s') { '"' + ($_ -replace '"', '\"') + '"' } else { $_ }
}) -join " ")

function Quote-ProcessArgument {
  param([string]$Value)
  if ($null -eq $Value) { return '""' }
  if ($Value -notmatch '[\s"]') { return $Value }
  return '"' + ($Value -replace '\\', '\\' -replace '"', '\"') + '"'
}

$manifest = [ordered]@{
  started = $started
  repoRoot = [string]$repoRoot
  runDir = $runDir
  launcherLog = $launcherLogPath
  stdout = $stdoutPath
  stderr = $stderrPath
  reportJson = $reportPath
  visualAuditDir = if ($NoVisualAudit) { $null } else { $visualAuditDir }
  games = $Games
  speed = $Speed
  timeoutMs = $TimeoutMs
  gpuHeadless = -not $NoGpuHeadless
  command = $commandLine
}

$manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
$commandLine | Set-Content -LiteralPath $commandPath -Encoding UTF8
$argsList | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath $argsJsonPath -Encoding UTF8
"started=$started" | Set-Content -LiteralPath $launcherLogPath -Encoding UTF8
if (Test-Path -LiteralPath $stdoutPath) { Remove-Item -LiteralPath $stdoutPath -Force }
if (Test-Path -LiteralPath $stderrPath) { Remove-Item -LiteralPath $stderrPath -Force }

$workerScript = @"
param(
  [string]`$RunDir,
  [string]`$RepoRoot,
  [string]`$ArgsJsonPath,
  [string]`$StdoutPath,
  [string]`$StderrPath,
  [string]`$PidPath,
  [string]`$LauncherLogPath,
  [string]`$ExitCodePath
)
`$ErrorActionPreference = "Stop"
`$exitCode = 997
try {
  `$argsList = @(Get-Content -LiteralPath `$ArgsJsonPath -Raw | ConvertFrom-Json)
  Set-Location -LiteralPath `$RepoRoot
  [string]`$PID | Set-Content -LiteralPath `$PidPath -Encoding ASCII
  "pid=`$PID" | Add-Content -LiteralPath `$LauncherLogPath
  "workerStarted=`$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Add-Content -LiteralPath `$LauncherLogPath

  & node @argsList > `$StdoutPath 2> `$StderrPath
  `$exitCode = `$LASTEXITCODE
} catch {
  `$exitCode = 998
  "workerException=`$(`$_.Exception.Message)" | Add-Content -LiteralPath `$LauncherLogPath
}
[string]`$exitCode | Set-Content -LiteralPath `$ExitCodePath -Encoding ASCII
"finished=`$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') exitCode=`$exitCode" | Add-Content -LiteralPath `$LauncherLogPath
"@

$workerScript | Set-Content -LiteralPath $workerScriptPath -Encoding UTF8

$workerStartInfo = [System.Diagnostics.ProcessStartInfo]::new()
$workerStartInfo.FileName = "powershell"
$workerStartInfo.WorkingDirectory = [string]$repoRoot
$workerStartInfo.UseShellExecute = $false
$workerStartInfo.CreateNoWindow = $true
$workerArgs = @(
  "-NoProfile",
  "-ExecutionPolicy", "Bypass",
  "-File", $workerScriptPath,
  "-RunDir", $runDir,
  "-RepoRoot", [string]$repoRoot,
  "-ArgsJsonPath", $argsJsonPath,
  "-StdoutPath", $stdoutPath,
  "-StderrPath", $stderrPath,
  "-PidPath", $pidPath,
  "-LauncherLogPath", $launcherLogPath,
  "-ExitCodePath", $exitCodePath
)
$workerStartInfo.Arguments = (($workerArgs | ForEach-Object { Quote-ProcessArgument ([string]$_) }) -join " ")

$workerProcess = [System.Diagnostics.Process]::new()
$workerProcess.StartInfo = $workerStartInfo
[void]$workerProcess.Start()

[string]$workerProcess.Id | Set-Content -LiteralPath $workerPidPath -Encoding ASCII
"workerPid=$($workerProcess.Id)" | Add-Content -LiteralPath $launcherLogPath

Write-Output "started=$started workerPid=$($workerProcess.Id) out=$runDir"
