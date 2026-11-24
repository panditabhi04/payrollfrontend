import HrExplorer from "@/components/HrExplorer";

export const metadata = { title: "Departments — HR" };

export default function DepartmentsPage() {
  return (
    <HrExplorer
      resource="departments"
      title="Departments"
      idKey="dept_code"
      expectedCount={8}
      searchPlaceholder="Search department code or name…"
      columns={[
        { key: "dept_code", label: "Dept Code" },
        { key: "dept_name", label: "Department Name" },
        { key: "comp_code", label: "Company" },
      ]}
    />
  );
}
