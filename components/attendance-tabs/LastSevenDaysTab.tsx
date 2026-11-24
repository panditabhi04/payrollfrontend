"use client";
/* Attendance Approval -> tab 1 "Last Seven Days Approval". Ported from legacy Days_approval.aspx
   <div id="menu1"> (process_validation JS, btn_process_Click -> show_gridview, btn_approve_Click,
   btn_hold_Click). Employees that were absent in the last 7 days of the billing period are listed;
   Approve (ticked rows) / Hold (reason required). Backend: /api/attendance/last-seven-days/ */
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getJSON, mk, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";
import { TD, TH } from "./RmServiceTab";

const BASE = "/api/attendance/last-seven-days";

interface Row {
  emp_code: string; emp_name: string; unit_code: string; unit_name: string; state_name: string;
  client: string; tot_days_present: number; tot_days_absent: number; status: string; hold_reason: string;
}

export default function LastSevenDaysTab() {
  const [clients, setClients] = useState<{ client_code: string; client_name: string }[]>([]);
  const [client, setClient] = useState("Select");
  const [ym, setYm] = useState("");                    // yyyy-mm
  const [rows, setRows] = useState<Row[]>([]);
  const [shown, setShown] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    getJSON<{ results: { client_code: string; client_name: string }[] }>("/api/masters/clients/?page_size=all")
      .then((d) => setClients(d?.results ?? []));
  }, []);

  const my = () => { const [y, m] = ym.split("-"); return { month: String(parseInt(m, 10)), year: y }; };
  const sel = () => ({ client_code: client, ...my() });

  // process_validation()
  const validate = (): boolean => {
    if (!ym) { alert("Please Select Month/Year "); return false; }
    if (client === "Select") { alert("Please Select Client Name "); return false; }
    return true;
  };

  const load = async (): Promise<boolean> => {
    const r = await fetch(`${API_BASE_URL}${BASE}/?${new URLSearchParams(sel()).toString()}`, { credentials: "include" });
    if (!r.ok) { setRows([]); alert(await responseMessage(r)); return false; }
    const d = await r.json();
    setRows(d.results ?? []);
    setChecked(new Set());
    return true;
  };

  const onProcess = async () => {
    if (!validate()) return;
    setBusy(true);
    try { if (await load()) setShown(true); } finally { setBusy(false); }
  };

  const approve = async () => {
    if (checked.size === 0) { alert("Please select atleast one Record "); return; }
    if (!window.confirm("Are you sure want to Approve The Records?")) return;
    setBusy(true);
    try {
      const r = await mk(`${BASE}/approve/`, { ...sel(), emp_codes: Array.from(checked) });
      if (!r.ok) { alert(await responseMessage(r)); return; }
      alert("Record Approved Successfully");
      await load();
    } finally { setBusy(false); }
  };

  const hold = async (emp: string) => {
    if (!(reasons[emp] || "").trim()) { alert("Please Enter Reason First"); return; }
    if (!window.confirm("Are you sure want to Hold The Record?")) return;
    setBusy(true);
    try {
      const r = await mk(`${BASE}/hold/`, { ...sel(), emp_code: emp, reason: reasons[emp] || "" });
      if (!r.ok) { alert(await responseMessage(r)); return; }
      alert("Payment Hold Successfully");
      await load();
    } finally { setBusy(false); }
  };

  const q = search.trim().toLowerCase();
  const visible = rows.filter((r) => !q || [r.client, r.state_name, r.unit_name, r.emp_name, r.emp_code, r.status]
    .some((v) => String(v ?? "").toLowerCase().includes(q)));
  const toggleAll = () => setChecked((p) => p.size === visible.length ? new Set() : new Set(visible.map((r) => r.emp_code)));
  const toggle = (c: string) => setChecked((p) => { const n = new Set(p); n.has(c) ? n.delete(c) : n.add(c); return n; });
  const fieldStyle: React.CSSProperties = { width: "100%", height: "34px", borderRadius: "4px", border: "1px solid #ccc" };

  return (
    <>
      <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "18px", marginBottom: "16px" }}>
        <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 150px" }}>
            <b>Month / Year :</b><span style={{ color: "red" }}>*</span>
            <input type="month" className="form-control" value={ym} onChange={(e) => setYm(e.target.value)} style={fieldStyle} />
          </div>
          <div style={{ flex: "1 1 220px" }}>
            <b>Client Name :</b><span style={{ color: "red" }}>*</span>
            <select className="form-control" value={client} onChange={(e) => setClient(e.target.value)} style={fieldStyle}>
              <option value="Select">Select</option>
              {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
            </select>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <button className="btn btn-primary" onClick={onProcess} disabled={busy} style={{ padding: "6px 18px", borderRadius: "4px" }}>Process</button>
            <Link href="/" className="btn btn-danger" style={{ background: "#d9534f", border: "1px solid #d43f3a", color: "#fff", padding: "6px 18px", borderRadius: "4px", textDecoration: "none" }}>Close</Link>
          </div>
        </div>
      </div>

      {shown && rows.length > 0 && (
        <>
          <div style={{ margin: "6px 0" }}>Search: <input value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div style={{ overflowX: "auto" }}>
            <table className="table table-bordered" style={{ width: "100%", fontSize: "12px" }}>
              <thead>
                <tr>{["Sr. No.", "SELECT", "Client name", "State Name", "Unit Name", "Employee Name", "Present Days", "Absent Days", "Hold", "Reason", "Status"]
                  .map((h) => <th key={h} style={TH}>{h === "SELECT" ? <><input type="checkbox" title="Select all" checked={visible.length > 0 && checked.size === visible.length} onChange={toggleAll} /> SELECT</> : h}</th>)}</tr>
              </thead>
              <tbody>
                {visible.map((r, i) => (
                  <tr key={r.emp_code}>
                    <td style={TD}>{i + 1}</td>
                    <td style={TD}><input type="checkbox" checked={checked.has(r.emp_code)} onChange={() => toggle(r.emp_code)} /></td>
                    <td style={TD}>{r.client}</td>
                    <td style={TD}>{r.state_name}</td>
                    <td style={TD}>{r.unit_name}</td>
                    <td style={TD}>{r.emp_name} ({r.emp_code})</td>
                    <td style={TD}>{r.tot_days_present}</td>
                    <td style={TD}>{r.tot_days_absent}</td>
                    <td style={TD}>
                      <input className="form-control" placeholder="Reason" value={reasons[r.emp_code] ?? ""}
                        onChange={(e) => setReasons((p) => ({ ...p, [r.emp_code]: e.target.value }))} style={{ width: "140px", display: "inline-block" }} />{" "}
                      <button className="btn btn-danger btn-xs" disabled={busy} onClick={() => hold(r.emp_code)}>Hold</button>
                    </td>
                    <td style={TD}>{r.hold_reason}</td>
                    <td style={TD}>{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ textAlign: "center", marginTop: "10px" }}>
            <button className="btn btn-success" onClick={approve} disabled={busy}>Approve</button>
          </div>
        </>
      )}
    </>
  );
}
