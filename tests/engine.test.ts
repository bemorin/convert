import test from 'node:test';
import assert from 'node:assert/strict';
import { engineURLs, explainEngineError } from '../lib/engine-config.ts';
import { parseWasmManifest } from '../lib/wasm-assets.ts';

test('worker and core use absolute same-origin static asset URLs', () => {
  const urls = engineURLs('http://localhost:3000/');
  assert.equal(urls.coreURL, 'http://localhost:3000/ffmpeg/core/ffmpeg-core.js');
  assert.equal(urls.wasmManifestURL, 'http://localhost:3000/ffmpeg/core/wasm-manifest.json');
  assert.equal(urls.wasmPartsBaseURL, 'http://localhost:3000/ffmpeg/core/');
  assert.equal(urls.classWorkerURL, 'http://localhost:3000/ffmpeg/lib/worker.js');
  assert.deepEqual(urls.dependencies, [
    'http://localhost:3000/ffmpeg/lib/const.js',
    'http://localhost:3000/ffmpeg/lib/errors.js',
  ]);
});

test('accepts a complete Cloudflare-safe WASM manifest', () => {
  const manifest = {
    schema: 1, totalBytes: 30,
    parts: [
      { file: 'ffmpeg-core.wasm.part-01', size: 20, sha256: 'a'.repeat(64) },
      { file: 'ffmpeg-core.wasm.part-02', size: 10, sha256: 'b'.repeat(64) },
    ],
  };
  assert.deepEqual(parseWasmManifest(manifest), manifest);
});

test('rejects incomplete, oversized or untrusted WASM manifests', () => {
  const part = { file: 'ffmpeg-core.wasm.part-01', size: 10, sha256: 'a'.repeat(64) };
  assert.throws(() => parseWasmManifest({ schema: 1, totalBytes: 9, parts: [part] }), /Incomplete/);
  assert.throws(() => parseWasmManifest({ schema: 1, totalBytes: 21 * 1024 * 1024,
    parts: [{ ...part, size: 21 * 1024 * 1024 }] }), /Invalid/);
  assert.throws(() => parseWasmManifest({ schema: 1, totalBytes: 10,
    parts: [{ ...part, file: '../../secret' }] }), /Invalid/);
});

test('diagnostics identify a missing deployment asset', () => {
  assert.match(explainEngineError(new Error('Missing FFmpeg asset /ffmpeg/core/wasm-manifest.json (HTTP 404).')), /deployment assets/);
});

test('diagnostics retain worker errors rather than hiding them', () => {
  assert.match(explainEngineError(new Error('failed to import ffmpeg-core.js')), /failed to import ffmpeg-core.js/);
});
