"use client";
/**
 * CR-Note / Manual Invoice - port of credit_note.aspx (four tabs).
 *  0 Credit Debit Note        : Process -> Submit -> GST auto-calc -> Save, CR Exl, CR Invoice, CR Final Invoice, status grid
 *  1 Manual Invoice           : entry (+ mandatory attachment), Edit / Update / Remove, Final Invoice
 *  2 Final Credit/Debit Note  : history by client + month + note type, CR Exl, CR Invoice
 *  3 Add Manual Invoice In System : history table entry (credit note / manual other)
 * PDFs (CR Invoice / Final Invoice / manual invoice print) are drawn by the backend on the LEGACY .rpt layouts.
 */
import React, { useCallback, useEffect, useState } from "react";
import { getJSON, mk } from "@/lib/api/legacy-fetch";
import { API_BASE_URL, drfErrorText } from "@/lib/api/client";

const CN = "/api/transactions/credit-notes/";
const MI = "/api/transactions/manual-invoices/";
type Row = Record<string, any>;
interface Client { client_code: string; client_name: string }

const GST_OPTS: [string, string][] = [["R", "Regular"], ["SEWP", "SEZ supplies with payment"], ["SEWOP", "SEZ supplies without payment"],
  ["DE", "Deemed Exp"], ["SCU", "Supplies covered under section 7 of IGST Acts"]];
const BILL_TYPES = ["Manpower", "Material", "Conveyance", "Machine Rental", "Admin Expense", "Other"];

const th: React.CSSProperties = { backgroundColor: "#006699", color: "#fff", padding: 6, border: "1px solid #ccc", fontSize: 11 };
const td: React.CSSProperties = { padding: 5, border: "1px solid #ccc", fontSize: 11 };

async function send(path: string, body: any): Promise<any> {
  const r = await mk(path, body);
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(drfErrorText(d) || `Request failed (${r.status})`);
  return d;
}
async function sendForm(path: string, fd: FormData): Promise<any> {
  await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  const r = await fetch(`${API_BASE_URL}${path}`, { method: "POST", credentials: "include",
    headers: { "X-CSRFToken": m ? decodeURIComponent(m[1]) : "" }, body: fd });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(drfErrorText(d) || `Request failed (${r.status})`);
  return d;
}
async function getStrict(path: string): Promise<any> {
  const r = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(drfErrorText(d) || `Request failed (${r.status})`);
  return d;
}
async function download(path: string) {
  const r = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(drfErrorText(d) || "No Matching Records Found."); }
  const cd = r.headers.get("content-disposition") || "";
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] || "download";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await r.blob()); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
async function downloadPost(path: string, body: any) {
  const r = await mk(path, body);
  const ct = r.headers.get("content-type") || "";
  if (!r.ok || !ct.includes("pdf")) { const d = await r.json().catch(() => null); throw new Error(drfErrorText(d) || d?.detail || `Request failed (${r.status})`); }
  const cd = r.headers.get("content-disposition") || "";
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] || "document.pdf";
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await r.blob()); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
const monthNow = () => { const d = new Date(); return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; };
const num = (v: any) => { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return Number.isFinite(n) ? n : 0; };
const toIso = (dmy: string) => { const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(dmy || ""); return m ? `${m[3]}-${m[2]}-${m[1]}` : ""; };
const fromIso = (iso: string) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ""); return m ? `${m[3]}/${m[2]}/${m[1]}` : ""; };

