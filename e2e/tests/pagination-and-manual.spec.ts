import { expect, test } from "@playwright/test";
import { deletePaginationDataset, seedPaginationDataset } from "../helpers/seed";

let paginationPrefix = "";

test.describe("Authenticated shell — version and user manual", () => {
  test("shows O3S v1.0 and downloads the real user manual PDF", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page.getByText("O3S v1.0", { exact: true })).toBeVisible();
    const manualLink = page.getByRole("link", { name: "Manual de Usuario" });
    await expect(manualLink).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await manualLink.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe("Manual de usuario.pdf");

    const stream = await download.createReadStream();
    let downloadedBytes = 0;
    let header = Buffer.alloc(0);
    for await (const chunk of stream) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      if (header.length < 5) header = Buffer.concat([header, bytes]).subarray(0, 5);
      downloadedBytes += bytes.length;
    }
    expect(downloadedBytes).toBeGreaterThan(1_000);
    expect(header.toString("ascii")).toBe("%PDF-");
  });
});

test.describe("Server-side list pagination", () => {
  test.beforeAll(async () => {
    ({ prefix: paginationPrefix } = await seedPaginationDataset(55));
  });

  test.afterAll(async () => {
    if (paginationPrefix) await deletePaginationDataset(paginationPrefix);
  });

  test("orders paginate, navigate both ways, reset filters, and search beyond page one", async ({
    page,
  }) => {
    await page.goto("/orders");
    const card = page.getByTestId("orders-list-card");
    const rows = card.locator("tbody tr");
    const firstOrderCell = rows.first().locator("td").first();
    const searchInput = page.getByPlaceholder("Código, cliente, equipo…");

    await searchInput.fill(paginationPrefix);
    await expect(card.getByText(/de 55 registros/)).toBeVisible();
    await expect(rows).toHaveCount(50);
    await expect(rows.first()).toContainText(paginationPrefix);
    const firstPageOrder = await firstOrderCell.innerText();

    await card.getByRole("button", { name: "Siguiente" }).click();
    await expect(card.getByText(/Página 2 de/)).toBeVisible();
    await expect(firstOrderCell).not.toHaveText(firstPageOrder);
    expect(await rows.count()).toBeLessThanOrEqual(50);
    const secondPageOrder = await firstOrderCell.innerText();

    await card.getByRole("button", { name: "Anterior" }).click();
    await expect(card.getByText(/Página 1 de/)).toBeVisible();
    await expect(firstOrderCell).toHaveText(firstPageOrder);

    await card.getByRole("button", { name: "Siguiente" }).click();
    await expect(firstOrderCell).toHaveText(secondPageOrder);
    await page.getByRole("combobox").first().click();
    await page.getByRole("option", { name: "Evaluación" }).click();
    await expect(card.getByText(/Página 1 de/)).toBeVisible();
    await expect(firstOrderCell).toHaveText(firstPageOrder);

    await searchInput.fill(secondPageOrder);
    await expect(card.getByText(/Página 1 de 1/)).toBeVisible();
    await expect(rows).toHaveCount(1);
    await expect(firstOrderCell).toHaveText(secondPageOrder);
  });

  test("clients paginate and server-side search finds a page-two client", async ({ page }) => {
    await page.goto("/clients");
    const card = page.getByTestId("clients-list-card");
    const rows = card.locator("tbody tr");
    const firstClientCell = rows.first().locator("td").first();
    const searchCard = page.getByTestId("client-search-card");

    await searchCard.getByLabel("Nombre, teléfono o cédula").fill(paginationPrefix);
    await searchCard.getByRole("button", { name: "Buscar" }).click();
    await expect(card.getByText(/de 55 registros/)).toBeVisible();
    await expect(rows).toHaveCount(50);
    const firstPageClient = await firstClientCell.innerText();

    await card.getByRole("button", { name: "Siguiente" }).click();
    await expect(card.getByText(/Página 2 de/)).toBeVisible();
    await expect(firstClientCell).not.toHaveText(firstPageClient);
    const secondPageClient = await firstClientCell.innerText();
    expect(await rows.count()).toBeLessThanOrEqual(50);

    await card.getByRole("button", { name: "Anterior" }).click();
    await expect(firstClientCell).toHaveText(firstPageClient);

    await searchCard.getByLabel("Nombre, teléfono o cédula").fill(secondPageClient);
    await searchCard.getByRole("button", { name: "Buscar" }).click();
    await expect(card.getByText(/Página 1 de 1/)).toBeVisible();
    await expect(rows).toHaveCount(1);
    await expect(firstClientCell).toHaveText(secondPageClient);
  });

  test("equipment paginate and server-side search finds a page-two serial", async ({ page }) => {
    await page.goto("/equipment");
    const card = page.getByTestId("equipment-list-card");
    const rows = card.locator("tbody tr");
    const serialCell = rows.first().locator("td").nth(4);
    const searchCard = page.getByTestId("equipment-search-card");

    await searchCard.getByLabel("Descripción, modelo, serie o marca").fill(paginationPrefix);
    await searchCard.getByRole("button", { name: "Buscar" }).click();
    await expect(card.getByText(/de 55 registros/)).toBeVisible();
    await expect(rows).toHaveCount(50);
    const firstPageSerial = await serialCell.innerText();

    await card.getByRole("button", { name: "Siguiente" }).click();
    await expect(card.getByText(/Página 2 de/)).toBeVisible();
    await expect(serialCell).not.toHaveText(firstPageSerial);
    const secondPageSerial = await serialCell.innerText();
    expect(await rows.count()).toBeLessThanOrEqual(50);

    await card.getByRole("button", { name: "Anterior" }).click();
    await expect(serialCell).toHaveText(firstPageSerial);

    await searchCard.getByLabel("Descripción, modelo, serie o marca").fill(secondPageSerial);
    await searchCard.getByRole("button", { name: "Buscar" }).click();
    await expect(card.getByText(/Página 1 de 1/)).toBeVisible();
    await expect(rows).toHaveCount(1);
    await expect(serialCell).toHaveText(secondPageSerial);
  });

  test("inventory paginates and searches the complete commercial catalog", async ({ page }) => {
    await page.goto("/inventory");
    const card = page.getByTestId("inventory-list-card");
    const rows = card.locator("tbody tr");
    const firstPartCell = rows.first().locator("td").first();
    const searchInput = card.getByLabel("Buscar en el catálogo");

    await searchInput.fill(paginationPrefix);
    await card.getByRole("button", { name: "Buscar" }).click();
    await expect(card.getByText(/de 55 registros/)).toBeVisible();
    await expect(rows).toHaveCount(50);
    const firstPagePart = await firstPartCell.innerText();

    await card.getByRole("button", { name: "Siguiente" }).click();
    await expect(card.getByText(/Página 2 de/)).toBeVisible();
    await expect(firstPartCell).not.toHaveText(firstPagePart);
    const secondPagePart = await firstPartCell.innerText();
    expect(await rows.count()).toBeLessThanOrEqual(50);

    await card.getByRole("button", { name: "Anterior" }).click();
    await expect(firstPartCell).toHaveText(firstPagePart);

    await searchInput.fill(secondPagePart);
    await card.getByRole("button", { name: "Buscar" }).click();
    await expect(card.getByText(/Página 1 de 1/)).toBeVisible();
    await expect(rows).toHaveCount(1);
    await expect(firstPartCell).toHaveText(secondPagePart);
  });

  test("pagination controls remain usable on a mobile viewport", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/clients");
    const card = page.getByTestId("clients-list-card");
    const searchCard = page.getByTestId("client-search-card");
    await searchCard.getByLabel("Nombre, teléfono o cédula").fill(paginationPrefix);
    await searchCard.getByRole("button", { name: "Buscar" }).click();
    await expect(card.getByText(/de 55 registros/)).toBeVisible();
    await expect(card.locator("tbody tr")).toHaveCount(50);
    await expect(card.getByRole("button", { name: "Anterior" })).toBeDisabled();
    await card.getByRole("button", { name: "Siguiente" }).click();
    await expect(card.getByText(/Página 2 de/)).toBeVisible();
  });

  test("a Supabase failure remains an error instead of an empty list", async ({ page }) => {
    await page.route("**/rest/v1/customers*", async (route) => {
      await route.fulfill({
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ message: "Forced pagination query failure" }),
      });
    });
    await page.goto("/clients");
    const card = page.getByTestId("clients-list-card");
    await expect(card.getByText("Esta página no se cargó")).toBeVisible({ timeout: 15_000 });
    await expect(card.getByText("No hay clientes registrados.")).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Reintentar" })).toBeVisible();
  });
});
