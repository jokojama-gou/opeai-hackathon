[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$EasArguments = @(),
    [ValidateSet('status', 'init', 'android', 'ios', 'simulator')]
    [string]$Task,
    [string]$CredentialFile = (Join-Path $PSScriptRoot '../.env.expo.local')
)

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path $PSScriptRoot -Parent
$previousToken = $env:EXPO_TOKEN
$previousPath = $env:PATH
$previousTelemetry = $env:EXPO_NO_TELEMETRY
$exitCode = 1
try {
    $runtimeDirectory = Join-Path $repoRoot '.npm-cache/runtime/node-v22.20.0-win-x64'
    if (Test-Path -LiteralPath (Join-Path $runtimeDirectory 'node.exe')) {
        $env:PATH = $runtimeDirectory + ';' + $env:PATH
    }
    $cli = Join-Path $repoRoot 'node_modules/eas-cli/bin/run'
    if (-not (Test-Path -LiteralPath $cli)) { throw 'Run npm ci first.' }
    if ($Task -and $EasArguments.Count) { throw 'Use -Task or raw EAS arguments, not both.' }
    # Preserve both the existing EAS command interface and the local task shortcuts.
    if (-not $Task -and $EasArguments.Count -eq 1 -and
        $EasArguments[0] -in @('status', 'android', 'ios', 'simulator')) {
        $Task = $EasArguments[0]
    }
    if ($Task) {
        $EasArguments = switch ($Task) {
            'status' { @('whoami') }
            'init' { @('init') }
            'android' { @('build', '--platform', 'android', '--profile', 'preview') }
            'ios' { @('build', '--platform', 'ios', '--profile', 'preview') }
            'simulator' { @('build', '--platform', 'ios', '--profile', 'simulator') }
        }
    } elseif (-not $EasArguments.Count) { $EasArguments = @('whoami') }
    if (-not $env:EXPO_TOKEN) {
        if (-not (Test-Path -LiteralPath $CredentialFile)) {
            throw 'Set EXPO_TOKEN or create .env.expo.local first.'
        }
        $lines = @(Get-Content -LiteralPath $CredentialFile | Where-Object { $_ -match '^EXPO_TOKEN=' })
        if ($lines.Count -ne 1) { throw 'Expected exactly one EXPO_TOKEN entry.' }
        $env:EXPO_TOKEN = ($lines[0] -split '=', 2)[1].Trim().Trim('"', "'")
        if (-not $env:EXPO_TOKEN) { throw 'EXPO_TOKEN is empty.' }
    }
    $env:EXPO_NO_TELEMETRY = '1'
    Push-Location (Join-Path $repoRoot 'apps/client')
    try {
        & node $cli @EasArguments
        $exitCode = $LASTEXITCODE
    } finally { Pop-Location }
} finally {
    $env:EXPO_TOKEN = $previousToken
    $env:PATH = $previousPath
    $env:EXPO_NO_TELEMETRY = $previousTelemetry
    $lines = $null
}
exit $exitCode
