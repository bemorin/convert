/**
 * Run at install AND before dev/build. Keep FFmpeg's module worker outside
 * Next.js/Webpack/Turbopack so its dynamic import of the core stays native.
 * Everything is served from this application's own origin.
 */
import { copyFile, mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const dest = resolve('public/ffmpeg');
const entries = [
  ['@ffmpeg/core/dist/esm/ffmpeg-core.js', 'core/ffmpeg-core.js'],
  ['@ffmpeg/core/dist/esm/ffmpeg-core.wasm', 'core/ffmpeg-core.wasm'],
  ['@ffmpeg/ffmpeg/dist/esm/worker.js', 'lib/worker.js'],
  ['@ffmpeg/ffmpeg/dist/esm/const.js', 'lib/const.js'],
  ['@ffmpeg/ffmpeg/dist/esm/errors.js', 'lib/errors.js'],
];

try {
  for (const [source, target] of entries) {
    const input = resolve('node_modules', source);
    const output = resolve(dest, target);
    // Validate the source exists first so a missing npm installation produces
    // a useful failure instead of a deployment with silent 404s.
    const metadata = await stat(input);
    if (metadata.size === 0) throw new Error(`Empty FFmpeg asset: ${source}`);
    await mkdir(resolve(output, '..'), { recursive: true });
    await copyFile(input, output);
  }
  const core = JSON.parse(await readFile(resolve('node_modules/@ffmpeg/core/package.json'), 'utf8'));
  const lib = JSON.parse(await readFile(resolve('node_modules/@ffmpeg/ffmpeg/package.json'), 'utf8'));
  await writeFile(resolve(dest, 'version.json'), JSON.stringify({ core: core.version, lib: lib.version }) + '\n');
  console.log(`Self-hosted FFmpeg assets copied (core ${core.version}, library ${lib.version}).`);
} catch (error) {
  console.error('Cannot prepare FFmpeg. Run `npm install` in the project root; ensure npm scripts are enabled.', error);
  process.exitCode = 1;
}
