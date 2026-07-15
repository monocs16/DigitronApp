import { supabase } from "@/integrations/supabase/client";

export type OrderPartLine = {
  id: string;
  part_id: string;
  stage: string;
  quantity: number;
  unit_cost_at_registration?: number | null;
  in_stock_at_registration?: boolean;
};

export const orderPartsRepository = {
  getByOrderId: async (orderId: string, privateValues: boolean): Promise<OrderPartLine[]> => {
    if (privateValues) {
      const { data, error } = await supabase
        .from("order_parts")
        .select("id, part_id, stage, quantity, unit_cost_at_registration, in_stock_at_registration")
        .eq("order_id", orderId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    }
    const view = supabase.from("order_parts_technician" as never) as unknown as {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          order: (
            column: string,
            options: { ascending: boolean },
          ) => Promise<{
            data: { id: string; part_id: string; stage: string; quantity: number }[] | null;
            error: Error | null;
          }>;
        };
      };
    };
    const { data, error } = await view
      .select("id, part_id, stage, quantity")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data ?? [];
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
    evaluation_id?: string;
  }) => {
    const { error } = await supabase.from("order_parts").insert(payload);
    if (error) throw error;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from("order_parts").delete().eq("id", id);
    if (error) throw error;
  },
};
