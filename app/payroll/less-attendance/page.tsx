"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getJSON, mk, upload } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

/* 1:1 port of grade_unit_salary.aspx — "Client / Branch wise Salary".
   15 payment tabs. Most tabs Process a pay_pro_* staging and stream .xls (no grid);
   grids exist on Payment (Hold list), Material, Manual Payment, Manual Payment Process.
   All alert/confirm strings are the verbatim legacy strings (typos preserved). */

/** The server sends a validation reason as {detail}, a list ["..."], or {field: ["..."]}: show the real text. */
function serverMsg(b: any, fallback: string): string {
  if (!b) return fallback;
  if (typeof b === "string") return b || fallback;
  if (Array.isArray(b)) return b.length ? String(b[0]) : fallback;
  if (b.detail) return String(b.detail);
  const first = Object.values(b)[0] as any;
  if (Array.isArray(first) && first.length) return String(first[0]);
  if (typeof first === "string" && first) return first;
  return fallback;
}

interface ClientOpt { client_code: string; client_name: string; }
interface UnitOpt { unit_code: string; unit_name: string; state_name: string; }
interface StatusBox { title: string; count: number; items: string[]; }
interface StatusReport {
  pending_attendance: StatusBox; appro_attendannce_finanace: StatusBox; finance_approve: StatusBox;
  finance_not_approve: StatusBox; payment_approve: StatusBox;
}
interface HoldRow {
  emp_code: string; emp_name: string; client: string; state_name: string; unit_name: string;
  present_day: number; absent_days: number; per_day_rate: number; total: number; no_days: string;
  less_attendances_flag: string; less_attendances_flag_reliver: string; checked?: boolean;
}
interface StagedRow {
  party_name: string; account_holder_name: string; bank_name: string; month: string; year: string;
  amount: string; account_no: string; ifsc_no: string; mode_of_transfer: string; description: string;
  file: File | null; expense_head: string; payment_against: string; client_code: string;
}
interface ManualRow {
  id: number; party_name: string; account_holder_name: string; bank_name: string;
  month: number; year: number; amount: string; account_no: string; ifsc_no: string;
  mode_of_transfer: string; description: string; file_url: string; expense_head: string;
  payment_against: string; from_bank: string; from_bank_ac: string; to_bank: string;
  to_bank_ac: string; to_bank_ifsc: string; uploaded_date: string; payment_status: number;
}

const TABS = [
  "Payment", "OT Payment", "Arrears Payment", "Conveyance Payment", "Material Payment",
  "Vendor Payment", "R&M Service Payment", "Administrative Expense Payment", "Advanced Payment",
  "Shiftwise Payment", "Incentive Payment", "Office Rent Payment", "Yearly Payment",
  "Manual Payment", "Manual Payment Process",
];
const XL_TYPES = [["0", "Employee XL"], ["1", "Without Ac/No XL"], ["2", "Left Employee XL"],
  ["3", "Reliever Employee XL"], ["5", "Bank Approval Pending"], ["4", "ALL"], ["7", "Bank Payable (ALL)"]];
const EXPENSE_HEADS = ["Salary And Wages Expenses", "Office Expenses", "Personal Expenses",
  "Travel Expenses", "Loan And Interest Payments", "Rent,Taxes And Insurance Expenses",
  "Repairs And Maintenance Expenses"];
const DAYS_1_31 = Array.from({ length: 31 }, (_, i) => String(i + 1));

const SP = "/api/payroll/salary-payment";
const ctl: React.CSSProperties = { width: "100%", height: "34px", borderRadius: "4px", border: "1px solid #ccc", padding: "4px 8px" };
const blue: React.CSSProperties = { background: "#337ab7", border: "1px solid #2e6da4", color: "#fff", padding: "6px 16px", borderRadius: "4px", cursor: "pointer" };
const red: React.CSSProperties = { background: "#d9534f", border: "1px solid #d43f3a", color: "#fff", padding: "6px 16px", borderRadius: "4px", textDecoration: "none", cursor: "pointer" };
const green: React.CSSProperties = { background: "#5cb85c", border: "1px solid #4cae4c", color: "#fff", padding: "6px 16px", borderRadius: "4px", cursor: "pointer" };

function Field({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ flex: "1 1 180px" }}>
      <b>{label}</b>{req && <span style={{ color: "red" }}>*</span>}
      {children}
    </div>
  );
}

