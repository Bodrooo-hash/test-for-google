import DashboardLayout from "@/components/layout/DashboardLayout";

const Sales = () => {
  return (
    <DashboardLayout breadcrumbs={[{ label: "Проекты", href: "#" }, { label: "Отдел продаж" }]}>
    </DashboardLayout>
  );
};

export default Sales;
