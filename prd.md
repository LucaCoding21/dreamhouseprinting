# Product Requirements Document

## Custom Print Shop Platform — Storefront, In-Browser Designer, Admin Portal & Customer Portal

**Document type:** Engineering PRD for implementation
**Audience:** AI build agent extending an existing website
**Status:** Build-ready

---

## 0. How to read this document

This PRD describes a complete custom-apparel e-commerce platform with an in-browser design tool. It is written to be built on top of an **existing website**. Where the existing site already provides primitives (auth, a database, a payment integration, a component library, routing), reuse them rather than introducing parallel systems. Where this document specifies behavior, treat it as the source of truth.

The platform has four surfaces that share one backend and one data model:

1. **Public storefront** — browse and discover (logged-out friendly)
2. **Designer tool** — in-browser garment customizer (Fabric.js-style canvas)
3. **Customer portal** — logged-in account area (orders, proofs, payment, reorders)
4. **Admin portal** — staff operations (orders, artwork, production, catalog)

Every requirement below is grouped by surface, then by feature. Each feature lists **behavior**, **data**, and **acceptance criteria**. The data model in §9 is canonical — all surfaces read from and write to the same entities.

Throughout: the single organizing principle is that **a Product's configuration is authored once in Admin and propagates everywhere** — to the storefront listing, the designer's constraints, the price calculation, and what production is permitted to do.

---

## 1. Roles & access

| Role            | Description                                          | Access                                                  |
| --------------- | ---------------------------------------------------- | ------------------------------------------------------- |
| **Guest**       | Logged-out visitor                                   | Storefront, designer (must log in to submit/checkout)   |
| **Customer**    | Registered buyer                                     | Customer portal + everything a guest can do             |
| **Org Member**  | Customer belonging to an organization                | Customer portal scoped to their org's shared resources  |
| **Org Admin**   | Manages an organization's members and shared artwork | Org Member access + member/role management              |
| **Staff**       | Shop employee                                        | Admin portal (scoped by permissions below)              |
| **Staff Admin** | Shop owner / manager                                 | Full Admin portal including Settings & staff management |

### Staff permission granularity

Staff accounts must support per-area permissions so that, e.g., a designer can prep artwork but cannot change pricing. Minimum permission flags:

- `orders.view`, `orders.edit`, `orders.pricing`
- `proofs.manage`
- `production.manage`
- `products.manage`
- `quotes.manage`
- `customers.view`, `customers.edit`
- `reports.view`
- `settings.manage`
- `staff.manage`

**Acceptance criteria**

- A staff member without `orders.pricing` sees pricing fields as read-only on the order detail page.
- A staff member without `settings.manage` cannot access the Settings section (route guarded + nav item hidden).
- Permission checks are enforced server-side, not just in the UI.

---

## 2. Global concepts & vocabulary

These concepts recur across every surface. Define them once in the data layer.

### 2.1 Decoration method

A technique for applying artwork to a garment. The platform must treat decoration methods as configurable records, not hard-coded strings.

Default set (Staff Admin can add/edit):

- Screenprint
- Embroidery
- DTG (direct-to-garment)
- Vinyl / heat transfer

Each decoration method has:

- `name`
- `description` (customer-facing explainer)
- pricing rules (setup fee, per-unit cost, per-color cost where relevant)
- constraints (e.g., max colors for screenprint)

### 2.2 Print area

A defined zone on a garment where artwork may be placed (e.g., "Front center", "Left chest", "Full back"). Each print area has a position, max dimensions, and is tied to a garment view (front/back/sleeve).

### 2.3 Product configuration

Every Product carries the full set of options that constrain ordering and design:

- Available **colours**
- Available **sizes**
- **Pricing / markup**
- **Allowed decoration methods** (subset of the global set)
- **Lead time** (turnaround estimate)
- **Print areas**
- **Active / inactive** flag
- **Stock status**
- **Category / subcategory** placement

> This configuration is authored in **Admin → Products** and is the single source that drives the storefront, the designer, quoting, and production.

### 2.4 Order status (canonical state machine)

A single status field drives both the admin workflow and the customer-facing tracker.

```
draft → submitted → in_review → proof_ready → changes_requested
      → approved → in_production → quality_check → shipped → completed
                                                  (or) → ready_for_pickup
cancelled / on_hold (can apply from most states)
```

| Status              | Meaning                         | Customer tracker shows                   |
| ------------------- | ------------------------------- | ---------------------------------------- |
| `draft`             | Saved but not submitted         | (not shown — lives in My Designs / cart) |
| `submitted`         | Customer placed the order       | Order received                           |
| `in_review`         | Staff reviewing artwork         | Order received                           |
| `proof_ready`       | Official mockup sent            | Proof ready                              |
| `changes_requested` | Customer asked for edits        | Proof ready (in revision)                |
| `approved`          | Proof approved, locked          | In production                            |
| `in_production`     | Being decorated                 | In production                            |
| `quality_check`     | Printed, being inspected/packed | Quality check                            |
| `shipped`           | In transit                      | Shipped                                  |
| `ready_for_pickup`  | Ready at shop                   | Ready for pickup                         |
| `completed`         | Fulfilled                       | Delivered / complete                     |
| `on_hold`           | Paused                          | (last known stage, with a hold note)     |
| `cancelled`         | Cancelled                       | Cancelled                                |

**Acceptance criteria**

- Changing an order's status in Admin immediately updates the customer tracker.
- Status transitions are logged with timestamp + actor (for the order activity history).
- Illegal transitions (e.g., `shipped → submitted`) are blocked or require explicit override with a logged reason.

### 2.5 Payment status (independent of order status)

`unpaid → deposit_paid → paid_in_full → refunded → partially_refunded`

Order status and payment status are tracked separately. An order can be `in_production` while `deposit_paid`.

### 2.6 Catalog data source — S&S Activewear API

Blank garments are **not hand-authored**. The catalog is sourced from **S&S Activewear**, the shop's wholesale blank-goods supplier, via their REST API. S&S is the system of record for raw garment data; Admin layers the shop's configuration (§2.3) on top.

