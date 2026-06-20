import { supabase } from "@/integrations/supabase/client";

export const repairsRepository = {
  getByOrderId: async (orderId: string) => {
    const { data, error } = await supabase
      .from("repairs")
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
      work_description: string | null;
      technician_id: string | null;
      state?: string;
      started_at?: string;
      finished_at?: string;
    },
  ) => {
    const { error } = existing
      ? await supabase.from("repairs").update(payload).eq("id", existing.id)
      : await supabase.from("repairs").insert({ state: "in_progress", ...payload });
    if (error) throw error;
  },
};
