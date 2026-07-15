#!/usr/bin/env node
/**
 * Creates idempotent demo customers and independent equipment in the LOCAL
 * Supabase stack. It requires API_URL and SERVICE_ROLE_KEY from `supabase status`.
 */
const API_URL = process.env.API_URL;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;

if (!API_URL || !SERVICE_ROLE_KEY) {
  console.error("seed-demo: API_URL and SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

const customers = [
  {
    name: "Demo — María Fernández",
    tax_id: "DEMO-100001",
    phone1: "8888-1001",
    email: "maria.fernandez@example.test",
    address: "San José, Barrio Escalante",
  },
  {
    name: "Demo — Carlos Ramírez",
    tax_id: "DEMO-100002",
    phone1: "8888-1002",
    email: "carlos.ramirez@example.test",
    address: "Heredia, San Francisco",
  },
  {
    name: "Demo — Sofía Morales",
    tax_id: "DEMO-100003",
    phone1: "8888-1003",
    email: "sofia.morales@example.test",
    address: "Cartago, El Carmen",
  },
  {
    name: "Demo — Grupo Horizonte S.A.",
    tax_id: "DEMO-310100004",
    phone1: "2222-1004",
    email: "contacto@horizonte.example.test",
    address: "San José, Sabana Norte",
  },
  {
    name: "Demo — Andrea Castillo",
    tax_id: "DEMO-100005",
    phone1: "8888-1005",
    email: "andrea.castillo@example.test",
    address: "Alajuela, Grecia",
  },
  {
    name: "Demo — Taller Mecánico Rojas",
    tax_id: "DEMO-310100006",
    phone1: "2444-1006",
    email: "servicio@rojas.example.test",
    address: "Alajuela, San Ramón",
  },
];

const equipment = [
  ["Laptop", "Dell", "Latitude 5420", "DEMO-LT-1001"],
  ["Laptop", "HP", "ProBook 450 G8", "DEMO-LT-1002"],
  ["Laptop", "Lenovo", "ThinkPad E14", "DEMO-LT-1003"],
  ["Laptop", "Apple", "MacBook Air M2", "DEMO-LT-1004"],
  ["Impresora", "Epson", "EcoTank L3250", "DEMO-PR-2001"],
  ["Impresora", "HP", "LaserJet Pro M404dn", "DEMO-PR-2002"],
  ["Teléfono", "Samsung", "Galaxy A54", "DEMO-PH-3001"],
  ["Teléfono", "Apple", "iPhone 13", "DEMO-PH-3002"],
  ["Tablet", "Samsung", "Galaxy Tab S8", "DEMO-TB-4001"],
  ["Monitor", "LG", "24MP400", "DEMO-MN-5001"],
].map(([type, brand, model, serial_number]) => ({
  type,
  brand,
  model,
  serial_number,
  purchase_store: "Demo Store",
  purchase_date: "2025-01-15",
  purchase_invoice: `FAC-${serial_number}`,
}));

const parts = [
  ["DEMO-RAM-001", "Memoria RAM DDR4 8 GB", 18.5, 12, "Componentes Central"],
  ["DEMO-RAM-002", "Memoria RAM DDR4 16 GB", 32.75, 4, "Componentes Central"],
  ["DEMO-SSD-001", "Disco SSD 240 GB SATA", 19.9, 8, "TecnoPartes CR"],
  ["DEMO-SSD-002", "Disco SSD 1 TB NVMe", 54.5, 2, "TecnoPartes CR"],
  ["DEMO-BAT-001", "Batería compatible para laptop Dell", 38, 3, "Baterías Express"],
  ["DEMO-SCR-001", "Pantalla LCD 15.6 pulgadas", 82.25, 1, "Pantallas y Más"],
  ["DEMO-PRT-001", "Cabezal de impresión Epson L3250", 46, 0, "Print Supply"],
  ["DEMO-TON-001", "Tóner HP 58A compatible", 21.5, 6, "Print Supply"],
  ["DEMO-USB-001", "Puerto de carga USB-C", 7.25, 15, "Móvil Repuestos"],
  ["DEMO-FAN-001", "Ventilador para laptop Lenovo", 14.8, 2, "Componentes Central"],
].map(([part_code, description, unit_cost, stock, supplier]) => ({
  part_code,
  description,
  unit_cost,
  stock,
  supplier,
}));

async function ensureRow(table, query, row, label) {
  const existing = await fetch(`${API_URL}/rest/v1/${table}?${query}&select=id`, { headers });
  if (!existing.ok) throw new Error(`lookup ${label} failed (${existing.status}): ${await existing.text()}`);
  if ((await existing.json()).length > 0) return false;

  const created = await fetch(`${API_URL}/rest/v1/${table}`, {
    method: "POST",
    headers,
    body: JSON.stringify(row),
  });
  if (!created.ok) throw new Error(`create ${label} failed (${created.status}): ${await created.text()}`);
  return true;
}

async function main() {
  let customersAdded = 0;
  let equipmentAdded = 0;
  let partsAdded = 0;

  for (const customer of customers) {
    if (await ensureRow("customers", `tax_id=eq.${encodeURIComponent(customer.tax_id)}`, customer, customer.name)) {
      customersAdded += 1;
    }
  }

  for (const item of equipment) {
    if (await ensureRow("equipment", `serial_number=eq.${encodeURIComponent(item.serial_number)}`, item, item.serial_number)) {
      equipmentAdded += 1;
    }
  }

  for (const part of parts) {
    if (await ensureRow("parts", `part_code=eq.${encodeURIComponent(part.part_code)}`, part, part.part_code)) {
      partsAdded += 1;
    }
  }

  console.log(
    `✓ Demo data ready: ${customersAdded} customer(s), ${equipmentAdded} equipment item(s), ${partsAdded} part(s) added.`,
  );
}

main().catch((error) => {
  console.error(`seed-demo failed: ${error.message}`);
  process.exit(1);
});
