import { supabase } from "@/integrations/supabase/client";

function customerSearchFilter(term: string): string {
  const pattern = `%${term.trim().replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  return ["name", "phone1", "phone2", "tax_id"]
    .map((column) => `${column}.ilike.${pattern}`)
    .join(",");
}

export const customersRepository = {
  getAll: async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, tax_id, phone1, phone2, email, address")
      .order("name");
    if (error) throw error;
    return data;
  },

  getAllMin: async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, tax_id")
      .order("name");
    if (error) throw error;
    return data;
  },

  search: async (term: string) => {
    const value = term.trim();
    if (value.length < 2) return [];
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, tax_id, phone1, phone2")
      .or(customerSearchFilter(value))
      .order("name")
      .limit(20);
    if (error) throw error;
    return data;
  },

  searchWithHistory: async (term: string) => {
    const value = term.trim();
    if (!value) return [];
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, tax_id, phone1, phone2, orders(id, order_number, stage, intake_at)")
      .or(customerSearchFilter(value))
      .order("name")
      .limit(50);
    if (error) throw error;
    return data;
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, tax_id")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  create: async (payload: {
    name: string;
    tax_id: string | null;
    phone1: string | null;
    phone2: string | null;
    email: string | null;
    address: string | null;
  }) => {
    const { data, error } = await supabase.from("customers").insert(payload).select("id").single();
    if (error) throw error;
    return data.id as string;
  },

  update: async (
    id: string,
    payload: {
      name: string;
      tax_id: string | null;
      phone1: string | null;
      phone2: string | null;
      email: string | null;
      address: string | null;
    },
  ) => {
    const { error } = await supabase.from("customers").update(payload).eq("id", id);
    if (error) throw error;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw error;
  },
};
