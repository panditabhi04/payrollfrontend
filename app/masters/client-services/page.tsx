import MasterCrudManager from "@/components/MasterCrudManager";
export const metadata = { title: "Client Services" };
// Legacy clientmaster.aspx Service tab (client_service). Comp-scoped; RBAC "Client Master".
export default function Page() {
  return (
    <MasterCrudManager
      basePath="/api/masters/client-services"
      menuName="Client Master"
      title="Client Services"
      idKey="id"
      note="Services configured per client. Scoped to your company."
      searchPlaceholder="Search service…"
      columns={[
        { key: "client_code", label: "Client Code" },
        { key: "service", label: "Service" },
        { key: "start_date", label: "Start Date" },
        { key: "end_date", label: "End Date" },
      ]}
      fields={[
        { key: "client_code", label: "Client Code", required: true },
        { key: "service", label: "Service" },
        { key: "start_date", label: "Start Date" },
        { key: "end_date", label: "End Date" },
      ]}
    />
  );
}
