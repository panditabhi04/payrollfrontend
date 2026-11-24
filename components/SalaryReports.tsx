"use client";
/* =====================================================================
 * EMPLOYEE SALARY — 1:1 port of reports_main.aspx (NOT the monthly
 * compliance screen). 11 tabs: Employee | Allowance | Payment
 * Hold/Unhold | Loan | Reports | GST Reports | Accounting |
 * Monthly Paid Amount | Tally Report | Purchase GST Report |
 * Send Outsanding Mail. Exact controls, exact validation strings, exact
 * .xls filenames/columns. Dates: month boxes mm/yy, date boxes dd/mm/yyyy.
 * Backend: /api/reports/salary-reports/* (legacy billing tables).
 * ===================================================================== */
import React, { useEffect, useState } from "react";
import { getJSON, getJSONStrict, mk, responseMessage } from "@/lib/api/legacy-fetch";
import { apiGet } from "@/lib/api/client";

const BASE = "/api/reports/salary-reports";
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
async function errText(r: Response, fallback: string) {
  const e = await r.json().catch(() => ({} as any));
  return (e as any)?.detail || (e as any)?.non_field_errors?.[0] || (Array.isArray(e) ? (e as any)[0] : fallback);
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
    const m = String(e?.message ?? "");
    let t = "Report failed. Please try again.";
    if (m.includes("400") || m.includes("500")) {
      try {
        const r = await fetch(url, { credentials: "include" });
        const b = await r.json().catch(() => ({} as any));
        t = (b as any)?.detail || (b as any)?.non_field_errors?.[0] || t;
      } catch { /* keep default */ }
    }
    window.alert(t); show(t, false);
  }
}

const EMP_TYPES: Opt[] = [{ v: ALL, t: ALL }, { v: "Permanent", t: "Permanent" },
  { v: "Reliever", t: "Reliever" }, { v: "Staff", t: "Staff" },
  { v: "Temporary", t: "Temporary" }, { v: "Left", t: "Left" }];
const REPORT_TYPES = ["PF XL", "LWF XL", "PT XL", "ESIC XL", "GST XL", "Branch Head Contact Details",
  "Salary Slip Sending Details", "Joining Letter Sending Details", "Monthwise Billing Details"];
const GST_BILLS: Opt[] = [{ v: SEL, t: SEL }, { v: ALL, t: ALL },
  { v: "1", t: "MAN POWER BILLING" }, { v: "2", t: "CONVEYANCE BILLING" },
  { v: "3", t: "DRIVER CONVEYANCE BILLING" }, { v: "4", t: "MATERIAL BILLING" },
  { v: "5", t: "DEEP CLEANING BILLING" }, { v: "6", t: "MACHINE RENTAL BILLING" },
  { v: "7", t: "ARREARS MANPOAWER BILLING" }, { v: "8", t: "MANUAL BILLING" },
  { v: "9", t: "R&M BILLING" }, { v: "10", t: "ADMINISTRATIVE BILLING" },
  { v: "11", t: "SHIFTWISE BILLING" }, { v: "12", t: "INCENTIVE BILLING" },
  { v: "13", t: "OFFICE RENT BILLING" }, { v: "14", t: "MANPOWER OT BILLING" }];
const ACC_TYPES: Opt[] = [{ v: SEL, t: SEL }, { v: "1", t: "Manpower" }, { v: "2", t: "Conveyance" },
  { v: "3", t: "Driver Conveyance" }, { v: "4", t: " Material" }, { v: "5", t: "Deep Clean" }];
const EMAIL_RE = /^([\w-]+(\.[\w-]+)*)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([\w-]+\.)+))([a-zA-Z]{2,4}|[0-9]{1,3})(\]?)$/;

export interface Filters { client: string; state: string; unit: string; etype: string; emp: string; month: string; }

