import type { Page } from "@playwright/test";
import { labels } from "./labels";
import { gotoNewOrderForm, selectComboboxOption } from "./page";
import { seedTestCustomerEquipment } from "./seed";

/** Seeds client/equipment via service role, then creates an intake order through the UI. */
export async function createIntakeOrderFromSeed(page: Page): Promise<{
  orderId: string;
  clientId: string;
  customerName: string;
}> {
  const { clientId, customerName } = await seedTestCustomerEquipment();

  await gotoNewOrderForm(page);
  await selectComboboxOption(page, 0, customerName);
  await selectComboboxOption(page, 1, /Laptop.*E2E.*Test/);
  await page
    .getByRole("textbox", { name: labels.orders.problemReported })
    .fill("E2E test problem description");
  await page.getByRole("button", { name: labels.orders.createOrder }).click();
  await page.waitForURL(/\/orders\/[a-z0-9-]+$/i, { timeout: 30_000 });

  const orderId = page.url().split("/").pop();
  if (!orderId) throw new Error("Could not resolve order id from URL after create");

  return { orderId, clientId, customerName };
}
