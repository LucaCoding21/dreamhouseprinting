"use client";

import { useEffect, useId, useMemo, useState, useTransition } from "react";
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
import { scrollToCenter } from "@/lib/scrollToCenter";
import { AddItemRow } from "@/components/admin/AddItemRow";
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
import { openInNewTab, fileKind } from "../[id]/ProofLightbox";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { PriceBreakdown } from "@/components/admin/PriceBreakdown";
import { PdfGlyph, PdfThumb } from "@/components/orders/PdfThumb";
import { breakdownUnitPrice, type PriceChargeDraft } from "@/lib/orders/priceBreakdown";
import { DecorationSpotRow } from "../[id]/DecorationSpotRow";
import {
  LBL,
  SIZE_ORDER,
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
  type ManualOrderAddress,
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
}[] = [
  { key: "customerNotes", label: "Customer notes", placeholder: "What the customer asked for" },
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
  /** Mockups staged to the proofs bucket while the order is being built. */
  mockups: StagedMockup[];
  /** Custom lines only: charges the unit price is built from. Empty = typed by hand. */
  priceCharges: PriceChargeDraft[];
}

interface StagedMockup {
  path: string;
  name: string;
  /** Object URL for the local preview (revoked on remove). */
  preview: string;
  kind: "image" | "pdf";
}

const BLANK_ADDRESS: ManualOrderAddress = { name: "", company: "", phone: "", street: "", unit: "", city: "", prov: "BC", postal: "" };

/** Same shape the server action accepts, so the form never enables a submit it would reject. */
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

interface MissingField {
  key: string;
  /** Reads after "Still missing:" in the hero caption. */
  label: string;
}

/** A custom line opens on the common size run; the rest of SIZE_ORDER (and a
 *  plain "Qty" column for unsized goods) are one click away as "+" pills. */
const CUSTOM_DEFAULT_SIZES = ["S", "M", "L", "XL"];

let seq = 0;
function blankItem(kind: "catalog" | "custom"): ItemDraft {
  seq += 1;
  return {
    key: `item-${seq}`,
    kind,
    productId: "",
    colourName: "",
    productName: "",
    sizes: kind === "custom" ? CUSTOM_DEFAULT_SIZES.map((s) => [s, 0] as [string, number]) : [],
    spots: [],
    bagging: false,
    sewnTags: false,
    supplier: "",
    customerNotes: "",
    productionNotes: "",
    shippingNotes: "",
    unitPrice: "",
    autoPrice: null,
    mockups: [],
    priceCharges: [],
  };
}

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const itemQty = (it: ItemDraft) => it.sizes.reduce((a, [, q]) => a + (q > 0 ? q : 0), 0);

/** A line priced from a breakdown keeps its unit price in step with the
 *  charges AND the quantity (one-time charges spread over the pieces). */
