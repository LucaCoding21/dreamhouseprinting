"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { Checkbox } from "@/components/ui/Checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { useToast } from "@/components/ui/use-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { STATUS_META } from "@/lib/orderStatus";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/db/rows";
import type { OrderRow, LineItemRow, DesignRow, ProofRow, OrderActivityRow, ProfileRow, OrderStatus, PaymentStatus } from "@/lib/db/rows";
import {
  setOrderStatusAction,
  setPaymentStatusAction,
  addOrderNoteAction,
  updateOrderPricingAction,
  updateOrderDetailsAction,
  updateLineItemsAction,
  deleteLineItemAction,
  uploadProofAction,
} from "../actions";
import type { DecorationSpot, LineItemDecorations } from "../actions";

interface Detail {
  order: OrderRow;
  customer: Pick<ProfileRow, "id" | "name" | "email" | "phone"> | null;
  lineItems: LineItemRow[];
  designs: DesignRow[];
  proofs: ProofRow[];
  activity: OrderActivityRow[];
}

interface Note {
  at: string;
  actor: string;
  text: string;
}

interface StoredAddress {
  name?: string;
  company?: string | null;
  phone?: string;
  street?: string;
  city?: string;
  prov?: string;
  postal?: string;
}

interface ItemState {
  id: string;
  productName: string;
  sizes: [string, number][];
  unitPrice: string;
  spots: DecorationSpot[];
  bagging: boolean;
  sewnTags: boolean;
  priceConfirmed: boolean;
}

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "2XL", "3XL", "4XL", "5XL"];
const PROVINCES = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];

/** Tiny uppercase field label, matching the wireframe. */
const LBL = "text-[11px] font-semibold uppercase tracking-wide text-dream-muted";

