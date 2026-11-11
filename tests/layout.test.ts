import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
const css = readFileSync('app/globals.css', 'utf8');
const batch = readFileSync('START.bat', 'utf8');
const openBrowser = readFileSync('scripts/open-browser.ps1', 'utf8');
test('Mobile grid and loaded file allow shrinking without intrinsic content overflow', () => {
  assert.match(css, /\.drop-frame\s*\{[^}]*min-width:\s*0;[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\);/s);
  assert.match(css, /\.loaded-state\s*\{[^}]*width:\s*min\(100%,\s*630px\);[^}]*max-width:\s*630px;[^}]*min-width:\s*0;/s);
  assert.match(css, /\.export-grid\s*\{[^}]*min-width:\s*0;[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,1fr\)\);/s);
});
test('Mobile layout has neither a forced 465px dropzone nor hidden second export', () => {
  const mobile = css.split('@media (max-width: 640px) {')[1]?.split('@media (max-width: 380px)')[0];
  assert.ok(mobile);
  assert.match(mobile, /\.drop-frame\s*\{[^}]*min-height:\s*0/);
  assert.doesNotMatch(mobile, /465px|overflow-y:\s*(hidden|scroll)|export-grid\s*\{[^}]*grid-template-columns:\s*1fr/s);
});
test('Batch bootstraps dependencies, checks FFmpeg, and waits before opening browser', () => {
  assert.match(batch, /npm\.cmd install/);
  assert.match(batch, /npm\.cmd run check:assets/);
  assert.match(batch, /npm\.cmd run dev -- -p 3000/);
  assert.match(batch, /open-browser\.ps1/);
  assert.match(openBrowser, /GetAsync\(\$url\)/);
  assert.match(openBrowser, /Start-Process \$url/);
});

test('Multifile picker, page-level drag, queue navigation and sequential ZIP exports exist', () => {
  const ui = readFileSync('components/audio-studio.tsx', 'utf8');
  const sidebar = readFileSync('components/collection-panel.tsx', 'utf8');
  assert.match(ui, /type="file"\s*multiple/);
  assert.match(ui, /window\.addEventListener\("drop", drop\)/);
  // Drops go through filesFromDrop, which also opens dropped folders (same as Compress).
  assert.match(ui, /filesFromDrop\(event\.dataTransfer\)/);
  // While dragging, a halo lights up inside the frame, above the content; no full-page overlay.
  assert.match(css, /\.drag-halo\s*\{[^}]*z-index:\s*4/s);
  assert.doesNotMatch(ui, /global-drop-overlay/);
  assert.match(sidebar, /className="queue-list"/);
  assert.match(ui, /await ensureConverted\(item, target,/);
  assert.match(ui, /compression: "STORE"/);
  assert.match(sidebar, /<Trash2 size=\{13\}/);
  assert.match(ui, /estimateBatch\(items, "mp3"\)/);
  assert.match(css, /\.multi-state \.studio-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,1fr\) minmax\(220px,255px\)/);
  assert.match(batch, /node_modules\\jszip\\package\.json/);
});

test('Sidebar height is independent of item count with internal scrolling and persistent exports', () => {
  assert.match(css, /\.queue-panel\s*\{[^}]*height:\s*clamp\(/s);
  assert.match(css, /\.queue-panel\s*\{[^}]*overflow:\s*hidden/s);
  assert.match(css, /\.queue-list\s*\{[^}]*overflow-y:\s*auto/s);
  // Thin scrollbars in the app's colours: ::-webkit rules, and the standard ones for Firefox only.
  assert.match(css, /::-webkit-scrollbar-thumb\s*\{[^}]*background-color:\s*var\(--dash\)/s);
  assert.match(css, /@supports not selector\(::-webkit-scrollbar\)\s*\{[^}]*scrollbar-width:\s*thin/s);
  assert.match(css, /\.batch-area\s*\{[^}]*flex:\s*0 0 auto/s);
});
test('Batch progress covers overall progress, per-track indicator and ZIP packaging', () => {
  const ui = readFileSync('components/audio-studio.tsx', 'utf8');
  const sidebar = readFileSync('components/collection-panel.tsx', 'utf8');
  assert.match(sidebar, /className="batch-live-rail" role="progressbar"/);
  assert.match(sidebar, /className="queue-item-rail" role="progressbar"/);
  assert.match(ui, /setBatchStage\("packaging"\)/);
  assert.match(ui, /\(\{ percent \}\) => setProgress\(Math\.max/);
});

test('Windows launcher and all launcher instructions use English', () => {
  assert.match(batch, /CONVERT BY BEN MORIN/);
  assert.match(batch, /Starting Convert\. Your browser will open automatically/);
  assert.match(batch, /Press Enter to close this window/);
  assert.doesNotMatch(batch, /DEMARRER|Premiere ouverture|Demarrage|navigateur|Verif|introuvable|reinstalle|relance|Aucun fichier/i);
  const readme = readFileSync('README.md', 'utf8');
  assert.match(readme, /Double-click \*\*`START\.bat`\*\*/);
  assert.doesNotMatch(readme, /DEMARRER\.bat/);
});
