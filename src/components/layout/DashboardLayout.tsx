import Sidebar from "./Sidebar";
import Header from "./Header";
import { SidebarCollapseProvider, useSidebarCollapse } from "@/contexts/SidebarContext";

interface DashboardLayoutProps {
  children?: React.ReactNode;
  breadcrumbs?: { label: string; href?: string }[];
}

const DashboardContent = ({ children, breadcrumbs }: DashboardLayoutProps) => {
  const { collapsed } = useSidebarCollapse();
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className={`transition-all duration-200 ${collapsed ? "ml-[60px]" : "ml-[var(--sidebar-width)]"}`}>
        <Header breadcrumbs={breadcrumbs} />
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
};

const DashboardLayout = (props: DashboardLayoutProps) => (
  <SidebarCollapseProvider>
    <DashboardContent {...props} />
  </SidebarCollapseProvider>
);

export default DashboardLayout;
