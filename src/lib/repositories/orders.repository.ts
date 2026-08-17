import { supabase } from "@/integrations/supabase/client";
import type { OrderStage } from "@/lib/digitron";
import { getPageRange, type PageRequest, type PaginatedResult } from "@/lib/pagination";
import { buildIlikeOrFilter } from "./query-helpers";

const ORDER_LIST_SELECT =
  "id, order_number, stage, technician_id, client_id, equipment_id, created_at, customer_name, equipment_brand, equipment_model, technician_name";

export type OrderListRow = {
  id: string;
  order_number: string;
  stage: OrderStage;
  technician_id: string | null;
  client_id: string;
  equipment_id: string;
  created_at: string;
  customer_name: string | null;
  equipment_brand: string | null;
  equipment_model: string | null;
  technician_name: string | null;
};

export type OrdersPageRequest = PageRequest & {
  stage?: OrderStage;
  technicianId?: string | "none";
  clientId?: string;
  equipmentId?: string;
  fromDate?: string;
  toDate?: string;
};

const REPORT_PAGE_SIZE = 1_000;
const REPORT_SELECT = `id, order_number, stage, technician_id, client_id, created_at, updated_at, intake_at,
  delivery_at, decision_notified_at, delivery_notified_at, source, authorized,
  balance_waived, warranty_origin_id, reported_fault, received_accessories,
  equipment_condition, general_notes, closing_notes, received_by,
  customers(name, tax_id, phone1, phone2, email, address),
  equipment(type, brand, model, serial_number, description, purchase_date, purchase_invoice, purchase_store),
  technician:profiles!orders_technician_id_fkey(full_name),
  technical_evaluations(diagnosis, technical_notes, evaluated_at),
  budgets(labor_cost, parts_cost, freight_cost, other_charges, advances, customer_comments,
    decision, deferred_reason, budgeted_at, decided_at),
  repairs(state, work_description, started_at, finished_at),
  payments(amount, method, reference, paid_at)`;

async function getReportOrdersPage(from: number, to: number) {
  return supabase
    .from("orders")
    .select(REPORT_SELECT)
    .order("created_at", { ascending: false })
    .range(from, to);
}

type ReportOrdersPage = NonNullable<Awaited<ReturnType<typeof getReportOrdersPage>>["data"]>;

export const ordersRepository = {
  getPage: async ({
    page,
    pageSize,
    search = "",
    stage,
    technicianId,
    clientId,
    equipmentId,
    fromDate,
    toDate,
  }: OrdersPageRequest): Promise<PaginatedResult<OrderListRow>> => {
    const { from, to } = getPageRange(page, pageSize);
    let query = supabase.from("orders_list").select(ORDER_LIST_SELECT, { count: "exact" });

    if (search.trim()) {
      query = query.or(
        buildIlikeOrFilter(
          ["order_number", "customer_name", "equipment_brand", "equipment_model"],
          search,
        ),
      );
    }
    if (stage) query = query.eq("stage", stage);
    if (technicianId === "none") query = query.is("technician_id", null);
    else if (technicianId) query = query.eq("technician_id", technicianId);
    if (clientId) query = query.eq("client_id", clientId);
    if (equipmentId) query = query.eq("equipment_id", equipmentId);
    if (fromDate) query = query.gte("created_at", `${fromDate}T00:00:00.000Z`);
    if (toDate) query = query.lte("created_at", `${toDate}T23:59:59.999Z`);

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return { rows: data as OrderListRow[], count: count ?? 0 };
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `id, order_number, stage, technician_id, client_id, equipment_id, created_at,
         customers(name), equipment(brand, model),
         technician:profiles!orders_technician_id_fkey(full_name)`,
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  getAllSummary: async () => {
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, stage, technician_id, created_at, updated_at, customers(name), equipment(brand, model)",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  getAllForReports: async () => {
    const rows: ReportOrdersPage = [];
    let from = 0;

    while (true) {
      const { data, error } = await getReportOrdersPage(from, from + REPORT_PAGE_SIZE - 1);
      if (error) throw error;
      rows.push(...data);
      if (data.length < REPORT_PAGE_SIZE) break;
      from += REPORT_PAGE_SIZE;
    }

    return rows;
  },

  getById: async (orderId: string) => {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `*, customers(id, name, phone1, email, address), equipment(id, type, brand, model, serial_number)`,
      )
      .eq("id", orderId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  create: async (payload: {
    client_id: string;
    equipment_id: string;
    reported_fault: string;
    source: string;
    technician_id: string | null;
    received_accessories: string | null;
    equipment_condition: string;
    advance: number;
  }) => {
    const { advance, ...order } = payload;
    const { data, error } = await supabase
      .from("orders")
      .insert({ ...order, stage: "evaluation" })
      .select("id")
      .single();
    if (error) throw error;
    if (advance > 0) {
      const { error: budgetError } = await supabase
        .from("budgets")
        .insert({ order_id: data.id as string, advances: advance });
      if (budgetError) throw budgetError;
    }
    return data;
  },

  updateTechnician: async (orderId: string, technicianId: string | null) => {
    const { error } = await supabase
      .from("orders")
      .update({ technician_id: technicianId })
      .eq("id", orderId);
    if (error) throw error;
  },

  waiveBalance: async (orderId: string) => {
    const { error } = await supabase
      .from("orders")
      .update({ balance_waived: true })
      .eq("id", orderId);
    if (error) throw error;
  },
};
