"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Dialog, DialogContent } from "@/components/ui/Dialog";
import { Spinner } from "@/components/ui/Spinner";
import { loadSizeGuide } from "@/app/shop/[id]/size-guide-action";
import type { SizeGuide } from "@/lib/ss/types";

type LoadState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded"; guide: SizeGuide | null }
  | { status: "error" };

/**
 * "Size guide" trigger + modal. Measurements come straight from S&S (the
 * supplier we source the blanks from) via the loadSizeGuide server action,
 * fetched lazily the first time the modal opens.
 */
export function SizeGuideModal({
  ssStyleId,
  productName,
}: {
  ssStyleId: string | null;
  productName: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LoadState>({ status: "idle" });

  function openModal() {
    setOpen(true);
    if (state.status !== "idle") return; // already loaded / loading
    setState({ status: "loading" });
    loadSizeGuide(ssStyleId)
      .then((guide) => setState({ status: "loaded", guide }))
      .catch(() => setState({ status: "error" }));
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-xs font-medium text-dream-purple hover:underline"
      >
        Size guide
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl" backdropClassName="bg-dream-overlay/50 backdrop-blur-sm">
          <div className="flex items-start justify-between gap-4 p-5 pb-3">
            <div>
              <h2 className="font-display text-lg font-bold text-dream-ink">Size guide</h2>
              <p className="mt-0.5 text-sm text-dream-muted">{productName}</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="-mr-1 -mt-1 flex h-8 w-8 items-center justify-center rounded-full text-dream-muted transition-colors hover:bg-dream-bg hover:text-dream-ink"
            >
              <span aria-hidden="true" className="text-xl leading-none">&times;</span>
            </button>
          </div>

          <div className="max-h-[70vh] overflow-auto px-5 pb-5">
            {state.status === "loading" && (
              <div className="flex items-center justify-center gap-2 py-12 text-dream-muted">
                <Spinner size={18} />
                <span className="text-sm">Loading measurements…</span>
              </div>
            )}

            {state.status === "error" && (
              <p className="py-12 text-center text-sm text-dream-muted">
                Couldn&rsquo;t load the size guide right now. Please try again later.
              </p>
            )}

            {state.status === "loaded" && !state.guide && (
              <p className="py-12 text-center text-sm text-dream-muted">
                No measurements are published for this product.{" "}
                <Link href="/contact" className="font-semibold text-dream-purple hover:underline">
                  Contact us
                </Link>{" "}
                and we&rsquo;ll help you find the right fit.
              </p>
            )}

            {state.status === "loaded" && state.guide && <SizeGuideBody guide={state.guide} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * Render the guide in the format that fits the data (Jakob's law): a compact
 * numeric grid wants a table; a single size with prose values (One Size totes,
 * M/L caps) wants a label→value list that wraps instead of clipping.
 */
function SizeGuideBody({ guide }: { guide: SizeGuide }) {
  const compact =
    guide.rows.length > 1 &&
    guide.rows.every((r) => guide.columns.every((c) => (r.values[c] ?? "").length <= 10));

  return (
    <>
      {compact ? <SizeMatrix guide={guide} /> : <SizeList guide={guide} />}
      <p className="mt-4 text-xs leading-relaxed text-dream-muted">
        Garment measurements in inches, taken flat. Allow a small tolerance.
      </p>
    </>
  );
}

/** Multi-size numeric grid, scrolls horizontally on overflow instead of clipping. */
function SizeMatrix({ guide }: { guide: SizeGuide }) {
  return (
    <div className="-mx-1 overflow-x-auto rounded-xl border border-dream-line">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-dream-bg text-left align-bottom">
            <th className="sticky left-0 z-10 bg-dream-bg px-4 py-3 font-semibold text-dream-ink">
              Size
            </th>
            {guide.columns.map((c) => (
              <th key={c} className="px-4 py-3 font-semibold text-dream-ink">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {guide.rows.map((row, i) => (
            <tr key={row.size} className={i % 2 ? "bg-dream-surface" : "bg-white"}>
              <th
                scope="row"
                className={`sticky left-0 z-10 px-4 py-3 text-left font-bold text-dream-ink ${i % 2 ? "bg-dream-surface" : "bg-white"}`}
              >
                {row.size}
              </th>
              {guide.columns.map((c) => (
                <td key={c} className="whitespace-nowrap px-4 py-3 tabular-nums text-dream-ink-soft">
                  {row.values[c] ?? "–"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One section per size; each measurement as a wrapping label→value row. No truncation. */
function SizeList({ guide }: { guide: SizeGuide }) {
  return (
    <div className="flex flex-col gap-5">
      {guide.rows.map((row) => (
        <section key={row.size}>
          <span className="inline-block rounded-full bg-dream-lavender-soft px-3 py-1 text-sm font-bold text-dream-purple-dark">
            {row.size}
          </span>
          <dl className="mt-3 divide-y divide-dream-line overflow-hidden rounded-xl border border-dream-line">
            {guide.columns.map((c) => (
              <div
                key={c}
                className="flex flex-col gap-0.5 px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-8"
              >
                <dt className="text-xs font-semibold uppercase tracking-wide text-dream-muted">
                  {c}
                </dt>
                <dd className="text-sm font-medium text-dream-ink sm:text-right">
                  {row.values[c] ?? "–"}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
