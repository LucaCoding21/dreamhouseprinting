"use client";

/**
 * Lite, client-side cart. Holds saved-design summaries in localStorage so the
 * nav badge and the /cart page need no server round-trip. The real Order is
 * still placed server-side at checkout (one order per carted design — see
 * src/app/cart/actions.ts). We store only display fields + the designId; the
 * authoritative design + price live in the database.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "dh_cart_v1";

export interface CartItem {
  /** The saved design's id — the key we place the order against. */
  designId: string;
  /** The product this design is on — used to reopen it in the designer. */
  productId?: string;
  productName: string;
  /** Short human summary of colours/sizes, e.g. "Aqua · 12 pcs". */
  colourSummary: string;
  quantity: number;
  total: number;
  mockupUrl: string | null;
  /** ms epoch, set by the adder (we can't call Date.now() at module load). */
  addedAt: number;
}

interface CartValue {
  items: CartItem[];
  count: number;
  /** Hydrated from localStorage yet? Avoids a flash of an empty badge. */
  ready: boolean;
  addItem: (item: CartItem) => void;
  removeItem: (designId: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartValue | null>(null);

function readStorage(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  // Hydrate once on mount (localStorage can't be read during SSR render without
  // a hydration mismatch), then keep other tabs in sync via the storage event.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration read on mount
    setItems(readStorage());
    setReady(true);
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setItems(readStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const persist = useCallback((next: CartItem[]) => {
    setItems(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* storage full / disabled — cart still works in-memory this session */
    }
  }, []);

  const addItem = useCallback(
    (item: CartItem) => {
      // Replace any existing entry for the same design (re-adding edits it).
      persist([...readStorage().filter((i) => i.designId !== item.designId), item]);
    },
    [persist],
  );

  const removeItem = useCallback(
    (designId: string) => persist(readStorage().filter((i) => i.designId !== designId)),
    [persist],
  );

  const clearCart = useCallback(() => persist([]), [persist]);

  const value = useMemo<CartValue>(
    () => ({ items, count: items.length, ready, addItem, removeItem, clearCart }),
    [items, ready, addItem, removeItem, clearCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
