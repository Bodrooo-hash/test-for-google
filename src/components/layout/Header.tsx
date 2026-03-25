import { useState, useEffect } from "react";
import { Sun, Moon, Bell, PanelRight, PanelLeft } from "lucide-react";
import { useSidebarCollapse } from "@/contexts/SidebarContext";

interface HeaderProps {
  breadcrumbs?: { label: string; href?: string }[];
}

const Header = ({ breadcrumbs = [] }: HeaderProps) => {
  const { toggle } = useSidebarCollapse();
  const [now, setNow] = useState(new Date());
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleTheme = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  const weekday = now.toLocaleDateString("ru-RU", { weekday: "short" });
  const dateStr = now.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
  const timeStr = new Date(
    now.toLocaleString("en-US", { timeZone: "Europe/Moscow" })
  ).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false });
  const gzTimeStr = new Date(
    now.toLocaleString("en-US", { timeZone: "Asia/Shanghai" })
  ).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-6 bg-card">
      <div className="flex items-center gap-3">
        <button onClick={toggle} className="text-muted-foreground hover:text-foreground transition-colors">
          <PanelLeft size={18} />
        </button>
        <nav className="flex items-center gap-2 text-xs">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-2">
              {i > 0 && <span className="text-muted-foreground">/</span>}
              {crumb.href ? (
                <a href={crumb.href} className="text-muted-foreground hover:text-foreground transition-colors text-xs">{crumb.label}</a>
              ) : (
                <span className="text-xs" style={{ color: "#0077ff" }}>{crumb.label}</span>
              )}
            </span>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-0">
        <div className="flex items-center gap-0">
          <div className="flex items-center gap-1 px-1.5 py-1">
            <span className="text-xs text-muted-foreground capitalize">{weekday},</span>
            <span className="text-xs text-muted-foreground">{dateStr}</span>
          </div>
          <span className="text-xs text-muted-foreground">/</span>
          <div className="flex items-center gap-1 px-1.5 py-1">
            <span className="text-xs text-muted-foreground">{timeStr}</span>
            <span className="text-xs text-muted-foreground">MSK</span>
          </div>
          <div className="flex items-center gap-1 px-1.5 py-1">
            <span className="text-xs text-muted-foreground">{gzTimeStr}</span>
            <span className="text-xs text-muted-foreground">CST</span>
          </div>
          <span className="text-xs text-muted-foreground">/</span>
          <div className="flex items-center gap-1 px-1.5 py-1">
            <span className="text-xs text-muted-foreground">USD</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">EUR</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">CNY</span>
          </div>
        </div>

        <div className="flex items-center gap-4 ml-4">
          <button onClick={toggleTheme} className="text-muted-foreground hover:text-foreground transition-colors">
            {dark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <Bell size={18} />
          </button>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <PanelRight size={18} />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
