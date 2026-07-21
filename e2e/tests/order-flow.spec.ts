import { test, expect } from "@playwright/test";
import { labels } from "../helpers/labels";
import { gotoNewOrderForm, gotoOrderDetail, waitForAdminOrderAccess } from "../helpers/page";
import { createIntakeOrderFromSeed } from "../helpers/order-ui";
import {
  deleteTestCustomer,
  deleteTestPartByCode,
  getServiceRoleKey,
  seedTestBudget,
  seedTestCustomerEquipment,
  seedTestEvaluation,
  seedTestOrder,
  seedTestOrderPart,
  seedTestPart,
  seedTestPayment,
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

  test("unsaved text persists when the browser tab regains focus", async ({ page }) => {
    await gotoNewOrderForm(page);
    const problem = page.getByLabel(/Problema reportado/);
    const draft = "Texto sin guardar que debe sobrevivir al cambio de pestaña";
    await problem.fill(draft);

    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await page.waitForTimeout(100);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    await page.waitForTimeout(750);
    await expect(problem).toHaveValue(draft);
  });

  test("admin sees new-order action on orders list", async ({ page }) => {
    await page.goto("/orders");
    await waitForAdminOrderAccess(page);
  });

  test("client and equipment searches match all supported fields", async ({ page }) => {
    const seeded = await seedTestCustomerEquipment();
    try {
      await page.goto("/clients");
      const clientSearch = page.getByTestId("client-search-card");
      const clientInput = clientSearch.getByLabel("Nombre, teléfono o cédula");
      for (const term of [seeded.customerName, seeded.phoneNumber, seeded.taxId]) {
        await clientInput.fill(term);
        await clientSearch.getByRole("button", { name: "Buscar" }).click();
        await expect(clientSearch.getByText(seeded.customerName, { exact: true })).toBeVisible();
      }

      await page.goto("/equipment");
      const equipmentSearch = page.getByTestId("equipment-search-card");
      const equipmentInput = equipmentSearch.getByLabel("Modelo, serie o marca");
      for (const term of [seeded.model, seeded.serialNumber, seeded.brand]) {
        await equipmentInput.fill(term);
        await equipmentSearch.getByRole("button", { name: "Buscar" }).click();
        await expect(equipmentSearch.getByText(seeded.serialNumber, { exact: true })).toBeVisible();
      }
    } finally {
      await deleteTestCustomer(seeded.clientId, seeded.equipmentId);
    }
  });

  test("admin can create a new service order", async ({ page }) => {
    if (!getServiceRoleKey()) {
      test.skip(true, "SUPABASE_SERVICE_ROLE_KEY not set — skipping cleanup-dependent test");
    }

    const { clientId, equipmentId, equipmentCondition } = await createIntakeOrderFromSeed(page);
    try {
      await expect(page.getByText(labels.stage.evaluation).first()).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByText(equipmentCondition)).toBeVisible();
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

  test("order modules can be collapsed and expanded", async ({ page }) => {
    const { clientId, equipmentId } = await seedTestCustomerEquipment();
    const order = await seedTestOrder(clientId, equipmentId, "evaluation", "E2E collapsible cards");

    try {
      await seedTestEvaluation(order.id);
      await gotoOrderDetail(page, order.id);

      const evaluationCard = page.getByTestId("evaluation-card");
      const evaluationToggle = evaluationCard.getByRole("button").first();
      await expect(evaluationCard.getByLabel("Diagnóstico *")).toBeVisible();

      await evaluationToggle.click();
      await expect(evaluationCard.getByLabel("Diagnóstico *")).toBeHidden();

      await evaluationToggle.click();
      await expect(evaluationCard.getByLabel("Diagnóstico *")).toBeVisible();
      await expect(
        page.getByTestId("photos-card").getByText("No hay fotos adjuntas."),
      ).toBeHidden();
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

  test("technical evaluation changes appear in the order history", async ({ page }) => {
    const { clientId, equipmentId } = await seedTestCustomerEquipment();
    const order = await seedTestOrder(clientId, equipmentId, "evaluation", "E2E fault");
    try {
      await seedTestEvaluation(order.id);
      await gotoOrderDetail(page, order.id);

      await expect(page.getByText("Evaluación técnica registrada", { exact: true })).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await deleteTestCustomer(clientId, equipmentId);
    }
  });

  test("deferral reason is copied to internal notes and order history", async ({ page }) => {
    const { clientId, equipmentId } = await seedTestCustomerEquipment();
    const order = await seedTestOrder(
      clientId,
      equipmentId,
      "customer_decision",
      "E2E deferred decision",
    );
    const reason = "El cliente solicita esperar hasta fin de mes";
    try {
      await seedTestBudget(order.id);
      await gotoOrderDetail(page, order.id);

      await page.getByLabel("Motivo del diferimiento").fill(reason);
      await page.getByRole("button", { name: "Diferido", exact: true }).click();

      await expect(
        page.getByText(`Motivo de diferimiento: ${reason}`, { exact: true }),
      ).toBeVisible({ timeout: 15_000 });
      await expect(
        page.getByText(`Motivo de diferimiento registrado: ${reason}`, { exact: true }),
      ).toBeVisible();
    } finally {
      await deleteTestCustomer(clientId, equipmentId);
    }
  });

  test("repair only offers evaluated parts and records available stock", async ({ page }) => {
    const { clientId, equipmentId } = await seedTestCustomerEquipment();
    const order = await seedTestOrder(clientId, equipmentId, "repair", "E2E repair parts");
    const suffix = Date.now();
    const quotedCode = `QUOTED-${suffix}`;
    const unrelatedCode = `OTHER-${suffix}`;

    try {
      const quotedPart = await seedTestPart(quotedCode, 2);
      await seedTestPart(unrelatedCode, 2);
      await seedTestOrderPart(order.id, quotedPart.id, "quoted", 1);
      await gotoOrderDetail(page, order.id);

      const partSelect = page.getByRole("combobox", { name: "Repuestos usados" });
      await partSelect.click();
      const quotedOption = page.getByRole("option").filter({ hasText: quotedCode });
      await expect(quotedOption).toBeVisible();
      await expect(page.getByRole("option").filter({ hasText: unrelatedCode })).toHaveCount(0);
      await quotedOption.click();

      await page.getByRole("spinbutton", { name: "Cantidad" }).last().fill("1");
      await page.getByRole("button", { name: "Agregar", exact: true }).last().click();
      await expect(page.getByText("Repuesto agregado", { exact: true })).toBeVisible();
    } finally {
      await deleteTestCustomer(clientId, equipmentId);
      await deleteTestPartByCode(quotedCode);
      await deleteTestPartByCode(unrelatedCode);
    }
  });

  test("repair reports insufficient stock without exposing a database constraint", async ({
    page,
  }) => {
    const { clientId, equipmentId } = await seedTestCustomerEquipment();
    const order = await seedTestOrder(clientId, equipmentId, "repair", "E2E no stock");
    const partCode = `NO-STOCK-${Date.now()}`;

    try {
      const part = await seedTestPart(partCode, 0);
      await seedTestOrderPart(order.id, part.id, "quoted", 1);
      await gotoOrderDetail(page, order.id);

      await page.getByRole("combobox", { name: "Repuestos usados" }).click();
      await page.getByRole("option").filter({ hasText: partCode }).click();
      await page.getByRole("button", { name: "Agregar", exact: true }).last().click();

      await expect(
        page.getByText("No hay suficiente inventario para registrar este repuesto como usado"),
      ).toBeVisible();
      await expect(page.getByText(/parts_stock_check/)).toHaveCount(0);
    } finally {
      await deleteTestCustomer(clientId, equipmentId);
      await deleteTestPartByCode(partCode);
    }
  });

  test("multiple payment methods can settle the exact persisted balance", async ({ page }) => {
    const { clientId, equipmentId } = await seedTestCustomerEquipment();
    const order = await seedTestOrder(clientId, equipmentId, "payment", "E2E split payment");

    try {
      await seedTestBudget(order.id, { labor_cost: 6000, advances: 1000 });
      await seedTestPayment(order.id, 4000, "cash");
      await gotoOrderDetail(page, order.id);

      const paymentsCard = page.getByTestId("payments-card");
      await expect(paymentsCard.getByText("1000.00", { exact: true })).toBeVisible();
      await paymentsCard.getByLabel("Monto").fill("1000");
      await paymentsCard.getByRole("combobox", { name: "Método" }).click();
      await page.getByRole("option", { name: "Tarjeta" }).click();
      await paymentsCard.getByRole("button", { name: "Registrar pago" }).click();

      await expect(page.getByText("Pago registrado", { exact: true })).toBeVisible();
      await expect(paymentsCard.getByText("0.00", { exact: true }).last()).toBeVisible();
    } finally {
      await deleteTestCustomer(clientId, equipmentId);
    }
  });

  test("using an evaluated part preserves the approved parts budget", async ({ page }) => {
    const { clientId, equipmentId } = await seedTestCustomerEquipment();
    const order = await seedTestOrder(clientId, equipmentId, "repair", "E2E budget preservation");
    const partCode = `BUDGET-PART-${Date.now()}`;

    try {
      const part = await seedTestPart(partCode, 2);
      await seedTestOrderPart(order.id, part.id, "quoted", 1);
      await seedTestBudget(order.id, { labor_cost: 5000, parts_cost: 1000, advances: 1000 });
      await gotoOrderDetail(page, order.id);

      await page.getByRole("combobox", { name: "Repuestos usados" }).click();
      await page.getByRole("option").filter({ hasText: partCode }).click();
      await page.getByRole("button", { name: "Agregar", exact: true }).last().click();

      await expect(page.getByText("Repuesto agregado", { exact: true })).toBeVisible();
      const paymentsCard = page.getByTestId("payments-card");
      await expect(paymentsCard.getByText("6000.00", { exact: true })).toBeVisible();
    } finally {
      await deleteTestCustomer(clientId, equipmentId);
      await deleteTestPartByCode(partCode);
    }
  });

  test("unsaved budget edits cannot create a misleading payable balance", async ({ page }) => {
    const { clientId, equipmentId } = await seedTestCustomerEquipment();
    const order = await seedTestOrder(clientId, equipmentId, "payment", "E2E budget draft");

    try {
      await seedTestBudget(order.id, { labor_cost: 5000, advances: 1000 });
      await seedTestPayment(order.id, 4000, "cash");
      await gotoOrderDetail(page, order.id);

      await page.getByRole("spinbutton", { name: "Mano de obra" }).fill("6000");

      const paymentsCard = page.getByTestId("payments-card");
      await expect(
        paymentsCard.getByText("Guarde los cambios del presupuesto antes de registrar pagos"),
      ).toBeVisible();
      await expect(paymentsCard.getByRole("button", { name: "Registrar pago" })).toBeDisabled();
      await expect(paymentsCard.getByText("0.00", { exact: true }).last()).toBeVisible();
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
