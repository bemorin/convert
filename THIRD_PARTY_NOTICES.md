# Third-party components and distribution notes

Original Bemorin application source: MIT (see `LICENSE`). Dependency licenses remain their own. Check transitive dependencies and the exact installed package versions before a public deployment.

| Component | Role | Declared license | Source / license |
|---|---|---|---|
| `@ffmpeg/ffmpeg` | JS browser API / worker | MIT | https://github.com/ffmpegwasm/ffmpeg.wasm/tree/main/packages/ffmpeg |
| `@ffmpeg/core` | Distributed WebAssembly engine, copied to `public/ffmpeg/core` at install | **GPL-2.0-or-later** | https://github.com/ffmpegwasm/ffmpeg.wasm/tree/main/packages/core |
| FFmpeg (upstream) | Codec framework embedded in the core | LGPL-2.1-or-later by default; GPL for some build configurations | https://ffmpeg.org/legal.html |
| JSZip | ZIP assembly | MIT or GPL-3.0 dual license (this project relies on the MIT option) | https://github.com/Stuk/jszip/blob/main/LICENSE.markdown |

**Important:** MIT covers this repository's original code only. Shipping the GPL FFmpeg WASM binary as an app asset invokes GPL requirements. Providing a mere link to upstream is not in itself a guarantee of compliance: the deployed distribution must include applicable license texts, notices and appropriate access to corresponding sources and build information for the **exact** binary it distributes. Evaluate the legal status of the complete distribution before release; consult qualified legal counsel if needed. To avoid GPL distribution implications, an alternative conversion implementation or a properly reviewed custom LGPL build and its LGPL obligations would need separate engineering work.

The source repository includes a copy of the GPL version 2 text at `public/licenses/GPL-2.0.txt` and the deployed site exposes it at `/licenses/GPL-2.0.txt`. This notice and that text are **not** a substitute for full binary-specific GPL source compliance.

`@ffmpeg/core` license declaration: https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/packages/core/package.json
`@ffmpeg/ffmpeg` license declaration: https://github.com/ffmpegwasm/ffmpeg.wasm/blob/main/packages/ffmpeg/package.json
