import {
  Archivo,
  Darumadrop_One,
  Inter,
  Lilita_One,
  Anton,
  Bebas_Neue,
  Oswald,
  Pacifico,
  Bangers,
  Permanent_Marker,
  Graduate,
  Teko,
  Bungee,
  Righteous,
  Lobster,
  Monoton,
  Press_Start_2P,
  Fredoka,
} from "next/font/google";

// Brand fonts (kept as CSS variables on <html> in layout.tsx).
export const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});
export const darumadrop = Darumadrop_One({
  variable: "--font-darumadrop",
  subsets: ["latin"],
  weight: "400",
});
export const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
export const lilitaOne = Lilita_One({
  variable: "--font-lilita",
  subsets: ["latin"],
  weight: "400",
});

// Designer text fonts — self-hosted (next/font) so Fabric can render them on the
// <canvas>. We keep the full CSS family string (for previews + Fabric) and the
// bare primary family name (for document.fonts.load, which needs a single face).
const anton = Anton({ subsets: ["latin"], weight: "400" });
const bebas = Bebas_Neue({ subsets: ["latin"], weight: "400" });
const oswald = Oswald({ subsets: ["latin"], weight: "400" });
const pacifico = Pacifico({ subsets: ["latin"], weight: "400" });
const bangers = Bangers({ subsets: ["latin"], weight: "400" });
const marker = Permanent_Marker({ subsets: ["latin"], weight: "400" });
const graduate = Graduate({ subsets: ["latin"], weight: "400" });
const teko = Teko({ subsets: ["latin"], weight: "600" });
const bungee = Bungee({ subsets: ["latin"], weight: "400" });
const righteous = Righteous({ subsets: ["latin"], weight: "400" });
const lobster = Lobster({ subsets: ["latin"], weight: "400" });
const monoton = Monoton({ subsets: ["latin"], weight: "400" });
const pressStart = Press_Start_2P({ subsets: ["latin"], weight: "400" });
const fredoka = Fredoka({ subsets: ["latin"], weight: "600" });

export interface DesignerFont {
  /** Short human label shown on the picker button. */
  label: string;
  /** Full CSS font-family value (with fallbacks) — for previews + Fabric. */
  css: string;
  /** Bare primary family name — for document.fonts.load(). */
  family: string;
  /** Weight to render at (single-weight display faces stay 400). */
  weight: number;
}

/** Strip the fallback list + quotes off next/font's generated family string. */
function primary(css: string): string {
  return css.split(",")[0].trim().replace(/^['"]|['"]$/g, "");
}

/** The fonts offered in the designer's text tool, in menu order. */
export const DESIGNER_FONTS: DesignerFont[] = [
  { label: "Clean", css: archivo.style.fontFamily, family: primary(archivo.style.fontFamily), weight: 700 },
  { label: "Bold", css: anton.style.fontFamily, family: primary(anton.style.fontFamily), weight: 400 },
  { label: "Tall", css: bebas.style.fontFamily, family: primary(bebas.style.fontFamily), weight: 400 },
  { label: "Condensed", css: oswald.style.fontFamily, family: primary(oswald.style.fontFamily), weight: 400 },
  { label: "Script", css: pacifico.style.fontFamily, family: primary(pacifico.style.fontFamily), weight: 400 },
  { label: "Comic", css: bangers.style.fontFamily, family: primary(bangers.style.fontFamily), weight: 400 },
  { label: "Marker", css: marker.style.fontFamily, family: primary(marker.style.fontFamily), weight: 400 },
  { label: "Athletic", css: graduate.style.fontFamily, family: primary(graduate.style.fontFamily), weight: 400 },
  { label: "Jersey", css: teko.style.fontFamily, family: primary(teko.style.fontFamily), weight: 600 },
  { label: "Urban", css: bungee.style.fontFamily, family: primary(bungee.style.fontFamily), weight: 400 },
  { label: "Retro", css: righteous.style.fontFamily, family: primary(righteous.style.fontFamily), weight: 400 },
  { label: "Cursive", css: lobster.style.fontFamily, family: primary(lobster.style.fontFamily), weight: 400 },
  { label: "Neon", css: monoton.style.fontFamily, family: primary(monoton.style.fontFamily), weight: 400 },
  { label: "Arcade", css: pressStart.style.fontFamily, family: primary(pressStart.style.fontFamily), weight: 400 },
  { label: "Round", css: fredoka.style.fontFamily, family: primary(fredoka.style.fontFamily), weight: 600 },
];
