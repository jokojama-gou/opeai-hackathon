#requires -Version 7.0
param(
    [Parameter(Mandatory)][ValidateSet('protect', 'verify', 'remove-plaintext', 'run')][string]$Action,
    [string]$SourceDirectory = (Split-Path -Parent $PSScriptRoot),
    [string]$VaultDirectory = (Join-Path $env:LOCALAPPDATA 'OpeaiHackathon\Secrets'),
    [string]$Executable,
    [string[]]$CommandArguments = @()
)
$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath($SourceDirectory)
$vaultRoot = [IO.Path]::GetFullPath($VaultDirectory)
$vaultFile = Join-Path $vaultRoot 'audio-credentials.dpapi'
$fileNames = @('.env.audio-models.local', '.env.audio-google-service-account.local.json')
$archiveFormat = 'opeai-audio-vault/v1'
$comparison = [StringComparison]::OrdinalIgnoreCase
if (-not $IsWindows) { throw 'This vault requires Windows and the Windows account that protected it.' }
if ($vaultRoot.Equals($sourceRoot, $comparison) -or $vaultRoot.StartsWith($sourceRoot.TrimEnd('\', '/') + [IO.Path]::DirectorySeparatorChar, $comparison)) {
    throw 'The vault must be outside the repository.'
}

function Assert-NoReparsePoints([string]$Path) {
    $candidate = $Path
    while ($candidate) {
        if ((Test-Path -LiteralPath $candidate) -and ((Get-Item -LiteralPath $candidate -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw 'Credential paths must not use symlinks or junctions.' }
        $candidate = Split-Path -Parent $candidate
    }
}
Assert-NoReparsePoints $vaultRoot
foreach ($name in $fileNames) { Assert-NoReparsePoints (Join-Path $sourceRoot $name) }

function Set-PrivateDirectory([string]$Directory) {
    if (Test-Path -LiteralPath $Directory) { throw 'A new private directory is required.' }
    [void][IO.Directory]::CreateDirectory($Directory)
    $acl = [Security.AccessControl.DirectorySecurity]::new()
    $acl.SetAccessRuleProtection($true, $false)
    $owner = [Security.Principal.WindowsIdentity]::GetCurrent().User
    $acl.SetOwner($owner)
    foreach ($sid in @($owner, [Security.Principal.SecurityIdentifier]::new('S-1-5-18'))) {
        $rule = [Security.AccessControl.FileSystemAccessRule]::new($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
    }
    Set-Acl -LiteralPath $Directory -AclObject $acl
}

function Read-Vault {
    $encrypted = [IO.File]::ReadAllBytes($vaultFile)
    $plain = [Security.Cryptography.ProtectedData]::Unprotect($encrypted, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
    try {
        $archive = [Text.Encoding]::UTF8.GetString($plain) | ConvertFrom-Json
        if ($archive.format -ne $archiveFormat -or $archive.files.Count -ne 2) { throw 'Invalid vault format.' }
        foreach ($name in $fileNames) {
            $items = @($archive.files | Where-Object name -CEQ $name)
            if ($items.Count -ne 1) { throw 'Invalid vault file inventory.' }
            $bytes = [Convert]::FromBase64String($items[0].data)
            try {
                if ([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)) -cne $items[0].sha256) { throw 'Vault integrity check failed.' }
            } finally { [Array]::Clear($bytes) }
        }
        return $archive
    } finally { [Array]::Clear($plain) }
}

function Assert-OriginalsMatch($Archive) {
    foreach ($entry in $Archive.files) {
        $source = Join-Path $sourceRoot $entry.name
        $bytes = [IO.File]::ReadAllBytes($source)
        try {
            if ([Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)) -cne $entry.sha256) { throw 'Local credentials differ from the vault; originals were preserved.' }
        } finally { [Array]::Clear($bytes) }
    }
}

try {
    if ($Action -eq 'protect') {
        if (Test-Path -LiteralPath $vaultFile) { throw 'An existing vault will not be overwritten.' }
        $files = foreach ($name in $fileNames) {
            $bytes = [IO.File]::ReadAllBytes((Join-Path $sourceRoot $name))
            try { @{ name = $name; data = [Convert]::ToBase64String($bytes); sha256 = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($bytes)) } }
            finally { [Array]::Clear($bytes) }
        }
        Set-PrivateDirectory $vaultRoot
        $plain = [Text.Encoding]::UTF8.GetBytes((@{format=$archiveFormat;files=@($files)} | ConvertTo-Json -Depth 5 -Compress))
        try { $encrypted = [Security.Cryptography.ProtectedData]::Protect($plain, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser) }
        finally { [Array]::Clear($plain) }
        $stream = [IO.File]::Open($vaultFile, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
        try { $stream.Write($encrypted) } finally { $stream.Dispose() }
        $archive = Read-Vault
        Assert-OriginalsMatch $archive
        Write-Output 'PASS: both credential files are protected and byte-identical; originals are still present.'
        exit 0
    }
    $archive = Read-Vault
    if ($Action -eq 'verify') {
        $originalsPresent = @($fileNames | Where-Object { Test-Path -LiteralPath (Join-Path $sourceRoot $_) }).Count
        if ($originalsPresent -gt 0) { Assert-OriginalsMatch $archive }
        Write-Output 'PASS: Windows-user-bound vault authenticated; both files passed integrity verification.'
        exit 0
    }
    if ($Action -eq 'remove-plaintext') {
        Assert-OriginalsMatch $archive
        foreach ($name in $fileNames) {
            $tracked = & git -c "safe.directory=$($sourceRoot.Replace('\','/'))" -C $sourceRoot ls-files -- $name
            if ($LASTEXITCODE -ne 0 -or $tracked) { throw 'Remove both credential files from the Git index before removing plaintext.' }
        }
        foreach ($name in $fileNames) { Remove-Item -LiteralPath (Join-Path $sourceRoot $name) }
        Write-Output 'PASS: verified plaintext copies removed; vault retained.'
        exit 0
    }
    if (-not $Executable) { throw 'run requires -Executable and optional -CommandArguments.' }
    $childEnvironment = @{}
    $originalEnvironment = @{}
    $envEntry = $archive.files | Where-Object name -CEQ '.env.audio-models.local'
    $envBytes = [Convert]::FromBase64String($envEntry.data)
    $allowed = @('OPENAI_API_KEY','ELEVENLABS_API_KEY','PYANNOTE_API_KEY','GEMINI_API_KEY','SPEECHMATICS_API_KEY','DEEPGRAM_API_KEY','ASSEMBLYAI_API_KEY','HF_TOKEN','GOOGLE_CLOUD_PROJECT','GOOGLE_CLOUD_LOCATION')
    try {
        foreach ($line in [Text.Encoding]::UTF8.GetString($envBytes).Split("`n")) {
            if ($line -match '^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$' -and $Matches[1] -cin $allowed) {
                $childEnvironment[$Matches[1]] = $Matches[2].Trim('"', "'")
            }
        }
    } finally { [Array]::Clear($envBytes) }
    $sessionDirectory = Join-Path $vaultRoot ('run-' + [Guid]::NewGuid().ToString('N'))
    $cloudFile = Join-Path $sessionDirectory 'google-service-account.json'
    try {
        Set-PrivateDirectory $sessionDirectory
        $cloudEntry = $archive.files | Where-Object name -CEQ '.env.audio-google-service-account.local.json'
        $cloudBytes = [Convert]::FromBase64String($cloudEntry.data)
        try { [IO.File]::WriteAllBytes($cloudFile, $cloudBytes) } finally { [Array]::Clear($cloudBytes) }
        $childEnvironment['GOOGLE_APPLICATION_CREDENTIALS'] = $cloudFile
        foreach ($name in $childEnvironment.Keys) {
            $originalEnvironment[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
            [Environment]::SetEnvironmentVariable($name, $childEnvironment[$name], 'Process')
        }
        & $Executable @CommandArguments
        $resultCode = $LASTEXITCODE
    } finally {
        foreach ($name in $originalEnvironment.Keys) { [Environment]::SetEnvironmentVariable($name, $originalEnvironment[$name], 'Process') }
        if (Test-Path -LiteralPath $cloudFile) { Remove-Item -LiteralPath $cloudFile }
        if (Test-Path -LiteralPath $sessionDirectory) { [IO.Directory]::Delete($sessionDirectory) }
    }
    exit $resultCode
} catch {
    Write-Error 'Credential vault operation failed. Existing credentials were not intentionally overwritten; inspect paths, account, permissions and inventory without printing secret values.' -ErrorAction Continue
    exit 1
}
