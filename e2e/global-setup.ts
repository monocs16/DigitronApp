import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export const STATUS_FILE = join(__dirname, ".supabase-status.json");
const E2E_ENV_FILE = join(__dirname, "..", ".env.e2e.local");

/** Must match `supabase/config.toml` [api].port offset. */
const EXPECTED_API_URL = "http://127.0.0.1:55321";
const EXPECTED_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

function sh(cmd: string, args: string[]): string {
  return execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function dockerRunning(): boolean {
  try {
    sh("docker", ["info"]);
    return true;
  } catch {
    return false;
  }
}

function supabaseStatusJson(): Record<string, string> | null {
  try {
    const out = sh("supabase", ["status", "-o", "json"]);
    return JSON.parse(out) as Record<string, string>;
  } catch {
    return null;
  }
}

async function waitForSupabaseStatus(): Promise<Record<string, string>> {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const status = supabaseStatusJson();
    const apiUrl = status?.API_URL ?? status?.api_url;
    const serviceRoleKey = status?.SERVICE_ROLE_KEY ?? status?.service_role_key;
    if (status && apiUrl && serviceRoleKey) return status;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("[e2e] Timed out waiting for local Supabase API credentials.");
}

function seedAdmin(apiUrl: string, serviceRoleKey: string): void {
  execFileSync("node", ["scripts/seed-admin.mjs"], {
    stdio: "inherit",
    env: {
      ...process.env,
      API_URL: apiUrl,
      SERVICE_ROLE_KEY: serviceRoleKey,
    },
  });
}

function writeE2eEnv(apiUrl: string, anonKey: string, serviceRoleKey: string): void {
  writeFileSync(
    E2E_ENV_FILE,
    [
      `VITE_SUPABASE_URL=${apiUrl}`,
      `VITE_SUPABASE_PUBLISHABLE_KEY=${anonKey}`,
      `SUPABASE_URL=${apiUrl}`,
      `SUPABASE_PUBLISHABLE_KEY=${anonKey}`,
      `SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey}`,
      "",
    ].join("\n"),
  );
}

export default async function globalSetup(): Promise<void> {
  if (process.env.SKIP_E2E_SETUP === "1") {
    console.log("[e2e] SKIP_E2E_SETUP=1 — skipping Supabase bootstrap.");
    const status = supabaseStatusJson();
    if (!status) {
      throw new Error(
        "[e2e] SKIP_E2E_SETUP=1 but local Supabase is not running. Run: pnpm run supabase:start",
      );
    }
    const apiUrl = status.API_URL ?? status.api_url;
    const serviceRoleKey = status.SERVICE_ROLE_KEY ?? status.service_role_key;
    const anonKey = status.ANON_KEY ?? status.anon_key;
    if (!apiUrl || !serviceRoleKey) {
      throw new Error("[e2e] Could not read API_URL / SERVICE_ROLE_KEY from `supabase status`.");
    }
    const resolvedAnonKey = anonKey ?? EXPECTED_ANON_KEY;
    writeE2eEnv(apiUrl, resolvedAnonKey, serviceRoleKey);
    writeFileSync(
      STATUS_FILE,
      JSON.stringify({ apiUrl, serviceRoleKey, anonKey: resolvedAnonKey }, null, 2),
    );
    return;
  }

  if (!dockerRunning()) {
    throw new Error(
      "[e2e] Docker is not running. Start Docker Desktop, then re-run `pnpm test:e2e`.",
    );
  }

  let status = supabaseStatusJson();
  if (!status) {
    console.log("[e2e] Starting local Supabase…");
    sh("supabase", ["start"]);
  }

  console.log("[e2e] Resetting local database (re-applying migrations)…");
  sh("supabase", ["db", "reset"]);

  status = await waitForSupabaseStatus();

  const apiUrl = status.API_URL ?? status.api_url;
  const serviceRoleKey = status.SERVICE_ROLE_KEY ?? status.service_role_key;
  const anonKey = status.ANON_KEY ?? status.anon_key;

  if (!apiUrl || !serviceRoleKey) {
    throw new Error("[e2e] Could not read API_URL / SERVICE_ROLE_KEY from `supabase status`.");
  }

  if (apiUrl !== EXPECTED_API_URL) {
    throw new Error(
      `[e2e] Local API URL is ${apiUrl}, expected ${EXPECTED_API_URL}. ` +
        "Update EXPECTED_API_URL in e2e/global-setup.ts to match supabase/config.toml.",
    );
  }

  if (anonKey && anonKey !== EXPECTED_ANON_KEY) {
    throw new Error(
      "[e2e] Local anon key from `supabase status` does not match the expected local key. " +
        "Update EXPECTED_ANON_KEY in e2e/global-setup.ts.",
    );
  }

  const resolvedAnonKey = anonKey ?? EXPECTED_ANON_KEY;
  writeE2eEnv(apiUrl, resolvedAnonKey, serviceRoleKey);

  console.log("[e2e] Seeding admin + technician test users…");
  seedAdmin(apiUrl, serviceRoleKey);

  writeFileSync(
    STATUS_FILE,
    JSON.stringify({ apiUrl, serviceRoleKey, anonKey: resolvedAnonKey }, null, 2),
  );
  console.log(`[e2e] Local Supabase ready at ${apiUrl}.`);
}
