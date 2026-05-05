"use client";

import Link from "next/link";
import { useState, type CSSProperties, type FormEvent } from "react";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

const TOPICS = [
  { value: "general", label: "General question" },
  { value: "quote", label: "Quote follow-up" },
  { value: "custom", label: "Custom / partnership" },
  { value: "press", label: "Press & other" },
] as const;

type Topic = (typeof TOPICS)[number]["value"];

const inputCls =
  "w-full rounded-2xl border border-dream-ink/15 bg-white px-4 py-3.5 text-base text-dream-ink placeholder:text-dream-ink/40 outline-none transition hover:border-dream-ink/40 focus:border-dream-purple focus:ring-4 focus:ring-dream-purple/20 disabled:opacity-60";

// 12 sun rays around the submit button — same recipe used elsewhere on the site.
const SUBMIT_RAYS = Array.from({ length: 12 }, (_, i) => {
  const angle = i * 30;
  const rad = (angle * Math.PI) / 180;
  const rx = 132;
  const ry = 56;
  const lenJitter = [20, 16, 18, 15, 20, 14, 18, 16, 19, 15, 17, 16][i];
  const angleJitter = [-3, 4, -2, 5, -4, 2, -3, 4, -5, 3, -2, 4][i];
  return {
    x: +(Math.cos(rad) * rx).toFixed(1),
    y: +(Math.sin(rad) * ry).toFixed(1),
    r: angle + angleJitter,
    len: lenJitter,
    delay: +(((i * 83) % 450) / 1000).toFixed(2),
  };
});

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [topic, setTopic] = useState<Topic>("general");
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const topicLabel =
        TOPICS.find((t) => t.value === topic)?.label ?? "General question";
      const messageWithTopic = `[${topicLabel}]\n\n${form.message}`;
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, message: messageWithTopic }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Something went wrong. Try again?");
        return;
      }
      setSent(true);
      setForm({ name: "", email: "", message: "" });
      setTopic("general");
    } catch {
      setError("Couldn't reach the server. Check your connection and retry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-dream-cream">
      <div className="bg-dream-lavender-soft">
        <SiteNav />
      </div>

      {/* Rough-edge filter for sun rays — local copy so this page is self-contained. */}
      <RoughEdgeFilter />

      <Hero />

      <section className="relative bg-dream-cream pb-24 pt-20 lg:pb-32 lg:pt-28">
        <svg
          aria-hidden="true"
          preserveAspectRatio="xMidYMid"
          className="pointer-events-none absolute inset-x-0 top-0 z-10 block h-[28px] w-full"
        >
          <defs>
            <pattern
              id="contact-hero-scallop"
              width="120"
              height="28"
              patternUnits="userSpaceOnUse"
            >
              <ellipse cx="60" cy="0" rx="60" ry="28" fill="#e0dffe" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#contact-hero-scallop)" />
        </svg>

        <div className="mx-auto grid max-w-[1280px] gap-10 px-6 lg:grid-cols-[1.4fr_1fr] lg:gap-14 lg:px-10">
          {/* Form column */}
          <div className="rough-card relative px-6 py-8 sm:px-10 sm:py-10">
            {sent ? (
              <SentState onReset={() => setSent(false)} />
            ) : (
              <form onSubmit={onSubmit} className="flex flex-col gap-6">
                <div>
                  <h2 className="font-display text-[28px] font-bold leading-tight text-dream-ink sm:text-[32px]">
                    Drop us a line.
                  </h2>
                  <p className="mt-2 text-[14px] text-dream-ink-soft sm:text-[15px]">
                    We read every message and get back within a business day.
                  </p>
                </div>

                <Field label="What's this about?">
                  <div className="flex flex-wrap gap-2">
                    {TOPICS.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => setTopic(t.value)}
                        disabled={submitting}
                        className={`rounded-full px-4 py-2 font-display text-[13px] font-semibold transition disabled:opacity-60 ${
                          topic === t.value
                            ? "bg-dream-purple text-white"
                            : "border border-dream-ink/15 bg-white text-dream-ink hover:border-dream-ink/40"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </Field>

                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Your name">
                    <input
                      type="text"
                      name="name"
                      required
                      disabled={submitting}
                      value={form.name}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, name: e.target.value }))
                      }
                      placeholder="What should we call you?"
                      className={inputCls}
                      autoComplete="name"
                    />
                  </Field>

                  <Field label="Email">
                    <input
                      type="email"
                      name="email"
                      required
                      disabled={submitting}
                      value={form.email}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, email: e.target.value }))
                      }
                      placeholder="you@example.com"
                      className={inputCls}
                      autoComplete="email"
                      inputMode="email"
                    />
                  </Field>
                </div>

                <Field label="Message">
                  <textarea
                    name="message"
                    required
                    disabled={submitting}
                    value={form.message}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, message: e.target.value }))
                    }
                    rows={6}
                    maxLength={1000}
                    placeholder="Tell us a bit about what you're thinking…"
                    className={`${inputCls} resize-none`}
                  />
                  <span className="mt-1.5 block text-right text-[12px] text-dream-ink-soft">
                    {form.message.length}/1000
                  </span>
                </Field>

                {error ? (
                  <div className="rounded-2xl border-2 border-red-400/60 bg-red-50 px-4 py-3 text-sm text-red-900">
                    {error}
                  </div>
                ) : null}

                <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                  <div
                    className="sun-burst relative inline-block self-start"
                    style={{ "--ray-color": "#ecbb25" } as CSSProperties}
                  >
                    {SUBMIT_RAYS.map((ray, i) => (
                      <span
                        key={i}
                        aria-hidden
                        className="sun-ray"
                        style={
                          {
                            "--x": `${ray.x}px`,
                            "--y": `${ray.y}px`,
                            "--r": `${ray.r}deg`,
                            "--delay": `${ray.delay}s`,
                            width: `${ray.len}px`,
                          } as CSSProperties
                        }
                      />
                    ))}
                    <button
                      type="submit"
                      disabled={submitting}
                      className="rough-pill rough-pill-filled rough-pill-lean relative inline-flex items-center justify-center px-9 py-4 font-display text-base font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-60"
                    >
                      {submitting ? "Sending…" : "Send message"}
                    </button>
                  </div>

                  <p className="text-[13px] text-dream-ink-soft">
                    Or just email{" "}
                    <a
                      href="mailto:hello@dreamhouseprinting.ca"
                      className="font-semibold text-dream-ink underline-offset-4 hover:underline"
                    >
                      hello@dreamhouseprinting.ca
                    </a>
                  </p>
                </div>
              </form>
            )}
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-5">
            <ContactCard
              kicker="Email"
              heading="hello@dreamhouseprinting.ca"
              href="mailto:hello@dreamhouseprinting.ca"
              hint="Best for design files, mockups, and back-and-forth."
              icon={<EmailIcon />}
            />
            <ContactCard
              kicker="Call or text"
              heading="(604) 555-1234"
              href="tel:16045551234"
              hint="Mon–Fri, 9am–5pm PT."
              icon={<PhoneIcon />}
            />
            <ContactCard
              kicker="Visit the workshop"
              heading="123 Main St, Vancouver"
              hint="By appointment. Drop us a note before stopping by."
              icon={<PinIcon />}
            />

            <div className="rounded-[28px] bg-dream-sun px-7 py-7 text-dream-ink">
              <span className="font-display text-xs font-bold uppercase tracking-[0.12em] text-black">
                Already know what you want?
              </span>
              <h3 className="mt-3 font-display text-[24px] font-bold leading-tight text-black sm:text-[26px]">
                Skip the chat. Get a real quote.
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-dream-ink/70">
                Five quick questions about your job and Julian comes back with
                pricing within a business day.
              </p>
              <Link
                href="/quote"
                className="mt-5 inline-flex items-center justify-center rounded-full bg-white px-6 py-3 font-display text-[14px] font-bold text-dream-ink shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition active:translate-y-[2px] active:shadow-[0_2px_0_0_rgba(27,20,88,0.9)]"
              >
                Start a quote →
              </Link>
            </div>
          </aside>
        </div>
      </section>

      <BeforeYouWrite />

      <SiteFooter />
    </main>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Hero
// ────────────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section className="relative bg-dream-lavender-soft">
      <div className="mx-auto flex max-w-[820px] flex-col items-center px-6 pb-24 pt-16 text-center lg:px-10 lg:pb-32 lg:pt-24">
        <h1 className="font-display text-[60px] font-semibold leading-[1.05] tracking-tight text-black sm:text-[76px] lg:text-[96px]">
          Let&apos;s{" "}
          <span className="relative inline-block">
            talk
            <ScribbleUnderline className="-bottom-1 lg:-bottom-2" />
          </span>
          .
        </h1>
        <p className="mt-6 max-w-[560px] text-[15px] leading-relaxed text-dream-ink-soft sm:text-base">
          Got a question, an idea, or just want to chat about a project? Pick
          the way that works for you, whether that&apos;s the form, email, or
          a quick call.
        </p>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Before-you-write — small set of pointers so people don't write blind
// ────────────────────────────────────────────────────────────────────────────

function BeforeYouWrite() {
  const items = [
    {
      n: "01",
      title: "Tell us roughly what you want",
      body: "Tees, hoodies, hats, totes (and how many). A ballpark is fine.",
    },
    {
      n: "02",
      title: "Share artwork if you have it",
      body: "Vector (.ai .eps .pdf) or 300dpi .png is ideal. A sketch works too.",
    },
    {
      n: "03",
      title: "Mention your deadline",
      body: "Standard turnaround is 7–10 days. Need it sooner? Let us know.",
    },
  ];

  return (
    <section className="relative pb-24 pt-20 lg:pb-32 lg:pt-28">
      <div className="relative mx-auto max-w-[1280px] px-6 lg:px-10">
        <div className="text-center">
          <span className="font-display text-xs font-bold uppercase tracking-[0.12em] text-dream-purple">
            Before you write
          </span>
          <h2 className="mt-4 font-display text-[40px] font-bold leading-[1.02] tracking-tight text-dream-ink sm:text-[52px]">
            Three things that speed it up.
          </h2>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-3 sm:gap-6">
          {items.map((item) => (
            <div key={item.n} className="rough-card relative px-7 py-7">
              <span className="font-display text-[13px] font-bold text-dream-purple">
                {item.n}
              </span>
              <h3 className="mt-2 font-display text-[20px] font-bold leading-tight text-dream-ink">
                {item.title}
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-dream-ink-soft sm:text-[15px]">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Bits
// ────────────────────────────────────────────────────────────────────────────

function ContactCard({
  kicker,
  heading,
  href,
  hint,
  icon,
}: {
  kicker: string;
  heading: string;
  href?: string;
  hint: string;
  icon: React.ReactNode;
}) {
  const inner = (
    <div className="flex items-start gap-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-dream-lavender-soft text-dream-purple">
        {icon}
      </span>
      <div className="min-w-0">
        <span className="font-display text-[11px] font-bold uppercase tracking-[0.14em] text-dream-purple">
          {kicker}
        </span>
        <p className="mt-1 break-words font-display text-[18px] font-bold leading-tight text-dream-ink">
          {heading}
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-dream-ink-soft">
          {hint}
        </p>
      </div>
    </div>
  );

  const baseCls =
    "block rounded-[24px] border-2 border-dream-ink bg-white px-6 py-6 shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition active:translate-y-[2px] active:shadow-[0_2px_0_0_rgba(27,20,88,0.9)]";

  return href ? (
    <a href={href} className={`${baseCls} hover:-translate-y-0.5`}>
      {inner}
    </a>
  ) : (
    <div className={baseCls}>{inner}</div>
  );
}

function SentState({ onReset }: { onReset: () => void }) {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-dream-sun text-dream-ink">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-6 w-6"
          aria-hidden="true"
        >
          <path d="M5 12.5 L10 17.5 L19.5 7" />
        </svg>
      </div>
      <h2 className="mt-5 font-display text-[28px] font-bold leading-tight text-dream-ink sm:text-[32px]">
        Got it, thanks!
      </h2>
      <p className="mx-auto mt-3 max-w-[420px] text-[15px] leading-relaxed text-dream-ink-soft">
        We&apos;ll be in touch soon. In the meantime, you can keep browsing or
        grab a quick quote.
      </p>
      <div className="mt-7 flex flex-wrap items-center justify-center gap-4">
        <Link
          href="/quote"
          className="rough-pill rough-pill-filled inline-flex items-center justify-center px-7 py-3.5 font-display text-[15px] font-bold text-white transition-transform hover:-translate-y-0.5"
        >
          Start a quote
        </Link>
        <button
          type="button"
          onClick={onReset}
          className="font-display text-sm font-bold uppercase tracking-[0.18em] text-dream-purple underline-offset-4 hover:underline"
        >
          Send another →
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-dream-ink">
        {label}
      </span>
      {children}
    </label>
  );
}

function ScribbleUnderline({ className = "" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 220 12"
      preserveAspectRatio="none"
      className={`absolute left-0 right-0 h-[12px] w-full ${className}`}
    >
      <path
        d="M4 7 C 20 3, 40 9, 60 6 S 100 3, 120 7 S 160 4, 184 7 S 210 8, 216 6"
        stroke="#ecbb25"
        strokeWidth="4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

function RoughEdgeFilter() {
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute h-0 w-0">
      <defs>
        <filter id="rough-edges" x="-5%" y="-30%" width="110%" height="160%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.04"
            numOctaves="2"
            seed="3"
          />
          <feDisplacementMap in="SourceGraphic" scale="3" />
        </filter>
      </defs>
    </svg>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Icons
// ────────────────────────────────────────────────────────────────────────────

function EmailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M5 4h3.5l1.6 4-2 1.4a12 12 0 0 0 6.5 6.5l1.4-2 4 1.6V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}
