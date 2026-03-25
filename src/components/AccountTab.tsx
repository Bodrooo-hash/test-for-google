import { useState, useRef, useEffect } from "react";
import { useSupabaseProfile, ProfileData } from "@/hooks/useSupabaseProfile";
import { useAuth } from "@/contexts/AuthContext";
import OnlineAvatar from "@/components/OnlineAvatar";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Phone, Cake, Building2, UserCircle, Briefcase, Pencil, Check, X, Camera, Settings, LogOut, Copy, Crown, Shield } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import MultiDepartmentSelect from "@/components/MultiDepartmentSelect";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { format, parse } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { externalSupabase } from "@/lib/externalSupabase";
import { useDepartmentManagers } from "@/hooks/useDepartmentManagers";

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  copyable?: boolean;
}

const InfoRow = ({ icon, label, value, copyable }: InfoRowProps) => {
  const [expanded, setExpanded] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const el = textRef.current;
    if (el) setIsTruncated(el.scrollWidth > el.clientWidth);
  }, [value]);

  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
      toast.success("Скопировано");
    }
  };

  return (
    <div className="flex items-start gap-3 py-2.5 group">
      <div className="text-muted-foreground/60 mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground/60">{label}</p>
        <div className="flex items-center gap-1.5">
          <p
            ref={textRef}
            onClick={() => isTruncated && !expanded && setExpanded(true)}
            className={cn(
              "text-sm transition-colors",
              expanded ? "whitespace-normal break-words" : "truncate",
              isTruncated && !expanded && "cursor-pointer",
              copyable && value ? "group-hover:text-blue1 text-foreground/85" : "text-foreground/85 hover:text-blue1"
            )}
          >
            {value || "—"}
          </p>
          {copyable && value && (
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-blue1 transition-all cursor-pointer flex-shrink-0"
            >
              <Copy size={12} />
            </button>
          )}
        </div>
        {expanded && (
          <button
            onClick={() => setExpanded(false)}
            className="text-[10px] text-blue1 hover:text-blue1/70 transition-colors mt-0.5"
          >
            Свернуть
          </button>
        )}
      </div>
    </div>
  );
};

