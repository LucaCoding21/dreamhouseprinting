import type { Metadata } from "next";

const title = "Contact Dreamhouse Printing in Vancouver";
const description =
  "Contact Dreamhouse Printing for custom screen printing in Vancouver. Visit our shop at 323 Alexander St or send a note about your project.";
const image = "/dreamhouse-screen-print-shop-vancouver.webp";

export const metadata: Metadata = {
  title,
  description,
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title,
    description,
    url: "/contact",
    siteName: "Dreamhouse Printing",
    type: "website",
    locale: "en_CA",
    images: [{ url: image, width: 1200, height: 1200, alt: "Dreamhouse Printing shop on Alexander Street, Vancouver" }],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: [image],
  },
};

export default function ContactLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
