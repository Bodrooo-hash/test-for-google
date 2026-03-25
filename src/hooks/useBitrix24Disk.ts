import { useQuery } from "@tanstack/react-query";
import { fetchStorages, fetchStorageChildren, fetchFolderChildren, fetchRecentDiskActivity, type DiskStorage, type DiskItem } from "@/lib/bitrix24-disk";

export function useBitrix24Storages() {
  return useQuery<DiskStorage[]>({ queryKey: ["bitrix24-storages"], queryFn: fetchStorages, staleTime: 5 * 60 * 1000 });
}

export function useBitrix24DiskChildren(storageId: string | null, folderId: string | null) {
  return useQuery<DiskItem[]>({
    queryKey: ["bitrix24-disk-children", storageId, folderId],
    queryFn: () => { if (folderId) return fetchFolderChildren(folderId); if (storageId) return fetchStorageChildren(storageId); return Promise.resolve([]); },
    enabled: !!(storageId || folderId), staleTime: 30 * 1000,
  });
}

export function useBitrix24RecentActivity(storageId: string | null) {
  return useQuery<DiskItem[]>({ queryKey: ["bitrix24-disk-recent", storageId], queryFn: () => fetchRecentDiskActivity(storageId!), enabled: !!storageId, staleTime: 60 * 1000 });
}
