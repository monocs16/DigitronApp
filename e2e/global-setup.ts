import { chromium, type FullConfig } from "@playwright/test";

const BASE_URL = "http://localhost:5173";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@digitron.test";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "digitron123";

const TECH_EMAIL = process.env.E2E_TECH_EMAIL ?? "tech@digitron.test";
const TECH_PASSWORD = process.env.E2E_TECH_PASSWORD ?? "digitron123";

async function loginAndSave(
  email: string,
  password: string,
  stateFile: string,
): Promise<void> {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector("#email", { timeout: 10_000 });

  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click('button[type="submit"]');

  // Wait until redirected away from login (dashboard or orders)
  await page.waitForURL((url) => !url.pathname.startsWith("/login"), { timeout: 15_000 });

  await page.context().storageState({ path: stateFile });
  await browser.close();
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  await loginAndSave(ADMIN_EMAIL, ADMIN_PASSWORD, "e2e/fixtures/admin-state.json");

  // Technician auth is best-effort: skip if no separate tech account is configured.
  try {
    await loginAndSave(TECH_EMAIL, TECH_PASSWORD, "e2e/fixtures/technician-state.json");
  } catch {
    // Seed a fallback empty state so Playwright doesn't error on missing file.
    const { writeFileSync } = await import("node:fs");
    writeFileSync(
      "e2e/fixtures/technician-state.json",
      JSON.stringify({ cookies: [], origins: [] }),
    );
    console.warn(
      `[global-setup] Technician login failed for ${TECH_EMAIL}. ` +
        "Technician E2E tests will be skipped or will redirect to login.",
    );
  }
}
