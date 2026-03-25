import { useState, useRef, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronDown, X, Crown, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDepartments, type DepartmentNode } from "@/hooks/useDepartments";
import type { ExclusiveRoleInfo } from "@/hooks/useDepartmentManagers";

interface MultiDepartmentSelectProps {
  value: string[];
  onChange: (value: string[]) => void;
  managedDepartments?: string[];
  onManagedChange?: (value: string[]) => void;
  /** @deprecated Use managedDepartments */
  leaderDepartments?: string[];
  /** @deprecated Use onManagedChange */
  onLeaderChange?: (value: string[]) => void;
  placeholder?: string;
  /** Optional filtered list of departments to show */
  availableDepartments?: string[];
  /** Function to get exclusive role info for a department */
  getRoleInfo?: (dept: string) => ExclusiveRoleInfo;
}

export default function MultiDepartmentSelect({
  value,
  onChange,
  managedDepartments,
  onManagedChange,
  leaderDepartments,
  onLeaderChange,
  placeholder = "Выберите отделы",
  availableDepartments,
  getRoleInfo,
}: MultiDepartmentSelectProps) {
  const { tree, isLoading } = useDepartments();

  const managed = managedDepartments ?? leaderDepartments ?? [];
  const onManagedChanged = onManagedChange ?? onLeaderChange;
  const [open, setOpen] = useState(false);
  const [warn, setWarn] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const warnTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (dept: string) => {
    const info = getRoleInfo?.(dept);
    if (info?.disabled) return;

    if (value.includes(dept)) {
      onChange(value.filter(d => d !== dept));
      if (onManagedChanged && managed.includes(dept)) {
        onManagedChanged(managed.filter(d => d !== dept));
      }
    } else {
      onChange([...value, dept]);
    }
  };

  const toggleLeader = (dept: string) => {
    if (!onManagedChanged) return;
    const info = getRoleInfo?.(dept);
    if (info?.disabled) return;
    if (info?.exclusiveManager && info.managerName) return;

    onManagedChanged(
      managed.includes(dept)
        ? managed.filter(d => d !== dept)
        : [...managed, dept]
    );
  };

  const remove = (dept: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(d => d !== dept));
    if (onManagedChanged && managed.includes(dept)) {
      onManagedChanged(managed.filter(d => d !== dept));
    }
  };

  /** Excluded from selection (structural-only nodes) */
  const EXCLUDED = ["Совет директоров", "Генеральный директор"];

  /** Collect selectable leaf-level departments from the tree, grouped */
  const getSelectableGroups = (nodes: DepartmentNode[]): { header: string; items: string[] }[] => {
    const groups: { header: string; items: string[] }[] = [];
    const walk = (node: DepartmentNode) => {
      if (EXCLUDED.includes(node.name)) {
        node.children.forEach(walk);
        return;
      }
      // Node with children → group header + children as items
      if (node.children.length > 0) {
        const childNames: string[] = [];
        const collectLeaves = (n: DepartmentNode) => {
          if (n.children.length === 0) childNames.push(n.name);
          else n.children.forEach(collectLeaves);
        };
        node.children.forEach(collectLeaves);
        // Sort children for Коммерческий отдел
        const COMMERCIAL_ORDER = ["Отдел закупки", "Отдел продаж", "Отдел маркетинга и дизайна", "Отдел сервиса"];
        if (node.name === "Коммерческий отдел") {
          childNames.sort((a, b) => {
            const ai = COMMERCIAL_ORDER.indexOf(a);
            const bi = COMMERCIAL_ORDER.indexOf(b);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          });
        }
        groups.push({ header: node.name, items: childNames });
      } else {
        // Standalone department → self-group with header
        groups.push({ header: node.name, items: [node.name] });
      }
    };
    nodes.forEach(walk);
    return groups;
  };

  const DEPT_ORDER = ["Финансовый отдел", "Коммерческий отдел", "HR отдел"];
  const selectableGroups = getSelectableGroups(tree).sort((a, b) => {
    const ai = DEPT_ORDER.indexOf(a.header);
    const bi = DEPT_ORDER.indexOf(b.header);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  /** Check if a department passes the availableDepartments filter */
  const isAvailable = (dept: string) => !availableDepartments || availableDepartments.includes(dept);

  /** Departments that act as parent groups with sub-departments */
  const GROUP_PARENTS = ["Коммерческий отдел"];

  const renderGroup = (group: { header: string; items: string[] }) => {
    const hasAvailable = group.items.some(isAvailable);
    if (!hasAvailable && !isAvailable(group.header)) return null;

    const isSelfGroup = group.items.length === 1 && group.items[0] === group.header;
    const isGroupParent = GROUP_PARENTS.includes(group.header) && !isSelfGroup;
    const parentInfo = isGroupParent ? getRoleInfo?.(group.header) : undefined;
    const isParentChecked = isGroupParent && value.includes(group.header);
    const isParentManaged = isGroupParent && managed.includes(group.header);

    return (
      <div key={group.header} className="mb-1">
        <div className="flex items-center justify-between pt-2 pb-1 px-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-semibold">
            {group.header}
          </p>
          {isGroupParent && onManagedChanged && (
            <>
              {parentInfo?.exclusiveManager && parentInfo.managerName ? (
                <span className="text-[10px] text-muted-foreground/60 shrink-0 truncate max-w-[120px]">
                  Рук: {parentInfo.managerName}
                </span>
              ) : (
                <label className="flex items-center gap-1 cursor-pointer shrink-0">
                  <Checkbox
                    checked={isParentManaged}
                    onCheckedChange={() => {
                      if (!value.includes(group.header)) {
                        onChange([...value, group.header]);
                      }
                      toggleLeader(group.header);
                    }}
                    className="h-3.5 w-3.5"
                  />
                  <span className={cn("text-[10px]", isParentManaged ? "text-amber-600 font-medium" : "text-muted-foreground/60")}>
                    Рук.
                  </span>
                </label>
              )}
            </>
          )}
        </div>
        {group.items.map(dept => {
          if (!isAvailable(dept)) return null;
          const info = getRoleInfo?.(dept);
          const isChecked = value.includes(dept);
          const isLeader = managed.includes(dept);

          if (info?.disabled) {
            return (
              <div key={dept} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md opacity-40 pl-5">
                <Lock size={12} className="text-muted-foreground shrink-0" />
                <span className="text-xs text-muted-foreground truncate">{dept}</span>
              </div>
            );
          }

          return (
            <div key={dept} className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md hover:bg-muted/40 transition-colors pl-5">
              <label className="flex items-center gap-2.5 cursor-pointer flex-1 min-w-0">
                <Checkbox checked={isChecked} onCheckedChange={() => toggle(dept)} />
                <span className="text-xs text-foreground/80 truncate">{dept}</span>
              </label>
              {isChecked && onManagedChanged && (
                <>
                  {info?.exclusiveManager && info.managerName ? (
                    <span className="text-[10px] text-muted-foreground/60 shrink-0 truncate max-w-[120px]">
                      Рук: {info.managerName}
                    </span>
                  ) : (
                    <label className="flex items-center gap-1 cursor-pointer shrink-0">
                      <Checkbox
                        checked={isLeader}
                        onCheckedChange={() => toggleLeader(dept)}
                        className="h-3.5 w-3.5"
                      />
                      <span className={cn("text-[10px]", isLeader ? "text-amber-600 font-medium" : "text-muted-foreground/60")}>
                        Рук.
                      </span>
                    </label>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          if (availableDepartments && availableDepartments.length === 0) {
            setWarn(true);
            clearTimeout(warnTimer.current);
            warnTimer.current = setTimeout(() => setWarn(false), 3000);
            return;
          }
          setOpen(!open);
        }}
        className={cn(
          "flex min-h-10 w-full items-center justify-between rounded-md px-1 py-2 text-sm",
          !value.length && "text-muted-foreground"
        )}
      >
        <div className="flex flex-wrap gap-1 flex-1 min-w-0">
          {value.length === 0 ? (
            <span className={cn("transition-colors", warn ? "text-destructive" : "text-muted-foreground/50")}>{placeholder}</span>
          ) : (
            value.map(d => (
              <Badge key={d} className="text-xs gap-1 shrink-0 bg-blue1 text-white hover:bg-blue1/90 border-0 py-1.5 px-2.5">
                {managed.includes(d) && <Crown size={10} className="text-white" />}
                {d}
                <X size={10} className="cursor-pointer hover:text-white/70" onClick={(e) => remove(d, e)} />
              </Badge>
            ))
          )}
        </div>
        <ChevronDown size={14} className="ml-2 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div
          className="rounded-md border bg-popover p-1 shadow-md animate-in fade-in-0 zoom-in-95 max-h-[300px] overflow-y-auto"
          style={{
            position: "fixed",
            zIndex: 50,
            width: ref.current?.getBoundingClientRect().width,
            left: ref.current?.getBoundingClientRect().left,
            top: (ref.current?.getBoundingClientRect().bottom ?? 0) + 4,
          }}
        >
          {isLoading ? (
            <p className="text-xs text-muted-foreground text-center py-3">Загрузка...</p>
          ) : (
            selectableGroups.map(g => renderGroup(g))
          )}
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full mt-1 py-1.5 rounded-md text-xs font-medium bg-blue1 text-white hover:bg-blue1/90 transition-colors"
          >
            Сохранить
          </button>
        </div>
      )}
    </div>
  );
}
