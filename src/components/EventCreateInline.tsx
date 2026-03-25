import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { X, Paperclip, Check, XCircle, Clock, HelpCircle, User, ChevronUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useSupabaseProfile } from "@/hooks/useSupabaseProfile";
import { useAllProfiles } from "@/hooks/useAllProfiles";
import AttendeeAccordionPicker, { type AttendeeProfile } from "@/components/AttendeeAccordionPicker";
import { uploadCalendarFile, type CalendarEventInsert, type CalendarEventAttendee } from "@/lib/supabase-calendar";
import { useCreateCalendarEvent, useUpdateCalendarEvent } from "@/hooks/useCalendarEvents";
import { toast } from "sonner";

const EVENT_COLORS = [
  { value: "#007AFF", label: "Синий" }, { value: "#34C759", label: "Зелёный" },
  { value: "#FF9500", label: "Оранжевый" }, { value: "#AF52DE", label: "Фиолетовый" },
  { value: "#FF3B30", label: "Красный" }, { value: "#5AC8FA", label: "Голубой" },
  { value: "#FF2D55", label: "Розовый" },
];
const RECURRENCE_OPTIONS = [
  { value: "none", label: "Не повторяется" }, { value: "DAILY", label: "Ежедневно" },
  { value: "WEEKLY", label: "Еженедельно" }, { value: "MONTHLY", label: "Ежемесячно" },
  { value: "YEARLY", label: "Ежегодно" },
];

interface EditEventData {
  id: string; title: string; description?: string; date: Date; time?: string; timeTo?: string;
  color?: string; meetingType?: string; attendees?: Array<{ id: string; name: string }>;
  files?: string[];
}

interface EventCreateInlineProps {
  selectedDate: Date;
  onClose: () => void;
  onEventCreated?: () => void;
  editEvent?: EditEventData | null;
  department: string;
}

