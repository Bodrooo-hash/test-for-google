const BITRIX24_WEBHOOK_URL = "https://elllement.bitrix24.ru/rest/1/jfiz1scltqgjwt3b";

interface Bitrix24Response<T> {
  result: T;
  error?: string;
  error_description?: string;
}

async function callBitrix24<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  const url = `${BITRIX24_WEBHOOK_URL}/${method}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Bitrix24 API error: ${response.status}`);
  }

  const data: Bitrix24Response<T> = await response.json();
  if (data.error) {
    throw new Error(`Bitrix24: ${data.error_description || data.error}`);
  }

  return data.result;
}

export interface DiskStorage {
  ID: string;
  NAME: string;
  ENTITY_TYPE: string;
  ENTITY_ID: string;
  MODULE_ID: string;
}

export interface DiskItem {
  ID: string;
  NAME: string;
  TYPE: "file" | "folder";
  SIZE?: number;
  CREATE_TIME: string;
  UPDATE_TIME: string;
  CREATED_BY?: string;
  UPDATED_BY?: string;
  PARENT_ID?: string;
  STORAGE_ID?: string;
  DETAIL_URL?: string;
  DOWNLOAD_URL?: string;
  CODE?: string;
}

export async function fetchStorages(): Promise<DiskStorage[]> {
  return callBitrix24<DiskStorage[]>("disk.storage.getlist", {});
}

export async function fetchStorageChildren(
  storageId: string,
  filter?: Record<string, unknown>
): Promise<DiskItem[]> {
  const params: Record<string, unknown> = { id: storageId };
  if (filter) params.filter = filter;
  return callBitrix24<DiskItem[]>("disk.storage.getchildren", params);
}

export async function fetchFolderChildren(
  folderId: string,
  filter?: Record<string, unknown>
): Promise<DiskItem[]> {
  const params: Record<string, unknown> = { id: folderId };
  if (filter) params.filter = filter;
  return callBitrix24<DiskItem[]>("disk.folder.getchildren", params);
}

export async function fetchFolder(folderId: string): Promise<DiskItem> {
  return callBitrix24<DiskItem>("disk.folder.get", { id: folderId });
}

export async function renameFolder(folderId: string, newName: string): Promise<DiskItem> {
  return callBitrix24<DiskItem>("disk.folder.rename", { id: folderId, newName });
}

export async function renameFile(fileId: string, newName: string): Promise<DiskItem> {
  return callBitrix24<DiskItem>("disk.file.rename", { id: fileId, newName });
}

export async function deleteFolder(folderId: string): Promise<boolean> {
  return callBitrix24<boolean>("disk.folder.markdeleted", { id: folderId });
}

export async function deleteFile(fileId: string): Promise<boolean> {
  return callBitrix24<boolean>("disk.file.markdeleted", { id: fileId });
}

export async function getFileDownloadUrl(fileId: string): Promise<string> {
  const result = await callBitrix24<{ DOWNLOAD_URL: string }>("disk.file.get", { id: fileId });
  return result.DOWNLOAD_URL;
}

export async function moveFolder(folderId: string, targetFolderId: string): Promise<DiskItem> {
  return callBitrix24<DiskItem>("disk.folder.moveto", { id: folderId, targetFolderId });
}

export async function moveFile(fileId: string, targetFolderId: string): Promise<DiskItem> {
  return callBitrix24<DiskItem>("disk.file.moveto", { id: fileId, targetFolderId });
}

export type SortField = "NAME" | "SIZE" | "UPDATE_TIME" | "CREATE_TIME";
export type SortOrder = "asc" | "desc";

export function sortDiskItems(
  items: DiskItem[],
  field: SortField,
  order: SortOrder
): DiskItem[] {
  const sorted = [...items].sort((a, b) => {
    if (a.TYPE === "folder" && b.TYPE !== "folder") return -1;
    if (a.TYPE !== "folder" && b.TYPE === "folder") return 1;

    let cmp = 0;
    switch (field) {
      case "NAME":
        cmp = (a.NAME || "").localeCompare(b.NAME || "", "ru");
        break;
      case "SIZE":
        cmp = (a.SIZE || 0) - (b.SIZE || 0);
        break;
      case "UPDATE_TIME":
        cmp = new Date(a.UPDATE_TIME).getTime() - new Date(b.UPDATE_TIME).getTime();
        break;
      case "CREATE_TIME":
        cmp = new Date(a.CREATE_TIME).getTime() - new Date(b.CREATE_TIME).getTime();
        break;
    }
    return order === "asc" ? cmp : -cmp;
  });
  return sorted;
}

export async function createFolder(parentFolderId: string, name: string): Promise<DiskItem> {
  return callBitrix24<DiskItem>("disk.folder.addsubfolder", {
    id: parentFolderId,
    data: { NAME: name },
  });
}

export async function createStorageFolder(storageId: string, name: string): Promise<DiskItem> {
  return callBitrix24<DiskItem>("disk.storage.addfolder", {
    id: storageId,
    data: { NAME: name },
  });
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] || result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function uploadFileToFolder(folderId: string, file: File): Promise<DiskItem> {
  const base64 = await fileToBase64(file);
  const url = `${BITRIX24_WEBHOOK_URL}/disk.folder.uploadfile`;
  const formData = new FormData();
  formData.append("id", folderId);
  formData.append("data[NAME]", file.name);
  formData.append("fileContent[0]", file.name);
  formData.append("fileContent[1]", base64);

  const response = await fetch(url, { method: "POST", body: formData });
  if (!response.ok) throw new Error(`Bitrix24 API error: ${response.status}`);
  const data: Bitrix24Response<DiskItem> = await response.json();
  if (data.error) throw new Error(`Bitrix24: ${data.error_description || data.error}`);
  return data.result;
}

export async function uploadFileToStorage(storageId: string, file: File): Promise<DiskItem> {
  const base64 = await fileToBase64(file);
  const url = `${BITRIX24_WEBHOOK_URL}/disk.storage.uploadfile`;
  const formData = new FormData();
  formData.append("id", storageId);
  formData.append("data[NAME]", file.name);
  formData.append("fileContent[0]", file.name);
  formData.append("fileContent[1]", base64);

  const response = await fetch(url, { method: "POST", body: formData });
  if (!response.ok) throw new Error(`Bitrix24 API error: ${response.status}`);
  const data: Bitrix24Response<DiskItem> = await response.json();
  if (data.error) throw new Error(`Bitrix24: ${data.error_description || data.error}`);
  return data.result;
}

export async function fetchRecentDiskActivity(storageId: string): Promise<DiskItem[]> {
  const topLevel = await callBitrix24<DiskItem[]>("disk.storage.getchildren", { id: storageId });

  const folders = topLevel.filter((i) => i.TYPE === "folder");
  const subItemsArrays = await Promise.all(
    folders.slice(0, 5).map((f) =>
      callBitrix24<DiskItem[]>("disk.folder.getchildren", { id: f.ID }).catch(() => [] as DiskItem[])
    )
  );

  const allItems = [...topLevel, ...subItemsArrays.flat()];

  return allItems
    .sort((a, b) => new Date(b.UPDATE_TIME).getTime() - new Date(a.UPDATE_TIME).getTime())
    .slice(0, 10);
}

export function formatFileSize(bytes?: number): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} ГБ`;
}
