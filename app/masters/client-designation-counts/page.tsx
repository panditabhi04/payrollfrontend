import MasterCrudManager from "@/components/MasterCrudManager";

export const metadata = { title: "Client Designation Counts — Core Masters" };

export default function Page() {
  return (
    <MasterCrudManager
      basePath="/api/masters/client-designation-counts"
      menuName="Client Master"
      title="Designation Count"
      idKey="id"
      note="Manpower / designation counts per client, unit and state. Scoped to your company; filter by client via ?client_code= on the API."
      searchPlaceholder="Search…"
      columns={[
        { key: "client_code", label: "Client" },
        { key: "state", label: "State" },
        { key: "designation", label: "Designation" },
        { key: "unit_code", label: "Unit" },
        { key: "count", label: "Count" },
        { key: "hours", label: "Hours" },
      ]}
      fields={[
        { key: "client_code", label: "Client code", required: true },
        { key: "state", label: "State" },
        { key: "designation", label: "Designation" },
        { key: "unit_code", label: "Unit code" },
        { key: "count", label: "Count", type: "number" },
        { key: "hours", label: "Hours" },
        { key: "location", label: "Location" },
        { key: "category", label: "Category" },
        { key: "sr_no", label: "Sr no", type: "number" },
      ]}
    />
  );
}
