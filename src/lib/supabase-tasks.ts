import { externalSupabase } from './externalSupabase';
import type { Bitrix24Task, Bitrix24User, CreateTaskParams } from './bitrix24';

function normalizeUuid(value?: string | null) {
  const normalized = typeof value === 'string' ? value.trim() : value;
  if (!normalized) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
    ? normalized
    : null;
}

function normalizeUuidArray(values?: string[] | null) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => normalizeUuid(value))
    .filter((value): value is string => Boolean(value));
}

// ─── Users ───

export async function fetchGroupMembers(groupId: string | number): Promise<Bitrix24User[]> {
  const { data, error } = await externalSupabase
    .from('users')
    .select('*');
  if (error) throw error;
  return (data || []).map(mapUserRow);
}

export async function fetchUsers(): Promise<Bitrix24User[]> {
  const { data, error } = await externalSupabase.from('users').select('*');
  console.log('Fetched users:', data, error);
  if (error) throw error;
  return (data || []).map(mapUserRow);
}

export async function fetchUsersByIds(ids: string[]): Promise<Bitrix24User[]> {
  if (ids.length === 0) return [];
  const { data, error } = await externalSupabase
    .from('users')
    .select('*')
    .in('id', ids);
  if (error) throw error;
  return (data || []).map(mapUserRow);
}

function mapUserRow(row: any): Bitrix24User {
  return {
    ID: String(row.id ?? ''), // Use UUID id, not bitrix_id
    NAME: row.name || row.first_name || '',
    LAST_NAME: row.last_name || row.surname || '',
    EMAIL: row.email || undefined,
    PERSONAL_PHOTO: row.personal_photo || row.photo || undefined,
    WORK_POSITION: row.work_position || undefined,
  };
}

// ─── Tasks ───

export async function fetchGroupTasks(groupId: string | number): Promise<Bitrix24Task[]> {
  const { data, error } = await externalSupabase
    .from('tasks')
    .select('*')
    .eq('project_id', String(groupId));
  if (error) throw error;

  // Fetch users for resolution
  const userIds = new Set<string>();
  (data || []).forEach((t: any) => {
    if (t.assignee_id) userIds.add(t.assignee_id);
    if (t.creator_id) userIds.add(t.creator_id);
    (t.assistants || []).forEach((id: string) => userIds.add(id));
    (t.observers || []).forEach((id: string) => userIds.add(id));
  });

  let usersMap = new Map<string, Bitrix24User>();
  if (userIds.size > 0) {
    const { data: users } = await externalSupabase
      .from('profiles')
      .select('id, first_name, last_name, avatar_url, position')
      .in('id', Array.from(userIds));
    (users || []).forEach((u: any) => {
      usersMap.set(u.id, {
        ID: u.id,
        NAME: u.first_name || '',
        LAST_NAME: u.last_name || '',
        PERSONAL_PHOTO: u.avatar_url || undefined,
        WORK_POSITION: u.position || undefined,
      });
    });
  }

  return (data || []).map((row: any) => mapTaskRow(row, usersMap));
}

function mapTaskRow(row: any, usersMap: Map<string, Bitrix24User>): Bitrix24Task {
  const resolveUser = (id?: string) => {
    if (!id) return undefined;
    const u = usersMap.get(id);
    return u ? { id: u.ID, name: `${u.LAST_NAME} ${u.NAME}`.trim(), icon: u.PERSONAL_PHOTO } : { id, name: `#${id}` };
  };

  // Use created_date (original) falling back to created_at


  return {
    id: row.id,
    title: row.title || '',
    status: row.status || 'new',
    priority: row.priority || 'medium',
    responsible: resolveUser(row.assignee_id),
    creator: resolveUser(row.creator_id),
    deadline: row.due_date || undefined,
    createdDate: row.created_date || row.created_at || undefined,
    groupId: row.project_id ? String(row.project_id) : undefined,
    accomplices: (row.assistants || []).map((id: string) => resolveUser(id)).filter(Boolean),
    auditors: (row.observers || []).map((id: string) => resolveUser(id)).filter(Boolean),
    description: row.description || undefined,
  };
}

