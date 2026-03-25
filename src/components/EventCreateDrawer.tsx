import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { X, Paperclip, Check, XCircle, Clock, HelpCircle, UserPlus, User } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useBitrix24Users } from "@/hooks/useBitrix24Users";
import { useBitrix24Profile } from "@/hooks/useBitrix24Profile";
import { createCalendarEvent, type CreateEventParams } from "@/lib/bitrix24";
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

interface Attendee { id: string; name: string; status: "pending" | "accepted" | "declined"; }
interface EditEventData { id: string; title: string; description?: string; date: Date; time?: string; timeTo?: string; color?: string; meetingType?: string; attendees?: Array<{ id: string; name: string }>; }
interface EventCreateDrawerProps { open: boolean; onOpenChange: (open: boolean) => void; selectedDate: Date; onEventCreated?: () => void; editEvent?: EditEventData | null; }

const EventCreateDrawer = ({ open, onOpenChange, selectedDate, onEventCreated, editEvent }: EventCreateDrawerProps) => {
  const [title, setTitle] = useState(""); const [description, setDescription] = useState("");
  const [date, setDate] = useState(format(selectedDate, "yyyy-MM-dd"));
  const [timeFrom, setTimeFrom] = useState("09:00"); const [timeTo, setTimeTo] = useState("10:00");
  const [color, setColor] = useState("#007AFF"); const [recurrence, setRecurrence] = useState("none");
  const [calendarType, setCalendarType] = useState("project"); const [meetingType, setMeetingType] = useState("bitrix24_video");
  const [attendees, setAttendees] = useState<Attendee[]>([]); const [files, setFiles] = useState<File[]>([]);
  const [searchUser, setSearchUser] = useState(""); const [showUserSearch, setShowUserSearch] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { data: allUsers = [] } = useBitrix24Users(); const { data: profile } = useBitrix24Profile();

  useEffect(() => {
    if (editEvent) {
      setTitle(editEvent.title); setDescription(editEvent.description || "");
      setDate(format(editEvent.date, "yyyy-MM-dd")); setTimeFrom(editEvent.time || "09:00");
      setTimeTo(editEvent.timeTo || "10:00"); setColor(editEvent.color || "#007AFF");
      setMeetingType(editEvent.meetingType || "bitrix24_video");
      setAttendees(editEvent.attendees?.map((a) => ({ ...a, status: "pending" as const })) || []);
    } else { setDate(format(selectedDate, "yyyy-MM-dd")); resetForm(); }
  }, [editEvent, selectedDate]);

  const filteredUsers = useMemo(() => {
    const excludeId = profile?.ID; let list = allUsers.filter((u) => u.ID !== excludeId);
    if (searchUser.trim()) { const q = searchUser.toLowerCase(); list = list.filter((u) => `${u.NAME} ${u.LAST_NAME}`.toLowerCase().includes(q) || u.EMAIL?.toLowerCase().includes(q)); }
    else { list = list.slice(0, 10); }
    return list;
  }, [allUsers, searchUser, profile]);

  const addAttendee = (user: { ID: string; NAME: string; LAST_NAME: string }) => {
    if (attendees.find((a) => a.id === user.ID)) return;
    setAttendees((prev) => [...prev, { id: user.ID, name: `${user.NAME} ${user.LAST_NAME}`, status: "pending" }]);
    setSearchUser(""); setShowUserSearch(false);
  };
  const removeAttendee = (id: string) => setAttendees((prev) => prev.filter((a) => a.id !== id));
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { if (e.target.files) setFiles((prev) => [...prev, ...Array.from(e.target.files!)]); };
  const removeFile = (index: number) => setFiles((prev) => prev.filter((_, i) => i !== index));
  const statusIcon = (status: Attendee["status"]) => {
    switch (status) { case "accepted": return <Check className="w-3.5 h-3.5 text-green-500" />; case "declined": return <XCircle className="w-3.5 h-3.5 text-red-500" />; default: return <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />; }
  };

  const handleSubmit = async () => {
    if (!title.trim()) { toast.error("Введите название события"); return; }
    setIsSaving(true);
    try {
      const params: CreateEventParams = { name: title, description, dateFrom: `${date} ${timeFrom}:00`, dateTo: `${date} ${timeTo}:00`, color,
        rrule: recurrence !== "none" ? recurrence : undefined, attendees: [...(profile?.ID ? [profile.ID] : []), ...attendees.map((a) => a.id)] };
      await createCalendarEvent(params); toast.success("Событие создано"); resetForm(); onOpenChange(false); onEventCreated?.();
    } catch (err) { toast.error("Не удалось создать событие"); console.error(err); } finally { setIsSaving(false); }
  };

  const resetForm = () => { setTitle(""); setDescription(""); setTimeFrom("09:00"); setTimeTo("10:00"); setColor("#007AFF"); setRecurrence("none"); setAttendees([]); setFiles([]); };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[50vw] sm:max-w-[50vw] overflow-y-auto p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b border-border">
          <div className="flex items-start justify-between gap-4">
            <SheetTitle className="text-lg font-semibold" style={{ color: "#007AFF" }}>{editEvent ? "Изменить событие" : "Новое событие"}</SheetTitle>
            <div className="text-[10px] text-muted-foreground leading-snug space-y-0 border border-border rounded-md px-2.5 py-1.5 text-right shrink-0 mr-4">
              <p>{date ? format(new Date(date + "T00:00:00"), "d MMMM yyyy", { locale: ru }) : "—"} · {timeFrom} – {timeTo}</p>
              <p>Организатор: {profile ? `${profile.LAST_NAME} ${profile.NAME?.charAt(0)}.` : "—"}</p>
              {attendees.length > 0 && <p>Участники: {attendees.map((a) => a.name).join(", ")}</p>}
              <p>Календарь: {calendarType === "project" ? "Проект «Финансовый отдел»" : "Личный календарь"}</p>
            </div>
          </div>
        </SheetHeader>
        <div className="px-6 py-5 space-y-5">
          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Название</Label><Input placeholder="Название события" value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" /></div>
          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Описание</Label><Textarea placeholder="Описание события..." value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[80px] resize-none" />
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent transition-colors cursor-pointer"><Paperclip className="w-3.5 h-3.5" />Прикрепить файл<input type="file" multiple className="hidden" onChange={handleFileChange} /></label>
              {files.map((file, i) => (<Badge key={i} variant="secondary" className="gap-1 pr-1 text-xs font-normal">{file.name}<button onClick={() => removeFile(i)} className="ml-1"><X className="w-3 h-3" /></button></Badge>))}
            </div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Дата</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Время начала</Label><div className="relative"><Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" /><Input type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} className="h-9 pl-8" /></div></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Время окончания</Label><div className="relative"><Clock className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" /><Input type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} className="h-9 pl-8" /></div></div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Организатор</Label>
            <div className="flex items-center gap-2 px-3 h-9 rounded-md border border-input bg-muted/50 text-sm">
              {profile?.PERSONAL_PHOTO ? <img src={profile.PERSONAL_PHOTO} alt="" className="w-5 h-5 rounded-full object-cover" /> : <User className="w-4 h-4 text-muted-foreground" />}
              <span className="text-foreground">{profile ? `${profile.LAST_NAME} ${profile.NAME?.charAt(0)}.` : "Загрузка..."}</span>
            </div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Участники</Label>
            <div className="space-y-2">
              {attendees.map((attendee) => (
                <div key={attendee.id} className="flex items-center justify-between px-3 h-9 rounded-lg bg-accent/50">
                  <div className="flex items-center gap-2">{statusIcon(attendee.status)}<span className="text-sm">{attendee.name}</span></div>
                  <button onClick={() => removeAttendee(attendee.id)} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>
                </div>
              ))}
              {showUserSearch ? (
                <div className="space-y-1">
                  <Input placeholder="Поиск по имени или email..." value={searchUser} onChange={(e) => setSearchUser(e.target.value)} className="h-9" autoFocus />
                  <div className="max-h-32 overflow-y-auto rounded-lg border border-border bg-background">
                    {filteredUsers.length === 0 ? <p className="text-xs text-muted-foreground p-2 text-center">Пользователи не найдены</p> :
                      filteredUsers.map((user) => (
                        <button key={user.ID} onClick={() => addAttendee(user)} className="flex items-center gap-2 w-full px-3 py-2 text-sm hover:bg-accent transition-colors text-left">
                          {user.PERSONAL_PHOTO ? <img src={user.PERSONAL_PHOTO} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" /> : <User className="w-4 h-4 text-muted-foreground shrink-0" />}
                          <span>{user.NAME} {user.LAST_NAME}</span>
                          {user.WORK_POSITION && <span className="text-xs text-muted-foreground">— {user.WORK_POSITION}</span>}
                        </button>
                      ))}
                  </div>
                </div>
              ) : <button onClick={() => setShowUserSearch(true)} className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-xs font-medium text-muted-foreground hover:bg-accent transition-colors"><UserPlus className="w-3.5 h-3.5" />Добавить участника</button>}
            </div>
          </div>
          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Способ связи</Label>
            <Select value={meetingType} onValueChange={setMeetingType}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bitrix24_video">Видео-конференция Битрикс24</SelectItem><SelectItem value="zoom">Видео-конференция Zoom</SelectItem><SelectItem value="in_person">Личная встреча</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Повторяемость</Label>
            <Select value={recurrence} onValueChange={setRecurrence}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent>{RECURRENCE_OPTIONS.map((opt) => (<SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>))}</SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Календарь</Label>
            <Select value={calendarType} onValueChange={setCalendarType}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="project">Проект «Финансовый отдел»</SelectItem><SelectItem value="personal">Личный календарь</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Цвет события</Label>
            <div className="flex items-center gap-2">
              {EVENT_COLORS.map((c) => (<button key={c.value} onClick={() => setColor(c.value)}
                className={cn("w-7 h-7 rounded-full transition-all", color === c.value ? "ring-2 ring-offset-2 ring-offset-background" : "hover:scale-110")}
                style={{ backgroundColor: c.value, ...(color === c.value ? { boxShadow: `0 0 0 2px white, 0 0 0 4px #007AFF` } : {}) }} title={c.label} />))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border flex items-center gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={isSaving}>Отмена</Button>
          <Button size="sm" onClick={handleSubmit} disabled={isSaving} style={{ backgroundColor: "#007AFF", color: "white" }} className="hover:opacity-90">{isSaving ? "Сохранение..." : editEvent ? "Сохранить" : "Создать событие"}</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default EventCreateDrawer;
