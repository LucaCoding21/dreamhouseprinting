#!/usr/bin/env node
/**
 * Seeds a spread of DEMO orders for the test customer so the customer portal
 * (/account/*) looks populated, dashboard action cards, order list, tracker,
 * proof approval, line items and pricing. Purely for eyeballing the UI.
 *
 * Target: customer@dreamhouse.test (role=customer, pw dreamhouse123).
 * Idempotent: every order it creates is tagged sales_rep='seed-demo'; re-running
 * deletes those first (line_items + proofs cascade) before re-inserting.
 * It never touches real orders (any without that tag).
 *
 * Usage:  node --env-file=.env.local scripts/seed-demo-orders.mjs
 *         node --env-file=.env.local scripts/seed-demo-orders.mjs --clean   # remove demo orders only
 */

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const h = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
const SEED_TAG = "seed-demo";
const CUSTOMER_EMAIL = "customer@dreamhouse.test";
const METHOD_SCREENPRINT = "548687f5-b584-48ff-8e10-6165e6299cdb";

async function rest(path, init = {}) {
  const r = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { ...h, ...(init.headers ?? {}) } });
  if (!r.ok) throw new Error(`${r.status} ${init.method ?? "GET"} ${path}\n${await r.text()}`);
  const text = await r.text();
  return text ? JSON.parse(text) : null;
}

const img = (n) => `https://cdn.ssactivewear.com/Images/Color/${n}_f_fm.jpg`;

// Real seeded products (id, display name, a colour, a CDN photo for the proof).
const P = {
  hoodie: { id: "3d594d6f-e1ae-4b58-b84d-0e0b44ca832a", name: "Unisex Heavy Blend™ Hooded Sweatshirt", colour: { name: "Antique Cherry Red", hex: "#971B2F" }, img: img(33306) },
  tee: { id: "c152e1f2-1279-4eb7-8296-241d2bfedc6a", name: "Unisex Heavy Cotton™ T-Shirt", colour: { name: "Antique Cherry Red", hex: "#971B2F" }, img: img(33476) },
  cvc: { id: "62959ec8-8886-4d27-ab88-73d2f8953109", name: "Unisex CVC T-Shirt", colour: { name: "Apple Green", hex: "#99c221" }, img: img(43895) },
  dadhat: { id: "3125dd3c-dd3b-4439-a076-b800fd5c3814", name: "Peached Cotton Twill Dad Hat", colour: { name: "Black", hex: "#1b151a" }, img: img(64035) },
  midhoodie: { id: "6f626171-399b-4c63-92e5-a81e921b18df", name: "Unisex Midweight Hooded Sweatshirt", colour: { name: "Alpine Green", hex: "#193E34" }, img: img(64737) },
  cap: { id: "d99dc54e-e5eb-4921-9c6e-004362f3acf2", name: "Cotton Blend Cap", colour: { name: "Black", hex: "#1b151a" }, img: img(20234) },
};

const SHIP_ADDR = {
  name: "Test Customer", phone: "(604) 555-0123", company: "",
  street: "323 Alexander St", city: "Vancouver", prov: "BC", postal: "V6A 1C4", country: "CA",
};

const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString();
const inDays = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

/** Build a line item + its pricing contribution. */
function line(p, sizes, unit, setup = 25) {
  const qty = Object.values(sizes).reduce((s, n) => s + n, 0);
  const lineTotal = +(unit * qty + setup).toFixed(2);
  return {
    li: {
      product_id: p.id,
      product_name: p.name,
      colour: p.colour,
      size_quantities: sizes,
      decoration_method_id: METHOD_SCREENPRINT,
      decorations: [{ location: "Front", type: "screenprint", colours: ["#1b1458"] }],
      unit_price: unit,
      setup_fee: setup,
      line_total: lineTotal,
    },
    subtotal: +(unit * qty).toFixed(2),
    setup,
  };
}

/** An order spec: status, payment, when, the line items, and optional proof. */
function pricingOf(lines) {
  const subtotal = +lines.reduce((s, l) => s + l.subtotal, 0).toFixed(2);
  const setupFees = +lines.reduce((s, l) => s + l.setup, 0).toFixed(2);
  const tax = +((subtotal + setupFees) * 0.12).toFixed(2);
  const total = +(subtotal + setupFees + tax).toFixed(2);
  return { subtotal, setupFees, tax, shipping: 0, discount: 0, total };
}

