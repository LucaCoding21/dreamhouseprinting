# Dreamhouse Printing — Claude Context

This is the context file Claude Code auto-loads for this project. Read it before making changes.

## What this is

A quote-request web app for **Julian's custom print shop**. Customers fill out a 5-step form for shirts/hoodies/hats/etc., Julian gets an email with all the details, and he quotes them manually. It replaces the DM/text chaos he had before.

**This is not the end state.** The quote form is Phase 1. Future phases will layer on more features — treat it as the starting point of a real product, not a one-off form.

## Stack

- **Next.js 16** (App Router, TypeScript, Turbopack) — `src/app`
- **Tailwind v4** — palette defined in `src/app/globals.css` via `@theme` block, all tokens prefixed `dream-` (e.g. `bg-dream-lavender`, `text-dream-ink`)
- **Archivo** for display (headings, buttons), **Inter** for body — loaded via `next/font/google` in `src/app/layout.tsx`
- **Supabase** for Postgres + Storage (submissions + file uploads)
- **Resend** for the notification email to Julian

No state manager, no form library. `useState` is plenty for 5 steps — don't reach for react-hook-form / formik / zustand unless a real need appears.

## Commands

```bash
npm run dev     # Next dev server, http://localhost:3000
npm run build   # production build + TypeScript check — run this before claiming done
npm run lint    # eslint
npm run setup   # provisions Supabase: creates quote-files bucket, verifies submissions table
```

There's no test suite yet. When you add functionality, verify by running `npm run build` (catches type errors) and by driving the UI in a browser.

## Project layout

```
src/
  app/
    api/submit/route.ts   # POST — parses multipart, saves to Supabase, emails via Resend
    layout.tsx            # fonts + body bg
    page.tsx              # home page — renders <QuoteCard /> (no separate /quote route)
    globals.css           # Tailwind + dream-* palette
  components/
    QuoteCard.tsx         # the whole quote flow: price calculator → multi-step form → submit
    pricing.ts (in lib/)  # real per-unit prices + quantity-break tables
  lib/
    formTypes.ts          # shared types + option lists (PRODUCT_OPTIONS, PRINT_LOCATIONS, etc.)
    pricing.ts            # calculateQuote() + roundDisplayPrice() — see file header
    supabase.ts           # lazy server-side client, returns null if env vars missing
public/
  dreamhouse-logo.svg     # the "Solo Logo" — house character, tinted via fill="#7664ff"
scripts/
  setup-supabase.mjs      # idempotent: makes bucket, prints SQL if table missing
```

### Why the quote flow is one file (`QuoteCard.tsx`)

The price calculator and the multi-step request form are one client component with two phases (`"calc"` → `"form"`). Locking in a price swaps the same card from calculator to form, carrying the picks across; the `Step*` field components are co-located as siblings below the parent. Keeping it all in one file makes the prop-drilling obvious and the flow readable top-to-bottom. There is **no `/quote` route** — this card on the home page (`#quick-quote` anchor) owns the entire flow. `/quote` 301-redirects to `/#quick-quote` (see `next.config.ts`). If a step grows past ~150 lines, split it then — not before.

## Environment

All secrets in `.env.local` (gitignored). Template in `.env.example`.

| Var                         | Purpose                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `SUPABASE_URL`              | Project URL — the Dreamhouse project is `vnymgxztalayouvxxuzl` |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only. Used by API route + setup script               |
| `SUPABASE_ANON_KEY`         | Not currently used, kept for future client-side features    |
| `RESEND_API_KEY`            | From resend.com                                             |
| `JULIAN_NOTIFY_EMAIL`       | Primary recipient for new quote requests                    |
| `NOTIFY_CC_EMAILS`          | Extra recipients, comma-separated. Added to the `to` list   |
| `RESEND_FROM_EMAIL`         | Verified sender (dev: `onboarding@resend.dev`)              |

**Graceful degradation:** if Supabase or Resend env vars are missing, the API route logs to console and still returns 200. The form flow works locally even without credentials.

## Supabase

**Project ref:** `vnymgxztalayouvxxuzl`
**SQL editor:** https://supabase.com/dashboard/project/vnymgxztalayouvxxuzl/sql/new

