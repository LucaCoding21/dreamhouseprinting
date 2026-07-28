"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";
import { formatCAD, roundCents } from "@/lib/money";
import { rushFee } from "@/lib/pricing/rush";
import { PROVINCES, calcTax, isProvinceCode } from "@/lib/pricing/tax";
import { priceFromCurve, decorationForMethodSlug, defaultDecoration } from "@/lib/pricing/quote";
import type { OrderStatus, QuoteDecoration } from "@/lib/db/rows";
import { createManualOrderAction, searchCustomersAction } from "./actions";
import {
  FREEFORM_SIZE,
  MANUAL_ORDER_STATUSES,
  type CatalogProduct,
  type CustomerHit,
  type ManualOrderItemInput,
} from "./shared";

/** Tiny uppercase field label, matching the order detail screen. */
const LBL = "text-[11px] font-semibold uppercase tracking-wide text-dream-muted";

interface ItemDraft {
  key: string;
  kind: "catalog" | "custom";
  productId: string;
  colourName: string;
  methodId: string;
  /** Print colours + locations the price is quoted from. */
  colours: string;
  locations: string;
  /** size name -> quantity, catalog lines only. */
  sizes: Record<string, string>;
  /** Freeform lines only. */
  description: string;
  qty: string;
  price: string;
  /** Once staff types a price, the curve suggestion stops overwriting it. */
  priceTouched: boolean;
}

let seq = 0;
function blankItem(kind: "catalog" | "custom"): ItemDraft {
  seq += 1;
  return {
    key: `item-${seq}`,
    kind,
    productId: "",
    colourName: "",
    methodId: "",
    colours: "1",
    locations: "1",
    sizes: {},
    description: "",
    qty: "",
    price: "",
    priceTouched: false,
  };
}

const num = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const int = (v: string) => Math.max(0, Math.floor(num(v)));

