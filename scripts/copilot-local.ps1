$repoRoot = Split-Path -Parent $PSScriptRoot
$env:COPILOT_HOME = Join-Path $repoRoot '.copilot'

copilot @args
