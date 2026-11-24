"use client";
import React, { useEffect, useRef, useState } from "react";
import { getJSON, postJSON, upload, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";
import { MonthYearField, downloadAuth } from "./MaterialAmountTab";

/**
 * Attendance Sheet -> "Material Challan Uploading" tab (legacy emp_sample.aspx #menu9).
 * Backend: /api/attendance/material-challan/ (MaterialChallanViewSet).
 */
const BASE = "/api/attendance/material-challan/";

interface Opt { client_code: string; client_name: string }
interface Br { unit_code: string; unit_name: string }
interface GridRow {
  id: number; src?: string; unit_code: string; state_name: string; unit_name: string; month_year: string;
  has_file: boolean; status: string; reject_reason?: string; contract_name?: string;
}
interface Grids { mode: "upload" | "approved"; can_approve: boolean; rows: GridRow[]; notice?: string; messages?: string[] }
interface StRow { client_name: string; state_name: string; unit_name: string; contract_name?: string }
interface Status { not_approved_admin: StRow[]; approved_admin: StRow[]; approved_finance: StRow[]; rejected_finance: StRow[] }

const hdr: React.CSSProperties = { backgroundColor: "#224173", color: "#fff", fontWeight: "bold" };

export default function MaterialChallanTab() {
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [billType, setBillType] = useState("Select");
  const [clients, setClients] = useState<Opt[]>([]);
  const [client, setClient] = useState("Select");
  const [states, setStates] = useState<string[]>([]);
  const [state, setState] = useState("");
  const [branches, setBranches] = useState<Br[]>([]);
  const [branchList, setBranchList] = useState(false);     // true once a state change loaded the branch list
  const [branch, setBranch] = useState("");
  const [grids, setGrids] = useState<Grids | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const files = useRef<Record<number, File | undefined>>({});
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [modal, setModal] = useState<{ title: string; rows: StRow[]; contract: boolean } | null>(null);

  const billName = ({ "1": "Material", "2": "DeepClean", "3": "PasteControl" } as Record<string, string>)[billType] || "";

  const params = () => `month=${encodeURIComponent(month)}&year=${encodeURIComponent(year)}&bill_type=${billType}` +
    `&client_code=${encodeURIComponent(client)}&state_name=${encodeURIComponent(state)}&unit_code=${encodeURIComponent(branch)}`;
  const common = () => ({ month, year, bill_type: billType, client_code: client, state_name: state, unit_code: branch });

  // legacy validation_process_btn()
  const validate = (): boolean => {
    if (!month || !year) { alert("Please Enter Date"); return false; }
    if (client === "Select") { alert("Please Select Client"); return false; }
    if (!state || state === "Select") { alert("Please Select State"); return false; }
    if (!branch || branch === "Select") { alert("Please Select Branch"); return false; }
    return true;
  };

  const reset = () => { setGrids(null); setStatus(null); setChecked({}); files.current = {}; };

  // ddl_material_bill_type_SelectedIndexChanged -> client_code_for_material_upload
  const onBill = async (v: string) => {
    setBillType(v); setClient("Select"); setClients([]); setStates([]); setState(""); setBranches([]); setBranch(""); setBranchList(false); reset();
    if (v === "Select") return;
    const d = await getJSON<{ results: Opt[] }>(`${BASE}clients/?bill_type=${v}`);
    setClients(d?.results || []);
  };
  // ddl_client_material_upload_SelectedIndexChanged: State = ALL + states, Branch = ALL
  const onClient = async (v: string) => {
    setClient(v); setBranches([]); setBranchList(false); setBranch("ALL"); reset();
    if (v === "Select") { setStates([]); setState(""); setBranch(""); return; }
    const d = await getJSON<{ results: string[] }>(`${BASE}states/?client_code=${encodeURIComponent(v)}`);
    setStates(["ALL", ...(d?.results || [])]); setState("ALL");
  };
  // ddl_state_material_upload_SelectedIndexChanged: Branch = Select, ALL, billing branches
  const onState = async (v: string) => {
    setState(v); reset();
    const d = await getJSON<{ results: Br[] }>(
      `${BASE}branches/?bill_type=${billType}&client_code=${encodeURIComponent(client)}&state_name=${encodeURIComponent(v)}`);
    setBranches(d?.results || []); setBranchList(true); setBranch("Select");
  };

  const applyGrids = (d: Grids) => { setGrids(d); setChecked({}); files.current = {}; setSearch(""); };

  const process = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await postJSON(`${BASE}process/`, common());
      if (!res.ok) { alert(await responseMessage(res, "Request failed.")); return; }
      const d: Grids = await res.json();
      applyGrids(d);
      if (d.notice) alert(d.notice);
    } finally { setBusy(false); }
  };

  const reports = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}${BASE}status/?${params()}`, { credentials: "include" });
      if (!res.ok) { alert(await responseMessage(res, "Request failed.")); return; }
      setStatus(await res.json());
    } finally { setBusy(false); }
  };

  const approve = async () => {
    // legacy material_approve_validation()
    const ids = Object.keys(checked).filter(k => checked[Number(k)]).map(Number);
    if (!ids.length) { alert("Please select atleast one Record "); return; }
    if (!validate()) return;
    const fd = new FormData();
    Object.entries(common()).forEach(([k, v]) => fd.append(k, String(v)));
    fd.append("ids", JSON.stringify(ids));
    ids.forEach(i => { const f = files.current[i]; if (f) fd.append(`file_${i}`, f); });
    setBusy(true);
    try {
      const res = await upload(`${BASE}approve/`, fd);
      if (!res.ok) { alert(await responseMessage(res, "Request failed.")); return; }
      const d: Grids = await res.json();
      (d.messages || []).forEach(m => alert(m));
      applyGrids(d);
    } finally { setBusy(false); }
  };

  const download = (r: GridRow) => {
    if (!r.has_file) { alert("Attachment File Cannot Be Uploaded !!!"); return; }
    downloadAuth(`${BASE}download/?id=${r.id}&src=${r.src || "M"}`, `${r.unit_code}_${billName}`);
  };

  const rows = (grids?.rows || []).filter(r =>
    !search || [r.state_name, r.unit_name, r.month_year, r.contract_name || billName].join(" ").toLowerCase().includes(search.toLowerCase()));
  const allChecked = rows.length > 0 && rows.every(r => checked[r.id]);

  const show = (title: string, rs: StRow[], contract: boolean) => setModal({ title, rows: rs, contract });
  const link = (t: string, onClick: () => void) => <a href="#" onClick={e => { e.preventDefault(); onClick(); }}><b>{t}</b></a>;

  return (
    <div style={{ padding: "10px 0" }}>
      <div className="row">
        <div className="col-sm-2 col-xs-12">
          <b>Select Month :</b><span style={{ color: "red" }}>*</span>
          <MonthYearField month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>Bill Type :</b> <span style={{ color: "red" }}>*</span>
          <select className="form-control" value={billType} onChange={e => onBill(e.target.value)}>
            <option value="Select">Select</option>
            <option value="1">Material</option>
            <option value="2">DeepClean</option>
            <option value="3">PasteControl</option>
          </select>
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
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>Branch Name :</b><span style={{ color: "red" }}>*</span>
          <select className="form-control" value={branch} onChange={e => { setBranch(e.target.value); reset(); }}>
            {branchList && <option value="Select">Select</option>}
            {(branchList || client !== "Select") && <option value="ALL">ALL</option>}
            {branches.map(b => <option key={b.unit_code} value={b.unit_code}>{b.unit_name}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-10" style={{ paddingTop: 20 }}>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={process}>Process</button>{" "}
          <button type="button" className="btn btn-primary" disabled={busy} onClick={reports}>Reports</button>
        </div>
      </div>
      <br />

      {status && (
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-8 col-xs-12" />
            <div className="col-sm-4 col-xs-12">
              <div style={{ maxHeight: 200, overflowY: "auto", overflowX: "hidden" }}>
                <table border={1} className="table table-striped">
                  <tbody>
                    <tr style={{ backgroundColor: "#eeeaea" }}><th>Branch Count</th><th style={{ textAlign: "center" }}>Notification</th></tr>
                    <tr><td style={{ fontWeight: "bold" }}>{status.not_approved_admin.length}</td><td>{link("Branches Not Approved By Admin", () => show("Employees Not Approved By Admin", status.not_approved_admin, false))}</td></tr>
                    <tr><td style={{ fontWeight: "bold" }}>{status.approved_admin.length}</td><td>{link("Branches Approved By Admin", () => show("Branches Approved By Admin", status.approved_admin, true))}</td></tr>
                    <tr><td style={{ fontWeight: "bold" }}>{status.approved_finance.length}</td><td>{link("Branches Approve By Finance", () => show("Branches Approve By Finance", status.approved_finance, true))}</td></tr>
                    <tr><td style={{ fontWeight: "bold" }}>{status.rejected_finance.length}</td><td>{link("Branches Reject By Finance", () => show("Branches Reject By Finance", status.rejected_finance, true))}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {grids && grids.mode === "upload" && grids.rows.length > 0 && (
        <div className="row">
          <div className="row">
            <div className="col-sm-10 col-xs-12" />
            <div className="col-sm-2 col-xs-12">
              <b>Search :</b>
              <input className="form-control" value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="container-fluid" style={{ overflow: "auto", maxHeight: 300, width: "auto" }}>
            <table className="table" style={{ width: "100%", background: "#fff", border: "1px solid #ccc" }}>
              <thead>
                <tr style={hdr}>
                  <th style={hdr}>SR NO.</th>
                  <th style={hdr}>
                    <label style={{ margin: 0 }}>
                      <input type="checkbox" checked={allChecked}
                        onChange={e => { const v = e.target.checked; const n: Record<number, boolean> = { ...checked }; rows.forEach(r => { n[r.id] = v; }); setChecked(n); }} /> SELECT RECORD
                    </label>
                  </th>
                  <th style={hdr}>STATE NAME</th><th style={hdr}>BRANCH NAME</th><th style={hdr}>MONTH/YEAR</th>
                  <th style={hdr}>FILE (Only JPG, PNG,JPEG and PDF files will be uploaded.)</th>
                  <th style={hdr}>Contract Name</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} style={{ background: "#EFF3FB" }}>
                    <td>{i + 1}</td>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={!!checked[r.id]} onChange={e => setChecked({ ...checked, [r.id]: e.target.checked })} />
                    </td>
                    <td>{r.state_name}</td><td>{r.unit_name}</td><td>{r.month_year}</td>
                    <td><input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={e => { files.current[r.id] = e.target.files?.[0]; }} /></td>
                    <td>{r.contract_name || billName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <br />
          <div className="row text-center">
            <button type="button" className="btn btn-primary" disabled={busy} onClick={approve}>Approve</button>
          </div>
        </div>
      )}

      {grids && grids.mode === "approved" && grids.rows.length > 0 && (
        <div className="container-fluid" style={{ overflow: "auto", maxHeight: 200, width: "auto" }}>
          <table className="table" style={{ width: "100%", background: "#fff", border: "1px solid #ccc" }}>
            <thead>
              <tr>
                <th style={hdr}>SR NO.</th><th style={hdr}>STATE NAME</th><th style={hdr}>BRANCH NAME</th>
                <th style={hdr}>MONTH/YEAR</th><th style={hdr}>STATUS</th><th style={hdr}>DOWNLOAD</th>
              </tr>
            </thead>
            <tbody>
              {grids.rows.map((r, i) => (
                <tr key={`${r.src}-${r.id}`} style={{ background: "#EFF3FB" }}>
                  <td>{i + 1}</td><td>{r.state_name}</td><td>{r.unit_name}</td><td>{r.month_year}</td><td>{r.status}</td>
                  <td><button type="button" className="btn btn-primary" style={{ width: "100%", color: "white" }} onClick={() => download(r)}>DOWNLOAD</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div onClick={() => setModal(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1050, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={e => e.stopPropagation()} style={{ background: "#fff", width: 520, maxWidth: "95%", borderRadius: 6, boxShadow: "0 5px 15px rgba(0,0,0,.5)" }}>
            <div style={{ padding: 15, borderBottom: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between" }}>
              <h4 style={{ margin: 0 }}>{modal.title}</h4>
              <button type="button" className="close" onClick={() => setModal(null)}>&times;</button>
            </div>
            <div style={{ padding: 15, maxHeight: 360, overflowY: "auto" }}>
              <table className="table">
                <thead><tr><th>Client Name</th><th>State Name</th><th>Branch Name</th>{modal.contract && <th>Contact Name</th>}</tr></thead>
                <tbody>{modal.rows.map((r, i) => (
                  <tr key={i}><td>{r.client_name}</td><td>{r.state_name}</td><td>{r.unit_name}</td>{modal.contract && <td>{r.contract_name}</td>}</tr>
                ))}</tbody>
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
