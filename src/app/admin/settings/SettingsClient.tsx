"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Switch } from "@/components/ui/Switch";
import { Field } from "@/components/ui/Field";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import type { DecorationMethodRow } from "@/lib/db/rows";
import type { CheckoutSettings } from "@/lib/checkoutSettings";
import type { AddonSettings } from "@/lib/addonSettings";
import type { PaymentSettings } from "@/lib/paymentSettings";
import type { BusinessSettings } from "@/lib/businessSettings";
import {
  updateDecorationMethodAction,
  updateEmailTemplatesAction,
  updateCheckoutSettingsAction,
  updateAddonSettingsAction,
  updatePaymentSettingsAction,
  updateBusinessSettingsAction,
  type EmailTemplateMap,
} from "./actions";

interface StaffRow {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
  permissionCount: string;
}

interface EmailTemplate {
  subject: string;
  body: string;
}

interface SettingsClientProps {
  decorationMethods: DecorationMethodRow[];
  staff: StaffRow[];
  emailTemplates: Record<string, EmailTemplate>;
  checkout: CheckoutSettings;
  addons: AddonSettings;
  payments: PaymentSettings;
  business: BusinessSettings;
}

export function SettingsClient({ decorationMethods, staff, emailTemplates, checkout, addons, payments, business }: SettingsClientProps) {
  return (
    <div>
      <AdminHeader title="Settings" />
      <div className="px-8 py-6">
        <Tabs defaultValue="decoration">
          <TabsList>
            <TabsTrigger value="decoration">Decoration methods</TabsTrigger>
            <TabsTrigger value="addons">Add-ons</TabsTrigger>
            <TabsTrigger value="checkout">Checkout</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="email">Email templates</TabsTrigger>
          </TabsList>

          <TabsContent value="decoration" className="mt-4">
            <DecorationMethodsTab methods={decorationMethods} />
          </TabsContent>

          <TabsContent value="addons" className="mt-4">
            <AddonsTab settings={addons} />
          </TabsContent>

          <TabsContent value="checkout" className="mt-4 space-y-6">
            <CheckoutTab settings={checkout} />
            <PickupAddressCard settings={business} />
          </TabsContent>

          <TabsContent value="payments" className="mt-4">
            <PaymentsTab settings={payments} />
          </TabsContent>

          <TabsContent value="staff" className="mt-4">
            <StaffTab staff={staff} />
          </TabsContent>

          <TabsContent value="email" className="mt-4">
            <EmailTemplatesTab templates={emailTemplates} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Decoration methods                                                 */
/* ------------------------------------------------------------------ */

function DecorationMethodsTab({ methods }: { methods: DecorationMethodRow[] }) {
  if (methods.length === 0) {
    return <EmptyState title="No decoration methods" description="Decoration methods configure pricing for screen print, embroidery, and more." />;
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {methods.map((method) => (
        <DecorationMethodCard key={method.id} method={method} />
      ))}
    </div>
  );
}

function DecorationMethodCard({ method }: { method: DecorationMethodRow }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const [name, setName] = useState(method.name);
  const [description, setDescription] = useState(method.description ?? "");
  const [setupFee, setSetupFee] = useState(String(method.setup_fee));
  const [perUnit, setPerUnit] = useState(String(method.per_unit_cost));
  const [perColor, setPerColor] = useState(String(method.per_color_cost));
  const [active, setActive] = useState(method.is_active);

  function save() {
    start(async () => {
      const res = await updateDecorationMethodAction(method.id, {
        name: name.trim(),
        description: description.trim() || null,
        setup_fee: Number(setupFee) || 0,
        per_unit_cost: Number(perUnit) || 0,
        per_color_cost: Number(perColor) || 0,
        is_active: active,
      });
      if (res.error) toast({ title: "Failed", description: res.error, variant: "error" });
      else {
        toast({ title: "Decoration method saved", variant: "success" });
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>{method.name}</CardTitle>
        <Badge variant={active ? "success" : "neutral"}>{active ? "Active" : "Inactive"}</Badge>
      </CardHeader>
      <CardContent className="space-y-3">
        <Field label="Name" htmlFor={`name-${method.id}`}>
          <Input id={`name-${method.id}`} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description" htmlFor={`desc-${method.id}`}>
          <Textarea
            id={`desc-${method.id}`}
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Setup fee" htmlFor={`setup-${method.id}`}>
            <Input
              id={`setup-${method.id}`}
              type="number"
              value={setupFee}
              onChange={(e) => setSetupFee(e.target.value)}
            />
          </Field>
          <Field label="Per unit" htmlFor={`unit-${method.id}`}>
            <Input
              id={`unit-${method.id}`}
              type="number"
              value={perUnit}
              onChange={(e) => setPerUnit(e.target.value)}
            />
          </Field>
          <Field label="Per color" htmlFor={`color-${method.id}`}>
            <Input
              id={`color-${method.id}`}
              type="number"
              value={perColor}
              onChange={(e) => setPerColor(e.target.value)}
            />
          </Field>
        </div>
        <div className="flex items-center justify-between border-t border-dream-line pt-3">
          <label className="flex items-center gap-2 text-sm text-dream-ink">
            <Switch checked={active} onCheckedChange={setActive} />
            Active
          </label>
          <Button variant="primary" loading={pending} onClick={save}>
            Save
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Add-on charges                                                     */
/* ------------------------------------------------------------------ */

function AddonsTab({ settings }: { settings: AddonSettings }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [bagging, setBagging] = useState(String(settings.baggingPerUnit));
  const [sewnTags, setSewnTags] = useState(String(settings.sewnTagsPerUnit));
  const [spotProcess, setSpotProcess] = useState(String(settings.spotProcessPerUnit));

  function save() {
    start(async () => {
      const res = await updateAddonSettingsAction({
        baggingPerUnit: Number(bagging) || 0,
        sewnTagsPerUnit: Number(sewnTags) || 0,
        spotProcessPerUnit: Number(spotProcess) || 0,
      });
      if (res.error) toast({ title: "Failed", description: res.error, variant: "error" });
      else {
        toast({ title: "Add-on charges saved", variant: "success" });
        router.refresh();
      }
    });
  }

  const fields: { label: string; hint: string; value: string; onChange: (v: string) => void; id: string }[] = [
    { id: "addon-bagging", label: "Individual bagging", hint: "Per garment, when the line is bagged individually.", value: bagging, onChange: setBagging },
    { id: "addon-tags", label: "Sewn-on size tags", hint: "Per garment, when the line has sewn-on tags.", value: sewnTags, onChange: setSewnTags },
    { id: "addon-spot", label: "Spot process", hint: "Per garment, for each print spot marked spot process.", value: spotProcess, onChange: setSpotProcess },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-dream-muted">
        Per-garment charges added to an order when you tick the matching option on a line (bagging, sewn tags, spot
        process). They fold into the order total and the customer&apos;s invoice. The customer&apos;s self-serve quote is
        not affected.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Add-on charges</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-3">
            {fields.map((f) => (
              <Field key={f.id} label={f.label} htmlFor={f.id}>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm text-dream-muted">$</span>
                  <Input
                    id={f.id}
                    type="number"
                    min={0}
                    step="0.01"
                    value={f.value}
                    onChange={(e) => f.onChange(e.target.value)}
                  />
                </div>
                <p className="mt-1 text-xs text-dream-muted">{f.hint}</p>
              </Field>
            ))}
          </div>
          <div className="flex justify-end">
            <Button variant="primary" loading={pending} onClick={save}>
              Save add-on charges
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Checkout                                                           */
/* ------------------------------------------------------------------ */

function CheckoutTab({ settings }: { settings: CheckoutSettings }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<CheckoutSettings>(settings);

  const set = (patch: Partial<CheckoutSettings>) => setDraft((d) => ({ ...d, ...patch }));

  function save() {
    start(async () => {
      const res = await updateCheckoutSettingsAction(draft);
      if (res.error) toast({ title: "Failed", description: res.error, variant: "error" });
      else {
        toast({ title: "Checkout settings saved", variant: "success" });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-dream-muted">
        Controls the copy and options on the customer checkout (delivery + timeline steps). Tax rates are statutory and
        set in code.
      </p>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Delivery</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Shipping note" htmlFor="co-shipping">
              <Input id="co-shipping" value={draft.shippingNote} onChange={(e) => set({ shippingNote: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm text-dream-ink">
              <Switch checked={draft.pickupEnabled} onCheckedChange={(v) => set({ pickupEnabled: v })} />
              Offer in-shop pickup
            </label>
            <Field label="Pickup note" htmlFor="co-pickup">
              <Input
                id="co-pickup"
                value={draft.pickupNote}
                onChange={(e) => set({ pickupNote: e.target.value })}
                disabled={!draft.pickupEnabled}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-dream-ink">
              <Switch checked={draft.rushEnabled} onCheckedChange={(v) => set({ rushEnabled: v })} />
              Offer the rush / ASAP option
            </label>
            <Field label="Standard note" htmlFor="co-standard">
              <Input id="co-standard" value={draft.standardNote} onChange={(e) => set({ standardNote: e.target.value })} />
            </Field>
            <Field label="Rush note" htmlFor="co-rush">
              <Input
                id="co-rush"
                value={draft.rushNote}
                onChange={(e) => set({ rushNote: e.target.value })}
                disabled={!draft.rushEnabled}
              />
            </Field>
            <Field label="Timeline intro" htmlFor="co-timeline">
              <Textarea
                id="co-timeline"
                rows={3}
                value={draft.timelineNote}
                onChange={(e) => set({ timelineNote: e.target.value })}
                disabled={!draft.rushEnabled}
              />
            </Field>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Reassurance footnote</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Field label="Shown under the checkout buttons" htmlFor="co-footnote">
            <Textarea id="co-footnote" rows={2} value={draft.footnote} onChange={(e) => set({ footnote: e.target.value })} />
          </Field>
          <div className="flex justify-end">
            <Button variant="primary" loading={pending} onClick={save}>
              Save checkout settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pickup address                                                     */
/* ------------------------------------------------------------------ */

function PickupAddressCard({ settings }: { settings: BusinessSettings }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [address, setAddress] = useState(settings.pickupAddress);

  function save() {
    start(async () => {
      const res = await updateBusinessSettingsAction({ pickupAddress: address.trim() });
      if (res.error) toast({ title: "Failed", description: res.error, variant: "error" });
      else {
        toast({ title: "Pickup address saved", variant: "success" });
        router.refresh();
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pickup address</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-dream-muted">
          Shown at checkout when a customer chooses to pick up, with an embedded map. Leave blank to keep the exact
          address private until you confirm the order.
        </p>
        <Field label="Shop / pickup address" htmlFor="biz-pickup-address">
          <Textarea
            id="biz-pickup-address"
            rows={3}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="123 Main St, Vancouver, BC V6A 1A1"
          />
        </Field>
        <div className="flex justify-end">
          <Button variant="primary" loading={pending} onClick={save}>
            Save pickup address
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Payments                                                           */
/* ------------------------------------------------------------------ */

function PaymentsTab({ settings }: { settings: PaymentSettings }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<PaymentSettings>(settings);

  const set = (patch: Partial<PaymentSettings>) => setDraft((d) => ({ ...d, ...patch }));
  const live = draft.etransferEnabled && draft.etransferEmail.trim() !== "";

  function save() {
    start(async () => {
      const res = await updatePaymentSettingsAction(draft);
      if (res.error) toast({ title: "Failed", description: res.error, variant: "error" });
      else {
        toast({ title: "Payment settings saved", variant: "success" });
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-dream-muted">
        Card payments run through Stripe and are always on. Interac e-Transfer shows as a second option in the
        customer&rsquo;s payment step once it&rsquo;s enabled and has a recipient email.
      </p>
      <Card className="max-w-xl">
        <CardHeader className="flex-row items-center justify-between gap-3">
          <CardTitle>Interac e-Transfer</CardTitle>
          <Badge variant={live ? "success" : "neutral"}>{live ? "Offered to customers" : "Hidden"}</Badge>
        </CardHeader>
        <CardContent className="space-y-3">
          <label className="flex items-center gap-2 text-sm text-dream-ink">
            <Switch checked={draft.etransferEnabled} onCheckedChange={(v) => set({ etransferEnabled: v })} />
            Accept Interac e-Transfer
          </label>
          <Field label="Send transfers to (email)" htmlFor="pay-et-email">
            <Input
              id="pay-et-email"
              type="email"
              value={draft.etransferEmail}
              onChange={(e) => set({ etransferEmail: e.target.value })}
              placeholder="payments@yourshop.com"
              disabled={!draft.etransferEnabled}
            />
          </Field>
          <Field label="Note shown with the instructions" htmlFor="pay-et-note">
            <Textarea
              id="pay-et-note"
              rows={2}
              value={draft.etransferNote}
              onChange={(e) => set({ etransferNote: e.target.value })}
              placeholder="e.g. Autodeposit is on, so no security question is needed."
              disabled={!draft.etransferEnabled}
            />
          </Field>
          <p className="text-xs text-dream-faint">
            When a customer says they&rsquo;ve sent a transfer, the order shows in the dashboard under
            &ldquo;E-transfers to verify&rdquo;. Check your bank, then confirm it on the order to mark it paid.
          </p>
          <div className="flex justify-end">
            <Button variant="primary" loading={pending} onClick={save}>
              Save payment settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Staff                                                              */
/* ------------------------------------------------------------------ */

function StaffTab({ staff }: { staff: StaffRow[] }) {
  if (staff.length === 0) {
    return <EmptyState title="No staff accounts" description="Staff accounts appear here once added." />;
  }
  return (
    <div className="rounded-xl border border-dream-line bg-dream-surface">
      <Table>
        <THead>
          <TR>
            <TH>Name</TH>
            <TH>Email</TH>
            <TH>Role</TH>
            <TH>Permissions</TH>
          </TR>
        </THead>
        <TBody>
          {staff.map((s) => (
            <TR key={s.id}>
              <TD>
                <span className="font-medium text-dream-ink">{s.name ?? "-"}</span>
              </TD>
              <TD className="text-dream-muted">{s.email ?? "-"}</TD>
              <TD>
                <Badge variant={s.role === "staff_admin" ? "purple" : "info"}>
                  {s.role.replace(/_/g, " ")}
                </Badge>
              </TD>
              <TD className="text-dream-muted">{s.permissionCount}</TD>
            </TR>
          ))}
        </TBody>
      </Table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Email templates                                                    */
/* ------------------------------------------------------------------ */

function EmailTemplatesTab({ templates }: { templates: Record<string, EmailTemplate> }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const keys = Object.keys(templates);

  const [drafts, setDrafts] = useState<EmailTemplateMap>(() => {
    const initial: EmailTemplateMap = {};
    for (const key of keys) {
      initial[key] = {
        subject: templates[key]?.subject ?? "",
        body: templates[key]?.body ?? "",
      };
    }
    return initial;
  });

  if (keys.length === 0) {
    return (
      <EmptyState
        title="No email templates"
        description="Transactional email templates (order confirmation, proof ready, shipped) appear here once configured."
      />
    );
  }

  function update(key: string, field: "subject" | "body", value: string) {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
  }

  function save() {
    start(async () => {
      const res = await updateEmailTemplatesAction({ ...templates, ...drafts });
      if (res.error) toast({ title: "Failed", description: res.error, variant: "error" });
      else {
        toast({ title: "Email template saved", variant: "success" });
        router.refresh();
      }
    });
  }

  function titleFor(key: string) {
    return key
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  return (
    <div className="space-y-6">
      {keys.map((key) => (
        <Card key={key}>
          <CardHeader>
            <CardTitle>{titleFor(key)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Subject" htmlFor={`subject-${key}`}>
              <Input
                id={`subject-${key}`}
                value={drafts[key]?.subject ?? ""}
                onChange={(e) => update(key, "subject", e.target.value)}
              />
            </Field>
            <Field label="Body" htmlFor={`body-${key}`}>
              <Textarea
                id={`body-${key}`}
                rows={6}
                value={drafts[key]?.body ?? ""}
                onChange={(e) => update(key, "body", e.target.value)}
              />
            </Field>
            <div className="flex justify-end">
              <Button variant="primary" loading={pending} onClick={save}>
                Save
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
