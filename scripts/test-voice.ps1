<#
  Sends a WAV recording to Nouri's backend exactly like the ESP32 will, prints the result,
  and downloads the spoken reply (if speech generation is available).

  Works in Windows PowerShell 5.1 and PowerShell 7.

  Example:
    $env:NOURI_DEVICE_TOKEN = "<credential from: npm run device:issue -- nouri-001>"
    .\scripts\test-voice.ps1 -Wav .\hardware\test-audio\nouri_voice.wav

  Options:
    -Server          Backend URL (default http://localhost:3000). From another machine use the PC's LAN IP.
    -Confirm         "all" or "none": answer the "should I save this?" question after the reply.
    -TestTranscript  Pretend the audio said this (only when the server runs without an OpenAI key
                     and was started with NOURI_ALLOW_TEST_TRANSCRIPT=1).
#>
param(
  [Parameter(Mandatory = $true)][string]$Wav,
  [string]$Server = "http://localhost:3000",
  [string]$Token = $env:NOURI_DEVICE_TOKEN,
  [ValidateSet("", "all", "none")][string]$Confirm = "",
  [string]$TestTranscript = ""
)

$ErrorActionPreference = "Stop"
if (-not $Token) { throw "No device credential. Set `$env:NOURI_DEVICE_TOKEN or pass -Token (create one with: npm run device:issue -- nouri-001)." }
$wavPath = (Resolve-Path $Wav).Path
$bytes = [IO.File]::ReadAllBytes($wavPath)
Write-Host "Sending $([IO.Path]::GetFileName($wavPath)) ($($bytes.Length) bytes) to $Server/api/v1/voice ..."

Add-Type -AssemblyName System.Net.Http
$client = New-Object System.Net.Http.HttpClient
$client.Timeout = [TimeSpan]::FromSeconds(90)

function Invoke-Nouri([string]$Method, [string]$Url, $Content) {
  $req = New-Object System.Net.Http.HttpRequestMessage((New-Object System.Net.Http.HttpMethod($Method)), $Url)
  $req.Headers.TryAddWithoutValidation("Authorization", "Bearer $Token") | Out-Null
  if ($TestTranscript) { $req.Headers.TryAddWithoutValidation("X-Nouri-Test-Transcript", $TestTranscript) | Out-Null }
  if ($Content) { $req.Content = $Content }
  return $client.SendAsync($req).Result
}

$content = New-Object System.Net.Http.ByteArrayContent(, $bytes)
$content.Headers.TryAddWithoutValidation("Content-Type", "audio/wav") | Out-Null
$watch = [Diagnostics.Stopwatch]::StartNew()
$res = Invoke-Nouri "POST" "$Server/api/v1/voice" $content
$body = $res.Content.ReadAsStringAsync().Result
$watch.Stop()

if (-not $res.IsSuccessStatusCode) {
  Write-Host "`nFAILED: HTTP $([int]$res.StatusCode)" -ForegroundColor Red
  Write-Host $body
  exit 1
}

$r = $body | ConvertFrom-Json
Write-Host "`nOK in $($watch.ElapsedMilliseconds) ms" -ForegroundColor Green
Write-Host "  interaction_id : $($r.interaction_id)"
Write-Host "  audio received : $($r.audio.sample_rate) Hz, $($r.audio.channels) ch, $($r.audio.bits_per_sample)-bit, $($r.audio.duration_s) s"
Write-Host "  transcript     : $($r.transcript)"
Write-Host "  reply          : $($r.reply)"
Write-Host "  checkin_saved  : $($r.checkin_saved)"
if ($r.stt.note) { Write-Host "  speech-to-text : $($r.stt.note)" -ForegroundColor Yellow }
if ($r.pending_observations.Count) {
  Write-Host "  waiting for the patient to confirm:"
  $r.pending_observations | ForEach-Object { Write-Host "    - $($_.description)   (heard: `"$($_.quote)`")" }
}

if ($r.audio_url) {
  $out = Join-Path (Split-Path $wavPath) "nouri_reply.wav"
  $audio = Invoke-Nouri "GET" $r.audio_url $null
  if ($audio.IsSuccessStatusCode) {
    [IO.File]::WriteAllBytes($out, $audio.Content.ReadAsByteArrayAsync().Result)
    Write-Host "  reply audio    : saved to $out (16 kHz mono 16-bit WAV)" -ForegroundColor Green
  } else {
    Write-Host "  reply audio    : download failed (HTTP $([int]$audio.StatusCode))" -ForegroundColor Yellow
  }
} else {
  Write-Host "  reply audio    : none ($($r.tts.error))" -ForegroundColor Yellow
}

if ($Confirm -and $r.confirmation_required) {
  $json = New-Object System.Net.Http.StringContent("{`"accept`":`"$Confirm`"}", [Text.Encoding]::UTF8, "application/json")
  $c = Invoke-Nouri "POST" "$Server/api/v1/voice/$($r.interaction_id)/confirm" $json
  Write-Host "`nConfirm ($Confirm): HTTP $([int]$c.StatusCode) $($c.Content.ReadAsStringAsync().Result)"
}
