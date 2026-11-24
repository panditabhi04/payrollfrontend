import ClientAssign from "@/components/ClientAssign";

export const metadata = { title: "Client Assign" };

// Legacy Assign_Client.aspx 1:1: client/branch/employee listboxes, move buttons, matrix submit.
export default function Page() {
  return <ClientAssign />;
}
