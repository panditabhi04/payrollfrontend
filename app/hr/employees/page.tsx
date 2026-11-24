import EmployeeMaster from "@/components/EmployeeMaster";

export const metadata = { title: "Employee Master" };
export const dynamic = "force-dynamic";

export default function EmployeesPage() {
  return <EmployeeMaster />;
}
