import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  // Required when running behind a reverse proxy (e.g. Nginx Proxy Manager)
  // that terminates HTTPS and forwards requests over HTTP internally.
  // Tells Next.js to trust X-Forwarded-Proto / X-Forwarded-Host headers.
  experimental: {
    trustHostHeader: true,
  },
};

export default nextConfig;
