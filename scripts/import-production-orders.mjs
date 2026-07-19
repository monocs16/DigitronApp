import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const source = process.argv[2];
const execute = process.argv.includes("--execute");
if (!source) throw new Error("Usage: node scripts/import-production-orders.mjs <xlsx> [--execute]");

const decodeXml = (value) =>
  value
    .replace(/<[^>]+>/g, "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&#39;", "'")
    .replaceAll("&quot;", '"');

function workbookRows(path) {
  const readEntry = statSync(path).isDirectory()
    ? (entry) => readFileSync(join(path, entry), "utf8")
    : (entry) => execFileSync("unzip", ["-p", path, entry], { encoding: "utf8" });
  const sharedXml = readEntry("xl/sharedStrings.xml");
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) =>
    [...match[1].matchAll(/<t(?: [^>]*)?>([\s\S]*?)<\/t>/g)]
      .map((text) => decodeXml(text[1]))
      .join(""),
  );
  const sheet = readEntry("xl/worksheets/sheet1.xml");
  return [...sheet.matchAll(/<row[^>]*r="(\d+)"[^>]*>([\s\S]*?)<\/row>/g)].map((row) => {
    const values = [];
    for (const cell of row[2].matchAll(/<c[^>]*r="([A-Z]+)\d+"([^>]*)>([\s\S]*?)<\/c>/g)) {
      let column = 0;
      for (const letter of cell[1]) column = column * 26 + letter.charCodeAt(0) - 64;
      const raw = cell[3].match(/<v>([\s\S]*?)<\/v>/)?.[1] ?? "";
      values[column - 1] = /t="s"/.test(cell[2]) ? (shared[Number(raw)] ?? "") : raw;
    }
    return values;
  });
}

const clean = (value) => String(value ?? "").trim() || null;
const normalized = (value) =>
  (clean(value) ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .toUpperCase();

function costaRicaTimestamp(value) {
  if (!clean(value)) return null;
  if (/^\d+(\.\d+)?$/.test(value)) {
    const date = new Date((Number(value) - 25569) * 86_400_000);
    const pad = (n) => String(n).padStart(2, "0");
    // Numeric cells were saved under a US locale with day/month reversed.
    return (
      `${date.getUTCFullYear()}-${pad(date.getUTCDate())}-${pad(date.getUTCMonth() + 1)}` +
      `T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}-06:00`
    );
  }
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}) (\d{1,2}):(\d{2}):(\d{2}) ([AP]M)$/i);
  if (!match) throw new Error(`Unsupported date: ${value}`);
  let hour = Number(match[4]) % 12;
  if (match[7].toUpperCase() === "PM") hour += 12;
  const pad = (n) => String(n).padStart(2, "0");
  return `20${match[3]}-${pad(match[2])}-${pad(match[1])}T${pad(hour)}:${match[5]}:${match[6]}-06:00`;
}

