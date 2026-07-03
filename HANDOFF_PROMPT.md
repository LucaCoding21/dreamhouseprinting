# Claude Code Prompt — Polish the Dreamhouse platform to "done" + on-brand

Paste everything below into a fresh Claude Code session in this repo.

---

You are continuing the Dreamhouse Printing build. The full commerce platform from `prd.md` already exists on branch `feat/platform-build` (read `BUILD_PLAN.md` and the CLAUDE.md "Current status" first). It **works** end-to-end, but it does **not look done** — the customer-facing surfaces use a generic SaaS look that clashes with our playful marketing home page, the shop is nearly empty, and the designer is ugly with a misaligned print box. Your job: make it feel finished, cohesive, and on-brand, and fix the specific bugs below. Work in small slices, run `npm run build` after each, and **verify every visual change in the browser yourself** (dev server is on **http://localhost:3001** — 3000 is an unrelated app). Don't ask me to verify; drive Chrome and look. Commit per slice on the existing branch. Don't push.

## Orientation (read these before touching anything)
- Marketing/home aesthetic to MATCH: `src/app/page.tsx`, `src/app/globals.css` (the `@theme` `dream-*` tokens + the `.rough-pill`, `.rough-card`, `.scribble-frame-*`, `.blob-morph`, `.sun-ray`/`.sun-burst`, `.animate-pop`, `.reveal-*`, `.polaroid-pop`, `.price-tag-alive`, `.hiw-line` animations), and components `SiteNav.tsx`, `SiteFooter.tsx`, `HeroDog.tsx`, `ScribbleButton.tsx`, `ShopByCategories.tsx`, `Testimonials.tsx`, `PolaroidPhoto.tsx`, `Reveal.tsx`. Fonts: `font-display` = Archivo (headings/buttons), `font-daruma` = Daruma Drop (playful accents), default = Inter. Brand mascot: the house-character logo (`public/dreamhouse-logo.svg`) + the doodle dog. The vibe is warm, hand-drawn, lavender + sun-yellow, bouncy.
- Platform surfaces to RESTYLE: storefront `src/app/shop/**` + `src/components/storefront/**`, designer `src/app/design/[productId]/**`, customer portal `src/app/account/**` + `src/components/portal/**`. The UI primitives live in `src/components/ui/**`.
- Admin (`src/app/admin/**`) should stay clean/functional (matches the `roughadmin` references) — only give it light brand accents, don't make it playful.
- S&S import + product editor + print-area editor: `src/app/admin/products/**`, `src/lib/ss/**`. DB/DDL goes through `node --env-file=.env.local scripts/db-push.mjs` (Management API — **never use the Supabase MCP, it points to a different project**). Test logins: `julian@dreamhouse.test` (staff_admin) / `customer@dreamhouse.test`, pw `dreamhouse123`.

## DECISION TO MAKE FIRST (ask me if unsure)
Decide how hard to push the playful brand onto the storefront/designer. Default: keep the platform legible and conversion-focused, but warm it up to clearly belong to the same brand — reuse the `dream-*` palette, Archivo headings, `rough-pill`/`scribble` button treatments for primary CTAs, the dog mascot, sun-yellow accents, and the bouncy reveal animations. Don't turn product grids or the designer into chaos; warmth + cohesion, not gimmicks.

---

## P0 — the specific things I called out

1. **Home nav "Shop All".** Add a "Shop All" link to the marketing nav (`src/components/SiteNav.tsx`) that routes to `/shop`. Place it alongside the existing menu items, styled to match. Also make sure the storefront's own header (`StorefrontNav.tsx`) and the footer link back consistently (Home / Shop All / Services / How to Order / Account / Cart).

2. **Populate the catalog — the shop is basically empty.** Right now there's ~1 product. Import **at least 3 real products for every important category** from the live S&S Activewear catalog and publish them (active, with a category, sensible markup, and at least a front print area so they open in the designer). Do this with a repeatable seed script `scripts/seed-catalog.mjs` (mirror `scripts/seed-staff.mjs`'s style; reuse `src/lib/ss/transform.ts` logic or call the same admin import path) that takes a curated list of S&S styles, imports each, auto-assigns category + a default front print area + activates, and marks one per category featured. Suggested styles (verify they resolve via `api-ca.ssactivewear.com`):
   - Shirts: Bella+Canvas 3001 (have it), Gildan 5000, Next Level 6210, Comfort Colors 1717, Gildan 64000.
   - Hoodies: Gildan 18500, Independent SS4500, Bella+Canvas 3719, Gildan 18000 (crewneck).
   - Hats & Toques: Yupoong 6245CM (dad cap), Sportsman SP12 (toque), Flexfit 6277.
   - Totes: Q-Tees Q1300, Liberty Bags 8860.
   After seeding, the "Top 5 favourites" row and category tabs on `/shop` should be full and every tile should have an image. **Verify in the browser that `/shop` looks abundant, not empty.**

