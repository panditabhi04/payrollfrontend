import EmployeeViewDetails from "@/components/EmployeeViewDetails";

export const metadata = { title: "Employee View Details" };

// Legacy Employee_view_details.aspx 1:1: search + filter form + 12 tabs +
// documents/uniform/duplicate-id/approve/left/rejoin/export flows.
export default function Page() {
  return <EmployeeViewDetails />;
}
