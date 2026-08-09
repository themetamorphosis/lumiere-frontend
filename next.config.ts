import type { NextConfig } from "next";
import { createHash } from "crypto";
import { THEME_SCRIPT } from "./lib/themeScript";

// Hash of the one inline script we ship, computed from the same export the
// layout renders — so the two can never drift. A hash rather than a nonce
// keeps pages statically renderable.
const themeScriptHash = `'sha256-${createHash("sha256")
  .update(THEME_SCRIPT)
  .digest("base64")}'`;

// The browser talks to the backend directly today (lib/apiClient.ts). Once that
// path is removed, connect-src can drop back to 'self'.
const apiOrigin = (() => {
  try {
    return new URL(
      process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1",
    ).origin;
  } catch {
    return "http://127.0.0.1:8000";
  }
})();

const isDev = process.env.NODE_ENV !== "production";

const csp = [
  "default-src 'self'",
  // Next injects its own inline bootstrap; dev additionally needs eval for HMR.
  `script-src 'self' ${themeScriptHash} 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  // Tailwind, framer-motion, and the inline style on <body> all need this.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://image.tmdb.org https://img.youtube.com https://i.ytimg.com https://lh3.googleusercontent.com",
  `connect-src 'self' ${apiOrigin}${isDev ? " ws: wss:" : ""}`,
  "font-src 'self' data:",
  // Trailer embeds in DetailOverlay.
  "frame-src https://www.youtube.com https://www.youtube-nocookie.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

/**
 * Report-only for now, per REMEDIATION_PLAN.md Phase 1 task 1.12.
 *
 * The policy is already correct — including the hash for the theme script — so
 * promoting it is a one-line change: swap this header name for
 * "Content-Security-Policy". Do that only after real traffic has run against
 * the report-only header without violations. The failure mode if the hash is
 * wrong is a page that loads with no theme, which report-only surfaces safely.
 */
const CSP_HEADER_NAME = "Content-Security-Policy-Report-Only";

const securityHeaders = [
  { key: CSP_HEADER_NAME, value: csp },
  // These four are unambiguous and ship enforcing.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "img.youtube.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  async redirects() {
    return [
      {
        source: "/library",
        destination: "/library/movies",
        permanent: true,
      },
      {
        source: "/wishlist",
        destination: "/wishlist/movies",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
