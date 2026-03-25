import { useState, useMemo } from "react";
import DashboardLayout from "@/components/layout/DashboardLayout";
import EventCalendar from "@/components/EventCalendar";

import DepartmentTree from "@/components/DepartmentTree";
import TasksBlock from "@/components/TasksBlock";
import ProjectTaskCard, { type SelectedProject } from "@/components/ProjectTaskCard";
import TaskDetailView from "@/components/TaskDetailView";
import FinanceChat from "@/components/FinanceChat";
import CompanyDisk, { encodeFolderName } from "@/components/CompanyDisk";
import PageControl from "@/components/PageControl";

import { useSidebarCollapse } from "@/contexts/SidebarContext";
import type { Bitrix24Task, Bitrix24User } from "@/lib/bitrix24";

const tabs = ["Обзор", "Задачи", "Календарь", "Диск", "Чат отдела"];

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

const Index = () => {
  const [activeTab, setActiveTab] = useState(0);
  
  const [selectedProject, setSelectedProject] = useState<SelectedProject | null>(null);
  const [selectedTask, setSelectedTask] = useState<{ task: Bitrix24Task; members: Bitrix24User[] } | null>(null);

  return (
    <DashboardLayout
      breadcrumbs={[
        { label: "Проекты", href: "#" },
        { label: "Финансовый отдел" },
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

        <div className="mt-6 flex-1 min-h-0">
          {activeTab === 1 && (
            selectedTask ? (
              <TaskDetailView
                task={selectedTask.task}
                members={selectedTask.members}
                projectName={selectedProject?.name}
                sectionName={selectedProject?.sectionTitle}
                onBack={() => setSelectedTask(null)}
              />
            ) : (
              <div className="flex h-full min-h-0 gap-6 w-full">
                <div className="w-[437px] shrink-0 h-full min-h-0">
                  <DepartmentTree department="Финансовый отдел" onSelectProject={(p) => setSelectedProject(p || null)} selectedProjectId={selectedProject?.id} />
                </div>
                <div className="flex-1 min-w-0 h-full min-h-0 overflow-hidden border border-border rounded-2xl p-4 bg-card">
                  {selectedProject ? (
                    <ProjectTaskCard
                      project={selectedProject}
                      onBack={() => setSelectedProject(null)}
                      onTaskClick={(task, members) => setSelectedTask({ task, members })}
                    />
                  ) : (
                    <div><p className="text-xs text-muted-foreground">Для отображения задач выберите нужный раздел или группу</p></div>
                  )}
                </div>
              </div>
            )
          )}
          {activeTab === 2 && (
              <EventCalendar department="Финансовый отдел" />
          )}
          {activeTab === 3 && <CompanyDisk initialPath={[encodeFolderName("Финансовый отдел и бухгалтерия")]} />}
          {activeTab === 4 && <FinanceChat />}
        </div>

        <FixedPageControl total={tabs.length} current={activeTab} onSelect={setActiveTab} />
      </div>
    </DashboardLayout>
  );
};

export default Index;
