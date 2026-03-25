import { useState, useEffect, useRef, useCallback } from "react";
import OnlineAvatar from "@/components/OnlineAvatar";
import { ArrowLeft, Clock, User, Send, Check, CalendarIcon, X, Paperclip, ListChecks, FileText, FileImage, FileSpreadsheet, FileArchive, FileVideo, FileAudio, File, Plus, Trash2, Settings, Pencil, Copy, MoreVertical, Eye, ChevronDown, GripVertical, Sparkles, Pause, ShieldCheck, CircleCheck, Moon, CircleDot, Play, Maximize2, Download, Upload, Loader2, AlertTriangle, type LucideIcon } from "lucide-react";
import TaskUserAccordionPicker from "@/components/TaskUserAccordionPicker";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { useSupabaseProfile } from "@/hooks/useSupabaseProfile";
import { useSupabaseUsers } from "@/hooks/useSupabaseUsers";
import { useAllProfiles } from "@/hooks/useAllProfiles";
import type { Bitrix24Task, Bitrix24User } from "@/lib/bitrix24";
import { updateTask, fetchKanbanStages, moveTaskToKanbanStage } from "@/lib/supabase-tasks";
import { toast } from "sonner";
import RichTextEditor from "@/components/RichTextEditor";
import {
  fetchChecklistsByTaskId,
  addChecklistItem as addSupabaseChecklistItem,
  updateChecklistItemCompleted,
  updateChecklistItemTitle as updateSupabaseChecklistItemTitle,
  deleteChecklistItem as deleteSupabaseChecklistItem,
  type ChecklistItemRow,
} from "@/lib/supabase-checklists";
import {
  fetchTaskAttachments,
  uploadTaskFile,
  deleteTaskAttachment,
  type TaskAttachmentRow,
} from "@/lib/supabase-attachments";

interface Props {
  task: Bitrix24Task;
  members: Bitrix24User[];
  projectName?: string;
  sectionName?: string;
  onBack: () => void;
}

const statusConfig: Record<string, {label: string;color: string;bg: string;icon: LucideIcon;}> = {
  "1": { label: "Новая", color: "text-teal-600", bg: "bg-teal-500/10", icon: Sparkles },
  "2": { label: "Ожидает", color: "text-yellow-600", bg: "bg-yellow-500/10", icon: Pause },
  "3": { label: "В работе", color: "text-blue-600", bg: "bg-blue-500/10", icon: Play },
  "4": { label: "На согласовании", color: "text-amber-600", bg: "bg-amber-500/10", icon: ShieldCheck },
  "5": { label: "Завершена", color: "text-green-600", bg: "bg-green-500/10", icon: CircleCheck },
  "6": { label: "Отложена", color: "text-muted-foreground", bg: "bg-muted", icon: Moon },
  "new": { label: "Новая", color: "text-teal-600", bg: "bg-teal-500/10", icon: Sparkles },
  "pending": { label: "Новая", color: "text-teal-600", bg: "bg-teal-500/10", icon: Sparkles },
  "inwork": { label: "В работе", color: "text-blue-600", bg: "bg-blue-500/10", icon: Play },
  "in_progress": { label: "В работе", color: "text-blue-600", bg: "bg-blue-500/10", icon: Play },
  "help": { label: "Нужна помощь", color: "text-red-600", bg: "bg-red-500/10", icon: AlertTriangle },
  "approval": { label: "На согласовании", color: "text-amber-600", bg: "bg-amber-500/10", icon: ShieldCheck },
  "done": { label: "Завершена", color: "text-green-600", bg: "bg-green-500/10", icon: CircleCheck },
  "completed": { label: "Завершена", color: "text-green-600", bg: "bg-green-500/10", icon: CircleCheck },
};

const priorityConfig: Record<string, {label: string;color: string;}> = {
  "0": { label: "Низкий", color: "text-muted-foreground" },
  "1": { label: "Средний", color: "text-blue-500" },
  "2": { label: "Высокий", color: "text-red-500" }
};

function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((p) => p.charAt(0)).join("").slice(0, 2).toUpperCase();
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
}

function formatDateTime(dateStr?: string) {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return `${d.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })} ${d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}`;
}

function isOverdue(task: Bitrix24Task) {
  return task.status !== "5" && task.deadline && new Date(task.deadline) < new Date();
}

function toRoman(n: number): string {
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];
  let r = "";for (let i = 0; i < vals.length; i++) while (n >= vals[i]) {r += syms[i];n -= vals[i];}return r;
}

interface MockMessage {
  id: number;
  author: string;
  authorIcon?: string;
  text: string;
  date: string;
  isMine: boolean;
}

/* ─── Checklist settings menu ─── */
const ChecklistSettingsMenu = ({ onEdit, onCopy, onDelete, onNewChecklist }: {onEdit: () => void;onCopy: () => void;onDelete: () => void;onNewChecklist: () => void;}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);};
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative ml-auto" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="shrink-0 w-5 h-5 flex items-center justify-center rounded-md hover:bg-foreground/[0.06] transition-colors"><Settings className="w-3.5 h-3.5 text-foreground/30" /></button>
      {open &&
      <div className="absolute right-0 top-full mt-1 z-50 w-36 rounded-lg border border-border bg-card shadow-lg p-1 animate-in fade-in-0 zoom-in-95 duration-150">
          <button onClick={() => {onEdit();setOpen(false);}} className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md hover:bg-foreground/[0.04] transition-colors text-left"><Pencil className="w-3.5 h-3.5 text-foreground/40" /><span className="text-xs text-foreground/70">Редактировать</span></button>
          <button onClick={() => {onCopy();setOpen(false);}} className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md hover:bg-foreground/[0.04] transition-colors text-left"><Copy className="w-3.5 h-3.5 text-foreground/40" /><span className="text-xs text-foreground/70">Скопировать</span></button>
          <button onClick={() => {onDelete();setOpen(false);}} className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md hover:bg-destructive/10 transition-colors text-left"><Trash2 className="w-3.5 h-3.5 text-destructive/60" /><span className="text-xs text-destructive/80">Удалить</span></button>
          <div className="h-px bg-border my-1" />
          <button onClick={() => {onNewChecklist();setOpen(false);}} className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md hover:bg-foreground/[0.04] transition-colors text-left"><Plus className="w-3.5 h-3.5 text-foreground/40" /><span className="text-xs text-foreground/70">Новый чек-лист</span></button>
        </div>
      }
    </div>);

};
const roadmapSteps = [
{ key: "new", label: "Новая", color: "text-white", bg: "bg-blue1", icon: Sparkles },
{ key: "inwork", label: "В работе", color: "text-white", bg: "bg-blue1", icon: Play },
{ key: "help", label: "Нужна помощь", color: "text-white", bg: "bg-red-500", icon: AlertTriangle },
{ key: "approval", label: "На согласовании", color: "text-white", bg: "bg-yellow-500", icon: ShieldCheck },
{ key: "done", label: "Завершена", color: "text-white", bg: "bg-green-500", icon: CircleCheck }];

const roadmapOrder = roadmapSteps.map((s) => s.key);

const StatusRoadmap = ({ status, onStatusChange, locked, disabledKeys = [] }: {status: string;onStatusChange?: (key: string) => void;locked?: boolean;disabledKeys?: string[];}) => {
  const [collapsed, setCollapsed] = useState(false);
  const measureRef = useRef<HTMLDivElement>(null);
  const currentIdx = roadmapOrder.indexOf(status);
  const activeStep = roadmapSteps.find((s) => s.key === status) || roadmapSteps[0];

  useEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    const check = () => {
      const parent = el.parentElement;
      if (!parent) return;
      setCollapsed(el.scrollWidth > parent.clientWidth);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="rounded-xl border border-border bg-foreground/[0.04] dark:bg-muted/50 px-3 py-3">
      <div className="flex items-center gap-2 px-2.5">
        <CircleDot className="w-4 h-4 text-muted-foreground shrink-0" />
        <span className="text-xs text-foreground/50 font-medium shrink-0">Статус:</span>
        <div className="overflow-hidden flex-1 min-w-0">
          <div ref={measureRef} className={`flex items-center gap-1 whitespace-nowrap w-full ${collapsed ? 'invisible absolute' : ''}`}>
            {roadmapSteps.map((step, i, arr) => {
              const isActive = status === step.key;
              const stepIdx = roadmapOrder.indexOf(step.key);
              const isPassed = currentIdx > stepIdx && currentIdx !== -1;
              const isDisabled = locked || disabledKeys.includes(step.key);
              return (
                <div key={step.key} className="flex items-center flex-1 min-w-0">
                  <button
                    disabled={isDisabled}
                    onClick={() => !isDisabled && onStatusChange?.(step.key)}
                    className={`flex items-center justify-center gap-0.5 px-1 py-1.5 rounded-lg transition-all w-full ${
                    isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:opacity-90'} ${
                    isActive ? `${step.bg} ${step.color} opacity-100 font-extrabold` : isPassed ? 'bg-foreground/[0.04] text-foreground/30' : 'bg-transparent text-foreground/20 ring-1 ring-inset ring-foreground/10 hover:bg-foreground/[0.03]'}`
                    }>
                    
                    <step.icon className="w-3.5 h-3.5 shrink-0" />
                    <span className="text-[11px] font-bold truncate">{step.label}</span>
                  </button>
                  {i < arr.length - 1 &&
                  <div className="w-3 h-px shrink-0 bg-foreground/10" />
                  }
                </div>);

            })}
          </div>
          {collapsed &&
          <Popover>
              <PopoverTrigger asChild>
                <button disabled={locked} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold ${activeStep.bg} ${activeStep.color} ring-1 ring-inset ring-current/20 w-full ${locked ? 'cursor-not-allowed opacity-50' : ''}`}>
                  <activeStep.icon className="w-3 h-3 shrink-0" />
                  <span className="truncate">{activeStep.label}</span>
                  <ChevronDown className="w-3 h-3 ml-auto shrink-0 opacity-50" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-48 p-1" align="start">
                {roadmapSteps.map((step) => {
                const isActive = status === step.key;
                const isStepDisabled = locked || disabledKeys.includes(step.key);
                return (
                  <button
                    key={step.key}
                    disabled={isStepDisabled}
                    onClick={() => !isStepDisabled && onStatusChange?.(step.key)}
                    className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-xs transition-colors ${isStepDisabled ? 'opacity-50 cursor-not-allowed' : ''} ${isActive ? `${step.bg} ${step.color} font-semibold` : 'hover:bg-foreground/5 text-foreground/60'}`}>
                    
                      <step.icon className="w-3.5 h-3.5 shrink-0" />
                      {step.label}
                    </button>);

              })}
              </PopoverContent>
            </Popover>
          }
        </div>
      </div>
    </div>);

};


