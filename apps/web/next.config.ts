import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataLock = JSON.parse(
  readFileSync(path.join(root, "data.lock.json"), "utf8"),
) as { version: string };

const dev = process.env.NODE_ENV !== "production";
// Vercel injects its feedback toolbar into preview deployments only.
const preview = process.env.VERCEL_ENV === "preview";
const vercelLive = preview ? " https://vercel.live" : "";

// Everything is served from our own origin. 'unsafe-inline' covers Next's
// inline bootstrap, the theme script and JSON-LD (nonces would force dynamic
// rendering); 'wasm-unsafe-eval' lets the Draco worker compile its decoder.
// Vercel Analytics and Speed Insights use va.vercel-scripts.com.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://va.vercel-scripts.com${dev ? " 'unsafe-eval'" : ""}${vercelLive}`,
  `style-src 'self' 'unsafe-inline'${vercelLive}`,
  `img-src 'self' data: blob:${preview ? " https://vercel.live https://vercel.com" : ""}`,
  `font-src 'self'${preview ? " https://vercel.live https://assets.vercel.com" : ""}`,
  `connect-src 'self' https://va.vercel-scripts.com${dev ? " ws:" : ""}${preview ? " https://vercel.live wss://ws-us3.pusher.com" : ""}`,
  "worker-src 'self' blob:",
  `frame-src 'self'${vercelLive}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The code is open source, so production errors may as well be readable.
  productionBrowserSourceMaps: true,
  transpilePackages: ["three"],
  // HarfBuzz shapes the share images' text. It loads its WebAssembly next to
  // its own module, so Node runs it from node_modules instead of a bundle.
  serverExternalPackages: ["harfbuzzjs"],
  outputFileTracingRoot: root,
  env: {
    // The viewer asks for /data files with ?v=<release>, so a year-long cache
    // can never serve one data release's file to code expecting another.
    NEXT_PUBLIC_DATA_VERSION: dataLock.version,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        // Fetched from the data-vN release at build time and requested with a
        // version or content hash in the query string.
        source: "/data/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        // The Draco decoder only changes with a three.js upgrade.
        source: "/draco/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=2592000, stale-while-revalidate=86400",
          },
        ],
      },
    ];
  },
  webpack: (config) => {
    // The simulator is NodeNext ESM (".js" specifiers on .ts files) so the
    // worker bundle and the script typecheck share one import style.
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
      ".mjs": [".mts", ".mjs"],
    };
    return config;
  },
};

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

export default withNextIntl(nextConfig);
