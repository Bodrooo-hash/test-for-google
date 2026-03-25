import DashboardLayout from "@/components/layout/DashboardLayout";
import CompanyDisk from "@/components/CompanyDisk";

const Disk = () => {
  return (
    <DashboardLayout breadcrumbs={[{ label: "Диск компании" }]}>
      <CompanyDisk />
    </DashboardLayout>
  );
};

export default Disk;
