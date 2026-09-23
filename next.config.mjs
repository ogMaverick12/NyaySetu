import bundleAnalyzer from "@next/bundle-analyzer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
  // Write stats JSON to .next/analyze/ — works headlessly in CI
  openAnalyzer: false,
});

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // tesseract.js uses WASM workers and spawns Node.js child threads —
    // it must be required at runtime from node_modules, not bundled by webpack.
    // (Next.js 14 equivalent of the Next.js 15 stable `serverExternalPackages`)
    serverComponentsExternalPackages: ["tesseract.js"],
  },
  webpack: (config) => {
    // Drop Next's fixed legacy polyfill module from the shared client chunk.
    // Stock `next/dist/build/polyfills/polyfill-module` ships core-js style
    // guards (trimStart/flat/fromEntries/hasOwn/at/…) flagged as ~12 KB legacy
    // JS on mobile Lighthouse. Every guarded API is native across our
    // evergreen floors and no app code touches the one exception
    // (URL.canParse), so the stub (lib/evergreen-polyfill-stub.js) is a
    // behavioral no-op here. Both client entries require it via the exact
    // request "../build/polyfills/polyfill-module", which this alias matches.
    config.resolve.alias = {
      ...config.resolve.alias,
      "../build/polyfills/polyfill-module": path.join(rootDir, "lib/evergreen-polyfill-stub.js"),
    };
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=()",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://generativelanguage.googleapis.com https://openrouter.ai",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
