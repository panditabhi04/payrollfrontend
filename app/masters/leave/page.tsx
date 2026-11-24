import MasterExplorer from "@/components/MasterExplorer";

export const metadata = { title: "Leave — Core Masters" };

export default function LeavePage() {
  return (
    <MasterExplorer
      resource="leaves"
      title="Leave Types"
      expectedCount={3}
      searchPlaceholder="Search leave name, abbreviation, policy…"
      columns={[
        { key: "leave_name", label: "Leave" },
        { key: "abbreviation", label: "Abbr" },
        { key: "policy_name", label: "Policy" },
        { key: "max_no_of_leave", label: "Max" },
        { key: "carry_forward", label: "Carry Fwd" },
        { key: "comp_code", label: "Company" },
      ]}
    />
  );
}
