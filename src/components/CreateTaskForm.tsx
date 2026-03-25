import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Loader2, User, Users, UserCheck, Eye, Calendar, Paperclip, Upload, X, ListChecks, Plus, GripVertical, Trash2, Settings, Pencil, Copy, Check, SlidersHorizontal, FileText, FileImage, FileSpreadsheet, FileArchive, FileVideo, FileAudio, File, MessageSquare } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { createTask } from "@/lib/supabase-tasks";
import { addChecklistItemsBatch } from "@/lib/supabase-checklists";
import { uploadTaskFilesBatch } from "@/lib/supabase-attachments";
import type { Bitrix24User } from "@/lib/bitrix24";
import RichTextEditor from "@/components/RichTextEditor";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar as CalendarPicker } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useSupabaseProfile } from "@/hooks/useSupabaseProfile";
import { useSupabaseUsers } from "@/hooks/useSupabaseUsers";
import { useAllProfiles } from "@/hooks/useAllProfiles";
import TaskUserAccordionPicker from "@/components/TaskUserAccordionPicker";

interface Props {
  projectId: string | number;
  projectName: string;
  sectionName?: string;
  members: Bitrix24User[];
  onBack: () => void;
  onCreated: () => void;
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).map((p) => p.charAt(0)).join("").slice(0, 2).toUpperCase();
}
function toRoman(n: number): string {
  const vals = [1000, 900, 500, 400, 100, 90, 50, 40, 10, 9, 5, 4, 1];
  const syms = ["M", "CM", "D", "CD", "C", "XC", "L", "XL", "X", "IX", "V", "IV", "I"];
  let r = "";for (let i = 0; i < vals.length; i++) while (n >= vals[i]) {r += syms[i];n -= vals[i];}return r;
}
function fullName(u: Bitrix24User) {
  return `${u.LAST_NAME || ""} ${u.NAME || ""}`.trim();
}

/* ─── Accordion-based role picker (single or multi) ─── */
const AccordionRolePicker = ({ label, icon: Icon, selectedIds, onConfirm, multiple = false, error, profiles }: {
  label: string; icon: React.ElementType; selectedIds: string[]; onConfirm: (ids: string[]) => void; multiple?: boolean; error?: boolean;
  profiles: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null }[];
}) => {
  const [open, setOpen] = useState(false);
  const selected = profiles.filter((p) => selectedIds.includes(p.id));
  const displayName = (p: { first_name: string | null; last_name: string | null }) =>
    `${p.last_name || ""} ${p.first_name || ""}`.trim() || "—";

  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex items-center gap-1.5 w-28 shrink-0">
        <span className={`text-xs font-medium ${error ? "text-destructive" : "text-foreground/50"} transition-colors`}>{label}</span>
      </div>
      <div className="relative flex-1 min-w-0">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <div className="flex items-center gap-2 w-full px-2.5 py-1.5 cursor-pointer text-left min-h-[32px]">
              {selected.length > 0 ? (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="flex items-center -space-x-1.5">
                    {selected.slice(0, 3).map((u) => (
                      <Avatar key={u.id} className="w-6 h-6 shrink-0 border border-card">
                        <AvatarImage src={u.avatar_url || undefined} />
                        <AvatarFallback className="text-[8px] bg-muted">{getInitials(displayName(u))}</AvatarFallback>
                      </Avatar>
                    ))}
                  </div>
                  <span className="text-xs text-foreground/70 truncate">
                    {selected.length === 1 ? displayName(selected[0]) : `${selected.length} чел.`}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); onConfirm([]); }} className="ml-auto shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-foreground/[0.08]">
                    <X className="w-3 h-3 text-foreground/30" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-1 min-w-0 group/pick">
                  <User className="w-4 h-4 text-foreground/30 group-hover/pick:text-ring transition-colors" />
                  <span className="text-xs text-foreground/30 group-hover/pick:text-ring transition-colors">Выбрать</span>
                </div>
              )}
            </div>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <TaskUserAccordionPicker
              selectedIds={selectedIds}
              multiple={multiple}
              onConfirm={(ids) => { onConfirm(ids); setOpen(false); }}
              onClose={() => setOpen(false)}
              buttonLabel="Назначить"
            />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};

