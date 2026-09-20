# Full-platform audit fix plan (2026-07-17)

Produced from a 6-agent parallel audit (security, customer purchase flow, designer canvas,
portal/auth/public order page, admin, legacy quote + APIs + email layer). Every finding was
verified against actual code with file:line evidence; the two most critical were re-verified
by hand. Work the waves in order: each wave is a coherent, commit-able unit.

Legend: [DECISION] = a product call. ALL decisions are now RESOLVED (2026-07-17, William
delegated: "pick the smartest one"). Resolutions are recorded inline as [RESOLVED: ...].

Locked decisions summary:
- Payment on a cancelled order: ALERT-ONLY (notify Julian, he refunds in Stripe). No auto-refund.
- Reorder: reprice from current rules and place as a normal submitted order with emails + copied
  addresses (not a draft), behind a confirm dialog.
- Orphaned `/checkout/[designId]` stepper + `submitDesignAction` + `?quote=1`: DELETE. Cart is the
  single funnel. "Quick quote" links point at the designer.
- Email opt-out pref: exempt payment/transactional templates (submitted, proof_ready, invoice_sent,
  payment_received). Marketing/status-nicety emails still respect the pref.
- Cancelled order: ADD a customer "order cancelled" email. on_hold stays silent (internal state).
- Display rounding: unify on rounding UP everywhere (matches the doc, errs toward margin).
- Colour surcharge table: EXTEND to 6 colours so "full colour = 6 screens" is real (prices are
  provisional pre-proof anyway, so this only tightens the estimate toward the true screen count).
- Upload rate limit ceiling: 40 mints / 10 min / key (in-memory sliding window).

---

## Wave 0 - Security criticals (do first, small diffs, huge risk)

