param(
  [string]$OutDir = "",
  [int]$Cycles = 5,
  [int]$GamesPerCycle = 1,
  [int]$Speed = 1,
  [int]$HalfSeconds = 300,
  [switch]$Resume,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $repoRoot

if (-not $OutDir) {
  $stamp = Get-Date -Format "yyyy-MM-dd-HHmmss"
  $OutDir = "telemetry\nightly-$stamp"
}

$absOutDir = Join-Path $repoRoot $OutDir
New-Item -ItemType Directory -Force -Path $absOutDir | Out-Null

$hostStdout = Join-Path $absOutDir "launcher-stdout.log"
$hostStderr = Join-Path $absOutDir "launcher-stderr.log"
$pidPath = Join-Path $absOutDir "launcher.pid"
$runnerPath = Join-Path $absOutDir "launch-tuning-series.runner.ps1"

$resumeArg = if ($Resume) { " --resume" } else { "" }
$runnerScript = @"
`$ErrorActionPreference = "Continue"
Set-Location "$repoRoot"
npm run tuning:series -- --cycles $Cycles --games-per-cycle $GamesPerCycle --speed $Speed --half-seconds $HalfSeconds --out-dir "$OutDir"$resumeArg
exit `$LASTEXITCODE
"@

Set-Content -Path $runnerPath -Value $runnerScript -Encoding utf8

if ($DryRun) {
  Write-Output "dryRun=true"
  Write-Output "outDir=$OutDir"
  Write-Output "runner=$runnerPath"
  Write-Output "status=$OutDir\overnight-status.json"
  Write-Output "runnerLog=$OutDir\runner.out.log"
  exit 0
}

$encodedCommand = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes("& '$runnerPath'"))
$process = Start-Process -FilePath "powershell.exe" `
  -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-EncodedCommand", $encodedCommand) `
  -WorkingDirectory $repoRoot `
  -RedirectStandardOutput $hostStdout `
  -RedirectStandardError $hostStderr `
  -WindowStyle Hidden `
  -PassThru

Set-Content -Path $pidPath -Value $process.Id -Encoding ascii

Write-Output "started pid=$($process.Id)"
Write-Output "outDir=$OutDir"
Write-Output "status=$OutDir\overnight-status.json"
Write-Output "runnerLog=$OutDir\runner.out.log"
