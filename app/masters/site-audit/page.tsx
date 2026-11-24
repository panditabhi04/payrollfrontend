import SiteAuditDetail from "@/components/SiteAuditDetail";

export const metadata = { title: "Site Audit" };
export const dynamic = "force-dynamic";

// Legacy site_audit_detail.aspx: feedback type, Client/State/Branch/Supervisor filters, photo grid,
// Approve / Reject / Complete.
export default function Page() {
  return <SiteAuditDetail />;
}
