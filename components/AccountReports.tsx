"use client";
/* =====================================================================
 * Payment History — 1:1 port of account_reports.aspx.
 * 6 tabs: Receipt | Receipt Details | Payment | Sales Entry |
 * Upload Ledger | Send Outsanding Mail (sic). Exact controls, exact
 * validation strings, exact grid columns, exact .xls names.
 * Backend: /api/transactions/account-portal/* (legacy minibank/debit/gst
 * tables). Outstanding mail tab reuses /api/reports/salary-reports/*.
 * Dates dd/mm/yyyy (month boxes mm/yy).
 * ===================================================================== */
import React, { useEffect, useState } from "react";
import { getJSON, mk, upload } from "@/lib/api/legacy-fetch";
import { apiGet } from "@/lib/api/client";

const BASE = "/api/transactions/account-portal";
const SAL = "/api/reports/salary-reports";
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
    let t = "Report failed. Please try again.";
    try {
      const r = await fetch(url, { credentials: "include" });
      const b = await r.json().catch(() => ({} as any));
      t = (b as any)?.detail || (b as any)?.non_field_errors?.[0] || t;
    } catch { /* keep default */ }
    window.alert(t); show(t, false);
  }
}
function numKey(e: React.KeyboardEvent) {
  const k = e.key;
  if (k.length !== 1) return;
  if (/^[0-9.]$/.test(k)) return;
  e.preventDefault();
}
function Exports({ id, cols, rows, cell }: { id: string; cols: string[]; rows: Row[]; cell: (r: Row, c: string) => any }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [showM, setShowM] = useState(false);
  const vis = cols.filter((c) => !hidden[c]);
  const q = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const dl = (name: string, type: string, text: string) => {
    const blob = new Blob(["\ufeff" + text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  };
  return (
    <div className="dt-btns" style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", position: "relative" }}>
      <button type="button" className="dt-exp" onClick={() => dl(`${id}.csv`, "text/csv", vis.map(q).join(",") + "\r\n" + rows.map((r) => vis.map((c) => q(cell(r, c))).join(",")).join("\r\n"))}>csv</button>
      <button type="button" className="dt-exp" onClick={() => {
        const w = window.open("", "_blank"); if (!w) return;
        w.document.write(`<html><head><title>${id}</title></head><body><table border=1><tr>${vis.map((c) => `<th>${c}</th>`).join("")}</tr>${rows.map((r) => `<tr>${vis.map((c) => `<td>${cell(r, c)}</td>`).join("")}</tr>`).join("")}</table><script>window.print()</script></body></html>`);
        w.document.close();
      }}>print</button>
      <button type="button" className="dt-exp" onClick={() => {
        navigator.clipboard?.writeText([vis.join("\t"), ...rows.map((r) => vis.map((c) => cell(r, c)).join("\t"))].join("\n")).catch(() => undefined);
      }}>copyHtml5</button>
      <button type="button" className="dt-exp" onClick={() => setShowM((s) => !s)}>colvis</button>
      {showM && (
        <div className="dt-colmenu" style={{ background: "#fff", border: "1px solid #ccc", padding: 8, position: "absolute", zIndex: 5 }}>
          {cols.map((c) => (
            <label key={c} style={{ display: "block", fontSize: 12 }}>
              <input type="checkbox" checked={!hidden[c]} onChange={() => setHidden((h) => ({ ...h, [c]: !h[c] }))} /> {c || "(x)"}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= TAB 1: Receipt ================= */
interface StageRow { receive_date: string; amount: string; utr_no: string; mode: string; against: string; remark: string; }
function TabReceipt({ show, msg }: { show: (t: string, ok?: boolean) => void; msg: { text: string; ok: boolean } }) {
  const [recv, setRecv] = useState(SEL);
  const [clients, setClients] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [others, setOthers] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [client, setClient] = useState(SEL);
  const [other, setOther] = useState(SEL);
  const [bank, setBank] = useState({ comp_bank: "", comp_ac: "", client_bank: "", client_ac: "" });
  const [rdate, setRdate] = useState("");
  const [amount, setAmount] = useState("0");
  const [mode, setMode] = useState(SEL);
  const [utr, setUtr] = useState("");
  const [cheque, setCheque] = useState("");
  const [payType, setPayType] = useState(SEL);
  const [desc, setDesc] = useState("");
  const [remark, setRemark] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editId, setEditId] = useState("");
  const [stage, setStage] = useState<StageRow[]>([]);
  const [showUtr, setShowUtr] = useState(false);
  const [ufrom, setUfrom] = useState("");
  const [uto, setUto] = useState("");
  const [ustatus, setUstatus] = useState(ALL);
  const [viewRows, setViewRows] = useState<Row[]>([]);
  const [viewBound, setViewBound] = useState(false);

  useEffect(() => {
    (async () => {
      const d = await getJSON<{ results: Row[] }>(`${BASE}/gst-clients/`);
      const list = ((d?.results ?? []) as Row[]);
      setClients([{ v: SEL, t: SEL }, ...list.map((c) => ({ v: String(val(c, "client_code")), t: String(val(c, "client_name")) }))]);
      const o = await getJSON<{ results: Row[] }>(`${BASE}/other-clients/`);
      const ol = ((o?.results ?? []) as Row[]);
      setOthers([{ v: SEL, t: SEL }, ...ol.map((c) => ({ v: String(val(c, "name")), t: String(val(c, "name")) }))]);
    })();
  }, []);
  const refreshBank = async (cc: string, cname: string) => {
    const d = await getJSON<any>(`${BASE}/bank-details/?client_code=${encodeURIComponent(cc)}&client_name=${encodeURIComponent(cname)}&receive_date=${encodeURIComponent(rdate)}`);
    if (d) setBank({ comp_bank: d.comp_bank || "", comp_ac: d.comp_ac || "", client_bank: d.client_bank || "", client_ac: d.client_ac || "" });
  };

  // Required_mini_validation() — shared by Add/Submit/Update
  const validMini = () => {
    if (!recv || recv === SEL) { window.alert("Please Select Receiver type "); return false; }
    if (recv === "1" && (!other || other === SEL)) { window.alert("Please Select Other "); return false; }
    if (!bank.comp_ac) { window.alert("Company Bank A/C  Number Not Added"); return false; }
    if (!desc) { window.alert("Please Enter Description "); return false; }
    if (!amount || amount === "0") { window.alert("Please Enter Receiving Amount"); return false; }
    if (!rdate) { window.alert("Please Select Reciving Date"); return false; }
    if (!mode || mode === SEL) { window.alert("Please Select Mode Of Transfer"); return false; }
    if (!utr && !cheque) { window.alert(mode === "Cheque" ? "Please Enter Cheque NO." : "Please Enter UTR NO."); return false; }
    if (recv === "0" && (!client || client === SEL)) { window.alert("Please Select Client"); return false; }
    if (!payType || payType === SEL) { window.alert("Please Select Payment Against  "); return false; }
    if (recv === "0" && !bank.client_bank) { window.alert("Please Select Client Bank "); return false; }
    return true;
  };
  const addRow = async () => {
    if (!validMini()) return;
    if (!bank.comp_bank) { window.alert("Bank Details Not Found, Please add bank detail for this client!!!"); return; }
    const uno = mode === "Cheque" ? cheque : utr;
    if (!uno) { window.alert(mode === "Cheque" ? "Please Enter Cheque NO." : "Please Enter UTR Number"); return; }
    const dup = await getJSON<any>(`${BASE}/utr-check/?utr_no=${encodeURIComponent(uno)}`);
    if (dup?.exists) { window.alert("Same UTR Number is  Already in used"); return; }
    if (stage.some((s) => s.utr_no === uno)) { window.alert("Same UTR Allready added, you canot add one more.!!"); return; }
    setStage((p) => [...p, {
      receive_date: rdate, amount, utr_no: uno, mode,
      against: payType === "1" ? "Invoice Against" : payType === "2" ? "Advance Payment" : payType,
      remark,
    }]);
  };
  const submit = async () => {
    if (!validMini()) return;
    if (!file) { window.alert("Please attach payment advice copy.!!!"); return; }
    const rows = stage.length > 0 ? stage : [{
      receive_date: rdate, amount, utr_no: mode === "Cheque" ? cheque : utr, mode,
      against: payType === "1" ? "Invoice Against" : payType === "2" ? "Advance Payment" : payType,
      remark,
    }];
    const fd = new FormData();
    fd.append("received_from", recv === "Client" || recv === "0" ? "0" : recv === "Other" || recv === "1" ? "1" : recv);
    fd.append("client_name", recv === "1" ? "" : clients.find((c) => c.v === client)?.t ?? "");
    fd.append("other", other);
    fd.append("payment_type", payType);
    fd.append("comp_bank", bank.comp_bank); fd.append("comp_ac", bank.comp_ac);
    fd.append("client_bank", bank.client_bank); fd.append("client_ac", bank.client_ac);
    fd.append("rows", JSON.stringify(rows));
    fd.append("file", file);
    const r = await upload(`${BASE}/receipt-submit/`, fd);
    if (r.ok) {
      window.alert("Transaction Saved Successfully Approve This Record !!!");
      show("Transaction Saved Successfully Approve This Record !!!", true);
      setStage([]); setFile(null);
    } else { const t = await errText(r, "Transaction Failed !!!"); window.alert(t); show(t, false); }
  };
  const approve = async () => {
    // R_validation(): same checks + confirm
    if (!validMini()) return;
    if (!window.confirm("Are you Sure You Want to Approve")) return;
    const uno = mode === "Cheque" ? cheque : utr;
    const r = await mk(`${BASE}/receipt-approve/`, {
      received_from: recv === "1" ? "1" : "0", other, client_code: client, comp_bank: bank.comp_bank,
      comp_ac: bank.comp_ac, client_bank: bank.client_bank, client_ac: bank.client_ac,
      amount, receive_date: rdate, mode, utr_no: uno,
    });
    if (r.ok) { window.alert("Approved Succesfully !!"); show("Approved Succesfully !!", true); }
    else { const t = await errText(r, "Approve failed"); window.alert(t); show(t, false); }
  };
  const update = async () => {
    if (!validMini()) return;
    const uno = mode === "Cheque" ? cheque : utr;
    const r = await mk(`${BASE}/receipt-update/`, {
      id: editId, received_from: recv === "1" ? "1" : "0", other, client_code: client,
      comp_bank: bank.comp_bank, comp_ac: bank.comp_ac, client_bank: bank.client_bank,
      client_ac: bank.client_ac, payment_type: payType, amount, receive_date: rdate, mode, utr_no: uno,
    });
    if (r.ok) { window.alert("Record Updated Succesfully !!"); show("Record Updated Succesfully !!", true); }
    else { const t = await errText(r, "Update failed"); window.alert(t); show(t, false); }
  };
  const view = async () => {
    const d = await getJSON<{ results: Row[] }>(
      `${BASE}/receipt-view/?client_code=${encodeURIComponent(client)}&client_name=${encodeURIComponent(clients.find((c) => c.v === client)?.t ?? "")}&from=${encodeURIComponent(ufrom)}&to=${encodeURIComponent(uto)}&knockoff=${ustatus}`);
    setViewRows(((d?.results ?? []) as Row[])); setViewBound(true);
  };
  const report = async () => {
    const d = await getJSON<any>(
      `${BASE}/utr-report/?client_code=${encodeURIComponent(client)}&client_name=${encodeURIComponent(clients.find((c) => c.v === client)?.t ?? "")}&from=${encodeURIComponent(ufrom)}&to=${encodeURIComponent(uto)}&knockoff=${ustatus}`);
    if (!d || (d.count ?? (d.rows || []).length) === 0) {
      const t = "No Matching Records Found."; window.alert(t); show(t, false); return;
    }
    const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const html = `<table border=1><tr>${d.columns.map((c: string) => `<th>${esc(c)}</th>`).join("")}</tr>` +
      d.rows.map((r: any[]) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") + `</table>`;
    const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = d.filename;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const rowAct = async (kind: "del" | "approve", r: Row) => {
    const id = val(r, "ID");
    if (kind === "del") {
      const resp = await mk(`${BASE}/receipt-delete/`, { id });
      if (resp.ok) { window.alert("Record Deleted Succsefully !!!"); show("Record Deleted Succsefully !!!", true); view(); }
      else { const t = await errText(resp, "Delete failed"); window.alert(t); show(t, false); }
    } else {
      if (!window.confirm("Are you Sure You Want to Approve")) return;
      const resp = await mk(`${BASE}/receipt-edit-approve/`, { id });
      if (resp.ok) { window.alert("Approved Succesfully !!"); show("Approved Succesfully !!", true); view(); }
      else { const t = await errText(resp, "Approve failed"); window.alert(t); show(t, false); }
    }
  };
  const dl = (name: string) => {
    if (!name) { window.alert("File Can not Found!!."); return; }
    window.open(`/api/transactions/account-portal/receipt-file/?name=${encodeURIComponent(name)}`, "_blank");
  };
  const cols = ["Sr No.", "Status", "client_name", "Receive_DATE", "Utr_no", "amount", "setteled_amt",
    "utr_balance", "Knockoff_Status", "Comp_Bank_Name", "Entry_Date", "Entry_By", "remark", "utr_type"];
  return (
    <div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div className="col-sm-2 col-xs-12"><b>Received from :</b>
          <select className="form-control" value={recv} onChange={(e) => setRecv(e.target.value)}>
            <option value={SEL}>{SEL}</option><option value="0">Client</option><option value="1">Other</option>
          </select></div>
        {recv === "0" && (
          <div className="col-sm-2 col-xs-12" id="for_client"><b>Client Name :</b>
            <select className="form-control" value={client} onChange={(e) => { setClient(e.target.value); refreshBank(e.target.value, clients.find((c) => c.v === e.target.value)?.t ?? ""); }}>
              {clients.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select></div>
        )}
        {recv === "1" && (
          <div className="col-sm-2 col-xs-12" id="for_other"><b>Other :</b>
            <select className="form-control" value={other} onChange={(e) => setOther(e.target.value)}>
              {others.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select></div>
        )}
        <div className="col-sm-2 col-xs-12"><b>Bank Name :</b><div>{bank.comp_bank}</div>
          <b>A/C Number :</b><div>{bank.comp_ac}</div></div>
        <div className="col-sm-2 col-xs-12"><b>Client Bank Name :</b><div>{bank.client_bank}</div>
          <b>Client A/C Number :</b><div>{bank.client_ac}</div></div>
        <div className="col-sm-2 col-xs-12"><b>Received Date :</b>
          <input type="text" className="form-control date-picker1" placeholder="dd/mm/yyyy" value={rdate}
            onChange={(e) => setRdate(e.target.value)} /></div>
        <div className="col-sm-2 col-xs-12"><b>Amount :</b>
          <input type="text" className="form-control" value={amount}
            onChange={(e) => setAmount(e.target.value)} onKeyPress={(e) => { if (!/[0-9.]/.test(e.key)) e.preventDefault(); }} /></div>
        <div className="col-sm-2 col-xs-12" style={{ display: "none" }}><b>Payment Hit Date :</b>
          <input type="text" className="form-control date-picker3" value={rdate} readOnly /></div>
        <div className="col-sm-2 col-xs-12"><b>Pay.Mode:</b>
          <select className="form-control" value={mode} onChange={(e) => setMode(e.target.value)}>
            <option value={SEL}>{SEL}</option><option value="NEFT">NEFT</option><option value="RTGS">RTGS</option>
          </select></div>
        <div className="col-sm-2 col-xs-12" id="utr_no"><b>UTR NO :</b>
          <input type="text" className="form-control" maxLength={40} value={utr} onChange={(e) => setUtr(e.target.value)} /></div>
        <div className="col-sm-2 col-xs-12" id="cheque" style={{ display: mode === "Cheque" ? undefined : "none" }}><b>Cheque No :</b>
          <input type="text" className="form-control" maxLength={20} value={cheque} onChange={(e) => setCheque(e.target.value)} /></div>
        <div className="col-sm-2 col-xs-12"><b>Payment Against :</b>
          <select className="form-control" value={payType} onChange={(e) => setPayType(e.target.value)}>
            <option value={SEL}>{SEL}</option><option value="1">Invoice Against</option><option value="2">Advance Payment</option>
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Description:</b>
          <input type="text" className="form-control" placeholder="Enter Description " value={desc}
            onChange={(e) => setDesc(e.target.value)} /></div>
        <div className="col-sm-2 col-xs-12"><b>Remark :</b>
          <textarea className="form-control" value={remark} onChange={(e) => setRemark(e.target.value)} /></div>
        <div className="col-sm-2 col-xs-12" style={{ display: "none" }}><b>id :</b>
          <input type="text" className="form-control" value={editId} onChange={(e) => setEditId(e.target.value)} /></div>
        <div className="col-sm-2 col-xs-12" id="btn_row"><b>Attachment :</b>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div style={{ fontSize: 11 }}>Only JPG, PNG, XLSX, XLS and PDF files.</div></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button type="button" className="it-btn" onClick={addRow}>Add</button>
        <button type="button" className="it-btn" onClick={submit}>Submit</button>
        <button type="button" className="it-btn" onClick={approve}>Approve</button>
        <button type="button" className="it-btn" onClick={update}>Update</button>
        <button type="button" className="btn btn-danger" onClick={() => { window.location.href = "/Home"; }}>Close</button>
        <button type="button" className="it-btn" onClick={() => setShowUtr((s) => !s)}>UTR Report</button>
      </div>
      {stage.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
            <thead><tr><th></th><th>Sr No.</th><th>Receipt_Date</th><th>Amount</th><th>UTR_no</th><th>Payment_mode</th><th>Payment_against</th><th>Remark</th></tr></thead>
            <tbody>
              {stage.map((s, i) => (
                <tr key={i}>
                  <td><button type="button" onClick={() => setStage((p) => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer" }}>❌</button></td>
                  <td>{i + 1}</td><td>{s.receive_date}</td><td>{s.amount}</td><td>{s.utr_no}</td>
                  <td>{s.mode}</td><td>{s.against}</td><td>{s.remark}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showUtr && (
        <div style={{ marginTop: 12, borderTop: "1px solid #ddd", paddingTop: 8 }}>
          <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div className="col-sm-2 col-xs-12"><b>From Date</b>
              <input type="text" className="form-control date-picker1" placeholder="dd/mm/yyyy" value={ufrom} onChange={(e) => setUfrom(e.target.value)} /></div>
            <div className="col-sm-2 col-xs-12"><b>To Date</b>
              <input type="text" className="form-control date-picker1" placeholder="dd/mm/yyyy" value={uto} onChange={(e) => setUto(e.target.value)} /></div>
            <div className="col-sm-2 col-xs-12"><b>Knockoff Status</b>
              <select className="form-control" value={ustatus} onChange={(e) => setUstatus(e.target.value)}>
                <option value={ALL}>All</option><option value="Yes">Complete(Yes)</option><option value="No">Pending(No)</option>
              </select></div>
            <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn" onClick={view}>View</button></div>
            <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn" onClick={report}>Report</button></div>
          </div>
          {viewBound && (
            <div style={{ overflowX: "auto", marginTop: 8 }}>
              <Exports id="gv_minibank" cols={cols} rows={viewRows} cell={(r, c) => val(r, c)} />
              <table id="gv_minibank" className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
                <thead><tr><th></th><th></th><th></th>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {viewRows.map((r, i) => {
                    const ap = String(val(r, "receipt_approve"));
                    const canAct = ap === "0" || ap === "3";
                    return (
                      <tr key={val(r, "ID") || i}>
                        <td>{canAct && <button type="button" onClick={() => rowAct("del", r)} style={{ background: "none", border: "none", cursor: "pointer" }}>🗑</button>}</td>
                        <td>{val(r, "Upload_file") ? <button type="button" className="it-btn" onClick={() => dl(val(r, "Upload_file"))}>DOWNLOAD</button> : null}</td>
                        <td>{canAct && <button type="button" className="it-btn" onClick={() => rowAct("approve", r)}>Approve</button>}</td>
                        {cols.map((c) => <td key={c}>{c === "Sr No." ? i + 1 : val(r, c)}</td>)}
                      </tr>
                    );
                  })}
                  {viewRows.length === 0 && <tr><td colSpan={17} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ================= TAB 2: Receipt Details ================= */
function TabReceiptDetails({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [clients, setClients] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [client, setClient] = useState(SEL);
  const [dates, setDates] = useState<Opt[]>([]);
  const [date, setDate] = useState("");
  const [amounts, setAmounts] = useState<Opt[]>([]);
  const [amountId, setAmountId] = useState("");
  const [invoices, setInvoices] = useState<Row[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [knock, setKnock] = useState<Row[]>([]);
  const [kedit, setKedit] = useState<Record<number, { amt: string; tds: string; status: string; remark: string; ded: string; rdate: string }>>({});
  const [saved, setSaved] = useState(false);
  const [done, setDone] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [ledgerFile, setLedgerFile] = useState<File | null>(null);

  useEffect(() => {
    (async () => {
      const d = await getJSON<{ results: Row[] }>(`${BASE}/gst-clients/`);
      const list = ((d?.results ?? []) as Row[]);
      setClients([{ v: SEL, t: SEL }, ...list.map((c) => ({ v: String(val(c, "client_code")), t: String(val(c, "client_name")) }))]);
    })();
  }, []);
  useEffect(() => {
    (async () => {
      if (!client || client === SEL) { setDates([]); return; }
      const d = await getJSON<{ results: Row[] }>(`${BASE}/detail-dates/?client_code=${encodeURIComponent(client)}`);
      const list = ((d?.results ?? []) as Row[]);
      setDates(list.map((x) => ({ v: String(val(x, "d")), t: String(val(x, "d")) })));
    })();
  }, [client]);
  useEffect(() => {
    (async () => {
      if (!date) { setAmounts([]); return; }
      const d = await getJSON<{ results: Row[] }>(`${BASE}/detail-amounts/?client_code=${encodeURIComponent(client)}&date=${encodeURIComponent(date)}`);
      const list = ((d?.results ?? []) as Row[]);
      setAmounts(list.map((x) => ({ v: String(val(x, "Id")), t: String(val(x, "amount")) })));
    })();
  }, [date, client]);
  const pickClient = (v: string) => {
    setClient(v); setDate(""); setAmountId(""); setInvoices([]); setKnock([]); setChecked({});
  };
  const processInvoices = async () => {
    if (!date) { window.alert("Please Select Month"); return; }
    const cname = clients.find((c) => c.v === client)?.t ?? "";
    const d = await getJSON<{ results: Row[] }>(`${BASE}/invoice-list/?client_name=${encodeURIComponent(cname)}`);
    const list = ((d?.results ?? []) as Row[]);
    setInvoices(list); setChecked({});
    if (list.length === 0) { const t = "No Matching Records Found !!!"; window.alert(t); show(t, false); }
  };
  const knockoff = async () => {
    const invs = invoices.filter((_, i) => checked[String(i)]).map((r) => val(r, "Invoice_No"));
    if (invs.length === 0) { window.alert("Please Select Invoice !!!"); return; }
    // one knock-off row per selected invoice; previous receipts 1/2/3 come from the invoice itself
    setKnock(invs.map((inv) => {
      const src = invoices.find((r) => String(val(r, "Invoice_No")) === String(inv)) || {};
      const billing = Number(val(src, "amount")) || 0;
      const tdsAmt = Number(val(src, "tds_amt")) || 0;
      return {
        Invoice_no: inv, billing_amt: billing, tds_amt: tdsAmt, receviable_amt: (billing - tdsAmt).toFixed(2),
        receving_date: date, p1: Number(val(src, "received_amt1")) || 0, p2: Number(val(src, "received_amt2")) || 0,
        p3: Number(val(src, "received_amt3")) || 0,
      };
    }));
    setKedit({}); setSaved(false);
  };
  const slotOf = (r: Row) => (r.p1 === 0 && r.p2 === 0 ? 1 : r.p1 > 0 && r.p2 === 0 ? 2 : r.p2 > 0 && r.p3 === 0 ? 3 : 0);
  const editOf = (i: number) => kedit[i] ?? { amt: "", tds: String(knock[i]?.tds_amt ?? ""), status: "0", remark: "", ded: "0", rdate: knock[i]?.receving_date };
  const balanceOf = (i: number) => {
    const r = knock[i]; const e = editOf(i);
    return Math.round(((Number(r.billing_amt) || 0) - (slotOf(r) === 1 ? (parseFloat(e.tds || "0") || 0) : (Number(r.tds_amt) || 0))
      - (r.p1 + r.p2 + r.p3 + (parseFloat(e.amt || "0") || 0)) - (parseFloat(e.ded || "0") || 0)) * 100) / 100;
  };
  const saveAll = async () => {
    if (!amountId) { window.alert("Please Select Amount"); return; }
    const rows = knock.map((r, i) => {
      const e = editOf(i);
      return { invoice_no: r.Invoice_no, amount: e.amt, tds_amount: e.tds, receive_date: e.rdate || date,
        deduction: e.ded, remark: e.remark, payment_status: e.status };
    });
    const fd = new FormData();
    fd.append("utr_id", amountId); fd.append("rows", JSON.stringify(rows));
    if (ledgerFile) fd.append("ledger_file", ledgerFile);
    const resp = await upload(`${BASE}/knockoff-save/`, fd);
    if (resp.ok) {
      const t = "Transaction Saved Successfully Please Approve Record !!!";
      window.alert(t); show(t, true); setSaved(true);
    } else { const t = await errText(resp, "Save failed"); window.alert(t); show(t, false); }
  };
  const approveAll = async () => {
    for (let i = 0; i < knock.length; i++) {
      const r = knock[i]; const e = editOf(i);
      const sl = slotOf(r);
      const level = sl === 1 ? "1" : "2";
      const amt = sl === 1 ? e.amt : sl === 2 ? e.amt : String(r.p2);
      const resp = await mk(`${BASE}/knockoff-approve/`, { invoice_no: r.Invoice_no, amount: amt, receive_date: date, level });
      if (!resp.ok) { const t = await errText(resp, "Approve failed"); window.alert(t); show(t, false); return; }
    }
    window.alert("Record Approve  Successfully !!!"); show("Record Approve  Successfully !!!", true);
    setKnock([]); setKedit({}); setSaved(false);
  };
  const viewDone = async (mode: "done" | "pending") => {
    const d = await getJSON<{ results: Row[] }>(`${BASE}/payment-done/?client_code=${encodeURIComponent(client)}&mode=${mode}`);
    setDone(((d?.results ?? []) as Row[]));
  };
  const filt = invoices.filter((r) => !search || JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
  const kcols = ["SR. NO.", "INVOICE NO", "BILLING AMOUNT", "TDS AMOUNT", "RECEIVABLE AMOUNT", "RECIVING DATE", "Received Amount1", "Received Amount2", "Received Amount3", "Total Received", "Balance", "Payment Status", "DEDUCTION AMT", "REMARK"];
  return (
    <div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="col-sm-2 col-xs-12"><b>Client:<span className="text-red"> *</span></b>
          <select className="form-control" value={client} onChange={(e) => pickClient(e.target.value)}>
            {clients.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Payment Receving Date :<span className="text-red"> *</span></b>
          <select className="form-control" value={date} onChange={(e) => setDate(e.target.value)}>
            <option value="">Select</option>
            {dates.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Select Amount:<span className="text-red"> *</span></b>
          <select className="form-control" value={amountId} onChange={(e) => setAmountId(e.target.value)}>
            <option value="">Select</option>
            {amounts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Search :</b>
          <input type="text" className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="col-sm-2 col-xs-12"><b>Ledger Attachment :</b>
          <input type="file" onChange={(e) => setLedgerFile(e.target.files?.[0] ?? null)} /></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
        <button type="button" className="it-btn" onClick={processInvoices}>Submit</button>
        <button type="button" className="it-btn" onClick={knockoff}>Process</button>
        <button type="button" className="it-btn" onClick={() => viewDone("done")}>View Done</button>
        <button type="button" className="it-btn" onClick={() => viewDone("pending")}>View Pending</button>
        <button type="button" className="btn btn-danger" onClick={() => { window.location.href = "/Home"; }}>Close</button>
      </div>
      {filt.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
            <thead><tr><th>Sr. No.</th><th>SELECT INVOICE</th><th>Invoice</th><th>Amount</th><th>Balance</th><th>Type</th></tr></thead>
            <tbody>
              {filt.map((r, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td style={{ textAlign: "center" }}>
                    <input type="checkbox" checked={!!checked[String(i)]}
                      onChange={(e) => setChecked((p) => ({ ...p, [String(i)]: e.target.checked }))} />
                  </td>
                  <td>{val(r, "Invoice_No")}</td><td>{val(r, "amount")}</td>
                  <td>{val(r, "Balance_Amount")}</td><td>{val(r, "type")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {knock.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
            <thead><tr>{kcols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {knock.map((r, i) => {
                const e = editOf(i);
                const sl = slotOf(r);
                const set = (k: string, v: string) => setKedit((p) => ({ ...p, [i]: { ...editOf(i), [k]: v } }));
                const box = (n: number, prior: number) => (sl === n
                  ? <input type="text" className="form-control" style={{ width: 90 }} value={e.amt} disabled={saved}
                      onKeyPress={numKey} onChange={(ev) => set("amt", ev.target.value)} />
                  : <input type="text" className="form-control" style={{ width: 90 }} value={prior} disabled readOnly />);
                const bal = balanceOf(i);
                return (
                  <tr key={i}>
                    <td>{i + 1}</td><td>{r.Invoice_no}</td><td>{r.billing_amt}</td>
                    <td><input type="text" className="form-control" style={{ width: 80 }} value={sl === 1 ? e.tds : String(r.tds_amt)}
                      disabled={sl !== 1 || saved} onKeyPress={numKey} onChange={(ev) => set("tds", ev.target.value)} /></td>
                    <td>{r.receviable_amt}</td><td>{r.receving_date}</td>
                    <td>{box(1, r.p1)}</td><td>{box(2, r.p2)}</td><td>{box(3, r.p3)}</td>
                    <td>{(r.p1 + r.p2 + r.p3 + (parseFloat(e.amt || "0") || 0)).toFixed(2)}</td>
                    <td>{bal.toFixed(2)}</td>
                    <td><select className="form-control" value={e.status} disabled={saved} onChange={(ev) => set("status", ev.target.value)}>
                      <option value="0">Select</option><option value="1">GST Hold</option><option value="2">TDS Not Deduct</option>
                      <option value="3">Credit Note</option><option value="4">Part Payment</option><option value="5">Payment Done</option>
                    </select></td>
                    <td><input type="text" className="form-control" style={{ width: 80 }} value={e.ded}
                      disabled={saved || e.status !== "3"} onKeyPress={numKey} onChange={(ev) => set("ded", ev.target.value)} /></td>
                    <td><input type="text" className="form-control" style={{ width: 120 }} value={e.remark} disabled={saved}
                      onChange={(ev) => set("remark", ev.target.value)} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {!saved && <button type="button" className="it-btn" onClick={saveAll}>Save</button>}
            {saved && <button type="button" className="it-btn" onClick={approveAll}>Approve</button>}
          </div>
        </div>
      )}
      {done.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <h4>Transaction Details</h4>
          <table className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
            <thead><tr>{Object.keys(done[0]).map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {done.map((r, i) => (
                <tr key={i}>{Object.keys(done[0]).map((c) => <td key={c}>{val(r, c)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {ledgerFile && <div style={{ fontSize: 11, marginTop: 4 }}>Ledger file: {ledgerFile.name}</div>}
    </div>
  );
}

/* ================= TAB 3: Payment ================= */
function TabPayment({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [ptype, setPtype] = useState(SEL);
  const [clients, setClients] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [client, setClient] = useState(SEL);
  const [batches, setBatches] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [batch, setBatch] = useState(SEL);
  const [banks, setBanks] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [bank, setBank] = useState(SEL);
  const [acno, setAcno] = useState("");
  const [desc, setDesc] = useState("");
  const [descMode, setDescMode] = useState<"select" | "text">("select");
  const [amount, setAmount] = useState("0");
  const [pdate, setPdate] = useState("");
  const [tmode, setTmode] = useState(SEL);
  const [pmode, setPmode] = useState(SEL);
  const [utr, setUtr] = useState("");
  const [chq, setChq] = useState("");
  const [chqRecv, setChqRecv] = useState("");
  const [chqDep, setChqDep] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    (async () => {
      if (!ptype || ptype === SEL) { setClients([{ v: SEL, t: SEL }]); return; }
      const d = await getJSON<{ results: Row[] }>(`${BASE}/payment-clients/?ptype=${ptype}`);
      const list = ((d?.results ?? []) as Row[]);
      setClients([{ v: SEL, t: SEL }, ...list.map((c) => ({ v: String(val(c, "code")), t: String(val(c, "name")) }))]);
    })();
  }, [ptype]);
  useEffect(() => {
    (async () => {
      if (!ptype || ptype === SEL) { setBanks([{ v: SEL, t: SEL }]); return; }
      const d = await getJSON<{ results: Row[] }>(`${BASE}/company-banks/?ptype=${ptype}&client=${encodeURIComponent(client)}`);
      const list = ((d?.results ?? []) as Row[]);
      setBanks([{ v: SEL, t: SEL }, ...list.map((b) => ({ v: String(val(b, "code")), t: String(val(b, "name")) }))]);
    })();
  }, [ptype, client]);
  useEffect(() => {
    (async () => {
      if (!client || client === SEL || (ptype !== "1" && ptype !== "2")) { setBatches([{ v: SEL, t: SEL }]); return; }
      const d = await getJSON<{ results: Row[] }>(`${BASE}/batches/?ptype=${ptype}&client=${encodeURIComponent(client)}`);
      const list = ((d?.results ?? []) as Row[]);
      setBatches([{ v: SEL, t: SEL }, ...list.map((b) => ({ v: String(val(b, "batch")), t: String(val(b, "batch")) }))]);
    })();
  }, [ptype, client]);
  useEffect(() => {
    (async () => {
      if (!batch || batch === SEL) return;
      const d = await getJSON<any>(`${BASE}/batch-info/?ptype=${ptype}&client=${encodeURIComponent(client)}&batch=${encodeURIComponent(batch)}`);
      if (d) {
        if (d.amount) setAmount(String(d.amount));
        if (d.bank && ptype === "1") setBank(d.bank);
      }
    })();
  }, [batch, ptype, client]);
  const pickType = (v: string) => {
    setPtype(v); setClient(SEL); setBatch(SEL); setBank(SEL); setAcno(""); setDesc(""); setAmount("0");
    setDescMode("select");
  };
  const pickClient = (v: string) => {
    setClient(v); setBatch(SEL);
    if (ptype === "3") {
      setAcno(v);
      (async () => {
        const d = await getJSON<{ results: Row[] }>(`${BASE}/company-banks/?ptype=3&client=${encodeURIComponent(v)}`);
        const list = ((d?.results ?? []) as Row[]);
        setBanks([{ v: SEL, t: SEL }, ...list.map((b) => ({ v: String(val(b, "code")), t: String(val(b, "name")) }))]);
      })();
    }
  };
  const submit = async () => {
    // Required_pmt_validation() dispatcher
    if (!ptype || ptype === SEL) { window.alert("Please Select Client Name"); return; }
    if (ptype === "1") {
      if (!client || client === SEL) { window.alert("Please Select Client Name"); return; }
      if (!batch || batch === SEL) { window.alert("Please Select Batch Number"); return; }
      if (!desc) { window.alert("Please Select Description"); return; }
    } else if (ptype === "2") {
      if (!client || client === SEL) { window.alert("Please Select Vendor Name"); return; }
      if (!batch || batch === SEL) { window.alert("Please Select Batch Number"); return; }
      if (!bank || bank === SEL) { window.alert("Please Select Company Bank Name"); return; }
      if (!desc) { window.alert("Please Enter Description"); return; }
    } else {
      if (!client || client === SEL) { window.alert("Please Select Transfer To"); return; }
      if (!bank || bank === SEL) { window.alert("Please Select Transfer From"); return; }
    }
    if (!amount || amount === "0") { window.alert("Please Enter Payment Amount"); return; }
    if (!pdate) { window.alert("Please Select Payment Date"); return; }
    if (!tmode || tmode === SEL) { window.alert("Please Select Mode Of Transfer"); return; }
    if (tmode !== "Cheque" && !utr) { window.alert("Please Enter UTR Number"); return; }
    if (tmode === "Cheque") {
      if (!chq) { window.alert("Please Enter Cheque Number"); return; }
      if (chq.length !== 6) { window.alert("Invalid Cheque Number ! Please Enter 6 Digit Cheque Number"); return; }
      if (!chqRecv) { window.alert("Please Select Cheque Received Date"); return; }
      if (!chqDep) { window.alert("Please Select Cheque Deposite Date"); return; }
    }
    if (utr && utr.length !== 12 && tmode !== "Cheque") { window.alert("Invalid UTR Number ! Please Enter 12 Digit UTR Number"); }
    if (ptype !== "3" && !file) { window.alert(ptype === "1" ? "Please Upload Annexure" : "Please Upload Document"); return; }
    const fd = new FormData();
    fd.append("ptype", ptype); fd.append("client", client); fd.append("batch", batch);
    fd.append("bank", ptype === "3" ? (banks.find((b) => b.v === bank)?.t ?? bank) : bank);
    fd.append("ac_no", acno); fd.append("desc", desc); fd.append("amount", amount);
    fd.append("pay_date", pdate); fd.append("transfer_mode", tmode); fd.append("utr_no", utr);
    fd.append("cheque_no", chq); fd.append("cheque_recv", chqRecv); fd.append("cheque_dep", chqDep);
    if (file) fd.append("file", file);
    const r = await upload(`${BASE}/payment-submit/`, fd);
    if (r.ok) {
      const d = await r.json().catch(() => ({} as any));
      window.alert((d as any)?.message || "Saved"); show((d as any)?.message || "Saved", true);
      setAmount("0"); setFile(null); loadList(client);
    } else { const t = await errText(r, "Save failed"); window.alert(t); show(t, false); }
  };
  const loadList = async (cc: string) => {
    if (!cc || cc === SEL) { setRows([]); return; }
    const d = await getJSON<{ results: Row[] }>(`${BASE}/payment-list/?ptype=${ptype}&client=${encodeURIComponent(cc)}`);
    setRows(((d?.results ?? []) as Row[]));
  };
  useEffect(() => { loadList(client); }, [client, ptype]);
  const del = async (r: Row) => {
    if (!window.confirm("Are you sure You want to  Delete ?")) return;
    const resp = await mk(`${BASE}/payment-delete/`, { id: val(r, "Id"), file: val(r, "annuxure_file") });
    if (resp.ok) { window.alert("Record Deleted Succsefully !!!"); show("Record Deleted Succsefully !!!", true); loadList(client); }
    else { const t = await errText(resp, "Delete failed"); window.alert(t); show(t, false); }
  };
  const dl = (name: string) => {
    if (!name) { window.alert("Attachment File Cannot Be Uploaded !!!"); return; }
    window.open(`/api/transactions/account-portal/payment-file/?name=${encodeURIComponent(name)}`, "_blank");
  };
  const lblClient = ptype === "2" ? "Vendor:" : ptype === "3" ? "Transfer To:" : "Client:";
  return (
    <div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div className="col-sm-2 col-xs-12"><b>Paid To :</b>
          <select className="form-control" value={ptype} onChange={(e) => pickType(e.target.value)}>
            <option value={SEL}>{SEL}</option><option value="1">Employee Payment</option>
            <option value="2">Vendor Payment</option><option value="3">Internal Transfer</option>
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>{lblClient}</b>
          <select className="form-control" value={client} onChange={(e) => pickClient(e.target.value)}>
            {clients.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        {ptype !== "3" && (
          <div className="col-sm-2 col-xs-12"><b>Batch No:</b>
            <select className="form-control" value={batch} onChange={(e) => setBatch(e.target.value)}>
              {batches.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select></div>
        )}
        <div className="col-sm-2 col-xs-12"><b>{ptype === "3" ? "Transfer From:" : "Company Bank Name :"}</b>
          <select className="form-control" value={bank} onChange={(e) => {
            setBank(e.target.value);
            if (ptype === "3") { setDesc(e.target.value); }
          }}>
            {banks.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>A/C No :</b>
          <input type="text" className="form-control" value={acno} readOnly={ptype === "3"} onChange={(e) => setAcno(e.target.value)} /></div>
        <div className="col-sm-2 col-xs-12"><b>Description :</b>
          {descMode === "select" && ptype === "1" ? (
            <select className="form-control" value={desc} onChange={(e) => setDesc(e.target.value)}>
              <option value="">{SEL}</option><option value="Salary">Salary</option>
            </select>
          ) : (
            <input type="text" className="form-control" value={desc} readOnly={ptype === "3"} onChange={(e) => setDesc(e.target.value)} />
          )}</div>
        <div className="col-sm-2 col-xs-12"><b>Amount :</b>
          <input type="text" className="form-control" value={amount} onChange={(e) => setAmount(e.target.value)}
            onKeyPress={(e) => { if (!/[0-9]/.test(e.key)) e.preventDefault(); }} /></div>
        <div className="col-sm-2 col-xs-12"><b>Payment Date :</b>
          <input type="text" className="form-control date-picker1" placeholder="dd/mm/yyyy" value={pdate} onChange={(e) => setPdate(e.target.value)} /></div>
        <div className="col-sm-2 col-xs-12"><b>Transaction Mode:</b>
          <select className="form-control" value={tmode} onChange={(e) => setTmode(e.target.value)}>
            <option value={SEL}>{SEL}</option><option value="Cash">Cash</option><option value="Bank">Bank</option>
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Mode Of Transfer :</b>
          <select className="form-control" value={pmode} onChange={(e) => setPmode(e.target.value)}>
            <option value={SEL}>{SEL}</option><option value="RTGS">RTGS</option><option value="Cheque">Cheque</option><option value="NEFT">NEFT</option>
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>UTR No. :</b>
          <input type="text" className="form-control" maxLength={12} value={utr}
            onChange={(e) => setUtr(e.target.value)}
            onBlur={() => { if (utr && utr.length !== 12) window.alert("Invalid UTR Number ! Please Enter 12 Digit UTR Number"); }} /></div>
        <div className="col-sm-2 col-xs-12"><b>Cheque No :</b>
          <input type="text" className="form-control" maxLength={6} value={chq}
            onChange={(e) => setChq(e.target.value)} onKeyPress={(e) => { if (!/[0-9]/.test(e.key)) e.preventDefault(); }}
            onBlur={() => { if (chq && chq.length !== 6) window.alert("Invalid Cheque Number ! Please Enter 6 Digit Cheque Number"); }} /></div>
        <div className="col-sm-2 col-xs-12"><b>Cheque Received Date :</b>
          <input type="text" className="form-control date-picker3" placeholder="dd/mm/yyyy" value={chqRecv} onChange={(e) => setChqRecv(e.target.value)} /></div>
        <div className="col-sm-2 col-xs-12"><b>Deposite Date :</b>
          <input type="text" className="form-control date-picker4" placeholder="dd/mm/yyyy" value={chqDep} onChange={(e) => setChqDep(e.target.value)} /></div>
        {ptype !== "3" && (
          <div className="col-sm-2 col-xs-12" id="panel_annexure_id"><b>Annexure :</b>
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" className="it-btn" onClick={submit}>Submit</button>
        <button type="button" className="btn btn-danger" onClick={() => { window.location.href = "/Home"; }}>Close</button>
      </div>
      {rows.length > 0 && (
        <div style={{ overflowX: "auto", marginTop: 8 }}>
          <table className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
            <thead><tr><th>DELETE</th><th>DOWNLOAD FILE</th>{Object.keys(rows[0]).map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td><button type="button" onClick={() => del(r)} style={{ background: "none", border: "none", cursor: "pointer" }}>🗑</button></td>
                  <td><button type="button" className="it-btn" onClick={() => dl(val(r, "annuxure_file"))}>DOWNLOAD</button></td>
                  {Object.keys(rows[0]).map((c) => <td key={c}>{val(r, c)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================= TAB 4: Sales Entry ================= */
function TabSales() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    (async () => {
      const d = await getJSON<{ results: Row[] }>(`${BASE}/sale-entry/`);
      setRows(((d?.results ?? []) as Row[]));
    })();
  }, []);
  const cols = rows.length > 0 ? Object.keys(rows[0]) : [];
  return (
    <div className="grid-view" style={{ overflowX: "auto" }}>
      <Exports id="grv_saleentery" cols={cols} rows={rows} cell={(r, c) => val(r, c)} />
      <table id="grv_saleentery" className="table dt-grid" style={{ width: "100%", background: "#fff", fontSize: "x-small" }}>
        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{cols.map((c) => <td key={c}>{val(r, c)}</td>)}</tr>
          ))}
          {rows.length === 0 && <tr><td style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

/* ================= TAB 5: Upload Ledger ================= */
function TabLedger({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [clients, setClients] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [client, setClient] = useState(SEL);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [selId, setSelId] = useState("");
  const [form, setForm] = useState({ batchid: "", state: "", invoice: "", invdate: "", payment: "", paydate: "", ref: "", deduction: "", remark: "" });
  const [search, setSearch] = useState("");
  const [showUpdate, setShowUpdate] = useState(false);
  useEffect(() => {
    (async () => {
      const d = await getJSON<{ results: Row[] }>(`${BASE}/gst-clients/`);
      const list = ((d?.results ?? []) as Row[]);
      setClients([{ v: SEL, t: SEL }, ...list.map((c) => ({ v: String(val(c, "client_code")), t: String(val(c, "client_name")) }))]);
    })();
  }, []);
  const loadGrid = async (cc: string) => {
    if (!cc || cc === SEL) { setRows([]); return; }
    const d = await getJSON<{ results: Row[] }>(`${BASE}/ledger-grid/?client_code=${encodeURIComponent(cc)}`);
    setRows(((d?.results ?? []) as Row[])); setShowUpdate(false);
  };
  const pickRow = (r: Row) => {
    setSelId(String(val(r, "ID")));
    setForm({
      batchid: String(val(r, "batchid") ?? ""), state: String(val(r, "state_name") ?? ""),
      invoice: String(val(r, "invoice_no") ?? ""), invdate: String(val(r, "invoice_date") ?? ""),
      payment: String(val(r, "payment") ?? ""), paydate: String(val(r, "payment_date") ?? ""),
      ref: String(val(r, "transaction_ref") ?? ""), deduction: String(val(r, "tds_deducted") ?? ""),
      remark: String(val(r, "remarks") ?? ""),
    });
    setShowUpdate(true);
  };
  const process = async () => {
    // Req_validation()
    if (!client || client === SEL) { window.alert("Please Select Client Name"); return; }
    if (!file) { window.alert("Please Upload the File "); return; }
    const fd = new FormData();
    fd.append("client_code", client); fd.append("file", file);
    const r = await upload(`${BASE}/ledger-upload/`, fd);
    if (r.ok) {
      const d = await r.json().catch(() => ({} as any));
      window.alert("Ledger File Uploaded Successfully...");
      show("Ledger File Uploaded Successfully...", true);
      if ((d as any)?.issues) {
        const iss = (d as any).issues;
        const blob = new Blob(["\ufeff" + iss.html], { type: "application/vnd.ms-excel" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = iss.filename;
        document.body.appendChild(a); a.click(); a.remove();
      }
      window.alert("File Uploaded Successfully !!!");
      loadGrid(client);
    } else { const t = await errText(r, "Upload failed"); window.alert(t); show(t, false); }
  };
  const report = async () => {
    if (!client || client === SEL) { window.alert("Please Select Client Name"); return; } // Req_report_validation()
    const d = await getJSON<any>(`${BASE}/ledger-report/?client_code=${encodeURIComponent(client)}`);
    if (!d || (d.count ?? (d.rows || []).length) === 0) {
      const t = "No Matching Records Found."; window.alert(t); show(t, false); return;
    }
    const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const html = `<table border=1><tr>${d.columns.map((c: string) => `<th>${esc(c)}</th>`).join("")}</tr>` +
      d.rows.map((r: any[]) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") + `</table>`;
    const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = d.filename;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const update = async () => {
    if (!client || client === SEL) { window.alert("Please Select Client Name"); return; } // req_val()
    const r = await mk(`${BASE}/ledger-update/`, {
      invoice_no: form.invoice, payment: form.payment, remarks: form.remark, batchid: form.batchid,
      transaction_ref: form.ref,
    });
    if (r.ok) {
      window.alert("Record update successfully"); show("Record update successfully", true);
      setForm({ batchid: "", state: "", invoice: "", invdate: "", payment: "", paydate: "", ref: "", deduction: "", remark: "" });
      setShowUpdate(false); loadGrid(client);
    } else { const t = await errText(r, "Update failed"); window.alert(t); show(t, false); }
  };
  const F = (k: keyof typeof form, label: string, ro = false, num = false, max = 255) => (
    <div className="col-sm-2 col-xs-12"><b>{label}</b>
      <input type="text" className="form-control" value={form[k]}
        readOnly={ro} maxLength={max}
        onChange={(e) => setForm({ ...form, [k]: e.target.value })}
        onKeyPress={num ? (e) => { if (!/[0-9.]/.test(e.key)) e.preventDefault(); } : undefined} />
    </div>
  );
  const filt = rows.filter((r) => !search || JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
  const cols = ["batchid", "state", "invoice_no", "invoice_date", "payment", "payment_date", "transaction_ref", "tds_deducted", "remarks"];
  return (
    <div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="col-sm-2 col-xs-12"><b>Client Name :</b>
          <select className="form-control" value={client} onChange={(e) => { setClient(e.target.value); loadGrid(e.target.value); }}>
            {clients.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>File : <span className="text-red">*</span></b>
          <input type="file" accept=".xls,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn btn-primary convience" onClick={process}>Process</button></div>
        <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn" onClick={report}>Report</button></div>
      </div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
        {F("batchid", "Batch ID :", false, true)}
        {F("state", "state :", true)}
        {F("invoice", "Invoice No :", true)}
        {F("invdate", "Invoice Date :", true)}
        {F("payment", "Payment :", false, true)}
        <div className="col-sm-2 col-xs-12"><b>Payment Date :</b>
          <input type="text" className="form-control date-picker1" placeholder="dd/mm/yyyy" value={form.paydate}
            onChange={(e) => setForm({ ...form, paydate: e.target.value })} /></div>
        {F("ref", "Transaction Ref :", false, true)}
        {F("deduction", "TDS Deduction :", true)}
        {F("remark", "Remark:")}
        <div className="col-sm-2 col-xs-12"><b>Search :</b>
          <input type="text" className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {showUpdate && <button type="button" className="it-btn text-center" onClick={update}>Update</button>}
        <button type="button" className="btn btn-danger" onClick={() => { window.location.href = "/Home"; }}>Close</button>
      </div>
      <div className="grid-view" style={{ overflowX: "auto", marginTop: 8 }}>
        <table id="payment_gridview" className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
          <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {filt.map((r, i) => (
              <tr key={i} onClick={() => pickRow(r)} style={{ cursor: "pointer", fontWeight: String(val(r, "ID")) === selId ? 700 : 400 }}>
                {cols.map((c) => <td key={c}>{val(r, c)}</td>)}
              </tr>
            ))}
            {filt.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= TAB 6: Send Outsanding Mail (salary-reports reuse) ================= */
const EMAIL_RE = /^([\w-]+(\.[\w-]+)*)@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.)|(([\w-]+\.)+))([a-zA-Z]{2,4}|[0-9]{1,3})(\]?)$/;
function TabOutstanding({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [clients, setClients] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [client, setClient] = useState(SEL);
  const [total, setTotal] = useState("");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [rows, setRows] = useState<any[][]>([]);
  const [bound, setBound] = useState(false);
  const [emailErr, setEmailErr] = useState("");
  useEffect(() => {
    (async () => {
      const d = await getJSON<{ results: Row[] }>(`${SAL}/outstanding-clients/`);
      const list = ((d?.results ?? []) as Row[]);
      setClients([{ v: SEL, t: SEL }, ...list.map((c) => ({ v: String(val(c, "name")), t: String(val(c, "name")) }))]);
    })();
  }, []);
  const pick = async (v: string) => {
    setClient(v); setRows([]); setBound(false);
    if (!v || v === SEL) { setTotal(""); return; }
    const t = await getJSON<{ total: string }>(`${SAL}/outstanding-total/?client_code=${encodeURIComponent(v)}`);
    setTotal(String((t as any)?.total ?? ""));
    const m = await getJSON<any>(`${SAL}/outstanding-mails/?client_code=${encodeURIComponent(v)}`);
    if (m) { setTo(String((m as any)?.to ?? "")); setCc(String((m as any)?.cc ?? "")); }
  };
  const view = async () => {
    if (!client || client === SEL) { window.alert("Please Select Client Name"); return; }
    const d = await getJSON<any>(`${SAL}/outstanding-view/?client_code=${encodeURIComponent(client)}`);
    const list = ((d?.rows ?? []) as any[][]);
    if (!d || list.length === 0) { const t = "No Matching Records Found."; window.alert(t); show(t, false); return; }
    const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const html = `<table border=1><tr>${d.columns.map((c: string) => `<th>${esc(c)}</th>`).join("")}</tr>` +
      list.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") + `</table>`;
    const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = d.filename;
    document.body.appendChild(a); a.click(); a.remove();
    setRows(list); setBound(true);
    show("Report downloaded", true);
  };
  const send = async () => {
    if (!client || client === SEL) { window.alert("Please Select Client Name"); return; }
    if (!to) { window.alert("Please Enter To Mail"); return; }
    if (!cc) { window.alert("Please Enter CC Mail"); return; }
    const r = await mk(`${SAL}/outstanding-send/`, { client_code: client, to_mail: to, cc_mail: cc });
    if (r.ok) { window.alert("Mail Sent Successfully...!!!"); show("Mail Sent Successfully...!!!", true); }
    else { const t = await errText(r, "Error in Sending Email...!!"); window.alert(t); show(t, false); }
  };
  const cols = ["SR.NO.", "INVOICE DATE", "INVOICE NO", "MONTH", "CLIENT", "STATE", "TYPE", "GST",
    "INVOICE AMT", "TDS", "RECEIVABLE", "RECV1", "RECV2", "RECV3", "TOTAL REC", "DEDUCTION",
    "BALANCE", "STATUS"];
  return (
    <div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="col-sm-3 col-xs-12"><b>Client Name :</b>
          <select className="form-control" value={client} onChange={(e) => pick(e.target.value)}>
            {clients.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select>
          <div style={{ fontSize: "x-large", color: "blue" }}>{total}</div></div>
        <div className="col-sm-3 col-xs-12"><b>TO MAIL ID:</b>
          <textarea className="form-control" rows={2} value={to}
            onChange={(e) => { setTo(e.target.value); setEmailErr(EMAIL_RE.test(e.target.value) || e.target.value === "" ? "" : "Invalid email address."); }} />
          <span id="lblError" style={{ color: "red" }}>{emailErr}</span></div>
        <div className="col-sm-3 col-xs-12"><b>CC MAIL ID:</b>
          <textarea className="form-control" rows={2} value={cc} onChange={(e) => setCc(e.target.value)} /></div>
        <div className="col-sm-2 col-xs-12" style={{ display: "flex", gap: 8 }}>
          <button type="button" className="it-btn btn-block convience" onClick={view}>Check Outstanding</button>
          <button type="button" className="it-btn btn-block" style={{ width: "auto" }} onClick={send}>Send Mail</button>
        </div>
      </div>
      <br />
      {bound && (
        <div className="grid-view" style={{ overflowX: "auto" }}>
          <table id="gv_outstanding" className="table dt-grid" style={{ width: "100%", background: "#fff", fontSize: "x-small" }}>
            <thead><tr><th>Sr No.</th>{cols.slice(1).map((c) => <th key={c}>{c}</th>)}</tr></thead>
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

/* ================= shell ================= */
const TABS = [
  { key: "menu1", label: "Receipt" }, { key: "menu2", label: "Receipt Details" },
  { key: "menu3", label: "Payment" }, { key: "menu4", label: "Sales Entry" },
  { key: "menu5", label: "Upload Ledger" }, { key: "menu6", label: "Send Outsanding Mail" },
];

export default function AccountReports() {
  const [hidtab, setHidtab] = useState("menu1");
  const [msg, setMsg] = useState({ text: "", ok: true });
  const show = (text: string, ok = true) => setMsg({ text, ok });
  const openHelp = () => {
    window.open("html/Account_report.html", "popUpWindow",
      "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No");
  };
  return (
    <div className="container-fluid itmaster">
      <div className="lg-panel" style={{ marginBottom: 0 }}>
        <div className="lg-panel-head">
          <div className="row">
            <div className="col-sm-10">
              <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase"><b>Payment History</b></div>
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
            {hidtab === "menu1" && <TabReceipt show={show} msg={msg} />}
            {hidtab === "menu2" && <TabReceiptDetails show={show} />}
            {hidtab === "menu3" && <TabPayment show={show} />}
            {hidtab === "menu4" && <TabSales />}
            {hidtab === "menu5" && <TabLedger show={show} />}
            {hidtab === "menu6" && <TabOutstanding show={show} />}
          </div>
        </div>
      </div>
    </div>
  );
}
