param(
  [string]$OutDir = "telemetry\overnight-self-edit-2026-04-27-run",
  [int]$Cycles = 5,
  [int]$HalfSeconds = 300
)

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$log = Join-Path $OutDir "runner.log"
$err = Join-Path $OutDir "runner.err.log"

node scripts\iterate-overnight.mjs `
  --cycles $Cycles `
  --games-per-cycle 1 `
  --mode tuning `
  --speed 1 `
  --half-seconds $HalfSeconds `
  --out-dir $OutDir `
  1>> $log `
  2>> $err
