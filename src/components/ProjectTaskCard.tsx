import { useState, useEffect, useMemo } from "react";
import { ArrowLeft, Plus, Search, Filter, Loader2, AlertCircle, Clock, Users, RefreshCw } from "lucide-react";
import CreateTaskForm from "@/components/CreateTaskForm";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { fetchGroupTasks, fetchGroupMembers } from "@/lib/supabase-tasks";
import type { Bitrix24Task, Bitrix24User } from "@/lib/bitrix24";

export interface SelectedProject { id: string; name: string; sectionTitle: string; }
interface Props { project: SelectedProject; onBack: () => void; onTaskClick?: (task: Bitrix24Task, members: Bitrix24User[]) => void; }

const statusConfig: Record<string, {label: string; color: string; bg: string;}> = {
  "1": { label: "Новая", color: "text-teal-600", bg: "bg-teal-500/10" },
  "2": { label: "Ожидает", color: "text-yellow-600", bg: "bg-yellow-500/10" },
  "3": { label: "В работе", color: "text-blue-600", bg: "bg-blue-500/10" },
  "4": { label: "На согласовании", color: "text-amber-600", bg: "bg-amber-500/10" },
  "5": { label: "Завершена", color: "text-green-600", bg: "bg-green-500/10" },
  "6": { label: "Отложена", color: "text-muted-foreground", bg: "bg-muted" },
  "new": { label: "Новая", color: "text-teal-600", bg: "bg-teal-500/10" },
  "pending": { label: "Новая", color: "text-teal-600", bg: "bg-teal-500/10" },
  "in_progress": { label: "В работе", color: "text-blue-600", bg: "bg-blue-500/10" },
  "inwork": { label: "В работе", color: "text-blue-600", bg: "bg-blue-500/10" },
  "help": { label: "Нужна помощь", color: "text-red-600", bg: "bg-red-500/10" },
  "approval": { label: "На согласовании", color: "text-amber-600", bg: "bg-amber-500/10" },
  "completed": { label: "Завершена", color: "text-green-600", bg: "bg-green-500/10" },
  "done": { label: "Завершена", color: "text-green-600", bg: "bg-green-500/10" },
};

type FilterKey = "all" | "new" | "inProgress" | "help" | "approval";
const filters: {key: FilterKey; label: string;}[] = [
  { key: "all", label: "Всего задач" },
  { key: "new", label: "Новые" },
  { key: "inProgress", label: "В работе" },
  { key: "help", label: "Нужна помощь" },
  { key: "approval", label: "На согласовании результата" }
];

const filterColors: Record<FilterKey, {text: string; bg: string;}> = {
  all: { text: "text-muted-foreground", bg: "bg-transparent" },
  new: { text: "text-teal-500", bg: "bg-teal-500/15" },
  inProgress: { text: "text-blue-500", bg: "bg-blue-500/15" },
  help: { text: "text-red-500", bg: "bg-red-500/15" },
  approval: { text: "text-amber-500", bg: "bg-amber-500/15" }
};

function shortName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length >= 2) return `${parts[0]} ${parts[1].charAt(0)}.`;
  return parts[0] || "";
}
function getInitials(name?: string | null) {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((p) => p.charAt(0)).join("").slice(0, 2).toUpperCase();
}
function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
}
function isOverdue(task: Bitrix24Task) {
  return task.status !== "5" && task.deadline && new Date(task.deadline) < new Date();
}

