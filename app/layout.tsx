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
  icons: {
    icon: "https://planner.bemorin.com/favicon.ico",
    shortcut: "https://planner.bemorin.com/favicon.ico",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, colorScheme: "light dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Browser extensions may inject root attributes before React hydration;
  // this suppresses root warnings only, not nested application mismatches.
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
