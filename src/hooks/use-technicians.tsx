import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TechnicianItem = { id: string; full_name: string; role?: "admin" | "technician" };

export function useTechnicians(options: { includeRole?: boolean } = {}) {
  const select = options.includeRole ? "id, full_name, role" : "id, full_name";
  return useQuery({
    queryKey: ["technicians"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select(select).order("full_name");
      if (error) throw error;
      return data as TechnicianItem[];
    },
  });
}
