# Convert by Ben Morin

Private, local-first audio conversion for WAV, MP3 and FLAC. Minimal UI, waveform playback, whole-page drag & drop, a collection of up to 24 files, two instant single-file export choices, and independently estimated ZIP exports for each target format. The interface follows your operating system's light or dark preference until you pick one with the switch in the top bar; the choice is remembered in that browser.

**Proposed address:** `https://convert.bemorin.com` (configure DNS/hosting separately). The website title is **Convert by Ben Morin**. The favicon is the Convert mark, in `public/icon.svg`.

## Windows — start without typing commands

1. Install Node.js 22 or later once: https://nodejs.org/
2. Extract the **entire** repository from the ZIP.
3. Double-click **`START.bat`** at the root of the extracted folder. The script installs dependencies if needed, checks the local FFmpeg assets, starts Next.js and opens the browser when the site is ready.
4. Leave the console window open while using the app; close it to stop the local server.

The first start requires an internet connection for npm installation. Subsequent local conversions do not upload your audio. Next.js development builds may still request development-related assets; production hosting should be tested separately. If you replace the files of an already-installed project, run a fresh dependency installation (the batch launcher handles missing dependencies, but does not upgrade existing package installations automatically).

## Cloudflare Pages — no terminal required

This repository is configured to export a fully static site to Cloudflare Pages. Audio remains in the browser; the FFmpeg JS and chunked WebAssembly assets are served from the same site, not a third-party CDN. After replacing the files in your existing `convert` GitHub Desktop repository, commit and push. Then select these settings in Cloudflare **Pages**:

| Setting | Value |
|---|---|
| Framework preset | `Next.js (Static HTML Export)` |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `out` |
| Root directory | `/` |
| Environment variable | `NODE_VERSION` = `22` |

Cloudflare automatically installs dependencies. `npm run build` runs the `prebuild` script that prepares the self-hosted ESM engine and chunks. Do not use `next start` on Cloudflare Pages; `START.bat` is only for local Windows development. The generated `out` folder is uploaded by Cloudflare; it should not be committed.

**Before public release:** The original application is MIT, but the currently distributed `@ffmpeg/core` is GPL-2.0-or-later. Read `THIRD_PARTY_NOTICES.md` and fulfill the applicable redistribution and corresponding-source obligations for the exact upstream binaries you publish. Hosting the engine yourself does not eliminate these obligations.

## Deployment / quality checks

On CI or a machine with npm network access:

```text
npm install
npm run test:unit
npm run typecheck
npm run check:assets
npm run build
```

The FFmpeg engine stays on your own origin. `scripts/copy-ffmpeg.mjs` copies the unbundled ESM worker and **splits the large WebAssembly binary into cacheable parts of at most 20 MiB**, with a generated manifest and SHA-256 checksums. The browser checks the parts and reconstructs a temporary WebAssembly Blob URL before initializing FFmpeg. This is necessary because Cloudflare Pages limits individual assets to 25 MiB and the upstream core binary exceeds that limit. Generated assets are recreated at install and before every build; do not commit `node_modules`, `.next`, `out` or `public/ffmpeg`.

### User experience and memory

- Drop more files **anywhere**, including on the waveform or collection, while a batch is running. Files added after a batch starts go into the collection but are **not** silently inserted into that already-running ZIP. The prepared ZIP button states the exported file count and format.
- Collection height stays fixed across any number of items. Only the track list scrolls; export actions stay visible. On small screens, the whole page may scroll naturally so controls are never clipped.
- Batch progress displays a determinate **conversion stage** (file number and overall percentage) and a separate determinate **ZIP packaging stage**. The current track gets an inline progress rail; completed tracks get a checkmark. Matching source files are reused byte-for-byte.
- Source file extensions are verified against file signatures. Duplicate imports are ignored. The queue has a collection memory budget, and batch eligibility is evaluated **separately** for MP3, WAV and FLAC using original sizes, cached conversions and header/browser metadata.
- MP3 size is estimated using 320 kbps CBR, WAV using 32-bit PCM, FLAC as an honestly uncertain range. Conversions that risk exceeding the batch ZIP memory limit are disabled **independently**, not globally. Estimates cannot guarantee browser memory on every device; if actual encoded bytes exceed the budget mid-export, the ZIP is stopped without deleting individual completed conversions.
- Local files and cached conversions live in memory only and are cleared by page refresh. No tracking or upload API is included.

## Architecture

- `app/` Next.js App Router, metadata and system-theme CSS
- `components/audio-studio.tsx` collection controller, drop listeners and conversion orchestration
- `components/collection-panel.tsx` isolated collection / batch-progress presentation, with no encoding side effects
- `components/waveform.tsx` canvas-based waveform and seek UI
- `components/use-audio-preview.ts` Web Audio + audio element lifecycle
- `lib/audio.ts` formats / validation; `lib/estimates.ts` target-specific memory plans
- `lib/batch-progress.ts` pure, tested file-weighted progress math
- `lib/convert.ts` serialized FFmpeg operations, worker verification, diagnostics and downloads
- `tests/` Node unit tests and static browser layout fixtures

The thresholds are centralized in `lib/limits.ts` as explicit browser-memory safety limits, **not** assumptions about available RAM. If you increase them, test conversion peak memory and ZIP assembly in target browsers first.

## License — important before public distribution

Original application code is offered under **MIT**, in [`LICENSE`](./LICENSE). Third-party dependencies do **not** become MIT merely because this app is MIT. See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md). The app includes a publicly accessible `/licenses` page and GPL v2 license text.

In particular, `@ffmpeg/ffmpeg` (browser interface) is MIT, while `@ffmpeg/core` (the WebAssembly codec engine this build copies into public assets) declares **GPL-2.0-or-later**. FFmpeg upstream is generally LGPL with GPL options, but you must use the license of the **actual core distributed here**, not assume upstream's default license applies. Hosting and redistributing that core has GPL notice/source obligations and may affect the compliance requirements of a combined application. The MIT file alone is **not** a claim that the distributed website is MIT-only. For an MIT-only distribution, replace the GPL engine with appropriately licensed components and check every codec dependency; simply editing LICENSE is insufficient. Consider legal review prior to a public release.

## Limitations of this source delivery

The UI, progress logic, layout CSS, test sources and Windows launcher are provided. The unit tests and static layout smoke tests can run without npm. A full Next.js production build and end-to-end live audio conversions require npm dependencies and browser runtime verification on your machine or CI; these should not be described as already validated when npm is inaccessible.
