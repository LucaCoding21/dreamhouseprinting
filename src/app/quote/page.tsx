import type { Metadata } from "next";
import QuoteForm from "@/components/QuoteForm";

type ProductKey = "shirt" | "hoodie" | "hat" | "bag";

type VariantMeta = {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
};

const PRODUCT_META: Record<ProductKey, VariantMeta> = {
  shirt: {
    title: "Custom T Shirts in Vancouver | Dreamhouse Printing",
    description:
      "Custom t shirts in Vancouver, screen printed in house on Gildan, Bella+Canvas, and Comfort Colors. Tell us your design and we'll send a quote.",
    image: "/custom-screen-printed-tshirts-vancouver.webp",
    imageAlt: "Custom screen-printed t-shirts in Vancouver",
  },
  hoodie: {
    title: "Custom Hoodies in Vancouver | Dreamhouse Printing",
    description:
      "Custom hoodies in Vancouver, screen printed or embroidered on premium blanks. Five quick questions and we send a quote within one business day.",
    image: "/custom-printed-brand-merch-vancouver.webp",
    imageAlt: "Custom printed hoodies and brand merch in Vancouver",
  },
  hat: {
    title: "Custom Hats & Toques in Vancouver | Dreamhouse Printing",
    description:
      "Custom hats and toques in Vancouver, embroidered on Flexfit, Richardson, and Yupoong. Send your logo and we'll quote your run within a business day.",
    image: "/custom-embroidery-vancouver.webp",
    imageAlt: "Custom embroidered hats made in Vancouver",
  },
  bag: {
    title: "Custom Tote Bags in Vancouver | Dreamhouse Printing",
    description:
      "Custom tote bags in Vancouver, screen printed on Liberty Bags and Port Authority blanks. Tell us your design and quantity for a quick quote.",
    image: "/custom-t-shirt-printing-vancouver.webp",
    imageAlt: "Custom printed apparel and bags from Dreamhouse Vancouver",
  },
};

const DEFAULT_META: VariantMeta = {
  title: "Get a Custom Quote | Dreamhouse Printing Vancouver",
  description:
    "Get a custom apparel quote in Vancouver for screen printed shirts, hoodies, hats, and totes. Five quick questions and Julian replies within a day.",
  image: "/custom-screen-printed-tshirts-vancouver.webp",
  imageAlt: "Get a custom apparel quote in Vancouver",
};

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ product?: string }>;
}): Promise<Metadata> {
  const { product } = await searchParams;
  const isVariant = product && product in PRODUCT_META;
  const variant = isVariant ? PRODUCT_META[product as ProductKey] : DEFAULT_META;
  const path = isVariant ? `/quote?product=${product}` : "/quote";

  return {
    title: variant.title,
    description: variant.description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: variant.title,
      description: variant.description,
      url: path,
      siteName: "Dreamhouse Printing",
      type: "website",
      locale: "en_CA",
      images: [{ url: variant.image, width: 1200, height: 1200, alt: variant.imageAlt }],
    },
    twitter: {
      card: "summary_large_image",
      title: variant.title,
      description: variant.description,
      images: [variant.image],
    },
  };
}

export default function QuotePage() {
  return (
    <main className="relative">
      <QuoteForm />
    </main>
  );
}
