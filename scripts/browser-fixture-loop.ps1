$ErrorActionPreference = 'Continue'

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$teams = @(
  'Canada',
  'Mexico',
  'United States',
  'Austria',
  'Belgium',
  'Bosnia and Herzegovina',
  'Croatia',
  'Czechia',
  'England',
  'France',
  'Germany',
  'Netherlands',
  'Norway',
  'Portugal',
  'Scotland',
  'Spain',
  'Sweden',
  'Switzerland',
  'Türkiye',
  'Argentina',
  'Brazil',
  'Colombia',
  'Ecuador',
  'Paraguay',
  'Uruguay',
  'Algeria',
  'Cabo Verde',
  "Côte d'Ivoire",
  'DR Congo',
  'Egypt',
  'Ghana',
  'Morocco',
  'Senegal',
  'South Africa',
  'Tunisia',
  'Australia',
  'Iran',
  'Iraq',
  'Japan',
  'Jordan',
  'Qatar',
  'Saudi Arabia',
  'South Korea',
  'Uzbekistan',
  'Curaçao',
  'Haiti',
  'Panama',
  'New Zealand'
)

$formations = @('4-4-2', '4-3-3', '4-2-3-1', '3-5-2', '3-4-3')
$telemetryDir = Join-Path $repoRoot 'telemetry'
New-Item -ItemType Directory -Force -Path $telemetryDir | Out-Null
$loopLog = Join-Path $telemetryDir 'browser-fixture-loop.log'

$index = 0
while ($true) {
  $index += 1
  $homeTeam = Get-Random -InputObject $teams
  do {
    $awayTeam = Get-Random -InputObject $teams
  } while ($awayTeam -eq $homeTeam)

  $formationA = Get-Random -InputObject $formations
  $formationB = Get-Random -InputObject $formations
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  $report = "telemetry/browser-loop-$stamp-$index.json"

  & node scripts/browser-wait-smoke-idle.mjs 2>&1 | Tee-Object -FilePath $loopLog -Append
  "[$(Get-Date -Format o)] START #$index $homeTeam ($formationA) vs $awayTeam ($formationB)" | Tee-Object -FilePath $loopLog -Append
  & node scripts/browser-harness-fixture.mjs `
    --home $homeTeam `
    --away $awayTeam `
    --formation-a $formationA `
    --formation-b $formationB `
    --url 'http://127.0.0.1:3001/' `
    --half-seconds 300 `
    --speed 1 `
    --timeout-ms 900000 `
    --report-json $report 2>&1 | Tee-Object -FilePath $loopLog -Append

  "[$(Get-Date -Format o)] END #$index exit=$LASTEXITCODE report=$report" | Tee-Object -FilePath $loopLog -Append
  Start-Sleep -Seconds 2
}
