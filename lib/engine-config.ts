/** Build same-origin absolute asset URLs for the *unbundled* FFmpeg module worker. */
export function engineURLs(origin: string) {
  const clean = origin.replace(/\/$/, '');
  return {
    coreURL: `${clean}/ffmpeg/core/ffmpeg-core.js`,
    wasmURL: `${clean}/ffmpeg/core/ffmpeg-core.wasm`,
    classWorkerURL: `${clean}/ffmpeg/lib/worker.js`,
    dependencies: [`${clean}/ffmpeg/lib/const.js`, `${clean}/ffmpeg/lib/errors.js`],
  };
}

/** Human-readable error without hiding the underlying worker/FFmpeg issue. */
export function explainEngineError(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  if (/Missing FFmpeg asset|404|not found/i.test(detail)) {
    return `The local conversion engine is missing a file. Run npm install, restart the app, then try again. (${detail})`;
  }
  if (/worker|import ffmpeg-core|module script|dynamically imported|Failed to fetch/i.test(detail)) {
    return `The conversion worker could not load. Restart the app after npm install and check browser network errors. (${detail})`;
  }
  if (/out of memory|allocation failed|memory access out of bounds/i.test(detail)) {
    return `The browser ran out of memory during conversion. Try a shorter audio file or close other tabs. (${detail})`;
  }
  return `Conversion failed: ${detail}`;
}
