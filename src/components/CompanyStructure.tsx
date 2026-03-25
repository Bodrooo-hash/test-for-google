import { useState, useEffect } from "react";
import { Crown, Users, User, Building2, Landmark, UserCog, DollarSign, Handshake, ShoppingCart, TrendingUp, Palette, Wrench, HeartHandshake, ChevronDown, MessageCircle, PhoneCall, UsersRound } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { externalSupabase } from "@/lib/externalSupabase";
import { useDepartments, type Department } from "@/hooks/useDepartments";
import EmployeeAccountModal from "@/components/EmployeeAccountModal";

const BLUE1 = "#0079FF";

// Unique icon per department
const DEPT_ICONS: Record<string, React.ElementType> = {
  "Совет директоров": Landmark,
  "Генеральный директор": UserCog,
  "Финансовый отдел": DollarSign,
  "HR отдел": HeartHandshake,
  "Коммерческий отдел": Handshake,
  "Отдел продаж": TrendingUp,
  "Отдел закупки": ShoppingCart,
  "Отдел маркетинга и дизайна": Palette,
  "Отдел сервиса": Wrench,
};

function getDeptIcon(name: string): React.ElementType {
  return DEPT_ICONS[name] || Building2;
}

const COMMERCIAL_CHILD_ORDER = [
  "Отдел закупки",
  "Отдел продаж",
  "Отдел маркетинга и дизайна",
  "Отдел сервиса",
];

interface OrgNode {
  key: string;
  title: string;
  department?: string;
  children?: OrgNode[];
}

function buildOrgTree(departments: Department[]): OrgNode[] {
  const roots: OrgNode[] = [];
  const byParent = new Map<string, Department[]>();

  for (const d of departments) {
    const parent = d.parent_name || "__root__";
    if (!byParent.has(parent)) byParent.set(parent, []);
    byParent.get(parent)!.push(d);
  }

  const sortChildren = (parentName: string, items: Department[]) => {
    if (parentName !== "Коммерческий отдел") return items;

    return [...items].sort((a, b) => {
      const ai = COMMERCIAL_CHILD_ORDER.indexOf(a.name);
      const bi = COMMERCIAL_CHILD_ORDER.indexOf(b.name);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });
  };

  const buildNode = (dept: Department): OrgNode => {
    const children = byParent.get(dept.name);
    const node: OrgNode = {
      key: dept.name,
      title: dept.name,
      department: dept.name,
      children: children ? sortChildren(dept.name, children).map(buildNode) : undefined,
    };
    return node;
  };

  const topLevel = byParent.get("__root__") || [];
  for (const d of topLevel) {
    roots.push(buildNode(d));
  }
  return roots;
}

interface TeamMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  role: string | null;
  email: string | null;
  phone?: string | null;
  birthday?: string | null;
  avatar_url?: string | null;
  department?: string[] | null;
  managed_departments: string[] | null;
}

