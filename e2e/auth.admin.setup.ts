import { test as setup } from "@playwright/test";
import { waitForAdminRoles } from "./helpers/page";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@digitron.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "digitron123";

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/login", { waitUntil: "load" });

  const emailInput = page.locator('input[type="email"]');
  const passwordInput = page.locator('input[type="password"]');

  await emailInput.waitFor({ state: "visible", timeout: 30_000 });
  await passwordInput.waitFor({ state: "visible", timeout: 10_000 });

  await emailInput.fill(ADMIN_EMAIL);
  await passwordInput.fill(ADMIN_PASSWORD);
  await page.click('button[type="submit"]');

  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });
  await waitForAdminRoles(page);
  await page.context().storageState({ path: "e2e/fixtures/admin-state.json" });
});
