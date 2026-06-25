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
| `SUPABASE_ANON_KEY`         | Server-side anon key, kept for future use                   |
| `NEXT_PUBLIC_SUPABASE_URL`  | Browser-exposed project URL — direct-to-Storage artwork uploads |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser-exposed anon key (public by design). **Must be set in Vercel** or uploads fail |
| `RESEND_API_KEY`            | From resend.com                                             |
| `JULIAN_NOTIFY_EMAIL`       | Primary recipient for new quote requests                    |
| `NOTIFY_CC_EMAILS`          | Extra recipients, comma-separated. Added to the `to` list   |
| `RESEND_FROM_EMAIL`         | Verified sender (dev: `onboarding@resend.dev`)              |

**Graceful degradation:** if Supabase or Resend env vars are missing, the API route logs to console and still returns 200. The form flow works locally even without credentials.

## Supabase

**Project ref:** `vnymgxztalayouvxxuzl`
**SQL editor:** https://supabase.com/dashboard/project/vnymgxztalayouvxxuzl/sql/new

### Storage

- Private bucket: `quote-files` (25MB file-size limit, no mime restriction)
- **Files upload straight from the browser**, not through `/api/submit`. `POST /api/upload-url` mints short-lived signed upload URLs (service role); the browser PUTs each file to Supabase via `uploadToSignedUrl` (anon client). This bypasses Vercel's 4.5MB serverless request-body limit, which used to 413 any sizeable artwork.
- Files are stored at `{uploadId}/artwork/{i}-{filename}` and `{uploadId}/price-match/{...}`, where `uploadId` is a per-submission UUID minted by `/api/upload-url` (no longer the submission row id, since the row doesn't exist yet at upload time).
- `/api/submit` now takes **small JSON** ( `{ payload, estimate, artwork:[{name,path}], priceMatch:[...] }` ), generates 30-day signed download URLs per path, and stores `{name, path, url}` in the row's `artwork_files` / `price_match_files` jsonb columns (path kept so you can re-sign later).

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

**The full platform from `prd.md` is now built (2026-06-16) — see `BUILD_PLAN.md` for the phased checklist.** The legacy quick-quote form (`QuoteCard.tsx` + `submissions` table + `/api/submit`) is untouched and still on the home page; the platform lives alongside it.

Platform architecture (new this build):
- **Data model** — all PRD §9 entities in `supabase/migrations/0001-0004` (products, categories, decoration_methods, print_areas, designs, orders, line_items, proofs, order_activity, quotes, profiles, organizations, settings) + RLS + seed. Migrations apply via `node --env-file=.env.local scripts/db-push.mjs` (Management API — **the Supabase MCP points to a DIFFERENT project; never write through it**). Generated DB types in `src/lib/db/types.ts`.
- **Auth** — Supabase Auth via `@supabase/ssr`. Clients in `src/lib/supabase/{client,server,service}.ts`; session refresh in `src/proxy.ts`; role/permission guards in `src/lib/auth.ts` (`requireUser/requireStaff/requirePermission`). Profiles auto-created by a DB trigger. Auth project is set to `mailer_autoconfirm` for now (revisit before launch).
- **S&S Activewear** — `src/lib/ss/*` (Canadian endpoint `api-ca.ssactivewear.com/v2`, CDN images CORS-`*`). Admin imports a style → Product, configures Admin-owned fields, re-syncs S&S-owned fields.
- **Surfaces** — Storefront (`/shop` §3.3 wireframe + `/shop/[id]`), Designer (`/design/[productId]`, Fabric.js, print-area overlay, live price, submit→Order+mockup), Customer portal (`/account/*`: dashboard, orders + animated dog tracker, proof approve/request-changes, designs, account editing, reorder, help), Admin (`/admin/*`: dashboard, orders list+detail with status control/proof/notes/pricing/payment/activity, proofs queue, production kanban, products + S&S import + print-area editor, quotes, customers CRM, reports + CSV, settings).
- **Pricing** `src/lib/pricing/platform.ts` (wholesale+markup+decoration+bulk). **Notifications** `src/lib/notify.ts` (Resend, fired on status change, gated by prefs, templated from settings). **UI primitives** `src/components/ui/*` (20 components, SaaS look using `dream-*` tokens incl. new app-surface tokens). Order status→tracker mapping `src/lib/orderStatus.ts`.
- **Browser-QA'd end-to-end**: imported B+C 3001 (79 colours), configured+published, /shop→detail→designer→Order DH-2026-0001→admin status control→proof→customer approval→production move→tracker, plus dashboard/settings/customers/reports. Build + lint green (only 4 pre-existing marketing-component lint errors remain). Work on branch `feat/platform-build` (committed per phase, **not pushed**).

**Brand-cohesion pass (2026-06-17):** customer surfaces rewarmed from the generic SaaS look to match the playful home page (cream/lavender grounds, Archivo headings, `rough-pill` CTAs, sun-yellow price tags, the doodle dog). Admin kept clean. Notable:
- **Shop uses the normal `SiteNav`** (per Julian) — not a bespoke storefront nav. The old `StorefrontNav.tsx` was deleted; catalog search moved into the shop hero (`ShopSearch.tsx`). Added a **Shop All** entry to `SiteNav` `NAV_LINKS`. Dead `/cart` link removed (no cart concept — quote/design flow).
- **Catalog seeded** via `node --env-file=.env.local scripts/seed-catalog.mjs` (idempotent, mirrors `transform.ts` + the products insert; `--dry` resolves only). 14 real S&S styles across 4 categories, featured-per-category, each with a default front print area + active. Yupoong 6245CM / Liberty 8860 aren't on the CA endpoint → substituted YP Classics 6245PT + extra Q-Tees bags.
- **Designer print-area drift fixed (two bugs):** the Fabric canvas now sizes to the garment image's aspect ratio (no letterbox; normalized 0..1 coords map 1:1) AND the print rect is anchored `originX/Y:"left"/"top"` (Fabric v7 defaults to center → was offset by half its size). Admin `PrintAreaEditor` matches via `aspectRatio` on the frame. WYSIWYG admin↔designer verified across colour/view swaps. Designer also restyled (zoom+undo, scrollable swatches, dog mascot, empty/loading, mobile-stack).
- **Designer page redesigned (2026-06-24)** to match Julian's comp: full `SiteNav` + green price-match banner on top (was a bespoke minimal header), a left **vertical icon rail** (Back-to-product house + Upload/Text/Clipart tool selectors using the SVGs in `public/designer/`), a persistent "Current product + colour" card, a "Design tools" panel that swaps by selected tool (upload dropzone / add-text / built-in clip-art tray), and a right rail with big estimate, size grid, **ink-colour 1–4 chips**, print-location chips, and a **Rush delivery toggle (+50%, flat surcharge on the whole job, recorded in `priceSnapshot.rush`)**. Undo **and** redo now. Clip-art is a small inline-SVG starter set (`CLIPART` in `DesignerClient.tsx`) — the full clip-art library is still future work.
- **Designer center is now multi-canvas (2026-06-24):** every decorated view (front + back …) renders as its own Fabric canvas **side by side, all editable at once** — the Front/Back *toggle* is gone. State is keyed by view: `canvasRefs`/`histories`/`futures` maps, an `activeView` (tool target, set by clicking a canvas or the left "Adding to" pills / right print-location chips), and per-view undo/redo. Colour swaps reload every canvas's garment but keep its art. `finalize()` now exports **one mockup per decorated view** (clears the old "active view only" limitation). Colour swatches are a tidy `grid-cols-6` with an inset ring + check. The page is no longer a locked viewport: the editor is one `h-dvh` "app screen", and a **full-width shirt-details section (`ProductDetails`) + `SiteFooter`** sit below it in normal flow (scroll down to reach them). `description` + `stock_status` now flow from `page.tsx`.
- **Order tracker** now animates the brand doodle dog (`/how it works/3dog.png`) trotting/hopping along the track carrying the bag (`dog-trot`/`dog-cheer` keyframes in globals.css), replacing the static 🐕 emoji.

### Pick up from here

1. Read this file + `BUILD_PLAN.md` (phase checklist) + the `project_platform_build` / `project_supabase_mcp_mismatch` / `reference_ss_activewear` memories.
2. **P0 + P1 brand pass is done** (storefront/designer/portal warmed + abundant catalog + alignment fixed, all browser-verified). **Remaining P2 / PRD work**: Organizations / team accounts (§6 — entity exists; needs member-management UI + shared artwork/brand kit, selectable in the designer); saved-artwork-on-file reuse in the designer + "My Designs" (§5.5); text curve/arch + clip-art library; admin category CRUD; bulk-tier quote pricing; art-issue flags on proofs.
3. **Mobile** on the rewarmed surfaces is via responsive Tailwind classes (`flex-col lg:flex-row` + `order-*`, SiteNav hamburger) but was NOT visually confirmed — the Chrome MCP `resize_window` doesn't shrink this 1920-wide window (known gotcha). Verify on a real narrow viewport.
4. **Before launch**: turn OFF `mailer_autoconfirm` + wire Resend SMTP for email verification; confirm a real notification email delivers; set `NEXT_PUBLIC_SUPABASE_*` in Vercel; review RLS with `get_advisors`; clear the 4 pre-existing marketing-component lint errors; the Resend sender + test accounts (`julian@dreamhouse.test` staff_admin / `customer@dreamhouse.test`, pw `dreamhouse123`) are dev-only.
5. Dev server runs on **:3001** (3000 is an unrelated app). Don't auto-open Chrome unless diagnosing.
