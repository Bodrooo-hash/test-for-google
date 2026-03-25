import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { User, Search, UserPlus, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskProfile } from "@/hooks/useAllProfiles";

export type AttendeeProfile = TaskProfile;

interface AttendeeAccordionPickerProps {
  profiles: AttendeeProfile[];
  selectedIds: Set<string>;
  onToggle: (profile: AttendeeProfile) => void;
  excludeId?: string;
}

const AttendeeAccordionPicker = ({ profiles, selectedIds, onToggle, excludeId }: AttendeeAccordionPickerProps) => {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);

  const filteredProfiles = useMemo(() => {
    let list = profiles.filter(p => p.id !== excludeId);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
        p.position?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [profiles, search, excludeId]);

  const grouped = useMemo(() => {
    const map = new Map<string, AttendeeProfile[]>();
    for (const p of filteredProfiles) {
      const depts = p.department?.length ? p.department : ["Без отдела"];
      for (const d of depts) {
        if (!map.has(d)) map.set(d, []);
        map.get(d)!.push(p);
      }
    }
    // Sort groups, "Без отдела" last
    const entries = Array.from(map.entries()).sort((a, b) => {
      if (a[0] === "Без отдела") return 1;
      if (b[0] === "Без отдела") return -1;
      return a[0].localeCompare(b[0], "ru");
    });
    return entries;
  }, [filteredProfiles]);

  if (!open) {
    return (
      <div
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 cursor-pointer group/pick"
      >
        <User className="w-4 h-4 text-foreground/30 group-hover/pick:text-ring transition-colors" />
        <span className="text-xs text-foreground/30 group-hover/pick:text-ring transition-colors">Добавить участника</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 pl-8 text-xs"
            autoFocus
          />
        </div>
        <button
          onClick={() => { setOpen(false); setSearch(""); }}
          className="ml-2 flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-foreground/[0.06] text-foreground/50 hover:bg-foreground/[0.1] transition-colors"
        >
          Свернуть
        </button>
      </div>

      <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-background">
        {grouped.length === 0 ? (
          <p className="text-xs text-muted-foreground p-3 text-center">Пользователи не найдены</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {grouped.map(([dept, users]) => (
              <AccordionItem key={dept} value={dept} className="border-b border-border last:border-b-0">
                <AccordionTrigger className="px-3 py-2 text-xs font-medium text-foreground hover:no-underline hover:bg-accent/50">
                  <span className="flex items-center gap-2">
                    {dept}
                    <span className="text-[10px] text-muted-foreground font-normal">({users.length})</span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pb-1">
                  {users.map((user) => {
                    const isSelected = selectedIds.has(user.id);
                    return (
                      <button
                        key={user.id}
                        onClick={() => onToggle(user)}
                        className={cn(
                          "flex items-center gap-2.5 w-full px-3 py-1.5 text-left transition-colors",
                          isSelected ? "bg-accent" : "hover:bg-accent/50"
                        )}
                      >
                        <Checkbox checked={isSelected} className="pointer-events-none h-3.5 w-3.5" />
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                        ) : (
                          <User className="w-4 h-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs text-foreground truncate">{user.last_name} {user.first_name}</span>
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
      </div>
    </div>
  );
};

export default AttendeeAccordionPicker;
