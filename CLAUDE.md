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
- **Lite client-side cart + designer review polish (2026-06-29):** the designer review screen's "Begin checkout" is now **"Add to cart"**. A lite cart (`src/lib/cart/CartContext.tsx`, localStorage `dh_cart_v1`, mounted in root `layout.tsx`) holds saved-design *summaries* (designId + product name + colour summary + qty + total + mockup data-URL). Nav gets a `CartNavButton` (sketch tote icon + count badge + dropdown). `/cart` (`page.tsx` server prefill + `CartClient.tsx`) lists items, collects contact/address once, and **"Request these" places one Order per carted design** via `src/app/cart/actions.ts` → loops the existing `saveContactAction` + `placeOrderAction` (so N designs = N orders = N Julian emails — intentional for lite; the declined "full cart" was the single-combined-order version). `saveDesign("cart", …)` in `DesignerClient` replaces the old `"checkout"` destination. **Review column also reworked**: decoration spec relabels its colour count by method (embroidery → "Thread colours", else "Ink colours"), per-colourway pricing spelled out (`N pieces × $unit = $total`), estimate shown as a lavender card, tighter vertical spacing, "Name your design" dialog re-spaced.

- **Forgot-password flow + portal polish (2026-07-01):** built self-serve password reset — `Forgot password?` link on `/login` → `/forgot-password` (`requestPasswordResetAction` → `resetPasswordForEmail`, redirectTo `…/auth/confirm?next=/reset-password`) → `/auth/confirm/route.ts` (handles **both** `token_hash`+`type` via `verifyOtp` AND `code` via `exchangeCodeForSession`, robust to whichever the email template uses) → `/reset-password` (guards on `getUser()`; shows "link expired" if no recovery session, else `updateUser({password})`). All new auth actions live in `src/app/login/actions.ts` (`AuthResult` adds `done`). **Not testable in dev** — see pre-launch item. Also: shared `Dialog` backdrop is now transparent (dark tint + blur removed, per Julian); `/checkout/done` made a flex-column so the footer pins flush (was leaking `bg-dream-bg` below it) + copy shortened; `AuthShell` clouds repositioned and page locked to `h-dvh` (non-scrollable); cart reassurance strip + item rows + `CartNavButton` dropdown restyled; designer review stepper recoloured off heavy purple (ink done / sun-yellow current). **Demo data:** `scripts/seed-demo-orders.mjs` seeds a spread of orders (proof_ready → completed, with proofs/line items/pricing/tracking) for `customer@dreamhouse.test` so the portal looks populated; idempotent via `sales_rep='seed-demo'`, `--clean` removes them, touches no real orders. Note raised, unresolved: the lite cart fans out to one-order-per-design, so a single multi-design checkout shows as several separate tracker cards — revisit whether the portal should group orders from the same checkout.

