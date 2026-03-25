import DashboardLayout from "@/components/layout/DashboardLayout";

const Marketing = () => {
  return (
    <DashboardLayout breadcrumbs={[{ label: "Проекты", href: "#" }, { label: "Отдел маркетинга" }]}>
    </DashboardLayout>
  );
};

export default Marketing;