- **Base URL:** `https://api.ssactivewear.com/v2/`
- **Auth:** HTTP Basic — `SS_ACCOUNT` (account number) as username, `SS_API_KEY` as password. Both live in env (`SS_ACCOUNT`, `SS_API_KEY`); **server-side only** — never call S&S from the browser.
- **What S&S provides per style/SKU:** style name & description, brand, available **colours** (with swatch/hex), **sizes**, **product images** (flat/model/swatch), specs, and **live wholesale pricing + inventory**.

**What S&S owns vs. what Admin owns**

| Field | Source |
| --- | --- |
| Garment name, brand, description, colours, sizes, images, specs | **S&S** (synced) |
| Wholesale cost, live inventory / stock status | **S&S** (synced, refreshable) |
| Markup, retail price rules | **Admin** |
| Allowed decoration methods, print areas, lead time | **Admin** |
| Category/subcategory placement, Featured flag, Active flag | **Admin** |

**Behavior**

- Admin → Products imports/searches the S&S catalog and **adds a style as a shop Product**, then configures the Admin-owned fields. A local Product record references its S&S identity (`ss_style_id` / SKU) so it can be re-synced.
- A **sync** refreshes S&S-owned fields (price, inventory, images, colours/sizes) on demand and/or on a schedule. Admin-owned config is preserved across syncs.
- **Stock status** on the storefront/designer reflects S&S live inventory (mapped to in_stock / out_of_stock / made_to_order).
- The shop's **retail price** = S&S wholesale cost + Admin markup + decoration-method fees (§10.3). S&S cost is never shown to customers.

**Acceptance criteria**

- A Product can be created by importing an S&S style; its colours, sizes, and images come from S&S without manual entry.
- Re-syncing a Product updates S&S-owned fields without overwriting Admin-owned config (markup, decoration methods, print areas, category, flags).
- S&S credentials are only ever used server-side.

---

## 3. Public storefront

### 3.1 Site navigation

Top-level nav (these pages exist on the current site or are added):

| Nav item     | Route           | Purpose                                |
| ------------ | --------------- | -------------------------------------- |
| Home         | `/`             | Landing + funnel to designer           |
| About        | `/about`        | Shop story & trust                     |
| Shop All     | `/shop`         | Full catalog browse                    |
| Services     | `/services`     | Decoration capabilities                |
| How to Order | `/how-to-order` | Process, decoration guide, size charts |

Plus auth-gated entry points: **Log in / Account** (→ customer portal) and **Cart**.

### 3.2 Home page

**Behavior**

- Hero section with a primary CTA: "Start designing" (deep-links into the designer, or to Shop All if no default product).
- Featured products row (configurable in Admin — pulls flagged products).
- Brief value props (decoration methods, bulk-friendly, fast turnaround).
- Secondary CTA toward Services / How to Order.

**Acceptance criteria**

- Featured products are driven by an Admin flag, not hard-coded.
- Clicking a featured product opens it in the designer.

### 3.3 Shop All — catalog page (`/shop`)

This is the core browse experience. **There is no separate category landing page.** Shoppers land directly on Shop All and narrow down from there. The reference low-fidelity wireframe below is the canonical layout for this page.

```
┌──────────────────────────────────────────────────────────────────────┐
│ LOGO   [ search…                                            ]      🛒  │
├──────────────────────────────────────────────────────────────────────┤
│ CATEGORY TILES — click a tile to jump to that subsection               │
│ ┌────────┐ ┌────────┐ ┌──────────────┐ ┌────────┐ ┌──────────────┐     │
│ │ Shirts │ │Hoodies │ │ Hats & toques│ │ Totes  │ │ All products │     │
│ └────────┘ └────────┘ └──────────────┘ └────────┘ └──────────────┘     │
├──────────────┬───────────────────────────────────────────────────────┤
│ SIDEBAR      │ TOP 5 PER CATEGORY — the favourites, shown first        │
│ Shirts       │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐            │
│   Short slv  │ │ Top  │ │ Top  │ │ Top  │ │ Top  │ │ Top  │            │
│   Long slv   │ │shirt │ │hoodie│ │ hat  │ │toque │ │ tote │            │
│   Ladies/kids│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘            │
│ Hoodies      ├───────────────────────────────────────────────────────┤
│ Hats & toques│ TABS — click a tab, grid below swaps (no page reload)   │
│ Totes        │  [Shirts] Hoodies  Hats  Toques  Totes                  │
│ ┄┄┄┄┄┄┄┄┄┄┄┄ │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                     │
│ (niche below)│ │      │ │      │ │      │ │      │                     │
│ Quarter zips │ └──────┘ └──────┘ └──────┘ └──────┘                     │
│ Windbreakers │ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐                     │
│ Bags         │ │      │ │      │ │      │ │      │       ↓ more         │
└──────────────┴───────────────────────────────────────────────────────┘
```

#### 3.3.1 Layout

- **Header:** logo, a catalog **search** field, and a **cart** icon.
- **Category tiles (top):** Large tiles for the major categories — Shirts, Hoodies, Hats & Toques, Totes — plus an **"All Products"** catch-all tile. Clicking a tile jumps to that subsection.
- **Sidebar (left):** Begins with the same major categories (Shirts with its subsections — Short Sleeve, Long Sleeve, Ladies/Kids — then Hoodies, Hats & Toques, Totes), then a divider, then smaller/niche items below the main set (Quarter Zips, Windbreakers, Bags). Major categories are visually emphasized; niche items sit beneath them.
- **Main content (default / "All Products"):**
  - **Top 5 per category row, shown first** — the favourites: one featured pick per major category (top shirt, top hoodie, top hat, top toque, top tote).
  - Below that, a **tab strip** (Shirts · Hoodies · Hats · Toques · Totes). Clicking a tab swaps the product grid in place — **no page reload**. The grid shows that category's products.
  - When a **specific category** is selected (tile or sidebar): show that category's subsection (e.g., T-Shirts → Short Sleeve, Long Sleeve, Athletic, Tank Tops & Sleeveless, Ringer, V-Neck, Ladies, Kids, View All).

