import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { labels } from "./labels";

/** Waits until auth bootstrap finished (past the global loading shell). */
export async function waitForAuthReady(page: Page): Promise<void> {
  await expect(page.getByText(/^Cargando…$/)).not.toBeVisible({ timeout: 15_000 });
  await expect(page.locator("main")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: labels.sidebar.settings })).toBeVisible({
    timeout: 15_000,
  });
}

/** Waits until the admin super role is loaded (sidebar footer + RLS-ready session). */
export async function waitForAdminRoles(page: Page): Promise<void> {
  await waitForAuthReady(page);
  await expect(page.getByText(labels.roles.super)).toBeVisible({ timeout: 30_000 });
}

/** Waits until role-gated admin UI (e.g. new order) is available. */
export async function waitForAdminOrderAccess(page: Page): Promise<void> {
  await waitForAdminRoles(page);
  await expect(
    page.getByRole("main").getByRole("link", { name: labels.orders.newOrder }),
  ).toBeVisible({ timeout: 30_000 });
}

/** Opens a Radix select and picks an option, retrying if the data hasn't loaded yet. */
export async function selectComboboxOption(
  page: Page,
  comboboxIndex: number,
  optionName: string | RegExp,
): Promise<void> {
  const combobox = page.getByRole("combobox").nth(comboboxIndex);

  await expect(async () => {
    await page.keyboard.press("Escape").catch(() => undefined);
    await expect(combobox).toBeVisible({ timeout: 5_000 });
    await combobox.click();
    const option = page.getByRole("option", { name: optionName });
    await expect(option).toBeVisible({ timeout: 15_000 });
    await option.click();
  }).toPass({ timeout: 30_000 });
}

/** Navigates to an order detail page and waits until the order content is rendered. */
export async function gotoOrderDetail(page: Page, orderId: string): Promise<void> {
  await page.goto(`/orders/${orderId}`);
  await waitForAdminRoles(page);
  await expect(page.getByRole("link", { name: labels.orders.back })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(labels.orders.notFound)).not.toBeVisible();
}

export async function gotoNewOrderForm(page: Page): Promise<void> {
  await page.goto("/orders/new");
  await waitForAdminRoles(page);
  await expect(page.getByPlaceholder("Ingrese nombre, teléfono o cédula…")).toBeVisible({
    timeout: 15_000,
  });
}