### Storage

- Private bucket: `quote-files`
- Files are stored at `{submission_id}/artwork/{timestamp}-{filename}` and `{submission_id}/price-match/{...}`
- The API route generates 30-day signed URLs and stores them in the row's `artwork_files` / `price_match_files` jsonb columns (+ includes the raw path so you can re-sign later)

### Schema — source of truth

```sql
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  name text not null,
  email text not null,
  phone text not null,
  referral_code text,

  product_type text not null,
  garment_brand text,                  -- 'gildan' | 'bella-canvas' | 'comfort-colors' | 'no-preference'
  garment_color text not null,
  sizes jsonb,                         -- { S: "10", M: "15", ... } — null means user chose "sizes later"
  quantity integer,                    -- either sum(sizes) or the "sizes later" total

  print_colors text not null,
  print_locations text[] not null default '{}',
  print_method text not null,

  design_description text,
  needed_by date,
  notes text,
  price_match_link text,               -- URL pasted in the "paste link" tab (nullable)

  heard_about text,                    -- marketing attribution ("how did you find us")
  estimated_per_unit numeric,          -- per-item price shown to customer (CR -10%, rounded up)
  estimated_total numeric,             -- estimated_per_unit * quantity
  quote_estimate jsonb,                -- full snapshot: product, decoration, colors, locations, qty

  artwork_files jsonb not null default '[]'::jsonb,
  price_match_files jsonb not null default '[]'::jsonb
);

alter table public.submissions enable row level security;
-- No policies = anon/authenticated denied. Service role bypasses RLS.

create index if not exists submissions_created_at_idx
  on public.submissions (created_at desc);
```

**Keep this SQL in sync with `scripts/setup-supabase.mjs` (`TABLE_SQL` constant) and the `submissions` insert in `src/app/api/submit/route.ts`.** If you add a column to any of those three, add it to the other two.

### Running DDL

The `@supabase/supabase-js` SDK can't run DDL (PostgREST limitation). To alter the schema:

1. **If the Supabase MCP is connected in this session**, use it directly — it wraps the Management API
2. **Otherwise**, paste SQL into the dashboard SQL editor (link above), then re-run `npm run setup` to verify

## Resend

- Production sender is `dreamhouseprinting@cloverfield.studio` — the `cloverfield.studio` domain is verified in Resend
- Fallback `onboarding@resend.dev` only delivers to the email address that owns the Resend account — use only if the verified sender is unavailable
- `replyTo` is set to the customer's email so Julian can reply straight from his inbox

## Conventions

- **Tailwind palette** — use the `dream-*` tokens (`bg-dream-lavender`, `text-dream-ink`, etc.), defined in `globals.css`. Don't introduce raw hex values outside `@theme`.
- **Fonts** — `font-display` (Archivo) for headings and big buttons, default sans (Inter) for body
- **Buttons** — the "raised" look with `shadow-[0_4px_0_0_rgba(27,20,88,0.9)]` + `active:translate-y-[2px]` is a brand element; reuse it for primary CTAs
- **Validation** — per-step via the `stepErrors` useMemo; errors are only shown after the user tries to advance (`touchedNext` flag)
- **File uploads** — 25MB per file cap (enforced client-side + bucket-level)
- **No emojis in code** unless matching an existing UI element (the wireframe has `:)` which we kept as ASCII)
- **Don't add libraries speculatively.** This is a young project; a new dependency should solve a real problem, not a hypothetical one.

## Working style

- **Don't auto-open Chrome to "verify" UI edits.** The user watches the dev server themselves and will say if something's off. Make the edit, say what changed, stop. Only open Chrome when the user asks you to, or when diagnosing a runtime bug that needs it.
- **Prefer editing `.env.local` over hardcoding** — never commit secrets.
- **When Julian's requirements are ambiguous**, default to the wireframe in the project brief and ask rather than guess. The source of truth lives in the user's head.
- **Commit messages** — short, imperative, present tense. No AI self-attribution unless the user's git config already uses a Co-Authored-By trailer.

## Known gotchas

