import ClientAccess from "@/components/ClientAccess";

export const metadata = { title: "Client Assign" };

// Legacy client_access.aspx 1:1 (menu "Client Assign"): staff access assign/remove + grid.
export default function Page() {
  return <ClientAccess />;
}
