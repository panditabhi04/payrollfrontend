"use client";
import React, { useEffect, useState, useCallback } from "react";
import { getJSON, postJSON } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";
import Link from "next/link";
import RmApprovalTab from "@/components/attendance-tabs/RmApprovalTab";
import LastSevenDaysTab from "@/components/attendance-tabs/LastSevenDaysTab";

/* Ported 1:1 from Days_approval.aspx — 3 tabs:
   1) Last Seven Days Approval   2) Attendance Approval   3) R&M Approval
   All three tabs are wired: Tab 1 (last-seven-days, derived from the approved muster + stored
   Approve/Hold decisions), Tab 2 (per-branch attendance approval), Tab 3 (R&M approval). */

const BA = "/api/attendance/branch-approval/";

interface ClientItem { client_code: string; client_name: string; }
interface UnitItem { unit_code: string; unit_name: string; client_code: string; state_name: string; }
interface Branch { unit_code: string; state_name?: string; branch_name: string; month_year: string; status: string; flag: number; emp_count: number; attachment_url: string; rejected_reason: string; }

const TABS = ["Last Seven Days Approval", "Attendance Approval", "R&M Approval"];
const ST_TABS = [
  { key: "", label: "All" },
  { key: "0", label: "Not Approved" },
  { key: "1", label: "Approved By Admin Manager" },
  { key: "3", label: "Rejected" },
];

