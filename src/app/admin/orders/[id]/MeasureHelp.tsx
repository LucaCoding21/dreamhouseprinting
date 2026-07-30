"use client";

import { useState } from "react";
import Image from "next/image";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/Dialog";

/**
 * "?" affordance beside the Width/Height fields on a decoration spot row.
 * Opens a diagram (a real past order's mockup, annotated) explaining exactly
 * what the two numbers measure: the box around the WHOLE composition on that
 * side, not the print area and not a single element.
 */
export function MeasureHelpDot() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label="What do width and height measure?"
        // Mouse-only: keyboard flow must go Location, Type, Width, Height,
        // Colours without stopping on the help dot.
        tabIndex={-1}
        onClick={() => setOpen(true)}
        className="flex h-3.5 w-3.5 items-center justify-center rounded-full bg-dream-line text-[9px] font-bold text-dream-muted transition-colors hover:bg-dream-purple hover:text-white"
      >
        ?
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>What width and height measure</DialogTitle>
            <DialogDescription>
              The box around the whole design on that side, in inches at garment scale.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto px-5 pb-5">
            {/* Annotated example: order 1008's front, stored as 11.7 x 10.8 in. */}
            <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-dream-line bg-white">
              <Image
                src="/admin/measure-example-1008.png"
                alt="Shirt mockup with three lines of text, annotated with the measured bounding box"
                width={960}
                height={1200}
                className="w-full"
              />
              <svg viewBox="0 0 960 1200" className="absolute inset-0 h-full w-full" aria-hidden>
                {/* Bounding box around ALL elements together */}
                <rect
                  x="256"
                  y="334"
                  width="448"
                  height="394"
                  fill="none"
                  stroke="#7664ff"
                  strokeWidth="5"
                  strokeDasharray="14 10"
                />
                {/* Width arrow under the box */}
                <line x1="268" y1="790" x2="692" y2="790" stroke="#1b1458" strokeWidth="6" />
                <path d="M258 790l26 -14v28z" fill="#1b1458" />
                <path d="M702 790l-26 -14v28z" fill="#1b1458" />
                <line x1="256" y1="740" x2="256" y2="778" stroke="#1b1458" strokeWidth="4" />
                <line x1="704" y1="740" x2="704" y2="778" stroke="#1b1458" strokeWidth="4" />
                <rect x="355" y="814" width="250" height="56" rx="12" fill="#ffffff" stroke="#1b1458" strokeWidth="3" />
                <text x="480" y="854" textAnchor="middle" fontSize="38" fontWeight="700" fill="#1b1458">
                  Width 11.7&#8243;
                </text>
                {/* Height arrow beside the box */}
                <line x1="766" y1="346" x2="766" y2="716" stroke="#1b1458" strokeWidth="6" />
                <path d="M766 336l-14 26h28z" fill="#1b1458" />
                <path d="M766 726l-14 -26h28z" fill="#1b1458" />
                <line x1="716" y1="334" x2="754" y2="334" stroke="#1b1458" strokeWidth="4" />
                <line x1="716" y1="728" x2="754" y2="728" stroke="#1b1458" strokeWidth="4" />
                <rect x="640" y="500" width="260" height="56" rx="12" fill="#ffffff" stroke="#1b1458" strokeWidth="3" />
                <text x="770" y="540" textAnchor="middle" fontSize="38" fontWeight="700" fill="#1b1458">
                  Height 10.8&#8243;
                </text>
              </svg>
            </div>

            <div className="mt-4 space-y-2.5 text-sm text-dream-ink">
              <p>
                <strong className="font-semibold">One box around everything on that side.</strong>{" "}
                Width runs from the leftmost edge of any element to the rightmost edge; height runs
                from the highest point to the lowest. In this example the three lines of text
                measure together as one 11.7&#8243; &#215; 10.8&#8243; print, even though each line
                is smaller on its own. A rotated element counts by its tilted footprint.
              </p>
              <p>
                <strong className="font-semibold">It is not the print area.</strong> The printable
                zone on the product just limits placement; these numbers are the actual art
                footprint the customer laid out.
              </p>
              <p>
                <strong className="font-semibold">Treat it as a starting point.</strong> The numbers
                are auto-measured from the customer&#39;s placement in the designer, converted to
                inches by the print area&#39;s calibration on this product. Check them against the
                artwork before production and type over them if the final print spec differs; the
                fields are yours to edit.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
