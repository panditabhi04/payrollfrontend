"use client";
import React, { useEffect, useRef, useState } from "react";
import { getJSON, postJSON, upload, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";
import { MonthYearField, downloadAuth } from "./MaterialAmountTab";

/**
 * Attendance Sheet -> "Add OT Hrs" tab, 1:1 with legacy emp_sample.aspx #menu1:
 * Month/Year, Client, State, Branch, Process / Close, the OT-hours grid (Save / Approve), the signed
 * OT sheet upload and the uploaded-sheet grid (delete / download / reject reason).
 * Backend: /api/attendance/ot-sheet/.
 */
const BASE = "/api/attendance/ot-sheet/";
const headStyle: React.CSSProperties = { backgroundColor: "#006699", color: "#fff", textTransform: "uppercase" };

interface Opt { client_code: string; client_name: string }
interface Branch { unit_code: string; unit_name: string }
interface OtRow { emp_code: string; emp_name: string; designation: string; ot_hours: string }
interface Up { id: number; client_name: string; state_name: string; unit_name: string; month: string; file: string; rejected_reason: string; approved: boolean }

export default function OtSheetTab({ onClose }: { onClose?: () => void }) {
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [clients, setClients] = useState<Opt[]>([]);
  const [client, setClient] = useState("Select");
  const [states, setStates] = useState<string[]>([]);
  const [state, setState] = useState("Select");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branch, setBranch] = useState("Select");
  const [rows, setRows] = useState<OtRow[]>([]);
  const [visible, setVisible] = useState(false);
  const [ups, setUps] = useState<Up[]>([]);
  const [showUps, setShowUps] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { getJSON<{ results: Opt[] }>(`${BASE}clients/`).then(d => setClients(d?.results || [])); }, []);

  const body = (extra: object = {}) => ({ month, year, client_code: client, state_name: state, unit_code: branch, ...extra });
  const qs = () => `month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}&client_code=${encodeURIComponent(client)}` +
    `&state_name=${encodeURIComponent(state)}&unit_code=${encodeURIComponent(branch)}`;

  // legacy ot_validation(): Month/Year -> Client -> State -> Branch
  const validate = (): boolean => {
    if (!month || !year) { alert("Please Select Month/Year"); return false; }
    if (client === "Select") { alert("Please Select Client"); return false; }
    if (state === "Select") { alert("Please Select State"); return false; }
    if (branch === "Select") { alert("Please Select Branch"); return false; }
    return true;
  };

  const reset = () => { setRows([]); setVisible(false); setUps([]); setShowUps(false); };

  const onClient = async (v: string, m = month, y = year) => {
    setClient(v); setState("Select"); setBranch("Select"); setStates([]); setBranches([]); reset();
    if (v === "Select") return;
    const d = await getJSON<{ results: string[] }>(`${BASE}states/?client_code=${encodeURIComponent(v)}&month=${m}&year=${y}`);
    setStates(d?.results || []);
  };
  const onState = async (v: string) => {
    setState(v); setBranch("Select"); setBranches([]); reset();
    if (v === "Select") return;
    const d = await getJSON<{ results: Branch[] }>(
      `${BASE}branches/?client_code=${encodeURIComponent(client)}&state_name=${encodeURIComponent(v)}&month=${month}&year=${year}`);
    setBranches(d?.results || []);
  };

  // btn_ot_process_Click
  const process = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}${BASE}?${qs()}`, { credentials: "include" });
      if (!res.ok) { reset(); alert(await responseMessage(res)); return; }
      const d = await res.json();
      setRows(d.rows || []); setVisible(!!d.visible); setUps(d.uploads || []); setShowUps(true);
      if (d.alert) alert(d.alert);
    } finally { setBusy(false); }
  };

  const setHours = (i: number, v: string) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, ot_hours: v.replace(/[^0-9.]/g, "") } : r)));   // isNumberKey()

  const save = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await postJSON(`${BASE}save/`, body({ rows: rows.map(r => ({ emp_code: r.emp_code, ot_hours: r.ot_hours })) }));
      if (!res.ok) { alert(await responseMessage(res)); return; }
      const d = await res.json().catch(() => ({}));
      if (d.status) alert(d.status);
      if (d.rows) setRows(d.rows);
    } finally { setBusy(false); }
  };

  const approve = async () => {
    if (!confirm("Are you Sure You Want to Approve Record")) return;          // R_valid()
    setBusy(true);
    try {
      const res = await postJSON(`${BASE}approve/`, body());
      if (!res.ok) { alert(await responseMessage(res)); return; }
      const d = await res.json().catch(() => ({}));
      setVisible(false); setUps(d.uploads || []); setShowUps(true);
      alert(d.status || "Record Approve successfully !!");
    } finally { setBusy(false); }
  };

  // btn_ot_upload_Click (ot_upload_validation(): "Please Upload Employee OT File")
  const doUpload = async () => {
    const f = fileRef.current?.files?.[0];
    if (!f) { alert("Please Upload Employee OT File"); return; }
    if (!validate()) return;
    const fd = new FormData();
    Object.entries(body()).forEach(([k, v]) => fd.append(k, String(v)));
    fd.append("file", f);
    setBusy(true);
    try {
      const res = await upload(`${BASE}upload/`, fd);
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.status || "Files uploaded Successfully... !!!");
        setUps(d.uploads || []); setShowUps(true);
        if (fileRef.current) fileRef.current.value = "";
      } else alert(await responseMessage(res, "Files uploading Failed... !!!"));
    } finally { setBusy(false); }
  };

  const del = async (id: number) => {
    if (!confirm("Are you sure You want to  Delete ?")) return;
    const res = await postJSON(`${BASE}delete/`, { id });
    if (!res.ok) { alert(await responseMessage(res)); return; }
    alert("Record Deleted Succsefully !!!");
    const r = await fetch(`${API_BASE_URL}${BASE}?${qs()}`, { credentials: "include" });
    if (r.ok) { const d = await r.json(); setUps(d.uploads || []); }
  };

  const dl = (u: Up) => {
    if (!u.file) { alert("Attachment File Cannot Be Downloaded !!!"); return; }
    downloadAuth(`${BASE}download/?file=${encodeURIComponent(u.file)}&unit_name=${encodeURIComponent(u.unit_name)}`, u.file);
  };

  const th = (t: string) => <th style={headStyle}>{t}</th>;
  const approved = ups.some(u => u.approved);

  return (
    <div style={{ padding: "10px 0" }}>
      <div className="row">
        <div className="col-sm-2 col-xs-12">
          <b>Month / Year :</b><span style={{ color: "red" }}>*</span>
          <MonthYearField month={month} year={year}
            onChange={(m, y) => { setMonth(m); setYear(y); if (client !== "Select") onClient(client, m, y); }} />
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>Client Name :</b> <span style={{ color: "red" }}>*</span>
          <select className="form-control" value={client} onChange={e => onClient(e.target.value)}>
            <option value="Select">Select</option>
            {clients.map(c => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>State :</b><span style={{ color: "red" }}>*</span>
          <select className="form-control" value={state} onChange={e => onState(e.target.value)}>
            <option value="Select">Select</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>Branch Name :</b> <span style={{ color: "red" }}>*</span>
          <select className="form-control" value={branch} onChange={e => { setBranch(e.target.value); reset(); }}>
            <option value="Select">Select</option>
            {branches.map(b => <option key={b.unit_code} value={b.unit_code}>{b.unit_name}</option>)}
          </select>
        </div>
        <div className="col-sm-4 col-xs-12">
          <br />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={process}>Process</button>{" "}
          <button type="button" className="btn btn-danger" onClick={() => onClose?.()}>Close</button>
        </div>
      </div>
      <br /><br />

      {visible && (
        <div className="row">
          <div className="container">
            <div className="row">
              <table className="table" style={{ width: "100%", background: "#fff", border: "1px solid #ccc" }}>
                <thead><tr>{th("Sr No.")}{th("Employee Code")}{th("Employee Name")}{th("DESIGNATION")}{th("OT Hours :")}</tr></thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.emp_code} style={{ color: "#000066" }}>
                      <td>{i + 1}</td><td>{r.emp_code}</td><td>{r.emp_name}</td><td>{r.designation}</td>
                      <td><input className="form-control" style={{ width: "50%" }} value={r.ot_hours} onChange={e => setHours(i, e.target.value)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row text-center" style={{ textAlign: "center" }}>
              <br />
              <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>Save</button>{" "}
              <button type="button" className="btn btn-primary" disabled={busy} onClick={approve}>Approve</button>
            </div>
          </div>
          <br /><br />
          <div className="row">
            <div className="col-sm-5" />
            <div className="col-sm-6 col-xs-12">
              <table className="table table-striped" style={{ width: "20%", minWidth: 340 }}>
                <tbody>
                  <tr>
                    <td>File to Upload : <span style={{ color: "red" }}>*</span>
                      <input type="file" ref={fileRef} accept=".jpg,.jpeg,.png,.pdf,.zip" />
                      <span style={{ color: "red", fontSize: 8, fontWeight: "bold" }}>Only JPG,JPEG,GIF,PDF</span></td>
                    <td><button type="button" className="btn btn-primary" style={{ marginTop: "1em" }} disabled={busy} onClick={doUpload}> Upload </button></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showUps && ups.length > 0 && (
        <div className="container">
          <table className="table" style={{ width: "100%", background: "#fff", border: "1px solid #ccc" }}>
            <thead>
              <tr>
                {!approved && th("DELETE")}{th("Sr No.")}{th("Client Name")}{th("State")}{th("Branch Name")}{th("Month/Year")}{th("DOWNLOAD")}{th("Reject Reason")}
              </tr>
            </thead>
            <tbody>
              {ups.map((u, i) => (
                <tr key={u.id} style={{ color: "#000066" }}>
                  {!approved && <td><a href="#" title="Delete" onClick={e => { e.preventDefault(); del(u.id); }}><span className="glyphicon glyphicon-trash" style={{ color: "#d9534f" }}>&#128465;</span></a></td>}
                  <td>{i + 1}</td><td>{u.client_name}</td><td>{u.state_name}</td><td>{u.unit_name}</td><td>{u.month}</td>
                  <td><button type="button" className="btn btn-primary" style={{ color: "white", width: "90%" }} onClick={() => dl(u)}>OT Sheet</button></td>
                  <td>{u.rejected_reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