#### 3.3.2 Behavior

- Clicking any category — tile **or** sidebar — navigates into that subsection.
- The favourites row and tabs are the default landing state; the tab strip swaps the grid client-side without a navigation.
- Clicking any product card opens that product in the **designer tool** (§4).
- Standard catalog affordances: filtering (by category, colour, decoration method, price), sorting, and a result count.
- **Inactive products never appear.** Deactivating a product in Admin removes it from Shop All automatically.
- The "Top 5" favourites are driven by the product **Featured** flag (per category), not hard-coded.

#### 3.3.3 Data

Driven entirely by the **Product** and **Category** entities from Admin. No catalog content is hard-coded on the storefront. Garment data inside each Product originates from the **S&S Activewear catalog** (§2.6); the storefront reads it through the Product record, never by calling S&S directly.

**Acceptance criteria**

- Selecting "All Products" renders the top-picks row followed by category tabs.
- Toggling a product to inactive in Admin removes it from `/shop` without a code change.
- Filters and sorting operate on live product data.
- Every product card has a working click-through into the designer pre-loaded with that product.

### 3.4 Services page

Explains each decoration method (pulled from the decoration-method records so descriptions stay in sync), typical use cases, and bulk/custom capabilities. Includes a CTA into the designer or quote request.

### 3.5 How to Order page

Step-by-step ordering walkthrough, decoration method guide, and size charts. Reduces friction for first-time buyers. Size charts and decoration guides are reused inside the customer portal Help section (§5.7).

---

## 4. Designer tool (in-browser customizer)

The centerpiece. A drag-and-drop canvas — built on **Fabric.js** (the canvas library is fixed, because the saved scene format and re-edit/reorder flows depend on a stable serialization) — where the shopper places artwork onto a blank garment and submits it. Comparable to a print-on-demand product editor.

The blank garment the customer designs on is the **S&S product imagery** (§2.6): the per-colour flat shots S&S returns become the canvas backdrop, and the colour swatches drive the colour switcher. S&S does **not** provide print-area coordinates or a decorating template — those are **Admin-authored on the Product** and layered over the S&S image. Keep this split in mind throughout §4: S&S supplies the *picture of the blank*; Admin supplies *where and how it can be decorated*.

### 4.1 Entry

- Opened by clicking any product on Shop All, a featured product, or a "Start designing" CTA.
- Route: `/design/:productId` (and `/design/:productId/:designId` when resuming a saved draft).
- On open, the canvas pre-loads, from the Product configuration: the **S&S garment image** for the default colour/view, the **available colours** (S&S swatches, filtered to the colours Admin enabled), the **sizes** (S&S, filtered to enabled), the **Admin-authored print areas**, allowed decoration methods, pricing, and lead time.

### 4.2 Canvas capabilities

| Capability                                                 | Requirement                                                                                                                                                                      |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Garment preview**                                        | Render the **S&S garment image** for the current colour/view as the canvas backdrop. Switching **colour** swaps to that colour's S&S image (only Admin-enabled colours offered); switching **view** (front / back / sleeve) swaps to that view's image, limited to the views that have a print area. Fall back to the default-colour image when S&S has no shot for a colour/view pair. |
| **Upload artwork**                                         | Accept customer-uploaded images: PNG, JPG, SVG (and ideally PDF). Store the original file at full quality.                                                                       |
| **Add text**                                               | Add text objects with font selection, colour, size, alignment, and curve/arch options.                                                                                           |
| **Transform**                                              | Drag (move), resize (scale, with aspect lock option), rotate, and layer (z-order: bring forward / send back) any object.                                                         |
| **Print-area guides**                                      | Display the active print area's boundary. Warn or prevent when artwork exceeds the printable zone.                                                                               |
| **Clip art / shapes** _(optional but supported in schema)_ | A library of built-in graphics/shapes the customer can add.                                                                                                                      |
| **Live price**                                             | Display a price that updates as quantity, sizes, colours, and decoration method change — computed from the product's pricing rules + decoration method pricing.                  |
| **Decoration method selection**                            | The customer chooses a decoration method **restricted to the product's allowed methods**. Method choice can affect available options (e.g., screenprint color limits) and price. |
| **Quantity & size breakdown**                              | Enter quantities per size (e.g., 5×M, 3×L). Drives pricing and the order line items.                                                                                             |
| **Save draft**                                             | Persist the in-progress design to the customer's account ("My Designs"). Requires login; prompt to log in if guest.                                                              |
| **Submit**                                                 | Add to cart / proceed to checkout, or request a quote (for bulk).                                                                                                                |

### 4.3 Garment imagery & print-area authoring (S&S + Admin)

The designer's preview is the seam where S&S data meets Admin configuration. Specify it explicitly so the canvas always has a backdrop to draw on and a printable zone to constrain to.

**From S&S (synced onto the Product, §2.6)**

- Per-colour garment images (flat front / back / side / model shots) — the canvas backdrops.
- Colour swatches (name + hex/swatch image) — the colour switcher.
- Sizes and live inventory — the size/quantity grid and stock state.

**From Admin (authored on the Product)**

- **Print areas** — each a named zone (front center, left chest, full back, sleeve) with a **view**, a **position/bounding box expressed in the coordinate space of that view's S&S image**, and `maxWidth`/`maxHeight` (real-world inches). This is what S&S can't give us; it's drawn once per product in the Admin print-area editor and reused by every customer design.
- The subset of S&S colours/sizes actually offered, plus markup, allowed decoration methods, and lead time.

**Rendering rules**

