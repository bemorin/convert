import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('Next.js builds static export for Cloudflare Pages', () => {
  const config = readFileSync('next.config.ts', 'utf8');
  assert.match(config, /output:\s*"export"/);
});

test('FFmpeg is split into self-hosted chunks rather than one oversized public asset', () => {
  const script = readFileSync('scripts/copy-ffmpeg.mjs', 'utf8');
  const check = readFileSync('scripts/check-ffmpeg.mjs', 'utf8');
  const loader = readFileSync('lib/convert.ts', 'utf8');
  assert.match(script, /const chunkBytes = 20 \* 1024 \* 1024/);
  assert.match(script, /wasm-manifest\.json/);
  assert.match(check, /maxAssetBytes = 25 \* 1024 \* 1024/);
  assert.match(loader, /loadWasmObjectURL/);
  assert.doesNotMatch(script, /\['@ffmpeg\/core\/dist\/esm\/ffmpeg-core\.wasm',\s*'core\/ffmpeg-core\.wasm'\]/);
});
