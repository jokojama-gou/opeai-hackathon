[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$EasArguments = @('whoami')
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$credentialPath = Join-Path $repoRoot '.env.expo.local'
$previousToken = $env:EXPO_TOKEN
$exitCode = 1
try {
    if (-not $env:EXPO_TOKEN) {
        if (-not (Test-Path -LiteralPath $credentialPath)) {
            throw 'Set EXPO_TOKEN or create .env.expo.local first.'
        }
        $lines = @(Get-Content -LiteralPath $credentialPath | Where-Object { $_ -match '^EXPO_TOKEN=' })
        if ($lines.Count -ne 1) { throw 'Expected exactly one EXPO_TOKEN entry.' }
        $env:EXPO_TOKEN = ($lines[0] -split '=', 2)[1].Trim()
        if (-not $env:EXPO_TOKEN) { throw 'EXPO_TOKEN is empty.' }
    }
    Push-Location (Join-Path $repoRoot 'apps/client')
    try {
        & node (Join-Path $repoRoot 'node_modules/eas-cli/bin/run') @EasArguments
        $exitCode = $LASTEXITCODE
    } finally { Pop-Location }
} finally {
    $env:EXPO_TOKEN = $previousToken
    $lines = $null
}
exit $exitCode