- The print-area box is overlaid on the S&S image; the customer's artwork is clipped/warned against that box (§4.2, "Print-area guides").
- Because the box is anchored to the S&S image's coordinate space, the print area stays correctly placed when the colour swatch changes (same view, same geometry) and moves with the **view** swap.
- Map real-world `maxWidth`/`maxHeight` (inches) to canvas pixels via a per-view scale stored with the print area, so a "12 inch wide" limit means the same thing on every garment.

**Fallbacks**

- If S&S lacks an image for a colour/view, fall back to the default-colour image for that view (preview only — the order still records the chosen colour).
- A product with no Admin-authored print area cannot be opened in the designer (nowhere to place art); it can still exist as a catalog/quote-only product.

**Acceptance criteria**

- Each Product opened in the designer shows the correct S&S blank for the selected colour, with the Admin print area overlaid in the right place.
- Changing colour keeps the print area aligned; changing view loads that view's image and its print area.
- A size/colour S&S reports as out of stock is surfaced (greyed or flagged) without blocking design.

### 4.4 How Product configuration constrains the designer

This is the most important integration in the platform. The designer must enforce the product's Admin configuration:

| Admin / S&S setting        | Effect in the designer                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Available colours          | Only Admin-enabled colours (a subset of the S&S colours) are selectable; each swaps the S&S garment image.                                |
| Available sizes            | Only Admin-enabled sizes (a subset of the S&S sizes) appear in the quantity grid.                                                         |
| Print areas                | Admin-authored zones define where art can be placed and the maximum size; the canvas clips/warns against them.                            |
| Allowed decoration methods | The decoration method picker only offers methods this product supports. A product flagged as un-screenprintable never offers screenprint. |
| Pricing / markup           | Drives the live price as the design changes (S&S wholesale cost + markup + decoration fees; cost never shown).                            |
| Lead time                  | Surfaced to the customer as an estimated turnaround.                                                                                      |
| Active / inactive          | An inactive product cannot be opened in the designer at all (route returns not-available).                                                |
| Stock status (S&S live)    | Out-of-stock / made-to-order colours and sizes surfaced to the customer.                                                                  |

### 4.5 Submit payload

On submit (to cart, checkout, or quote), persist a **Design** record and attach it to the resulting Order or Quote. The Design captures:

- `productId`
- Rendered **mockup image(s)** (the visual the customer built, per view)
- **Source artwork file(s)** uploaded by the customer (original quality, retained)
- Canvas **scene definition** (serialized Fabric.js JSON or equivalent) so the design is re-editable
- Selected **colour**
- **Size/quantity breakdown**
- Selected **decoration method**
- **Print area(s)** used
- Computed **price snapshot** (line totals + any setup fees)

**Acceptance criteria**

- A product whose allowed methods exclude screenprint never shows screenprint in the designer.
- Switching garment colour swaps to that colour's S&S image (Admin-enabled colours only) with the print area still correctly placed.
- The live price recomputes on every change to quantity, size mix, colour, or decoration method, and matches the price stored on submit.
- A saved draft can be reopened and edited from the customer's "My Designs."
- The original uploaded artwork file is stored and retrievable by staff at full quality.
- Submitting creates a Design record linked to the new Order (or Quote) and to the Customer.

---

## 5. Customer portal (logged-in)

Intentionally lean. Customers register, then do four core things: **track orders, approve proofs, pay, and reorder.** Everything else stays out of the way.

### 5.1 Authentication

