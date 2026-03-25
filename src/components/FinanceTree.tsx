import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronRight, ChevronsUpDown, Banknote, Warehouse, BarChart3, FileText, Users, Scale, Loader2, AlertTriangle } from "lucide-react";
import { fetchGroupTasks } from "@/lib/supabase-tasks";
import type { Bitrix24Task } from "@/lib/bitrix24";

interface ProcessItem {id: number;name: string;}
interface Section {key: string;roman: string;title: string;abbr?: string;icon: React.ReactNode;color: string;items: ProcessItem[];}

const sections: Section[] = [
{ key: "ops", roman: "I", title: "Операционные финансы", abbr: "OF", icon: <Banknote className="w-4 h-4" />, color: "#3b82f6", items: [{ id: 46, name: "Исходящие платежи" }, { id: 52, name: "Входящие платежи" }] },
{ key: "tax", roman: "II", title: "Налоговая отчетность ", abbr: "NO", icon: <FileText className="w-4 h-4" />, color: "#3b82f6", items: [{ id: 44, name: "Налоги и отчеты в ФНС" }, { id: 54, name: "Запросы гос.органов" }] },
{ key: "hr", roman: "III", title: "Расчеты с персоналом", abbr: "RP", icon: <Users className="w-4 h-4" />, color: "#3b82f6", items: [{ id: 50, name: "Начисление ЗП" }, { id: 56, name: "Кадровые движения" }, { id: 58, name: "Командировочные" }] },
{ key: "mgmt", roman: "IV", title: "Управленческий учёт ", abbr: "UU", icon: <BarChart3 className="w-4 h-4" />, color: "#3b82f6", items: [{ id: 48, name: "Фин. планирование " }, { id: 66, name: "Управ. отчеты" }] },
{ key: "warehouse", roman: "V", title: "Склад и ТМЦ", abbr: "ST", icon: <Warehouse className="w-4 h-4" />, color: "#3b82f6", items: [{ id: 60, name: "Оприходование" }, { id: 62, name: "Инвентаризация" }, { id: 64, name: "Списание / Брак" }] },
{ key: "legal", roman: "VI", title: "Документы", abbr: "D", icon: <Scale className="w-4 h-4" />, color: "#3b82f6", items: [{ id: 68, name: "Акты-сверки" }, { id: 70, name: "Поставщики и ВЭД" }, { id: 72, name: "Розничные продажи: Сверка эквайринга, ККД" }, { id: 74, name: "Розничные продажи: Обработка возвратов" }, { id: 76, name: "Тендеры, гос. и корп. закупки" }] }];


interface ItemTaskStats {total: number;done: number;newTasks: number;inProgress: number;consultation: number;approval: number;overdue: boolean;}

