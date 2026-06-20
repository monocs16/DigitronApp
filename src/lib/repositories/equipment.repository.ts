import { supabase } from "@/integrations/supabase/client";

export const equipmentRepository = {
  getAll: async () => {
    const { data, error } = await supabase
      .from("equipment")
      .select(
        "id, type, brand, model, serial_number, accessories, purchase_invoice, purchase_store, purchase_date, client_id, customers(name)",
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  getBySerialNumber: async (serial: string) => {
    const { data, error } = await supabase
      .from("equipment")
      .select(
        "id, type, brand, model, serial_number, customers(name), orders(id, order_number, stage, intake_at)",
      )
      .ilike("serial_number", `%${serial}%`);
    if (error) throw error;
    return data;
  },

  getByClientId: async (clientId: string) => {
    const { data, error } = await supabase
      .from("equipment")
      .select("id, brand, model, type")
      .eq("client_id", clientId);
    if (error) throw error;
    return data;
  },

  create: async (payload: {
    client_id: string;
    type: string;
    brand: string;
    model: string;
    serial_number: string | null;
    accessories: string | null;
    purchase_invoice: string | null;
    purchase_store: string | null;
    purchase_date: string | null;
  }) => {
    const { data, error } = await supabase.from("equipment").insert(payload).select("id").single();
    if (error) throw error;
    return data.id as string;
  },

  update: async (
    id: string,
    payload: {
      client_id: string;
      type: string;
      brand: string;
      model: string;
      serial_number: string | null;
      accessories: string | null;
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