function purchaseDate(value) {
  if (!clean(value)) return null;
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2})$/);
  if (!match) throw new Error(`Unsupported purchase date: ${value}`);
  return `20${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
}

const stageByLegacyStatus = new Map([
  ["AGUARDANDO ENTRADA DEL APARATO", "customer_decision"],
  ["EVALUACION TECNICA", "evaluation"],
  ["PRESUPUESTO", "budget"],
  ["AGUARDANDO APROBACION DE PRESUPUESTO", "customer_decision"],
  ["PRESUPUESTO NO APROBADO-AGUARDANDO RETI", "on_hold"],
  ["EN REPARACION", "repair"],
  ["REPARACION CONCLUIDA", "payment"],
  ["PRESUPUESTO NO APROBADO-RET.POR EL C.", "closed"],
  ["PRONTO Y PRODUCTO RETIRADO/ENTREGUE", "closed"],
]);
const serialPlaceholders = new Set(["NT", "W", "EDITAR", "MIGHTYMOUSE"]);

const rows = workbookRows(source)
  .slice(1)
  .filter((row) => /^\d{5}$/.test(clean(row[0]) ?? ""))
  .map((row) => {
    const orderNumber = clean(row[0]);
    const legacyStatus = normalized(row[2]);
    const stage = stageByLegacyStatus.get(legacyStatus);
    if (!stage) throw new Error(`Unknown status for ${orderNumber}: ${row[2]}`);
    let type = clean(row[10]);
    let brand = clean(row[11]);
    const model = clean(row[12]);
    if (orderNumber === "47714") {
      type ??= "PARLANTE";
      brand ??= "OTRA";
    }
    if (!type || !brand || !model) throw new Error(`Incomplete equipment for ${orderNumber}`);
    const rawSerial = clean(row[13]);
    const phone2 = clean(row[7]);
    return {
      orderNumber,
      customerKey: `${normalized(row[4])}|${normalized(row[6])}`,
      customer: {
        name: clean(row[4]),
        tax_id: clean(row[5]),
        phone1: clean(row[6]),
        phone2: phone2 && phone2.replace(/\D/g, "").length >= 7 ? phone2 : null,
        email: clean(row[8]),
        address: clean(row[9]),
        registered_at: costaRicaTimestamp(row[1]),
      },
      equipment: {
        type,
        brand,
        model,
        serial_number:
          rawSerial && !serialPlaceholders.has(normalized(rawSerial)) ? rawSerial : null,
        purchase_invoice: clean(row[14]),
        purchase_store: clean(row[15]),
        purchase_date: purchaseDate(row[17]),
      },
      order: {
        order_number: orderNumber,
        stage,
        source: clean(row[3]),
        reported_fault: clean(row[20]),
        general_notes: clean(row[23]),
        received_accessories: clean(row[19]),
        intake_at: costaRicaTimestamp(row[1]),
        delivery_at: costaRicaTimestamp(row[26]),
        authorized: /^(SI|YES|TRUE|1)$/i.test(clean(row[25]) ?? ""),
        received_by: clean(row[27]),
        closing_notes: clean(row[28]),
      },
    };
  });

if (rows.length !== 50 || rows[0].orderNumber !== "47670" || rows.at(-1).orderNumber !== "47719") {
  throw new Error("Expected exactly orders 47670–47719");
}
const uniqueCustomers = new Map();
for (const row of rows)
  if (!uniqueCustomers.has(row.customerKey)) uniqueCustomers.set(row.customerKey, row.customer);
const serials = rows.map((row) => row.equipment.serial_number?.toLowerCase()).filter(Boolean);
if (new Set(serials).size !== serials.length)
  throw new Error("Duplicate non-placeholder equipment serial");

const stageCounts = Object.fromEntries(
  Object.entries(Object.groupBy(rows, (row) => row.order.stage)).map(([stage, items]) => [
    stage,
    items.length,
  ]),
);
console.log(
  JSON.stringify(
    {
      mode: execute ? "execute" : "dry-run",
      orders: rows.length,
      customers: uniqueCustomers.size,
      equipment: rows.length,
      stages: stageCounts,
    },
    null,
    2,
  ),
);
if (!execute) process.exit(0);
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw new Error("Missing server credentials");

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const check = (label, result) => {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
};
const profiles = check(
  "profiles",
  await supabase.from("profiles").select("id,full_name,email,active"),
);
const technician = profiles.find(
  (profile) => normalized(profile.full_name) === "TECHNICIAN DIGITRON" && profile.active,
);
if (!technician) throw new Error("Active Technician Digitron profile not found");

// Replace operational data only. Authentication profiles and roles are preserved.
for (const table of [
  "order_photos",
  "order_notes",
  "payments",
  "repairs",
  "order_parts",
  "budgets",
  "technical_evaluations",
  "orders",
  "equipment",
  "customers",
  "parts",
]) {
  check(`clear ${table}`, await supabase.from(table).delete().not("id", "is", null));
}
check("clear audit_log", await supabase.from("audit_log").delete().not("id", "is", null));

const customerIds = new Map();
for (const [key, customer] of uniqueCustomers) {
  const inserted = check(
    "insert customer",
    await supabase.from("customers").insert(customer).select("id").single(),
  );
  customerIds.set(key, inserted.id);
}
for (const row of rows) {
  const equipment = check(
    `equipment ${row.orderNumber}`,
    await supabase.from("equipment").insert(row.equipment).select("id").single(),
  );
  check(
    `order ${row.orderNumber}`,
    await supabase.from("orders").insert({
      ...row.order,
      client_id: customerIds.get(row.customerKey),
      equipment_id: equipment.id,
      technician_id: technician.id,
      created_by: technician.id,
      created_at: row.order.intake_at,
      updated_at: row.order.delivery_at ?? row.order.intake_at,
    }),
  );
}
const verification = check(
  "verify orders",
  await supabase.from("orders").select("order_number,stage,technician_id").order("order_number"),
);
if (
  verification.length !== 50 ||
  verification[0].order_number !== "47670" ||
  verification.at(-1).order_number !== "47719"
) {
  throw new Error("Post-import order verification failed");
}
console.log(
  JSON.stringify(
    { imported: verification.length, nextOrderNumber: "47720", technician: technician.full_name },
    null,
    2,
  ),
);
