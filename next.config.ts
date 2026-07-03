import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    // Cache optimized image variants on Vercel's edge for 30 days instead of
    // the default 60s — this is a marketing site whose images rarely change,
    // and per-host cache misses across .com/.ca were inflating data transfer.
    minimumCacheTTL: 2592000,
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
