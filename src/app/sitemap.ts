import type { MetadataRoute } from "next";

const SITE_URL = "https://www.dreamhouseprinting.com";

type SitemapEntry = MetadataRoute.Sitemap[number] & {
  images?: string[];
};

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const entries: SitemapEntry[] = [
    {
      url: `${SITE_URL}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1.0,
      images: [`${SITE_URL}/homepage_assets/custom-apparel-vancouver.webp`],
    },
    {
      url: `${SITE_URL}/services`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.9,
      images: [
        `${SITE_URL}/custom-screen-printed-tshirts-vancouver.webp`,
        `${SITE_URL}/screen-printing-vancouver.webp`,
        `${SITE_URL}/custom-embroidery-vancouver.webp`,
        `${SITE_URL}/dtg-printing-vancouver.webp`,
      ],
    },
    {
      url: `${SITE_URL}/about`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.6,
      images: [`${SITE_URL}/dreamhouse-screen-print-shop-vancouver.webp`],
    },
    {
      url: `${SITE_URL}/contact`,
      lastModified: now,
      changeFrequency: "yearly",
      priority: 0.6,
    },
  ];

  return entries;
}
