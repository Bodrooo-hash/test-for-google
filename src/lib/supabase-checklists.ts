import { externalSupabase } from './externalSupabase';

export interface ChecklistItemRow {
  id: string;
  task_id: string;
  title: string;
  is_completed: boolean;
}

export async function fetchChecklistsByTaskId(taskId: string): Promise<ChecklistItemRow[]> {
  const { data, error } = await externalSupabase
    .from('checklists')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function addChecklistItem(taskId: string, title: string): Promise<ChecklistItemRow> {
  const { data, error } = await externalSupabase
    .from('checklists')
    .insert({ task_id: taskId, title, is_completed: false })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateChecklistItemCompleted(itemId: string, isCompleted: boolean): Promise<void> {
  const { error } = await externalSupabase
    .from('checklists')
    .update({ is_completed: isCompleted })
    .eq('id', itemId);
  if (error) throw error;
}

export async function updateChecklistItemTitle(itemId: string, title: string): Promise<void> {
  const { error } = await externalSupabase
    .from('checklists')
    .update({ title })
    .eq('id', itemId);
  if (error) throw error;
}

export async function deleteChecklistItem(itemId: string): Promise<void> {
  const { error } = await externalSupabase
    .from('checklists')
    .delete()
    .eq('id', itemId);
  if (error) throw error;
}

export async function addChecklistItemsBatch(taskId: string, items: { title: string; is_completed?: boolean }[]): Promise<ChecklistItemRow[]> {
  if (items.length === 0) return [];
  const rows = items.map((item) => ({
    task_id: taskId,
    title: item.title,
    is_completed: item.is_completed ?? false,
  }));
  const { data, error } = await externalSupabase
    .from('checklists')
    .insert(rows)
    .select();
  if (error) throw error;
  return data || [];
}
