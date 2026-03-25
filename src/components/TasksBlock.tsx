import { useState } from "react";
import { Clock, Loader2, AlertCircle, User } from "lucide-react";
import { useBitrix24Users } from "@/hooks/useBitrix24Users";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { fetchGroupTasks } from "@/lib/supabase-tasks";
import type { Bitrix24Task } from "@/lib/bitrix24";

interface TaskSection { number: string; title: string; items: TaskItem[]; }
interface TaskItem { number: string; title: string; id: number; }

const sections: TaskSection[] = [
  { number: "I", title: "Операционные финансы", items: [
    { number: "1.1", title: "Исходящие платежи", id: 46 },
    { number: "1.2", title: "Входящие платежи", id: 52 },
  ]},
  { number: "II", title: "Участок реализации и дистрибьюции", items: [
    { number: "2.1", title: "Маркетплейсы: Сверка взаиморасчетов", id: 68 },
    { number: "2.2", title: "B2B: Сверка с контрагентами", id: 70 },
    { number: "2.3", title: "Розничные продажи: Сверка эквайринга, контрольно-кассовая дисциплина", id: 72 },
    { number: "2.4", title: "Розничные продажи: Обработка возвратов", id: 74 },
    { number: "2.5", title: "Тендеры, гос. закупки и корпоративные закупки", id: 76 },
  ]},
  { number: "III", title: "Склад и товарно-материальные ценности", items: [
    { number: "3.1", title: "Оприходование товара", id: 60 },
    { number: "3.2", title: "Инвентаризация", id: 62 },
    { number: "3.3", title: "Списание/Брак", id: 64 },
  ]},
  { number: "IV", title: "Управленческий учет и фин. планирование", items: [
    { number: "4.1", title: "Фин. планирование и расчет unit-экономики", id: 48 },
    { number: "4.2", title: "Формирование управленческих отчетов", id: 66 },
  ]},
  { number: "V", title: "Налоговая отчетность и работа с гос.органами", items: [
    { number: "5.1", title: "Налоги и отчеты в ФНС", id: 44 },
    { number: "5.2", title: "Запросы гос.органов", id: 54 },
  ]},
  { number: "VI", title: "Кадровый учет и расчеты с персоналом", items: [
    { number: "6.1", title: "Расчет ЗП и премий", id: 56 },
    { number: "6.2", title: "Кадровые документы и отчетность", id: 58 },
  ]},
];

const statusLabels: Record<string, { label: string; color: string }> = {
  "1": { label: "Новая", color: "text-blue-500" },
  "2": { label: "Ожидает", color: "text-yellow-500" },
  "3": { label: "В работе", color: "text-orange-500" },
  "4": { label: "На проверке", color: "text-purple-500" },
  "5": { label: "Завершена", color: "text-green-500" },
  "6": { label: "Отложена", color: "text-muted-foreground" },
};

const TasksBlock = () => {
  const { data: users } = useBitrix24Users();
  const [activeFilter, setActiveFilter] = useState(0);
  const [tasksCache, setTasksCache] = useState<Record<number, Bitrix24Task[]>>({});
  const [loadingIds, setLoadingIds] = useState<Set<number>>(new Set());
  const [errorIds, setErrorIds] = useState<Set<number>>(new Set());

  const handleAccordionChange = async (value: string) => {
    if (!value) return;
    const itemId = parseInt(value);
    if (tasksCache[itemId] || loadingIds.has(itemId)) return;
    setLoadingIds((prev) => new Set(prev).add(itemId));
    setErrorIds((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
    try {
      const tasks = await fetchGroupTasks(itemId);
      setTasksCache((prev) => ({ ...prev, [itemId]: tasks }));
    } catch {
      setErrorIds((prev) => new Set(prev).add(itemId));
    } finally {
      setLoadingIds((prev) => { const next = new Set(prev); next.delete(itemId); return next; });
    }
  };

  return (
    <div>
      {/* Sections placeholder - TasksBlock content */}
    </div>
  );
};

export default TasksBlock;
