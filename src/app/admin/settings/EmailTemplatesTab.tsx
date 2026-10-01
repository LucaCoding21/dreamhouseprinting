"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Select } from "@/components/ui/Select";
import { Field } from "@/components/ui/Field";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/cn";
import {
  EMAIL_CONFIG,
  TEMPLATE_GUIDE,
  interpolate,
  renderOrderEmailHtml,
  unknownVariables,
  variablesFor,
} from "@/lib/email/orderEmail";
import { updateEmailTemplatesAction, type EmailTemplateMap } from "./actions";

/** Real values for the preview where we have them, from the settings page. */
export interface EmailPreviewContext {
  pickupLocation: string;
  etransferEmail: string;
  businessAddress: string | null;
}

/** Customer journey order, so the list reads like the life of an order. */
const ORDER = [
  "order_confirmation",
  "proof_ready",
  "changes_requested",
  "invoice_sent",
  "etransfer_reported",
  "payment_received",
  "in_production",
  "shipped",
  "ready_for_pickup",
];

function titleFor(key: string) {
  return TEMPLATE_GUIDE[key]?.title ?? key.replace(/[_-]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Edit the customer order emails with a live preview. The preview runs the
 * exact renderer the real send uses (lib/email/orderEmail.ts), filled with
 * sample values, so what the admin sees is what the customer gets.
 */
export function EmailTemplatesTab({
  templates,
  preview,
}: {
  templates: Record<string, { subject: string; body: string }>;
  preview: EmailPreviewContext;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();

  const keys = useMemo(
    () => Object.keys(templates).sort((a, b) => (ORDER.indexOf(a) + 1 || 99) - (ORDER.indexOf(b) + 1 || 99)),
    [templates],
  );
  const [active, setActive] = useState(keys[0] ?? "");
  const [drafts, setDrafts] = useState<EmailTemplateMap>(() =>
    Object.fromEntries(
      keys.map((k) => [k, { subject: templates[k]?.subject ?? "", body: templates[k]?.body ?? "" }]),
    ),
  );

  // Where a clicked variable gets inserted: the last field the admin was in,
  // at the cursor. Defaults to the end of the body.
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastField = useRef<"subject" | "body">("body");

  if (keys.length === 0) {
    return (
      <EmptyState
        title="No email templates"
        description="Transactional email templates (order confirmation, proof ready, shipped) appear here once configured."
      />
    );
  }

  const isDirty = (k: string) =>
    drafts[k]?.subject !== (templates[k]?.subject ?? "") || drafts[k]?.body !== (templates[k]?.body ?? "");
  const anyDirty = keys.some(isDirty);

  const draft = drafts[active] ?? { subject: "", body: "" };
  const guide = TEMPLATE_GUIDE[active];
  const vars = variablesFor(active);
  const unknown = unknownVariables(`${draft.subject}\n${draft.body}`, active);

  function update(field: "subject" | "body", value: string) {
    setDrafts((prev) => ({ ...prev, [active]: { ...prev[active], [field]: value } }));
  }

  function insertVariable(name: string) {
    const token = `{{${name}}}`;
    const field = lastField.current;
    const el = field === "subject" ? subjectRef.current : bodyRef.current;
    const value = draft[field];
    const startPos = el?.selectionStart ?? value.length;
    const endPos = el?.selectionEnd ?? value.length;
    update(field, value.slice(0, startPos) + token + value.slice(endPos));
    // Put the cursor back right after the inserted variable.
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const caret = startPos + token.length;
      el.setSelectionRange(caret, caret);
    });
  }

  function save() {
    start(async () => {
      const res = await updateEmailTemplatesAction({ ...templates, ...drafts });
      if (res.error) toast({ title: "Failed", description: res.error, variant: "error" });
      else {
        toast({ title: "Email templates saved", variant: "success" });
        router.refresh();
      }
    });
  }

  // Sample values: the real setting where there is one, made-up otherwise.
  const sampleVars: Record<string, string> = Object.fromEntries(vars.map((v) => [v.name, v.sample]));
  sampleVars.pickupLocation = preview.pickupLocation || sampleVars.pickupLocation;
  if (preview.etransferEmail) sampleVars.etransferEmail = preview.etransferEmail;

  const cfg = EMAIL_CONFIG[active] ?? { cta: "View your order" };
  const heading = interpolate(draft.subject, sampleVars);
  const html = renderOrderEmailHtml({
    heading,
    bodyText: interpolate(draft.body, sampleVars),
    orderLink: sampleVars.orderLink,
    ctaLabel: cfg.cta,
    amount: cfg.amountLabel ? { label: cfg.amountLabel, value: sampleVars.totalDue } : null,
    businessAddress: preview.businessAddress,
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      {/* Template picker: a list on desktop, a dropdown on phones. */}
      <div className="lg:hidden">
        <Select value={active} onChange={(e) => setActive(e.target.value)} aria-label="Email template">
          {keys.map((k) => (
            <option key={k} value={k}>
              {titleFor(k)}
              {isDirty(k) ? " (unsaved)" : ""}
            </option>
          ))}
        </Select>
      </div>
      <nav className="hidden flex-col gap-1 lg:flex" aria-label="Email templates">
        {keys.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setActive(k)}
            className={cn(
              "flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
              k === active ? "bg-dream-lavender-soft font-semibold text-dream-purple" : "text-dream-ink hover:bg-white",
            )}
          >
            {titleFor(k)}
            {isDirty(k) && <span className="h-2 w-2 shrink-0 rounded-full bg-dream-sun" aria-label="Unsaved changes" />}
          </button>
        ))}
      </nav>

      <div className="grid min-w-0 gap-6 xl:grid-cols-2">
        {/* Editor */}
        <Card className="min-w-0">
          <CardContent className="space-y-5 p-5">
            <div>
              <h2 className="font-display text-lg font-bold text-dream-ink">{titleFor(active)}</h2>
              {guide && <p className="mt-1 text-sm text-dream-muted">{guide.when}</p>}
            </div>

            <Field
              label="Subject"
              htmlFor="tpl-subject"
              hint="Also used as the big heading at the top of the email."
            >
              <Input
                id="tpl-subject"
                ref={subjectRef}
                value={draft.subject}
                onFocus={() => (lastField.current = "subject")}
                onChange={(e) => update("subject", e.target.value)}
              />
            </Field>

            <Field label="Message" htmlFor="tpl-body" hint="Leave a blank line to start a new paragraph.">
              <Textarea
                id="tpl-body"
                ref={bodyRef}
                rows={8}
                value={draft.body}
                onFocus={() => (lastField.current = "body")}
                onChange={(e) => update("body", e.target.value)}
              />
            </Field>

            {unknown.length > 0 && (
              <p className="rounded-lg bg-dream-warn-soft px-3 py-2 text-sm text-dream-ink">
                {unknown.map((u) => `{{${u}}}`).join(", ")} {unknown.length === 1 ? "isn't a variable" : "aren't variables"}{" "}
                this email knows, so {unknown.length === 1 ? "it" : "they"} would send blank. Check the spelling against
                the list below.
              </p>
            )}

            <div>
              <h3 className="text-sm font-semibold text-dream-ink">Variables you can use</h3>
              <p className="mt-0.5 text-sm text-dream-muted">
                Click one to add it where your cursor is. It gets swapped for the real value when the email sends.
              </p>
              <ul className="mt-3 space-y-2">
                {vars.map((v) => (
                  <li key={v.name} className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3">
                    <button
                      type="button"
                      // Keep focus (and the cursor position) in the field.
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => insertVariable(v.name)}
                      className="shrink-0 self-start rounded-md border border-dream-line bg-dream-bg px-2 py-1 font-mono text-xs text-dream-purple transition-colors hover:border-dream-purple"
                    >
                      {`{{${v.name}}}`}
                    </button>
                    <span className="text-sm text-dream-muted">{v.description}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-sm text-dream-muted">
              Added automatically, you don&apos;t need to write them: the &ldquo;{cfg.cta}&rdquo; button
              {cfg.amountLabel ? `, the "${cfg.amountLabel}" box` : ""}, and the footer.
              {active === "proof_ready" || active === "invoice_sent"
                ? " Any message you typed when sending also shows up in its own box."
                : ""}
            </p>

            <div className="flex justify-end">
              <Button variant="primary" loading={pending} onClick={save} disabled={!anyDirty} className="w-full sm:w-auto">
                Save changes
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-dream-ink">Preview</h3>
            <span className="text-xs text-dream-muted">Sample customer and order</span>
          </div>
          <div className="overflow-hidden rounded-xl border border-dream-line bg-white">
            <div className="border-b border-dream-line px-4 py-3 text-sm">
              <span className="text-dream-muted">Subject: </span>
              <span className="font-semibold text-dream-ink">{heading || "(no subject)"}</span>
            </div>
            <iframe
              title={`${titleFor(active)} email preview`}
              srcDoc={html}
              sandbox=""
              className="block h-[640px] w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