function OrgItem({
  node,
  depth = 0,
  selectedKey,
  onSelect,
}: { node: OrgNode; depth?: number; selectedKey: string | null; onSelect: (node: OrgNode) => void }) {
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedKey === node.key;
  const Icon = getDeptIcon(node.title);
  const isAccordion = node.title === "Коммерческий отдел" && hasChildren;
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div>
      <button
        onClick={(e) => {
          onSelect(node);
          if (isAccordion) {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
          }
        }}
        className={`w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left transition-all group ${
          isSelected ? "bg-accent" : "hover:bg-accent/40"
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <div
          className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center"
          style={{ backgroundColor: `${BLUE1}15`, color: BLUE1 }}
        >
          <Icon className="w-3.5 h-3.5" />
        </div>
        <span
          className={`truncate text-xs font-medium transition-colors ${
            isSelected ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
          }`}
        >
          {node.title}
        </span>
        {isAccordion && (
          <ChevronDown
            className={`w-3.5 h-3.5 ml-1 flex-shrink-0 text-muted-foreground transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
          />
        )}
      </button>
      {hasChildren && !isAccordion && (
        <div className="border-l border-dashed border-border ml-5">
          {node.children!.map((child) => (
            <OrgItem key={child.key} node={child} depth={depth + 1} selectedKey={selectedKey} onSelect={onSelect} />
          ))}
        </div>
      )}
      {isAccordion && (
        <div
          className={`border-l border-dashed border-border ml-5 overflow-hidden transition-all duration-200 ${
            isOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          {node.children!.map((child) => (
            <OrgItem key={child.key} node={child} depth={depth + 1} selectedKey={selectedKey} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}

// Collect all department names from a node and its descendants
function collectDepartments(node: OrgNode): string[] {
  const result: string[] = [];
  if (node.department) result.push(node.department);
  if (node.children) {
    for (const child of node.children) {
      result.push(...collectDepartments(child));
    }
  }
  return result;
}

const TeamPanel = ({ node, onMemberClick }: { node: OrgNode | null; onMemberClick?: (member: TeamMember) => void }) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const fetchMembers = async () => {
    if (!node?.department) {
      setMembers([]);
      return;
    }
    setLoading(true);
    try {
      const deptNames = collectDepartments(node);
      // Fetch members that belong to any of the collected departments
      const { data, error } = await externalSupabase
        .from("profiles")
        .select("id, first_name, last_name, position, role, email, phone, birthday, avatar_url, department, managed_departments")
        .overlaps("department", deptNames);
      if (!error && data) {
        // Deduplicate by id
        const unique = Array.from(new Map((data as TeamMember[]).map(m => [m.id, m])).values());
        setMembers(unique);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [node?.department]);

  if (!node) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground/40">
        <div className="text-center">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-xs">Выберите отдел для просмотра команды</p>
        </div>
      </div>
    );
  }

  const leader = members.find((m) => m.managed_departments && m.managed_departments.length > 0 && m.managed_departments.includes(node!.department!));
  const team = members.filter((m) => m !== leader);

  const DeptIcon = getDeptIcon(node.title);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div
          className="w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${BLUE1}15`, color: BLUE1 }}
        >
          <DeptIcon className="w-4 h-4" />
        </div>
        <h3 className="text-sm font-semibold text-foreground truncate">{node.title}</h3>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-muted/30 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <p className="text-xs text-muted-foreground/50">Нет сотрудников в отделе</p>
      ) : (
        <>
          {leader && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-semibold mb-2">Руководитель</p>
              <MemberCard member={leader} isLeader department={node.department} onClick={() => onMemberClick ? onMemberClick(leader) : setSelectedMember(leader)} />
            </div>
          )}
          {team.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-semibold mb-2">
                Команда · {team.length}
              </p>
              <div className="space-y-1.5">
                {team.map((m) => (
                  <MemberCard key={m.id} member={m} department={node.department} onClick={() => onMemberClick ? onMemberClick(m) : setSelectedMember(m)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
      <EmployeeAccountModal
        member={selectedMember}
        open={!!selectedMember}
        onOpenChange={(open) => !open && setSelectedMember(null)}
        onUpdated={() => {
          setSelectedMember(null);
          fetchMembers();
        }}
      />
    </div>
  );
};

const MemberCard = ({ member, isLeader, department, onClick }: { member: TeamMember; isLeader?: boolean; department?: string; onClick?: () => void }) => {
  const initials = `${member.first_name?.[0] ?? ""}${member.last_name?.[0] ?? ""}`;
  const fullName = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || "—";
  const businessRole = department && member.managed_departments?.includes(department) ? `Руководитель ${department.startsWith("Отдел ") ? department.replace("Отдел ", "отдела ") : "отдела"}` : null;

  return (
    <div onClick={onClick} className={`flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors cursor-pointer ${isLeader ? "bg-accent/60" : "hover:bg-accent/30"}`}>
      <Avatar className="h-8 w-8 flex-shrink-0">
        {member.avatar_url && <AvatarImage src={member.avatar_url} />}
        <AvatarFallback
          className="text-[10px] font-medium"
          style={{ backgroundColor: `${BLUE1}15`, color: BLUE1 }}
        >
          {initials || <User className="w-3.5 h-3.5" />}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-foreground/85 truncate">{fullName}</p>
        <p className="text-[11px] text-muted-foreground/50 truncate">
          {[member.position, businessRole].filter(Boolean).join(" - ") || member.email || "—"}
        </p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0 -ml-[10%]">
        <button
          onClick={e => { e.stopPropagation(); }}
          className="p-1 rounded-md text-muted-foreground/40 hover:text-blue1 hover:bg-blue1/10 transition-colors"
        >
          <MessageCircle className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={e => { e.stopPropagation(); }}
          className="p-1 rounded-md text-muted-foreground/40 hover:text-blue1 hover:bg-blue1/10 transition-colors"
        >
          <PhoneCall className="w-3.5 h-3.5" />
        </button>
        {isLeader && <Crown className="w-3.5 h-3.5 flex-shrink-0" style={{ color: BLUE1 }} />}
      </div>
    </div>
  );
};

const AllEmployeesPanel = ({ onMemberClick }: { onMemberClick?: (member: TeamMember) => void }) => {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const { data, error } = await externalSupabase
        .from("profiles")
        .select("id, first_name, last_name, position, role, email, phone, birthday, avatar_url, department, managed_departments");
      if (!error && data) setMembers(data as TeamMember[]);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  // Group members by department
  const grouped = new Map<string, TeamMember[]>();
  for (const m of members) {
    const depts = m.department && m.department.length > 0 ? m.department : ["Без отдела"];
    for (const d of depts) {
      if (!grouped.has(d)) grouped.set(d, []);
      grouped.get(d)!.push(m);
    }
  }

  // Sort departments
  const DEPT_ORDER = ["Совет директоров", "Генеральный директор", "Финансовый отдел", "Коммерческий отдел", "Отдел закупки", "Отдел продаж", "Отдел маркетинга и дизайна", "Отдел сервиса", "HR отдел"];
  const sortedDepts = [...grouped.keys()].sort((a, b) => {
    const ai = DEPT_ORDER.indexOf(a);
    const bi = DEPT_ORDER.indexOf(b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return (
    <div className="p-4 space-y-4">
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted/30 rounded-lg animate-pulse" />)}
        </div>
      ) : members.length === 0 ? (
        <p className="text-xs text-muted-foreground/50">Нет сотрудников</p>
      ) : (
        sortedDepts.map(dept => {
          const deptMembers = grouped.get(dept)!;
          const DeptIcon = getDeptIcon(dept);
          return (
            <div key={dept}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${BLUE1}15`, color: BLUE1 }}>
                  <DeptIcon className="w-3 h-3" />
                </div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 font-semibold">
                  {dept} · {deptMembers.length}
                </p>
              </div>
              <div className="space-y-1.5">
                {deptMembers.map(m => (
                  <MemberCard key={`${dept}-${m.id}`} member={m} department={dept} onClick={() => onMemberClick ? onMemberClick(m) : setSelectedMember(m)} />
                ))}
              </div>
            </div>
          );
        })
      )}
      <EmployeeAccountModal
        member={selectedMember}
        open={!!selectedMember}
        onOpenChange={(open) => !open && setSelectedMember(null)}
        onUpdated={() => { setSelectedMember(null); fetchAll(); }}
      />
    </div>
  );
};

export type { TeamMember };

const CompanyStructure = ({ searchQuery = "", onMemberClick }: { searchQuery?: string; onMemberClick?: (member: TeamMember) => void }) => {
  const [selectedNode, setSelectedNode] = useState<OrgNode | null>(null);
  const [showAll, setShowAll] = useState(false);
  const { departments, isLoading } = useDepartments();
  const [allMembers, setAllMembers] = useState<TeamMember[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Fetch all members for search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setAllMembers([]);
      return;
    }
    const fetchAll = async () => {
      setSearchLoading(true);
      try {
        const { data } = await externalSupabase
          .from("profiles")
          .select("id, first_name, last_name, position, role, email, phone, birthday, avatar_url, department, managed_departments");
        if (data) setAllMembers(data as TeamMember[]);
      } catch { /* ignore */ } finally {
        setSearchLoading(false);
      }
    };
    fetchAll();
  }, [searchQuery]);

  const isSearching = searchQuery.trim().length > 0;

  const filteredMembers = isSearching
    ? allMembers.filter(m => {
        const q = searchQuery.toLowerCase();
        const fullName = `${m.first_name ?? ""} ${m.last_name ?? ""}`.toLowerCase();
        const role = (m.role ?? "").toLowerCase();
        const depts = (m.department ?? []).join(" ").toLowerCase();
        const managedDepts = (m.managed_departments ?? []).join(" ").toLowerCase();
        const position = (m.position ?? "").toLowerCase();
        const email = (m.email ?? "").toLowerCase();
        return fullName.includes(q) || role.includes(q) || depts.includes(q) || managedDepts.includes(q) || position.includes(q) || email.includes(q);
      })
    : [];

  const orgTree = buildOrgTree(departments);

  const STANDALONE_NAMES = ["Совет директоров", "Генеральный директор"];

  // Extract standalone nodes from any level of the tree
  const extractNodes = (nodes: OrgNode[]): { standalone: OrgNode[]; rest: OrgNode[] } => {
    const standalone: OrgNode[] = [];
    const rest: OrgNode[] = [];
    for (const node of nodes) {
      if (STANDALONE_NAMES.includes(node.title)) {
        // Add node itself as standalone (without children that are standalone)
        const { standalone: childStandalone, rest: childRest } = extractNodes(node.children || []);
        standalone.push({ ...node, children: childRest.length > 0 ? childRest : undefined });
        standalone.push(...childStandalone);
      } else {
        rest.push(node);
      }
    }
    return { standalone, rest };
  };

  const { standalone: standaloneNodes, rest: extractedRest } = extractNodes(orgTree);
  // Merge remaining children of standalone nodes with top-level non-standalone
  const treeNodes = [...extractedRest];
  // Also collect children of standalone nodes that aren't standalone themselves
  for (const sn of standaloneNodes) {
    if (sn.children) {
      treeNodes.push(...sn.children);
    }
  }
  // Remove children from standalone display (they go to treeNodes)
  const flatStandaloneNodes = standaloneNodes.map(n => ({ ...n, children: undefined }));

  // Custom sort order for departments
  const DEPT_ORDER = ["Финансовый отдел", "Коммерческий отдел", "HR отдел"];
  const sortedTreeNodes = [...treeNodes].sort((a, b) => {
    const ai = DEPT_ORDER.indexOf(a.title);
    const bi = DEPT_ORDER.indexOf(b.title);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-[0.85fr_1.15fr] gap-4">
      {/* Left — tree */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#007bff]" />
            <h2 className="text-sm font-semibold text-foreground flex-1">Структура компании</h2>
            <button
              onClick={() => { setShowAll(true); setSelectedNode(null); }}
              className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg transition-colors ${
                showAll ? "bg-blue1/10 text-blue1" : "text-muted-foreground hover:text-blue1 hover:bg-accent/40"
              }`}
            >
              <UsersRound className="w-3.5 h-3.5" />
              Все сотрудники
            </button>
          </div>
        </div>
        <div className="px-2.5 py-3 space-y-0.5">
          {isLoading ? (
            <div className="space-y-2 px-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-6 bg-muted/30 rounded animate-pulse" />
              ))}
            </div>
          ) : orgTree.length === 0 ? (
            <p className="text-xs text-muted-foreground/50 text-center py-4">Нет данных</p>
          ) : (
            <>
              {flatStandaloneNodes.length > 0 && (
                <div className="rounded-xl p-1.5">
                  {flatStandaloneNodes.map((node) => (
                    <OrgItem
                      key={node.key}
                      node={node}
                      selectedKey={showAll ? null : (selectedNode?.key ?? null)}
                      onSelect={(n) => { setShowAll(false); setSelectedNode(n); }}
                    />
                  ))}
                </div>
              )}
              {flatStandaloneNodes.length > 0 && sortedTreeNodes.length > 0 && (
                <div className="my-5 mx-1 h-px bg-border/40" />
              )}
              {sortedTreeNodes.length > 0 && (
                <div className="rounded-xl p-1.5">
                  {sortedTreeNodes.map((node) => (
                    <OrgItem
                      key={node.key}
                      node={node}
                      selectedKey={showAll ? null : (selectedNode?.key ?? null)}
                      onSelect={(n) => { setShowAll(false); setSelectedNode(n); }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Right — team panel */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden min-h-[200px]">
        <div className="px-4 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground">
              {isSearching ? `Результаты поиска · ${filteredMembers.length}` : showAll ? "Все сотрудники" : "Команда отдела"}
            </h2>
          </div>
        </div>
        {isSearching ? (
          <div className="p-4 space-y-1.5">
            {searchLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-10 bg-muted/30 rounded-lg animate-pulse" />)}
              </div>
            ) : filteredMembers.length === 0 ? (
              <p className="text-xs text-muted-foreground/50">Ничего не найдено</p>
            ) : (
              filteredMembers.map(m => (
                <MemberCard key={m.id} member={m} onClick={() => onMemberClick ? onMemberClick(m) : undefined} />
              ))
            )}
          </div>
        ) : showAll ? <AllEmployeesPanel onMemberClick={onMemberClick} /> : <TeamPanel node={selectedNode} onMemberClick={onMemberClick} />}
      </div>
    </div>
  );
};

export default CompanyStructure;
