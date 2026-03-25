import { useQuery } from "@tanstack/react-query";
import { externalSupabase } from "@/lib/externalSupabase";

interface DepartmentManager {
  id: string;
  first_name: string | null;
  last_name: string | null;
  managed_departments: string[] | null;
}

export interface ExclusiveRoleInfo {
  /** Department is completely disabled — cannot be selected at all */
  disabled: boolean;
  /** Department manager role is exclusive (single occupant) */
  exclusiveManager: boolean;
  /** Current manager's full name, if occupied */
  managerName: string | null;
  /** Current manager's id */
  managerId: string | null;
}

const DISABLED_DEPARTMENTS = ["Совет директоров"];
const EXCLUSIVE_MANAGER_DEPARTMENTS = ["Генеральный директор", "Коммерческий отдел"];

export function useDepartmentManagers(currentUserId?: string) {
  const query = useQuery<DepartmentManager[]>({
    queryKey: ["department-managers"],
    queryFn: async () => {
      const { data, error } = await externalSupabase
        .from("profiles")
        .select("id, first_name, last_name, managed_departments")
        .not("managed_departments", "is", null);
      if (error) throw error;
      return (data || []) as DepartmentManager[];
    },
    staleTime: 60 * 1000,
  });

  const managers = query.data || [];

  function getRoleInfo(department: string): ExclusiveRoleInfo {
    if (DISABLED_DEPARTMENTS.includes(department)) {
      return { disabled: true, exclusiveManager: false, managerName: null, managerId: null };
    }

    if (EXCLUSIVE_MANAGER_DEPARTMENTS.includes(department)) {
      const manager = managers.find(
        m => m.managed_departments?.includes(department) && m.id !== currentUserId
      );
      const managerName = manager
        ? `${manager.first_name || ""} ${manager.last_name || ""}`.trim()
        : null;
      return {
        disabled: false,
        exclusiveManager: true,
        managerName,
        managerId: manager?.id || null,
      };
    }

    return { disabled: false, exclusiveManager: false, managerName: null, managerId: null };
  }

  return { ...query, getRoleInfo, managers };
}
