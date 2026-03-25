import { useState, useMemo } from "react";
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays,
  isSameMonth, isSameDay, addMonths, subMonths, isBefore, startOfDay,
} from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus, Clock, Paperclip, Video, MapPin, Pencil, FolderOpen, CalendarDays, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import EventCreateInline from "@/components/EventCreateInline";
import { useCalendarEvents, useDeleteCalendarEvent } from "@/hooks/useCalendarEvents";
import type { CalendarEventRow } from "@/lib/supabase-calendar";
import { toast } from "sonner";

export interface CalendarEvent {
  id: string; title: string; date: Date; time?: string; timeTo?: string;
  color?: string; description?: string; hasFiles?: boolean;
  meetingType?: string; attendees?: { id: string; name: string; photo?: string }[];
  organizer?: { id: string; name: string; photo?: string };
  files?: string[];
}

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function rowToEvent(row: CalendarEventRow): CalendarEvent {
  const organizer = row.attendees?.find(a => a.id === row.organizer_id);
  return {
    id: row.id,
    title: row.title,
    date: new Date(row.event_date + "T00:00:00"),
    time: row.start_time,
    timeTo: row.end_time,
    color: row.color,
    description: row.description,
    hasFiles: row.has_files,
    meetingType: row.meeting_type,
    files: row.files,
    attendees: row.attendees?.filter(a => a.id !== row.organizer_id).map(a => ({ id: a.id, name: a.name })),
    organizer: organizer ? { id: organizer.id, name: organizer.name } : undefined,
  };
}

interface EventCalendarProps {
  department: string;
}