- **Next.js 16 Turbopack** picks the wrong workspace root if there's a `package-lock.json` at a parent directory. `next.config.ts` sets `turbopack.root` to silence the warning.
- **Tailwind v4** uses `@theme` in CSS, not `tailwind.config.js`. Don't create a config file.
- **API route uploads** use `runtime = "nodejs"` so multipart bodies work; the Edge runtime would break file uploads.
- **Window resize via the Chrome MCP** doesn't always stick — the underlying browser sometimes enforces a minimum width. Use JS (`window.innerWidth`) to confirm, and drive forms with JS helpers rather than coordinate clicks for anything complex.

## Session handoff — update this in place

The two sections below are the only "what's happening right now" state. **Edit them in place at the end of every session** where meaningful work shipped. Do NOT append — overwrite. Keep each section short; if you find yourself writing more than a screenful, you're logging history that belongs in git commit messages, not here.

No separate dev log file exists on purpose. Historical "why did we do it this way" belongs in:
- **Git commit messages** for what changed and why (use `git log` / `git blame` to find it)
- **Code comments** for non-obvious invariants at the point of use
- **This CLAUDE.md** for rules and conventions that apply project-wide

### Current status

- ✅ Next.js + Tailwind scaffolded
- ✅ 5-step form built, validated, visually matches wireframe
- ✅ `/api/submit` wired to Supabase Storage + Resend
- ✅ Storage bucket `quote-files` created
- ✅ `submissions` table provisioned via Supabase MCP (2026-04-10 session)
- ✅ Resend sender set to `dreamhouseprinting@cloverfield.studio` (cloverfield.studio domain verified)
- ✅ Quote emails CC'd to `william@cloverfield.studio` via `NOTIFY_CC_EMAILS` env var
- ✅ Size breakdown (S–3XL with "sizes later" escape hatch); total quantity auto-derives. Columns: `garment_brand text`, `sizes jsonb`.
- ✅ Price match has a **tab toggle**: "Paste link" or "Upload file". Link stored in `price_match_link`.
- ✅ **Real pricing in `lib/pricing.ts`** (2026-05-28). Final customer prices (Coastal Reign −10%, markup baked in — no multiplier), quantity-break tables from `our_pricing.csv` for **all 6 SKUs**: tee (ATC1000), hoodie (Gildan 18500 — note: replaced the old ATC fleece), crewneck (Gildan 18000), tote (Q-Tees), toque (SP12), dad-cap (6245CM). Decoration derived from product (apparel/tote=screen, headwear=embroidery). Per-item display rounds **UP** to nearest $ (`roundDisplayPrice`). Add-ons (extra locations, names/numbers, 2XL+) in `our_pricing_addons.csv` **not yet wired** into `calculateQuote`. Only "other" + the form's generic "hats" can't be priced.
- ✅ **Quote flow merged into one home-page card** (2026-05-28). Killed the separate `/quote` page and the standalone purple section; `QuoteCard.tsx` does calculator → form in place ("Lock in this price" swaps phases, picks carry over; **Back** on step 0 returns to the calculator). Calculator exposes Shirt/Hoodie/Crewneck/Tote/Toque/Dad Cap/Other. Sticky **yellow** bottom bar shows live price + product context + Back/Next (no top banner). All `/quote` links repointed to `/#quick-quote` (category links pass `?product=` to preselect); `/quote` 301-redirects; sitemap entries removed.
- ⏳ No real end-to-end submission driven through the browser yet against the live table + verified sender.
- 🐛 **Known gap:** `?product=` preselect only fires on mount, so clicking a category link (footer/ShopByCategories) **while already on the home page** scrolls to the card but doesn't switch the product. Works fine navigating in from other pages.

### Pick up from here

What the next Claude should do first when starting a new session — keep this to ~5 bullets, replace with whatever is actually most pressing:

1. Read this file (you're here)
2. Ask the user what they want to work on — don't assume
3. Smoke test the merged card: calc → lock in → form steps → submit; confirm a row lands in `public.submissions` and emails arrive at `JULIAN_NOTIFY_EMAIL` + `NOTIFY_CC_EMAILS`
4. If wanted: fix the on-home `?product=` preselect gap, or wire the add-on pricing (locations/names/numbers) into the form quote
5. Phase 2 candidates: admin dashboard, order-status tracking, Irish's character illustrations when the Figma drops
