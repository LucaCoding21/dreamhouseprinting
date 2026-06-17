"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useToast } from "@/components/ui/use-toast";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatCAD } from "@/lib/money";
import { STATUS_META } from "@/lib/orderStatus";
import { ORDER_STATUSES, PAYMENT_STATUSES } from "@/lib/db/rows";
import type { OrderRow, LineItemRow, DesignRow, ProofRow, OrderActivityRow, ProfileRow, OrderStatus, PaymentStatus } from "@/lib/db/rows";
import {
  setOrderStatusAction,
  setPaymentStatusAction,
  addOrderNoteAction,
  updateOrderPricingAction,
  uploadProofAction,
} from "../actions";

interface Detail {
  order: OrderRow;
  customer: Pick<ProfileRow, "id" | "name" | "email" | "phone"> | null;
  lineItems: LineItemRow[];
  designs: DesignRow[];
  proofs: ProofRow[];
  activity: OrderActivityRow[];
}

export function OrderDetailClient({ detail, can }: { detail: Detail; can: { edit: boolean; pricing: boolean; proofs: boolean } }) {
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

  const designMockups = detail.designs.flatMap((d) => (d.mockup_images ?? []) as { view: string; url: string | null }[]);
  const sourceArt = detail.designs.flatMap((d) => (d.source_artwork_files ?? []) as { name: string; url: string | null }[]);
  const pieces = detail.lineItems.reduce((acc, li) => {
    const sq = (li.size_quantities ?? {}) as Record<string, number>;
    return acc + Object.values(sq).reduce((a, b) => a + (b || 0), 0);
  }, 0);

  function run(fn: () => Promise<{ ok?: boolean; error?: string }>, okMsg: string) {
    start(async () => {
      const res = await fn();
      if (res.error) toast({ title: "Failed", description: res.error, variant: "error" });
      else {
        toast({ title: okMsg, variant: "success" });
        router.refresh();
      }
    });
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

  const meta = STATUS_META[status as OrderStatus];
  const shipping = (order.shipping_address ?? {}) as Record<string, string>;

  return (
    <div>
      <AdminHeader title={order.order_number ?? "Order"} badge={<Badge variant={meta?.badge ?? "neutral"}>{meta?.label}</Badge>}>
        <Button variant="ghost" onClick={() => router.push("/admin/orders")}>
          ← All orders
        </Button>
      </AdminHeader>

      <div className="px-8 py-6">
        {/* Stat strip */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-5">
          {[
            { label: "In hands", value: order.due_date ?? "—" },
            { label: "Pieces", value: `${pieces}` },
            { label: "Order value", value: formatCAD(pricing.total ?? 0) },
            { label: "Payment", value: payment.replace(/_/g, " ") },
            { label: "Customer", value: detail.customer?.name ?? detail.customer?.email ?? "—" },
          ].map((s) => (
            <div key={s.label} className="rounded-xl border border-dream-line bg-dream-surface p-3">
              <div className="text-xs uppercase tracking-wide text-dream-muted">{s.label}</div>
              <div className="mt-0.5 truncate font-medium capitalize text-dream-ink">{s.value}</div>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {/* Status control */}
            <Card>
              <CardHeader>
                <CardTitle>Status</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <div className="flex-1">
                  <Select value={status} onChange={(e) => setStatus(e.target.value)} disabled={!can.edit}>
                    {ORDER_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_META[s].label}
                      </option>
                    ))}
                  </Select>
                </div>
                <Button
                  variant="primary"
                  disabled={!can.edit || status === order.status}
                  loading={pending}
                  onClick={() => run(() => setOrderStatusAction(order.id, status as OrderStatus), "Status updated")}
                >
                  Update status
                </Button>
                {can.proofs && (
                  <>
                    <Button variant="secondary" loading={uploadingProof} onClick={() => proofInput.current?.click()}>
                      Upload official mockup
                    </Button>
                    <input ref={proofInput} type="file" accept="image/*,application/pdf" hidden onChange={onProofFile} />
                  </>
                )}
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader>
                <CardTitle>Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {detail.lineItems.map((li) => {
                  const colour = (li.colour ?? {}) as { name?: string };
                  const sq = (li.size_quantities ?? {}) as Record<string, number>;
                  const mock = designMockups.find((m) => m.url)?.url;
                  return (
                    <div key={li.id} className="flex gap-4">
                      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-dream-line bg-dream-bg">
                        {mock && <Image src={mock} alt="" width={96} height={96} className="h-full w-full object-contain" />}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-dream-ink">{li.product_name}</div>
                        <div className="text-sm text-dream-muted">{colour.name}</div>
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {Object.entries(sq)
                            .filter(([, q]) => q > 0)
                            .map(([s, q]) => (
                              <span key={s} className="rounded bg-dream-bg px-2 py-0.5 text-xs text-dream-ink">
                                {q}×{s}
                              </span>
                            ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium text-dream-ink">{formatCAD(li.line_total)}</div>
                        <div className="text-xs text-dream-muted">{formatCAD(li.unit_price)}/ea</div>
                      </div>
                    </div>
                  );
                })}
                {sourceArt.length > 0 && (
                  <div className="border-t border-dream-line pt-3">
                    <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-dream-muted">Source artwork</div>
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
              </CardContent>
            </Card>

            {/* Proofs */}
            <Card>
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
                          {p.change_request_comment && (
                            <p className="mt-1 text-sm text-dream-warn">“{p.change_request_comment}”</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <NoteList title="Internal (staff only)" notes={(order.internal_notes ?? []) as unknown as Note[]} tone="warn" />
                <NoteList title="Customer-facing" notes={(order.customer_notes ?? []) as unknown as Note[]} tone="info" />
                <div className="border-t border-dream-line pt-3">
                  <Textarea rows={2} placeholder="Add a note…" value={note} onChange={(e) => setNote(e.target.value)} />
                  <div className="mt-2 flex items-center gap-2">
                    <Select value={noteVis} onChange={(e) => setNoteVis(e.target.value as "internal" | "customer")} className="w-44">
                      <option value="internal">Internal note</option>
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
                      Add note
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Pricing</CardTitle>
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

            <Card>
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

            {(detail.customer || shipping.street) && (
              <Card>
                <CardHeader>
                  <CardTitle>Contact</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="text-dream-ink">{detail.customer?.name}</div>
                  <div className="text-dream-muted">{detail.customer?.email}</div>
                  <div className="text-dream-muted">{detail.customer?.phone}</div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Activity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {detail.activity.map((a) => (
                  <div key={a.id} className="text-xs">
                    <span className="font-medium text-dream-ink">{a.actor_name}</span>{" "}
                    <span className="text-dream-muted">{a.type.replace(/_/g, " ")}</span>
                    <div className="text-dream-faint">{new Date(a.created_at).toLocaleString("en-CA")}</div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Note {
  at: string;
  actor: string;
  text: string;
}
function NoteList({ title, notes, tone }: { title: string; notes: Note[]; tone: "warn" | "info" }) {
  if (notes.length === 0) return null;
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-dream-muted">{title}</div>
      <div className="space-y-1.5">
        {notes.map((n, i) => (
          <div key={i} className={`rounded-lg px-3 py-1.5 text-sm ${tone === "warn" ? "bg-dream-warn-soft" : "bg-dream-info-soft"}`}>
            <span className="text-dream-ink">{n.text}</span>
            <span className="ml-2 text-xs text-dream-muted">— {n.actor}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
