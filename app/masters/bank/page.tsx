import MasterExplorer from "@/components/MasterExplorer";

export const metadata = { title: "Bank — Core Masters" };

export default function BankPage() {
  return (
    <MasterExplorer
      resource="banks"
      title="Bank Branch"
      expectedCount={0}
      searchPlaceholder="Search bank, branch, IFSC…"
      columns={[
        { key: "bank_name", label: "Bank" },
        { key: "branch_name", label: "Branch" },
        { key: "bank_ifsc_no", label: "IFSC" },
        { key: "bank_type", label: "Type" },
        { key: "comp_code", label: "Company" },
      ]}
    />
  );
}
