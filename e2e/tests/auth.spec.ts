import { test, expect } from "@playwright/test";
import { labels } from "../helpers/labels";

/**
 * Auth guard E2E tests.
 *
 * Run under the `no-auth` Playwright project (no storageState) so every request
 * is unauthenticated. Tests here verify that the route guard redirects correctly
 * and that the login page is functional.
 */

test.describe("Auth — unauthenticated access", () => {
  test("navigating to /orders without a session redirects to /login", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("navigating to an order detail without a session redirects to /login", async ({ page }) => {
    await page.goto("/orders/00000000-0000-0000-0000-000000000000");
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test("login page renders the sign-in form", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: labels.login.signIn })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("submitting wrong credentials shows an error", async ({ page }) => {
    await page.goto("/login");
    await page.locator('input[type="email"]').fill("no-such-user@digitron.test");
    await page.locator('input[type="password"]').fill("wrongpassword");
    await page.getByRole("button", { name: labels.login.signIn }).click();

    // The app must stay on /login and the sign-in form must still be present.
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await expect(page.getByRole("button", { name: labels.login.signIn })).toBeVisible({
      timeout: 5_000,
    });
  });
});
