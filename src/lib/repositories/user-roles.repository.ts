import { supabase } from "@/integrations/supabase/client";

export const userRolesRepository = {
  getByUserId: async (uid: string) => {
    const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", uid);
    if (error) throw error;
    return data ?? [];
  },

  getTechnicianIds: async () => {
    const { data, error } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .eq("role", "tecnico");
    if (error) throw error;
    return data ?? [];
  },
};
