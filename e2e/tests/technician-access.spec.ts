import { test, expect } from "@playwright/test";
import { labels } from "../helpers/labels";
import {
  skipIfNoTechnicianSession,
  waitForAuthenticatedShell,
} from "../helpers/technician-session";

/**
 * Technician role E2E tests.
 *
 * These run under the `technician` Playwright project (storageState = technician-state.json).
 * If no technician account is configured (E2E_TECH_EMAIL / E2E_TECH_PASSWORD), the setup
 * project writes an empty storage state and these tests skip when login is shown.
 */

test.describe("Technician — access restrictions", () => {
  test("technician session is authenticated or skipped gracefully", async ({ page }) => {
    await skipIfNoTechnicianSession(page);
    await waitForAuthenticatedShell(page);
  });

  test("technician does not see admin-only navigation items", async ({ page }) => {
    await skipIfNoTechnicianSession(page);

    await expect(page.getByRole("link", { name: labels.sidebar.users })).not.toBeVisible();
  });

  test("technician cannot see new order button", async ({ page }) => {
    await skipIfNoTechnicianSession(page);

    await expect(page.getByRole("link", { name: labels.orders.newOrder })).not.toBeVisible();
  });
});
