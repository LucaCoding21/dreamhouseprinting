"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";
import { formatCAD, roundCents } from "@/lib/money";
import { rushTierFee } from "@/lib/pricing/decorationPricing";
import { PROVINCES, calcTax } from "@/lib/pricing/tax";
import { resolveTaxProvince, taxRateLabel } from "@/lib/orders/pricingMath";
import { STATUS_META, TRACKER_STAGES, statusStageIndex } from "@/lib/orderStatus";
import { swatchStyle } from "@/lib/swatch";
import type { DecorationPricingSettings } from "@/lib/pricing/decorationPricing";
import type { OrderStatus } from "@/lib/db/rows";
import type { DecorationSpot } from "../actions";
import { BlankGarment } from "../[id]/BlankGarment";
import { DecorationSpotRow } from "../[id]/DecorationSpotRow";
import {
  LBL,
  SUPPLIER_OPTIONS,
  sizeRank,
  suggestLineUnitPrice,
  type OrderProduct,
} from "../[id]/shared";
import { ColourPickerDialog } from "./ColourPickerDialog";
import { ProductPickerDialog } from "./ProductPickerDialog";
import { createManualOrderAction, searchCustomersAction } from "./actions";
import {
  FREEFORM_SIZE,
  MANUAL_ORDER_STATUSES,
  type CatalogProduct,
  type CustomerHit,
  type ManualOrderItemInput,
} from "./shared";

/* This screen is a fill-in clone of the order detail page: same command header
 * card, same full-width item cards (blank rail / spec middle / price rail),
 * same bottom reference grid. Anything that only exists once an order exists
 * (proofs, comments, payment actions) is simply absent. */

/** Per-line notes, same taxonomy as the order detail's item card. */
const LINE_NOTE_FIELDS: {
  key: "customerNotes" | "productionNotes" | "shippingNotes";
  label: string;
  placeholder: string;
  fromCustomer?: boolean;
}[] = [
  { key: "customerNotes", label: "Customer notes", placeholder: "What the customer asked for", fromCustomer: true },
  { key: "productionNotes", label: "Production notes", placeholder: "Manufacturing, e.g. black shirt needs a white underbase" },
  { key: "shippingNotes", label: "Shipping notes", placeholder: "For the shipping label, e.g. gate code" },
];

interface ItemDraft {
  key: string;
  kind: "catalog" | "custom";
  productId: string;
  colourName: string;
  /** Snapshot label: catalog product name, or the freeform description. */
  productName: string;
  sizes: [string, number][];
  spots: DecorationSpot[];
  bagging: boolean;
  sewnTags: boolean;
  supplier: string;
  customerNotes: string;
  productionNotes: string;
  shippingNotes: string;
  unitPrice: string;
  /** The price was just refilled from the curve; typing over it clears the chip. */
  autoPrice: { unit: number; qty: number } | null;
}

let seq = 0;
function blankItem(kind: "catalog" | "custom"): ItemDraft {
  seq += 1;
  return {
    key: `item-${seq}`,
    kind,
    productId: "",
    colourName: "",
    productName: "",
    sizes: kind === "custom" ? [[FREEFORM_SIZE, 0]] : [],
    spots: [],
    bagging: false,
    sewnTags: false,
    supplier: "",
    customerNotes: "",
    productionNotes: "",
    shippingNotes: "",
    unitPrice: "",
    autoPrice: null,
  };
}

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const itemQty = (it: ItemDraft) => it.sizes.reduce((a, [, q]) => a + (q > 0 ? q : 0), 0);

/** Prefer the screen-print-like method for "Add print", mirroring the detail page. */
const printMethodOf = (names: string[]) =>
  names.find((m) => /screen/i.test(m)) ?? names.find((m) => !/embroider/i.test(m)) ?? names[0] ?? "";
const embroideryMethodOf = (names: string[]) => names.find((m) => /embroider/i.test(m));

const freshSpot = (type: string): DecorationSpot => ({
  location: "",
  type,
  widthIn: "",
  heightIn: "",
  colours: "1",
  pantones: [],
  puff: false,
  spotProcess: false,
});

