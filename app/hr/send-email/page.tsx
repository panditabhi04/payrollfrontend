"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getJSON, mk, upload } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

/* 1:1 port of Pay_Send_Email.aspx — "EMPLOYEE SEND EMAIL". Two tabs: Send Email / Attachment.
   Email is fail-closed (real SMTP result only, never a fake "sent"). All alert() strings are
   the verbatim legacy strings (typos/spacing preserved). */

const SE = "/api/transactions/send-email-page";
interface ClientOpt { client_code: string; client_name: string; }
interface UnitOpt { unit_code: string; unit_name: string; }
interface EmpRow { emp_code: string; emp_name: string; branch_name: string; unit_code: string; employee_type: string; left_date: string; left_reason: string; checked: boolean; }
interface NoEmail { unit_code: string; unit_name: string; }
interface FbFile { id: number; client_code: string; client_name?: string; file_name: string; type: string; filename_and: string; uploaded_by: string; uploaded_date: string; }

const ctl: React.CSSProperties = { width: "100%", height: "34px", borderRadius: "4px", border: "1px solid #ccc", padding: "4px 8px" };
const blue: React.CSSProperties = { background: "#337ab7", border: "1px solid #2e6da4", color: "#fff", padding: "6px 14px", borderRadius: "4px", cursor: "pointer" };
const green: React.CSSProperties = { background: "#5cb85c", border: "1px solid #4cae4c", color: "#fff", padding: "6px 14px", borderRadius: "4px", cursor: "pointer" };
const red: React.CSSProperties = { background: "#d9534f", border: "1px solid #d43f3a", color: "#fff", padding: "6px 14px", borderRadius: "4px", textDecoration: "none", cursor: "pointer" };

