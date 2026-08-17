import { supabase } from "@/integrations/supabase/client";
import { getPageRange, type PageRequest, type PaginatedResult } from "@/lib/pagination";
import { buildIlikeOrFilter } from "./query-helpers";

const EQUIPMENT_LIST_SELECT =
  "id, type, brand, model, description, serial_number, purchase_invoice, purchase_store, purchase_date";

export type EquipmentListRow = {
  id: string;
  type: string;
  brand: string;
  model: string;
  description: string | null;
  serial_number: string | null;
  purchase_invoice: string | null;
  purchase_store: string | null;
  purchase_date: string | null;
};

function equipmentSearchFilter(term: string): string {
  return buildIlikeOrFilter(["description", "model", "serial_number", "brand"], term);
}

export const equipmentRepository = {
  getPage: async ({
    page,
    pageSize,
    search = "",
  }: PageRequest): Promise<PaginatedResult<EquipmentListRow>> => {
    const { from, to } = getPageRange(page, pageSize);
    let query = supabase.from("equipment").select(EQUIPMENT_LIST_SELECT, { count: "exact" });

    if (search.trim()) query = query.or(equipmentSearchFilter(search));

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, to);
    if (error) throw error;
    return { rows: data, count: count ?? 0 };
  },

  getAll: async () => {
    const { data, error } = await supabase
      .from("equipment")
      .select(EQUIPMENT_LIST_SELECT)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  searchWithHistory: async (term: string) => {
    const value = term.trim();
    if (!value) return [];
    const { data, error } = await supabase
      .from("equipment")
      .select("id, type, brand, model, serial_number, orders(id, order_number, stage, intake_at)")
      .or(equipmentSearchFilter(value))
      .order("brand")
      .order("model")
      .limit(50);
    if (error) throw error;
    return data;
  },

  search: async (term: string) => {
    const value = term.trim();
    if (value.length < 2) return [];
    const { data, error } = await supabase
      .from("equipment")
      .select("id, type, brand, model, serial_number")
      .or(equipmentSearchFilter(value))
      .order("brand")
      .order("model")
      .limit(20);
    if (error) throw error;
    return data;
  },

  getAllMin: async () => {
    const { data, error } = await supabase
      .from("equipment")
      .select("id, brand, model, type, serial_number")
      .order("brand")
      .order("model");
    if (error) throw error;
    return data;
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from("equipment")
      .select("id, type, brand, model, serial_number")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  getSuggestions: async () => {
    const { data, error } = await supabase.from("equipment").select("type, brand, model");
    if (error) throw error;
    const unique = (key: "type" | "brand" | "model") =>
      [...new Set((data ?? []).map((row) => row[key].trim()).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      );
    return { types: unique("type"), brands: unique("brand"), models: unique("model") };
  },

  create: async (payload: {
    type: string;
    brand: string;
    model: string;
    description: string | null;
    serial_number: string | null;
    purchase_invoice: string | null;
    purchase_store: string | null;
    purchase_date: string | null;
  }) => {
    // The schema type is regenerated after the migration is applied; this cast
    // keeps the client buildable while a developer has pending local migrations.
    const { data, error } = await supabase
      .from("equipment")
      .insert(payload as never)
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  },

  update: async (
    id: string,
    payload: {
      type: string;
      brand: string;
      model: string;
      description: string | null;
      serial_number: string | null;
      purchase_invoice: string | null;
      purchase_store: string | null;
      purchase_date: string | null;
    },
  ) => {
    const { error } = await supabase.from("equipment").update(payload).eq("id", id);
    if (error) throw error;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from("equipment").delete().eq("id", id);
    if (error) throw error;
  },
};
