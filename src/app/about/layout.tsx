import type { Metadata } from "next";

const title = "About Dreamhouse Printing | Vancouver Print Shop";
const description =
  "Meet Dreamhouse Printing, a Vancouver print shop on Alexander Street making custom screen printed and embroidered apparel for local brands and teams.";
const image = "/dreamhouse-screen-print-shop-vancouver.webp";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title,
    description,
    url: "/about",
    siteName: "Dreamhouse Printing",
    type: "website",
    locale: "en_CA",
    images: [{ url: image, width: 1200, height: 1200, alt: "Dreamhouse Printing screen print shop in Vancouver" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [image],
  },
};

export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
