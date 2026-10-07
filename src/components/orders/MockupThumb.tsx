"use client";

import Image from "next/image";
import { isPdf } from "./Lightbox";
import { PdfGlyph, PdfThumb } from "./PdfThumb";

/**
 * A small mockup square for admin lists (dashboard queues, the orders list).
 * Official mockups on manual orders are often PDFs, which next/image can't
 * optimize (the optimizer answers 400 and the square showed a broken image),
 * so a PDF draws its first page instead.
 */
export function MockupThumb({ src, size }: { src: string; size: number }) {
  if (isPdf(src)) {
    return <PdfThumb src={src} alt="" fallback={<PdfGlyph iconClassName="h-4 w-4" label={null} />} />;
  }
  return <Image src={src} alt="" width={size} height={size} className="h-full w-full object-contain" />;
}