/* ================= TAB 1: Employee ================= */
function TabEmployee({ f, show }: { f: Filters; show: (t: string, ok?: boolean) => void }) {
  const [field, setField] = useState("pf_number");
  const [diff, setDiff] = useState("0");
  const [myear, setMyear] = useState("");
  const go1 = () => {
    fetchXls(`${BASE}/emp-documents/?field=${field}&diff=${diff}`, show);
  };
  const go2 = () => {
    if (myear.length < 5) { window.alert("Please Select Date"); return; } // valid_date()
    const q = `month=${encodeURIComponent(myear)}&client_code=${encodeURIComponent(f.client)}&state=${encodeURIComponent(f.state)}&unit_code=${encodeURIComponent(f.unit)}&employee_type=${encodeURIComponent(f.etype)}&emp_code=${encodeURIComponent(f.emp)}`;
    fetchXls(`${BASE}/employee-report/?${q}`, show);
  };
  const panel: React.CSSProperties = {
    background: "#fff", border: "1px solid #7fa8c9", borderRadius: 6,
    padding: "18px 12px", marginBottom: 22, textAlign: "center",
  };
  const title: React.CSSProperties = { textAlign: "center", fontWeight: 700, textDecoration: "underline", marginBottom: 16 };
  const ctr: React.CSSProperties = { display: "flex", gap: 18, justifyContent: "center", alignItems: "center", flexWrap: "wrap" };
  return (
    <div>
      <div style={panel}>
        <div style={title}>PF/ESIC/UAN</div>
        <div style={ctr}>
          <select className="form-control" value={field} onChange={(e) => setField(e.target.value)} style={{ width: 220 }}>
            <option value="pf_number">PF</option><option value="esic_number">ESIC</option>
            <option value="pan_number">UAN</option>
          </select>
          <select className="form-control" value={diff} onChange={(e) => setDiff(e.target.value)} style={{ width: 220 }}>
            <option value="0">ALL</option><option value="1">Duplicate</option><option value="2">Blank</option>
          </select>
          <button type="button" className="it-btn" style={{ minWidth: 150 }} onClick={go1}>Get Report</button>
        </div>
      </div>
      <div style={panel}>
        <div style={title}>Employee Report</div>
        <div style={ctr}>
          <input type="text" className="form-control date-picker12" placeholder="mm/yy" maxLength={5}
            value={myear} onChange={(e) => setMyear(e.target.value)} style={{ width: 110 }} />
          <button type="button" className="it-btn" style={{ minWidth: 200 }} onClick={go2}>Get Employee Report</button>
        </div>
      </div>
    </div>
  );
}

