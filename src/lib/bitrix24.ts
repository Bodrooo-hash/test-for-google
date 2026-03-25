const BITRIX24_WEBHOOK_URL = "https://elllement.bitrix24.ru/rest/1/jfiz1scltqgjwt3b";

interface Bitrix24CalendarEvent {
  ID: string;
  NAME: string;
  DATE_FROM: string;
  DATE_TO: string;
  DATE_FROM_FORMATTED?: string;
  DESCRIPTION?: string;
  COLOR?: string;
  CAL_TYPE?: string;
  SECTION_ID?: string;
  CREATED_BY?: string;
  UF_WEBDAV_CAL_EVENT?: unknown[];
  ATTENDEE_LIST?: Array<{
    id: number;
    entryId: string;
    status: string;
  }>;
}

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

export async function fetchCalendarEvents(from: Date, to: Date): Promise<Bitrix24CalendarEvent[]> {
  const formatDate = (d: Date) =>
    `${d.getDate().toString().padStart(2, "0")}.${(d.getMonth() + 1).toString().padStart(2, "0")}.${d.getFullYear()}`;

  return callBitrix24<Bitrix24CalendarEvent[]>("calendar.event.get", {
    type: "group",
    ownerId: 42,
    from: formatDate(from),
    to: formatDate(to),
  });
}

export async function fetchUserProfile() {
  return callBitrix24<Record<string, unknown>>("profile");
}

export interface Bitrix24User {
  ID: string;
  NAME: string;
  LAST_NAME: string;
  EMAIL?: string;
  PERSONAL_PHOTO?: string;
  WORK_POSITION?: string;
}

export async function fetchUsers(): Promise<Bitrix24User[]> {
  const members = await callBitrix24<Array<{ USER_ID: string }>>("sonet_group.user.get", {
    ID: 42,
  });
  if (!members || members.length === 0) return [];

  const userIds = members.map((m) => m.USER_ID);
  return callBitrix24<Bitrix24User[]>("user.get", { ID: userIds, ACTIVE: true });
}

export async function fetchUsersByIds(ids: string[]): Promise<Bitrix24User[]> {
  if (ids.length === 0) return [];
  return callBitrix24<Bitrix24User[]>("user.get", { ID: ids });
}

export interface CreateEventParams {
  name: string;
  description?: string;
  dateFrom: string;
  dateTo: string;
  color?: string;
  rrule?: string;
  attendees?: string[];
  sectionId?: number;
}

export async function createCalendarEvent(params: CreateEventParams) {
  return callBitrix24<number>("calendar.event.add", {
    type: "group",
    ownerId: 42,
    name: params.name,
    description: params.description || "",
    from: params.dateFrom,
    to: params.dateTo,
    color: params.color,
    rrule: params.rrule ? { FREQ: params.rrule } : undefined,
    attendees: params.attendees,
    section: params.sectionId,
    is_meeting: params.attendees && params.attendees.length > 0 ? "Y" : "N",
  });
}

export interface Bitrix24Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  stageId?: string;
  responsible?: { id: string; name: string; icon?: string };
  deadline?: string;
  createdDate?: string;
  groupId?: string;
  createdBy?: string;
  creator?: { id: string; name: string; icon?: string };
  accomplices?: Array<{ id: string; name: string; icon?: string }>;
  auditors?: Array<{ id: string; name: string; icon?: string }>;
  activityDate?: string;
  description?: string;
}

export async function fetchGroupTasks(groupId: number): Promise<Bitrix24Task[]> {
  const data = await callBitrix24<{ tasks: Bitrix24Task[] }>("tasks.task.list", {
    filter: { GROUP_ID: groupId },
    select: ["ID", "TITLE", "STATUS", "PRIORITY", "RESPONSIBLE_ID", "DEADLINE", "CREATED_DATE", "GROUP_ID", "CREATED_BY", "ACCOMPLICES", "AUDITORS", "ACTIVITY_DATE", "DESCRIPTION", "STAGE_ID"],
  });
  return data.tasks || [];
}

export interface CreateTaskParams {
  title: string;
  description?: string;
  groupId: number | string;
  responsibleId?: string;
  creatorId?: string;
  deadline?: string;
  priority?: string;
  accomplices?: string[];
  auditors?: string[];
}

export async function createTask(params: CreateTaskParams): Promise<{ task: { id: string } }> {
  const fields: Record<string, unknown> = {
    TITLE: params.title,
    GROUP_ID: params.groupId,
  };
  if (params.description) fields.DESCRIPTION = params.description;
  if (params.responsibleId) fields.RESPONSIBLE_ID = params.responsibleId;
  if (params.deadline) fields.DEADLINE = params.deadline;
  if (params.priority) fields.PRIORITY = params.priority;
  if (params.accomplices?.length) fields.ACCOMPLICES = params.accomplices;
  if (params.auditors?.length) fields.AUDITORS = params.auditors;
  return callBitrix24<{ task: { id: string } }>("tasks.task.add", { fields });
}

export async function updateTask(taskId: string, fields: Record<string, unknown>): Promise<void> {
  await callBitrix24<unknown>("tasks.task.update", { taskId, fields });
}

export interface KanbanStage {
  ID: string;
  TITLE: string;
  SORT: string;
  COLOR: string;
  SYSTEM_TYPE?: string;
  ENTITY_ID: string;
  ENTITY_TYPE: string;
  ADDITIONAL_FILTER?: unknown[];
}

