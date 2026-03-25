import { useNavigate, useLocation } from "react-router-dom";
import { Wallet, Truck, BarChart3, User, Users, HardDrive, Mail, Megaphone, MessageCircle, ChevronRight, PanelLeftClose, PanelLeft } from "lucide-react";
import { useSidebarCollapse } from "@/contexts/SidebarContext";
import logoSvg from "@/assets/logo.svg";

interface NavItem { label: string; icon: React.ReactNode; active?: boolean; dot?: boolean; chevron?: boolean; href?: string; }

const Sidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { collapsed: isCollapsed, toggle } = useSidebarCollapse();

  const mainItems: NavItem[] = [{ label: "Мой рабочий стол", icon: null, dot: true, href: "/" }];

  const projectItems: NavItem[] = [
    { label: "Фин. отдел", icon: <Wallet size={18} />, href: "/finance" },
    { label: "Отдел закупок", icon: <Truck size={18} />, href: "/procurement" },
    { label: "Отдел продаж", icon: <BarChart3 size={18} />, href: "/sales" },
    { label: "Отдел маркетинга", icon: <Megaphone size={18} />, href: "/marketing" },
    { label: "Отдел HR", icon: <Users size={18} />, href: "/hr" },
  ];

  const pageItems: NavItem[] = [
    { label: "Мой аккаунт", icon: <User size={18} />, href: "/account", chevron: true },
    { label: "Диск компании", icon: <HardDrive size={18} />, href: "/disk" },
    { label: "Почта", icon: <Mail size={18} /> },
    { label: "Чаты", icon: <MessageCircle size={18} /> },
  ];

  const renderItem = (item: NavItem) => {
    const isActive = item.href ? location.pathname === item.href : false;
    return (
      <button
        key={item.label}
        onClick={() => item.href ? navigate(item.href) : undefined}
        title={isCollapsed ? item.label : undefined}
        className={`group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 ${
          isActive ? "bg-[hsl(211,100%,50%)] font-medium text-white" : "text-muted-foreground hover:bg-[#007bff]/[0.06] hover:text-foreground"
        } ${isCollapsed ? "justify-center" : ""}`}
      >
        {item.dot && !isCollapsed && <span className={`mr-[-4px] h-1.5 w-1.5 rounded-full ${isActive ? "bg-green-500 opacity-100" : "bg-blue1 opacity-100"}`} />}
        {item.dot && isCollapsed && <span className={`h-1.5 w-1.5 rounded-full ${isActive ? "bg-green-500 opacity-100" : "bg-blue1 opacity-100"}`} />}
        {item.icon && (
          <span className={isActive ? "text-white" : "text-muted-foreground group-hover:text-[#007bff] transition-all duration-200"}>{item.icon}</span>
        )}
        {!isCollapsed && <span className="flex-1 whitespace-nowrap text-left text-xs">{item.label}</span>}
        {!isCollapsed && item.chevron && <ChevronRight size={14} className={isActive ? "text-white" : "text-muted-foreground"} />}
      </button>
    );
  };

  return (
    <aside className={`fixed left-0 top-0 flex h-screen flex-col border-r border-border bg-card transition-all duration-200 ${isCollapsed ? "w-[60px]" : "w-[var(--sidebar-width)]"}`}>
      <div className={`flex items-center gap-3 bg-card ${isCollapsed ? "justify-center px-2 py-5" : "px-6 py-5"}`}>
        <img src={logoSvg} alt="Element App" className="h-6 w-6 shrink-0" />
        {!isCollapsed && <span className="text-xs font-semibold tracking-tight">Element App</span>}
      </div>

      <nav className={`flex-1 space-y-4 overflow-y-auto bg-card ${isCollapsed ? "px-1.5 py-2" : "px-3 py-2"}`}>
        <div>
          {!isCollapsed && <p className="mb-2 px-3 text-xs text-muted-foreground opacity-50">Основные</p>}
          {mainItems.map(renderItem)}
        </div>
        <div>
          {!isCollapsed && <p className="mb-2 px-3 text-xs text-muted-foreground opacity-50">Проекты</p>}
          {projectItems.map(renderItem)}
        </div>
        <div>
          {!isCollapsed && <p className="mb-2 px-3 text-xs text-muted-foreground opacity-50">Настройки</p>}
          {pageItems.map(renderItem)}
        </div>
      </nav>

      <div className={`border-t border-border bg-card ${isCollapsed ? "px-1.5 py-3" : "px-3 py-3"}`}>
        <button onClick={toggle} className="group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-all duration-200 hover:bg-[#007bff]/[0.06] hover:text-foreground">
          {isCollapsed ? (
            <PanelLeft size={18} className="mx-auto text-muted-foreground group-hover:text-[#007bff] transition-all duration-200" />
          ) : (
            <>
              <PanelLeftClose size={18} className="text-muted-foreground group-hover:text-[#007bff] transition-all duration-200" />
              <span className="text-xs">Свернуть</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
