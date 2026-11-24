"use client";
/**
 * Email Follow-up - port of email_followup.aspx ("Required Report" menu), four tabs:
 *  Attendance E-mail Follow-up | Billing Upload format | Send E-Invoice | Send Manual Email
 * Mail sending is fail-closed on the server (no SMTP configured => the server answers with the reason).
 */
import React, { useEffect, useState } from "react";
import { getJSON, mk } from "@/lib/api/legacy-fetch";
import { API_BASE_URL, drfErrorText } from "@/lib/api/client";

const EF = "/api/transactions/email-followup/";
type Row = Record<string, any>;
interface Client { client_code: string; client_name: string }

const th: React.CSSProperties = { backgroundColor: "#006699", color: "#fff", padding: 6, border: "1px solid #ccc", fontSize: 11 };
const td: React.CSSProperties = { padding: 5, border: "1px solid #ccc", fontSize: 11 };

async function parse(r: Response) {
  const d = await r.json().catch(() => null);
  if (!r.ok) throw new Error(drfErrorText(d) || `Request failed (${r.status})`);
  return d;
}
async function post(path: string, body: any) { return parse(await mk(path, body)); }
async function get(path: string) { return parse(await fetch(`${API_BASE_URL}${path}`, { credentials: "include" })); }
async function postForm(path: string, fd: FormData) {
  await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
  const m = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
  return parse(await fetch(`${API_BASE_URL}${path}`, { method: "POST", credentials: "include",
    headers: { "X-CSRFToken": m ? decodeURIComponent(m[1]) : "" }, body: fd }));
}
async function download(path: string, fallbackName: string) {
  const r = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  if (!r.ok) { const d = await r.json().catch(() => null); throw new Error(drfErrorText(d) || "File not Found!!."); }
  const cd = r.headers.get("content-disposition") || "";
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] || fallbackName;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await r.blob()); a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
const monthNow = () => { const d = new Date(); return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`; };

function ClientSelect({ clients, value, onChange, all }: { clients: Client[]; value: string; onChange: (v: string) => void; all?: boolean }) {
  return (
    <select className="form-control" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="Select">Select</option>
      {all && <option value="ALL">ALL</option>}
      {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
    </select>
  );
}

export default function EmailFollowupPage() {
  const [tab, setTab] = useState(0);
  const [clients, setClients] = useState<Client[]>([]);
  useEffect(() => { getJSON<{ results: Client[] }>(`${EF}clients/`).then((d) => setClients(d?.results ?? [])); }, []);
  const tabs = ["Attendance E-mail Follow-up", "Billing Upload format", "Send E-Invoice", "Send Manual Email"];
  return (
    <div className="container-fluid">
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: 4 }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px" }}>
          <div className="text-center text-uppercase" style={{ fontSize: "small" }}><b>Required Report</b></div>
        </div>
        <div className="panel-body" style={{ padding: 15 }}>
          <ul className="nav nav-tabs" style={{ background: "#f3f1fe", display: "flex", gap: 4, listStyle: "none", paddingLeft: 0, borderBottom: "1px solid #ddd" }}>
            {tabs.map((t, i) => (
              <li key={t} className={tab === i ? "active" : ""} style={{ background: tab === i ? "#fff" : undefined }}>
                <a href="#" onClick={(e) => { e.preventDefault(); setTab(i); }} style={{ padding: "8px 14px", display: "block" }}><b>{t}</b></a>
              </li>))}
          </ul>
          <div style={{ paddingTop: 15 }}>
            {tab === 0 && <FollowTab clients={clients} />}
            {tab === 1 && <FormatTab clients={clients} />}
            {tab === 2 && <EInvoiceTab clients={clients} />}
            {tab === 3 && <ManualTab clients={clients} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function FollowTab({ clients }: { clients: Client[] }) {
  const [client, setClient] = useState("Select");
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const view = async () => {
    if (client === "Select") { alert("Please Select Client Name"); return; }
    try { setRows((await get(`${EF}followup/?client_code=${encodeURIComponent(client)}`)).results ?? []); }
    catch (e: any) { alert(e.message); }
  };
  const send = async () => {
    if (client === "Select") { alert("Please Select Client Name"); return; }
    if (!to) { alert("Please Enter To Mail"); return; }
    if (!cc) { alert("Please Enter CC Mail"); return; }
    try { const d = await post(`${EF}followup_mail/`, { client_code: client, to_mail: to, cc_mail: cc }); alert(d.message); }
    catch (e: any) { alert(e.message); }
  };
  return (
    <div>
      <div className="row">
        <div className="col-sm-3"><b>Client Name :</b><ClientSelect clients={clients} value={client} onChange={setClient} /></div>
        <div className="col-sm-3"><b>To Mail :</b><input className="form-control" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="col-sm-3"><b>CC Mail :</b><input className="form-control" value={cc} onChange={(e) => setCc(e.target.value)} /></div>
        <div className="col-sm-3"><br /><button className="btn btn-primary" onClick={view} style={{ marginRight: 6 }}>View</button>
          <button className="btn btn-primary" onClick={send}>Send Mail</button></div>
      </div>
      <br />
      {rows.length > 0 && (
        <table className="table" style={{ width: "100%" }}>
          <thead><tr>{["Sr No.", "Client Name", "Month-Year", "Previous Month", "Approve By Finance", "Approve By Admin", "Approve By Admin Manager", "Pending"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={i}><td style={td}>{i + 1}</td><td style={td}>{r.client_name}</td><td style={td}>{r.month}</td><td style={td}>{r.previous_cnt}</td>
              <td style={td}>{r.App_by_fin_cnt}</td><td style={td}>{r.App_by_admin_cnt}</td><td style={td}>{r.App_by_adm_mngr_cnt}</td><td style={td}>{r.pend_cnt}</td></tr>))}</tbody>
        </table>
      )}
    </div>
  );
}

function FormatTab({ clients }: { clients: Client[] }) {
  const [client, setClient] = useState("Select");
  const [month, setMonth] = useState(monthNow());
  const dl = async () => {
    if (!month) { alert("Please Select month & year "); return; }
    if (client === "Select") { alert("Please Select Client Name"); return; }
    try { await download(`${EF}billing_format/?client_code=${encodeURIComponent(client)}&month=${encodeURIComponent(month)}`, "UPLOAD BILLING FORMAT.xls"); }
    catch (e: any) { alert(e.message); }
  };
  return (
    <div className="row">
      <div className="col-sm-3"><b>Month (mm/yyyy) :</b><input className="form-control" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
      <div className="col-sm-3"><b>Client Name :</b><ClientSelect clients={clients} value={client} onChange={setClient} /></div>
      <div className="col-sm-3"><br /><button className="btn btn-primary" onClick={dl}>Report</button></div>
    </div>
  );
}

function EInvoiceTab({ clients }: { clients: Client[] }) {
  const [client, setClient] = useState("Select");
  const [date, setDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [sel, setSel] = useState<Record<number, boolean>>({});
  const load = async (c: string) => {
    if (c === "Select") { setRows([]); return; }
    try {
      const d = await get(`${EF}einvoice_list/?client_code=${encodeURIComponent(c)}`);
      setRows(d.results ?? []); setTo(d.to_mail ?? ""); setCc(d.cc_mail ?? ""); setSel({});
    } catch (e: any) { setRows([]); alert(e.message); }
  };
  const upload = async () => {
    if (client === "Select") { alert("Please Select Client Name"); return; }
    if (!date) { alert("Please Select Date"); return; }
    if (!file) { alert("Please Upload Document "); return; }
    if (!to) { alert("Please Enter To Mail"); return; }
    if (!cc) { alert("Please Enter CC Mail"); return; }
    const fd = new FormData();
    fd.append("client_code", client); fd.append("e_invoice_date", date); fd.append("to_mail", to); fd.append("cc_mail", cc);
    fd.append("document", file);
    try { const d = await postForm(`${EF}einvoice_upload/`, fd); alert(d.message); setFile(null); await load(client); }
    catch (e: any) { alert(e.message); }
  };
  const send = async () => {
    const ids = rows.filter((r) => sel[r.id]).map((r) => r.id);
    if (ids.length === 0) { alert("Please select atleast one Record "); return; }
    try { const d = await post(`${EF}einvoice_send/`, { client_code: client, ids, to_mail: to, cc_mail: cc }); alert(d.message); await load(client); }
    catch (e: any) { alert(e.message); }
  };
  return (
    <div>
      <div className="row">
        <div className="col-sm-3"><b>Client Name :</b><ClientSelect clients={clients} value={client} onChange={(v) => { setClient(v); load(v); }} /></div>
        <div className="col-sm-2"><b>E-Invoice Date :</b><input type="date" className="form-control" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="col-sm-3"><b>Document (zip / rar / pdf) :</b><input type="file" accept=".zip,.rar,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        <div className="col-sm-2"><br /><button className="btn btn-primary" onClick={upload}>Submit</button></div>
      </div>
      <div className="row" style={{ marginTop: 8 }}>
        <div className="col-sm-4"><b>To Mail :</b><input className="form-control" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="col-sm-4"><b>CC Mail :</b><input className="form-control" value={cc} onChange={(e) => setCc(e.target.value)} /></div>
      </div>
      <br />
      {rows.length > 0 && (
        <div>
          <table className="table" style={{ width: "100%" }}>
            <thead><tr><th style={th}></th>{["Client Name", "E-Invoice Date", "File", "Status"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}>
                <td style={td}><input type="checkbox" disabled={r.send_status === 1} checked={!!sel[r.id]} onChange={(e) => setSel({ ...sel, [r.id]: e.target.checked })} /></td>
                <td style={td}>{r.client_name}</td><td style={td}>{r.e_invoice_date}</td>
                <td style={td}>{r.e_invoice_file ? <a href="#" onClick={(e) => { e.preventDefault(); download(`${EF}${r.id}/einvoice_download/`, r.e_invoice_file).catch((x) => alert(x.message)); }}>{r.e_invoice_file}</a> : null}</td>
                <td style={td}>{r.status}</td>
              </tr>))}</tbody>
          </table>
          <button className="btn btn-primary" onClick={send}>Send</button>
        </div>
      )}
    </div>
  );
}

function ManualTab({ clients }: { clients: Client[] }) {
  const [status, setStatus] = useState("1");
  const [client, setClient] = useState("Select");
  const [states, setStates] = useState<string[]>([]);
  const [state, setState] = useState("Select");
  const [branches, setBranches] = useState<Row[]>([]);
  const [branch, setBranch] = useState("Select");
  const [f, setF] = useState({ cc_mail: "", subject: "", mail_body: "", regards: "", contact_no: "", email_address: "" });
  const [file, setFile] = useState<File | null>(null);
  const loadBranches = async (c: string, s: string, st: string) => {
    if (s === "Select") { setBranches([]); return; }
    const d = await get(`${EF}branches/?client_code=${encodeURIComponent(c)}&state=${encodeURIComponent(s)}&branch_status=${st}`).catch(() => null);
    setBranches(d?.results ?? []);
  };
  const onClient = async (v: string) => {
    setClient(v); setState("Select"); setBranch("Select"); setBranches([]); setStates([]);
    if (v === "Select" || v === "ALL") return;
    const d = await get(`${EF}states/?client_code=${encodeURIComponent(v)}`).catch(() => null);
    setStates(d?.results ?? []);
  };
  const onState = (v: string) => { setState(v); setBranch("Select"); loadBranches(client, v, status); };
  const clear = () => { setClient("Select"); setState("Select"); setBranch("Select"); setF({ cc_mail: "", subject: "", mail_body: "", regards: "", contact_no: "", email_address: "" }); setFile(null); };
  const send = async () => {
    const need: [boolean, string][] = [
      [client === "Select", "Please Select Client Name"], [state === "Select", "Please Select State Name"],
      [branch === "Select", "Please Select Branch_Name"], [!f.cc_mail, "Please Enter cc mail"], [!f.subject, "Please Enter subject"],
      [!f.mail_body, "Please Enter the mail body "], [!f.regards, "Please Enter Designation & Company name"],
      [!f.contact_no, "Please Enter contact No."], [!f.email_address, "Please Enter email address"],
    ];
    for (const [bad, msg] of need) if (bad) { alert(msg); return; }
    if (!file) { alert("Please upload one file atleast..!!!"); return; }
    const fd = new FormData();
    fd.append("client_code", client); fd.append("client_name", clients.find((c) => c.client_code === client)?.client_name ?? client);
    fd.append("state_name", state); fd.append("unit_code", branch);
    fd.append("branch_name", branches.find((b) => b.unit_code === branch)?.unit_name ?? branch);
    Object.entries(f).forEach(([k, v]) => fd.append(k, v));
    fd.append("attachment", file);
    try { const d = await postForm(`${EF}manual_send/`, fd); alert(d.message); clear(); } catch (e: any) { alert(e.message); }
  };
  const inp = (k: keyof typeof f, label: string, big = false) => (
    <div className="col-sm-4" style={{ marginBottom: 8 }}><b>{label}</b>
      {big ? <textarea className="form-control" rows={4} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
        : <input className="form-control" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />}</div>);
  return (
    <div>
      <div className="row">
        <div className="col-sm-3"><b>Branch Status :</b>
          <select className="form-control" value={status} onChange={(e) => { setStatus(e.target.value); loadBranches(client, state, e.target.value); }}>
            <option value="1">All Branches</option><option value="2">Attendance Not Uploaded</option>
          </select></div>
        <div className="col-sm-3"><b>Client Name :</b><ClientSelect clients={clients} value={client} onChange={onClient} all /></div>
        <div className="col-sm-3"><b>State Name :</b>
          <select className="form-control" value={state} onChange={(e) => onState(e.target.value)}>
            <option value="Select">Select</option><option value="ALL">ALL</option>{states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select></div>
        <div className="col-sm-3"><b>Branch Name :</b>
          <select className="form-control" value={branch} onChange={(e) => setBranch(e.target.value)}>
            <option value="Select">Select</option><option value="ALL">ALL</option>{branches.map((b) => <option key={b.unit_code} value={b.unit_code}>{b.unit_name}</option>)}
          </select></div>
      </div>
      <br />
      <div className="row">
        {inp("cc_mail", "CC Mail :")}{inp("subject", "Subject :")}
        <div className="col-sm-4" style={{ marginBottom: 8 }}><b>Attachment :</b><input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        {inp("mail_body", "Mail Body :", true)}{inp("regards", "Designation & Company :")}{inp("contact_no", "Contact No :")}{inp("email_address", "Email Address :")}
      </div>
      <div className="text-center">
        <button className="btn btn-primary" onClick={send} style={{ marginRight: 6 }}>Send Mail</button>
        <button className="btn btn-primary" onClick={clear}>Clear</button>
      </div>
    </div>
  );
}
