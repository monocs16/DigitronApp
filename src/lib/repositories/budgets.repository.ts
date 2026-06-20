import { supabase } from "@/integrations/supabase/client";

export const budgetsRepository = {
  getByOrderId: async (orderId: string) => {
    const { data, error } = await supabase
      .from("budgets")
      .select("*")
      .eq("order_id", orderId)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  upsert: async (
    existing: { id: string } | null | undefined,
    payload: {
      order_id: string;
      labor_cost: number;
      parts_cost: number;
      freight_cost: number;
      other_charges: number;
      advances: number;
      deferred_reason: string | null;
      customer_comments: string | null;
    },
  ) => {
    const { error } = existing
      ? await supabase.from("budgets").update(payload).eq("id", existing.id)
      : await supabase.from("budgets").insert(payload);
    if (error) throw error;
  },
};
