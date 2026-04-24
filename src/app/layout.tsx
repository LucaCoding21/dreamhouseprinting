import type { Metadata } from "next";
import { Archivo, Inter } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Dreamhouse Printing — Custom screen printing & embroidery in Vancouver",
  description:
    "Premium custom apparel for businesses, teams, and brands. Upload your design and get a quote in minutes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${inter.variable} h-full antialiased`}
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
          </defs>
        </svg>
        {children}
      </body>
    </html>
  );
}
