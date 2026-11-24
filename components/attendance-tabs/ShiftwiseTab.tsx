"use client";
// Attendance Sheet -> "Shiftwise Attendance" tab. 1:1 port of legacy emp_sample.aspx #menu10:
// Month/Year, Client, State, Branch + Process; grid (Sr. No., SELECT, EMPLOYEE Name, Shift Count),
// "File to Upload", Save and Approve. (Legacy hides the EMPLOYEE CODE column in RowDataBound.)
import React, { useEffect, useRef, useState } from "react";
import { getJSON, upload, mk, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

interface ClientItem { client_code: string; client_name: string; }
interface UnitItem { unit_code: string; unit_name: string; client_code: string; state_name: string; }
interface EmpRow { emp_code: string; emp_name: string; shift: string; checked: boolean; }

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const VALID_EXT = [".jpg", ".jpeg", ".gif", ".pdf"];   // legacy ValidateSingleInput()
const lbl: React.CSSProperties = { fontWeight: 700 };
const red: React.CSSProperties = { color: "red" };

function MonthYear({ value, onChange }: { value: { m: string; y: string }; onChange: (v: { m: string; y: string }) => void }) {
  const now = new Date();
  const curY = now.getFullYear(), curM = now.getMonth() + 1;
  const [open, setOpen] = useState(false);
  const [vy, setVy] = useState(curY);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const display = value.m && value.y ? `${value.m.padStart(2, "0")}/${value.y}` : "";
  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <input className="form-control" readOnly value={display} placeholder="mm/yyyy" style={{ cursor: "pointer", background: "#fff" }}
        onClick={() => { setVy(value.y ? parseInt(value.y, 10) : curY); setOpen(o => !o); }} />
      {open && (
        <div style={{ position: "absolute", top: 38, left: 0, zIndex: 50, background: "#fff", border: "1px solid #428bca", borderRadius: 6, boxShadow: "0 4px 14px rgba(0,0,0,.25)", padding: 10, width: 230 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <button type="button" className="btn btn-default btn-xs" disabled={vy <= 1990} onClick={() => setVy(y => y - 1)}>&lsaquo;</button>
            <b style={{ color: "#006699" }}>{vy}</b>
            <button type="button" className="btn btn-default btn-xs" disabled={vy >= curY} onClick={() => setVy(y => y + 1)}>&rsaquo;</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
            {MONTHS.map((n, i) => {
              const dis = vy === curY && i + 1 > curM;
              const sel = value.m === String(i + 1) && value.y === String(vy);
              return (
                <button key={n} type="button" disabled={dis} className={"btn btn-xs " + (sel ? "btn-primary" : "btn-default")}
                  onClick={() => { onChange({ m: String(i + 1), y: String(vy) }); setOpen(false); }}>{n.slice(0, 3)}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ShiftwiseTab() {
  const [my, setMy] = useState({ m: "", y: "" });
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [branch, setBranch] = useState("Select");
  const [rows, setRows] = useState<EmpRow[]>([]);
  const [showGrid, setShowGrid] = useState(false);     // Panel24 / buton_visibility
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const loadClients = () => {
      getJSON<{ results: ClientItem[] }>(`/api/masters/clients/?page_size=all`).then(d => { if (alive) setClients(d?.results || []); });
    };
    loadClients();
    // A client created in another tab (e.g. Client Master) must appear here
    // without a full reload — refresh whenever the page becomes visible again.
    const refresh = () => { if (!document.hidden) loadClients(); };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => { alive = false; document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); };
  }, []);
  useEffect(() => {
    if (client === "Select") { setUnits([]); return; }
    getJSON<{ units: UnitItem[] }>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(client)}`).then(d => setUnits(d?.units ?? []));
  }, [client]);

  const states = Array.from(new Set(units.map(u => u.state_name).filter(Boolean))).sort();
  const branches = units.filter(u => u.state_name === state);

  // ddl_client/state_shiftwise_SelectedIndexChanged: clear grid and hide the button panel
  const clear = () => { setRows([]); setShowGrid(false); };
  const onClient = (v: string) => { setClient(v); setState("Select"); setBranch("Select"); clear(); };
  const onState = (v: string) => { setState(v); setBranch("Select"); clear(); };

  // req_validation_shift()
  const validate = (): boolean => {
    if (!my.m || !my.y) { alert("Please Select Month/Year "); return false; }
    if (client === "Select") { alert("Please Select Client Name... "); return false; }
    if (state === "Select") { alert("Please Select State Name... "); return false; }
    if (branch === "Select") { alert("Please Select Branch Name... "); return false; }
    return true;
  };
  const base = () => ({
    month_year: `${my.m.padStart(2, "0")}/${my.y}`, client_code: client, state_name: state, unit_code: branch,
  });

  const process = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const qs = new URLSearchParams(base());
      const res = await fetch(API_BASE_URL + `/api/attendance/shiftwise-attendance/?${qs.toString()}`, { credentials: "include" });
      if (!res.ok) { clear(); alert(await responseMessage(res, "Request failed.")); return; }
      const d = await res.json();
      setRows((d.results || []).map((r: any) => ({ emp_code: r.emp_code, emp_name: r.emp_name, shift: r.shift ?? "", checked: false })));
      setShowGrid(true);
    } finally { setBusy(false); }
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (f && !VALID_EXT.some(x => f.name.toLowerCase().endsWith(x))) {
      alert("Sorry, " + f.name + " is invalid, allowed extensions are: " + VALID_EXT.join(", "));
      setFileKey(k => k + 1); setFile(null); return;
    }
    setFile(f);
  };

  const allChecked = rows.length > 0 && rows.every(r => r.checked);
  const payloadRows = () => rows.map(r => ({ emp_code: r.emp_code, emp_name: r.emp_name, shift: r.shift, checked: r.checked }));

  // btn_save_shift_Click (client-side checks first, the server re-checks in the same order)
  const save = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(base()).forEach(([k, v]) => fd.append(k, v));
      fd.append("rows", JSON.stringify(payloadRows()));
      if (file) fd.append("shift_file", file);
      const res = await upload("/api/attendance/shiftwise-attendance/save/", fd);
      if (!res.ok) { alert(await responseMessage(res, "Request failed.")); return; }
      const d = await res.json().catch(() => null);
      alert("Shift Save successfully !!");
      if (d && Array.isArray(d.results)) {
        setRows(d.results.map((r: any) => ({ emp_code: r.emp_code, emp_name: r.emp_name, shift: r.shift ?? "", checked: false })));
      }
      setFile(null); setFileKey(k => k + 1);
    } finally { setBusy(false); }
  };

  // btn_approve_shift_Click
  const approve = async () => {
    setBusy(true);
    try {
      const res = await mk("/api/attendance/shiftwise-attendance/approve/", { ...base(), rows: payloadRows() });
      if (!res.ok) { alert(await responseMessage(res, "Request failed.")); return; }
      setShowGrid(false);       // legacy hides the button panel after approval
      alert("Shift Approved Successfully !!");
    } finally { setBusy(false); }
  };

  const th: React.CSSProperties = { background: "#006699", color: "#fff", textTransform: "uppercase" };

  return (
    <div>
      <div className="container-fluid">
        <div className="row">
          <div className="col-sm-2 col-xs-12">
            <span style={lbl}>Month / Year :</span><span style={red}>*</span>
            <MonthYear value={my} onChange={v => { setMy(v); clear(); }} />
          </div>
          <div className="col-sm-2 col-xs-12">
            <span style={lbl}>Client Name :</span> <span style={red}>*</span>
            <select className="form-control" value={client} onChange={e => onClient(e.target.value)}>
              <option value="Select">Select</option>
              {clients.map(c => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
            </select>
          </div>
          <div className="col-sm-2 col-xs-12">
            <span style={lbl}>State :</span><span style={red}>*</span>
            <select className="form-control" value={state} onChange={e => onState(e.target.value)}>
              <option value="Select">Select</option>
              {states.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="col-sm-2 col-xs-12">
            <span style={lbl}>Branch Name :</span> <span style={red}>*</span>
            <select className="form-control" value={branch} onChange={e => { setBranch(e.target.value); clear(); }}>
              <option value="Select">Select</option>
              {branches.map(u => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
            </select>
          </div>
          <div className="col-sm-4 col-xs-12">
            <br />
            <button type="button" className="btn btn-primary" disabled={busy} onClick={process}>Process</button>
          </div>
        </div>
      </div>

      <br />
      {showGrid && (
        <>
          <div className="container" style={{ width: "60%" }}>
            <div style={{ overflowY: "auto", maxHeight: 250, overflowX: "hidden" }}>
              <table className="table" style={{ border: "1px solid #ccc", color: "#333" }}>
                <thead>
                  <tr>
                    <th style={th}>Sr. No.</th>
                    <th style={th}>
                      <label style={{ fontWeight: 700, margin: 0 }}>
                        <input type="checkbox" checked={allChecked}
                          onChange={e => setRows(rs => rs.map(r => ({ ...r, checked: e.target.checked })))} /> SELECT
                      </label>
                    </th>
                    <th style={th}>EMPLOYEE Name</th>
                    <th style={th}>Shift Count :</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.emp_code} style={{ color: "#000066", background: "#fff" }}>
                      <td>{i + 1}</td>
                      <td><input type="checkbox" className="center-block" checked={r.checked}
                        onChange={e => setRows(rs => rs.map((x, k) => k === i ? { ...x, checked: e.target.checked } : x))} /></td>
                      <td>{r.emp_name}</td>
                      <td style={{ width: 100 }}>
                        <input type="text" className="form-control" value={r.shift}
                          onKeyDown={e => { if (e.key.length === 1 && !/[0-9.]/.test(e.key) && !e.ctrlKey && !e.metaKey) e.preventDefault(); }}
                          onChange={e => setRows(rs => rs.map((x, k) => k === i ? { ...x, shift: e.target.value.replace(/[^0-9.]/g, "") } : x))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <br />
          </div>

          <br /><br />
          <div className="row">
            <div className="col-sm-2"></div>
            <div className="col-sm-3 col-xs-12">
              <table className="table table-striped" style={{ width: "30%" }}>
                <tbody>
                  <tr>
                    <td>
                      File to Upload :
                      <input key={fileKey} type="file" onChange={onFile} accept=".jpg,.jpeg,.gif,.pdf" />
                      <span style={{ color: "red", fontSize: 8, fontWeight: "bold" }}>Only JPG,JPEG,GIF,PDF</span>
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>Save</button>{" "}
            <button type="button" className="btn btn-primary" disabled={busy} onClick={approve}>Approve</button>
          </div>
        </>
      )}
    </div>
  );
}
