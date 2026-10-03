export type AudioFormat = "wav" | "mp3" | "flac";
export const FORMATS: readonly AudioFormat[] = ["wav", "mp3", "flac"];
import { MAX_BYTES } from "./limits.ts";
export { MAX_BYTES, WAVEFORM_MAX_BYTES } from "./limits.ts";

export type SelectedAudio = {
  file: File;
  format: AudioFormat;
  id: number;
};

/** Inspect file signatures, not just filenames or browser-supplied MIME types. */
export async function inspectAudio(file: File): Promise<AudioFormat> {
  if (file.size === 0) throw new Error("This file is empty.");
  if (file.size > MAX_BYTES) throw new Error(`Choose a file smaller than ${bytesLabel(MAX_BYTES)} for browser conversion.`);

  const bytes = new Uint8Array(await file.slice(0, 64).arrayBuffer());
  const ascii = (start: number, end: number) => String.fromCharCode(...bytes.slice(start, end));
  if ((ascii(0, 4) === "RIFF" || ascii(0, 4) === "RF64") && ascii(8, 12) === "WAVE") return "wav";
  if (ascii(0, 4) === "fLaC") return "flac";
  if (ascii(0, 3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)) return "mp3";
  throw new Error("This doesn't appear to be a supported WAV, MP3, or FLAC file.");
}

export function otherFormats(format: AudioFormat): [AudioFormat, AudioFormat] {
  return FORMATS.filter((item) => item !== format) as [AudioFormat, AudioFormat];
}

export function bytesLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  const rank = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), 3);
  const value = bytes / 1024 ** rank;
  return `${value >= 100 ? value.toFixed(0) : value.toFixed(1)} ${units[rank - 1]}`;
}

export function timeLabel(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const rounded = Math.floor(seconds);
  const mins = Math.floor(rounded / 60);
  const secs = rounded % 60;
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

/** Distinguish genuinely lossless conversions from formats that merely have a lossless container. */
export function targetCopy(source: AudioFormat, target: AudioFormat) {
  if (target === "mp3") return { sub: "320 kbps · high quality", detail: "Smaller file · lossy" };
  if (target === "flac") {
    return source === "mp3"
      ? { sub: "Compressed · larger than MP3", detail: "Cannot restore MP3 detail" }
      : { sub: "Lossless for integer PCM", detail: "Original PCM quality preserved" };
  }
  return source === "mp3"
    ? { sub: "32-bit PCM · uncompressed", detail: "Cannot restore MP3 detail" }
    : { sub: "32-bit PCM · uncompressed", detail: "Preserves supported PCM precision" };
}

export function downloadName(filename: string, target: AudioFormat): string {
  const basename = filename.replace(/\.[^.]+$/, "") || "audio";
  return `${basename}.${target}`;
}

/** Compute actual per-bin audio peaks; no random / fabricated waveform. */
export function peaksFromBuffer(buffer: AudioBuffer, bins = 132): number[] {
  const length = buffer.length;
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i));
  const peaks: number[] = [];
  for (let i = 0; i < bins; i++) {
    const start = Math.floor((i / bins) * length);
    const end = Math.max(start + 1, Math.floor(((i + 1) / bins) * length));
    const step = Math.max(1, Math.floor((end - start) / 128));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j += step) {
      for (const channel of channels) sum += Math.abs(channel[j] ?? 0);
      count += channels.length;
    }
    peaks.push(count ? sum / count : 0);
  }
  const max = Math.max(...peaks, 0.0001);
  // Contrast expansion gives quiet passages a legible shape, without changing source data.
  return peaks.map((peak) => Math.max(0.07, Math.min(1, Math.pow(peak / max, 0.75))));
}
