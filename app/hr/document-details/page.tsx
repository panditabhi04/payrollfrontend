import DocumentDetailsForm from "@/components/DocumentDetailsForm";

export const metadata = { title: "Document Details" };

// Legacy Document_Details.aspx (pay_document_details): exact form (Sr. No., employee, reporting to,
// document list, issue / end date, Save / Update / Delete / Cancel / Close and the click-to-select grid).
export default function Page() {
  return <DocumentDetailsForm />;
}
