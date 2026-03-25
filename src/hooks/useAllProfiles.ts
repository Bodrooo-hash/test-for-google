import { useQuery } from "@tanstack/react-query";
import { externalSupabase } from "@/lib/externalSupabase";

export interface TaskProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  department: string[] | null;
  avatar_url: string | null;
  position: string | null;
}

export function useAllProfiles() {
  return useQuery<TaskProfile[]>({
    queryKey: ["all-profiles"],
    queryFn: async () => {
      const { data, error } = await externalSupabase
        .from("profiles")
        .select("id, first_name, last_name, department, avatar_url, position")
        .order("last_name");
      if (error) throw error;
      return (data || []) as TaskProfile[];
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
}
