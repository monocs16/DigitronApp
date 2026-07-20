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
