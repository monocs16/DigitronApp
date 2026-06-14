#!/usr/bin/env node
/**
 * Idempotently ensures a super-admin user exists in the target Supabase
 * (intended for the LOCAL stack). Safe to run repeatedly.
 *
 * Required env: API_URL, SERVICE_ROLE_KEY
 * Optional env: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 */
const API_URL = process.env.API_URL;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL || "admin@digitron.test";
const password = process.env.ADMIN_PASSWORD || "digitron123";
const full_name = process.env.ADMIN_NAME || "Admin Digitron";

if (!API_URL || !SERVICE_ROLE_KEY) {
  console.error("seed-admin: API_URL and SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function main() {
  // 1. Create the auth user (auto-confirmed). Ignore "already exists".
  const created = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name } }),
  });
  if (created.status !== 200 && created.status !== 201) {
    const body = await created.json().catch(() => ({}));
    const msg = `${body.msg || body.error_description || body.error || ""}`.toLowerCase();
    const exists = /already|registered|exists/.test(msg);
    if (!exists) {
      throw new Error(`create user failed (${created.status}): ${JSON.stringify(body)}`);
    }
  }

  // 2. Resolve the user id (profile is created by the signup trigger).
  const pr = await fetch(
    `${API_URL}/rest/v1/profiles?select=id&email=eq.${encodeURIComponent(email)}`,
    { headers },
  );
  if (!pr.ok) throw new Error(`lookup profile failed (${pr.status}): ${await pr.text()}`);
  const [profile] = await pr.json();
  if (!profile?.id) throw new Error("could not resolve admin user id");

  // 3. Ensure the super role (idempotent on the (user_id, role) unique key).
  const rr = await fetch(`${API_URL}/rest/v1/user_roles?on_conflict=user_id,role`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: profile.id, role: "super" }),
  });
  if (!rr.ok) throw new Error(`set super role failed (${rr.status}): ${await rr.text()}`);

  console.log(`✓ super admin ready → ${email} / ${password}`);
}

main().catch((e) => {
  console.error(`seed-admin failed: ${e.message}`);
  process.exit(1);
});
