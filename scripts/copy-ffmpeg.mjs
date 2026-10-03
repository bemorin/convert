/**
 * Prepare same-origin FFmpeg ESM assets for local development and static hosts.
 * Cloudflare Pages limits individual files to 25 MiB. The upstream WASM file
 * exceeds that, so publish independently cacheable chunks (20 MiB maximum)
 * and reassemble them in the browser before FFmpeg starts.
 *
 * Keep the original unbundled ESM worker, or its dynamic core import can break.
 */
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const destination = resolve('public/ffmpeg');
const chunkBytes = 20 * 1024 * 1024;
const entries = [
  ['@ffmpeg/core/dist/esm/ffmpeg-core.js', 'core/ffmpeg-core.js'],
  ['@ffmpeg/ffmpeg/dist/esm/worker.js', 'lib/worker.js'],
  ['@ffmpeg/ffmpeg/dist/esm/const.js', 'lib/const.js'],
  ['@ffmpeg/ffmpeg/dist/esm/errors.js', 'lib/errors.js'],
];

try {
  // This directory is entirely generated and gitignored. Remove stale assets
  // so publishing a new build never ships a redundant >25 MiB .wasm file.
  await rm(destination, { recursive: true, force: true });
  for (const [source, target] of entries) {
    const input = resolve('node_modules', source);
    const output = resolve(destination, target);
    if ((await stat(input)).size === 0) throw new Error(`Empty FFmpeg asset: ${source}`);
    await mkdir(resolve(output, '..'), { recursive: true });
    await copyFile(input, output);
  }

  const wasmSource = resolve('node_modules/@ffmpeg/core/dist/esm/ffmpeg-core.wasm');
  const wasm = await readFile(wasmSource);
  if (wasm.length < 8 || wasm.toString('hex', 0, 4) !== '0061736d') {
    throw new Error('The installed FFmpeg core does not contain a valid WebAssembly binary.');
  }

  const parts = [];
  for (let offset = 0; offset < wasm.byteLength; offset += chunkBytes) {
    const part = wasm.subarray(offset, Math.min(offset + chunkBytes, wasm.byteLength));
    const file = `ffmpeg-core.wasm.part-${String(parts.length + 1).padStart(2, '0')}`;
    await writeFile(resolve(destination, 'core', file), part);
    parts.push({ file, size: part.byteLength, sha256: createHash('sha256').update(part).digest('hex') });
  }

  const core = JSON.parse(await readFile(resolve('node_modules/@ffmpeg/core/package.json'), 'utf8'));
  const lib = JSON.parse(await readFile(resolve('node_modules/@ffmpeg/ffmpeg/package.json'), 'utf8'));
  await writeFile(resolve(destination, 'core/wasm-manifest.json'),
    `${JSON.stringify({ schema: 1, totalBytes: wasm.byteLength, parts })}\n`);
  await writeFile(resolve(destination, 'version.json'),
    `${JSON.stringify({ core: core.version, lib: lib.version })}\n`);
  console.log(`Prepared FFmpeg core ${core.version}: ${parts.length} cacheable WASM parts, ` +
    `${(wasm.byteLength / 1024 / 1024).toFixed(1)} MiB in total.`);
} catch (error) {
  console.error('FFmpeg preparation failed. Check installed packages and Node.js version.', error);
  process.exitCode = 1;
}
