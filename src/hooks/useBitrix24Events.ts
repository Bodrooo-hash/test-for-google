import { useQuery } from "@tanstack/react-query";
import { startOfMonth, endOfMonth, addMonths, subMonths } from "date-fns";
import { fetchCalendarEvents, mapBitrix24Events } from "@/lib/bitrix24";
import { fetchUsers } from "@/lib/supabase-tasks";
import type { CalendarEvent } from "@/components/EventCalendar";

export function useBitrix24Events(currentMonth: Date) {
  const from = subMonths(startOfMonth(currentMonth), 1);
  const to = addMonths(endOfMonth(currentMonth), 1);

  return useQuery<CalendarEvent[]>({
    queryKey: ["bitrix24-events", from.toISOString(), to.toISOString()],
    queryFn: async () => {
      const [raw, users] = await Promise.all([fetchCalendarEvents(from, to), fetchUsers()]);
      const usersMap = new Map(users.map((u) => [u.ID, u]));
      return mapBitrix24Events(raw, usersMap);
    },
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
