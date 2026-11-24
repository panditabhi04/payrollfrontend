"use client";

import { useEffect, useState } from "react";
import { getJSON, mk, responseMessage, upload as uploadFile } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";
import SubBillSection, { SUB_BILL_TYPES } from "./ClientBillingSubBill";
import { DeepCleanPestSection, OtSection, isFamilyBillingType } from "./ClientBillingFamilies";
import MaterialConveyanceSection, { isMcBillingType } from "./ClientBillingMaterialConveyance";
import { BillUploadTab, BillingStatusPanel, DeploymentPanel, FeedbackPanel, FinanceApprovalPanel, NotificationPanel, type BillingScope } from "./ClientBillingPanels";

interface FormOptions {
  states: string[];
  units: { unit_code: string; unit_name: string; label: string; state_name: string }[];
  billing_types: { billing_id: string; billing_name: string }[];
  regions: string[];
  company_groups: string[];
  designations: string[];
  region_wise: boolean;
}

interface ClientOption { client_code: string; client_name: string; gst_no?: string; }
interface UnitOption { unit_code: string; unit_name: string; state_name: string; }
interface PolicyRow { id: number; policy_name1: string; designation: string; }
interface BillingLine {
  designation: string;
  policy_name?: string;
  per_person_grand_total: number;
  line_total: number;
  head_count?: number;        // from the approved attendance muster
  days_total?: number;        // sum of present days for the designation
  avg_days?: number;          // present days per employee (rate basis)
  per_person_avg?: number;
}
interface BillingResult {
  lines: BillingLine[]; client_total: number; emp_count: number;
  muster_rows?: number; skipped_no_policy?: number; units?: string[];
  skipped_designations?: string[];
  skipped_employees?: { emp_code: string; designation: string; days: number; unit_code?: string }[];
  emp_lines?: { emp_code: string; unit_code: string; designation: string; days: number; per_person_grand_total: number; employee_type?: string }[];
}
interface BillingSummaryRow {
  id: number;
  client_code: string;
  client_name: string;
  state_name: string;
  unit_code: string;
  invoice_no: string;
  invoice_date: string | null;
  type: string;
  invoice_value: number;
  emp_count: number;
  flag_invoice: number;
  payment_status: string;
}
interface GeneratedInvoice { invoice_no: string; amount: number; cgst: number; sgst: number; igst: number; reused: boolean; }
interface ArrearsRunLine {
  month: number;
  year: number;
  designation: string;
  head_count: number;
  days: number;
  per_person_grand_total: number;
  components: Record<string, number>;
}
interface ArrearsRun { run_id: number; lines: ArrearsRunLine[]; emp_count: number; note: string; }
interface BillingDocument {
  id: number;
  client_code: string;
  unit_code: string;
  state_name: string;
  document_type: string;
  month: number;
  year: number;
  file_name: string;
  file_size: number;
}
interface DispatchInvoice {
  id: number;
  invoice_no: string;
  client_code: string;
  client_name: string;
  state_name: string;
  unit_code: string;
  invoice_value: number;
  dispatched: boolean;
}
interface YearlyBillingLine {
  month: number;
  year: number;
  emp_code: string;
  emp_name: string;
  designation: string;
  yearly_bonus: number;
  service_charge: number;
  amount: number;
  cgst: number;
  sgst: number;
  igst: number;
}
interface YearlyBillingRun {
  run_id: number;
  count: number;
  lines: YearlyBillingLine[];
  finalized?: boolean;
  invoices?: { invoice_no: string; state_name: string; invoice_value: number; reused: boolean }[];
}

const BILLING_TYPES = [
  "Manpower Billing", "OT Billing", "R And M Service", "Administrative Expenses",
  "Material Billing", "Conveyance Billing", "Deep Clean Billing", "Pest Control Billing",
  "Machine Rental", "Shiftwise Billing", "Incentive Billing", "Office Rent Billing",
];
const BILLING_TABS = [
  "Manpower Billing", "Arrears Billing", "Yearly Billing", "Bill Upload", "Bill Dispatch",
  "Billing Summary Report", "Send Soft Copy",
];

// Per-billing-type action buttons, taken 1:1 from the legacy grade_unit_billing.aspx
// sections (#menu1..#menu16). Selecting a Billing Type shows that type's section
// (legacy billing_rates() show/hide). Only Manpower Billing's processing is migrated;
// the others render their legacy buttons (processing staged).
const BILLING_TYPE_SECTIONS: Record<string, string[]> = {
  "Manpower Billing": ["Process", "Client Attendance", "Client Feedback", "Break Up", "Statewise Break Up", "Finance Copy", "Invoice Copy", "Final Invoice Print", "Generate E-Invoice", "Client Sheet", "Report", "Support Format"],
  "Material Billing": ["Process", "Material Finance Copy", "Material Invoice Copy", "Final Invoice Print", "Digital Invoice Print", "Report", "Material Actual Bill", "Material Actual Invoice", "Export Material Details"],
  "Conveyance Billing": ["Process", "Conveyance Finance Copy", "Conveyance Bill", "Final Conveyance Bill", "Digital Invoice Print", "Report", "Conveyance Sheet"],
  "Deep Clean Billing": ["Process", "Deep Clean Finance Copy", "Deep Cleaning Bill", "Final Deep Cleaning Bill", "Digital Invoice"],
  "Pest Control Billing": ["Process", "Pest Control Finance Copy", "Invoice Copy"],
  "Machine Rental": ["Process", "Rent Finance Copy", "Rent Invoice", "Final Invoice"],
  "R And M Service": ["Process", "Finance Copy", "Invoice", "Final Invoice", "Digital Invoice Print"],
  "Administrative Expenses": ["Process", "Finance Copy", "Invoice", "Final Invoice"],
  "OT Billing": ["Process", "OT Sheet", "OT Break Up", "OT Finance Copy", "OT Invoice Copy", "Final OT Invoice Print", "Digital Invoice Print", "OT Client Sheet"],
  "Shiftwise Billing": ["Process", "Finance Copy", "Invoice Copy", "Final Invoice Print", "Digital Invoice Print", "Sheet"],
  "Incentive Billing": ["Process", "Finance Copy", "Invoice Copy", "Final Invoice Print", "Sheet"],
  "Office Rent Billing": ["Process", "Finance Copy", "Invoice Copy", "Final Invoice Print", "Digital Invoice Print"],
  "Stipend Billing": ["Process", "Finance Copy", "Invoice Copy", "Final Invoice Print"],
};
// Manpower Billing button label -> backend manpower-report type (xlsx download).
const MANPOWER_REPORT_TYPE: Record<string, string> = {
  "Client Attendance": "attendance",
  "Break Up": "rate-breakup",
  "Statewise Break Up": "statewise-breakup",
  "Finance Copy": "finance-copy",
  "Invoice Copy": "invoice-copy",
  "Client Sheet": "client-sheet",
};
// Page_Load client SQL: these client codes carry a HK / SG caption
const CLIENT_SUFFIX: Record<string, string> = { "BALIK HK": " HK", "BALIC SG": " SG", "BAG": " HK", "BG": " SG" };
const money = (value: number) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 2,
}).format(value || 0);