- Customers create an account and log in (reuse the existing site's auth if present).
- Standard flows: register, log in, log out, password reset, email verification.
- After login, land on the portal **Dashboard**.

### 5.2 Navigation

| Nav item       | Route               | Contents                                                                                       |
| -------------- | ------------------- | ---------------------------------------------------------------------------------------------- |
| **Dashboard**  | `/account`          | Active orders with the animated tracker; action items (proofs to approve, balances to pay)     |
| **My Orders**  | `/account/orders`   | Active + past orders; order detail with tracker, mockups, approve-proof, pay, invoice, reorder |
| **My Designs** | `/account/designs`  | Saved designs from the designer; start a new design; logos & artwork on file to reuse          |
| **Account**    | `/account/settings` | Profile & contact info, saved addresses, payment methods, notification preferences             |
| **Help**       | `/account/help`     | How to order, size charts, contact support                                                     |

### 5.3 Dashboard

**Behavior**

- Surfaces active orders, each with the animated tracker at its current stage.
- Highlights anything needing the customer's action: **proofs awaiting approval**, **balances owed**.
- Quick actions: start a new design, reorder a past job.

### 5.4 My Orders

**Behavior**

- List of all orders (active + past), filterable by status.
- **Order detail page** includes:
  - The animated **order tracker** at its current stage
  - **Line items** (garment, colour, sizes, quantities, decoration method)
  - **Mockups / proofs** with **Approve** and **Request changes** actions
  - **Payment** — pay outstanding balance / deposit from within the account
  - **Invoice / receipt** (downloadable)
  - **Shipping tracking link** once shipped
  - **Reorder** (optionally with edited quantities/sizes)
  - Per-order **messages/notes thread** with the shop (optional; can live inside the order)

#### 5.4.1 The animated order tracker

A Domino's-style animated tracker: a dog carrying a bag advances through each production stage. It is a friendly visual layer over the order's status field.

| Tracker stage   | Underlying status              | Advanced by                   |
| --------------- | ------------------------------ | ----------------------------- |
| Order received  | `submitted` / `in_review`      | Order placed                  |
| Proof ready     | `proof_ready`                  | Staff uploads official mockup |
| In production   | `approved` / `in_production`   | Staff sets production         |
| Quality check   | `quality_check`                | Staff sets QC/packing         |
| Shipped / ready | `shipped` / `ready_for_pickup` | Staff sets shipped            |
| Complete        | `completed`                    | Order fulfilled               |

**Acceptance criteria**

- The tracker reflects the order's current status in real time (or on refresh) — no separate state to maintain.
- When staff advance the order status, the dog advances and (if enabled) a notification fires.

#### 5.4.2 Proof approval

- Customer can **Approve** a proof (locks it for production → status moves toward `approved`).
- Customer can **Request changes** with a comment (status → `changes_requested`, flagged in Admin).
- The approve/request-changes loop can repeat until approval.

#### 5.4.3 In-account payment

- Customer can pay an outstanding balance or deposit from the order detail page.
- Payment status updates and is reflected in Admin.

#### 5.4.4 Reorder

- One-click reorder pre-fills a new order from a past job's saved design, artwork, garment, and specs.
- Customer may edit quantities/sizes before submitting.
- Because the artwork is already approved, reorders may skip directly toward production (Admin can still review).

### 5.5 My Designs

**Behavior**

- **Saved design drafts** from the designer tool (resume and finish later).
- **Start a new design** (launches the designer).
- **Logos & artwork on file** — upload artwork once and reuse it across future orders without re-uploading.
- **Approved proofs / print files** available to download.

**Acceptance criteria**

- A saved design opens back in the designer in its prior state.
- Artwork on file can be selected inside the designer instead of re-uploading.

### 5.6 Account

- Profile & contact info.
- Saved shipping addresses (multiple).
- Saved payment methods.
- Notification preferences (email/SMS toggles per event — order status changes, proof ready, etc.). These preferences feed the tracker notifications.

### 5.7 Help

- How to order, decoration method guide, size charts (shared with the storefront).
- Contact / support request.

---

## 6. Organization / team accounts

Supports group buyers — schools, sports teams, businesses — who reorder repeatedly. This is a meaningful retention surface.

### 6.1 Behavior

- An **Organization** groups multiple customer accounts.
- **Org Admins** manage members and roles (admin vs. member who can only order).
- **Shared artwork / logos** available to all members of the org.
- Optional **brand kit**: stored team colours + logo so every member's order stays on-brand.
- Members order under the org; orders can roll up to the org for visibility.

### 6.2 Data

- `Organization` entity with members, roles, shared artwork, and optional brand kit.
- Customer records can belong to an organization.

**Acceptance criteria**

- An Org Member sees the org's shared logos available in the designer.
- An Org Admin can add/remove members and assign roles.
- A member without admin rights cannot manage members or change shared artwork.

---

## 7. Admin portal (operational core)

Where the shop runs every order end-to-end and manages the catalog that powers the storefront and designer.

### 7.1 Navigation

| Nav item             | Route               | Contents                                                                                                               |
| -------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Dashboard**        | `/admin`            | Snapshot of new orders, awaiting approval, in production, ready to ship; outstanding balances; alerts; recent activity |
| **Orders**           | `/admin/orders`     | All orders (filterable); order detail; status sub-views                                                                |
| **Proofs & Artwork** | `/admin/proofs`     | Incoming submissions; proof approval queue; print-ready file library; art issue flags                                  |
| **Production**       | `/admin/production` | Job board by stage; decoration method per job; due dates from lead times; staff assignment                             |
| **Products**         | `/admin/products`   | Add / edit / deactivate products; full product config; categories                                                      |
| **Quotes**           | `/admin/quotes`     | Quote requests inbox; build & send quotes; convert to order; bulk pricing tiers                                        |
| **Customers**        | `/admin/customers`  | Customer profiles; order history; saved artwork; reorder; org grouping                                                 |
| **Reports**          | `/admin/reports`    | Sales & revenue, best sellers, outstanding balances, CSV export                                                        |
| **Settings**         | `/admin/settings`   | Decoration methods & pricing rules, shipping, tax, staff accounts & permissions, email templates                       |

### 7.2 Dashboard

**Behavior**

- Counts/queues: new orders, orders awaiting proof approval, in production, ready to ship.
- Outstanding balances total.
- Alerts: low-resolution artwork flags, overdue jobs (past their lead-time-derived due date).
- Recent activity feed (status changes, new orders, approvals).

### 7.3 Orders

The page Julian described first — **every order in one place.**

**List view**

- Filterable/sortable table by status, customer, date, payment status.
- Status sub-views: New · In Proofing · In Production · Ready to Ship · Completed.

**Order detail view** must support:

- **Line items** — garment, colour, sizes, quantities, decoration method per item.
- **Adjust pricing, markup & quantities** after the order is placed.
- **Upload official mockups** with adjusted/production-ready artwork.
- **Notes** — internal staff-only notes **and** customer-facing notes, kept distinct.
- **Status control** — advance the order through the state machine (drives the customer tracker).
- **Payment status** — paid / deposit / balance owed / refunded; record payments.
- **Activity log** — timestamped history of status changes and edits with actor.
- Attached **Design**, **source artwork**, and **proofs**.

**Acceptance criteria**

- Editing pricing/quantity on a placed order updates totals and is visible to the customer (and reflected in any balance due).
- Uploading an official mockup moves the order toward `proof_ready` and surfaces the proof in the customer portal.
- Internal notes are never shown to customers; customer-facing notes are.

### 7.4 Proofs & Artwork

The link between the designer tool and production. Without it, designer submissions would have nowhere to go.

**Behavior**

- **Incoming design submissions** from the designer land here automatically.
- **Side-by-side view:** what the customer made (their design + source files) vs. the production-ready file.
- **Proof approval loop:** send proof → customer approves or requests changes → locked for production.
- **File library:** print-ready files stored per order, with **separate art per decoration method** (the screenprint file may differ from the embroidery file).
- **Art issue flags:** flag problems — low resolution, too many colours for screenprint, etc. Flags surface as Dashboard alerts.

**Acceptance criteria**

- A designer submission appears in the Proofs queue without manual import.
- Staff can upload a revised proof; the customer sees it and can re-approve.
- Multiple decoration-method files can be attached to a single order's artwork record.

### 7.5 Production

**Behavior**

- **Job board** organized by production stage (art approved → printing → QC → packed).
- **Decoration method per job** shown (screenprint, embroidery, DTG, vinyl).
- **Due dates** computed from each product's lead time (and surfaced for overdue alerts).
- Optional **assignment** of jobs to a staff member / station.

**Acceptance criteria**

- Moving a job across the board updates the order status and the customer tracker.
- Jobs past their due date appear in Dashboard alerts.

### 7.6 Products — catalog engine

Edits here ripple to the storefront, the designer, and quoting.

**Behavior — product list**

- Table of all products with **Add / Edit / Deactivate (hide)** actions.
- **Add** imports a blank from the **S&S Activewear catalog** (§2.6) — search S&S by style/brand, pick a style, and it lands as a Product with colours, sizes, images, and wholesale cost pre-filled. Staff then set the Admin-owned config below.
- **Sync** re-pulls S&S-owned fields (price, inventory, colours, sizes, images) for a Product on demand; Admin-owned config is preserved.
- Deactivating hides a product from the storefront and designer immediately (for pieces too technical to decorate).

**Behavior — product detail / editor** must configure:

- **Name, description, photos**
- **Colours** (available garment colours)
- **Sizes** (available sizes)
- **Pricing / markup** (base cost + markup, and any size-based or quantity-based adjustments)
- **Allowed decoration methods** (subset of the global decoration methods — e.g., disallow screenprint or embroidery on specific products)
- **Lead time** (turnaround, feeds due dates and customer estimates)
- **Print areas** (zones + max sizes + garment views)
- **Stock status** (in stock / out of stock / made to order)
- **Category & subcategory** placement (drives Shop All structure)
- **Featured** flag (for the home page)

**Behavior — categories**

- Manage the **categories & subcategories** that structure the Shop All page (major categories + niche items + the "All Products" grouping logic).

**Acceptance criteria**

- Setting a product inactive removes it from `/shop` and blocks it in the designer, with no code change.
- Removing a decoration method from a product's allowed list removes it from that product's designer options.
- Changing a product's lead time updates due-date calculations for new orders.
- Adding a product to a category makes it appear under that category on Shop All.

### 7.7 Quotes

Most custom/bulk apparel buys begin as a quote rather than a direct checkout.

**Behavior**

- **Quote requests** (from the designer's "request a quote" or a standalone request) land in an inbox.
- Staff **build a quote** — set line items, pricing using **bulk pricing tiers** (e.g., 50 shirts priced differently than 5), and send it to the customer.
- Customer accepts → **quote converts to an order** and enters the normal order flow.

**Acceptance criteria**

- A converted quote produces an Order carrying the quote's line items, design, and pricing.
- Bulk pricing tiers are configurable and applied based on quantity.

### 7.8 Customers (CRM)

**Behavior**

- Table of all customers.
- **Customer profile:** contact info, saved addresses, **order history**, **saved artwork/logos on file**, internal notes.
- **One-click reorder** of a past job on the customer's behalf.
- Optional **organization/team grouping** (§6).

**Acceptance criteria**

- A customer's full order history is visible on their profile.
- Saved artwork on a customer (or their org) is available when building orders/designs for them.

### 7.9 Reports

**Behavior**

- Sales & revenue overview.
- Best-selling products.
- Outstanding balances.
- **CSV export** of orders and customers for accounting.

### 7.10 Settings

**Behavior**

- **Decoration methods & pricing rules** (the global set + per-method pricing/constraints).
- **Shipping** options & costs.
- **Tax** settings.
- **Staff accounts & permissions** (§1).
- **Email templates** for transactional messages (order confirmation, proof ready, shipped, etc.).

**Acceptance criteria**

- Editing a decoration method's description updates it everywhere it's surfaced (Services page, designer).
- Email templates drive the actual notifications sent on status changes.

---

## 8. End-to-end flows

These specify exactly where each surface hands off to the next. Implement so that each transition writes to the shared data model and triggers the appropriate notifications.

### 8.1 New custom order (primary flow)

1. Guest/customer browses **Shop All**, selects a product.
2. **Designer** opens with the blank garment; they upload/position artwork, choose colour, decoration method, and per-size quantities. Live price updates.
3. They log in / register, then **check out** (or request a quote).
4. An **Order** is created (status `submitted`); the **Design** + artwork attach to it. Customer tracker shows **Order received**.
5. Staff review artwork in **Proofs & Artwork**, prep the production file, adjust pricing/quantity if needed, and upload an **official mockup** (status → `proof_ready`). Tracker shows **Proof ready**.
6. Mockup appears in the customer portal. Customer **approves** (status → `approved`) or **requests changes** (status → `changes_requested`).
7. On approval, the job enters **Production** (`in_production` → `quality_check`). Tracker advances accordingly.
8. Staff mark it **shipped** (`shipped` / `ready_for_pickup` → `completed`). Tracker completes. The full job is saved to the **Customer** record for reorders.

### 8.2 Proof revision flow

1. Customer clicks **Request changes** on a proof, leaving a comment.
2. Order flags in **Admin → Proofs** as `changes_requested`; staff see the note.
3. Staff edit artwork and upload a **new mockup** (status → `proof_ready`).
4. Customer reviews again → approves → locks for production. Loop repeats only if needed.

### 8.3 Reorder flow

1. Customer opens **My Orders**, finds a past job, clicks **Reorder**.
2. The saved design, artwork, garment, and specs pre-fill a new Order — optionally with edited quantities/sizes.
3. The new Order enters the admin queue. Because artwork is already approved, it may skip toward production (Admin can still review).

### 8.4 Quote flow (bulk / custom)

1. Customer requests a quote (from the designer or a "Request a quote" action).
2. Request lands in **Admin → Quotes**. Staff build pricing (bulk tiers) and send it.
3. Customer accepts → the **Quote converts to an Order** and enters the normal order flow.

---

## 9. Data model (canonical)

All surfaces read/write these entities. Field lists are the minimum required; extend as needed but do not fork the model.

### 9.1 Product

| Field                        | Type                     | Notes                                   |
| ---------------------------- | ------------------------ | --------------------------------------- |
| `id`                         | id                       |                                         |
| `ssStyleId`                  | string                   | S&S style/SKU ref (§2.6); null if manual |
| `ssLastSyncedAt`             | datetime                 | last S&S sync                            |
| `name`                       | string                   | from S&S, editable                      |
| `description`                | text                     | from S&S, editable                      |
| `photos`                     | image[]                  | from S&S                                |
| `wholesaleCost`              | money                    | S&S-synced; never shown to customers    |
| `categoryId`                 | ref → Category           |                                         |
| `subcategoryId`              | ref → Category           | optional                                |
| `colours`                    | colour[]                 | available garment colours               |
| `sizes`                      | string[]                 | available sizes                         |
| `basePrice`                  | money                    |                                         |
| `markup`                     | money/percent            |                                         |
| `pricingRules`               | object                   | size-based / quantity-based adjustments |
| `allowedDecorationMethodIds` | ref[] → DecorationMethod | subset of global set                    |
| `leadTimeDays`               | int                      | turnaround                              |
| `printAreas`                 | PrintArea[]              |                                         |
| `stockStatus`                | enum                     | in_stock / out_of_stock / made_to_order |
| `isActive`                   | bool                     | inactive = hidden everywhere            |
| `isFeatured`                 | bool                     | home page                               |

### 9.2 Category

| Field          | Type           | Notes                         |
| -------------- | -------------- | ----------------------------- |
| `id`           | id             |                               |
| `name`         | string         |                               |
| `parentId`     | ref → Category | null for top-level            |
| `isMajor`      | bool           | major category vs. niche item |
| `displayOrder` | int            |                               |
| `image`        | image          | for the tile                  |

### 9.3 DecorationMethod

| Field          | Type   | Notes                                  |
| -------------- | ------ | -------------------------------------- |
| `id`           | id     |                                        |
| `name`         | string | screenprint, embroidery, DTG, vinyl, … |
| `description`  | text   | customer-facing                        |
| `setupFee`     | money  |                                        |
| `perUnitCost`  | money  |                                        |
| `perColorCost` | money  | where relevant (screenprint)           |
| `constraints`  | object | e.g., maxColors                        |

### 9.4 PrintArea

| Field                    | Type      | Notes                               |
| ------------------------ | --------- | ----------------------------------- |
| `id`                     | id        |                                            |
| `name`                   | string    | front center, left chest, full back        |
| `view`                   | enum      | front / back / sleeve                       |
| `position`               | object    | bounding box in the S&S view image's coords |
| `maxWidth` / `maxHeight` | dimension | printable bounds, real-world inches         |
| `pxPerInch`              | number    | scale to map inches → canvas px for `view`  |

### 9.5 Design

| Field                | Type                   | Notes                           |
| -------------------- | ---------------------- | ------------------------------- |
| `id`                 | id                     |                                 |
| `productId`          | ref → Product          |                                 |
| `customerId`         | ref → Customer         |                                 |
| `organizationId`     | ref → Organization     | optional                        |
| `sceneDefinition`    | json                   | serialized canvas (re-editable) |
| `mockupImages`       | image[]                | rendered previews per view      |
| `sourceArtworkFiles` | file[]                 | original uploads, full quality  |
| `colour`             | colour                 | selected garment colour         |
| `sizeQuantities`     | object                 | e.g., {M:5, L:3}                |
| `decorationMethodId` | ref → DecorationMethod |                                 |
| `printAreaIds`       | ref[] → PrintArea      |                                 |
| `priceSnapshot`      | object                 | line totals + fees at submit    |
| `status`             | enum                   | draft / submitted               |

### 9.6 Order

| Field                     | Type               | Notes                                          |
| ------------------------- | ------------------ | ---------------------------------------------- |
| `id`                      | id                 |                                                |
| `customerId`              | ref → Customer     |                                                |
| `organizationId`          | ref → Organization | optional                                       |
| `lineItems`               | LineItem[]         |                                                |
| `designIds`               | ref[] → Design     |                                                |
| `status`                  | enum               | order state machine (§2.4)                     |
| `paymentStatus`           | enum               | §2.5                                           |
| `pricing`                 | object             | adjustable totals, markup, discounts           |
| `proofs`                  | Proof[]            |                                                |
| `officialMockups`         | image[]            | staff-uploaded                                 |
| `internalNotes`           | note[]             | staff-only                                     |
| `customerNotes`           | note[]             | customer-facing                                |
| `dueDate`                 | date               | derived from product lead times                |
| `shippingAddress`         | address            |                                                |
| `shippingTracking`        | string             | carrier link                                   |
| `activityLog`             | event[]            | status changes + edits, with actor + timestamp |
| `createdAt` / `updatedAt` | datetime           |                                                |

### 9.7 LineItem

| Field                | Type                   | Notes |
| -------------------- | ---------------------- | ----- |
| `id`                 | id                     |       |
| `productId`          | ref → Product          |       |
| `designId`           | ref → Design           |       |
| `colour`             | colour                 |       |
| `sizeQuantities`     | object                 |       |
| `decorationMethodId` | ref → DecorationMethod |       |
| `unitPrice`          | money                  |       |
| `lineTotal`          | money                  |       |

### 9.8 Proof

| Field                  | Type        | Notes                                  |
| ---------------------- | ----------- | -------------------------------------- |
| `id`                   | id          |                                        |
| `orderId`              | ref → Order |                                        |
| `image`                | image       | the mockup sent                        |
| `status`               | enum        | pending / approved / changes_requested |
| `changeRequestComment` | text        | when changes requested                 |
| `decorationFiles`      | file[]      | print-ready, per method                |
| `createdAt`            | datetime    |                                        |

### 9.9 Customer

| Field                      | Type               | Notes                 |
| -------------------------- | ------------------ | --------------------- |
| `id`                       | id                 |                       |
| `name` / `email` / `phone` | string             |                       |
| `organizationId`           | ref → Organization | optional              |
| `addresses`                | address[]          |                       |
| `paymentMethods`           | paymentMethod[]    |                       |
| `savedArtwork`             | file[]             | logos/artwork on file |
| `savedDesignIds`           | ref[] → Design     | drafts                |
| `notificationPreferences`  | object             | email/SMS per event   |
| `internalNotes`            | note[]             | staff-only            |
| `orderHistory`             | ref[] → Order      | derived               |

### 9.10 Organization

| Field           | Type                 | Notes                          |
| --------------- | -------------------- | ------------------------------ |
| `id`            | id                   |                                |
| `name`          | string               |                                |
| `members`       | {customerId, role}[] | role: admin / member           |
| `sharedArtwork` | file[]               | logos available to all members |
| `brandKit`      | object               | colours + logo                 |

### 9.11 Quote

| Field              | Type           | Notes                                              |
| ------------------ | -------------- | -------------------------------------------------- |
| `id`               | id             |                                                    |
| `customerId`       | ref → Customer |                                                    |
| `lineItems`        | LineItem[]     |                                                    |
| `designIds`        | ref[] → Design |                                                    |
| `pricing`          | object         | bulk-tier pricing                                  |
| `status`           | enum           | requested / sent / accepted / declined / converted |
| `convertedOrderId` | ref → Order    | when accepted                                      |

### 9.12 Staff

| Field            | Type     | Notes               |
| ---------------- | -------- | ------------------- |
| `id`             | id       |                     |
| `name` / `email` | string   |                     |
| `permissions`    | string[] | §1 permission flags |
| `role`           | enum     | staff / staff_admin |

### 9.13 Settings (singleton-ish)

- Decoration methods (collection of DecorationMethod)
- Shipping options & costs
- Tax configuration
- Email templates (keyed by event)

---

## 10. Cross-cutting requirements

### 10.1 Notifications

- Transactional notifications fire on order events (placed, proof ready, changes requested, shipped, etc.), driven by the **email templates** in Settings and gated by the customer's **notification preferences**.
- The same status change that advances the tracker triggers the notification — one event, both effects.

### 10.2 File handling

- Customer-uploaded artwork is stored at **original quality** and retained for reorders.
- Multiple print-ready files may attach to one order (one per decoration method).
- Mockups (customer-built and staff-official) are stored as images.

### 10.3 Pricing integrity

- Every displayed price (designer live price, cart, order, quote) is computed from the same pricing logic: product base + markup + pricing rules + decoration method fees + quantity/bulk tiers.
- The price shown at submit is snapshotted onto the Design/Order so later catalog changes don't retroactively alter a placed order.
- Staff price adjustments on a placed order recompute the order total and any balance due.

### 10.4 Storefront ↔ catalog binding

- The storefront and designer render **only active products** and **live category structure**. No catalog content is hard-coded. Toggling a product or editing a category in Admin is reflected on the storefront without code changes.

### 10.5 Status as single source of truth

- The customer tracker, admin order views, and production board all read the **same order status field**. There is no duplicate state to keep in sync.

### 10.6 Auditability

- Order and proof changes are logged with actor and timestamp for the activity history.

---

## 11. Acceptance summary (build checklist)

A correct implementation satisfies all of the following:

- [ ] Shop All has no separate category landing page; users land on the catalog, see major category tiles + niche sidebar + an "All Products" catch-all, and narrow down from there.
- [ ] Shop All matches the §3.3 wireframe: header (search + cart), category tiles, sidebar (major categories + subsections, then niche items below a divider), a "Top 5 per category" favourites row, and a tab strip that swaps the grid in place with no page reload.
- [ ] Products are imported from the S&S Activewear API (colours/sizes/images/cost pre-filled); re-syncing updates S&S-owned fields without clobbering Admin config; S&S credentials are used server-side only.
- [ ] Clicking any product opens the designer pre-loaded with that product.
- [ ] The designer enforces the product's colours, sizes, print areas, and allowed decoration methods, and shows a live price.
- [ ] The designer renders the S&S garment image as the canvas backdrop (per colour/view), with the Admin-authored print area overlaid in the correct position and aligned across colour and view swaps.
- [ ] A product flagged un-screenprintable never offers screenprint anywhere.
- [ ] Submitting a design creates a Design + Order (or Quote), retains original artwork, and stores a re-editable scene + price snapshot.
- [ ] Deactivating a product in Admin removes it from the storefront and designer with no code change.
- [ ] Editing a product's pricing, lead time, colours, sizes, decoration methods, or category propagates to storefront/designer/quoting/production.
- [ ] The customer portal has exactly: Dashboard, My Orders, My Designs, Account, Help.
- [ ] The animated dog tracker reflects the order's status field in real time.
- [ ] Customers can approve proofs and request changes (with comments) from their account.
- [ ] Customers can pay balances/deposits in-account; payment status reflects in Admin.
- [ ] One-click reorder pre-fills a new order from a past job's saved design/artwork.
- [ ] Saved artwork on file can be reused in the designer without re-uploading.
- [ ] The admin portal has: Dashboard, Orders, Proofs & Artwork, Production, Products, Quotes, Customers, Reports, Settings.
- [ ] Order detail supports line items, pricing/quantity adjustment, official mockup upload, internal + customer notes, status control, payment status, and activity log.
- [ ] Proofs & Artwork receives designer submissions automatically, supports the approval loop, and stores per-method print-ready files with issue flags.
- [ ] Production board moves jobs through stages, shows decoration method per job, and computes due dates from lead times.
- [ ] Products supports add/edit/deactivate and the full product configuration including allowed decoration methods and lead times.
- [ ] Quotes supports request → build (bulk tiers) → convert to order.
- [ ] Customers (CRM) shows profiles, order history, and saved artwork, with org grouping support.
- [ ] Settings configures decoration methods/pricing, shipping, tax, staff permissions, and email templates.
- [ ] Org/team accounts support members, roles, and shared logos/brand kit usable in the designer.
- [ ] Staff permissions are enforced server-side and reflected in the UI.
- [ ] Notifications fire on status changes per templates + customer preferences.
- [ ] All four surfaces read/write the single shared data model in §9.

---

_End of PRD._