/* ─── Checklist settings menu ─── */
const ChecklistMenu = ({ onEdit, onCopy, onDelete, onNewChecklist }: {onEdit: () => void;onCopy: () => void;onDelete: () => void;onNewChecklist: () => void;}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="shrink-0 w-5 h-5 flex items-center justify-center rounded-md hover:bg-foreground/[0.06] transition-colors"><Settings className="w-3.5 h-3.5 text-foreground/30" /></button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-36 rounded-lg border border-border bg-card shadow-lg p-1 animate-in fade-in-0 zoom-in-95 duration-150">
          <button onClick={() => {onEdit();setOpen(false);}} className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md hover:bg-foreground/[0.04] transition-colors text-left"><Pencil className="w-3.5 h-3.5 text-foreground/40" /><span className="text-xs text-foreground/70">Редактировать</span></button>
          <button onClick={() => {onCopy();setOpen(false);}} className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md hover:bg-foreground/[0.04] transition-colors text-left"><Copy className="w-3.5 h-3.5 text-foreground/40" /><span className="text-xs text-foreground/70">Скопировать</span></button>
          <button onClick={() => {onDelete();setOpen(false);}} className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md hover:bg-destructive/10 transition-colors text-left"><Trash2 className="w-3.5 h-3.5 text-destructive/60" /><span className="text-xs text-destructive/80">Удалить</span></button>
          <div className="h-px bg-border my-1" />
          <button onClick={() => {onNewChecklist();setOpen(false);}} className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md hover:bg-foreground/[0.04] transition-colors text-left"><Plus className="w-3.5 h-3.5 text-foreground/40" /><span className="text-xs text-foreground/70">Новый чек-лист</span></button>
        </div>
      )}
    </div>
  );
};

