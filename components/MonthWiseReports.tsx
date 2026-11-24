"use client";
/* =====================================================================
 * MONTH WISE REPORTS -- port of Reports.aspx (menu "Month Wise").
 * Filter header (Month/Year, Client, State, Branch, Designation) + 10 tabs:
 * Compliance (Acts), Salary Details, PF Details, ESIC Details, MLWF Details,
 * Other Details, ID Cards, GST, LWF, Generate Form 5.
 * Backend: /api/reports/salary-reports/month-wise/* (legacy SQL, read-only).
 * Crystal Reports layouts cannot run here: those reports download the data set
 * the .rpt is fed with as Excel, and say so.
 * ===================================================================== */
import React, { useEffect, useMemo, useState } from "react";
import { API_BASE_URL, apiGet } from "@/lib/api/client";

const BASE = "/api/reports/salary-reports/month-wise";
type Row = any[];
type Result = {
  title?: string; filename: string; columns: string[]; rows: Row[]; count: number; kind?: string;
  crystal?: boolean; html?: string; message?: string; csv?: string; missing_columns?: string[];
};

/* ---------- transport ---------- */
let _csrf = "";
async function csrf(): Promise<string> {
  try {
    const r = await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
    const d = await r.json().catch(() => null);
    if (d && typeof d.csrfToken === "string") _csrf = d.csrfToken;
  } catch { /* cookie fallback below */ }
  if (_csrf) return _csrf;
  const m = typeof document !== "undefined" ? document.cookie.match(/(^|; )csrftoken=([^;]+)/) : null;
  return m ? decodeURIComponent(m[2]) : "";
}
async function errMsg(res: Response): Promise<string> {
  const b = await res.json().catch(() => null);
  if (Array.isArray(b)) return String(b[0]);
  return (b && (b.detail || (b.non_field_errors && b.non_field_errors[0]))) || `Request failed (${res.status})`;
}
async function post(path: string, body?: FormData): Promise<Response> {
  const t = await csrf();
  return fetch(`${API_BASE_URL}${path}`, { method: "POST", credentials: "include", headers: { "X-CSRFToken": t }, body });
}
// reports that the legacy page prints as Crystal Reports PDFs (the server draws the legacy .rpt layout)
const PDF_KEYS = new Set(["pf_statement", "ptax", "pf_challan", "pf_challan_unit", "esic_challan", "form10", "form5",
  "mlwf_statement", "mlwf_details", "mlwf_monthly", "salary_unit", "salary_statement", "pf_summary", "esic_summary",
  "form9", "pf_return", "form16", "form11", "form2", "noc", "enquiry", "lwf_chalan"]);

