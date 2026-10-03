import test from 'node:test';
import assert from 'node:assert/strict';
import { engineURLs, explainEngineError } from '../lib/engine-config.ts';

test('worker and core use absolute same-origin ESM asset URLs', () => {
  const urls = engineURLs('http://localhost:3000/');
  assert.equal(urls.coreURL, 'http://localhost:3000/ffmpeg/core/ffmpeg-core.js');
  assert.equal(urls.wasmURL, 'http://localhost:3000/ffmpeg/core/ffmpeg-core.wasm');
  assert.equal(urls.classWorkerURL, 'http://localhost:3000/ffmpeg/lib/worker.js');
  assert.deepEqual(urls.dependencies, [
    'http://localhost:3000/ffmpeg/lib/const.js',
    'http://localhost:3000/ffmpeg/lib/errors.js',
  ]);
});

test('diagnostics identify a missing deployment asset', () => {
  assert.match(explainEngineError(new Error('Missing FFmpeg asset /ffmpeg/core/ffmpeg-core.wasm (HTTP 404).')), /npm install/);
});

test('diagnostics retain worker errors without replacing them with generic text', () => {
  assert.match(explainEngineError(new Error('failed to import ffmpeg-core.js')), /failed to import ffmpeg-core.js/);
});
