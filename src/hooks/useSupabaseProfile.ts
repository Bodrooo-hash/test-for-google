import { useQuery } from "@tanstack/react-query";
import { externalSupabase } from "@/lib/externalSupabase";

export interface ProfileData {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  department: string[] | null;
  leader_departments: string[] | null;
  managed_departments: string[] | null;
  role: string | null;
  phone: string | null;
  birthday: string | null;
  avatar_url: string | null;
  // Legacy aliases for backward compatibility
  ID: string;
  NAME: string;
  LAST_NAME: string;
  PERSONAL_PHOTO?: string;
}

/** @deprecated Use ProfileData instead */
export type CurrentUser = ProfileData;

export function useSupabaseProfile() {
  return useQuery<ProfileData | null>({
    queryKey: ["supabase-profile"],
    queryFn: async () => {
      const { data: { user }, error: authError } = await externalSupabase.auth.getUser();
      if (authError || !user) return null;

      const { data, error } = await externalSupabase
        .from("profiles")
        .select("id, email, first_name, last_name, position, department, leader_departments, managed_departments, role, phone, birthday, avatar_url")
        .eq("id", user.id)
        .single();

      if (error || !data) return null;

      const profile = data as any;
      return {
        ...profile,
        // Legacy aliases
        ID: profile.id,
        NAME: profile.first_name || "",
        LAST_NAME: profile.last_name || "",
        PERSONAL_PHOTO: profile.avatar_url || undefined,
      } as ProfileData;
    },
    staleTime: 30 * 60 * 1000,
    retry: 1,
  });
}
