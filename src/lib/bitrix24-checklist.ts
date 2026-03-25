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
  if (!response.ok) throw new Error(`Bitrix24 API error: ${response.status}`);
  const data: Bitrix24Response<T> = await response.json();
  if (data.error) throw new Error(`Bitrix24: ${data.error_description || data.error}`);
  return data.result;
}

export interface ChecklistItem {
  ID: string;
  TASK_ID: string;
  TITLE: string;
  IS_COMPLETE: "Y" | "N";
  SORT_INDEX: string;
  PARENT_ID?: string;
  TOGGLED_BY?: string;
  TOGGLED_DATE?: string;
  MEMBERS?: { USER_ID: string; TYPE: string }[];
  ATTACHMENTS?: { FILE_ID: string; NAME?: string }[];
}

export async function fetchChecklistItems(taskId: string): Promise<ChecklistItem[]> {
  const result = await callBitrix24<Record<string, ChecklistItem>>("task.checklistitem.getlist", {
    TASKID: taskId,
  });
  // Result is object with IDs as keys
  return Object.values(result || {});
}

export async function addChecklistItem(taskId: string, title: string, parentId?: string): Promise<string> {
  const fields: Record<string, unknown> = { TITLE: title };
  if (parentId) fields.PARENT_ID = parentId;
  const id = await callBitrix24<number>("task.checklistitem.add", {
    TASKID: taskId,
    FIELDS: fields,
  });
  return String(id);
}

export async function completeChecklistItem(taskId: string, itemId: string): Promise<void> {
  await callBitrix24<boolean>("task.checklistitem.complete", {
    TASKID: taskId,
    ITEMID: itemId,
  });
}

export async function renewChecklistItem(taskId: string, itemId: string): Promise<void> {
  await callBitrix24<boolean>("task.checklistitem.renew", {
    TASKID: taskId,
    ITEMID: itemId,
  });
}

export async function deleteChecklistItem(taskId: string, itemId: string): Promise<void> {
  await callBitrix24<boolean>("task.checklistitem.delete", {
    TASKID: taskId,
    ITEMID: itemId,
  });
}

export async function updateChecklistItemTitle(taskId: string, itemId: string, title: string): Promise<void> {
  await callBitrix24<boolean>("task.checklistitem.update", {
    TASKID: taskId,
    ITEMID: itemId,
    FIELDS: { TITLE: title },
  });
}

export async function updateChecklistItemMembers(taskId: string, itemId: string, memberIds: string[]): Promise<void> {
  const members = memberIds.map((id) => ({ USER_ID: id, TYPE: "A" }));
  await callBitrix24<boolean>("task.checklistitem.update", {
    TASKID: taskId,
    ITEMID: itemId,
    FIELDS: { MEMBERS: members },
  });
}

export async function updateChecklistItemAttachments(taskId: string, itemId: string, attachments: { FILE_ID: string }[]): Promise<void> {
  await callBitrix24<boolean>("task.checklistitem.update", {
    TASKID: taskId,
    ITEMID: itemId,
    FIELDS: { ATTACHMENTS: attachments },
  });
}

export async function getChecklistItem(taskId: string, itemId: string): Promise<ChecklistItem> {
  return callBitrix24<ChecklistItem>("task.checklistitem.get", {
    TASKID: taskId,
    ITEMID: itemId,
  });
}

export async function attachFileToTask(taskId: string, fileId: string): Promise<void> {
  await callBitrix24<unknown>("tasks.task.files.attach", {
    taskId,
    fileId,
  });
}

export async function detachFileFromTask(taskId: string, fileId: string): Promise<void> {
  // Remove file from task by deleting the disk file (marks as deleted)
  await callBitrix24<boolean>("disk.file.markdeleted", { id: fileId });
}

export interface TaskFile {
  ID: string;
  NAME: string;
  SIZE: number;
  DOWNLOAD_URL?: string;
  VIEW_URL?: string;
  FILE_ID?: string;
}

export async function fetchTaskFiles(taskId: string): Promise<TaskFile[]> {
  try {
    const result = await callBitrix24<{ task: Record<string, unknown> }>("tasks.task.get", {
      taskId,
      select: ["UF_TASK_WEBDAV_FILES"],
    });
    const attachmentIds = result?.task?.ufTaskWebdavFiles as number[] | undefined;
    if (!attachmentIds || attachmentIds.length === 0) return [];
    
    // ufTaskWebdavFiles contains ATTACHMENT IDs, not disk file IDs
    // Use disk.attachedObject.get to resolve them
    const files = await Promise.all(
      attachmentIds.map(async (attachId) => {
        try {
          const attached = await callBitrix24<{
            ID: string;
            OBJECT_ID: string;
            MODULE_ID: string;
            ENTITY_TYPE: string;
            ENTITY_ID: string;
            CREATE_TIME: string;
            CREATED_BY: string;
            NAME: string;
            SIZE: number;
            DOWNLOAD_URL: string;
          }>("disk.attachedObject.get", { id: attachId });
          return {
            ID: attached.OBJECT_ID, // actual disk file ID for download/delete
            NAME: attached.NAME,
            SIZE: attached.SIZE,
            DOWNLOAD_URL: attached.DOWNLOAD_URL,
            attachmentId: String(attachId),
          } as TaskFile & { attachmentId: string };
        } catch {
          return null;
        }
      })
    );
    return files.filter(Boolean) as TaskFile[];
  } catch {
    return [];
  }
}

export async function getFileDownloadUrl(fileId: string): Promise<string> {
  const result = await callBitrix24<{ DOWNLOAD_URL: string }>("disk.file.get", { id: fileId });
  return result.DOWNLOAD_URL;
}
