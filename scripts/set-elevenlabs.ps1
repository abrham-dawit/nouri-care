<#
  Saves the ElevenLabs API key and voice ID into .env.local (git-ignored), without showing the key.
  Run from the nouri-care folder:   .\scripts\set-elevenlabs.ps1
  Then restart the server so it loads them.
#>
$ErrorActionPreference = "Stop"
$envFile = Join-Path (Split-Path $PSScriptRoot -Parent) ".env.local"
if (-not (Test-Path $envFile)) { throw "Can't find $envFile" }

$secure = Read-Host "Paste your ElevenLabs API key (hidden), then press Enter" -AsSecureString
$bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
$key = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr).Trim()
[Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
$voice = (Read-Host "Paste your ElevenLabs voice ID, then press Enter").Trim()
if (-not $key -or -not $voice) { throw "Both values are needed. Nothing was saved." }

$lines = [IO.File]::ReadAllLines($envFile)
$set = @{ "ELEVENLABS_API_KEY" = $key; "ELEVENLABS_VOICE_ID" = $voice }
foreach ($name in @($set.Keys)) {
  $found = $false
  for ($i = 0; $i -lt $lines.Length; $i++) {
    if ($lines[$i] -match "^\s*$name\s*=") { $lines[$i] = "$name=$($set[$name])"; $found = $true }
  }
  if (-not $found) { $lines += "$name=$($set[$name])" }
}
[IO.File]::WriteAllLines($envFile, $lines, (New-Object Text.UTF8Encoding($false)))
$key = $null

Write-Host "Saved to $envFile" -ForegroundColor Green
Select-String -Path $envFile -Pattern '^ELEVENLABS_' | ForEach-Object {
  $n, $v = $_.Line -split '=', 2
  Write-Host ("  {0} length={1}" -f $n, $v.Length)
}
Write-Host "Now restart the server: Ctrl+C in its terminal, then  npm.cmd run dev -- -H 0.0.0.0"
