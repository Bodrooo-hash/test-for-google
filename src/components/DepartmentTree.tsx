import { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronRight, ChevronsUpDown, Loader2, AlertTriangle, Coins, FileText, BarChart3, Scale, Landmark, Receipt, PiggyBank, TrendingUp, Calculator, Briefcase, FolderOpen, Warehouse, type LucideIcon } from "lucide-react";
import { fetchGroupTasks } from "@/lib/supabase-tasks";
import { useProjects, type Project, type ProjectGroup } from "@/hooks/useProjects";
import type { Bitrix24Task } from "@/lib/bitrix24";

const GROUP_ICON_MAP: [RegExp, LucideIcon][] = [
  [/операцион/i, Coins],
  [/налог/i, Receipt],
  [/бюджет/i, PiggyBank],
  [/отчет|отчёт/i, FileText],
  [/аналит/i, BarChart3],
  [/аудит|контрол/i, Scale],
  [/казн|treasury/i, Landmark],
  [/инвест/i, TrendingUp],
  [/бухгалтер|учет|учёт/i, Calculator],
  [/закуп/i, Briefcase],
  [/документ/i, FolderOpen],
  [/склад/i, Warehouse],
];

function getGroupIcon(groupName: string): LucideIcon {
  for (const [pattern, icon] of GROUP_ICON_MAP) {
    if (pattern.test(groupName)) return icon;
  }
  return Briefcase;
}

const GROUP_ABBR_MAP: [RegExp, string][] = [
  [/операцион/i, "OF"],
  [/налог/i, "TX"],
  [/бюджет/i, "BG"],
  [/отчет|отчёт/i, "RP"],
  [/аналит/i, "AN"],
  [/аудит|контрол/i, "AU"],
  [/казн|treasury/i, "TR"],
  [/инвест/i, "IN"],
  [/бухгалтер|учет|учёт/i, "AC"],
  [/закуп/i, "PR"],
  [/документ/i, "DC"],
  [/склад/i, "WH"],
];

function getGroupAbbr(groupName: string): string {
  for (const [pattern, abbr] of GROUP_ABBR_MAP) {
    if (pattern.test(groupName)) return abbr;
  }
  return groupName.slice(0, 2).toUpperCase();
}

interface ItemTaskStats {
  total: number;
  done: number;
  newTasks: number;
  inProgress: number;
  consultation: number;
  approval: number;
  overdue: boolean;
}

