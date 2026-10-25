# Test audio

Put Abrham's recording here as `nouri_voice.wav` (16 kHz, mono, 16-bit PCM). WAV files in this folder
are git-ignored, since recordings of someone's voice shouldn't be committed.

```powershell
.\scripts\test-voice.ps1 -Wav .\hardware\test-audio\nouri_voice.wav
```

The reply (when speech generation is configured) is saved next to it as `nouri_reply.wav`.