export default function CreditNotePage() {
  const [tab, setTab] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  useEffect(() => { getJSON<{ results: Client[] }>(`${CN}clients/`).then((d) => setClients(d?.results ?? [])); }, []);
  const tabs = ["Credit Debit Note", "Manual Invoice", "Final Credit/Debit Note", "Add Manual Invoice In System"];
  return (
    <div className="container-fluid">
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: 4 }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px" }}>
          <div className="text-center text-uppercase" style={{ fontSize: "small" }}><b>CR-Note/Manual Invoice</b></div>
        </div>
        <div className="panel-body" style={{ padding: 15 }}>
          <ul className="nav nav-tabs" style={{ background: "#f3f1fe", display: "flex", gap: 4, listStyle: "none", paddingLeft: 0, borderBottom: "1px solid #ddd" }}>
            {tabs.map((t, i) => (
              <li key={t} className={tab === i ? "active" : ""} style={{ background: tab === i ? "#fff" : undefined }}>
                <a href="#" onClick={(e) => { e.preventDefault(); setTab(i); }} style={{ padding: "8px 14px", display: "block" }}><b>{t}</b></a>
              </li>))}
          </ul>
          <div style={{ paddingTop: 15 }}>
            {tab === 0 && <NoteTab clients={clients} />}
            {tab === 1 && <ManualTab clients={clients} />}
            {tab === 2 && <HistoryTab clients={clients} />}
            {tab === 3 && <SystemTab clients={clients} />}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- tab 0 */
function NoteTab({ clients }: { clients: Client[] }) {
  const [noteType, setNoteType] = useState("Select");
  const [client, setClient] = useState("Select");
  const [month, setMonth] = useState(monthNow());
  const [checks, setChecks] = useState<Row[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [details, setDetails] = useState<Row[]>([]);
  const [dsel, setDsel] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<Row[]>([]);
  const loadStatus = useCallback(async (c: string) => {
    const d = await getJSON<{ results: Row[] }>(`${CN}${c && c !== "Select" ? `?client_code=${encodeURIComponent(c)}` : ""}`);
    setStatus(d?.results ?? []);
  }, []);
  useEffect(() => { loadStatus("Select"); }, [loadStatus]);

  const process = async () => {
    if (noteType === "Select") { alert("Please Select Credit Note"); return; }
    if (client === "Select") { alert("Please Select Client"); return; }
    try {
      const d = await getStrict(`${CN}invoices/?note_type=${noteType}&client_code=${encodeURIComponent(client)}&month=${encodeURIComponent(month)}`);
      setChecks(d.results ?? []); setSel({}); setDetails([]);
    } catch (e: any) { alert(e.message); }
  };
  const submit = async () => {
    const invoices = checks.filter((r) => sel[r.invoice_no]).map((r) => r.invoice_no);
    try {
      const d = await send(`${CN}submit/`, { client_code: client, month, note_type: noteType, invoices });
      setDetails(d.results ?? []); setDsel({}); setChecks([]);
    } catch (e: any) { alert(e.message); }
  };
  // txt_amount_TextChanged: 9 % / 9 % / 18 % of the taxable amount for the boxes that are non-zero
  const recalc = (i: number, amount: string) => {
    setDetails((p) => p.map((r, j) => {
      if (j !== i) return r;
      const a = num(amount);
      const cg = num(r.cgst) !== 0 ? a * 0.09 : 0, sg = num(r.sgst) !== 0 ? a * 0.09 : 0, ig = num(r.igst) !== 0 ? a * 0.18 : 0;
      return { ...r, amount, cgst: cg, sgst: sg, igst: ig, total: cg + sg + ig + a };
    }));
  };
  const setField = (i: number, k: string, v: string) => setDetails((p) => p.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const rowsPayload = () => details.map((r) => ({ ...r, checked: !!dsel[r.invoice_no] }));
  const save = async () => {
    try {
      const d = await send(`${CN}save/`, { client_code: client, note_type: noteType, rows: rowsPayload() });
      alert(d.message); await loadStatus(client);
    } catch (e: any) { alert(e.message); }
  };
  const picked = () => details.filter((r) => dsel[r.invoice_no]).map((r) => r.invoice_no);
  const exl = async () => {
    if (picked().length === 0) { alert("Please Select Invoice !!!"); return; }
    try { await download(`${CN}export/?note_type=${noteType}&client_code=${encodeURIComponent(client)}&invoices=${encodeURIComponent(picked().join(","))}`); }
    catch (e: any) { alert(e.message); }
  };
  const crInvoice = async () => {
    if (picked().length === 0) { alert("Please Select Invoice !!!"); return; }
    try { await downloadPost(`${CN}invoice/`, { invoices: picked(), note_type: noteType, client_code: client }); }
    catch (e: any) { alert(e.message); }
  };
  const crFinal = async () => {
    if (picked().length === 0) { alert("Please Select Invoice !!!"); return; }
    if (!window.confirm("Are you sure want to Final Invoice Print?")) return;
    try {
      const d = await send(`${CN}final/`, { client_code: client, note_type: noteType, month, rows: rowsPayload() });
      alert(`${d.message}\n\n${d.detail ?? ""}`); await loadStatus(client);
      if (d.pdf_url) await download(d.pdf_url);
    } catch (e: any) { alert(e.message); }
  };
  const remove = async (no: string) => {
    if (!window.confirm("Are you Sure You Want to Delete Record")) return;
    try { const d = await send(`${CN}remove/`, { credit_note_no: no }); alert(d.message); await loadStatus(client); }
    catch (e: any) { alert(e.message); }
  };

  return (
    <div>
      <div className="row">
        <div className="col-sm-3"><b>Note Type :</b>
          <select className="form-control" value={noteType} onChange={(e) => setNoteType(e.target.value)}>
            <option value="Select">Select</option><option value="1">Credit Note</option><option value="2">Debit Note</option>
          </select></div>
        <div className="col-sm-3"><b>Client Name :</b>
          <select className="form-control" value={client} onChange={(e) => { setClient(e.target.value); loadStatus(e.target.value); }}>
            <option value="Select">Select</option>
            {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
          </select></div>
        <div className="col-sm-2"><b>Month :</b><input className="form-control" value={month} onChange={(e) => setMonth(e.target.value)} placeholder="mm/yyyy" /></div>
        <div className="col-sm-2"><br /><button className="btn btn-primary" onClick={process}>Process</button></div>
      </div>
      <br />
      {checks.length > 0 && (
        <div>
          <table className="table" style={{ width: "100%" }}>
            <thead><tr><th style={th}></th><th style={th}>Invoice No</th><th style={th}>State</th><th style={th}>Type</th></tr></thead>
            <tbody>{checks.map((r) => (
              <tr key={r.invoice_no}>
                <td style={td}><input type="checkbox" checked={!!sel[r.invoice_no]} onChange={(e) => setSel({ ...sel, [r.invoice_no]: e.target.checked })} /></td>
                <td style={td}>{r.invoice_no}</td><td style={td}>{r.state_name}</td><td style={td}>{r.type}</td>
              </tr>))}</tbody>
          </table>
          <button className="btn btn-primary" onClick={submit}>Submit</button>
        </div>
      )}
      {details.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%" }}>
            <thead><tr>{["", "Invoice No", "Bill Date", "Credit Note Date (dd/mm/yyyy)", "Client", "State", "Type", "GST No", "Amount", "CGST", "SGST", "IGST", "Total", "Description"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{details.map((r, i) => (
              <tr key={r.invoice_no}>
                <td style={td}><input type="checkbox" disabled={r.final} checked={!!dsel[r.invoice_no] || r.final} onChange={(e) => setDsel({ ...dsel, [r.invoice_no]: e.target.checked })} /></td>
                <td style={td}>{r.invoice_no}</td><td style={td}>{r.invoice_date}</td>
                <td style={td}><input className="form-control" style={{ width: 110 }} value={r.credit_note_date} onChange={(e) => setField(i, "credit_note_date", e.target.value)} placeholder="dd/mm/yyyy" /></td>
                <td style={td}>{r.client_name}</td><td style={td}>{r.state_name}</td><td style={td}>{r.type}</td><td style={td}>{r.gst_no}</td>
                <td style={td}><input className="form-control" style={{ width: 90 }} value={r.amount} onChange={(e) => recalc(i, e.target.value)} /></td>
                <td style={td}><input className="form-control" style={{ width: 80 }} value={r.cgst} onChange={(e) => setField(i, "cgst", e.target.value)} /></td>
                <td style={td}><input className="form-control" style={{ width: 80 }} value={r.sgst} onChange={(e) => setField(i, "sgst", e.target.value)} /></td>
                <td style={td}><input className="form-control" style={{ width: 80 }} value={r.igst} onChange={(e) => setField(i, "igst", e.target.value)} /></td>
                <td style={td}><input className="form-control" style={{ width: 90 }} value={r.total} readOnly /></td>
                <td style={td}><input className="form-control" style={{ width: 160 }} value={r.description_cr} onChange={(e) => setField(i, "description_cr", e.target.value)} /></td>
              </tr>))}</tbody>
          </table>
          <div className="text-center">
            <button className="btn btn-primary" onClick={save} style={{ marginRight: 6 }}>Save</button>
            <button className="btn btn-primary" onClick={exl} style={{ marginRight: 6 }}>CR Exl</button>
            <button className="btn btn-primary" onClick={crInvoice} style={{ marginRight: 6 }}>CR Invoice</button>
            <button className="btn btn-primary" onClick={crFinal}>CR Final Invoice</button>
          </div>
        </div>
      )}
      <br />
      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ width: "100%" }}>
          <thead><tr>{["", "Type", "Note No", "Client", "Month", "Year", "Original Bill No", "Bill Date", "GST No", "State", "Taxable", "CGST", "SGST", "IGST", "Total", "Status", "Description"].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {status.map((r) => (
              <tr key={r.id}>
                <td style={td}>{String(r.aa) === "1" ? null : <a href="#" onClick={(e) => { e.preventDefault(); remove(r.credit_note_no); }}><img src="/Images/delete_icon.png" width={15} height={15} alt="remove" /></a>}</td>
                <td style={td}>{r.type_label}</td><td style={td}>{r.credit_note_no}</td><td style={td}>{r.client_name}</td><td style={td}>{r.month}</td>
                <td style={td}>{r.year}</td><td style={td}>{r.original_bill_no}</td><td style={td}>{r.bill_date}</td><td style={td}>{r.gst_no}</td>
                <td style={td}>{r.state_name}</td><td style={td}>{r.taxable_amt}</td><td style={td}>{r.cgst}</td><td style={td}>{r.sgst}</td>
                <td style={td}>{r.igst}</td><td style={td}>{r.total}</td><td style={td}>{r.final_label}</td><td style={td}>{r.description_cr}</td>
              </tr>))}
            {status.length === 0 && <tr><td colSpan={17} style={{ ...td, textAlign: "center" }}>No Record Found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- tab 1 */
const blankManual = () => ({ manual_invoice_type: "Select", client_code: "ALL", client_name: "", manual_invoice_bill_type: "Select", state_name: "Select",
  unit_code: "ALL", manual_region: "", invoice_no: "", gst_no: "", sac_code: "", manual_month: monthNow(), gst_to_be: "Select", amount: "0",
  cgst: "0", sgst: "0", igst: "0", manual_grand_total: "0", po_no_gst: "", description: "", bill_to_party: "", invoice_category: "",
  gst_address: "", bill_shipping_add: "", invoice_date: "" });

function ManualTab({ clients }: { clients: Client[] }) {
  const [f, setF] = useState<Row>(blankManual());
  const [file, setFile] = useState<File | null>(null);
  const [states, setStates] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [final, setFinal] = useState(false);
  const other = f.manual_invoice_type === "1";

  const load = useCallback(async (t: string, m: string) => {
    const d = await getJSON<{ results: Row[] }>(`${MI}?${t === "0" || t === "1" ? `manual_invoice_type=${t}&` : ""}month=${encodeURIComponent(m)}`);
    setRows(d?.results ?? []);
  }, []);
  useEffect(() => { load(f.manual_invoice_type, f.manual_month); }, [load, f.manual_invoice_type, f.manual_month]);
  useEffect(() => {
    getJSON<{ h: string }>(`${MI}sac/`).then((d) => setF((p) => (p.sac_code ? p : { ...p, sac_code: d?.h ?? "" })));
  }, []);

  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const calc = (patch: Row) => setF((p) => {
    const n = { ...p, ...patch };
    n.manual_grand_total = String(num(n.amount) + num(n.cgst) + num(n.sgst) + num(n.igst));
    return n;
  });
  const onClient = async (code: string) => {
    const c = clients.find((x) => x.client_code === code);
    setF((p) => ({ ...p, client_code: code, client_name: c?.client_name ?? "", state_name: "Select", gst_no: "" }));
    if (code === "ALL") { setStates([]); return; }
    const d = await getJSON<{ results: string[] }>(`${MI}states/?client_code=${encodeURIComponent(code)}`);
    setStates(d?.results ?? []);
  };
  const onState = async (s: string) => {
    set("state_name", s);
    if (!other && f.client_code !== "ALL" && s !== "Select") {
      const d = await getJSON<{ gst_no: string }>(`${MI}gst_number/?client_code=${encodeURIComponent(f.client_code)}&state=${encodeURIComponent(s)}`);
      set("gst_no", d?.gst_no ?? "");
    }
  };
  const clear = () => { setF({ ...blankManual(), sac_code: f.sac_code }); setFile(null); setEditId(null); setFinal(false); };

  const save = async () => {
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.append(k, String(v ?? "")));
    if (file) fd.append("attachment", file);
    try { const d = await sendForm(MI, fd); alert(d.message); clear(); load(f.manual_invoice_type, f.manual_month); }
    catch (e: any) { alert(e.message); }
  };
  const edit = async (r: Row) => {
    const d = await getJSON<Row>(`${MI}${r.id}/`);
    if (!d) return;
    setEditId(r.id); setFinal(String(d.final_invoice) === "1");
    setF({ ...blankManual(), manual_invoice_type: String(r.manual_invoice_type === "Other" ? "1" : "0"), client_code: d.client_code || "ALL",
      client_name: d.client_name, state_name: d.state_name, unit_code: d.unit_code || "ALL", manual_region: d.manual_region || "", invoice_no: d.invoice_no || "",
      gst_no: d.gst_no || "", sac_code: d.sac_code || "", manual_month: d.manual_month || monthNow(), gst_to_be: d.gst_to_be_code || "Select",
      amount: String(d.amount ?? 0), cgst: String(d.cgst ?? 0), sgst: String(d.sgst ?? 0), igst: String(d.igst ?? 0),
      manual_grand_total: String(d.manual_grand_total ?? 0), po_no_gst: d.po_no_gst || "", description: d.description || "",
      manual_invoice_bill_type: d.manual_invoice_bill_type || "Select", bill_to_party: d.bill_to_party || d.client_name || "",
      invoice_category: d.invoice_category || "", gst_address: d.gst_address || "", bill_shipping_add: d.bill_shipping_add || "",
      invoice_date: toIso(String(d.invoice_date || "").replace(/-/g, "/")) });
  };
  const update = async () => {
    if (editId == null) return;
    try { const d = await send(`${MI}${editId}/update_invoice/`, f); alert(d.message); clear(); load(f.manual_invoice_type, f.manual_month); }
    catch (e: any) { alert(e.message); }
  };
  const remove = async (id: number) => {
    if (!window.confirm("Are you Sure You Want to Delete Record")) return;
    try { await send(`${MI}${id}/remove/`, {}); load(f.manual_invoice_type, f.manual_month); } catch (e: any) { alert(e.message); }
  };
  const finalInvoice = async () => {
    if (editId == null) { alert("Please Select Invoice Date !!"); return; }
    if (!f.invoice_date) { alert("Please Enter Invoice Date"); return; }
    if (!window.confirm("Are you Sure You Want to Final Invoice")) return;
    try {
      const d = await send(`${MI}${editId}/final/`, { invoice_date: fromIso(f.invoice_date) });
      alert(`${d.message}\n\nInvoice No: ${d.invoice_no}\n${d.detail ?? ""}`);
      if (d.pdf_url) await download(d.pdf_url).catch((x) => alert(x.message));
      clear(); load(f.manual_invoice_type, f.manual_month);
    } catch (e: any) { alert(e.message); }
  };
  const exl = async () => {
    try { await download(`${MI}export/?manual_invoice_type=${f.manual_invoice_type}&month=${encodeURIComponent(f.manual_month)}`); }
    catch (e: any) { alert(e.message); }
  };
  const inp = (k: string, label: string, props: any = {}) => (
    <div className="col-sm-3" style={{ marginBottom: 8 }}><b>{label}</b>
      <input className="form-control" value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} {...props} /></div>);
  const stateSelect = (
    <div className="col-sm-3" style={{ marginBottom: 8 }}><b>State Name :</b>
      <select className="form-control" value={f.state_name} onChange={(e) => onState(e.target.value)}>
        <option value="Select">Select</option>{states.map((s) => <option key={s} value={s}>{s}</option>)}
      </select></div>);
  return (
    <div>
      <div className="row">
        <div className="col-sm-3" style={{ marginBottom: 8 }}><b>Manual Invoice Type :</b>
          <select className="form-control" value={f.manual_invoice_type} disabled={editId != null} onChange={(e) => set("manual_invoice_type", e.target.value)}>
            <option value="Select">Select</option><option value="0">Clientwise</option><option value="1">Other</option>
          </select></div>
        {!other && (
          <div className="col-sm-3" style={{ marginBottom: 8 }}><b>Client Name :</b>
            <select className="form-control" value={f.client_code} disabled={editId != null} onChange={(e) => onClient(e.target.value)}>
              <option value="ALL">ALL</option>{clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
            </select></div>)}
        {!other && (
          <div className="col-sm-3" style={{ marginBottom: 8 }}><b>Billing Type :</b>
            <select className="form-control" value={f.manual_invoice_bill_type} onChange={(e) => set("manual_invoice_bill_type", e.target.value)}>
              <option value="Select">Select</option>{BILL_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}
            </select></div>)}
        {!other ? stateSelect : null}
        {other && inp("bill_to_party", "Bill To Party :")}
        {other && inp("invoice_category", "Invoice Category :")}
        {other && inp("gst_address", "GST Address :")}
        {other && inp("bill_shipping_add", "Bill Shipping Address :")}
        {other && stateSelect}
        {inp("invoice_no", "Invoice No :", { disabled: editId != null })}
        {inp("gst_no", "GST No :")}
        {inp("sac_code", "SAC Code :")}
        {inp("manual_month", "Month (mm/yyyy) :", { placeholder: "mm/yyyy" })}
        <div className="col-sm-3" style={{ marginBottom: 8 }}><b>GST to be Paid :</b>
          <select className="form-control" value={f.gst_to_be} onChange={(e) => set("gst_to_be", e.target.value)}>
            <option value="Select">Select</option>{GST_OPTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select></div>
        <div className="col-sm-3" style={{ marginBottom: 8 }}><b>Amount :</b><input className="form-control" value={f.amount} onChange={(e) => calc({ amount: e.target.value })} /></div>
        <div className="col-sm-3" style={{ marginBottom: 8 }}><b>CGST :</b><input className="form-control" value={f.cgst} onChange={(e) => calc({ cgst: e.target.value })} /></div>
        <div className="col-sm-3" style={{ marginBottom: 8 }}><b>SGST :</b><input className="form-control" value={f.sgst} onChange={(e) => calc({ sgst: e.target.value })} /></div>
        <div className="col-sm-3" style={{ marginBottom: 8 }}><b>IGST :</b><input className="form-control" value={f.igst} onChange={(e) => calc({ igst: e.target.value })} /></div>
        <div className="col-sm-3" style={{ marginBottom: 8 }}><b>Grand Total :</b><input className="form-control" value={f.manual_grand_total} readOnly /></div>
        {inp("po_no_gst", "PO No :")}
        {inp("description", "Description :")}
        {editId != null && <div className="col-sm-3" style={{ marginBottom: 8 }}><b>Invoice Date :</b>
          <input type="date" className="form-control" value={f.invoice_date} onChange={(e) => set("invoice_date", e.target.value)} /></div>}
        {editId == null && <div className="col-sm-3" style={{ marginBottom: 8 }}><b>Attachment :</b>
          <input type="file" accept=".jpg,.jpeg,.png,.pdf,.zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>}
      </div>
      <div className="text-center">
        {editId == null && <button className="btn btn-primary" onClick={save} style={{ marginRight: 6 }}>Save</button>}
        {editId != null && !final && <button className="btn btn-primary" onClick={update} style={{ marginRight: 6 }}>Update</button>}
        {editId != null && <button className="btn btn-primary" onClick={finalInvoice} style={{ marginRight: 6 }}>Final Invoice</button>}
        <button className="btn btn-primary" onClick={clear} style={{ marginRight: 6 }}>Clear</button>
        <button className="btn btn-primary" onClick={exl}>Excel</button>
      </div>
      <br />
      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ width: "100%" }}>
          <thead><tr>{["", "Client", "State", "Invoice No", "Invoice Date", "Amount", "Total", "IGST", "CGST", "SGST", "Month", "Status", "Type", "GST", "Region", "Description", "Billing Type", "File"].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={td}>
                  <a href="#" onClick={(e) => { e.preventDefault(); edit(r); }} style={{ marginRight: 6 }}>Edit</a>
                  {String(r.final_invoice) === "0" && <a href="#" onClick={(e) => { e.preventDefault(); remove(r.id); }}><img src="/Images/delete_icon.png" width={15} height={15} alt="remove" /></a>}
                </td>
                <td style={td}>{r.client_name}</td><td style={td}>{r.state_name}</td><td style={td}>{r.invoice_no}</td><td style={td}>{r.invoice_date}</td>
                <td style={td}>{r.amount}</td><td style={td}>{r.manual_grand_total}</td><td style={td}>{r.igst}</td><td style={td}>{r.cgst}</td><td style={td}>{r.sgst}</td>
                <td style={td}>{r.manual_month}</td><td style={td}>{r.final_invoice_check}</td><td style={td}>{r.manual_invoice_type}</td><td style={td}>{r.gst_to_be}</td>
                <td style={td}>{r.manual_region}</td><td style={td}>{r.description}</td><td style={td}>{r.manual_invoice_bill_type}</td>
                <td style={td}>{r.manual_invoicefile ? <a href="#" onClick={(e) => { e.preventDefault(); download(`${MI}${r.id}/download/`).catch((x) => alert(x.message)); }}>Download</a> : null}
                  {r.invoice_no ? <a href="#" style={{ marginLeft: 6 }} onClick={(e) => { e.preventDefault(); download(`${MI}${r.id}/pdf/`).catch((x) => alert(x.message)); }}>Print</a> : null}</td>
              </tr>))}
            {rows.length === 0 && <tr><td colSpan={18} style={{ ...td, textAlign: "center" }}>No Record Found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- tab 2 */
function HistoryTab({ clients }: { clients: Client[] }) {
  const [noteType, setNoteType] = useState("Select");
  const [client, setClient] = useState("Select");
  const [month, setMonth] = useState(monthNow());
  const [rows, setRows] = useState<Row[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const process = async () => {
    if (noteType === "Select") { alert("Please Select Note Type"); return; }
    if (client === "Select") { alert("Please Select Client"); return; }
    try {
      const d = await getStrict(`${CN}history/?note_type=${noteType}&client_code=${encodeURIComponent(client)}&month=${encodeURIComponent(month)}`);
      setRows(d.results ?? []); setSel({});
    } catch (e: any) { alert(e.message); }
  };
  const picked = () => rows.filter((r) => sel[r.original_bill_no]).map((r) => r.original_bill_no);
  const exl = async () => {
    if (picked().length === 0) { alert("Please Select Invoice !!!"); return; }
    try { await download(`${CN}history_export/?note_type=${noteType}&client_code=${encodeURIComponent(client)}&invoices=${encodeURIComponent(picked().join(","))}`); }
    catch (e: any) { alert(e.message); }
  };
  const inv = async () => {
    if (picked().length === 0) { alert("Please Select Invoice !!!"); return; }
    try {
      await downloadPost(`${CN}history_invoice/`, { invoices: picked(), note_type: noteType,
        numbers: rows.filter((r) => sel[r.original_bill_no]).map((r) => r.credit_note_no) });
    } catch (e: any) { alert(e.message); }
  };
  return (
    <div>
      <div className="row">
        <div className="col-sm-3"><b>Note Type :</b>
          <select className="form-control" value={noteType} onChange={(e) => setNoteType(e.target.value)}>
            <option value="Select">Select</option><option value="1">Credit Note</option><option value="2">Debit Note</option>
          </select></div>
        <div className="col-sm-3"><b>Client Name :</b>
          <select className="form-control" value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="Select">Select</option>{clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
          </select></div>
        <div className="col-sm-2"><b>Month :</b><input className="form-control" value={month} onChange={(e) => setMonth(e.target.value)} placeholder="mm/yyyy" /></div>
        <div className="col-sm-2"><br /><button className="btn btn-primary" onClick={process}>Process</button></div>
      </div>
      <br />
      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ width: "100%" }}>
            <thead><tr>{["", "Type", "Note No", "Client", "Month", "Year", "Original Bill No", "Bill Date", "GST No", "Taxable", "CGST", "SGST", "IGST", "Total", "Description"].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.credit_note_no}>
                <td style={td}><input type="checkbox" checked={!!sel[r.original_bill_no]} onChange={(e) => setSel({ ...sel, [r.original_bill_no]: e.target.checked })} /></td>
                <td style={td}>{r.type_label}</td><td style={td}>{r.credit_note_no}</td><td style={td}>{r.client_name}</td><td style={td}>{r.month}</td><td style={td}>{r.year}</td>
                <td style={td}>{r.original_bill_no}</td><td style={td}>{r.bill_date}</td><td style={td}>{r.gst_no}</td><td style={td}>{r.taxable_amt}</td>
                <td style={td}>{r.cgst}</td><td style={td}>{r.sgst}</td><td style={td}>{r.igst}</td><td style={td}>{r.total}</td><td style={td}>{r.description_cr}</td>
              </tr>))}</tbody>
          </table>
          <div className="text-center">
            <button className="btn btn-primary" onClick={exl} style={{ marginRight: 6 }}>CR Exl</button>
            <button className="btn btn-primary" onClick={inv}>CR Invoice</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- tab 3 */
const blankSys = () => ({ bill_type: "manual_other", credit_invoice_no: "", client_code: "ALL", client_name: "", state_name: "Select", manual_region: "",
  invoice_no: "", invoice_date: "", gst_no: "", sac_code: "", manual_month: monthNow(), gst_to_be: "R", amount: "0", cgst: "0", sgst: "0", igst: "0",
  manual_grand_total: "0", concern_person: "", description: "" });
function SystemTab({ clients }: { clients: Client[] }) {
  const [f, setF] = useState<Row>(blankSys());
  const [file, setFile] = useState<File | null>(null);
  const [states, setStates] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [editId, setEditId] = useState<number | null>(null);
  const [fc, setFc] = useState("ALL");
  const load = useCallback(async () => {
    const d = await getJSON<{ results: Row[] }>(`${MI}history_list/?bill_type=${f.bill_type}&client_code=${encodeURIComponent(fc)}`);
    setRows(d?.results ?? []);
  }, [f.bill_type, fc]);
  useEffect(() => { load(); }, [load]);
  const set = (k: string, v: any) => setF((p) => ({ ...p, [k]: v }));
  const calc = (patch: Row) => setF((p) => {
    const n = { ...p, ...patch };
    n.manual_grand_total = String(num(n.amount) + num(n.cgst) + num(n.sgst) + num(n.igst));
    return n;
  });
  const onClient = async (code: string) => {
    const c = clients.find((x) => x.client_code === code);
    setF((p) => ({ ...p, client_code: code, client_name: c?.client_name ?? "", state_name: "Select", gst_no: "" }));
    if (code === "ALL") { setStates([]); return; }
    const d = await getJSON<{ results: string[] }>(`${MI}states/?client_code=${encodeURIComponent(code)}`);
    setStates(d?.results ?? []);
  };
  const clear = () => { setF(blankSys()); setFile(null); setEditId(null); };
  const save = async () => {
    const fd = new FormData();
    Object.entries({ ...f, invoice_date: fromIso(f.invoice_date) }).forEach(([k, v]) => fd.append(k, String(v ?? "")));
    if (file) fd.append("attachment", file);
    try { const d = await sendForm(`${MI}history_create/`, fd); alert(d.message); clear(); load(); }
    catch (e: any) { alert(e.message); }
  };
  const pick = (r: Row) => {
    setEditId(r.id);
    setF({ ...blankSys(), bill_type: r.type, client_code: r.client_code || "ALL", client_name: r.client_name, state_name: r.state_name, invoice_no: r.invoice_no,
      invoice_date: toIso(String(r.invoice_date || "").replace(/-/g, "/")), gst_no: r.gst_no || "", sac_code: r.sac_code || "", manual_month: r.manual_month || monthNow(),
      gst_to_be: r.gst_to_be_code || "R", amount: String(r.amount ?? 0), cgst: String(r.cgst ?? 0), sgst: String(r.sgst ?? 0), igst: String(r.igst ?? 0),
      manual_grand_total: String(r.manual_grand_total ?? 0), concern_person: r.concern_person || "", description: r.description || "", manual_region: r.manual_region || "" });
  };
  const update = async () => {
    if (editId == null) return;
    try { const d = await send(`${MI}${editId}/history_update/`, { ...f, invoice_date: fromIso(f.invoice_date) }); alert(d.message); clear(); load(); }
    catch (e: any) { alert(e.message); }
  };
  const remove = async (id: number) => {
    if (!window.confirm("Are you Sure You Want to Delete Record")) return;
    try { await send(`${MI}${id}/history_remove/`, {}); load(); } catch (e: any) { alert(e.message); }
  };
  const inp = (k: string, label: string, props: any = {}) => (
    <div className="col-sm-3" style={{ marginBottom: 8 }}><b>{label}</b>
      <input className="form-control" value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} {...props} /></div>);
  return (
    <div>
      <div className="row">
        <div className="col-sm-3" style={{ marginBottom: 8 }}><b>Bill Type :</b>
          <select className="form-control" value={f.bill_type} disabled={editId != null} onChange={(e) => set("bill_type", e.target.value)}>
            <option value="manual_other">Manual Other Invoice</option><option value="credit">Credit Note</option>
          </select></div>
        {f.bill_type === "credit" && inp("credit_invoice_no", "Credit Invoice No :")}
        <div className="col-sm-3" style={{ marginBottom: 8 }}><b>Client Name :</b>
          <select className="form-control" value={f.client_code} disabled={editId != null} onChange={(e) => onClient(e.target.value)}>
            <option value="ALL">ALL</option>{clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
          </select></div>
        <div className="col-sm-3" style={{ marginBottom: 8 }}><b>State Name :</b>
          <select className="form-control" value={f.state_name} onChange={(e) => set("state_name", e.target.value)}>
            <option value="Select">Select</option>
            {(states.includes(f.state_name) || f.state_name === "Select" ? states : [f.state_name, ...states]).map((s) => <option key={s} value={s}>{s}</option>)}
          </select></div>
        {inp("invoice_no", "Invoice No :", { disabled: editId != null })}
        <div className="col-sm-3" style={{ marginBottom: 8 }}><b>Invoice Date :</b>
          <input type="date" className="form-control" value={f.invoice_date} onChange={(e) => set("invoice_date", e.target.value)} /></div>
        {inp("gst_no", "GST No :")}
        {inp("sac_code", "SAC Code :")}
        {inp("manual_month", "Month (mm/yyyy) :")}
        <div className="col-sm-3" style={{ marginBottom: 8 }}><b>GST to be Paid :</b>
          <select className="form-control" value={f.gst_to_be} onChange={(e) => set("gst_to_be", e.target.value)}>
            <option value="Select">Select</option>{GST_OPTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select></div>
        <div className="col-sm-3" style={{ marginBottom: 8 }}><b>Amount :</b><input className="form-control" value={f.amount} onChange={(e) => calc({ amount: e.target.value })} /></div>
        <div className="col-sm-3" style={{ marginBottom: 8 }}><b>CGST :</b><input className="form-control" value={f.cgst} onChange={(e) => calc({ cgst: e.target.value })} /></div>
        <div className="col-sm-3" style={{ marginBottom: 8 }}><b>SGST :</b><input className="form-control" value={f.sgst} onChange={(e) => calc({ sgst: e.target.value })} /></div>
        <div className="col-sm-3" style={{ marginBottom: 8 }}><b>IGST :</b><input className="form-control" value={f.igst} onChange={(e) => calc({ igst: e.target.value })} /></div>
        <div className="col-sm-3" style={{ marginBottom: 8 }}><b>Grand Total :</b><input className="form-control" value={f.manual_grand_total} readOnly /></div>
        {inp("concern_person", "Concern Person :")}
        {inp("description", "Description :")}
        {editId == null && <div className="col-sm-3" style={{ marginBottom: 8 }}><b>Attachment :</b>
          <input type="file" accept=".jpg,.jpeg,.png,.pdf,.zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>}
      </div>
      <div className="text-center">
        {editId == null && <button className="btn btn-primary" onClick={save} style={{ marginRight: 6 }}>Save</button>}
        {editId != null && <button className="btn btn-primary" onClick={update} style={{ marginRight: 6 }}>Update</button>}
        <button className="btn btn-primary" onClick={clear}>Clear</button>
      </div>
      <br />
      <div className="row"><div className="col-sm-3"><b>Filter Client :</b>
        <select className="form-control" value={fc} onChange={(e) => setFc(e.target.value)}>
          <option value="ALL">ALL</option>{clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
        </select></div></div>
      <div style={{ overflowX: "auto" }}>
        <table className="table" style={{ width: "100%" }}>
          <thead><tr>{["", "Reference", "Client", "State", "Invoice No", "Invoice Date", "Amount", "Total", "Month", "GST", "Concern Person", "Description", "File"].map((h, i) => <th key={i} style={th}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td style={td}><a href="#" onClick={(e) => { e.preventDefault(); pick(r); }} style={{ marginRight: 6 }}>Select</a>
                  <a href="#" onClick={(e) => { e.preventDefault(); remove(r.id); }}><img src="/Images/delete_icon.png" width={15} height={15} alt="remove" /></a></td>
                <td style={td}>{r.reference_code}</td><td style={td}>{r.client_name}</td><td style={td}>{r.state_name}</td><td style={td}>{r.invoice_no}</td>
                <td style={td}>{r.invoice_date}</td><td style={td}>{r.amount}</td><td style={td}>{r.manual_grand_total}</td><td style={td}>{r.manual_month}</td>
                <td style={td}>{r.gst_to_be}</td><td style={td}>{r.concern_person}</td><td style={td}>{r.description}</td>
                <td style={td}>{r.manual_invoice_attachment ? <a href="#" onClick={(e) => { e.preventDefault(); download(`${MI}${r.id}/history_download/`).catch((x) => alert(x.message)); }}>Download</a> : null}
                  {r.invoice_no ? <a href="#" style={{ marginLeft: 6 }} onClick={(e) => { e.preventDefault(); download(`${MI}${r.id}/history_pdf/`).catch((x) => alert(x.message)); }}>Print</a> : null}</td>
              </tr>))}
            {rows.length === 0 && <tr><td colSpan={13} style={{ ...td, textAlign: "center" }}>No Record Found</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
