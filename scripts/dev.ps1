param([ValidateSet('web','start','typecheck','test','build:bundles','doctor','contracts:generate')][string]$Task = 'web')
$ErrorActionPreference = 'Stop'
$taskRepoRoot = Split-Path $PSScriptRoot -Parent
$taskNodeDir = Join-Path $taskRepoRoot '.npm-cache/runtime/node-v22.20.0-win-x64'
if (Test-Path -LiteralPath (Join-Path $taskNodeDir 'npm.cmd')) { $env:PATH = $taskNodeDir + ';' + $env:PATH }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'Install Node.js 22.20.0 (includes npm), then run this script again.' }
$env:EXPO_NO_TELEMETRY = '1'
$env:EXPO_HOME = Join-Path $taskRepoRoot '.npm-cache/expo-home'
Push-Location $taskRepoRoot
try { & npm.cmd run $Task; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } } finally { Pop-Location }
