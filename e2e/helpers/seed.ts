import { loadE2eSupabaseEnv } from "./supabase-env";

function adminHeaders(serviceRoleKey: string): Record<string, string> {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  };
}

export function getServiceRoleKey(): string {
  return loadE2eSupabaseEnv().serviceRoleKey;
}

async function postRow<T>(
  apiUrl: string,
  serviceRoleKey: string,
  table: string,
  body: Record<string, unknown>,
): Promise<T> {
  const response = await fetch(`${apiUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: adminHeaders(serviceRoleKey),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`seed ${table}: ${response.status} ${await response.text()}`);
  }
  const rows = (await response.json()) as T[];
  if (!rows[0]) throw new Error(`seed ${table}: empty response — check RLS or service role key`);
  return rows[0];
}

async function deleteWhere(
  apiUrl: string,
  serviceRoleKey: string,
  table: string,
  query: string,
): Promise<void> {
  const response = await fetch(`${apiUrl}/rest/v1/${table}?${query}`, {
    method: "DELETE",
    headers: adminHeaders(serviceRoleKey),
  });
  if (!response.ok) {
    throw new Error(`delete ${table}: ${response.status} ${await response.text()}`);
  }
}

function uniqueCustomerName(): string {
  return `E2E Client ${Date.now()}`;
}

/** Seeds independent customer and equipment rows via service role (bypasses RLS). */
export async function seedTestCustomerEquipment(): Promise<{
  clientId: string;
  equipmentId: string;
  customerName: string;
  serialNumber: string;
}> {
  const { apiUrl, serviceRoleKey } = loadE2eSupabaseEnv();
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for seed helpers — run E2E via pnpm test:e2e",
    );
  }

  const customerName = uniqueCustomerName();

  const customer = await postRow<{ id: string }>(apiUrl, serviceRoleKey, "customers", {
    name: customerName,
    phone1: "555-0001",
  });

  const serialNumber = `E2E-${Date.now()}`;
  const equipment = await postRow<{ id: string }>(apiUrl, serviceRoleKey, "equipment", {
    type: "Laptop",
    brand: "E2E",
    model: "Test",
    serial_number: serialNumber,
  });

  return { clientId: customer.id, equipmentId: equipment.id, customerName, serialNumber };
}

export async function seedTestOrder(
  clientId: string,
  equipmentId: string,
  stage: string,
  reportedFault: string,
): Promise<{ id: string }> {
  const { apiUrl, serviceRoleKey } = loadE2eSupabaseEnv();
  return postRow<{ id: string }>(apiUrl, serviceRoleKey, "orders", {
    client_id: clientId,
    equipment_id: equipmentId,
    reported_fault: reportedFault,
    stage,
    source: "counter",
  });
}

/** Deletes a test order's customer and optional independent equipment. */
export async function deleteTestCustomer(clientId: string, equipmentId?: string): Promise<void> {
  const { apiUrl, serviceRoleKey } = loadE2eSupabaseEnv();
  await deleteWhere(apiUrl, serviceRoleKey, "orders", `client_id=eq.${clientId}`);
  if (equipmentId) {
    await deleteWhere(apiUrl, serviceRoleKey, "equipment", `id=eq.${equipmentId}`);
  }
  await deleteWhere(apiUrl, serviceRoleKey, "customers", `id=eq.${clientId}`);
}

export async function deleteTestCustomerByName(name: string): Promise<void> {
  const { apiUrl, serviceRoleKey } = loadE2eSupabaseEnv();
  const response = await fetch(
    `${apiUrl}/rest/v1/customers?name=eq.${encodeURIComponent(name)}&select=id`,
    { headers: adminHeaders(serviceRoleKey) },
  );
  if (!response.ok) {
    throw new Error(`lookup customer ${name}: ${response.status} ${await response.text()}`);
  }
  const rows = (await response.json()) as { id: string }[];
  for (const row of rows) {
    await deleteTestCustomer(row.id);
  }
}

export async function updateTestOrderStage(orderId: string, stage: string): Promise<void> {
  const { apiUrl, serviceRoleKey } = loadE2eSupabaseEnv();
  const response = await fetch(`${apiUrl}/rest/v1/orders?id=eq.${orderId}`, {
    method: "PATCH",
    headers: { ...adminHeaders(serviceRoleKey), Prefer: "return=minimal" },
    body: JSON.stringify({ stage }),
  });
  if (!response.ok) {
    throw new Error(`update order ${orderId}: ${response.status} ${await response.text()}`);
  }
}
