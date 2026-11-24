import MasterCrudManager from "@/components/MasterCrudManager";

export const metadata = { title: "Client Deductions — Core Masters" };

export default function Page() {
  return (
    <MasterCrudManager
      basePath="/api/masters/client-deductions"
      menuName="Client Master"
      title="Client Deduction"
      idKey="id"
      note="Client deduction items. Scoped to your company."
      searchPlaceholder="Search…"
      columns={[
        { key: "client_code", label: "Client" },
        { key: "deduction_item", label: "Item" },
        { key: "deduction_amount", label: "Amount" },
      ]}
      fields={[
        { key: "client_code", label: "Client code", required: true },
        { key: "deduction_item", label: "Deduction item" },
        { key: "deduction_amount", label: "Amount" },
      ]}
    />
  );
}