function sizeRank(s: string): number {
  const i = SIZE_ORDER.indexOf(s.toUpperCase());
  return i === -1 ? 99 : i;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function fmtWhen(iso: string): string {
  return new Date(iso).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { dateStyle: "medium" });
}

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.round(days / 7)}w ago`;
  return `${Math.round(days / 30)}mo ago`;
}

const itemQty = (it: ItemState) => it.sizes.reduce((a, [, q]) => a + (q > 0 ? q : 0), 0);

export function OrderDetailClient({
  detail,
  methodNames,
  can,
}: {
  detail: Detail;
  methodNames: Record<string, string>;
  can: { edit: boolean; pricing: boolean; proofs: boolean };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { order } = detail;
  const proofInput = useRef<HTMLInputElement>(null);

  const [status, setStatus] = useState(order.status);
  const [payment, setPayment] = useState(order.payment_status);
  const [note, setNote] = useState("");
  const [noteVis, setNoteVis] = useState<"internal" | "customer">("internal");
  const [pending, start] = useTransition();
  const [uploadingProof, setUploadingProof] = useState(false);

  const pricing = (order.pricing ?? {}) as { subtotal?: number; setupFees?: number; shipping?: number; tax?: number; total?: number };
  const [price, setPrice] = useState({
    subtotal: pricing.subtotal ?? 0,
    setupFees: pricing.setupFees ?? 0,
    shipping: pricing.shipping ?? 0,
    tax: pricing.tax ?? 0,
  });
  const priceTotal = price.subtotal + price.setupFees + price.shipping + price.tax;

  const designById = useMemo(() => new Map(detail.designs.map((d) => [d.id, d])), [detail.designs]);
  const shippingAddr = (order.shipping_address ?? {}) as StoredAddress;
  const billingAddr = (order.billing_address ?? {}) as { name?: string; email?: string; company?: string };

  // --- Editable order details (contact / shipping / billing) ---
  const initialDetails = useMemo(
    () => ({
      company: shippingAddr.company ?? "",
      contactName: detail.customer?.name ?? shippingAddr.name ?? "",
      contactPhone: detail.customer?.phone ?? shippingAddr.phone ?? "",
      contactEmail: detail.customer?.email ?? order.guest_email ?? "",
      shipName: shippingAddr.name ?? "",
      shipStreet: shippingAddr.street ?? "",
      shipCity: shippingAddr.city ?? "",
      shipProv: shippingAddr.prov ?? "BC",
      shipPostal: shippingAddr.postal ?? "",
      method: order.shipping_method ?? "standard",
      fulfillment: order.fulfillment_method ?? "ship",
      billName: billingAddr.name ?? "",
      billEmail: billingAddr.email ?? "",
      billCompany: billingAddr.company ?? "",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [details, setDetails] = useState(initialDetails);
  const [detailsSnap, setDetailsSnap] = useState(initialDetails);
  const detailsDirty = JSON.stringify(details) !== JSON.stringify(detailsSnap);
  const setD = (patch: Partial<typeof initialDetails>) => setDetails((d) => ({ ...d, ...patch }));

  // --- Editable line items ---
  const initItems = (): ItemState[] =>
    detail.lineItems.map((li) => {
      const dec = (li.decorations ?? {}) as Partial<LineItemDecorations>;
      const design = li.design_id ? designById.get(li.design_id) : undefined;
      const views = ((design?.mockup_images ?? []) as { view: string; url: string | null }[]).map((m) => m.view);
      const methodName = li.decoration_method_id ? methodNames[li.decoration_method_id] ?? "" : "";
      // No saved decoration spec yet → start from what the designer produced.
      const spots: DecorationSpot[] =
        dec.spots && dec.spots.length > 0
          ? dec.spots
          : (views.length ? views : ["front"]).map((v) => ({
              location: capitalize(v),
              type: methodName,
              widthIn: "",
              heightIn: "",
              colours: "",
              pantones: [],
              puff: false,
              spotProcess: false,
            }));
      const sq = (li.size_quantities ?? {}) as Record<string, number>;
      const sizes = Object.entries(sq).sort(([a], [b]) => sizeRank(a) - sizeRank(b));
      return {
        id: li.id,
        productName: li.product_name ?? "",
        sizes,
        unitPrice: String(li.unit_price),
        spots,
        bagging: !!dec.bagging,
        sewnTags: !!dec.sewnTags,
        priceConfirmed: !!dec.priceConfirmed,
      };
    });
  const [items, setItems] = useState<ItemState[]>(initItems);
  const [itemsSnap, setItemsSnap] = useState(() => JSON.stringify(items));
  const itemsDirty = JSON.stringify(items) !== itemsSnap;
  const [addingSizeFor, setAddingSizeFor] = useState<string | null>(null);
  const [newSize, setNewSize] = useState("");

  const patchItem = (id: string, fn: (it: ItemState) => ItemState) =>
    setItems((arr) => arr.map((it) => (it.id === id ? fn(it) : it)));
  const patchSpot = (id: string, si: number, patch: Partial<DecorationSpot>) =>
    patchItem(id, (it) => ({ ...it, spots: it.spots.map((s, i) => (i === si ? { ...s, ...patch } : s)) }));

  // Notes feed, newest first.
  const feed = useMemo(() => {
    const internal = ((order.internal_notes ?? []) as unknown as Note[]).map((n) => ({ ...n, vis: "internal" as const }));
    const customer = ((order.customer_notes ?? []) as unknown as Note[]).map((n) => ({ ...n, vis: "customer" as const }));
    return [...internal, ...customer].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [order.internal_notes, order.customer_notes]);

  const sourceArt = detail.designs.flatMap((d) => (d.source_artwork_files ?? []) as { name: string; url: string | null }[]);
  const pieces = items.reduce((acc, it) => acc + itemQty(it), 0);
  const setupById = useMemo(() => new Map(detail.lineItems.map((li) => [li.id, li.setup_fee])), [detail.lineItems]);

  function run(fn: () => Promise<{ ok?: boolean; error?: string }>, okMsg: string, after?: () => void) {
    start(async () => {
      const res = await fn();
      if (res.error) toast({ title: "Failed", description: res.error, variant: "error" });
      else {
        toast({ title: okMsg, variant: "success" });
        after?.();
        router.refresh();
      }
    });
  }

  function saveDetails() {
    run(
      () =>
        updateOrderDetailsAction(order.id, {
          contactName: details.contactName,
          contactPhone: details.contactPhone,
          guestEmail: detail.customer ? undefined : details.contactEmail,
          shipping: {
            name: details.shipName,
            company: details.company,
            phone: details.contactPhone,
            street: details.shipStreet,
            city: details.shipCity,
            prov: details.shipProv,
            postal: details.shipPostal,
          },
          billing:
            details.billName || details.billEmail || details.billCompany
              ? { name: details.billName, email: details.billEmail, company: details.billCompany }
              : null,
          shippingMethod: details.method,
          fulfillmentMethod: details.fulfillment,
        }),
      "Details saved",
      () => setDetailsSnap(details)
    );
  }

  function saveItems() {
    run(
      () =>
        updateLineItemsAction(
          order.id,
          items.map((it) => ({
            id: it.id,
            productName: it.productName,
            sizeQuantities: Object.fromEntries(it.sizes),
            unitPrice: Number(it.unitPrice) || 0,
            decorations: {
              spots: it.spots,
              bagging: it.bagging,
              sewnTags: it.sewnTags,
              priceConfirmed: it.priceConfirmed,
            },
          }))
        ),
      "Items saved",
      () => setItemsSnap(JSON.stringify(items))
    );
  }

  function removeItem(id: string) {
    if (!window.confirm("Remove this item from the order?")) return;
    run(
      () => deleteLineItemAction(order.id, id),
      "Item removed",
      () =>
        setItems((arr) => {
          const next = arr.filter((it) => it.id !== id);
          setItemsSnap(JSON.stringify(next));
          return next;
        })
    );
  }

  async function onProofFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingProof(true);
    try {
      const res = await fetch("/api/design/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: [{ id: "p", bucket: "proofs", name: file.name, kind: "proof", size: file.size }] }),
      });
      if (!res.ok) throw new Error("Could not prepare upload");
      const { uploads } = (await res.json()) as { uploads: { id: string; bucket: string; path: string; token: string }[] };
      const u = uploads[0];
      const supabase = createSupabaseBrowserClient();
      const { error: upErr } = await supabase.storage.from(u.bucket).uploadToSignedUrl(u.path, u.token, file, {
        contentType: file.type || "image/png",
      });
      if (upErr) throw new Error(upErr.message);
      const result = await uploadProofAction(order.id, u.path);
      if (result.error) throw new Error(result.error);
      toast({ title: "Proof sent to customer", variant: "success" });
      setStatus("proof_ready");
      router.refresh();
    } catch (err) {
      toast({ title: "Proof upload failed", description: err instanceof Error ? err.message : "", variant: "error" });
    } finally {
      setUploadingProof(false);
    }
  }

  const meta = STATUS_META[order.status as OrderStatus];
  const paymentBadge: "success" | "info" | "warn" | "neutral" =
    payment === "paid_in_full" ? "success" : payment.startsWith("deposit") ? "info" : payment === "refunded" ? "neutral" : "warn";
  const methodOptions = Object.values(methodNames);

  return (
    <div className="space-y-6 px-8 py-6">
      {/* Header */}
      <div>
        <Link href="/admin/orders" className="text-sm text-dream-purple hover:underline">
          Back to orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl font-bold text-dream-ink">Order {order.order_number ?? ""}</h1>
          <Badge variant={meta?.badge ?? "neutral"}>{meta?.label ?? order.status}</Badge>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-dream-muted">
          <span>{details.company || details.contactName || detail.customer?.email || order.guest_email || "Guest"}</span>
          <span aria-hidden>·</span>
          <span>Submitted {fmtDay(order.created_at)}</span>
          <span aria-hidden>·</span>
          <span>Updated {fmtWhen(order.updated_at)}</span>
        </div>
      </div>

      {order.hold_note && (
        <div className="rounded-lg border border-dream-warn/40 bg-dream-warn-soft px-4 py-3 text-sm text-dream-warn">
          <strong>On hold:</strong> {order.hold_note}
        </div>
      )}

      {/* Stat strip — one joined card */}
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-dream-line bg-dream-surface md:grid-cols-5 md:divide-x md:divide-dream-line">
        {[
          { label: "In hands", value: order.due_date ?? "—", sub: meta?.label ?? "" },
          { label: "Total pieces", value: `${pieces}`, sub: `across ${items.length} item${items.length === 1 ? "" : "s"}` },
          { label: "Order value", value: formatCAD(pricing.total ?? 0), sub: "incl. tax & shipping" },
          {
            label: "Payment",
            value: <Badge variant={paymentBadge}>{payment === "paid_in_full" ? "Paid" : payment.replace(/_/g, " ")}</Badge>,
            sub: details.method === "rush" ? "Rush shipping" : "Standard shipping",
          },
          { label: "Sales rep", value: order.sales_rep ?? "—", sub: details.fulfillment === "ship" ? "Ship" : "Pick up" },
        ].map((s) => (
          <div key={s.label} className="px-5 py-4">
            <div className={LBL}>{s.label}</div>
            <div className="mt-1 truncate font-display text-lg font-semibold text-dream-ink">{s.value}</div>
            <div className="mt-0.5 truncate text-xs text-dream-muted">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Contact / Shipping / Billing */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wide">Contact information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className={cn(LBL, "mb-1")}>Company</div>
              <Input value={details.company} disabled={!can.edit} onChange={(e) => setD({ company: e.target.value })} />
            </div>
            <div>
              <div className={cn(LBL, "mb-1")}>Name</div>
              <Input value={details.contactName} disabled={!can.edit} onChange={(e) => setD({ contactName: e.target.value })} />
            </div>
            <div>
              <div className={cn(LBL, "mb-1")}>Phone</div>
              <Input value={details.contactPhone} disabled={!can.edit} onChange={(e) => setD({ contactPhone: e.target.value })} />
            </div>
            <div>
              <div className={cn(LBL, "mb-1")}>Email</div>
              <Input
                value={details.contactEmail}
                disabled={!can.edit || !!detail.customer}
                title={detail.customer ? "Login email — the customer manages this" : undefined}
                onChange={(e) => setD({ contactEmail: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wide">Shipping address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className={cn(LBL, "mb-1")}>Name</div>
              <Input value={details.shipName} disabled={!can.edit} onChange={(e) => setD({ shipName: e.target.value })} />
            </div>
            <div>
              <div className={cn(LBL, "mb-1")}>Street</div>
              <Input value={details.shipStreet} disabled={!can.edit} onChange={(e) => setD({ shipStreet: e.target.value })} />
            </div>
            <div className="grid grid-cols-[1fr_5.5rem] gap-3">
              <div>
                <div className={cn(LBL, "mb-1")}>City</div>
                <Input value={details.shipCity} disabled={!can.edit} onChange={(e) => setD({ shipCity: e.target.value })} />
              </div>
              <div>
                <div className={cn(LBL, "mb-1")}>Prov</div>
                <Select value={details.shipProv} disabled={!can.edit} onChange={(e) => setD({ shipProv: e.target.value })}>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <div className={cn(LBL, "mb-1")}>Postal</div>
              <Input value={details.shipPostal} disabled={!can.edit} onChange={(e) => setD({ shipPostal: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className={cn(LBL, "mb-1")}>Method</div>
                <Select value={details.method} disabled={!can.edit} onChange={(e) => setD({ method: e.target.value })}>
                  <option value="standard">Standard</option>
                  <option value="rush">Rush</option>
                </Select>
              </div>
              <div>
                <div className={cn(LBL, "mb-1")}>Fulfillment</div>
                <Select value={details.fulfillment} disabled={!can.edit} onChange={(e) => setD({ fulfillment: e.target.value })}>
                  <option value="ship">Ship</option>
                  <option value="pickup">Pick up</option>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wide">Billing</CardTitle>
            <button
              type="button"
              disabled={!can.edit}
              className="text-sm text-dream-purple hover:underline disabled:opacity-50"
              onClick={() =>
                setD({ billName: details.shipName || details.contactName, billEmail: details.contactEmail, billCompany: details.company })
              }
            >
              Copy from shipping
            </button>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className={cn(LBL, "mb-1")}>Name</div>
              <Input value={details.billName} disabled={!can.edit} onChange={(e) => setD({ billName: e.target.value })} />
            </div>
            <div>
              <div className={cn(LBL, "mb-1")}>Email</div>
              <Input value={details.billEmail} disabled={!can.edit} onChange={(e) => setD({ billEmail: e.target.value })} />
            </div>
            <div>
              <div className={cn(LBL, "mb-1")}>Company</div>
              <Input value={details.billCompany} disabled={!can.edit} onChange={(e) => setD({ billCompany: e.target.value })} />
            </div>
          </CardContent>
        </Card>
      </div>

      {detailsDirty && (
        <div className="flex items-center justify-end gap-3">
          <span className="text-sm font-medium text-dream-danger">Unsaved changes</span>
          <Button variant="ghost" onClick={() => setDetails(detailsSnap)}>
            Discard
          </Button>
          <Button variant="primary" loading={pending} onClick={saveDetails}>
            Save details
          </Button>
        </div>
      )}

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Items &amp; pricing</TabsTrigger>
          <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* ------------------------------------------------ Items & pricing */}
        <TabsContent value="items" className="space-y-4 pt-2">
          <div className="flex flex-wrap items-center gap-3">
            <span className={LBL}>
              Items ({items.length})
            </span>
            <div className="ml-auto flex items-center gap-3">
              {itemsDirty && (
                <>
                  <span className="text-sm font-medium text-dream-danger">Unsaved changes</span>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setItems(JSON.parse(itemsSnap) as ItemState[]);
                    }}
                  >
                    Discard
                  </Button>
                </>
              )}
              <Button variant="primary" disabled={!can.edit || !itemsDirty} loading={pending} onClick={saveItems}>
                Save changes
              </Button>
            </div>
          </div>

          {items.map((it, idx) => {
            const li = detail.lineItems.find((l) => l.id === it.id);
            const design = li?.design_id ? designById.get(li.design_id) : undefined;
            const mockups = ((design?.mockup_images ?? []) as { view: string; url: string | null }[]).filter((m) => m.url);
            const colour = (li?.colour ?? {}) as { name?: string; hex?: string | null };
            const qty = itemQty(it);
            const unit = Number(it.unitPrice) || 0;
            const setup = setupById.get(it.id) ?? 0;
            return (
              <Card key={it.id}>
                <CardContent className="space-y-4 p-5">
                  {/* Item header */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-dream-faint">{idx + 1}.</span>
                    <Input
                      value={it.productName}
                      disabled={!can.edit}
                      onChange={(e) => patchItem(it.id, (p) => ({ ...p, productName: e.target.value }))}
                      className="w-72 font-medium"
                    />
                    {it.spots.map((s, i) => (
                      <Badge key={i} variant="info">
                        {s.location || `Spot ${i + 1}`}
                      </Badge>
                    ))}
                    {can.edit && (
                      <button
                        type="button"
                        aria-label="Remove item"
                        className="ml-auto rounded p-1 text-dream-faint transition-colors hover:bg-dream-danger-soft hover:text-dream-danger"
                        onClick={() => removeItem(it.id)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden>
                          <path d="M6 6l12 12M18 6L6 18" />
                        </svg>
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-dream-muted">
                    {design?.name && <span>“{design.name}”</span>}
                    <span className="inline-flex items-center gap-1.5">
                      Colour:
                      <span className="h-3.5 w-3.5 rounded-full border border-dream-line-strong" style={{ background: colour.hex ?? "#fff" }} />
                      <span className="font-medium text-dream-ink">{colour.name ?? "—"}</span>
                    </span>
                  </div>

                  <div className="flex flex-col gap-5 lg:flex-row">
                    {/* Mockups */}
                    <div className="flex shrink-0 gap-3 lg:flex-col">
                      {mockups.length === 0 ? (
                        <div className="flex h-32 w-32 items-center justify-center rounded-lg border border-dream-line bg-dream-bg text-xs text-dream-faint">
                          No mockup
                        </div>
                      ) : (
                        mockups.map((m) => (
                          <figure key={m.view} className="w-32 rounded-lg border border-dream-line p-2">
                            <figcaption className="mb-1 text-xs font-medium capitalize text-dream-ink">{m.view}</figcaption>
                            <div className="h-28 w-full overflow-hidden bg-dream-bg">
                              <Image src={m.url!} alt={`${m.view} mockup`} width={112} height={112} className="h-full w-full object-contain" />
                            </div>
                          </figure>
                        ))
                      )}
                    </div>

                    <div className="min-w-0 flex-1 space-y-5">
                      {/* Sizes */}
                      <div>
                        <div className="flex items-baseline justify-between">
                          <div className={LBL}>Sizes ({qty} pcs)</div>
                          {can.edit &&
                            (addingSizeFor === it.id ? (
                              <span className="flex items-center gap-1.5">
                                <Input
                                  autoFocus
                                  value={newSize}
                                  onChange={(e) => setNewSize(e.target.value)}
                                  placeholder="e.g. 4XL"
                                  className="h-7 w-20 text-xs"
                                  onKeyDown={(e) => {
                                    if (e.key !== "Enter") return;
                                    const s = newSize.trim().toUpperCase();
                                    if (s && !it.sizes.some(([k]) => k.toUpperCase() === s)) {
                                      patchItem(it.id, (p) => ({
                                        ...p,
                                        sizes: [...p.sizes, [s, 0] as [string, number]].sort(([a], [b]) => sizeRank(a) - sizeRank(b)),
                                      }));
                                    }
                                    setNewSize("");
                                    setAddingSizeFor(null);
                                  }}
                                />
                                <button type="button" className="text-xs text-dream-muted hover:text-dream-ink" onClick={() => setAddingSizeFor(null)}>
                                  Cancel
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="text-sm text-dream-purple hover:underline"
                                onClick={() => {
                                  setAddingSizeFor(it.id);
                                  setNewSize("");
                                }}
                              >
                                + Add size
                              </button>
                            ))}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {it.sizes.map(([s, q]) => (
                            <div key={s} className="w-14">
                              <div className="mb-1 text-center text-xs font-semibold uppercase text-dream-muted">{s}</div>
                              <Input
                                type="number"
                                min={0}
                                value={q}
                                disabled={!can.edit}
                                onChange={(e) =>
                                  patchItem(it.id, (p) => ({
                                    ...p,
                                    sizes: p.sizes.map(([k, v]) => (k === s ? [k, Math.max(0, Number(e.target.value) || 0)] : [k, v])),
                                  }))
                                }
                                className="h-9 text-center"
                              />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Decoration spots */}
                      <div className="space-y-3">
                        <div className={LBL}>
                          Decoration ({it.spots.length} spot{it.spots.length === 1 ? "" : "s"})
                        </div>
                        {it.spots.map((spot, si) => (
                          <div key={si} className="space-y-3 rounded-lg border border-dream-line p-3">
                            <div className="flex flex-wrap items-end gap-3">
                              <div className="w-32">
                                <div className={cn(LBL, "mb-1")}>Location</div>
                                <Input value={spot.location} disabled={!can.edit} onChange={(e) => patchSpot(it.id, si, { location: e.target.value })} />
                              </div>
                              <div className="w-40">
                                <div className={cn(LBL, "mb-1")}>Type</div>
                                <Select value={spot.type} disabled={!can.edit} onChange={(e) => patchSpot(it.id, si, { type: e.target.value })}>
                                  <option value="">—</option>
                                  {methodOptions.map((m) => (
                                    <option key={m} value={m}>
                                      {m}
                                    </option>
                                  ))}
                                  {spot.type && !methodOptions.includes(spot.type) && <option value={spot.type}>{spot.type}</option>}
                                </Select>
                              </div>
                              <div className="w-24">
                                <div className={cn(LBL, "mb-1")}>Width</div>
                                <div className="flex items-center gap-1">
                                  <Input value={spot.widthIn} disabled={!can.edit} onChange={(e) => patchSpot(it.id, si, { widthIn: e.target.value })} />
                                  <span className="text-xs text-dream-muted">in</span>
                                </div>
                              </div>
                              <div className="w-24">
                                <div className={cn(LBL, "mb-1")}>Height</div>
                                <div className="flex items-center gap-1">
                                  <Input value={spot.heightIn} disabled={!can.edit} onChange={(e) => patchSpot(it.id, si, { heightIn: e.target.value })} />
                                  <span className="text-xs text-dream-muted">in</span>
                                </div>
                              </div>
                              <div className="w-24">
                                <div className={cn(LBL, "mb-1")}># Colours</div>
                                <Input value={spot.colours} disabled={!can.edit} onChange={(e) => patchSpot(it.id, si, { colours: e.target.value })} />
                              </div>
                              <div className="flex flex-col gap-1.5 pb-1">
                                <Checkbox
                                  label="Puff"
                                  checked={spot.puff}
                                  disabled={!can.edit}
                                  onChange={(e) => patchSpot(it.id, si, { puff: e.target.checked })}
                                />
                                <Checkbox
                                  label="Spot process"
                                  checked={spot.spotProcess}
                                  disabled={!can.edit}
                                  onChange={(e) => patchSpot(it.id, si, { spotProcess: e.target.checked })}
                                />
                              </div>
                              {can.edit && (
                                <button
                                  type="button"
                                  aria-label="Remove decoration"
                                  className="mb-2 ml-auto rounded p-1 text-dream-faint transition-colors hover:bg-dream-danger-soft hover:text-dream-danger"
                                  onClick={() => patchItem(it.id, (p) => ({ ...p, spots: p.spots.filter((_, i) => i !== si) }))}
                                >
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" className="h-4 w-4" aria-hidden>
                                    <path d="M6 6l12 12M18 6L6 18" />
                                  </svg>
                                </button>
                              )}
                            </div>
                            <div>
                              <div className={cn(LBL, "mb-1.5")}>Pantone colours</div>
                              {spot.pantones.length === 0 && <p className="text-xs italic text-dream-faint">No colours yet</p>}
                              <div className="flex flex-wrap items-center gap-2">
                                {spot.pantones.map((code, pi) => (
                                  <span key={pi} className="flex items-center gap-1">
                                    <Input
                                      value={code}
                                      disabled={!can.edit}
                                      placeholder="Pantone code"
                                      onChange={(e) =>
                                        patchSpot(it.id, si, { pantones: spot.pantones.map((c, i) => (i === pi ? e.target.value : c)) })
                                      }
                                      className="h-8 w-32 text-sm"
                                    />
                                    {can.edit && (
                                      <button
                                        type="button"
                                        aria-label="Remove colour"
                                        className="text-dream-faint hover:text-dream-danger"
                                        onClick={() => patchSpot(it.id, si, { pantones: spot.pantones.filter((_, i) => i !== pi) })}
                                      >
                                        ×
                                      </button>
                                    )}
                                  </span>
                                ))}
                                {can.edit && (
                                  <button
                                    type="button"
                                    className="text-sm text-dream-purple hover:underline"
                                    onClick={() => patchSpot(it.id, si, { pantones: [...spot.pantones, ""] })}
                                  >
                                    + Add colour
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                        {can.edit && (
                          <button
                            type="button"
                            className="text-sm text-dream-purple hover:underline"
                            onClick={() =>
                              patchItem(it.id, (p) => ({
                                ...p,
                                spots: [
                                  ...p.spots,
                                  { location: "", type: methodOptions[0] ?? "", widthIn: "", heightIn: "", colours: "", pantones: [], puff: false, spotProcess: false },
                                ],
                              }))
                            }
                          >
                            + Add print
                          </button>
                        )}
                      </div>

                      {/* Unit price */}
                      <div className="flex flex-wrap items-center gap-4 border-t border-dream-line pt-4">
                        <div>
                          <div className={cn(LBL, "mb-1")}>Unit price</div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-dream-muted">$</span>
                            <Input
                              value={it.unitPrice}
                              disabled={!can.pricing}
                              onChange={(e) => patchItem(it.id, (p) => ({ ...p, unitPrice: e.target.value }))}
                              className="h-9 w-24"
                            />
                            <Checkbox
                              label="Confirm price"
                              checked={it.priceConfirmed}
                              disabled={!can.edit}
                              onChange={(e) => patchItem(it.id, (p) => ({ ...p, priceConfirmed: e.target.checked }))}
                            />
                          </div>
                        </div>
                        <div className="ml-auto text-right">
                          <div className="font-display text-xl font-bold text-dream-ink">{formatCAD(unit * qty + setup)}</div>
                          <div className="text-xs text-dream-muted">
                            {formatCAD(unit)} × {qty}
                            {setup > 0 && <> + {formatCAD(setup)} setup</>}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-5">
                        <Checkbox
                          label="Individual bagging"
                          checked={it.bagging}
                          disabled={!can.edit}
                          onChange={(e) => patchItem(it.id, (p) => ({ ...p, bagging: e.target.checked }))}
                        />
                        <Checkbox
                          label="Sewn size tags"
                          checked={it.sewnTags}
                          disabled={!can.edit}
                          onChange={(e) => patchItem(it.id, (p) => ({ ...p, sewnTags: e.target.checked }))}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {sourceArt.length > 0 && (
            <div>
              <div className={cn(LBL, "mb-1.5")}>Source artwork</div>
              <div className="flex flex-wrap gap-2">
                {sourceArt.map((a, i) =>
                  a.url ? (
                    <a key={i} href={a.url} target="_blank" rel="noreferrer" className="text-sm text-dream-purple underline">
                      {a.name}
                    </a>
                  ) : null
                )}
              </div>
            </div>
          )}

          {/* Pricing summary — bottom right, like an invoice */}
          <div className="flex justify-end">
            <Card className="w-full max-w-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Pricing</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(["subtotal", "setupFees", "shipping", "tax"] as const).map((k) => (
                  <label key={k} className="flex items-center justify-between gap-2 text-sm">
                    <span className="capitalize text-dream-muted">{k === "setupFees" ? "Setup fees" : k}</span>
                    <Input
                      type="number"
                      value={price[k]}
                      disabled={!can.pricing}
                      onChange={(e) => setPrice((p) => ({ ...p, [k]: Number(e.target.value) || 0 }))}
                      className="h-8 w-28 text-right"
                    />
                  </label>
                ))}
                <div className="flex justify-between border-t border-dream-line pt-2 font-semibold text-dream-ink">
                  <span>Total</span>
                  <span>{formatCAD(priceTotal)}</span>
                </div>
                {can.pricing && (
                  <Button
                    variant="secondary"
                    className="mt-2 w-full"
                    onClick={() => run(() => updateOrderPricingAction(order.id, { ...price, total: priceTotal }), "Pricing saved")}
                  >
                    Save pricing
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ------------------------------------------------ Lifecycle */}
        <TabsContent value="lifecycle" className="space-y-6 pt-2">
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dream-line bg-dream-surface p-4">
            <span className="text-sm font-medium text-dream-ink">Status</span>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!can.edit} className="w-56">
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s].label}
                </option>
              ))}
            </Select>
            <Button
              variant="primary"
              disabled={!can.edit || status === order.status}
              loading={pending}
              onClick={() => run(() => setOrderStatusAction(order.id, status as OrderStatus), "Status updated")}
            >
              Update status
            </Button>
            {can.proofs && (
              <div className="ml-auto">
                <Button variant="secondary" loading={uploadingProof} onClick={() => proofInput.current?.click()}>
                  Upload official mockup
                </Button>
                <input ref={proofInput} type="file" accept="image/*,application/pdf" hidden onChange={onProofFile} />
              </div>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Proofs</CardTitle>
              </CardHeader>
              <CardContent>
                {detail.proofs.length === 0 ? (
                  <p className="text-sm text-dream-muted">No proofs sent yet. Upload an official mockup to send one.</p>
                ) : (
                  <div className="space-y-3">
                    {detail.proofs.map((p) => (
                      <div key={p.id} className="flex items-center gap-4 rounded-lg border border-dream-line p-3">
                        <div className="h-16 w-16 overflow-hidden rounded bg-dream-bg">
                          {p.image && <Image src={p.image} alt="" width={64} height={64} className="h-full w-full object-contain" />}
                        </div>
                        <div className="flex-1">
                          <Badge variant={p.status === "approved" ? "success" : p.status === "changes_requested" ? "warn" : "info"}>
                            {p.status.replace(/_/g, " ")}
                          </Badge>
                          {p.change_request_comment && <p className="mt-1 text-sm text-dream-warn">“{p.change_request_comment}”</p>}
                        </div>
                        <div className="text-xs text-dream-faint">{relativeTime(p.created_at)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="self-start">
              <CardHeader>
                <CardTitle>Payment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Select value={payment} onChange={(e) => setPayment(e.target.value)} disabled={!can.edit}>
                  {PAYMENT_STATUSES.map((p) => (
                    <option key={p} value={p}>
                      {p.replace(/_/g, " ")}
                    </option>
                  ))}
                </Select>
                <Button
                  variant="secondary"
                  className="w-full"
                  disabled={!can.edit || payment === order.payment_status}
                  onClick={() => run(() => setPaymentStatusAction(order.id, payment as PaymentStatus), "Payment updated")}
                >
                  Update payment
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ------------------------------------------------ Notes */}
        <TabsContent value="notes" className="pt-2">
          <Card>
            <CardContent className="space-y-3 p-5">
              {feed.length === 0 && <p className="text-sm text-dream-muted">No notes yet. Notes about this job show up here.</p>}
              {feed.map((n, i) => (
                <div
                  key={`${n.at}-${i}`}
                  className={cn(
                    "rounded-lg border px-4 py-2.5",
                    n.vis === "internal" ? "border-dream-warn/30 bg-dream-warn-soft" : "border-dream-periwinkle/30 bg-dream-info-soft"
                  )}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-semibold text-dream-ink">
                      {n.actor}
                      <span className="font-normal text-dream-muted"> @ {fmtWhen(n.at)}</span>
                    </span>
                    <span
                      className={cn(
                        "shrink-0 text-[10px] font-bold uppercase tracking-wider",
                        n.vis === "internal" ? "text-dream-warn" : "text-dream-ink-soft"
                      )}
                    >
                      {n.vis === "internal" ? "Internal" : "Customer"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-dream-ink">{n.text}</p>
                </div>
              ))}
              <div className={cn("flex flex-wrap items-start gap-2", feed.length > 0 && "border-t border-dream-line pt-3")}>
                <Textarea
                  rows={1}
                  placeholder="Add a note…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="min-h-10 flex-1 basis-64"
                />
                <Select value={noteVis} onChange={(e) => setNoteVis(e.target.value as "internal" | "customer")} className="w-40">
                  <option value="internal">Internal</option>
                  <option value="customer">Customer-facing</option>
                </Select>
                <Button
                  variant="secondary"
                  disabled={!can.edit || !note.trim()}
                  onClick={() =>
                    run(async () => {
                      const r = await addOrderNoteAction(order.id, note, noteVis);
                      if (!r.error) setNote("");
                      return r;
                    }, "Note added")
                  }
                >
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ------------------------------------------------ Activity */}
        <TabsContent value="activity" className="pt-2">
          <Card className="max-w-2xl">
            <CardContent className="divide-y divide-dream-line p-5">
              {detail.activity.length === 0 && <p className="text-sm text-dream-muted">No activity yet.</p>}
              {detail.activity.map((a) => (
                <div key={a.id} className="flex items-baseline justify-between gap-2 py-2 text-sm first:pt-0 last:pb-0">
                  <div className="min-w-0 truncate">
                    <span className="font-semibold capitalize text-dream-ink">{a.type.replace(/_/g, " ")}</span>
                    <span className="text-dream-muted"> · {a.actor_name ?? "Staff"}</span>
                  </div>
                  <time dateTime={a.created_at} title={fmtWhen(a.created_at)} className="shrink-0 text-xs text-dream-faint">
                    {relativeTime(a.created_at)}
                  </time>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
