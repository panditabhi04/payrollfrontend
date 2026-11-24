import MasterCrudManager from "@/components/MasterCrudManager";

export const metadata = { title: "Company Config Rows — Core Masters" };

export default function CompanyZoneRowsPage() {
  return (
    <MasterCrudManager
      basePath="/api/masters/company-zone-rows"
      menuName="Company Master"
      title="Company Config Row"
      idKey="id"
      note="Company-level typed configuration (ESIC/LWF/branch_details/GST/minibank/SERVICES/HEAD/ZONE/REGION). Field meaning depends on the type (e.g. ESIC: field1=state, field2=address, field3=code; GST: region=state, field1=address, field2=GSTIN). Bank account details are handled by the secure banking sub-module, not here."
      searchPlaceholder="(use ?comp_code=&row_type= via the API for filtering)"
      columns={[
        { key: "comp_code", label: "Company" },
        { key: "row_type", label: "Type" },
        { key: "region", label: "Region" },
        { key: "field1", label: "Field1" },
        { key: "field2", label: "Field2" },
        { key: "field3", label: "Field3" },
      ]}
      fields={[
        { key: "comp_code", label: "Company code", required: true },
        { key: "row_type", label: "Type (ESIC/LWF/branch_details/GST/minibank/SERVICES/HEAD/ZONE/REGION)", required: true },
        { key: "region", label: "Region" },
        { key: "field1", label: "Field 1" },
        { key: "field2", label: "Field 2" },
        { key: "field3", label: "Field 3" },
        { key: "field4", label: "Field 4" },
        { key: "field5", label: "Field 5" },
      ]}
    />
  );
}