const TaskDetailView = ({ task, members, projectName, sectionName, onBack }: Props) => {
  const st = statusConfig[task.status] || statusConfig["6"];
  const pr = priorityConfig[task.priority] || priorityConfig["1"];
  const overdue = isOverdue(task);
  const { data: currentUser } = useSupabaseProfile();
  const { data: supabaseUsers = [], isLoading: usersLoading } = useSupabaseUsers();
  const { isLoading: profilesLoading } = useAllProfiles();
  const memberOptions = supabaseUsers.length > 0 ? supabaseUsers : members;

  // Permission: only creator and assignee can edit
  const isCreator = currentUser && (
    String(currentUser.ID) === task.createdBy ||
    String(currentUser.ID) === task.creator?.id
  );
  const isAssignee = currentUser && String(currentUser.ID) === task.responsible?.id;
  const canEdit = isCreator || isAssignee;

  // Workflow modals state
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [issueDescription, setIssueDescription] = useState("");
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [resultDescription, setResultDescription] = useState("");
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [feedbackNotes, setFeedbackNotes] = useState("");


  // Editable state
  const [editingCreator, setEditingCreator] = useState(false);
  const [editingResponsible, setEditingResponsible] = useState(false);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [localTitle, setLocalTitle] = useState(task.title);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [localDescription, setLocalDescription] = useState(task.description || "");
  const [editingDescription, setEditingDescription] = useState<boolean>(false);

  // Local editable values
  const [localCreatorId, setLocalCreatorId] = useState(task.creator?.id);
  const [localResponsibleId, setLocalResponsibleId] = useState(task.responsible?.id);
  const [localAuditorIds, setLocalAuditorIds] = useState<string[]>(
    () => task.auditors?.map((a) => a.id) || []
  );
  const [auditorsOpen, setAuditorsOpen] = useState(false);
  const auditorsRef = useRef<HTMLDivElement>(null);

  const [localAccompliceIds, setLocalAccompliceIds] = useState<string[]>(
    () => task.accomplices?.map((a) => a.id) || []
  );
  const [accomplicesOpen, setAccomplicesOpen] = useState(false);
  const accomplicesRef = useRef<HTMLDivElement>(null);

  const [rolesCollapsed, setRolesCollapsed] = useState(true);

  // Files
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<{file: globalThis.File;comment: string;}[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);

  // Supabase task attachments (already uploaded)
  const [taskFiles, setTaskFiles] = useState<TaskAttachmentRow[]>([]);
  const [loadingTaskFiles, setLoadingTaskFiles] = useState(false);
  const [downloadingFileId, setDownloadingFileId] = useState<string | null>(null);

  // Result files
  const resultFileInputRef = useRef<HTMLInputElement>(null);
  const [resultFiles, setResultFiles] = useState<{file: globalThis.File;comment: string;}[]>([]);

  // Help/problem files
  const helpFileInputRef = useRef<HTMLInputElement>(null);
  const [helpFiles, setHelpFiles] = useState<{file: globalThis.File;comment: string;}[]>([]);
  const [helpComment, setHelpComment] = useState("");
  const [helpSubmitted, setHelpSubmitted] = useState<{text: string; date: Date; files: {file: globalThis.File; comment: string}[]; userName: string; userAvatar?: string} | null>(null);

  // Checklists from external Supabase
  const [checklists, setChecklists] = useState<{id: string;title: string;items: {id: string;dbId?: string;title: string;checked?: boolean;assigneeId?: string;files?: {name: string;size: number;fileId?: string;downloadUrl?: string;uploading?: boolean;}[];}[];}[]>([]);
  const [loadingChecklists, setLoadingChecklists] = useState(false);
  const checkItemFileRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const checklistTitleRefs = useRef<Record<string, HTMLSpanElement | null>>({});
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [assigneePopoverItemId, setAssigneePopoverItemId] = useState<string | null>(null);
  const [editingItemTitle, setEditingItemTitle] = useState("");
  const [editingChecklistTitleId, setEditingChecklistTitleId] = useState<string | null>(null);
  const [activeChecklistId, setActiveChecklistId] = useState<string | null>(null);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const [dragChecklistId, setDragChecklistId] = useState<string | null>(null);

  // Load checklists from external Supabase
  useEffect(() => {
    const loadChecklists = async () => {
      setLoadingChecklists(true);
      try {
        const items = await fetchChecklistsByTaskId(task.id);
        if (items.length > 0) {
          const clId = crypto.randomUUID();
          setChecklists([{
            id: clId,
            title: "Чек-лист",
            items: items.map((item) => ({
              id: crypto.randomUUID(),
              dbId: item.id,
              title: item.title,
              checked: item.is_completed,
            })),
          }]);
          setActiveChecklistId(clId);
        }
      } catch (e) {
        console.error("Failed to load checklists:", e);
      } finally {
        setLoadingChecklists(false);
      }
    };
    loadChecklists();
  }, [task.id]);

  // Load task files from Bitrix24
  // Load task files from external Supabase
  useEffect(() => {
    const loadFiles = async () => {
      setLoadingTaskFiles(true);
      try {
        const files = await fetchTaskAttachments(task.id);
        setTaskFiles(files);
      } catch (e) {
        console.error("Failed to load task files:", e);
      } finally {
        setLoadingTaskFiles(false);
      }
    };
    loadFiles();
  }, [task.id]);

  // Toggle checklist item
  const handleToggleCheckItem = useCallback(async (clId: string, itemId: string) => {
    const cl = checklists.find((c) => c.id === clId);
    const item = cl?.items.find((i) => i.id === itemId);
    if (!item) return;
    
    const newChecked = !item.checked;
    setChecklists((prev) => prev.map((c) => c.id === clId ? { ...c, items: c.items.map((ci) => ci.id === itemId ? { ...ci, checked: newChecked } : ci) } : c));
    
    if (item.dbId) {
      try {
        await updateChecklistItemCompleted(item.dbId, newChecked);
      } catch (e: any) {
        toast.error("Ошибка обновления чек-листа");
        setChecklists((prev) => prev.map((c) => c.id === clId ? { ...c, items: c.items.map((ci) => ci.id === itemId ? { ...ci, checked: !newChecked } : ci) } : c));
      }
    }
  }, [checklists]);

  // Add checklist item
  const handleAddCheckItem = useCallback(async (clId: string, title: string) => {
    const localId = crypto.randomUUID();
    setChecklists((prev) => prev.map((c) => c.id === clId ? { ...c, items: [...c.items, { id: localId, title }] } : c));
    
    try {
      const created = await addSupabaseChecklistItem(task.id, title);
      setChecklists((prev) => prev.map((c) => c.id === clId ? { ...c, items: c.items.map((ci) => ci.id === localId ? { ...ci, dbId: created.id } : ci) } : c));
    } catch (e: any) {
      toast.error("Ошибка добавления пункта: " + (e?.message || ""));
    }
  }, [task.id]);

  // Delete checklist item
  const handleDeleteCheckItem = useCallback(async (clId: string, itemId: string) => {
    const cl = checklists.find((c) => c.id === clId);
    const item = cl?.items.find((i) => i.id === itemId);
    
    setChecklists((prev) => prev.map((c) => c.id === clId ? { ...c, items: c.items.filter((ci) => ci.id !== itemId) } : c));
    
    if (item?.dbId) {
      try {
        await deleteSupabaseChecklistItem(item.dbId);
      } catch (e: any) {
        toast.error("Ошибка удаления пункта");
      }
    }
  }, [checklists]);

  // Update checklist item title
  const handleUpdateCheckItemTitle = useCallback(async (clId: string, itemId: string, newTitle: string) => {
    const cl = checklists.find((c) => c.id === clId);
    const item = cl?.items.find((i) => i.id === itemId);
    
    setChecklists((prev) => prev.map((c) => c.id === clId ? { ...c, items: c.items.map((ci) => ci.id === itemId ? { ...ci, title: newTitle } : ci) } : c));
    
    if (item?.dbId) {
      try {
        await updateSupabaseChecklistItemTitle(item.dbId, newTitle);
      } catch (e: any) {
        toast.error("Ошибка обновления пункта");
      }
    }
  }, [checklists]);

  // Set assignee for checklist item
  const handleSetCheckItemAssignee = useCallback((clId: string, itemId: string, userId: string | undefined) => {
    setChecklists((prev) => prev.map((c) => c.id === clId ? { ...c, items: c.items.map((ci) => ci.id === itemId ? { ...ci, assigneeId: userId } : ci) } : c));
  }, []);

  // Upload files to external Supabase storage
  const handleUploadFiles = useCallback(async (files: globalThis.File[]) => {
    setUploadingFiles(true);
    try {
      for (const file of files) {
        try {
          const row = await uploadTaskFile(task.id, file);
          setTaskFiles((prev) => [...prev, row]);
          toast.success(`Файл "${file.name}" загружен`);
        } catch (e: any) {
          toast.error(`Ошибка загрузки "${file.name}": ${e?.message || ""}`);
        }
      }
      setAttachedFiles([]);
    } catch (e: any) {
      toast.error("Ошибка загрузки файлов: " + (e?.message || ""));
    } finally {
      setUploadingFiles(false);
    }
  }, [task.id]);

  // Open file URL
  const handleDownloadFile = useCallback((_fileId: string, fileUrl: string) => {
    window.open(fileUrl, "_blank");
  }, []);

  // Build assignee candidates from task roles (creator, responsible, accomplices)
  const assigneeCandidates = (() => {
    const ids = new Set<string>();
    if (localCreatorId) ids.add(localCreatorId);
    if (localResponsibleId) ids.add(localResponsibleId);
    localAccompliceIds.forEach((id) => ids.add(id));
    return memberOptions.filter((m) => ids.has(m.ID));
  })();

  useEffect(() => {
    if (!auditorsOpen) return;
    const handler = (e: MouseEvent) => {
      if (auditorsRef.current && !auditorsRef.current.contains(e.target as Node)) setAuditorsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [auditorsOpen]);

  useEffect(() => {
    if (!accomplicesOpen) return;
    const handler = (e: MouseEvent) => {
      if (accomplicesRef.current && !accomplicesRef.current.contains(e.target as Node)) setAccomplicesOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [accomplicesOpen]);

  const handleToggleAuditor = async (userId: string) => {
    const next = localAuditorIds.includes(userId) ?
    localAuditorIds.filter((id) => id !== userId) :
    [...localAuditorIds, userId];
    setLocalAuditorIds(next);
    setAuditorsOpen(false);
    await handleUpdateField("AUDITORS", next);
  };

  const handleToggleAccomplice = async (userId: string) => {
    const next = localAccompliceIds.includes(userId) ?
    localAccompliceIds.filter((id) => id !== userId) :
    [...localAccompliceIds, userId];
    setLocalAccompliceIds(next);
    setAccomplicesOpen(false);
    await handleUpdateField("ACCOMPLICES", next);
  };
  const [localDeadline, setLocalDeadline] = useState<Date | undefined>(task.deadline ? new Date(task.deadline) : undefined);
  const [deadlineHour, setDeadlineHour] = useState(() => {
    if (!task.deadline) return "12";
    return String(new Date(task.deadline).getHours()).padStart(2, "0");
  });
  const [deadlineMinute, setDeadlineMinute] = useState(() => {
    if (!task.deadline) return "00";
    return String(new Date(task.deadline).getMinutes()).padStart(2, "0");
  });

  // Fetch kanban stages for the group
  const [kanbanStages, setKanbanStages] = useState<Record<string, {ID: string;TITLE: string;}>>({});
  useEffect(() => {
    if (task.groupId) {
      fetchKanbanStages(Number(task.groupId)).then(setKanbanStages).catch(() => {});
    }
  }, [task.groupId]);

  // Determine initial status from kanban stage
  const [localStatus, setLocalStatus] = useState(task.status);
  useEffect(() => {
    if (task.stageId && Object.keys(kanbanStages).length > 0) {
      const stage = kanbanStages[task.stageId];
      if (stage) {
        const title = stage.TITLE.toLowerCase();
        if (title.includes("помощь")) {
          setLocalStatus("help");
        } else if (title.includes("согласовани")) {
          setLocalStatus("approval");
        } else if (title.includes("новые") || title.includes("новая")) {
          setLocalStatus("new");
        } else if (title.includes("в работе")) {
          setLocalStatus("inwork");
        } else if (title.includes("заверш")) {
          setLocalStatus("done");
        }
      }
    }
  }, [task.stageId, kanbanStages]);

  const handleUpdateField = async (field: string, value: unknown) => {
    setSaving(true);
    try {
      await updateTask(task.id, { [field]: value });
      if (field === "STATUS") {
        setLocalStatus(String(value));
      }
      toast.success("Задача обновлена");
    } catch (e: any) {
      toast.error("Нет прав или ошибка: " + (e?.message || "неизвестная ошибка"));
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (key: string) => {
    setSaving(true);
    try {
      await moveTaskToKanbanStage(task.id, key);
      setLocalStatus(key);
      const stageLabel = roadmapSteps.find(s => s.key === key)?.label || key;
      toast.success(`Задача перемещена на стадию «${stageLabel}»`);
    } catch (e: any) {
      toast.error("Ошибка: " + (e?.message || "неизвестная ошибка"));
    } finally {
      setSaving(false);
    }
  };

  const handleSelectCreator = async (userId: string) => {
    setLocalCreatorId(userId);
    setEditingCreator(false);
    await handleUpdateField("CREATED_BY", userId);
  };

  const handleSelectResponsible = async (userId: string) => {
    setLocalResponsibleId(userId);
    setEditingResponsible(false);
    await handleUpdateField("RESPONSIBLE_ID", userId);
  };

  const handleSaveTitle = async () => {
    setEditingTitle(false);
    const trimmed = localTitle.trim();
    if (!trimmed || trimmed === task.title) {
      setLocalTitle(task.title);
      return;
    }
    await handleUpdateField("TITLE", trimmed);
  };

  const handleBecomeAuditor = async () => {
    if (!currentUser) return;
    const uid = String(currentUser.ID);
    if (localAuditorIds.includes(uid)) {
      toast.info("Вы уже наблюдатель");
      return;
    }
    const next = [...localAuditorIds, uid];
    setLocalAuditorIds(next);
    await handleUpdateField("AUDITORS", next);
  };

  const handleSaveDeadline = async () => {
    setEditingDeadline(false);
    if (!localDeadline) {
      await handleUpdateField("DEADLINE", "");
      return;
    }
    const d = new Date(localDeadline);
    d.setHours(parseInt(deadlineHour), parseInt(deadlineMinute), 0, 0);
    setLocalDeadline(d);
    const iso = d.toISOString().replace("T", " ").slice(0, 19);
    await handleUpdateField("DEADLINE", iso);
  };

  // Find member by ID
  const getMember = (id?: string) => memberOptions.find((m) => m.ID === id);

  const localCreator = getMember(localCreatorId);
  const localResponsible = getMember(localResponsibleId);

  const [messages, setMessages] = useState<MockMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatTab, setChatTab] = useState<"Чат задачи" | "Медиа и файлы" | "Ссылки" | "Избранное">("Чат задачи"); // task chat tabs
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    setMessages((prev) => [
    ...prev,
    { id: Date.now(), author: "Вы", text: newMessage.trim(), date: new Date().toISOString(), isMine: true }]
    );
    setNewMessage("");
  };

  const InfoRow = ({ label, children }: {label: string;children: React.ReactNode;}) =>
  <div className="flex items-center gap-3 py-2">
      <div className="flex items-center gap-1.5 w-[161px] shrink-0">
        <span className="text-xs text-foreground/50 font-medium">{label}</span>
      </div>
      <div className="flex-1 min-w-0 min-h-[24px] flex items-center text-sm">{children}</div>
    </div>;


  const PersonBadge = ({ name, icon, onClick }: {name: string;icon?: string;onClick?: () => void;}) =>
  <div
    className={cn("flex items-center gap-2", onClick && "cursor-pointer hover:text-blue1 transition-colors")}
    onClick={onClick}>
    
      <Avatar className="w-6 h-6">
        <AvatarImage src={icon} />
        <AvatarFallback className="text-[8px] bg-muted">{getInitials(name)}</AvatarFallback>
      </Avatar>
      <span className="text-xs text-foreground/70 truncate hover:text-blue1 transition-colors">{name}</span>
      {/* clickable */}
    </div>;


  const MemberSelector = ({ selectedId, onSelect, open, onOpenChange }: {selectedId?: string;onSelect: (id: string) => void;open: boolean;onOpenChange: (v: boolean) => void;}) =>
  <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <span />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <TaskUserAccordionPicker
          selectedIds={selectedId ? [selectedId] : []}
          onConfirm={(ids) => { if (ids[0]) onSelect(ids[0]); onOpenChange(false); }}
          onClose={() => onOpenChange(false)}
          buttonLabel="Назначить"
        />
      </PopoverContent>
    </Popover>;


  const creatorName = localCreator ? `${localCreator.LAST_NAME} ${localCreator.NAME}` : task.creator?.name;
  const creatorIcon = localCreator?.PERSONAL_PHOTO || task.creator?.icon;
  const responsibleName = localResponsible ? `${localResponsible.LAST_NAME} ${localResponsible.NAME}` : task.responsible?.name;
  const responsibleIcon = localResponsible?.PERSONAL_PHOTO || task.responsible?.icon;

  const deadlineDateStr = localDeadline ? localDeadline.toISOString() : undefined;

  return (
    <div className="flex h-full min-h-0 w-full border border-muted-foreground/30 rounded-2xl bg-card overflow-hidden">
      <div className="w-[63%] min-w-0 flex flex-col border-r border-border">
        <div className="px-5 py-3 border-b border-border bg-muted flex items-center gap-3">
          <button onClick={onBack} className="w-7 h-7 rounded-full bg-foreground/[0.05] hover:bg-foreground/[0.1] flex items-center justify-center transition-colors shrink-0">
            <ArrowLeft className="w-4 h-4 text-foreground/60" />
          </button>
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-1.5">
              <h2
                ref={titleRef}
                contentEditable={editingTitle}
                suppressContentEditableWarning
                onInput={(e) => setLocalTitle((e.target as HTMLElement).textContent || "")}
                onKeyDown={(e) => {if (e.key === "Enter") {e.preventDefault();handleSaveTitle();}if (e.key === "Escape") {if (titleRef.current) titleRef.current.textContent = task.title;setLocalTitle(task.title);setEditingTitle(false);}}}
                className={cn(
                  "text-base font-semibold truncate text-foreground outline-none",
                  editingTitle && "border-b border-primary truncate-none"
                )}>
                
                {task.title}
              </h2>
              {editingTitle &&
              <button
                onClick={handleSaveTitle}
                className="w-5 h-5 rounded-full bg-blue1 flex items-center justify-center shrink-0 hover:bg-blue1/80 transition-colors">
                
                  <Check className="w-3 h-3 text-white" />
                </button>
              }
            </div>
          </div>
          {/* Workflow buttons based on status */}
          {canEdit && (localStatus === "new" || localStatus === "pending" || localStatus === "1" || localStatus === "2") &&
          <button disabled={saving} onClick={async () => { await handleStatusChange("inwork"); }}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-blue1 text-white text-xs font-semibold hover:bg-green-500 transition-colors duration-200 disabled:opacity-50 flex items-center gap-1.5">
            <Play className="w-3.5 h-3.5" />Начать задачу
          </button>}



          {isCreator && localStatus === "approval" && <>
          <button disabled={saving} onClick={async () => { await handleStatusChange("done"); toast.success("Задача завершена!"); }}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-700 text-xs font-semibold hover:bg-green-500/20 transition-colors disabled:opacity-50">
            Завершить
          </button>
          <button disabled={saving} onClick={() => setShowFeedbackModal(true)}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-blue1/10 text-blue1 text-xs font-semibold hover:bg-blue1/20 transition-colors disabled:opacity-50">
            На доработку
          </button>
          </>}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-7 h-7 rounded-full hover:bg-foreground/[0.08] flex items-center justify-center transition-colors shrink-0">
                <MoreVertical className="w-4 h-4 text-foreground/50" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuItem onClick={() => {setEditingTitle(true);setTimeout(() => {if (titleRef.current) {titleRef.current.focus();const range = document.createRange();range.selectNodeContents(titleRef.current);const sel = window.getSelection();sel?.removeAllRanges();sel?.addRange(range);}}, 50);}}>
                <Pencil className="w-4 h-4 mr-2" />
                Редактировать
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleBecomeAuditor}>
                <Eye className="w-4 h-4 mr-2" />
                Наблюдать
              </DropdownMenuItem>
              {localStatus === "inwork" && canEdit &&
              <DropdownMenuItem onClick={async () => {
                await handleStatusChange("new");
              }}>
                <Moon className="w-4 h-4 mr-2" />
                Приостановить задачу
              </DropdownMenuItem>
              }
              <DropdownMenuItem className="text-red-500 focus:text-red-500" onClick={() => {}}>
                <Trash2 className="w-4 h-4 mr-2" />
                Удалить
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-4 bg-card dark:bg-card">
            <StatusRoadmap status={localStatus} onStatusChange={(key) => {
              if (key === "help") { handleStatusChange("help"); return; }
              if (key === "approval") { setShowApprovalModal(true); return; }
              handleStatusChange(key);
            }} locked={!canEdit} disabledKeys={[...(isCreator ? [] : ["done"]), ...(localStatus === "done" ? ["new","inwork","help","approval"] : [])]} />
            {localStatus === "approval" && <div className="rounded-xl border border-border bg-foreground/[0.04] dark:bg-muted/50 px-3 py-2">
              <div className="flex items-center gap-2 mb-1.5">
                <FileText className="w-3.5 h-3.5 text-yellow-600" />
                <span className="text-xs font-medium text-yellow-600">Финальный результат задачи:</span>
              </div>
              <textarea
                placeholder="Вы - большой молодец! Добавьте финальное описание выполненных работ и результатов..."
                className="w-full min-h-[60px] text-xs text-foreground/70 placeholder:text-foreground/25 bg-transparent border-none outline-none resize-none px-1 py-1 leading-relaxed" />
              <div className="mt-1.5 border-t border-foreground/[0.06] pt-1.5">
                <button onClick={() => resultFileInputRef.current?.click()} className="group/rf flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors">
                  <Paperclip className="w-3.5 h-3.5 text-muted-foreground group-hover/rf:text-blue1 transition-colors" />
                  <span className="text-[11px] text-muted-foreground group-hover/rf:text-blue1 transition-colors">Прикрепить файлы</span>
                </button>
                <input ref={resultFileInputRef} type="file" multiple className="hidden" onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  if (files.length > 0) setResultFiles((prev) => [...prev, ...files.map((f) => ({ file: f, comment: "" }))]);
                  e.target.value = "";
                }} />
                {resultFiles.length > 0 &&
                <div className="mt-1.5 space-y-1.5">
                    {resultFiles.map((item, i) => {
                    const ext = item.file.name.split(".").pop()?.toLowerCase() || "";
                    const IconComp = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext) ? FileImage : ["pdf", "doc", "docx", "txt", "rtf", "odt"].includes(ext) ? FileText : ["xls", "xlsx", "csv"].includes(ext) ? FileSpreadsheet : ["zip", "rar", "7z", "tar", "gz"].includes(ext) ? FileArchive : ["mp4", "avi", "mov", "mkv", "webm"].includes(ext) ? FileVideo : ["mp3", "wav", "ogg", "flac", "aac"].includes(ext) ? FileAudio : File;
                    const colorClass = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext) ? "text-green-500" : ["pdf"].includes(ext) ? "text-red-500" : ["doc", "docx", "txt", "rtf", "odt"].includes(ext) ? "text-blue-500" : ["xls", "xlsx", "csv"].includes(ext) ? "text-emerald-600" : ["zip", "rar", "7z", "tar", "gz"].includes(ext) ? "text-amber-500" : ["mp4", "avi", "mov", "mkv", "webm"].includes(ext) ? "text-purple-500" : ["mp3", "wav", "ogg", "flac", "aac"].includes(ext) ? "text-pink-500" : "text-foreground/40";
                    return (
                      <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-foreground/[0.03]">
                          <IconComp className={`w-4 h-4 shrink-0 ${colorClass}`} />
                          <span className="text-xs text-foreground/60 truncate shrink-0 max-w-[120px]">{item.file.name}</span>
                          <span className="text-foreground/10 shrink-0">·</span>
                          <input type="text" value={item.comment} onChange={(e) => setResultFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, comment: e.target.value } : f))} placeholder="Комментарий..." className="flex-1 min-w-0 text-[11px] text-foreground/50 placeholder:text-foreground/20 bg-transparent border-none outline-none" />
                          <span className="text-[10px] text-foreground/25 shrink-0">{(item.file.size / 1024).toFixed(0)} KB</span>
                          <button onClick={() => setResultFiles((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-foreground/[0.08]"><X className="w-3 h-3 text-foreground/30" /></button>
                        </div>);
                  })}
                  </div>
                }
              </div>
            </div>}
            {localStatus === "help" && <div className={cn("rounded-xl border bg-foreground/[0.04] dark:bg-muted/50 px-3 py-2", helpSubmitted ? "border-red-500" : "border-border")}>
              {helpSubmitted ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-xs font-medium text-red-500">
                      Комментарии проблемы от {helpSubmitted.date.toLocaleDateString("ru-RU")} {helpSubmitted.date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-1.5">
                    <OnlineAvatar userId={currentUser?.id} src={helpSubmitted.userAvatar} fallback={helpSubmitted.userName.charAt(0)} className="w-6 h-6" dotClassName="w-2 h-2" />
                    <span className="text-xs font-medium text-foreground/70">{helpSubmitted.userName}</span>
                  </div>
                  <div className="text-xs text-foreground/60 leading-relaxed whitespace-pre-wrap px-1">{helpSubmitted.text}</div>
                  {helpSubmitted.files.length > 0 && (
                    <div className="mt-1.5 space-y-1">
                      {helpSubmitted.files.map((item, i) => {
                        const ext = item.file.name.split(".").pop()?.toLowerCase() || "";
                        const IconComp = ["jpg","jpeg","png","gif","webp","svg","bmp","ico"].includes(ext) ? FileImage : ["pdf","doc","docx","txt","rtf","odt"].includes(ext) ? FileText : ["xls","xlsx","csv"].includes(ext) ? FileSpreadsheet : ["zip","rar","7z","tar","gz"].includes(ext) ? FileArchive : ["mp4","avi","mov","mkv","webm"].includes(ext) ? FileVideo : ["mp3","wav","ogg","flac","aac"].includes(ext) ? FileAudio : File;
                        const colorClass = ["jpg","jpeg","png","gif","webp","svg","bmp","ico"].includes(ext) ? "text-green-500" : ["pdf"].includes(ext) ? "text-red-500" : ["doc","docx","txt","rtf","odt"].includes(ext) ? "text-blue-500" : ["xls","xlsx","csv"].includes(ext) ? "text-emerald-600" : ["zip","rar","7z","tar","gz"].includes(ext) ? "text-amber-500" : ["mp4","avi","mov","mkv","webm"].includes(ext) ? "text-purple-500" : ["mp3","wav","ogg","flac","aac"].includes(ext) ? "text-pink-500" : "text-foreground/40";
                        return (
                          <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-foreground/[0.03]">
                            <IconComp className={`w-4 h-4 shrink-0 ${colorClass}`} />
                            <span className="text-xs text-foreground/60 truncate">{item.file.name}</span>
                            <span className="text-[10px] text-foreground/25 shrink-0">{(item.file.size / 1024).toFixed(0)} KB</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="flex items-center gap-2 mb-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                    <span className="text-xs font-medium text-red-500">Комментарии к проблеме:</span>
                  </div>
                  <textarea
                    value={helpComment}
                    onChange={(e) => setHelpComment(e.target.value)}
                    placeholder="Опишите проблему, с которой вы столкнулись..."
                    className="w-full min-h-[60px] text-xs text-foreground/70 placeholder:text-foreground/25 bg-transparent border-none outline-none resize-none px-1 py-1 leading-relaxed" />
                  <div className="mt-1.5 border-t border-foreground/[0.06] pt-1.5">
                    <div className="flex items-center justify-between">
                      <button onClick={() => helpFileInputRef.current?.click()} className="group/hf flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors">
                        <Paperclip className="w-3.5 h-3.5 text-muted-foreground group-hover/hf:text-blue1 transition-colors" />
                        <span className="text-[11px] text-muted-foreground group-hover/hf:text-blue1 transition-colors">Прикрепить файлы</span>
                      </button>
                      <button
                        onClick={() => {
                          if (!helpComment.trim() && helpFiles.length === 0) return;
                          const userName = currentUser ? `${currentUser.first_name || currentUser.NAME || ""} ${currentUser.last_name || currentUser.LAST_NAME || ""}`.trim() : "Пользователь";
                          setHelpSubmitted({
                            text: helpComment,
                            date: new Date(),
                            files: [...helpFiles],
                            userName,
                            userAvatar: currentUser?.avatar_url || currentUser?.PERSONAL_PHOTO,
                          });
                        }}
                        disabled={!helpComment.trim() && helpFiles.length === 0}
                        className="px-3 py-1 rounded-md bg-red-500 text-white text-[11px] font-medium hover:bg-red-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Отправить
                      </button>
                    </div>
                    <input ref={helpFileInputRef} type="file" multiple className="hidden" onChange={(e) => {
                      const files = e.target.files ? Array.from(e.target.files) : [];
                      if (files.length > 0) setHelpFiles((prev) => [...prev, ...files.map((f) => ({ file: f, comment: "" }))]);
                      e.target.value = "";
                    }} />
                    {helpFiles.length > 0 &&
                    <div className="mt-1.5 space-y-1.5">
                        {helpFiles.map((item, i) => {
                        const ext = item.file.name.split(".").pop()?.toLowerCase() || "";
                        const IconComp = ["jpg","jpeg","png","gif","webp","svg","bmp","ico"].includes(ext) ? FileImage : ["pdf","doc","docx","txt","rtf","odt"].includes(ext) ? FileText : ["xls","xlsx","csv"].includes(ext) ? FileSpreadsheet : ["zip","rar","7z","tar","gz"].includes(ext) ? FileArchive : ["mp4","avi","mov","mkv","webm"].includes(ext) ? FileVideo : ["mp3","wav","ogg","flac","aac"].includes(ext) ? FileAudio : File;
                        const colorClass = ["jpg","jpeg","png","gif","webp","svg","bmp","ico"].includes(ext) ? "text-green-500" : ["pdf"].includes(ext) ? "text-red-500" : ["doc","docx","txt","rtf","odt"].includes(ext) ? "text-blue-500" : ["xls","xlsx","csv"].includes(ext) ? "text-emerald-600" : ["zip","rar","7z","tar","gz"].includes(ext) ? "text-amber-500" : ["mp4","avi","mov","mkv","webm"].includes(ext) ? "text-purple-500" : ["mp3","wav","ogg","flac","aac"].includes(ext) ? "text-pink-500" : "text-foreground/40";
                        return (
                          <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-foreground/[0.03]">
                              <IconComp className={`w-4 h-4 shrink-0 ${colorClass}`} />
                              <span className="text-xs text-foreground/60 truncate shrink-0 max-w-[120px]">{item.file.name}</span>
                              <span className="text-foreground/10 shrink-0">·</span>
                              <input type="text" value={item.comment} onChange={(e) => setHelpFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, comment: e.target.value } : f))} placeholder="Комментарий..." className="flex-1 min-w-0 text-[11px] text-foreground/50 placeholder:text-foreground/20 bg-transparent border-none outline-none" />
                              <span className="text-[10px] text-foreground/25 shrink-0">{(item.file.size / 1024).toFixed(0)} KB</span>
                              <button onClick={() => setHelpFiles((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-foreground/[0.08]"><X className="w-3 h-3 text-foreground/30" /></button>
                            </div>);
                      })}
                      </div>
                    }
                  </div>
                </>
              )}
            </div>}

            <div className="relative rounded-xl border border-border bg-foreground/[0.04] dark:bg-muted/50 px-3 min-h-[80px]">
              {(usersLoading || profilesLoading) && (
                <div className="absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-card/80">
                  <div className="w-2/3 h-[3px] rounded-full bg-foreground/[0.06] overflow-hidden">
                    <div className="h-full w-1/2 rounded-full bg-blue1" style={{ animation: "progressBar 1.5s ease-in-out infinite" }} />
                  </div>
                </div>
              )}
              <button
                onClick={() => setRolesCollapsed(!rolesCollapsed)}
                className="absolute top-2 right-2 p-1 text-foreground/30 hover:text-blue1 transition-colors z-10"
              >
                <ChevronDown className={cn("w-4 h-4 transition-transform duration-200", rolesCollapsed && "rotate-180")} />
              </button>
              {/* Исполнитель */}
              <InfoRow label="Исполнитель">
                <div className="relative">
                  {responsibleName ?
                  <PersonBadge
                    name={responsibleName}
                    icon={responsibleIcon}
                    onClick={canEdit ? () => setEditingResponsible(true) : undefined} /> :
                  <div className="flex items-center gap-2 flex-1 min-w-0 group/pick cursor-pointer" onClick={canEdit ? () => setEditingResponsible(true) : undefined}><User className="w-4 h-4 text-foreground/30 group-hover/pick:text-ring transition-colors" /><span className="text-xs text-foreground/30 group-hover/pick:text-ring transition-colors">Выбрать</span></div>
                  }
                  {canEdit &&
                  <MemberSelector
                    selectedId={localResponsibleId}
                    onSelect={handleSelectResponsible}
                    open={editingResponsible}
                    onOpenChange={setEditingResponsible} />
                  }
                </div>
              </InfoRow>

              {/* Постановщик — always visible */}
              <InfoRow label="Постановщик">
                <div className="relative">
                  {creatorName ?
                  <PersonBadge
                    name={creatorName}
                    icon={creatorIcon}
                    onClick={canEdit ? () => setEditingCreator(true) : undefined} /> :
                  <div className="flex items-center gap-2 flex-1 min-w-0 group/pick cursor-pointer" onClick={canEdit ? () => setEditingCreator(true) : undefined}><User className="w-4 h-4 text-foreground/30 group-hover/pick:text-ring transition-colors" /><span className="text-xs text-foreground/30 group-hover/pick:text-ring transition-colors">Выбрать</span></div>
                  }
                  {canEdit &&
                  <MemberSelector
                    selectedId={localCreatorId}
                    onSelect={handleSelectCreator}
                    open={editingCreator}
                    onOpenChange={setEditingCreator} />
                  }
                </div>
              </InfoRow>

              {!rolesCollapsed && (
                <>
              {/* Помощники (соисполнители) */}
              <InfoRow label="Помощники">
                <div className="relative" ref={accomplicesRef}>
                  {localAccompliceIds.length > 0 ? (
                    <div className="flex items-center gap-1 flex-wrap">
                      {localAccompliceIds.map((id) => {
                        const m = getMember(id);
                        const name = m ? `${m.LAST_NAME} ${m.NAME}` : id;
                        return (
                          <div key={id} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-foreground/[0.04] text-xs text-foreground/60">
                            <Avatar className="w-4 h-4">
                              <AvatarImage src={m?.PERSONAL_PHOTO} />
                              <AvatarFallback className="text-[6px] bg-muted">{getInitials(name)}</AvatarFallback>
                            </Avatar>
                            <span className="truncate max-w-[80px]">{name}</span>
                            {canEdit && <button onClick={() => handleToggleAccomplice(id)} className="w-3 h-3 flex items-center justify-center hover:text-destructive"><X className="w-2.5 h-2.5" /></button>}
                          </div>
                        );
                      })}
                      {canEdit && <button onClick={() => setAccomplicesOpen(true)} className="w-5 h-5 rounded-full hover:bg-foreground/[0.06] flex items-center justify-center"><Plus className="w-3 h-3 text-foreground/30" /></button>}
                    </div>
                  ) : (
                    canEdit ? <div className="flex items-center gap-2 flex-1 min-w-0 group/pick cursor-pointer" onClick={() => setAccomplicesOpen(true)}><User className="w-4 h-4 text-foreground/30 group-hover/pick:text-ring transition-colors" /><span className="text-xs text-foreground/30 group-hover/pick:text-ring transition-colors">Выбрать</span></div> : <span className="text-muted-foreground text-xs">—</span>
                  )}
                  {accomplicesOpen &&
                  <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-lg border border-border bg-card shadow-lg animate-in fade-in-0 zoom-in-95 duration-150">
                      <TaskUserAccordionPicker
                        selectedIds={localAccompliceIds}
                        multiple
                        onConfirm={(ids) => {
                          setLocalAccompliceIds(ids);
                          setAccomplicesOpen(false);
                          handleUpdateField("ACCOMPLICES", ids);
                        }}
                        onClose={() => setAccomplicesOpen(false)}
                        buttonLabel="Назначить"
                      />
                    </div>
                  }
                </div>
              </InfoRow>

              {/* Наблюдатели */}
              <InfoRow label="Наблюдатели">
                <div className="relative" ref={auditorsRef}>
                  {localAuditorIds.length > 0 ? (
                    <div className="flex items-center gap-1 flex-wrap">
                      {localAuditorIds.map((id) => {
                        const m = getMember(id);
                        const name = m ? `${m.LAST_NAME} ${m.NAME}` : id;
                        return (
                          <div key={id} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-foreground/[0.04] text-xs text-foreground/60">
                            <Avatar className="w-4 h-4">
                              <AvatarImage src={m?.PERSONAL_PHOTO} />
                              <AvatarFallback className="text-[6px] bg-muted">{getInitials(name)}</AvatarFallback>
                            </Avatar>
                            <span className="truncate max-w-[80px]">{name}</span>
                            {canEdit && <button onClick={() => handleToggleAuditor(id)} className="w-3 h-3 flex items-center justify-center hover:text-destructive"><X className="w-2.5 h-2.5" /></button>}
                          </div>
                        );
                      })}
                      {canEdit && <button onClick={() => setAuditorsOpen(true)} className="w-5 h-5 rounded-full hover:bg-foreground/[0.06] flex items-center justify-center"><Plus className="w-3 h-3 text-foreground/30" /></button>}
                    </div>
                  ) : (
                    canEdit ? <div className="flex items-center gap-2 flex-1 min-w-0 group/pick cursor-pointer" onClick={() => setAuditorsOpen(true)}><User className="w-4 h-4 text-foreground/30 group-hover/pick:text-ring transition-colors" /><span className="text-xs text-foreground/30 group-hover/pick:text-ring transition-colors">Выбрать</span></div> : <span className="text-muted-foreground text-xs">—</span>
                  )}
                  {auditorsOpen &&
                  <div className="absolute left-0 top-full mt-1 z-50 w-72 rounded-lg border border-border bg-card shadow-lg animate-in fade-in-0 zoom-in-95 duration-150">
                      <TaskUserAccordionPicker
                        selectedIds={localAuditorIds}
                        multiple
                        onConfirm={(ids) => {
                          setLocalAuditorIds(ids);
                          setAuditorsOpen(false);
                          handleUpdateField("AUDITORS", ids);
                        }}
                        onClose={() => setAuditorsOpen(false)}
                        buttonLabel="Назначить"
                      />
                    </div>
                  }
                </div>
              </InfoRow>
                </>
              )}


              {/* Крайний срок */}
                <div className="flex items-center gap-3 py-2">
                  <div className="flex items-center gap-1.5 w-[161px] shrink-0">
                    <span className="text-xs text-foreground/50 font-medium">Крайний срок</span>
                  </div>
                  <div className="flex-1 min-w-0 text-sm flex items-center gap-2">
                    <div className="relative flex-1">
                      {canEdit ?
                      <Popover open={editingDeadline} onOpenChange={(v) => {if (!v) handleSaveDeadline();setEditingDeadline(v);}}>
                          <PopoverTrigger asChild>
                            <div className="flex items-center gap-1.5 cursor-pointer transition-colors text-xs text-foreground/70 hover:text-blue1 group/deadline">
                              <CalendarIcon className="w-3.5 h-3.5 text-blue1 shrink-0" />
                              <span className={cn("truncate", overdue ? "text-red-500 font-medium" : "")}>
                                {overdue && <Clock className="w-3 h-3 inline mr-1" />}
                                {localDeadline ? formatDate(localDeadline.toISOString()) : "—"}
                              </span>
{localDeadline && (() => {const h = localDeadline.getHours();const m = localDeadline.getMinutes();return h !== 0 || m !== 0 ? <span className={cn("truncate", overdue ? "text-red-500 font-medium" : "")}>{String(h).padStart(2, "0")}:{String(m).padStart(2, "0")}</span> : null;})()}
{localDeadline && (() => {const now = new Date();const deadlineDay = new Date(localDeadline.getFullYear(), localDeadline.getMonth(), localDeadline.getDate());const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());const diffDays = Math.round((deadlineDay.getTime() - todayDay.getTime()) / (1000 * 60 * 60 * 24));if (diffDays < 0) return <span className="text-red-500 text-xs ml-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3 inline" />Задача просрочена!</span>;if (diffDays === 0) return <span className="text-yellow-500 text-xs ml-1">[сегодня]</span>;const dLabel = diffDays === 1 ? "день" : diffDays < 5 ? "дня" : "дней";const colorClass = diffDays <= 3 ? "text-yellow-500" : "text-foreground/70";return <span className={`${colorClass} text-xs ml-1 group/ping relative cursor-pointer`}><span className="group-hover/ping:opacity-0 transition-opacity">[осталось {diffDays} {dLabel}]</span><button onClick={(e) => {e.stopPropagation();}} className="absolute inset-0 opacity-0 group-hover/ping:opacity-100 transition-opacity text-blue1 text-xs font-medium whitespace-nowrap">[Пинг задачи]</button></span>;})()}
                            </div>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <CalendarPicker mode="single" selected={localDeadline} onSelect={setLocalDeadline} initialFocus className={cn("p-3 pointer-events-auto")} />
                            <div className="flex items-center gap-2 px-3 pb-3 border-t border-border pt-2">
                              <span className="text-xs text-muted-foreground">Время:</span>
                              <select value={deadlineHour} onChange={(e) => setDeadlineHour(e.target.value)} className="h-7 rounded-md border border-border bg-muted/50 px-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring">
                                {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => <option key={h} value={h}>{h}</option>)}
                              </select>
                              <span className="text-xs text-muted-foreground">:</span>
                              <select value={deadlineMinute} onChange={(e) => setDeadlineMinute(e.target.value)} className="h-7 rounded-md border border-border bg-muted/50 px-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring">
                                {["00", "15", "30", "45"].map((m) => <option key={m} value={m}>{m}</option>)}
                              </select>
                            </div>
                          </PopoverContent>
                        </Popover> :
                      <div className="flex items-center gap-2">
                          <CalendarIcon className="w-3.5 h-3.5 text-foreground/30 shrink-0" />
                          <span className={cn("text-xs text-foreground/70", overdue && "text-red-500 font-medium")}>
                            {localDeadline ? formatDate(localDeadline.toISOString()) : "—"}
                          </span>
                        </div>
                      }
                    </div>
                  </div>
                </div>

              {!rolesCollapsed && (
                <InfoRow label="Дата создания">
                  <span className="text-xs text-foreground/50">{task.createdDate ? formatDateTime(task.createdDate) : "—"}</span>
                </InfoRow>
              )}
            </div>

            {/* Путь задачи + Описание задачи */}
            <div>
              {editingDescription ?
              <RichTextEditor
                  value={localDescription}
                  onChange={setLocalDescription}
                  placeholder="Описание"
                  onSave={() => {
                    setEditingDescription(false);
                    if (localDescription !== (task.description || "")) {
                      handleUpdateField("DESCRIPTION", localDescription);
                    }
                  }}
                  onExpand={() => {
                    setEditingDescription(false);
                    if (localDescription !== (task.description || "")) {
                      handleUpdateField("DESCRIPTION", localDescription);
                    }
                  }} /> :
              <div className="rounded-xl border border-border bg-foreground/[0.04] dark:bg-muted/50 px-3 py-2">
                  <button
                  onClick={() => setEditingDescription(true)}
                  className="group/desc flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md transition-colors hover:text-blue1 [&:hover_.desc-icon]:text-blue1">
                    {!(localDescription && localDescription.replace(/<[^>]*>/g, '').trim()) && <FileText className="desc-icon w-4 h-4 text-muted-foreground shrink-0 transition-colors" />}
                    <div className="flex items-center gap-1.5 min-w-0 text-xs text-muted-foreground group-hover/desc:text-blue1 truncate text-left transition-colors">
                      {localDescription && localDescription.replace(/<[^>]*>/g, '').trim() ? (
                        <>
                          <span className="text-xs font-medium text-foreground/50 shrink-0">Описание задачи:</span>
                          <span className="truncate text-foreground/70" dangerouslySetInnerHTML={{ __html: localDescription }} />
                        </>
                      ) : "Описание"}
                    </div>
                  </button>
                </div>
              }
            </div>

            {/* Файлы задачи */}
            <div className="rounded-xl border border-border bg-foreground/[0.04] dark:bg-muted/50 px-3 py-2">
              <div className="flex items-center gap-2 mb-1">
                
                <span className="text-xs text-foreground/50 font-medium">Добавить файлы для работы с задачей:</span>
              </div>
              <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => {
                const files = e.target.files ? Array.from(e.target.files) : [];
                if (files.length > 0) setAttachedFiles((prev) => [...prev, ...files.map((f) => ({ file: f, comment: "" }))]);
                e.target.value = "";
              }} />
              {attachedFiles.length > 0 &&
              <div className="space-y-1.5 mb-2">
                {attachedFiles.map((item, i) => {
                  const ext = item.file.name.split(".").pop()?.toLowerCase() || "";
                  const IconComp = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext) ? FileImage : ["pdf", "doc", "docx", "txt", "rtf", "odt"].includes(ext) ? FileText : ["xls", "xlsx", "csv"].includes(ext) ? FileSpreadsheet : ["zip", "rar", "7z", "tar", "gz"].includes(ext) ? FileArchive : ["mp4", "avi", "mov", "mkv", "webm"].includes(ext) ? FileVideo : ["mp3", "wav", "ogg", "flac", "aac"].includes(ext) ? FileAudio : File;
                  const colorClass = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext) ? "text-green-500" : ["pdf"].includes(ext) ? "text-red-500" : ["doc", "docx", "txt", "rtf", "odt"].includes(ext) ? "text-blue-500" : ["xls", "xlsx", "csv"].includes(ext) ? "text-emerald-600" : ["zip", "rar", "7z", "tar", "gz"].includes(ext) ? "text-amber-500" : ["mp4", "avi", "mov", "mkv", "webm"].includes(ext) ? "text-purple-500" : ["mp3", "wav", "ogg", "flac", "aac"].includes(ext) ? "text-pink-500" : "text-foreground/40";
                  return (
                    <div key={i} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-foreground/[0.03]">
                      <IconComp className={`w-4 h-4 shrink-0 ${colorClass}`} />
                      <span className="text-xs text-foreground/60 truncate shrink-0 max-w-[120px]">{item.file.name}</span>
                      <span className="text-foreground/10 shrink-0">·</span>
                      <input type="text" value={item.comment} onChange={(e) => setAttachedFiles((prev) => prev.map((f, idx) => idx === i ? { ...f, comment: e.target.value } : f))} placeholder="Комментарий..." className="flex-1 min-w-0 text-[11px] text-foreground/50 placeholder:text-foreground/20 bg-transparent border-none outline-none" />
                      <span className="text-[10px] text-foreground/25 shrink-0">{(item.file.size / 1024).toFixed(0)} KB</span>
                      <button onClick={() => setAttachedFiles((prev) => prev.filter((_, idx) => idx !== i))} className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-foreground/[0.08]"><X className="w-3 h-3 text-foreground/30" /></button>
                    </div>
                  );
                })}
                {!uploadingFiles && attachedFiles.length > 0 &&
                <button onClick={() => handleUploadFiles(attachedFiles.map(f => f.file))} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue1/10 text-blue1 text-xs font-medium hover:bg-blue1/20 transition-colors w-full justify-center">
                  <Upload className="w-3.5 h-3.5" />
                  Загрузить ({attachedFiles.length})
                </button>
                }
                {uploadingFiles &&
                <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-muted-foreground">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Загрузка...
                </div>
                }
              </div>
              }
              {loadingTaskFiles && <div className="flex items-center gap-2 px-2.5 py-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" /><span className="text-xs text-muted-foreground">Загрузка файлов...</span></div>}
              {taskFiles.length > 0 &&
              <div className="space-y-1">
                {taskFiles.map((tf) => {
                  const ext = tf.file_name?.split(".").pop()?.toLowerCase() || "";
                  const IconComp = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext) ? FileImage : ["pdf", "doc", "docx", "txt", "rtf", "odt"].includes(ext) ? FileText : ["xls", "xlsx", "csv"].includes(ext) ? FileSpreadsheet : ["zip", "rar", "7z", "tar", "gz"].includes(ext) ? FileArchive : ["mp4", "avi", "mov", "mkv", "webm"].includes(ext) ? FileVideo : ["mp3", "wav", "ogg", "flac", "aac"].includes(ext) ? FileAudio : File;
                  const colorClass = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico"].includes(ext) ? "text-green-500" : ["pdf"].includes(ext) ? "text-red-500" : ["doc", "docx", "txt", "rtf", "odt"].includes(ext) ? "text-blue-500" : ["xls", "xlsx", "csv"].includes(ext) ? "text-emerald-600" : ["zip", "rar", "7z", "tar", "gz"].includes(ext) ? "text-amber-500" : ["mp4", "avi", "mov", "mkv", "webm"].includes(ext) ? "text-purple-500" : ["mp3", "wav", "ogg", "flac", "aac"].includes(ext) ? "text-pink-500" : "text-foreground/40";
                  return (
                    <div key={tf.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-foreground/[0.03] hover:bg-foreground/[0.06] transition-colors group/tf cursor-pointer"
                      onClick={() => handleDownloadFile(tf.id, tf.file_url)}>
                        <IconComp className={`w-4 h-4 shrink-0 ${colorClass}`} />
                        <span className="text-xs text-foreground/60 truncate flex-1">{tf.file_name}</span>
                        <Download className="w-3.5 h-3.5 text-foreground/30 shrink-0" />
                        <button
                          onClick={async (e) => {
                            e.stopPropagation();
                            try {
                              await deleteTaskAttachment(tf.id, tf.file_url);
                              setTaskFiles((prev) => prev.filter((f) => f.id !== tf.id));
                              toast.success(`Файл "${tf.file_name}" удалён`);
                            } catch (err: any) {
                              toast.error("Ошибка удаления: " + (err?.message || ""));
                            }
                          }}
                          className="shrink-0 w-5 h-5 flex items-center justify-center rounded-full hover:bg-destructive/10 opacity-0 group-hover/tf:opacity-100 transition-opacity"
                          title="Удалить файл">
                          <X className="w-3 h-3 text-foreground/30 hover:text-destructive" />
                        </button>
                      </div>);
                })}
                </div>
              }
            </div>

             {checklists.length === 0 && !loadingChecklists && <div className="rounded-xl border border-border bg-foreground/[0.04] dark:bg-muted/50 px-3 py-2">
              <button onClick={() => {const newId = crypto.randomUUID();setChecklists((prev) => [...prev, { id: newId, title: "Чек-лист", items: [] }]);setActiveChecklistId(newId);}}
              className="group/cl flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md transition-colors hover:text-blue1 [&:hover_.cl-icon]:text-blue1">
                <ListChecks className="cl-icon w-4 h-4 text-muted-foreground shrink-0 transition-colors" />
                <span className="text-xs text-muted-foreground shrink-0 group-hover/cl:text-blue1 transition-colors">Добавить чек-лист</span>
              </button>
            </div>}
            {loadingChecklists && <div className="rounded-xl border border-border bg-foreground/[0.04] dark:bg-muted/50 px-3 py-2 flex items-center gap-2 px-5">
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
              <span className="text-xs text-muted-foreground">Загрузка чек-листа...</span>
            </div>}

            {checklists.map((cl, clIndex) =>
            <div key={cl.id} className="rounded-xl border border-border bg-foreground/[0.04] dark:bg-muted/50 px-3 py-2">
                <div className="flex items-center gap-1.5 mb-3">
                  <ListChecks className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-foreground/50 font-medium shrink-0">{toRoman(clIndex + 1)}.</span>
                  <span
                    ref={(el) => { checklistTitleRefs.current[cl.id] = el; }}
                    contentEditable={editingChecklistTitleId === cl.id}
                    suppressContentEditableWarning
                    onInput={(e) => {
                      const newTitle = (e.target as HTMLElement).textContent || "";
                      setChecklists((prev) => prev.map((c) => c.id === cl.id ? { ...c, title: newTitle } : c));
                    }}
                    onBlur={() => setEditingChecklistTitleId(null)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); setEditingChecklistTitleId(null); }
                      if (e.key === "Escape") { setEditingChecklistTitleId(null); }
                    }}
                    className={cn(
                      "text-xs text-foreground/50 font-medium outline-none shrink min-w-0",
                      editingChecklistTitleId === cl.id && "border-b border-primary"
                    )}>
                    {cl.title}
                  </span>
                  {cl.items.length > 0 && (() => {
                    const done = cl.items.filter((i) => i.checked).length;
                    const total = cl.items.length;
                    const pct = Math.round((done / total) * 100);
                    return (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="w-16 h-1 rounded-full bg-foreground/[0.06] overflow-hidden">
                          <div className="h-full rounded-full bg-ring transition-all duration-300" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-[10px] text-foreground/40 tabular-nums">{done}/{total}</span>
                      </div>
                    );
                  })()}
                  {editingChecklistTitleId === cl.id && <button onClick={() => setEditingChecklistTitleId(null)} className="w-5 h-5 rounded-full bg-blue1 flex items-center justify-center shrink-0 hover:bg-blue1/80 transition-colors" title="Сохранить"><Check className="w-3 h-3 text-white" /></button>}
                  <ChecklistSettingsMenu
                  onEdit={() => {
                    setEditingChecklistTitleId(cl.id);
                    setTimeout(() => {
                      const el = checklistTitleRefs.current[cl.id];
                      if (el) {
                        el.focus();
                        const range = document.createRange();
                        range.selectNodeContents(el);
                        const sel = window.getSelection();
                        sel?.removeAllRanges();
                        sel?.addRange(range);
                      }
                    }, 50);
                  }}
                  onCopy={() => {const copy = { ...cl, id: crypto.randomUUID(), title: cl.title + " (копия)", items: cl.items.map((item) => ({ ...item, id: crypto.randomUUID() })) };setChecklists((prev) => [...prev, copy]);}}
                  onDelete={() => {setChecklists((prev) => prev.filter((c) => c.id !== cl.id));if (activeChecklistId === cl.id) setActiveChecklistId(null);}}
                  onNewChecklist={() => {const newId = crypto.randomUUID();setChecklists((prev) => [...prev, { id: newId, title: "Чек-лист", items: [] }]);setActiveChecklistId(newId);}} />
                
                </div>
                {cl.items.length > 0 &&
              <div className="space-y-1 mb-2">
                {cl.items.map((item, itemIndex) =>
                <div key={item.id}
                  draggable
                  onDragStart={() => { setDragItemId(item.id); setDragChecklistId(cl.id); }}
                  onDragEnd={() => { setDragItemId(null); setDragOverItemId(null); setDragChecklistId(null); }}
                  onDragOver={(e) => { e.preventDefault(); setDragOverItemId(item.id); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragItemId && dragChecklistId === cl.id && dragItemId !== item.id) {
                      setChecklists((prev) => prev.map((c) => {
                        if (c.id !== cl.id) return c;
                        const items = [...c.items];
                        const fromIdx = items.findIndex((i) => i.id === dragItemId);
                        const toIdx = items.findIndex((i) => i.id === item.id);
                        if (fromIdx === -1 || toIdx === -1) return c;
                        const [moved] = items.splice(fromIdx, 1);
                        items.splice(toIdx, 0, moved);
                        return { ...c, items };
                      }));
                    }
                    setDragItemId(null); setDragOverItemId(null); setDragChecklistId(null);
                  }}
                  className={cn(
                    "rounded-md bg-foreground/[0.03] group transition-all",
                    dragItemId === item.id && "opacity-40",
                    dragOverItemId === item.id && dragItemId !== item.id && "border-t-2 border-ring"
                  )}>
                        <div className="flex items-center gap-2 px-0.5 py-1.5 cursor-grab active:cursor-grabbing">
                          
                          <span className={`text-[10px] text-foreground/30 shrink-0 tabular-nums w-4 text-right`}>{itemIndex + 1}.</span>
                          <button
                            onClick={() => handleToggleCheckItem(cl.id, item.id)}
                            className={`shrink-0 w-3 h-3 rounded-sm border flex items-center justify-center transition-colors ${item.checked ? 'bg-ring border-ring' : 'border-foreground/20 hover:border-foreground/40'}`}>
                            {item.checked && <Check className="w-1.5 h-1.5 text-white" />}
                          </button>
                          {editingItemId === item.id ? (
                            <input
                              autoFocus
                              value={editingItemTitle}
                              onChange={(e) => setEditingItemTitle(e.target.value)}
                              onBlur={() => {
                                if (editingItemTitle.trim()) {
                                  handleUpdateCheckItemTitle(cl.id, item.id, editingItemTitle.trim());
                                }
                                setEditingItemId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") { e.currentTarget.blur(); }
                                if (e.key === "Escape") { setEditingItemId(null); }
                              }}
                              className={`text-xs flex-1 min-w-0 bg-transparent outline-none border-b border-ring ${item.checked ? 'line-through text-foreground/30' : 'text-foreground/70'}`}
                            />
                          ) : (
                            <span
                              onDoubleClick={() => { setEditingItemId(item.id); setEditingItemTitle(item.title); }}
                              className={`text-xs truncate flex-1 cursor-default ${item.checked ? 'line-through text-foreground/30' : 'text-foreground/70'}`}
                            >{item.title}</span>
                          )}
                          <button onClick={() => checkItemFileRefs.current[item.id]?.click()}
                    className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-foreground/[0.08] opacity-60 group-hover:opacity-100 transition-opacity" title="Прикрепить файл">
                            <Paperclip className="w-3 h-3 text-foreground/30 hover:text-blue1 transition-colors" />
                          </button>
                          <input ref={(el) => {checkItemFileRefs.current[item.id] = el;}} type="file" multiple className="hidden" onChange={async (e) => {
                      const files = e.target.files ? Array.from(e.target.files) : [];
                      if (files.length === 0) { e.target.value = ""; return; }
                      // Add files with uploading state
                      const tempFiles = files.map((f) => ({ name: f.name, size: f.size, uploading: true }));
                      setChecklists((prev) => prev.map((c) => c.id === cl.id ? { ...c, items: c.items.map((ci) => ci.id === item.id ? { ...ci, files: [...(ci.files || []), ...tempFiles] } : ci) } : c));
                      // Upload each file to external Supabase storage
                      for (let fi = 0; fi < files.length; fi++) {
                        const file = files[fi];
                        try {
                          const uploaded = await uploadTaskFile(task.id, file);
                          // Update file state: remove uploading, add real data
                          setChecklists((prev) => prev.map((c) => c.id === cl.id ? { ...c, items: c.items.map((ci) => {
                            if (ci.id !== item.id) return ci;
                            const updatedFiles = (ci.files || []).map((f) => f.name === file.name && f.uploading ? { ...f, uploading: false, fileId: uploaded.id, downloadUrl: uploaded.file_url } : f);
                            return { ...ci, files: updatedFiles };
                          }) } : c));
                          toast.success(`Файл "${file.name}" прикреплён`);
                        } catch (err: any) {
                          toast.error(`Ошибка: ${err?.message || ""}`);
                          // Remove failed file
                          setChecklists((prev) => prev.map((c) => c.id === cl.id ? { ...c, items: c.items.map((ci) => ci.id === item.id ? { ...ci, files: (ci.files || []).filter((f) => !(f.name === file.name && f.uploading)) } : ci) } : c));
                        }
                      }
                      e.target.value = "";
                    }} />
                          {/* Assignee */}
                          <Popover open={assigneePopoverItemId === item.id} onOpenChange={(v) => setAssigneePopoverItemId(v ? item.id : null)}>
                            <PopoverTrigger asChild>
                              <button className="shrink-0">
                                {item.assigneeId ? (() => {
                                  const m = getMember(item.assigneeId);
                                  return m ? <Avatar className="w-4 h-4"><AvatarImage src={m.PERSONAL_PHOTO} /><AvatarFallback className="text-[6px] bg-muted">{getInitials(`${m.LAST_NAME} ${m.NAME}`)}</AvatarFallback></Avatar> : <User className="w-3 h-3 text-foreground/30" />;
                                })() : <User className="w-3 h-3 text-foreground/20 hover:text-foreground/40 transition-colors" />}
                              </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-48 p-1" align="end">
                              <div className="max-h-40 overflow-y-auto">
                                {assigneeCandidates.map((m) => {
                                  const name = `${m.LAST_NAME} ${m.NAME}`.trim();
                                  const isSelected = item.assigneeId === m.ID;
                                  return (
                                    <button key={m.ID} onClick={() => {
                                      handleSetCheckItemAssignee(cl.id, item.id, isSelected ? undefined : m.ID);
                                      setAssigneePopoverItemId(null);
                                    }} className={cn("w-full flex items-center gap-2 px-2 py-1 rounded-md text-left transition-colors", isSelected ? "bg-ring/10" : "hover:bg-foreground/[0.04]")}>
                                      <Avatar className="w-4 h-4"><AvatarImage src={m.PERSONAL_PHOTO} /><AvatarFallback className="text-[6px] bg-muted">{getInitials(name)}</AvatarFallback></Avatar>
                                      <span className="text-[11px] truncate text-foreground/70">{name}</span>
                                      {isSelected && <Check className="w-3 h-3 text-ring ml-auto" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </PopoverContent>
                          </Popover>
                          <button onClick={() => handleDeleteCheckItem(cl.id, item.id)} className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-3 h-3 text-foreground/30 hover:text-destructive" />
                          </button>
                        </div>
                        {/* Checklist item files */}
                        {item.files && item.files.length > 0 && (
                          <div className="pl-8 pb-1.5 space-y-1">
                            {item.files.map((f, fi) => {
                              const ext = f.name.split(".").pop()?.toLowerCase() || "";
                              const IconComp = ["jpg","jpeg","png","gif","webp","svg","bmp","ico"].includes(ext) ? FileImage : ["pdf","doc","docx","txt","rtf","odt"].includes(ext) ? FileText : ["xls","xlsx","csv"].includes(ext) ? FileSpreadsheet : ["zip","rar","7z","tar","gz"].includes(ext) ? FileArchive : ["mp4","avi","mov","mkv","webm"].includes(ext) ? FileVideo : ["mp3","wav","ogg","flac","aac"].includes(ext) ? FileAudio : File;
                              const colorClass = ["jpg","jpeg","png","gif","webp","svg","bmp","ico"].includes(ext) ? "text-green-500" : ["pdf"].includes(ext) ? "text-red-500" : ["doc","docx","txt","rtf","odt"].includes(ext) ? "text-blue-500" : ["xls","xlsx","csv"].includes(ext) ? "text-emerald-600" : ["zip","rar","7z","tar","gz"].includes(ext) ? "text-amber-500" : ["mp4","avi","mov","mkv","webm"].includes(ext) ? "text-purple-500" : ["mp3","wav","ogg","flac","aac"].includes(ext) ? "text-pink-500" : "text-foreground/40";
                              return (
                                <div key={fi} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-foreground/[0.03] hover:bg-foreground/[0.06] transition-colors group/cf">
                                  {f.uploading ? (
                                    <Loader2 className="w-4 h-4 shrink-0 text-muted-foreground animate-spin" />
                                  ) : (
                                    <button onClick={() => f.fileId && handleDownloadFile(f.fileId, f.name)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                                      <IconComp className={`w-4 h-4 shrink-0 ${colorClass}`} />
                                      <span className="text-xs text-foreground/60 truncate flex-1">{f.name}</span>
                                      <Download className="w-3.5 h-3.5 text-foreground/30 shrink-0" />
                                    </button>
                                  )}
                                  {!f.uploading && (
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (f.fileId) {
                                          try { await deleteTaskAttachment(f.fileId, f.downloadUrl || ""); } catch {}
                                        }
                                        setChecklists((prev) => prev.map((c) => c.id === cl.id ? { ...c, items: c.items.map((ci) => ci.id === item.id ? { ...ci, files: (ci.files || []).filter((_, idx) => idx !== fi) } : ci) } : c));
                                        toast.success(`Файл "${f.name}" откреплён`);
                                      }}
                                      className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-destructive/10 opacity-0 group-hover/cf:opacity-100 transition-opacity"
                                      title="Открепить файл">
                                      <X className="w-3 h-3 text-foreground/30 hover:text-destructive" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                )}
              </div>
              }
                <div className="mt-1 flex items-center gap-1">
                <input
                value={activeChecklistId === cl.id ? newCheckItem : ""}
                onChange={(e) => {setActiveChecklistId(cl.id);setNewCheckItem(e.target.value);}}
                onKeyDown={(e) => {if (e.key === "Enter" && newCheckItem.trim()) {handleAddCheckItem(cl.id, newCheckItem.trim());setNewCheckItem("");}}}
                placeholder="Нажмите, чтобы добавить новый пункт..." className="flex-1 text-xs text-foreground/70 placeholder:text-foreground/30 bg-transparent border-none outline-none px-2.5 py-1.5 min-h-[32px]" />
                </div>
              </div>
            )}

          </div>
        </ScrollArea>
      </div>
      {/* Chat panel */}
      <div className="w-[37%] shrink-0 flex flex-col">
        <div className="px-4 py-2 border-b border-border bg-muted/30">
          <div className="flex items-center gap-0 rounded-lg bg-foreground/[0.03] p-0.5">
            {(["Чат задачи", "Медиа и файлы", "Ссылки", "Избранное"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setChatTab(tab)}
                className={`flex-1 px-2 py-1.5 rounded-md transition-all text-[11px] font-medium ${
                  chatTab === tab
                    ? "bg-card text-foreground/85 shadow-sm"
                    : "text-foreground/40 hover:text-foreground/60"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {chatTab === "Чат задачи" && (
          <>
            <ScrollArea className="flex-1 min-h-0">
              <div className="p-4 space-y-3">
                {messages.map((msg) =>
                <div key={msg.id} className={`flex gap-2.5 ${msg.isMine ? "flex-row-reverse" : ""}`}>
                    <Avatar className="w-7 h-7 shrink-0">
                      <AvatarImage src={msg.authorIcon} />
                      <AvatarFallback className="text-[8px] bg-muted">{getInitials(msg.author)}</AvatarFallback>
                    </Avatar>
                    <div className={`max-w-[220px] ${msg.isMine ? "items-end" : ""}`}>
                      <p className="text-[10px] text-muted-foreground mb-0.5">{msg.author}</p>
                      <div className={`rounded-xl px-3 py-2 text-xs leading-relaxed ${msg.isMine ? "bg-ring/10 text-foreground/80" : "bg-foreground/[0.04] text-foreground/70"}`}>{msg.text}</div>
                      <p className="text-[9px] text-muted-foreground/60 mt-0.5">{new Date(msg.date).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
            <div className="p-3 border-t border-border">
              <div className="flex items-center gap-2 bg-foreground/[0.03] rounded-xl px-3 py-2">
                <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                placeholder="Написать сообщение..."
                className="flex-1 bg-transparent text-xs text-foreground/80 placeholder:text-muted-foreground/40 outline-none" />
                <button onClick={handleSend} disabled={!newMessage.trim()}
                className="w-7 h-7 rounded-full bg-ring flex items-center justify-center hover:bg-ring/80 transition-colors disabled:opacity-30">
                  <Send className="w-3.5 h-3.5 text-white" />
                </button>
              </div>
            </div>
          </>
        )}

        {chatTab === "Медиа и файлы" && (
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Paperclip className="w-8 h-8 text-foreground/15 mb-3" />
                <p className="text-xs text-muted-foreground">Медиа и файлы из чата</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">Здесь будут отображаться все<br/>файлы, отправленные в чате</p>
              </div>
            </div>
          </ScrollArea>
        )}

        {chatTab === "Ссылки" && (
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Eye className="w-8 h-8 text-foreground/15 mb-3" />
                <p className="text-xs text-muted-foreground">Ссылки из чата</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">Здесь будут отображаться все<br/>ссылки, отправленные в чате</p>
              </div>
            </div>
          </ScrollArea>
        )}

        {chatTab === "Избранное" && (
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Sparkles className="w-8 h-8 text-foreground/15 mb-3" />
                <p className="text-xs text-muted-foreground">Избранные сообщения</p>
                <p className="text-[10px] text-muted-foreground/50 mt-1">Здесь будут отображаться<br/>сохранённые сообщения</p>
              </div>
            </div>
          </ScrollArea>
        )}
      </div>

      {/* ─── Approval Modal ─── */}
      {showApprovalModal && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setShowApprovalModal(false)}>
        <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-yellow-600" />
            <h3 className="text-sm font-semibold text-foreground">Отправить на согласование</h3>
          </div>
          <textarea
            value={resultDescription}
            onChange={(e) => setResultDescription(e.target.value)}
            placeholder="Опишите выполненную работу и результаты (обязательно)..."
            className="w-full min-h-[100px] rounded-xl border border-border bg-foreground/[0.04] px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none resize-none"
          />
          <div>
            <button onClick={() => resultFileInputRef.current?.click()} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-muted-foreground hover:text-blue1 transition-colors">
              <Paperclip className="w-3.5 h-3.5" />
              Прикрепить файлы результата
            </button>
            {resultFiles.length > 0 && <div className="mt-2 space-y-1">
              {resultFiles.map((item, i) => (
                <div key={i} className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-foreground/[0.03] text-xs">
                  <span className="truncate text-foreground/60">{item.file.name}</span>
                  <span className="text-foreground/20 text-[10px]">{(item.file.size / 1024).toFixed(0)} KB</span>
                  <button onClick={() => setResultFiles((prev) => prev.filter((_, idx) => idx !== i))} className="ml-auto"><X className="w-3 h-3 text-foreground/30" /></button>
                </div>
              ))}
            </div>}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowApprovalModal(false); setResultDescription(""); setResultFiles([]); }}
              className="px-3 py-1.5 rounded-lg text-xs text-foreground/60 hover:bg-foreground/[0.06] transition-colors">Отмена</button>
            <button
              disabled={!resultDescription.trim() || saving}
              onClick={async () => {
                setSaving(true);
                try {
                  await updateTask(task.id, { RESULT_DESCRIPTION: resultDescription });
                  if (resultFiles.length > 0) await handleUploadFiles(resultFiles.map(f => f.file));
                  await handleStatusChange("approval");
                  setShowApprovalModal(false);
                  setResultDescription("");
                  setResultFiles([]);
                } catch (e: any) { toast.error(e?.message || "Ошибка"); }
                finally { setSaving(false); }
              }}
              className="px-3 py-1.5 rounded-lg bg-yellow-500 text-white text-xs font-semibold hover:bg-yellow-600 transition-colors disabled:opacity-50">
              На согласование
            </button>
          </div>
        </div>
      </div>}

      {/* ─── Feedback Modal (На доработку) ─── */}
      {showFeedbackModal && <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setShowFeedbackModal(false)}>
        <div className="bg-card rounded-2xl border border-border shadow-xl w-full max-w-md p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-2">
            <ArrowLeft className="w-5 h-5 text-blue1" />
            <h3 className="text-sm font-semibold text-foreground">Вернуть на доработку</h3>
          </div>
          <textarea
            value={feedbackNotes}
            onChange={(e) => setFeedbackNotes(e.target.value)}
            placeholder="Комментарий к доработке (необязательно)..."
            className="w-full min-h-[80px] rounded-xl border border-border bg-foreground/[0.04] px-3 py-2 text-sm text-foreground placeholder:text-foreground/30 outline-none resize-none"
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowFeedbackModal(false); setFeedbackNotes(""); }}
              className="px-3 py-1.5 rounded-lg text-xs text-foreground/60 hover:bg-foreground/[0.06] transition-colors">Отмена</button>
            <button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  if (feedbackNotes.trim()) await updateTask(task.id, { FEEDBACK_NOTES: feedbackNotes });
                  await handleStatusChange("inwork");
                  setShowFeedbackModal(false);
                  setFeedbackNotes("");
                  toast.success("Задача возвращена на доработку");
                } catch (e: any) { toast.error(e?.message || "Ошибка"); }
                finally { setSaving(false); }
              }}
              className="px-3 py-1.5 rounded-lg bg-blue1 text-white text-xs font-semibold hover:bg-blue1/90 transition-colors disabled:opacity-50">
              Вернуть
            </button>
          </div>
        </div>
      </div>}
    </div>);

};

export default TaskDetailView;