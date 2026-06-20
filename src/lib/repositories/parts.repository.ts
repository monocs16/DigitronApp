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

  create: async (payload: {
    part_code: string;
    description: string;
    unit_cost: number;
    stock: number;
    supplier: string | null;
  }) => {
    const { data, error } = await supabase.from("parts").insert(payload).select("id").single();
    if (error) throw error;
    return data.id as string;
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
