# Dreamhouse Platform — Build Plan

Building `prd.md` end-to-end: a 4-surface custom-apparel commerce platform (storefront · in-browser designer · customer portal · admin portal) on one shared Supabase model. The legacy quick-quote form stays untouched.

**Decisions:** Supabase Auth · manual/offline payments · live S&S Activewear (CA) · phased vertical slices.

**Infra notes:** Migrations via `scripts/db-push.mjs` (Management API — the Supabase MCP is bound to a different project). Dev on `localhost:3001`. Test logins: `julian@dreamhouse.test` (staff_admin), `customer@dreamhouse.test`, pw `dreamhouse123`.

## Phases (each self-QA'd in the browser before advancing)

- [x] **Phase 0 — Foundation.** Data model (all §9 entities) + RLS + seed; migration runner; Supabase clients (browser/server/service) + proxy + auth guards; S&S client (CA) + transformer; pricing engine; catalog query layer; UI primitive library (20 components); auth flows (register/login/logout); app shell for all four surfaces. ✅ Browser-QA'd: register→profile, guard enforcement, staff sidebar.
- [x] **Phase 1 — Catalog.** Admin Products (S&S import/search, full product editor, visual print-area editor, sync, activate/feature); storefront `/shop` (§3.3 wireframe) + product detail page (`productpage3.png`). ✅ Browser-QA'd: imported B+C 3001 (79 colours/9 sizes), configured + published, appears on /shop with live price, colour-swap works. (Deferred: admin category CRUD; Top-5 favourites row needs >1 product to show.)
- [x] **Phase 2 — Designer.** `/design/[productId]` Fabric.js canvas: S&S backdrop per colour/view, Admin print-area overlay (normalized coords align), upload art + text + transform/layer, restricted decoration picker, live price, size/qty grid, save draft, submit → Design + Order + storage mockup (`designtool.png`). ✅ Browser-QA'd: designed a tee, placed order DH-2026-0001, mockup exported→stored→shown on the customer order page with the dog tracker. (Deferred: multi-view mockup export currently captures the active view only; text curve/arch.)
- [ ] **Phase 3 — Customer portal.** Dashboard, My Orders + animated dog tracker, proof approve/request-changes, My Designs, Account, Help, reorder.
- [ ] **Phase 4 — Admin core.** Orders list (`roughadmin.png`) + order detail (`roughadmin2.png`): line items, pricing/qty adjust, official mockup upload, internal/customer notes, status control, payment status, activity log. Proofs & Artwork queue, Production board, Quotes, Customers CRM, Reports, Settings.
- [ ] **Phase 5 — Org & cross-cutting.** Organizations + shared artwork/brand kit in designer; notifications (Resend templates + prefs); reports CSV.

## Source-of-truth references
`public/refrences/`: `designtool.png` (designer), `productpage3.png` (product detail), `roughadmin.png` (orders list), `roughadmin2.png` (order detail).
