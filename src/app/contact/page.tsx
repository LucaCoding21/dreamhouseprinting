"use client";

import { useState, type FormEvent } from "react";
import SiteFooter from "@/components/SiteFooter";
import SiteNav from "@/components/SiteNav";

const inputCls =
  "w-full rounded-2xl border-2 border-dream-ink/80 bg-white px-4 py-3.5 text-base text-dream-ink placeholder:text-dream-ink/40 outline-none transition focus:border-dream-purple focus:ring-4 focus:ring-dream-purple/20 disabled:opacity-60";

export default function ContactPage() {
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", message: "" });

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Something went wrong. Try again?");
        return;
      }
      setSent(true);
      setForm({ name: "", email: "", message: "" });
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

      <section className="mx-auto max-w-[640px] px-6 pb-20 pt-14 lg:pb-28 lg:pt-20">
        <div className="text-center">
          <h1 className="font-display text-[42px] font-bold leading-[1.05] tracking-tight text-dream-ink sm:text-5xl lg:text-[56px]">
            Say{" "}
            <span className="relative inline-block">
              hi
              <ScribbleUnderline className="-bottom-1" />
            </span>
            .
          </h1>
          <p className="mx-auto mt-5 max-w-[460px] text-[15px] leading-relaxed text-dream-ink-soft sm:text-base">
            Got a question, an idea, or just want to chat about a project? Drop a
            note below and we&apos;ll get back to you within a business day.
          </p>
        </div>

        {sent ? (
          <div className="mt-12 rounded-3xl border-2 border-dream-ink bg-white px-7 py-10 text-center shadow-[0_4px_0_0_rgba(27,20,88,0.9)]">
            <h2 className="font-display text-2xl font-bold text-dream-ink sm:text-3xl">
              Got it — thanks!
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed text-dream-ink-soft">
              We&apos;ll be in touch soon. In the meantime, you can keep browsing
              or grab a quick quote.
            </p>
            <button
              type="button"
              onClick={() => setSent(false)}
              className="mt-6 font-display text-sm font-bold uppercase tracking-[0.18em] text-dream-purple underline-offset-4 hover:underline"
            >
              Send another →
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-12 flex flex-col gap-5">
            <Field label="Your name">
              <input
                type="text"
                name="name"
                required
                disabled={submitting}
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
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
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                className={inputCls}
                autoComplete="email"
                inputMode="email"
              />
            </Field>

            <Field label="What&rsquo;s up?">
              <textarea
                name="message"
                required
                disabled={submitting}
                value={form.message}
                onChange={(e) =>
                  setForm((f) => ({ ...f, message: e.target.value }))
                }
                rows={6}
                placeholder="Tell us a bit about what you&rsquo;re thinking…"
                className={`${inputCls} resize-y`}
              />
            </Field>

            {error ? (
              <div className="rounded-2xl border-2 border-red-400/60 bg-red-50 px-4 py-3 text-sm text-red-900">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="mt-3 inline-flex h-14 items-center justify-center rounded-2xl border-2 border-dream-ink bg-white font-display text-lg font-bold text-dream-ink shadow-[0_4px_0_0_rgba(27,20,88,0.9)] transition active:translate-y-[2px] active:shadow-[0_2px_0_0_rgba(27,20,88,0.9)] disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Send it"}
            </button>

            <p className="mt-2 text-center text-[13px] text-dream-ink-soft">
              Or just email us at{" "}
              <a
                href="mailto:hi@dreamhouseprinting.com"
                className="font-semibold text-dream-ink underline-offset-4 hover:underline"
              >
                hi@dreamhouseprinting.com
              </a>
              .
            </p>
          </form>
        )}
      </section>

      <SiteFooter />
    </main>
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
