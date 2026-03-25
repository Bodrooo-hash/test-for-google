import { useState, useRef } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Phone, Cake, Building2, UserCircle, Briefcase, Pencil, Check, X, Camera, Copy, Crown, Shield, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MultiDepartmentSelect from "@/components/MultiDepartmentSelect";
import { format, parse } from "date-fns";
import { ru } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { externalSupabase } from "@/lib/externalSupabase";
import { useDepartmentManagers } from "@/hooks/useDepartmentManagers";
import OnlineAvatar from "@/components/OnlineAvatar";

interface EmployeeProfile {
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
  managed_departments?: string[] | null;
}

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  copyable?: boolean;
}

const InfoRow = ({ icon, label, value, copyable }: InfoRowProps) => {
  const handleCopy = () => {
    if (value) {
      navigator.clipboard.writeText(value);
      toast.success("Скопировано");
    }
  };

  return (
    <div className="flex items-center gap-3 py-2.5 group">
      <div className="text-muted-foreground/60">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground/60">{label}</p>
        <div className="flex items-center gap-1.5">
          <p className={cn("text-sm truncate transition-colors", copyable && value ? "group-hover:text-blue1 text-foreground/85" : "text-foreground/85")}>{value || "—"}</p>
          {copyable && value && (
            <button
              onClick={handleCopy}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-blue1 transition-all cursor-pointer"
            >
              <Copy size={12} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

interface EmployeeAccountModalProps {
  member: EmployeeProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated?: () => void;
}

const EmployeeAccountModal = ({ member, open, onOpenChange, onUpdated }: EmployeeAccountModalProps) => {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { getRoleInfo } = useDepartmentManagers(member?.id);

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

  if (!member) return null;

  const fullName = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || "—";
  const initials = `${member.first_name?.[0] ?? ""}${member.last_name?.[0] ?? ""}`;
  const displayPhoto = photoPreview || member.avatar_url;
  const formattedBirthday = member.birthday
    ? format(parse(member.birthday, "yyyy-MM-dd", new Date()), "d MMMM", { locale: ru })
    : "";

  const startEdit = () => {
    if (!member) return;
    setForm({
      firstName: member.first_name || "",
      lastName: member.last_name || "",
      position: member.position || "",
      role: member.role || "",
      phone: member.phone || "",
      department: member.department || [],
      managedDepartments: member.managed_departments || [],
    });
    setBirthday(member.birthday ? parse(member.birthday, "yyyy-MM-dd", new Date()) : undefined);
    setPhotoPreview(null);
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setPhotoPreview(null);
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !member) return;
    setPhotoPreview(URL.createObjectURL(file));
    setUploadingPhoto(true);
    try {
      const path = `${member.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await externalSupabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = externalSupabase.storage.from("avatars").getPublicUrl(path);
      const { error: updateErr } = await externalSupabase
        .from("profiles")
        .update({ avatar_url: urlData.publicUrl })
        .eq("id", member.id);
      if (updateErr) throw updateErr;
      toast.success("Фото обновлено");
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Ошибка загрузки фото");
      setPhotoPreview(null);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = async () => {
    if (!member) return;
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
        .eq("id", member.id);
      if (error) throw error;
      toast.success("Профиль обновлён");
      setEditing(false);
      onUpdated?.();
    } catch (err: any) {
      toast.error(err.message || "Ошибка при сохранении");
    } finally {
      setSaving(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) {
      setEditing(false);
      setPhotoPreview(null);
    }
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-xl p-0 gap-0 rounded-2xl overflow-hidden">
        <div className="relative">
          {/* Edit button */}
          {!editing && (
            <div className="absolute top-4 right-4 z-10">
              <button
                onClick={startEdit}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-blue1 transition-colors"
              >
                <Pencil size={13} />
                Редактировать
              </button>
            </div>
          )}

          {/* Header with avatar */}
          <div className="p-6 pb-4 flex items-center gap-4">
            <div className="relative group">
              <OnlineAvatar
                userId={member.id}
                src={displayPhoto}
                fallback={initials || "?"}
                className="h-16 w-16 transition-shadow group-hover:ring-2 group-hover:ring-blue1 group-hover:ring-offset-0"
                dotClassName="h-3.5 w-3.5"
              />
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

          {/* View mode */}
          {!editing && (
            <div className="px-6 pb-6">
              <InfoRow icon={<UserCircle size={18} />} label="Имя Фамилия" value={fullName} />
              <InfoRow icon={<Shield size={18} />} label="Системная должность" value={member.role || ""} />
              <InfoRow icon={<Briefcase size={18} />} label="Должность" value={member.position || ""} />
              <InfoRow icon={<Crown size={18} />} label="Руководитель в" value={member.managed_departments?.join(", ") || ""} />
              <InfoRow icon={<Building2 size={18} />} label="Отдел" value={member.department?.join(", ") || ""} />
              <InfoRow icon={<Mail size={18} />} label="Почта" value={member.email || ""} copyable />
              <InfoRow icon={<Phone size={18} />} label="Телефон" value={member.phone || ""} copyable />
              <InfoRow icon={<Cake size={18} />} label="День рождения" value={formattedBirthday} />
            </div>
          )}

          {/* Edit mode */}
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
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeAccountModal;
