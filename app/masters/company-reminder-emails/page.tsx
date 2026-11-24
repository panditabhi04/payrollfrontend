import MasterCrudManager from "@/components/MasterCrudManager";

export const metadata = { title: "Company Reminder Emails — Core Masters" };

export default function CompanyReminderEmailsPage() {
  return (
    <MasterCrudManager
      basePath="/api/masters/company-reminder-emails"
      menuName="Company Master"
      title="Company Reminder Email"
      idKey="id"
      note="Per-department reminder-email contacts. The legacy per-contact password is never stored (secure discipline)."
      searchPlaceholder="Search…"
      columns={[
        { key: "comp_code", label: "Company" },
        { key: "department", label: "Department" },
        { key: "email", label: "Email" },
        { key: "contact_name", label: "Contact" },
        { key: "mobile", label: "Mobile" },
      ]}
      fields={[
        { key: "comp_code", label: "Company code", required: true },
        { key: "department", label: "Department" },
        { key: "email", label: "Email" },
        { key: "contact_name", label: "Contact name" },
        { key: "designation", label: "Designation" },
        { key: "mobile", label: "Mobile" },
        { key: "cc", label: "CC" },
        { key: "bcc", label: "BCC" },
        { key: "to_addr", label: "To" },
      ]}
    />
  );
}
