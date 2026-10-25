/**
 * Minimal WAV (RIFF) tools for device audio: strict parsing of 16-bit PCM uploads, resampling,
 * and encoding replies as 16 kHz mono 16-bit PCM for the ESP32 to play.
 */

export type WavInfo = {
  sampleRate: number;
  channels: number;
  bitsPerSample: number;
  dataOffset: number;
  dataBytes: number;
  durationSec: number;
  /** Root-mean-square level of the first channel, 0..1 (used to spot silent recordings). */
  rms: number;
};

export class WavError extends Error {}

/** Parses the RIFF chunks properly (header isn't always exactly 44 bytes). */
export function parseWav(buf: Buffer): WavInfo {
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    throw new WavError("Not a WAV file (missing RIFF/WAVE header).");
  }
  let pos = 12;
  let fmt: { format: number; channels: number; sampleRate: number; bits: number } | null = null;
  let data: { offset: number; bytes: number } | null = null;
  while (pos + 8 <= buf.length) {
    const id = buf.toString("ascii", pos, pos + 4);
    const size = buf.readUInt32LE(pos + 4);
    const body = pos + 8;
    if (id === "fmt ") {
      if (size < 16) throw new WavError("Malformed fmt chunk.");
      fmt = { format: buf.readUInt16LE(body), channels: buf.readUInt16LE(body + 2), sampleRate: buf.readUInt32LE(body + 4), bits: buf.readUInt16LE(body + 14) };
    } else if (id === "data") {
      // Some recorders write a placeholder size; clamp to what was actually sent.
      data = { offset: body, bytes: Math.min(size, buf.length - body) };
      break;
    }
    pos = body + size + (size % 2);
  }
  if (!fmt) throw new WavError("WAV has no fmt chunk.");
  if (!data) throw new WavError("WAV has no data chunk.");
  if (fmt.format !== 1) throw new WavError(`Only uncompressed PCM is supported (format ${fmt.format}).`);
  if (fmt.bits !== 16) throw new WavError(`Only 16-bit samples are supported (got ${fmt.bits}-bit).`);
  if (fmt.channels < 1 || fmt.channels > 2) throw new WavError(`Expected mono or stereo (got ${fmt.channels} channels).`);
  if (fmt.sampleRate < 8000 || fmt.sampleRate > 48000) throw new WavError(`Sample rate ${fmt.sampleRate} Hz is out of range (8–48 kHz).`);

  const frame = fmt.channels * 2;
  const frames = Math.floor(data.bytes / frame);
  let sum = 0;
  for (let i = 0; i < frames; i++) {
    const s = buf.readInt16LE(data.offset + i * frame) / 32768;
    sum += s * s;
  }
  return {
    sampleRate: fmt.sampleRate,
    channels: fmt.channels,
    bitsPerSample: fmt.bits,
    dataOffset: data.offset,
    dataBytes: frames * frame,
    durationSec: frames / fmt.sampleRate,
    rms: frames ? Math.sqrt(sum / frames) : 0,
  };
}

/** Resamples mono 16-bit PCM with a short low-pass then linear interpolation (good enough for speech). */
export function resample(input: Int16Array, from: number, to: number): Int16Array {
  if (from === to) return input;
  let src: Float32Array = Float32Array.from(input);
  if (to < from) {
    // 5-tap moving average ≈ low-pass to reduce aliasing when downsampling
    const f = new Float32Array(src.length);
    for (let i = 0; i < src.length; i++) {
      let acc = 0, n = 0;
      for (let k = -2; k <= 2; k++) {
        const j = i + k;
        if (j >= 0 && j < src.length) { acc += src[j] * (k === 0 ? 2 : 1); n += k === 0 ? 2 : 1; }
      }
      f[i] = acc / n;
    }
    src = f;
  }
  const outLen = Math.floor((src.length * to) / from);
  const out = new Int16Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const p = (i * from) / to;
    const i0 = Math.floor(p), i1 = Math.min(src.length - 1, i0 + 1), t = p - i0;
    out[i] = Math.max(-32768, Math.min(32767, Math.round(src[i0] * (1 - t) + src[i1] * t)));
  }
  return out;
}

/** 16-bit PCM WAV with the standard 44-byte header. */
export function encodeWav(samples: Int16Array, sampleRate: number, channels = 1): Buffer {
  const dataBytes = samples.length * 2;
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * channels * 2, 28);
  buf.writeUInt16LE(channels * 2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataBytes, 40);
  for (let i = 0; i < samples.length; i++) buf.writeInt16LE(samples[i], 44 + i * 2);
  return buf;
}

/** The first channel of a parsed WAV as 16-bit samples. */
export function monoSamples(buf: Buffer, info: WavInfo): Int16Array {
  const frame = info.channels * 2;
  const out = new Int16Array(info.dataBytes / frame);
  for (let i = 0; i < out.length; i++) out[i] = buf.readInt16LE(info.dataOffset + i * frame);
  return out;
}

/** Raw little-endian 16-bit PCM bytes → samples. */
export function pcm16(buf: Buffer): Int16Array {
  const out = new Int16Array(Math.floor(buf.length / 2));
  for (let i = 0; i < out.length; i++) out[i] = buf.readInt16LE(i * 2);
  return out;
}
