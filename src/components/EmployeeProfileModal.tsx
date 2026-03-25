import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Mail, Phone, Cake, Building2, UserCircle, Briefcase, Crown, User, Copy } from "lucide-react";
import { format, parse } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const BLUE1 = "#0079FF";

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

  if (!value) return null;

  return (
    <div className="flex items-center gap-3 py-2.5 group">
      <div className="text-muted-foreground/60">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground/60">{label}</p>
        <div className="flex items-center gap-1.5">
          <p className={cn("text-sm truncate transition-colors", copyable ? "group-hover:text-blue1 text-foreground/85" : "text-foreground/85")}>{value}</p>
          {copyable && (
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

interface EmployeeProfileModalProps {
  member: EmployeeProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EmployeeProfileModal = ({ member, open, onOpenChange }: EmployeeProfileModalProps) => {
  if (!member) return null;

  const fullName = `${member.first_name ?? ""} ${member.last_name ?? ""}`.trim() || "—";
  const initials = `${member.first_name?.[0] ?? ""}${member.last_name?.[0] ?? ""}`;
  const formattedBirthday = member.birthday
    ? format(parse(member.birthday, "yyyy-MM-dd", new Date()), "d MMMM", { locale: ru })
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="p-6 pb-4 flex items-center gap-4">
          <Avatar className="h-16 w-16 flex-shrink-0">
            {member.avatar_url && <AvatarImage src={member.avatar_url} />}
            <AvatarFallback
              className="text-sm font-medium"
              style={{ backgroundColor: `${BLUE1}15`, color: BLUE1 }}
            >
              {initials || <User className="w-5 h-5" />}
            </AvatarFallback>
          </Avatar>
          <div>
            <h2 className="text-lg font-semibold text-blue1">{fullName}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Контактная информация</p>
          </div>
        </div>

        {/* Info rows */}
        <div className="px-6 pb-6">
          <InfoRow icon={<Briefcase size={18} />} label="Должность" value={member.position || ""} />
          <InfoRow icon={<Crown size={18} />} label="Руководитель в" value={member.managed_departments?.join(", ") || ""} />
          <InfoRow icon={<Building2 size={18} />} label="Отдел" value={member.department?.join(", ") || ""} />
          <InfoRow icon={<Mail size={18} />} label="Почта" value={member.email || ""} copyable />
          <InfoRow icon={<Phone size={18} />} label="Телефон" value={member.phone || ""} copyable />
          <InfoRow icon={<Cake size={18} />} label="День рождения" value={formattedBirthday} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmployeeProfileModal;
