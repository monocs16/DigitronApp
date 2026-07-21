import { supabase } from "@/integrations/supabase/client";

export const partsRepository = {
  getAll: async () => {
    const { data, error } = await supabase
      .from("parts")
      .select("id, part_code, description, unit_cost, stock, supplier")
      .order("part_code", { ascending: true });
    if (error) throw error;
    return data;
  },

  getTechnicianCatalog: async (): Promise<
    { id: string; part_code: string; description: string }[]
  > => {
    const view = supabase.from("parts_technician" as never) as unknown as {
      select: (columns: string) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => Promise<{
          data: { id: string; part_code: string; description: string }[] | null;
          error: Error | null;
        }>;
      };
    };
    const { data, error } = await view
      .select("id, part_code, description")
      .order("part_code", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  create: async (payload: {
    part_code: string;
    description: string;
    unit_cost: number;
    stock: number;
    supplier: string | null;
    created_from_order_id?: string | null;
  }) => {
    const id = crypto.randomUUID();
    const { error } = await supabase.from("parts").insert({ ...payload, id });
    if (error) throw error;
    return id;
  },

  update: async (
    id: string,
    payload: {
      part_code: string;
      description: string;
      unit_cost: number;
      stock: number;
      supplier: string | null;
    },
  ) => {
    const { error } = await supabase.from("parts").update(payload).eq("id", id);
    if (error) throw error;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from("parts").delete().eq("id", id);
    if (error) throw error;
  },
};
