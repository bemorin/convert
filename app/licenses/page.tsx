import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Licenses · Convert by Ben Morin",
  description: "Open-source notices for Convert and its third-party conversion engine.",
};

export default function LicensesPage() {
  return (
    <main className="license-page">
      <a className="license-back" href="/">← Back to Convert</a>
      <h1>Licenses and notices</h1>
      <p>Original Convert by Ben Morin application code is made available under the MIT License.</p>
      <p>
        The conversion engine is separate: the JavaScript FFmpeg interface uses MIT,
        while the WebAssembly <code>@ffmpeg/core</code> package declares GPL-2.0-or-later.
        The application license does not change the engine license.
      </p>
      <div className="license-links">
        <a href="/licenses/GPL-2.0.txt">Read GNU GPL version 2</a>
        <a href="https://github.com/ffmpegwasm/ffmpeg.wasm/tree/main/packages/core" target="_blank" rel="noopener noreferrer">FFmpeg WASM source and build information ↗</a>
        <a href="https://ffmpeg.org/legal.html" target="_blank" rel="noopener noreferrer">FFmpeg licensing details ↗</a>
      </div>
      <p className="license-note">An MIT license for the original application is not a claim that the complete, deployed app is MIT-only. Hosting the GPL engine entails its separate distribution obligations.</p>
    </main>
  );
}
