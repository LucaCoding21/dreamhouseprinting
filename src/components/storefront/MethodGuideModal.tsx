"use client";

import Image from "next/image";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";

export type MethodKey = "print" | "embroidery";

type MethodImage = { src: string; alt: string };

type MethodInfo = {
  label: string;
  tagline: string;
  blurb: string;
  images: MethodImage[];
  pros: string[];
  cons: string[];
};

// Real Dreamhouse work, not stock. Swap or add photos here any time; the grid
// adapts to however many each method has.
const METHODS: Record<MethodKey, MethodInfo> = {
  print: {
    label: "Screen Print",
    tagline: "Ink pressed into the fabric",
    blurb:
      "Screen printing presses ink onto the garment through a stencil. It is what we reach for most on bold, colourful designs and larger orders. For photo prints or very fine detail we may use a direct film transfer instead. We always pick the best fit for your art and confirm it on your proof.",
    images: [
      { src: "/screen-printing-process-vancouver.jpeg", alt: "Screen printing press applying ink to a shirt in our Vancouver shop" },
      { src: "/screen-printed-tshirt-vancouver.jpeg", alt: "Finished screen-printed custom t-shirt" },
      { src: "/custom-printed-tshirts-vancouver.jpeg", alt: "Stack of custom screen-printed t-shirts" },
    ],
    pros: [
      "Bright, vivid colours",
      "Great value on larger runs",
      "Holds up wash after wash",
      "Works on most garments",
    ],
    cons: [
      "More colours can add to the cost",
      "A larger print can add to the cost",
      "Costs a bit more per piece on small runs",
    ],
  },
  embroidery: {
    label: "Embroidery",
    tagline: "Stitched with real thread",
    blurb:
      "Embroidery stitches your design into the garment with thread. It gives a premium, textured finish that lasts, and it looks especially sharp on hats, polos, and jackets.",
    images: [
      { src: "/embroidery-machine-stitching-vancouver.jpeg", alt: "Embroidery machine stitching a green thread design into fabric" },
      { src: "/embroidered-cat-tshirt.jpeg", alt: "Embroidered green cat design on a brown t-shirt" },
    ],
    pros: [
      "Premium, professional look",
      "Very durable finish",
      "Feels high quality to the touch",
      "Perfect for logos and text",
    ],
    cons: [
      "Costs more on small runs",
      "Best kept under 8 thread colours",
      "Fine detail and gradients are hard",
      "Not suited to large, full prints",
    ],
  },
};

const TABS: MethodKey[] = ["print", "embroidery"];

/**
 * "Print vs Embroidery" explainer. One "?" in the designer opens this; the two
 * tabs each show sample photos, a plain description, and Pros/Cons so an unsure
 * customer can pick with confidence. Tab is controlled by the parent so opening
 * it can land on whichever method is currently selected.
 */
export function MethodGuideModal({
  open,
  tab,
  onTab,
  onClose,
}: {
  open: boolean;
  tab: MethodKey;
  onTab: (t: MethodKey) => void;
  onClose: () => void;
}) {
  const info = METHODS[tab];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl" backdropClassName="bg-dream-overlay/50 backdrop-blur-sm">
        {/* Header + tab toggle */}
        <div className="flex flex-col gap-4 px-6 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-extrabold text-dream-ink">How it&rsquo;s made</h2>
            <p className="mt-0.5 text-sm text-dream-muted">Compare your two decoration options.</p>
          </div>
          <div className="flex gap-1.5 rounded-full bg-dream-cream p-1">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTab(t)}
                aria-pressed={tab === t}
                className={cn(
                  "rounded-full px-4 py-2 font-display text-sm font-bold transition-colors",
                  tab === t
                    ? "bg-dream-purple text-white"
                    : "text-dream-muted hover:text-dream-ink",
                )}
              >
                {METHODS[t].label}
              </button>
            ))}
          </div>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-6 pb-6 pt-5">
          {/* Sample photos */}
          <div
            className={cn(
              "grid grid-cols-2 gap-2.5",
              info.images.length >= 4 ? "sm:grid-cols-4" : info.images.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-2",
            )}
          >
            {info.images.map((img) => (
              <div key={img.src} className="relative aspect-square overflow-hidden rounded-xl border border-dream-line bg-dream-cream">
                <Image src={img.src} alt={img.alt} fill sizes="(max-width: 640px) 45vw, 22vw" className="object-cover" />
              </div>
            ))}
          </div>

          {/* Tagline + description */}
          <p className="mt-5 font-display text-base font-bold text-dream-ink">{info.tagline}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-dream-muted">{info.blurb}</p>

          {/* Pros / Cons */}
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <ProsConsList kind="pros" items={info.pros} />
            <ProsConsList kind="cons" items={info.cons} />
          </div>

          <p className="mt-6 border border-dream-line bg-dream-cream px-4 py-3 text-xs leading-relaxed text-dream-ink">
            Not sure? Pick either one. An artist confirms the best method on your free proof before anything prints.
          </p>
        </div>

        <div className="flex justify-end border-t border-dream-line px-6 py-4">
          <button
            onClick={onClose}
            className="rounded-full bg-dream-purple px-5 py-2 font-display text-sm font-bold text-white transition-transform hover:-translate-y-0.5"
          >
            Got it
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProsConsList({ kind, items }: { kind: "pros" | "cons"; items: string[] }) {
  const isPros = kind === "pros";
  return (
    <div>
      <h3 className="font-display text-sm font-bold text-dream-ink">{isPros ? "Pros" : "Cons"}</h3>
      <ul className="mt-2.5 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2.5 text-sm text-dream-muted">
            <span
              className={cn(
                "mt-px shrink-0",
                isPros ? "text-dream-success" : "text-dream-danger",
              )}
              aria-hidden
            >
              {isPros ? (
                // Loose, hand-drawn tick
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M4 13c2 1 3.5 2.5 5 5C11 12 14.5 7 20 4" /></svg>
              ) : (
                // Loose, hand-drawn cross (two slightly-off strokes so it reads as an X, not a badge)
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6.5 6C10 9.5 13.5 13.5 17.5 18" /><path d="M17.5 6.5C13.5 10 10 13.5 6 18" /></svg>
              )}
            </span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