export default function AttendanceApprovalPage() {
  const [tab, setTab] = useState(1);        // 0,1,2 -> Tab1/2/3
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [unit, setUnit] = useState("Select");
  // Legacy Days_approval grid shows ONLY branches pending at this (admin-manager) level
  // ("Approve By Admin"). After Approve/Reject the row no longer matches -> it leaves the grid.
  // Default to that pending view; the status tabs let you view Approved/Rejected/All.
  const [statusFlag, setStatusFlag] = useState("0");

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);

  const [rows, setRows] = useState<Branch[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<{ pending: number; approved: number; rejected: number; total_branches: number } | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  // Report button: the eight legacy status categories (attendance_status)
  const [cats, setCats] = useState<{ key: string; title: string; count: number; emp_count: number | null; rows: Record<string, string>[] }[] | null>(null);
  // View Feedback Report (lbtn_fb) for one branch
  const [fbUnit, setFbUnit] = useState<string | null>(null);
  const [fbRows, setFbRows] = useState<Record<string, string>[]>([]);
  // Employee-level drill-down: whose attendance is done vs pending
  const [detailBranch, setDetailBranch] = useState<string | null>(null);
  const [detailRows, setDetailRows] = useState<any[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    getJSON<{ results: ClientItem[] }>(`/api/masters/clients/?page_size=all`).then(d => setClients(d?.results || []));
    getJSON<{ states: string[] }>(`/api/masters/states/lookup/`).then(d => setStates(d?.states ?? []));
  }, []);
  useEffect(() => {
    if (!client || client === "Select") { setUnits([]); return; }
    getJSON<{ units: UnitItem[] }>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(client)}`).then(d => setUnits(d?.units ?? []));
  }, [client]);

  const filteredStates = client && client !== "Select"
    ? Array.from(new Set(units.map(u => u.state_name).filter(Boolean)))
    : states;
  const filteredUnits = units.filter(u => (!state || state === "Select" || u.state_name === state));
  const clientName = clients.find(c => c.client_code === client)?.client_name || client;

  const show = useCallback(async (flagOverride?: string) => {
    if (!month || !year) { alert("Please Select Month/Year"); return; }
    if (!client || client === "Select") { alert("Please Select Client"); return; }
    if (!state || state === "Select") { alert("Please Select State"); return; }
    const sf = flagOverride !== undefined ? flagOverride : statusFlag;
    setMsg(""); setSelected(new Set());
    let q = `month=${month}&year=${year}&client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}`;
    if (unit && unit !== "Select") q += `&unit_code=${encodeURIComponent(unit)}`;
    if (sf !== "") q += `&status_flag=${sf}`;
    const d = await getJSON<{ results: Branch[] }>(`${BA}?${q}`);
    setRows(d?.results ?? []);
    const s = await getJSON<{ pending: number; approved: number; rejected: number; total_branches: number }>(`${BA}summary/?month=${month}&year=${year}&client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}`);
    setSummary(s);
    if ((d?.results ?? []).length === 0) setMsg("No records found... !!!");
  }, [month, year, client, state, unit, statusFlag]);

  const pendingUnits = rows.filter(r => r.flag === 0).map(r => r.unit_code);
  const toggle = (uc: string) => setSelected(p => { const n = new Set(p); n.has(uc) ? n.delete(uc) : n.add(uc); return n; });
  const toggleAll = () => setSelected(p => p.size === pendingUnits.length ? new Set() : new Set(pendingUnits));

  const doApprove = async () => {
    const unit_codes = Array.from(selected);
    if (unit_codes.length === 0) { alert("Please select atleast one Branch"); return; }
    if (!window.confirm("Are you sure want to Approve The Records?")) return;
    setBusy(true);
    try {
      const r = await postJSON(`${BA}approve/`, { unit_codes, month, year, client_code: client });
      const b = await r.json().catch(() => ({}));
      if (r.ok) { alert(b.status || "Attendace Approved Successfully !!"); show(); }
      else alert((Array.isArray(b) ? b[0] : b?.detail) || "Attendace Not Approved !!");
    } finally { setBusy(false); }
  };
  const doReject = async () => {
    const unit_codes = Array.from(selected);
    if (unit_codes.length === 0) { alert("Please select atleast one Branch"); return; }
    // legacy: each checked branch's reject_reason textbox must be filled
    for (const uc of unit_codes) {
      if (!(rejectReasons[uc] || "").trim()) { alert("Please Enter Reject Reason"); return; }
    }
    setBusy(true);
    try {
      let ok = true; let why = "";
      for (const uc of unit_codes) {
        const r = await postJSON(`${BA}reject/`, { unit_codes: [uc], month, year, client_code: client, reject_reason: rejectReasons[uc].trim() });
        if (!r.ok) { ok = false; if (!why) { const b = await r.json().catch(() => ({})); why = (Array.isArray(b) ? b[0] : b?.detail) || ""; } }
      }
      alert(ok ? "Attendace Rejected Successfully !!" : (why || "Attendace Not Rejected !!"));
      show();
    } finally { setBusy(false); }
  };

  // Client Attendance — export the branch's muster as ATTENDANCE_COPY.xls (legacy btn_attend_Click)
  const clientAttendance = async () => {
    if (!month || !year) { alert("Please Select Month/Year"); return; }
    if (!unit || unit === "Select" || unit === "ALL") { alert("Please select a specific Branch for Client Attendance."); return; }
    const r = await fetch(`${API_BASE_URL}/api/attendance/muster-sheet/?unit_code=${encodeURIComponent(unit)}&month=${month}&year=${year}&export=xls`, { credentials: "include" });
    if (!r.ok) { alert("No Matching Records Found."); return; }
    const blob = await r.blob();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = "ATTENDANCE_COPY.xls";
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  // Report (legacy btn_report_Click -> attendance_status): the eight category grids with counts
  const report = async () => {
    if (!month || !year) { alert("Please Select Month/Year"); return; }
    if (!client || client === "Select") { alert("Please Select Client Name"); return; }
    const r = await fetch(`${API_BASE_URL}${BA}status-report/?month=${month}&year=${year}&client_code=${encodeURIComponent(client)}`, { credentials: "include" });
    if (!r.ok) { const b = await r.json().catch(() => ({})); alert((Array.isArray(b) ? b[0] : b?.detail) || "Report failed."); return; }
    const d = await r.json();
    setCats(d.categories ?? []);
    const s = await getJSON<{ pending: number; approved: number; rejected: number; total_branches: number }>(`${BA}summary/?month=${month}&year=${year}&client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}`);
    setSummary(s);
  };

  // zip_download: <CLIENT>_ATTENDANCE.zip of the approved attendance sheets
  const zipDownload = async () => {
    if (!month || !year) { alert("Please Select Month/Year"); return; }
    if (!client || client === "Select") { alert("Please Select Client Name"); return; }
    let q = `month=${month}&year=${year}&client_code=${encodeURIComponent(client)}`;
    if (state && state !== "Select" && state !== "ALL") q += `&state=${encodeURIComponent(state)}`;
    if (unit && unit !== "Select" && unit !== "ALL") q += `&unit_code=${encodeURIComponent(unit)}`;
    const r = await fetch(`${API_BASE_URL}${BA}zip/?${q}`, { credentials: "include" });
    if (!r.ok) { const b = await r.json().catch(() => ({})); alert((Array.isArray(b) ? b[0] : b?.detail) || "Download failed."); return; }
    const blob = await r.blob();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${clientName.replace(/ /g, "_")}_ATTENDANCE.zip`;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };

  // lbtn_fb_Click toggles the branch feedback panel
  const toggleFeedback = async (uc: string) => {
    if (fbUnit === uc) { setFbUnit(null); setFbRows([]); return; }
    const d = await getJSON<{ results: Record<string, string>[] }>(`${BA}feedback/?month=${month}&year=${year}&client_code=${encodeURIComponent(client)}&unit_code=${encodeURIComponent(uc)}`);
    setFbUnit(uc); setFbRows(d?.results ?? []);
  };
  const decideFeedback = async (kind: "approve" | "reject") => {
    if (!fbUnit) return;
    const r = await postJSON(`${BA}feedback-${kind}/`, { unit_code: fbUnit, month, year, client_code: client });
    const b = await r.json().catch(() => ({}));
    alert(r.ok ? (b.status || "") : ((Array.isArray(b) ? b[0] : b?.detail) || "Failed."));
    if (r.ok) { setFbUnit(null); setFbRows([]); }
  };

  const onShow = () => { show(); setDetailBranch(null); setDetailRows([]); };

  // Fetch per-employee muster for a branch to show whose attendance is done vs not done
  const viewEmployees = async (branch: Branch) => {
    if (detailBranch === branch.unit_code) { setDetailBranch(null); setDetailRows([]); return; }
    if (!month || !year) { alert("Please Select Month/Year"); return; }
    setDetailBranch(branch.unit_code); setDetailRows([]); setDetailLoading(true);
    try {
      const d = await getJSON<{ results: any[] }>(`/api/attendance/muster-sheet/?unit_code=${encodeURIComponent(branch.unit_code)}&month=${month}&year=${year}`);
      setDetailRows(d?.results ?? []);
    } catch { setDetailRows([]); }
    finally { setDetailLoading(false); }
  };

  const fieldStyle: React.CSSProperties = { width: "100%", height: "34px", borderRadius: "4px", border: "1px solid #ccc" };
  const statusBg = (flag: number) => flag === 1 ? "#5cb85c" : flag === 3 ? "#d9534f" : "#f0ad4e";

  const Filters = ({ withSlot }: { withSlot?: boolean }) => (
    <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "18px", marginBottom: "16px" }}>
      <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 150px" }}>
          <b>Month / Year :</b><span style={{ color: "red" }}>*</span>
          <input type="month" className="form-control" value={year && month ? `${year}-${month.padStart(2, "0")}` : ""}
            onChange={(e) => { if (e.target.value) { const [y, m] = e.target.value.split("-"); setYear(y); setMonth(parseInt(m, 10).toString()); } else { setYear(""); setMonth(""); } }} style={fieldStyle} />
        </div>
        <div style={{ flex: "1 1 200px" }}>
          <b>Client Name :</b><span style={{ color: "red" }}>*</span>
          <select className="form-control" value={client} onChange={e => { setClient(e.target.value); setState("Select"); setUnit("Select"); }} style={fieldStyle}>
            <option value="Select">Select</option>
            {clients.map(c => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
          </select>
        </div>
        <div style={{ flex: "1 1 150px" }}>
          <b>State :</b><span style={{ color: "red" }}>*</span>
          <select className="form-control" value={state} onChange={e => { setState(e.target.value); setUnit("Select"); }} style={fieldStyle}>
            <option value="Select">Select</option>
            {filteredStates.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ flex: "1 1 200px" }}>
          <b>Branch Name :</b><span style={{ color: "red" }}>*</span>
          <select className="form-control" value={unit} onChange={e => setUnit(e.target.value)} style={fieldStyle}>
            <option value="Select">Select</option>
            <option value="ALL">ALL</option>
            {filteredUnits.map(u => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
          </select>
        </div>
        {withSlot && (
          <div style={{ flex: "1 1 150px" }}>
            <b>Invoice Slot :</b><span style={{ color: "red" }}>*</span>
            <select className="form-control" style={fieldStyle} defaultValue="Select">
              <option value="Select">Select</option><option value="1_to_15">1 to 15</option><option value="16_to_30">16 to 30</option>
            </select>
          </div>
        )}
        <div style={{ display: "flex", gap: "10px" }}>
          <button className="btn btn-success" onClick={onShow} disabled={busy} style={{ background: "#5cb85c", border: "1px solid #4cae4c", color: "#fff", padding: "6px 18px", borderRadius: "4px" }}>Show</button>
          <Link href="/" className="btn btn-danger" style={{ background: "#d9534f", border: "1px solid #d43f3a", color: "#fff", padding: "6px 18px", borderRadius: "4px", textDecoration: "none" }}>Close</Link>
        </div>
      </div>
    </div>
  );

  return (
    <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px", marginBottom: "20px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
          ATTENDANCE APPROVAL
        </div>
        <div className="panel-body" style={{ padding: "15px" }}>

          {/* tabs */}
          <ul style={{ display: "flex", listStyle: "none", padding: 0, margin: "0 0 14px", borderBottom: "2px solid #006699", flexWrap: "wrap" }}>
            {TABS.map((t, i) => (
              <li key={t}>
                <a href="#" onClick={e => { e.preventDefault(); setTab(i); setRows([]); setMsg(""); }}
                  style={{ display: "inline-block", padding: "8px 16px", textDecoration: "none", fontWeight: 700, borderRadius: "4px 4px 0 0", background: tab === i ? "#006699" : "#eee", color: tab === i ? "#fff" : "#333" }}>{t}</a>
              </li>
            ))}
          </ul>

          {tab === 0 && <LastSevenDaysTab />}
          {tab === 2 && <RmApprovalTab />}

          {tab === 1 && (
            <>
              <Filters />

              {/* status summary (clickable filter) */}
              {summary && (
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
                  {ST_TABS.map(t => (
                    <button key={t.key} onClick={() => { setStatusFlag(t.key); show(t.key); }} style={{ padding: "6px 14px", borderRadius: "4px", border: "1px solid #ccc", cursor: "pointer", fontWeight: 700, background: statusFlag === t.key ? "#006699" : "#fff", color: statusFlag === t.key ? "#fff" : "#333" }}>
                      {t.label}{t.key === "0" ? ` (${summary.pending})` : t.key === "1" ? ` (${summary.approved})` : t.key === "3" ? ` (${summary.rejected})` : ` (${summary.total_branches})`}
                    </button>
                  ))}
                </div>
              )}

              {msg && <div style={{ color: "#8a6d3b", fontWeight: "bold", textAlign: "center", marginBottom: "12px", padding: "8px", background: "#fcf8e3", border: "1px solid #faebcc", borderRadius: "4px" }}>{msg}</div>}

              <div style={{ overflowX: "auto" }}>
                <table className="table table-bordered table-striped table-hover" style={{ width: "100%", background: "#fff", border: "1px solid #ddd" }}>
                  <thead style={{ background: "#006699", color: "white" }}>
                    <tr>
                      <th style={{ padding: "8px", textAlign: "center" }}><input type="checkbox" title="Select all" checked={pendingUnits.length > 0 && selected.size === pendingUnits.length} onChange={toggleAll} /></th>
                      <th style={{ padding: "8px" }}>CLIENT NAME</th>
                      <th style={{ padding: "8px" }}>STATE NAME</th>
                      <th style={{ padding: "8px" }}>BRANCH NAME</th>
                      <th style={{ padding: "8px" }}>MONTH YEAR</th>
                      <th style={{ padding: "8px" }}>CURRENT STATUS</th>
                      <th style={{ padding: "8px" }}>EMPLOYEES</th>
                      <th style={{ padding: "8px" }}>DOWNLOAD</th>
                      <th style={{ padding: "8px" }}>REJECT REASON</th>
                      <th style={{ padding: "8px" }}>FEEDBACK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.unit_code}>
                        <td style={{ padding: "8px", textAlign: "center" }}>{r.flag === 0 && <input type="checkbox" checked={selected.has(r.unit_code)} onChange={() => toggle(r.unit_code)} />}</td>
                        <td style={{ padding: "8px" }}>{(r as Branch & { client_name?: string }).client_name || clientName}</td>
                        <td style={{ padding: "8px" }}>{r.state_name || (state === "Select" ? "" : state)}</td>
                        <td style={{ padding: "8px" }}>{r.branch_name}</td>
                        <td style={{ padding: "8px" }}>{r.month_year}</td>
                        <td style={{ padding: "8px" }}><span style={{ background: statusBg(r.flag), color: "#fff", padding: "2px 8px", borderRadius: "3px", fontSize: "11px", fontWeight: 700 }}>{r.status}</span></td>
                        <td style={{ padding: "8px", textAlign: "center" }}>
                          <button onClick={() => viewEmployees(r)} style={{ padding: "2px 8px", fontSize: "11px", borderRadius: "4px", border: "1px solid #006699", background: detailBranch === r.unit_code ? "#006699" : "#fff", color: detailBranch === r.unit_code ? "#fff" : "#006699", cursor: "pointer" }}>
                            {r.emp_count} {detailBranch === r.unit_code ? "Hide" : "View"}
                          </button>
                        </td>
                        <td style={{ padding: "8px" }}>{r.attachment_url ? <a href={r.attachment_url.startsWith("http") ? r.attachment_url : `${API_BASE_URL}${r.attachment_url}`} target="_blank" rel="noreferrer" style={{ color: "#337ab7" }}>Attendance Sheet</a> : "-"}</td>
                        <td style={{ padding: "8px" }}>
                          {r.flag === 0
                            ? <input className="form-control" placeholder="Reject reason" value={rejectReasons[r.unit_code] || ""} onChange={e => setRejectReasons(p => ({ ...p, [r.unit_code]: e.target.value }))} style={{ height: "30px", padding: "2px 6px", fontSize: "12px" }} />
                            : <span style={{ color: "#d9534f" }}>{r.rejected_reason}</span>}
                        </td>
                        <td style={{ padding: "8px" }}><a href="#" onClick={(e) => { e.preventDefault(); toggleFeedback(r.unit_code); }} style={{ color: "#337ab7" }}>View Feedback Report</a></td>
                      </tr>
                    ))}
                    {rows.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center", padding: "20px" }}>No records found... !!!</td></tr>}
                  </tbody>
                </table>
              </div>

              {/* Per-employee drill-down: whose attendance is done vs pending */}
              {detailBranch && (
                <div style={{ marginTop: "14px", border: "1px solid #006699", borderRadius: "6px", overflow: "hidden" }}>
                  <div style={{ background: "#006699", color: "#fff", padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <b>Employees — {rows.find(r => r.unit_code === detailBranch)?.branch_name || detailBranch} ({detailRows.length})</b>
                    <span style={{ fontSize: "11px", background: "#fff", color: "#006699", padding: "2px 8px", borderRadius: "10px" }}>{detailRows.filter((e: any) => (e.computed_present ?? e.tot_days_present ?? 0) > 0).length} Done / {detailRows.filter((e: any) => (e.computed_present ?? e.tot_days_present ?? 0) === 0).length} Not Done</span>
                  </div>
                  <div style={{ overflowX: "auto", maxHeight: "320px", overflowY: "auto" }}>
                    {detailLoading ? <div style={{ padding: "20px", textAlign: "center" }}>Loading employees...</div> : (
                      <table className="table table-bordered table-hover" style={{ width: "100%", margin: 0, fontSize: "12px" }}>
                        <thead style={{ background: "#e6f0f7", position: "sticky", top: 0 }}>
                          <tr>
                            <th style={{ padding: "6px" }}>#</th>
                            <th style={{ padding: "6px" }}>EMP CODE</th>
                            <th style={{ padding: "6px" }}>EMP NAME</th>
                            <th style={{ padding: "6px" }}>DESIG</th>
                            <th style={{ padding: "6px" }}>PRESENT</th>
                            <th style={{ padding: "6px" }}>ABSENT</th>
                            <th style={{ padding: "6px" }}>STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailRows.map((e: any, i: number) => {
                            const present = e.computed_present ?? e.tot_days_present ?? 0;
                            const absent = e.computed_absent ?? e.tot_days_absent ?? 0;
                            const isDone = present > 0;
                            return (
                              <tr key={e.emp_code} style={{ background: isDone ? "#eaffea" : "#fff3f3" }}>
                                <td style={{ padding: "6px" }}>{i + 1}</td>
                                <td style={{ padding: "6px" }}>{e.emp_code}</td>
                                <td style={{ padding: "6px" }}>{e.emp_name}</td>
                                <td style={{ padding: "6px" }}>{e.designation || "-"}</td>
                                <td style={{ padding: "6px", textAlign: "center", fontWeight: 700, color: isDone ? "green" : "#999" }}>{present}</td>
                                <td style={{ padding: "6px", textAlign: "center" }}>{absent}</td>
                                <td style={{ padding: "6px" }}><span style={{ background: isDone ? "#5cb85c" : "#d9534f", color: "#fff", padding: "2px 8px", borderRadius: "10px", fontSize: "10px" }}>{isDone ? "Done" : "Not Done"}</span></td>
                              </tr>
                            );
                          })}
                          {detailRows.length === 0 && !detailLoading && <tr><td colSpan={7} style={{ textAlign: "center", padding: "20px" }}>No employees found for this branch/month</td></tr>}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {fbUnit && (
                <div style={{ marginTop: "14px", border: "1px solid #006699", borderRadius: "6px", overflow: "hidden" }}>
                  <div style={{ background: "#006699", color: "#fff", padding: "8px 12px" }}><b>Feedback Report</b></div>
                  <table className="table table-bordered" style={{ width: "100%", margin: 0, fontSize: "12px" }}>
                    <thead><tr><th>State</th><th>Branch</th><th>Feedback</th><th>Good</th><th>Satisfactory</th><th>Need Improvement</th><th>Any Other Remark</th></tr></thead>
                    <tbody>
                      {fbRows.map((f, i) => (
                        <tr key={i}><td>{f.state_name}</td><td>{f.unit_name}</td><td>{f.feedback}</td>
                          <td><input type="checkbox" readOnly checked={f.good === "Yes"} /></td>
                          <td><input type="checkbox" readOnly checked={f.satisfactory === "Yes"} /></td>
                          <td><input type="checkbox" readOnly checked={f.need_improvement === "Yes"} /></td>
                          <td>{f.any_other_remark}</td></tr>
                      ))}
                      {fbRows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center" }}>No feedback pending for this branch.</td></tr>}
                    </tbody>
                  </table>
                  <div style={{ display: "flex", gap: "10px", padding: "10px", justifyContent: "center" }}>
                    <button className="btn btn-success" onClick={() => decideFeedback("approve")}>Approve Feedback</button>
                    <button className="btn btn-danger" onClick={() => decideFeedback("reject")}>Reject Feedback</button>
                  </div>
                </div>
              )}

              {cats && (
                <div style={{ marginTop: "14px", display: "grid", gap: "12px" }}>
                  {cats.map((c) => (
                    <div key={c.key} style={{ border: "1px solid #006699", borderRadius: "6px", overflow: "hidden" }}>
                      <div style={{ background: "#006699", color: "#fff", padding: "6px 12px" }}>
                        <b>{c.title}</b> — Branches: {c.count}{c.emp_count !== null && c.emp_count !== undefined ? ` · Employees: ${c.emp_count}` : ""}
                      </div>
                      {c.rows.length > 0 && (
                        <table className="table table-bordered" style={{ width: "100%", margin: 0, fontSize: "12px" }}>
                          <thead><tr><th>Branch</th>{c.key === "rejected" && <><th>Rejected Reason</th><th>Rejected Date</th><th>Rejected By</th></>}{c.key === "closed" && <th>Branch Close Date</th>}</tr></thead>
                          <tbody>
                            {c.rows.map((r, i) => (
                              <tr key={i}><td>{r.cunit}</td>
                                {c.key === "rejected" && <><td>{r.rejected_reason}</td><td>{r.rejected_date}</td><td>{r.rejected_by}</td></>}
                                {c.key === "closed" && <td>{r.branch_close_date}</td>}</tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* action buttons — all together, below the grid */}
              <div style={{ display: "flex", gap: "10px", marginTop: "14px", flexWrap: "wrap", justifyContent: "center" }}>
                <button className="btn btn-primary" onClick={clientAttendance} disabled={busy} style={{ background: "#337ab7", border: "1px solid #2e6da4", color: "#fff", padding: "6px 16px", borderRadius: "4px" }}>Client Attendance</button>
                <button className="btn btn-primary" onClick={zipDownload} disabled={busy} style={{ background: "#337ab7", border: "1px solid #2e6da4", color: "#fff", padding: "6px 16px", borderRadius: "4px" }}>Download Attendance Zip</button>
                <button className="btn btn-primary" onClick={report} disabled={busy} style={{ background: "#337ab7", border: "1px solid #2e6da4", color: "#fff", padding: "6px 16px", borderRadius: "4px" }}>Report</button>
                <button className="btn btn-success" onClick={doApprove} disabled={busy || pendingUnits.length === 0} style={{ background: pendingUnits.length === 0 ? "#9bcf9b" : "#5cb85c", border: "1px solid #4cae4c", color: "#fff", padding: "6px 18px", borderRadius: "4px", fontWeight: 700 }}>Approve</button>
                <button className="btn btn-danger" onClick={doReject} disabled={busy || pendingUnits.length === 0} style={{ background: pendingUnits.length === 0 ? "#e0a3a0" : "#d9534f", border: "1px solid #d43f3a", color: "#fff", padding: "6px 18px", borderRadius: "4px", fontWeight: 700 }}>Reject</button>
              </div>
            </>
          )}

        </div>
      </div>
    </div>
  );
}
