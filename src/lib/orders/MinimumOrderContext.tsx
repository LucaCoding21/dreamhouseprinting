"use client";

import { createContext, useContext } from "react";
import { DEFAULT_MIN_ONLINE_ORDER_QTY } from "./minimum";

const MinimumOrderContext = createContext<number>(DEFAULT_MIN_ONLINE_ORDER_QTY);

/** Mounted once in the root layout with the value from getMinimumOrderQty(). */
export function MinimumOrderProvider({ value, children }: { value: number; children: React.ReactNode }) {
  return <MinimumOrderContext.Provider value={value}>{children}</MinimumOrderContext.Provider>;
}

/** The shop's current minimum order quantity (0 = no minimum). */
export function useMinimumOrder(): number {
  return useContext(MinimumOrderContext);
}
