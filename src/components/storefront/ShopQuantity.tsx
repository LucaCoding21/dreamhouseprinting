"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";
import { cn } from "@/lib/cn";

/**
 * Universal shop quantity: one number shared by every catalog card, so the
 * grid quotes real per-unit prices ("at 25 units, $12.40") for a minimum
 * print (1 colour, 1 location) instead of the top-volume "as low as" teaser.
 * Lives in React state (remembered in localStorage) so changing it repriced
 * the whole grid instantly, no navigation.
 */

const QTY_MIN = 1;
const QTY_MAX = 1000;
export const DEFAULT_SHOP_QTY = 25; // matches the product page's DEFAULT_QTY
const PRESETS = [10, 25, 50, 100];
const STORAGE_KEY = "dh_shop_qty";

const ShopQtyContext = createContext<{
  qty: number;
  setQty: (n: number) => void;
}>({ qty: DEFAULT_SHOP_QTY, setQty: () => {} });

/** Read the shared shop quantity. Outside a provider it's the default (25). */
export function useShopQty() {
  return useContext(ShopQtyContext);
}

export function ShopQtyProvider({ children }: { children: React.ReactNode }) {
  const [qty, setQtyState] = useState(DEFAULT_SHOP_QTY);

  // Restore the last-used quantity after mount. Reading localStorage in the
  // useState initializer would render a different number on the client than
  // the server did (hydration mismatch), so this one genuinely needs the
  // post-mount setState.
  useEffect(() => {
    try {
      const n = Number(window.localStorage.getItem(STORAGE_KEY));
      if (Number.isFinite(n) && n >= QTY_MIN && n <= QTY_MAX) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setQtyState(Math.round(n));
      }
    } catch {
      // localStorage unavailable (private mode), keep the default
    }
  }, []);

  const setQty = (n: number) => {
    const clamped = Math.min(QTY_MAX, Math.max(QTY_MIN, Math.round(n)));
    setQtyState(clamped);
    try {
      window.localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      // best-effort persistence only
    }
  };

  return (
    <ShopQtyContext.Provider value={{ qty, setQty }}>
      {children}
    </ShopQtyContext.Provider>
  );
}

/** Preset chips + a free-typed field, compact enough for the grid header row. */
export function ShopQtyControl({ className }: { className?: string }) {
  const { qty, setQty } = useShopQty();
  // Keep the raw text separate so partial entries ("5" on the way to "50")
  // don't get clamped mid-keystroke; qty stays the source of truth. Synced
  // during render (not an effect) when qty changes elsewhere (preset chips).
  // A preset chip already shows the active number, so echoing it in the field
  // too just made the same "10" appear twice. The field holds the custom value
  // only, and otherwise shows an example of what to type.
  const [text, setText] = useState(PRESETS.includes(qty) ? "" : String(qty));
  const [lastQty, setLastQty] = useState(qty);
  if (qty !== lastQty) {
    setLastQty(qty);
    setText(PRESETS.includes(qty) ? "" : String(qty));
  }

  const commit = () => {
    if (text.trim() === "") return; // cleared: leave the preset as it is
    const n = Number(text);
    if (Number.isFinite(n) && n >= QTY_MIN) setQty(n);
    else setText(PRESETS.includes(qty) ? "" : String(qty));
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <span className="text-sm font-semibold text-dream-ink-soft">
        Prices for
      </span>
      <div className="flex items-center gap-1.5">
        {PRESETS.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={qty === n}
            onClick={() => setQty(n)}
            className={cn(
              "cursor-pointer rounded-full px-3 py-1.5 font-display text-[14px] font-semibold transition",
              qty === n
                ? "bg-dream-purple text-white"
                : "border border-dream-line bg-white text-dream-ink hover:border-dream-purple/50",
            )}
          >
            {n}
          </button>
        ))}
        <input
          type="number"
          min={QTY_MIN}
          max={QTY_MAX}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          placeholder="e.g. 75"
          aria-label="Quantity to price the catalog at"
          className={cn(
            "h-[34px] w-[4.5rem] rounded-full border bg-white text-center font-display text-[14px] font-semibold text-dream-ink outline-none transition placeholder:font-medium placeholder:text-dream-ink/40",
            "border-dream-line hover:border-dream-purple/50 focus:border-dream-purple focus:ring-2 focus:ring-dream-purple/25",
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            !PRESETS.includes(qty) && "border-dream-purple ring-2 ring-dream-purple/25",
          )}
        />
      </div>
      <span className="text-sm font-semibold text-dream-ink-soft">units</span>
    </div>
  );
}
