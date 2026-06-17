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
import {
  updateDecorationMethodAction,
  updateEmailTemplatesAction,
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
}

export function SettingsClient({ decorationMethods, staff, emailTemplates }: SettingsClientProps) {
  return (
    <div>
      <AdminHeader title="Settings" />
      <div className="px-8 py-6">
        <Tabs defaultValue="decoration">
          <TabsList>
            <TabsTrigger value="decoration">Decoration methods</TabsTrigger>
            <TabsTrigger value="staff">Staff</TabsTrigger>
            <TabsTrigger value="email">Email templates</TabsTrigger>
          </TabsList>

          <TabsContent value="decoration" className="mt-4">
            <DecorationMethodsTab methods={decorationMethods} />
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
                <span className="font-medium text-dream-ink">{s.name ?? "—"}</span>
              </TD>
              <TD className="text-dream-muted">{s.email ?? "—"}</TD>
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
