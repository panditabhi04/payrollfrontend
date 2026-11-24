"use client";
import React, { useEffect, useRef, useState } from "react";
import { getJSON, postJSON, upload, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

/**
 * Attendance Sheet -> "Material Amount" tab (legacy emp_sample.aspx #menu6).
 * Backend: /api/attendance/material-amount/ (MaterialAmountViewSet).
 */
const BASE = "/api/attendance/material-amount/";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];

// Legacy Month textbox: CssClass "date-picker", mm/yyyy, 1990..current year, never a future month.
export function MonthYearField({ month, year, onChange }: {
  month: string; year: string; onChange: (m: string, y: string) => void;
}) {
  const now = new Date();
  const curY = now.getFullYear(), curM = now.getMonth() + 1;
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(curY);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const display = month && year ? `${month.padStart(2, "0")}/${year}` : "";
  const btn: React.CSSProperties = { border: "1px solid #ccc", background: "#fff", borderRadius: 4, padding: "2px 10px", cursor: "pointer" };
  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <input className="form-control" readOnly value={display} placeholder="mm/yyyy"
        onClick={() => { setViewYear(year ? parseInt(year, 10) : curY); setOpen(o => !o); }}
        style={{ cursor: "pointer", background: "#fff" }} />
      {open && (
        <div style={{ position: "absolute", top: 38, left: 0, zIndex: 50, background: "#fff", border: "1px solid #428bca", borderRadius: 6, boxShadow: "0 4px 14px rgba(0,0,0,0.25)", padding: 10, width: 230 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
            <button type="button" style={btn} disabled={viewYear <= 1990} onClick={() => setViewYear(y => Math.max(1990, y - 1))}>&lsaquo;</button>
            <b style={{ color: "#006699" }}>{viewYear}</b>
            <button type="button" style={btn} disabled={viewYear >= curY} onClick={() => setViewYear(y => Math.min(curY, y + 1))}>&rsaquo;</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
            {MONTH_NAMES.map((n, i) => {
              const m = i + 1;
              const disabled = viewYear === curY && m > curM;
              const sel = month === String(m) && year === String(viewYear);
              return (
                <button key={n} type="button" disabled={disabled}
                  onClick={() => { onChange(String(m), String(viewYear)); setOpen(false); }}
                  style={{ border: "1px solid " + (sel ? "#428bca" : "#ddd"), background: disabled ? "#f0f0f0" : sel ? "#428bca" : "#fff", color: disabled ? "#aaa" : sel ? "#fff" : "#333", borderRadius: 4, padding: "6px 0", fontSize: 12, cursor: disabled ? "not-allowed" : "pointer" }}>
                  {n.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Authenticated file download (the backend only serves files of the caller's company).
export async function downloadAuth(path: string, filename: string) {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
    if (!res.ok) { alert(await responseMessage(res, "File not Found!!.")); return; }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename || "download"; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  } catch {
    alert("File not Found!!.");
  }
}

interface Opt { client_code: string; client_name: string }
interface Branch { unit_code: string; label: string }
interface EmpRow { unit_name: string; unit_code: string; emp_name?: string; emp_code?: string; amount: string; deduction?: string }
interface Dl { client_name: string; state_name: string; unit_name: string; month: string; file: string }
interface StatusRow { client_name: string; state_name: string; unit_name: string }

const headStyle: React.CSSProperties = { backgroundColor: "#006699", color: "#fff", textTransform: "uppercase" };

export default function MaterialAmountTab() {
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [atype, setAtype] = useState("0");
  const [clients, setClients] = useState<Opt[]>([]);
  const [client, setClient] = useState("Select");
  const [states, setStates] = useState<string[]>([]);
  const [state, setState] = useState("Select");
  const [empType, setEmpType] = useState("0");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branch, setBranch] = useState("Select");
  const [rows, setRows] = useState<EmpRow[]>([]);
  const [downloads, setDownloads] = useState<Dl[]>([]);
  const [canEdit, setCanEdit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [desc, setDesc] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<{ not_approved_admin: StatusRow[]; approved_admin: StatusRow[]; approved_finance: StatusRow[]; rejected_finance: StatusRow[] } | null>(null);
  const [modal, setModal] = useState<{ title: string; rows: StatusRow[] } | null>(null);

  useEffect(() => {
    getJSON<{ results: Opt[] }>(`${BASE}clients/`).then(d => setClients(d?.results || []));
  }, []);

  const qs = (m = month, y = year, c = client, s = state, b = branch, t = atype, e = empType) =>
    `month=${encodeURIComponent(m)}&year=${encodeURIComponent(y)}&client_code=${encodeURIComponent(c)}` +
    `&state_name=${encodeURIComponent(s)}&unit_code=${encodeURIComponent(b)}&amount_type=${t}&employee_type=${e}`;
  const body = (extra: object = {}) => ({
    month, year, client_code: client, state_name: state, unit_code: branch, amount_type: atype, employee_type: empType, ...extra,
  });

  // legacy r_validation1(): Month -> Client -> State -> Branch
  const validate = (): boolean => {
    if (!month || !year) { alert("Please Select Month"); return false; }
    if (client === "Select") { alert("Please Select Client"); return false; }
    if (state === "Select") { alert("Please Select State"); return false; }
    if (branch === "Select") { alert("Please Select Branch Name "); return false; }
    return true;
  };

  const clearGrid = () => { setRows([]); setDownloads([]); setCanEdit(true); setStatus(null); };

  const onClient = async (v: string) => {
    setClient(v); setState("Select"); setBranch("Select"); setStates([]); setBranches([]); clearGrid();
    if (v === "Select") return;
    const d = await getJSON<{ results: string[] }>(`${BASE}states/?client_code=${encodeURIComponent(v)}`);
    setStates(d?.results || []);
  };
  const onState = async (v: string) => {
    setState(v); setBranch("Select"); setBranches([]); clearGrid();
    if (v === "Select") return;
    const d = await getJSON<{ results: Branch[] }>(`${BASE}branches/?client_code=${encodeURIComponent(client)}&state_name=${encodeURIComponent(v)}`);
    setBranches(d?.results || []);
  };

  const load = async (over: { m?: string; y?: string; b?: string; t?: string; e?: string } = {}) => {
    const m = over.m ?? month, y = over.y ?? year, b = over.b ?? branch, t = over.t ?? atype, e = over.e ?? empType;
    if (!m || !y || client === "Select" || state === "Select" || b === "Select") { clearGrid(); return; }
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}${BASE}?${qs(m, y, client, state, b, t, e)}`, { credentials: "include" });
      if (!res.ok) { alert(await responseMessage(res, "Request failed.")); clearGrid(); return; }
      const d = await res.json();
      setRows(d.rows || []); setDownloads(d.downloads || []); setCanEdit(!!d.can_edit); setStatus(null);
      if (d.alert) alert(d.alert);
    } finally { setBusy(false); }
  };

  const onBranch = (v: string) => { setBranch(v); if (v === "Select") clearGrid(); else load({ b: v }); };

  const setCell = (i: number, k: "amount" | "deduction", v: string) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));

  const gridPayload = () => rows.map(r => ({ unit_code: r.unit_code, emp_code: r.emp_code || "", amount: r.amount, deduction: r.deduction || "" }));

  const save = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await postJSON(`${BASE}save/`, body({ rows: gridPayload() }));
      if (res.ok) { const d = await res.json().catch(() => ({})); alert(d.detail || "Material Amount Added Successfully... !!! Please  Click on Approve to Approve Material!!"); }
      else alert(await responseMessage(res, "Material Added Failed... !!!"));
      await load();
    } finally { setBusy(false); }
  };

  const approve = async () => {
    // legacy r_validation3()
    if (!confirm("Are you Sure You Want to Approve Record")) { alert("Record not Available"); return; }
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await postJSON(`${BASE}approve/`, body({ rows: gridPayload() }));
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.detail || (atype === "0" ? "Employee Approved Successfully!!" : "Branch Approved Successfully!!"));
        setRows([]); setCanEdit(false);
        await load();
      } else alert(await responseMessage(res, "Request failed."));
    } finally { setBusy(false); }
  };

  const doUpload = async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) { alert("Please First Select The File For Upload"); return; }
    if (!validate()) return;
    const fd = new FormData();
    Object.entries(body({ description: desc })).forEach(([k, v]) => fd.append(k, String(v)));
    fd.append("file", f);
    setBusy(true);
    try {
      const res = await upload(`${BASE}upload/`, fd);
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.detail || "Material Sheet Upload Succsefully ..!!");
        if (fileRef.current) fileRef.current.value = "";
        setDesc("");
        await load();
      } else alert(await responseMessage(res, "Request failed."));
    } finally { setBusy(false); }
  };

  const reports = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}${BASE}status/?${qs()}`, { credentials: "include" });
      if (!res.ok) { alert(await responseMessage(res, "Request failed.")); return; }
      setStatus(await res.json());
    } finally { setBusy(false); }
  };

  const dlFile = (file: string, unitName: string) => {
    if (!file) { alert("Attachment File Cannot Be Uploaded !!!"); return; }
    downloadAuth(`${BASE}download/?file=${encodeURIComponent(file)}`, file);
  };

  const sel = "form-control";
  const th = (t: string) => <th style={headStyle}>{t}</th>;
  const ntBox = (n: number) => <td style={{ fontWeight: "bold" }}>{n}</td>;

  return (
    <div style={{ padding: "10px 0" }}>
      <div className="row">
        <div className="col-sm-2 col-xs-12">
          <b>Select Month :</b><span style={{ color: "red" }}>*</span>
          <MonthYearField month={month} year={year}
            onChange={(m, y) => { setMonth(m); setYear(y); if (branch !== "Select") load({ m, y }); }} />
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>Material Amount Type :</b> <span style={{ color: "red" }}>*</span>
          <select className={sel} value={atype} onChange={e => { setAtype(e.target.value); setRows([]); if (branch !== "Select") load({ t: e.target.value }); }}>
            <option value="0">Employeewise Material</option>
            <option value="1">Locationwise Material</option>
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>Client Name :</b> <span style={{ color: "red" }}>*</span>
          <select className={sel} value={client} onChange={e => onClient(e.target.value)}>
            <option value="Select">Select</option>
            {clients.map(c => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>State :</b><span style={{ color: "red" }}>*</span>
          <select className={sel} value={state} onChange={e => onState(e.target.value)}>
            <option value="Select">Select</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>Employee Type :</b> <span style={{ color: "red" }}>*</span>
          <select className={sel} value={empType} onChange={e => { setEmpType(e.target.value); if (branch !== "Select") load({ e: e.target.value }); }}>
            <option value="0">Permanent</option>
            <option value="1">Left</option>
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>Branch Name :</b><span style={{ color: "red" }}>*</span>
          <select className={sel} value={branch} onChange={e => onBranch(e.target.value)}>
            <option value="Select">Select</option>
            {branches.length > 0 && <option value="ALL">ALL</option>}
            {branches.map(b => <option key={b.unit_code} value={b.unit_code}>{b.label}</option>)}
          </select>
        </div>
      </div>
      <br />

      <div style={{ background: "beige" }}>
        <ul className="nav nav-tabs" style={{ margin: 0 }}>
          <li className={atype === "0" ? "active" : ""}><a href="#" onClick={e => { e.preventDefault(); setAtype("0"); setRows([]); if (branch !== "Select") load({ t: "0" }); }}>Employeewise Material</a></li>
          <li className={atype === "1" ? "active" : ""}><a href="#" onClick={e => { e.preventDefault(); setAtype("1"); setRows([]); if (branch !== "Select") load({ t: "1" }); }}>Locationwise Material</a></li>
        </ul>

        {status && (
          <div className="row" style={{ marginTop: 10 }}>
            <div className="col-sm-8 col-xs-12" />
            <div className="col-sm-4 col-xs-12">
              <div style={{ maxHeight: 200, overflowY: "auto", overflowX: "hidden" }}>
                <table border={1} className="table table-striped">
                  <tbody>
                    <tr style={{ backgroundColor: "#eeeaea" }}><th>Branch Count</th><th style={{ textAlign: "center" }}>Notification</th></tr>
                    <tr>{ntBox(status.not_approved_admin.length)}<td><a href="#" onClick={e => { e.preventDefault(); setModal({ title: "Not Approve By Admin", rows: status.not_approved_admin }); }}><b>Branches Not Approved By Admin</b></a></td></tr>
                    <tr>{ntBox(status.approved_admin.length)}<td><a href="#" onClick={e => { e.preventDefault(); setModal({ title: "Approve By Admin", rows: status.approved_admin }); }}><b>Branches Approved By Admin</b></a></td></tr>
                    <tr>{ntBox(status.approved_finance.length)}<td><a href="#" onClick={e => { e.preventDefault(); setModal({ title: "Approve By Finance", rows: status.approved_finance }); }}><b>Branches Approved By Finance</b></a></td></tr>
                    <tr>{ntBox(status.rejected_finance.length)}<td><a href="#" onClick={e => { e.preventDefault(); setModal({ title: "Branches Rejected By Finance", rows: status.rejected_finance }); }}><b>Branches Reject By Finance</b></a></td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {downloads.length > 0 && (
          <div className="container" style={{ width: "75%", marginTop: 10 }}>
            <table className="table" style={{ width: "100%", background: "#fff", border: "1px solid #ccc" }}>
              <thead><tr>{th("Sr No.")}{th("Client Name")}{th("State")}{th("Branch Name")}{th("Month")}{th("DOWNLOAD")}</tr></thead>
              <tbody>
                {downloads.map((d, i) => (
                  <tr key={i} style={{ color: "#000066" }}>
                    <td>{i + 1}</td><td>{d.client_name}</td><td>{d.state_name}</td><td>{d.unit_name}</td><td>{d.month}</td>
                    <td><button type="button" className="btn btn-primary" style={{ color: "white" }} onClick={() => dlFile(d.file, d.unit_name)}>Material</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <div style={{ marginTop: 10, overflowX: "auto" }}>
            <table className="table" style={{ background: "#fff", color: "#333" }} border={1}>
              <thead>
                <tr>
                  {th("Sr. No.")}{th("Branch name")}
                  {atype === "0" ? <>{th("Employee Name")}{th("Material Amount")}{th("Material Deduction Amount")}</>
                    : <>{th("Branch code")}{th("Material Amount")}</>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.unit_code}-${r.emp_code || ""}`} style={{ color: "#000066" }}>
                    <td>{i + 1}</td>
                    <td>{r.unit_name}</td>
                    {atype === "0" ? <td>{r.emp_name}</td> : <td>{r.unit_code}</td>}
                    <td><input className="form-control" style={{ width: 100 }} value={r.amount} onChange={e => setCell(i, "amount", e.target.value)} /></td>
                    {atype === "0" && <td><input className="form-control" style={{ width: 100 }} value={r.deduction || ""} onChange={e => setCell(i, "deduction", e.target.value)} /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canEdit && (
          <>
            <div style={{ textAlign: "center", margin: "12px 0" }}>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>Save</button>{" "}
              <button type="button" className="btn btn-primary" disabled={busy} onClick={approve}>Approve</button>{" "}
              <button type="button" className="btn btn-primary" disabled={busy} onClick={reports}>Reports</button>
            </div>
            <div className="row" style={{ marginBottom: 10 }}>
              <div className="col-sm-2 col-xs-12" />
              <div className="col-sm-2 col-xs-12">
                <b>Description :</b>
                <input className="form-control" maxLength={200} value={desc} onChange={e => setDesc(e.target.value)} />
              </div>
              <div className="col-sm-3 col-xs-12">
                <b>File to Upload :</b>
                <input type="file" ref={fileRef} accept=".jpg,.jpeg,.png,.pdf,.rar,.zip" />
                <div><b style={{ color: "#f00" }}>Note :</b> Only JPG, PNG,JPEG and PDF files will be uploaded.</div>
              </div>
              <div className="col-sm-2 col-xs-12" style={{ paddingTop: "1%" }}>
                <button type="button" className="btn btn-primary" disabled={busy} onClick={doUpload}> Upload </button>
              </div>
            </div>
          </>
        )}
      </div>

      {modal && (
        <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1050, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", width: 520, maxWidth: "95%", borderRadius: 6, boxShadow: "0 5px 15px rgba(0,0,0,.5)" }}>
            <div style={{ padding: 15, borderBottom: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between" }}>
              <h4 style={{ margin: 0 }}>{modal.title}</h4>
              <button type="button" className="close" onClick={() => setModal(null)}>&times;</button>
            </div>
            <div style={{ padding: 15, maxHeight: 360, overflowY: "auto" }}>
              <table className="table">
                <thead><tr><th>Client Name</th><th>State Name</th><th>Branch Name</th></tr></thead>
                <tbody>{modal.rows.map((r, i) => <tr key={i}><td>{r.client_name}</td><td>{r.state_name}</td><td>{r.unit_name}</td></tr>)}</tbody>
              </table>
            </div>
            <div style={{ padding: 15, borderTop: "1px solid #e5e5e5", textAlign: "center" }}>
              <button type="button" className="btn btn-danger" onClick={() => setModal(null)}>CLOSE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
