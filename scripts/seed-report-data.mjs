#!/usr/bin/env node
/**
 * Creates idempotent service-order fixtures for the configurable reports module.
 *
 * This script is intentionally LOCAL-ONLY. It accepts the API_URL and
 * SERVICE_ROLE_KEY emitted by `supabase status` and refuses non-loopback URLs.
 * Run it through `pnpm run seed:reports` after starting the local stack.
 */

const API_URL = process.env.API_URL;
const SERVICE_ROLE_KEY = process.env.SERVICE_ROLE_KEY;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@digitron.test";
const TECH_EMAIL = process.env.TECH_EMAIL || "tech@digitron.test";

if (!API_URL || !SERVICE_ROLE_KEY) {
  console.error("seed-reports: API_URL and SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

let parsedApiUrl;
try {
  parsedApiUrl = new URL(API_URL);
} catch {
  console.error("seed-reports: API_URL is not a valid URL.");
  process.exit(1);
}

const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
if (parsedApiUrl.protocol !== "http:" || !localHosts.has(parsedApiUrl.hostname)) {
  console.error(
    `seed-reports: refusing to write to non-local Supabase URL ${parsedApiUrl.origin}.`,
  );
  process.exit(1);
}

const headers = {
  apikey: SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
  "Content-Type": "application/json",
};

const ids = {
  customers: [
    "10000000-0000-4000-8000-000000000001",
    "10000000-0000-4000-8000-000000000002",
    "10000000-0000-4000-8000-000000000003",
    "10000000-0000-4000-8000-000000000004",
    "10000000-0000-4000-8000-000000000005",
  ],
  equipment: [
    "20000000-0000-4000-8000-000000000001",
    "20000000-0000-4000-8000-000000000002",
    "20000000-0000-4000-8000-000000000003",
    "20000000-0000-4000-8000-000000000004",
    "20000000-0000-4000-8000-000000000005",
    "20000000-0000-4000-8000-000000000006",
    "20000000-0000-4000-8000-000000000007",
    "20000000-0000-4000-8000-000000000008",
    "20000000-0000-4000-8000-000000000009",
    "20000000-0000-4000-8000-000000000010",
  ],
  parts: [
    "30000000-0000-4000-8000-000000000001",
    "30000000-0000-4000-8000-000000000002",
    "30000000-0000-4000-8000-000000000003",
    "30000000-0000-4000-8000-000000000004",
  ],
  orders: Array.from(
    { length: 100 },
    (_, index) => `40000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  ),
};

function isoDaysAgo(days, hour = 15) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hour, 0, 0, 0);
  return date.toISOString();
}

function restUrl(table, query = "") {
  return `${parsedApiUrl.origin}/rest/v1/${table}${query ? `?${query}` : ""}`;
}

async function getRows(table, query) {
  const response = await fetch(restUrl(table, query), { headers });
  if (!response.ok) {
    throw new Error(`lookup ${table} failed (${response.status}): ${await response.text()}`);
  }
  return response.json();
}

async function insertIfMissing(table, row, label, stats) {
  const existing = await getRows(table, `id=eq.${row.id}&select=id&limit=1`);
  if (existing.length > 0) {
    stats.existing += 1;
    return false;
  }

  const response = await fetch(restUrl(table), {
    method: "POST",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    throw new Error(`create ${label} failed (${response.status}): ${await response.text()}`);
  }
  stats.created += 1;
  return true;
}

async function profileId(email) {
  const rows = await getRows("profiles", `email=eq.${encodeURIComponent(email)}&select=id&limit=1`);
  if (!rows[0]?.id) {
    throw new Error(`profile ${email} not found; run pnpm run seed:admin first`);
  }
  return rows[0].id;
}

const customers = [
  {
    id: ids.customers[0],
    name: "Reportes Demo — Ana Solís",
    tax_id: "RPT-CLI-001",
    phone1: "8700-1001",
    phone2: "2200-1001",
    email: "ana.solis@reportes.example.test",
    address: "San José, Rohrmoser",
  },
  {
    id: ids.customers[1],
    name: "Reportes Demo — Clínica Central",
    tax_id: "RPT-CLI-002",
    phone1: "2200-2002",
    email: "soporte@clinica-central.example.test",
    address: "Heredia, San Pablo",
  },
  {
    id: ids.customers[2],
    name: "Reportes Demo — Diego Vargas",
    tax_id: "RPT-CLI-003",
    phone1: "8700-3003",
    email: "diego.vargas@reportes.example.test",
    address: "Cartago, Occidental",
  },
  {
    id: ids.customers[3],
    name: "Reportes Demo — Librería Horizonte",
    tax_id: "RPT-CLI-004",
    phone1: "2400-4004",
    email: "administracion@horizonte.example.test",
    address: "Alajuela, Grecia",
  },
  {
    id: ids.customers[4],
    name: "Reportes Demo — Valeria Mora",
    tax_id: "RPT-CLI-005",
    phone1: "8700-5005",
    email: "valeria.mora@reportes.example.test",
    address: "San José, Curridabat",
  },
];

const equipment = [
  ["Laptop", "Dell", "Latitude 5420", "RPT-EQ-001", "No enciende después de descarga"],
  ["Impresora", "Epson", "EcoTank L3250", "RPT-EQ-002", "Impresora de recepción"],
  ["Monitor", "LG", "27UP600", "RPT-EQ-003", "Monitor 4K de diseño"],
  ["Televisor", "Samsung", "UN55AU7000", "RPT-EQ-004", "Televisor sala de espera"],
  ["Laptop", "Lenovo", "ThinkPad E14", "RPT-EQ-005", "Equipo administrativo"],
  ["UPS", "APC", "Back-UPS 1200", "RPT-EQ-006", "Respaldo de servidor"],
  ["Tablet", "Apple", "iPad Air 5", "RPT-EQ-007", "Tablet para inventario"],
  ["Impresora", "HP", "LaserJet M404dn", "RPT-EQ-008", "Impresora contabilidad"],
  ["Consola", "Sony", "PlayStation 5", "RPT-EQ-009", "Equipo recibido por garantía"],
  ["Laptop", "Apple", "MacBook Air M2", "RPT-EQ-010", "Equipo de trabajo remoto"],
].map(([type, brand, model, serial_number, description], index) => ({
  id: ids.equipment[index],
  type,
  brand,
  model,
  serial_number,
  description,
  purchase_date: `2025-${String((index % 9) + 1).padStart(2, "0")}-15`,
  purchase_invoice: `RPT-FAC-${String(index + 1).padStart(3, "0")}`,
  purchase_store: index % 2 === 0 ? "Tecnología Central" : "Distribuidora Demo",
}));

const parts = [
  {
    id: ids.parts[0],
    part_code: "RPT-PWR-001",
    description: "Fuente de poder universal",
    unit_cost: 12000,
    stock: 20,
    supplier: "Componentes Reportes",
    location: "A-01",
  },
  {
    id: ids.parts[1],
    part_code: "RPT-CAP-001",
    description: "Capacitor electrolítico 1000 µF",
    unit_cost: 3500,
    stock: 40,
    supplier: "Electrónica Reportes",
    location: "B-12",
  },
  {
    id: ids.parts[2],
    part_code: "RPT-LCD-001",
    description: "Pantalla LCD de reemplazo",
    unit_cost: 48000,
    stock: 10,
    supplier: "Pantallas Reportes",
    location: "C-04",
  },
  {
    id: ids.parts[3],
    part_code: "RPT-CLN-001",
    description: "Kit de limpieza y mantenimiento",
    unit_cost: 6000,
    stock: 30,
    supplier: "Suministros Reportes",
    location: "D-02",
  },
];

async function main() {
  const stats = { created: 0, existing: 0 };
  const adminId = await profileId(ADMIN_EMAIL);
  const technicianId = await profileId(TECH_EMAIL);

  for (const customer of customers) {
    await insertIfMissing("customers", customer, customer.name, stats);
  }
  for (const item of equipment) {
    await insertIfMissing("equipment", item, item.serial_number, stats);
  }
  for (const part of parts) {
    await insertIfMissing("parts", part, part.part_code, stats);
  }

  const baseOrder = (index, values) => {
    const ageDays = 210 - index * 2;
    return {
      id: ids.orders[index],
      order_number: `RPT-${String(index + 1).padStart(4, "0")}`,
      client_id: ids.customers[index % ids.customers.length],
      equipment_id: ids.equipment[index % ids.equipment.length],
      source: ["counter", "phone", "web", "other"][index % 4],
      received_accessories: index % 2 === 0 ? "Cargador y cable de alimentación" : null,
      equipment_condition: index % 3 === 0 ? "Marcas normales de uso" : "Buen estado físico",
      created_by: adminId,
      created_at: isoDaysAgo(ageDays),
      intake_at: isoDaysAgo(ageDays),
      updated_at: isoDaysAgo(ageDays - 1),
      authorized: false,
      balance_waived: false,
      ...values,
    };
  };

  // The closed origin is inserted before its warranty follow-up to satisfy the self FK.
  const detailedOrders = [
    baseOrder(0, {
      stage: "intake",
      reported_fault: "Equipo recibido; pendiente de asignación y evaluación inicial.",
      general_notes: "Caso útil para filtrar órdenes sin técnico.",
    }),
    baseOrder(1, {
      stage: "evaluation",
      technician_id: technicianId,
      reported_fault: "Imprime con líneas y pierde intensidad después de varias páginas.",
      general_notes: "Cliente solicita diagnóstico antes de autorizar.",
    }),
    baseOrder(2, {
      stage: "budget",
      technician_id: technicianId,
      reported_fault: "La imagen parpadea al cambiar la resolución.",
    }),
    baseOrder(3, {
      stage: "customer_decision",
      technician_id: technicianId,
      reported_fault: "No muestra imagen, pero conserva audio.",
      decision_notified_at: isoDaysAgo(100),
    }),
    baseOrder(4, {
      stage: "on_hold",
      technician_id: technicianId,
      reported_fault: "Se apaga de forma aleatoria al trabajar con batería.",
      general_notes: "Cliente pidió esperar hasta el próximo mes.",
    }),
    baseOrder(5, {
      stage: "repair",
      technician_id: technicianId,
      reported_fault: "No mantiene carga y emite alarma continua.",
      authorized: true,
    }),
    baseOrder(6, {
      stage: "payment",
      technician_id: technicianId,
      reported_fault: "Puerto de carga intermitente y batería sin calibrar.",
      authorized: true,
    }),
    baseOrder(7, {
      stage: "awaiting_withdrawal",
      technician_id: technicianId,
      reported_fault: "Atasco recurrente en unidad dúplex.",
      decision_notified_at: isoDaysAgo(35),
      delivery_notified_at: isoDaysAgo(30),
      balance_waived: true,
    }),
    baseOrder(8, {
      stage: "closed",
      technician_id: technicianId,
      reported_fault: "No inicia y presenta daño en el conector de video.",
      authorized: true,
      decision_notified_at: isoDaysAgo(22),
      delivery_notified_at: isoDaysAgo(8),
      delivery_at: isoDaysAgo(7),
      received_by: "Valeria Mora",
      closing_notes: "Equipo entregado funcionando y probado con el cliente.",
    }),
    baseOrder(9, {
      stage: "repair",
      technician_id: technicianId,
      reported_fault: "Reincidencia: el equipo vuelve a apagarse bajo carga.",
      authorized: true,
      warranty_origin_id: ids.orders[8],
      general_notes: "Seguimiento de garantía de la orden RPT-0009.",
    }),
  ];

  const stages = [
    "intake",
    "evaluation",
    "budget",
    "customer_decision",
    "on_hold",
    "repair",
    "payment",
    "awaiting_withdrawal",
    "closed",
  ];
  const generatedOrders = Array.from({ length: 90 }, (_, offset) => {
    const index = offset + detailedOrders.length;
    const stage = stages[offset % stages.length];
    const isClosed = stage === "closed";
    const isAwaitingWithdrawal = stage === "awaiting_withdrawal";
    const requiresAuthorization = ["repair", "payment", "awaiting_withdrawal", "closed"].includes(
      stage,
    );

    return baseOrder(index, {
      stage,
      technician_id: stage === "intake" ? null : technicianId,
      reported_fault: `Escenario de reportes ${String(index + 1).padStart(3, "0")}: falla intermitente reproducida durante pruebas.`,
      general_notes: `Orden sintética idempotente para validar paginación, filtros y exportaciones (${stage}).`,
      authorized: requiresAuthorization,
      decision_notified_at: [
        "customer_decision",
        "on_hold",
        "repair",
        "payment",
        "awaiting_withdrawal",
        "closed",
      ].includes(stage)
        ? isoDaysAgo(205 - index * 2)
        : null,
      delivery_notified_at: isAwaitingWithdrawal || isClosed ? isoDaysAgo(203 - index * 2) : null,
      delivery_at: isClosed ? isoDaysAgo(202 - index * 2) : null,
      received_by: isClosed ? `Cliente reportes ${String(index + 1).padStart(3, "0")}` : null,
      closing_notes: isClosed ? "Orden sintética cerrada después de pruebas satisfactorias." : null,
      balance_waived: isAwaitingWithdrawal && index % 2 === 0,
    });
  });
  const orders = [...detailedOrders, ...generatedOrders];

  for (const order of orders) {
    await insertIfMissing("orders", order, order.order_number, stats);
  }

  const evaluations = detailedOrders.slice(1).map((order, index) => ({
    id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    order_id: order.id,
    technician_id: technicianId,
    evaluated_at: isoDaysAgo(130 - index * 14),
    diagnosis: [
      "Cabezal con residuos y flujo irregular de tinta.",
      "Falla en cable flex del panel y conector flojo.",
      "Fuente secundaria sin voltaje de salida.",
      "Batería degradada y circuito de carga inestable.",
      "Banco de baterías agotado; fuente requiere reemplazo.",
      "Conector USB-C con soldadura fracturada.",
      "Rodillos de arrastre desgastados.",
      "Daño en módulo de video y acumulación de polvo.",
      "Falla térmica reproducida durante prueba de garantía.",
    ][index],
    technical_notes: index % 2 === 0 ? "Pruebas eléctricas completadas en banco." : null,
  }));

  for (const evaluation of evaluations) {
    await insertIfMissing("technical_evaluations", evaluation, evaluation.id, stats);
  }

  const budgets = [
    [2, 18000, 0, 2500, 0, 0, null, null],
    [3, 42000, 0, 0, 5000, 0, null, null],
    [4, 36000, 0, 3000, 0, 0, "deferred", "Cliente solicitó posponer el trabajo"],
    [5, 32000, 0, 0, 0, 5000, "approved", null],
    [6, 28000, 0, 2500, 0, 0, "approved", null],
    [7, 25000, 0, 0, 0, 0, "rejected", null],
    [8, 22000, 0, 0, 5000, 10000, "approved", null],
    [9, 15000, 0, 0, 0, 0, "approved", null],
  ].map(
    (
      [
        orderIndex,
        labor_cost,
        parts_cost,
        freight_cost,
        other_charges,
        advances,
        decision,
        deferred_reason,
      ],
      index,
    ) => ({
      id: `60000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
      order_id: ids.orders[orderIndex],
      labor_cost,
      parts_cost,
      freight_cost,
      other_charges,
      advances,
      decision,
      deferred_reason,
      customer_comments: decision === "rejected" ? "Prefiere reemplazar el equipo." : null,
      budgeted_at: isoDaysAgo(115 - index * 13),
      decided_at: decision ? isoDaysAgo(110 - index * 13) : null,
    }),
  );

  // Budgets must exist before quoted lines because the quote trigger recalculates parts_cost.
  for (const budget of budgets) {
    await insertIfMissing("budgets", budget, budget.id, stats);
  }

  const orderParts = [
    [1, 5, 0, "quoted", 1],
    [2, 6, 1, "quoted", 2],
    [3, 6, 1, "used", 2],
    [4, 8, 2, "quoted", 1],
    [5, 8, 2, "used", 1],
    [6, 9, 3, "quoted", 1],
    [7, 9, 3, "used", 1],
  ].map(([lineIndex, orderIndex, partIndex, stage, quantity]) => ({
    id: `90000000-0000-4000-8000-${String(lineIndex).padStart(12, "0")}`,
    order_id: ids.orders[orderIndex],
    part_id: ids.parts[partIndex],
    stage,
    quantity,
  }));

  for (const line of orderParts) {
    await insertIfMissing("order_parts", line, line.id, stats);
  }

  const repairs = [
    [5, "in_progress", "Reemplazo de banco de baterías y pruebas de autonomía.", 70, null],
    [6, "completed", "Resoldado de conector USB-C y calibración de batería.", 55, 48],
    [8, "completed", "Cambio de módulo LCD, limpieza interna y pruebas de carga.", 25, 12],
    [9, "in_progress", "Diagnóstico térmico y validación del trabajo en garantía.", 8, null],
  ].map(([orderIndex, state, work_description, startedDaysAgo, finishedDaysAgo], index) => ({
    id: `70000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    order_id: ids.orders[orderIndex],
    technician_id: technicianId,
    state,
    work_description,
    started_at: isoDaysAgo(startedDaysAgo),
    finished_at: finishedDaysAgo ? isoDaysAgo(finishedDaysAgo) : null,
  }));

  for (const repair of repairs) {
    await insertIfMissing("repairs", repair, repair.id, stats);
  }

  const payments = [
    {
      id: "80000000-0000-4000-8000-000000000001",
      order_id: ids.orders[6],
      amount: 15000,
      method: "card",
      reference: "RPT-POS-15001",
      paid_at: isoDaysAgo(40),
      registered_by: adminId,
    },
    {
      id: "80000000-0000-4000-8000-000000000002",
      order_id: ids.orders[8],
      amount: 35000,
      method: "transfer",
      reference: "RPT-TR-35001",
      paid_at: isoDaysAgo(15),
      registered_by: adminId,
    },
    {
      id: "80000000-0000-4000-8000-000000000003",
      order_id: ids.orders[8],
      amount: 30000,
      method: "cash",
      reference: null,
      paid_at: isoDaysAgo(8),
      registered_by: adminId,
    },
  ];

  for (const payment of payments) {
    await insertIfMissing("payments", payment, payment.id, stats);
  }

  const notes = [
    [1, "Cliente dejó muestras de impresión para comparar el resultado."],
    [4, "Se confirmó por teléfono que la reparación queda temporalmente en espera."],
    [5, "Repuesto recibido y reparación iniciada en banco técnico."],
    [6, "Pruebas de carga completadas; pendiente cancelar el saldo."],
    [8, "Entrega verificada con el cliente y garantía explicada."],
    [9, "Caso abierto como seguimiento de garantía, sin costo para el cliente."],
  ].map(([orderIndex, body], index) => ({
    id: `a0000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    order_id: ids.orders[orderIndex],
    body,
    created_by: index % 2 === 0 ? technicianId : adminId,
    created_at: isoDaysAgo(120 - index * 18),
  }));

  for (const note of notes) {
    await insertIfMissing("order_notes", note, note.id, stats);
  }

  const reportOrders = await getRows(
    "orders",
    "order_number=like.RPT-*&select=id,order_number,stage&order=order_number.asc",
  );
  if (reportOrders.length !== orders.length) {
    throw new Error(
      `verification expected ${orders.length} report orders, found ${reportOrders.length}`,
    );
  }

  const orderIdFilter = ids.orders.join(",");
  const relatedExpectations = [
    ["technical_evaluations", 9],
    ["budgets", 8],
    ["order_parts", 7],
    ["repairs", 4],
    ["payments", 3],
    ["order_notes", 6],
  ];
  const relatedCounts = [];
  for (const [table, expected] of relatedExpectations) {
    const rows = await getRows(table, `order_id=in.(${orderIdFilter})&select=id`);
    if (rows.length !== expected) {
      throw new Error(`verification expected ${expected} ${table} rows, found ${rows.length}`);
    }
    relatedCounts.push(`${table}: ${rows.length}`);
  }

  const stageCounts = reportOrders.reduce((counts, order) => {
    counts.set(order.stage, (counts.get(order.stage) ?? 0) + 1);
    return counts;
  }, new Map());
  const stageSummary = [...stageCounts.entries()]
    .map(([stage, count]) => `${stage}=${count}`)
    .join(", ");

  console.log(`✓ Report demo data ready at ${parsedApiUrl.origin}.`);
  console.log(`  ${stats.created} row(s) created; ${stats.existing} already present.`);
  console.log(`  ${reportOrders.length} service orders available from RPT-0001 to RPT-0100.`);
  console.log(`  Stages: ${stageSummary}.`);
  console.log(`  Related rows: ${relatedCounts.join(", ")}.`);
}

main().catch((error) => {
  console.error(`seed-reports failed: ${error.message}`);
  process.exit(1);
});
