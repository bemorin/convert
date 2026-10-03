/** CI/deploy smoke check after npm install. */
import { stat, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
const files = [
  'core/ffmpeg-core.js', 'core/ffmpeg-core.wasm',
  'lib/worker.js', 'lib/const.js', 'lib/errors.js', 'version.json',
];
for (const file of files) {
  const path = resolve('public/ffmpeg', file);
  const info = await stat(path);
  assert(info.size > 0, `Empty asset: ${file}`);
  console.log(`${file}: ${(info.size / 1024).toFixed(1)} KiB`);
}
const core = await readFile(resolve('public/ffmpeg/core/ffmpeg-core.js'), 'utf8');
const worker = await readFile(resolve('public/ffmpeg/lib/worker.js'), 'utf8');
assert(core.includes('export default'), 'Expected ESM FFmpeg core, not UMD');
assert(worker.includes('import('), 'Expected original ESM FFmpeg worker, not bundled/minified');
console.log('FFmpeg asset smoke check passed.');
