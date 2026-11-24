"use client";
import React, { useEffect, useRef, useState } from "react";
import { getJSON, postJSON, upload, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";
import { MonthYearField, downloadAuth } from "./MaterialAmountTab";

/**
 * Attendance Sheet -> "Conveyance" tab, 1:1 with legacy emp_sample.aspx #menu5:
 * filter row (Select Month / Client / State / Branch / Employee Type / Employee Name) and the
 * "Employee Conveyance" + "Driver Conveyance" sub-tabs. Backend: /api/attendance/conveyance-legacy/.
 */
const BASE = "/api/attendance/conveyance-legacy/";
const EMP_TYPES = ["Permanent", "Reliever", "Staff", "Temporary", "Left"];
const headStyle: React.CSSProperties = { backgroundColor: "#006699", color: "#fff", textTransform: "uppercase" };

interface Opt { client_code: string; client_name: string }
interface Branch { unit_code: string; unit_name: string }
interface Emp { emp_code: string; emp_name: string }
interface GridRow { emp_code: string; emp_name: string; conveyance_rate: string; emp_con_deduction: string }
interface Up { client_name: string; state_name: string; unit_name: string; month: string; file: string }
interface StatusRow { client_name: string; state_name: string; unit_name: string; emp_name?: string }
interface Status { not_approved_admin: StatusRow[]; approved_admin: StatusRow[]; approved_finance: StatusRow[]; rejected_finance: StatusRow[] }
const ZERO = { food_days: "0", oc_days: "0", os_days: "0", nh_days: "0", total_km: "0", deduction_amount: "0" };

export default function ConveyanceTab({ onClose }: { onClose?: () => void }) {
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [clients, setClients] = useState<Opt[]>([]);
  const [client, setClient] = useState("Select");
  const [states, setStates] = useState<string[]>([]);
  const [state, setState] = useState("Select");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branch, setBranch] = useState("Select");
  const [etype, setEtype] = useState("Select");
  const [emps, setEmps] = useState<Emp[]>([]);
  const [emp, setEmp] = useState("ALL");
  const [sub, setSub] = useState<"emp" | "driver">("emp");
  const [rows, setRows] = useState<GridRow[]>([]);
  const [ups, setUps] = useState<Up[]>([]);
  const [canEdit, setCanEdit] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [modal, setModal] = useState<{ title: string; rows: StatusRow[]; emp?: boolean } | null>(null);
  const [drvPanel, setDrvPanel] = useState(false);
  const [drvEdit, setDrvEdit] = useState(true);
  const [drv, setDrv] = useState({ ...ZERO });
  const [drvUps, setDrvUps] = useState<Up[]>([]);
  const [drvStatus, setDrvStatus] = useState<Status | null>(null);
  const empFile = useRef<HTMLInputElement>(null);
  const drvFile = useRef<HTMLInputElement>(null);

  useEffect(() => { getJSON<{ results: Opt[] }>(`${BASE}clients/`).then(d => setClients(d?.results || [])); }, []);

  const q = (m = month, y = year, c = client, s = state, b = branch, t = etype, e = emp) =>
    `month=${encodeURIComponent(m)}&year=${encodeURIComponent(y)}&client_code=${encodeURIComponent(c)}` +
    `&state_name=${encodeURIComponent(s)}&unit_code=${encodeURIComponent(b)}&employee_type=${encodeURIComponent(t)}` +
    `&emp_code=${encodeURIComponent(e)}`;
  const body = (extra: object = {}) => ({
    month, year, client_code: client, state_name: state, unit_code: branch, employee_type: etype, emp_code: emp, ...extra,
  });

  // legacy driver_conveyneance1() (Save / Reports of Employee Conveyance) and driver_conveyneance() (+ employee)
  const validate = (needEmp = false): boolean => {
    if (!month || !year) { alert("Please Select Month"); return false; }
    if (client === "Select") { alert("Please Select Client "); return false; }
    if (state === "Select") { alert("Please Select State "); return false; }
    if (branch === "Select") { alert("Please Select Branch Name "); return false; }
    if (etype === "Select") { alert("Please Select Employee Type "); return false; }
    if (needEmp && emp === "ALL") { alert("Please Select Employee Name "); return false; }
    return true;
  };

  const clearAll = () => {
    setRows([]); setUps([]); setCanEdit(true); setStatus(null); setEmps([]); setEmp("ALL");
    setDrvPanel(false); setDrvEdit(true); setDrv({ ...ZERO }); setDrvUps([]); setDrvStatus(null);
  };

  const onClient = async (v: string, m = month, y = year) => {
    setClient(v); setState("Select"); setBranch("Select"); setStates([]); setBranches([]); clearAll();
    if (v === "Select") return;
    const d = await getJSON<{ results: string[] }>(`${BASE}states/?client_code=${encodeURIComponent(v)}&month=${m}&year=${y}`);
    setStates(d?.results || []);
  };
  const onState = async (v: string) => {
    setState(v); setBranch("Select"); setBranches([]); clearAll();
    if (v === "Select") return;
    const d = await getJSON<{ results: Branch[] }>(
      `${BASE}branches/?client_code=${encodeURIComponent(client)}&state_name=${encodeURIComponent(v)}&month=${month}&year=${year}`);
    setBranches(d?.results || []);
  };

  // ddlunitselect_SelectedIndexChanged: employee list + grid + uploaded sheet
  const loadGrid = async (over: { b?: string; t?: string; m?: string; y?: string } = {}) => {
    const b = over.b ?? branch, t = over.t ?? etype, m = over.m ?? month, y = over.y ?? year;
    setEmp("ALL"); setDrvPanel(false); setDrv({ ...ZERO }); setDrvUps([]); setStatus(null); setDrvStatus(null);
    if (!m || !y || client === "Select" || state === "Select" || b === "Select" || t === "Select") { setRows([]); setUps([]); setEmps([]); return; }
    setBusy(true);
    try {
      const r1 = await fetch(`${API_BASE_URL}${BASE}employees/?${q(m, y, client, state, b, t, "ALL")}`, { credentials: "include" });
      if (r1.ok) setEmps((await r1.json()).results || []); else { setEmps([]); alert(await responseMessage(r1)); return; }
      const r2 = await fetch(`${API_BASE_URL}${BASE}?${q(m, y, client, state, b, t, "ALL")}`, { credentials: "include" });
      if (!r2.ok) { setRows([]); setUps([]); alert(await responseMessage(r2)); return; }
      const d = await r2.json();
      setRows(d.rows || []); setUps(d.uploads || []); setCanEdit(!!d.can_edit);
      if (d.alert) alert(d.alert);
    } finally { setBusy(false); }
  };

  const reloadUps = async () => {
    const r2 = await fetch(`${API_BASE_URL}${BASE}?${q(month, year, client, state, branch, etype, "ALL")}`, { credentials: "include" });
    if (r2.ok) { const d = await r2.json(); setUps(d.uploads || []); setRows(d.rows || []); setCanEdit(!!d.can_edit); }
  };

  // ddlemployee_SelectedIndexChanged: driver record + driver uploads
  const loadDriver = async (code: string) => {
    setEmp(code); setDrvStatus(null);
    if (code === "ALL") { setDrvPanel(false); setDrv({ ...ZERO }); setDrvUps([]); return; }
    const r = await fetch(`${API_BASE_URL}${BASE}driver/?${q(month, year, client, state, branch, etype, code)}`, { credentials: "include" });
    if (!r.ok) { alert(await responseMessage(r)); return; }
    const d = await r.json();
    setDrvPanel(!!d.panel); setDrvEdit(!!d.can_edit); setDrvUps(d.uploads || []);
    setDrv({ ...ZERO, ...(d.values || {}) });
    if (d.alert) alert(d.alert);
  };

  const setCell = (i: number, k: "conveyance_rate" | "emp_con_deduction", v: string) =>
    setRows(rs => rs.map((r, idx) => (idx === i ? { ...r, [k]: v.replace(/[^0-9.]/g, "") } : r)));  // isNumber_dot()

  const send = async (path: string, extra: object = {}) => {
    setBusy(true);
    try {
      const res = await postJSON(`${BASE}${path}`, body(extra));
      if (res.ok) return await res.json().catch(() => ({}));
      alert(await responseMessage(res, "Request failed."));
      return null;
    } finally { setBusy(false); }
  };

  const save = async () => {
    if (!validate()) return;
    const d = await send("save/", { rows });
    if (d) { alert(d.alert || d.status); await reloadUps(); }
  };
  const approve = async () => {
    const d = await send("approve/", { rows });
    if (d) { alert(d.status || "Conveyance Approved Successfully!!"); setCanEdit(false); setRows([]); setUps([]); }
  };
  const reports = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}${BASE}status/?${q()}`, { credentials: "include" });
      if (!r.ok) { alert(await responseMessage(r)); return; }
      setStatus(await r.json());
    } finally { setBusy(false); }
  };

  const doUpload = async (driver: boolean) => {
    const f = (driver ? drvFile : empFile).current?.files?.[0];
    if (!f) { alert(driver ? "Please Enter Driver Conveyance Bill Upload" : "Please Upload Employee Conveyance"); return; }
    if (!validate(driver)) return;
    const fd = new FormData();
    Object.entries(body()).forEach(([k, v]) => fd.append(k, String(v)));
    fd.append("file", f);
    setBusy(true);
    try {
      const res = await upload(`${BASE}${driver ? "driver-upload/" : "upload/"}`, fd);
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.status || "Conveyance Files uploaded Successfully... !!!");
        if (driver) { setDrvUps(d.uploads || []); if (drvFile.current) drvFile.current.value = ""; }
        else { setUps(d.uploads || []); if (empFile.current) empFile.current.value = ""; }
      } else alert(await responseMessage(res, "Conveyance Files uploading Failed... !!!"));
    } finally { setBusy(false); }
  };

  const driverPost = async (path: string, okMsg: string) => {
    if (!validate(true)) return;
    const d = await send(path, drv);
    if (d) {
      alert(d.status || okMsg);
      if (path === "driver-approve/") { setDrvPanel(false); setDrv({ ...ZERO }); setDrvEdit(false); }
    }
  };
  const driverReports = async () => {
    if (!validate(true)) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}${BASE}driver-status/?${q()}`, { credentials: "include" });
      if (!r.ok) { alert(await responseMessage(r)); return; }
      setDrvStatus(await r.json());
    } finally { setBusy(false); }
  };

  const dl = (u: Up) => {
    if (!u.file) { alert("Attachment File Cannot Be Downloaded !!!"); return; }
    downloadAuth(`${BASE}download/?file=${encodeURIComponent(u.file)}&unit_name=${encodeURIComponent(u.unit_name)}`, u.file);
  };

  const th = (t: string) => <th style={headStyle}>{t}</th>;
  const sel = "form-control";
  const notify = (s: Status, driver: boolean) => (
    <div className="row" style={{ marginTop: 10 }}>
      <div className="col-sm-8 col-xs-12" />
      <div className="col-sm-4 col-xs-12">
        <div style={{ maxHeight: 200, overflowY: "auto", overflowX: "hidden" }}>
          <table border={1} className="table table-striped">
            <tbody>
              <tr style={{ backgroundColor: "#eeeaea" }}><th>Branch Count</th><th style={{ textAlign: "center" }}>Notification</th></tr>
              {([["not_approved_admin", "Branches Not Approved By Admin", "Branches Not Approve By Admin"],
                ["approved_admin", "Branches Approved By Admin", "Branches  Approve By Admin"],
                ["approved_finance", "Branches Approve By Finance", "Branches  Approve By Finance"],
                ["rejected_finance", "Branches Reject By Finance", "Reject By Finance"]] as [keyof Status, string, string][]).map(([k, label, title]) => (
                <tr key={k}>
                  <td style={{ fontWeight: "bold" }}>{s[k].length}</td>
                  <td><a href="#" onClick={e => { e.preventDefault(); setModal({ title, rows: s[k], emp: driver }); }}><b>{label}</b></a></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
  const upGrid = (list: Up[]) => list.length > 0 && (
    <div className="container" style={{ width: "75%", marginTop: 10 }}>
      <table className="table" style={{ width: "100%", background: "#fff", border: "1px solid #ccc" }}>
        <thead><tr>{th("Sr No.")}{th("Client Name")}{th("State")}{th("Branch Name")}{th("Month")}{th("DOWNLOAD")}</tr></thead>
        <tbody>
          {list.map((u, i) => (
            <tr key={i} style={{ color: "#000066" }}>
              <td>{i + 1}</td><td>{u.client_name}</td><td>{u.state_name}</td><td>{u.unit_name}</td><td>{u.month}</td>
              <td><button type="button" className="btn btn-primary" style={{ color: "white" }} onClick={() => dl(u)}>conveyance</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  const fileBox = (driver: boolean) => (
    <table className="table table-striped" style={{ width: "20%", minWidth: 320 }}>
      <tbody>
        <tr>
          <td>File to Upload :
            <input type="file" ref={driver ? drvFile : empFile} accept=".jpg,.jpeg,.png,.pdf,.zip" />
            <span style={{ color: "red", fontSize: 8, fontWeight: "bold" }}>Only JPG,JPEG,GIF,PDF</span></td>
          <td><button type="button" className="btn btn-primary" style={{ marginTop: "1em" }} disabled={busy} onClick={() => doUpload(driver)}> Upload </button></td>
        </tr>
      </tbody>
    </table>
  );
  const drvField = (label: string, k: keyof typeof ZERO, unitLabel: string) => (
    <>
      <div className="row">
        <div className="col-sm-2 col-xs-12" />
        <div className="col-sm-3 col-xs-12" style={{ marginTop: 25, textAlign: "left", fontWeight: "bold" }}>{label}</div>
        <div className="col-sm-1 col-xs-12" />
        <div className="col-sm-2 col-xs-12">
          {unitLabel}
          <input className="form-control" value={drv[k]} onChange={e => setDrv(v => ({ ...v, [k]: e.target.value.replace(/[^0-9]/g, "") }))} />
        </div>
      </div>
      <br />
    </>
  );

  return (
    <div style={{ padding: "10px 0" }}>
      <div className="row">
        <div className="col-sm-2 col-xs-12">
          <b>Select Month :</b><span style={{ color: "red" }}>*</span>
          <MonthYearField month={month} year={year}
            onChange={(m, y) => { setMonth(m); setYear(y); if (client !== "Select") onClient(client, m, y); }} />
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>Client Name :</b>
          <select className={sel} value={client} onChange={e => onClient(e.target.value)}>
            <option value="Select">Select</option>
            {clients.map(c => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>State Name :</b>
          <select className={sel} value={state} onChange={e => onState(e.target.value)}>
            <option value="Select">Select</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>Branch Name :</b>
          <select className={sel} value={branch} onChange={e => { setBranch(e.target.value); loadGrid({ b: e.target.value }); }}>
            <option value="Select">Select</option>
            {branches.map(b => <option key={b.unit_code} value={b.unit_code}>{b.unit_name}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>Employee Type :</b>
          <select className={sel} value={etype} onChange={e => { setEtype(e.target.value); loadGrid({ t: e.target.value }); }}>
            <option value="Select">Select</option>
            {EMP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>Employee Name :</b>
          <select className={sel} value={emp} onChange={e => loadDriver(e.target.value)}>
            <option value="ALL">ALL</option>
            {emps.map(e => <option key={e.emp_code} value={e.emp_code}>{e.emp_name}</option>)}
          </select>
        </div>
      </div>
      <br />

      <div style={{ background: "beige" }}>
        <ul className="nav nav-tabs" style={{ margin: 0 }}>
          <li className={sub === "emp" ? "active" : ""}><a href="#" onClick={e => { e.preventDefault(); setSub("emp"); }}>Employee Conveyance</a></li>
          <li className={sub === "driver" ? "active" : ""}><a href="#" onClick={e => { e.preventDefault(); setSub("driver"); }}>Driver Conveyance</a></li>
        </ul>

        {sub === "emp" && (
          <div style={{ paddingTop: 8 }}>
            {fileBox(false)}
            {status && notify(status, false)}
            {upGrid(ups)}
            <br />
            {rows.length > 0 && (
              <div className="container" style={{ width: "75%", overflowY: "auto", height: 300 }}>
                <table className="table" style={{ width: "100%", background: "#fff" }}>
                  <thead><tr>{th("Sr No.")}{th("Employee Code")}{th("Employee Name")}{th("Conveyance Amount :")}{th("Conveyance Deduction :")}</tr></thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.emp_code} style={{ color: "#000066" }}>
                        <td>{i + 1}</td><td>{r.emp_code}</td><td>{r.emp_name}</td>
                        <td><input className="form-control" value={r.conveyance_rate} disabled={!canEdit} onChange={e => setCell(i, "conveyance_rate", e.target.value)} /></td>
                        <td style={{ width: 70 }}><input className="form-control" value={r.emp_con_deduction} disabled={!canEdit} onChange={e => setCell(i, "emp_con_deduction", e.target.value)} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <br />
            {etype !== "Select" && (
              <div className="row text-center" style={{ textAlign: "center", paddingBottom: 12 }}>
                {canEdit && <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>Save</button>}{" "}
                {canEdit && <button type="button" className="btn btn-primary" style={{ width: "10%" }} disabled={busy} onClick={approve}>Approve</button>}{" "}
                {canEdit && <button type="button" className="btn btn-primary" disabled={busy} onClick={reports}>Reports</button>}{" "}
                <button type="button" className="btn btn-danger" onClick={() => onClose?.()}>Close</button>
              </div>
            )}
          </div>
        )}

        {sub === "driver" && (
          <div className="container-fluid" style={{ paddingTop: 8 }}>
            {fileBox(true)}
            {drvStatus && notify(drvStatus, true)}
            {upGrid(drvUps)}
            {drvPanel && (
              <>
                {drvField("FOOD ALLOWANCE :", "food_days", "Days :")}
                {drvField("OUTSTATION ALLOWANCE/CONVEYANCE :", "oc_days", "Days :")}
                {drvField("OUTSTATION FOOD ALLOWANCE :", "os_days", "Days :")}
                {drvField("NIGHT HALT :", "nh_days", "Days :")}
                {drvField("TOTAL KM AMOUNT :", "total_km", "Total  :")}
                {drvField("DEDUCTION :", "deduction_amount", "Amount  :")}
              </>
            )}
            <br />
            <div className="row text-center" style={{ textAlign: "center", paddingBottom: 12 }}>
              {drvEdit && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => driverPost("driver-save/", "Record Save successfully Please Approve This Employee!!")}>Save</button>}{" "}
              {drvEdit && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => driverPost("driver-approve/", "Driver Conveyance Approved Successfully!!")}>Approve</button>}{" "}
              {drvEdit && <button type="button" className="btn btn-primary" disabled={busy} onClick={driverReports}>Reports</button>}
            </div>
          </div>
        )}
      </div>

      {modal && (
        <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1050, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", width: 560, maxWidth: "95%", borderRadius: 6, boxShadow: "0 5px 15px rgba(0,0,0,.5)" }}>
            <div style={{ padding: 15, borderBottom: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between" }}>
              <h4 style={{ margin: 0 }}>{modal.title}</h4>
              <button type="button" className="close" onClick={() => setModal(null)}>&times;</button>
            </div>
            <div style={{ padding: 15, maxHeight: 360, overflowY: "auto" }}>
              <table className="table">
                <thead><tr><th>Client Name</th><th>State Namae</th><th>Branch Name</th>{modal.emp && <th>Employee Name</th>}</tr></thead>
                <tbody>{modal.rows.map((r, i) => <tr key={i}><td>{r.client_name}</td><td>{r.state_name}</td><td>{r.unit_name}</td>{modal.emp && <td>{r.emp_name}</td>}</tr>)}</tbody>
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
