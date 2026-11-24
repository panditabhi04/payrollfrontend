"use client";
/* =====================================================================
 * Get Reports (MD Reports) — 1:1 port of all_reports.aspx.
 * Header "Get Reports" + help (html/reports_main.html). Shared filters:
 * Select Month (mm/yy) / Client / State / Branch. 11 tabs: GST Reports |
 * Payment Paid Report | Tally Report | Payment Summary Report | MIS Report |
 * Reject Bill Report | Finance Copy | Soft Copy Send Mail Status |
 * Attendance Report | MD Approve Report | Monthwise Outstanding.
 * Exact controls, exact validation strings, exact .xls names/columns.
 * Backend: /api/reports/salary-reports/md/* (legacy billing tables).
 * ===================================================================== */
import React, { useEffect, useState } from "react";
import { getJSON } from "@/lib/api/legacy-fetch";
import { API_BASE_URL, apiGet } from "@/lib/api/client";

const BASE = "/api/reports/salary-reports/md";
const SEL = "Select";
const ALL = "ALL";

type Row = Record<string, any>;
type Opt = { v: string; t: string };

function Msg({ text, ok }: { text: string; ok: boolean }) {
  if (!text) return null;
  return (
    <div style={{ margin: "0 0 10px", padding: "6px 12px", borderRadius: 4, fontSize: 12,
      color: ok ? "#2e7d32" : "#c62828", background: ok ? "#e8f5e9" : "#ffebee",
      border: `1px solid ${ok ? "#a5d6a7" : "#ef9a9a"}` }}>{text}</div>
  );
}
function val(r: Row, name: string): any {
  if (r[name] !== undefined && r[name] !== null) return r[name];
  const want = name.toLowerCase();
  for (const k of Object.keys(r)) {
    if (k.toLowerCase() === want) return (r as Row)[k];
  }
  return "";
}
function downloadXls(d: { title?: string; filename: string; columns: string[]; rows: any[][] }) {
  const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<table border=1>${d.title ? `<tr></tr><tr><th colspan=${d.columns.length}>${esc(d.title)}</th></tr>` : ""}<tr>${d.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>` +
    d.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") + `</table>`;
  const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = d.filename;
  document.body.appendChild(a); a.click(); a.remove();
}
async function fetchXls(url: string, show: (t: string, ok?: boolean) => void) {
  try {
    const d = await apiGet<any>(url, { credentials: "include" });
    if (!d || (d.count ?? (d.rows || []).length) === 0) {
      const t = "No Matching Records Found."; window.alert(t); show(t, false); return;
    }
    downloadXls(d);
    show("Report downloaded", true);
  } catch (e: any) {
    let t = "No Matching Records Found.";
    try {
      const r = await fetch(url, { credentials: "include" });
      const b = await r.json().catch(() => ({} as any));
      t = (b as any)?.detail || (b as any)?.non_field_errors?.[0] || t;
    } catch { /* keep default */ }
    window.alert(t); show(t, false);
  }
}

/* ---- calendar choosers (single box each; API formats unchanged) ---- */
function DateBox({ value, onChange, cls }: { value: string; onChange: (ddmm: string) => void; cls?: string }) {
  const toISO = (s: string) => {
    const m = (s || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
  };
  const fromISO = (s: string) => {
    const m = (s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
  };
  return (
    <input type="date" className={`form-control ${cls ?? "date-picker1"}`} style={{ width: "100%" }}
      value={toISO(value)} onChange={(e) => onChange(fromISO(e.target.value))} title="Choose Date" />
  );
}
function MonthBox({ value, onChange, cls }: { value: string; onChange: (mmYY: string) => void; cls?: string }) {
  const toMonth = (s: string) => {
    const m = (s || "").match(/^(\d{2})\/(\d{2,4})$/);
    if (!m) return "";
    return `${m[2].length === 2 ? `20${m[2]}` : m[2]}-${m[1]}`;
  };
  return (
    <input type="month" className={`form-control ${cls ?? "date-picker12"}`} style={{ width: 150 }}
      value={toMonth(value)} onChange={(e) => {
        const m = (e.target.value || "").match(/^(\d{4})-(\d{2})$/);
        onChange(m ? `${m[2]}/${m[1].slice(2)}` : "");
      }} title="Select Month" />
  );
}
/* ---- status-aware fetch + banner (404 = restart backend, 403 = login, 500 = DB) ---- */
async function need<T>(path: string, setWarn: (s: string) => void): Promise<T | null> {
  let r: Response;
  try {
    r = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include", headers: { Accept: "application/json" }, cache: "no-store",
    });
  } catch {
    setWarn("Cannot reach the backend at all — please check that the Django server is running, then Refresh.");
    return null;
  }
  if (r.ok) {
    setWarn("");
    try { return (await r.json()) as T; } catch { return {} as T; }
  }
  let detail = "";
  try {
    const b = await r.json();
    detail = (b as any)?.detail || (b as any)?.non_field_errors?.[0] || "";
  } catch { /* HTML error */ }
  if (r.status === 404) setWarn("Data not loading (404) — please restart the backend server for /api/reports/salary-reports/md/*, then Refresh.");
  else if (r.status === 403) setWarn("Access denied (403) — your session may have expired. Please log in again and refresh.");
  else if (detail) setWarn(`Server says: ${detail}`);
  else setWarn("Failed to load data (server error) — please check the backend logs and the legacy DB connection.");
  return null;
}
function DropBanner({ errs, onRefresh }: { errs: (string | undefined)[]; onRefresh?: () => void }) {
  const list = errs.filter(Boolean) as string[];
  if (list.length === 0) return null;
  return (
    <div style={{ background: "#fff3cd", border: "1px solid #ffc107", color: "#856404", padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 12, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
      <span>{list.join(" ")}</span>
      <button type="button" className="btn btn-primary" style={{ whiteSpace: "nowrap" }}
        onClick={() => { if (onRefresh) onRefresh(); else window.location.reload(); }}>Refresh</button>
    </div>
  );
}

export interface Filters { month: string; client: string; state: string; unit: string; }

const GST_BILLS: Opt[] = [{ v: SEL, t: SEL }, { v: ALL, t: ALL },
  { v: "1", t: "MAN POWER BILLING" }, { v: "2", t: "CONVEYANCE BILLING" },
  { v: "3", t: "DRIVER CONVEYANCE BILLING" }, { v: "4", t: "MATERIAL BILLING" },
  { v: "5", t: "DEEP CLEANING BILLING" }, { v: "6", t: "MACHINE RENTAL BILLING" },
  { v: "7", t: "ARREARS MANPOAWER BILLING" }, { v: "8", t: "MANUAL BILLING" },
  { v: "9", t: "R&M BILLING" }, { v: "10", t: "ADMINISTRATIVE BILLING" },
  { v: "11", t: "SHIFTWISE BILLING" }];
const REJ_BILLS: Opt[] = [{ v: SEL, t: SEL }, { v: ALL, t: ALL },
  { v: "1", t: "MAN POWER BILLING" }, { v: "2", t: "CONVEYANCE BILLING" },
  { v: "3", t: "DRIVER CONVEYANCE BILLING" }, { v: "4", t: "MATERIAL BILLING" },
  { v: "5", t: "DEEP CLEANING BILLING" }, { v: "6", t: "MACHINE RENTAL BILLING" },
  { v: "7", t: "ARREARS MANPOAWsER BILLING" }, { v: "8", t: "MANUAL BILLING" },
  { v: "9", t: "R&M BILLING" }, { v: "10", t: "ADMINISTRATIVE BILLING" },
  { v: "11", t: "SHIFTWISE BILLING" }];
const PAY_TYPES: Opt[] = [{ v: SEL, t: SEL }, { v: "1", t: "MAN POWER PAYMENT" },
  { v: "2", t: "CONVEYANCE PAYMENT" }, { v: "3", t: "DRIVER CONVEYANCE PAYMENT" },
  { v: "4", t: "MATERIAL PAYMENT" }, { v: "5", t: "ARREARS MANPOAWER PAYMENT" },
  { v: "6", t: "R&M PAYMENT" }, { v: "7", t: "ADMINISTRATIVE PAYMENT" },
  { v: "8", t: "SHIFTWISE PAYMENT" }, { v: "9", t: "VENDOR PAYMENT" }, { v: "10", t: "OT PAYMENT" }];

/* ================= TAB 1: GST ================= */
function TabGST({ f, show }: { f: Filters; show: (t: string, ok?: boolean) => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [btype, setBtype] = useState(SEL);
  const go = (sac: boolean) => {
    if (!from) { window.alert("Please Select From Month"); return; } // valid_gst()
    if (!to) { window.alert("Please Select To Month"); return; }
    if (!btype || btype === SEL) { window.alert("Please Select Bill Type "); return; }
    fetchXls(`${BASE}/gst/?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&bill_type=${btype}&client_code=${encodeURIComponent(f.client)}&state=${encodeURIComponent(f.state)}${sac ? "&sac=1" : ""}`, show);
  };
  return (
    <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="col-sm-2 col-xs-12"><b>From Date :</b>
        <DateBox value={from} onChange={setFrom} /></div>
      <div className="col-sm-2 col-xs-12"><b>To Date :</b>
        <DateBox value={to} onChange={setTo} cls="date-picker2" /></div>
      <div className="col-sm-3 col-xs-12"><b>Select Bill Type</b>
        <select className="form-control" value={btype} onChange={(e) => setBtype(e.target.value)}>
          {GST_BILLS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select></div>
      <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn" onClick={() => go(false)}>GST Report</button></div>
      <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn" style={{ width: "100%" }} onClick={() => go(true)}>SAC Wise GST Report</button></div>
    </div>
  );
}

/* ================= TAB 2: Paid ================= */
function TabPaid({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [party, setParty] = useState(SEL);
  const [code, setCode] = useState(SEL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [opts, setOpts] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [warn, setWarn] = useState("");
  useEffect(() => {
    (async () => {
      if (!party || party === SEL) { setOpts([{ v: SEL, t: SEL }]); setWarn(""); return; }
      const d = await need<{ results: Row[] }>(`${BASE}/party-list/?party=${party}`, setWarn);
      if (!d) return;
      const list = ((d?.results ?? []) as Row[]);
      setOpts([{ v: SEL, t: SEL }, { v: ALL, t: ALL },
        ...list.map((x) => ({ v: String(val(x, "code")), t: String(val(x, "name")) }))]);
    })();
  }, [party]);
  const go = () => {
    if (!party || party === SEL) { window.alert("Please Select Type"); return; }
    if (!code || code === SEL) { window.alert("Please Select Client Type"); return; }
    if (!from) { window.alert("Please Select From Date"); return; }
    if (!to) { window.alert("Please Select To Date"); return; }
    fetchXls(`${BASE}/paid/?party=${party}&code=${encodeURIComponent(code)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, show);
  };
  return (
    <div>
      <DropBanner errs={[warn]} />
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="col-sm-2 col-xs-12"><b>Party Type :</b>
        <select className="form-control" value={party} onChange={(e) => { setParty(e.target.value); setCode(SEL); }}>
          <option value={SEL}>{SEL}</option><option value="1">Client</option><option value="2">Vendor</option>
        </select></div>
      <div className="col-sm-3 col-xs-12"><b>Select Client/Vendor :</b>
        <select className="form-control" value={code} onChange={(e) => setCode(e.target.value)}>
          {opts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select></div>
      <div className="col-sm-2 col-xs-12"><b>Payment Date(From):</b>
        <DateBox value={from} onChange={setFrom} /></div>
      <div className="col-sm-2 col-xs-12"><b>Payment Date(To) :</b>
        <DateBox value={to} onChange={setTo} cls="date-picker2" /></div>
      <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn" onClick={go}>Report</button></div>
    </div>
    </div>
  );
}

/* ================= TAB 3: Tally ================= */
function TabTally({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [party, setParty] = useState(SEL);
  const [code, setCode] = useState(SEL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [opts, setOpts] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [warn, setWarn] = useState("");
  useEffect(() => {
    (async () => {
      if (!party || party === SEL || party === "3") { setOpts([{ v: SEL, t: SEL }, { v: ALL, t: ALL }]); setWarn(""); return; }
      const d = await need<{ results: Row[] }>(`${BASE}/party-list/?party=${party}`, setWarn);
      if (!d) return;
      const list = ((d?.results ?? []) as Row[]);
      setOpts([{ v: SEL, t: SEL }, { v: ALL, t: ALL },
        ...list.map((x) => ({ v: String(val(x, "code")), t: String(val(x, "name")) }))]);
    })();
  }, [party]);
  const go = () => {
    if (!party || party === SEL) { window.alert("Please Select Type"); return; }
    if (!code || code === SEL) { window.alert("Please Select Client Type"); return; }
    if (!from) { window.alert("Please Select From Date"); return; }
    if (!to) { window.alert("Please Select To Date"); return; }
    fetchXls(`${BASE}/tally/?party=${party}&code=${encodeURIComponent(code)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, show);
  };
  return (
    <div>
      <DropBanner errs={[warn]} />
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="col-sm-2 col-xs-12"><b>Party Type :</b>
        <select className="form-control" value={party} onChange={(e) => { setParty(e.target.value); setCode(SEL); }}>
          <option value={SEL}>{SEL}</option><option value="1">Client</option>
          <option value="2">Vendor</option><option value="3">R&M</option>
        </select></div>
      <div className="col-sm-3 col-xs-12"><b>Select Client/Vendor :</b>
        <select className="form-control" value={code} onChange={(e) => setCode(e.target.value)}>
          {opts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select></div>
      <div className="col-sm-2 col-xs-12"><b>From Booking Date:</b>
        <DateBox value={from} onChange={setFrom} /></div>
      <div className="col-sm-2 col-xs-12"><b>To Booking Date:</b>
        <DateBox value={to} onChange={setTo} cls="date-picker2" /></div>
      <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn" onClick={go}>Get Report</button></div>
    </div>
    </div>
  );
}

/* ================= TAB 4: Payment Summary ================= */
function TabSummary({ f, show }: { f: Filters; show: (t: string, ok?: boolean) => void }) {
  const [rtype, setRtype] = useState(SEL);
  const [ptype, setPtype] = useState(SEL);
  const [client, setClient] = useState(SEL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [clients, setClients] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [warn, setWarn] = useState("");
  useEffect(() => {
    (async () => {
      const d = await need<{ results: Row[] }>(`${BASE}/clients/`, setWarn);
      if (!d) return;
      const list = ((d?.results ?? []) as Row[]);
      setClients([{ v: SEL, t: SEL }, { v: ALL, t: ALL },
        ...list.map((c) => ({ v: String(val(c, "client_code")), t: String(val(c, "client_name")) }))]);
    })();
  }, []);
  const go = () => {
    // summary_payment_val()
    if (!rtype || rtype === SEL) { window.alert("Please Select Report Type"); return; }
    if (!ptype || ptype === SEL) { window.alert("Please Select Payment Type"); return; }
    if (!ptype || ptype === SEL) { window.alert("Please Select Payment Type"); return; }
    const pname = PAY_TYPES.find((p) => p.v === ptype)?.t ?? "";
    if (pname !== "VENDOR PAYMENT" && (!client || client === SEL)) { window.alert("Please Select Client Name"); return; }
    if (!from) { window.alert("Please Select From Month"); return; }
    if (!to) { window.alert("Please Select To Year"); return; }
    fetchXls(`${BASE}/summary/?report_type=${rtype === "Invoicewise payment" ? "1" : "2"}&pay_type=${ptype}&client_code=${encodeURIComponent(client)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, show);
  };
  return (
    <div>
      <DropBanner errs={[warn]} />
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="col-sm-2 col-xs-12"><b>Report Type :</b>
        <select className="form-control" value={rtype} onChange={(e) => setRtype(e.target.value)}>
          <option value={SEL}>{SEL}</option><option value="Invoicewise payment">Invoicewise payment</option>
          <option value="Employeewise payment">Employeewise payment</option>
        </select></div>
      <div className="col-sm-3 col-xs-12"><b>Select Payment Type</b>
        <select className="form-control" value={ptype} onChange={(e) => setPtype(e.target.value)}>
          {[{ v: SEL, t: SEL }, ...PAY_TYPES.slice(1)].map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select></div>
      <div className="col-sm-2 col-xs-12"><b>Select Client :</b>
        <select className="form-control" value={client} onChange={(e) => setClient(e.target.value)}>
          {clients.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select></div>
      <div className="col-sm-2 col-xs-12"><b>from Month :</b>
        <MonthBox value={from} onChange={setFrom} /></div>
      <div className="col-sm-2 col-xs-12"><b>To Month :</b>
        <MonthBox value={to} onChange={setTo} /></div>
      <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn" onClick={go}>Get Report</button></div>
    </div>
    </div>
  );
}

/* ================= TAB 5: MIS ================= */
function TabMIS({ f, show }: { f: Filters; show: (t: string, ok?: boolean) => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const go = () => {
    fetchXls(`${BASE}/mis/?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&client_code=${encodeURIComponent(f.client)}`, show);
  };
  return (
    <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="col-sm-2 col-xs-12"><b>from Month :</b>
        <MonthBox value={from} onChange={setFrom} /></div>
      <div className="col-sm-2 col-xs-12"><b>To Month :</b>
        <MonthBox value={to} onChange={setTo} /></div>
      <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn" onClick={go}>Get Report</button></div>
    </div>
  );
}

/* ================= TAB 6: Reject Bill ================= */
function TabReject({ f, show }: { f: Filters; show: (t: string, ok?: boolean) => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [btype, setBtype] = useState(SEL);
  const go = () => {
    fetchXls(`${BASE}/reject-bill/?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&bill_type=${btype}&client_code=${encodeURIComponent(f.client)}&state=${encodeURIComponent(f.state)}&unit_code=${encodeURIComponent(f.unit)}`, show);
  };
  return (
    <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="col-sm-2 col-xs-12"><b>from Month :</b>
        <MonthBox value={from} onChange={setFrom} /></div>
      <div className="col-sm-2 col-xs-12"><b>To Month :</b>
        <MonthBox value={to} onChange={setTo} /></div>
      <div className="col-sm-3 col-xs-12"><b>Select Bill Type</b>
        <select className="form-control" value={btype} onChange={(e) => setBtype(e.target.value)}>
          {REJ_BILLS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select></div>
      <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn" onClick={go}>Report</button></div>
    </div>
  );
}

/* ================= TAB 7: Finance Copy ================= */
function TabFinance({ f, show }: { f: Filters; show: (t: string, ok?: boolean) => void }) {
  const [btype, setBtype] = useState(SEL);
  const [conv, setConv] = useState("1");
  const [opts, setOpts] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [warn, setWarn] = useState("");
  useEffect(() => {
    (async () => {
      if (!f.client || f.client === SEL) { setOpts([{ v: SEL, t: SEL }]); setWarn(""); return; }
      const d = await need<{ results: Row[] }>(
        `${BASE}/finance-bills/?client_code=${encodeURIComponent(f.client)}`, setWarn);
      if (!d) return;
      const list = ((d?.results ?? []) as Row[]);
      setOpts([{ v: SEL, t: SEL }, ...list.map((x) => ({ v: String(val(x, "id") ?? val(x, "billing_id")), t: String(val(x, "name") ?? val(x, "billing_name")) }))]);
    })();
  }, [f.client]);
  const go = () => {
    fetchXls(`${BASE}/finance-copy/?month=${encodeURIComponent(f.month)}&client_code=${encodeURIComponent(f.client)}&bill=${btype}&conv=${conv}&state=${encodeURIComponent(f.state)}&unit_code=${encodeURIComponent(f.unit)}`, show);
  };
  return (
    <div>
      <DropBanner errs={[warn]} />
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="col-sm-3 col-xs-12"><b>Select Bill Type</b>
        <select className="form-control" value={btype} onChange={(e) => setBtype(e.target.value)}>
          {opts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select></div>
      {btype === "3" && (
        <div className="col-sm-3 col-xs-12" id="conveyance_type"><b>Conveyance Billing : <span className="text-red">*</span></b>
          <select className="form-control" value={conv} onChange={(e) => setConv(e.target.value)}>
            <option value="1">Employee Conveyance Billing</option>
            <option value="2">Driver Convenyance Billing</option>
          </select></div>
      )}
      <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn" onClick={go}>Report</button></div>
    </div>
    </div>
  );
}

/* ================= TAB 8: Softcopy ================= */
function TabSoftcopy({ f, show }: { f: Filters; show: (t: string, ok?: boolean) => void }) {
  const go = () => {
    fetchXls(`${BASE}/softcopy/?month=${encodeURIComponent(f.month)}&client_code=${encodeURIComponent(f.client)}&state=${encodeURIComponent(f.state)}&unit_code=${encodeURIComponent(f.unit)}`, show);
  };
  return (
    <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn" onClick={go}>Report</button></div>
    </div>
  );
}

/* ================= TAB 9: Attendance ================= */
function TabAttendance({ f, show }: { f: Filters; show: (t: string, ok?: boolean) => void }) {
  const [rows, setRows] = useState<any[][]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [srows, setSrows] = useState<any[][]>([]);
  const [scols, setScols] = useState<string[]>([]);
  const [sclient, setSclient] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  void show;
  const go = async () => {
    if (f.month.length < 5) { window.alert("Please Select  Month"); return; } // validate()
    const d = await getJSON<any>(`${BASE}/attendance/?month=${encodeURIComponent(f.month)}&client_code=${encodeURIComponent(f.client)}`);
    if (d) { setCols(d.columns ?? []); setRows(d.rows ?? []); setCodes(d.client_codes ?? []); }
  };
  const viewState = async (clientCode: string) => {
    const d = await getJSON<any>(`${BASE}/attendance-state/?month=${encodeURIComponent(f.month)}&client_code=${encodeURIComponent(clientCode)}`);
    if (d) { setScols(d.columns ?? []); setSrows(d.rows ?? []); setSclient(clientCode); }
  };
  const grid = (id: string, c: string[], r: any[][], view?: (rowIndex: number) => void) => (
    <div style={{ overflowX: "auto", marginTop: 8 }}>
      <div className="dt-btns" style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        {(["csv", "print", "copyHtml5", "colvis"] as string[]).map((b) => (
          <button key={b} type="button" className="dt-exp" onClick={() => {
            if (b === "print") window.print();
            else if (b === "copyHtml5") navigator.clipboard?.writeText([c.join("\t"), ...r.map((x) => x.join("\t"))].join("\n")).catch(() => undefined);
            else if (b === "csv") {
              const q = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
              const blob = new Blob(["\ufeff" + c.map(q).join(",") + "\r\n" + r.map((x) => x.map(q).join(",")).join("\r\n")], { type: "text/csv" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob); a.download = `${id}.csv`;
              document.body.appendChild(a); a.click(); a.remove();
            }
          }}>{b}</button>
        ))}
      </div>
      <table id={id} className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
        <thead><tr>{c.map((x) => <th key={x}>{x}</th>)}{view ? <th>View</th> : null}</tr></thead>
        <tbody>
          {r.map((x, i) => (
            <tr key={i}>{x.map((v: any, j: number) => <td key={j}>{v}</td>)}
              {view ? <td><button type="button" className="it-btn" onClick={() => view(i)}>View</button></td> : null}</tr>
          ))}
          {r.length === 0 && <tr><td colSpan={(c.length || 1) + (view ? 1 : 0)} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
        </tbody>
      </table>
    </div>
  );
  return (
    <div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="col-sm-2 col-xs-12" style={{ width: "auto" }}>
          <button type="button" className="it-btn" onClick={go}>Attendance Report</button></div>
      </div>
      {grid("gv_attendance", cols, rows, (i) => viewState(codes[i] ?? String(rows[i]?.[1] ?? "")))}
      {sclient && grid("gv_state_attendance", scols, srows)}
    </div>
  );
}

/* ================= TAB 10: MD Approve ================= */
function TabMD({ f, show }: { f: Filters; show: (t: string, ok?: boolean) => void }) {
  const [sel, setSel] = useState("1");
  const [atyp, setAtyp] = useState("1");
  const [myear, setMyear] = useState("");
  const [rows, setRows] = useState<any[][]>([]);
  const [cols, setCols] = useState<string[]>([]);
  void show;
  const go = async () => {
    const d = await getJSON<any>(`${BASE}/md-approve/?sel=${sel}&approved=${atyp}&month=${encodeURIComponent(myear)}&client_code=${encodeURIComponent(f.client)}`);
    if (d) {
      setCols(d.columns ?? []); setRows(d.rows ?? []);
      if ((d.count ?? (d.rows || []).length) === 0) window.alert("No Matching Records Found.");
    }
  };
  return (
    <div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="col-sm-2 col-xs-12"><b>Select :</b>
          <select className="form-control" value={sel} onChange={(e) => setSel(e.target.value)}>
            <option value="1">ALL</option><option value="2">Month Wise</option><option value="3">Year Wise</option>
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Select Type :</b>
          <select className="form-control" value={atyp} onChange={(e) => setAtyp(e.target.value)}>
            <option value="1">ALL</option><option value="2">Approved</option><option value="3">Not Approved</option>
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Select Month :</b>
          <MonthBox value={myear} onChange={setMyear} /></div>
        <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn" onClick={go}>Report</button></div>
      </div>
      {cols.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table id="gv_Md_Approve" className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
            <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>{r.map((v: any, j: number) => <td key={j}>{v}</td>)}</tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={cols.length} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================= TAB 11: Monthwise Outstanding ================= */
function TabOut({ f, show }: { f: Filters; show: (t: string, ok?: boolean) => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [rows, setRows] = useState<any[][]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const go = async () => {
    // Legacy outstanding_required() guards before postback (all_reports.aspx.cs:426-442).
    if (!from) { window.alert("Please Select From Date"); return; }
    if (!to) { window.alert("Please Select To Date"); return; }
    try {
      const d = await apiGet<any>(
        `${BASE}/outstanding/?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&client_code=${encodeURIComponent(f.client)}`, { credentials: "include" });
      if (!d || (d.count ?? (d.rows || []).length) === 0) {
        const t = "No Matching Records Found."; window.alert(t); show(t, false); return;
      }
      setCols(d.columns ?? []); setRows(d.rows ?? []);
      const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
      const html = `<table border=1><tr>${d.columns.map((c: string) => `<th>${esc(c)}</th>`).join("")}</tr>` +
        d.rows.map((r: any[]) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") + `</table>`;
      const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = d.filename;
      document.body.appendChild(a); a.click(); a.remove();
      show("Report downloaded", true);
    } catch (e: any) {
      let t = "No Matching Records Found.";
      try {
        const r = await fetch(`${BASE}/outstanding/?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, { credentials: "include" });
        const b = await r.json().catch(() => ({} as any));
        t = (b as any)?.detail || (b as any)?.non_field_errors?.[0] || t;
      } catch { /* keep */ }
      window.alert(t); show(t, false);
    }
  };
  return (
    <div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="col-sm-2 col-xs-12"><b>From Month :*</b>
          <MonthBox value={from} onChange={setFrom} /></div>
        <div className="col-sm-2 col-xs-12"><b>To Month :*</b>
          <MonthBox value={to} onChange={setTo} /></div>
        <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn" onClick={go}>Report</button></div>
      </div>
      {cols.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
            <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>{r.map((v: any, j: number) => <td key={j}>{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================= shell ================= */
const TABS = [
  { key: "menu1", label: "GST Reports" }, { key: "menu2", label: "Payment Paid Report" },
  { key: "menu3", label: "Tally Report" }, { key: "menu4", label: "Payment Summary Report" },
  { key: "menu5", label: "MIS Report" }, { key: "menu6", label: "Reject Bill Report" },
  { key: "menu7", label: "Finance Copy" }, { key: "menu8", label: "Soft Copy Send Mail Status" },
  { key: "menu9", label: "Attendance Report" }, { key: "menu10", label: "MD Approve Report" },
  { key: "menu11", label: "Monthwise Outstanding" },
];

export default function MdReports() {
  const [clients, setClients] = useState<Opt[]>([{ v: SEL, t: SEL }, { v: ALL, t: ALL }]);
  const [states, setStates] = useState<Opt[]>([{ v: SEL, t: SEL }, { v: ALL, t: ALL }]);
  const [branches, setBranches] = useState<Opt[]>([{ v: SEL, t: SEL }, { v: ALL, t: ALL }]);
  const [f, setF] = useState<Filters>({ month: "", client: ALL, state: ALL, unit: ALL });
  const [hidtab, setHidtab] = useState("menu1");
  const [msg, setMsg] = useState({ text: "", ok: true });
  const [warn, setWarn] = useState("");
  const show = (text: string, ok = true) => setMsg({ text, ok });
  const set = (k: keyof Filters, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    (async () => {
      const d = await need<{ results: Row[] }>(`${BASE}/clients/`, setWarn);
      if (!d) return;
      const list = ((d?.results ?? []) as Row[]);
      setClients([{ v: SEL, t: SEL }, { v: ALL, t: ALL },
        ...list.map((c) => ({ v: String(val(c, "client_code")), t: String(val(c, "client_name")) }))]);
    })();
  }, []);
  useEffect(() => {
    (async () => {
      if (!f.client || f.client === SEL || f.client === ALL) {
        setStates([{ v: SEL, t: SEL }, { v: ALL, t: ALL }]); return;
      }
      const d = await need<{ results: Row[] }>(
        `${BASE}/states/?client_code=${encodeURIComponent(f.client)}`, setWarn);
      if (!d) return;
      const list = ((d?.results ?? []) as Row[]);
      setStates([{ v: SEL, t: SEL }, { v: ALL, t: ALL },
        ...list.map((s) => ({ v: String(val(s, "state")), t: String(val(s, "state")) }))]);
    })();
  }, [f.client]);
  useEffect(() => {
    (async () => {
      if (!f.client || f.client === SEL || f.client === ALL) {
        setBranches([{ v: SEL, t: SEL }, { v: ALL, t: ALL }]); return;
      }
      const d = await need<{ results: Row[] }>(
        `${BASE}/branches/?client_code=${encodeURIComponent(f.client)}&state=${encodeURIComponent(f.state)}`,
        setWarn);
      if (!d) return;
      const list = ((d?.results ?? []) as Row[]);
      setBranches([{ v: SEL, t: SEL }, { v: ALL, t: ALL },
        ...list.map((b) => ({ v: String(val(b, "unit_code")), t: String(val(b, "unit_name")) }))]);
    })();
  }, [f.client, f.state]);

  const openHelp = () => {
    window.open("html/reports_main.html", "popUpWindow",
      "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No");
  };
  return (
    <div className="container-fluid itmaster">
      <div className="lg-panel" style={{ marginBottom: 0 }}>
        <div className="lg-panel-head">
          <div className="row">
            <div className="col-sm-10">
              <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase"><b>Get Reports</b></div>
            </div>
            <div className="col-sm-2 text-right">
              <button type="button" onClick={openHelp} style={{ background: "transparent", border: "none", cursor: "pointer" }} title="Help">
                <img src="/Images/help_ico.png" width={20} height={20} alt="Help" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="container-fluid">
        <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
          <div className="col-sm-2 col-xs-12"><b>Select Month :</b>
            <MonthBox value={f.month} onChange={(v) => set("month", v)} /></div>
          <div className="col-sm-2 col-xs-12"><b>Client Name :</b>
            <select className="form-control" value={f.client} onChange={(e) => { set("client", e.target.value); set("state", ALL); set("unit", ALL); }}>
              {clients.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select></div>
          <div className="col-sm-2 col-xs-12"><b>State Name :</b>
            <select className="form-control" value={f.state} onChange={(e) => { set("state", e.target.value); set("unit", ALL); }}>
              {states.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select></div>
          <div className="col-sm-2 col-xs-12"><b>Branch Name :</b>
            <select className="form-control" value={f.unit} onChange={(e) => set("unit", e.target.value)}>
              {branches.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select></div>
        </div>
        <br />
        <Msg text={msg.text} ok={msg.ok} />
        <DropBanner errs={[warn]} />
        <div id="tabs" className="itmaster-tabs">
          <input type="hidden" id="hidtab" value={hidtab} readOnly />
          <input type="hidden" id="hf_lwf" value="" readOnly />
          <ul>
            {TABS.map((t) => (
              <li key={t.key} className={hidtab === t.key ? "active" : ""}>
                <a data-toggle="tab" href={`#${t.key}`} onClick={(e) => { e.preventDefault(); setHidtab(t.key); }}>
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
          <div id={hidtab} className="itmaster-body">
            {hidtab === "menu1" && <TabGST f={f} show={show} />}
            {hidtab === "menu2" && <TabPaid show={show} />}
            {hidtab === "menu3" && <TabTally show={show} />}
            {hidtab === "menu4" && <TabSummary f={f} show={show} />}
            {hidtab === "menu5" && <TabMIS f={f} show={show} />}
            {hidtab === "menu6" && <TabReject f={f} show={show} />}
            {hidtab === "menu7" && <TabFinance f={f} show={show} />}
            {hidtab === "menu8" && <TabSoftcopy f={f} show={show} />}
            {hidtab === "menu9" && <TabAttendance f={f} show={show} />}
            {hidtab === "menu10" && <TabMD f={f} show={show} />}
            {hidtab === "menu11" && <TabOut f={f} show={show} />}
          </div>
        </div>
      </div>
    </div>
  );
}
