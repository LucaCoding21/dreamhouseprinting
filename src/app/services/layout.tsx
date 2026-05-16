import type { Metadata } from "next";

const title = "Screen Printing, Embroidery & DTG Services in Vancouver";
const description =
  "Custom screen printing, embroidery, and DTG printing in Vancouver for shirts, hoodies, hats, and totes. See pricing, turnaround, and method details.";
const image = "/custom-screen-printed-tshirts-vancouver.webp";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/services",
  },
  openGraph: {
    title,
    description,
    url: "/services",
    siteName: "Dreamhouse Printing",
    type: "website",
    locale: "en_CA",
    images: [{ url: image, width: 1200, height: 1200, alt: "Custom screen-printed apparel in Vancouver" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [image],
  },
};

export default function ServicesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
