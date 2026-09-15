param()
$ErrorActionPreference = 'Stop'
$taskRepoRoot = Split-Path $PSScriptRoot -Parent
$taskEnvFile = Join-Path $taskRepoRoot 'services/backend/.env'
$taskAccountsFile = Join-Path $taskRepoRoot '.npm-cache/local-test-accounts.json'
if ((Test-Path -LiteralPath $taskEnvFile) -or (Test-Path -LiteralPath $taskAccountsFile)) {
  throw 'Local configuration already exists. Preserve it and inspect its state before configuring again.'
}
[IO.Directory]::CreateDirectory((Join-Path $taskRepoRoot '.npm-cache')) | Out-Null
Push-Location $taskRepoRoot
try {
  $taskRaw = & (Join-Path $taskRepoRoot 'node_modules/.bin/supabase.cmd') status --output json --agent no 2> (Join-Path $taskRepoRoot '.npm-cache/supabase-status-stderr.log')
  if ($LASTEXITCODE -ne 0) { throw 'Start this project local Supabase first.' }
  $taskStatus = ($taskRaw -join "`n") | ConvertFrom-Json
  foreach ($taskName in @('API_URL','DB_URL','ANON_KEY','SERVICE_ROLE_KEY')) {
    if (-not $taskStatus.$taskName) { throw "Supabase status is missing $taskName" }
  }
  $taskApi = [Uri]$taskStatus.API_URL
  $taskDb = [Uri]$taskStatus.DB_URL
  if ($taskApi.Host -notin @('localhost','127.0.0.1','[::1]') -or $taskDb.Host -notin @('localhost','127.0.0.1','[::1]')) {
    throw 'This setup only accepts local Supabase. No remote project changes are allowed.'
  }
  $taskSecret = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
  $taskEnvLines = @(
    '# Created for this PC local Supabase. Never commit or send to the client.',
    "DATABASE_URL=$($taskStatus.DB_URL)",
    "SUPABASE_URL=$($taskStatus.API_URL)",
    "SUPABASE_ANON_KEY=$($taskStatus.ANON_KEY)",
    "SUPABASE_SERVICE_ROLE_KEY=$($taskStatus.SERVICE_ROLE_KEY)",
    "UPLOAD_TICKET_SECRET=$taskSecret",
    'PC_DESTINATION_ID=local-development-pc',
    'CORS_ORIGINS=http://localhost:8081,http://localhost:8082,http://localhost:8091',
    'GENERATION_ENABLED=false'
  )
  [IO.File]::WriteAllLines($taskEnvFile, $taskEnvLines, [Text.UTF8Encoding]::new($false))
  $taskHeaders = @{ apikey=$taskStatus.SERVICE_ROLE_KEY; Authorization="Bearer $($taskStatus.SERVICE_ROLE_KEY)" }
  $taskAccounts = @()
  foreach ($taskLabel in @('iphone','android')) {
    $taskEmail = "$taskLabel@demo.invalid"
    $taskPassword = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(20)) + 'a!7'
    $taskPayload = @{email=$taskEmail;password=$taskPassword;email_confirm=$true} | ConvertTo-Json
    $taskUser = Invoke-RestMethod -Uri ($taskStatus.API_URL+'/auth/v1/admin/users') -Method Post -Headers $taskHeaders -ContentType 'application/json' -Body $taskPayload
    $taskAccounts += @{label=$taskLabel;email=$taskEmail;password=$taskPassword;user_id=$taskUser.id}
    # Save after each creation so a later failure never loses an account's password.
    $taskAccounts | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $taskAccountsFile -Encoding utf8
  }
  Write-Output 'Configured the local backend and two local test accounts. ASR and generation remain unconfigured.'
  Write-Output 'Account passwords are in .npm-cache/local-test-accounts.json and were not printed.'
} finally { Pop-Location }