/* ─── Main form ─── */
const CreateTaskForm = ({ projectId, projectName, sectionName, members, onBack, onCreated }: Props) => {
  const { data: profile } = useSupabaseProfile();
  const { data: supabaseUsers = [] } = useSupabaseUsers();
  const { data: allProfiles = [] } = useAllProfiles();
  const validProfileIds = new Set(allProfiles.map((item) => item.id));
  const memberOptions = supabaseUsers.length > 0 ? supabaseUsers : members;
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [responsibleId, setResponsibleId] = useState("");
  const [creatorId, setCreatorId] = useState("");
  const [accompliceIds, setAccompliceIds] = useState<string[]>([]);
  const [auditorIds, setAuditorIds] = useState<string[]>([]);
  const [attachedFiles, setAttachedFiles] = useState<{file: File; comment: string}[]>([]);
  const [checklists, setChecklists] = useState<{id: string;title: string;items: {id: string;title: string;}[];}[]>([]);
  const [activeChecklistId, setActiveChecklistId] = useState<string | null>(null);
  const [checklistAdding, setChecklistAdding] = useState(false);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [deadline, setDeadline] = useState<Date | undefined>();
  const [deadlineHour, setDeadlineHour] = useState("12");
  const [deadlineMinute, setDeadlineMinute] = useState("00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [controlAfterComplete, setControlAfterComplete] = useState(false);
  const [allowChangeDeadline, setAllowChangeDeadline] = useState(false);
  const [requireReason, setRequireReason] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showValidation, setShowValidation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile?.ID && !creatorId) {
      setCreatorId(String(profile.ID));
    }
  }, [profile, creatorId]);

  const toggleAccomplice = (id: string) => setAccompliceIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const toggleAuditor = (id: string) => setAuditorIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const handleSubmit = async () => {
    const hasErrors = !title.trim() || !responsibleId || !creatorId || !deadline;
    if (hasErrors) { setShowValidation(true); return; }
    setShowValidation(false); setSubmitting(true); setError("");
    try {
      const normalizedProjectId = typeof projectId === "string" && projectId.trim() ? projectId.trim() : null;
      const normalizedResponsibleId = validProfileIds.has(responsibleId) ? responsibleId : undefined;
      const sessionCreatorId = [profile?.id, profile?.ID, creatorId].find((value) => value && validProfileIds.has(String(value)));
      const normalizedAccomplices = accompliceIds.filter((id) => validProfileIds.has(id));
      const normalizedAuditors = auditorIds.filter((id) => validProfileIds.has(id));

      const result = await createTask({
        title: title.trim(), description: description.trim() || undefined, groupId: normalizedProjectId ?? "",
        responsibleId: normalizedResponsibleId, creatorId: sessionCreatorId || undefined,
        deadline: deadline ? format(deadline, "yyyy-MM-dd'T'HH:mm:ss") : undefined,
        accomplices: normalizedAccomplices, auditors: normalizedAuditors
      });
      // Save checklist items to DB
      const allItems = checklists.flatMap((cl) => cl.items.map((item) => ({ title: item.title })));
      if (allItems.length > 0 && result.task.id) {
        try {
          await addChecklistItemsBatch(result.task.id, allItems);
        } catch (e) {
          console.error("Failed to save checklist items:", e);
        }
      }
      // Upload attached files to storage
      if (attachedFiles.length > 0 && result.task.id) {
        try {
          await uploadTaskFilesBatch(result.task.id, attachedFiles.map(f => f.file));
        } catch (e) {
          console.error("Failed to upload files:", e);
        }
      }
      onCreated();
    } catch { setError("Не удалось создать задачу"); } finally { setSubmitting(false); }
  };

  return (
    <div className="flex flex-col h-full -m-4">
      <div className="px-5 py-3.5 border-b border-border bg-muted/30 flex items-center gap-3 rounded-t-2xl shrink-0">
        <button onClick={onBack} className="w-7 h-7 rounded-full bg-foreground/[0.04] flex items-center justify-center hover:bg-foreground/[0.08] transition-colors"><ArrowLeft className="w-3.5 h-3.5 text-muted-foreground" /></button>
        <div className="min-w-0">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Новая задача..."
            className={`text-base font-semibold placeholder:text-foreground/30 bg-transparent border-none outline-none w-full transition-colors ${showValidation && !title.trim() ? "text-destructive placeholder:text-destructive/50" : "text-foreground"}`} />
          <p className="text-xs text-muted-foreground truncate mt-0.5">{sectionName}{sectionName && projectName ? " / " : ""}{projectName}</p>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-5 py-5 space-y-4">
        <RichTextEditor value={description} onChange={setDescription} placeholder="Описание" />

        <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.03] px-3">
          <AccordionRolePicker label="Исполнитель" icon={User} selectedIds={responsibleId ? [responsibleId] : []} onConfirm={(ids) => setResponsibleId(ids[0] || "")} error={showValidation && !responsibleId} profiles={allProfiles} />
          <AccordionRolePicker label="Помощники" icon={Users} selectedIds={accompliceIds} onConfirm={setAccompliceIds} multiple profiles={allProfiles} />
          <AccordionRolePicker label="Постановщик" icon={UserCheck} selectedIds={creatorId ? [creatorId] : []} onConfirm={(ids) => setCreatorId(ids[0] || "")} error={showValidation && !creatorId} profiles={allProfiles} />
          <AccordionRolePicker label="Наблюдатели" icon={Eye} selectedIds={auditorIds} onConfirm={setAuditorIds} multiple profiles={allProfiles} />

          <div className="flex items-center gap-3 py-2">
            <div className="flex items-center gap-1.5 w-28 shrink-0">
              
              <span className={`text-xs font-medium ${showValidation && !deadline ? "text-destructive" : "text-foreground/50"} transition-colors`}>Крайний срок</span>
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-1.5">
              <Popover>
                <PopoverTrigger asChild>
                  <div className="flex items-center gap-2 flex-1 px-2.5 py-1.5 cursor-pointer text-left min-h-[32px]">
                    {deadline ? (
                      <div className="group/deadline flex items-center gap-2 flex-1 min-w-0 hover:text-blue1 transition-colors">
                        <Calendar className="w-3.5 h-3.5 shrink-0 text-muted-foreground group-hover/deadline:text-blue1 transition-colors" />
                        <span className="text-xs text-foreground/70 group-hover/deadline:text-blue1 transition-colors">{format(deadline, "d MMMM yyyy", { locale: ru })} {deadlineHour}:{deadlineMinute}</span>
                        <button onClick={(e) => {e.stopPropagation();setDeadline(undefined);}} className="ml-auto shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-foreground/[0.08]"><X className="w-3 h-3 text-foreground/30" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1 min-w-0 group/pick">
                        <Calendar className="w-4 h-4 text-foreground/30 group-hover/pick:text-ring transition-colors" />
                        <span className="text-xs text-foreground/30 group-hover/pick:text-ring transition-colors">Установить</span>
                      </div>
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarPicker mode="single" selected={deadline} onSelect={setDeadline} initialFocus className={cn("p-3 pointer-events-auto")} />
                  <div className="flex items-center gap-2 px-3 pb-3 border-t border-border pt-2">
                    <span className="text-xs text-muted-foreground">Время:</span>
                    <select value={deadlineHour} onChange={(e) => setDeadlineHour(e.target.value)} className="h-7 rounded-md border border-border bg-background px-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring">
                      {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className="text-xs text-muted-foreground">:</span>
                    <select value={deadlineMinute} onChange={(e) => setDeadlineMinute(e.target.value)} className="h-7 rounded-md border border-border bg-background px-1.5 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring">
                      {["00", "15", "30", "45"].map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </PopoverContent>
              </Popover>
              <div className="relative shrink-0">
                <button onClick={() => setShowSettings((v) => !v)} className={`w-6 h-6 flex items-center justify-center rounded-md transition-colors ${showSettings ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]"}`} title="Настройки задачи">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-foreground/40" />
                </button>
                {showSettings && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
                    <div className="absolute right-0 top-full mt-1 z-50 w-72 rounded-xl border border-border bg-card shadow-lg p-3 space-y-3 animate-in fade-in-0 zoom-in-95 duration-150">
                      <div className="flex items-center gap-2.5"><Switch checked={controlAfterComplete} onCheckedChange={setControlAfterComplete} /><span className="text-xs text-foreground/60">Проконтролировать задачу после завершения</span></div>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2.5"><Switch checked={allowChangeDeadline} onCheckedChange={setAllowChangeDeadline} /><span className="text-xs text-foreground/60">Разрешить исполнителю менять крайний срок</span></div>
                        {allowChangeDeadline && (
                          <div className="flex items-center gap-2.5 pl-10 animate-in slide-in-from-top-1 duration-150"><Switch checked={requireReason} onCheckedChange={setRequireReason} /><span className="text-xs text-foreground/40">Запрашивать причину</span></div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.03] px-3 py-2">
          <button onClick={() => fileInputRef.current?.click()} className="group/file flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md transition-colors">
            <Paperclip className="w-4 h-4 text-foreground/30 group-hover/file:text-ring transition-colors" />
            <span className="text-xs text-foreground/30 group-hover/file:text-ring transition-colors">Добавить файлы</span>
          </button>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { const files = e.target.files ? Array.from(e.target.files) : []; if (files.length > 0) { setAttachedFiles((prev) => [...prev, ...files.map(f => ({ file: f, comment: "" }))]); } e.target.value = ""; }} />
          {attachedFiles.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {attachedFiles.map((item, i) => {
                const ext = item.file.name.split(".").pop()?.toLowerCase() || "";
                const IconComp = ["jpg","jpeg","png","gif","webp","svg","bmp","ico"].includes(ext) ? FileImage : ["pdf","doc","docx","txt","rtf","odt"].includes(ext) ? FileText : ["xls","xlsx","csv"].includes(ext) ? FileSpreadsheet : ["zip","rar","7z","tar","gz"].includes(ext) ? FileArchive : ["mp4","avi","mov","mkv","webm"].includes(ext) ? FileVideo : ["mp3","wav","ogg","flac","aac"].includes(ext) ? FileAudio : File;
                const colorClass = ["jpg","jpeg","png","gif","webp","svg","bmp","ico"].includes(ext) ? "text-green-500" : ["pdf"].includes(ext) ? "text-red-500" : ["doc","docx","txt","rtf","odt"].includes(ext) ? "text-blue-500" : ["xls","xlsx","csv"].includes(ext) ? "text-emerald-600" : ["zip","rar","7z","tar","gz"].includes(ext) ? "text-amber-500" : ["mp4","avi","mov","mkv","webm"].includes(ext) ? "text-purple-500" : ["mp3","wav","ogg","flac","aac"].includes(ext) ? "text-pink-500" : "text-foreground/40";
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
            </div>
          )}
        </div>

        <div className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.03] px-3 py-2">
          <button onClick={() => { const newId = crypto.randomUUID(); setChecklists((prev) => [...prev, { id: newId, title: "Чек-лист", items: [] }]); setActiveChecklistId(newId); }}
            className="group/cl flex items-center gap-2 w-full px-2.5 py-1.5 rounded-md transition-colors">
            <ListChecks className="w-4 h-4 text-foreground/30 group-hover/cl:text-ring transition-colors" />
            <span className="text-xs text-foreground/30 group-hover/cl:text-ring transition-colors">Добавить чек-лист</span>
          </button>
        </div>

        {checklists.map((cl, clIndex) => (
          <div key={cl.id} className="rounded-xl border border-foreground/[0.06] bg-foreground/[0.03] px-3 py-2">
            <div className="flex items-center gap-1.5 mb-1">
              <ListChecks className="w-3.5 h-3.5 text-muted-foreground" />
              {activeChecklistId === cl.id ? (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <span className="text-xs text-foreground/50 font-medium shrink-0">{toRoman(clIndex + 1)}.</span>
                  <input type="text" value={cl.title} onChange={(e) => setChecklists((prev) => prev.map((c) => c.id === cl.id ? { ...c, title: e.target.value } : c))} placeholder="Название чек-листа..." className="text-xs text-foreground/50 font-medium flex-1 bg-transparent border-none outline-none placeholder:text-foreground/30" autoFocus />
                </div>
              ) : <span className="text-xs text-foreground/50 font-medium flex-1">{toRoman(clIndex + 1)}. {cl.title}</span>}
              {activeChecklistId === cl.id && <button onClick={() => setActiveChecklistId(null)} className="w-4 h-4 rounded-full bg-ring text-white flex items-center justify-center hover:opacity-80 transition-colors shrink-0" title="Сохранить"><Check className="w-2.5 h-2.5" /></button>}
              <ChecklistMenu
                onEdit={() => setActiveChecklistId(cl.id)}
                onCopy={() => { const copy = { ...cl, id: crypto.randomUUID(), title: cl.title + " (копия)", items: cl.items.map((item) => ({ ...item, id: crypto.randomUUID() })) }; setChecklists((prev) => [...prev, copy]); }}
                onDelete={() => { setChecklists((prev) => prev.filter((c) => c.id !== cl.id)); if (activeChecklistId === cl.id) setActiveChecklistId(null); }}
                onNewChecklist={() => { const newId = crypto.randomUUID(); setChecklists((prev) => [...prev, { id: newId, title: "Чек-лист", items: [] }]); setActiveChecklistId(newId); }} />
            </div>
            {cl.items.length > 0 && (
              <div className="space-y-1 mb-2">
                {cl.items.map((item, itemIndex) => (
                  <div key={item.id} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-foreground/[0.03] group">
                    <span className="text-[10px] text-foreground/30 shrink-0 w-4 text-right tabular-nums">{itemIndex + 1}.</span>
                    <span className="text-xs text-foreground/70 truncate flex-1">{item.title}</span>
                    <button onClick={() => setChecklists((prev) => prev.map((c) => c.id === cl.id ? { ...c, items: c.items.filter((ci) => ci.id !== item.id) } : c))}
                      className="shrink-0 w-4 h-4 flex items-center justify-center rounded-full hover:bg-foreground/[0.08] opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="w-3 h-3 text-foreground/30" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input type="text" value={activeChecklistId === cl.id ? newCheckItem : ""} onFocus={() => setActiveChecklistId(cl.id)}
                onChange={(e) => {setActiveChecklistId(cl.id);setNewCheckItem(e.target.value);}}
                onKeyDown={(e) => { if (e.key === "Enter" && newCheckItem.trim()) { setChecklists((prev) => prev.map((c) => c.id === cl.id ? { ...c, items: [...c.items, { id: crypto.randomUUID(), title: newCheckItem.trim() }] } : c)); setNewCheckItem(""); } }}
                placeholder="Название пункта..." className="flex-1 text-xs text-foreground/70 placeholder:text-foreground/30 bg-transparent border-none outline-none px-2.5 py-1.5 min-h-[32px]" />
              <button onClick={() => { if (newCheckItem.trim() && activeChecklistId === cl.id) { setChecklists((prev) => prev.map((c) => c.id === cl.id ? { ...c, items: [...c.items, { id: crypto.randomUUID(), title: newCheckItem.trim() }] } : c)); setNewCheckItem(""); } }}
                className="shrink-0 w-6 h-6 flex items-center justify-center rounded-md hover:bg-foreground/[0.04] transition-colors"><Plus className="w-3.5 h-3.5 text-foreground/30" /></button>
            </div>
          </div>
        ))}

        <div>
          {error && <p className="text-xs text-destructive mb-2">{error}</p>}
          <div className="flex items-center gap-2">
            <button onClick={onBack} className="px-4 py-2 rounded-xl bg-foreground/[0.04] text-foreground/50 hover:bg-foreground/[0.08] transition-colors" style={{ fontSize: 13, fontWeight: 500 }}>Отмена</button>
            <button onClick={handleSubmit} disabled={submitting} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-ring text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-40" style={{ fontSize: 13, fontWeight: 500 }}>
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {submitting ? "Создание..." : "Создать задачу"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateTaskForm;
