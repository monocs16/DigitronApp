import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/lib/digitron";

export type TechnicianItem = { id: string; full_name: string; roles?: AppRole[] };

/**
 * Lists users that can be assigned to orders (the `tecnico` role). Roles live in
 * `user_roles`; we resolve the technician ids there, then fetch their profiles.
 */
export function useTechnicians(options: { includeRoles?: boolean } = {}) {
  return useQuery({
    queryKey: ["technicians", options.includeRoles ?? false],
    queryFn: async () => {
      const { data: roleRows, error: roleErr } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("role", "tecnico");
      if (roleErr) throw roleErr;

      const ids = (roleRows ?? []).map((r) => r.user_id);
      if (ids.length === 0) return [] as TechnicianItem[];

      const { data: profiles, error: profErr } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids)
        .order("full_name");
      if (profErr) throw profErr;

      return (profiles ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        ...(options.includeRoles ? { roles: ["tecnico"] as AppRole[] } : {}),
      })) as TechnicianItem[];
    },
  });
}