function SectionBranch({ section, defaultExpanded = true, totalTasks, doneTasks, loading, itemStats, onSelectItem, selectedProjectId


}: {section: Section;defaultExpanded?: boolean;totalTasks: number;doneTasks: number;loading?: boolean;itemStats: Record<number, ItemTaskStats>;onSelectItem?: (item: ProcessItem | null, sectionTitle: string) => void;selectedProjectId?: number | null;}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className="relative">
      <div className="relative flex items-center gap-2 group">
        <div className="relative z-10 flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center" style={{ backgroundColor: `${section.color}15`, color: section.color }}>{section.icon}</div>
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1.5 min-w-0 text-left hover:opacity-80 transition-opacity cursor-pointer">
          <span className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${section.color}12`, color: section.color }}>{section.roman}</span>
          <span className={`truncate text-xs font-medium transition-colors group-hover:text-ring ${expanded ? "text-ring" : "text-muted-foreground"}`}>{section.title}</span>
          {section.abbr && <span className="flex-shrink-0 text-[10px] px-1 py-0.5 rounded" style={{ backgroundColor: `${section.color}10`, color: section.color }}>{section.abbr}</span>}
          {section.items.length > 0 && <span className="flex-shrink-0 text-muted-foreground">{expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}</span>}
        </button>
        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          {loading ? <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" /> : <>
            <span className="text-[10px] text-muted-foreground tabular-nums">{doneTasks}/{totalTasks}</span>
            <div className="w-12 h-1.5 rounded-full bg-[hsl(0_0%_85%)] dark:bg-muted overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{ width: `${totalTasks > 0 ? doneTasks / totalTasks * 100 : 0}%`, backgroundColor: '#007bff', opacity: 0.7 }} />
            </div>
          </>}
        </div>
      </div>
      {expanded && section.items.length > 0 &&
      <div className="ml-3 mt-1 mb-1 pl-5 border-l border-dashed" style={{ borderColor: `${section.color}30` }}>
          {section.items.map((item) => {
          const stats = itemStats?.[item.id];
          return (
            <div key={item.id} className="relative flex items-center gap-2 py-[3px] group/item">
                <div className="absolute -left-5 top-1/2 w-4 h-px" style={{ backgroundColor: `${section.color}30` }} />
                <div className="relative z-10 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: `${section.color}50` }} />
                <span className={`text-xs flex-shrink-0 tabular-nums w-5 text-right ${selectedProjectId === item.id ? "text-blue-500" : "text-muted-foreground"}`}>{stats?.total ?? 0}</span>
                <span className={`text-xs transition-colors truncate cursor-pointer hover:underline ${selectedProjectId === item.id ? "text-blue-500 underline decoration-blue-500" : "text-foreground/80 group-hover/item:text-foreground"}`}
              onClick={() => {if (selectedProjectId === item.id) {onSelectItem?.(null, "");} else {onSelectItem?.(item, section.title);}}}>{item.name}</span>
                {stats && !loading &&
              <>
                    
                    <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                      {stats.newTasks > 0 && <span className="text-[11px] tabular-nums px-1 py-0.5 rounded bg-teal-500/15 text-teal-500" title="Новые задачи">{stats.newTasks}</span>}
                      {stats.inProgress > 0 && <span className="text-[11px] tabular-nums px-1 py-0.5 rounded bg-blue-500/15 text-blue-500" title="Задачи в работе">{stats.inProgress}</span>}
                      {stats.consultation > 0 && <span className="text-[11px] tabular-nums px-1 py-0.5 rounded bg-red-500/15 text-red-500" title="Нужна помощь">{stats.consultation}</span>}
                      {stats.approval > 0 && <span className="text-[11px] tabular-nums px-1 py-0.5 rounded bg-amber-500/15 text-amber-500" title="На согласовании результата">{stats.approval}</span>}
                      {stats.overdue && <span title="Есть просроченные задачи"><AlertTriangle className="w-3 h-3 text-red-500" /></span>}
                    </div>
                  </>
              }
              </div>);

        })}
        </div>
      }
    </div>);

}

interface SectionTaskStats {total: number;done: number;}

const FinanceTree = ({ onSelectProject, selectedProjectId }: {onSelectProject?: (project: {id: number;name: string;sectionTitle: string;} | null) => void;selectedProjectId?: number | null;}) => {
  const [allExpanded, setAllExpanded] = useState(false);
  const [smartExpand, setSmartExpand] = useState(false);
  const [toggleKey, setToggleKey] = useState(0);
  const [taskStats, setTaskStats] = useState<Record<string, SectionTaskStats>>({});
  const [itemTaskStats, setItemTaskStats] = useState<Record<number, ItemTaskStats>>({});
  const [loading, setLoading] = useState(true);

  const allGroupIds = useMemo(() => {
    const ids: {sectionKey: string;groupId: number;}[] = [];
    sections.forEach((s) => s.items.forEach((item) => ids.push({ sectionKey: s.key, groupId: item.id })));
    return ids;
  }, []);

  useEffect(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const fetchAll = async () => {
      setLoading(true);
      const results: Record<string, SectionTaskStats> = {};
      sections.forEach((s) => {results[s.key] = { total: 0, done: 0 };});
      const perItem: Record<number, ItemTaskStats> = {};
      const now2 = new Date();
      await Promise.all(allGroupIds.map(async ({ sectionKey, groupId }) => {
        try {
          const tasks = await fetchGroupTasks(groupId);
          const monthTasks = tasks.filter((t: Bitrix24Task) => {const created = t.createdDate ? new Date(t.createdDate) : null;return created && created >= monthStart && created <= monthEnd;});
          results[sectionKey].total += monthTasks.length;
          results[sectionKey].done += monthTasks.filter((t: Bitrix24Task) => t.status === "5").length;
          perItem[groupId] = { total: monthTasks.length, done: monthTasks.filter((t) => t.status === "5").length, newTasks: monthTasks.filter((t) => t.status === "1").length, inProgress: monthTasks.filter((t) => t.status === "3").length, consultation: monthTasks.filter((t) => t.status === "2").length, approval: monthTasks.filter((t) => t.status === "4").length, overdue: monthTasks.some((t) => t.status !== "5" && t.deadline && new Date(t.deadline) < now2) };
        } catch {perItem[groupId] = { total: 0, done: 0, newTasks: 0, inProgress: 0, consultation: 0, approval: 0, overdue: false };}
      }));
      setTaskStats(results);setItemTaskStats(perItem);setLoading(false);
    };
    fetchAll();
  }, [allGroupIds]);

  return (
    <div className="w-full bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#007bff]" /><h2 className="text-sm font-semibold text-foreground">Структура процессов</h2></div>
          <div className="flex items-center gap-2">
            <span className={`text-xs cursor-pointer transition-colors ${smartExpand ? "text-blue-500" : "text-muted-foreground hover:text-foreground"}`} onClick={() => {setSmartExpand(!smartExpand);setToggleKey((k) => k + 1);}}>{loading ? "..." : `${Object.values(itemTaskStats).reduce((sum, s) => sum + (s.total - s.done), 0)} задач`}</span>
            <button onClick={() => {setAllExpanded(!allExpanded);setToggleKey((k) => k + 1);}} className="text-muted-foreground hover:text-foreground transition-colors" title={allExpanded ? "Свернуть все" : "Развернуть все"}><ChevronsUpDown className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
      <div className="px-2.5 py-3 space-y-2.5">
        {sections.map((section) =>
        <SectionBranch key={`${section.key}-${toggleKey}`} section={section}
        defaultExpanded={allExpanded || smartExpand && section.items.some((item) => {const s = itemTaskStats[item.id];return s && s.total - s.done > 0;})}
        totalTasks={taskStats[section.key]?.total ?? 0} doneTasks={taskStats[section.key]?.done ?? 0} loading={loading} itemStats={itemTaskStats} selectedProjectId={selectedProjectId}
        onSelectItem={(item, sectionTitle) => {if (!item) {onSelectProject?.(null);} else {onSelectProject?.({ id: item.id, name: item.name, sectionTitle });}}} />
        )}
      </div>
    </div>);

};

export default FinanceTree;