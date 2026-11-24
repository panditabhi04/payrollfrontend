import { redirect } from "next/navigation";

export const metadata = { title: "Billing Details" };

// Legacy BillingDetails.aspx (Billing & Salary Master) is ported at /payroll/policy-master;
// the former stub route here redirects to the real page.
export default function Page() {
  redirect("/payroll/policy-master");
}
