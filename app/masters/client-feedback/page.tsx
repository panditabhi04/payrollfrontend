import MasterCrudManager from "@/components/MasterCrudManager";

export const metadata = { title: "Client Feedback — Core Masters" };

export default function Page() {
  return (
    <MasterCrudManager
      basePath="/api/masters/client-feedback"
      menuName="Client Master"
      title="Client Feedback"
      idKey="id"
      note="Client feedback policy + remark log. Scoped to your company."
      searchPlaceholder="Search…"
      columns={[
        { key: "client_code", label: "Client" },
        { key: "client_name", label: "Client Name" },
        { key: "feedback", label: "Feedback" },
        { key: "update_by", label: "Updated By" },
      ]}
      fields={[
        { key: "client_code", label: "Client code", required: true },
        { key: "client_name", label: "Client name" },
        { key: "feedback", label: "Feedback (0/1)" },
        { key: "remark", label: "Remark" },
        { key: "update_by", label: "Updated by" },
      ]}
    />
  );
}