export default function ClientBilling() {
  const now = new Date();
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [client, setClient] = useState("");
  const [state, setState] = useState("");
  const [unit, setUnit] = useState("");
  const [billingType, setBillingType] = useState("");
  const [clientBillingTypes, setClientBillingTypes] = useState<string[]>([]);
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [billDate, setBillDate] = useState("");
  // Legacy defaults (grade_unit_billing.aspx): Invoice Type first item = CLUB;
  // Billing Start/End Day dropdowns default = Select (value "0").
  const [invoiceType, setInvoiceType] = useState("Club");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [reverseCharge, setReverseCharge] = useState(false);
  const [startDay, setStartDay] = useState("0");
  const [endDay, setEndDay] = useState("0");
  const [headCounts, setHeadCounts] = useState<Record<string, string>>({});
  const [result, setResult] = useState<BillingResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState("Manpower Billing");
  const [arrearType, setArrearType] = useState("");
  const [arrearFrom, setArrearFrom] = useState("");
  const [arrearTo, setArrearTo] = useState("");
  const [reportType, setReportType] = useState("Salary Slip Sending Details");
  const [summaryRows, setSummaryRows] = useState<BillingSummaryRow[]>([]);
  const [summaryLoaded, setSummaryLoaded] = useState(false);
  const [generatedInvoice, setGeneratedInvoice] = useState<GeneratedInvoice | null>(null);
  const [arrearsRun, setArrearsRun] = useState<ArrearsRun | null>(null);
  const [billingDocuments, setBillingDocuments] = useState<BillingDocument[]>([]);
  const [documentType, setDocumentType] = useState("SCANNED_BILL_UPLOAD");
  const [documentState, setDocumentState] = useState("");
  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<number[]>([]);
  const [mailRecipient, setMailRecipient] = useState("");
  const [dispatchMonth, setDispatchMonth] = useState(month);
  const [dispatchInvoices, setDispatchInvoices] = useState<DispatchInvoice[]>([]);
  const [dispatchSelectedIds, setDispatchSelectedIds] = useState<number[]>([]);
  const [yearlyType, setYearlyType] = useState("");
  const [yearlyFrom, setYearlyFrom] = useState("");
  const [yearlyTo, setYearlyTo] = useState("");
  const [yearlyRun, setYearlyRun] = useState<YearlyBillingRun | null>(null);
  const [conveyanceRows, setConveyanceRows] = useState<Record<string, string | number>[]>([]);
  const [conveyanceTotals, setConveyanceTotals] = useState<Record<string, number> | null>(null);
  const [conveyanceLoaded, setConveyanceLoaded] = useState(false);
  // Conveyance sub-mode (legacy ddl_conveyance_type: Employee / Driver).
  const [conveyanceMode, setConveyanceMode] = useState<"Employee" | "Driver">("Employee");
  const [driverRows, setDriverRows] = useState<Record<string, string | number>[]>([]);
  const [driverTotals, setDriverTotals] = useState<Record<string, number> | null>(null);
  const [driverLoaded, setDriverLoaded] = useState(false);
  const [materialRows, setMaterialRows] = useState<Record<string, string | number>[]>([]);
  const [materialTotals, setMaterialTotals] = useState<Record<string, number> | null>(null);
  const [materialLoaded, setMaterialLoaded] = useState(false);
  // Legacy main-form fields that were missing from the modern port (1:1):
  const [billingProcess, setBillingProcess] = useState("Regular"); // ddl_billing_process
  const [region, setRegion] = useState(""); // ddlregion
  const [companyGroup, setCompanyGroup] = useState(""); // ddl_company_group
  const [companyGroups, setCompanyGroups] = useState<string[]>([]);
  const [poNo, setPoNo] = useState(""); // txt_po_no
  const [designation, setDesignation] = useState(""); // ddl_designation
  const [designations, setDesignations] = useState<string[]>([]);
  const [summaryBillType, setSummaryBillType] = useState("");
  const [processData, setProcessData] = useState("0"); // ddl_process_data: 0 = Current Policy, 1 = Old Policy
  const [formOpts, setFormOpts] = useState<FormOptions | null>(null);
  // panel reload counters (gv_attendace_load / gv_load_deployment / attendance_status)
  const [approvalKey, setApprovalKey] = useState(0);
  const [deployKey, setDeployKey] = useState(0);
  const [notifyKey, setNotifyKey] = useState(0);
  const [statusKey, setStatusKey] = useState(0);
  const [showBillCheck, setShowBillCheck] = useState(false);   // legacy: Check Client Billing is a modal opened from a link
  const [feedbackUnit, setFeedbackUnit] = useState("");

  useEffect(() => {
    getJSON<{ results: ClientOption[] }>("/api/masters/clients/?page_size=all")
      .then((data) => setClients(data?.results ?? []));
  }, []);

  // Dropdown sources (states, branches as STATE_CODE_CITY_ADD1_UNITNAME, billing types, regions,
  // company groups, designations) come from the billing form-options endpoint.
  useEffect(() => {
    if (!client || !month) { setFormOpts(null); return; }
    const [y, m] = month.split("-");
    const p = new URLSearchParams({ client_code: client, month: String(Number(m)), year: y,
      billing_process: billingProcess, invoice_type: invoiceType === "Unclub" ? "2" : "1" });
    if (state) p.set("state", state);
    if (unit) p.set("unit_code", unit);
    if (region) p.set("region", region);
    const bt = formOptsBillingId(billingType);
    if (bt) p.set("billing_id", bt);
    getJSON<FormOptions>(`/api/payroll/client-billing/form-options/?${p.toString()}`).then((d) => {
      setFormOpts(d);
      if (d) { setDesignations(d.designations); setCompanyGroups(d.company_groups); }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, month, state, billingProcess, region, invoiceType, billingType, unit]);

  // Invoice No / Bill Date of the selection (get_invoice_bill_date): the registered final invoice,
  // otherwise the next number Final Invoice Print will assign.
  useEffect(() => {
    if (!client || !state || !month || state === "ALL") return;
    const [y, m] = month.split("-");
    const p = new URLSearchParams({ client_code: client, state, unit_code: unit || "ALL", month: String(Number(m)), year: y,
      start_day: startDay, end_day: endDay, invoice_type: invoiceType === "Unclub" ? "2" : "1",
      designation: invoiceType === "Unclub" ? designation : "", billing_process: billingProcess, region });
    getJSON<{ invoice_no: string; bill_date: string }>(`/api/payroll/client-billing/invoice-preview/?${p.toString()}`).then((d) => {
      if (!d) return;
      setInvoiceNo(d.invoice_no || "");
      if (d.bill_date) setBillDate(d.bill_date);
    });
  }, [client, state, month, unit, startDay, endDay, invoiceType, designation, billingProcess, region, generatedInvoice]);

  function formOptsBillingId(name: string): string {
    return formOpts?.billing_types.find((b) => b.billing_name === name)?.billing_id ?? "";
  }

  useEffect(() => setDispatchMonth(month), [month]);

  useEffect(() => {
    setUnits([]);
    setState("");
    setUnit("");
    setPolicies([]);
    setResult(null);
    setClientBillingTypes([]);
    setBillingType("");
    setRegion(""); setCompanyGroup(""); setDesignation("");
    setDesignations([]); setCompanyGroups([]);
    if (!client) return;
    getJSON<{ units: UnitOption[] }>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(client)}`)
      .then((data) => setUnits(data?.units ?? []));
    // Designation dropdown (legacy ddl_designation): distinct designations for the client.
    getJSON<{ results: { designation?: string }[] }>(`/api/masters/client-designation-counts/lookup/?client_code=${encodeURIComponent(client)}`)
      .then((data) => setDesignations(Array.from(new Set((data?.results ?? []).map((r) => (r.designation || "").trim()).filter(Boolean))).sort()));
    getJSON<{ results: { billing_name?: string }[] }>(`/api/masters/client-billing-details/lookup/?client_code=${encodeURIComponent(client)}`)
      .then((data) => {
        // Legacy billing_type1(): SELECT DISTINCT billing_id, billing_name FROM
        // pay_client_billing_details WHERE client_code=<client>. We show the stored
        // billing_name verbatim (exactly the text legacy puts in the Billing Type
        // dropdown) instead of a hardcoded id map, so every configured type appears.
        const types = (data?.results ?? [])
          .map((r) => (r.billing_name || "").trim())
          .filter(Boolean);
        setClientBillingTypes(Array.from(new Set(types)));
      });
  }, [client]);

  useEffect(() => {
    setPolicies([]);
    setResult(null);
    setMessage("");
    if (!client) return;
    const params = new URLSearchParams({ billing_client_code: client });
    if (state && state !== "ALL") params.set("billing_state", state);
    if (unit && unit !== "ALL") params.set("billing_unit_code", unit);
    getJSON<{ results: PolicyRow[] }>(`/api/payroll/client-billing/?${params.toString()}`)
      .then((data) => {
        const rows = data?.results ?? [];
        setPolicies(rows);
        setHeadCounts((current) => Object.fromEntries(rows.map((row) => [row.designation, current[row.designation] ?? "0"])));
      });
  }, [client, state, unit, refreshKey]);

  const availableStates = formOpts?.states?.length
    ? formOpts.states
    : Array.from(new Set(units.map((item) => item.state_name).filter(Boolean))).sort();
  // Branch text = STATE_CODE_CITY_ADD1_UNITNAME (ddl_state_SelectedIndexChanged)
  const availableUnits: UnitOption[] = formOpts && state
    ? formOpts.units.map((u) => ({ unit_code: u.unit_code, unit_name: u.label || u.unit_name, state_name: u.state_name }))
    : units.filter((item) => !state || item.state_name === state);
  const billingTypeNames = formOpts?.billing_types?.length ? formOpts.billing_types.map((b) => b.billing_name) : clientBillingTypes;
  const scope: BillingScope | null = client && month && state ? {
    client_code: client, state, unit_code: unit || "ALL", month: Number(month.split("-")[1]), year: Number(month.split("-")[0]),
    billing_id: formOptsBillingId(billingType), billing_process: billingProcess, region,
  } : null;
  const selectedClient = clients.find((item) => item.client_code === client);
  const monthParts = month.split("-");
  const DAY_OPTS = Array.from({ length: 31 }, (_, i) => String(i + 1));

  // Main-form fields that legacy sends with every Process / Final Invoice postback.
  function formFields() {
    return {
      billing_type: billingType,
      billing_id: formOptsBillingId(billingType),
      invoice_type: invoiceType === "Unclub" ? "2" : "1",
      designation: invoiceType === "Unclub" ? designation : "",
      start_day: startDay,
      end_day: endDay,
      billing_process: billingProcess,
      region,
      company_group: companyGroup,
      process_data: processData,
      po_no: poNo,
      invoice_no: invoiceNo,
      bill_date: billDate,
    };
  }

  // req_validation_process(): the client-side checks of the Process button, legacy texts verbatim.
  function validateProcessForm(): boolean {
    const block = (m: string) => { setMessage(m); alert(m); return false; };
    if (!client || client === "ALL") return block("Please Select Client Name ");
    if (!state) return block("Please Select State Name ");
    if (selectedClient?.client_name === "Reliance Capital Ltd." && unit === "ALL") return block("Please Select Branch Name ");
    if (!month) return block("Please Select month & year ");
    return true;
  }

  async function processBill() {
    setMessage("");
    setResult(null);
    if (!validateProcessForm()) return;
    if (!unit) { const m = "Please Select Branch Name "; setMessage(m); alert(m); return; }
    setBusy(true);
    try {
      const [year, selectedMonth] = monthParts.map(Number);
      // Attendance-driven (legacy 1:1): head count + each employee's days come from the
      // approved attendance muster, not manually typed counts.
      const response = await mk("/api/payroll/client-billing/compute-attendance/", {
        client_code: client,
        state,
        unit_code: unit,
        month: selectedMonth,
        year,
        ...formFields(),
      });
      if (!response.ok) throw new Error(await responseMessage(response, "Unable to calculate this billing preview."));
      const data = (await response.json()) as BillingResult;
      setResult(data);
      // Keep headCounts in sync with attendance (used by the Final Invoice posting too).
      setHeadCounts(Object.fromEntries((data.lines ?? []).map((l) => [l.designation, String(l.head_count ?? 0)])));
      const say = (m: string) => { setMessage(m); alert(m); };
      if (!data.muster_rows) {
        say("No approved attendance found for this Client / Branch / Month — nothing to bill. Approve the attendance muster first.");
      } else {
        const skipped = data.skipped_no_policy ? ` ${data.skipped_no_policy} present employee(s) had no matching billing policy and were skipped.` : "";
        const skippedDesig = (data.skipped_designations ?? []).length
          ? ` Skipped designation(s): ${((data.skipped_designations ?? []).map((d: string) => d || "(blank)")).join(", ")}. Create a billing policy for these in Policy Master.`
          : "";
        const skippedEmps = (data.skipped_employees ?? []).length
          ? " Skipped employees: " + ((data.skipped_employees ?? []).map((e: any) => e.emp_code + " (" + (e.designation || "blank") + " @ " + e.unit_code + ")").join(", ")) + "."
          : "";
        const branches = (data.units ?? []).length > 1 ? ` across ${(data.units ?? []).length} branches` : "";
        say(`Billing calculated from attendance: ${data.emp_count} employee(s) across ${data.lines.length} designation(s)${branches}. No invoice posted.${skipped}${skippedDesig}${skippedEmps}`);
      }
      // gv_attendace_load(): the Finance attendance approval grid follows every Process
      setApprovalKey((k) => k + 1); setStatusKey((k) => k + 1);
    } catch (error) {
      const m = error instanceof Error ? error.message : "Unable to calculate this billing preview.";
      setMessage(m); alert(m);
      setApprovalKey((k) => k + 1); setStatusKey((k) => k + 1);
    } finally {
      setBusy(false);
    }
  }

  // Conveyance Billing (legacy grade_unit_billing #menu3) — read-only, cent-exact.
  async function processConveyance() {
    setMessage("");
    setConveyanceRows([]); setConveyanceTotals(null); setConveyanceLoaded(false);
    if (!client || client === "ALL" || !month) { setMessage("Please Select Client Name "); alert("Please Select Client Name "); return; }
    const [year, mm] = month.split("-");
    const params = new URLSearchParams({ client_code: client, month: String(Number(mm)), year });
    if (state) params.set("state", state);
    if (unit && unit !== "ALL") params.set("unit_code", unit);
    setBusy(true);
    try {
      const data = await getJSON<{ results: Record<string, string | number>[]; totals: Record<string, number> }>(
        `/api/payroll/client-billing/conveyance-process/?${params.toString()}`);
      if (!data) { setMessage("Please sign in / check Client Billing Read permission."); return; }
      setConveyanceRows(data.results ?? []);
      setConveyanceTotals(data.totals ?? null);
      setConveyanceLoaded(true);
      if ((data.results ?? []).length === 0) setMessage("No conveyance billing data found for this client/month (from legacy billing data).");
    } finally { setBusy(false); }
  }
  function downloadConveyanceFinanceCopy() {
    if (!client || !month) { setMessage("Please select Client and Month/Year first."); return; }
    const [year, mm] = month.split("-");
    const params = new URLSearchParams({ client_code: client, month: String(Number(mm)), year });
    if (state) params.set("state", state);
    if (unit && unit !== "ALL") params.set("unit_code", unit);
    window.open(`${API_BASE_URL}/api/payroll/client-billing/conveyance-finance-copy/?${params.toString()}`, "_blank");
  }
  async function processConveyanceDriver() {
    setMessage("");
    setDriverRows([]); setDriverTotals(null); setDriverLoaded(false);
    if (!client || !month) { setMessage("Please select Client and Month/Year first."); return; }
    const [year, mm] = month.split("-");
    const params = new URLSearchParams({ client_code: client, month: String(Number(mm)), year });
    if (state) params.set("state", state);
    if (unit && unit !== "ALL") params.set("unit_code", unit);
    setBusy(true);
    try {
      const data = await getJSON<{ results: Record<string, string | number>[]; totals: Record<string, number> }>(
        `/api/payroll/client-billing/conveyance-driver-process/?${params.toString()}`);
      if (!data) { setMessage("Please sign in / check Client Billing Read permission."); return; }
      setDriverRows(data.results ?? []); setDriverTotals(data.totals ?? null); setDriverLoaded(true);
      if ((data.results ?? []).length === 0) setMessage("No driver conveyance data found for this client/month.");
    } finally { setBusy(false); }
  }
  function downloadDriverFinanceCopy() {
    if (!client || !month) { setMessage("Please select Client and Month/Year first."); return; }
    const [year, mm] = month.split("-");
    const params = new URLSearchParams({ client_code: client, month: String(Number(mm)), year });
    if (state) params.set("state", state);
    if (unit && unit !== "ALL") params.set("unit_code", unit);
    window.open(`${API_BASE_URL}/api/payroll/client-billing/conveyance-driver-finance-copy/?${params.toString()}`, "_blank");
  }

  // Material / Deep Clean / Pest Control (legacy #menu2/#menu4/#menu5) — read-only.
  async function processMaterialFamily() {
    setMessage("");
    setMaterialRows([]); setMaterialTotals(null); setMaterialLoaded(false);
    if (!client || !month) { setMessage("Please select Client and Month/Year first."); return; }
    const [year, mm] = month.split("-");
    const params = new URLSearchParams({ billing_type: billingType, client_code: client, month: String(Number(mm)), year });
    if (state) params.set("state", state);
    if (unit && unit !== "ALL") params.set("unit_code", unit);
    setBusy(true);
    try {
      const data = await getJSON<{ results: Record<string, string | number>[]; totals: Record<string, number> }>(
        `/api/payroll/client-billing/material-process/?${params.toString()}`);
      if (!data) { setMessage("Please sign in / check Client Billing Read permission."); return; }
      setMaterialRows(data.results ?? []);
      setMaterialTotals(data.totals ?? null);
      setMaterialLoaded(true);
      if ((data.results ?? []).length === 0) setMessage(`No ${billingType} data found for this client/month (from legacy billing data).`);
    } finally { setBusy(false); }
  }
  function downloadMaterialFinanceCopy() {
    if (!client || !month) { setMessage("Please select Client and Month/Year first."); return; }
    const [year, mm] = month.split("-");
    const params = new URLSearchParams({ billing_type: billingType, client_code: client, month: String(Number(mm)), year });
    if (state) params.set("state", state);
    if (unit && unit !== "ALL") params.set("unit_code", unit);
    window.open(`${API_BASE_URL}/api/payroll/client-billing/material-finance-copy/?${params.toString()}`, "_blank");
  }

  // Manpower Billing reports — for Breakup, always fetch ALL branches so Excel shows pura (59) even if ES13 is selected
  function downloadManpowerReport(reportType: string) {
    if (!client || !state || !unit || !month) {
      setMessage("Select Client, State, Branch and Month first — then this report will download.");
      return;
    }
    const [year, mm] = month.split("-");
    // For Breakup, force ALL to get full 59 rows (user wants pura, not just ES13's 2)
    const effectiveUnit = (reportType === "rate-breakup" || reportType === "finance-copy") ? "ALL" : unit;
    const params = new URLSearchParams({
      report_type: reportType, client_code: client, state, unit_code: effectiveUnit,
      month: String(Number(mm)), year, _ts: String(Date.now()),
    });
    window.open(`${API_BASE_URL}/api/payroll/client-billing/manpower-report/?${params.toString()}`, "_blank");
  }

  // Final Invoice posting for non-manpower types (legacy delete-then-insert into
  // pay_report_gst). Amounts + GST come from the exact legacy aggregate SELECT on the
  // read-only legacy DB; one invoice row per state is upserted into the modern GST register.
  async function postTypeInvoice() {
    if (!client || !month) { setMessage("Please select Client and Month/Year first."); return; }
    const isDriver = billingType === "Conveyance Billing" && conveyanceMode === "Driver";
    const label = isDriver ? "Driver Conveyance" : billingType;
    if (!window.confirm(`Post the ${label} final invoice to the GST register for the selected client/month? Reposting a period updates the existing invoice(s).`)) return;
    setBusy(true); setMessage("");
    try {
      const [year, mm] = month.split("-").map(Number);
      const response = await mk("/api/payroll/client-billing/post-invoice/", {
        conveyance_mode: isDriver ? "Driver" : "Employee",
        client_code: client,
        client_name: selectedClient?.client_name ?? "",
        state,
        unit_code: unit,
        month: mm,
        year,
        invoice_date: billDate || undefined,
        ...formFields(),
      });
      if (!response.ok) throw new Error(await responseMessage(response, "Unable to post invoice."));
      const body = await response.json();
      const n = body.states_posted ?? 0;
      if (n === 0) {
        setMessage(`${label}: no billable rows found for this client/month — nothing was posted.`);
        alert(`${label}: no billable rows found for this client/month — nothing was posted.`);
      } else {
        const gst = (body.grand_cgst ?? 0) + (body.grand_sgst ?? 0) + (body.grand_igst ?? 0);
        const total = (body.grand_amount ?? 0) + gst;
        setMessage(`${label}: ${n} state invoice(s) GST register me post ho gaye. Taxable ${money(body.grand_amount ?? 0)}, GST ${money(gst)}, Total ${money(total)}.`);
        alert(`${label}: ${n} state invoice(s) GST register me post ho gaye. Taxable ${money(body.grand_amount ?? 0)}, GST ${money(gst)}, Total ${money(total)}.`);
      }
      await loadBillingSummary();
    } catch (error) {
      const m = error instanceof Error ? error.message : "Unable to post invoice.";
      setMessage(m); alert(m);
    } finally { setBusy(false); }
  }

  // btn_report_Click(): attendance_status() - the notification panels
  function showNotifications() {
    if (!client || client === "ALL" || client === "Select") { const m = "Please Select Client Name "; setMessage(m); alert(m); return; }
    if (!month) { const m = "Please Select month & year "; setMessage(m); alert(m); return; }
    if (!state) { const m = "Please Select State Name "; setMessage(m); alert(m); return; }
    setNotifyKey((k) => k + 1);
    setStatusKey((k) => k + 1);   // display_ClientBilling(): the Check Client Billing grid
  }

  async function downloadReportFile(path: string, fallback: string) {
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
      if (!r.ok) throw new Error(await responseMessage(r, "No Matching Records Found."));
      const cd = r.headers.get("Content-Disposition") || "";
      const mm = /filename="?([^";]+)"?/.exec(cd);
      const objectUrl = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = objectUrl; a.download = mm ? mm[1] : fallback;
      document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "No Matching Records Found.";
      setMessage(msg); alert(msg);
    } finally { setBusy(false); }
  }

  // btn_support_format_Click() -> generate_report(4)
  async function downloadSupportFormat() {
    if (!client) { const m = "Please Select Client Name "; setMessage(m); alert(m); return; }
    if (!month || !state) { const m = !month ? "Please Select month & year " : "Please Select State Name "; setMessage(m); alert(m); return; }
    const [y, m] = month.split("-");
    const p = new URLSearchParams({ client_code: client, state, unit_code: unit || "ALL", month: String(Number(m)), year: y,
      billing_id: formOptsBillingId(billingType), invoice_type: invoiceType === "Unclub" ? "2" : "1", billing_process: billingProcess });
    await downloadReportFile(`/api/payroll/client-billing/support-format/?${p.toString()}`, "SUPPORT_FORMAT.xlsx");
  }

  // btn_feedback_Click() -> feedback_report()
  async function downloadFeedbackReport() {
    if (!client || client === "ALL") { const m = "Please Select Client Name "; setMessage(m); alert(m); return; }
    if (!month) { const m = "Please Select month & year "; setMessage(m); alert(m); return; }
    const [y, m] = month.split("-");
    const p = new URLSearchParams({ client_code: client, state: state || "ALL", unit_code: unit || "ALL", month: String(Number(m)), year: y });
    await downloadReportFile(`/api/payroll/client-billing/feedback-report/?${p.toString()}`, "CLIENT_FEEDBACK.xlsx");
  }

  // btn_getxl_report_Click -> export_xl(1|2)
  async function downloadSummaryReport() {
    const block = (m: string) => { setMessage(m); alert(m); };
    if (!client || client === "ALL") { block("Please Select Client Name "); return; }
    if (!month) { block("Please Select month & year "); return; }
    if (reportType === "Monthwise Billing Details" && !summaryBillType) { block("Please Select Billing Type"); return; }
    const [y, m] = month.split("-");
    const p = new URLSearchParams({ client_code: client, state: state || "ALL", unit_code: unit || "ALL",
      month: String(Number(m)), year: y, report_type: reportType, bill_type: summaryBillType });
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}/api/payroll/client-billing/summary-report/?${p.toString()}`, { credentials: "include" });
      if (!r.ok) throw new Error(await responseMessage(r, "No Matching Records Found."));
      const cd = r.headers.get("Content-Disposition") || "";
      const mm = /filename="?([^";]+)"?/.exec(cd);
      const objectUrl = URL.createObjectURL(await r.blob());
      const a = document.createElement("a");
      a.href = objectUrl; a.download = mm ? mm[1] : "BILLING_REPORT.xlsx";
      document.body.appendChild(a); a.click(); a.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      const msg = error instanceof Error ? error.message : "No Matching Records Found.";
      setMessage(msg); alert(msg);
    } finally { setBusy(false); }
  }

  async function loadBillingSummary() {
    setMessage("");
    setSummaryRows([]);
    setSummaryLoaded(false);
    if (!month) {
      setMessage("Please select Month/Year first.");
      return;
    }
    const [year, selectedMonth] = month.split("-");
    const params = new URLSearchParams({ month: String(Number(selectedMonth)), year });
    if (client) params.set("client_code", client);
    if (state) params.set("state", state);
    if (unit && unit !== "ALL") params.set("unit_code", unit);
    try {
      const response = await fetch(`${API_BASE_URL}/api/payroll/client-billing/summary/?${params.toString()}`, {
        credentials: "include", headers: { Accept: "application/json" }, cache: "no-store",
      });
      if (response.status === 401) { setMessage("Please sign in to view billing summary."); return; }
      if (response.status === 403) { setMessage("Your role needs Read permission for Client Billing."); return; }
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.detail ?? "Unable to load billing summary.");
      setSummaryRows(data.results ?? []);
      setSummaryLoaded(true);
      setMessage(data.results?.length ? `${data.results.length} billing record(s) loaded.` : "No billing records found for this period.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load billing summary.");
    }
  }

  async function loadBillDocuments() {
    setMessage("");
    if (!client || !month) { setMessage("Please select Client Name and Month/Year first."); return; }
    const [year, selectedMonth] = month.split("-");
    const params = new URLSearchParams({ client_code: client, month: String(Number(selectedMonth)), year });
    if (state) params.set("state", state);
    const data = await getJSON<{ results: BillingDocument[] }>(`/api/payroll/client-billing/bill-documents/?${params.toString()}`);
    if (!data) { setMessage("Please sign in and check your Client Billing Read permission."); return; }
    setBillingDocuments(data.results ?? []);
    setSelectedDocumentIds([]);
    setMessage(data.results?.length ? `${data.results.length} billing document(s) loaded.` : "No uploaded bills found for this month.");
  }

  async function uploadBillDocument() {
    if (!client || !month || !documentFile) { setMessage("Select Client, Month/Year and a PDF or ZIP file."); return; }
    const [year, selectedMonth] = month.split("-");
    const form = new FormData();
    form.append("client_code", client);
    form.append("document_type", documentType);
    form.append("month", String(Number(selectedMonth)));
    form.append("year", year);
    if (documentState) form.append("state", documentState);
    if (unit) form.append("unit_code", unit);
    form.append("file", documentFile);
    setBusy(true);
    setMessage("");
    try {
      const response = await uploadFile("/api/payroll/client-billing/upload-document/", form);
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail ?? "Unable to upload billing document.");
      setDocumentFile(null);
      await loadBillDocuments();
      setMessage(`${body.file_name} uploaded successfully.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload billing document.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadBillDocument(billingDocument: BillingDocument) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/payroll/client-billing/download-document/?id=${billingDocument.id}`, { credentials: "include" });
      if (!response.ok) throw new Error("Unable to download this billing document.");
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = billingDocument.file_name;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to download this billing document.");
    }
  }

  async function sendBillingMail() {
    if (!client || !month || !mailRecipient.trim() || selectedDocumentIds.length === 0) {
      setMessage("Enter recipient email and select at least one bill attachment.");
      return;
    }
    const [year, selectedMonth] = month.split("-");
    setBusy(true);
    setMessage("");
    try {
      const response = await mk("/api/payroll/client-billing/send-bill-mail/", {
        client_code: client, month: Number(selectedMonth), year: Number(year),
        to_email: mailRecipient, document_ids: selectedDocumentIds,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = body.missing_states?.length
          ? `${body.detail} Missing: ${body.missing_states.join(", ")}`
          : body.detail ?? "Billing email was not sent.";
        throw new Error(detail);
      }
      setMessage(`Billing email ${body.status.toLowerCase()}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Billing email was not sent.");
    } finally {
      setBusy(false);
    }
  }

  async function loadDispatchInvoices() {
    if (!dispatchMonth) { setMessage("Please select dispatch month."); return; }
    const [year, selectedMonth] = dispatchMonth.split("-");
    const params = new URLSearchParams({ month: String(Number(selectedMonth)), year });
    if (client) params.set("client_code", client);
    if (state) params.set("state", state);
    if (unit && unit !== "ALL") params.set("unit_code", unit);
    const data = await getJSON<{ results: DispatchInvoice[] }>(`/api/payroll/client-billing/dispatch-invoices/?${params.toString()}`);
    if (!data) { setMessage("Please sign in and check your Client Billing Read permission."); return; }
    const invoices = data.results ?? [];
    setDispatchInvoices(invoices);
    setDispatchSelectedIds(invoices.filter((row) => !row.dispatched).map((row) => row.id));
    setMessage(invoices.length ? `${invoices.length} finalized invoice(s) loaded.` : "No finalized invoices found for dispatch.");
  }

  async function submitBillDispatch() {
    if (!dispatchInvoices.length) { await loadDispatchInvoices(); return; }
    if (!dispatchSelectedIds.length) { setMessage("Select at least one undispatched invoice."); return; }
    const [year, selectedMonth] = dispatchMonth.split("-");
    setBusy(true);
    try {
      const response = await mk("/api/payroll/client-billing/submit-dispatch/", {
        month: Number(selectedMonth), year: Number(year), invoice_ids: dispatchSelectedIds,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.detail ?? "Unable to submit invoice dispatch.");
      await loadDispatchInvoices();
      setMessage(`${body.submitted} invoice(s) submitted; ${body.already_submitted} were already submitted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to submit invoice dispatch.");
    } finally {
      setBusy(false);
    }
  }

  // Req_final_invoice(): client-side checks + confirm of Final Invoice Print, legacy texts verbatim.
  async function postFinalInvoice() {
    const block = (m: string) => { setMessage(m); alert(m); };
    if (!client || client === "ALL") { block("Please Select Client Name "); return; }
    if (!month) { block("Please Select month & year "); return; }
    if (!state) { block("Please Select State Name "); return; }
    if (state !== "ALL" && !invoiceNo.trim()) { block("Please Enter Invoice No "); return; }
    if (state !== "ALL" && !billDate) { block("Please Enter Bill Date "); return; }
    if (state !== "ALL"
        && !window.confirm(` Invoice No : ${invoiceNo} And Billing Date : ${billDate}\n\n Are you sure want to Final Invoice Print?`)) return;
    setBusy(true);
    setMessage("");
    try {
      const [year, selectedMonth] = monthParts.map(Number);
      const response = await mk("/api/payroll/client-billing/generate/", {
        // attendance:true -> posts exactly what the attendance preview showed (per-employee).
        attendance: true,
        client_code: client,
        client_name: selectedClient?.client_name ?? "",
        gst_no: selectedClient?.gst_no ?? "",
        state,
        unit_code: unit || "ALL",
        month: selectedMonth,
        year,
        invoice_date: billDate,
        reverse_charge: reverseCharge,
        ...formFields(),
      });
      if (!response.ok) {
        const m = await responseMessage(response, "Unable to post invoice.");
        // The gates open their grids exactly like the legacy page does.
        setApprovalKey((k) => k + 1); setStatusKey((k) => k + 1);
        if (m.startsWith("Check  This  Branch")) setDeployKey((k) => k + 1);
        throw new Error(m);
      }
      if ((response.headers.get("Content-Type") || "").includes("zip")) {
        // State = ALL -> zip_files(): ZIP of the finalised states' invoices
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl; a.download = `ALL_${String(selectedMonth).padStart(2, "0")}_${year}_${client}.zip`;
        document.body.appendChild(a); a.click(); a.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
        return;
      }
      const body = await response.json();
      setGeneratedInvoice(body as GeneratedInvoice);
      if (body.invoice_no) setInvoiceNo(body.invoice_no);
      await loadBillingSummary();
      setApprovalKey((k) => k + 1); setStatusKey((k) => k + 1);
      setMessage(`Invoice ${body.invoice_no} posted to the GST register${body.reused ? " (existing invoice re-printed)" : ""}.`);
      alert(`Invoice ${body.invoice_no} posted to the GST register${body.reused ? " (existing invoice re-printed)" : ""}.`);
      // btn_invoice_rpt_Click(): the invoice copy is printed after the flags are written
      downloadManpowerReport("invoice-copy");
    } catch (error) {
      const m = error instanceof Error ? error.message : "Unable to post invoice.";
      setMessage(m); alert(m);
    } finally {
      setBusy(false);
    }
  }

  // Generate the real IRN for the posted invoice (legacy reports_main einvoice_process ->
  // OctaBills GenerateIrn). Fails closed; the backend never fabricates an IRN.
  async function generateEInvoice() {
    if (!generatedInvoice?.invoice_no) {
      setMessage("Post the Final Invoice first — then Generate E-Invoice (IRN).");
      return;
    }
    const [year, selectedMonth] = monthParts.map(Number);
    setBusy(true);
    setMessage("");
    try {
      const response = await mk("/api/payroll/client-billing/generate-einvoice/", {
        invoice_no: generatedInvoice.invoice_no, month: selectedMonth, year,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = body.detail ?? body.non_field_errors?.[0] ?? "Unable to generate e-invoice.";
        throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
      }
      if (body.available) {
        setMessage(`E-Invoice generated — IRN ${body.irn}, Ack No ${body.ack_no} (${body.ack_date}). The Invoice Copy now carries the signed QR.`);
      } else {
        setMessage(`E-Invoice not generated (${body.status}): ${body.detail}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to generate e-invoice.");
    } finally {
      setBusy(false);
    }
  }

  function updateMonth(value: string) {
    setMonth(value);
    setResult(null);
  }

  function legacyAction(action: string) {
    setMessage(`${action} needs a backend workflow that has not been migrated yet.`);
  }

  async function downloadArrearsReport(reportType: "finance-copy" | "attendance" | "rate-breakup" | "final-invoice" | "client-sheet", label: string, isFinal = false) {
    setMessage("");
    const block = (m: string) => { setMessage(m); alert(m); };
    if (!client || client === "ALL") { block("Please Select Client Name "); return; }
    if (!arrearType) { block(reportType === "client-sheet" ? "Please select Arrear type." : "Please Select Arrear Type"); return; }
    if ((reportType === "final-invoice") && !invoiceNo.trim()) { block("Please Enter Invoice No "); return; }
    if ((reportType === "final-invoice") && !billDate) { block("Please Enter Bill Date "); return; }
    const params = new URLSearchParams({ client_code: client, arrear_type: arrearType });
    if (state) params.set("state", state);
    if (unit && unit !== "ALL") params.set("unit_code", unit);
    if (arrearType === "month") {
      if (!month) { block("Please Select month & year "); return; }
      const [year, selectedMonth] = month.split("-");
      params.set("month", String(Number(selectedMonth)));
      params.set("year", year);
    } else {
      if (!arrearFrom) { block("Please Select From Month "); return; }
      if (!arrearTo) { block("Please Select To Month "); return; }
      params.set("from_month", arrearFrom);
      params.set("to_month", arrearTo);
    }

    setBusy(true);
    try {
      const endpoint = reportType === "finance-copy" ? "arrears-finance-copy" : "arrears-report";
      if (reportType !== "finance-copy") params.set("report_type", reportType);
      if (isFinal) params.set("final", "1");   // Final Invoice copy -> DG_<invoice>_<state>.pdf
      const response = await fetch(`${API_BASE_URL}/api/payroll/client-billing/${endpoint}/?${params.toString()}`, {
        credentials: "include",
        headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const detail = body.detail ?? `Unable to download ${label}.`;
        throw new Error(Array.isArray(detail) ? detail.join(" ") : String(detail));
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      // legacy file name comes from the response (ARREARS_*_<client>.xls / Invoice.pdf / DG_<invoice>_<state>.pdf / Arrears_*.xls)
      const cdName = /filename="?([^";]+)"?/.exec(response.headers.get("Content-Disposition") || "");
      link.download = cdName ? cdName[1] : (reportType === "final-invoice" ? "Invoice.pdf" : `ARREARS_${reportType.toUpperCase().replaceAll("-", "_")}_${client}.xls`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setMessage(`${label} downloaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `Unable to download ${label}.`);
    } finally {
      setBusy(false);
    }
  }

  async function processArrearsBill() {
    setMessage("");
    setArrearsRun(null);
    const block = (m: string) => { setMessage(m); alert(m); };
    if (!client || client === "ALL") { block("Please Select Client Name "); return; }
    if (!state) { block("Please Select State Name "); return; }
    if (!arrearType) { block("Please Select Arrear Type"); return; }
    if (!unit) { block("Please Select Branch Name "); return; }
    const payload: Record<string, string | number> = {
      client_code: client,
      state,
      unit_code: unit,
      arrear_type: arrearType,
      ...formFields(),
    };
    if (arrearType === "month") {
      if (!month) { block("Please Select month & year "); return; }
      const [year, selectedMonth] = month.split("-").map(Number);
      payload.year = year;
      payload.month = selectedMonth;
    } else {
      if (!arrearFrom) { block("Please Select From Month "); return; }
      if (!arrearTo) { block("Please Select To Month "); return; }
      payload.from_month = arrearFrom;
      payload.to_month = arrearTo;
    }

    setBusy(true);
    try {
      const response = await mk("/api/payroll/client-billing/arrears-process/", payload);
      if (!response.ok) throw new Error(await responseMessage(response, "Unable to process arrears billing."));
      const body = await response.json();
      setArrearsRun(body as ArrearsRun);
      setMessage(`Arrears calculation run ${body.run_id} completed. It is a preview and has not been approved or invoiced.`);
    } catch (error) {
      const m = error instanceof Error ? error.message : "Unable to process arrears billing.";
      setMessage(m); alert(m);
    } finally {
      setBusy(false);
    }
  }

  // btn_final_arrears_invoice_Click(): Req_arrears_final() checks, then the arrears run is finalised
  async function finalArrearsInvoice() {
    const block = (m: string) => { setMessage(m); alert(m); };
    if (!client || client === "ALL") { block("Please Select Client Name "); return; }
    if (!arrearType) { block("Please Select Arrear Type"); return; }
    if (!invoiceNo.trim()) { block("Please Enter Invoice No "); return; }
    if (!billDate) { block("Please Enter Bill Date "); return; }
    if (!arrearsRun) { block("Process the arrears bill first."); return; }
    const payload: Record<string, string | number> = {
      client_code: client, client_name: selectedClient?.client_name ?? "", gst_no: selectedClient?.gst_no ?? "",
      state, unit_code: unit || "ALL", arrear_type: arrearType, run_id: arrearsRun.run_id, ...formFields(),
    };
    if (arrearType === "month") {
      const [year, selectedMonth] = month.split("-").map(Number);
      payload.year = year; payload.month = selectedMonth;
    } else { payload.from_month = arrearFrom; payload.to_month = arrearTo; }
    setBusy(true);
    try {
      const response = await mk("/api/payroll/client-billing/final-arrears-invoice/", payload);
      if (!response.ok) throw new Error(await responseMessage(response, "Unable to post arrears invoice."));
      const body = await response.json();
      setInvoiceNo(body.invoice_no || invoiceNo);
      const m = `Arrears invoice ${body.invoice_no} posted to the GST register${body.reused ? " (existing invoice re-printed)" : ""}.`;
      setMessage(m); alert(m);
      await downloadArrearsReport("final-invoice", "Final Invoice copy", true);
    } catch (error) {
      const m = error instanceof Error ? error.message : "Unable to post arrears invoice.";
      setMessage(m); alert(m);
    } finally {
      setBusy(false);
    }
  }

  async function processYearlyBilling() {
    setMessage("");
    setYearlyRun(null);
    if (!client || client === "ALL") { setMessage("Please Select Client Name "); return; }
    if (!state) { setMessage("Please Select State Name "); return; }
    if (!unit) { setMessage("Please Select Branch Name "); return; }
    if (!yearlyType) { setMessage("Please Select Yearly Billing Type"); return; }
    if (!yearlyFrom) { setMessage("Please Select From month & year "); return; }
    if (!yearlyTo) { setMessage("Please Select To month & year "); return; }
    setBusy(true);
    try {
      const response = await mk("/api/payroll/client-billing/yearly-process/", {
        client_code: client, state, unit_code: unit, yearly_type: yearlyType,
        from_month: yearlyFrom, to_month: yearlyTo,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = body.detail ?? body.non_field_errors?.[0] ?? (Array.isArray(body) ? body[0] : null) ?? "Unable to process yearly billing.";
        throw new Error(Array.isArray(detail) ? detail.join(" ") : String(detail));
      }
      setYearlyRun(body as YearlyBillingRun);
      setMessage(`Yearly Bonus run ${body.run_id} staged from finalized monthly billing. No invoice has been posted.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to process yearly billing.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadYearlyReport(reportType: "finance-copy" | "yearly-bill") {
    if (!yearlyRun) {
      setMessage("Process the yearly Bonus bill first.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const params = new URLSearchParams({ run_id: String(yearlyRun.run_id), report_type: reportType });
      const response = await fetch(`${API_BASE_URL}/api/payroll/client-billing/yearly-report/?${params.toString()}`, {
        credentials: "include", headers: { Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.detail ?? "Unable to download yearly billing report.");
      }
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      // legacy names: "<Bonus Billing>_FINANCE_COPY_<client>.xls" (Finance Copy) / "Invoice.pdf" (Yearly Bill)
      const cdYearly = /filename="?([^";]+)"?/.exec(response.headers.get("Content-Disposition") || "");
      link.download = cdYearly ? cdYearly[1] : (reportType === "yearly-bill" ? "Invoice.pdf" : `Bonus Billing_FINANCE_COPY_${client}.xls`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setMessage(`${reportType === "finance-copy" ? "Finance Copy" : "Yearly Bill"} downloaded.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to download yearly billing report.");
    } finally {
      setBusy(false);
    }
  }

  async function finalizeYearlyBilling() {
    if (!yearlyRun) {
      setMessage("Process the yearly Bonus bill first.");
      return;
    }
    if (!window.confirm("Post this staged yearly Bonus bill to the GST register?")) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await mk("/api/payroll/client-billing/final-yearly-bill/", { run_id: yearlyRun.run_id });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = body.detail ?? "Unable to post yearly invoice.";
        throw new Error(Array.isArray(detail) ? detail.join(" ") : String(detail));
      }
      setYearlyRun({ ...yearlyRun, finalized: true, invoices: body.invoices ?? [] });
      setMessage(`Yearly invoice${body.invoices?.length === 1 ? "" : "s"} posted to the GST register${body.reused ? " (existing invoice reused)" : ""}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to post yearly invoice.");
    } finally {
      setBusy(false);
    }
  }

  async function sendBillingZip(archiveType: "standard" | "rm") {
    if (!mailRecipient.trim()) { setMessage("Please Select Email Id"); return; }
    if (!client || !month || !mailRecipient.trim() || !selectedDocumentIds.length) {
      setMessage("Select a client/month, enter a recipient and choose uploaded documents first.");
      return;
    }
    const [year, selectedMonth] = month.split("-").map(Number);
    setBusy(true);
    setMessage("");
    try {
      const response = await mk("/api/payroll/client-billing/send-bill-zip/", {
        client_code: client, month: selectedMonth, year, to_email: mailRecipient,
        document_ids: selectedDocumentIds, archive_type: archiveType,
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        const detail = body.detail ?? `Unable to send ${archiveType === "rm" ? "R&M" : "billing"} ZIP.`;
        throw new Error(Array.isArray(detail) ? detail.join(" ") : String(detail));
      }
      setMessage(`${archiveType === "rm" ? "R&M" : "Billing"} ZIP sent. Email status: ${body.status}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to send billing ZIP.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-fluid" style={{ maxWidth: "99%", margin: "0 auto" }}>
      <section className="lg-panel">
        <header className="lg-panel-head" style={{ textAlign: "center", padding: "12px 18px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ width: 24 }} /><b>Billing Rates</b>
            <a href="/html/grade_unit_billing.html" target="_blank" rel="noreferrer" aria-label="Open billing help">
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </a>
          </div>
        </header>
        <div className="lg-panel-body">
          <section style={{ background: "#f6f3ff", border: "1px solid #bfbcbc", borderRadius: 4, padding: 14 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: "10px 16px" }}>
              <label className="lg-row"><span className="lg-label">Select Month <span className="lg-req">*</span></span>
                <input className="lg-control" type="month" value={month} onChange={(event) => updateMonth(event.target.value)} /></label>
              <label className="lg-row"><span className="lg-label">Client Name <span className="lg-req">*</span></span>
                <select className="lg-control" value={client} onChange={(event) => setClient(event.target.value)}>
                  <option value="">Select</option><option value="ALL">ALL</option>{clients.map((item) => <option key={item.client_code} value={item.client_code}>{item.client_name}{CLIENT_SUFFIX[item.client_code] ?? ""}</option>)}
                </select></label>
              {/* Legacy: .billingProcess shown only for client "BAJAJ FINANCE LIMITED". */}
              {selectedClient?.client_name === "BAJAJ FINANCE LIMITED" && (
              <label className="lg-row"><span className="lg-label">Billing Process</span>
                <select className="lg-control" value={billingProcess} onChange={(event) => setBillingProcess(event.target.value)}>
                  <option value="Regular">Regular</option><option value="Metro">Metro</option><option value="Non Metro">Non Metro</option>
                </select></label>
              )}
              <label className="lg-row"><span className="lg-label">Billing Type <span className="lg-req">*</span></span>
                <select className="lg-control" value={billingType} onChange={(event) => { setBillingType(event.target.value); setResult(null); }} disabled={!client}>
                  <option value="">Select</option>
                  {billingTypeNames.map((item) => <option key={item} value={item}>{item}</option>)}
                </select></label>
              {/* Legacy: .region shown only for "BAJAJ ALLIANZ GENERAL INSURANCE COMPANY LTD." */}
              {selectedClient?.client_name === "BAJAJ ALLIANZ GENERAL INSURANCE COMPANY LTD." && (
              <label className="lg-row"><span className="lg-label">Region</span>
                <select className="lg-control" value={region} onChange={(event) => setRegion(event.target.value)}>
                  <option value="">Select</option><option value="ALL">ALL</option>
                  {(formOpts?.regions ?? []).map((item) => <option key={item} value={item}>{item}</option>)}
                </select></label>
              )}
              {/* Legacy: ddcomp_group.Visible only when client code == "RCPL" (Reliance Capital Ltd.) */}
              {client === "RCPL" && (
              <label className="lg-row"><span className="lg-label">Company Groups <span className="lg-req">*</span></span>
                <select className="lg-control" value={companyGroup} onChange={(event) => setCompanyGroup(event.target.value)}>
                  <option value="">Select</option>{companyGroups.map((item) => <option key={item} value={item}>{item}</option>)}
                </select></label>
              )}
              <label className="lg-row"><span className="lg-label">State Name <span className="lg-req">*</span></span>
                <select className="lg-control" value={state} onChange={(event) => { setState(event.target.value); setUnit(""); }} disabled={!client}>
                  <option value="">Select</option><option value="ALL">ALL</option>{availableStates.map((item) => <option key={item} value={item}>{item}</option>)}
                </select></label>
              <label className="lg-row"><span className="lg-label">Branch Name <span className="lg-req">*</span></span>
                <select className="lg-control" value={unit} onChange={(event) => setUnit(event.target.value)} disabled={!client}>
                  <option value="">Select</option><option value="ALL">ALL</option>{availableUnits.map((item) => <option key={item.unit_code} value={item.unit_code}>{item.unit_name}</option>)}
                </select></label>
              <label className="lg-row"><span className="lg-label">Process Data</span>
                <select className="lg-control" value={processData} onChange={(event) => setProcessData(event.target.value)}><option value="0">Current Policy</option><option value="1">Old Policy</option></select></label>
            </div>
            <div style={{ borderTop: "1px solid #d4d0df", marginTop: 8, paddingTop: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))", gap: "10px 16px" }}>
                <label className="lg-row"><span className="lg-label">Invoice No</span>
                  <input className="lg-control" value={invoiceNo} onChange={(event) => setInvoiceNo(event.target.value)} placeholder={generatedInvoice?.invoice_no ?? ""} /></label>
                <label className="lg-row"><span className="lg-label">Bill Date</span>
                  <input className="lg-control" type="date" value={billDate} onChange={(event) => setBillDate(event.target.value)} /></label>
                <label className="lg-row"><span className="lg-label">Reverse Charge</span>
                  <input type="checkbox" checked={reverseCharge} onChange={(event) => setReverseCharge(event.target.checked)} title="Client pays the GST: the invoice is printed without CGST/SGST/IGST (Reverse Charge: Yes)" /></label>
                <label className="lg-row"><span className="lg-label">PO No</span>
                  <input className="lg-control" value={poNo} onChange={(event) => setPoNo(event.target.value)} /></label>
                <label className="lg-row"><span className="lg-label">Invoice Type</span>
                  <select className="lg-control" value={invoiceType} onChange={(event) => setInvoiceType(event.target.value)}><option>Club</option><option>Unclub</option></select></label>
                {/* Legacy: desigpanel.Visible only when Invoice Type = UNCLUB. */}
                {invoiceType === "Unclub" && (
                <label className="lg-row"><span className="lg-label">Designation</span>
                  <select className="lg-control" value={designation} onChange={(event) => setDesignation(event.target.value)} disabled={!client}>
                    <option value="">Select</option>{designations.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select></label>
                )}
                <label className="lg-row"><span className="lg-label">Billing Start Day</span>
                  <select className="lg-control" value={startDay} onChange={(event) => setStartDay(event.target.value)}>
                    <option value="0">Select</option>{DAY_OPTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select></label>
                <label className="lg-row"><span className="lg-label">Billing End Day</span>
                  <select className="lg-control" value={endDay} onChange={(event) => setEndDay(event.target.value)}>
                    <option value="0">Select</option>{DAY_OPTS.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select></label>
              </div>
            </div>
          </section>

          <div role="tablist" aria-label="Billing sub-functions" style={{ display: "flex", gap: 3, overflowX: "auto", border: "1px solid #aaa", borderRadius: 4, background: "#fff", padding: 5, marginTop: 18 }}>
            {BILLING_TABS.map((tab) => {
              const selected = activeTab === tab;
              return <button key={tab} role="tab" aria-selected={selected} onClick={() => { setActiveTab(tab); setMessage(""); }}
                style={{ flex: "0 0 auto", minHeight: 50, padding: "0 18px", fontSize: 13, background: selected ? "#fff" : "#424d7a", color: selected ? "#424d7a" : "#fff", border: selected ? "2px solid #222" : "1px solid #fff", borderRadius: 4, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                {tab}
              </button>;
            })}
          </div>

          <section role="tabpanel" style={{ minHeight: 230, background: "#f6f5dc", border: "1px solid #aaa", borderTop: 0, borderRadius: "0 0 4px 4px", padding: "38px 14px 14px" }}>
            {activeTab === "Arrears Billing" && <>
              <label style={{ display: "block", width: "min(275px, 100%)", margin: "0 0 31px 4px" }}>
                <span className="lg-label">Arrear Type :</span>
                <select className="lg-control" value={arrearType} onChange={(event) => setArrearType(event.target.value)} style={{ marginTop: 2 }}>
                  <option value="">Select</option><option value="month">Month Wise</option><option value="policy">Policy Wise</option>
                </select>
              </label>
              {arrearType === "policy" && <div style={{ display: "flex", gap: 14, flexWrap: "wrap", margin: "-14px 0 18px 4px" }}>
                <label className="lg-row" style={{ width: 220 }}><span className="lg-label">From Month <span className="lg-req">*</span></span><input type="month" className="lg-control" value={arrearFrom} onChange={(event) => setArrearFrom(event.target.value)} /></label>
                <label className="lg-row" style={{ width: 220 }}><span className="lg-label">To Month <span className="lg-req">*</span></span><input type="month" className="lg-control" value={arrearTo} onChange={(event) => setArrearTo(event.target.value)} /></label>
              </div>}
              <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }}>
                {["Process", "Arrears Client Attendances", "Arrears Rate Breakup", "Arrears Finance Copy", "Arrears Invoice Copy", "Final Invoice copy"].map((action, index) => {
                  const widths = [165, 366, 276, 277, 276, 180];
                  const isProcess = action === "Process";
                  const isFinanceCopy = action === "Arrears Finance Copy";
                  const reportType = action === "Arrears Client Attendances" ? "attendance"
                    : action === "Arrears Rate Breakup" ? "rate-breakup"
                    : action === "Final Invoice copy" || action === "Arrears Invoice Copy" ? "final-invoice" : null;
                  return <button key={action} className="lg-btn lg-btn-primary" onClick={() => isProcess ? processArrearsBill() : action === "Final Invoice copy" ? finalArrearsInvoice() : isFinanceCopy ? downloadArrearsReport("finance-copy", action) : reportType ? downloadArrearsReport(reportType, action) : legacyAction(action)} disabled={busy && (isProcess || Boolean(reportType) || isFinanceCopy)} style={{ width: widths[index], minHeight: 40, padding: "0 8px", fontFamily: "Georgia, serif", fontSize: 16 }}>{isProcess && busy ? "Processing..." : (isFinanceCopy || reportType) && busy ? "Downloading..." : action}</button>;
                })}
              </div>
              <div style={{ marginTop: 16 }}><button className="lg-btn lg-btn-primary" onClick={() => downloadArrearsReport("client-sheet", "Client Sheet")} disabled={busy} style={{ width: 183, minHeight: 40, fontFamily: "Georgia, serif", fontSize: 16 }}>{busy ? "Downloading..." : "Client Sheet"}</button></div>
              {arrearsRun && <div style={{ overflowX: "auto", marginTop: 18 }}>
                <b>Arrears Calculation Preview · Run {arrearsRun.run_id} · {arrearsRun.emp_count} employees</b>
                <table className="lg-grid">
                  <thead><tr><th>Month</th><th>Designation</th><th>Employees</th><th>Working Days</th><th>Rate / Employee</th></tr></thead>
                  <tbody>{arrearsRun.lines.map((line, index) => <tr key={`${line.year}-${line.month}-${line.designation}-${index}`}>
                    <td>{String(line.month).padStart(2, "0")}/{line.year}</td>
                    <td>{line.designation}</td>
                    <td>{line.head_count}</td>
                    <td>{line.days}</td>
                    <td>{money(line.per_person_grand_total)}</td>
                  </tr>)}</tbody>
                </table>
              </div>}
            </>}

            {activeTab === "Yearly Billing" && <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 275px))", gap: 14, marginBottom: 25 }}>
                <label className="lg-row"><span className="lg-label">Yearly Billing Type <span className="lg-req">*</span></span><select className="lg-control" value={yearlyType} onChange={(event) => setYearlyType(event.target.value)}><option value="">Select</option><option value="bonus">Bonus Billing</option><option value="leave" disabled>Leave Billing</option><option value="gratuity" disabled>Gratuity Billing</option></select></label>
                <label className="lg-row"><span className="lg-label">From Month <span className="lg-req">*</span></span><input type="month" className="lg-control" value={yearlyFrom} onChange={(event) => { setYearlyFrom(event.target.value); setYearlyRun(null); }} /></label>
                <label className="lg-row"><span className="lg-label">To Month <span className="lg-req">*</span></span><input type="month" className="lg-control" value={yearlyTo} onChange={(event) => { setYearlyTo(event.target.value); setYearlyRun(null); }} /></label>
              </div>
              <div style={{ display: "flex", gap: 11, flexWrap: "wrap" }}>
                <button className="lg-btn lg-btn-primary" onClick={processYearlyBilling} disabled={busy}>{busy ? "Processing..." : "Process"}</button>
                <button className="lg-btn lg-btn-primary" onClick={() => downloadYearlyReport("finance-copy")} disabled={busy || !yearlyRun}>Finance Copy</button>
                <button className="lg-btn lg-btn-primary" onClick={() => downloadYearlyReport("yearly-bill")} disabled={busy || !yearlyRun}>Yearly Bill</button>
                <button className="lg-btn lg-btn-primary" onClick={finalizeYearlyBilling} disabled={busy || !yearlyRun || yearlyRun.finalized}>Final Yearly Bill</button>
              </div>
              {yearlyRun && <div style={{ overflowX: "auto", marginTop: 16 }}>
                <b>Yearly Bonus Run {yearlyRun.run_id} · {yearlyRun.count} rows {yearlyRun.finalized ? "· Finalized" : "· Preview"}</b>
                <table className="lg-grid"><thead><tr><th>Month</th><th>Employee</th><th>Designation</th><th>Bonus</th><th>Service Charge</th><th>Amount</th><th>GST</th></tr></thead>
                  <tbody>{yearlyRun.lines.map((line, index) => <tr key={`${line.year}-${line.month}-${line.emp_code}-${index}`}>
                    <td>{String(line.month).padStart(2, "0")}/{line.year}</td><td>{line.emp_name} ({line.emp_code})</td><td>{line.designation}</td>
                    <td>{money(line.yearly_bonus)}</td><td>{money(line.service_charge)}</td><td>{money(line.amount)}</td><td>{money(line.cgst + line.sgst + line.igst)}</td>
                  </tr>)}</tbody></table>
                {yearlyRun.invoices?.map((invoice) => <div className="lg-alert" key={invoice.invoice_no}>Invoice {invoice.invoice_no} · {invoice.state_name} · {money(invoice.invoice_value)}</div>)}
              </div>}
            </>}

            {activeTab === "Bill Upload" && (
              <BillUploadTab client={client} month={Number(month.split("-")[1])} year={Number(month.split("-")[0])}
                onClientSheet={() => downloadManpowerReport("client-sheet")} notify={setMessage} />
            )}

            {activeTab === "Bill Dispatch" && <>
              <div style={{ display: "flex", alignItems: "end", gap: 14, flexWrap: "wrap" }}>
                <label className="lg-row" style={{ width: 240 }}><span className="lg-label">Month :</span><input type="month" className="lg-control" value={dispatchMonth} onChange={(event) => { setDispatchMonth(event.target.value); setDispatchInvoices([]); setDispatchSelectedIds([]); }} /></label>
                <button className="lg-btn" onClick={loadDispatchInvoices} disabled={busy}>Show</button>
                <button className="lg-btn lg-btn-primary" onClick={submitBillDispatch} disabled={busy || dispatchSelectedIds.length === 0}>{busy ? "Submitting..." : "Submit"}</button>
              </div>
              <div style={{ overflowX: "auto" }}><table className="lg-grid" style={{ marginTop: 16 }}>
                <thead><tr><th>Select</th><th>Invoice No.</th><th>Client</th><th>State</th><th>Branch</th><th>Invoice Value</th><th>Status</th></tr></thead>
                <tbody>{dispatchInvoices.map((invoice) => <tr key={invoice.id}>
                  <td><input type="checkbox" aria-label={`Select invoice ${invoice.invoice_no}`} disabled={invoice.dispatched} checked={invoice.dispatched || dispatchSelectedIds.includes(invoice.id)} onChange={(event) => setDispatchSelectedIds((current) => event.target.checked ? [...current, invoice.id] : current.filter((id) => id !== invoice.id))} /></td>
                  <td>{invoice.invoice_no}</td><td>{invoice.client_name || invoice.client_code}</td><td>{invoice.state_name || "-"}</td>
                  <td>{invoice.unit_code || "-"}</td><td>{money(invoice.invoice_value)}</td><td>{invoice.dispatched ? "Submitted" : "Pending"}</td>
                </tr>)}
                {dispatchInvoices.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center" }}>Use Show to load finalized invoices for dispatch.</td></tr>}</tbody>
              </table></div>
            </>}

            {activeTab === "Billing Summary Report" && <div style={{ display: "flex", gap: 14, alignItems: "end", flexWrap: "wrap" }}>
              <label className="lg-row" style={{ width: 250 }}><span className="lg-label">Report type <span className="lg-req">*</span></span><select className="lg-control" value={reportType} onChange={(event) => setReportType(event.target.value)}><option value="Salary Slip Sending Details">Salary Slip Sending Details</option><option value="Monthwise Billing Details">Monthwise Billing Details</option></select></label>
              {reportType === "Monthwise Billing Details" && <label className="lg-row" style={{ width: 230 }}><span className="lg-label">Billing type <span className="lg-req">*</span></span><select className="lg-control" value={summaryBillType} onChange={(event) => setSummaryBillType(event.target.value)}><option value="">Select</option><option value="1">Clientwise Bill</option><option value="2">Statewise Bill</option><option value="3">Branchwise Bill</option></select></label>}
              <button className="lg-btn lg-btn-primary" onClick={downloadSummaryReport} disabled={busy}>Get Report</button>
            </div>}

            {activeTab === "Send Soft Copy" && <>
              <div style={{ display: "flex", alignItems: "end", gap: 12, flexWrap: "wrap" }}>
                <label className="lg-row" style={{ width: "min(360px, 100%)" }}><span className="lg-label">To Mail Id <span className="lg-req">*</span></span><input className="lg-control" type="text" value={mailRecipient} onChange={(event) => setMailRecipient(event.target.value)} placeholder="name@example.com" /></label>
                <button className="lg-btn" onClick={loadBillDocuments} disabled={busy}>Show Uploads</button>
                <button className="lg-btn lg-btn-primary" onClick={() => sendBillingZip("standard")} disabled={busy || !selectedDocumentIds.length}>{busy ? "Sending..." : "Send Zip File"}</button>
                <button className="lg-btn lg-btn-primary" onClick={() => sendBillingZip("rm")} disabled={busy || !selectedDocumentIds.length}>{busy ? "Sending..." : "Send RM Zip File"}</button>
              </div>
              <div style={{ overflowX: "auto", marginTop: 12 }}><table className="lg-grid">
                <thead><tr><th>Select</th><th>Document Type</th><th>State</th><th>File</th><th>Size</th></tr></thead>
                <tbody>{billingDocuments.map((doc) => <tr key={doc.id}>
                  <td><input type="checkbox" aria-label={`Include ${doc.file_name} in ZIP`} checked={selectedDocumentIds.includes(doc.id)} onChange={(event) => setSelectedDocumentIds((current) => event.target.checked ? [...current, doc.id] : current.filter((id) => id !== doc.id))} /></td>
                  <td>{doc.document_type}</td><td>{doc.state_name || "Client-wide"}</td><td>{doc.file_name}</td><td>{Math.max(1, Math.ceil(doc.file_size / 1024))} KB</td>
                </tr>)}{billingDocuments.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center" }}>Use Show Uploads to load files for the selected month.</td></tr>}</tbody>
              </table></div>
            </>}

            {summaryLoaded && (activeTab === "Billing Summary Report" || activeTab === "Arrears Billing") && <div style={{ overflowX: "auto", marginTop: 20 }}>
              <table className="lg-grid">
                <thead><tr><th>Invoice No.</th><th>Client</th><th>State</th><th>Branch</th><th>Invoice Date</th><th>Type</th><th>Employees</th><th>Invoice Value</th><th>Flag</th></tr></thead>
                <tbody>{summaryRows.map((row) => <tr key={row.id}>
                  <td>{row.invoice_no || "-"}</td><td>{row.client_name || row.client_code}</td><td>{row.state_name || "-"}</td>
                  <td>{row.unit_code || "-"}</td><td>{row.invoice_date || "-"}</td><td>{row.type || "-"}</td>
                  <td>{row.emp_count}</td><td>{money(row.invoice_value)}</td><td>{row.payment_status || row.flag_invoice}</td>
                </tr>)}
                {summaryRows.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center" }}>No billing records found for this period.</td></tr>}</tbody>
              </table>
            </div>}

            {message && <div className="lg-alert" role="status" style={{ marginTop: 14, background: "#fcf8e3", borderColor: "#faebcc", color: "#8a6d3b" }}>{message}</div>}

          {/* Billing-type-driven area belongs to the "Manpower Billing" main tab only
              (legacy): other sub-tabs (Arrears/Yearly/etc.) must not show it. */}
          {activeTab === "Manpower Billing" && <>
          {/* Legacy billing_rates(): a non-Manpower Billing Type shows its own
              section with its own buttons. Processing for these is staged. */}
          {billingType && billingType !== "Manpower Billing" && (
            <section style={{ marginTop: 18 }}>
              <h2 className="lg-subhead">{billingType}</h2>
              {billingType === "Conveyance Billing" && !isMcBillingType(billingType) && (
                <div style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <b>Conveyance Type:</b>
                  {(["Employee", "Driver"] as const).map((m) => (
                    <button key={m} className={conveyanceMode === m ? "lg-btn lg-btn-primary" : "lg-btn"} onClick={() => setConveyanceMode(m)}
                      style={{ padding: "4px 14px" }}>
                      {m === "Employee" ? "Employee Conveyance" : "Driver Conveyance"}
                    </button>
                  ))}
                </div>
              )}
              {SUB_BILL_TYPES[billingType] && !isFamilyBillingType(billingType) && (
                <SubBillSection billingType={billingType} cfg={SUB_BILL_TYPES[billingType]} scope={scope}
                  fields={formFields()} invoiceNo={invoiceNo} billDate={billDate} setMessage={setMessage} />
              )}
              {/* Deep Clean / Pest Control / OT tabs: own components (ClientBillingFamilies.tsx) */}
              {isFamilyBillingType(billingType) && (() => {
                const famCtx = { client, clientName: selectedClient?.client_name ?? "", state, unit, month, scope,
                  fields: formFields(), invoiceNo, billDate, setInvoiceNo, setMessage };
                return billingType === "OT Billing"
                  ? <OtSection ctx={famCtx} />
                  : <DeepCleanPestSection ctx={famCtx} family={billingType === "Deep Clean Billing" ? "deepclean" : "pest"} />;
              })()}
              {/* Material / Conveyance tabs: own component (ClientBillingMaterialConveyance.tsx) */}
              {isMcBillingType(billingType) && (
                <MaterialConveyanceSection billingType={billingType} ctx={{ client, clientName: selectedClient?.client_name ?? "", state, unit, month }}
                  fields={formFields()} invoiceNo={invoiceNo} billDate={billDate} setMessage={setMessage} />
              )}
              {!SUB_BILL_TYPES[billingType] && !isFamilyBillingType(billingType) && !isMcBillingType(billingType) && <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                {((billingType === "Conveyance Billing" && conveyanceMode === "Driver")
                  ? ["Process", "Driver Finance Copy", "Driver Bill", "Final Driver Bill", "Driver Report"]
                  : (BILLING_TYPE_SECTIONS[billingType] ?? ["Process"])).map((label) => {
                  const isMaterialFam = ["Material Billing", "Deep Clean Billing", "Pest Control Billing"].includes(billingType);
                  const isFinanceCopy = label.endsWith("Finance Copy");
                  const isDriver = billingType === "Conveyance Billing" && conveyanceMode === "Driver";
                  // Labels that post the Final Invoice to the GST register (pay_report_gst).
                  const isPostInvoice =
                    (billingType === "Material Billing" && label === "Final Invoice Print")
                    || (billingType === "Deep Clean Billing" && label === "Final Deep Cleaning Bill")
                    || (billingType === "Pest Control Billing" && label === "Invoice Copy")
                    || (billingType === "Conveyance Billing" && !isDriver && label === "Final Conveyance Bill")
                    || (isDriver && label === "Final Driver Bill");
                  const live = (billingType === "Conveyance Billing" && !isDriver && (label === "Process" || label === "Conveyance Finance Copy"))
                    || (isDriver && (label === "Process" || label === "Driver Finance Copy"))
                    || (isMaterialFam && (label === "Process" || isFinanceCopy))
                    || isPostInvoice;
                  return (
                    <button key={label} className="lg-btn lg-btn-primary" disabled={busy && (label === "Process" || isPostInvoice)}
                      style={{ minHeight: 40, padding: "0 14px", fontFamily: "Georgia, serif", fontSize: 15, opacity: live ? 1 : 0.85 }}
                      onClick={() => {
                        if (isDriver && label === "Process") { processConveyanceDriver(); return; }
                        if (isDriver && label === "Driver Finance Copy") { downloadDriverFinanceCopy(); return; }
                        if (billingType === "Conveyance Billing" && !isDriver && label === "Process") { processConveyance(); return; }
                        if (billingType === "Conveyance Billing" && !isDriver && label === "Conveyance Finance Copy") { downloadConveyanceFinanceCopy(); return; }
                        if (isMaterialFam && label === "Process") { processMaterialFamily(); return; }
                        if (isMaterialFam && isFinanceCopy) { downloadMaterialFinanceCopy(); return; }
                        if (isPostInvoice) { postTypeInvoice(); return; }
                        setMessage(`"${billingType}"${isDriver ? " (Driver)" : ""} "${label}" workflow is not migrated yet (staged). Process + Finance Copy + Final Invoice posting are live for Conveyance (Emp+Driver)/Material/Deep Clean/Pest Control; Manpower is fully functional.`);
                      }}>
                      {busy && live && (label === "Process" || isPostInvoice) ? "Processing..." : label}
                    </button>
                  );
                })}
              </div>}
              {billingType === "Conveyance Billing" && conveyanceMode === "Driver" && driverLoaded && (
                <div style={{ overflowX: "auto", marginTop: 6 }}>
                  <table className="lg-grid">
                    <thead><tr><th>Emp Code</th><th>Employee</th><th>State</th><th>Branch</th><th>Designation</th><th>Subtotal</th><th>Service Charge</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Grand Total</th></tr></thead>
                    <tbody>
                      {driverRows.map((r, i) => <tr key={i}>
                        <td>{r.emp_code}</td><td>{r.emp_name}</td><td>{r.state_name}</td><td>{r.unit_name}</td><td>{r.designation}</td>
                        <td>{money(Number(r.subtotal_a))}</td><td>{money(Number(r.service_charge))}</td><td>{money(Number(r.taxable))}</td>
                        <td>{money(Number(r.cgst))}</td><td>{money(Number(r.sgst))}</td><td>{money(Number(r.igst))}</td><td>{money(Number(r.grand_total))}</td>
                      </tr>)}
                      {driverRows.length === 0 && <tr><td colSpan={12} style={{ textAlign: "center" }}>No driver conveyance data for this selection.</td></tr>}
                    </tbody>
                    {driverTotals && <tfoot><tr><th colSpan={5}>TOTAL ({driverRows.length})</th>
                      <th>{money(driverTotals.subtotal_a)}</th><th>{money(driverTotals.service_charge)}</th><th>{money(driverTotals.taxable)}</th>
                      <th>{money(driverTotals.cgst)}</th><th>{money(driverTotals.sgst)}</th><th>{money(driverTotals.igst)}</th><th>{money(driverTotals.grand_total)}</th></tr></tfoot>}
                  </table>
                </div>
              )}
              {billingType === "Conveyance Billing" && conveyanceMode === "Employee" && conveyanceLoaded && (
                <div style={{ overflowX: "auto", marginTop: 6 }}>
                  <table className="lg-grid">
                    <thead><tr><th>Emp Code</th><th>Employee</th><th>State</th><th>Branch</th><th>Designation</th><th>Rate</th><th>Service Charge</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Grand Total</th></tr></thead>
                    <tbody>
                      {conveyanceRows.map((r, i) => <tr key={i}>
                        <td>{r.emp_code}</td><td>{r.emp_name}</td><td>{r.state_name}</td><td>{r.unit_name}</td><td>{r.designation}</td>
                        <td>{money(Number(r.base))}</td><td>{money(Number(r.service_charge))}</td><td>{money(Number(r.taxable))}</td>
                        <td>{money(Number(r.cgst))}</td><td>{money(Number(r.sgst))}</td><td>{money(Number(r.igst))}</td><td>{money(Number(r.grand_total))}</td>
                      </tr>)}
                      {conveyanceRows.length === 0 && <tr><td colSpan={12} style={{ textAlign: "center" }}>No conveyance billing data for this selection.</td></tr>}
                    </tbody>
                    {conveyanceTotals && <tfoot><tr><th colSpan={5}>TOTAL ({conveyanceRows.length})</th>
                      <th>{money(conveyanceTotals.base)}</th><th>{money(conveyanceTotals.service_charge)}</th><th>{money(conveyanceTotals.taxable)}</th>
                      <th>{money(conveyanceTotals.cgst)}</th><th>{money(conveyanceTotals.sgst)}</th><th>{money(conveyanceTotals.igst)}</th><th>{money(conveyanceTotals.grand_total)}</th></tr></tfoot>}
                  </table>
                  <div style={{ fontSize: 12, color: "#555", fontWeight: "bold" }}>Total: {conveyanceRows.length} records</div>
                </div>
              )}
              {["Material Billing"].includes(billingType) && materialLoaded && (
                <div style={{ overflowX: "auto", marginTop: 6 }}>
                  <table className="lg-grid">
                    <thead><tr><th>State</th><th>Branch</th><th>Designation</th><th>Total</th><th>Handling</th><th>Taxable</th><th>CGST</th><th>SGST</th><th>IGST</th><th>Grand Total</th></tr></thead>
                    <tbody>
                      {materialRows.map((r, i) => <tr key={i}>
                        <td>{r.state_name}</td><td>{r.unit_name}</td><td>{r.designation}</td>
                        <td>{money(Number(r.total))}</td><td>{money(Number(r.handling_charge))}</td><td>{money(Number(r.taxable))}</td>
                        <td>{money(Number(r.cgst))}</td><td>{money(Number(r.sgst))}</td><td>{money(Number(r.igst))}</td><td>{money(Number(r.grand_total))}</td>
                      </tr>)}
                      {materialRows.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center" }}>No billing data for this selection.</td></tr>}
                    </tbody>
                    {materialTotals && <tfoot><tr><th colSpan={3}>TOTAL ({materialRows.length})</th>
                      <th>{money(materialTotals.total)}</th><th>{money(materialTotals.handling_charge)}</th><th>{money(materialTotals.taxable)}</th><th>{money(materialTotals.cgst)}</th>
                      <th>{money(materialTotals.sgst)}</th><th>{money(materialTotals.igst)}</th><th>{money(materialTotals.grand_total)}</th></tr></tfoot>}
                  </table>
                  <div style={{ fontSize: 12, color: "#555", fontWeight: "bold" }}>Total: {materialRows.length} records</div>
                </div>
              )}
              {!SUB_BILL_TYPES[billingType] && !isFamilyBillingType(billingType) && !isMcBillingType(billingType) && <div className="lg-alert" role="status" style={{ background: "#fcf8e3", borderColor: "#faebcc", color: "#8a6d3b", marginTop: 12 }}>
                {["Conveyance Billing", "Material Billing", "Deep Clean Billing", "Pest Control Billing"].includes(billingType)
                  ? `${billingType}: Process, Finance Copy and Final Invoice posting (GST register) are available. The Final Invoice button posts the invoice to the GST register per state (idempotent). Digital print and IRP e-invoice (IRN) are not available for this billing type yet.`
                  : `${billingType}: the buttons match the legacy screen. The calculation for this billing type is not available yet; Manpower, Conveyance, Material, Deep Clean and Pest Control are available.`}
              </div>}
            </section>
          )}

          {(billingType === "" || billingType === "Manpower Billing") && <section style={{ marginTop: 18 }}>
            {/* Legacy grade_unit_billing #tabs-1 Manpower button row (green), always visible. */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center", marginBottom: 18 }}>
              {(BILLING_TYPE_SECTIONS["Manpower Billing"] ?? []).filter((label) => label !== "Support Format" || client === "MAX").map((label) => {
                const reportType = MANPOWER_REPORT_TYPE[label];
                const isProcess = label === "Process";
                const isFinal = label === "Final Invoice Print";
                const isEInvoice = label === "Generate E-Invoice";
                return (
                  <button key={label} className="lg-btn lg-btn-primary"
                    style={{ minHeight: 40, padding: "0 16px" }}
                    disabled={(busy && (isProcess || isFinal || isEInvoice)) || (isEInvoice && !generatedInvoice)}
                    onClick={() => {
                      if (isProcess) { processBill(); return; }
                      if (isFinal) { postFinalInvoice(); return; }
                      if (isEInvoice) { generateEInvoice(); return; }
                      if (reportType) { downloadManpowerReport(reportType); return; }
                      if (label === "Report") { showNotifications(); return; }
                      if (label === "Support Format") { void downloadSupportFormat(); return; }
                      if (label === "Client Feedback") { void downloadFeedbackReport(); return; }
                    }}>
                    {busy && isProcess ? "Processing..." : busy && isFinal ? "Posting..." : busy && isEInvoice ? "Generating IRN..." : label}
                  </button>
                );
              })}
              <button className="lg-btn lg-btn-danger" title="Undo the FINAL invoice of the selected client / state / month so it can be Processed again"
                style={{ minHeight: 40, padding: "0 16px" }} disabled={busy}
                onClick={async () => {
                  if (!client || client === "ALL") { alert("Please Select Client Name "); return; }
                  if (!state) { alert("Please Select State Name "); return; }
                  if (!month) { alert("Please select month & year "); return; }
                  const reason = (window.prompt("Reason for cancelling the Final Invoice of " + state + " " + month + " :") || "").trim();
                  if (!reason) { alert("Please Enter Reason for Cancel Invoice"); return; }
                  if (!window.confirm("Cancel the Final Invoice of " + state + " for " + month + "? The branches become unlocked and can be Processed again.")) return;
                  setBusy(true);
                  try {
                    const [yy, mm] = month.split("-").map(Number);
                    const r = await mk("/api/payroll/client-billing/cancel-final-invoice/", { client_code: client, state, month: mm, year: yy, reason });
                    if (!r.ok) { const m = await responseMessage(r, "Cancel failed."); setMessage(m); alert(m); return; }
                    const b = await r.json();
                    setMessage(b.message); alert(b.message);
                  } finally { setBusy(false); }
                }}>Cancel Final Invoice</button>
              <button className="lg-btn lg-btn-danger" title="Clear selection"
                style={{ minHeight: 40, padding: "0 20px" }}
                onClick={() => { window.location.href = "/Home"; }}>CLOSE</button>
            </div>
            {/* Legacy grade_unit_billing.aspx Manpower section has NO billing-lines
                grid (no Designation/Policy/Line Amount table) — Process computes
                server-side; output is via the report buttons + Final Invoice Print.
                So only the selection hint + posted-invoice note render here. */}
            {!(client && state && unit) ? (
              <div className="lg-alert" role="status" style={{ background: "#fcf8e3", borderColor: "#faebcc", color: "#8a6d3b" }}>
                Select <b>Month</b>, <b>Client</b>, <b>Billing Type = Manpower Billing</b>, <b>State</b> and <b>Branch</b> above — then click <b>Process</b> and <b>Final Invoice Print</b>.
              </div>
            ) : (<>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <b>{selectedClient?.client_name ?? client} / {state} / {availableUnits.find((item) => item.unit_code === unit)?.unit_name ?? unit}</b>
              <span>{policies.length} billing polic{policies.length === 1 ? "y" : "ies"} found — click <b>Process</b> to bill from the approved <b>attendance</b>, then <b>Final Invoice Print</b>.</span>
            </div>
            {generatedInvoice && <div className="lg-alert" role="status" style={{ marginTop: 10 }}>
              Posted invoice {generatedInvoice.invoice_no}: {money(generatedInvoice.amount + generatedInvoice.cgst + generatedInvoice.sgst + generatedInvoice.igst)}
              {generatedInvoice.reused ? " (existing invoice updated)" : ""}
            </div>}
            </>)}
          </section>}
          {/* gv_attendace_load / gv_load_deployment / attendance_status panels */}
          {/* legacy gv_attendance_panel is Visible=false until an action shows it: render only after that action */}
          {approvalKey > 0 && <FinanceApprovalPanel scope={scope} loadKey={approvalKey} onFeedback={(u) => setFeedbackUnit((cur) => (cur === u ? "" : u))} />}
          {feedbackUnit && <FeedbackPanel scope={scope} unit={feedbackUnit} onClose={() => setFeedbackUnit("")} />}
          <DeploymentPanel scope={scope} loadKey={deployKey} />
          <NotificationPanel scope={scope} loadKey={notifyKey} />
          {/* legacy 'Check Client Billing' is a modal opened by a link, not an always-visible grid */}
          {statusKey > 0 && (
            <div style={{ margin: "6px 0" }}>
              <a href="#" style={{ color: "blue", fontWeight: "bold" }}
                 onClick={(e) => { e.preventDefault(); setShowBillCheck(true); }}>Check Client Billing</a>
            </div>
          )}
          {showBillCheck && (
            <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1050, overflow: "auto" }}
                 onClick={() => setShowBillCheck(false)}>
              <div style={{ background: "#fff", maxWidth: 1100, margin: "60px auto", borderRadius: 6, padding: 14 }}
                   onClick={(e) => e.stopPropagation()}>
                <div style={{ textAlign: "right" }}>
                  <button className="btn btn-danger btn-sm" onClick={() => setShowBillCheck(false)}>Close</button>
                </div>
                <BillingStatusPanel scope={scope} loadKey={statusKey} />
              </div>
            </div>
          )}
          </>}
          </section>
        </div>
      </section>
    </div>
  );
}