export async function createTask(params: CreateTaskParams): Promise<{ task: { id: string } }> {
  const row: any = {
    title: params.title,
    status: 'new',
    priority: params.priority || 'medium',
    project_id: normalizeUuid(String(params.groupId ?? '')),
    assignee_id: normalizeUuid(params.responsibleId),
    creator_id: normalizeUuid(params.creatorId),
    assistants: normalizeUuidArray(params.accomplices),
    observers: normalizeUuidArray(params.auditors),
  };
  if (params.description) row.description = params.description;
  if (params.deadline) row.due_date = params.deadline.split('T')[0]; // date only

  console.log('Sending task data:', row);

  const { data, error } = await externalSupabase
    .from('tasks')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return { task: { id: data.id } };
}

export async function updateTask(taskId: string, fields: Record<string, unknown>): Promise<void> {
  const mapped: any = {};
  if (fields.TITLE !== undefined) mapped.title = fields.TITLE;
  if (fields.DESCRIPTION !== undefined) mapped.description = fields.DESCRIPTION;
  if (fields.STATUS !== undefined) mapped.status = fields.STATUS;
  if (fields.PRIORITY !== undefined) mapped.priority = fields.PRIORITY;
  if (fields.RESPONSIBLE_ID !== undefined) mapped.assignee_id = normalizeUuid(fields.RESPONSIBLE_ID as string | null | undefined);
  if (fields.CREATOR_ID !== undefined) mapped.creator_id = normalizeUuid(fields.CREATOR_ID as string | null | undefined);
  if (fields.PROJECT_ID !== undefined) mapped.project_id = normalizeUuid(fields.PROJECT_ID as string | null | undefined);
  if (fields.DEADLINE !== undefined) mapped.due_date = typeof fields.DEADLINE === 'string' ? fields.DEADLINE.split('T')[0] : fields.DEADLINE;
  if (fields.ACCOMPLICES !== undefined) mapped.assistants = normalizeUuidArray(fields.ACCOMPLICES as string[] | null | undefined);
  if (fields.AUDITORS !== undefined) mapped.observers = normalizeUuidArray(fields.AUDITORS as string[] | null | undefined);
  if (fields.ISSUE_DESCRIPTION !== undefined) mapped.issue_description = fields.ISSUE_DESCRIPTION;
  if (fields.RESULT_DESCRIPTION !== undefined) mapped.result_description = fields.RESULT_DESCRIPTION;
  if (fields.FEEDBACK_NOTES !== undefined) mapped.feedback_notes = fields.FEEDBACK_NOTES;

  console.log('Updating task:', taskId, mapped);

  const { error } = await externalSupabase
    .from('tasks')
    .update(mapped)
    .eq('id', taskId);
  if (error) throw error;
}

// Simplified kanban stages
export async function fetchKanbanStages(_groupId: number | string): Promise<Record<string, any>> {
  return {
    "new": { ID: "new", TITLE: "Новая", SORT: "100", COLOR: "#14b8a6", ENTITY_ID: "0", ENTITY_TYPE: "G" },
    "pending": { ID: "pending", TITLE: "Новая", SORT: "100", COLOR: "#14b8a6", ENTITY_ID: "0", ENTITY_TYPE: "G" },
    "in_progress": { ID: "in_progress", TITLE: "В работе", SORT: "200", COLOR: "#3b82f6", ENTITY_ID: "0", ENTITY_TYPE: "G" },
    "inwork": { ID: "inwork", TITLE: "В работе", SORT: "200", COLOR: "#3b82f6", ENTITY_ID: "0", ENTITY_TYPE: "G" },
    "help": { ID: "help", TITLE: "Нужна помощь", SORT: "300", COLOR: "#ef4444", ENTITY_ID: "0", ENTITY_TYPE: "G" },
    "approval": { ID: "approval", TITLE: "На согласовании", SORT: "400", COLOR: "#f59e0b", ENTITY_ID: "0", ENTITY_TYPE: "G" },
    "completed": { ID: "completed", TITLE: "Завершена", SORT: "500", COLOR: "#22c55e", ENTITY_ID: "0", ENTITY_TYPE: "G" },
    "done": { ID: "done", TITLE: "Завершена", SORT: "500", COLOR: "#22c55e", ENTITY_ID: "0", ENTITY_TYPE: "G" },
  };
}

export async function moveTaskToKanbanStage(taskId: string, stageId: string): Promise<void> {
  await updateTask(taskId, { STATUS: stageId });
}

export async function checkTaskAccess(_taskId: string): Promise<Record<string, boolean>> {
  return { edit: true, delete: true };
}
