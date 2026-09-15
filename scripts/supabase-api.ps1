[CmdletBinding()]
param(
    [ValidateSet('GET', 'POST', 'PATCH', 'PUT', 'DELETE')]
    [string]$Method = 'GET',
    [string]$Path = '/v1/projects',
    [string]$BodyFile,
    [string]$CredentialFile = (Join-Path $PSScriptRoot '../.env.supabase.local')
)

$ErrorActionPreference = 'Stop'
# Never accept an arbitrary host or follow redirects with the credential.
if ($Path -notmatch '^/v1/[A-Za-z0-9_/?=&.%-]+$' -or $Path.Contains('..')) {
    throw 'Use a Supabase Management API path starting with /v1/.'
}
$token = $env:SUPABASE_ACCESS_TOKEN
if (-not $token) {
    if (-not (Test-Path -LiteralPath $CredentialFile)) {
        throw 'SUPABASE_ACCESS_TOKEN is missing. Set it in the process environment, .env.supabase.local, or a file selected by -CredentialFile.'
    }
    $tokenLine = @(Get-Content -LiteralPath $CredentialFile | Where-Object { $_ -match '^SUPABASE_ACCESS_TOKEN=' })
    if ($tokenLine.Count -ne 1) { throw 'Expected exactly one SUPABASE_ACCESS_TOKEN entry.' }
    $token = ($tokenLine[0] -split '=', 2)[1].Trim().Trim('"', "'")
}
if ($token -notmatch '^sbp_[A-Za-z0-9_-]+$') { throw 'Invalid access token format.' }
$request = @{
    Uri = 'https://api.supabase.com' + $Path
    Method = $Method
    Headers = @{ Authorization = 'Bearer ' + $token }
    MaximumRedirection = 0
    TimeoutSec = 30
}
if ($BodyFile) {
    $request.Body = Get-Content -LiteralPath $BodyFile -Raw
    $null = $request.Body | ConvertFrom-Json
    $request.ContentType = 'application/json'
}
try {
    Invoke-RestMethod @request
} catch {
    # Do not echo request headers, token, or arbitrary response content on error.
    $status = if ($_.Exception.Response) { [int]$_.Exception.Response.StatusCode } else { 'unavailable' }
    throw "Supabase API request failed (HTTP $status). Check connectivity, token permissions and API path."
} finally {
    $request.Headers.Clear()
    $token = $null
    $tokenLine = $null
}
