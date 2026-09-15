# Run the verified Setlog snapshot while the primary checkout is being merged.
param([int]$Port = 8083)
$ErrorActionPreference = 'Stop'
$verifiedRepo = Split-Path $PSScriptRoot -Parent
$verifiedRoot = Join-Path $verifiedRepo '.npm-cache/setlog-verified-preview'
$verifiedClient = Join-Path $verifiedRoot 'apps/client'
$verifiedNode = Join-Path $verifiedRepo '.npm-cache/runtime/node-v22.20.0-win-x64'
$verifiedCli = Join-Path $verifiedRoot 'node_modules/expo/bin/cli'
if (-not (Test-Path -LiteralPath $verifiedCli)) { throw 'Restore the verified snapshot and run npm ci in it first. See SETLOG_VERIFIED_PREVIEW.md.' }
$env:PATH = $verifiedNode + ';' + $env:PATH
$env:EXPO_PUBLIC_API_URL = (Get-Content -Raw -LiteralPath (Join-Path $verifiedClient 'eas.json') | ConvertFrom-Json).build.preview.env.EXPO_PUBLIC_API_URL
$env:EXPO_NO_TELEMETRY = '1'
Push-Location $verifiedClient
try { & node $verifiedCli start --go --lan --port $Port; exit $LASTEXITCODE } finally { Pop-Location }
