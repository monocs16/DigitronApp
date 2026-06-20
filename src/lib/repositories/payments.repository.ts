import { supabase } from "@/integrations/supabase/client";

export const paymentsRepository = {
  getByOrderId: async (orderId: string) => {
    const { data, error } = await supabase
      .from("payments")
      .select("id, amount, method, reference, paid_at, registered_by")
      .eq("order_id", orderId)
      .order("paid_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  getAllForReports: async () => {
    const { data, error } = await supabase.from("payments").select("amount, paid_at");
    if (error) throw error;
    return data;
  },

  create: async (payload: {
    order_id: string;
    amount: number;
    method: string;
    reference: string | null;
    registered_by: string | null;
  }) => {
    const { error } = await supabase.from("payments").insert(payload);
    if (error) throw error;
  },
};
