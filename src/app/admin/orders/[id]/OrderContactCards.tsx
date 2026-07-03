"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { updateOrderDetailsAction } from "../actions";
import { LBL, PROVINCES, useOrderAction, type Detail, type StoredAddress } from "./shared";

export function OrderContactCards({
  detail,
  canEdit,
}: {
  detail: Detail;
  canEdit: boolean;
}) {
  const { order, customer } = detail;
  const { pending, run } = useOrderAction();

  const shippingAddr = (order.shipping_address ?? {}) as StoredAddress;
  const billingAddr = (order.billing_address ?? {}) as { name?: string; email?: string; company?: string };

  const initial = useMemo(
    () => ({
      company: shippingAddr.company ?? "",
      contactName: customer?.name ?? shippingAddr.name ?? "",
      contactPhone: customer?.phone ?? shippingAddr.phone ?? "",
      contactEmail: customer?.email ?? order.guest_email ?? "",
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
    [],
  );

  const [details, setDetails] = useState(initial);
  const [snap, setSnap] = useState(initial);
  const dirty = JSON.stringify(details) !== JSON.stringify(snap);
  const setD = (patch: Partial<typeof initial>) => setDetails((d) => ({ ...d, ...patch }));

  function save() {
    run(
      () =>
        updateOrderDetailsAction(order.id, {
          contactName: details.contactName,
          contactPhone: details.contactPhone,
          guestEmail: customer ? undefined : details.contactEmail,
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
      () => setSnap(details),
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wide">Contact information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Labeled label="Company">
              <Input value={details.company} disabled={!canEdit} onChange={(e) => setD({ company: e.target.value })} />
            </Labeled>
            <Labeled label="Name">
              <Input value={details.contactName} disabled={!canEdit} onChange={(e) => setD({ contactName: e.target.value })} />
            </Labeled>
            <Labeled label="Phone">
              <Input value={details.contactPhone} disabled={!canEdit} onChange={(e) => setD({ contactPhone: e.target.value })} />
            </Labeled>
            <Labeled label="Email">
              <Input
                value={details.contactEmail}
                disabled={!canEdit || !!customer}
                title={customer ? "Login email — the customer manages this" : undefined}
                onChange={(e) => setD({ contactEmail: e.target.value })}
              />
            </Labeled>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wide">Shipping address</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Labeled label="Name">
              <Input value={details.shipName} disabled={!canEdit} onChange={(e) => setD({ shipName: e.target.value })} />
            </Labeled>
            <Labeled label="Street">
              <Input value={details.shipStreet} disabled={!canEdit} onChange={(e) => setD({ shipStreet: e.target.value })} />
            </Labeled>
            <div className="grid grid-cols-[1fr_5.5rem] gap-3">
              <Labeled label="City">
                <Input value={details.shipCity} disabled={!canEdit} onChange={(e) => setD({ shipCity: e.target.value })} />
              </Labeled>
              <Labeled label="Prov">
                <Select value={details.shipProv} disabled={!canEdit} onChange={(e) => setD({ shipProv: e.target.value })}>
                  {PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </Labeled>
            </div>
            <Labeled label="Postal">
              <Input value={details.shipPostal} disabled={!canEdit} onChange={(e) => setD({ shipPostal: e.target.value })} />
            </Labeled>
            <div className="grid grid-cols-2 gap-3">
              <Labeled label="Method">
                <Select value={details.method} disabled={!canEdit} onChange={(e) => setD({ method: e.target.value })}>
                  <option value="standard">Standard</option>
                  <option value="rush">Rush</option>
                </Select>
              </Labeled>
              <Labeled label="Fulfillment">
                <Select value={details.fulfillment} disabled={!canEdit} onChange={(e) => setD({ fulfillment: e.target.value })}>
                  <option value="ship">Ship</option>
                  <option value="pickup">Pick up</option>
                </Select>
              </Labeled>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-bold uppercase tracking-wide">Billing address</CardTitle>
            <button
              type="button"
              disabled={!canEdit}
              className="text-sm text-dream-purple hover:underline disabled:opacity-50"
              onClick={() =>
                setD({ billName: details.shipName || details.contactName, billEmail: details.contactEmail, billCompany: details.company })
              }
            >
              Copy from shipping
            </button>
          </CardHeader>
          <CardContent className="space-y-3">
            <Labeled label="Name">
              <Input value={details.billName} disabled={!canEdit} onChange={(e) => setD({ billName: e.target.value })} />
            </Labeled>
            <Labeled label="Email">
              <Input value={details.billEmail} disabled={!canEdit} onChange={(e) => setD({ billEmail: e.target.value })} />
            </Labeled>
            <Labeled label="Company">
              <Input value={details.billCompany} disabled={!canEdit} onChange={(e) => setD({ billCompany: e.target.value })} />
            </Labeled>
          </CardContent>
        </Card>
      </div>

      {dirty && (
        <div className="sticky bottom-4 z-10 flex items-center justify-end gap-3 rounded-xl border border-dream-line bg-dream-surface/95 px-4 py-3 shadow-lg backdrop-blur">
          <span className="text-sm font-medium text-dream-danger">Unsaved changes</span>
          <Button variant="ghost" onClick={() => setDetails(snap)}>
            Discard
          </Button>
          <Button variant="primary" loading={pending} disabled={!canEdit} onClick={save}>
            Save details
          </Button>
        </div>
      )}
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
