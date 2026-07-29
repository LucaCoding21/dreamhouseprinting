# Julian call notes, 2026-07-27

## What's new (shipped and browser-tested from your last feedback batch)

### Admin
- **Top bar navigation** replaced the sidebar. Pages are full-width now, so orders and line items get all the horizontal space.
- **Dashboard queues cap at 7 rows** with a "View all N" link into the filtered orders list. A 40-order Needs proof queue no longer swallows the dashboard.
- **Manual order creation** ("New order" button on the Orders page): create an order for phone/DM/walk-in customers. Pick an existing account or type name + email, add catalog products (real tier pricing auto-suggested, still editable) or freeform off-catalog items, pickup or shipping, optional confirmation email (off by default). The customer-facing link works immediately.

### Order page
- **Order total, production stage, and payment status pinned at the top.** No more scrolling to see where a job stands.
- **Move an order to ANY stage, including backwards** (production back to mockup, shipped back for a reprint). Backward moves ask for confirmation first and get logged in the activity.
- **Supplier dropdown on every line item** (S&S Activewear, SanMar, Alphabroder, Stormtech, Other) plus a **"Mark fulfilled" toggle** per line.
- **Multiple discounts and fees**: named rows in the pricing card (e.g. "Repeat customer discount -$25", "Art digitizing fee +$15"). They show itemized on the customer's page and Stripe charges the updated total automatically.
- **Tax auto-calculates from the shipping province** (ON 13, BC 12, QC 14.975, and so on). Pickup defaults to BC. Still manually editable when you need to override.
- **Compact inputs**: quantity boxes, width/height (fits values like 14.325), and colour boxes (2 digits) are sized to their content. Less dead space.
- **"All artwork on one page"**: one printable page per order with every customer upload, placed art piece, and mockup, labeled by item. One copy-paste into Illustrator instead of many.
- **Customer view link at the bottom of every order**: "View this order as the customer sees it" plus a copy button.

### Quick quote (home page)
- **"Number of locations" is gone.** You add prints one at a time, each with its own location and its own colour count. Each print shows its own price line, so the math is finally visible.

## Needs your sign-off

1. **Price change on the quick quote.** Colour surcharge now applies PER PRINT. Front 3-colour + back 3-colour pays the colour surcharge twice (matches burning screens per location). The old model charged it once no matter how many locations, so multi-print jobs now quote higher. OK, or revert to one global colour charge?
2. **Backward status moves email the customer** like any other status change. Fine, or do you want a "move silently" option?
3. **Supplier list**: S&S Activewear, SanMar, Alphabroder, Stormtech, Other. Anyone missing?
4. **Tax logic**: shipping orders use the destination province, pickup uses BC. Confirm that is how you want tax handled (vs always BC).
5. **Comparison page** (like the T-shirt Elephant "vs Coastal Reign" page): worth building, but I need the claims to be true. What are our real minimums, turnaround, price position, free shipping threshold, proof policy?
6. **Your photo PDFs never arrived.** Resend them.
7. **The $80 Coastal Reign test order**: still on. Either you place it and screenshot every email plus the order page at each stage, or we do it together on a screen share. The goal is their status-email cadence and proof-approval flow.
8. **Multi-person editing**: designed, not built yet. Plan: two people editing different things (shipping vs mockups) both save fine; a save that conflicts with something already locked in (print size after production started) gets rejected with a "reload first" message. Confirm that is the behavior you want.
9. **Housekeeping**: the dashboard "Awaiting payment" and "E-transfers to verify" queues currently open the broader Production tab of the orders list. Want dedicated tabs for them?