3. **Designer is ugly + the print grid is misaligned on the shirt.** Two parts:
   - **Alignment bug (root cause):** the print-area box is positioned in full-canvas coordinates while the garment image is letterboxed (`object-contain`) inside the canvas, so the box drifts off the shirt. Fix by anchoring the print area to the **rendered image's actual rectangle**, consistently in BOTH the admin `PrintAreaEditor` and the designer `DesignCanvas`. Cleanest approach: stop letterboxing — size the Fabric canvas (and the admin editor's image container) to the **garment image's real aspect ratio** so the image fills it exactly; then normalized box coords map 1:1 to the image. If you keep `object-contain`, you must compute the image's displayed contain-rect (`left/top/scaledW/scaledH`) and place/scale the print rect against THAT rect, not the full canvas — do it in both places or they won't match. After the fix, author a box in admin, open the product in the designer, and confirm by eye that the dashed zone sits exactly where it was drawn, across colour and view swaps.
   - **Make it look good:** redesign the designer to be clean and on-brand (`designtool.png` is the reference layout). Tighten the three rails, frame the canvas nicely (drop the muddy gray bg, give the garment a soft card + subtle shadow), present colour swatches in a tidy scrollable grid with the selected name, make the tools (Upload artwork / Add text) feel like real buttons, add a zoom control and an undo, improve the size/quantity grid, and make the price panel prominent and friendly. Add the dog mascot somewhere tasteful. Better empty/loading states. Mobile: it should at least be usable (stack rails) on a phone.

---

## P1 — "it's lowkey not looking done" — the finish pass
Go surface by surface and make each feel intentional and complete. Verify each in the browser.

- **/shop**: add a short branded hero/intro, make `ProductCard` warmer (rough-card edge or soft shadow, hover lift, the price tag treatment), ensure the "Top 5 favourites" row renders distinctly above the tabs, give category tiles real imagery, and make search + filters + sort actually work and feel good. Result count. Skeletons while loading.
- **Product detail (`/shop/[id]`)**: match `productpage3.png` but warmed to brand; the 3 value-prop blobs should use the lavender blob style; "You might also like" should be a real, populated row; make "Design now" the hero CTA (scribble/rough treatment).
- **Customer portal**: make the **dog tracker actually delightful** — the dog should look like it's carrying a bag and visibly hop/advance between stages (animate it), not just a static emoji on a line. Warm up the dashboard/orders/cards. Real empty states.
- **Consistency**: one button language for customer-facing CTAs, consistent spacing/typography, consistent page headers, consistent use of the palette. Kill any leftover generic-SaaS gray that fights the brand.
- **Cross-cutting**: mobile-responsive on every new surface; loading + empty + error states everywhere; fix any broken images / placeholder boxes; make sure `/cart` either exists or its links are removed; double-check all nav links resolve (no 404s).

## P2 — remaining product work / next steps
- **Organizations / team accounts (§6)** — the one un-built major PRD surface. Entity is in the schema (`organizations` + `profiles.organization_id/org_role`). Build: org create + member management (org admin adds/removes members, assigns roles), shared artwork/logos + optional brand kit, and **shared artwork selectable in the designer** (reuse without re-uploading) — that's the key acceptance criterion.
- **Saved artwork on file (§5.5)** — let a customer reuse their own previously-uploaded artwork in the designer without re-uploading; surface it in "My Designs".
- **Designer depth**: multi-view mockup export (currently only the active view is captured at submit), text curve/arch, clip-art/shapes library.
- **Admin**: category CRUD (add/edit/reorder the Shop-All categories), bulk-tier pricing UI on quotes, art-issue flags on the proofs queue.
- **Pre-launch hardening**: turn OFF Supabase `mailer_autoconfirm` and wire real email verification (Resend SMTP); confirm a real notification email actually delivers; set `NEXT_PUBLIC_SUPABASE_*` in Vercel; run Supabase `get_advisors` (security + performance) and resolve findings; review the 4 pre-existing marketing-component lint errors (`AnimatedPrice`, `PolaroidPhoto`, `SiteNav`, `useReveal` — `react-hooks/set-state-in-effect`).

## Working method (do this, not optional)
- After each slice: `npm run build` must pass (strict TS — for Supabase jsonb, READ with `as unknown as T` and WRITE with an `asJson` cast; type `.update()` patches as `Database["public"]["Tables"]["x"]["Update"]`), then **open the page in Chrome and look at it**. Screenshot-compare against the home page for cohesion and against the reference PNGs in `public/refrences/`.
- Keep the admin clean; make the customer-facing surfaces feel like the home page's cousin.
- Commit each slice on `feat/platform-build` with a terse imperative message (no AI attribution — repo convention).
- When everything in P0+P1 looks genuinely done in the browser, summarize what changed and what P2 items remain.