const EventCreateInline = ({ selectedDate, onClose, onEventCreated, editEvent, department }: EventCreateInlineProps) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(selectedDate, "yyyy-MM-dd"));
  const [timeFrom, setTimeFrom] = useState("09:00");
  const [timeTo, setTimeTo] = useState("10:00");
  const [color, setColor] = useState("#007AFF");
  const [recurrence, setRecurrence] = useState("none");
  const [calendarType, setCalendarType] = useState("project");
  const [meetingType, setMeetingType] = useState("bitrix24_video");
  const [attendees, setAttendees] = useState<CalendarEventAttendee[]>([]);
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [existingFileUrls, setExistingFileUrls] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const { data: allProfiles = [] } = useAllProfiles();
  const { data: profile } = useSupabaseProfile();
  const createMutation = useCreateCalendarEvent(department);
  const updateMutation = useUpdateCalendarEvent(department);

  const selectedAttendeeIds = useMemo(() => new Set(attendees.map(a => a.id)), [attendees]);

  useEffect(() => {
    if (editEvent) {
      setTitle(editEvent.title); setDescription(editEvent.description || "");
      setDate(format(editEvent.date, "yyyy-MM-dd")); setTimeFrom(editEvent.time || "09:00");
      setTimeTo(editEvent.timeTo || "10:00"); setColor(editEvent.color || "#007AFF");
      setMeetingType(editEvent.meetingType || "bitrix24_video");
      setAttendees(editEvent.attendees?.map((a) => ({ ...a, status: "pending" as const })) || []);
      setExistingFileUrls(editEvent.files || []);
    } else {
      setDate(format(selectedDate, "yyyy-MM-dd"));
      resetForm();
    }
  }, [editEvent, selectedDate]);

  const handleToggleAttendee = (p: AttendeeProfile) => {
    if (selectedAttendeeIds.has(p.id)) {
      setAttendees(prev => prev.filter(a => a.id !== p.id));
    } else {
      setAttendees(prev => [...prev, { id: p.id, name: `${p.first_name} ${p.last_name}`, status: "pending" as const }]);
    }
  };
  const removeAttendee = (id: string) => setAttendees((prev) => prev.filter((a) => a.id !== id));
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) setNewFiles((prev) => [...prev, ...Array.from(e.target.files!)]); };
  const removeNewFile = (index: number) => setNewFiles((prev) => prev.filter((_, i) => i !== index));
  const removeExistingFile = (index: number) => setExistingFileUrls((prev) => prev.filter((_, i) => i !== index));

  const statusIcon = (status: CalendarEventAttendee["status"]) => {
    switch (status) {
      case "accepted": return <Check className="w-3.5 h-3.5 text-green-500" />;
      case "declined": return <XCircle className="w-3.5 h-3.5 text-red-500" />;
      default: return <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />;
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error("Введите название события"); return; }
    setIsSaving(true);
    try {
      // Upload new files
      const uploadedUrls: string[] = [];
      for (const file of newFiles) {
        const url = await uploadCalendarFile(file);
        uploadedUrls.push(url);
      }
      const allFileUrls = [...existingFileUrls, ...uploadedUrls];

      const eventData: CalendarEventInsert = {
        title,
        description,
        event_date: date,
        start_time: timeFrom,
        end_time: timeTo,
        color,
        recurrence,
        calendar_type: calendarType,
        meeting_type: meetingType,
        attendees: [...(profile?.id ? [{ id: profile.id, name: `${profile.first_name} ${profile.last_name}`, status: "accepted" as const }] : []), ...attendees],
        files: allFileUrls,
        has_files: allFileUrls.length > 0,
        organizer_id: profile?.id || "",
        department,
      };

      if (editEvent) {
        await updateMutation.mutateAsync({ id: editEvent.id, data: eventData });
        toast.success("Событие обновлено");
      } else {
        await createMutation.mutateAsync(eventData);
        toast.success("Событие создано");
      }
      resetForm();
      onClose();
      onEventCreated?.();
    } catch (err) {
      toast.error("Не удалось сохранить событие");
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  const resetForm = () => {
    setTitle(""); setDescription(""); setTimeFrom("09:00"); setTimeTo("10:00");
    setColor("#007AFF"); setRecurrence("none"); setAttendees([]); setNewFiles([]); setExistingFileUrls([]);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-blue1">
          {editEvent ? "Изменить событие" : "Новое событие"}
        </h3>
        <button onClick={onClose} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-blue1 transition-colors">
          <ChevronUp size={14} />Свернуть
        </button>
      </div>

      <div className="text-[10px] text-muted-foreground leading-snug space-y-0 border border-border rounded-lg px-2.5 py-1.5 mb-4">
        <p>{date ? format(new Date(date + "T00:00:00"), "d MMMM yyyy", { locale: ru }) : "—"} · {timeFrom} – {timeTo}</p>
        <p>Организатор: {profile ? `${profile.last_name} ${profile.first_name?.charAt(0)}.` : "—"}</p>
        {attendees.length > 0 && <p>Участники: {attendees.map((a) => a.name).join(", ")}</p>}
        <p>Календарь: {calendarType === "project" ? `Проект «${department}»` : "Личный календарь"}</p>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 px-1">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Название</Label>
          <Input placeholder="Название события" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Описание</Label>
          <Textarea placeholder="Описание события..." value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[60px] resize-none" />
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent transition-colors cursor-pointer">
              <Paperclip className="w-3.5 h-3.5" />Прикрепить файл
              <input type="file" multiple className="hidden" onChange={handleFileChange} />
            </label>
            {existingFileUrls.map((url, i) => (
              <Badge key={`existing-${i}`} variant="secondary" className="gap-1 pr-1 text-xs font-normal">
                Файл {i + 1}
                <button onClick={() => removeExistingFile(i)} className="ml-1"><X className="w-3 h-3" /></button>
              </Badge>
            ))}
            {newFiles.map((file, i) => (
              <Badge key={`new-${i}`} variant="secondary" className="gap-1 pr-1 text-xs font-normal">
                {file.name}
                <button onClick={() => removeNewFile(i)} className="ml-1"><X className="w-3 h-3" /></button>
              </Badge>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Дата</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Время начала</Label>
            <div className="relative">
              <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} className="h-9 pl-8" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Время окончания</Label>
            <div className="relative">
              <Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} className="h-9 pl-8" />
            </div>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Организатор</Label>
          <div className="flex items-center gap-2 px-3 h-9 rounded-md border border-input bg-muted/50 text-sm">
            {profile?.avatar_url ? <img src={profile.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" /> : <User className="w-4 h-4 text-muted-foreground" />}
            <span className="text-foreground">{profile ? `${profile.last_name} ${profile.first_name?.charAt(0)}.` : "Загрузка..."}</span>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Участники</Label>
          <div className="space-y-2">
            {attendees.map((attendee) => (
              <div key={attendee.id} className="flex items-center justify-between px-3 h-9 rounded-lg bg-accent/50">
                <div className="flex items-center gap-2">{statusIcon(attendee.status)}<span className="text-sm">{attendee.name}</span></div>
                <button onClick={() => removeAttendee(attendee.id)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
              </div>
            ))}
            <AttendeeAccordionPicker
              profiles={allProfiles}
              selectedIds={selectedAttendeeIds}
              onToggle={handleToggleAttendee}
              excludeId={profile?.id}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Способ связи</Label>
          <Select value={meetingType} onValueChange={setMeetingType}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bitrix24_video">Видео-конференция Битрикс24</SelectItem>
              <SelectItem value="zoom">Видео-конференция Zoom</SelectItem>
              <SelectItem value="in_person">Личная встреча</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Повторяемость</Label>
          <Select value={recurrence} onValueChange={setRecurrence}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              {RECURRENCE_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Календарь</Label>
          <Select value={calendarType} onValueChange={setCalendarType}>
            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="project">Проект «{department}»</SelectItem>
              <SelectItem value="personal">Личный календарь</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Цвет события</Label>
          <div className="flex items-center gap-2">
            {EVENT_COLORS.map((c) => (
              <button key={c.value} onClick={() => setColor(c.value)}
                className={cn("w-7 h-7 rounded-full transition-all", color === c.value ? "ring-2 ring-offset-2 ring-offset-background" : "hover:scale-110")}
                style={{ backgroundColor: c.value, ...(color === c.value ? { boxShadow: `0 0 0 2px white, 0 0 0 4px #007AFF` } : {}) }}
                title={c.label}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="pt-4 mt-4 border-t border-border flex items-center gap-2 justify-end">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={isSaving}>Отмена</Button>
        <Button size="sm" onClick={handleSubmit} disabled={isSaving} className="bg-blue1 hover:bg-blue1/90 text-white">
          {isSaving ? "Сохранение..." : editEvent ? "Сохранить" : "Создать событие"}
        </Button>
      </div>
    </div>
  );
};

export default EventCreateInline;
