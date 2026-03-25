import { externalSupabase } from "./externalSupabase";

export interface CalendarEventAttendee {
  id: string;
  name: string;
  status: "pending" | "accepted" | "declined";
}

export interface CalendarEventRow {
  id: string;
  title: string;
  description: string;
  event_date: string; // yyyy-MM-dd
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  color: string;
  recurrence: string; // none, DAILY, WEEKLY, MONTHLY, YEARLY
  calendar_type: string; // project, personal
  meeting_type: string; // bitrix24_video, zoom, in_person
  attendees: CalendarEventAttendee[];
  files: string[];
  has_files: boolean;
  organizer_id: string;
  department: string;
  created_at?: string;
  updated_at?: string;
}

export type CalendarEventInsert = Omit<CalendarEventRow, "id" | "created_at" | "updated_at">;

export async function fetchCalendarEvents(department: string): Promise<CalendarEventRow[]> {
  const { data, error } = await externalSupabase
    .from("calendar_events")
    .select("*")
    .eq("department", department)
    .order("event_date", { ascending: true });

  if (error) throw error;
  return (data || []) as CalendarEventRow[];
}

export async function createCalendarEventInSupabase(event: CalendarEventInsert): Promise<CalendarEventRow> {
  const { data, error } = await externalSupabase
    .from("calendar_events")
    .insert(event)
    .select()
    .single();

  if (error) throw error;
  return data as CalendarEventRow;
}

export async function updateCalendarEventInSupabase(id: string, event: Partial<CalendarEventInsert>): Promise<CalendarEventRow> {
  const { data, error } = await externalSupabase
    .from("calendar_events")
    .update(event)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as CalendarEventRow;
}

export async function deleteCalendarEvent(id: string): Promise<void> {
  const { error } = await externalSupabase
    .from("calendar_events")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

export async function uploadCalendarFile(file: File): Promise<string> {
  const timestamp = Date.now();
  const safeName = `${timestamp}_${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const path = `calendar/${safeName}`;

  const { error } = await externalSupabase.storage
    .from("calendar_files")
    .upload(path, file);

  if (error) throw error;

  const { data: urlData } = externalSupabase.storage
    .from("calendar_files")
    .getPublicUrl(path);

  return urlData.publicUrl;
}
