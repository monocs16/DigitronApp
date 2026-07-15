import { supabase } from "@/integrations/supabase/client";

export const orderNotesRepository = {
  getByOrderId: async (orderId: string) => {
    const table = supabase.from("order_notes" as never) as unknown as {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          order: (
            column: string,
            options: { ascending: boolean },
          ) => Promise<{
            data: { id: string; body: string; created_by: string; created_at: string }[] | null;
            error: Error | null;
          }>;
        };
      };
    };
    const { data, error } = await table
      .select("id, body, created_by, created_at")
      .eq("order_id", orderId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  },

  create: async (orderId: string, body: string, createdBy: string) => {
    const table = supabase.from("order_notes" as never) as unknown as {
      insert: (row: {
        order_id: string;
        body: string;
        created_by: string;
      }) => Promise<{ error: Error | null }>;
    };
    const { error } = await table.insert({
      order_id: orderId,
      body: body.trim(),
      created_by: createdBy,
    });
    if (error) throw error;
  },
};
