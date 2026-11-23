# Generates synthetic speech in memory. Never records the microphone or reads audio files.
# Requires the demo server. Bills one synthetic voiceprint, identification and transcription.
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Speech
$demoSynth = [System.Speech.Synthesis.SpeechSynthesizer]::new()
$demoMemory = [IO.MemoryStream]::new()
try {
    $demoJapanese = $demoSynth.GetInstalledVoices() | Where-Object { $_.Enabled -and $_.VoiceInfo.Culture.Name -like 'ja-*' } | Select-Object -First 1
    if ($demoJapanese) {
        $demoSynth.SelectVoice($demoJapanese.VoiceInfo.Name)
        $demoText = 'これは書き起こしのテストです。明日の会議は午前十時に始まります。資料を三部用意してください。'
    } else {
        $demoText = 'This is a transcription test. The meeting begins at ten tomorrow morning. Please prepare three copies of the document.'
    }
    $demoFormat = [System.Speech.AudioFormat.SpeechAudioFormatInfo]::new(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
    $demoSynth.SetOutputToAudioStream($demoMemory, $demoFormat)
    $demoSynth.Speak($demoText)
    $demoSynth.SetOutputToNull()
    $demoData = $demoMemory.ToArray()
    if (-not $demoData -or $demoData.Length -gt 640000) { throw 'Synthetic speech must be nonempty and shorter than 20 seconds.' }
    # Pad with silence to exactly 20 seconds of 16-kHz mono PCM16.
    $demoPadded = [IO.MemoryStream]::new()
    $demoWriter = [IO.BinaryWriter]::new($demoPadded)
    try {
        $demoWriter.Write([Text.Encoding]::ASCII.GetBytes('RIFF'))
        $demoWriter.Write([uint32](36 + 640000))
        $demoWriter.Write([Text.Encoding]::ASCII.GetBytes('WAVEfmt '))
        $demoWriter.Write([uint32]16)
        $demoWriter.Write([uint16]1)
        $demoWriter.Write([uint16]1)
        $demoWriter.Write([uint32]16000)
        $demoWriter.Write([uint32]32000)
        $demoWriter.Write([uint16]2)
        $demoWriter.Write([uint16]16)
        $demoWriter.Write([Text.Encoding]::ASCII.GetBytes('data'))
        $demoWriter.Write([uint32]640000)
        $demoWriter.Write($demoData)
        $demoWriter.Write([byte[]]::new(640000 - $demoData.Length))
        $demoClock = [Diagnostics.Stopwatch]::StartNew()
        $demoHeaders = @{ 'X-Demo-Session' = [guid]::NewGuid().ToString() }
        $demoEnrollResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:4175/enroll?label=Synthetic1' -Method Post -Headers $demoHeaders -ContentType 'audio/wav' -Body $demoPadded.ToArray() -TimeoutSec 330 -SkipHttpErrorCheck
        $demoEnroll = $demoEnrollResponse.Content | ConvertFrom-Json
        if ($demoEnrollResponse.StatusCode -ne 200) {
            [pscustomobject]@{ Stage = 'synthetic-enrollment'; HttpStatus = [int]$demoEnrollResponse.StatusCode; Code = $demoEnroll.code } | ConvertTo-Json -Compress
            exit 1
        }
        $demoResponse = Invoke-WebRequest -Uri 'http://127.0.0.1:4175/transcribe' -Method Post -Headers $demoHeaders -ContentType 'audio/wav' -Body $demoPadded.ToArray() -TimeoutSec 330 -SkipHttpErrorCheck
        $demoResult = $demoResponse.Content | ConvertFrom-Json
        $demoHasText = -not [string]::IsNullOrWhiteSpace($demoResult.text)
        $demoSegments = @($demoResult.segments).Where({ $null -ne $_ })
        [pscustomobject]@{
            Fixture = 'synthetic-speech-20s'
            HttpStatus = [int]$demoResponse.StatusCode
            Duration = $demoResult.duration
            NonemptyTranscript = $demoHasText
            SegmentCount = $demoSegments.Count
            AllSegmentsLabeled = ($demoSegments.Count -gt 0 -and @($demoSegments | Where-Object { -not $_.speaker }).Count -eq 0)
            ErrorCode = $demoResult.code
            SpeakerErrorCode = $demoResult.speakerError.code
            MatchedSegments = @($demoSegments | Where-Object { $_.match -eq 'Synthetic1' }).Count
            TranscriptionModel = $demoResult.models.transcription
            SpeakerModel = $demoResult.models.speaker
            ElapsedMs = $demoClock.ElapsedMilliseconds
        } | ConvertTo-Json -Compress
        if ($demoResponse.StatusCode -ne 200 -or -not $demoHasText -or $demoSegments.Count -eq 0 -or $demoResult.speakerError) { exit 1 }
    } finally {
        if ($demoHeaders) { $null = Invoke-WebRequest -Uri 'http://127.0.0.1:4175/voices' -Method Delete -Headers $demoHeaders -TimeoutSec 10 -SkipHttpErrorCheck }
        $demoWriter.Dispose()
        $demoPadded.Dispose()
    }
} finally {
    $demoSynth.Dispose()
    $demoMemory.Dispose()
}
