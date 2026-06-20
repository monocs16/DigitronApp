import { supabase } from "@/integrations/supabase/client";

export const customersRepository = {
  getAll: async () => {
    const { data, error } = await supabase
      .from("customers")
      .select("id, name, tax_id, phone1, phone2, email, address")
      .order("name");
    if (error) throw error;
    return data;
  },

  getAllMin: async () => {
    const { data, error } = await supabase.from("customers").select("id, name").order("name");
    if (error) throw error;
    return data;
  },

  create: async (payload: {
    name: string;
    tax_id: string | null;
    phone1: string | null;
    phone2: string | null;
    email: string | null;
    address: string | null;
  }) => {
    const { data, error } = await supabase.from("customers").insert(payload).select("id").single();
    if (error) throw error;
    return data.id as string;
  },

  update: async (
    id: string,
    payload: {
      name: string;
      tax_id: string | null;
      phone1: string | null;
      phone2: string | null;
      email: string | null;
      address: string | null;
    },
  ) => {
    const { error } = await supabase.from("customers").update(payload).eq("id", id);
    if (error) throw error;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) throw error;
  },
};
