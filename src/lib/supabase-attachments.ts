import { externalSupabase } from './externalSupabase';

export interface TaskAttachmentRow {
  id: string;
  task_id: string;
  file_name: string;
  file_url: string;
  created_at?: string;
}

export async function fetchTaskAttachments(taskId: string): Promise<TaskAttachmentRow[]> {
  const { data, error } = await externalSupabase
    .from('task_attachments')
    .select('*')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function uploadTaskFile(
  taskId: string,
  file: File
): Promise<TaskAttachmentRow> {
  // Upload to storage bucket
  const filePath = `${taskId}/${Date.now()}_${file.name}`;
  const { error: uploadError } = await externalSupabase.storage
    .from('task-attachments')
    .upload(filePath, file, { upsert: false });
  if (uploadError) throw uploadError;

  // Get public URL
  const { data: urlData } = externalSupabase.storage
    .from('task-attachments')
    .getPublicUrl(filePath);

  const fileUrl = urlData.publicUrl;

  // Save record in task_attachments table
  const { data, error } = await externalSupabase
    .from('task_attachments')
    .insert({ task_id: taskId, file_name: file.name, file_url: fileUrl })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteTaskAttachment(attachmentId: string, fileUrl: string): Promise<void> {
  // Extract path from URL to delete from storage
  try {
    const bucketBase = '/storage/v1/object/public/task-attachments/';
    const idx = fileUrl.indexOf(bucketBase);
    if (idx !== -1) {
      const path = decodeURIComponent(fileUrl.substring(idx + bucketBase.length));
      await externalSupabase.storage.from('task-attachments').remove([path]);
    }
  } catch (e) {
    console.warn('Failed to delete file from storage:', e);
  }

  // Delete record from table
  const { error } = await externalSupabase
    .from('task_attachments')
    .delete()
    .eq('id', attachmentId);
  if (error) throw error;
}

export async function uploadTaskFilesBatch(
  taskId: string,
  files: File[]
): Promise<TaskAttachmentRow[]> {
  const results: TaskAttachmentRow[] = [];
  for (const file of files) {
    const row = await uploadTaskFile(taskId, file);
    results.push(row);
  }
  return results;
}
