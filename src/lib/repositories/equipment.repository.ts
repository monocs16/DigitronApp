import { supabase } from "@/integrations/supabase/client";

function equipmentSearchFilter(term: string): string {
  const pattern = `%${term.trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  return ["model", "serial_number", "brand"]
    .map((column) => `${column}.ilike.${pattern}`)
    .join(",");
}

export const equipmentRepository = {
  getAll: async () => {
    const { data, error } = await supabase
      .from("equipment")
      .select(
        "id, type, brand, model, serial_number, purchase_invoice, purchase_store, purchase_date",
      )
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
