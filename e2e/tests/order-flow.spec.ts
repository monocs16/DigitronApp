import { test, expect } from "@playwright/test";
import { labels } from "../helpers/labels";
import { gotoNewOrderForm, gotoOrderDetail, waitForAdminOrderAccess } from "../helpers/page";
import { createIntakeOrderFromSeed } from "../helpers/order-ui";
import {
  deleteTestCustomer,
  getServiceRoleKey,
  seedTestCustomerEquipment,
  seedTestOrder,
  updateTestOrderStage,
} from "../helpers/seed";

test.describe("Admin — order flow", () => {
  test("orders list page renders and is accessible", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.locator("main")).toBeVisible();
  });

  test("new order form renders with all required fields", async ({ page }) => {
    await gotoNewOrderForm(page);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByRole("combobox").first()).toBeVisible();
    await expect(page.getByRole("button", { name: labels.orders.createOrder })).toBeVisible();
  });

  test("admin sees new-order action on orders list", async ({ page }) => {
    await page.goto("/orders");
    await waitForAdminOrderAccess(page);
  });

  test("admin can create a new service order", async ({ page }) => {
    if (!getServiceRoleKey()) {
      test.skip(true, "SUPABASE_SERVICE_ROLE_KEY not set — skipping cleanup-dependent test");
    }

    const { clientId, equipmentId } = await createIntakeOrderFromSeed(page);
    try {
      await expect(page.getByText(labels.stage.evaluation).first()).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await deleteTestCustomer(clientId, equipmentId);
    }
  });
});

test.describe("Admin — order detail stage actions", () => {
  test.beforeEach(() => {
    if (!getServiceRoleKey()) {
      test.skip(true, "SUPABASE_SERVICE_ROLE_KEY not set — skipping cleanup-dependent tests");
    }
  });

  test("send to evaluation button is visible on intake stage order", async ({ page }) => {
    const { clientId, equipmentId } = await seedTestCustomerEquipment();
    const order = await seedTestOrder(clientId, equipmentId, "intake", "E2E fault");
    try {
      await gotoOrderDetail(page, order.id);
      await expect(page.getByRole("button", { name: labels.orders.sendToEvaluation })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(labels.stage.intake).first()).toBeVisible();
    } finally {
      await deleteTestCustomer(clientId, equipmentId);
    }
  });

  test("admin can advance intake order to evaluation stage", async ({ page }) => {
    const { clientId, equipmentId } = await seedTestCustomerEquipment();
    const order = await seedTestOrder(clientId, equipmentId, "intake", "E2E fault");
    try {
      await gotoOrderDetail(page, order.id);
      await expect(page.getByRole("button", { name: labels.orders.sendToEvaluation })).toBeVisible({
        timeout: 15_000,
      });

      await page.getByRole("button", { name: labels.orders.sendToEvaluation }).click();

      await expect(page.getByText(labels.stage.evaluation, { exact: true }).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(
        page.getByRole("button", { name: labels.orders.sendToEvaluation }),
      ).not.toBeVisible();
    } finally {
      await deleteTestCustomer(clientId, equipmentId);
    }
  });

  test("closed order shows no action buttons", async ({ page }) => {
    const { clientId, equipmentId } = await seedTestCustomerEquipment();
    const order = await seedTestOrder(clientId, equipmentId, "intake", "E2E fault");
    try {
      await updateTestOrderStage(order.id, "closed");
      await gotoOrderDetail(page, order.id);

      await expect(page.getByText(labels.stage.closed).first()).toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByRole("button", { name: labels.orders.sendToEvaluation }),
      ).not.toBeVisible();
      await expect(page.getByRole("button", { name: labels.orders.closeOrder })).not.toBeVisible();
    } finally {
      await deleteTestCustomer(clientId, equipmentId);
    }
  });
});
