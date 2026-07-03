#!/usr/bin/env node
/**
 * Creates (or updates) a staff_admin account so the admin portal can be used.
 * Uses the service-role key + GoTrue admin API. The on_auth_user_created trigger
 * auto-creates the profile row; this script promotes it to staff_admin.
 *
 * Usage: node --env-file=.env.local scripts/seed-staff.mjs [email] [password] [name]
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const email = process.argv[2] ?? "julian@dreamhouse.test";
const password = process.argv[3] ?? "dreamhouse123";
const name = process.argv[4] ?? "Julian";

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function findUserByEmail(target) {
  // Paginate the admin user list (small project).
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) break;
  }
  return null;
}

let userId;
const { data: created, error } = await supabase.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { name },
});

if (error) {
  if (/already|registered|exists/i.test(error.message)) {
    const existing = await findUserByEmail(email);
    if (!existing) {
      console.error("User exists but could not be located:", error.message);
      process.exit(1);
    }
    userId = existing.id;
    // Reset the password so the known credentials work.
    await supabase.auth.admin.updateUserById(userId, { password, email_confirm: true });
    console.log(`Reusing existing auth user ${email}`);
  } else {
    console.error("createUser failed:", error.message);
    process.exit(1);
  }
} else {
  userId = created.user.id;
  console.log(`Created auth user ${email}`);
}

const PERMS = [
  "orders.view", "orders.edit", "orders.pricing", "proofs.manage", "production.manage",
  "products.manage", "quotes.manage", "customers.view", "customers.edit", "reports.view",
  "settings.manage", "staff.manage",
];

const { error: upErr } = await supabase
  .from("profiles")
  .update({ role: "staff_admin", name, staff_permissions: PERMS })
  .eq("id", userId);

if (upErr) {
  console.error("Failed to promote profile:", upErr.message);
  process.exit(1);
}

console.log(`✓ ${email} is now staff_admin (password: ${password})`);
