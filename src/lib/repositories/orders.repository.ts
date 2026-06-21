import { supabase } from "@/integrations/supabase/client";

export const ordersRepository = {
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
    const { data, error } = await supabase
      .from("orders")
      .select(
        "id, order_number, stage, technician_id, client_id, created_at, warranty_origin_id, customers(name)",
      );
    if (error) throw error;
    return data;
  },

  getById: async (orderId: string) => {
    const { data, error } = await supabase
      .from("orders")
      .select(
        `*, customers(id, name, phone1, email), equipment(id, type, brand, model, serial_number)`,
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
  }) => {
    const { data, error } = await supabase.from("orders").insert(payload).select("id").single();
    if (error) throw error;
    return data;
  },

  updateTechnician: async (orderId: string, technicianId: string | null) => {
    const { error } = await supabase
      .from("orders")
      .update({ technician_id: technicianId })
      .eq("id", orderId);
    if (error) throw error;
  },

  updateNotes: async (orderId: string, notes: string | null) => {
    const { error } = await supabase
      .from("orders")
      .update({ general_notes: notes })
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
