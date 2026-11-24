import { redirect } from "next/navigation";

// Emp_Document_Verification.aspx is the one legacy document-verification screen; its faithful 1:1
// port lives at /hr/document-verification. This legacy menu URL redirects there (the old raw-CRUD
// upload surface had no legacy equivalent and is retired).
export default function Page() {
  redirect("/hr/document-verification");
}
