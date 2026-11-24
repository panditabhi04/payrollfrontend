import MasterCrudManager from "@/components/MasterCrudManager";

export const metadata = { title: "Client ESIC — Core Masters" };

export default function Page() {
  return (
    <MasterCrudManager
      basePath="/api/masters/client-esic"
      menuName="Client Master"
      title="Client ESIC"
      idKey="id"
      note="Client ESIC registrations. Scoped to your company."
      searchPlaceholder="Search…"
      columns={[
        { key: "client_code", label: "Client" },
        { key: "esic_state", label: "State" },
        { key: "esic_code", label: "Code" },
        { key: "type", label: "Type" },
      ]}
      fields={[
        { key: "client_code", label: "Client code", required: true },
        { key: "esic_state", label: "ESIC state" },
        { key: "esic_address", label: "ESIC address" },
        { key: "esic_code", label: "ESIC code" },
        { key: "type", label: "Type" },
      ]}
    />
  );
}
