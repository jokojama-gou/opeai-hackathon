param([Parameter(Mandatory=$true)][string]$RepoRoot)
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path -LiteralPath $RepoRoot).Path
$issues = [Collections.Generic.List[string]]::new()
$managed = [Collections.Generic.List[string]]::new()
function Require-File([string]$relative) {
    $full = Join-Path $root $relative
    if (-not (Test-Path -LiteralPath $full -PathType Leaf)) { $issues.Add("Missing: $relative"); return $null }
    $managed.Add($full)
    return $full
}
foreach ($suffix in @('research','design','implement','review','handoff')) {
    $name = "aidd-lite-$suffix"
    $skill = Require-File ".agents/skills/$name/SKILL.md"
    if ($skill) {
        $body = [IO.File]::ReadAllText($skill)
        $fm = [regex]::Match($body, '\A---\r?\n(?<fields>.*?)\r?\n---(?:\r?\n|$)', 'Singleline')
        if (-not $fm.Success) { $issues.Add("Frontmatter: $name") }
        else {
            $fields = $fm.Groups['fields'].Value
            foreach ($key in @('name','description')) {
                $matches = [regex]::Matches($fields, "(?m)^${key}: (.+?)\r?$")
                if ($matches.Count -ne 1 -or [string]::IsNullOrWhiteSpace($matches[0].Groups[1].Value.Trim(' ', '"', "'"))) { $issues.Add("Field ${key}: $name") }
            }
            if ($fields -notmatch "(?m)^name: $([regex]::Escape($name))\r?$") { $issues.Add("Name mismatch: $name") }
        }
    }
    $ui = Require-File ".agents/skills/$name/agents/openai.yaml"
    if ($ui) {
        $yaml = [IO.File]::ReadAllText($ui)
        if ($yaml -notmatch '(?m)^interface:\r?$') { $issues.Add("UI interface: $name") }
        foreach ($key in @('display_name','short_description','default_prompt')) {
            $values = [regex]::Matches($yaml, "(?m)^  ${key}: `"([^`"\r\n]+)`"\r?$")
            if ($values.Count -ne 1) { $issues.Add("UI ${key}: $name") }
        }
        $prompt = [regex]::Match($yaml, '(?m)^  default_prompt: "([^"\r\n]+)"\r?$')
        if (-not $prompt.Success -or -not $prompt.Groups[1].Value.Contains('$' + $name)) { $issues.Add("UI prompt name: $name") }
        if ($yaml -notmatch '(?m)^policy:\r?\n  allow_implicit_invocation: true\r?$') { $issues.Add("UI policy: $name") }
    }
}
foreach ($doc in @('GUIDE.md','PROJECT_CHECKS.md','PROVENANCE.md','ACCEPTANCE.md','agents/researcher.md','agents/reviewer.md')) {
    $null = Require-File "docs/development/aidd-lite/$doc"
}
foreach ($path in $managed) {
    $body = [IO.File]::ReadAllText($path)
    if ($body -match '\[INSERT[^\]]*\]|\{\{[^}]+\}\}|REPLACE_ME') { $issues.Add("Scaffold: $path") }
    if ($path.EndsWith('.md')) {
        # Supported subset: inline Markdown links, without nested parentheses.
        # Fenced examples are excluded. Fragment targets/external URLs are not validated.
        $prose = [regex]::Replace($body, '(?ms)^(```|~~~)[^\r\n]*\r?\n.*?^\1[ \t]*\r?$', '')
        foreach ($link in [regex]::Matches($prose, '\[[^\]\r\n]+\]\(([^)\r\n]+)\)')) {
            $target = $link.Groups[1].Value.Trim('<','>')
            if ($target -match '^[a-zA-Z][a-zA-Z0-9+.-]*:|^#') { continue }
            $target = [Uri]::UnescapeDataString(($target -split '#',2)[0])
            if ($target -and -not (Test-Path -LiteralPath (Join-Path (Split-Path $path) $target))) { $issues.Add("Broken link: $path -> $target") }
        }
    }
}
if ($issues.Count) { $issues | ForEach-Object { Write-Output "FAIL $_" }; exit 1 }
Write-Output "PASS: $($managed.Count) managed files; supported metadata and local file links. Model behavior, anchors and external URLs are not checked."
Write-Output 'Full document and used-anchor check: node scripts/check-docs.mjs (separate from metadata checks).'
exit 0
