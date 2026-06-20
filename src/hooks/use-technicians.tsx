import { useQuery } from "@tanstack/react-query";
import { profilesRepository, userRolesRepository } from "@/lib/repositories";
import type { AppRole } from "@/lib/digitron";

export type TechnicianItem = { id: string; full_name: string; roles?: AppRole[] };

export function useTechnicians(options: { includeRoles?: boolean } = {}) {
  return useQuery({
    queryKey: ["technicians", options.includeRoles ?? false],
    queryFn: async () => {
      const roleRows = await userRolesRepository.getTechnicianIds();
      const ids = roleRows.map((r) => r.user_id);
      if (ids.length === 0) return [] as TechnicianItem[];

      const profiles = await profilesRepository.getByIds(ids);

      const rolesByUser = new Map<string, AppRole[]>();
      if (options.includeRoles) {
        for (const r of roleRows) {
          const existing = rolesByUser.get(r.user_id) ?? [];
          rolesByUser.set(r.user_id, [...existing, r.role as AppRole]);
        }
      }

      return (profiles ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name,
        ...(options.includeRoles ? { roles: rolesByUser.get(p.id) ?? [] } : {}),
      })) as TechnicianItem[];
    },
  });
}