const AccountTab = () => {
  const { data: profile, isLoading, refetch } = useSupabaseProfile();
  const { getRoleInfo } = useDepartmentManagers(profile?.id);
  const [loadProgress, setLoadProgress] = useState(0);
  const { signOut } = useAuth();

  useEffect(() => {
    if (isLoading) {
      setLoadProgress(0);
      const t1 = setTimeout(() => setLoadProgress(45), 80);
      const t2 = setTimeout(() => setLoadProgress(65), 400);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    } else {
      setLoadProgress(100);
      const t = setTimeout(() => setLoadProgress(0), 300);
      return () => clearTimeout(t);
    }
  }, [isLoading]);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    position: "",
    role: "",
    phone: "",
    department: [] as string[],
    managedDepartments: [] as string[],
  });
  const [birthday, setBirthday] = useState<Date | undefined>();
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const handleLogout = async () => {
    await signOut();
    window.location.href = "/login";
  };

  const startEdit = () => {
    if (!profile) return;
    setForm({
      firstName: profile.first_name || "",
      lastName: profile.last_name || "",
      position: profile.position || "",
      role: profile.role || "",
      phone: profile.phone || "",
      department: profile.department || [],
      managedDepartments: profile.managed_departments || [],
    });
    setBirthday(profile.birthday ? parse(profile.birthday, "yyyy-MM-dd", new Date()) : undefined);
    setPhotoPreview(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setPhotoPreview(null);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    // Instant preview
    setPhotoPreview(URL.createObjectURL(file));
    setUploadingPhoto(true);

    try {
      const path = `${profile.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await externalSupabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = externalSupabase.storage
        .from("avatars")
        .getPublicUrl(path);

      const { error: updateErr } = await externalSupabase
        .from("profiles")
        .update({ avatar_url: urlData.publicUrl })
        .eq("id", profile.id);
      if (updateErr) throw updateErr;

      toast.success("Фото обновлено");
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Ошибка загрузки фото");
      setPhotoPreview(null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const { error } = await externalSupabase
        .from("profiles")
        .update({
          first_name: form.firstName || null,
          last_name: form.lastName || null,
          position: form.position || null,
          role: form.role || null,
          phone: form.phone || null,
          department: form.department.length > 0 ? form.department : null,
          managed_departments: form.managedDepartments.length > 0 ? form.managedDepartments : null,
          birthday: birthday ? format(birthday, "yyyy-MM-dd") : null,
        })
        .eq("id", profile.id);

      if (error) throw error;

      toast.success("Профиль обновлён");
      setEditing(false);
      refetch();
    } catch (err: any) {
      toast.error(err.message || "Ошибка при сохранении");
    } finally {
      setSaving(false);
    }
  };

  const fullName = profile
    ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "—"
    : "—";
  const initials = profile
    ? `${profile.first_name?.[0] ?? ""}${profile.last_name?.[0] ?? ""}`
    : "?";
  const displayPhoto = photoPreview || profile?.avatar_url;
  const formattedBirthday = profile?.birthday
    ? format(parse(profile.birthday, "yyyy-MM-dd", new Date()), "d MMMM", { locale: ru })
    : "";

  return (
    <div className="max-w-xl">
      <div className="border border-border rounded-2xl bg-card overflow-hidden relative">
        {/* Full overlay loader */}
        {isLoading && (
          <div className="absolute inset-0 z-30 rounded-2xl bg-card flex flex-col items-center justify-center gap-3">
            <div className="w-32 h-[3px] bg-muted/30 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-blue1"
                style={{
                  width: `${loadProgress}%`,
                  transition: loadProgress === 0 ? 'none' : loadProgress < 70 ? 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)' : 'width 0.25s ease-out',
                }}
              />
            </div>
            <p className="text-sm text-muted-foreground">Загрузка, подождите...</p>
          </div>
        )}
        {/* Settings button */}
        <div className="absolute top-4 right-4 z-10">
          {!editing ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground/60 transition-colors">
                  <Settings size={15} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[180px]">
                <DropdownMenuItem onClick={startEdit} className="gap-2 text-xs cursor-pointer hover:!text-blue1 focus:!text-blue1">
                  <Pencil size={13} />
                  Изменить контактную информацию
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="gap-2 text-xs cursor-pointer text-destructive focus:text-destructive focus:bg-destructive/10 hover:bg-destructive/10 hover:text-destructive">
                  <LogOut size={13} />
                  Выйти
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {/* Header with avatar */}
        <div className="p-6 pb-4 flex items-center gap-4">
          <div className="relative group">
            <OnlineAvatar
              userId={profile?.id}
              src={displayPhoto}
              fallback={initials}
              className="h-16 w-16 transition-shadow group-hover:ring-2 group-hover:ring-blue1 group-hover:ring-offset-0"
              dotClassName="h-3.5 w-3.5"
            />
            {/* Hover overlay for photo change */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute top-0 left-0 h-16 w-16 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
            >
              {uploadingPhoto ? (
                <div className="h-4 w-4 border-2 border-blue1 border-t-transparent rounded-full animate-spin" />
              ) : (
                <Camera size={18} className="text-white" />
              )}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
          </div>
          <div>
            {editing ? (
              <h2 className="text-base font-semibold text-blue1">Редактирование профиля</h2>
            ) : (
              <h2 className="text-lg font-semibold text-blue1">{fullName}</h2>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">Контактная информация</p>
          </div>
        </div>

        {/* Info rows — view mode */}
        {!editing && (
          <div className="px-6 pb-6">
            <InfoRow icon={<UserCircle size={18} />} label="Имя Фамилия" value={fullName} />
            <InfoRow icon={<Shield size={18} />} label="Системная должность" value={profile?.role || ""} />
            <InfoRow icon={<Briefcase size={18} />} label="Должность" value={profile?.position || ""} />
            <InfoRow icon={<Crown size={18} />} label="Руководитель в" value={profile?.managed_departments?.join(", ") || ""} />
            <InfoRow icon={<Building2 size={18} />} label="Отдел" value={profile?.department?.join(", ") || ""} />
            <InfoRow icon={<Mail size={18} />} label="Почта" value={profile?.email || ""} copyable />
            <InfoRow icon={<Phone size={18} />} label="Телефон" value={profile?.phone || ""} copyable />
            <InfoRow icon={<Cake size={18} />} label="День рождения" value={formattedBirthday} />
          </div>
        )}

        {/* Edit form */}
        {editing && (
          <div className="px-6 pb-6">
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground/50">Имя</Label>
                  <Input value={form.firstName} onChange={e => setForm(p => ({ ...p, firstName: e.target.value }))} placeholder="Имя" />
                </div>
                <div className="grid gap-1.5">
                  <Label className="text-xs text-muted-foreground/50">Фамилия</Label>
                  <Input value={form.lastName} onChange={e => setForm(p => ({ ...p, lastName: e.target.value }))} placeholder="Фамилия" />
                </div>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground/50">Системная должность</Label>
                <Select value={form.role} onValueChange={v => setForm(p => ({ ...p, role: v }))}>
                  <SelectTrigger><SelectValue placeholder="Выберите системную роль" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Администратор">Администратор</SelectItem>
                    <SelectItem value="Сотрудник">Сотрудник</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground/50">Должность</Label>
                <Input value={form.position} onChange={e => setForm(p => ({ ...p, position: e.target.value }))} placeholder="Введите должность" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground/50">Руководитель в</Label>
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
                <Label className="text-xs text-muted-foreground/50">Отдел</Label>
                <MultiDepartmentSelect
                  value={form.department}
                  onChange={v => setForm(p => ({ ...p, department: v, managedDepartments: p.managedDepartments.filter(d => v.includes(d)) }))}
                  getRoleInfo={getRoleInfo}
                />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground/50">Телефон</Label>
                <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} placeholder="+7 (999) 999-99-99" />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground/50">День рождения</Label>
                <Input
                  value={birthday ? format(birthday, "dd.MM.yyyy") : ""}
                  onChange={e => {
                    const val = e.target.value;
                    const parsed = parse(val, "dd.MM.yyyy", new Date());
                    if (!isNaN(parsed.getTime()) && parsed.getFullYear() >= 1950) {
                      setBirthday(parsed);
                    } else if (val === "") {
                      setBirthday(undefined);
                    }
                  }}
                  placeholder="дд.мм.гггг"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={cancelEdit} className="w-[30%] flex items-center justify-center gap-1 py-2 rounded-lg text-xs text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors">
                  <X size={13} />
                  Отмена
                </button>
                <button onClick={handleSave} disabled={saving} className="w-[70%] flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium bg-blue1 text-white hover:bg-blue1/90 transition-colors disabled:opacity-50">
                  <Check size={13} />
                  {saving ? "..." : "Сохранить"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountTab;
