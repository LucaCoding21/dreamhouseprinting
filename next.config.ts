import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  experimental: {
    // Designer scenes stage their images to Storage and send only markers, so
    // action bodies stay small — this is headroom for text-heavy scenes, kept
    // under Vercel's 4.5MB serverless request cap (raising it further would do
    // nothing in production).
    serverActions: { bodySizeLimit: "3mb" },
  },
  images: {
    // Cache optimized image variants on Vercel's edge for 30 days instead of
    // the default 60s — this is a marketing site whose images rarely change,
    // and per-host cache misses across .com/.ca were inflating data transfer.
    minimumCacheTTL: 2592000,
    // Allow next/image to serve SVGs (the nav logo is an SVG). Next blocks SVG
    // through the optimizer by default — without this the logo 400s and renders
    // blank. Safe here because we only load first-party SVGs; the CSP +
    // attachment disposition neutralize any script an untrusted SVG could carry.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    // S&S Activewear product imagery is served from their CDN; allow Next/Image
    // to optimize it. Supabase Storage signed URLs are also remote.
    remotePatterns: [
      { protocol: "https", hostname: "cdn.ssactivewear.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async redirects() {
    // The standalone /quote page was folded into the home page's quote card.
    // Redirect old inbound links / bookmarks to the card anchor so they don't
    // 404 (query params like ?product= are dropped — the card defaults fine).
    return [
      { source: "/quote", destination: "/#quick-quote", permanent: true },
    ];
  },
};

export default nextConfig;