async function main() {
  const clean = process.argv.includes("--clean");

  const [customer] = await rest(`profiles?select=id,email&email=eq.${encodeURIComponent(CUSTOMER_EMAIL)}`);
  if (!customer) throw new Error(`No profile for ${CUSTOMER_EMAIL}`);
  const customerId = customer.id;

  // Remove any previous demo orders (proofs + line_items cascade on delete).
  const existing = await rest(`orders?select=id&customer_id=eq.${customerId}&sales_rep=eq.${SEED_TAG}`);
  if (existing.length) {
    await rest(`orders?customer_id=eq.${customerId}&sales_rep=eq.${SEED_TAG}`, { method: "DELETE" });
    console.log(`Removed ${existing.length} existing demo order(s).`);
  }
  if (clean) {
    console.log("Clean-only run: done.");
    return;
  }

  // status, payment_status, created daysAgo, lines[], optional proof {status, comment}
  const specs = [
    {
      status: "proof_ready", payment_status: "unpaid", ago: 2, due: 9,
      lines: [line(P.hoodie, { S: 4, M: 8, L: 8, XL: 4 }, 34.9)],
      proof: { p: P.hoodie, status: "pending" },
    },
    {
      status: "changes_requested", payment_status: "unpaid", ago: 4, due: 12,
      lines: [line(P.tee, { M: 12, L: 12, XL: 6 }, 16.9)],
      proof: { p: P.tee, status: "changes_requested", comment: "Can we make the logo about 15% bigger and center it a touch higher?" },
    },
    {
      status: "approved", payment_status: "unpaid", ago: 6, due: 8,
      lines: [line(P.dadhat, { OS: 24 }, 21.5), line(P.cap, { OS: 12 }, 18.9)],
    },
    {
      status: "in_production", payment_status: "deposit_paid", ago: 10, due: 4,
      lines: [line(P.cvc, { S: 6, M: 10, L: 10, XL: 6, "2XL": 2 }, 19.9)],
    },
    {
      status: "shipped", payment_status: "paid_in_full", ago: 18, due: -2, tracking: "CP 4210 8877 0193 CA",
      lines: [line(P.midhoodie, { M: 8, L: 8, XL: 4 }, 42.0)],
    },
    {
      status: "completed", payment_status: "paid_in_full", ago: 40, due: -30,
      lines: [line(P.tee, { S: 10, M: 20, L: 20, XL: 10 }, 15.9)],
    },
  ];

  let n = 0;
  for (const s of specs) {
    const pricing = pricingOf(s.lines);
    const [order] = await rest("orders", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify([
        {
          customer_id: customerId,
          status: s.status,
          payment_status: s.payment_status,
          pricing,
          shipping_address: SHIP_ADDR,
          billing_address: SHIP_ADDR,
          fulfillment_method: "ship",
          shipping_method: "standard",
          shipping_tracking: s.tracking ?? null,
          due_date: inDays(s.due),
          sales_rep: SEED_TAG,
          created_at: daysAgo(s.ago),
          updated_at: daysAgo(s.ago),
        },
      ]),
    });

    await rest("line_items", {
      method: "POST",
      body: JSON.stringify(s.lines.map((l) => ({ ...l.li, order_id: order.id }))),
    });

    if (s.proof) {
      await rest("proofs", {
        method: "POST",
        body: JSON.stringify([
          {
            order_id: order.id,
            image: s.proof.p.img,
            status: s.proof.status,
            change_request_comment: s.proof.comment ?? null,
            created_at: daysAgo(s.ago),
          },
        ]),
      });
    }

    n++;
    console.log(`  ${order.order_number}  ${s.status}  ${s.payment_status}  (${s.lines.length} item${s.lines.length > 1 ? "s" : ""})`);
  }

  console.log(`\nSeeded ${n} demo orders for ${CUSTOMER_EMAIL}. Log in with pw "dreamhouse123" and open /account.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
