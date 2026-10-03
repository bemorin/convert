"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { engineURLs, explainEngineError } from "./engine-config";
import type { AudioFormat } from "./audio";

type Progress = (fraction: number) => void;
let runtime: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;
let lastEngineLog = "";

const mime: Record<AudioFormat, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  flac: "audio/flac",
};

async function verifyAsset(url: string) {
  let response: Response;
  try {
    // A HEAD check avoids transferring the large .wasm file twice.
    response = await fetch(url, { method: "HEAD", cache: "no-store" });
  } catch (error) {
    throw new Error(`Cannot reach local FFmpeg asset ${new URL(url).pathname}: ${String(error)}`);
  }
  if (!response.ok) {
    throw new Error(`Missing FFmpeg asset ${new URL(url).pathname} (HTTP ${response.status}).`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("text/html")) {
    throw new Error(`Missing FFmpeg asset ${new URL(url).pathname}: server returned HTML instead of a file.`);
  }
}

export async function getRuntime(): Promise<FFmpeg> {
  if (runtime?.loaded) return runtime;
  if (loading) return loading;
  const instance = new FFmpeg();
  runtime = instance;
  lastEngineLog = "";
  instance.on("log", ({ type, message }) => {
    if (type === "stderr") lastEngineLog = message.slice(0, 400);
  });
  loading = (async () => {
    const urls = engineURLs(window.location.origin);
    await Promise.all([
      verifyAsset(urls.coreURL),
      verifyAsset(urls.wasmURL),
      verifyAsset(urls.classWorkerURL),
      ...urls.dependencies.map(verifyAsset),
    ]);
    // Key fix: a self-hosted, UNBUNDLED module worker + ESM core.
    // With Next.js, the default worker may rewrite dynamic import(coreURL).
    // Pass absolute URLs because FFmpeg resolves classWorkerURL vs import.meta.url.
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        instance.load({
          coreURL: urls.coreURL,
          wasmURL: urls.wasmURL,
          classWorkerURL: urls.classWorkerURL,
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(() => reject(new Error("FFmpeg initialization timed out after 90 seconds. Check the browser console and Network tab.")), 90_000);
        }),
      ]);
    } finally {
      clearTimeout(timeout);
    }
    return instance;
  })();
  try {
    return await loading;
  } catch (error) {
    instance.terminate();
    runtime = null;
    throw new Error(explainEngineError(error), { cause: error });
  } finally {
    loading = null;
  }
}

/** One operation at a time: FFmpeg has a shared in-memory filesystem. */
export async function convertFile(
  file: File,
  source: AudioFormat,
  target: AudioFormat,
  progress?: Progress,
): Promise<Blob> {
  if (source === target) throw new Error("The input is already in that format.");
  const ffmpeg = await getRuntime();
  const uid = crypto.randomUUID();
  const input = `${uid}-input.${source}`;
  const output = `${uid}-output.${target}`;
  const onProgress = ({ progress: value }: { progress: number }) => {
    if (Number.isFinite(value)) progress?.(Math.max(0, Math.min(0.95, value * 0.95)));
  };
  ffmpeg.on("progress", onProgress);

  try {
    await ffmpeg.writeFile(input, await fetchFile(file));
    const encoder =
      target === "mp3"
        ? ["-c:a", "libmp3lame", "-b:a", "320k"]
        : target === "flac"
          ? ["-c:a", "flac"]
          : ["-c:a", "pcm_s32le"];
    lastEngineLog = "";
    const exit = await ffmpeg.exec(["-hide_banner", "-i", input, "-vn", "-map_metadata", "0", ...encoder, output]);
    if (exit !== 0) {
      const reason = lastEngineLog || "The source codec or target encoder may be unsupported.";
      throw new Error(`FFmpeg exited with code ${exit}: ${reason}`);
    }
    const result = await ffmpeg.readFile(output);
    if (typeof result === "string" || !result.byteLength) {
      throw new Error("FFmpeg did not produce a valid output file.");
    }
    const bytes = new Uint8Array(result.byteLength);
    bytes.set(result);
    progress?.(1);
    return new Blob([bytes], { type: mime[target] });
  } catch (error) {
    const underlying = error instanceof Error ? error.message : String(error);
    const reason = underlying.includes("FFmpeg exited") || !lastEngineLog
      ? underlying
      : `${underlying}. FFmpeg: ${lastEngineLog}`;
    throw new Error(explainEngineError(reason), { cause: error });
  } finally {
    ffmpeg.off("progress", onProgress);
    await Promise.allSettled([ffmpeg.deleteFile(input), ffmpeg.deleteFile(output)]);
  }
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
