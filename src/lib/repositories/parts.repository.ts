import { supabase } from "@/integrations/supabase/client";

export const partsRepository = {
  getAll: async () => {
    const { data, error } = await supabase
      .from("parts")
      .select(
        "id, part_code, stock, location, description, datasheet, nte_substitute, image, unit_cost, supplier",
      )
      .order("part_code", { ascending: true });
    if (error) throw error;
    return data;
  },

  getTechnicianCatalog: async (): Promise<
    {
      id: string;
      part_code: string;
      location: string | null;
      description: string;
      datasheet: string | null;
      nte_substitute: string | null;
      image: string | null;
    }[]
  > => {
    const { data, error } = await supabase
      .from("parts_technician")
      .select("id, part_code, location, description, datasheet, nte_substitute, image")
      .order("part_code", { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  create: async (payload: {
    part_code: string;
    location: string | null;
    description: string;
    datasheet: string | null;
    nte_substitute: string | null;
    image: string | null;
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
      location: string | null;
      description: string;
      datasheet: string | null;
      nte_substitute: string | null;
      image: string | null;
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
