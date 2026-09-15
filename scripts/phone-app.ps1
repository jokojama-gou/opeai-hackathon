param([ValidateSet('go','web')][string]$Mode = 'go', [int]$Port = 8083)
$ErrorActionPreference = 'Stop'
$phoneRepo = Split-Path $PSScriptRoot -Parent
$phoneNode = Join-Path $phoneRepo '.npm-cache/runtime/node-v22.20.0-win-x64'
if (Test-Path -LiteralPath (Join-Path $phoneNode 'node.exe')) { $env:PATH = $phoneNode + ';' + $env:PATH }
$phoneConfig = Get-Content -Raw -LiteralPath (Join-Path $phoneRepo 'apps/client/eas.json') | ConvertFrom-Json
$env:EXPO_PUBLIC_API_URL = $phoneConfig.build.preview.env.EXPO_PUBLIC_API_URL
if (-not $env:EXPO_PUBLIC_API_URL.StartsWith('https://')) { throw 'Set the HTTPS API URL in apps/client/eas.json first.' }
$env:EXPO_NO_TELEMETRY = '1'
Push-Location (Join-Path $phoneRepo 'apps/client')
try {
    $phoneArgs = @('start', '--lan', '--port', "$Port")
    if ($Mode -eq 'web') { $phoneArgs += '--web' } else { $phoneArgs += '--go' }
    & node (Join-Path $phoneRepo 'node_modules/expo/bin/cli') @phoneArgs
    exit $LASTEXITCODE
} finally { Pop-Location }