### S1. CRITICAL: any customer can promote themselves to staff_admin
`supabase/migrations/0002_rls.sql:79-81`. The `profiles_update` policy is row-level only; there
is no column guard, so a logged-in user can `update profiles set role='staff_admin'` with the
public anon key from the browser console. Also lets them self-assign `organization_id` (reads
that org's orders), `staff_permissions`, `internal_notes`, `saved_artwork`.
**Fix:** new migration (0014): a `BEFORE UPDATE` trigger on `profiles` that raises unless
`public.is_staff_admin()` when any of `role, staff_permissions, organization_id, org_role,
internal_notes` change. (Trigger, not `with check`, because RLS cannot see OLD values.)
Server actions use the service client and bypass RLS, so nothing legitimate breaks.
Apply via `node --env-file=.env.local scripts/db-push.mjs`. NEVER via the Supabase MCP (wrong project).

### S2. HIGH: client-controlled price is what Stripe charges
`src/app/checkout/[designId]/actions.ts` copies `design.price_snapshot` (client-written via
`saveDraftAction`) into `orders.pricing`, and approve-and-pay charges `pricing.total` with no
server-side recomputation. A tampered snapshot = pay $0.50 for a real job unless staff manually
reprice before proofing.
**Fix:** in `placeOrderAction`, recompute subtotal/setup server-side from the product's
`pricing_rules` via `priceFromCurve` (same inputs: method, colour count, combined qty) and use
the recomputed numbers; keep the snapshot only for display/spec. Clamp any client-supplied
number to the server result. (Also covers the cart loop, which delegates here.)

### S3. HIGH: open redirect via backslash in `?next=`
`src/app/login/actions.ts:25-29` and `src/app/auth/confirm/route.ts:27`. `/\evil.com` passes
`startsWith("/") && !startsWith("//")` and browsers normalize `\` to `/`. Post-auth phishing,
worst on the emailed reset-link leg.
**Fix:** reject any `next` containing `\` in both places (shared `safeNext` helper).

### S4. MEDIUM: wholesale cost leaked to every visitor
`src/app/design/[productId]/page.tsx:107-113` passes `wholesale_cost` as a prop to the client
component; it lands in the RSC payload for anyone. Violates the documented invariant.
**Fix:** stop passing it. Compute the cost-plus fallback tiers server-side and pass only tiers.

### S5. MEDIUM: staff-only columns readable by customers via PostgREST
`0002_rls.sql:129-133` `orders_select` lets a customer `select *` on their own order row:
`internal_notes`, `production_notes`, `hold_note`, `sales_rep`, full `pricing` internals, plus
all `order_activity` rows (price edits, internal notes) and `line_items.decorations.priceSuggestion`.
UI filtering is cosmetic; the anon key + session JWT returns everything.
**Fix (same migration as S1):** revoke SELECT on the staff-only columns from
`authenticated`/`anon` (column-level GRANTs), or move customer reads to a security-barrier view.
Verify the portal still works (it reads via the server client as the user; keep the columns it
actually renders).

### S6. MEDIUM: `persistDesign` signs arbitrary storage paths
`src/app/design/[productId]/actions.ts:71-114` signs whatever paths the client sends
(mockups/artwork/sceneImages/dh-staged) with no ownership check.
**Fix:** reject any path not prefixed `${userId}/` or `guest/${guestToken}/`.

### S7. MEDIUM: upload endpoints too open
- `/api/design/upload` allows the `proofs` bucket for guests (`route.ts:16`). Restrict `proofs`
  to staff (`requireStaff`), guests get `designs`/`artwork` only.
- `/api/upload-url` has zero auth; both have zero rate limiting. Add a cheap in-memory/cookie
  rate limit (e.g. N mints per token/IP per hour) to both. [DECISION: acceptable ceiling]

### S8. Config, pre-launch (already on the list, restated because it is a live exploit path):
`mailer_autoconfirm` ON makes the `email_confirmed_at` claim-guard a no-op: anyone can register
with a victim's email and instantly claim their guest orders/designs (PII + order history).
Must be OFF before launch; S11/Wave-2 signup-UX work depends on it too.

### S9. MEDIUM: resume link hands the design to whoever opens it
`src/app/design/resume/[designId]/route.ts:38-40` sets the guest cookie for ANY visitor
(including a logged-in stranger, whose next /account visit permanently claims the design), and
clobbers the visitor's own guest cookie, orphaning their in-progress work.
**Fix:** only set the cookie when the visitor has none; if authenticated, only claim when
`lead_email` matches the account email; never overwrite an existing different token
(re-key the resumed design to the existing cookie token instead).

---

## Wave 1 - Money and order-state integrity

### M1. Proof decisions lack all guards (portal + /o/token)
`src/lib/orders/proofDecision.ts:39-46,75-82`. No order-status check and no rowcount check:
- approve on a CANCELLED order un-cancels it into `approved` (payable!), same for on_hold/completed
- stale tab / forwarded link re-approve regresses `in_production` back to `approved`, duplicate
  emails to Julian, duplicate activity rows.
**Fix:** read order status first; only proceed from `proof_ready | changes_requested | in_review |
submitted`. Use `.update(...).select("id")` and no-op (return ok) when 0 proofs transitioned.

### M2. Manual "paid in full" vs `paid_at` desync = double charge
`src/app/admin/orders/actions.ts:86-97`. Setting payment_status=paid_in_full does not set
`paid_at`; `orderPayableError` only checks `paid_at`, so the customer can still Stripe-pay a
cash-paid order. Reverse: unpaid never clears `paid_at`.
**Fix:** stamp/clear `paid_at` in `setPaymentStatusAction`, also treat
`payment_status === "paid_in_full"` as paid in `orderPayableError`, and expire any open
checkout session when marking paid manually.

### M3. Cancelling never expires the Stripe session; webhook ignores status
`CommandHeader.tsx:134-140` + `src/app/api/stripe/webhook/route.ts:31-38`. A customer with the
Stripe page already open can finish paying a cancelled order.
**Fix:** on transition to `cancelled`, `stripe.checkout.sessions.expire(stored id)`; webhook
alerts Julian (notifyJulian) instead of silently marking a cancelled order paid. [RESOLVED:
alert-only, Julian refunds manually in Stripe.]

### M4. Paid-but-unreconciled session gets discarded, second charge possible
`src/lib/orders/payments.ts:72-86`. Only `status === "open"` sessions are reused; a `complete`
session (webhook missed, tab closed on receipt) falls through to minting a NEW payable session.
**Fix:** if retrieved session has `payment_status === "paid"`, call `markOrderPaid` and return
"already paid" instead of minting.

### M5. No order idempotency + orphan orders
`src/app/checkout/[designId]/actions.ts:252-317`.
- Back-button/retry resubmits create duplicate orders + duplicate Julian emails (design.status
  is set to "submitted" but never read).
- If the line_items insert fails, the order row survives headless and the customer retries.
**Fix:** in `placeOrderAction`: if the design is already `submitted` with a live order, return
that existing order (idempotent). Delete the order row when line-item insert fails.
Cart loop (`cart/actions.ts`) inherits both fixes; also return per-order numbers/tokens for C-wave UX.

### M6. Item edits leave stale tax and a stale PricingCard that can overwrite
- `syncOrderPricing` (`admin/orders/actions.ts:291-311`) carries old `tax` over onto a new
  subtotal; customer can immediately approve-and-pay the wrong total.
  **Fix:** re-derive tax from the shipping province inside `syncOrderPricing`.
- `PricingCard.tsx:40-49` initializes state once; after item edits, Save pricing writes the
  pre-edit numbers back. **Fix:** `key={JSON.stringify(order.pricing)}` (or resync-on-props).

### M7. Server-side status/lifecycle guards
- `setOrderStatusAction` (`actions.ts:67-79`) accepts any transition; `uploadProofsAction`
  (`actions.ts:524-573`) flips ANY order (paid/completed/cancelled) back to `proof_ready` and
  emails an approve-and-pay CTA.
**Fix:** a small transition validator in one place: block proof_ready with no pending proofs,
block proof upload on cancelled/completed/paid (or upload without status change), require
confirm flag for cancel-on-paid, keep everything else permissive (one-man shop). Clear
`hold_note` on any transition out of on_hold (today only `applyStatus` does).

### M8. Payable UI on cancelled orders
`src/components/orders/OrderView.tsx:25-28`: add `status !== "cancelled"` to `payable` (action
already rejects; button should not render).

### M9. Pricing input validation
`updateOrderPricingAction` (`actions.ts:131-154`): clamp to finite >= 0, recompute total from
parts server-side, block or confirm-with-activity-note when `paid_at` is set. Same clamps for
unit price in `updateLineItemsAction` and markup >= 0 in `updateProductAction`.

---

## Wave 2 - Broken flows and data loss

### Customer-facing
- **C1. Shop grid never loads the price curve.** `src/lib/db/catalog.ts:22-24` LIST_COLUMNS is
  missing `pricing_rules`, so every card shows blank-garment "from" pricing and price sort is
  wrong; detail page disagrees with the card. One-line fix + verify card/detail parity.
- **C2. Designer method fallback prices decorated jobs at blank-garment price.**
  `DesignerClient.tsx:239-248`: when admin allows only DTG/vinyl on a curve product,
  `priceableMethods` is empty and pricing silently drops to `calcPrice` with $0 decoration.
  Fix: same full-curve fallback as the product page (`allowedCurveDecorations`), or a
  "not configured" block state.
- **C3. Cart integrity set:** re-validate cart rows against the DB on /cart load (prune deleted/
  foreign designs with a clear message; refresh qty/total from the live `price_snapshot`);
  store the signed mockup URL instead of a data URL (localStorage quota kills persistence);
  partial-failure UX: show every placed order number + successes styled as success.
- **C4. Legacy quote form:** `..` in a filename silently drops the artwork server-side
  (`api/submit/route.ts:69` vs `api/upload-url/route.ts:18` sanitizer): collapse dots in the
  sanitizer AND fix the per-segment check. Silently-rejected oversized/wrong-type files get a
  visible error (`QuoteCard.tsx:401-418`). Floor `quantity` server-side (decimal 500s today).
  Whitelist enums/date server-side. In-flight ref to stop double-submit.
- **C5. Checkout validation:** `saveContactAction` re-validates nothing. Add server-side email/
  province/postal validation + field errors; cart client gets the same postal/province checks
  the stepper client already has. Reject-or-flag unknown province instead of silently taxing $0.
  Cap designer per-size quantity (e.g. 10k) like the product page caps at 1000.
- **C6. Dead code removal [RESOLVED: delete]:** the 3-step `/checkout/[designId]` funnel is
  unreachable from the UI, and `submitDesignAction` + `startAsQuote`/`?quote=1` "Quick Quote"
  links are dead or inert. Delete the stepper directory + `submitDesignAction` + the
  `startAsQuote` prop, keep the cart as the single funnel, and point the product-page
  "Quick quote" links at the designer.

### Designer (data loss + correctness)
- **D1. Re-save wipes source artwork refs.** `actions.ts:110,125` overwrites
  `source_artwork_files` with only this session's uploads. Merge with existing row files;
  reconcile against images still present in scenes (also fixes over-reporting deleted uploads).
- **D2. Garment load failure bricks the view and cascades to scene loss.**
  `DesignCanvas.tsx:325-354` has no .catch: spinner forever, initial scene never loads, next
  save overwrites the design with an empty canvas. Fix: catch, degrade to plain background,
  still fire onGarmentLoaded, surface an error chip; never let save export a view whose initial
  scene hasn't loaded.
- **D3. Undo/redo/snapshot not gated during async scene loads** (`DesignerClient.tsx:574-600`):
  rapid clicks capture partial scenes into history. Gate on a per-view loading flag.
- **D4. Drag/scale/rotate/text-recolour never snapshot** (`DesignCanvas.tsx:206`): push history
  on `object:modified` and in applyTextColor/Font.
- **D5. Signed scene URLs expire after 1 year and unresolved `dh-staged:` markers are stored
  verbatim** (`actions.ts:85-98`): re-sign Supabase-storage https srcs on every save; error
  instead of storing a dead marker; stop swallowing load failures (`catch(() => {})`).
- **D6. Resume drift:** carry scenes for since-removed print areas through saves untouched;
  fall back to first available colour with a notice when the saved colour is gone.
- **D7. Mockup export gating:** don't export before `loadedViews` has every decorated view
  (white-background mockups on slow connections).
- **D8. Review parity:** checkout review hardcodes "Full colour" and omits W x H
  (`review/ReviewClient.tsx:240-244`); render real `decorationSpots`. Await pending colour
  analyses before locking the snapshot (understated estimates).
- **D9. beforeunload guard** when unsaved work exists.

### Admin / lifecycle
- **A1. Quote conversion produces empty orders.** `admin/quote-actions.ts:55-118` copies
  `line_items` (always []) and drops `design_ids`, message, contact. Synthesize line items from
  the design row, stamp `guest_email`, copy message to notes, send the submitted email.
- **A2. Reorder:** fire `sendOrderStatusEmail` + `notifyJulian` (currently silent), copy
  addresses/fulfillment, and reprice server-side from current rules. [RESOLVED: place as a
  normal submitted order with emails, not a draft.] Add a confirm dialog.
- **A3. S&S re-sync must recompile the price curve** when `wholesale_cost` changes and
  `pricing_rules.profileId` is set (`products/actions.ts:224-276`).
- **A4. Print-area save:** validate geometry server-side (0 < x,y,w,h <= 1, inches > 0) and
  upsert instead of delete-then-insert (`products/actions.ts:309-337`).
- **A5. Guest orders editable in admin:** CustomerCard treats synthesized guest contact as a
  real profile; enable guest email editing and route name/phone to shipping_address.
- **A6. Dashboard "Awaiting payment" deep link:** add an orders-list tab whose predicate matches
  the queue (and include deposit_paid balances). 
- **A7. Line-item loaders need `.order("created_at")`** (`db/orders.ts:30`, `o/[token]/page.tsx:41`):
  nondeterministic item order + wrong mockup attachment.
- **A8. Proof set semantics:** supersede older pending proofs on upload or track a batch id, so
  approval can't cover proofs the customer never saw; group by batch in OrderView.

### Email layer
- **E1.** Missing template key = silent no-email (`notify.ts:124`): log a warning + hardcoded
  fallback templates for invoice_sent/payment_received.
- **E2.** Email opt-out currently suppresses invoices/receipts too: exempt payment-critical
  templates from the pref. [RESOLVED: exempt submitted, proof_ready, invoice_sent,
  payment_received; the pref only gates status-nicety/marketing emails.]
- **E3.** `approved` maps to the in_production template ("now printing", sent at approval and
  again at in_production, and sent by "approve on behalf" despite the dialog promising no email).
  Give approved its own template or none; dedupe consecutive same-template sends.
- **E4.** `changes_requested` acknowledgment is wired to the wrong trigger (admin manual set,
  not the customer's actual request): move it into `requestProofChangesCore`.
- **E5.** No cancelled/on_hold customer emails exist. [RESOLVED: add a customer "order
  cancelled" template + wire it from the cancel transition; on_hold stays silent (internal).]
- **E6.** Reset-password rate-limit errors (429) are swallowed as success
  (`login/actions.ts:101-104`): surface them.
- **E7.** `/auth/confirm` failure lands on `/login?error=link` which renders nothing: add the
  expired-link banner. Signup "check your email" state before autoconfirm turns off (today it
  silently bounces, and duplicate-email registrations look identical).

---

## Wave 3 - Post-order UX (the account question) + polish

### Post-order experience (recommendation)
Current: guest lands on /checkout/done with the FIRST order number only, no link to the order,
and a bare "Create an account" link to /register (not prefilled, no explanation). Logged-in
users skip it entirely. The public token never reaches the page.

Plan (keep guest checkout frictionless, make the account the obvious upsell, never a wall):
1. `placeOrderAction`/`placeCartOrdersAction` return `{orderNumber, publicToken}` per order.
2. /checkout/done lists EVERY placed order as a card with its `/o/{token}` "Track this order"
   link (works with zero friction, matches the email), plus the email address we sent it to.
3. Below, one inline "Save these to an account" module for guests: email prefilled (read-only)
   from checkout contact, single password field, one button. It calls the existing signUpAction;
   `claimGuestRecords` already attaches orders+designs on confirm/sign-in. Copy states plainly:
   "Register with this same email and these orders attach to your account automatically."
   With email confirmation ON it becomes "check your inbox to finish", and claiming happens at
   /auth/confirm (already wired).
4. Logged-in users: redirect to /account/orders with a success banner listing all placed order
   numbers (today: bare list, no confirmation context).
5. Do NOT force accounts: proofs + payment already work over /o/{token} for guests by design.

### Polish batch (grouped, low risk)
- Portal: OrderRow stale "we'll send your invoice" copy; designs page `/design/null` links for
  deleted products (+ drop target=_blank); missing-profile login loop (create profile row on
  demand in /account layout); redirect authed users away from /login and /register.
- Dates: render order dates in a fixed America/Vancouver timezone, format due_date properly.
- Admin: optimistic payment select revert on error; markShipped toast honesty; CSV guest emails
  + `'` prefix hardening for =+-@ values; CRM "total spent" = paid orders only; DecorationSpotRow
  keys; duplicate send-invoice confirm flows unified.
- Legacy: display-rounding direction unified [RESOLVED: round UP everywhere, matches the doc
  and errs toward margin; fix the quote card's Math.floor]; stale comments (QuoteCard needed-by
  claim, CLAUDE.md rush section, CR-10% "rounded up" note).
- Perf guardrails (not urgent): `.limit()` + narrow columns on getAdminOrders/getMyOrders/CSV;
  exclude `api/stripe` from proxy session refresh.
- Signed-URL rot strategy: proofs store only a 1-year URL with no path column; add `path` to
  proofs (migration) and re-sign on read, same for mockup_images. (Prereq for orders older
  than a year staying viewable.)
- Colour surcharge table is flat above 4 colours so "full colour = 6 screens" is inert
  [RESOLVED: extend the surcharge table through 6 colours so the documented intent is real;
  provisional pre-proof pricing, so it only tightens the estimate toward true screen count].

---

## Execution notes
- Branch: continue on `feat/platform-build`. One commit per wave-section, terse imperative.
- DB changes: migration 0014 (S1+S5 guards, proofs.path). Apply with scripts/db-push.mjs.
- After each wave: `npm run build` + lint; browser-QA the money paths (proof approve/pay,
  admin cancel, manual paid) before calling Wave 1 done.
- Re-check `get_advisors` RLS lints at the end via the Management API (NOT the Supabase MCP).
- Full agent reports (60+ findings with quoted evidence) exceed this file; this plan is the
  deduplicated, prioritized superset of everything actionable.