export default function ClientBranchSalaryPage() {
  const router = useRouter();
  // ---- top filters (row 1 + row 2) ----
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("ALL");
  const [unit, setUnit] = useState("ALL");
  const [processData, setProcessData] = useState("0");
  const [bank, setBank] = useState("Select");
  const [startDay, setStartDay] = useState("0");
  const [endDay, setEndDay] = useState("0");
  const [paymentType, setPaymentType] = useState("1");       // 1 CLUB, 2 UNCLUB
  const [designation, setDesignation] = useState("Select");

  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState("Payment");
  const [busy, setBusy] = useState(false);

  // ---- per-tab fields ----
  const [paymentXl, setPaymentXl] = useState("0");
  const [otXl, setOtXl] = useState("0");
  const [arrearType, setArrearType] = useState("");          // month | policy
  const [arrearFrom, setArrearFrom] = useState("");
  const [arrearTo, setArrearTo] = useState("");
  const [arrearXl, setArrearXl] = useState("0");
  const [convType, setConvType] = useState("0");             // 1 Conveyance, 2 Driver
  const [convXl, setConvXl] = useState("0");
  const [materialXl, setMaterialXl] = useState("0");
  const [vendorName, setVendorName] = useState("");
  const [poNo, setPoNo] = useState("");
  const [invNo, setInvNo] = useState("");
  const [modeOfPayment, setModeOfPayment] = useState("1");   // 1 NEFT, 2 CHEQUE
  const [chequeNo, setChequeNo] = useState("");
  const [chequeDate, setChequeDate] = useState("");
  const [invoiceSlot, setInvoiceSlot] = useState("");
  const [partyType, setPartyType] = useState("");            // 1 Client, 2 Vendor
  const [party, setParty] = useState("");
  const [yearlyType, setYearlyType] = useState("");          // 0 Bonus, 1 Leave, 2 Gratuity
  const [yFrom, setYFrom] = useState("");
  const [yTo, setYTo] = useState("");

  // ---- grids ----
  const [holdRows, setHoldRows] = useState<HoldRow[]>([]);
  const [holdSel, setHoldSel] = useState<Record<string, boolean>>({});
  const [holdDays, setHoldDays] = useState<Record<string, string>>({});
  const [showHold, setShowHold] = useState(false);
  const [report, setReport] = useState<StatusReport | null>(null);
  const [modalBox, setModalBox] = useState<StatusBox | null>(null);
  const [designations, setDesignations] = useState<string[]>([]);
  const [msg, setMsg] = useState("");

  // ---- manual payment ----
  const [manualMode, setManualMode] = useState("manual");    // manual | bank | bulk
  const [mPaymentAgainst, setMPaymentAgainst] = useState("");
  const [mExpHead, setMExpHead] = useState("");
  const [mClient, setMClient] = useState("Select");
  const [mParty, setMParty] = useState("");
  const [mBank, setMBank] = useState("");
  const [mHolder, setMHolder] = useState("");
  const [mAcc, setMAcc] = useState("");
  const [mMot, setMMot] = useState("");
  const [mAmount, setMAmount] = useState("");
  const [mIfsc, setMIfsc] = useState("");
  const [mDesc, setMDesc] = useState("");
  // bank-to-bank
  const [bExpHead, setBExpHead] = useState("");
  const [bFromBank, setBFromBank] = useState("");
  const [bFromAc, setBFromAc] = useState("");
  const [bToBank, setBToBank] = useState("");
  const [bToAc, setBToAc] = useState("");
  const [bToIfsc, setBToIfsc] = useState("");
  const [bAmount, setBAmount] = useState("");
  const [bMot, setBMot] = useState("");
  const [bDesc, setBDesc] = useState("");
  const [manualRows, setManualRows] = useState<ManualRow[]>([]);
  const [staged, setStaged] = useState<StagedRow[]>([]);          // legacy ViewState["clustertable"]
  const [mAttach, setMAttach] = useState<File | null>(null);
  const [bAttach, setBAttach] = useState<File | null>(null);
  const [bulkAttach, setBulkAttach] = useState<File | null>(null);
  // Manual Payment Process filters
  const [mpDate, setMpDate] = useState("");
  const [mpHead, setMpHead] = useState("");
  const [mpAgainst, setMpAgainst] = useState("");
  const [mpClient, setMpClient] = useState("Select");
  const [mpParty, setMpParty] = useState("");

  // ---- vendor / PO lookups (real masters + purchase orders) ----
  const [vendors, setVendors] = useState<{ vend_id: string; vend_name: string }[]>([]);
  const [pos, setPos] = useState<{ po_no: string }[]>([]);
  const [bulkFile, setBulkFile] = useState<File | null>(null);

  // ---- manual payment process ----
  const [mpMode, setMpMode] = useState("manual");            // manual | bank
  const [mpRows, setMpRows] = useState<ManualRow[]>([]);
  const [mpSel, setMpSel] = useState<Record<number, boolean>>({});

  useEffect(() => {
    getJSON<{ results: ClientOpt[] }>("/api/masters/clients/?page_size=all").then((d) =>
      setClients((d?.results ?? []).map((c) => ({ client_code: c.client_code, client_name: c.client_name }))));
  }, []);
  const [banks, setBanks] = useState<string[]>([]);
  useEffect(() => {
    if (!client || client === "Select") { setUnits([]); setStates([]); setBanks([]); setBank("Select"); return; }
    getJSON<{ units: UnitOpt[]; states: string[] }>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(client)}`).then((d) => {
      const rs = d?.units ?? [];
      setUnits(rs);
      setStates([...(d?.states ?? Array.from(new Set(rs.map((u) => u.state_name).filter(Boolean))))].sort());
    });
    // Legacy ddl_bank: distinct bank for this client (pay_client_master.bank).
    getJSON<{ bank_names: string[] }>(`/api/masters/bank-names/?client_code=${encodeURIComponent(client)}`).then((d) => {
      setBanks(d?.bank_names ?? []);
      setBank("Select");
    });
  }, [client]);

  // Legacy ddl_invoice_type_SelectedIndexChanged: UNCLUB lists the designations of the selected scope.
  useEffect(() => {
    if (paymentType !== "2") { setDesignations([]); setDesignation("Select"); return; }
    if (!month || !year) { alert("Please select Month and try again."); return; }
    if (!client || client === "Select") return;
    getJSON<{ designations: string[] }>(`${SP}/designations/?${scopeQ().toString()}`).then((d) => {
      setDesignations(d?.designations ?? []); setDesignation("Select");
    });
  }, [paymentType, month, year, client, state, unit]);

  const monthVal = year && month ? `${year}-${month.padStart(2, "0")}` : "";
  const onMonth = (v: string) => { if (v) { const [y, m] = v.split("-"); setYear(y); setMonth(parseInt(m, 10).toString()); } else { setYear(""); setMonth(""); } };
  const scopeQ = () => {
    const q = new URLSearchParams({ month, year, client_code: client });
    if (state !== "ALL") q.set("state", state);
    if (unit !== "ALL") q.set("unit_code", unit);
    if (startDay !== "0") q.set("start_day", startDay);
    if (endDay !== "0") q.set("end_day", endDay);
    return q;
  };
  // Legacy attendance_status(): the five clickable branch counters (Final Bill Not Approve, Final Bill
  // Approved, Approve By Finance, Not Approve By Finance, This Branches Payment Approve). Read only.
  const loadStatus = async (silent = false) => {
    try {
      const r = await fetch(`${API_BASE_URL}${SP}/status/?${scopeQ().toString()}`, { credentials: "include" });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (!silent) alert((Array.isArray(b) ? String(b[0]) : "") || b.detail || "Status failed.");
        return;
      }
      setReport(b as StatusReport);
    } catch { /* counters are informational */ }
  };
  // Legacy btn_report_Click = attendance_status() dashboard refresh ONLY (no processing).
  const doStatus = async () => {
    if (!reqStrict()) return;
    setBusy(true); setMsg("");
    try { await loadStatus(); } finally { setBusy(false); }
  };
  // Legacy bntclose_Click / btn_material_close_Click: Response.Redirect("Home.aspx")
  const doClose = () => { router.push("/Home"); };

  // ---- generic process / export / approve ----
  const reqClientMonth = (): boolean => {
    if (!client || client === "Select") { alert("Please Select Client Name "); return false; }
    if (!month.trim() || !year.trim()) { alert("Please Select month & year "); return false; }
    return true;
  };
  // legacy Req_validation(): client "Select" AND "ALL" are both rejected (Process / Report / Material XL ...)
  const reqStrict = (): boolean => {
    if (!client || client === "Select" || client === "ALL") { alert("Please Select Client Name "); return false; }
    if (!month.trim() || !year.trim()) { alert("Please Select month & year "); return false; }
    return true;
  };
  // legacy yearly_validations() (shared by Process / Get Employee XL / Paid Salary)
  const yearlyOk = (): boolean => {
    if (!client || client === "Select") { alert("Please Select Client Name "); return false; }
    if (!yearlyType) { alert("Please Select Yearly Salary Type"); return false; }
    if (!yFrom) { alert("Please From Date "); return false; }
    if (!yTo) { alert("Please Select To Date "); return false; }
    return true;
  };
  const doProcess = async (tab_type: string, extra: Record<string, string> = {}) => {
    setBusy(true); setMsg("");
    try {
      const r = await mk(`${SP}/process/`, { tab_type, month, year, client_code: client, state, unit_code: unit,
        ...(bank !== "Select" ? { bank } : {}), ...(startDay !== "0" ? { start_day: startDay } : {}),
        ...(endDay !== "0" ? { end_day: endDay } : {}), ...extra });
      const b = await r.json().catch(() => ({}));
      if (r.ok) { setMsg(b.status || "Process Completed Successfully !!!"); alert(b.status || "Process Completed Successfully !!!"); }
      else {
        const msg = (b as any).detail || (Array.isArray(b) ? (b as any)[0] : "") || (typeof b === "string" ? b : "") || "Process failed.";
        alert(typeof msg === "string" ? msg : JSON.stringify(msg));
      }
    } finally { setBusy(false); }
  };
  const doApprove = async (tab_type: string, extra: Record<string, string> = {}) => {
    if (!window.confirm("Are you sure you want to Approve?")) return;
    setBusy(true);
    try {
      const r = await mk(`${SP}/approve/`, { tab_type, month, year, client_code: client, state, unit_code: unit, ...extra });
      const b = await r.json().catch(() => ({}));
      if (r.ok && tab_type === "payment") {
        // Legacy: payment_approve=1, attendance_status() counters, then the ANNUXURE_UPLOAD.xls download.
        await loadStatus(true);
        await doExport("payment", paymentXl, { approved: "1" });
      } else if (r.ok) alert((b as any).status || "Payment Approve Successfully !!!");
      else {
        const msg = (b as any).detail || (Array.isArray(b) ? (b as any)[0] : "") || (typeof b === "string" ? b : "") || "Approve failed.";
        alert(typeof msg === "string" ? msg : JSON.stringify(msg));
      }
    } finally { setBusy(false); }
  };
  const doExport = async (tab_type: string, xl_type: string, extra: Record<string, string> = {}) => {
    const q = scopeQ(); q.set("tab_type", tab_type); q.set("xl_type", xl_type);
    if (paymentType === "2" && designation !== "Select") q.set("designation", designation);
    if (bank !== "Select") q.set("bank", bank);
    Object.entries(extra).forEach(([k, v]) => q.set(k, v));
    const r = await fetch(`${API_BASE_URL}${SP}/export/?${q.toString()}`, { credentials: "include" });
    if (!r.ok) { const b = await r.json().catch(() => ({})); alert(serverMsg(b, "No Matching Records Found.")); return; }
    const blob = await r.blob();
    const cd = r.headers.get("Content-Disposition") || "";
    const fm = cd.match(/filename="?([^"]+)"?/);
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    // file name: <report name>_<STATE or ALL_STATES>_<MM-YYYY>.xls, so the state of the file is clear from its name
    const full = fm ? fm[1] : `${tab_type.toUpperCase()}_PAYMENT.xls`;
    const ext = (full.match(/\.[A-Za-z0-9]+$/) || [".xls"])[0];
    const stTag = state === "ALL" ? "ALL_STATES" : state.trim().replace(/\s+/g, "_").toUpperCase();
    a.download = `${full.replace(/\.[A-Za-z0-9]+$/, "")}_${stTag}_${String(month).padStart(2, "0")}-${year}${ext}`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  // ---- Payment tab: Process (staging -> pay_pro_*) + Less/Hold list ----
  // Legacy grade_unit_salary.aspx btn_save_Click: Process does staging, then
  // lessAndroidAttendancesMarksEmployeeList() shows gv_lessEmployeeAttendances
  // ONLY when less-attendance rows exist (lessEmployeeAttendances.Visible).
  // No salary grid in legacy — Process never renders a salary list.
  const processSalary = async () => {
    if (!reqStrict()) return;
    setBusy(true); setMsg("");
    try {
      const r = await mk(`${SP}/process/`, { tab_type: "payment", month, year, client_code: client, state, unit_code: unit, start_day: startDay, end_day: endDay, process_data: processData });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = (b as any).detail || (Array.isArray(b) ? (b as any)[0] : "") || (typeof b === "string" ? b : "") || "Process failed.";
        alert(typeof msg === "string" ? msg : JSON.stringify(msg));
        return;
      }
      await showHoldList();
      setMsg(b.status || "Process Completed Successfully !!!");
    } finally { setBusy(false); }
  };

  // ---- Payment tab: Hold list (does NOT set the status message; caller owns it) ----
  const showHoldList = useCallback(async () => {
    const d = await getJSON<{ results: HoldRow[] }>(`${SP}/hold-list/?${scopeQ().toString()}`);
    const rows = d?.results ?? [];
    const pre: Record<string, boolean> = {};
    rows.forEach((r) => { if (r.checked) pre[r.emp_code] = true; });
    setHoldRows(rows); setHoldSel(pre); setHoldDays({}); setShowHold(rows.length > 0);
  }, [month, year, client, state, unit]);

  const holdApprove = async () => {
    const rows = holdRows.filter((r) => holdSel[r.emp_code])
      .map((r) => ({ emp_code: r.emp_code, no_days: holdDays[r.emp_code] ?? "", total: String(r.total) }));
    if (rows.length === 0) { alert("Please Select Employee"); return; }
    setBusy(true);
    try {
      const r = await mk(`${SP}/hold-approve/`, { rows, month, year, client_code: client });
      const b = await r.json().catch(() => ({}));
      alert(r.ok ? (b.status || "Record Updated Successfully") : serverMsg(b, "Failed"));
      showHoldList();
    } finally { setBusy(false); }
  };

  // ---- Manual payment ----
  const loadManual = useCallback(async (mtype: string) => {
    const d = await getJSON<{ results: ManualRow[] }>(`${SP}/manual-list/?mtype=${mtype}&payment_status=0`);
    setManualRows(d?.results ?? []);
  }, []);
  useEffect(() => {
    if (activeTab === "Manual Payment") loadManual(manualMode === "bank" ? "bank_to_bank" : "manual_payment");
  }, [activeTab, manualMode, loadManual]);

  useEffect(() => {
    if (activeTab !== "Vendor Payment" && activeTab !== "Advanced Payment") return;
    getJSON<{ results: { vend_id: string; vend_name: string }[] } | { vend_id: string; vend_name: string }[]>(
      "/api/masters/vendors/?page_size=all").then((d) => {
      setVendors((Array.isArray(d) ? d : d?.results ?? []) as { vend_id: string; vend_name: string }[]);
    });
  }, [activeTab]);
  const poVendor = activeTab === "Vendor Payment" ? vendorName : (partyType === "2" ? party : "");
  useEffect(() => {
    if (!poVendor) { setPos([]); return; }
    getJSON<{ results: { po_no: string }[] } | { po_no: string }[]>(
      `/api/transactions/purchase-orders/?cust_code=${encodeURIComponent(poVendor)}&page_size=all`).then((d) => {
      setPos((Array.isArray(d) ? d : d?.results ?? []) as { po_no: string }[]);
    });
  }, [poVendor]);

  const downloadFile = async (url: string, fallback: string) => {
    const r = await fetch(`${API_BASE_URL}${url}`, { credentials: "include" });
    if (!r.ok) { const b = await r.json().catch(() => ({} as any)); alert(b?.detail || (Array.isArray(b) ? String(b[0]) : "") || "No Matching Records Found."); return; }
    const blob = await r.blob();
    const cd = r.headers.get("Content-Disposition") || "";
    const fm = cd.match(/filename="?([^"]+)"?/);
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = fm ? fm[1] : fallback;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  const ATT_RE = /\.(jpg|jpeg|png|pdf|zip)$/i;
  const AGAINST_TXT = (v: string) => (v === "0" ? "Client" : v === "1" ? "Other Expenses" : v);
  const headTxt = (v: string) => EXPENSE_HEADS[Number(v)] ?? v;
  const submitBulk = async () => {
    // bulk_payment_val() order + legacy messages
    if (!mPaymentAgainst) return alert("Please Select Payment Against");
    if (mPaymentAgainst === "0" && (!mClient || mClient === "Select")) return alert("Please Select Client Name");
    if (!mExpHead) return alert("Please Select payment Head");
    if (mPaymentAgainst === "1" && !mParty.trim()) return alert("Please Enter party name");
    if (!month.trim() || !year.trim()) return alert("Please Select month and date......!!! ");
    if (!bulkAttach) return alert("Please upload attachment......!!! ");
    if (!bulkFile) return alert("Please upload file Xls or Xlxs......!!! ");
    if (!/\.(xls|xlsx|csv)$/i.test(bulkFile.name)) return alert("Invalid file type. Please insert a valid Excel file.");
    if (!ATT_RE.test(bulkAttach.name)) return alert("Please select only JPG, PNG , JPEG, ZIP and PDF  Files  !!");
    const party = mPaymentAgainst === "0"
      ? (clients.find((c) => c.client_code === mClient)?.client_name ?? mClient) : mParty.trim();
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("month", month); fd.append("year", year); fd.append("party_name", party);
      fd.append("expense_head", headTxt(mExpHead)); fd.append("payment_against", AGAINST_TXT(mPaymentAgainst));
      fd.append("client_code", mClient === "Select" ? "" : mClient); fd.append("file", bulkFile);
      fd.append("attachment", bulkAttach);
      const r = await upload(`${SP}/manual-bulk-upload/`, fd);
      const b = await r.json().catch(() => ({} as any));
      if (r.ok) {
        const dups: any[] = b.duplicates ?? [];
        if ((b.inserted ?? 0) > 0) { alert(b.status); setBulkFile(null); setBulkAttach(null); }
        else if (dups.length) {
          // legacy send_file(): EXCEL_REPEATED_RECORD.xls ("This Records Already Exist")
          const esc = (x: any) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
          const head = ["SR. NO.", "Party Name ", "Bank Name", "Account Holder Name", "Account No", "Mode of Transfer", "Amount ", "IFSC No ", " Descripton ", "Comment"];
          const html = `<table border=1><tr ><th bgcolor=yellow colspan=10>This Records Already Exist</th></tr><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr>` +
            dups.map((d, i) => `<tr><td>${i + 1}</td>${[d.party_name, d.bank_name, d.account_holder_name, d.account_no, d.mode_of_transfer, d.amount, d.ifsc_no, d.description, d.comment].map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("") + "</table>";
          const a = document.createElement("a");
          a.href = URL.createObjectURL(new Blob([html], { type: "application/vnd.ms-excel" }));
          a.download = "EXCEL_REPEATED_RECORD.xls"; document.body.appendChild(a); a.click();
          setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
        }
      } else {
        alert(b?.detail || (Array.isArray(b) ? String(b[0]) : "") || "Failed");
      }
    } finally { setBusy(false); }
  };

  // Legacy "+" (lnk_add_Click): validate, stage the row in the grid; nothing is saved until Submit.
  const addManual = async () => {
    // Req_validation_manual_payment() order
    if (!mPaymentAgainst) return alert("Please Select Payment Against");
    if (mPaymentAgainst === "0" && (!mClient || mClient === "Select")) return alert("Please Select Client Name");
    if (!mExpHead) return alert("Please Select payment Head");
    if (!month.trim() || !year.trim()) return alert("Please Select month & year ");
    if (mPaymentAgainst === "1" && !mParty.trim()) return alert("Please Enter party name");
    if (!mBank.trim()) return alert("Please Enter Bank name ");
    if (!mHolder.trim()) return alert("Please Enter Account holder name");
    if (!mAcc.trim()) return alert("Please Enter account number ");
    if (!mMot) return alert("Please Select Mode of Transfer. ");
    if (!mAmount.trim()) return alert("Please Enter Amount");
    if (mAmount.trim() === "0") return alert("Please Enter Amount greater than 0 ");
    if (!mIfsc.trim()) return alert("Please Enter IFSC Code ");
    if (!mDesc.trim()) return alert("Please Enter Description");
    // server-side part of lnk_add_Click
    if (Number.isNaN(Number(mAcc))) return alert(" Please Enter Valid Account Number !!");
    if (Number.isNaN(Number(mAmount))) return alert("Please Enter Valid Amount !!");
    if (mAttach && !ATT_RE.test(mAttach.name)) return alert("Please select only JPG, PNG , JPEG, ZIP and PDF  Files  !!");
    const m2 = month.padStart(2, "0");
    if (staged.some((r) => mParty === r.party_name && m2 === r.month && mAmount === r.amount && year === r.year))
      return alert("Same Party Name  Allready added, you canot add one more.!!");
    const party = mPaymentAgainst === "0"
      ? (clients.find((c) => c.client_code === mClient)?.client_name ?? mClient) : mParty.trim();
    const q = new URLSearchParams({ party_name: party, month, year, amount: mAmount });
    const ex = await getJSON<{ exists: boolean }>(`${SP}/manual-exists/?${q.toString()}`);
    if (ex?.exists) return alert("Same Party Name is Already exist");
    setStaged([...staged, {
      party_name: party, account_holder_name: mHolder, bank_name: mBank, month: m2, year, amount: mAmount,
      account_no: mAcc, ifsc_no: mIfsc, mode_of_transfer: mMot, description: mDesc, file: mAttach,
      expense_head: headTxt(mExpHead), payment_against: AGAINST_TXT(mPaymentAgainst),
      client_code: mClient === "Select" ? "" : mClient }]);
    setMExpHead(""); setMPaymentAgainst(""); setMClient("Select"); setMHolder(""); setMBank("");
    setMAmount(""); setMAcc(""); setMIfsc(""); setMDesc(""); setMMot(""); setMAttach(null);
  };
  const removeStaged = (i: number) => {
    if (!window.confirm("Are you sure You want to Delete Record?")) return;
    setStaged(staged.filter((_, j) => j !== i));
  };
  // btn_submit_click: insert every staged row (duplicates are rejected with "Record already exist!!")
  const submitManual = async () => {
    if (!window.confirm("Are you sure You want Submit Record?")) return;
    setBusy(true);
    try {
      let saved = 0;
      for (const r of staged) {
        const fd = new FormData();
        const f: Record<string, string> = {
          type: "manual_payment", month: String(Number(r.month)), year: r.year, expense_head: r.expense_head,
          payment_against: r.payment_against, client_code: r.client_code, party_name: r.party_name,
          bank_name: r.bank_name, account_holder_name: r.account_holder_name, account_no: r.account_no,
          ifsc_no: r.ifsc_no, mode_of_transfer: r.mode_of_transfer, amount: r.amount, description: r.description };
        Object.entries(f).forEach(([k, v]) => fd.append(k, v));
        if (r.file) fd.append("file", r.file);
        const res = await upload(`${SP}/manual-submit/`, fd);
        const b = await res.json().catch(() => ({} as any));
        if (!res.ok) { alert(b?.detail || (Array.isArray(b) ? String(b[0]) : "") || "Failed"); return; }
        saved += 1;
      }
      if (saved > 0) { alert("Record submited successfully!!"); setStaged([]); }
    } finally { setBusy(false); }
  };
  const submitBankToBank = async () => {
    // Req_validation_bank_to_bank (verbatim)
    if (!month.trim() || !year.trim()) return alert("Please Select month & year ");
    if (!bExpHead) return alert("Please Select payment Head");
    if (!bFromBank.trim()) return alert("Please Select From Bank Name. ");
    if (!bToBank.trim()) return alert("Please Select To Bank Name. ");
    if (!bAmount.trim()) return alert("Please Enter Amount");
    if (Number(bAmount) <= 0) return alert("Please Enter Amount greater than 0");
    if (!bMot) return alert("Please Select Mode OF Transfer. ");
    if (!bDesc.trim()) return alert("Please Enter Description");
    if (Number.isNaN(Number(bAmount))) return alert("Please Enter Valid Amount !!");
    if (bAttach && !ATT_RE.test(bAttach.name)) return alert("Please select only JPG, PNG ,JPEG, ZIP and PDF  Files  !!");
    if (!window.confirm("Are you sure You want Submit Record?")) return;
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries({
        type: "bank_to_bank", month, year, expense_head: headTxt(bExpHead), from_bank: bFromBank,
        from_bank_ac: bFromAc, to_bank: bToBank, to_bank_ac: bToAc, to_bank_ifsc: bToIfsc,
        amount: bAmount, mode_of_transfer: bMot, description: bDesc,
      }).forEach(([k, v]) => fd.append(k, v));
      if (bAttach) fd.append("file", bAttach);
      const r = await upload(`${SP}/manual-submit/`, fd);
      const b = await r.json().catch(() => ({}));
      alert(r.ok ? (b.status || "Record submited successfully!!") : serverMsg(b, "Failed"));
      if (r.ok) { setBFromBank(""); setBFromAc(""); setBToBank(""); setBToAc(""); setBToIfsc(""); setBAmount(""); setBDesc(""); setBAttach(null); loadManual("bank_to_bank"); }
    } finally { setBusy(false); }
  };
  const deleteManual = async (id: number, reload?: () => void) => {
    if (!window.confirm("Are you sure you want to delete this Record?")) return;
    const r = await mk(`${SP}/manual-delete/`, { id });
    if (r.ok) {
      if (reload) { alert("Record Deleted Successfully... !!!"); reload(); }
      else loadManual(manualMode === "bank" ? "bank_to_bank" : "manual_payment");
    }
  };

  // ---- Manual payment process (Show / Process / Get Excle / Final Annexure) ----
  const mpType = () => (mpMode === "bank" ? "bank_to_bank" : "manual_payment");
  const mpParams = () => {
    const q = new URLSearchParams({ mtype: mpType(), date: mpDate });
    if (mpHead) q.set("expense_head", headTxt(mpHead));
    if (mpMode === "manual") {
      if (mpAgainst) q.set("payment_against", AGAINST_TXT(mpAgainst));
      if (mpAgainst === "0" && mpClient !== "Select")
        q.set("client_name", clients.find((c) => c.client_code === mpClient)?.client_name ?? mpClient);
      if (mpAgainst === "1" && mpParty.trim()) q.set("party", mpParty.trim());
    }
    return q;
  };
  // Req_validation_manual_payment_process()
  const mpDateOk = (): boolean => { if (!mpDate) { alert("Please Select Date "); return false; } return true; };
  const loadMp = useCallback(async () => {
    if (!mpDateOk()) return;
    const q = mpParams(); q.set("process", "1");
    const r = await fetch(`${API_BASE_URL}${SP}/manual-list/?${q.toString()}`, { credentials: "include" });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { alert((Array.isArray(d) ? String(d[0]) : "") || d.detail || "Failed"); return; }
    const rows: ManualRow[] = d?.results ?? [];
    setMpRows(rows); setMpSel({});
    if (rows.length === 0) alert("No Matching Records Found.");
  }, [mpMode, mpDate, mpHead, mpAgainst, mpClient, mpParty, clients]);
  const mpProcess = async () => {
    const ids = mpRows.filter((r) => mpSel[r.id]).map((r) => r.id);
    if (ids.length === 0) { alert("Please select atleast one Record "); return; }
    const r = await mk(`${SP}/manual-process/`, { ids, mtype: mpType() });
    const b = await r.json().catch(() => ({}));
    alert(r.ok ? (b.status || "Processed successfully!!") : (b.detail || (Array.isArray(b) ? String(b[0]) : "") || "Failed"));
    if (r.ok) { setMpRows([]); setMpSel({}); }
  };
  const mpFinal = async () => {
    if (!mpDateOk()) return;
    const r = await mk(`${SP}/manual-final/`, { mtype: mpType(), date: mpDate });
    if (!r.ok) { const b = await r.json().catch(() => ({} as any)); alert((Array.isArray(b) ? String(b[0]) : "") || b.detail || "No Matching Records Found."); return; }
    const blob = await r.blob();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "Manual_Payment.xls";
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  const filteredUnits = units.filter((u) => state === "ALL" || u.state_name === state);
  const tabBtn = (t: string) => ({
    background: activeTab === t ? "#fff" : "#424D7A", color: activeTab === t ? "#333" : "#fff",
    border: "1px solid #ccc", borderBottomColor: activeTab === t ? "#fff" : "#ccc",
    padding: "9px 13px", cursor: "pointer", fontWeight: (activeTab === t ? "bold" : "normal") as React.CSSProperties["fontWeight"],
    borderRadius: "4px 4px 0 0", fontSize: "13px",
  });

  const Btns = ({ children }: { children: React.ReactNode }) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center", marginTop: "18px" }}>{children}</div>
  );

  return (
    <section style={{ padding: "15px", fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #337ab7", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#337ab7", color: "#fff", padding: "10px 15px", textAlign: "center", textTransform: "uppercase", fontWeight: "bold" }}>
          Client / Branch wise Salary
        </div>
        <div className="panel-body" style={{ padding: "18px" }}>

          {/* ===== top filter bar (both rows, shown for every tab) ===== */}
          <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "18px", marginBottom: "16px" }}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end" }}>
              <Field label="Select Month :" req>
                <input type="month" className="form-control" value={monthVal} onChange={(e) => onMonth(e.target.value)} style={ctl} />
              </Field>
              <Field label="Client :" req>
                <select className="form-control" value={client} onChange={(e) => { setClient(e.target.value); setState("ALL"); setUnit("ALL"); }} style={ctl}>
                  <option value="Select">Select</option>
                  {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
                </select>
              </Field>
              <Field label="State :">
                <select className="form-control" value={state} onChange={(e) => { setState(e.target.value); setUnit("ALL"); }} style={ctl}>
                  <option value="ALL">ALL</option>{states.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Branch :">
                <select className="form-control" value={unit} onChange={(e) => setUnit(e.target.value)} style={ctl}>
                  <option value="ALL">ALL</option>{filteredUnits.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
                </select>
              </Field>
              <Field label="Process Data :">
                <select className="form-control" value={processData} onChange={(e) => setProcessData(e.target.value)} style={ctl}>
                  <option value="0">Current Policy</option><option value="1">Old Policy</option>
                </select>
              </Field>
            </div>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end", marginTop: "12px" }}>
              <Field label="Bank :">
                <select className="form-control" value={bank} onChange={(e) => setBank(e.target.value)} style={ctl}>
                  <option value="Select">Select</option>
                  {banks.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="Billing Start Day:">
                <select className="form-control" value={startDay} onChange={(e) => setStartDay(e.target.value)} style={ctl}>
                  <option value="0">Select</option>{DAYS_1_31.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Billing End Day:">
                <select className="form-control" value={endDay} onChange={(e) => setEndDay(e.target.value)} style={ctl}>
                  <option value="0">Select</option>{DAYS_1_31.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Payment Type :">
                <select className="form-control" value={paymentType} onChange={(e) => setPaymentType(e.target.value)} style={ctl}>
                  <option value="1">CLUB</option><option value="2">UNCLUB</option>
                </select>
              </Field>
              {paymentType === "2" && (
                <Field label="Designation :">
                  <select className="form-control" value={designation} onChange={(e) => setDesignation(e.target.value)} style={ctl}>
                    {designations.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </Field>
              )}
            </div>
          </div>

          {/* ===== tabs ===== */}
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", borderBottom: "1px solid #ccc", marginBottom: "16px" }}>
            {TABS.map((t) => (
              <li key={t} style={{ marginRight: "2px", marginBottom: "-1px" }}>
                <button onClick={() => { setActiveTab(t); setMsg(""); }} style={tabBtn(t)}>{t}</button>
              </li>
            ))}
          </ul>

          {msg && <div style={{ color: "#8a6d3b", fontWeight: "bold", textAlign: "center", marginBottom: "12px", padding: "8px", background: "#fcf8e3", border: "1px solid #faebcc", borderRadius: "4px" }}>{msg}</div>}

          {/* ===================== TAB 1: Payment ===================== */}
          {activeTab === "Payment" && (
            <>
              <Btns>
                <button style={green} disabled={busy} onClick={processSalary}>Process</button>
                <select value={paymentXl} onChange={(e) => setPaymentXl(e.target.value)} style={{ ...ctl, width: "auto" }}>
                  {XL_TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <button style={blue} disabled={busy} onClick={async () => { if (!reqClientMonth()) return; if (paymentXl !== "5") await loadStatus(true); await doExport("payment", paymentXl); }}>Get Employee XL</button>
                <button style={blue} disabled={busy} onClick={async () => { if (!reqClientMonth()) return; await loadStatus(true); await doExport("payment", paymentXl === "5" ? "0" : paymentXl, { provisional: "1" }); }}>Provisional Payment</button>
                <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("payment", paymentXl, { paid: "1" })}>Paid Salary</button>
                <button style={blue} disabled={busy} onClick={() => doApprove("payment")}>Get Annuxure Upload</button>
                <button style={blue} disabled={busy} onClick={() => reqStrict() && doStatus()}>Report</button>
                <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("payment", "6")}>Query Payment</button>
                <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("payment", "8")}>Android Attendance Report</button>
                <button style={blue} disabled={busy} onClick={() => doExport("payment", paymentXl, { salary_hol_flag: "1" })}>Get Hold Employee</button>
                <button style={red} onClick={doClose}>CLOSE</button>
              </Btns>

              {report && report.pending_attendance && (
                <div style={{ marginTop: "16px", textAlign: "right" }}>
                  {([report.pending_attendance, report.appro_attendannce_finanace, report.finance_approve,
                     report.finance_not_approve, report.payment_approve]).map((bx) => (
                    <div key={bx.title}>
                      <a href="#" onClick={(e) => { e.preventDefault(); setModalBox(bx); }}>
                        <b style={{ color: "red" }}>{bx.count}</b> {bx.title}
                      </a>
                    </div>
                  ))}
                </div>
              )}
              {modalBox && (
                <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1050, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setModalBox(null)}>
                  <div style={{ background: "#fff", borderRadius: "6px", minWidth: "360px", maxWidth: "90vw", maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
                    <div style={{ padding: "10px 15px", borderBottom: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between" }}>
                      <h4 style={{ margin: 0 }}>{modalBox.title}</h4>
                      <button style={{ border: 0, background: "transparent", fontSize: "20px", cursor: "pointer" }} onClick={() => setModalBox(null)}>&times;</button>
                    </div>
                    <table className="table" style={{ margin: 0 }}>
                      <thead><tr><th>Branches</th></tr></thead>
                      <tbody>
                        {modalBox.items.map((it, i) => <tr key={i}><td>{it}</td></tr>)}
                        {modalBox.items.length === 0 && <tr><td>No Matching Records Found.</td></tr>}
                      </tbody>
                    </table>
                    <div style={{ padding: "10px 15px", textAlign: "center", borderTop: "1px solid #e5e5e5" }}>
                      <button style={red} onClick={() => setModalBox(null)}>Close</button>
                    </div>
                  </div>
                </div>
              )}

              {showHold && (
                <div style={{ marginTop: "18px" }}>
                  <div style={{ background: "#006699", color: "#fff", padding: "8px 12px", fontWeight: "bold", borderRadius: "4px 4px 0 0", textAlign: "center" }}>Hold Employee List</div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff" }}>
                      <thead style={{ background: "#006699", color: "white" }}>
                        <tr>
                          <th style={{ padding: "8px", textAlign: "center" }}>
                            <input type="checkbox" checked={holdRows.length > 0 && holdRows.every((r) => holdSel[r.emp_code])}
                              onChange={(e) => { const m: Record<string, boolean> = {}; holdRows.forEach((r) => (m[r.emp_code] = e.target.checked)); setHoldSel(m); }} /> SELECT EMPLOYEE
                          </th>
                          <th style={{ padding: "8px" }}>Employee Code</th>
                          <th style={{ padding: "8px" }}>Employee Name</th>
                          <th style={{ padding: "8px" }}>Client Name</th>
                          <th style={{ padding: "8px" }}>State Name</th>
                          <th style={{ padding: "8px" }}>Unit Name</th>
                          <th style={{ padding: "8px" }}>Present Day</th>
                          <th style={{ padding: "8px" }}>Absent Days</th>
                          <th style={{ padding: "8px" }}>Per Day Deduction Rate</th>
                          <th style={{ padding: "8px" }}>Total</th>
                          <th style={{ padding: "8px" }}>No Of Days</th>
                        </tr>
                      </thead>
                      <tbody>
                        {holdRows.map((r) => (
                          <tr key={r.emp_code}>
                            <td style={{ padding: "8px", textAlign: "center" }}><input type="checkbox" checked={!!holdSel[r.emp_code]} onChange={(e) => setHoldSel({ ...holdSel, [r.emp_code]: e.target.checked })} /></td>
                            <td style={{ padding: "8px" }}>{r.emp_code}</td>
                            <td style={{ padding: "8px" }}>{r.emp_name}</td>
                            <td style={{ padding: "8px" }}>{r.client}</td>
                            <td style={{ padding: "8px" }}>{r.state_name}</td>
                            <td style={{ padding: "8px" }}>{r.unit_name}</td>
                            <td style={{ padding: "8px" }}>{r.present_day}</td>
                            <td style={{ padding: "8px" }}>{r.absent_days}</td>
                            <td style={{ padding: "8px" }}>{r.per_day_rate}</td>
                            <td style={{ padding: "8px" }}>{r.total}</td>
                            <td style={{ padding: "8px" }}><input className="form-control" style={{ width: "70px", height: "30px" }} value={holdDays[r.emp_code] ?? ""} onChange={(e) => setHoldDays({ ...holdDays, [r.emp_code]: e.target.value })} /></td>
                          </tr>
                        ))}
                        {holdRows.length === 0 && <tr><td colSpan={11} style={{ textAlign: "center", padding: "18px" }}>No Matching Records Found.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  {holdRows.length > 0 && <Btns><button style={green} disabled={busy} onClick={holdApprove}>Approve</button></Btns>}
                </div>
              )}
            </>
          )}

          {/* ===================== TAB 2: OT Payment ===================== */}
          {activeTab === "OT Payment" && (
            <Btns>
              <button style={green} disabled={busy} onClick={() => reqStrict() && doProcess("ot")}>Process</button>
              <select value={otXl} onChange={(e) => setOtXl(e.target.value)} style={{ ...ctl, width: "auto" }}>
                {XL_TYPES.slice(0, 4).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("ot", otXl)}>OT Get Employee XL</button>
              <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("ot", otXl, { paid: "1" })}>OT Paid Salary</button>
              <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("ot", otXl, { salary_hol_flag: "1" })}>Get Hold Employee</button>
            </Btns>
          )}

          {/* ===================== TAB 3: Arrears Payment ===================== */}
          {activeTab === "Arrears Payment" && (
            <>
              <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end" }}>
                <Field label="Arrear Type : ">
                  <select className="form-control" value={arrearType} onChange={(e) => setArrearType(e.target.value)} style={ctl}>
                    <option value="">Select</option><option value="month">Month Wise</option><option value="policy">Policy Wise</option>
                  </select>
                </Field>
                {arrearType === "policy" && <>
                  <Field label="From Month :" req><input type="month" className="form-control" value={arrearFrom} onChange={(e) => setArrearFrom(e.target.value)} style={ctl} /></Field>
                  <Field label="To Month :" req><input type="month" className="form-control" value={arrearTo} onChange={(e) => setArrearTo(e.target.value)} style={ctl} /></Field>
                </>}
              </div>
              <Btns>
                <button style={green} disabled={busy} onClick={() => {
                  if (!reqStrict()) return;
                  if (!arrearType) return alert("Please Select Arrear Type");
                  if (arrearType === "policy" && !arrearFrom) return alert("Please Select From Month ");
                  if (arrearType === "policy" && !arrearTo) return alert("Please Select To Month ");
                  doProcess("arrears", { arrear_type: arrearType, from_month: arrearFrom, to_month: arrearTo });
                }}>Process</button>
                <select value={arrearXl} onChange={(e) => setArrearXl(e.target.value)} style={{ ...ctl, width: "auto" }}>{XL_TYPES.slice(0, 4).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("arrears", arrearXl)}>Get Employee XL</button>
                <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("arrears", arrearXl, { paid: "1" })}>Paid Salary</button>
                <button style={blue} disabled={busy} onClick={() => doApprove("arrears")}>Get Annuexure Upload</button>
                <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("arrears", "7")}>Query Payment</button>
                <button style={red} onClick={doClose}>CLOSE</button>
              </Btns>
            </>
          )}

          {/* ===================== TAB 4: Conveyance Payment ===================== */}
          {activeTab === "Conveyance Payment" && (
            <>
              <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end" }}>
                <Field label="Conveyance Type:" req>
                  <select className="form-control" value={convType} onChange={(e) => setConvType(e.target.value)} style={ctl}>
                    <option value="0">Select</option><option value="1">Conveyance</option><option value="2">Driver Conveyance</option>
                  </select>
                </Field>
                <Field label="XL Type :">
                  <select className="form-control" value={convXl} onChange={(e) => setConvXl(e.target.value)} style={ctl}>{XL_TYPES.slice(0, 3).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                </Field>
              </div>
              <Btns>
                <button style={green} disabled={busy} onClick={() => { if (!reqClientMonth()) return; if (convType === "0") return alert("Please Select Conveyance Type"); doProcess("conveyance", { conveyance_type: convType }); }}>Process</button>
                <button style={blue} disabled={busy} onClick={() => { if (!reqClientMonth()) return; if (convType === "0") return alert("Please Select Conveyance Type"); doExport("conveyance", convXl, { conveyance_type: convType }); }}>Get Employee XL</button>
                <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("conveyance", convXl, { conveyance_type: convType, paid: "1" })}>Paid Conveyance</button>
                <button style={blue} disabled={busy} onClick={() => doApprove("conveyance")}>Payment Approve</button>
                <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("conveyance", convXl, { conveyance_type: convType, query: "1" })}>Query Payment</button>
                <button style={blue} disabled={busy} onClick={() => doExport("conveyance", convXl, { conveyance_type: convType, salary_hol_flag: "1" })}>Get Hold Employee</button>
                <button style={red} onClick={doClose}>CLOSE</button>
              </Btns>
            </>
          )}

          {/* ===================== TAB 5: Material Payment ===================== */}
          {activeTab === "Material Payment" && (
            <>
              <Btns>
                <button style={green} disabled={busy} onClick={() => { if (!reqStrict()) return; doProcess("material"); }}>Process</button>
                <select value={materialXl} onChange={(e) => setMaterialXl(e.target.value)} style={{ ...ctl, width: "auto" }}>{XL_TYPES.slice(0, 3).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
                <button style={blue} disabled={busy} onClick={() => reqStrict() && doExport("material", materialXl)}>Get Employee XL</button>
                <button style={blue} disabled={busy} onClick={() => reqStrict() && doExport("material", "4")}>Paid Material</button>
                <button style={blue} disabled={busy} onClick={() => doApprove("material")}>Payment Approve</button>
                <button style={red} onClick={doClose}>CLOSE</button>
              </Btns>
              <div style={{ overflowX: "auto", marginTop: "16px" }}>
                <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff" }}>
                  <thead style={{ background: "#006699", color: "white" }}>
                    <tr>{["Sr No.", "State_Name", "Branch", "Employee_Name", "Designation", "Month_Year", "Branch_Area(In Sq.Ft)", "Contract_Rate", "Payment_Amount(BY 75%)", "Account_Number"].map((h) => <th key={h} style={{ padding: "8px" }}>{h}</th>)}</tr>
                  </thead>
                  <tbody><tr><td colSpan={10} style={{ textAlign: "center", padding: "18px" }}>No Data Found</td></tr></tbody>
                </table>
              </div>
            </>
          )}

          {/* ===================== TAB 6: Vendor Payment ===================== */}
          {activeTab === "Vendor Payment" && (
            <>
              <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end" }}>
                <Field label="Month :" req><input type="month" className="form-control" value={monthVal} onChange={(e) => onMonth(e.target.value)} style={ctl} /></Field>
                <Field label="Vendor Name:" req><select className="form-control" value={vendorName} onChange={(e) => { setVendorName(e.target.value); setPoNo(""); }} style={ctl}><option value="">Select</option>{vendors.map((v) => <option key={v.vend_id} value={v.vend_id}>{v.vend_name}</option>)}</select></Field>
                <Field label="Purchase Order No:" req><select className="form-control" value={poNo} onChange={(e) => setPoNo(e.target.value)} style={ctl}><option value="">Select</option>{pos.map((o) => <option key={o.po_no} value={o.po_no}>{o.po_no}</option>)}</select></Field>
                <Field label="Mode Of Payment:"><select className="form-control" value={modeOfPayment} onChange={(e) => setModeOfPayment(e.target.value)} style={ctl}><option value="1">NEFT</option><option value="2">CHEQUE</option></select></Field>
                {modeOfPayment === "2" && <>
                  <Field label="Cheque Number :" req><input className="form-control" value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} style={ctl} /></Field>
                  <Field label="Cheque Date :" req><input type="date" className="form-control" value={chequeDate} onChange={(e) => setChequeDate(e.target.value)} style={ctl} /></Field>
                </>}
              </div>
              <Btns>
                <button style={green} disabled={busy} onClick={() => {
                  if (!month.trim() || !year.trim()) return alert("Please Enter Month");
                  if (!vendorName) return alert("Please Select Vendor Name");
                  if (!poNo) return alert("Please Select  Purchase Orader Number");
                  if (!modeOfPayment) return alert("Please Select Mode of Payment");
                  if (modeOfPayment === "2" && !chequeNo.trim()) return alert("Please Enter Check Number");
                  if (modeOfPayment === "2" && !chequeDate) return alert("Please Select Check Date");
                  doProcess("vendor", { vendor_name: vendorName, purchase_order_no: poNo, mode_of_payment: modeOfPayment });
                }}>Process</button>
                <button style={blue} disabled={busy} onClick={() => doExport("vendor", "0")}>Get Vendor XL</button>
                <button style={blue} disabled={busy} onClick={() => doExport("vendor", "3")}>Paid Vendor Payment</button>
                <button style={blue} disabled={busy} onClick={() => doApprove("vendor")}>Get Annuxure Upload</button>
              </Btns>
            </>
          )}

          {/* ===================== TAB 7: R&M Service Payment ===================== */}
          {activeTab === "R&M Service Payment" && (
            <>
              <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end" }}>
                <Field label="Invoice Slot :" req>
                  <select className="form-control" value={invoiceSlot} onChange={(e) => setInvoiceSlot(e.target.value)} style={ctl}>
                    <option value="">Select</option><option value="1_to_15">1 to 15</option><option value="16_to_30">16 to 30</option>
                  </select>
                </Field>
              </div>
              <Btns>
                <button style={green} disabled={busy} onClick={() => { if (!reqStrict()) return; if (!invoiceSlot) return alert("Please Select Invoice Slot"); doProcess("rm", { invoice_slot: invoiceSlot }); }}>Process</button>
                <button style={blue} disabled={busy} onClick={() => reqStrict() && doExport("rm", "0", { invoice_slot: invoiceSlot })}>Get Employee XL</button>
                <button style={blue} disabled={busy} onClick={() => reqStrict() && doExport("rm", "2", { invoice_slot: invoiceSlot })}>Paid Salary</button>
              </Btns>
            </>
          )}

          {/* ===================== TAB 8: Administrative Expense Payment ===================== */}
          {activeTab === "Administrative Expense Payment" && (
            <Btns>
              <button style={green} disabled={busy} onClick={() => reqStrict() && doProcess("admin")}>Process</button>
              <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("admin", "0")}>Get Employee XL</button>
              <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("admin", "2")}>Paid Salary</button>
            </Btns>
          )}

          {/* ===================== TAB 9: Advanced Payment ===================== */}
          {activeTab === "Advanced Payment" && (
            <>
              <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end" }}>
                <Field label="Select Month :"><input type="month" className="form-control" value={monthVal} onChange={(e) => onMonth(e.target.value)} style={ctl} /></Field>
                <Field label="Select Party Type :">
                  <select className="form-control" value={partyType} onChange={(e) => { setPartyType(e.target.value); if (!month.trim()) alert("Please Select Month/Year."); }} style={ctl}>
                    <option value="">Select</option><option value="1">Client</option><option value="2">Vendor</option>
                  </select>
                </Field>
                <Field label="Select Party :"><select className="form-control" value={party} onChange={(e) => { setParty(e.target.value); setPoNo(""); }} style={ctl}><option value="">Select</option>
                  {partyType === "1" && clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
                  {partyType === "2" && vendors.map((v) => <option key={v.vend_id} value={v.vend_id}>{v.vend_name}</option>)}
                </select></Field>
                {partyType === "2" && <>
                  <Field label="Purchase Order No:" req><select className="form-control" value={poNo} onChange={(e) => setPoNo(e.target.value)} style={ctl}><option value="">Select</option>{pos.map((o) => <option key={o.po_no} value={o.po_no}>{o.po_no}</option>)}</select></Field>
                </>}
              </div>
              <Btns>
                <button style={green} disabled={busy} onClick={() => {
                  if (!month.trim() || !year.trim()) return alert("Please Select month & year ");
                  if (!partyType) return alert("Please Select Party Type Name ");
                  if (!party) return alert("Please Select Party Name ");
                  if (partyType === "2" && !poNo) return alert("Please Select Purchase Order No. ");
                  if (partyType === "1" && (!state || state === "ALL")) return alert("Please Select State Name. ");
                  if (partyType === "1" && (!unit || unit === "ALL")) return alert("Please Select Branch Name. ");
                  doProcess("advanced", { party_type: partyType, party, po_no: poNo });
                }}>Process</button>
                <button style={blue} disabled={busy} onClick={() => doExport("advanced", "1", { party_type: partyType, party, po_no: poNo })}>Get Employee XL</button>
                <button style={blue} disabled={busy} onClick={() => doExport("advanced", "2", { party_type: partyType, party, po_no: poNo })}>Paid  Payment</button>
                <button style={blue} disabled={busy} onClick={() => doApprove("advanced", { party_type: partyType, party })}>Get Annuxure Upload</button>
              </Btns>
            </>
          )}

          {/* ===================== TAB 10: Shiftwise Payment ===================== */}
          {activeTab === "Shiftwise Payment" && (
            <Btns>
              <button style={green} disabled={busy} onClick={() => reqStrict() && doProcess("shiftwise")}>Process</button>
              <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("shiftwise", "0")}>Get Employee XL</button>
              <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("shiftwise", "2")}>Paid Salary</button>
              <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("shiftwise", "0", { salary_hol_flag: "1" })}>Get Hold Employee</button>
            </Btns>
          )}

          {/* ===================== TAB 11: Incentive Payment ===================== */}
          {activeTab === "Incentive Payment" && (
            <Btns>
              <button style={green} disabled={busy} onClick={() => reqStrict() && doProcess("incentive")}>Process</button>
              <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("incentive", "0")}>Get Employee XL</button>
              <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("incentive", "0", { paid: "1" })}>Paid Salary</button>
            </Btns>
          )}

          {/* ===================== TAB 12: Office Rent Payment ===================== */}
          {activeTab === "Office Rent Payment" && (
            <Btns>
              <button style={green} disabled={busy} onClick={() => reqStrict() && doProcess("office_rent")}>Process</button>
              <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("office_rent", "0")}>Get Employee XL</button>
              <button style={blue} disabled={busy} onClick={() => reqClientMonth() && doExport("office_rent", "2")}>Paid Salary</button>
            </Btns>
          )}

          {/* ===================== TAB 13: Yearly Payment ===================== */}
          {activeTab === "Yearly Payment" && (
            <>
              <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end" }}>
                <Field label="Yearly Billing Type:" req>
                  <select className="form-control" value={yearlyType} onChange={(e) => setYearlyType(e.target.value)} style={ctl}>
                    <option value="">Select</option><option value="0">Bonus Billing</option><option value="1">Leave Billing</option><option value="2">Gratuity Billing</option>
                  </select>
                </Field>
                <Field label="From Month :" req><input type="month" className="form-control" value={yFrom} onChange={(e) => setYFrom(e.target.value)} style={ctl} /></Field>
                <Field label="To Month :" req><input type="month" className="form-control" value={yTo} onChange={(e) => setYTo(e.target.value)} style={ctl} /></Field>
              </div>
              <Btns>
                <button style={green} disabled={busy} onClick={() => {
                  if (!yearlyOk()) return;
                  doProcess("yearly", { yearly_type: yearlyType, from_month: yFrom, to_month: yTo });
                }}>Process</button>
                <button style={blue} disabled={busy} onClick={() => yearlyOk() && doExport("yearly", "11", { yearly_type: yearlyType, from_month: yFrom, to_month: yTo })}>Get Employee XL</button>
                <button style={blue} disabled={busy} onClick={() => yearlyOk() && doExport("yearly", "12", { yearly_type: yearlyType, from_month: yFrom, to_month: yTo })}>Paid Salary</button>
                <button style={red} onClick={doClose}>CLOSE</button>
              </Btns>
            </>
          )}

          {/* ===================== TAB 14: Manual Payment ===================== */}
          {activeTab === "Manual Payment" && (
            <>
              <div style={{ display: "flex", gap: "20px", marginBottom: "14px" }}>
                {[["manual", "   Manual Payment"], ["bank", "Bank To Bank"], ["bulk", "Bulk Payment"]].map(([v, l]) => (
                  <label key={v} style={{ cursor: "pointer" }}><input type="radio" name="manualMode" checked={manualMode === v} onChange={() => setManualMode(v)} /> {l}</label>
                ))}
              </div>

              {manualMode === "manual" && (
                <>
                  <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end", background: "#f7f7f7", padding: "14px", borderRadius: "6px" }}>
                    <Field label="Select Month :" req><input type="month" className="form-control" value={monthVal} onChange={(e) => onMonth(e.target.value)} style={ctl} /></Field>
                    <Field label="Expense Head:"><select className="form-control" value={mExpHead} onChange={(e) => setMExpHead(e.target.value)} style={ctl}><option value="">Select</option>{EXPENSE_HEADS.map((h, i) => <option key={h} value={String(i)}>{h}</option>)}</select></Field>
                    <Field label="Payment Against:"><select className="form-control" value={mPaymentAgainst} onChange={(e) => setMPaymentAgainst(e.target.value)} style={ctl}><option value="">Select</option><option value="0">Client</option><option value="1">Other Expenses</option></select></Field>
                    {mPaymentAgainst !== "1" && <Field label="Client :"><select className="form-control" value={mClient} onChange={(e) => setMClient(e.target.value)} style={ctl}><option value="Select">Select</option>{clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}</select></Field>}
                    {mPaymentAgainst === "1" && <Field label="Party Name :" req><input className="form-control" value={mParty} onChange={(e) => setMParty(e.target.value)} style={ctl} /></Field>}
                    <Field label="Bank Name :" req><input className="form-control" value={mBank} onChange={(e) => setMBank(e.target.value.replace(/[^A-Za-z ]/g, ""))} style={ctl} /></Field>
                    <Field label="Account Holder Name :" req><input className="form-control" value={mHolder} onChange={(e) => setMHolder(e.target.value)} style={ctl} /></Field>
                    <Field label="Account No :" req><input className="form-control" value={mAcc} onChange={(e) => setMAcc(e.target.value.replace(/[^0-9]/g, ""))} style={ctl} /></Field>
                    <Field label="Mode of Transfer :" req><select className="form-control" value={mMot} onChange={(e) => setMMot(e.target.value)} style={ctl}><option value="">Select</option><option value="N">N</option><option value="I">I</option></select></Field>
                    <Field label="Amount :" req><input className="form-control" value={mAmount} onChange={(e) => setMAmount(e.target.value.replace(/[^0-9]/g, ""))} style={ctl} /></Field>
                    <Field label="IFSC No :" req><input className="form-control" value={mIfsc} onChange={(e) => setMIfsc(e.target.value.replace(/[^A-Za-z0-9]/g, ""))} style={ctl} /></Field>
                    <Field label="Descripton :" req><textarea className="form-control" value={mDesc} onChange={(e) => setMDesc(e.target.value)} style={{ ...ctl, height: "60px" }} /></Field>
                    <Field label="Attachment :"><input type="file" className="form-control" onChange={(e) => setMAttach(e.target.files?.[0] ?? null)} style={ctl} /></Field>
                    <div style={{ flex: "0 0 60px" }}>
                      <button type="button" title="Add Item" disabled={busy} onClick={addManual} style={{ ...blue, fontSize: "18px", padding: "4px 14px" }}>+</button>
                    </div>
                  </div>
                  {staged.length > 0 && (
                    <>
                      <div style={{ overflowX: "auto", marginTop: "16px" }}>
                        <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff" }}>
                          <thead style={{ background: "#006699", color: "white" }}>
                            <tr>
                              <th style={{ padding: "8px" }}></th><th style={{ padding: "8px" }}>Sr No.</th><th style={{ padding: "8px" }}>ID</th>
                              {["Party Name", "Account Holder Name", "Bank Name", "Month", "Year", "Amount", "Account No", "IFSC No", "Mode of Transfer", "Description", "File", "Expense Head", "Payment Against"].map((c) => <th key={c} style={{ padding: "8px" }}>{c}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            {staged.map((r, i) => (
                              <tr key={i}>
                                <td style={{ padding: "8px", textAlign: "center" }}><button style={{ ...red, padding: "2px 8px" }} onClick={() => removeStaged(i)}>X</button></td>
                                <td style={{ padding: "8px" }}>{i + 1}</td><td style={{ padding: "8px" }}></td>
                                {[r.party_name, r.account_holder_name, r.bank_name, r.month, r.year, r.amount, r.account_no, r.ifsc_no, r.mode_of_transfer, r.description, r.file ? r.file.name : "null", r.expense_head, r.payment_against].map((v, j) => <td key={j} style={{ padding: "8px" }}>{v}</td>)}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <Btns><button style={green} disabled={busy} onClick={submitManual}> Submit </button></Btns>
                    </>
                  )}
                </>
              )}

              {manualMode === "bank" && (
                <>
                  <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end", background: "#f7f7f7", padding: "14px", borderRadius: "6px" }}>
                    <Field label="Select Month :" req><input type="month" className="form-control" value={monthVal} onChange={(e) => onMonth(e.target.value)} style={ctl} /></Field>
                    <Field label="Expense Head:"><select className="form-control" value={bExpHead} onChange={(e) => setBExpHead(e.target.value)} style={ctl}><option value="">Select</option>{EXPENSE_HEADS.map((h, i) => <option key={h} value={String(i)}>{h}</option>)}</select></Field>
                    <Field label="From Bank :" req><input className="form-control" value={bFromBank} onChange={(e) => setBFromBank(e.target.value)} style={ctl} /></Field>
                    <Field label="From Bank AC No :" req><input className="form-control" value={bFromAc} onChange={(e) => setBFromAc(e.target.value)} style={ctl} /></Field>
                    <Field label="To Bank :" req><input className="form-control" value={bToBank} onChange={(e) => setBToBank(e.target.value)} style={ctl} /></Field>
                    <Field label="TO Bank AC No :" req><input className="form-control" value={bToAc} onChange={(e) => setBToAc(e.target.value)} style={ctl} /></Field>
                    <Field label="TO Bank IFSC code :" req><input className="form-control" value={bToIfsc} onChange={(e) => setBToIfsc(e.target.value)} style={ctl} /></Field>
                    <Field label="Amount :" req><input className="form-control" value={bAmount} onChange={(e) => setBAmount(e.target.value.replace(/[^0-9.]/g, ""))} style={ctl} /></Field>
                    <Field label="Mode of Transfer :" req><select className="form-control" value={bMot} onChange={(e) => setBMot(e.target.value)} style={ctl}><option value="">Select</option><option value="N">N</option><option value="I">I</option></select></Field>
                    <Field label="Descripton :" req><input className="form-control" value={bDesc} onChange={(e) => setBDesc(e.target.value)} style={ctl} /></Field>
                    <Field label="Attachment :"><input type="file" className="form-control" onChange={(e) => setBAttach(e.target.files?.[0] ?? null)} style={ctl} /></Field>
                  </div>
                  <Btns><button style={green} disabled={busy} onClick={submitBankToBank}> Submit</button></Btns>
                  <ManualGrid rows={manualRows} onDelete={(id) => deleteManual(id)} bankToBank />
                </>
              )}

              {manualMode === "bulk" && (
                <>
                  <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end", background: "#f7f7f7", padding: "14px", borderRadius: "6px" }}>
                    <Field label="Select Month :" req><input type="month" className="form-control" value={monthVal} onChange={(e) => onMonth(e.target.value)} style={ctl} /></Field>
                    <Field label="Expense Head:"><select className="form-control" value={mExpHead} onChange={(e) => setMExpHead(e.target.value)} style={ctl}><option value="">Select</option>{EXPENSE_HEADS.map((h, i) => <option key={h} value={String(i)}>{h}</option>)}</select></Field>
                    <Field label="Payment Against:"><select className="form-control" value={mPaymentAgainst} onChange={(e) => setMPaymentAgainst(e.target.value)} style={ctl}><option value="">Select</option><option value="0">Client</option><option value="1">Other Expenses</option></select></Field>
                    {mPaymentAgainst !== "1" && <Field label="Client :"><select className="form-control" value={mClient} onChange={(e) => setMClient(e.target.value)} style={ctl}><option value="Select">Select</option>{clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}</select></Field>}
                    {mPaymentAgainst === "1" && <Field label="Party Name :" req><input className="form-control" value={mParty} onChange={(e) => setMParty(e.target.value)} style={ctl} /></Field>}
                    <Field label="Attachment :"><input type="file" className="form-control" onChange={(e) => setBulkAttach(e.target.files?.[0] ?? null)} style={ctl} /></Field>
                    <Field label="Excel File :" req><input type="file" accept=".xlsx,.csv" className="form-control" onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)} style={ctl} /></Field>
                  </div>
                  <Btns>
                    <button style={green} disabled={busy} onClick={submitBulk}> Submit </button>
                    <button style={blue} disabled={busy} onClick={() => downloadFile(`${SP}/manual-bulk-template/`, "MANUAL_PAYMENT_UPLOAD_FORMAT.xls")}>Download</button>
                  </Btns>
                </>
              )}
            </>
          )}

          {/* ===================== TAB 15: Manual Payment Process ===================== */}
          {activeTab === "Manual Payment Process" && (
            <>
              <div style={{ display: "flex", gap: "20px", marginBottom: "14px" }}>
                {[["manual", " Manual Payment"], ["bank", "Bank To Bank"]].map(([v, l]) => (
                  <label key={v} style={{ cursor: "pointer" }}><input type="radio" name="mpMode" checked={mpMode === v} onChange={() => { setMpMode(v); setMpRows([]); setMpSel({}); }} /> {l}</label>
                ))}
              </div>
              <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end" }}>
                <Field label={mpMode === "bank" ? "Select Month :" : "Select Date :"}><input type="date" className="form-control" value={mpDate} onChange={(e) => setMpDate(e.target.value)} style={ctl} /></Field>
                <Field label="Expense Head:"><select className="form-control" value={mpHead} onChange={(e) => setMpHead(e.target.value)} style={ctl}><option value="">Select</option>{EXPENSE_HEADS.map((h, i) => <option key={h} value={String(i)}>{h}</option>)}</select></Field>
                {mpMode === "manual" && <>
                  <Field label="Payment Against:"><select className="form-control" value={mpAgainst} onChange={(e) => setMpAgainst(e.target.value)} style={ctl}><option value="">Select</option><option value="0">Client</option><option value="1">Other Expenses</option></select></Field>
                  {mpAgainst !== "1" && <Field label="Client :"><select className="form-control" value={mpClient} onChange={(e) => setMpClient(e.target.value)} style={ctl}><option value="Select">Select</option>{clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}</select></Field>}
                  {mpAgainst === "1" && <Field label="Party Name :" req><input className="form-control" value={mpParty} onChange={(e) => setMpParty(e.target.value)} style={ctl} /></Field>}
                </>}
              </div>
              <Btns>
                <button style={green} disabled={busy} onClick={loadMp}> Show </button>
                {mpRows.length > 0 && <button style={blue} disabled={busy} onClick={mpProcess}> Process </button>}
                <button style={blue} disabled={busy} onClick={() => { if (!mpDateOk()) return; downloadFile(`${SP}/manual-export/?${mpParams().toString()}`, "Manual_Payment.xls"); }}>Get Excle</button>
                <button style={blue} disabled={busy} onClick={mpFinal}> Final Annexure</button>
              </Btns>
              {mpRows.length > 0 && (
                <div style={{ overflowX: "auto", marginTop: "16px" }}>
                  <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff" }}>
                    <thead style={{ background: "#006699", color: "white" }}>
                      <tr>
                        <th style={{ padding: "8px" }}>Delete</th>
                        <th style={{ padding: "8px" }}><input type="checkbox" checked={mpRows.length > 0 && mpRows.filter((r) => r.payment_status !== 1).every((r) => mpSel[r.id])} onChange={(e) => { const m: Record<number, boolean> = {}; mpRows.forEach((r) => { if (r.payment_status !== 1) m[r.id] = e.target.checked; }); setMpSel(m); }} /> SELECT RECORD</th>
                        <th style={{ padding: "8px" }}>Sr No.</th>
                        {(mpMode === "bank"
                          ? ["Account Holder Name", "From Bank Name", "From Bank AC NO", "To Bank Name", "To Bank AC No", "IFSC Code", "Amount", "MOde Of Transfer (N/I)", "Month", "Year", "Description", "Uploaded Date", "DOWNLOAD", "Status", "Expense Head"]
                          : ["Party Name", "Bank Name", "Account Holder Name", "Month", "Year", "Amount", "IFSC Code", "Account No", "Description", "Uploaded Date", "DOWNLOAD", "Status", "Expence Head"]
                        ).map((c) => <th key={c} style={{ padding: "8px" }}>{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {mpRows.map((r, i) => {
                        const dl = r.file_url ? <a href={`${API_BASE_URL}${r.file_url}`} target="_blank" rel="noreferrer" className="btn btn-primary" style={{ color: "#fff", padding: "2px 8px" }}>DOWNLOAD</a> : "";
                        const cells = mpMode === "bank"
                          ? [r.account_holder_name, r.from_bank, r.from_bank_ac, r.to_bank, r.to_bank_ac, r.to_bank_ifsc, r.amount, r.mode_of_transfer, r.month, r.year, r.description, r.uploaded_date, dl, r.payment_status, r.expense_head]
                          : [r.party_name, r.bank_name, r.account_holder_name, r.month, r.year, r.amount, r.ifsc_no, r.account_no, r.description, r.uploaded_date, dl, r.payment_status, r.expense_head];
                        return (
                          <tr key={r.id}>
                            <td style={{ padding: "8px", textAlign: "center" }}>{r.payment_status !== 1 && <button style={{ ...red, padding: "2px 8px" }} onClick={() => deleteManual(r.id, loadMp)}>X</button>}</td>
                            <td style={{ padding: "8px", textAlign: "center" }}><input type="checkbox" disabled={r.payment_status === 1} checked={!!mpSel[r.id]} onChange={(e) => setMpSel({ ...mpSel, [r.id]: e.target.checked })} /></td>
                            <td style={{ padding: "8px" }}>{i + 1}</td>
                            {cells.map((v, j) => <td key={j} style={{ padding: "8px" }}>{v}</td>)}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </section>
  );
}

function ManualGrid({ rows, onDelete, bankToBank }: { rows: ManualRow[]; onDelete: (id: number) => void; bankToBank?: boolean }) {
  const cols = bankToBank
    ? ["Account Holder Name", "From Bank Name", "From Bank AC NO", "To Bank Name", "To Bank AC No", "IFSC Code", "Amount", "MOde Of Transfer ( N / I )", "Month", "Year", "Description", "Uploaded Date", "Expense Head"]
    : ["Party Name", "Account Holder Name", "Bank Name", "Month", "Year", "Amount", "Account No", "IFSC No", "Mode of Transfer", "Description", "File", "Expense Head", "Payment Against"];
  return (
    <div style={{ overflowX: "auto", marginTop: "16px" }}>
      <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff" }}>
        <thead style={{ background: "#006699", color: "white" }}>
          <tr><th style={{ padding: "8px" }}>Del</th><th style={{ padding: "8px" }}>Sr No.</th><th style={{ padding: "8px" }}>ID</th>{cols.map((c) => <th key={c} style={{ padding: "8px" }}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.id}>
              <td style={{ padding: "8px", textAlign: "center" }}><button style={{ background: "#d9534f", border: "1px solid #d43f3a", color: "#fff", borderRadius: "4px", padding: "2px 8px", cursor: "pointer" }} onClick={() => onDelete(r.id)}>X</button></td>
              <td style={{ padding: "8px" }}>{i + 1}</td><td style={{ padding: "8px" }}>{r.id}</td>
              {bankToBank
                ? [r.account_holder_name, r.from_bank, r.from_bank_ac, r.to_bank, r.to_bank_ac, r.to_bank_ifsc, r.amount, r.mode_of_transfer, r.month, r.year, r.description, r.uploaded_date, r.expense_head].map((v, j) => <td key={j} style={{ padding: "8px" }}>{v}</td>)
                : [r.party_name, r.account_holder_name, r.bank_name, r.month, r.year, r.amount, r.account_no, r.ifsc_no, r.mode_of_transfer, r.description, r.file_url ? "file" : "", r.expense_head, r.payment_against].map((v, j) => <td key={j} style={{ padding: "8px" }}>{v}</td>)}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={cols.length + 3} style={{ textAlign: "center", padding: "18px" }}>No Record Found</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
