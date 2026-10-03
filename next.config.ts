import type { NextConfig } from "next";

// Audio conversion is entirely client-side; no Next.js server is required.
// Cloudflare Pages publishes the resulting static `out` directory.
const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
};

export default nextConfig;
