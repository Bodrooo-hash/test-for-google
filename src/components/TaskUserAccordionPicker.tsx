import { useState, useMemo } from "react";
import { Search, Check, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useAllProfiles, type TaskProfile } from "@/hooks/useAllProfiles";

function getInitials(name: string) {
  return name.trim().split(/\s+/).map((p) => p.charAt(0)).join("").slice(0, 2).toUpperCase();
}

interface TaskUserAccordionPickerProps {
  selectedIds: string[];
  onConfirm: (ids: string[]) => void;
  onClose?: () => void;
  multiple?: boolean;
  buttonLabel?: string;
  excludeId?: string;
}

const TaskUserAccordionPicker = ({
  selectedIds,
  onConfirm,
  onClose,
  multiple = false,
  buttonLabel = "Назначить",
  excludeId,
}: TaskUserAccordionPickerProps) => {
  const { data: profiles = [] } = useAllProfiles();
  const [tempIds, setTempIds] = useState<string[]>(selectedIds);
  const [search, setSearch] = useState("");
  const [shakeError, setShakeError] = useState(false);

  const filteredProfiles = useMemo(() => {
    let list = profiles.filter((p) => p.id !== excludeId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
          `${p.last_name} ${p.first_name}`.toLowerCase().includes(q) ||
          p.position?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [profiles, search, excludeId]);

  const grouped = useMemo(() => {
    const map = new Map<string, TaskProfile[]>();
    for (const p of filteredProfiles) {
      const depts = p.department?.length ? p.department : ["Без отдела"];
      for (const d of depts) {
        if (!map.has(d)) map.set(d, []);
        map.get(d)!.push(p);
      }
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === "Без отдела") return 1;
      if (b[0] === "Без отдела") return -1;
      return a[0].localeCompare(b[0], "ru");
    });
  }, [filteredProfiles]);

  const toggle = (id: string) => {
    if (multiple) {
      setTempIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    } else {
      setTempIds((prev) => (prev.includes(id) ? [] : [id]));
    }
  };

  const fullName = (p: TaskProfile) => `${p.last_name || ""} ${p.first_name || ""}`.trim() || "—";

  return (
    <div className="flex flex-col w-full">
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 pl-8 text-xs"
            autoFocus
          />
        </div>
      </div>
      <ScrollArea className="max-h-56">
        {grouped.length === 0 ? (
          <p className="text-xs text-muted-foreground italic px-3 py-3 text-center">Не найдено</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {grouped.map(([dept, users]) => (
              <AccordionItem key={dept} value={dept} className="border-b border-border last:border-b-0">
                <AccordionTrigger className="px-3 py-1.5 text-xs font-medium text-foreground hover:no-underline hover:bg-accent/50">
                  <span className="flex items-center gap-1.5">
                    {dept}
                    <span className="text-[10px] text-muted-foreground font-normal">({users.length})</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-0.5">
                  {users.map((user) => {
                    const name = fullName(user);
                    const isSelected = tempIds.includes(user.id);
                    return (
                      <button
                        key={user.id}
                        onClick={() => toggle(user.id)}
                        className={cn(
                          "flex items-center gap-2 w-full px-3 py-1.5 text-left transition-colors",
                          isSelected ? "bg-ring/10" : "hover:bg-foreground/[0.04]"
                        )}
                      >
                        {multiple ? (
                          <Checkbox checked={isSelected} className="pointer-events-none h-3.5 w-3.5" />
                        ) : (
                          isSelected && <Check className="w-3.5 h-3.5 text-ring shrink-0" />
                        )}
                        <Avatar className="w-5 h-5 shrink-0">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="text-[7px] bg-muted">{getInitials(name)}</AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs text-foreground/70 truncate">{name}</span>
                          {user.position && (
                            <span className="text-[10px] text-muted-foreground truncate">{user.position}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </ScrollArea>
      <div className="border-t border-border p-1.5 flex items-center gap-1.5">
        <button
          onClick={() => onClose?.()}
          className="w-[30%] shrink-0 text-xs font-medium py-1.5 rounded-md bg-foreground/[0.06] text-foreground/50 hover:bg-foreground/[0.1] transition-colors"
        >
          Отмена
        </button>
        <button
          onClick={() => {
            if (tempIds.length === 0) {
              setShakeError(true);
              setTimeout(() => setShakeError(false), 2000);
              return;
            }
            onConfirm(tempIds);
            onClose?.();
          }}
          className={cn("flex-1 text-xs font-medium py-1.5 rounded-md transition-colors", shakeError ? "bg-destructive/15 text-destructive" : tempIds.length > 0 ? "bg-blue1 text-white hover:bg-blue1/90" : "bg-ring/10 text-ring hover:bg-blue1 hover:text-white")}
        >
          {shakeError ? "Выберите сотрудника" : buttonLabel}
        </button>
      </div>
    </div>
  );
};

export default TaskUserAccordionPicker;
