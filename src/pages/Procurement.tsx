import DashboardLayout from "@/components/layout/DashboardLayout";
import TasksBlock from "@/components/TasksBlock";

const Procurement = () => {
  return (
    <DashboardLayout breadcrumbs={[{ label: "Проекты", href: "#" }, { label: "Отдел закупок" }]}>
      <TasksBlock />
    </DashboardLayout>
  );
};

export default Procurement;
