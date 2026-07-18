"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart/CartContext";
import { cn } from "@/lib/cn";
import { formatCAD } from "@/lib/money";
import { PROVINCES } from "@/lib/pricing/tax";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { HelpPrompt } from "@/components/support/HelpPrompt";
import { RushDatePicker } from "@/components/RushDatePicker";
import { placeCartOrdersAction } from "./actions";

export interface CartPrefill {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  street: string;
  city: string;
  province: string;
  postal: string;
}

export function CartClient({ isLoggedIn, prefill }: { isLoggedIn: boolean; prefill: CartPrefill }) {
  const router = useRouter();
  const { items, count, ready, removeItem, clearCart } = useCart();
  const [contact, setContact] = useState<CartPrefill>(prefill);
  const [fulfillment, setFulfillment] = useState<"ship" | "pickup">("ship");
  const [rush, setRush] = useState(false);
  const [neededBy, setNeededBy] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Each item.total is that design's pre-tax price (goods + setup). Rush is a
  // request only — the shop quotes the fee when they confirm the order, so it
  // never changes this estimate.
  const total = items.reduce((s, i) => s + (Number(i.total) || 0), 0);
  const set = (k: keyof CartPrefill, v: string) => setContact((c) => ({ ...c, [k]: v }));

  async function request() {
    setError(null);
    setNotice(null);
    const required: (keyof CartPrefill)[] = ["firstName", "lastName", "email", "phone", "street", "city", "province", "postal"];
    const missing = required.find((k) => !contact[k]?.trim());
    if (missing) {
      setError("Please fill in your name, email, phone and shipping address.");
      return;
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact.email.trim())) {
      setError("Enter a valid email.");
      return;
    }
    if (rush && !neededBy) {
      setError("Please pick the day you need your rush order by.");
      return;
    }

    setBusy(true);
    try {
      const res = await placeCartOrdersAction({
        designIds: items.map((i) => i.designId),
        contact,
        fulfillment,
        turnaround: rush ? "rush" : "standard",
        neededBy: rush ? neededBy : null,
      });
      // Drop every successfully placed design from the cart.
      res.placed.forEach((p) => removeItem(p.designId));
      if (res.placed.length === 0) {
        setError(res.failed[0]?.error ?? "We couldn’t place your request. Please try again.");
        return;
      }
      if (res.failed.length > 0) {
        // Some went through, some didn't. Celebrate the successes and flag the
        // stragglers separately (they stay in the cart to retry).
        const placedNums = res.placed.map((p) => p.orderNumber).filter(Boolean).join(", ");
        setNotice(
          res.placed.length === 1
            ? `Order ${placedNums} is in. We’ll email your proof.`
            : `${res.placed.length} orders placed (${placedNums}). We’ll email your proofs.`
        );
        setError(
          `${res.failed.length} ${res.failed.length === 1 ? "design" : "designs"} couldn’t be sent and ${res.failed.length === 1 ? "is" : "are"} still in your cart. Please try again.`
        );
        return;
      }
      clearCart();
      if (isLoggedIn) {
        router.push("/account/orders");
        return;
      }
      // Guests land on the done page. Carry EVERY placed order (number:token,
      // comma-separated in `orders`) so it can link each to /o/{token}. `order`
      // keeps the first number for backward compatibility.
      const params = new URLSearchParams();
      const first = res.placed[0]?.orderNumber;
      if (first) params.set("order", first);
      const pairs = res.placed
        .filter((p) => p.orderNumber && p.publicToken)
        .map((p) => `${p.orderNumber}:${p.publicToken}`);
      if (pairs.length) params.set("orders", pairs.join(","));
      const qs = params.toString();
      router.push(`/checkout/done${qs ? `?${qs}` : ""}`);
    } catch {
      setError("Something went wrong placing your request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  // Empty cart — warm, on-brand, with the doodle dog.
  if (ready && count === 0) {
    return (
      <main className="mx-auto w-full max-w-2xl px-4 py-20 text-center sm:px-6">
        <Image
          src="/testimonailsplusfooter/dogasset.png"
          alt=""
          width={120}
          height={205}
          className="mx-auto mb-3 h-32 w-auto"
        />
        <h1 className="font-display text-3xl font-extrabold text-dream-ink">Your cart is empty</h1>
        <p className="mx-auto mt-3 max-w-md text-dream-muted">
          Design a shirt, hoodie or hat and it&rsquo;ll show up here, ready to request. No payment now, no pressure.
        </p>
        <Link
          href="/shop"
          className="rough-pill rough-pill-filled mt-7 inline-flex items-center justify-center px-8 py-3.5 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5"
        >
          Browse the shop
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-44 pt-8 sm:px-6 lg:pb-56">
      {/* Back to shop — top-left, where people look to keep browsing */}
      <Link
        href="/shop"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-dream-purple transition-colors hover:text-dream-ink"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M15 18l-6-6 6-6" /></svg>
        Keep designing
      </Link>

      {/* Header */}
      <header className="mt-4">
        <h1 className="font-display text-3xl font-extrabold text-dream-ink sm:text-4xl">Your cart</h1>
        <p className="mt-1.5 text-sm text-dream-muted">
          {count} {count === 1 ? "design" : "designs"} ready to send to the shop.
        </p>
      </header>

      {/* Reassurance strip — three promises, each with its own icon badge so it
          reads as a highlight rather than fine print */}
      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          {
            t: "Free proof first",
            d: "See it before it prints",
            badge: "bg-dream-sun-soft text-dream-ink",
            icon: (
              <>
                <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
                <circle cx="12" cy="12" r="2.6" />
              </>
            ),
          },
          {
            t: "No payment now",
            d: "Pay once you approve",
            badge: "bg-dream-lavender-soft text-dream-purple",
            icon: (
              <>
                <rect x="2.5" y="6" width="19" height="13" rx="2.5" />
                <path d="M2.5 10h19" />
                <path d="M6.5 15h3" />
              </>
            ),
          },
          {
            t: "We tidy your art",
            d: "Our team cleans it up",
            badge: "bg-dream-peach/25 text-dream-peach",
            icon: (
              <>
                <path d="M9.06 11.9l8.07-8.06a2.85 2.85 0 1 1 4.03 4.03l-8.06 8.08" />
                <path d="M7.07 14.94c-1.66 0-3 1.35-3 3.02 0 1.33-2.5 1.52-2 2.02 1.08 1.1 2.49 2.02 4 2.02 2.2 0 4-1.8 4-4.04a3.01 3.01 0 0 0-3-3.02Z" />
              </>
            ),
          },
        ].map((r) => (
          <li
            key={r.t}
            className="flex items-center gap-3 rounded-2xl border border-dream-line bg-white px-4 py-3.5 shadow-[0_1px_0_0_rgba(27,20,88,0.04)]"
          >
            <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-full", r.badge)}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                {r.icon}
              </svg>
            </span>
            <div className="leading-tight">
              <p className="text-sm font-bold text-dream-ink">{r.t}</p>
              <p className="mt-0.5 text-xs text-dream-muted">{r.d}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Left — carted designs. Sticky on desktop so the designs stay in view
            while the taller "Send the proof" form scrolls alongside them. */}
        <section className="flex-1 lg:sticky lg:top-6 lg:self-start">
          <SectionHeading n={1}>Your designs</SectionHeading>

          <div className="mt-4 space-y-3.5">
            {items.map((item) => (
              <div
                key={item.designId}
                className="group flex items-center gap-4 rounded-xl border border-dream-line bg-white p-3.5 transition-transform hover:-translate-y-0.5 sm:p-4"
              >
                {/* Mockup in a white frame */}
                <span className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dream-line bg-white">
                  {item.mockupUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.mockupUrl} alt="" className="h-full w-full object-contain p-1.5" />
                  ) : (
                    <span className="text-xs text-dream-faint">No preview</span>
                  )}
                </span>

                <div className="flex min-w-0 flex-1 items-stretch justify-between gap-3 self-stretch">
                  {/* Left: name + colour · quantity, pinned to the top */}
                  <div className="flex min-w-0 flex-col justify-start gap-1">
                    <p className="truncate font-display text-base font-bold text-dream-ink sm:text-lg">{item.productName}</p>
                    <p className="truncate text-sm text-dream-muted">{item.colourSummary}</p>
                  </div>
                  {/* Right: actions pinned top, price pinned bottom */}
                  <div className="flex shrink-0 flex-col items-end justify-between gap-2">
                    <div className="flex items-center gap-3 text-xs font-semibold">
                      {item.productId && (
                        <Link
                          href={`/design/${item.productId}?design=${item.designId}`}
                          className="inline-flex items-center gap-1 text-dream-purple transition-colors hover:text-dream-ink"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                          Edit
                        </Link>
                      )}
                      {item.productId && <span aria-hidden className="h-3 w-px bg-dream-line-strong" />}
                      <button
                        type="button"
                        onClick={() => removeItem(item.designId)}
                        className="inline-flex items-center gap-1 text-dream-faint transition-colors hover:text-dream-danger"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                        Remove
                      </button>
                    </div>
                    <span className="font-display text-lg font-extrabold text-dream-purple">{formatCAD(item.total)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Right — contact + request, sticky on desktop */}
        <aside className="w-full lg:sticky lg:top-6 lg:w-[440px] lg:shrink-0">
          <div className="overflow-hidden rounded-xl border border-dream-line-strong bg-white shadow-[0_2px_0_0_rgba(27,20,88,0.06)]">
            {/* Lavender header strip */}
            <div className="border-b border-dream-line-strong bg-dream-lavender-soft px-5 py-4 sm:px-6">
              <SectionHeading n={2}>Send the proof</SectionHeading>
              <p className="mt-1.5 text-sm text-dream-ink-soft">
                We&rsquo;ll email your proof here and ship once you approve it.
              </p>
            </div>

            <div className="px-5 py-5 sm:px-6">
              {/* Your contact */}
              <p className="text-xs font-bold uppercase tracking-[0.04em] text-dream-purple">Your contact</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="First name" htmlFor="c-first" required>
                  <Input id="c-first" value={contact.firstName} onChange={(e) => set("firstName", e.target.value)} />
                </Field>
                <Field label="Last name" htmlFor="c-last" required>
                  <Input id="c-last" value={contact.lastName} onChange={(e) => set("lastName", e.target.value)} />
                </Field>
                <Field label="Email" htmlFor="c-email" required className="col-span-2">
                  <Input id="c-email" type="email" value={contact.email} onChange={(e) => set("email", e.target.value)} placeholder="you@email.com" />
                </Field>
                <Field label="Phone" htmlFor="c-phone" required className="col-span-2">
                  <Input id="c-phone" value={contact.phone} onChange={(e) => set("phone", e.target.value)} placeholder="(555) 555-5555" />
                </Field>
              </div>

              {/* Fulfillment — segmented Ship / Pickup */}
              <p className="mt-6 text-xs font-bold uppercase tracking-[0.04em] text-dream-purple">How you&rsquo;ll get it</p>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl bg-dream-cream p-1">
                <ToggleSeg active={fulfillment === "ship"} onClick={() => setFulfillment("ship")}>Ship to me</ToggleSeg>
                <ToggleSeg active={fulfillment === "pickup"} onClick={() => setFulfillment("pickup")}>Pick up</ToggleSeg>
              </div>

              {/* Address */}
              <div className="mt-3 grid grid-cols-2 gap-3">
                <Field label="Street address" htmlFor="c-street" required className="col-span-2">
                  <Input id="c-street" value={contact.street} onChange={(e) => set("street", e.target.value)} />
                </Field>
                <Field label="City" htmlFor="c-city" required>
                  <Input id="c-city" value={contact.city} onChange={(e) => set("city", e.target.value)} />
                </Field>
                <Field label="Province" htmlFor="c-prov" required>
                  <Select id="c-prov" value={contact.province} onChange={(e) => set("province", e.target.value)}>
                    <option value="">Select…</option>
                    {PROVINCES.map((p) => (
                      <option key={p.code} value={p.code}>{p.code}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Postal code" htmlFor="c-postal" required className="col-span-2">
                  <Input id="c-postal" value={contact.postal} onChange={(e) => set("postal", e.target.value)} placeholder="A1A 1A1" />
                </Field>
              </div>
              {fulfillment === "pickup" && (
                <p className="mt-2 text-xs text-dream-faint">
                  We still need an address on file for your order. You&rsquo;ll grab it at the shop.
                </p>
              )}

              {/* Rush toggle — a clear selectable card so the on/off state reads at a glance */}
              <label
                className={cn(
                  "mt-5 flex cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3.5 transition-colors",
                  rush
                    ? "border-dream-purple bg-dream-lavender-mist"
                    : "border-dream-line bg-white hover:border-dream-purple/50 hover:bg-dream-lavender-mist/40",
                )}
              >
                <input
                  type="checkbox"
                  checked={rush}
                  onChange={(e) => {
                    setRush(e.target.checked);
                    if (!e.target.checked) setNeededBy(null);
                  }}
                  className="sr-only"
                />
                {/* Custom check indicator — fills in when selected */}
                <span
                  aria-hidden
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
                    rush ? "border-dream-purple bg-dream-purple text-white" : "border-dream-line-strong bg-white",
                  )}
                >
                  {rush && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </span>
                <span className="flex-1">
                  <span className="font-display text-sm font-bold text-dream-ink">Request a rush</span>
                  <span className="mt-0.5 block text-xs text-dream-muted">
                    Bump to the front of the queue. We&rsquo;ll discuss any additional fee when we confirm your order.
                  </span>
                </span>
              </label>

              {rush && (
                <div className="mt-3 rounded-xl border border-dream-purple/30 bg-dream-lavender-mist/50 p-4">
                  <p className="text-sm font-semibold text-dream-ink">What day do you need it in hand?</p>
                  <p className="mt-0.5 text-xs text-dream-muted">Pick your target date so we can confirm whether we can hit it.</p>
                  <div className="mt-3">
                    <RushDatePicker value={neededBy} autoOpen onChange={setNeededBy} />
                  </div>
                </div>
              )}

              {/* Estimate */}
              <div className="mt-5 flex items-start justify-between gap-3 border-t border-dream-line pt-4">
                <div>
                  <span className="text-xs font-bold uppercase tracking-[0.04em] text-dream-purple">Estimated total</span>
                  <p className="mt-1 text-xs text-dream-faint">Taxes &amp; final pricing land on your proof.</p>
                </div>
                <span className="rounded-xl bg-dream-sun px-3 py-1.5 font-display text-xl font-extrabold text-dream-ink shadow-[0_3px_0_0_rgba(27,20,88,0.18)]">
                  {formatCAD(total)}
                </span>
              </div>

              {notice && <p className="mt-3 rounded-xl bg-dream-success-soft px-3 py-2 text-sm text-dream-success">{notice}</p>}
              {error && <p className="mt-3 rounded-xl bg-dream-danger-soft px-3 py-2 text-sm text-dream-danger">{error}</p>}

              <button
                onClick={request}
                disabled={busy || count === 0}
                className="rough-pill rough-pill-filled mt-4 flex w-full items-center justify-center px-6 py-3.5 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
              >
                {busy ? "Sending…" : `Request ${count === 1 ? "this design" : "these designs"}`}
              </button>
              <p className="mt-3 text-center text-xs leading-relaxed text-dream-faint">
                No payment now. Our team reviews &amp; cleans up your artwork, then emails a proof to approve.
              </p>
            </div>
          </div>

          <HelpPrompt variant="inline" title="Questions before you send?" className="mt-5" />
        </aside>
      </div>
    </main>
  );
}

/** Numbered step heading — a purple circle badge + Archivo label. */
function SectionHeading({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2.5 font-display text-lg font-extrabold text-dream-ink">
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-dream-purple text-sm font-bold text-white">
        {n}
      </span>
      {children}
    </h2>
  );
}

/** One half of the Ship / Pickup segmented control. */
function ToggleSeg({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-lg bg-white px-3 py-2 text-sm font-bold text-dream-ink shadow-[0_2px_0_0_rgba(27,20,88,0.12)]"
          : "rounded-lg px-3 py-2 text-sm font-semibold text-dream-muted transition-colors hover:text-dream-ink"
      }
    >
      {children}
    </button>
  );
}

function PencilIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6" />
    </svg>
  );
}
