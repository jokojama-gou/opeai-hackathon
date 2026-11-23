[CmdletBinding()]
param(
    [ValidateSet('GET', 'POST', 'PATCH', 'PUT', 'DELETE')]
    [string]$Method = 'GET',
    [string]$Path = '/v2/user',
    [string]$BodyFile
)

$ErrorActionPreference = 'Stop'
# Never accept an arbitrary host or follow redirects with the credential.
if ($Path -notmatch '^/v[0-9]+/[A-Za-z0-9_/?=&.%-]+$' -or $Path.Contains('..')) {
    throw 'Use a Vercel API path starting with /v followed by a version number.'
}
$credentialPath = Join-Path $PSScriptRoot '../.env.vercel.local'
if (-not (Test-Path -LiteralPath $credentialPath)) {
    throw 'Create .env.vercel.local with VERCEL_TOKEN first.'
}
$tokenLine = @(Get-Content -LiteralPath $credentialPath | Where-Object { $_ -match '^VERCEL_TOKEN=' })
if ($tokenLine.Count -ne 1) { throw 'Expected exactly one VERCEL_TOKEN entry.' }
$token = ($tokenLine[0] -split '=', 2)[1].Trim()
if ($token -notmatch '^vcp_[A-Za-z0-9_-]+$') { throw 'Invalid access token format.' }
$request = @{
    Uri = 'https://api.vercel.com' + $Path
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
    throw "Vercel API request failed (HTTP $status). Check connectivity, token permissions and API path."
} finally {
    $request.Headers.Clear()
    $token = $null
    $tokenLine = $null
}
