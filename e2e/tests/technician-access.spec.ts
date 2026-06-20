import { test, expect } from "@playwright/test";

/**
 * Technician role E2E tests.
 *
 * These run under the `technician` Playwright project (storageState = technician-state.json).
 * If no technician account is configured (E2E_TECH_EMAIL / E2E_TECH_PASSWORD), the global
 * setup writes an empty storage state and these tests will redirect to /login — in that case
 * the tests are skipped individually via URL check.
 */

test.describe("Technician — access restrictions", () => {
  test("technician session is authenticated or skipped gracefully", async ({ page }) => {
    await page.goto("/orders");
    if (page.url().includes("/login")) {
      test.skip(true, "No technician session available (not seeded). Skipping role-gate tests.");
    }
    await expect(page.locator("main")).toBeVisible();
  });

  test("technician does not see admin-only navigation items", async ({ page }) => {
    await page.goto("/orders");
    if (page.url().includes("/login")) {
      test.skip(true, "No technician session — skipping.");
    }

    // Security settings should not be visible for technician role
    await expect(page.getByRole("link", { name: /security|settings|usuarios/i })).not.toBeVisible();
  });

  test("technician cannot see new order button", async ({ page }) => {
    await page.goto("/orders");
    if (page.url().includes("/login")) {
      test.skip(true, "No technician session — skipping.");
    }

    // Technician has no os_apertura create permission
    await expect(page.getByRole("link", { name: /new order/i })).not.toBeVisible();
  });
});

// These tests use the admin project to seed a test order assigned to a known tech user.
// They verify what the technician sees — but since we only have the admin session for
// seeding, these are kept in the admin project instead.
// See order-flow.spec.ts for admin-perspective assertions.
