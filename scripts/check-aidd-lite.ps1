param([Parameter(Mandatory=$true)][string]$RepoRoot)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath $RepoRoot).Path
# Compatibility entry point. Metadata and link checks live in the Node script.
& node (Join-Path $PSScriptRoot 'check-aidd-lite.mjs') --repo-root $taskRoot
exit $LASTEXITCODE
