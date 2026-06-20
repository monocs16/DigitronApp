import { useQuery } from "@tanstack/react-query";
import { customersRepository } from "@/lib/repositories";

export type ClientMinItem = { id: string; name: string };

export function useClientsMin() {
  return useQuery({
    queryKey: ["clients-min"],
    queryFn: () => customersRepository.getAllMin() as Promise<ClientMinItem[]>,
  });
}
