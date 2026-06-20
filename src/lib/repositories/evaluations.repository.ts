import { supabase } from "@/integrations/supabase/client";

export const evaluationsRepository = {
  getByOrderId: async (orderId: string) => {
    const { data, error } = await supabase
      .from("technical_evaluations")
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
      diagnosis: string;
      technical_notes: string | null;
      technician_id: string | null;
    },
  ) => {
    const { error } = existing
      ? await supabase.from("technical_evaluations").update(payload).eq("id", existing.id)
      : await supabase.from("technical_evaluations").insert(payload);
    if (error) throw error;
  },
};
