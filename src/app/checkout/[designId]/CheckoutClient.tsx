"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import SiteFooter from "@/components/SiteFooter";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { isProvinceCode, PROVINCES } from "@/lib/pricing/tax";
import { OrderSummary, type CheckoutSummary } from "./OrderSummary";
import type { CheckoutContact } from "./context";
import { saveContactAction } from "./actions";

const STEPS = ["Details", "Shipping", "Submit"];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const POSTAL_RE = /^[A-Za-z]\d[A-Za-z][ ]?\d[A-Za-z]\d$/;

export function CheckoutClient({
  designId,
  summary,
  contact,
  footnote,
}: {
  designId: string;
  summary: CheckoutSummary;
  contact: CheckoutContact;
  footnote: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<CheckoutContact>(contact);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);

  const set = (k: keyof CheckoutContact) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const province = isProvinceCode(form.province) ? form.province : null;

  const errors = useMemo(() => {
    const e: Partial<Record<keyof CheckoutContact, string>> = {};
    if (!form.firstName.trim()) e.firstName = "Required";
    if (!form.lastName.trim()) e.lastName = "Required";
    if (!EMAIL_RE.test(form.email.trim())) e.email = "Enter a valid email";
    if (!form.phone.trim()) e.phone = "Required";
    if (!form.street.trim()) e.street = "Required";
    if (!form.city.trim()) e.city = "Required";
    if (!isProvinceCode(form.province)) e.province = "Select a province";
    if (!POSTAL_RE.test(form.postal.trim())) e.postal = "e.g. V6B 1A1";
    return e;
  }, [form]);

  async function onContinue() {
    setTouched(true);
    setError(null);
    if (Object.keys(errors).length > 0) {
      setError("Please fix the highlighted fields.");
      return;
    }
    setBusy(true);
    try {
      const res = await saveContactAction({
        designId,
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        company: form.company.trim(),
        street: form.street.trim(),
        city: form.city.trim(),
        province: form.province,
        postal: form.postal.trim(),
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      router.push(`/checkout/${designId}/shipping`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  const err = (k: keyof CheckoutContact) => (touched ? errors[k] : undefined);

  return (
    <div className="min-h-dvh bg-dream-bg text-dream-ink">
      <SiteNav />

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        <CheckoutHeader current={0} backHref="/account/designs" backLabel="Back to designs" />

        <div className="flex flex-col-reverse gap-8 lg:flex-row lg:items-start">
          {/* Left, contact + shipping address form */}
          <div className="flex-1">
            <section className="rounded-2xl border border-dream-line bg-white p-6">
              <h2 className="font-display text-lg font-bold">Contact information</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="First name" htmlFor="firstName" required error={err("firstName")}>
                  <Input id="firstName" value={form.firstName} onChange={set("firstName")} aria-invalid={!!err("firstName")} autoComplete="given-name" />
                </Field>
                <Field label="Last name" htmlFor="lastName" required error={err("lastName")}>
                  <Input id="lastName" value={form.lastName} onChange={set("lastName")} aria-invalid={!!err("lastName")} autoComplete="family-name" />
                </Field>
                <Field label="Email" htmlFor="email" required error={err("email")} className="sm:col-span-2">
                  <Input id="email" type="email" value={form.email} onChange={set("email")} aria-invalid={!!err("email")} autoComplete="email" />
                </Field>
                <Field label="Phone" htmlFor="phone" required error={err("phone")}>
                  <Input id="phone" type="tel" value={form.phone} onChange={set("phone")} aria-invalid={!!err("phone")} autoComplete="tel" />
                </Field>
                <Field label="Company" htmlFor="company" hint="Optional">
                  <Input id="company" value={form.company} onChange={set("company")} autoComplete="organization" />
                </Field>
              </div>
            </section>

            <section className="mt-6 rounded-2xl border border-dream-line bg-white p-6">
              <h2 className="font-display text-lg font-bold">Shipping address</h2>
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Street address" htmlFor="street" required error={err("street")} className="sm:col-span-2">
                  <Input id="street" value={form.street} onChange={set("street")} aria-invalid={!!err("street")} autoComplete="address-line1" placeholder="123 Main St, Unit 4" />
                </Field>
                <Field label="City" htmlFor="city" required error={err("city")}>
                  <Input id="city" value={form.city} onChange={set("city")} aria-invalid={!!err("city")} autoComplete="address-level2" />
                </Field>
                <Field label="Province" htmlFor="province" required error={err("province")}>
                  <Select id="province" value={form.province} onChange={set("province")} aria-invalid={!!err("province")} autoComplete="address-level1">
                    <option value="">Select…</option>
                    {PROVINCES.map((p) => (
                      <option key={p.code} value={p.code}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Postal code" htmlFor="postal" required error={err("postal")} className="sm:col-span-2">
                  <Input id="postal" value={form.postal} onChange={set("postal")} aria-invalid={!!err("postal")} autoComplete="postal-code" placeholder="V6B 1A1" className="sm:max-w-[12rem]" />
                </Field>
              </div>
            </section>

            {error && <p className="mt-4 rounded-xl bg-dream-danger-soft px-4 py-3 text-sm text-dream-danger">{error}</p>}

            <button
              onClick={onContinue}
              disabled={busy}
              className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-dream-purple px-6 py-3.5 font-display text-base font-bold text-white shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition-transform active:translate-y-[2px] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-10"
            >
              {busy ? "Saving…" : "Continue to shipping options"}
            </button>
            <p className="mt-3 text-[14px] text-dream-faint">{footnote}</p>
          </div>

          {/* Right, order summary (sticky, Stripe-style) */}
          <aside className="w-full lg:w-[360px] lg:shrink-0">
            <OrderSummary summary={summary} province={province} />
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

/** Step header shared by both checkout steps. */
export function CheckoutHeader({
  current,
  backHref,
  backLabel,
}: {
  current: number;
  backHref: string;
  backLabel: string;
}) {
  return (
    <div className="mb-8">
      <Link href={backHref} className="text-sm font-medium text-dream-muted transition-colors hover:text-dream-ink">
        ← {backLabel}
      </Link>
      <h1 className="mt-3 font-display text-3xl font-extrabold tracking-tight">Checkout</h1>
      <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full text-[14px] font-bold",
                i <= current ? "bg-dream-purple text-white" : "bg-dream-line text-dream-muted"
              )}
            >
              {i + 1}
            </span>
            <span className={cn("font-medium", i <= current ? "text-dream-ink" : "text-dream-faint")}>{s}</span>
            {i < STEPS.length - 1 && <span className="mx-1 text-dream-faint">·</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}