const ProjectTaskCard = ({ project, onBack, onTaskClick }: Props) => {
  const [tasks, setTasks] = useState<Bitrix24Task[]>([]);
  const [members, setMembers] = useState<Bitrix24User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");
  const [showTeam, setShowTeam] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  const loadTasks = async () => {
    setLoading(true); setError(false);
    try {
      const [t, m] = await Promise.all([fetchGroupTasks(project.id), fetchGroupMembers(project.id)]);
      setTasks(t); setMembers(m);
    } catch { setError(true); } finally { setLoading(false); }
  };

  useEffect(() => { loadTasks(); }, [project.id]);

  const filterCounts = useMemo(() => ({
    all: tasks.length,
    new: tasks.filter((t) => ["1", "new", "pending"].includes(t.status)).length,
    inProgress: tasks.filter((t) => ["3", "in_progress", "inwork"].includes(t.status)).length,
    help: tasks.filter((t) => ["2", "help"].includes(t.status)).length,
    approval: tasks.filter((t) => ["4", "approval"].includes(t.status)).length
  }), [tasks]);

  const filteredTasks = useMemo(() => {
    let list = tasks;
    if (activeFilter === "new") list = list.filter((t) => ["1", "new", "pending"].includes(t.status));
    else if (activeFilter === "inProgress") list = list.filter((t) => ["3", "in_progress", "inwork"].includes(t.status));
    else if (activeFilter === "help") list = list.filter((t) => ["2", "help"].includes(t.status));
    else if (activeFilter === "approval") list = list.filter((t) => ["4", "approval"].includes(t.status));
    if (search.trim()) { const q = search.toLowerCase(); list = list.filter((t) => t.title.toLowerCase().includes(q)); }
    // Sort "new" tasks by createdDate descending (newest first)
    list = [...list].sort((a, b) => {
      const aNew = ["1", "new", "pending"].includes(a.status);
      const bNew = ["1", "new", "pending"].includes(b.status);
      if (aNew && bNew) {
        const da = a.createdDate ? new Date(a.createdDate).getTime() : 0;
        const db = b.createdDate ? new Date(b.createdDate).getTime() : 0;
        return db - da;
      }
      return 0;
    });
    return list;
  }, [tasks, activeFilter, search]);

  if (showCreateForm) {
    return (
      <CreateTaskForm
        projectId={project.id}
        projectName={project.name}
        sectionName={project.sectionTitle}
        members={members}
        onBack={() => setShowCreateForm(false)}
        onCreated={() => { setShowCreateForm(false); loadTasks(); }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full -m-4">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between rounded-t-2xl">
        <div className="flex items-end gap-2">
          <h2 className="text-sm font-semibold truncate pb-px text-foreground">{project.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <button onClick={() => setShowTeam((v) => !v)} className="h-5 rounded-full bg-foreground/[0.03] flex items-center gap-1 px-2 transition-colors hover:bg-muted-foreground/20" title="Команда">
              <Users className="w-3 h-3 text-muted-foreground" /><span className="text-[10px] text-muted-foreground font-medium">Команда</span>
            </button>
            {showTeam && <>
              <div className="fixed inset-0 z-40" onClick={() => setShowTeam(false)} />
              <div className="absolute right-0 top-7 z-50 w-52 rounded-lg border border-border bg-card shadow-lg p-2 animate-scale-in">
                <p className="text-[10px] text-muted-foreground mb-1.5 px-1">Участники проекта</p>
                {members.length === 0 ? <p className="text-xs text-muted-foreground italic px-1">Нет участников</p> :
                  <div className="flex flex-col gap-0.5 max-h-48 overflow-auto">
                    {members.map((u) => <div key={u.ID} className="flex items-center gap-2 px-1 py-1 rounded hover:bg-muted/50">
                      <Avatar className="w-5 h-5"><AvatarImage src={u.PERSONAL_PHOTO} /><AvatarFallback className="text-[7px] bg-muted">{getInitials(`${u.NAME} ${u.LAST_NAME}`)}</AvatarFallback></Avatar>
                      <span className="text-xs text-foreground/80 truncate">{u.LAST_NAME} {u.NAME}</span>
                    </div>)}
                  </div>}
              </div>
            </>}
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => setShowCreateForm(true)} className="group/btn flex items-center gap-0 h-5 min-w-5 rounded-full bg-ring text-white transition-all duration-300 overflow-hidden px-1 hover:px-2.5 hover:gap-1">
              <Plus className="w-3 h-3 flex-shrink-0" />
              <span className="max-w-0 overflow-hidden whitespace-nowrap text-[10px] font-medium transition-all duration-300 group-hover/btn:max-w-[120px]">Создать задачу</span>
            </button>
            <button onClick={loadTasks} className="h-5 w-5 flex items-center justify-center rounded-full bg-foreground/[0.03] hover:bg-foreground/[0.06] transition-colors" title="Обновить">
              <RefreshCw className="w-3 h-3 text-muted-foreground" />
            </button>
          </div>
        </div>
      </div>
      <div className="px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {showSearch ?
            <div className="relative flex-1 max-w-xs animate-in slide-in-from-left-2 duration-200">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground/25" />
              <input type="text" placeholder="Поиск задач..." value={search} onChange={(e) => setSearch(e.target.value)}
                onBlur={() => { if (!search) setShowSearch(false); }}
                className="w-full pl-9 pr-4 py-2 rounded-xl bg-foreground/[0.03] border border-foreground/[0.06] text-foreground/80 placeholder:text-foreground/25 focus:outline-none focus:border-ring/30 focus:bg-background transition-all"
                style={{ fontSize: 13 }} autoFocus />
            </div> :
            <button onClick={() => setShowSearch(true)} className="w-8 h-8 rounded-full bg-foreground/[0.03] flex items-center justify-center hover:bg-foreground/[0.06] transition-colors shrink-0">
              <Search size={14} className="text-foreground/30" />
            </button>}
          {showFilters ?
            <div className="flex items-center gap-1 bg-foreground/[0.03] rounded-xl p-1 animate-in slide-in-from-left-2 duration-200">
              <button onClick={() => setShowFilters(false)} className="ml-1 mr-1"><Filter size={14} className="text-foreground/30" /></button>
              {filters.map((f) => {
                const count = filterCounts[f.key];
                const hasItems = f.key !== "all" && count >= 1;
                const colorClass = hasItems ? filterColors[f.key].text : "";
                return (
                  <button key={f.key} onClick={() => setActiveFilter(f.key)}
                    className={`text-xs font-medium px-3 py-1 rounded-lg transition-all ${activeFilter === f.key ? "bg-card shadow-sm " + (hasItems ? colorClass : "text-foreground/80") : (hasItems ? colorClass : "text-foreground/40") + " hover:text-foreground/60"}`}
                    >{f.label} <span className="ml-1 tabular-nums font-medium">{count}</span></button>
                );
              })}
            </div> :
            <button onClick={() => setShowFilters(true)} className="w-8 h-8 rounded-full bg-foreground/[0.03] flex items-center justify-center hover:bg-foreground/[0.06] transition-colors shrink-0">
              <Filter size={14} className="text-foreground/30" />
            </button>}
        </div>
      </div>
      {loading ? <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div> :
        error ? <div className="flex items-center justify-center gap-2 py-12 text-sm text-red-500"><AlertCircle className="w-4 h-4" />Не удалось загрузить задачи</div> :
          filteredTasks.length === 0 ? <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">{search ? "Ничего не найдено" : "Нет задач"}</div> :
            <div className="flex-1 min-h-0 overflow-auto px-4">
              <Table>
                <TableHeader><TableRow>
                  <TableHead className="text-xs">Название</TableHead>
                  <TableHead className="text-xs w-24">Дедлайн</TableHead>
                  <TableHead className="text-xs w-28">Статус</TableHead>
                  <TableHead className="text-xs w-16 text-center">Актив.</TableHead>
                  <TableHead className="text-xs w-36">Исполнитель</TableHead>
                  <TableHead className="text-xs w-24">Соисполн.</TableHead>
                  <TableHead className="text-xs w-24">Наблюд.</TableHead>
                  <TableHead className="text-xs w-36">Постановщик</TableHead>
                  <TableHead className="text-xs w-24">Создана</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {filteredTasks.map((task) => {
                    const st = statusConfig[task.status] || statusConfig["6"];
                    const overdue = isOverdue(task);
                    return (
                      <TableRow key={task.id} className="group cursor-pointer hover:bg-muted/50" onClick={() => onTaskClick?.(task, members)}>
                        <TableCell className="text-xs font-medium max-w-[200px] truncate">{task.title}</TableCell>
                        <TableCell className={`text-xs tabular-nums ${overdue ? "text-red-500 font-medium" : "text-muted-foreground"}`}>
                          <span className="flex items-center gap-1">{overdue && <Clock className="w-3 h-3" />}{formatDate(task.deadline)}</span>
                        </TableCell>
                        <TableCell><span className={`text-[10px] px-1.5 py-0.5 rounded ${st.bg} ${st.color}`}>{st.label}</span></TableCell>
                        <TableCell className="text-center">{task.activityDate && <div className="w-2 h-2 rounded-full bg-blue-500 mx-auto" title="Новая активность" />}</TableCell>
                        <TableCell>{task.responsible ? <div className="flex items-center gap-1.5"><Avatar className="w-5 h-5"><AvatarImage src={task.responsible.icon} /><AvatarFallback className="text-[7px] bg-muted">{getInitials(task.responsible.name)}</AvatarFallback></Avatar><span className="text-xs text-foreground/80 truncate">{shortName(task.responsible.name)}</span></div> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{task.accomplices && task.accomplices.length > 0 ? <div className="flex -space-x-1">{task.accomplices.slice(0, 3).map((a) => <Avatar key={a.id} className="w-5 h-5 border border-card" title={a.name}><AvatarImage src={a.icon} /><AvatarFallback className="text-[7px] bg-muted">{getInitials(a.name)}</AvatarFallback></Avatar>)}{task.accomplices.length > 3 && <div className="w-5 h-5 rounded-full bg-muted border border-card flex items-center justify-center text-[7px] text-muted-foreground">+{task.accomplices.length - 3}</div>}</div> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{task.auditors && task.auditors.length > 0 ? <div className="flex -space-x-1">{task.auditors.slice(0, 3).map((a) => <Avatar key={a.id} className="w-5 h-5 border border-card" title={a.name}><AvatarImage src={a.icon} /><AvatarFallback className="text-[7px] bg-muted">{getInitials(a.name)}</AvatarFallback></Avatar>)}{task.auditors.length > 3 && <div className="w-5 h-5 rounded-full bg-muted border border-card flex items-center justify-center text-[7px] text-muted-foreground">+{task.auditors.length - 3}</div>}</div> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                        <TableCell>{task.creator ? <div className="flex items-center gap-1.5"><Avatar className="w-5 h-5"><AvatarImage src={task.creator.icon} /><AvatarFallback className="text-[7px] bg-muted">{getInitials(task.creator.name)}</AvatarFallback></Avatar><span className="text-xs text-foreground/80 truncate">{shortName(task.creator.name)}</span></div> : <span className="text-xs text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-xs text-muted-foreground tabular-nums">{formatDate(task.createdDate)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>}
    </div>
  );
};

export default ProjectTaskCard;
