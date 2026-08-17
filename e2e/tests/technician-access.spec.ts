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
    await expect(page.getByText("O3S v1.0", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Manual de Usuario" })).toBeVisible();
  });

  test("technician does not see admin-only navigation items", async ({ page }) => {
    await skipIfNoTechnicianSession(page);

    await expect(page.getByRole("link", { name: labels.sidebar.users })).not.toBeVisible();
  });

  test("technician cannot see new order button", async ({ page }) => {
    await skipIfNoTechnicianSession(page);

    await expect(page.getByRole("link", { name: labels.orders.newOrder })).not.toBeVisible();
  });

  test("paginated orders keep the assigned-technician RLS restriction", async ({ page }) => {
    await skipIfNoTechnicianSession(page);
    const technicianId = await getTestTechnicianId();
    const assignedSeed = await seedTestCustomerEquipment();
    const unassignedSeed = await seedTestCustomerEquipment();

    try {
      const assignedOrder = await seedTestOrder(
        assignedSeed.clientId,
        assignedSeed.equipmentId,
        "evaluation",
        "E2E assigned paginated order",
        technicianId,
      );
      const unassignedOrder = await seedTestOrder(
        unassignedSeed.clientId,
        unassignedSeed.equipmentId,
        "evaluation",
        "E2E unassigned paginated order",
      );

      await page.goto("/orders");
      const card = page.getByTestId("orders-list-card");
      await expect(card.getByText(assignedOrder.order_number, { exact: true })).toBeVisible();
      await expect(card.getByText(unassignedOrder.order_number, { exact: true })).toHaveCount(0);
    } finally {
      await deleteTestCustomer(assignedSeed.clientId, assignedSeed.equipmentId);
      await deleteTestCustomer(unassignedSeed.clientId, unassignedSeed.equipmentId);
    }
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
    const datasheet = "https://example.com/technician-datasheet.pdf";
    const image = "https://example.com/technician-part.jpg";

    try {
      await page.goto(`/orders/${order.id}`);
      await page.getByRole("button", { name: "Nuevo repuesto" }).click();

      const dialog = page.getByRole("dialog", { name: "Nuevo repuesto" });
      await dialog.getByLabel("Código *").fill(partCode);
      await dialog.getByLabel("Ubicación").fill("Taller B-2");
      await dialog.getByLabel("Descripción *").fill("Repuesto creado desde evaluación");
      await dialog.getByLabel("Ficha técnica").fill(datasheet);
      await dialog.getByLabel("NTE (sustituto)").fill("NTE-TECH-1");
      await dialog.getByLabel("Imagen").fill(image);
      await expect(dialog.getByLabel("Proveedor")).not.toBeVisible();
      await expect(dialog.getByLabel("Costo unitario")).not.toBeVisible();
      await expect(dialog.getByLabel("Stock")).not.toBeVisible();
      await dialog.getByRole("button", { name: labels.common.save }).click();

      await expect(dialog).not.toBeVisible();

      const evaluationCard = page.getByTestId("evaluation-card");
      const requiredParts = evaluationCard.getByRole("combobox", {
        name: "Repuestos requeridos",
      });
      await requiredParts.click();
      await page.getByRole("option").filter({ hasText: partCode }).click();
      await evaluationCard.getByRole("button", { name: "Agregar", exact: true }).click();

      await expect(
        evaluationCard.locator("ul").getByText(partCode, { exact: false }),
      ).toBeVisible();

      await page.goto("/inventory");
      const inventoryCard = page.getByTestId("inventory-list-card");
      await inventoryCard.getByLabel("Buscar en el catálogo").fill(partCode);
      await inventoryCard.getByRole("button", { name: "Buscar" }).click();
      const inventoryRow = inventoryCard.getByRole("row").filter({ hasText: partCode });
      await expect(inventoryRow).toContainText("Taller B-2");
      await expect(inventoryRow).toContainText("NTE-TECH-1");
      await expect(inventoryRow.getByRole("link", { name: "Ver ficha" })).toHaveAttribute(
        "href",
        datasheet,
      );
      await expect(inventoryRow.getByRole("link", { name: "Ver imagen" })).toHaveAttribute(
        "href",
        image,
      );
      await expect(page.getByRole("columnheader", { name: "Stock" })).not.toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Costo unitario" })).not.toBeVisible();
      await expect(page.getByRole("columnheader", { name: "Proveedor" })).not.toBeVisible();
    } finally {
      await deleteTestCustomer(clientId, equipmentId);
      await deleteTestPartByCode(partCode);
    }
  });
});
