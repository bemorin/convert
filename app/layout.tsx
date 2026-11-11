import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://convert.bemorin.com"),
  title: "Convert by Ben Morin",
  description: "Convert audio to WAV, MP3 or FLAC, privately in your browser.",
  applicationName: "Convert by Ben Morin",
  openGraph: {
    title: "Convert by Ben Morin",
    description: "Convert WAV, MP3 and FLAC privately in your browser.",
    type: "website",
  },
  icons: { icon: "/icon.svg" },
};

const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "light dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Browser extensions may inject root attributes before React hydration;
  // this suppresses root warnings only, not nested application mismatches.
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Applies a saved light or dark choice before the first paint, so the page never flashes. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
