import type { Page } from "@playwright/test";
import { expect, test } from "@playwright/test";

/** Skip technician tests when no technician account/session is available. */
export async function skipIfNoTechnicianSession(page: Page): Promise<void> {
  await page.goto("/orders", { waitUntil: "load" });

  const loginEmail = page.locator('input[type="email"]');
  const main = page.locator("main");

  const outcome = await Promise.race([
    loginEmail.waitFor({ state: "visible", timeout: 15_000 }).then(() => "login" as const),
    main.waitFor({ state: "visible", timeout: 15_000 }).then(() => "app" as const),
  ]).catch(() => "login" as const);

  if (outcome === "login") {
    test.skip(true, "No technician session available (not seeded). Skipping role-gate tests.");
  }
}

export async function waitForAuthenticatedShell(page: Page): Promise<void> {
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
}
