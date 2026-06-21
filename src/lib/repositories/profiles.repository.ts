import { supabase } from "@/integrations/supabase/client";

export const profilesRepository = {
  getById: async (uid: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, active")
      .eq("id", uid)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  getAllMin: async () => {
    const { data, error } = await supabase.from("profiles").select("id, full_name");
    if (error) throw error;
    return data;
  },

  getByIds: async (ids: string[]) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", ids)
      .order("full_name");
    if (error) throw error;
    return data;
  },

  updateDisplayName: async (userId: string, fullName: string) => {
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName })
      .eq("id", userId);
    if (error) throw error;
  },
};
