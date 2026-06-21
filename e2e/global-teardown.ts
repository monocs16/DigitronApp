import { execFileSync } from "node:child_process";

/**
 * Stops the local Supabase stack after the Playwright run when we started it.
 * Set SKIP_E2E_TEARDOWN=1 to leave the stack running (faster local re-runs).
 */
export default async function globalTeardown(): Promise<void> {
  if (process.env.SKIP_E2E_TEARDOWN === "1" || process.env.SKIP_E2E_SETUP === "1") {
    console.log("[e2e] Skipping Supabase teardown.");
    return;
  }

  console.log("[e2e] Stopping local Supabase…");
  try {
    execFileSync("supabase", ["stop"], { stdio: "inherit" });
    console.log("[e2e] Local Supabase stopped.");
  } catch {
    console.warn("[e2e] Supabase stop failed (stack may already be stopped).");
  }
}