export function NewOrderClient({ products }: { products: CatalogProduct[] }) {
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
  const [rush, setRush] = useState(false);
  const [dueDate, setDueDate] = useState("");
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
  const patchItem = (key: string, patch: Partial<ItemDraft>) =>
    setItems((list) => list.map((it) => (it.key === key ? { ...it, ...patch } : it)));

  // ---- Money ---------------------------------------------------------------
  const [shippingStr, setShippingStr] = useState("0");
  const [taxStr, setTaxStr] = useState("0");
  const [taxTouched, setTaxTouched] = useState(false);

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

  // Quantity per catalog product, combined across colourway lines: the quantity
  // break applies to the whole job, exactly like the designer prices it.
  const itemQty = (it: ItemDraft) =>
    it.kind === "custom"
      ? int(it.qty)
      : Object.values(it.sizes).reduce((sum, v) => sum + int(v), 0);

  const qtyByProduct = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of items) {
      if (it.kind !== "catalog" || !it.productId) continue;
      map.set(it.productId, (map.get(it.productId) ?? 0) + itemQty(it));
    }
    return map;
  }, [items]);

  /** Curve price per unit at the combined quantity, or null when unpriceable. */
  function suggestedUnit(it: ItemDraft): number | null {
    if (it.kind !== "catalog") return null;
    const product = byId.get(it.productId);
    const curve = product?.curve;
    if (!product || !curve) return null;
    // The chosen method's curve axis, falling back to whatever this product can
    // actually price (mirrors the designer + checkout fallback).
    const slugDeco = decorationForMethodSlug(product.methods.find((m) => m.id === it.methodId)?.slug);
    const decoration: QuoteDecoration =
      slugDeco && curve.breaks[slugDeco]?.length
        ? slugDeco
        : product.decorations[0] ?? defaultDecoration(curve);
    const qty = Math.max(qtyByProduct.get(it.productId) ?? 0, 1);
    const result = priceFromCurve(curve, {
      qty,
      colours: Math.max(1, int(it.colours) || 1),
      locations: Math.max(1, int(it.locations) || 1),
      decoration,
    });
    return result.available ? roundCents(result.perUnit) : null;
  }

  const unitOf = (it: ItemDraft) => (it.priceTouched ? num(it.price) : suggestedUnit(it) ?? 0);
  const lineTotal = (it: ItemDraft) => roundCents(unitOf(it) * itemQty(it));

  const subtotal = roundCents(items.reduce((sum, it) => sum + lineTotal(it), 0));
  const rushAmount = rushFee(subtotal, 0, rush);
  const shipping = num(shippingStr);
  const autoTax = isProvinceCode(address.prov)
    ? calcTax(subtotal + rushAmount + shipping, address.prov).total
    : 0;
  const tax = taxTouched ? num(taxStr) : autoTax;
  const total = roundCents(subtotal + rushAmount + shipping + tax);
  const pieces = items.reduce((sum, it) => sum + itemQty(it), 0);

  function submit() {
    const payload: ManualOrderItemInput[] = items
      .filter((it) => itemQty(it) > 0)
      .map((it) => {
        const product = it.kind === "catalog" ? byId.get(it.productId) : undefined;
        const colour = product?.colours.find((c) => c.name === it.colourName) ?? null;
        const sizeQuantities: Record<string, number> =
          it.kind === "custom"
            ? { [FREEFORM_SIZE]: int(it.qty) }
            : Object.fromEntries(
                Object.entries(it.sizes)
                  .map(([size, v]) => [size, int(v)] as const)
                  .filter(([, n]) => n > 0)
              );
        return {
          kind: it.kind,
          productId: product?.id ?? null,
          productName: it.kind === "custom" ? it.description.trim() : product?.name ?? "",
          colourName: colour?.name ?? null,
          colourHex: colour?.hex ?? null,
          decorationMethodId: it.methodId || null,
          sizeQuantities,
          unitPrice: unitOf(it),
          printColours: Math.max(1, int(it.colours) || 1),
          printLocations: Math.max(1, int(it.locations) || 1),
        };
      });

    if (payload.length === 0) {
      toast({ title: "Add at least one item with a quantity", variant: "error" });
      return;
    }
    const unnamed = payload.find((p) => !p.productName);
    if (unnamed) {
      toast({
        title: "Every item needs a product or a description",
        variant: "error",
      });
      return;
    }

    startSave(async () => {
      const res = await createManualOrderAction({
        customerId: mode === "existing" ? picked?.id ?? null : null,
        guest: mode === "guest" ? guest : null,
        status,
        fulfillment,
        rush,
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

  const customerReady = mode === "existing" ? !!picked : !!guest.name.trim() && !!guest.email.trim();

  return (
    <div>
      <AdminHeader title="New order">
        <Link href="/admin/orders" className="text-sm text-dream-muted transition-colors hover:text-dream-ink">
          Cancel
        </Link>
        <Button onClick={submit} loading={saving} disabled={!customerReady || pieces === 0}>
          Create order
        </Button>
      </AdminHeader>

      <div className="grid items-start gap-6 px-8 py-6 lg:grid-cols-3">
        {/* ── Left: who it is for, and what they are buying ── */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Customer</CardTitle>
              <div className="flex gap-1 rounded-lg bg-dream-bg p-1">
                {(["existing", "guest"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={cn(
                      "rounded-md px-3 py-1 text-xs font-semibold transition-colors",
                      mode === m ? "bg-white text-dream-ink shadow-sm" : "text-dream-muted hover:text-dream-ink"
                    )}
                  >
                    {m === "existing" ? "Existing account" : "New / walk-in"}
                  </button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              {mode === "existing" ? (
                picked ? (
                  <div className="flex items-start justify-between gap-3 rounded-lg border border-dream-line bg-dream-bg p-3">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-dream-ink">{picked.name ?? "Unnamed"}</div>
                      <div className="truncate text-sm text-dream-muted">{picked.email}</div>
                      {picked.phone && <div className="text-sm text-dream-muted">{picked.phone}</div>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setPicked(null)}>
                      Change
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Field label="Search accounts" hint="Type a name or email, at least two characters.">
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Jane Smith or jane@example.com"
                      />
                    </Field>
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
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Name" required>
                    <Input value={guest.name} onChange={(e) => setGuest({ ...guest, name: e.target.value })} />
                  </Field>
                  <Field label="Email" required hint="Order updates go here.">
                    <Input
                      type="email"
                      value={guest.email}
                      onChange={(e) => setGuest({ ...guest, email: e.target.value })}
                    />
                  </Field>
                  <Field label="Phone">
                    <Input value={guest.phone} onChange={(e) => setGuest({ ...guest, phone: e.target.value })} />
                  </Field>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Items</CardTitle>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => setItems((l) => [...l, blankItem("catalog")])}>
                  Add catalog item
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setItems((l) => [...l, blankItem("custom")])}>
                  Add custom item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              {items.map((it, i) => (
                <ItemRow
                  key={it.key}
                  item={it}
                  index={i}
                  products={products}
                  product={byId.get(it.productId)}
                  qty={itemQty(it)}
                  suggested={suggestedUnit(it)}
                  unit={unitOf(it)}
                  total={lineTotal(it)}
                  onPatch={(patch) => patchItem(it.key, patch)}
                  onRemove={items.length > 1 ? () => setItems((l) => l.filter((x) => x.key !== it.key)) : undefined}
                />
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ── Right: order settings, address, money ── */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Order details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              <Field label="Status">
                <Select value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
                  {MANUAL_ORDER_STATUSES.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Fulfilment">
                <Select
                  value={fulfillment}
                  onChange={(e) => setFulfillment(e.target.value as "ship" | "pickup")}
                >
                  <option value="pickup">Pickup at the shop</option>
                  <option value="ship">Ship to address</option>
                </Select>
              </Field>

              <Field label="In-hands date" hint="Optional. Drives the countdown on the orders list.">
                <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </Field>

              <div className="flex items-center justify-between rounded-lg border border-dream-line bg-dream-bg px-3 py-2">
                <div>
                  <div className="text-sm font-semibold text-dream-ink">Rush</div>
                  <div className="text-xs text-dream-muted">Adds 50% to the job price.</div>
                </div>
                <Switch checked={rush} onCheckedChange={setRush} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{fulfillment === "ship" ? "Shipping address" : "Contact"}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name">
                  <Input value={address.name} onChange={(e) => setAddr({ name: e.target.value })} />
                </Field>
                <Field label="Company">
                  <Input value={address.company} onChange={(e) => setAddr({ company: e.target.value })} />
                </Field>
              </div>
              <Field label="Phone">
                <Input value={address.phone} onChange={(e) => setAddr({ phone: e.target.value })} />
              </Field>
              <Field label="Street" required={fulfillment === "ship"}>
                <Input value={address.street} onChange={(e) => setAddr({ street: e.target.value })} />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="City" className="col-span-2">
                  <Input value={address.city} onChange={(e) => setAddr({ city: e.target.value })} />
                </Field>
                <Field label="Postal">
                  <Input value={address.postal} onChange={(e) => setAddr({ postal: e.target.value })} />
                </Field>
              </div>
              <Field label="Province" hint="Sets the sales tax below.">
                <Select value={address.prov} onChange={(e) => setAddr({ prov: e.target.value })}>
                  {PROVINCES.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.code} - {p.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pricing</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 p-5 pt-0 text-sm">
              <Row label={`Subtotal (${pieces} ${pieces === 1 ? "piece" : "pieces"})`} value={formatCAD(subtotal)} />
              {rush && <Row label="Rush (+50%)" value={formatCAD(rushAmount)} />}
              <div className="flex items-center justify-between gap-3">
                <span className="text-dream-muted">Shipping</span>
                <Input
                  className="w-28 text-right"
                  inputMode="decimal"
                  value={shippingStr}
                  onChange={(e) => setShippingStr(e.target.value)}
                />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-dream-muted">Tax</span>
                <div className="flex items-center gap-2">
                  {taxTouched && (
                    <button
                      type="button"
                      onClick={() => setTaxTouched(false)}
                      className="text-xs text-dream-purple hover:underline"
                    >
                      Auto
                    </button>
                  )}
                  <Input
                    className="w-28 text-right"
                    inputMode="decimal"
                    value={taxTouched ? taxStr : autoTax.toFixed(2)}
                    onChange={(e) => {
                      setTaxTouched(true);
                      setTaxStr(e.target.value);
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center justify-between border-t border-dream-line pt-3 font-display text-lg font-bold text-dream-ink">
                <span>Total</span>
                <span>{formatCAD(total)}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Note to customer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-5 pt-0">
              <Textarea
                rows={3}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder="Anything the customer should see on their order page."
              />
              <Checkbox
                id="send-confirmation"
                label="Send confirmation email to customer"
                checked={sendConfirmation}
                onChange={(e) => setSendConfirmation(e.target.checked)}
              />
              <p className="text-xs text-dream-muted">
                Off by default: a phone or counter order is usually confirmed in person.
              </p>
            </CardContent>
          </Card>

          <Button className="w-full" size="lg" onClick={submit} loading={saving} disabled={!customerReady || pieces === 0}>
            Create order
          </Button>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-dream-muted">{label}</span>
      <span className="text-dream-ink">{value}</span>
    </div>
  );
}

function ItemRow({
  item,
  index,
  products,
  product,
  qty,
  suggested,
  unit,
  total,
  onPatch,
  onRemove,
}: {
  item: ItemDraft;
  index: number;
  products: CatalogProduct[];
  product: CatalogProduct | undefined;
  qty: number;
  suggested: number | null;
  unit: number;
  total: number;
  onPatch: (patch: Partial<ItemDraft>) => void;
  onRemove?: () => void;
}) {
  const isCatalog = item.kind === "catalog";

  function pickProduct(id: string) {
    const next = products.find((p) => p.id === id);
    onPatch({
      productId: id,
      // Colours and sizes never map across products, so both reset on a swap.
      colourName: next?.colours[0]?.name ?? "",
      methodId: next?.methods[0]?.id ?? "",
      sizes: {},
    });
  }

  return (
    <div className="rounded-xl border border-dream-line p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={LBL}>Item {index + 1}</span>
          {!isCatalog && <Badge variant="neutral">Custom</Badge>}
          {isCatalog && product && !product.isActive && <Badge variant="warn">Hidden in shop</Badge>}
        </div>
        {onRemove && (
          <button type="button" onClick={onRemove} className="text-xs text-dream-muted hover:text-dream-danger">
            Remove
          </button>
        )}
      </div>

      {isCatalog ? (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Product">
              <Select value={item.productId} onChange={(e) => pickProduct(e.target.value)}>
                <option value="">Pick a product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.brand ? `${p.brand} ` : ""}
                    {p.name}
                    {p.isActive ? "" : " (hidden)"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Colour">
              <Select
                value={item.colourName}
                onChange={(e) => onPatch({ colourName: e.target.value })}
                disabled={!product}
              >
                <option value="">Pick a colour</option>
                {(product?.colours ?? []).map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Decoration">
              <Select
                value={item.methodId}
                onChange={(e) => onPatch({ methodId: e.target.value })}
                disabled={!product}
              >
                <option value="">Pick a method</option>
                {(product?.methods ?? []).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Print colours" hint="Screen print charges per colour.">
              <Input
                inputMode="numeric"
                value={item.colours}
                onChange={(e) => onPatch({ colours: e.target.value })}
              />
            </Field>
            <Field label="Print locations">
              <Input
                inputMode="numeric"
                value={item.locations}
                onChange={(e) => onPatch({ locations: e.target.value })}
              />
            </Field>
          </div>

          {product && product.sizes.length > 0 ? (
            <div>
              <div className={cn(LBL, "mb-1.5 block")}>Size run</div>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <label key={size} className="w-16">
                    <span className="mb-1 block text-center text-xs font-semibold text-dream-muted">{size}</span>
                    <Input
                      className="px-1 text-center"
                      inputMode="numeric"
                      value={item.sizes[size] ?? ""}
                      onChange={(e) => onPatch({ sizes: { ...item.sizes, [size]: e.target.value } })}
                    />
                  </label>
                ))}
              </div>
            </div>
          ) : (
            product && <p className="text-xs text-dream-muted">This product has no sizes on file.</p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Description" className="sm:col-span-2">
            <Input
              value={item.description}
              onChange={(e) => onPatch({ description: e.target.value })}
              placeholder="Vinyl banner, 3ft x 6ft"
            />
          </Field>
          <Field label="Quantity">
            <Input inputMode="numeric" value={item.qty} onChange={(e) => onPatch({ qty: e.target.value })} />
          </Field>
        </div>
      )}

      {/* Price line: curve suggestion by default, overridable per item. */}
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-dream-line pt-3">
        <div className="flex items-end gap-3">
          <Field label="Unit price">
            <Input
              className="w-28"
              inputMode="decimal"
              value={item.priceTouched ? item.price : suggested !== null ? suggested.toFixed(2) : ""}
              placeholder="0.00"
              onChange={(e) => onPatch({ price: e.target.value, priceTouched: true })}
            />
          </Field>
          {item.priceTouched && suggested !== null && (
            <button
              type="button"
              onClick={() => onPatch({ price: "", priceTouched: false })}
              className="pb-2 text-xs text-dream-purple hover:underline"
            >
              Use {formatCAD(suggested)}
            </button>
          )}
          {!item.priceTouched && isCatalog && suggested === null && product && (
            <p className="pb-2 text-xs text-dream-warn">No price curve on this product, type a price.</p>
          )}
        </div>
        <div className="text-right">
          <div className={LBL}>Line total</div>
          <div className="font-display text-lg font-bold text-dream-ink">{formatCAD(total)}</div>
          <div className="text-xs text-dream-muted">
            {qty} x {formatCAD(unit)}
          </div>
        </div>
      </div>
    </div>
  );
}