- **Admin redesign + order lifecycle completion (2026-07-03):** the admin is now the lean 6-screen layout (Dashboard / Orders / order detail / Products / Customers / Settings) and the full submit→proof→approve→invoice→pay→ship flow works end-to-end (browser-QA'd incl. a real Stripe sandbox payment).
  - **Order detail** (`src/app/admin/orders/[id]/` — split into `OrderTimeline/OrderContactCards/OrderItemsSection/OrderItemCard/DecorationSpotRow/ProductionNotes/OrderRail` + `shared.ts`) is one dense Printavo-style scrolling page: yellow admin comment timeline on top, 3 editable address cards, per-item horizontal size-run + print-spec rows (method, W×H, #colours, Pantone chips, puff/spot-process) stored in `line_items.decorations`, per-item AND order-level proof upload (`proofs.line_item_id`), detailed/compact toggle, Calc-tax button (`calcTax`), Customer/Inventory/Printer notes (`orders.production_notes`), sticky rail with click-to-advance status pipeline, payment card (**Send invoice**), tracking input (`setTrackingAction` — finally writes `shipping_tracking`), copy-public-link.
  - **Public order page `/o/[token]`** (`orders.public_token`, migration 0009): no-login view for guests + customers. It reuses the portal's order view — extracted to `src/components/orders/OrderView.tsx` (+ `ProofPanel`, `InvoicePanel`, serializer `src/lib/orders/orderView.ts`), rendered by both `/account/orders/[id]` and `/o/[token]`. Token-authorized actions in `src/app/o/[token]/actions.ts` (approve / request changes / pay).
  - **Stripe (sandbox)**: `Send invoice` mints a hosted Checkout session (`ensureCheckoutSession` in `src/lib/orders/payments.ts` — reuses open sessions, re-mints on amount drift so price edits can't undercharge), customer pays via **Pay now** on the order page, `/api/stripe/webhook` (sig-verified) + reconcile-on-return both call idempotent `markOrderPaid` (guarded UPDATE on `paid_at is null`). Dev webhooks: `stripe listen --forward-to localhost:<devport>/api/stripe/webhook` → put the printed `whsec_…` in `STRIPE_WEBHOOK_SECRET`. Keys in `.env.local` are **William's personal sandbox** — swap for Julian's real keys + a dashboard webhook endpoint before launch. `NEXT_PUBLIC_APP_URL` must match the dev port or Stripe redirects/email links point at the wrong origin.
  - **notify.ts rework**: guests now get emails (`guest_email` fallback — was silently skipped before); every customer email appends the `/o/{token}` link in code; new templates `invoice_sent` / `payment_received` (in settings → email templates); `notifyJulian()` fires on proof approval, change requests, and payment received.
  - **Deleted**: `/admin/{proofs,production,quotes,reports}` routes (functions folded into the action-queue dashboard + orders-list filters; quote convert lives in `src/app/admin/quote-actions.ts`, CSV export API route kept). Orders list gained a Payment column and honours `?tab=` deep links from the dashboard queues.

- **Five tickets + order emails (2026-07-04, all browser-QA'd):**
  - **Rush fee is real now** — `src/lib/pricing/rush.ts` (`rushFee` = 50% of subtotal+setup, `RUSH_RATE`), applied when `turnaround === "rush"`: cart estimate updates live, checkout summaries/review show a "Rush (+50%)" row, `placeOrderAction` stores `pricing.rush` + includes it in the tax base and total (Stripe follows `pricing.total` automatically), admin Pricing card has an editable Rush field preserved by `syncOrderPricing`. Verified: $278.50 job → $417.75 + BC tax = $467.88.
  - **Guest save-design email + account claiming** — guest `saveDraftAction` (first save only) sends `sendDesignSavedEmail` (notify.ts) with a cross-device resume link `/design/resume/[designId]?t=<guest_token>` (route sets `dh_guest` cookie on exact token match, else → /shop). `src/lib/claim.ts` `claimGuestRecords(userId, email)` attaches guest orders (`guest_email`) + designs (`lead_email` + same-browser `guest_token`) to the account; runs on sign-in, sign-up (**only if `email_confirmed_at`** — hijack guard for when autoconfirm goes off), `/auth/confirm`, and lazily in `/account` layout. Verified: guest design+order → register same email → both appear in the new portal.
  - **Portal order view shows the mockup only on the designed colourway** — serializer attaches per-line-item `mockup` (match `designs.colour.name` to `li.colour.name`, fallback = first line item per design); other colourways render a colour-swatch placeholder. `firstMockup` prop removed.
  - **Admin S&S import UX** — friendly error copy (`friendlySsError`), dialog guidance line, Live/Hidden badges on the products list, and a 4-step setup-checklist banner (category / pricing / print area / Active, with anchors) on unconfigured products → "Live in shop" chip when done.
  - **Designer out-of-bounds warning** — `artOutsidePrintArea()` wired through `onCanvasChange` into per-view `outOfBounds: Set<View>`; amber `pointer-events-none` pill on the canvas + per-location badge and aggregate note on review. Never blocks ordering. Recomputes on colour swap/scene load (`setCoords()` guard added).
  - **Order placement finally emails** — `placeOrderAction` fires `sendOrderStatusEmail(id, "submitted")` (customer order confirmation) + `notifyJulian("New order …")`. Was: silent orders that only appeared if Julian polled /admin.
  - Dev artifacts from QA: orders DH-2026-0015/0016, account `nguyen.william0121+claimtest@gmail.com` (pw dreamhouse123!), inactive Softstyle 64000 draft product — delete or keep as fixtures.

### Pick up from here

1. Read this file + `BUILD_PLAN.md` (phase checklist) + the `project_platform_build` / `project_supabase_mcp_mismatch` / `reference_ss_activewear` memories.
2. **P0 + P1 brand pass and the admin/lifecycle redesign are done** (see above, browser-verified). **Remaining P2 / PRD work**: Organizations / team accounts (§6 — entity exists; needs member-management UI + shared artwork/brand kit, selectable in the designer); saved-artwork-on-file reuse in the designer + "My Designs" (§5.5); text curve/arch + clip-art library; admin category CRUD; bulk-tier quote pricing; art-issue flags on proofs. Open UX questions: an "invoiced/unpaid" tab on the orders list (dashboard queues currently deep-link those to the `production` tab), deposit (partial-payment) invoices, grouping multi-design checkouts in the portal.
3. **Mobile** on the rewarmed surfaces + the new admin/order pages is responsive-classes-only, NOT visually confirmed (Chrome MCP `resize_window` gotcha). Verify on a real narrow viewport.
4. **Before launch**: swap Stripe sandbox keys for Julian's live keys, create a production webhook endpoint (dashboard → put its secret in `STRIPE_WEBHOOK_SECRET`), set `NEXT_PUBLIC_APP_URL` + `NEXT_PUBLIC_SUPABASE_*` + Stripe vars in Vercel; turn OFF `mailer_autoconfirm` + wire Resend SMTP; confirm a real notification email delivers; forgot-password email-leg config (Supabase Auth → Redirect URLs + Reset Password template → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`); review RLS with `get_advisors`; clear the 4 pre-existing marketing-component lint errors; test accounts (`julian@dreamhouse.test` staff_admin / `customer@dreamhouse.test`, pw `dreamhouse123`) are dev-only; clear demo orders with `node --env-file=.env.local scripts/seed-demo-orders.mjs --clean`.
5. Dev server port is **whichever Next picks** — the user often already has this repo running on :3000; check before starting another (`lsof -i :3000`), and keep `NEXT_PUBLIC_APP_URL` in `.env.local` pointed at the live port. Don't auto-open Chrome unless diagnosing.
