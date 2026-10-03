import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep FFmpeg and its WAV/MP3/FLAC operations on the client.
};

export default nextConfig;
