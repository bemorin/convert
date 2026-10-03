/** Validate the generated FFmpeg assets before development or deployment. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('public/ffmpeg');
const maxAssetBytes = 25 * 1024 * 1024;
for (const name of [
  'core/ffmpeg-core.js', 'core/wasm-manifest.json',
  'lib/worker.js', 'lib/const.js', 'lib/errors.js', 'version.json',
]) {
  const info = await stat(resolve(root, name));
  assert(info.size > 0 && info.size <= maxAssetBytes, `Invalid Cloudflare asset: ${name}`);
}
const manifest = JSON.parse(await readFile(resolve(root, 'core/wasm-manifest.json'), 'utf8'));
assert.equal(manifest.schema, 1);
assert(Array.isArray(manifest.parts) && manifest.parts.length > 0);
let length = 0;
for (const part of manifest.parts) {
  assert.match(part.file, /^ffmpeg-core\.wasm\.part-\d{2,3}$/);
  const bytes = await readFile(resolve(root, 'core', part.file));
  assert(bytes.byteLength > 0 && bytes.byteLength <= maxAssetBytes);
  assert.equal(bytes.byteLength, part.size);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), part.sha256);
  length += bytes.byteLength;
  console.log(`${part.file}: ${(part.size / 1024 / 1024).toFixed(1)} MiB`);
}
assert.equal(length, manifest.totalBytes, 'Incomplete WASM file.');
const core = await readFile(resolve(root, 'core/ffmpeg-core.js'), 'utf8');
const worker = await readFile(resolve(root, 'lib/worker.js'), 'utf8');
assert(core.includes('export default'), 'Expected unbundled ESM FFmpeg core.');
assert(worker.includes('import('), 'Expected unbundled ESM FFmpeg worker.');
console.log('All FFmpeg assets satisfy the Cloudflare Pages per-file limit.');
