import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Shield, Users, Building2, X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  fetchAllProfiles,
  getFolderPermission,
  upsertFolderPermission,
  deleteFolderPermission,
  type UserProfile,
} from "@/lib/folder-permissions";
import { useToast } from "@/hooks/use-toast";
import { useDepartments } from "@/hooks/useDepartments";

interface FolderPermissionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderPath: string;
  folderDisplayName: string;
}

export default function FolderPermissionsModal({
  open,
  onOpenChange,
  folderPath,
  folderDisplayName,
}: FolderPermissionsModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedDepts, setSelectedDepts] = useState<string[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const { toast } = useToast();
  const { tree, flatNames, isLoading: deptsLoading } = useDepartments();

  const EXCLUDED = ["Совет директоров", "Генеральный директор"];
  const DEPT_ORDER = ["Финансовый отдел", "Коммерческий отдел", "HR отдел"];
  const COMMERCIAL_ORDER = ["Отдел закупки", "Отдел продаж", "Отдел маркетинга и дизайна", "Отдел сервиса"];

  type DeptGroup = { header: string; items: string[] };
  const getSelectableGroups = (nodes: any[]): DeptGroup[] => {
    const groups: DeptGroup[] = [];
    const walk = (node: any) => {
      if (EXCLUDED.includes(node.name)) { node.children.forEach(walk); return; }
      if (node.children.length > 0) {
        const childNames: string[] = [];
        const collectLeaves = (n: any) => { if (n.children.length === 0) childNames.push(n.name); else n.children.forEach(collectLeaves); };
        node.children.forEach(collectLeaves);
        if (node.name === "Коммерческий отдел") {
          childNames.sort((a: string, b: string) => {
            const ai = COMMERCIAL_ORDER.indexOf(a); const bi = COMMERCIAL_ORDER.indexOf(b);
            return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
          });
        }
        groups.push({ header: node.name, items: childNames });
      } else {
        groups.push({ header: node.name, items: [node.name] });
      }
    };
    nodes.forEach(walk);
    return groups.sort((a, b) => {
      const ai = DEPT_ORDER.indexOf(a.header); const bi = DEPT_ORDER.indexOf(b.header);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  };
  const selectableGroups = getSelectableGroups(tree);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setUserSearch("");
    setDeptFilter("all");
    Promise.all([
      fetchAllProfiles(),
      getFolderPermission(folderPath),
    ]).then(([profiles, perm]) => {
      setAllUsers(profiles);
      setSelectedDepts(perm?.allowed_departments || []);
      setSelectedUsers(perm?.allowed_users || []);
    }).catch((err) => {
      toast({ title: "Ошибка загрузки", description: err.message, variant: "destructive" });
    }).finally(() => setLoading(false));
  }, [open, folderPath]);

  const toggleDept = (dept: string) => {
    setSelectedDepts((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const toggleUser = (userId: string) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((u) => u !== userId) : [...prev, userId]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (selectedDepts.length === 0 && selectedUsers.length === 0) {
        // No restrictions — remove permission entry (open to all)
        await deleteFolderPermission(folderPath);
      } else {
        await upsertFolderPermission({
          folder_path: folderPath,
          allowed_departments: selectedDepts,
          allowed_users: selectedUsers,
        });
      }
      toast({ title: "Права доступа сохранены" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Ошибка сохранения", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const COMMERCIAL_CHILDREN = ["Отдел закупки", "Отдел продаж", "Отдел маркетинга и дизайна", "Отдел сервиса"];
  const EXCLUDED_FILTERS = ["Совет директоров", "Генеральный директор"];
  const visibleDeptFilters = flatNames.filter(d => !EXCLUDED_FILTERS.includes(d));

  const filteredUsers = allUsers.filter((u) => {
    if (deptFilter !== "all") {
      const matchDepts = deptFilter === "Коммерческий отдел"
        ? [deptFilter, ...COMMERCIAL_CHILDREN]
        : [deptFilter];
      if (!u.department || !matchDepts.some(d => u.department!.includes(d))) return false;
    }
    if (!userSearch) return true;
    const q = userSearch.toLowerCase();
    return (
      (u.first_name || "").toLowerCase().includes(q) ||
      (u.last_name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Shield size={16} className="text-[hsl(var(--blue1))]" />
            Права доступа
          </DialogTitle>
          <DialogDescription className="text-xs">
            Папка: <span className="font-medium text-foreground/80">{folderDisplayName}</span>
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-hidden space-y-4">



            {/* Users */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Users size={14} className="text-muted-foreground" />
                <span className="text-xs font-medium text-foreground/80">Сотрудники</span>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {["all", ...visibleDeptFilters].map((dept) => (
                  <button
                    key={dept}
                    onClick={() => setDeptFilter(dept)}
                    className={`px-2 py-0.5 rounded-md text-[10px] transition-colors ${
                      deptFilter === dept
                        ? "bg-[hsl(var(--blue1))] text-white"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {dept === "all" ? "Все" : dept}
                  </button>
                ))}
              </div>
              <div className="relative mb-2">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Поиск сотрудника…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="h-8 text-xs pl-8"
                />
              </div>
              {selectedUsers.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2 px-1">
                  {selectedUsers.map((uid) => {
                    const u = allUsers.find((p) => p.id === uid);
                    return (
                      <Badge
                        key={uid}
                        variant="secondary"
                        className="text-[10px] gap-1 cursor-pointer hover:bg-destructive/10"
                        onClick={() => toggleUser(uid)}
                      >
                        {u ? `${u.last_name} ${u.first_name}` : uid}
                        <X size={10} />
                      </Badge>
                    );
                  })}
                </div>
              )}
              <ScrollArea className="h-[180px] border border-border rounded-lg">
                <div className="p-1">
                  {filteredUsers.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Не найдено</p>
                  ) : (
                    filteredUsers.map((user) => (
                      <label
                        key={user.id}
                        className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-muted/40 cursor-pointer transition-colors"
                      >
                        <Checkbox
                          checked={selectedUsers.includes(user.id)}
                          onCheckedChange={() => toggleUser(user.id)}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs text-foreground/80 block truncate">
                            {user.last_name} {user.first_name}
                          </span>
                          {user.department && user.department.length > 0 && (
                            <span className="text-[10px] text-muted-foreground block truncate">
                              {user.department.join(", ")}
                            </span>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>

            <p className="text-[10px] text-muted-foreground/60 px-1">
              Если не выбрано ни одного отдела и сотрудника — папка доступна всем.
              Администраторы всегда имеют полный доступ.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button
            size="sm"
            className="bg-[hsl(var(--blue1))] text-white hover:bg-[hsl(var(--blue1))]/90"
            onClick={handleSave}
            disabled={loading || saving}
          >
            {saving && <Loader2 size={14} className="animate-spin mr-1" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
