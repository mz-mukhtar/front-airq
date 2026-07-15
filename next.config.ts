import type { NextConfig } from "next";

// Note: 'unsafe-inline'/'unsafe-eval' in script-src are required by Next.js
// (dev mode and inline runtime); acceptable for now. img-src allows https: +
// data: + blob: for Leaflet tile layers. Everything API-related goes through
// the same-origin proxy, so connect-src stays 'self'.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "font-src 'self' data:",
].join("; ");

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // strict-origin-when-cross-origin (not no-referrer): OSM's tile servers
  // require a Referer per their usage policy (osm.wiki/Blocked); this sends
  // only the origin cross-site, never paths or query strings.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
];

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image.
  output: "standalone",
  // Allow images from the backend
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'air-q-9f333037f389.herokuapp.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
