import type { Metadata } from "next";
import { Archivo, Darumadrop_One, Inter } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const darumadrop = Darumadrop_One({
  variable: "--font-darumadrop",
  subsets: ["latin"],
  weight: "400",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const homeTitle = "Custom Screen Printing & Embroidery in Vancouver | Dreamhouse";
const homeDescription =
  "Vancouver screen printing and embroidery shop for custom t shirts, hoodies, and team apparel. Upload your design and get a quote within one business day.";
const homeImage = "/dreamhouse-printing-vancouver.webp";
const homeImageAlt =
  "Dreamhouse Printing home page showing custom screen printed t-shirt, hat, sweatshirt, and tote bag";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.dreamhouseprinting.com"),
  title: homeTitle,
  description: homeDescription,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: homeTitle,
    description: homeDescription,
    url: "/",
    siteName: "Dreamhouse Printing",
    type: "website",
    locale: "en_CA",
    images: [{ url: homeImage, width: 1200, height: 657, alt: homeImageAlt }],
  },
  twitter: {
    card: "summary_large_image",
    title: homeTitle,
    description: homeDescription,
    images: [homeImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${darumadrop.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-dream-lavender text-dream-ink font-sans">
        <svg
          aria-hidden
          className="pointer-events-none fixed h-0 w-0 overflow-hidden"
        >
          <defs>
            <filter id="rough-edges">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.025"
                numOctaves="1"
                seed="4"
                stitchTiles="stitch"
                result="noise"
              />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.5" />
            </filter>
            <filter id="rough-edges-alive">
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.03"
                numOctaves="2"
                seed="4"
                stitchTiles="stitch"
                result="noise"
              >
                <animate
                  attributeName="seed"
                  values="4;9;14;19;24"
                  dur="0.75s"
                  repeatCount="indefinite"
                  calcMode="discrete"
                />
              </feTurbulence>
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="4.5" />
            </filter>
            <filter
              id="rough-card-edges"
              x="-3%"
              y="-3%"
              width="106%"
              height="106%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.022"
                numOctaves="1"
                seed="7"
                result="noise"
              />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.5" />
            </filter>
            {/* Subtle hand-drawn wobble for thin strokes — single low-amplitude
                turbulence pass, just enough to keep edges from looking CAD. */}
            <filter
              id="stroke-rough"
              x="-25%"
              y="-25%"
              width="150%"
              height="150%"
            >
              <feTurbulence
                type="fractalNoise"
                baseFrequency="0.09"
                numOctaves="2"
                seed="3"
                stitchTiles="stitch"
                result="noise"
              />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.4" />
            </filter>
          </defs>
        </svg>
        {children}
      </body>
    </html>
  );
}