/* ================= TAB 5: Reports ================= */
function TabReports({ f, show }: { f: Filters; show: (t: string, ok?: boolean) => void }) {
  const [rtype, setRtype] = useState(REPORT_TYPES[0]);
  const [btype, setBtype] = useState("0");
  const go = () => {
    // report_validation()
    if (["PF XL", "LWF XL", "PT XL", "GST XL", "Salary Slip Sending Details", "Monthwise Billing Details"].includes(rtype)) {
      if ((f.client === ALL || !f.client || f.client === SEL) && btype !== "1") {
        window.alert("Please Select Client Name"); return;
      }
    }
    if (!f.month) { window.alert("Please Select Month"); return; }
    if (rtype === "Monthwise Billing Details" && btype === "0") { window.alert("Please Select Billing Type"); return; }
    if (rtype === "Monthwise Billing Details" && btype === "1" && f.client !== ALL && f.client !== SEL && f.client) {
      window.alert("Please Select Client Name  ALL"); return;
    }
    if (rtype === "ESIC XL" && (f.client === ALL || !f.client || f.client === SEL)) { window.alert("Please Select Client Name"); return; }
    if (rtype === "ESIC XL" && (f.state === ALL || !f.state || f.state === SEL)) { window.alert("Please Select State Name"); return; }
    if (["Branch Head Contact Details", "Joining Letter Sending Details"].includes(rtype) &&
        (f.client === ALL || !f.client || f.client === SEL)) { window.alert("Please Select Client Name"); return; }
    const q = `type=${encodeURIComponent(rtype)}&month=${encodeURIComponent(f.month)}&client_code=${encodeURIComponent(f.client)}&state=${encodeURIComponent(f.state)}&unit_code=${encodeURIComponent(f.unit)}&bill_type=${btype}`;
    fetchXls(`${BASE}/xl-report/?${q}`, show);
  };
  return (
    <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="col-sm-3 col-xs-12"><b>Report type: <span className="text-red">*</span></b>
        <select className="form-control" value={rtype} onChange={(e) => { setRtype(e.target.value); }}
          onClick={() => undefined}>
          {REPORT_TYPES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select></div>
      {rtype === "Monthwise Billing Details" && (
        <div className="col-sm-3 col-xs-12 bill"><b>Billing type: <span className="text-red">*</span></b>
          <select className="form-control" value={btype} onChange={(e) => setBtype(e.target.value)}>
            <option value="0">Select</option><option value="1">Clientwise Bill</option>
            <option value="2">Statewise Bill</option><option value="3">Branchwise Bill</option>
          </select></div>
      )}
      <div className="col-sm-2 col-xs-12">
        <button type="button" className="it-btn" style={{ marginTop: 18 }} onClick={go}>Get Report</button></div>
    </div>
  );
}

/* ================= TAB 6: GST Reports ================= */
function TabGST({ f, show }: { f: Filters; show: (t: string, ok?: boolean) => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [btype, setBtype] = useState(SEL);
  const [einv, setEinv] = useState<Row[]>([]);
  const [esel, setEsel] = useState<Record<string, boolean>>({});
  const [egrid, setEgrid] = useState(false);
  const validGst = () => {
    if (!from) { window.alert("Please Select From Month"); return false; }
    if (!to) { window.alert("Please Select To Month"); return false; }
    if (!btype || btype === SEL) { window.alert("Please Select Bill Type "); return false; }
    return true;
  };
  const q = () => `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&bill_type=${btype}&client_code=${encodeURIComponent(f.client)}&state=${encodeURIComponent(f.state)}`;
  const check = async () => {
    let d: any;
    try { d = await getJSONStrict<any>(`${BASE}/einv-check/?${q()}`); }
    catch (e: any) { setEinv([]); setEsel({}); setEgrid(false); window.alert(e?.message || "Request failed."); return; }
    const list = ((d?.results ?? d?.rows ?? []) as Row[]);
    setEinv(list); setEsel({}); setEgrid(true);
  };
  const einvCols = ["Sr No.", "client_name", "state_name", "month", "year", "invoice_no", "invoice_date",
    "amount", "cgst", "sgst", "igst", "billing_amount", "type"];
  return (
    <div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="col-sm-2 col-xs-12"><b>From Date</b>
          <input type="text" className="form-control date-picker1" placeholder="dd/mm/yyyy" value={from}
            onChange={(e) => setFrom(e.target.value)} style={{ width: 105 }} /></div>
        <div className="col-sm-2 col-xs-12"><b>To Date</b>
          <input type="text" className="form-control date-picker2" placeholder="dd/mm/yyyy" value={to}
            onChange={(e) => setTo(e.target.value)} style={{ width: 105 }} /></div>
        <div className="col-sm-3 col-xs-12"><b>Select Bill Type</b>
          <select className="form-control" value={btype} onChange={(e) => setBtype(e.target.value)}>
            {GST_BILLS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
      </div>
      <br />
      <div id="panel7" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="it-btn" onClick={() => { if (validGst()) fetchXls(`${BASE}/gst-report/?${q()}`, show); }}>G GST Report</button>
        <button type="button" className="it-btn" onClick={() => { if (validGst()) fetchXls(`${BASE}/gst-report/?${q()}&sac=1`, show); }}>SAC Wise</button>
        <button type="button" className="it-btn" onClick={() => fetchXls(`${BASE}/rm-tally/?${q()}`, show)}>R&M Tally</button>
        <button type="button" className="it-btn" onClick={async () => {
          const r = await getJSON<any>(`${BASE}/invoice-download/`);
          void r; const t = "Invoice PDF download is generated by Crystal Reports on the application server and is not available in this build.";
          window.alert(t); show(t, false);
        }}>Invoice Download</button>
        <button type="button" className="it-btn" onClick={check}>Check For EInvoice</button>
      </div>
      <br />
      {egrid && (
        <div style={{ overflowX: "auto" }}>
          <table id="gv_check_einv" className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
            <thead><tr><th><input type="checkbox"
              checked={einv.length > 0 && einv.every((_, i) => esel[String(i)])}
              onChange={(e) => { const n: Record<string, boolean> = {}; einv.forEach((_, i) => { n[String(i)] = e.target.checked; }); setEsel(n); }} /> SELECT RECORD</th>
              {einvCols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {einv.map((r, i) => (
                <tr key={i}>
                  <td style={{ textAlign: "center" }}>
                    <input type="checkbox" checked={!!esel[String(i)]}
                      onChange={(e) => setEsel((p) => ({ ...p, [String(i)]: e.target.checked }))} />
                  </td>
                  <td>{i + 1}</td>
                  {einvCols.slice(1).map((c) => <td key={c}>{val(r, c)}</td>)}
                </tr>
              ))}
              {einv.length === 0 && <tr><td colSpan={14} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
            </tbody>
          </table>
          <button type="button" className="it-btn" onClick={async () => {
            if (!einv.some((_, i) => esel[String(i)])) { window.alert("Please select atleast one Record "); return; }
            const picked = einv.filter((_, i) => esel[String(i)]).map((r) => ({
              invoice_no: String(val(r, "invoice_no")), month: val(r, "month"), year: val(r, "year") }));
            const r = await mk(`${BASE}/einv-process/`, { invoices: picked });
            if (!r.ok) { const t = await errText(r, "E-Invoice processing failed."); window.alert(t); show(t, false); return; }
            const ok = await r.json().catch(() => ({} as any));
            const t = [`${ok?.message || "E-Invoice generated successfully."}`, (ok?.invoices || []).join(","),
              ...((ok?.failed || []) as string[])].filter(Boolean).join(String.fromCharCode(10));
            window.alert(t); show(t, true);
            check();
          }}>Process EInvoice</button>
        </div>
      )}
    </div>
  );
}

/* ================= TAB 7: Accounting ================= */
function TabAccounting({ f, show }: { f: Filters; show: (t: string, ok?: boolean) => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [typ, setTyp] = useState(SEL);
  const go = () => {
    // accouting_val()
    if (!f.client || f.client === ALL || f.client === SEL) { window.alert("Please Select Client Name"); return; }
    if (!from) { window.alert("Please Select From Date"); return; }
    if (!to) { window.alert("Please Select To Date"); return; }
    if (!typ || typ === SEL) { window.alert("Please Select Type"); return; }
    fetchXls(`${BASE}/accounting/?client_code=${encodeURIComponent(f.client)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&rtype=${typ}`, show);
  };
  return (
    <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="col-sm-2 col-xs-12"><b>From Date</b>
        <input type="text" className="form-control date-picker1" placeholder="dd/mm/yyyy" value={from}
          onChange={(e) => setFrom(e.target.value)} /></div>
      <div className="col-sm-2 col-xs-12"><b>To Date</b>
        <input type="text" className="form-control date-picker2" placeholder="dd/mm/yyyy" value={to}
          onChange={(e) => setTo(e.target.value)} /></div>
      <div className="col-sm-3 col-xs-12"><b>Select Type</b>
        <select className="form-control" value={typ} onChange={(e) => setTyp(e.target.value)}>
          {ACC_TYPES.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select></div>
      <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn" onClick={go}>Report</button></div>
    </div>
  );
}

/* ---- shared party-type block (menu8/9) ---- */
function usePartyList(party: string) {
  const [opts, setOpts] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  useEffect(() => {
    (async () => {
      if (!party || party === SEL) { setOpts([{ v: SEL, t: SEL }]); return; }
      const d = await getJSON<{ results: Row[] }>(`${BASE}/party-list/?party=${party}`);
      const list = ((d?.results ?? []) as Row[]);
      setOpts([{ v: SEL, t: SEL }, { v: ALL, t: ALL },
        ...list.map((x) => ({ v: String(val(x, "code")), t: String(val(x, "name")) }))]);
    })();
  }, [party]);
  return opts;
}

/* ================= TAB 8: Monthly Paid ================= */
function TabPaid({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [party, setParty] = useState(SEL);
  const [code, setCode] = useState(SEL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const opts = usePartyList(party);
  const go = () => {
    // monthly_paid_report_val()
    if (!party || party === SEL) { window.alert("Please Select Type"); return; }
    if (!code || code === SEL) { window.alert("Please Select Client Type"); return; }
    if (!from) { window.alert("Please Select From Date"); return; }
    if (!to) { window.alert("Please Select To Date"); return; }
    fetchXls(`${BASE}/monthly-paid/?party=${party}&code=${encodeURIComponent(code)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, show);
  };
  return (
    <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="col-sm-2 col-xs-12"><b>Party Type</b>
        <select className="form-control" value={party} onChange={(e) => { setParty(e.target.value); setCode(SEL); }}>
          <option value={SEL}>{SEL}</option><option value="1">Client</option><option value="2">Vendor</option>
        </select></div>
      <div className="col-sm-3 col-xs-12"><b>Select Type</b>
        <select className="form-control" value={code} onChange={(e) => setCode(e.target.value)}>
          {opts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select></div>
      <div className="col-sm-2 col-xs-12"><b>Payment Date(From)</b>
        <input type="text" className="form-control" placeholder="dd/mm/yyyy" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      <div className="col-sm-2 col-xs-12"><b>Payment Date(To)</b>
        <input type="text" className="form-control" placeholder="dd/mm/yyyy" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn" onClick={go}>Report</button></div>
    </div>
  );
}

/* ================= TAB 9: Tally ================= */
function TabTally({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [party, setParty] = useState(SEL);
  const [code, setCode] = useState(SEL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const opts = usePartyList(party);
  const go = () => {
    // tally_report_val()
    if (!party || party === SEL) { window.alert("Please Select Type"); return; }
    if (!code || code === SEL) { window.alert("Please Select Client Type"); return; }
    if (!from) { window.alert("Please Select From Date"); return; }
    if (!to) { window.alert("Please Select To Date"); return; }
    fetchXls(`${BASE}/tally/?party=${party}&code=${encodeURIComponent(code)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, show);
  };
  return (
    <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="col-sm-2 col-xs-12"><b>Party Type</b>
        <select className="form-control" value={party} onChange={(e) => { setParty(e.target.value); setCode(SEL); }}>
          <option value={SEL}>{SEL}</option><option value="1">Client</option><option value="2">Vendor</option>
        </select></div>
      <div className="col-sm-3 col-xs-12"><b>Select Type</b>
        <select className="form-control" value={code} onChange={(e) => setCode(e.target.value)}>
          {opts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select></div>
      <div className="col-sm-2 col-xs-12"><b>From Booking Date</b>
        <input type="text" className="form-control" placeholder="dd/mm/yyyy" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      <div className="col-sm-2 col-xs-12"><b>To Booking Date</b>
        <input type="text" className="form-control" placeholder="dd/mm/yyyy" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn" onClick={go}>Get Report</button></div>
    </div>
  );
}

/* ================= TAB 10: Purchase GST ================= */
function TabPurchase({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [vtype, setVtype] = useState(SEL);
  const [vname, setVname] = useState(SEL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [names, setNames] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  useEffect(() => {
    (async () => {
      if (!vtype || vtype === SEL) { setNames([{ v: SEL, t: SEL }]); return; }
      const d = await getJSON<{ results: Row[] }>(`${BASE}/vendor-names/?vendor_type=${vtype}`);
      const list = ((d?.results ?? []) as Row[]);
      setNames([{ v: SEL, t: SEL }, { v: ALL, t: ALL },
        ...list.map((x) => ({ v: String(val(x, "name")), t: String(val(x, "name")) }))]);
    })();
  }, [vtype]);
  const go = () => {
    fetchXls(`${BASE}/purchase/?vendor_type=${vtype}&vendor_name=${encodeURIComponent(vname)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, show);
  };
  return (
    <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
      <div className="col-sm-2 col-xs-12"><b>Vendor Type</b>
        <select className="form-control" value={vtype} onChange={(e) => { setVtype(e.target.value); setVname(SEL); }}>
          <option value={SEL}>{SEL}</option><option value="1">R & M</option><option value="2">Vendor</option>
        </select></div>
      <div className="col-sm-3 col-xs-12"><b>Vendor Name</b>
        <select className="form-control" value={vname} onChange={(e) => setVname(e.target.value)}>
          {names.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
        </select></div>
      <div className="col-sm-2 col-xs-12"><b>From Date</b>
        <input type="text" className="form-control" placeholder="dd/mm/yyyy" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      <div className="col-sm-2 col-xs-12"><b>To Date</b>
        <input type="text" className="form-control" placeholder="dd/mm/yyyy" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn" onClick={go}>Report</button></div>
    </div>
  );
}

/* ================= TAB 11: Send Outsanding Mail ================= */
function TabOutstanding({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [clients, setClients] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [client, setClient] = useState(SEL);
  const [total, setTotal] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [bound, setBound] = useState(false);
  const [emailErr, setEmailErr] = useState("");
  useEffect(() => {
    (async () => {
      const d = await getJSON<{ results: Row[] }>(`${BASE}/outstanding-clients/`);
      const list = ((d?.results ?? []) as Row[]);
      setClients([{ v: SEL, t: SEL },
        ...list.map((c) => ({ v: String(val(c, "name")), t: String(val(c, "name")) }))]);
    })();
  }, []);
  const pick = async (v: string) => {
    setClient(v); setRows([]); setBound(false);
    if (!v || v === SEL) { setTotal(""); return; }
    const t = await getJSON<{ total: string }>(`${BASE}/outstanding-total/?client_code=${encodeURIComponent(v)}`);
    setTotal(String((t as any)?.total ?? ""));
    const m = await getJSON<any>(`${BASE}/outstanding-mails/?client_code=${encodeURIComponent(v)}`);
    if (m) { setTo(String((m as any)?.to ?? "")); setCc(String((m as any)?.cc ?? "")); }
  };
  const view = async () => {
    // view_outstanding_validation()
    if (!client || client === SEL) { window.alert("Please Select Client Name"); return; }
    const d = await getJSON<any>(`${BASE}/outstanding-view/?client_code=${encodeURIComponent(client)}`);
    const list = ((d?.results ?? d?.rows ?? []) as any[][]);
    if (!d || list.length === 0) { const t = "No Matching Records Found."; window.alert(t); show(t, false); return; }
    downloadXls({ title: "", filename: d.filename || `Outstanding_${client}.xls`, columns: d.columns, rows: list });
    setRows(list); setBound(true);
    show("Report downloaded", true);
  };
  const send = async () => {
    // send_mail_validation()
    if (!client || client === SEL) { window.alert("Please Select Client Name"); return; }
    if (!to) { window.alert("Please Enter To Mail"); return; }
    if (!cc) { window.alert("Please Enter CC Mail"); return; }
    const r = await mk(`${BASE}/outstanding-send/`, { client_code: client, to_mail: to, cc_mail: cc });
    if (r.ok) { window.alert("Mail Sent Successfully...!!!"); show("Mail Sent Successfully...!!!", true); }
    else { const t = await errText(r, "Error in Sending Email...!!"); window.alert(t); show(t, false); }
  };
  const checkMail = (v: string) => {
    setTo(v);
    // ValidateEmail()
    setEmailErr(EMAIL_RE.test(v) || v === "" ? "" : "Invalid email address.");
  };
  const cols = ["SR.NO.", "INVOICE DATE", "INVOICE NO", "MONTH", "CLIENT", "STATE", "TYPE", "GST",
    "INVOICE AMT", "TDS", "RECEIVABLE", "RECV1", "RECV2", "RECV3", "TOTAL REC", "DEDUCTION",
    "BALANCE", "STATUS"];
  return (
    <div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="col-sm-3 col-xs-12"><b>Client Name</b>
          <select className="form-control" value={client} onChange={(e) => pick(e.target.value)}>
            {clients.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-3 col-xs-12"><b>Outstanding</b>
          <div style={{ color: "blue", fontSize: "x-large" }}>{total}</div></div>
        <div className="col-sm-3 col-xs-12"><b>TO MAIL ID</b>
          <textarea className="form-control" rows={2} value={to} onChange={(e) => checkMail(e.target.value)} />
          <span id="lblError" style={{ color: "red" }}>{emailErr}</span></div>
        <div className="col-sm-3 col-xs-12"><b>CC MAIL ID</b>
          <textarea className="form-control" rows={2} value={cc} onChange={(e) => setCc(e.target.value)} /></div>
        <div className="col-sm-2 col-xs-12" style={{ display: "flex", gap: 8 }}>
          <button type="button" className="it-btn" onClick={view}>Check Outstanding</button>
          <button type="button" className="it-btn" onClick={send}>Send Mail</button>
        </div>
      </div>
      <br />
      {bound && (
        <div style={{ overflowX: "auto" }}>
          <table id="gv_outstanding" className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
            <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>{r.map((c: any, j: number) => <td key={j}>{c}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================= Payment Hold/Unhold (bulk) ================= */
const HOLD_BASE = "/api/hr/employee-compliance";
function TabHold({ f, show }: { f: Filters; show: (t: string, ok?: boolean) => void }) {
  const [kind, setKind] = useState("left");
  const [rows, setRows] = useState<Row[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [remark, setRemark] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    if (kind !== "held" && f.month.length < 5) { window.alert("Please Select Month"); return; }
    setBusy(true);
    try {
      const q = new URLSearchParams({ client_code: f.client, state: f.state, unit_code: f.unit, month: f.month || "01/00", type: kind });
      const d = await getJSONStrict<{ results: Row[]; count: number }>(`${HOLD_BASE}/hold-list/?${q.toString()}`);
      setRows(d.results || []); setSel({});
      show(d.count ? `${d.count} employee(s) found.` : "No Matching Records Found.", !!d.count);
    } catch (e: any) { show(e?.message || "Request failed.", false); } finally { setBusy(false); }
  };
  const chosen = rows.filter((r) => sel[r.emp_code]).map((r) => String(r.emp_code));
  const act = async (what: "bulk-hold" | "bulk-unhold") => {
    if (!chosen.length) { window.alert("Please Select Employee"); return; }
    if (what === "bulk-hold" && !remark.trim()) { window.alert("Please Enter Remark"); return; }
    if (!window.confirm(`${what === "bulk-hold" ? "Hold" : "Unhold"} the payment of ${chosen.length} employee(s)?`)) return;
    setBusy(true);
    try {
      const res = await mk(`${HOLD_BASE}/${what}/`, { emp_codes: chosen, remark: remark.trim() });
      if (!res.ok) { show(await responseMessage(res), false); return; }
      const d = await res.json();
      show(d.status || "Done.");
      await load();
    } finally { setBusy(false); }
  };
  const allOn = rows.length > 0 && rows.every((r) => sel[r.emp_code]);
  const th: React.CSSProperties = { padding: "4px 6px", border: "1px solid #ccc", background: "#e8e6fb", fontSize: 12 };
  const td: React.CSSProperties = { padding: "3px 6px", border: "1px solid #ddd", fontSize: 12 };
  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 10 }}>
        <div><b>Show :</b>
          <select className="form-control" value={kind} onChange={(e) => { setKind(e.target.value); setRows([]); setSel({}); }} style={{ width: 210 }}>
            <option value="left">Left in the month</option>
            <option value="all">All employees of the month</option>
            <option value="held">Employees on hold</option>
          </select></div>
        <button type="button" className="it-btn" disabled={busy} onClick={load}>Show Employees</button>
        <div><b>Remark (for Hold) :</b>
          <input className="form-control" value={remark} onChange={(e) => setRemark(e.target.value)} placeholder="e.g. Left - hold till full & final" style={{ width: 280 }} /></div>
        <button type="button" className="it-btn" disabled={busy || !chosen.length} onClick={() => act("bulk-hold")}>Hold Selected ({chosen.length})</button>
        <button type="button" className="it-btn" disabled={busy || !chosen.length} onClick={() => act("bulk-unhold")}>Unhold Selected ({chosen.length})</button>
      </div>
      <div style={{ fontSize: 12, color: "#555", marginBottom: 8 }}>
        Uses the Client / State / Branch and Select Month (mm/yy) above. Employees on hold are left out of every payment
        XL (Employee XL, Left, Reliever ...) and are listed only by Get Hold Employee until they are unheld.
      </div>
      {rows.length > 0 && (
        <div style={{ overflowX: "auto", maxHeight: 520 }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr>
              <th style={th}><input type="checkbox" checked={allOn} onChange={(e) => setSel(Object.fromEntries(rows.map((r) => [r.emp_code, e.target.checked])))} /></th>
              {["Sr. No.", "Emp Code", "Employee Name", "Client", "State", "Branch", "Type", "Left Date", "Present Days", "Status", "Hold Remark", "Hold By", "Hold On"].map((h) => <th key={h} style={th}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.emp_code} style={{ background: r.status === "Hold" ? "#fff3e0" : undefined }}>
                  <td style={td}><input type="checkbox" checked={!!sel[r.emp_code]} onChange={(e) => setSel((p) => ({ ...p, [r.emp_code]: e.target.checked }))} /></td>
                  <td style={td}>{i + 1}</td><td style={td}>{r.emp_code}</td><td style={td}>{r.emp_name}</td><td style={td}>{r.client}</td>
                  <td style={td}>{r.state}</td><td style={td}>{r.unit_name}</td><td style={td}>{r.employee_type}</td><td style={td}>{r.left_date}</td>
                  <td style={td}>{r.present_days}</td><td style={{ ...td, fontWeight: 700, color: r.status === "Hold" ? "#c62828" : "#2e7d32" }}>{r.status}</td>
                  <td style={td}>{r.hold_remark}</td><td style={td}>{r.hold_by}</td><td style={td}>{r.hold_on}</td>
                </tr>
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
  { key: "menu1", label: "Employee" }, { key: "menu2", label: "Allowance" },
  { key: "menu3", label: "Payment Hold/Unhold" }, { key: "menu4", label: "Loan" },
  { key: "menu5", label: "Reports" }, { key: "menu6", label: "GST Reports" },
  { key: "menu7", label: "Accounting" }, { key: "menu8", label: "Monthly Paid Amount" },
  { key: "menu9", label: "Tally Report" }, { key: "menu10", label: "Purchase GST Report" },
  { key: "menu11", label: "Send Outsanding Mail" },
];

export default function SalaryReports() {
  const [clients, setClients] = useState<Opt[]>([{ v: SEL, t: SEL }, { v: ALL, t: ALL }]);
  const [states, setStates] = useState<Opt[]>([{ v: SEL, t: SEL }, { v: ALL, t: ALL }]);
  const [branches, setBranches] = useState<Opt[]>([{ v: SEL, t: SEL }, { v: ALL, t: ALL }]);
  const [emps, setEmps] = useState<Opt[]>([{ v: ALL, t: ALL }]);
  const [f, setF] = useState<Filters>({ client: ALL, state: ALL, unit: ALL, etype: ALL, emp: ALL, month: "" });
  const [hidtab, setHidtab] = useState("menu1");
  const [msg, setMsg] = useState({ text: "", ok: true });
  const show = (text: string, ok = true) => setMsg({ text, ok });
  const set = (k: keyof Filters, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => {
    (async () => {
      const d = await getJSON<{ results: Row[] }>(`${BASE}/clients/`);
      const list = ((d?.results ?? []) as Row[]);
      setClients([{ v: SEL, t: SEL }, { v: ALL, t: ALL },
        ...list.map((c) => ({ v: String(val(c, "client_code")), t: String(val(c, "client_name") || val(c, "client_code")) }))]);
    })();
  }, []);
  useEffect(() => {
    (async () => {
      if (!f.client || f.client === SEL) { setStates([{ v: SEL, t: SEL }, { v: ALL, t: ALL }]); return; }
      const d = await getJSON<{ results: Row[] }>(`${BASE}/states/?client_code=${encodeURIComponent(f.client)}`);
      const list = ((d?.results ?? []) as Row[]);
      setStates([{ v: SEL, t: SEL }, { v: ALL, t: ALL },
        ...list.map((s) => ({ v: String(val(s, "state")), t: String(val(s, "state")) }))]);
    })();
  }, [f.client]);
  useEffect(() => {
    (async () => {
      if (!f.client || f.client === SEL) { setBranches([{ v: SEL, t: SEL }, { v: ALL, t: ALL }]); return; }
      const d = await getJSON<{ results: Row[] }>(
        `${BASE}/branches/?client_code=${encodeURIComponent(f.client)}&state=${encodeURIComponent(f.state)}`);
      const list = ((d?.results ?? []) as Row[]);
      setBranches([{ v: SEL, t: SEL }, { v: ALL, t: ALL },
        ...list.map((b) => ({ v: String(val(b, "unit_code")), t: String(val(b, "unit_name")) }))]);
    })();
  }, [f.client, f.state]);
  useEffect(() => {
    (async () => {
      if (!f.client || f.client === SEL) { setEmps([{ v: ALL, t: ALL }]); return; }
      const q = `client_code=${encodeURIComponent(f.client)}&state=${encodeURIComponent(f.state)}&unit_code=${encodeURIComponent(f.unit)}&employee_type=${encodeURIComponent(f.etype)}`;
      const d = await getJSON<{ results: Row[] }>(`${BASE}/employees/?${q}`);
      const list = ((d?.results ?? []) as Row[]);
      setEmps([{ v: ALL, t: ALL }, ...list.map((e) => ({ v: String(val(e, "emp_code")), t: String(val(e, "emp_name")) }))]);
    })();
  }, [f.client, f.state, f.unit, f.etype]);

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
              <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase"><b>EMPLOYEE SALARY</b></div>
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
        <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: 10, padding: "14px 10px" }}>
          <div className="col-sm-2 col-xs-12"><b>Client Name :</b>
            <select className="form-control" value={f.client} onChange={(e) => { set("client", e.target.value); set("state", ALL); set("unit", ALL); set("emp", ALL); }}>
              {clients.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select></div>
          <div className="col-sm-2 col-xs-12"><b>State Name :</b>
            <select className="form-control" value={f.state} onChange={(e) => { set("state", e.target.value); set("unit", ALL); set("emp", ALL); }}>
              {states.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select></div>
          <div className="col-sm-2 col-xs-12"><b>Branch Name :</b>
            <select className="form-control" value={f.unit} onChange={(e) => { set("unit", e.target.value); set("emp", ALL); }}>
              {branches.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select></div>
          <div className="col-sm-2 col-xs-12"><b>Employee Type :</b>
            <select className="form-control" value={f.etype} onChange={(e) => { set("etype", e.target.value); set("emp", ALL); }}>
              {EMP_TYPES.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select></div>
          <div className="col-sm-2 col-xs-12"><b>Employee Name :</b>
            <select className="form-control" value={f.emp} onChange={(e) => set("emp", e.target.value)}>
              {emps.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select></div>
          <div className="col-sm-1 col-xs-12"><b>Select Month :</b>
            <input type="text" className="form-control date-picker12" placeholder="mm/yy" maxLength={5}
              value={f.month} onChange={(e) => set("month", e.target.value)} style={{ width: 105 }} /></div>
        </div>
        <br />
        <Msg text={msg.text} ok={msg.ok} />
        <div id="tabs" className="itmaster-tabs">
          <input type="hidden" id="hidtab" value={hidtab} readOnly />
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
            {hidtab === "menu1" && <TabEmployee f={f} show={show} />}
            {(hidtab === "menu2" || hidtab === "menu4") && <div className="row"><div className="col-sm-2"></div></div>}
            {hidtab === "menu3" && <TabHold f={f} show={show} />}
            {hidtab === "menu5" && <TabReports f={f} show={show} />}
            {hidtab === "menu6" && <TabGST f={f} show={show} />}
            {hidtab === "menu7" && <TabAccounting f={f} show={show} />}
            {hidtab === "menu8" && <TabPaid show={show} />}
            {hidtab === "menu9" && <TabTally show={show} />}
            {hidtab === "menu10" && <TabPurchase show={show} />}
            {hidtab === "menu11" && <TabOutstanding show={show} />}
          </div>
        </div>
      </div>
    </div>
  );
}
