import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCalendarEvents,
  createCalendarEventInSupabase,
  updateCalendarEventInSupabase,
  deleteCalendarEvent,
  type CalendarEventRow,
  type CalendarEventInsert,
} from "@/lib/supabase-calendar";

export function useCalendarEvents(department: string) {
  return useQuery<CalendarEventRow[]>({
    queryKey: ["calendar-events", department],
    queryFn: () => fetchCalendarEvents(department),
    staleTime: 2 * 60 * 1000,
    retry: 1,
  });
}

export function useCreateCalendarEvent(department: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (event: CalendarEventInsert) => createCalendarEventInSupabase(event),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events", department] });
    },
  });
}

export function useUpdateCalendarEvent(department: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CalendarEventInsert> }) =>
      updateCalendarEventInSupabase(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events", department] });
    },
  });
}

export function useDeleteCalendarEvent(department: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteCalendarEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events", department] });
    },
  });
}
