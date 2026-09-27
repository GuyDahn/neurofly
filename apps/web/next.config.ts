import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataLock = JSON.parse(
  readFileSync(path.join(root, "data.lock.json"), "utf8"),
) as { version: string };

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The code is open source, so production errors may as well be readable.
  productionBrowserSourceMaps: true,
  transpilePackages: ["three"],
  outputFileTracingRoot: root,
  env: {
    // The viewer asks for /data files with ?v=<release>, so a year-long cache
    // can never serve one data release's file to code expecting another.
    NEXT_PUBLIC_DATA_VERSION: dataLock.version,
  },
  async redirects() {
    return [
      {
        // Lesson 1 lived at / before the landing page. Share links made then
        // still replay: the lesson page reads ?r= and moves to the right lesson.
        source: "/",
        has: [{ type: "query", key: "r" }],
        destination: "/modules/smell-memory",
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
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

export default nextConfig;
