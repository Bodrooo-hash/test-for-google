import { useState } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import CompanyStructure from "@/components/CompanyStructure";
import type { TeamMember } from "@/components/CompanyStructure";
import PageControl from "@/components/PageControl";
import { useSidebarCollapse } from "@/contexts/SidebarContext";
import AccountTab from "@/components/AccountTab";
import MyTeamTab from "@/components/MyTeamTab";
import { UserPlus, ChevronDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MultiDepartmentSelect from "@/components/MultiDepartmentSelect";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { externalSupabase } from "@/lib/externalSupabase";
import { useDepartmentManagers } from "@/hooks/useDepartmentManagers";

const tabs = ["Мой аккаунт", "Моя команда", "Структура компании"];

const FixedPageControl = ({ total, current, onSelect }: { total: number; current: number; onSelect: (i: number) => void }) => {
  const { collapsed } = useSidebarCollapse();
  return (
    <div
      className="fixed bottom-6 right-0 z-30 px-6 pointer-events-none transition-all duration-200"
      style={{ left: collapsed ? 60 : 'var(--sidebar-width)' }}
    >
      <div className="pointer-events-auto inline-block">
        <PageControl total={total} current={current} onSelect={onSelect} />
      </div>
    </div>
  );
};


const CompanyStructureTab = ({ onMemberClick }: { onMemberClick?: (member: TeamMember) => void }) => {
  const [open, setOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", position: "", department: [] as string[], managedDepartments: [] as string[], role: "", email: "", phone: "", password: "" });
  const [birthday, setBirthday] = useState<Date>();
  const { getRoleInfo } = useDepartmentManagers();

  const handleChange = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const resetForm = () => {
    setForm({ firstName: "", lastName: "", position: "", department: [], managedDepartments: [], role: "", email: "", phone: "", password: "" });
    setBirthday(undefined);
  };

  const handleSubmit = async () => {
    if (!form.firstName || !form.lastName || !form.email || !form.password || !form.role) {
      toast.error("Заполните обязательные поля (имя, фамилия, почта, пароль, права доступа)");
      return;
    }

    setLoading(true);
    try {
      const { data: currentSession } = await externalSupabase.auth.getSession();

      const { data: authData, error: authError } = await externalSupabase.auth.signUp({
        email: form.email,
        password: form.password,
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Не удалось создать пользователя");

      const { error: profileError } = await externalSupabase.from("profiles").insert({
        id: authData.user.id,
        email: form.email,
        first_name: form.firstName,
        last_name: form.lastName,
        position: form.position || null,
        department: form.department.length > 0 ? form.department : null,
        managed_departments: form.managedDepartments.length > 0 ? form.managedDepartments : null,
        role: form.role,
        phone: form.phone || null,
        birthday: birthday ? format(birthday, "yyyy-MM-dd") : null,
      });

      if (profileError) throw profileError;

      if (currentSession?.session) {
        await externalSupabase.auth.setSession(currentSession.session);
      }

      toast.success("Сотрудник успешно зарегистрирован");
      resetForm();
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Ошибка при регистрации");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {!open && (
        <div className="mb-4 flex items-center gap-2">
          <Button onClick={() => setOpen(true)} size="sm" className="gap-1.5 h-8 px-3 text-xs bg-blue1 hover:bg-blue1/90 text-white">
            <UserPlus size={14} />
            Регистрация нового сотрудника
          </Button>
          {searchOpen ? (
            <div className="relative w-56">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                autoFocus
                placeholder="Поиск сотрудника..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onBlur={() => { if (!searchQuery) setSearchOpen(false); }}
                className="h-8 pl-8 text-xs"
              />
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={16} />
            </Button>
          )}
        </div>
      )}

      <CompanyStructure searchQuery={searchQuery} onMemberClick={onMemberClick} />

      <div className="mt-6">
        {open && (
          <div className="border border-border rounded-2xl bg-card overflow-hidden mb-4 max-h-[70vh] flex flex-col">
            <div className="sticky top-0 z-10 bg-card px-6 pt-6 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-blue1 mb-1 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue1 inline-block shrink-0" />Регистрация сотрудника</h3>
                  <p className="text-xs text-muted-foreground">Заполните данные нового сотрудника</p>
                </div>
                <button onClick={() => setOpen(false)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground/60 transition-colors self-start">
                  <ChevronDown size={14} />
                  Скрыть форму
                </button>
              </div>
            </div>
            <div className="p-6 pt-4 overflow-y-auto">
              <div className="grid gap-4">
                {[
                  { id: "firstName", label: "Имя *", placeholder: "Введите имя" },
                  { id: "lastName", label: "Фамилия *", placeholder: "Введите фамилию" },
                  { id: "position", label: "Должность", placeholder: "Введите должность" },
                ].map(({ id, label, placeholder }) => (
                  <div key={id} className="grid gap-1.5">
                    <Label htmlFor={id} className="text-xs text-muted-foreground/50">{label}</Label>
                    <Input id={id} placeholder={placeholder} value={form[id as keyof typeof form]} onChange={e => handleChange(id, e.target.value)} />
                  </div>
                ))}

                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground/50">Отдел</Label>
                  <MultiDepartmentSelect
                    value={form.department}
                    onChange={v => setForm(p => ({ ...p, department: v, managedDepartments: p.managedDepartments.filter(d => v.includes(d)) }))}
                    getRoleInfo={getRoleInfo}
                  />
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground/50">Руководитель в отделах</Label>
                  <MultiDepartmentSelect
                    value={form.managedDepartments}
                    onChange={v => setForm(p => ({ ...p, managedDepartments: v }))}
                    placeholder="Выберите отделы для руководства"
                    availableDepartments={form.department}
                    getRoleInfo={getRoleInfo}
                  />
                  {form.department.length > 0 && (
                    <p className="text-[10px] text-muted-foreground/40">Доступны только отделы, в которых состоит сотрудник</p>
                  )}
                </div>

                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground/50">Системная роль *</Label>
                  <Select value={form.role} onValueChange={v => handleChange("role", v)}>
                    <SelectTrigger><SelectValue placeholder="Выберите системную роль" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Администратор">Администратор</SelectItem>
                      <SelectItem value="Сотрудник">Сотрудник</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {[
                  { id: "email", label: "Почта *", placeholder: "example@elllement.ru", type: "text" },
                  { id: "password", label: "Пароль *", placeholder: "Минимум 6 символов", type: "password" },
                  { id: "phone", label: "Телефон", placeholder: "+7 (999) 999-99-99", type: "text" },
                ].map(({ id, label, placeholder, type }) => (
                  <div key={id} className="grid gap-1.5">
                    <Label htmlFor={id} className="text-xs text-muted-foreground/50">{label}</Label>
                    <Input id={id} type={type} placeholder={placeholder} value={form[id as keyof typeof form]} onChange={e => handleChange(id, e.target.value)} />
                  </div>
                ))}

                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground/50">День рождения</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !birthday && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {birthday ? format(birthday, "dd.MM.yyyy") : "Выберите дату"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={birthday}
                        onSelect={setBirthday}
                        locale={ru}
                        captionLayout="dropdown-buttons"
                        fromYear={1950}
                        toYear={new Date().getFullYear()}
                        className="p-3 pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => { resetForm(); setOpen(false); }}>Отмена</Button>
                  <Button onClick={handleSubmit} disabled={loading} className="bg-blue1 hover:bg-blue1/90 text-white">
                    {loading ? "Регистрация..." : "Зарегистрировать"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Account = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  const handleMemberClick = (member: TeamMember) => {
    setSelectedMember(member);
    setActiveTab(1);
  };

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Настройки", href: "#" },
        { label: "Мой аккаунт" },
      ]}
    >
      <div className="flex h-[calc(100dvh-6.5rem)] flex-col">
        <div className="flex items-center gap-1">
          <div>
            <div className="inline-flex items-center gap-0 rounded-lg bg-foreground/[0.03] p-1">
              {tabs.map((label, i) => (
                <button
                  key={i}
                  onClick={() => setActiveTab(i)}
                  className={`px-5 py-2 rounded-lg transition-all ${
                    activeTab === i
                      ? "bg-card text-foreground/85 shadow-sm"
                      : "text-foreground/40 hover:text-foreground/60"
                  }`}
                  style={{ fontSize: 13, fontWeight: 500 }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 flex-1 min-h-0 overflow-y-auto">
          {activeTab === 0 && <AccountTab />}
          {activeTab === 1 && (
            selectedMember ? (
              <MyTeamTab member={selectedMember} onBack={() => { setSelectedMember(null); setActiveTab(2); }} />
            ) : (
              <div className="border border-border rounded-2xl p-6 bg-card">
                <p className="text-sm text-muted-foreground">Выберите сотрудника в разделе «Структура компании»</p>
              </div>
            )
          )}
          {activeTab === 2 && <CompanyStructureTab onMemberClick={handleMemberClick} />}
        </div>

        <FixedPageControl total={tabs.length} current={activeTab} onSelect={setActiveTab} />
      </div>
    </DashboardLayout>
  );
};

export default Account;
