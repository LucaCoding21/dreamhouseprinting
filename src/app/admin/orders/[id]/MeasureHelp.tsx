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
            {/* Annotated example: order 1006's full back, stored as 11.6 x 13.9 in. */}
            <div className="relative mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-dream-line bg-white">
              <Image
                src="/admin/measure-example-1006.png"
                alt="Shirt mockup with a number overlapping a photo, annotated with the measured bounding box"
                width={960}
                height={1200}
                className="w-full"
              />
              <svg viewBox="0 0 960 1200" className="absolute inset-0 h-full w-full" aria-hidden>
                {/* Bounding box around ALL elements together */}
                <rect
                  x="312"
                  y="290"
                  width="352"
                  height="442"
                  fill="none"
                  stroke="#7664ff"
                  strokeWidth="5"
                  strokeDasharray="14 10"
                />
                {/* Width arrow under the box */}
                <line x1="324" y1="794" x2="652" y2="794" stroke="#1b1458" strokeWidth="6" />
                <path d="M314 794l26 -14v28z" fill="#1b1458" />
                <path d="M662 794l-26 -14v28z" fill="#1b1458" />
                <line x1="312" y1="744" x2="312" y2="782" stroke="#1b1458" strokeWidth="4" />
                <line x1="664" y1="744" x2="664" y2="782" stroke="#1b1458" strokeWidth="4" />
                <rect x="363" y="818" width="250" height="56" rx="12" fill="#ffffff" stroke="#1b1458" strokeWidth="3" />
                <text x="488" y="858" textAnchor="middle" fontSize="38" fontWeight="700" fill="#1b1458">
                  Width 11.6&#8243;
                </text>
                {/* Height arrow beside the box */}
                <line x1="726" y1="302" x2="726" y2="720" stroke="#1b1458" strokeWidth="6" />
                <path d="M726 292l-14 26h28z" fill="#1b1458" />
                <path d="M726 730l-14 -26h28z" fill="#1b1458" />
                <line x1="676" y1="290" x2="714" y2="290" stroke="#1b1458" strokeWidth="4" />
                <line x1="676" y1="732" x2="714" y2="732" stroke="#1b1458" strokeWidth="4" />
                <rect x="600" y="482" width="260" height="56" rx="12" fill="#ffffff" stroke="#1b1458" strokeWidth="3" />
                <text x="730" y="522" textAnchor="middle" fontSize="38" fontWeight="700" fill="#1b1458">
                  Height 13.9&#8243;
                </text>
              </svg>
            </div>

            <div className="mt-4 space-y-2.5 text-sm text-dream-ink">
              <p>
                <strong className="font-semibold">One box around everything on that side.</strong>{" "}
                Width runs from the leftmost edge of any element to the rightmost edge; height runs
                from the highest point to the lowest. In this example the number and the photo
                measure together as one 11.6&#8243; &#215; 13.9&#8243; print, even though each
                element is smaller on its own. A rotated element counts by its tilted footprint.
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
