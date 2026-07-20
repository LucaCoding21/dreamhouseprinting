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

- **Pricing unified on the customer curve (2026-07-08):** `products.pricing_rules.quote` (Julian's CR−10% quantity-break table) is now THE price on every surface. Shop card + price sorting use `shopPrice()` in `lib/pricing/quote.ts` ("as low as" = cheapest tier; curve-less products fall back to "from" garment retail); designer/cart/order snapshot now price via `priceFromCurve` (was the uncalibrated `calcPrice` cost-plus — qty 1 tee was $9.88 instead of $66.25, embroidery nearly free). Curve prices are all-inclusive → `setupTotal` is $0 on curve-priced jobs (checkout/portal setup rows already hide at 0); quantity breaks apply to the COMBINED qty across colourways; the "add N more" nudge reads the curve's next break (`nextCurveBreak`). `lib/pricing/platform.ts` demoted to fallback + admin cost/margin info (`startingAtPrice` deleted). Designer method picker only offers methods the curve prices (screen/embroidery) so DTG/vinyl can't fall through to near-free cost-plus. Admin product editor: "Customer pricing" card primary (always visible, plain-language `InfoTip` tooltips, warning when tier-less), "Copy pricing from" another priced product with a blank-cost-gap hint (`getCurveSources` in admin/queries), markup relabeled fallback-only under "Cost and margin"; setup checklist step 2 = has price tiers; admin products list shows a "No pricing" badge. **Data:** Sponge Fleece hoodie stamped hoodies curve +$40.56/unit and Softstyle tee t-shirts curve +$0.98/unit (blank-cost diff × 2 markup) — **Julian should review both**. Note: seeded family curves are shared across products with different blank costs (e.g. Jersey Tee vs Heavy Cotton) — tune per product in the editor when it matters.

- **Real print specs + scene-payload fix (2026-07-07, browser-QA'd):** the review "What we're printing" table now shows a real **Measurement** (W″×H″ of the placed art) and a real **colour count** (replacing the hardcoded `inkColours = 1`), each with a "?" disclaimer dialog (artist-reviews-everything copy, Coastal Reign style). Every print-box outline in the designer AND admin editor is labelled with its name + inch dims.
  - **Geometry model** (`src/lib/design/printArea.ts`): `maxWidthIn×maxHeightIn` is the physical truth; the admin-drawn normalized `position` is a placement *envelope*. All surfaces render the **effective box** = largest inch-aspect-true rect centered inside the envelope → uniform px-per-inch, so measurements can't distort. Computed at render time from the live garment-image aspect (admin ↔ designer ↔ review always agree). Seed `PRINT_AREA` recalibrated for the 500×625 (0.8) S&S images and applied to the dev DB.
  - **Colour counting** (`src/lib/design/colourCount.ts`, all client-side): SVG source parse + PDF operator-list scan (pdfjs) = exact; rasters = quantized estimate, photographic/continuous-tone → "Full colour". Cached per image src; text fills exact. **Pricing** uses the derived count (max across sides; full colour priced as 6 screens, counts capped at 8) — provisional by design: nothing is charged before the artist-reviewed invoice, and `line_items.decorations` is **pre-filled** on order placement (location/type/W/H/colours) from `price_snapshot.decorationSpots` so the artist starts from real values.
  - **1MB body-limit bug fixed** (the "Body exceeded 1 MB limit" save failure with PDFs/big photos): Fabric scenes no longer carry data-URL images through the server action — unique images are staged to Storage via the existing signed-upload flow, scenes send `dh-staged:<path>` markers, `persistDesign` rewrites them to 1-year signed URLs. `serverActions.bodySizeLimit` bumped to 3mb as headroom (needs a dev-server restart to take effect).
  - QA artifacts: design "QA measurement test", orders **DH-2026-0019** (the user's own "Jersey Tee" cart item — was in the browser cart and got checked out with the QA order) + **DH-2026-0020**.

- **Approve-and-pay (2026-07-13, NOT yet browser-QA'd):** the customer's proof approval now flows straight into Stripe payment — no admin invoice step required. `orderPayableError` in `lib/orders/payments.ts` + `PAYABLE_ORDER_STATUSES` in `lib/orderStatus.ts` define payability: unpaid + total>0 + (status approved-or-later OR invoice_sent_at). Both pay actions (`payNowPublicAction`, portal `payNowAction`) use it instead of the old `invoice_sent_at` gate. `ProofPanel`'s button is **"Approve & pay $X"** — approve → `payNow()` → redirect to Checkout (falls back to refresh, where the renamed "Payment" panel shows a Pay now button for any approved-unpaid order). Amount is ALWAYS the live `pricing.total` (`OrderView.amountDue` now prefers it over the stamped `invoice_amount`; `ensureCheckoutSession` already re-mints on drift, so admin pricing edits flow through automatically). Admin: `sendInvoiceAction` kept as the optional **"Email payment link"** (also the only way to open payment pre-approval), approved-unpaid hero = "Approved — awaiting payment" badge, dashboard queues "Ready to invoice"+"Invoice sent — unpaid" merged into one **"Awaiting payment"**, ProofReviewDialog warns when sending a proof on a $0-total order, proof_ready email CTA now "Review & approve your proof" + shows Total due (amount card suppressed at $0). Also fixed: `ProofPanel` referenced an undefined `changesRequested` (would not have compiled — now defined).

- **Pricing profiles, component model (2026-07-16, build+lint green, NOT browser-QA'd):** replaced the per-product 48-cell hand-typed price table with `blank (wholesale × markup) + a shared decoration profile`. New table `pricing_profiles` (migration 0013: name/slug/decorations/`ref_wholesale`/`setup`/`tiers`, RLS staff-manage; hand-added to `db/types.ts` + `rows.ts` since MCP can't regen). `src/lib/pricing/profile.ts` `compileCurveFromProfile(product, profile)` = `profile.tiers(qty) + blankShift`, where `blankShift = (myRetail − refRetail)` at the product's markup. The output writes to `products.pricing_rules.quote`, so **every storefront/designer/order surface is untouched** (compiled-cache pattern). `pricing_rules.profileId` records the link. `ref_wholesale` = the family's **cheapest** blank so all shifts are ≥ 0 (errs high = safe): the reference product reproduces the validated CR−10% curve exactly, pricier blanks shift up. Verified the shifts reproduce the old hand-nudges automatically (Softstyle +$0.98, Sponge Fleece Drop +$40.56). **New admin `/admin/pricing`** (`PricingClient` + `actions.ts`): edit a profile's tiers/setup once and `recompileProductsForProfile` reflows every product on it (`src/lib/admin/pricing.ts`); duplicate/delete (delete guarded on 0 users); sidebar nav added. **Product editor pricing card rewritten**: blank cost (read-only) + markup + profile `<select>` + **live read-only tier preview** (`compileCurveFromProfile` client-side); the 48-cell grid + "copy pricing from" (`getCurveSources`/`CurveSource`) are **deleted**. `updateProductAction` takes `profileId` (compiles server-side via `buildProductPricingRules`), no longer `quoteCurve`. Setup fee is stored per-profile but **informational only** (already amortized into tiers) pending an itemized-invoice toggle. Backfill/seed: `node --env-file=.env.local scripts/seed-pricing-profiles.mjs` (idempotent). **Julian to review:** pricier blanks err high at volume (Bella "Jersey Tee" @50 = $20.04 vs Gildan "Heavy Cotton" $11.82; the ×markup shift is generous at volume, so tune the tee profile's markup/reference or the product markup if too steep). Proposal artifact: https://claude.ai/code/artifact/bef72468-f10a-40a5-84bb-b86bc9d064ec

- **Designer mockup corruption fixed (2026-07-16, build+lint green, NOT browser-QA'd):** the admin was seeing mockup PNGs with the print-guide label ("Front center · 12″ × 10″") baked in (confirmed in order 1002 / design `d48a2532`'s stored PNG). Root cause chain: Fabric v7's `bringObjectToFront` unconditionally re-pushes its argument into `_objects`, so the `object:added` handler resurrected the old guide label mid-`loadFromJSON` (undo/redo/scene-restore) as an untracked orphan; and `toDataURL` ignores `excludeFromExport` (serialization-only flag), so the orphan rendered into `exportMockup`. Fixes in `DesignCanvas.tsx`: guides value-tagged `dhGuide` (isGuide + redraw sweep catch orphans), `object:added` only reorders a label still on canvas, `exportMockup` uses a `toDataURL` render `filter`, garment bg now `excludeFromExport` (smaller scenes, undo can't revert colour), `loadScene` strips legacy `backgroundImage` + chains concurrent loads, `setGarment` seq-guards out-of-order image loads; `DesignerClient` undo/redo await the load before re-measuring. Separate admin bug: `LineArtwork` skipped non-data-URL images, so staged (https) customer photos vanished from "View artwork"; it now accepts https srcs with fetch-based download. Stored mockups from before the fix stay corrupt until the design is re-saved; orphan-inflated `decorations` W×H on old orders (11.4×9.8 on 1002) are data artifacts.

- **Interac e-Transfer payment option (2026-07-17, build+lint green, NOT browser-QA'd, MIGRATION NOT APPLIED):** customers can now pay by e-transfer as well as card. "Approve & pay" / "Pay now" open a **payment-method dialog** (`src/components/orders/PaymentMethodDialog.tsx`: card via existing Stripe flow, or e-transfer instructions with copy-buttons for the recipient email + order-number memo and an "I've sent the e-transfer" button) — dialog only appears when e-transfer is configured, else the old direct-to-Stripe flow. Reporting a transfer (`reportEtransferCore` in `lib/orders/payments.ts`, token/RLS-authorized actions on both order pages) stamps `orders.payment_method='etransfer'` + `etransfer_reported_at` (order stays UNPAID), logs activity, emails the customer (new `etransfer_reported` template) and Julian ("E-transfer to verify"). The customer Payment panel then shows a "Confirming e-transfer" state with "View transfer details" + "Pay by card instead". **Admin verify flow**: Payment card (`OrderReference`) + command-header hero (`EtransferVerify.tsx`) show an amber callout with **Confirm received** (dialog, optional "Start production now" checkbox on approved orders → `confirmEtransferAction` = full markOrderPaid flow with method 'etransfer' + Stripe-session expiry, no redundant self-notify) and **Not received** (dialog with optional customer note → clears the pending flag). Dashboard gains an **"E-transfers to verify"** queue (excluded from Awaiting payment); orders list Payment column shows "E-transfer sent {date}" / "Paid · e-transfer"; `markOrderPaid` now stamps `payment_method` ('card' on Stripe paths). Settings → **Payments tab** (settings key `payments`, `lib/paymentSettings.ts`): enable toggle + recipient email + note; hidden from customers until an email is set. Migration `0015_etransfer_payments.sql` (columns + authenticated column grants + template seed) + hand-edits to `db/types.ts`.

- **Julian's ticket batch (2026-07-19, build green, NOT browser-QA'd):** parallel-agent sweep over the bug list.
  - **Designer**: undo/redo now captures transforms + text edits (pre-gesture snapshot via `before:transform`/`object:modified`, commit via `onModifyCommit`) with Cmd/Ctrl+Z / Shift+Z / Ctrl+Y keys; text panel gains left/center/right alignment + font-size stepper (controls sync from the selected text via `getActiveTextProps`); `activeView` is now `View | null`, clicking outside canvases clears it and drops Fabric selections (tools prompt "Click a shirt side"); heart clipart replaced with a symmetric path; save dialog notes designs save to the signed-in account (the typed email is contact-only; `claimGuestRecords`' `customer_id IS NULL` guard is intentional, do not loosen).
  - **Marketing/shop**: hero wave SVG got `pointer-events-none` (was swallowing shop category-tile clicks); `ShopByCategories` cards + footer product links now route to `/shop?category=shirts|hoodies|hats-toques|totes`; size-guide dialog dims its backdrop via the existing `backdropClassName` prop (other dialogs untouched).
  - **Portal/public link**: `ProofPanel` moved below `OrderTracker`; proof lightbox has prev/next + arrow-key nav; "Quality check" removed from `TRACKER_STAGES` (5 stages now; legacy `quality_check` status folds into production; `OrderTracker` dog maps re-keyed and its `PREVIEW_STAGE` dev override removed); approve-and-pay opens the payment-method chooser without racing `router.refresh()`; new `resolveEtransferOption()` in `lib/orders/orderView.ts` probes the 0015 columns and degrades to card-only when unapplied (this was the "public link broken" report, no literal crash reproduced, both /o pages render 200).
  - **Checkout/account**: new `business` settings key (`src/lib/businessSettings.ts`, Admin Settings Checkout tab) holds the pickup address; pickup panel shows it + keyless Google Maps embed + the relocated "why we still need your address" tip; `/checkout/done` rewritten (everyone lands there, orders param is `number:token:orderId`, per-audience CTA); customers can delete draft designs (`deleteDesignAction`, refuses non-drafts/order-referenced/non-owner).
  - **Admin comments now actually email**: the composer default was `internal`, flipped to `customer` with option label "Customer (emails them)". The email machinery was already correct.
  - **Em dashes purged everywhere** per Julian: src/scripts/supabase/globals.css/robots.txt (spaced ones became commas, `"—"` table placeholders became `"-"`) AND the DB `settings.email_templates` row (one-off service-role script). Do not reintroduce.
  - Arrows removed from admin "Back to orders" + products "Edit" labels.
  - **Answered/flagged**: no separate setup fee when adding colours (screenprint adds a per-unit surcharge, embroidery colours free, setup amortized in curve); left-chest works only as the front view's first/only print area (multi-zone-per-view = future feature); sleeves stay the "message us" handoff (S&S has no honest sleeve imagery); spam placement is domain reputation not DNS (SPF/DKIM/DMARC all valid; use a brand domain + DMARC quarantine at launch).

- **Sleeve designing live + migrations applied (2026-07-19, build+lint green, NOT browser-QA'd):** the designer now offers a **Sleeve** view (S&S side photo as garment) whenever the product has a sleeve-family print area AND some colourway has a `images.side` photo. "See both" is now "See all" with 3 canvases (zoom drops to 0.55). Fallback UX: colour without a side photo keeps the sleeve canvas mounted (art preserved) under an opaque "No sleeve photo for this colour, your art is saved" placeholder + Message-us link, with a sun-yellow dot on the Sleeve pill; products with no sleeve area/photos keep the old handoff card. `imageForView(colour,"sleeve")` returns `img.side ?? null` (no front fallback). Downstream (mockups, decorationSpots "Sleeve", review table, pricing location count, admin decoration pre-fill) flows through the existing per-view maps with no portal/admin edits needed; admin `PrintAreaEditor` already supported sleeve (saves as `left_sleeve`). **Seeded**: `scripts/seed-sleeve-areas.mjs` (idempotent, `--dry`) stamped a default "Sleeve" area (max 4×3.5in, envelope x0.4 y0.26 w0.18 h0.15 on the 500×625 side photos) onto all 8 active shirts/hoodies — **Julian should fine-tune box positions per product in the admin editor**. Also this session: fresh `SUPABASE_ACCESS_TOKEN` (user will rotate it, expect it dead next session) applied migrations **0014 + 0015** (payment marking + e-transfer now work at the DB level; e-transfer email still needs setting in Admin → Settings → Payments + browser QA). db-push checksum drift lesson: **never edit applied migration files** (the em-dash sweep did; 0001-0013 were restored to recorded checksums). Also: e-transfer recipient set to admin@dreamhouseprinting.com in the payments settings row; **all dialogs now auto-dim (grey `dream-overlay` scrim) + auto-render the X** (`DialogContent` defaults, `hideClose`/`backdropClassName` opt-outs; lightboxes use `bg-dream-overlay/90`); admin Payment box derives from the server payment status (stale-useState fix, e-transfer confirm now updates it); order Payment summary itemizes Shipping + Tax.

- **Navigation speed pass (2026-07-19, build+lint green, NOT browser-QA'd):** admin + portal navigation was blocking ~0.5s per click on auth+data round trips with no visual feedback. Fixes: (1) `loading.tsx` skeleton shells on every admin route (real `AdminHeader` title + shimmer content via `src/components/admin/AdminPageSkeleton.tsx`) and every `/account` route (`PortalPageSkeleton`/`SkeletonRows`/`SkeletonCard` added to `src/components/ui/Skeleton.tsx`), so clicks paint instantly and Next prefetches the shell on link hover; (2) `getUser`/`getProfile` wrapped in React `cache()` (one Supabase Auth round trip per request instead of 2-4, `getProfile` now reuses `getUser`); (3) every admin page runs its permission gate IN PARALLEL with its data queries (`Promise.all([requirePermission(...), ...data])`, redirect still fires before render; service-role reads never reach the client on gate failure), admin layout badge count parallelized too, dashboard fetches orders+quotes+activity concurrently, `getAdminOrder` folds the customer lookup into batch 1 and designs+products into one batch 2; (4) `experimental.staleTimes: { dynamic: 30, static: 180 }` in `next.config.ts`, so revisiting a tab within 30s renders instantly from the client router cache (safe: all mutations revalidate via server actions, which purge it). Tradeoff to know: admin list data can be up to 30s stale when flipping tabs without mutating; drop the `dynamic` value if that ever bites.

### Pick up from here

1. Read this file + `BUILD_PLAN.md` (phase checklist) + the `project_platform_build` / `project_supabase_mcp_mismatch` / `reference_ss_activewear` memories.
2. **Migrations 0014 + 0015 ARE applied (2026-07-19).** The `SUPABASE_ACCESS_TOKEN` in `.env.local` worked once and the user said they would rotate it, so assume it is dead again; mint a fresh one for any new DDL. Next: set the e-transfer email in Admin → Settings → Payments and browser-QA the payment flows (approve-and-pay method chooser, e-transfer report → dashboard queue → confirm/not-received, plus a Stripe card payment for regression), and browser-QA the 2026-07-19 ticket batch + sleeve view (undo transforms, sleeve placeholder on colours without side photos, checkout pickup panel).
3. **P0 + P1 brand pass and the admin/lifecycle redesign are done** (see above, browser-verified). **Remaining P2 / PRD work**: Organizations / team accounts (§6 — entity exists; needs member-management UI + shared artwork/brand kit, selectable in the designer); saved-artwork-on-file reuse in the designer + "My Designs" (§5.5); text curve/arch + clip-art library; admin category CRUD; bulk-tier quote pricing; art-issue flags on proofs. Open UX questions: an "invoiced/unpaid" tab on the orders list (dashboard queues currently deep-link those to the `production` tab), deposit (partial-payment) invoices, grouping multi-design checkouts in the portal.
4. **Mobile** on the rewarmed surfaces + the new admin/order pages is responsive-classes-only, NOT visually confirmed (Chrome MCP `resize_window` gotcha). Verify on a real narrow viewport.
5. **Before launch**: swap Stripe sandbox keys for Julian's live keys, create a production webhook endpoint (dashboard → put its secret in `STRIPE_WEBHOOK_SECRET`), set `NEXT_PUBLIC_APP_URL` + `NEXT_PUBLIC_SUPABASE_*` + Stripe vars in Vercel; turn OFF `mailer_autoconfirm` + wire Resend SMTP; confirm a real notification email delivers; forgot-password email-leg config (Supabase Auth → Redirect URLs + Reset Password template → `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=recovery&next=/reset-password`); review RLS with `get_advisors`; clear the 9 pre-existing lint errors (marketing components + PrintAreaEditor/AdminSidebar/OrderRow/DesignerClient setState-in-effect, none from recent batches); test accounts (`julian@dreamhouse.test` staff_admin / `customer@dreamhouse.test`, pw `dreamhouse123`) are dev-only; clear demo orders with `node --env-file=.env.local scripts/seed-demo-orders.mjs --clean`.
6. Dev server port is **whichever Next picks** — the user often already has this repo running on :3000; check before starting another (`lsof -i :3000`), and keep `NEXT_PUBLIC_APP_URL` in `.env.local` pointed at the live port. Don't auto-open Chrome unless diagnosing.
