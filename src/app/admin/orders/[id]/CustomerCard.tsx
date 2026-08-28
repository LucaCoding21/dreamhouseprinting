"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/Dialog";
import { cn } from "@/lib/cn";
import { updateOrderDetailsAction } from "../actions";
import { LBL, PROVINCES, useOrderAction, type Detail, type StoredAddress } from "./shared";

export function CustomerCard({ detail, canEdit }: { detail: Detail; canEdit: boolean }) {
  const { order, customer } = detail;
  const { pending, run } = useOrderAction();
  const [open, setOpen] = useState(false);

  const ship = (order.shipping_address ?? {}) as StoredAddress;
  const company = ship.company ?? "";
  const name = customer?.name ?? ship.name ?? "";
  const phone = customer?.phone ?? ship.phone ?? "";
  // guest_email doubles as a per-order override on account orders, so it wins.
  const email = order.guest_email ?? customer?.email ?? "";

  const initial = useMemo(
    () => ({
      company,
      contactName: name,
      contactPhone: phone,
      contactEmail: email,
      shipName: ship.name ?? "",
      shipStreet: ship.street ?? "",
      shipCity: ship.city ?? "",
      shipProv: ship.prov ?? "BC",
      shipPostal: ship.postal ?? "",
      method: order.shipping_method ?? "standard",
      fulfillment: order.fulfillment_method ?? "ship",
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [form, setForm] = useState(initial);
  const setF = (patch: Partial<typeof initial>) => setForm((d) => ({ ...d, ...patch }));

  function save() {
    run(
      () =>
        updateOrderDetailsAction(order.id, {
          contactName: form.contactName,
          contactPhone: form.contactPhone,
          guestEmail: form.contactEmail,
          shipping: {
            name: form.shipName,
            company: form.company,
            phone: form.contactPhone,
            street: form.shipStreet,
            city: form.shipCity,
            prov: form.shipProv,
            postal: form.shipPostal,
          },
          billing: null,
          shippingMethod: form.method,
          fulfillmentMethod: form.fulfillment,
        }),
      "Details saved",
      () => setOpen(false),
    );
  }

  const hasAddress = ship.street || ship.city || ship.postal;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">Customer</CardTitle>
        {canEdit && (
          <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
            Edit
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="space-y-0.5">
          {company && <div className="font-semibold text-dream-ink">{company}</div>}
          {name && <div className={cn(company ? "text-dream-muted" : "font-semibold text-dream-ink")}>{name}</div>}
          {phone && (
            // tel:/mailto: so the shop can dial or write straight from a phone.
            <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="block text-dream-muted hover:underline">
              {phone}
            </a>
          )}
          {email && (
            <a href={`mailto:${email}`} className="block truncate text-dream-purple hover:underline">
              {email}
            </a>
          )}
        </div>

        {hasAddress && (
          <div className="border-t border-dream-line pt-3 text-dream-ink">
            {ship.name && <div>{ship.name}</div>}
            {ship.street && <div>{ship.street}</div>}
            <div>{[ship.city, ship.prov, ship.postal].filter(Boolean).join(", ")}</div>
          </div>
        )}

        <div className="border-t border-dream-line pt-3 text-xs text-dream-muted">
          {order.fulfillment_method === "pickup" ? "Pick up in store" : "Ship to customer"}
          {order.shipping_method ? ` · ${order.shipping_method}` : ""}
        </div>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit customer details</DialogTitle>
          </DialogHeader>
          <div className="max-h-[70dvh] space-y-4 overflow-y-auto p-5 pt-0">
            <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
              <Labeled label="Company">
                <Input value={form.company} disabled={!canEdit} onChange={(e) => setF({ company: e.target.value })} />
              </Labeled>
              <Labeled label="Name">
                <Input value={form.contactName} disabled={!canEdit} onChange={(e) => setF({ contactName: e.target.value })} />
              </Labeled>
              <Labeled label="Phone">
                <Input value={form.contactPhone} disabled={!canEdit} onChange={(e) => setF({ contactPhone: e.target.value })} />
              </Labeled>
              <Labeled label="Email">
                <Input
                  type="email"
                  value={form.contactEmail}
                  disabled={!canEdit}
                  onChange={(e) => setF({ contactEmail: e.target.value })}
                />
                {customer && (
                  <p className="mt-1 text-[11px] text-dream-faint">
                    Where this order&apos;s emails go. Their account login email stays the same.
                  </p>
                )}
              </Labeled>
            </div>

            <div className="space-y-3 border-t border-dream-line pt-4">
              <div className={LBL}>Shipping address</div>
              <Labeled label="Name">
                <Input value={form.shipName} disabled={!canEdit} onChange={(e) => setF({ shipName: e.target.value })} />
              </Labeled>
              <Labeled label="Street">
                <Input value={form.shipStreet} disabled={!canEdit} onChange={(e) => setF({ shipStreet: e.target.value })} />
              </Labeled>
              <div className="grid grid-cols-[1fr_5.5rem] gap-3">
                <Labeled label="City">
                  <Input value={form.shipCity} disabled={!canEdit} onChange={(e) => setF({ shipCity: e.target.value })} />
                </Labeled>
                <Labeled label="Prov">
                  <Select value={form.shipProv} disabled={!canEdit} onChange={(e) => setF({ shipProv: e.target.value })}>
                    {PROVINCES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </Select>
                </Labeled>
              </div>
              <Labeled label="Postal">
                <Input value={form.shipPostal} disabled={!canEdit} onChange={(e) => setF({ shipPostal: e.target.value })} />
              </Labeled>
              <div className="grid grid-cols-1 gap-3 min-[430px]:grid-cols-2">
                <Labeled label="Method">
                  <Select value={form.method} disabled={!canEdit} onChange={(e) => setF({ method: e.target.value })}>
                    <option value="standard">Standard</option>
                    <option value="rush">Rush</option>
                  </Select>
                </Labeled>
                <Labeled label="Fulfillment">
                  <Select value={form.fulfillment} disabled={!canEdit} onChange={(e) => setF({ fulfillment: e.target.value })}>
                    <option value="ship">Ship</option>
                    <option value="pickup">Pick up</option>
                  </Select>
                </Labeled>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={pending} disabled={!canEdit} onClick={save}>
              Save details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
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