export default function SendEmailPage() {
  const [tab, setTab] = useState<"menu0" | "menu5">("menu0");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [unit, setUnit] = useState("ALL");
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [attClients, setAttClients] = useState<ClientOpt[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [rows, setRows] = useState<EmpRow[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [left, setLeft] = useState<Record<string, { d: string; r: string }>>({});
  const [noEmail, setNoEmail] = useState<NoEmail[]>([]);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  // upload2 (attendance scan)
  const [desc, setDesc] = useState("");
  const [scanFile, setScanFile] = useState<File | null>(null);

  // ADD EMAIL inline form
  const [showAddEmail, setShowAddEmail] = useState(false);
  const [aeEmail, setAeEmail] = useState(""); const [aeCc, setAeCc] = useState(""); const [aeName, setAeName] = useState(""); const [aeMob, setAeMob] = useState("");

  // Attachment tab
  const [attClient, setAttClient] = useState("Select");
  const [attFileName, setAttFileName] = useState("0");
  const [attFile, setAttFile] = useState<File | null>(null);
  const [fbFiles, setFbFiles] = useState<FbFile[]>([]);

  // legacy client_code(): active clients the user reports on; code(): every active client (Attachment tab)
  useEffect(() => {
    getJSON<{ results: ClientOpt[] }>(`${SE}/clients/`).then(d => setClients(d?.results ?? []));
    getJSON<{ results: ClientOpt[] }>(`${SE}/attach-clients/`).then(d => setAttClients(d?.results ?? []));
  }, []);
  // ddl_client_SelectedIndexChanged: states of the client; ddl_client_SelectedIndexChanged1: branches of the state
  useEffect(() => {
    if (!client || client === "Select") { setStates([]); return; }
    getJSON<{ results: { state: string }[] }>(`${SE}/states/?client_code=${encodeURIComponent(client)}`)
      .then(d => setStates((d?.results ?? []).map(x => x.state)));
  }, [client]);
  useEffect(() => {
    if (!client || client === "Select" || !state || state === "Select") { setUnits([]); return; }
    getJSON<{ results: UnitOpt[] }>(`${SE}/branches/?client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}`)
      .then(d => setUnits(d?.results ?? []));
  }, [client, state]);
  const loadFb = useCallback(() => { getJSON<{ results: FbFile[] }>(`${SE}/feedback-files/`).then(d => setFbFiles(d?.results ?? [])); }, []);
  useEffect(() => { if (tab === "menu5") loadFb(); }, [tab, loadFb]);

  const monthVal = year && month ? `${year}-${month.padStart(2, "0")}` : "";
  const onMonth = (v: string) => { if (v) { const [y, m] = v.split("-"); setYear(y); setMonth(parseInt(m, 10).toString()); } else { setYear(""); setMonth(""); } };
  const filteredUnits = units;

  // cascade: when State chosen, load employee grid + branches-without-email
  const loadGrid = useCallback(async () => {
    if (!client || client === "Select") return;
    const q = new URLSearchParams({ client_code: client });
    if (state && state !== "Select") q.set("state", state);
    if (unit && unit !== "ALL") q.set("unit_code", unit);
    if (month && year) { q.set("month", month); q.set("year", year); }
    const d = await getJSON<{ results: EmpRow[] }>(`${SE}/employees/?${q}`);
    const rs = d?.results ?? [];
    setRows(rs);
    const s: Record<string, boolean> = {}; const l: Record<string, { d: string; r: string }> = {};
    rs.forEach(r => { s[r.emp_code] = r.checked; l[r.emp_code] = { d: r.left_date, r: r.left_reason }; });
    setSel(s); setLeft(l);
    const ne = await getJSON<{ results: NoEmail[] }>(`${SE}/branches-no-email/?${new URLSearchParams({ client_code: client, state: state === "Select" ? "" : state })}`);
    setNoEmail(ne?.results ?? []);
  }, [client, state, unit, month, year]);

  useEffect(() => { if (client !== "Select" && state !== "Select") loadGrid(); }, [client, state, unit, month, year, loadGrid]);

  // ---- validations (verbatim) ----
  const reqValidation = (): boolean => {
    if (!client || client === "Select") { alert("Please Select Client Name... "); return false; }
    if (!unit || unit === "ALL") { alert("Please Select Branch... "); return false; }
    if (!month.trim() || !year.trim()) { alert("Please Select Month/Year "); return false; }
    return true;
  };
  const validateCheckBoxes = (): boolean => {
    if (Object.values(sel).filter(Boolean).length === 0) { alert("Please select atleast one Employee"); return false; }
    return true;
  };

  const doSend = async (mode: string) => {
    if (mode === "admin") {
      if (!client || client === "Select" || !month.trim()) { alert("Please select Client and Month"); return; }
    } else {
      if (!reqValidation()) return;
      if ((mode === "email" || mode === "blank" || mode === "pdf") && !validateCheckBoxes()) return;
    }
    setBusy(true); setMsg("");
    try {
      const emp_codes = Object.keys(sel).filter(k => sel[k]);
      const r = await mk(`${SE}/send/`, { mode, client_code: client, state, unit_code: unit, month, year, emp_codes });
      const b = await r.json().catch(() => ({}));
      const status = b.status || (r.ok ? "Mail Send Successfully." : "Mail Not Send.");
      setMsg(b.detail ? `${status} — ${b.detail}` : status);
      alert(status);
    } finally { setBusy(false); }
  };

  const saveLeft = async (emp: string) => {
    const v = left[emp]; if (!v) return;
    if (v.d && !v.r.trim()) { alert("Please Enter Reason"); return; }
    await mk(`${SE}/set-left/`, { emp_code: emp, left_date: v.d, left_reason: v.r });
  };

  const addEmail = async () => {
    if (!client || client === "Select") { alert("Please Select Client Name... "); return; }
    if (!unit || unit === "ALL") { alert("Please Select Branch... "); return; }
    if (!aeEmail.trim()) { alert("Please Enter Email Id"); return; }
    const r = await mk(`${SE}/add-email/`, { client_code: client, unit_code: unit, state: state === "Select" ? "" : state, head_name: aeName, head_email_id: aeEmail, cc_emailid: aeCc, mobileno: aeMob });
    const b = await r.json().catch(() => ({}));
    alert(r.ok ? (b.status || "Email Added Successfully") : (b.detail || "Failed"));
    if (r.ok) { setShowAddEmail(false); setAeEmail(""); setAeCc(""); setAeName(""); setAeMob(""); loadGrid(); }
  };

  const uploadScan = async () => {
    if (!desc.trim()) { alert("Please enter Description :  "); return; }
    if (!scanFile) { alert("Please select file."); return; }
    const fd = new FormData();
    fd.append("unit_code", unit); fd.append("client_code", client); fd.append("state_name", state === "Select" ? "" : state);
    fd.append("month", month); fd.append("year", year); fd.append("file", scanFile);
    const r = await upload("/api/attendance/attendance-attachment/upload/", fd);
    const b = await r.json().catch(() => ({}));
    alert(r.ok ? (b.status || " File upload Successfully... !!!") : (b.detail || " File upload Failed... !!!"));
    if (r.ok) { setDesc(""); setScanFile(null); }
  };

  const uploadFeedback = async () => {
    if (!attClient || attClient === "Select") { alert("Please Select Client Name... "); return; }
    if (!attFile) { alert("Please Select File "); return; }
    const fd = new FormData();
    fd.append("client_code", attClient); fd.append("filename_and", attFileName); fd.append("file", attFile);
    const r = await upload(`${SE}/feedback-upload/`, fd);
    const b = await r.json().catch(() => ({}));
    alert(r.ok ? (b.status || " File upload Successfully... !!!") : (b.detail || " File upload Failed... !!!"));
    if (r.ok) { setAttFile(null); loadFb(); }
  };
  const downloadFb = async (f: FbFile) => {
    const r = await fetch(`${API_BASE_URL}${SE}/feedback-download/?id=${f.id}`, { credentials: "include" });
    if (!r.ok) { alert("File Can not Found!!."); return; }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = f.file_name || "attachment"; a.click();
    URL.revokeObjectURL(a.href);
  };
  const deleteFeedback = async (id: number) => {
    if (!window.confirm("Are you sure?")) return;
    await mk(`${SE}/feedback-delete/`, { id }); loadFb();
  };

  const allSel = rows.length > 0 && rows.every(r => sel[r.emp_code]);
  const tabBtn = (t: "menu0" | "menu5") => ({ display: "inline-block", padding: "9px 16px", textDecoration: "none", fontWeight: 700, borderRadius: "4px 4px 0 0", background: tab === t ? "#fff" : "#424D7A", color: tab === t ? "#333" : "#fff", border: "1px solid #ccc", cursor: "pointer" } as React.CSSProperties);

  return (
    <section style={{ padding: "15px", fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #337ab7", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#337ab7", color: "#fff", padding: "10px 15px", textAlign: "center", fontWeight: "bold", textTransform: "uppercase" }}>
          EMPLOYEE SEND EMAIL
        </div>
        <div className="panel-body" style={{ padding: "18px" }}>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 16px", display: "flex", gap: "3px", borderBottom: "1px solid #ccc" }}>
            <li><button style={tabBtn("menu0")} onClick={() => setTab("menu0")}>Send Email</button></li>
            <li><button style={tabBtn("menu5")} onClick={() => setTab("menu5")}>Attachment</button></li>
          </ul>

          {msg && <div style={{ color: "#8a6d3b", fontWeight: "bold", textAlign: "center", marginBottom: "12px", padding: "8px", background: "#fcf8e3", border: "1px solid #faebcc", borderRadius: "4px" }}>{msg}</div>}

          {/* ============ TAB 1: SEND EMAIL ============ */}
          {tab === "menu0" && (
            <>
              <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "18px", marginBottom: "16px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end" }}>
                  <div style={{ flex: "1 1 160px" }}><b>Month / Year :</b><span style={{ color: "red" }}>*</span>
                    <input type="month" className="form-control" value={monthVal} onChange={e => onMonth(e.target.value)} style={ctl} /></div>
                  <div style={{ flex: "1 1 200px" }}><b>Client Name :</b><span style={{ color: "red" }}>*</span>
                    <select className="form-control" value={client} onChange={e => { setClient(e.target.value); setState("Select"); setUnit("ALL"); setRows([]); setNoEmail([]); }} style={ctl}>
                      <option value="Select">Select</option>
                      {clients.map(c => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
                    </select></div>
                  <div style={{ flex: "1 1 170px" }}><b>State :</b>
                    <select className="form-control" value={state} onChange={e => { setState(e.target.value); setUnit("ALL"); }} style={ctl}>
                      <option value="Select">Select</option>
                      {states.map(s => <option key={s} value={s}>{s}</option>)}
                    </select></div>
                  <div style={{ flex: "1 1 200px" }}><b>Branch Name :</b><span style={{ color: "red" }}>*</span>
                    <select className="form-control" value={unit} onChange={e => setUnit(e.target.value)} style={ctl}>
                      <option value="ALL">ALL</option>
                      {filteredUnits.map(u => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
                    </select></div>
                  {noEmail.length > 0 && (
                    <div style={{ flex: "1 1 220px" }}><b>Branch Having Not EmailId :</b>
                      <select multiple size={4} className="form-control" style={{ ...ctl, height: "100px" }}>
                        {noEmail.map(b => <option key={b.unit_code} value={b.unit_code}>{b.unit_name}</option>)}
                      </select></div>
                  )}
                </div>
              </div>

              {/* employee grid */}
              <div style={{ overflowX: "auto" }}>
                <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff" }}>
                  <thead style={{ background: "#006699", color: "white" }}>
                    <tr>
                      <th style={{ padding: "8px", textAlign: "center" }}>
                        <input type="checkbox" checked={allSel} onChange={e => { const m: Record<string, boolean> = {}; rows.forEach(r => (m[r.emp_code] = e.target.checked)); setSel(m); }} /> SELECT EMPLOYEE
                      </th>
                      <th style={{ padding: "8px" }}>BRANCH NAME</th>
                      <th style={{ padding: "8px" }}>EMPLOYEE NAME</th>
                      <th style={{ padding: "8px" }}>TYPE</th>
                      <th style={{ padding: "8px" }}>LEFT DATE</th>
                      <th style={{ padding: "8px" }}>LEFT REASON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.emp_code}>
                        <td style={{ padding: "8px", textAlign: "center" }}><input type="checkbox" checked={!!sel[r.emp_code]} onChange={e => setSel({ ...sel, [r.emp_code]: e.target.checked })} /></td>
                        <td style={{ padding: "8px" }}>{r.branch_name}</td>
                        <td style={{ padding: "8px" }}>{r.emp_name}</td>
                        <td style={{ padding: "8px" }}>{r.employee_type}</td>
                        <td style={{ padding: "8px" }}><input type="date" className="form-control" style={{ height: "30px" }} value={left[r.emp_code]?.d ? toISO(left[r.emp_code].d) : ""} onChange={e => setLeft({ ...left, [r.emp_code]: { d: fromISO(e.target.value), r: left[r.emp_code]?.r || "" } })} onBlur={() => saveLeft(r.emp_code)} /></td>
                        <td style={{ padding: "8px" }}><input type="text" className="form-control" style={{ height: "30px" }} value={left[r.emp_code]?.r || ""} onChange={e => setLeft({ ...left, [r.emp_code]: { d: left[r.emp_code]?.d || "", r: e.target.value } })} onBlur={() => saveLeft(r.emp_code)} /></td>
                      </tr>
                    ))}
                    {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: "18px" }}>No Data Found</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* action buttons */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center", marginTop: "18px" }}>
                <button style={green} disabled={busy} onClick={() => doSend("email")}>Send Email</button>
                <button style={blue} disabled={busy} onClick={() => doSend("blank")}>Send Blank Email</button>
                <button style={blue} disabled={busy} onClick={() => doSend("morning")}>Send Morning Email</button>
                <Link href="/hr/employees" style={blue}>Add Employee</Link>
                <button style={blue} disabled={busy} onClick={() => { if (!reqValidation()) return; setShowAddEmail(s => !s); }}>ADD EMAIL</button>
                <button style={blue} disabled={busy} onClick={() => doSend("pdf")}>Attendance PDF Send Email</button>
                <button style={blue} disabled={busy} onClick={() => doSend("admin")}>Send Admin Expense</button>
                <Link href="/Home" style={red}>CLOSE</Link>
              </div>

              {showAddEmail && (
                <div style={{ marginTop: "16px", background: "#f7f7f7", padding: "14px", borderRadius: "6px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end" }}>
                  <div style={{ flex: "1 1 180px" }}><b>Head Name :</b><input className="form-control" value={aeName} onChange={e => setAeName(e.target.value)} style={ctl} /></div>
                  <div style={{ flex: "1 1 220px" }}><b>Head Email Id :</b><span style={{ color: "red" }}>*</span><input className="form-control" value={aeEmail} onChange={e => setAeEmail(e.target.value)} style={ctl} /></div>
                  <div style={{ flex: "1 1 220px" }}><b>CC Email Id :</b><input className="form-control" value={aeCc} onChange={e => setAeCc(e.target.value)} style={ctl} /></div>
                  <div style={{ flex: "1 1 150px" }}><b>Mobile No :</b><input className="form-control" value={aeMob} onChange={e => setAeMob(e.target.value)} style={ctl} /></div>
                  <button style={green} onClick={addEmail}>Save Email</button>
                </div>
              )}

              {/* upload2 — Client Approved Attendance File Only */}
              <div style={{ marginTop: "20px", border: "1px solid #ddd", borderRadius: "6px", padding: "14px" }}>
                <b style={{ color: "#006699" }}>Client Approved Attendance File Only</b>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end", marginTop: "10px" }}>
                  <div style={{ flex: "1 1 220px" }}><b>Description :</b><input className="form-control" maxLength={50} value={desc} onChange={e => setDesc(e.target.value.replace(/["']/g, ""))} style={ctl} /></div>
                  <div style={{ flex: "1 1 220px" }}><b>File to Upload :</b><input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={e => setScanFile(e.target.files?.[0] ?? null)} style={{ display: "block", marginTop: "4px" }} /></div>
                  <button style={blue} onClick={uploadScan}> Upload </button>
                </div>
                <p style={{ fontSize: "12px", color: "#777", marginTop: "6px" }}>Only JPG, PNG,JPEG and PDF files will be uploaded.</p>
              </div>
            </>
          )}

          {/* ============ TAB 2: ATTACHMENT ============ */}
          {tab === "menu5" && (
            <>
              <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "18px", marginBottom: "16px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end" }}>
                  <div style={{ flex: "1 1 220px" }}><b>Client Name :</b>
                    <select className="form-control" value={attClient} onChange={e => setAttClient(e.target.value)} style={ctl}>
                      <option value="Select">Select</option>
                      {attClients.map(c => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
                    </select></div>
                  <div style={{ flex: "1 1 160px" }}><b>File Name :</b>
                    <select className="form-control" value={attFileName} onChange={e => setAttFileName(e.target.value)} style={ctl}>
                      <option value="0">Nothing</option><option value="1">Branch</option><option value="2">State</option>
                    </select></div>
                  <div style={{ flex: "1 1 220px" }}><b>File to Upload :</b><input type="file" accept=".xls,.xlsx,.pdf" onChange={e => setAttFile(e.target.files?.[0] ?? null)} style={{ display: "block", marginTop: "4px" }} /></div>
                  <button style={blue} onClick={uploadFeedback}> Upload</button>
                </div>
                <p style={{ fontSize: "12px", color: "#777", marginTop: "6px" }}>Only XLS and PDF files will be uploaded.</p>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff" }}>
                  <thead style={{ background: "#006699", color: "white" }}>
                    <tr>{["", "Client Name", "File Name", "Type", "FileName_And", "Download File", "Uploaded By", "Uploaded Date"].map((h, i) => <th key={i} style={{ padding: "8px" }}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {fbFiles.map(f => (
                      <tr key={f.id}>
                        <td style={{ padding: "8px", textAlign: "center" }}><button style={{ ...red, padding: "2px 8px" }} onClick={() => deleteFeedback(f.id)}>X</button></td>
                        <td style={{ padding: "8px" }}>{f.client_name || f.client_code}</td>
                        <td style={{ padding: "8px" }}>{f.file_name}</td>
                        <td style={{ padding: "8px" }}>{f.type}</td>
                        <td style={{ padding: "8px" }}>{f.filename_and}</td>
                        <td style={{ padding: "8px" }}><a href="#" onClick={e => { e.preventDefault(); downloadFb(f); }} style={{ color: "#337ab7" }}>Download</a></td>
                        <td style={{ padding: "8px" }}>{f.uploaded_by}</td>
                        <td style={{ padding: "8px" }}>{f.uploaded_date}</td>
                      </tr>
                    ))}
                    {fbFiles.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: "18px" }}>No Data Found</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function toISO(dmy: string): string {
  const m = dmy.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
function fromISO(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}
