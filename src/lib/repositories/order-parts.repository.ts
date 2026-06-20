import { supabase } from "@/integrations/supabase/client";

export const orderPartsRepository = {
  getByOrderId: async (orderId: string) => {
    const { data, error } = await supabase
      .from("order_parts")
      .select("id, part_id, stage, quantity, unit_cost_at_registration, in_stock_at_registration")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data;
  },

  getAllUsedForReports: async () => {
    const { data, error } = await supabase
      .from("order_parts")
      .select(
        "part_id, quantity, unit_cost_at_registration, created_at, parts(part_code, description)",
      )
      .eq("stage", "used");
    if (error) throw error;
    return data;
  },

  create: async (payload: {
    order_id: string;
    part_id: string;
    stage: "quoted" | "used";
    quantity: number;
    unit_cost_at_registration: number;
    in_stock_at_registration: boolean;
    evaluation_id?: string;
  }) => {
    const { error } = await supabase.from("order_parts").insert(payload);
    if (error) throw error;
  },
};
