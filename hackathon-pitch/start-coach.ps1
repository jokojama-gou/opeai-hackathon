[CmdletBinding()]
param(
    [string]$ProductPath,
    [string]$ProductUrl,
    [switch]$Check
)

$ErrorActionPreference = 'Stop'
$coachRoot = $PSScriptRoot
$skillPath = Join-Path $coachRoot 'skill/hackathon-pitch-coach/SKILL.md'
$requiredFiles = @('AGENTS.md', 'event-rules.md', 'event-open-questions.md', 'day-of-details.md', 'working-draft.md')
foreach ($fileName in $requiredFiles) {
    if (-not (Test-Path -LiteralPath (Join-Path $coachRoot $fileName) -PathType Leaf)) {
        throw "必要な資料がありません: $fileName"
    }
}
if (-not (Test-Path -LiteralPath $skillPath -PathType Leaf)) {
    throw "スキルがありません: $skillPath"
}

$resolvedProduct = $null
if ($ProductPath) {
    $resolvedProduct = (Resolve-Path -LiteralPath $ProductPath -ErrorAction Stop).ProviderPath
}
if ($ProductUrl) {
    $parsedUrl = $null
    if (-not [Uri]::TryCreate($ProductUrl, [UriKind]::Absolute, [ref]$parsedUrl) -or $parsedUrl.Scheme -notin @('http', 'https')) {
        throw 'ProductUrlにはhttpまたはhttpsのURLを指定してください。'
    }
}

$codexCommand = Get-Command codex -ErrorAction Stop
if ($Check) {
    [PSCustomObject]@{
        Status = 'Ready'
        Workspace = $coachRoot
        Skill = $skillPath
        Codex = $codexCommand.Source
        ProductPath = $resolvedProduct
        ProductUrl = $ProductUrl
        Note = '起動前チェックのみ。AIとの対話・製品確認は未実行。'
    }
    return
}

$promptLines = @(
    "次のスキルファイルを読んで、今回の発表コーチとして対話を始めてください: $skillPath",
    '大会の未定項目はそのまま進めてください。既存の作業メモがあれば続きから再開してください。'
)
if ($resolvedProduct) { $promptLines += "製品の参照先（読み取り用）: $resolvedProduct" }
if ($ProductUrl) { $promptLines += "製品URL（参照情報）: $ProductUrl" }
$promptLines += 'まず製品の根拠を確認し、発表の切り口を一緒に考えたいです。'

# 引数として渡し、入力パスやURLをシェルコードとして評価しない。
& $codexCommand.Source -C $coachRoot ($promptLines -join "`n")
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
