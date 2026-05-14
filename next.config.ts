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
  },
};

export default nextConfig;
