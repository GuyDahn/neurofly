import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataLock = JSON.parse(
  readFileSync(path.join(root, "data.lock.json"), "utf8"),
) as { version: string };

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
