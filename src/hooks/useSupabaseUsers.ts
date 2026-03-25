import { useQuery } from "@tanstack/react-query";
import { fetchUsers } from "@/lib/supabase-tasks";
import type { Bitrix24User } from "@/lib/bitrix24";

export function useSupabaseUsers() {
  return useQuery<Bitrix24User[]>({
    queryKey: ["supabase-users"],
    queryFn: fetchUsers,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}