const withBreakdown = (it: ItemDraft): ItemDraft =>
  it.priceCharges.length > 0
    ? { ...it, unitPrice: breakdownUnitPrice(it.priceCharges, itemQty(it)).toFixed(2), autoPrice: null }
    : it;

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
  // Errors stay out of the way until Create order is actually pressed: the
  // form is long, and painting it red while it is still being filled in is
  // noise. Pressing Create with gaps is what turns the hints on.
  const [tried, setTried] = useState(false);
  const uid = useId();
  /** DOM id for a blocking field, so a failed submit can jump straight to it. */
  const fid = (key: string) => `${uid}-${key}`;

  const byId = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  // ---- Customer -----------------------------------------------------------
  // One plain contact box. Typing a name or email looks up existing accounts
  // underneath it; picking a match links the order to that account and fills
  // the boxes, otherwise the order is a guest order. No mode toggle.
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "", company: "" });
  const setCust = (patch: Partial<typeof customer>) => setCustomer((c) => ({ ...c, ...patch }));
  const [linked, setLinked] = useState<CustomerHit | null>(null);
  /** The last name/email fragment typed, what the account lookup runs on. */
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [searching, setSearching] = useState(false);

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
  const [address, setAddress] = useState<ManualOrderAddress>(BLANK_ADDRESS);
  const setAddr = (patch: Partial<ManualOrderAddress>) => setAddress((a) => ({ ...a, ...patch }));
  // Bill-to is its own card. Blank means "same as shipping" as far as the
  // order is concerned (the server stores null), the copy button just saves
  // retyping when it genuinely is the same.
  const [billing, setBilling] = useState<ManualOrderAddress>(BLANK_ADDRESS);
  const setBill = (patch: Partial<ManualOrderAddress>) => setBilling((a) => ({ ...a, ...patch }));
  const billingBlank = (["name", "company", "phone", "street", "unit", "city", "postal"] as const).every((k) => !billing[k].trim());

  // ---- Items ---------------------------------------------------------------
  const [items, setItems] = useState<ItemDraft[]>(() => [blankItem("catalog")]);

  /** Non-pricing edits: apply and leave the price alone. */
  const patchItem = (key: string, fn: (it: ItemDraft) => ItemDraft) =>
    setItems((list) => list.map((it) => (it.key === key ? withBreakdown(fn(it)) : it)));

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
      const next = list.map((it) => (it.key === key ? withBreakdown(fn(it)) : it));
      const target = next.find((it) => it.key === key);
      if (!target) return next;
      const s = suggestFor(target, next);
      if (!s) return next;
      return next.map((it) =>
        it.key === key ? { ...it, unitPrice: s.unit.toFixed(2), autoPrice: { unit: s.unit, qty: s.qty } } : it,
      );
    });

  /** A catalog line becomes a freeform one in place (from the picker's
   *  pinned Custom product tile). Notes are kept, everything product-bound
   *  resets. */
  function switchToCustom(key: string) {
    setItems((list) =>
      list.map((it) =>
        it.key === key
          ? { ...blankItem("custom"), key, mockups: it.mockups, customerNotes: it.customerNotes, productionNotes: it.productionNotes, shippingNotes: it.shippingNotes }
          : it,
      ),
    );
  }

  function pickProduct(key: string, id: string) {
    setItems((list) => {
      const product = byId.get(id);
      const next = list.map((it) =>
        it.key === key
          ? {
              ...it,
              // Also the way back from a custom line: picking a product makes
              // it a catalog line again.
              kind: "catalog" as const,
              // Catalog lines price from the curve, not a breakdown.
              priceCharges: [],
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

  // Debounced account lookup off whatever was last typed in Name or Email.
  // Nothing runs once an account is linked.
  useEffect(() => {
    if (linked) return;
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
  }, [query, linked]);

  function linkAccount(hit: CustomerHit) {
    setLinked(hit);
    setHits([]);
    setQuery("");
    const a = hit.address;
    setCustomer({
      name: hit.name || a?.name || "",
      email: hit.email || "",
      phone: hit.phone || a?.phone || "",
      company: a?.company || "",
    });
    // Their saved address only lands on the ship-to when it has a street;
    // otherwise whatever staff already typed stays.
    if (a?.street) {
      setAddress({
        name: a.name || hit.name || "",
        company: a.company || "",
        phone: a.phone || hit.phone || "",
        street: a.street,
        unit: a.unit || "",
        city: a.city || "",
        prov: a.prov || "BC",
        postal: a.postal || "",
      });
      setFulfillment("ship");
    }
  }

  /** Push ship-to into the bill-to card, with the customer's own details
   *  filling any gap. The button lives on the shipping card, so the change
   *  happens off-screen on narrow layouts: hence the toast. */
  function copyShippingToBilling() {
    setBilling({
      ...address,
      name: address.name || customer.name,
      company: address.company || customer.company,
      phone: address.phone || customer.phone,
    });
    toast({ title: "Copied to the billing address", variant: "success" });
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

  // Everything that still blocks "Create order", in the order the form reads.
  // The button, its caption AND the inline "Required" hints all derive from
  // this one list, so they can never disagree about what is missing.
  const emailOk = EMAIL_RE.test(customer.email.trim());
  const missing: MissingField[] = [];
  if (!customer.name.trim()) missing.push({ key: "customerName", label: "customer name" });
  if (!emailOk) {
    missing.push({ key: "customerEmail", label: customer.email.trim() ? "a valid customer email" : "customer email" });
  }
  if (pieces === 0) {
    missing.push({ key: "qty", label: items.length === 1 ? "a quantity on the item" : "a quantity on at least one item" });
  }
  items.forEach((it, i) => {
    if (itemQty(it) > 0 && !it.productName.trim()) {
      missing.push({
        key: `name-${it.key}`,
        label: it.kind === "custom" ? `a description on item ${i + 1}` : `a product on item ${i + 1}`,
      });
    }
  });
  if (fulfillment === "ship" && !address.street.trim()) missing.push({ key: "street", label: "a shipping street" });
  const missingKeys = new Set(missing.map((m) => m.key));
  const canCreate = missing.length === 0;
  /** True only once a submit has been attempted, so nothing lights up early. */
  const flag = (key: string) => tried && missingKeys.has(key);
  const who = customer.name.trim() || customer.email.trim();

  function submit() {
    if (missing.length > 0) {
      setTried(true);
      toast({
        title: missing.length === 1 ? "One thing is missing" : `${missing.length} things are missing`,
        description: missing.map((m) => m.label).join(", "),
        variant: "error",
      });
      // Jump to the first gap. The quantity gap has no single box of its own,
      // so it points at the first item's first size input.
      const el = document.getElementById(fid(missing[0].key));
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      (el as HTMLElement | null)?.focus?.({ preventScroll: true });
      return;
    }

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
          priceCharges: it.kind === "custom" ? it.priceCharges : [],
          spots: it.spots,
          bagging: it.bagging,
          sewnTags: it.sewnTags,
          supplier: it.supplier,
          mockupPaths: it.mockups.map((m) => m.path),
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
        customerId: linked?.id ?? null,
        customer,
        status,
        fulfillment,
        rush: rushValue > 0 ? { type: rushType, value: rushValue } : null,
        dueDate: dueDate || null,
        address,
        billing: billingBlank ? null : billing,
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

  // Only speaks up after a failed submit; nothing to say otherwise.
  const heroCaption = tried && !canCreate ? `Still missing: ${missing.map((m) => m.label).join(", ")}` : null;

  const stageIdx = statusStageIndex(status);
  const stageLabel =
    stageIdx >= 0 ? `${stageIdx + 1}/${TRACKER_STAGES.length} ${TRACKER_STAGES[stageIdx].label}` : STATUS_META[status].label;

  function addItem() {
    const fresh = blankItem("catalog");
    setItems((l) => [...l, fresh]);
    // The new card lands at the bottom of the list, often below the
    // fold: bring it into view once it has rendered.
    requestAnimationFrame(() => scrollToCenter(document.getElementById(`new-item-${fresh.key}`)));
  }

  return (
    <div className="space-y-6 px-4 py-6 sm:px-8">
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
            {who && <div className="mt-1 text-sm font-medium text-dream-ink">{who}</div>}
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
              className="min-w-48"
              loading={saving}
              onClick={submit}
            >
              Create order
            </Button>
            {heroCaption && <p className="text-xs text-dream-danger">{heroCaption}</p>}
          </div>
        </div>
      </div>

      {/* Items, the hero of the screen, full width like the order detail */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="font-display text-lg font-semibold text-dream-ink">Items ({items.length})</h2>
          {/* One button: the item's product picker offers the catalog AND a
              custom item, so the choice happens there. */}
          <Button
            variant="secondary"
            size="sm"
            className="ml-auto border-dream-purple/40 text-dream-purple hover:bg-dream-lavender-mist"
            onClick={addItem}
          >
            <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
              <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Add item
          </Button>
        </div>

        {items.map((it, idx) => (
          <div key={it.key} id={`new-item-${it.key}`} className="scroll-mt-4">
          <NewItemCard
            item={it}
            index={idx}
            products={products}
            product={it.kind === "catalog" ? byId.get(it.productId) : undefined}
            missingName={flag(`name-${it.key}`)}
            nameFieldId={fid(`name-${it.key}`)}
            missingQty={flag("qty")}
            qtyFieldId={idx === 0 ? fid("qty") : undefined}
            methodNamesAll={methodNames}
            onPatch={(fn) => patchItem(it.key, fn)}
            onPatchPriced={(fn) => patchItemPriced(it.key, fn)}
            onPickProduct={(id) => pickProduct(it.key, id)}
            onPickCustom={() => switchToCustom(it.key)}
            onRemove={items.length > 1 ? () => setItems((l) => l.filter((x) => x.key !== it.key)) : undefined}
          />
          </div>
        ))}

        {/* Second Add item at the foot of a long list, so finishing the last
            item doesn't mean scrolling back up to the header. */}
        {items.length > 1 && <AddItemRow onClick={addItem} />}
      </div>

      {/* ── Reference: customer, order settings, money, kept at the bottom ── */}
      <section className="space-y-6 border-t border-dream-line pt-8">
        <div className="grid items-start gap-6 lg:grid-cols-3">
          {/* Customer card: who this is for and where their emails go */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Customer</CardTitle>
              <p className="text-xs text-dream-muted">Who the order is for. Their emails go to this address.</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {linked && (
                <div className="flex items-start justify-between gap-3 rounded-lg border border-dream-line bg-dream-bg px-3 py-2">
                  <div className="min-w-0 text-xs">
                    <div className="font-semibold text-dream-ink">Linked to their account</div>
                    <div className="truncate text-dream-muted">{linked.email}</div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setLinked(null)}>
                    Unlink
                  </Button>
                </div>
              )}
              <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Labeled label="Name *" error={flag("customerName") ? "Required" : undefined}>
                  <Input
                    id={fid("customerName")}
                    value={customer.name}
                    aria-invalid={flag("customerName") || undefined}
                    onChange={(e) => {
                      setCust({ name: e.target.value });
                      setQuery(e.target.value);
                    }}
                  />
                </Labeled>
                <Labeled label="Phone">
                  <Input value={customer.phone} onChange={(e) => setCust({ phone: e.target.value })} />
                </Labeled>
              </div>
              <Labeled
                label="Email *"
                error={
                  !flag("customerEmail") ? undefined : customer.email.trim() ? "Doesn't look like an email" : "Required"
                }
              >
                <Input
                  id={fid("customerEmail")}
                  type="email"
                  value={customer.email}
                  aria-invalid={flag("customerEmail") || undefined}
                  onChange={(e) => {
                    setCust({ email: e.target.value });
                    setQuery(e.target.value);
                  }}
                />
              </Labeled>
              <Labeled label="Company">
                <Input value={customer.company} onChange={(e) => setCust({ company: e.target.value })} />
              </Labeled>

              {/* Account matches for what was just typed. Picking one links the
                  order to that account; ignoring them makes a guest order. */}
              {!linked && (searching || hits.length > 0) && (
                <div className="space-y-1">
                  <div className={LBL}>{searching ? "Looking for an account..." : "Has an account? Pick to link"}</div>
                  {hits.length > 0 && (
                    <ul className="divide-y divide-dream-line overflow-hidden rounded-lg border border-dream-line">
                      {hits.map((h) => (
                        <li key={h.id}>
                          <button
                            type="button"
                            onClick={() => linkAccount(h)}
                            className="flex w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-dream-bg"
                          >
                            <span className="text-sm font-semibold text-dream-ink">{h.name ?? "Unnamed"}</span>
                            <span className="text-xs text-dream-muted">{h.email}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Shipping address card */}
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-3 pb-3">
              <div>
                <CardTitle className="text-base">Shipping address</CardTitle>
                <p className="text-xs text-dream-muted">Where the order goes.</p>
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="shrink-0 gap-1.5"
                title="Fill the billing address with these details"
                onClick={copyShippingToBilling}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
                </svg>
                Copy to billing
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <Labeled label="Fulfillment">
                <Select value={fulfillment} onChange={(e) => setFulfillment(e.target.value as "ship" | "pickup")}>
                  <option value="pickup">Pick up</option>
                  <option value="ship">Ship</option>
                </Select>
              </Labeled>
              <AddressFields
                value={address}
                onChange={setAddr}
                streetRequired={fulfillment === "ship"}
                streetId={fid("street")}
                streetError={flag("street") ? "Required to ship. Or switch fulfillment to Pick up" : undefined}
                namePlaceholder={customer.name || undefined}
                phonePlaceholder={customer.phone || undefined}
                companyPlaceholder={customer.company || undefined}
              />
            </CardContent>
          </Card>

          {/* Billing address card */}
          <Card className="border-dashed">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Billing address</CardTitle>
              <p className="text-xs text-dream-muted">Who pays. Goes on the invoice, never on the shipping label.</p>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <AddressFields value={billing} onChange={setBill} />
              {billingBlank && (
                <p className="text-[11px] text-dream-faint">Leave blank to bill the shipping address.</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-2">
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
              <div className="grid grid-cols-1 gap-3 border-t border-dream-line pt-3 min-[420px]:grid-cols-3">
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
          <Button size="lg" loading={saving} onClick={submit}>
            Create order
          </Button>
        </div>
      </section>
    </div>
  );
}

function Labeled({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className={cn(LBL, "mb-1")}>{label}</div>
      {children}
      {error && <RequiredHint>{error}</RequiredHint>}
    </div>
  );
}

/** The seven address boxes, shared by the ship-to and bill-to cards so they
 *  read identically and differ only by their card title. */
function AddressFields({
  value,
  onChange,
  streetRequired,
  streetId,
  streetError,
  namePlaceholder,
  phonePlaceholder,
  companyPlaceholder,
}: {
  value: ManualOrderAddress;
  onChange: (patch: Partial<ManualOrderAddress>) => void;
  streetRequired?: boolean;
  /** Set on the ship-to card only, so a failed submit can jump to it. */
  streetId?: string;
  streetError?: string;
  /** Ghost text showing what the server falls back to when the box is empty. */
  namePlaceholder?: string;
  phonePlaceholder?: string;
  companyPlaceholder?: string;
}) {
  return (
    <>
      <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Labeled label="Name">
          <Input value={value.name} placeholder={namePlaceholder} onChange={(e) => onChange({ name: e.target.value })} />
        </Labeled>
        <Labeled label="Phone">
          <Input value={value.phone} placeholder={phonePlaceholder} onChange={(e) => onChange({ phone: e.target.value })} />
        </Labeled>
      </div>
      <Labeled label="Company">
        <Input value={value.company} placeholder={companyPlaceholder} onChange={(e) => onChange({ company: e.target.value })} />
      </Labeled>
      <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-[minmax(0,1fr)_7rem]">
        <Labeled label={streetRequired ? "Street *" : "Street"} error={streetError}>
          <Input
            id={streetId}
            value={value.street}
            aria-invalid={!!streetError || undefined}
            onChange={(e) => onChange({ street: e.target.value })}
          />
        </Labeled>
        <Labeled label="Apt / Suite">
          <Input value={value.unit} placeholder="Optional" onChange={(e) => onChange({ unit: e.target.value })} />
        </Labeled>
      </div>
      {/* A Canadian postal code does not fit 5.5rem at the phone's 16px input text. */}
      <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-[minmax(0,1fr)_5.5rem]">
        <Labeled label="City">
          <Input value={value.city} onChange={(e) => onChange({ city: e.target.value })} />
        </Labeled>
        <Labeled label="Postal">
          <Input value={value.postal} onChange={(e) => onChange({ postal: e.target.value })} />
        </Labeled>
      </div>
      <Labeled label="Province">
        <Select value={value.prov} onChange={(e) => onChange({ prov: e.target.value })}>
          {PROVINCES.map((p) => (
            <option key={p.code} value={p.code}>
              {p.code} - {p.name}
            </option>
          ))}
        </Select>
      </Labeled>
    </>
  );
}

/** Inline "this is why the button is grey" note under a blocking input. */
function RequiredHint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs font-medium text-dream-danger">{children}</p>;
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
  onPickCustom,
  onRemove,
  missingName,
  missingQty,
  nameFieldId,
  qtyFieldId,
}: {
  item: ItemDraft;
  index: number;
  products: CatalogProduct[];
  product: CatalogProduct | undefined;
  methodNamesAll: string[];
  /** This line has a quantity but no product / description yet. */
  missingName: boolean;
  /** No line on the order has a quantity yet. */
  missingQty: boolean;
  /** DOM ids a failed submit jumps to. Only the first card gets a qty id. */
  nameFieldId: string;
  qtyFieldId?: string;
  onPatch: (fn: (it: ItemDraft) => ItemDraft) => void;
  onPatchPriced: (fn: (it: ItemDraft) => ItemDraft) => void;
  onPickProduct: (id: string) => void;
  onPickCustom: () => void;
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
  // one-click "+XS" pills, cloned from the detail's size run. Custom lines
  // offer the standard run plus a plain "Qty" column for unsized goods.
  const displaySizes = item.sizes.map(([s]) => s);
  const offeredSizes = isCatalog ? (product?.sizes ?? []) : [...SIZE_ORDER, FREEFORM_SIZE];
  const missingStandard = offeredSizes.filter(
    (s) => !item.sizes.some(([k]) => k.toUpperCase() === s.toUpperCase()),
  );
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

            <MockupUploader
              mockups={item.mockups}
              onChange={(mockups) => onPatch((it) => ({ ...it, mockups }))}
            />
          </div>

          {/* MIDDLE, product, sizes, print, notes */}
          <div className="min-w-0 flex-1 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-dream-faint">{index + 1}.</span>
              {isCatalog ? (
                <>
                  {/* Visual picker (photos, prices, search) instead of a bare
                      select; the button reads as the field it replaces. */}
                  <button
                    type="button"
                    id={nameFieldId}
                    onClick={() => setPickerOpen(true)}
                    className={cn(
                      "flex h-10 min-w-0 flex-1 items-center gap-2 rounded-lg border bg-white px-3 text-left text-sm transition-colors hover:border-dream-purple",
                      missingName ? "border-dream-danger" : "border-dream-line",
                    )}
                  >
                    {product ? (
                      <>
                        <span className="truncate font-semibold text-dream-ink">
                          {product.brand ? `${product.brand} ` : ""}
                          {product.name}
                        </span>
                        <span className="ml-auto shrink-0 text-xs text-dream-purple">Change</span>
                      </>
                    ) : (
                      <>
                        <span className="text-dream-muted">Pick a product…</span>
                        <span className="ml-auto shrink-0 text-xs text-dream-purple">Browse</span>
                      </>
                    )}
                  </button>
                  {/* Colour twin of the product picker: photo grid, not a select. */}
                  <button
                    type="button"
                    onClick={() => setColourOpen(true)}
                    disabled={!product}
                    title="Garment colour"
                    className={cn(
                      // Full width on phones so it wraps under the product button
                      // instead of squeezing it to a few characters.
                      "flex h-10 w-full shrink-0 items-center gap-1.5 rounded-lg border border-dream-line bg-white px-3 text-left text-sm transition-colors sm:w-44",
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
                <>
                  <Input
                    id={nameFieldId}
                    value={item.productName}
                    aria-invalid={missingName || undefined}
                    onChange={(e) => onPatch((p) => ({ ...p, productName: e.target.value }))}
                    placeholder="Vinyl banner, 3ft x 6ft"
                    className="h-10 flex-1 font-semibold text-dream-ink"
                  />
                  <Button variant="secondary" size="sm" className="h-10" onClick={() => setPickerOpen(true)}>
                    Change
                  </Button>
                </>
              )}
              <ProductPickerDialog
                open={pickerOpen}
                onOpenChange={setPickerOpen}
                products={products}
                currentId={item.productId}
                onPick={onPickProduct}
                onPickCustom={onPickCustom}
              />
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
              {missingName && (
                <RequiredHint>{isCatalog ? "Pick a product for this item" : "Describe this item, it's what prints on the order"}</RequiredHint>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              {!isCatalog ? null : product?.ssStyleName ? (
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
              <div className={cn(LBL, "mb-2")}>
                Sizes ({qty} pcs)
                {missingQty && qty === 0 && (
                  <span className="ml-2 text-dream-danger">
                    Type how many of each size
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-start gap-1.5">
                {displaySizes.map((s, si) => {
                  const q = qtyOf(s);
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
                        id={si === 0 ? qtyFieldId : undefined}
                        aria-invalid={(missingQty && qty === 0) || undefined}
                        onChange={(e) => setSizeQty(s, Math.max(0, Number(e.target.value) || 0))}
                        className="h-9 px-1 text-center [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                      <button
                        type="button"
                        aria-label={`Remove size ${s}`}
                        title={`Remove size ${s}`}
                        tabIndex={-1}
                        // The ::before widens the tap target without moving or
                        // resizing the 16px glyph. It only grows downward, so
                        // it never steals taps from the quantity input above.
                        className="relative mx-auto mt-1 block h-4 w-4 rounded text-xs leading-none text-dream-faint transition-colors before:absolute before:-inset-x-2 before:top-0 before:-bottom-3 before:content-[''] hover:bg-dream-danger-soft hover:text-dream-danger"
                        onClick={() => removeSize(s)}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
                {missingStandard.length > 0 && (
                  <div>
                    <div className="mb-1 h-4" aria-hidden />
                    <div className="flex min-h-9 flex-wrap items-center gap-1">
                      {missingStandard.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => addSizeColumn(s)}
                          title={`Add size ${s}`}
                          tabIndex={-1}
                          className="relative rounded-md border border-dashed border-dream-line px-1.5 py-1.5 text-[10px] font-bold uppercase leading-none text-dream-faint transition-colors before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-[''] hover:border-dream-purple hover:text-dream-purple"
                        >
                          +{s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
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
                  <span className={LBL}>{f.label}</span>
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

          {/* RIGHT, price rail (wider on custom lines for the breakdown) */}
          <div className={cn("shrink-0 border-t border-dream-line pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0", isCatalog ? "lg:w-48" : "lg:w-60")}>
            <div className={cn(LBL, "mb-1")}>Unit price</div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-dream-muted">$</span>
              <Input
                value={item.unitPrice}
                inputMode="decimal"
                placeholder="0.00"
                // The breakdown owns the price while it has charges; remove
                // them all to type a price by hand again.
                readOnly={item.priceCharges.length > 0}
                title={item.priceCharges.length > 0 ? "Set by the price breakdown" : undefined}
                // Typing a price by hand wins: the auto chip drops off and the
                // number is left alone until the next pricing-relevant edit.
                onChange={(e) => onPatch((p) => ({ ...p, unitPrice: e.target.value, autoPrice: null }))}
                className={cn("h-9 w-24", item.priceCharges.length > 0 && "bg-dream-bg")}
              />
              {item.autoPrice && (
                <span
                  title="Filled from this product's price tiers. Type over it to override."
                  className="rounded-md bg-dream-lavender-soft px-2 py-0.5 text-[11px] font-semibold text-dream-purple"
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
            {!isCatalog && (
              <div className="mt-4 border-t border-dream-line pt-4">
                <PriceBreakdown
                  charges={item.priceCharges}
                  qty={qty}
                  onChange={(priceCharges) => onPatch((p) => ({ ...p, priceCharges }))}
                />
              </div>
            )}
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


/**
 * Mockups for a line, uploaded while the order is still being built. Files
 * are staged straight to the proofs bucket (same signed-URL flow as
 * useProofUpload on the order page); createManualOrderAction turns each path
 * into a pending proof on the created line. Sits under the supplier blank so
 * "what we're printing" is next to "what we're printing on".
 */
function MockupUploader({
  mockups,
  onChange,
}: {
  mockups: StagedMockup[];
  onChange: (next: StagedMockup[]) => void;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const inputId = useId();

  async function stage(files: File[]) {
    if (files.length === 0) return;
    setUploading(true);
    try {
      const res = await fetch("/api/design/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: files.map((f, i) => ({ id: `m${i}`, bucket: "proofs", name: f.name, kind: "proof", size: f.size })),
        }),
      });
      if (!res.ok) throw new Error("Could not prepare upload");
      const { uploads } = (await res.json()) as { uploads: { id: string; bucket: string; path: string; token: string }[] };
      const byId = new Map(uploads.map((u) => [u.id, u]));
      const supabase = createSupabaseBrowserClient();
      const staged: StagedMockup[] = [];
      await Promise.all(
        files.map(async (f, i) => {
          const u = byId.get(`m${i}`);
          if (!u) throw new Error("Upload URL missing for a file");
          const { error } = await supabase.storage
            .from(u.bucket)
            .uploadToSignedUrl(u.path, u.token, f, { contentType: f.type || "image/png" });
          if (error) throw new Error(error.message);
          staged.push({ path: u.path, name: f.name, preview: URL.createObjectURL(f), kind: fileKind(f.type || f.name) });
        }),
      );
      onChange([...mockups, ...staged]);
    } catch (err) {
      toast({ title: "Mockup upload failed", description: err instanceof Error ? err.message : "", variant: "error" });
    } finally {
      setUploading(false);
    }
  }

  function remove(path: string) {
    const gone = mockups.find((m) => m.path === path);
    if (gone) URL.revokeObjectURL(gone.preview);
    onChange(mockups.filter((m) => m.path !== path));
  }

  return (
    <div className="space-y-2">
      <p className={LBL}>Mockups</p>
      {mockups.length > 0 && (
        <div className="grid grid-cols-3 gap-1.5">
          {mockups.map((m) => (
            <div key={m.path} className="group relative aspect-square overflow-hidden rounded-lg border border-dream-line bg-dream-bg transition-colors hover:border-dream-purple">
              <button
                type="button"
                onClick={() => openInNewTab(m.preview)}
                aria-label={`Open ${m.name} in a new tab`}
                title="Open in a new tab"
                className="block h-full w-full cursor-pointer"
              >
              {m.kind === "pdf" ? (
                <PdfThumb
                  src={m.preview}
                  alt={m.name}
                  fallback={<PdfGlyph className="gap-0" iconClassName="h-6 w-6" labelClassName="text-[9px] font-semibold" />}
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.preview} alt={m.name} className="h-full w-full object-contain" />
              )}
              </button>
              <button
                type="button"
                onClick={() => remove(m.path)}
                aria-label={`Remove ${m.name}`}
                className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-dream-ink/70 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-3 w-3" aria-hidden>
                  <path d="M4 4l8 8M12 4l-8 8" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        id={inputId}
        type="file"
        accept="image/*,application/pdf"
        multiple
        className="sr-only"
        disabled={uploading}
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = "";
          void stage(files);
        }}
      />
      <label
        htmlFor={inputId}
        className={cn(
          "inline-flex h-8 cursor-pointer items-center justify-center rounded-lg border border-dream-line bg-dream-surface px-3 text-xs font-semibold text-dream-ink transition-colors hover:border-dream-purple hover:text-dream-purple",
          uploading && "pointer-events-none opacity-60",
        )}
      >
        {uploading ? "Uploading…" : "Upload mockup"}
      </label>
    </div>
  );
}
