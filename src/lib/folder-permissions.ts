import { externalSupabase } from './externalSupabase';

export interface FolderPermission {
  folder_path: string;
  allowed_departments: string[];
  allowed_users: string[];
}

export interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  department: string[] | null;
  role: string | null;
  email: string | null;
}

/** @deprecated Use useDepartments hook instead */
export const DEPARTMENTS = [
  "Финансовый отдел",
  "Коммерческий отдел - отдел продаж",
  "Коммерческий отдел - отдел закупок",
  "Коммерческий отдел - отдел маркетинга",
  "Отдел HR",
];

export async function fetchCurrentUserProfile(): Promise<UserProfile | null> {
  const { data: { user } } = await externalSupabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await externalSupabase
    .from('profiles')
    .select('id, first_name, last_name, department, role, email')
    .eq('id', user.id)
    .single();

  if (error || !data) return null;
  return data as UserProfile;
}

export async function fetchAllProfiles(): Promise<UserProfile[]> {
  const { data, error } = await externalSupabase
    .from('profiles')
    .select('id, first_name, last_name, department, role, email')
    .order('last_name');

  if (error) throw error;
  return (data || []) as UserProfile[];
}

export async function fetchFolderPermissions(): Promise<FolderPermission[]> {
  const { data, error } = await externalSupabase
    .from('folder_permissions')
    .select('*');

  if (error) throw error;
  return (data || []) as FolderPermission[];
}

export async function getFolderPermission(folderPath: string): Promise<FolderPermission | null> {
  const { data, error } = await externalSupabase
    .from('folder_permissions')
    .select('*')
    .eq('folder_path', folderPath)
    .maybeSingle();

  if (error) throw error;
  return data as FolderPermission | null;
}

export async function upsertFolderPermission(permission: FolderPermission): Promise<void> {
  const { error } = await externalSupabase
    .from('folder_permissions')
    .upsert(permission, { onConflict: 'folder_path' });

  if (error) throw error;
}

export async function deleteFolderPermission(folderPath: string): Promise<void> {
  const { error } = await externalSupabase
    .from('folder_permissions')
    .delete()
    .eq('folder_path', folderPath);

  if (error) throw error;
}

export function canAccessFolder(
  folderPath: string,
  permissions: FolderPermission[],
  userProfile: UserProfile | null,
): boolean {
  if (!userProfile) return false;

  // Admins see everything
  if (userProfile.role === 'Администратор') return true;

  const perm = permissions.find((p) => p.folder_path === folderPath);

  // No permission entry = visible to everyone
  if (!perm) return true;

  // Check department intersection
  if (userProfile.department && perm.allowed_departments?.length) {
    if (userProfile.department.some(dept => perm.allowed_departments.includes(dept))) {
      return true;
    }
  }

  // Check user id
  if (perm.allowed_users?.includes(userProfile.id)) {
    return true;
  }

  return false;
}
