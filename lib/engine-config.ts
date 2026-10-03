/** Same-origin ESM FFmpeg assets. The WASM manifest contains deployment-safe chunks. */
export function engineURLs(origin: string) {
  const base = `${origin.replace(/\/$/, '')}/ffmpeg`;
  return {
    coreURL: `${base}/core/ffmpeg-core.js`,
    wasmManifestURL: `${base}/core/wasm-manifest.json`,
    wasmPartsBaseURL: `${base}/core/`,
    classWorkerURL: `${base}/lib/worker.js`,
    dependencies: [`${base}/lib/const.js`, `${base}/lib/errors.js`],
  };
}

/** Keep actionable diagnostics rather than hiding errors behind a retry message. */
export function explainEngineError(error: unknown): string {
  const detail = error instanceof Error ? error.message : String(error);
  if (/Missing FFmpeg asset|404|not found/i.test(detail)) {
    return `The local conversion engine is missing a file. Restart the app and check the deployment assets. (${detail})`;
  }
  if (/worker|import ffmpeg-core|module script|dynamically imported|Failed to fetch/i.test(detail)) {
    return `The conversion worker could not load. Check the browser network errors. (${detail})`;
  }
  if (/out of memory|allocation failed|memory access out of bounds/i.test(detail)) {
    return `The browser ran out of memory during conversion. Try a shorter audio file or close other tabs. (${detail})`;
  }
  return `Conversion failed: ${detail}`;
}
