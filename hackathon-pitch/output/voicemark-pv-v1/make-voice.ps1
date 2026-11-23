param([switch]$Check)
$ErrorActionPreference = 'Stop'
$pvRoot = $PSScriptRoot
$story = Get-Content -LiteralPath (Join-Path $pvRoot 'story.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$voice = New-Object -ComObject SAPI.SpVoice
$voices = @($voice.GetVoices())
$tokens = @()
for ($i = 0; $i -lt $voice.GetVoices().Count; $i++) { $tokens += $voice.GetVoices().Item($i) }
$japanese = @($tokens | Where-Object { $_.GetDescription() -match 'Haruka|Ayumi|Sayaka|Ichiro' })
if ($japanese.Count -eq 0) { throw 'Japanese local speech voice unavailable' }
$voice.Voice = $japanese[0]
$voice.Volume = 100
$voice.Rate = 0
$cues = @($story.cues)
if ($Check) { $cues = @($cues[0]) }
for ($i = 0; $i -lt $cues.Count; $i++) {
    $cue = $cues[$i]
    $voice.Rate = if ($cue.speaker -eq 'ren') { -1 } elseif ($cue.speaker -eq 'aoi') { 1 } else { 0 }
    $file = Join-Path $pvRoot ('audio/voice-{0:d2}.wav' -f $i)
    $stream = New-Object -ComObject SAPI.SpFileStream
    $stream.Open($file, 3, $false)
    $voice.AudioOutputStream = $stream
    [void]$voice.Speak($cue.text)
    $stream.Close()
    Write-Output ('Rendered voice {0}/{1}' -f ($i + 1), $cues.Count)
}
