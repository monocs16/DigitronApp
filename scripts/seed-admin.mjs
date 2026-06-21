#!/usr/bin/env node
/**
 * Idempotently ensures a super-admin user exists in the target Supabase
 * (intended for the LOCAL stack). Safe to run repeatedly.
 *
 * Required env: API_URL, SERVICE_ROLE_KEY
 * Optional env: ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME,
 *               TECH_EMAIL, TECH_PASSWORD, TECH_NAME
 */
const API_URL = process.env.API_URL;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
const email = process.env.ADMIN_EMAIL || "admin@digitron.test";
const password = process.env.ADMIN_PASSWORD || "digitron123";
const full_name = process.env.ADMIN_NAME || "Admin Digitron";
const techEmail = process.env.TECH_EMAIL || "tech@digitron.test";
const techPassword = process.env.TECH_PASSWORD || "digitron123";
const techName = process.env.TECH_NAME || "Technician Digitron";

if (!API_URL || !SERVICE_ROLE_KEY) {
  console.error("seed-admin: API_URL and SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

async function ensureUser({ userEmail, userPassword, userName, role }) {
  const created = await fetch(`${API_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: userEmail,
      password: userPassword,
      email_confirm: true,
      user_metadata: { full_name: userName },
    }),
  });
  if (created.status !== 200 && created.status !== 201) {
    const body = await created.json().catch(() => ({}));
    const msg = `${body.msg || body.error_description || body.error || ""}`.toLowerCase();
    const exists = /already|registered|exists/.test(msg);
    if (!exists) {
      throw new Error(`create user failed (${created.status}): ${JSON.stringify(body)}`);
    }
  }

  const pr = await fetch(
    `${API_URL}/rest/v1/profiles?select=id&email=eq.${encodeURIComponent(userEmail)}`,
    { headers },
  );
  if (!pr.ok) throw new Error(`lookup profile failed (${pr.status}): ${await pr.text()}`);
  const [profile] = await pr.json();
  if (!profile?.id) throw new Error(`could not resolve user id for ${userEmail}`);

  const rr = await fetch(`${API_URL}/rest/v1/user_roles?on_conflict=user_id,role`, {
    method: "POST",
    headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ user_id: profile.id, role }),
  });
  if (!rr.ok) throw new Error(`set ${role} role failed (${rr.status}): ${await rr.text()}`);

  console.log(`✓ ${role} user ready → ${userEmail} / ${userPassword}`);
}

async function main() {
  await ensureUser({ userEmail: email, userPassword: password, userName: full_name, role: "super" });
  await ensureUser({
    userEmail: techEmail,
    userPassword: techPassword,
    userName: techName,
    role: "tecnico",
  });
}

main().catch((e) => {
  console.error(`seed-admin failed: ${e.message}`);
  process.exit(1);
});