export function NewOrderClient({
  products,
  methodNames,
  pricingSettings,
}: {
  products: CatalogProduct[];
  /** All active decoration method names, the picker for freeform lines. */
  methodNames: string[];
  pricingSettings: DecorationPricingSettings;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [saving, startSave] = useTransition();

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // ---- Customer -----------------------------------------------------------
  const [mode, setMode] = useState<"existing" | "guest">("existing");
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState<CustomerHit | null>(null);
  const [guest, setGuest] = useState({ name: "", email: "", phone: "" });

  // ---- Order ---------------------------------------------------------------
  const [status, setStatus] = useState<OrderStatus>("submitted");
  const [fulfillment, setFulfillment] = useState<"ship" | "pickup">("pickup");
  // Rush is whatever the admin decides to charge: flat dollars or a custom
  // percent of the subtotal. No tiers, no request flow.
  const [rushType, setRushType] = useState<"amount" | "percent">("percent");
  const [rushValueStr, setRushValueStr] = useState("");
  const [dueDate, setDueDate] = useState("");

  const rushValue = num(rushValueStr);
  const [customerNote, setCustomerNote] = useState("");
  const [sendConfirmation, setSendConfirmation] = useState(false);
  const [address, setAddress] = useState({
    name: "",
    company: "",
    phone: "",
    street: "",
    city: "",
    prov: "BC",
    postal: "",
  });
  const setAddr = (patch: Partial<typeof address>) => setAddress((a) => ({ ...a, ...patch }));

  // ---- Items ---------------------------------------------------------------
  const [items, setItems] = useState<ItemDraft[]>(() => [blankItem("catalog")]);

  /** Non-pricing edits: apply and leave the price alone. */
  const patchItem = (key: string, fn: (it: ItemDraft) => ItemDraft) =>
    setItems((list) => list.map((it) => (it.key === key ? fn(it) : it)));

  /** Curve suggestion for one draft, read against a given list (combined qty). */
  function suggestFor(it: ItemDraft, list: ItemDraft[]) {
    if (it.kind !== "catalog") return null;
    const product = byId.get(it.productId);
    if (!product?.curve) return null;
    // Quantity breaks apply to the combined quantity per product across lines
    // (two colourways of 15 price as 30), exactly like the order detail does
    // across lines sharing a design.
    const combined = list.reduce(
      (sum, other) => (other.kind === "catalog" && other.productId === it.productId ? sum + itemQty(other) : sum),
      0,
    );
    return suggestLineUnitPrice(product.curve, it.spots, Math.max(combined, 1), pricingSettings);
  }

  /**
   * Pricing-relevant edits (sizes, prints, colour counts): apply, then refill
   * the unit price from the curve, exactly like the detail page's auto-reprice.
   * Typing a price by hand wins until the next pricing-relevant edit.
   */
  const patchItemPriced = (key: string, fn: (it: ItemDraft) => ItemDraft) =>
    setItems((list) => {
      const next = list.map((it) => (it.key === key ? fn(it) : it));
      const target = next.find((it) => it.key === key);
      if (!target) return next;
      const s = suggestFor(target, next);
      if (!s) return next;
      return next.map((it) =>
        it.key === key ? { ...it, unitPrice: s.unit.toFixed(2), autoPrice: { unit: s.unit, qty: s.qty } } : it,
      );
    });

  function pickProduct(key: string, id: string) {
    setItems((list) => {
      const product = byId.get(id);
      const next = list.map((it) =>
        it.key === key
          ? {
              ...it,
              productId: id,
              productName: product?.name ?? "",
              // Colours and sizes never map across products, so both reset.
              colourName: product?.colours[0]?.name ?? "",
              sizes: (product?.sizes ?? []).map((s) => [s, 0] as [string, number]),
              spots: product ? [freshSpot(printMethodOf(product.methods.map((m) => m.name)))] : [],
            }
          : it,
      );
      const target = next.find((it) => it.key === key);
      const s = target ? suggestFor(target, next) : null;
      return next.map((it) =>
        it.key === key
          ? { ...it, unitPrice: s ? s.unit.toFixed(2) : "", autoPrice: s ? { unit: s.unit, qty: s.qty } : null }
          : it,
      );
    });
  }

  // Debounced customer lookup. Nothing runs while a customer is already picked.
  useEffect(() => {
    if (mode !== "existing" || picked) return;
    const q = query.trim();
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled) return;
      if (q.length < 2) {
        setHits([]);
        return;
      }
      setSearching(true);
      const res = await searchCustomersAction(q);
      if (cancelled) return;
      setHits(res.customers ?? []);
      setSearching(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, mode, picked]);

  function pickCustomer(hit: CustomerHit) {
    setPicked(hit);
    setHits([]);
    setQuery("");
    const a = hit.address;
    setAddress({
      name: a?.name || hit.name || "",
      company: a?.company || "",
      phone: a?.phone || hit.phone || "",
      street: a?.street || "",
      city: a?.city || "",
      prov: a?.prov || "BC",
      postal: a?.postal || "",
    });
    if (a?.street) setFulfillment("ship");
  }

  // ---- Money ---------------------------------------------------------------
  const [shippingStr, setShippingStr] = useState("0");
  const [taxStr, setTaxStr] = useState("0");
  const [taxTouched, setTaxTouched] = useState(false);

  const unitOf = (it: ItemDraft) => num(it.unitPrice);
  const lineTotal = (it: ItemDraft) => roundCents(unitOf(it) * itemQty(it));

  const subtotal = roundCents(items.reduce((sum, it) => sum + lineTotal(it), 0));
  const rushAmount =
    rushValue <= 0 ? 0 : rushType === "percent" ? rushTierFee(subtotal, 0, rushValue) : roundCents(rushValue);
  const shipping = num(shippingStr);
  // Tax follows the ship-to province; pickup falls back to the shop's own
  // province instead of charging nothing, same as the order detail.
  const taxProv = resolveTaxProvince({ prov: address.prov, fulfillmentMethod: fulfillment });
  const autoTax = calcTax(subtotal + rushAmount + shipping, taxProv.code).total;
  const tax = taxTouched ? num(taxStr) : autoTax;
  const total = roundCents(subtotal + rushAmount + shipping + tax);
  const pieces = items.reduce((sum, it) => sum + itemQty(it), 0);

  const customerReady = mode === "existing" ? !!picked : !!guest.name.trim() && !!guest.email.trim();
  const canCreate = customerReady && pieces > 0;
  const who =
    (mode === "existing" ? picked?.name || picked?.email : guest.name.trim() || guest.email.trim()) || "New customer";

  function submit() {
    const payload: ManualOrderItemInput[] = items
      .filter((it) => itemQty(it) > 0)
      .map((it) => {
        const product = it.kind === "catalog" ? byId.get(it.productId) : undefined;
        const colour = product?.colours.find((c) => c.name === it.colourName) ?? null;
        return {
          kind: it.kind,
          productId: product?.id ?? null,
          productName: it.productName.trim(),
          colourName: colour?.name ?? null,
          colourHex: colour?.hex ?? null,
          // The line's method follows its first print, like placement does.
          decorationMethodId: product?.methods.find((m) => m.name === it.spots[0]?.type)?.id ?? null,
          sizeQuantities: Object.fromEntries(it.sizes.filter(([, q]) => q > 0)),
          unitPrice: unitOf(it),
          spots: it.spots,
          bagging: it.bagging,
          sewnTags: it.sewnTags,
          supplier: it.supplier,
          customerNotes: it.customerNotes,
          productionNotes: it.productionNotes,
          shippingNotes: it.shippingNotes,
        };
      });

    if (payload.length === 0) {
      toast({ title: "Add at least one item with a quantity", variant: "error" });
      return;
    }
    const unnamed = payload.find((p) => !p.productName);
    if (unnamed) {
      toast({ title: "Every item needs a product or a description", variant: "error" });
      return;
    }

    startSave(async () => {
      const res = await createManualOrderAction({
        customerId: mode === "existing" ? picked?.id ?? null : null,
        guest: mode === "guest" ? guest : null,
        status,
        fulfillment,
        rush: rushValue > 0 ? { type: rushType, value: rushValue } : null,
        dueDate: dueDate || null,
        address,
        customerNote,
        shipping,
        tax,
        items: payload,
        sendConfirmation,
      });
      if (res.error || !res.orderId) {
        toast({ title: "Could not create the order", description: res.error, variant: "error" });
        return;
      }
      toast({ title: `Order ${res.orderNumber ?? "created"}`, variant: "success" });
      router.push(`/admin/orders/${res.orderId}`);
    });
  }

  const heroCaption = !customerReady
    ? "Pick or enter the customer in the cards below first"
    : pieces === 0
      ? "Add at least one item with a quantity"
      : `Creates ${who}'s order and opens it`;

  const stageIdx = statusStageIndex(status);
  const stageLabel =
    stageIdx >= 0 ? `${stageIdx + 1}/${TRACKER_STAGES.length} ${TRACKER_STAGES[stageIdx].label}` : STATUS_META[status].label;

  return (
    <div className="space-y-6 px-8 py-6">
      {/* Command header, cloned from the order detail's strip */}
      <div className="space-y-5 rounded-xl border border-dream-line bg-dream-surface p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin/orders" className="text-sm text-dream-purple hover:underline">
            Back to orders
          </Link>
          <span className="text-xs text-dream-faint">Nothing is saved until you create the order</span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-bold text-dream-ink">New order</h1>
              <Badge variant="info">{STATUS_META[status].label}</Badge>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-dream-muted">
              <span className="font-medium text-dream-ink">{who}</span>
              <span aria-hidden>·</span>
              <span>Manual order (phone / DM / walk-in)</span>
            </div>
          </div>

          {/* Top summary clone: stage, money, payment */}
          <div className="flex flex-wrap items-start gap-x-8 gap-y-3">
            <div>
              <div className={LBL}>Stage</div>
              <div className="mt-0.5 font-display text-sm font-bold text-dream-ink">{stageLabel}</div>
            </div>
            <div>
              <div className={LBL}>Order total</div>
              <div className="font-display text-2xl font-bold leading-tight text-dream-ink">{formatCAD(total)}</div>
            </div>
            <div>
              <div className={LBL}>Payment</div>
              <div className="mt-1">
                <Badge variant="warn">unpaid</Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-dream-line pt-5">
          <div className="flex flex-col items-end gap-2">
            <Button
              variant="primary"
              size="lg"
              className="min-w-48 disabled:pointer-events-auto disabled:cursor-not-allowed"
              loading={saving}
              disabled={!canCreate}
              title={canCreate ? undefined : heroCaption}
              onClick={submit}
            >
              Create order
            </Button>
            <p className="text-xs text-dream-muted">{heroCaption}</p>
          </div>
        </div>
      </div>

      {/* Items, the hero of the screen, full width like the order detail */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-lg font-semibold text-dream-ink">Items ({items.length})</h2>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => setItems((l) => [...l, blankItem("catalog")])}>
              Add catalog item
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setItems((l) => [...l, blankItem("custom")])}>
              Add custom item
            </Button>
          </div>
        </div>

        {items.map((it, idx) => (
          <NewItemCard
            key={it.key}
            item={it}
            index={idx}
            products={products}
            product={it.kind === "catalog" ? byId.get(it.productId) : undefined}
            methodNamesAll={methodNames}
            onPatch={(fn) => patchItem(it.key, fn)}
            onPatchPriced={(fn) => patchItemPriced(it.key, fn)}
            onPickProduct={(id) => pickProduct(it.key, id)}
            onRemove={items.length > 1 ? () => setItems((l) => l.filter((x) => x.key !== it.key)) : undefined}
          />
        ))}
      </div>

      {/* ── Reference: customer, order settings, money, kept at the bottom ── */}
      <section className="space-y-6 border-t border-dream-line pt-8">
        <div className="grid items-start gap-6 lg:grid-cols-3">
          {/* Customer card */}
          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Customer</CardTitle>
              <div className="flex gap-1 rounded-lg bg-dream-bg p-1">
                {(["existing", "guest"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                      mode === m ? "bg-white text-dream-ink shadow-sm" : "text-dream-muted hover:text-dream-ink",
                    )}
                  >
                    {m === "existing" ? "Existing account" : "New / walk-in"}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {mode === "existing" ? (
                picked ? (
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-dream-line bg-dream-bg p-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-dream-ink">{picked.name ?? "Unnamed"}</div>
                      <div className="truncate text-dream-muted">{picked.email}</div>
                      {picked.phone && <div className="text-dream-muted">{picked.phone}</div>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Labeled label="Search accounts">
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Jane Smith or jane@example.com"
                      />
                    </Labeled>
                    {searching && <p className="text-xs text-dream-muted">Searching...</p>}
                    {hits.length > 0 && (
                      <ul className="divide-y divide-dream-line overflow-hidden rounded-lg border border-dream-line">
                        {hits.map((h) => (
                          <li key={h.id}>
                            <button
                              type="button"
                              onClick={() => pickCustomer(h)}
                              className="flex w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-dream-bg"
                            >
                              <span className="text-sm font-semibold text-dream-ink">{h.name ?? "Unnamed"}</span>
                              <span className="text-xs text-dream-muted">{h.email}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {!searching && query.trim().length >= 2 && hits.length === 0 && (
                      <p className="text-xs text-dream-muted">
                        No match. Switch to <strong>New / walk-in</strong> to type their details instead.
                      </p>
                    )}
                  </div>
                )
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <Labeled label="Name *">
                      <Input value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} />
                    </Labeled>
                    <Labeled label="Phone">
                      <Input value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} />
                    </Labeled>
                  </div>
                  <Labeled label="Email * (order updates go here)">
                    <Input
                      type="email"
                      value={guest.email}
                      onChange={(e) => setGuest({ ...guest, email: e.target.value })}
                    />
                  </Labeled>
                </div>
              )}

              {/* Fulfilment + shipping address, mirroring the detail's edit form */}
              <div className="space-y-3 border-t border-dream-line pt-3">
                <div className="grid grid-cols-2 gap-3">
                  <Labeled label="Fulfillment">
                    <Select value={fulfillment} onChange={(e) => setFulfillment(e.target.value as "ship" | "pickup")}>
                      <option value="pickup">Pick up</option>
                      <option value="ship">Ship</option>
                    </Select>
                  </Labeled>
                  <Labeled label="Company">
                    <Input value={address.company} onChange={(e) => setAddr({ company: e.target.value })} />
                  </Labeled>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Labeled label="Contact name">
                    <Input value={address.name} onChange={(e) => setAddr({ name: e.target.value })} />
                  </Labeled>
                  <Labeled label="Phone">
                    <Input value={address.phone} onChange={(e) => setAddr({ phone: e.target.value })} />
                  </Labeled>
                </div>
                <Labeled label={fulfillment === "ship" ? "Street *" : "Street"}>
                  <Input value={address.street} onChange={(e) => setAddr({ street: e.target.value })} />
                </Labeled>
                <div className="grid grid-cols-[1fr_5.5rem] gap-3">
                  <Labeled label="City">
                    <Input value={address.city} onChange={(e) => setAddr({ city: e.target.value })} />
                  </Labeled>
                  <Labeled label="Postal">
                    <Input value={address.postal} onChange={(e) => setAddr({ postal: e.target.value })} />
                  </Labeled>
                </div>
                <Labeled label="Province (sets the sales tax)">
                  <Select value={address.prov} onChange={(e) => setAddr({ prov: e.target.value })}>
                    {PROVINCES.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.code} - {p.name}
                      </option>
                    ))}
                  </Select>
                </Labeled>
              </div>
            </CardContent>
          </Card>

          {/* Order details card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Order details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Labeled label="Starting status">
                <Select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
                  {MANUAL_ORDER_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Labeled>

              <Labeled label="In-hands date (drives the countdown on the orders list)">
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Labeled>

              {/* Rush charge: flat dollars or a custom percent of the subtotal,
                  same $/% control as the pricing card's discount row. */}
              <Labeled label="Rush fee (optional)">
                <div className="flex items-center gap-1.5">
                  <Select
                    value={rushType}
                    onChange={(e) => setRushType(e.target.value as "amount" | "percent")}
                    className="h-9 w-20 shrink-0 py-0 leading-none"
                    title="Flat dollars or a percent of the subtotal"
                  >
                    <option value="amount">$</option>
                    <option value="percent">%</option>
                  </Select>
                  <Input
                    inputMode="decimal"
                    value={rushValueStr}
                    placeholder="0"
                    onChange={(e) => setRushValueStr(e.target.value)}
                    className="h-9 flex-1 text-right"
                  />
                </div>
                {rushType === "percent" && rushAmount > 0 && (
                  <p className="mt-1 text-right text-[11px] text-dream-faint">
                    = {formatCAD(rushAmount)} on the current subtotal
                  </p>
                )}
              </Labeled>

              <div className="space-y-2 border-t border-dream-line pt-3">
                <Labeled label="Note to customer (shown on their order page)">
                  <Textarea
                    rows={3}
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                    placeholder="Anything the customer should see on their order page."
                  />
                </Labeled>
                <Checkbox
                  id="send-confirmation"
                  label="Send confirmation email to customer"
                  checked={sendConfirmation}
                  onChange={(e) => setSendConfirmation(e.target.checked)}
                />
                <p className="text-xs text-dream-muted">
                  Off by default: a phone or counter order is usually confirmed in person.
                </p>
              </div>

              {/* Stat mini-block, same as the detail's reference cluster */}
              <div className="grid grid-cols-3 gap-3 border-t border-dream-line pt-3">
                {[
                  { label: "In hands", value: dueDate || "-" },
                  { label: "Total pieces", value: String(pieces) },
                  { label: "Order value", value: formatCAD(total) },
                ].map((s) => (
                  <div key={s.label}>
                    <div className={LBL}>{s.label}</div>
                    <div className="mt-0.5 truncate text-sm font-semibold text-dream-ink">{s.value}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Pricing card, cloned row style from the detail's Pricing & invoice */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-dream-muted">Subtotal ({pieces} {pieces === 1 ? "piece" : "pieces"})</span>
                <span className="w-32 text-right text-dream-ink">{formatCAD(subtotal)}</span>
              </div>
              {rushAmount > 0 && (
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-dream-muted">
                    Rush{rushType === "percent" ? ` (+${rushValue}%)` : ""}
                  </span>
                  <span className="w-32 text-right text-dream-ink">{formatCAD(rushAmount)}</span>
                </div>
              )}
              <label className="flex items-center justify-between gap-2 text-sm">
                <span className="text-dream-muted">Shipping</span>
                <Input
                  inputMode="decimal"
                  value={shippingStr}
                  onChange={(e) => setShippingStr(e.target.value)}
                  className="h-8 w-32 text-right"
                />
              </label>
              <div>
                <label className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-2 text-dream-muted">
                    Tax
                    {taxTouched && (
                      <button
                        type="button"
                        onClick={() => setTaxTouched(false)}
                        className="text-xs font-semibold text-dream-purple hover:underline"
                      >
                        Auto
                      </button>
                    )}
                  </span>
                  <Input
                    inputMode="decimal"
                    value={taxTouched ? taxStr : autoTax.toFixed(2)}
                    onChange={(e) => {
                      setTaxTouched(true);
                      setTaxStr(e.target.value);
                    }}
                    className="h-8 w-32 text-right"
                  />
                </label>
                <p className="mt-0.5 text-right text-[11px] text-dream-faint">
                  {taxRateLabel(taxProv.code)}
                  {taxProv.source === "pickup" ? ", pickup order" : ""}. Edit to override.
                </p>
              </div>
              <div className="flex justify-between border-t border-dream-line pt-2 font-semibold text-dream-ink">
                <span>Total</span>
                <span>{formatCAD(total)}</span>
              </div>
              <p className="text-[11px] text-dream-faint">
                Unit prices are edited per line above; discounts and extra fees live on the order page once it exists.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-end">
          <Button
            size="lg"
            loading={saving}
            disabled={!canCreate}
            className="disabled:pointer-events-auto disabled:cursor-not-allowed"
            title={canCreate ? undefined : heroCaption}
            onClick={submit}
          >
            Create order
          </Button>
        </div>
      </section>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className={cn(LBL, "mb-1")}>{label}</div>
      {children}
    </div>
  );
}


/**
 * One draft line, cloned from the order detail's OrderItemCard: supplier blanks
 * on the left, product / sizes / prints / notes in the middle, price on the
 * right. Design-only bits (mockups, proofs, artwork) don't exist yet.
 */
function NewItemCard({
  item,
  index,
  products,
  product,
  methodNamesAll,
  onPatch,
  onPatchPriced,
  onPickProduct,
  onRemove,
}: {
  item: ItemDraft;
  index: number;
  products: CatalogProduct[];
  product: CatalogProduct | undefined;
  methodNamesAll: string[];
  onPatch: (fn: (it: ItemDraft) => ItemDraft) => void;
  onPatchPriced: (fn: (it: ItemDraft) => ItemDraft) => void;
  onPickProduct: (id: string) => void;
  onRemove?: () => void;
}) {
  const [newSize, setNewSize] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [colourOpen, setColourOpen] = useState(false);
  const isCatalog = item.kind === "catalog";
  const qty = itemQty(item);
  const unit = num(item.unitPrice);

  const methodOptions = product ? product.methods.map((m) => m.name) : methodNamesAll;
  const printMethod = printMethodOf(methodOptions);
  const embroideryMethod = embroideryMethodOf(methodOptions);

  const colour = product?.colours.find((c) => c.name === item.colourName);
  // BlankGarment renders straight off the product's colour images, same rail
  // as the order detail's left column.
  const blankProduct: OrderProduct | undefined = product
    ? {
        id: product.id,
        name: product.name,
        brand: product.brand,
        ss_style_name: product.ssStyleName,
        ss_style_id: null,
        colours: product.colours,
        pricing_rules: null,
      }
    : undefined;

  // Only the sizes on the line get a column; the product's other sizes become
  // one-click "+XS" pills, cloned from the detail's size run.
  const displaySizes = item.sizes.map(([s]) => s);
  const missingStandard = isCatalog
    ? (product?.sizes ?? []).filter((s) => !item.sizes.some(([k]) => k.toUpperCase() === s.toUpperCase()))
    : [];
  const qtyOf = (s: string) => item.sizes.find(([k]) => k === s)?.[1] ?? 0;

  const setSizeQty = (s: string, val: number) =>
    onPatchPriced((p) => ({
      ...p,
      sizes: p.sizes.map(([k, v]) => (k === s ? [k, val] : [k, v])),
    }));

  const removeSize = (s: string) =>
    onPatchPriced((p) => ({ ...p, sizes: p.sizes.filter(([k]) => k !== s) }));

  const addSizeColumn = (s: string) =>
    onPatchPriced((p) =>
      p.sizes.some(([k]) => k.toUpperCase() === s.toUpperCase())
        ? p
        : { ...p, sizes: [...p.sizes, [s, 0] as [string, number]].sort(([a], [b]) => sizeRank(a) - sizeRank(b)) },
    );

  function addSize() {
    const s = newSize.trim().toUpperCase();
    if (s) addSizeColumn(s);
    setNewSize("");
  }

  /** Spot fields that move the price: the method, the colour count, the size. */
  const PRICED_SPOT_KEYS: (keyof DecorationSpot)[] = ["type", "colours", "widthIn", "heightIn"];

  const patchSpot = (si: number, patch: Partial<DecorationSpot>) => {
    const apply = (it: ItemDraft): ItemDraft => ({
      ...it,
      spots: it.spots.map((s, i) => (i === si ? { ...s, ...patch } : s)),
    });
    const priced = Object.keys(patch).some((k) => PRICED_SPOT_KEYS.includes(k as keyof DecorationSpot));
    return priced ? onPatchPriced(apply) : onPatch(apply);
  };

  const addSpot = (type: string) => onPatchPriced((it) => ({ ...it, spots: [...it.spots, freshSpot(type)] }));
  const removeSpot = (si: number) => onPatchPriced((p) => ({ ...p, spots: p.spots.filter((_, i) => i !== si) }));

  // Line-level finishing options, rendered inside the first print's Advanced
  // spec dropdown, exactly like the detail card.
  const finishingSpec = (
    <div className="flex flex-col gap-1.5">
      <div className={LBL}>Finishing</div>
      <Checkbox
        label="Individual bagging"
        checked={item.bagging}
        onChange={(e) => onPatch((p) => ({ ...p, bagging: e.target.checked }))}
      />
      <Checkbox
        label="Sewn-on size tags"
        checked={item.sewnTags}
        onChange={(e) => onPatch((p) => ({ ...p, sewnTags: e.target.checked }))}
      />
    </div>
  );

  const noCurve = isCatalog && !!product && !product.curve;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row">
          {/* LEFT, the supplier blank in the picked colour */}
          <div className="flex shrink-0 flex-col gap-3 lg:w-44">
            {blankProduct && colour ? (
              <BlankGarment product={blankProduct} colour={{ name: colour.name, hex: colour.hex ?? null }} />
            ) : (
              <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-dream-line bg-dream-bg p-2 text-center text-xs text-dream-faint">
                {isCatalog ? "Pick a product to see the blank" : "Custom item"}
              </div>
            )}

            {colour && (
              <div className="space-y-1 text-sm">
                <span className="inline-flex items-center gap-1.5 text-dream-muted">
                  Colour:
                  <span
                    className="h-3.5 w-3.5 rounded-full border border-dream-line-strong"
                    style={swatchStyle({ name: colour.name, hex: colour.hex ?? null })}
                  />
                  <span className="font-medium text-dream-ink">{colour.name}</span>
                </span>
              </div>
            )}
          </div>

          {/* MIDDLE, product, sizes, print, notes */}
          <div className="min-w-0 flex-1 space-y-5">
            <div className="flex items-center gap-2">
              <span className="text-sm text-dream-faint">{index + 1}.</span>
              {isCatalog ? (
                <>
                  {/* Visual picker (photos, prices, search) instead of a bare
                      select; the button reads as the field it replaces. */}
                  <button
                    type="button"
                    onClick={() => setPickerOpen(true)}
                    className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border border-dream-line bg-white px-3 text-left text-sm transition-colors hover:border-dream-purple"
                  >
                    {product ? (
                      <>
                        <span className="truncate font-semibold text-dream-ink">
                          {product.brand ? `${product.brand} ` : ""}
                          {product.name}
                        </span>
                        <span className="ml-auto shrink-0 text-xs font-semibold text-dream-purple">Change</span>
                      </>
                    ) : (
                      <>
                        <span className="text-dream-muted">Pick a product…</span>
                        <span className="ml-auto shrink-0 text-xs font-semibold text-dream-purple">Browse</span>
                      </>
                    )}
                  </button>
                  <ProductPickerDialog
                    open={pickerOpen}
                    onOpenChange={setPickerOpen}
                    products={products}
                    currentId={item.productId}
                    onPick={onPickProduct}
                  />
                  {/* Colour twin of the product picker: photo grid, not a select. */}
                  <button
                    type="button"
                    onClick={() => setColourOpen(true)}
                    disabled={!product}
                    title="Garment colour"
                    className={cn(
                      "flex h-10 w-44 shrink-0 items-center gap-1.5 rounded-lg border border-dream-line bg-white px-3 text-left text-sm transition-colors",
                      product ? "hover:border-dream-purple" : "cursor-not-allowed opacity-60",
                    )}
                  >
                    {colour ? (
                      <>
                        <span
                          aria-hidden
                          className="h-3.5 w-3.5 shrink-0 rounded-full border border-dream-line-strong"
                          style={swatchStyle({ name: colour.name, hex: colour.hex ?? null })}
                        />
                        <span className="truncate font-medium text-dream-ink">{colour.name}</span>
                      </>
                    ) : (
                      <span className="truncate text-dream-muted">Pick a colour…</span>
                    )}
                  </button>
                  {product && (
                    <ColourPickerDialog
                      open={colourOpen}
                      onOpenChange={setColourOpen}
                      productName={product.name}
                      colours={product.colours}
                      currentName={item.colourName}
                      onPick={(name) => onPatch((p) => ({ ...p, colourName: name }))}
                    />
                  )}
                </>
              ) : (
                <Input
                  value={item.productName}
                  onChange={(e) => onPatch((p) => ({ ...p, productName: e.target.value }))}
                  placeholder="Vinyl banner, 3ft x 6ft"
                  className="flex-1 font-semibold text-dream-ink"
                />
              )}
              {onRemove && (
                <button
                  type="button"
                  aria-label="Remove item"
                  className="rounded p-1 text-dream-faint transition-colors hover:bg-dream-danger-soft hover:text-dream-danger"
                  onClick={onRemove}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {!isCatalog ? (
                <Badge variant="neutral">Custom</Badge>
              ) : product?.ssStyleName ? (
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className={LBL}>S&amp;S blank</span>
                  <span className="font-semibold text-dream-ink">
                    {product.brand ? `${product.brand} ${product.ssStyleName}` : product.ssStyleName}
                  </span>
                </div>
              ) : (
                <span className="text-sm text-dream-muted">{product ? "No S&S style linked" : "No product picked"}</span>
              )}
              {isCatalog && product && !product.isActive && <Badge variant="warn">Hidden in shop</Badge>}

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5">
                  <span className={LBL}>Supplier</span>
                  <Select
                    value={item.supplier}
                    title="Where the blanks for this line are coming from"
                    onChange={(e) => onPatch((p) => ({ ...p, supplier: e.target.value }))}
                    className="h-8 w-40 py-0 leading-none"
                  >
                    <option value="">Not set</option>
                    {SUPPLIER_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </Select>
                </label>
              </div>
            </div>

            {/* Sizes, one horizontal row of size columns, cloned from the detail */}
            <div>
              <div className={cn(LBL, "mb-2")}>Sizes ({qty} pcs)</div>
              <div className="flex flex-wrap items-start gap-1.5">
                {displaySizes.map((s) => {
                  const q = qtyOf(s);
                  const fixed = !isCatalog && s === FREEFORM_SIZE;
                  return (
                    <div key={s} className={cn(s.length > 4 ? "w-16" : "w-11")}>
                      <div
                        title={s}
                        className="mb-1 h-4 truncate whitespace-nowrap text-center text-xs font-semibold uppercase leading-4 text-dream-muted"
                      >
                        {s}
                      </div>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={q === 0 ? "" : q}
                        placeholder="0"
                        onChange={(e) => setSizeQty(s, Math.max(0, Number(e.target.value) || 0))}
                        className="h-9 px-1 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      {!fixed && (
                        <button
                          type="button"
                          aria-label={`Remove size ${s}`}
                          title={`Remove size ${s}`}
                          tabIndex={-1}
                          className="mx-auto mt-1 block h-4 w-4 rounded text-xs leading-none text-dream-faint transition-colors hover:bg-dream-danger-soft hover:text-dream-danger"
                          onClick={() => removeSize(s)}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                })}
                {missingStandard.length > 0 && (
                  <div>
                    <div className="mb-1 h-4" aria-hidden />
                    <div className="flex h-9 flex-wrap items-center gap-1">
                      {missingStandard.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => addSizeColumn(s)}
                          title={`Add size ${s}`}
                          tabIndex={-1}
                          className="rounded-md border border-dashed border-dream-line px-1.5 py-1 text-[10px] font-bold uppercase leading-none text-dream-faint transition-colors hover:border-dream-purple hover:text-dream-purple"
                        >
                          +{s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {isCatalog && (
                  <div className="w-24">
                    <div className="mb-1 text-center text-[10px] font-semibold uppercase text-dream-faint">Eg. S or M</div>
                    <div className="flex items-center gap-1">
                      <Input
                        value={newSize}
                        onChange={(e) => setNewSize(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addSize();
                          }
                        }}
                        className="h-9 text-center text-xs"
                      />
                      <Button variant="secondary" size="sm" className="h-9" onClick={addSize} disabled={!newSize.trim()}>
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Print / decoration section, real spot rows like the detail */}
            <div className="space-y-3">
              <div className={LBL}>
                Print ({item.spots.length} spot{item.spots.length === 1 ? "" : "s"})
              </div>
              {item.spots.map((spot, si) => (
                <DecorationSpotRow
                  key={si}
                  spot={spot}
                  index={si}
                  methodOptions={methodOptions}
                  canEdit
                  onPatch={(patch) => patchSpot(si, patch)}
                  onRemove={() => removeSpot(si)}
                  extraSpec={si === 0 ? finishingSpec : undefined}
                  extraSpecActive={si === 0 && (item.bagging || item.sewnTags)}
                />
              ))}
              {/* No prints on this line, the finishing options still need a home. */}
              {item.spots.length === 0 && (
                <div className="rounded-lg border border-dream-line p-3">{finishingSpec}</div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" onClick={() => addSpot(printMethod)}>
                  Add print
                </Button>
                {embroideryMethod && (
                  <Button variant="secondary" size="sm" onClick={() => addSpot(embroideryMethod)}>
                    Add embroidery
                  </Button>
                )}
              </div>
            </div>

            {/* Per-line notes, same three fields as the detail card */}
            <div className="grid gap-3 sm:grid-cols-3">
              {LINE_NOTE_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className={LBL}>{f.label}</span>
                    {f.fromCustomer ? (
                      <span
                        title="What the customer asked for. Shown to them on their order page notes."
                        className="rounded bg-dream-info-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-dream-info"
                      >
                        From the customer
                      </span>
                    ) : (
                      <span className="rounded bg-dream-line px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-dream-muted">
                        Internal
                      </span>
                    )}
                  </div>
                  <Textarea
                    rows={2}
                    value={item[f.key]}
                    placeholder={f.placeholder}
                    onChange={(e) => onPatch((p) => ({ ...p, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT, price rail */}
          <div className="shrink-0 border-t border-dream-line pt-4 lg:w-48 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div className={cn(LBL, "mb-1")}>Unit price</div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-dream-muted">$</span>
              <Input
                value={item.unitPrice}
                inputMode="decimal"
                placeholder="0.00"
                // Typing a price by hand wins: the auto chip drops off and the
                // number is left alone until the next pricing-relevant edit.
                onChange={(e) => onPatch((p) => ({ ...p, unitPrice: e.target.value, autoPrice: null }))}
                className="h-9 w-24"
              />
              {item.autoPrice && (
                <span
                  title="Filled from this product's price tiers. Type over it to override."
                  className="rounded-full bg-dream-lavender-soft px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-dream-purple"
                >
                  Auto
                </span>
              )}
            </div>
            <div className="mt-1 text-sm text-dream-muted">× {qty} units</div>
            <div className="mt-4 border-t border-dream-line pt-4">
              <div className="font-display text-xl font-bold text-dream-ink">{formatCAD(unit * qty)}</div>
              <div className="text-xs text-dream-muted">
                {formatCAD(unit)} × {qty}
              </div>
            </div>
            {noCurve && (
              <p className="mt-3 rounded-lg border border-dream-warn/40 bg-dream-warn-soft p-2.5 text-xs text-dream-warn">
                No price curve on this product, type a price.
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
