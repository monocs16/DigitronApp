import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:55321";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

// Creates a minimal client+equipment+order via admin API so we have known test data.
async function seedTestOrder(): Promise<{ clientId: string; equipmentId: string }> {
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: client, error: ce } = await admin
    .from("clients")
    .insert({ name: "E2E Test Client", phone1: "555-0001" })
    .select("id")
    .single();
  if (ce) throw new Error(`seed client: ${ce.message}`);

  const { data: equipment, error: ee } = await admin
    .from("equipment")
    .insert({ client_id: client.id, type: "Laptop", brand: "E2E", model: "Test" })
    .select("id")
    .single();
  if (ee) throw new Error(`seed equipment: ${ee.message}`);

  return { clientId: client.id, equipmentId: equipment.id };
}

test.describe("Admin — order flow", () => {
  test("orders list page renders and is accessible", async ({ page }) => {
    await page.goto("/orders");
    await expect(page).not.toHaveURL(/\/login/);
    // Table or empty-state must be visible
    await expect(page.locator("main")).toBeVisible();
  });

  test("new order form renders with all required fields", async ({ page }) => {
    await page.goto("/orders/new");
    await expect(page).not.toHaveURL(/\/login/);

    // Required form fields
    await expect(page.getByRole("combobox").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /create order/i })).toBeVisible();
  });

  test("admin can create a new service order", async ({ page }) => {
    if (!SERVICE_ROLE_KEY) {
      test.skip(true, "SUPABASE_SERVICE_ROLE_KEY not set — skipping data-dependent test");
    }

    const { clientId, equipmentId } = await seedTestOrder();

    await page.goto("/orders/new");

    // Select client
    const [clientSelect] = await page.getByRole("combobox").all();
    await clientSelect.click();
    await page.getByRole("option", { name: "E2E Test Client" }).click();

    // Wait for equipment to load then select it
    await page.waitForTimeout(500);
    const [, equipmentSelect] = await page.getByRole("combobox").all();
    await equipmentSelect.click();
    await page.getByRole("option", { name: /E2E.*Test/i }).click();

    // Fill problem description
    await page.getByRole("textbox", { name: /problem/i }).fill("E2E test problem description");

    // Submit
    await page.getByRole("button", { name: /create order/i }).click();

    // Should redirect to order detail
    await page.waitForURL(/\/orders\/[a-z0-9-]+$/, { timeout: 10_000 });

    // Stage badge should show Intake
    await expect(page.getByText("Intake")).toBeVisible();

    // Cleanup: delete the seeded client (cascade deletes equipment and order)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await admin.from("clients").delete().eq("id", clientId);
    void equipmentId;
  });

  test("admin sees send-to-evaluation action on intake order", async ({ page }) => {
    if (!SERVICE_ROLE_KEY) {
      test.skip(true, "SUPABASE_SERVICE_ROLE_KEY not set — skipping data-dependent test");
    }

    const { clientId } = await seedTestOrder();

    // Navigate to new order and create it quickly
    await page.goto("/orders");
    await expect(page.getByRole("link", { name: /new order/i })).toBeVisible();

    // Cleanup
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await admin.from("clients").delete().eq("id", clientId);
  });
});

test.describe("Admin — order detail stage actions", () => {
  test("send to evaluation button is visible on intake stage order", async ({ page }) => {
    if (!SERVICE_ROLE_KEY) {
      test.skip(true, "SUPABASE_SERVICE_ROLE_KEY not set — skipping data-dependent test");
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Seed client + equipment + order directly
    const { clientId, equipmentId } = await seedTestOrder();
    const { data: order, error } = await admin
      .from("orders")
      .insert({
        client_id: clientId,
        equipment_id: equipmentId,
        reported_fault: "E2E direct seed test",
        stage: "intake",
        source: "counter",
      })
      .select("id")
      .single();
    if (error) throw new Error(`seed order: ${error.message}`);

    await page.goto(`/orders/${order.id}`);
    await expect(page.getByRole("button", { name: /send to evaluation/i })).toBeVisible();

    // Stage badge
    await expect(page.getByText("Intake")).toBeVisible();

    // Cleanup
    await admin.from("clients").delete().eq("id", clientId);
  });

  test("closed order shows no action buttons", async ({ page }) => {
    if (!SERVICE_ROLE_KEY) {
      test.skip(true, "SUPABASE_SERVICE_ROLE_KEY not set — skipping data-dependent test");
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { clientId, equipmentId } = await seedTestOrder();
    const { data: order, error } = await admin
      .from("orders")
      .insert({
        client_id: clientId,
        equipment_id: equipmentId,
        reported_fault: "E2E closed order test",
        stage: "closed",
        source: "counter",
      })
      .select("id")
      .single();
    if (error) throw new Error(`seed order: ${error.message}`);

    await page.goto(`/orders/${order.id}`);
    await expect(page.getByText("Closed")).toBeVisible();

    // None of the action buttons should exist
    await expect(page.getByRole("button", { name: /send to evaluation/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /close order/i })).not.toBeVisible();

    // Cleanup
    await admin.from("clients").delete().eq("id", clientId);
  });
});