function saveBlob(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
}
const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function gridHtml(d: Result) {
  return `<table border=1><tr>${d.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>` +
    d.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") + `</table>`;
}
function downloadXls(name: string, html: string) {
  saveBlob(name.endsWith(".xls") ? name : name + ".xls", new Blob(["﻿" + html], { type: "application/vnd.ms-excel" }));
}
function downloadCsv(d: Result) {
  const q = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const txt = [d.columns.map(q).join(","), ...d.rows.map((r) => r.map(q).join(","))].join("\r\n");
  saveBlob(d.filename + ".csv", new Blob(["﻿" + txt], { type: "text/csv" }));
}
function printGrid(d: Result) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<html><head><title>${esc(d.title || d.filename)}</title></head><body>${gridHtml(d)}</body></html>`);
  w.document.close(); w.print();
}

const ACTS = ["CHILD LABOUR ACT", "CLRA ACT", "S&E ACT", "MB ACT", "MW ACT", "PAYMENT WAGES ACT", "N & FH ACT",
  "EPF ACT", "ESI ACT", "EC ACT", "LWF ACT", "MH SG ACT"];
// legacy ddl_act_SelectedIndexChanged: which buttons / upload descriptions each Act shows
const ACT_BUTTONS: Record<string, string[]> = {
  "CHILD LABOUR ACT": ["form_13_above", "form_13_below"],
  "CLRA ACT": ["form_b", "form_a", "form_13_below", "form_13_above", "form_14", "form_d", "form_15", "form_16", "form_23",
    "form_22", "form_21", "form_20", "bonus_register", "leave_record", "employee_data"],
  "S&E ACT": ["form_a", "form_23"], "MB ACT": [],
  "MW ACT": ["form_b", "form_23", "form_22", "form_21", "form_20", "form_d"],
  "PAYMENT WAGES ACT": ["form_b"], "N & FH ACT": ["form_a"], "EPF ACT": [], "ESI ACT": [],
  "EC ACT": ["form_b"], "LWF ACT": [], "MH SG ACT": ["form_a", "form_14"],
};
const ACT_DOCS: Record<string, string[]> = {
  "CLRA ACT": ["AGREEMENT COPY", "RC COPY", "FORM V ISSUED BY PE", "LICENSE COPY", "ACK OF PE", "BANK TRANSFER LETTER"],
  "PAYMENT WAGES ACT": ["BANK TRANSFER PROOF"], "EPF ACT": ["COMPANY PF CODE", "ECR COPY", "INSPECTION REPORT"],
  "ESI ACT": ["ESI REG. CODE LETTER", "ECR COPY", "TIC FORM OF EMPLOYEES"], "EC ACT": ["RC-RETURN OF CONTRIBUTION"],
  "LWF ACT": ["LWF REMITTANCES CHALLAN", "UNPAID ACCUMULATION REGISTER", "LWF REGISTER COPY"],
  "MH SG ACT": ["RC OR EXEMPTION FROM GUARD BOARD", "REGISTER PRINCIPAL EMPLOYER"],
};
const ACT_LABEL: Record<string, string> = {
  form_a: "FORM A", form_b: "FORM B", form_d: "FORM D", form_13_below: "FORM XIII BELOW 18", form_13_above: "FORM XIII Above 18",
  form_14: "FORM XIV", form_15: "FORM XV", form_16: "FORM XVI", form_20: "FORM XX", form_21: "FORM XXI", form_22: "FORM XXII",
  form_23: "FORM XXIII", bonus_register: "BONUS REGISTER", leave_record: "LEAVE RECORD", employee_data: "EMPLOYEE DATA",
};
const ACT_ORDER = ["form_a", "form_b", "form_d", "form_13_below", "form_13_above", "form_14", "form_15", "form_16", "form_20",
  "form_21", "form_22", "form_23", "bonus_register", "leave_record", "employee_data"];

const TABS: [string, string][] = [["acts", "Compliance"], ["salary", "Salary Details"], ["pf", "PF Details"],
  ["esic", "ESIC Details"], ["mlwf", "MLWF Details"], ["other", "Other Details"], ["idcards", "ID Cards"], ["gst", "GST"],
  ["lwf", "LWF"], ["form5", "Generate Form 5"]];
const TAB_REPORTS: Record<string, [string, string][]> = {
  salary: [["salary_statement", "1) Salary Statement"], ["salary_unit", "2) Salary Statement Unit wise"], ["bank_excel", "3) Bank Excel"],
    ["ptax", "4) PTAX Statement"], ["salary_excel", "5) Salary Statement Excel"]],
  pf: [["pf_statement", "1) PF Statement"], ["pf_challan", "2) PF Challan"], ["pf_challan_unit", "3) PF Challan Unitwise"],
    ["pf_summary", "4) PF Summary"], ["pf_challan_download", "5) PF Challan Download"], ["pf_return", "7) PF Return"],
    ["uan_grid", "8) UAN Download"]],
  esic: [["esic_statement", "1) ESIC Statement"], ["esic_excel", "2) ESIC Statement Excel"], ["esic_challan", "3) ESIC Challan"],
    ["esic_unit", "4) Esic Summary Unitwise"], ["esic_summary", "5) ESIC Summary"]],
  mlwf: [["mlwf_statement", "1) MLWF Statement"], ["mlwf_details", "2) MLWF Statement Details"], ["mlwf_monthly", "3) Monthly MLWF"],
    ["lwf_chalan", "4) LWF Chalan"]],
  other: [["form10", "1) Form No.10"], ["form5", "2) Form No.5"], ["emp_info_status", "3) Employee Information Status"],
    ["emp_pf_esic", "4) Employee PF and ESIC Number"], ["kyc_grid", "5) KYC Download Adhar/Bank/Pan"], ["form9", "6) FORM No. 9"],
    ["form16", "7) Form 16"], ["form11", "8) Form No.11"], ["form2", "9) Form No.2"], ["noc", "10) No Objection Certificate"],
    ["enquiry", "13) Enquiry_Police_form"]],
};
// Req_validation / Reg_validate_2 / validte_form_B / validte_form_D / Reg_val_dispatch
const REG2 = new Set(["id_card_client", "id_print", "gst", "pt", "generate_form5", "bank_images", "form_a", "form_13_below", "form_13_above",
  "form_14", "form_15", "form_16", "form_20", "form_21", "form_22", "form_23", "bonus_register", "leave_record", "employee_data"]);

const lbl: React.CSSProperties = { fontWeight: 700, display: "block", fontSize: 12 };

export default function MonthWiseReports() {
  const [level, setLevel] = useState(0);
  const [month, setMonth] = useState("");
  const [clients, setClients] = useState<{ client_name: string; client_code: string }[]>([]);
  const [client, setClient] = useState("Select");
  const [states, setStates] = useState<string[]>([]);
  const [state, setState] = useState("ALL");
  const [units, setUnits] = useState<{ unit_name: string; unit_code: string }[]>([]);
  const [unit, setUnit] = useState("ALL");
  const [designs, setDesigns] = useState<{ grade_desc: string; grade_code: string }[]>([]);
  const [design, setDesign] = useState("ALL");
  const [tab, setTab] = useState("acts");
  const [act, setAct] = useState(ACTS[0]);
  const [res, setRes] = useState<Result | null>(null);
  const [resKey, setResKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [printDate, setPrintDate] = useState("");
  const [lot, setLot] = useState("1");
  const [form5Count, setForm5Count] = useState(0);
  const [form5Rows, setForm5Rows] = useState<any[]>([]);
  const [showForm5, setShowForm5] = useState(false);
  const [docDesc, setDocDesc] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [files, setFiles] = useState<any[]>([]);

  const clientText = useMemo(() => clients.find((c) => c.client_code === client)?.client_name ?? client, [clients, client]);
  const designText = useMemo(() => (design === "ALL" ? "ALL" : designs.find((d) => d.grade_code === design)?.grade_desc ?? design), [designs, design]);

  useEffect(() => {
    apiGet<any>(`${BASE}/access/`).then((a) => setLevel(a.level)).catch(() => setLevel(0));
    apiGet<any>(`${BASE}/clients/`).then((d) => setClients(d.results || [])).catch(() => setClients([]));
    apiGet<any>(`${BASE}/designations/`).then((d) => setDesigns(d.results || [])).catch(() => setDesigns([]));
    apiGet<any>(`${BASE}/form5-list/`).then((d) => { setForm5Count(d.count || 0); setForm5Rows(d.results || []); }).catch(() => undefined);
  }, []);

  const q = (extra: Record<string, string> = {}) => {
    const p = new URLSearchParams({ month, client, state, unit, designation: design, client_text: clientText, designation_text: designText,
      act, print_date: printDate, lot, ...extra });
    return p.toString();
  };

  const onClient = async (c: string) => {
    setClient(c); setState("ALL"); setUnit("ALL"); setDesign("ALL"); setStates([]); setUnits([]); setRes(null); setFiles([]);
    if (c === "Select") { apiGet<any>(`${BASE}/designations/`).then((d) => setDesigns(d.results || [])).catch(() => undefined); return; }
    const m = encodeURIComponent(month);
    apiGet<any>(`${BASE}/states/?client=${encodeURIComponent(c)}&month=${m}`).then((d) => setStates(d.results || [])).catch(() => setStates([]));
    apiGet<any>(`${BASE}/units/?client=${encodeURIComponent(c)}&month=${m}`).then((d) => setUnits(d.results || [])).catch(() => setUnits([]));
    apiGet<any>(`${BASE}/designations/?client=${encodeURIComponent(c)}&state=ALL`).then((d) => setDesigns(d.results || [])).catch(() => undefined);
  };
  const onState = (s: string) => {
    setState(s); setUnit("ALL");
    apiGet<any>(`${BASE}/units/?client=${encodeURIComponent(client)}&state=${encodeURIComponent(s)}&month=${encodeURIComponent(month)}`)
      .then((d) => setUnits(d.results || [])).catch(() => setUnits([]));
    apiGet<any>(`${BASE}/designations/?client=${encodeURIComponent(client)}&state=${encodeURIComponent(s)}`)
      .then((d) => { setDesigns(d.results || []); setDesign("ALL"); }).catch(() => undefined);
  };
  const onUnit = (u: string) => {
    setUnit(u);
    apiGet<any>(`${BASE}/designations/?client=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}&unit=${encodeURIComponent(u)}`)
      .then((d) => { setDesigns(d.results || []); setDesign("ALL"); }).catch(() => undefined);
  };

  // legacy client-side validators (alert + stop)
  const validate = (key: string): boolean => {
    const fail = (t: string) => { window.alert(t); return false; };
    if (key === "form_d") {
      if (client === "Select") return fail("Please Select Client Name ");
      if (!state || state === "Select") return fail("Please Select State");
      return true;
    }
    if (key === "dispatch_list") {
      if (client === "Select") return fail("Please Select Client Name ");
      if (!printDate) return fail("Please Select Date.");
      if (!lot) return fail("Please Enter Lot Number.");
      return true;
    }
    if (key === "sales_register") return true;
    // legacy btnformno10_Click / btnformno5_Click: the period (to date) is tested first
    if (key === "form10" || key === "form5") {
      if (!month) return fail("Please enter from date and  to date period for this report ");
      if (client === "Select") return fail("Please Select Client Name ");
      return true;
    }
    if (key === "form_b") {
      if (client === "Select") return fail("Please Select Client Name ");
      if (!month) return fail("Please Select Month / Year.");
      return true;
    }
    if (REG2.has(key) || key === "id_card_client" || key === "id_print") {
      if (client === "Select") return fail("Please Select Client Name ");
      if (!month) return fail("Please Select to Month / Year.");
      return true;
    }
    if (client === "Select") return fail("Please Select Client Name ");
    if (!month) return fail("Please Select Month / Year.");
    return true;
  };

  const run = async (key: string, label?: string) => {
    if (!validate(key)) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch(`${API_BASE_URL}${BASE}/run/?report=${key}&${q()}${PDF_KEYS.has(key) ? "&pdf=1" : ""}`, { credentials: "include" });
      if (!r.ok) { window.alert(await errMsg(r)); return; }
      if ((r.headers.get("content-type") || "").includes("application/pdf")) {
        // legacy Crystal Reports PDF layout (opens inline like the legacy ExportToHttpResponse)
        const url = URL.createObjectURL(await r.blob());
        window.open(url, "_blank");
        setMsg(`${label || key} PDF generated`);
        return;
      }
      const d: Result = await r.json();
      if (d.kind === "xls") {
        if (!d.count && d.message) { window.alert(d.message); setMsg(d.message); return; }
        downloadXls(d.filename, d.html || ""); setMsg(`${d.filename} downloaded (${d.count} record${d.count === 1 ? "" : "s"})`);
        return;
      }
      if (typeof d.csv === "string") {
        if (!d.count) { window.alert("No Matching Records Found."); return; }
        saveBlob(d.filename, new Blob([d.csv], { type: "application/text" }));
        if (key === "kyc_adhar_csv") await post(`${BASE}/kyc-confirm/`);
        setMsg(`${d.filename} downloaded (${d.count} record${d.count === 1 ? "" : "s"})`);
        return;
      }
      setRes(d); setResKey(key);
      if (!d.count && d.kind === "crystal") setMsg("No Matching Records Found.");
    } catch (e: any) {
      window.alert(e?.message || "Report failed");
    } finally { setBusy(false); }
  };

  const loadFiles = async (a: string, c: string) => {
    if (!c || c === "Select") { setFiles([]); return; }
    const d = await apiGet<any>(`${BASE}/compliance-files/?client=${encodeURIComponent(c)}&act=${encodeURIComponent(a)}`).catch(() => ({ results: [] }));
    setFiles(d.results || []);
  };
  const docs = ACT_DOCS[act] || [];
  useEffect(() => { setDocDesc(docs[0] || ""); }, [act]);  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (docs.length) loadFiles(docDesc, client); }, [docDesc, client, act]);  // eslint-disable-line react-hooks/exhaustive-deps

  const upload = async () => {
    if (client === "Select") { window.alert("Please Select Client Name "); return; }
    if (!month) { window.alert("Please Select Month / Year."); return; }
    if (!docFile) { window.alert("Please Select Document !!"); return; }
    const ext = docFile.name.slice(docFile.name.lastIndexOf(".")).toLowerCase();
    if (![".jpg", ".png", ".pdf"].includes(ext)) { window.alert("Please select only JPG, PNG and PDF Files !!!"); return; }
    const fd = new FormData(); fd.append("client", client); fd.append("act", docDesc); fd.append("file", docFile);
    const r = await post(`${BASE}/compliance-upload/`, fd);
    if (!r.ok) { window.alert(await errMsg(r)); return; }
    setDocFile(null); loadFiles(docDesc, client);
  };
  const delFile = async (id: number) => {
    const fd = new FormData(); fd.append("id", String(id));
    const r = await post(`${BASE}/compliance-delete/`, fd);
    if (!r.ok) { window.alert(await errMsg(r)); return; }
    loadFiles(docDesc, client);
  };
  const zip = async (path: string, name: string) => {
    if (!validate(path === "generate-id-card" ? "id_print" : "bank_images")) return;
    setBusy(true);
    try {
      const r = await post(`${BASE}/${path}/?${q()}`);
      if (!r.ok) { window.alert(await errMsg(r)); return; }
      saveBlob(name, await r.blob()); setMsg(`${name} downloaded`);
    } finally { setBusy(false); }
  };

  const btn = (key: string, label: string, extra?: React.CSSProperties) => (
    <button key={key} type="button" className="btn btn-primary" disabled={busy}
      style={{ margin: "3px 6px 3px 0", ...extra }} onClick={() => run(key, label)}>{label}</button>
  );

  const showUnitPanel = client !== "Select";
  const gridRes = res && res.kind !== "xls" ? res : null;
  const topPf = res && (resKey === "pf_challan_download");
  const topKyc = res && resKey === "kyc_grid";
  const topUan = res && resKey === "uan_grid";

  return (
    <div className="panel panel-primary" style={{ margin: 12 }}>
      <div className="panel-heading"><b>Month Wise Reports</b></div>
      <div className="panel-body">
        <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: 10, padding: 25, marginBottom: 20 }}>
          <div className="row">
            <div className="col-sm-1 col-xs-12">
              <label style={lbl}>Month/Year :</label>
              <input className="form-control" placeholder="MM/YYYY" maxLength={7} value={month} onChange={(e) => setMonth(e.target.value)} />
            </div>
            <div className="col-sm-2 col-xs-12">
              <label style={lbl}>Client Name:</label>
              <select className="form-control" value={client} onChange={(e) => onClient(e.target.value)}>
                <option value="Select">Select</option>
                {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
              </select>
            </div>
            {showUnitPanel && (<>
              <div className="col-sm-2 col-xs-12">
                <label style={lbl}>Select State :</label>
                <select className="form-control" value={state} onChange={(e) => onState(e.target.value)}>
                  <option value="ALL">ALL</option>
                  {states.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-sm-2 col-xs-12">
                <label style={lbl}>Branch Name :</label>
                <select className="form-control" value={unit} onChange={(e) => onUnit(e.target.value)}>
                  <option value="ALL">ALL</option>
                  {units.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
                </select>
              </div>
              <div className="col-sm-2 col-xs-12">
                <label style={lbl}>Select Designation :</label>
                <select className="form-control" value={design} onChange={(e) => setDesign(e.target.value)}>
                  <option value="ALL">ALL</option>
                  {designs.map((d) => <option key={d.grade_code} value={d.grade_code}>{d.grade_desc}</option>)}
                </select>
              </div>
            </>)}
            <div className="col-sm-3 col-xs-12 text-right" style={{ marginTop: 22 }}>
              <button type="button" className="btn btn-primary" onClick={() => { setRes(null); setMsg(""); }}>Clear</button>{" "}
              <button type="button" className="btn btn-danger" onClick={() => { window.location.href = "/"; }}>Close</button>
            </div>
          </div>
        </div>

        <div className="row text-center" style={{ marginBottom: 12 }}>
          {topPf && level >= 4 && (<>
            <button type="button" className="btn btn-primary" style={{ marginRight: 6 }} onClick={() => run("pf_challan_csv")}>PF Challan Download</button>
            <button type="button" className="btn btn-primary" style={{ marginRight: 6 }} onClick={() => res && downloadXls("PFChallanDownload", gridHtml(res))}>PF Challan Excel</button>
          </>)}
          {topKyc && level >= 4 && <button type="button" className="btn btn-primary" style={{ marginRight: 6 }} onClick={() => run("kyc_adhar_csv")}>KYC Adhar Download</button>}
          {topUan && level >= 4 && (<>
            <button type="button" className="btn btn-primary" style={{ marginRight: 6 }} onClick={() => res && downloadXls("UANDownload", gridHtml(res))}>UAN XL Download</button>
            <button type="button" className="btn btn-primary" style={{ marginRight: 6 }} onClick={() => run("uan_csv")}>UAN CSV Download</button>
          </>)}
        </div>

        {msg && <div style={{ margin: "0 0 10px", padding: "6px 12px", borderRadius: 4, fontSize: 12, color: "#2e7d32", background: "#e8f5e9", border: "1px solid #a5d6a7" }}>{msg}</div>}

        <div style={{ background: "#f3f1fe", padding: 20, borderRadius: 10 }}>
          <ul className="nav nav-tabs" style={{ display: "flex", flexWrap: "wrap", gap: 2, listStyle: "none", padding: 0, margin: 0, borderBottom: "1px solid #ddd" }}>
            {TABS.map(([k, t]) => (
              <li key={k}>
                <button type="button" onClick={() => setTab(k)}
                  style={{ border: "1px solid #ddd", borderBottom: tab === k ? "1px solid #fff" : "1px solid #ddd", background: tab === k ? "#fff" : "#eee", padding: "8px 14px", fontWeight: 700, cursor: "pointer" }}>{t}</button>
              </li>
            ))}
          </ul>
          <div style={{ background: "#fff", padding: 16, border: "1px solid #ddd", borderTop: 0 }}>
            {tab === "acts" && (
              <div>
                <div className="row">
                  <div className="col-sm-2 col-xs-12">
                    <label style={lbl}>Select Act :</label>
                    <select className="form-control" value={act} onChange={(e) => setAct(e.target.value)}>
                      {ACTS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                  <div className="col-sm-10 col-xs-12" style={{ marginTop: 24 }}>
                    {ACT_ORDER.filter((k) => (ACT_BUTTONS[act] || []).includes(k)).map((k) => btn(k, ACT_LABEL[k]))}
                  </div>
                </div>
                {docs.length > 0 && (
                  <div className="panel panel-primary" style={{ marginTop: 16 }}>
                    <div className="container-fluid" style={{ padding: 16 }}>
                      <div className="row">
                        <div className="col-sm-2 col-xs-12">
                          <label style={lbl}>Description</label>
                          <select className="form-control" value={docDesc} onChange={(e) => setDocDesc(e.target.value)}>
                            {docs.map((d) => <option key={d} value={d}>{d}</option>)}
                          </select>
                        </div>
                        <div className="col-sm-3 col-xs-12">
                          <span>File to Upload :</span>
                          <input type="file" accept=".jpg,.png,.pdf" onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
                        </div>
                        <div className="col-sm-2 col-xs-12" style={{ marginTop: 20 }}>
                          <button type="button" className="btn btn-primary" onClick={upload}>Upload</button>
                        </div>
                        <div className="col-sm-4 col-xs-12"><b style={{ color: "#f00" }}>Note :</b> Only JPG, PNG and PDF files will be uploaded.</div>
                      </div>
                      <table className="table" style={{ marginTop: 14 }}>
                        <thead><tr><th>No.</th><th>ID</th><th>Description</th><th>Download File</th><th></th></tr></thead>
                        <tbody>
                          {files.map((f, i) => (
                            <tr key={f.id}>
                              <td>{i + 1}</td><td>{f.id}</td><td>{f.description}</td>
                              <td><a href={`${API_BASE_URL}${BASE}/compliance-download/?id=${f.id}`}>Download</a></td>
                              <td><button type="button" className="btn btn-primary" onClick={() => delFile(f.id)}>Delete</button></td>
                            </tr>
                          ))}
                          {files.length === 0 && <tr><td colSpan={5}>No records</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
            {TAB_REPORTS[tab] && (
              <div>
                {TAB_REPORTS[tab].map(([k, t]) => btn(k, t))}
                {tab === "other" && (<div style={{ marginTop: 10, fontSize: 11, color: "#666" }}>KYC / PF-challan / UAN downloads appear after the grid is loaded (full-access role).</div>)}
              </div>
            )}
            {tab === "idcards" && (
              <div>
                <div className="row" style={{ marginBottom: 14 }}>
                  <b>ID - Print List</b>
                  <div style={{ marginTop: 6 }}>
                    <button type="button" className="btn btn-primary" disabled={busy} style={{ marginRight: 8 }} onClick={() => zip("generate-id-card", "id_cards.zip")}>Generate ID Card</button>
                    {btn("id_card_client", "Client and Branch Wise Id Card ")}
                  </div>
                </div>
                <div className="row" style={{ marginBottom: 14 }}>
                  <b>Dispatch Address List</b>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
                    <input className="form-control" style={{ width: 160 }} placeholder="dd/mm/yyyy" value={printDate} onChange={(e) => setPrintDate(e.target.value)} />
                    {btn("dispatch_list", "Printing List")}
                  </div>
                </div>
                <div className="row" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <input className="form-control" style={{ width: 120 }} value={lot} onChange={(e) => setLot(e.target.value.replace(/\D/g, ""))} />
                  {btn("sales_register", "Sales Register")}
                  <button type="button" className="btn btn-primary" disabled={busy} onClick={() => zip("bank-images", "bank_passbook.zip")}>Bank Passbook Images</button>
                </div>
              </div>
            )}
            {tab === "gst" && btn("gst", "Get GST")}
            {tab === "lwf" && btn("pt", "Get PT")}
            {tab === "form5" && (
              <div>
                {btn("generate_form5", "Generate Form 5")}
                <a href="#" style={{ marginLeft: 20 }} onClick={(e) => { e.preventDefault(); setShowForm5(true); }}>
                  <span style={{ color: "red" }}><b>{form5Count}</b></span>Generate Form 5
                </a>
                {showForm5 && (
                  <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 50 }} onClick={() => setShowForm5(false)}>
                    <div style={{ background: "#fff", maxWidth: 700, margin: "60px auto", padding: 16, borderRadius: 6 }} onClick={(e) => e.stopPropagation()}>
                      <h4 style={{ textAlign: "center" }}>Labour Regional List </h4>
                      <table className="table">
                        <thead><tr><th>Client Name</th><th>State Name</th><th>Labour Regional Office</th></tr></thead>
                        <tbody>{form5Rows.map((r, i) => <tr key={i}><td>{r.client_code}</td><td>{r.state_name}</td><td>{r.labour_office}</td></tr>)}</tbody>
                      </table>
                      <div className="text-center"><button type="button" className="btn btn-danger" onClick={() => setShowForm5(false)}>CLOSE</button></div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {gridRes && (
          <div style={{ marginTop: 16 }}>
            {gridRes.crystal && (
              <div style={{ padding: "6px 12px", marginBottom: 8, borderRadius: 4, fontSize: 12, color: "#8a6d3b", background: "#fcf8e3", border: "1px solid #faebcc" }}>
                The original report is a Crystal Reports PDF ({gridRes.title}); the Crystal layout cannot run in this system, so the data set it prints is shown below and can be exported to Excel.
              </div>
            )}
            {!!gridRes.missing_columns?.length && (
              <div style={{ padding: "6px 12px", marginBottom: 8, borderRadius: 4, fontSize: 12, color: "#8a6d3b", background: "#fcf8e3", border: "1px solid #faebcc" }}>
                Columns not present in the current database schema are shown blank: {gridRes.missing_columns.join(", ")}.
              </div>
            )}
            <div style={{ marginBottom: 8 }}>
              <button type="button" className="btn btn-default" onClick={() => navigator.clipboard?.writeText([gridRes.columns.join("\t"), ...gridRes.rows.map((r) => r.join("\t"))].join("\n"))}>Copy</button>{" "}
              <button type="button" className="btn btn-default" onClick={() => downloadCsv(gridRes)}>CSV</button>{" "}
              <button type="button" className="btn btn-default" onClick={() => downloadXls(gridRes.filename, gridHtml(gridRes))}>Excel</button>{" "}
              <button type="button" className="btn btn-default" onClick={() => printGrid(gridRes)}>Print</button>
              <span style={{ marginLeft: 12, fontSize: 12 }}>{gridRes.count} record{gridRes.count === 1 ? "" : "s"}</span>
            </div>
            <div className="grid-view" style={{ overflow: "auto", maxHeight: 520 }}>
              <table className="table">
                <thead><tr>{gridRes.columns.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
                <tbody>
                  {gridRes.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{String(c ?? "")}</td>)}</tr>)}
                  {gridRes.rows.length === 0 && <tr><td colSpan={Math.max(1, gridRes.columns.length)}>No Matching Records Found.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
