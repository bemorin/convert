import type { AudioFormat } from "./audio";
import { MAX_BATCH_ESTIMATED_OUTPUT_BYTES } from "./limits.ts";
export { MAX_BATCH_ESTIMATED_OUTPUT_BYTES } from "./limits.ts";

// MP3 uses a fixed 320 kbps encoder; WAV export uses 32-bit PCM.
// FLAC is content-dependent: show a range, never mislabel it as an exact result.
export type AudioFacts = { duration?: number; sampleRate?: number; channels?: number };
export type Estimate = {
  lowerBytes: number;
  upperBytes: number;
  expectedBytes: number;
  confidence: "exact" | "close" | "range";
};
export type EstimableItem = {
  file: { size: number };
  format: AudioFormat;
  facts?: AudioFacts;
  completed?: Partial<Record<AudioFormat, { size: number }>>;
};
const MB = 1024 * 1024;
const archiveOverhead = (count: number) => count * 4096 + 16 * 1024;

/** Header readers avoid decoding entire recordings just to display a size estimate. */
function readWav(bytes: Uint8Array, fileSize: number): AudioFacts {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (i: number, n: number) => String.fromCharCode(...bytes.subarray(i, i + n));
  let channels: number | undefined, sampleRate: number | undefined, byteRate: number | undefined, dataSize: number | undefined;
  for (let pos = 12; pos + 8 <= bytes.length;) {
    const id = ascii(pos, 4);
    const len = dv.getUint32(pos + 4, true);
    if (id === "fmt " && len >= 16 && pos + 24 <= bytes.length) {
      channels = dv.getUint16(pos + 10, true);
      sampleRate = dv.getUint32(pos + 12, true);
      byteRate = dv.getUint32(pos + 16, true);
    }
    if (id === "data") {
      // The input may be RF64 or have a truncated preview header; do not guess the size.
      dataSize = len === 0xffffffff ? undefined : Math.min(len, Math.max(0, fileSize - pos - 8));
      break;
    }
    if (len > fileSize || pos + 8 + len > fileSize) break;
    pos += 8 + len + (len % 2);
  }
  const duration = byteRate && dataSize !== undefined ? dataSize / byteRate : undefined;
  return { channels, sampleRate, duration };
}
function readFlac(bytes: Uint8Array): AudioFacts {
  // STREAMINFO is the first metadata block in compliant FLAC files.
  if (bytes.length < 26 || String.fromCharCode(...bytes.subarray(0, 4)) !== "fLaC" || (bytes[4] & 0x7f) !== 0) return {};
  const blockLength = (bytes[5] << 16) | (bytes[6] << 8) | bytes[7];
  if (blockLength < 34) return {};
  const sampleRate = (bytes[18] << 12) | (bytes[19] << 4) | (bytes[20] >> 4);
  const channels = ((bytes[20] >> 1) & 7) + 1;
  const totalSamples = (bytes[21] & 15) * 2 ** 32 + bytes[22] * 2 ** 24 + bytes[23] * 2 ** 16 + bytes[24] * 256 + bytes[25];
  return { sampleRate: sampleRate || undefined, channels, duration: sampleRate && totalSamples ? totalSamples / sampleRate : undefined };
}
function readMp3(bytes: Uint8Array, size: number): AudioFacts {
  let start = 0;
  if (bytes[0] === 73 && bytes[1] === 68 && bytes[2] === 51 && bytes.length >= 10) {
    const tagLength = ((bytes[6] & 127) << 21) | ((bytes[7] & 127) << 14) | ((bytes[8] & 127) << 7) | (bytes[9] & 127);
    start = 10 + tagLength + (bytes[5] & 16 ? 10 : 0);
  }
  for (let p = start; p + 4 <= bytes.length; p++) {
    if (bytes[p] !== 0xff || (bytes[p + 1] & 0xe0) !== 0xe0) continue;
    const version = (bytes[p + 1] >> 3) & 3, layer = (bytes[p + 1] >> 1) & 3;
    const bitrateIdx = (bytes[p + 2] >> 4) & 15, freqIdx = (bytes[p + 2] >> 2) & 3;
    if (version === 1 || layer !== 1 || bitrateIdx === 0 || bitrateIdx === 15 || freqIdx === 3) continue;
    const rates = version === 3 ? [44100, 48000, 32000] : version === 2 ? [22050, 24000, 16000] : [11025, 12000, 8000];
    const bitrates = version === 3
      ? [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
      : [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
    // Frame-derived duration is deliberately just a fallback for non-VBR streams;
    // browser metadata takes precedence when the browser can read the recording.
    const markerWindow = String.fromCharCode(...bytes.subarray(p + 4, Math.min(bytes.length, p + 220)));
    const isVbr = markerWindow.includes("Xing") || markerWindow.includes("VBRI") || markerWindow.includes("Info");
    const duration = isVbr ? undefined : (size - start) * 8 / (bitrates[bitrateIdx] * 1000);
    return { sampleRate: rates[freqIdx], channels: (bytes[p + 3] >> 6) === 3 ? 1 : 2, duration };
  }
  return {};
}

/** Resolves progressively; a metadata failure only makes uncertain export sizes unavailable. */
export async function readAudioFacts(file: File, format: AudioFormat): Promise<AudioFacts> {
  const bytes = new Uint8Array(await file.slice(0, format === "mp3" ? 512 * 1024 : 64 * 1024).arrayBuffer());
  const fromHeader = format === "wav" ? readWav(bytes, file.size)
    : format === "flac" ? readFlac(bytes) : readMp3(bytes, file.size);
  const fromBrowser = await new Promise<number | undefined>((resolve) => {
    if (typeof document === "undefined") { resolve(undefined); return; }
    const element = document.createElement("audio");
    const url = URL.createObjectURL(file);
    let finished = false;
    const finish = (duration?: number) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      element.removeAttribute("src");
      element.load();
      URL.revokeObjectURL(url);
      resolve(duration && Number.isFinite(duration) && duration > 0 ? duration : undefined);
    };
    const timeout = setTimeout(() => finish(), 4500);
    element.preload = "metadata";
    element.onloadedmetadata = () => finish(element.duration);
    element.onerror = () => finish();
    element.src = url;
    element.load();
  });
  return { ...fromHeader, duration: fromBrowser ?? fromHeader.duration };
}

export function estimateItem(item: EstimableItem, target: AudioFormat): Estimate | null {
  const actual = item.completed?.[target];
  if (actual || item.format === target) {
    const size = actual?.size ?? item.file.size;
    return { lowerBytes: size, upperBytes: size, expectedBytes: size, confidence: "exact" };
  }
  const { duration, sampleRate, channels } = item.facts ?? {};
  if (!(duration && Number.isFinite(duration) && duration > 0)) return null;
  if (target === "mp3") {
    const size = duration * 320_000 / 8 + 32_768;
    return { lowerBytes: size * .985, upperBytes: size * 1.035, expectedBytes: size, confidence: "close" };
  }
  if (!sampleRate || !channels) return null;
  const pcm32 = duration * sampleRate * channels * 4 + 4096;
  if (target === "wav") return { lowerBytes: pcm32 * .999, upperBytes: pcm32 * 1.005, expectedBytes: pcm32, confidence: "close" };
  // FLAC entropy/compression varies with audio. This is a planning range,
  // not a promise and not an absolute mathematical bound on all recordings.
  return { lowerBytes: pcm32 * .20, upperBytes: pcm32 * 1.12 + 128 * 1024, expectedBytes: pcm32 * .55, confidence: "range" };
}

export function estimateBatch(items: readonly EstimableItem[], target: AudioFormat) {
  const estimates = items.map((item) => estimateItem(item, target));
  if (estimates.some((estimate) => !estimate)) {
    return { ready: false as const, allowed: false, reason: "Size unavailable: audio metadata is still loading or unsupported." };
  }
  const known = estimates as Estimate[];
  const lowerBytes = known.reduce((n, e) => n + e.lowerBytes, 0);
  const upperBytes = known.reduce((n, e) => n + e.upperBytes, 0) + archiveOverhead(items.length);
  const expectedBytes = known.reduce((n, e) => n + e.expectedBytes, 0) + archiveOverhead(items.length);
  const confidence = known.some((e) => e.confidence === "range") ? "range"
    : known.some((e) => e.confidence === "close") ? "close" : "exact";
  return {
    ready: true as const, lowerBytes, upperBytes, expectedBytes, confidence,
    allowed: upperBytes <= MAX_BATCH_ESTIMATED_OUTPUT_BYTES,
    reason: upperBytes > MAX_BATCH_ESTIMATED_OUTPUT_BYTES
      ? `Estimated ${target.toUpperCase()} ZIP could exceed the ${shortSize(MAX_BATCH_ESTIMATED_OUTPUT_BYTES)} browser safety limit. Try another format or export tracks individually.`
      : null,
  };
}

export function shortSize(bytes: number) {
  if (bytes < MB) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / MB).toFixed(bytes / MB >= 10 ? 0 : 1)} MB`;
}
export function estimateLabel(value: Estimate | ReturnType<typeof estimateBatch> | null): string {
  if (!value || ("ready" in value && !value.ready)) return "Calculating…";
  if (value.confidence === "exact") return shortSize(value.expectedBytes);
  if (value.confidence === "range") return `≈ ${shortSize(value.lowerBytes)}–${shortSize(value.upperBytes)}`;
  return `≈ ${shortSize(value.expectedBytes)}`;
}
