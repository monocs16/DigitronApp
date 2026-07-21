import { test, expect } from "@playwright/test";
import { labels } from "../helpers/labels";
import {
  skipIfNoTechnicianSession,
  waitForAuthenticatedShell,
} from "../helpers/technician-session";
import {
  deleteTestCustomer,
  deleteTestPartByCode,
  getTestTechnicianId,
  seedTestCustomerEquipment,
  seedTestOrder,
} from "../helpers/seed";

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

  test("assigned technician can create an inventory part during evaluation", async ({ page }) => {
    await skipIfNoTechnicianSession(page);
    const technicianId = await getTestTechnicianId();
    const { clientId, equipmentId } = await seedTestCustomerEquipment();
    const order = await seedTestOrder(
      clientId,
      equipmentId,
      "evaluation",
      "E2E evaluation part",
      technicianId,
    );
    const partCode = `EVAL-${Date.now()}`;

    try {
      await page.goto(`/orders/${order.id}`);
      await page.getByRole("button", { name: "Nuevo repuesto" }).click();

      const dialog = page.getByRole("dialog", { name: "Nuevo repuesto" });
      await dialog.getByLabel("Código *").fill(partCode);
      await dialog.getByLabel("Descripción *").fill("Repuesto creado desde evaluación");
      await expect(dialog.getByLabel("Proveedor")).not.toBeVisible();
      await expect(dialog.getByLabel("Costo unitario")).not.toBeVisible();
      await expect(dialog.getByLabel("Stock")).not.toBeVisible();
      await dialog.getByRole("button", { name: labels.common.save }).click();

      await expect(dialog).not.toBeVisible();
      await expect(page.getByText(partCode, { exact: false }).first()).toBeVisible();
    } finally {
      await deleteTestCustomer(clientId, equipmentId);
      await deleteTestPartByCode(partCode);
    }
  });
});
