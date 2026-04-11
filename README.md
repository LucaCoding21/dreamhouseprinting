# Dreamhouse Printing

Quote form for Julian's custom print shop. Customers fill out a 5-step form and the submission lands in Supabase + gets emailed to Julian via Resend.

## Stack

- Next.js 16 (App Router) + TypeScript
- Tailwind v4
- Supabase (Postgres + Storage) for submissions and file uploads
- Resend for email notifications

## Quick start

```bash
npm install
# .env.local is already populated — fill in JULIAN_NOTIFY_EMAIL if empty
npm run setup   # creates the storage bucket
# Then run the SQL below in the Supabase SQL editor to create the table
npm run dev     # http://localhost:3000
```

## Environment variables

All in `.env.local` (see `.env.example`):

| Var                         | Purpose                                                     |
| --------------------------- | ----------------------------------------------------------- |
| `SUPABASE_URL`              | Project URL                                                 |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only, used to insert submissions + upload files      |
| `SUPABASE_ANON_KEY`         | Not currently used, kept for future client-side features    |
| `RESEND_API_KEY`            | API key from resend.com                                     |
| `JULIAN_NOTIFY_EMAIL`       | Inbox that receives new quote requests                      |
| `RESEND_FROM_EMAIL`         | Verified sender domain (or `onboarding@resend.dev` for dev) |

If Supabase or Resend env vars are missing, the API route falls back to logging submissions to the server console — the form still works end-to-end locally.

## Supabase setup

1. **Storage bucket** — `npm run setup` creates the private `quote-files` bucket.
2. **Submissions table** — paste the SQL below into the Supabase SQL editor (_Database → SQL editor_) and run it:

```sql
create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  name text not null,
  email text not null,
  phone text not null,
  referral_code text,

  product_type text not null,
  garment_color text not null,
  quantity integer,

  print_colors text not null,
  print_locations text[] not null default '{}',
  print_method text not null,

  design_description text,
  needed_by date,
  notes text,

  artwork_files jsonb not null default '[]'::jsonb,
  price_match_files jsonb not null default '[]'::jsonb
);

-- RLS: lock it down. Only service role (used by the API route) can read/write.
alter table public.submissions enable row level security;
-- No policies = denied for anon/authenticated. Service role bypasses RLS.

create index if not exists submissions_created_at_idx
  on public.submissions (created_at desc);
```

3. After running the SQL, verify with `npm run setup` — you should see `✓ submissions table is reachable.`

## Resend setup

- In dev, Resend only delivers to the inbox of the account owner when using `onboarding@resend.dev`. To send to any address, verify a domain (e.g. `dreamhouseprinting.com`) in Resend and set `RESEND_FROM_EMAIL` to a verified sender like `quotes@dreamhouseprinting.com`.
- The API route passes `replyTo` = the customer's email, so Julian can reply straight from his inbox.

## Project layout

```
src/
  app/
    api/submit/route.ts   # POST endpoint — saves to Supabase + emails Julian
    layout.tsx            # Archivo + Inter fonts, lavender background
    page.tsx              # Renders the QuoteForm
    globals.css           # Tailwind + Dreamhouse palette
  components/
    QuoteForm.tsx         # Multi-step form (5 steps, progress bar, file uploads)
  lib/
    formTypes.ts          # Shared types + option lists
    supabase.ts           # Server-side Supabase client (null if env missing)
public/
  dreamhouse-logo.svg     # Solo Logo from Julian, tinted purple
scripts/
  setup-supabase.mjs      # Creates the quote-files bucket
```

## How the form works

Five steps, mobile-first, one screen at a time with a progress bar:

1. **Contact** — name, email, phone, optional referral/promo code
2. **Product** — garment type, color (free text + color chips), quantity
3. **Print** — number of print colors, locations (multi-select), method (screen / embroidery / DTG / not sure)
4. **Artwork** — file upload (PNG, JPG, PDF, AI, EPS up to 25MB each) + optional description
5. **Timeline** — needed-by date, notes, and optional price-match upload

On submit:

1. Form data + files POST to `/api/submit` as `multipart/form-data`
2. Route inserts a row into `public.submissions`, uploads files to `quote-files/{submissionId}/artwork/*` and `.../price-match/*`, and stores signed URLs in the row
3. Resend emails Julian a formatted summary with clickable file links (30-day signed URLs)
4. User sees the "Got it!" success screen

## Deploy

Works as-is on Vercel. Set the same env vars in the Vercel project settings. The API route uses the Node.js runtime (`export const runtime = "nodejs"`) so multipart uploads work.
