import DashboardLayout from "@/components/layout/DashboardLayout";

const HR = () => {
  return (
    <DashboardLayout breadcrumbs={[{ label: "Проекты", href: "#" }, { label: "Отдел HR" }]}>
    </DashboardLayout>
  );
};

export default HR;
