import type { Page } from "@playwright/test";
import { labels } from "./labels";
import { expect } from "@playwright/test";
import { gotoNewOrderForm } from "./page";
import { seedTestCustomerEquipment } from "./seed";

/** Seeds client/equipment via service role, then creates an order through the UI. */
export async function createIntakeOrderFromSeed(page: Page): Promise<{
  orderId: string;
  clientId: string;
  equipmentId: string;
  customerName: string;
  equipmentCondition: string;
}> {
  const { clientId, equipmentId, customerName, serialNumber } = await seedTestCustomerEquipment();
  const equipmentCondition = "E2E scratched enclosure at receipt";

  await gotoNewOrderForm(page);
  await page.getByPlaceholder("Ingrese nombre, teléfono o cédula…").fill(customerName);
  await page.getByRole("button").filter({ hasText: customerName }).click();
  await page
    .getByRole("textbox", { name: `${labels.form.equipment} *`, exact: true })
    .fill(serialNumber);
  const equipmentOption = page.getByRole("button").filter({ hasText: serialNumber });
  await expect(equipmentOption).toBeVisible();
  await equipmentOption.click();
  await page
    .getByRole("textbox", { name: labels.orders.problemReported })
    .fill("E2E test problem description");
  await page
    .getByRole("textbox", { name: labels.orders.equipmentCondition })
    .fill(equipmentCondition);
  await page.getByRole("button", { name: labels.orders.createOrder }).click();
  await page.waitForURL(/\/orders\/[a-z0-9-]+$/i, { timeout: 30_000 });

  const orderId = page.url().split("/").pop();
  if (!orderId) throw new Error("Could not resolve order id from URL after create");

  return { orderId, clientId, equipmentId, customerName, equipmentCondition };
}
