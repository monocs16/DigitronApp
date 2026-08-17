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

async function postRows<T>(
  apiUrl: string,
  serviceRoleKey: string,
  table: string,
  body: Record<string, unknown>[],
): Promise<T[]> {
  const response = await fetch(`${apiUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: adminHeaders(serviceRoleKey),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`seed ${table}: ${response.status} ${await response.text()}`);
  }
  return (await response.json()) as T[];
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
  phoneNumber: string;
  taxId: string;
  brand: string;
  model: string;
  serialNumber: string;
}> {
  const { apiUrl, serviceRoleKey } = loadE2eSupabaseEnv();
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for seed helpers — run E2E via pnpm test:e2e",
    );
  }

  const customerName = uniqueCustomerName();
  const suffix = Date.now().toString().slice(-8);
  const phoneNumber = `555-${suffix}`;
  const taxId = `E2E-TAX-${suffix}`;

  const customer = await postRow<{ id: string }>(apiUrl, serviceRoleKey, "customers", {
    name: customerName,
    phone1: phoneNumber,
    tax_id: taxId,
  });

  const brand = `E2EBrand-${suffix}`;
  const model = `E2EModel-${suffix}`;
  const serialNumber = `E2E-Serial-${suffix}`;
  const equipment = await postRow<{ id: string }>(apiUrl, serviceRoleKey, "equipment", {
    type: "Laptop",
    brand,
    model,
    serial_number: serialNumber,
  });

  return {
    clientId: customer.id,
    equipmentId: equipment.id,
    customerName,
    phoneNumber,
    taxId,
    brand,
    model,
    serialNumber,
  };
}

export async function seedTestOrder(
  clientId: string,
  equipmentId: string,
  stage: string,
  reportedFault: string,
  technicianId?: string,
): Promise<{ id: string; order_number: string }> {
  const { apiUrl, serviceRoleKey } = loadE2eSupabaseEnv();
  return postRow<{ id: string; order_number: string }>(apiUrl, serviceRoleKey, "orders", {
    client_id: clientId,
    equipment_id: equipmentId,
    reported_fault: reportedFault,
    stage,
    source: "counter",
    ...(technicianId ? { technician_id: technicianId } : {}),
  });
}

function assertLocalApiUrl(apiUrl: string): void {
  const hostname = new URL(apiUrl).hostname;
  if (!["localhost", "127.0.0.1", "::1"].includes(hostname)) {
    throw new Error(`Bulk E2E seeds are restricted to local Supabase, received ${hostname}.`);
  }
}

export async function seedPaginationDataset(size = 55): Promise<{ prefix: string }> {
  const { apiUrl, serviceRoleKey } = loadE2eSupabaseEnv();
  assertLocalApiUrl(apiUrl);
  const prefix = `E2E-PAGE-${Date.now()}`;
  const indexes = Array.from({ length: size }, (_, index) => index + 1);
  const customers = await postRows<{ id: string }>(
    apiUrl,
    serviceRoleKey,
    "customers",
    indexes.map((index) => ({
      name: `${prefix}-Customer-${String(index).padStart(3, "0")}`,
      tax_id: `${prefix}-Tax-${String(index).padStart(3, "0")}`,
      phone1: `555-${String(index).padStart(4, "0")}`,
    })),
  );
  const equipment = await postRows<{ id: string }>(
    apiUrl,
    serviceRoleKey,
    "equipment",
    indexes.map((index) => ({
      type: "E2E pagination device",
      brand: `${prefix}-Brand`,
      model: `${prefix}-Model-${String(index).padStart(3, "0")}`,
      description: `${prefix}-Description-${String(index).padStart(3, "0")}`,
      serial_number: `${prefix}-Serial-${String(index).padStart(3, "0")}`,
    })),
  );

  await postRows(
    apiUrl,
    serviceRoleKey,
    "parts",
    indexes.map((index) => ({
      part_code: `${prefix}-Part-${String(index).padStart(3, "0")}`,
      description: `${prefix}-Part-description-${String(index).padStart(3, "0")}`,
      location: `Shelf-${index}`,
      stock: index,
      unit_cost: 1000 + index,
      supplier: `${prefix}-Supplier`,
    })),
  );

  await postRows(
    apiUrl,
    serviceRoleKey,
    "orders",
    indexes.map((index) => ({
      client_id: customers[index - 1].id,
      equipment_id: equipment[index - 1].id,
      reported_fault: `${prefix}-Fault-${String(index).padStart(3, "0")}`,
      stage: "evaluation",
      source: "counter",
    })),
  );

  return { prefix };
}

export async function deletePaginationDataset(prefix: string): Promise<void> {
  const { apiUrl, serviceRoleKey } = loadE2eSupabaseEnv();
  assertLocalApiUrl(apiUrl);
  const pattern = encodeURIComponent(`${prefix}*`);
  await deleteWhere(apiUrl, serviceRoleKey, "orders", `reported_fault=like.${pattern}`);
  await deleteWhere(apiUrl, serviceRoleKey, "equipment", `serial_number=like.${pattern}`);
  await deleteWhere(apiUrl, serviceRoleKey, "customers", `name=like.${pattern}`);
  await deleteWhere(apiUrl, serviceRoleKey, "parts", `part_code=like.${pattern}`);
}

export async function getTestTechnicianId(): Promise<string> {
  const { apiUrl, serviceRoleKey } = loadE2eSupabaseEnv();
  const technicianEmail = process.env.E2E_TECH_EMAIL ?? "tech@digitron.test";
  const response = await fetch(
    `${apiUrl}/rest/v1/profiles?email=eq.${encodeURIComponent(technicianEmail)}&select=id&limit=1`,
    { headers: adminHeaders(serviceRoleKey) },
  );
  if (!response.ok) {
    throw new Error(`lookup technician: ${response.status} ${await response.text()}`);
  }
  const rows = (await response.json()) as { id: string }[];
  if (!rows[0]) throw new Error("No technician user is available for E2E.");
  return rows[0].id;
}

export async function deleteTestPartByCode(partCode: string): Promise<void> {
  const { apiUrl, serviceRoleKey } = loadE2eSupabaseEnv();
  await deleteWhere(
    apiUrl,
    serviceRoleKey,
    "parts",
    `part_code=eq.${encodeURIComponent(partCode)}`,
  );
}

export async function seedTestPart(partCode: string, stock: number): Promise<{ id: string }> {
  const { apiUrl, serviceRoleKey } = loadE2eSupabaseEnv();
  return postRow<{ id: string }>(apiUrl, serviceRoleKey, "parts", {
    part_code: partCode,
    description: `Repuesto E2E ${partCode}`,
    stock,
    unit_cost: 1000,
  });
}

export async function seedTestOrderPart(
  orderId: string,
  partId: string,
  stage: "quoted" | "used",
  quantity: number,
): Promise<void> {
  const { apiUrl, serviceRoleKey } = loadE2eSupabaseEnv();
  await postRow(apiUrl, serviceRoleKey, "order_parts", {
    order_id: orderId,
    part_id: partId,
    stage,
    quantity,
  });
}

export async function seedTestEvaluation(orderId: string): Promise<void> {
  const { apiUrl, serviceRoleKey } = loadE2eSupabaseEnv();
  await postRow(apiUrl, serviceRoleKey, "technical_evaluations", {
    order_id: orderId,
    diagnosis: "Diagnóstico registrado para validar el historial E2E",
  });
}

export async function seedTestBudget(
  orderId: string,
  values: Partial<{
    labor_cost: number;
    parts_cost: number;
    freight_cost: number;
    other_charges: number;
    advances: number;
  }> = {},
): Promise<void> {
  const { apiUrl, serviceRoleKey } = loadE2eSupabaseEnv();
  const response = await fetch(`${apiUrl}/rest/v1/budgets?on_conflict=order_id`, {
    method: "POST",
    headers: {
      ...adminHeaders(serviceRoleKey),
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify({
      order_id: orderId,
      labor_cost: 10000,
      parts_cost: 0,
      freight_cost: 0,
      other_charges: 0,
      advances: 0,
      ...values,
    }),
  });
  if (!response.ok) {
    throw new Error(`seed budgets: ${response.status} ${await response.text()}`);
  }
}

export async function seedTestPayment(
  orderId: string,
  amount: number,
  method: "cash" | "card" | "transfer",
): Promise<void> {
  const { apiUrl, serviceRoleKey } = loadE2eSupabaseEnv();
  await postRow(apiUrl, serviceRoleKey, "payments", { order_id: orderId, amount, method });
}

/** Deletes a test order's customer and optional independent equipment. */
export async function deleteTestCustomer(clientId: string, equipmentId?: string): Promise<void> {
  const { apiUrl, serviceRoleKey } = loadE2eSupabaseEnv();
  const ordersResponse = await fetch(
    `${apiUrl}/rest/v1/orders?client_id=eq.${clientId}&select=id`,
    { headers: adminHeaders(serviceRoleKey) },
  );
  if (!ordersResponse.ok) {
    throw new Error(
      `lookup customer orders: ${ordersResponse.status} ${await ordersResponse.text()}`,
    );
  }
  const orders = (await ordersResponse.json()) as { id: string }[];
  for (const order of orders) {
    await deleteWhere(apiUrl, serviceRoleKey, "order_parts", `order_id=eq.${order.id}`);
  }
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
