param(
  [ValidateSet('setup','serve','worker','test','schema')][string]$Task = 'test',
  [string]$Python = 'python'
)
$ErrorActionPreference = 'Stop'
$taskRepoRoot = Split-Path $PSScriptRoot -Parent
$taskVenv = Join-Path $taskRepoRoot '.npm-cache/backend-venv'
$taskPython = Join-Path $taskVenv 'Scripts/python.exe'
$taskMediaRoot = Join-Path $taskRepoRoot '.npm-cache/tools/ffmpeg'
if (Test-Path -LiteralPath $taskMediaRoot) {
  $taskProbe = Get-ChildItem -LiteralPath $taskMediaRoot -Filter ffprobe.exe -Recurse -File | Select-Object -First 1
  if ($taskProbe) { $env:PATH = $taskProbe.DirectoryName + ';' + $env:PATH }
}
if ($Task -eq 'setup') {
  if (-not (Test-Path -LiteralPath $taskPython)) {
    & $Python -m venv $taskVenv
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
  }
  & $taskPython -m pip install -r (Join-Path $taskRepoRoot 'services/backend/requirements.lock.txt')
  exit $LASTEXITCODE
}
if (-not (Test-Path -LiteralPath $taskPython)) { throw 'Run scripts/backend.ps1 setup with Python 3.12 first.' }
Push-Location (Join-Path $taskRepoRoot 'services/backend')
try {
  switch ($Task) {
    'serve' { & $taskPython -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --no-access-log }
    'worker' { & $taskPython -m app.worker }
    'test' { & $taskPython -m pytest -q }
    'schema' { & $taskPython export_openapi.py }
  }
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally { Pop-Location }