function GroupBranch({
  group,
  defaultExpanded = true,
  totalTasks,
  doneTasks,
  loading,
  itemStats,
  onSelectItem,
  selectedProjectId,
  index,
}: {
  group: ProjectGroup;
  defaultExpanded?: boolean;
  totalTasks: number;
  doneTasks: number;
  loading?: boolean;
  itemStats: Record<string, ItemTaskStats>;
  onSelectItem?: (item: Project | null, groupName: string) => void;
  selectedProjectId?: string | null;
  index: number;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const color = "#3b82f6";
  const IconComponent = getGroupIcon(group.groupName);

  return (
    <div className="relative">
      <div className="relative flex items-center gap-2 group">
        <div
          className="relative z-10 flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${color}15`, color }}
        >
          <IconComponent className="w-3.5 h-3.5" />
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1.5 min-w-0 text-left hover:opacity-80 transition-opacity cursor-pointer"
        >
          <span
            className={`truncate text-xs font-medium transition-colors group-hover:text-ring ${expanded ? "text-ring" : "text-muted-foreground"}`}
          >
            {group.groupName}
          </span>
          <div
            className="flex-shrink-0 w-5 h-5 rounded flex items-center justify-center"
            style={{ backgroundColor: `${color}15`, color }}
          >
            <span className="text-[8px] font-bold leading-none">{getGroupAbbr(group.groupName)}</span>
          </div>
          {group.projects.length > 0 && (
            <span className="flex-shrink-0 text-muted-foreground">
              {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
            </span>
          )}
        </button>
        <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
          ) : (
            <>
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {doneTasks}/{totalTasks}
              </span>
              <div className="w-12 h-1.5 rounded-full bg-[hsl(0_0%_85%)] dark:bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${totalTasks > 0 ? (doneTasks / totalTasks) * 100 : 0}%`,
                    backgroundColor: "#007bff",
                    opacity: 0.7,
                  }}
                />
              </div>
            </>
          )}
        </div>
      </div>
      {expanded && group.projects.length > 0 && (
        <div className="ml-3 mt-1 mb-1 pl-5 border-l border-dashed" style={{ borderColor: `${color}30` }}>
          {group.projects.map((item) => {
            const stats = itemStats?.[item.id];
            return (
              <div key={item.id} className="relative flex items-center gap-2 py-[3px] group/item">
                <div className="absolute -left-5 top-1/2 w-4 h-px" style={{ backgroundColor: `${color}30` }} />
                <div className="relative z-10 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: `${color}50` }} />
                <span
                  className={`text-xs flex-shrink-0 tabular-nums w-5 text-right ${selectedProjectId === item.id ? "text-blue-500" : "text-muted-foreground"}`}
                >
                  {stats ? stats.total - stats.done : 0}
                </span>
                <span
                  className={`text-xs transition-colors truncate cursor-pointer hover:underline ${selectedProjectId === item.id ? "text-blue-500 underline decoration-blue-500" : "text-foreground/80 group-hover/item:text-foreground"}`}
                  onClick={() => {
                    if (selectedProjectId === item.id) {
                      onSelectItem?.(null, "");
                    } else {
                      onSelectItem?.(item, group.groupName);
                    }
                  }}
                >
                  {item.name}
                </span>
                {stats && !loading && (
                  <div className="ml-auto flex items-center gap-1.5 flex-shrink-0">
                    {stats.newTasks > 0 && (
                      <span className="text-[11px] tabular-nums px-1 py-0.5 rounded bg-teal-500/15 text-teal-500" title="Новые задачи">
                        {stats.newTasks}
                      </span>
                    )}
                    {stats.inProgress > 0 && (
                      <span className="text-[11px] tabular-nums px-1 py-0.5 rounded bg-blue-500/15 text-blue-500" title="В работе">
                        {stats.inProgress}
                      </span>
                    )}
                    {stats.consultation > 0 && (
                      <span className="text-[11px] tabular-nums px-1 py-0.5 rounded bg-red-500/15 text-red-500" title="Нужна помощь">
                        {stats.consultation}
                      </span>
                    )}
                    {stats.approval > 0 && (
                      <span className="text-[11px] tabular-nums px-1 py-0.5 rounded bg-amber-500/15 text-amber-500" title="На согласовании">
                        {stats.approval}
                      </span>
                    )}
                    {stats.overdue && (
                      <span title="Есть просроченные задачи">
                        <AlertTriangle className="w-3 h-3 text-red-500" />
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface SectionTaskStats {
  total: number;
  done: number;
}

const DepartmentTree = ({
  department,
  onSelectProject,
  selectedProjectId,
}: {
  department: string;
  onSelectProject?: (project: { id: string; name: string; sectionTitle: string } | null) => void;
  selectedProjectId?: string | null;
}) => {
  const { groups, loading: projectsLoading } = useProjects(department);
  const [allExpanded, setAllExpanded] = useState(false);
  const [smartExpand, setSmartExpand] = useState(false);
  const [toggleKey, setToggleKey] = useState(0);
  const [groupTaskStats, setGroupTaskStats] = useState<Record<string, SectionTaskStats>>({});
  const [itemTaskStats, setItemTaskStats] = useState<Record<number, ItemTaskStats>>({});
  const [loading, setLoading] = useState(false);

  // Fetch task stats for all projects
  useEffect(() => {
    if (projectsLoading || groups.length === 0) return;

    const allProjects = groups.flatMap((g) => g.projects.map((p) => ({ groupName: g.groupName, project: p })));
    if (allProjects.length === 0) {
      setLoading(false);
      return;
    }

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const fetchAll = async () => {
      setLoading(true);
      const gStats: Record<string, SectionTaskStats> = {};
      groups.forEach((g) => { gStats[g.groupName] = { total: 0, done: 0 }; });
      const perItem: Record<string, ItemTaskStats> = {};
      const now2 = new Date();

      await Promise.all(
        allProjects.map(async ({ groupName, project }) => {
          try {
            const tasks = await fetchGroupTasks(project.id);
            const monthTasks = tasks.filter((t: Bitrix24Task) => {
              const created = t.createdDate ? new Date(t.createdDate) : null;
              return created && created >= monthStart && created <= monthEnd;
            });
            gStats[groupName].total += monthTasks.length;
            gStats[groupName].done += monthTasks.filter((t) => t.status === "5").length;
            perItem[project.id] = {
              total: monthTasks.length,
              done: monthTasks.filter((t) => t.status === "5").length,
              newTasks: monthTasks.filter((t) => t.status === "1").length,
              inProgress: monthTasks.filter((t) => t.status === "3").length,
              consultation: monthTasks.filter((t) => t.status === "2").length,
              approval: monthTasks.filter((t) => t.status === "4").length,
              overdue: monthTasks.some((t) => t.status !== "5" && t.deadline && new Date(t.deadline) < now2),
            };
          } catch {
            perItem[project.id] = { total: 0, done: 0, newTasks: 0, inProgress: 0, consultation: 0, approval: 0, overdue: false };
          }
        })
      );
      setGroupTaskStats(gStats);
      setItemTaskStats(perItem);
      setLoading(false);
    };
    fetchAll();
  }, [groups, projectsLoading]);

  const totalOpen = useMemo(
    () => Object.values(itemTaskStats).reduce((sum, s) => sum + (s.total - s.done), 0),
    [itemTaskStats]
  );

  if (projectsLoading) {
    return (
      <div className="w-full bg-card border border-border rounded-2xl p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="w-full bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#007bff]" />
            <h2 className="text-sm font-semibold text-foreground">Структура процессов</h2>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs cursor-pointer transition-colors ${smartExpand ? "text-blue-500" : "text-muted-foreground hover:text-foreground"}`}
              onClick={() => { setSmartExpand(!smartExpand); setToggleKey((k) => k + 1); }}
            >
              {loading ? "..." : `${totalOpen} задач`}
            </span>
            <button
              onClick={() => { setAllExpanded(!allExpanded); setToggleKey((k) => k + 1); }}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title={allExpanded ? "Свернуть все" : "Развернуть все"}
            >
              <ChevronsUpDown className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      <div className="px-2.5 py-3 space-y-2.5">
        {groups.length === 0 && !loading ? (
          <p className="text-xs text-muted-foreground px-2">Нет проектов для этого отдела</p>
        ) : (
          groups.map((group, idx) => (
            <GroupBranch
              key={`${group.groupName}-${toggleKey}`}
              group={group}
              index={idx}
              defaultExpanded={
                allExpanded ||
                (smartExpand && group.projects.some((p) => {
                  const s = itemTaskStats[p.id];
                  return s && s.total - s.done > 0;
                }))
              }
              totalTasks={groupTaskStats[group.groupName]?.total ?? 0}
              doneTasks={groupTaskStats[group.groupName]?.done ?? 0}
              loading={loading}
              itemStats={itemTaskStats}
              selectedProjectId={selectedProjectId}
              onSelectItem={(item, groupName) => {
                if (!item) {
                  onSelectProject?.(null);
                } else {
                  onSelectProject?.({ id: item.id, name: item.name, sectionTitle: groupName });
                }
              }}
            />
          ))
        )}
      </div>
    </div>
  );
};

export default DepartmentTree;