const EventCalendar = ({ department }: EventCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showAllMonth, setShowAllMonth] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editEvent, setEditEvent] = useState<CalendarEvent | null>(null);

  const { data: rows = [], isLoading, error } = useCalendarEvents(department);
  const deleteMutation = useDeleteCalendarEvent(department);

  const events = useMemo(() => rows.map(rowToEvent), [rows]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days: Date[] = []; let day = start;
    while (day <= end) { days.push(day); day = addDays(day, 1); }
    return days;
  }, [currentMonth]);

  const eventsForDate = (date: Date) => events.filter((e) => isSameDay(e.date, date));
  const eventsForMonth = useMemo(
    () => events.filter((e) => isSameMonth(e.date, currentMonth)).sort((a, b) => a.date.getTime() - b.date.getTime()),
    [events, currentMonth]
  );
  const selectedEvents = showAllMonth ? eventsForMonth : eventsForDate(selectedDate);

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Событие удалено");
    } catch {
      toast.error("Не удалось удалить событие");
    }
  };

  return (
    <div className="flex gap-6 w-full">
      <div className="w-[620px] shrink-0 border border-border rounded-2xl p-4 bg-card self-start">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border -mx-4 px-4">
          <div className="w-2 h-2 rounded-full bg-[#007AFF]" />
          <h2 className="text-lg font-semibold capitalize text-foreground">
            {format(currentMonth, "LLLL yyyy", { locale: ru })}
          </h2>
          <div className="flex items-center gap-1">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-accent transition-colors text-muted-foreground"><ChevronLeft className="w-4 h-4" /></button>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-accent transition-colors text-muted-foreground"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 mb-1">
          {WEEKDAYS.map((day) => (<div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">{day}</div>))}
        </div>
        <div className="grid grid-cols-7">
          {calendarDays.map((day, i) => {
            const dayEvents = eventsForDate(day);
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isPast = isBefore(startOfDay(day), startOfDay(new Date())) && !isToday;
            return (
              <button key={i} onClick={() => { setSelectedDate(day); setShowAllMonth(false); }}
                className={cn("relative flex flex-col items-center py-2 h-16 rounded-xl transition-all text-sm",
                  !isCurrentMonth && "opacity-30", isPast && isCurrentMonth && "opacity-40",
                  isSelected && "bg-foreground/5 ring-1 ring-foreground/10", !isSelected && "hover:bg-accent")}>
                <span className={cn("w-7 h-7 flex items-center justify-center rounded-full text-sm font-medium",
                  isToday && "text-primary-foreground", !isToday && isSelected && "font-bold text-foreground",
                  !isToday && !isSelected && "text-foreground")}
                  style={isToday ? { backgroundColor: "#007AFF", color: "white" } : undefined}>
                  {format(day, "d")}
                </span>
                {dayEvents.length > 0 && (
                  <div className="flex gap-0.5 mt-1">
                    {dayEvents.slice(0, 3).map((e) => (<div key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.color || "#007AFF" }} />))}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex-1 min-w-0 border border-border rounded-2xl p-4 bg-card flex flex-col">
        {showCreateForm ? (
          <EventCreateInline
            selectedDate={selectedDate}
            onClose={() => { setShowCreateForm(false); setEditEvent(null); }}
            editEvent={editEvent ? {
              id: editEvent.id,
              title: editEvent.title,
              description: editEvent.description,
              date: editEvent.date,
              time: editEvent.time,
              timeTo: editEvent.timeTo,
              color: editEvent.color,
              meetingType: editEvent.meetingType,
              attendees: editEvent.attendees?.map(a => ({ id: a.id, name: a.name })),
              files: editEvent.files,
            } : null}
            department={department}
          />
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-blue1">
                {showAllMonth ? format(currentMonth, "LLLL yyyy", { locale: ru }) : format(selectedDate, "d MMMM, EEEE", { locale: ru })}
              </h3>
              <div className="flex items-center gap-1">
                <button onClick={() => setShowAllMonth(!showAllMonth)}
                  className={cn("px-2.5 h-7 rounded-lg text-xs font-medium transition-colors",
                    showAllMonth ? "text-primary-foreground" : "hover:bg-accent text-muted-foreground")}
                  style={showAllMonth ? { backgroundColor: "#007AFF", color: "white" } : undefined}>Все за месяц</button>
                <button onClick={() => { setEditEvent(null); setShowCreateForm(true); }} className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-accent transition-colors text-muted-foreground"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="space-y-2 flex-1 overflow-y-auto">
              {isLoading ? (
                <div className="flex items-center justify-center py-8"><div className="w-5 h-5 border-2 border-muted-foreground/30 border-t-primary rounded-full animate-spin" /><span className="ml-2 text-sm text-muted-foreground">Загрузка событий…</span></div>
              ) : error ? (
                <p className="text-sm text-destructive py-8 text-center">Не удалось загрузить события</p>
              ) : selectedEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">Нет событий на этот день</p>
              ) : (
                selectedEvents.map((event) => (
                  <Popover key={event.id}>
                    <PopoverTrigger asChild>
                      <div className="flex items-center gap-3 px-2 py-1.5 rounded-xl bg-accent/50 hover:bg-accent transition-colors cursor-pointer">
                        <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: event.color || "#007AFF" }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-normal text-foreground truncate">{event.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {showAllMonth && <span className="text-xs text-muted-foreground">{format(event.date, "d MMM", { locale: ru })}</span>}
                            {event.time && (<div className="flex items-center gap-1"><Clock className="w-3 h-3 text-muted-foreground" /><span className="text-xs text-muted-foreground">{event.time}{event.timeTo ? ` – ${event.timeTo}` : ""}</span></div>)}
                            {event.hasFiles && <Paperclip className="w-3 h-3 text-muted-foreground" />}
                          </div>
                          {event.description && <p className="text-xs text-muted-foreground truncate mt-0.5 max-w-[200px]">{event.description}</p>}
                        </div>
                        {event.attendees && event.attendees.length > 0 && (
                          <div className="flex items-center -space-x-1.5 shrink-0">
                            {event.attendees.slice(0, 4).map((att) => (
                              <div key={att.id} className="w-6 h-6 rounded-full border-2 border-background overflow-hidden bg-muted" title={att.name}>
                                {att.photo ? <img src={att.photo} alt={att.name} className="w-full h-full object-cover" /> :
                                  <div className="w-full h-full flex items-center justify-center text-[9px] font-medium text-muted-foreground">{att.name.charAt(0)}</div>}
                              </div>
                            ))}
                            {event.attendees.length > 4 && <div className="w-6 h-6 rounded-full border-2 border-background bg-muted flex items-center justify-center text-[9px] font-medium text-muted-foreground">+{event.attendees.length - 4}</div>}
                          </div>
                        )}
                      </div>
                    </PopoverTrigger>
                    <PopoverContent side="left" align="start" className="w-72 p-0 rounded-xl">
                      <div className="p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="w-1 h-full min-h-[24px] rounded-full shrink-0 mt-0.5" style={{ backgroundColor: event.color || "#007AFF" }} />
                          <div>
                            <p className="text-sm font-semibold text-foreground">{event.title}</p>
                            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground"><CalendarDays className="w-3 h-3" /><span>{format(event.date, "d MMMM yyyy, EEEE", { locale: ru })}</span></div>
                            {event.time && (<div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground"><Clock className="w-3 h-3" /><span>{event.time}{event.timeTo ? ` – ${event.timeTo}` : ""}</span></div>)}
                          </div>
                        </div>
                        {event.description && <p className="text-xs text-muted-foreground">{event.description}</p>}
                        {event.hasFiles && event.files && event.files.length > 0 && (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Paperclip className="w-3 h-3" /><span>Прикреплённые файлы ({event.files.length})</span></div>
                            {event.files.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue1 hover:underline block truncate">Файл {i + 1}</a>
                            ))}
                          </div>
                        )}
                        {event.meetingType && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {event.meetingType === "in_person" ? <MapPin className="w-3 h-3" /> : <Video className="w-3 h-3" />}
                            <span>{event.meetingType === "bitrix24_video" && "Видео-конференция Битрикс24"}{event.meetingType === "zoom" && "Видео-конференция Zoom"}{event.meetingType === "in_person" && "Личная встреча"}</span>
                          </div>
                        )}
                        {event.organizer && (
                          <div className="flex items-center gap-2 pt-1 border-t border-border">
                            <span className="text-xs text-muted-foreground">Организатор:</span>
                            <div className="flex items-center gap-1.5">
                              {event.organizer.photo ? <img src={event.organizer.photo} alt={event.organizer.name} className="w-5 h-5 rounded-full object-cover" /> :
                                <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-medium text-muted-foreground">{event.organizer.name.charAt(0)}</div>}
                              <span className="text-xs font-medium text-foreground">{event.organizer.name}</span>
                            </div>
                          </div>
                        )}
                        {event.attendees && event.attendees.length > 0 && (
                          <div className="pt-1 border-t border-border">
                            <span className="text-xs text-muted-foreground">Участники ({event.attendees.length}):</span>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {event.attendees.map((att) => (
                                <div key={att.id} className="flex items-center gap-1 bg-accent/50 rounded-full px-2 py-0.5">
                                  {att.photo ? <img src={att.photo} alt={att.name} className="w-4 h-4 rounded-full object-cover" /> :
                                    <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[8px] font-medium text-muted-foreground">{att.name.charAt(0)}</div>}
                                  <span className="text-[11px] text-foreground">{att.name}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div className="flex items-center gap-1.5 pt-1 border-t border-border text-xs text-muted-foreground"><FolderOpen className="w-3 h-3" /><span>Проект «{department}»</span></div>
                        <div className="pt-2 border-t border-border flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1.5" onClick={() => { setEditEvent(event); setShowCreateForm(true); }}><Pencil className="w-3 h-3" />Изменить</Button>
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive" onClick={() => handleDelete(event.id)}><Trash2 className="w-3 h-3" />Удалить</Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default EventCalendar;