export async function fetchKanbanStages(groupId: number): Promise<Record<string, KanbanStage>> {
  return callBitrix24<Record<string, KanbanStage>>("task.stages.get", {
    entityId: groupId,
    isAdmin: false,
  });
}

export async function moveTaskToKanbanStage(taskId: string, stageId: string): Promise<void> {
  await callBitrix24<unknown>("task.stages.movetask", {
    id: taskId,
    stageId,
  });
}

export async function checkTaskAccess(taskId: string): Promise<Record<string, boolean>> {
  try {
    const result = await callBitrix24<Record<string, boolean>>("tasks.task.getaccess", { taskId });
    return result || {};
  } catch {
    return {};
  }
}

export async function fetchGroupMembers(groupId: number): Promise<Bitrix24User[]> {
  const members = await callBitrix24<Array<{ USER_ID: string }>>("sonet_group.user.get", {
    ID: groupId,
  });
  if (!members || members.length === 0) return [];
  const userIds = members.map((m) => m.USER_ID);
  return callBitrix24<Bitrix24User[]>("user.get", { ID: userIds, ACTIVE: true });
}

export interface Bitrix24ChatMessage {
  id: number;
  chat_id: number;
  author_id: number;
  date: string;
  text: string;
  params?: Record<string, unknown>;
}

export interface Bitrix24ChatInfo {
  id: number;
  title: string;
  type: string;
  message_count: number;
}

export async function fetchGroupChat(groupId: number): Promise<Bitrix24ChatInfo | null> {
  try {
    const recent = await callBitrix24<{ items: Array<{
      id: string;
      chat_id?: number;
      type: string;
      title: string;
      chat?: {
        id: number;
        title: string;
        type: string;
        entity_type: string;
        entity_id: number;
      };
    }> }>("im.recent.list", {});

    if (recent?.items) {
      const groupChat = recent.items.find(
        (item) => item.chat?.entity_type === "SONET_GROUP" && String(item.chat?.entity_id) === String(groupId)
      );
      if (groupChat?.chat) {
        return {
          id: groupChat.chat.id,
          title: groupChat.chat.title,
          type: groupChat.chat.type,
          message_count: 0
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function fetchChatMessages(chatId: string, lastId?: number, limit = 50): Promise<{ messages: Bitrix24ChatMessage[] }> {
  const params: Record<string, unknown> = {
    DIALOG_ID: chatId,
    LIMIT: limit,
  };
  if (lastId) {
    params.LAST_ID = lastId;
  }

  const data = await callBitrix24<{ messages: Array<{
    id: number;
    chat_id: number;
    author_id: number;
    date: string;
    text: string;
    params?: Record<string, unknown>;
  }> }>("im.dialog.messages.get", params);

  return {
    messages: (data.messages || []).map((m) => ({
      id: m.id,
      chat_id: m.chat_id,
      author_id: m.author_id,
      date: m.date,
      text: m.text,
      params: m.params,
    })),
  };
}

export async function sendChatMessage(chatId: string, message: string): Promise<number> {
  return callBitrix24<number>("im.message.add", {
    DIALOG_ID: chatId,
    MESSAGE: message,
  });
}

const EVENT_COLORS = ["#007AFF", "#34C759", "#FF9500", "#AF52DE", "#FF3B30", "#5AC8FA", "#FF2D55"];

function parseBitrixDate(dateStr: string): Date {
  const match = dateStr.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
  if (match) {
    const [, day, month, year, hours, minutes, seconds] = match;
    return new Date(+year, +month - 1, +day, +hours, +minutes, +seconds);
  }
  return new Date(dateStr);
}

export function mapBitrix24Events(raw: Bitrix24CalendarEvent[], usersMap?: Map<string, Bitrix24User>) {
  return raw.map((e, i) => {
    const dateFrom = e.DATE_FROM_FORMATTED
      ? new Date(e.DATE_FROM_FORMATTED)
      : parseBitrixDate(e.DATE_FROM);
    const dateTo = parseBitrixDate(e.DATE_TO);

    const attendees = e.ATTENDEE_LIST?.map((att) => {
      const user = usersMap?.get(String(att.id));
      return {
        id: String(att.id),
        name: user ? `${user.NAME} ${user.LAST_NAME}` : `#${att.id}`,
        photo: user?.PERSONAL_PHOTO,
      };
    });

    const creatorUser = e.CREATED_BY ? usersMap?.get(e.CREATED_BY) : undefined;
    const formatShortName = (u: Bitrix24User) => `${u.LAST_NAME} ${u.NAME?.charAt(0)}.`;
    const organizer = e.CREATED_BY
      ? {
          id: e.CREATED_BY,
          name: creatorUser ? formatShortName(creatorUser) : `#${e.CREATED_BY}`,
          photo: creatorUser?.PERSONAL_PHOTO,
        }
      : undefined;

    const hasFiles = Array.isArray(e.UF_WEBDAV_CAL_EVENT) && e.UF_WEBDAV_CAL_EVENT.length > 0;

    return {
      id: e.ID,
      title: e.NAME || "Без названия",
      date: dateFrom,
      time: dateFrom.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      timeTo: dateTo.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }),
      color: e.COLOR || EVENT_COLORS[i % EVENT_COLORS.length],
      description: e.DESCRIPTION || undefined,
      hasFiles,
      attendees,
      organizer,
    };
  });
}
