"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getJSON, mk, responseMessage } from "@/lib/api/legacy-fetch";
import ExportButtons from "@/components/ExportButtons";

// Old Employee_leave_check.aspx ("Employee Leave Details"): HR console over every employee's
// leave transaction. Client / State / Unit / date range filter, per-row Comment + Approval /
// Reject (sets leave_status, status_comment and android_flag 2/3 for the Android app).
const B = "/api/leave/leave-check";

interface ClientRow { client_code: string; client_name: string }
interface UnitRow { unit_code: string; unit_name: string }
interface Row {
  leave_id: number; client_name: string; unit_name: string; emp_name: string; grade_name: string;
  from_date: string; to_date: string; no_of_days: string; leave_reason: string;
  leave_apply_date: string; status_comment: string; leave_status: string;
}

const sel: React.CSSProperties = { width: "100%", height: 34, border: "1px solid #ccc", borderRadius: 4 };
const cols = [
  { key: "leave_status", label: "Leave Status" }, { key: "client_name", label: "Client Name" },
  { key: "unit_name", label: "Unit Name" }, { key: "emp_name", label: "Employee Name" },
  { key: "grade_name", label: "Grade Name" }, { key: "from_date", label: "From Date" },
  { key: "to_date", label: "To Date" }, { key: "no_of_days", label: "No of days Leave" },
  { key: "leave_reason", label: "Leave Reason" }, { key: "leave_apply_date", label: "Leave apply date" },
];

// "dd/mm/yyyy" <-> "yyyy-mm-dd" (the native date input works in ISO)
const toLegacy = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "");

export default function EmployeeLeaveCheckPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [unit, setUnit] = useState("ALL");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [filter, setFilter] = useState<Record<string, string> | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (f: Record<string, string> | null) => {
    const qs = f ? "?" + new URLSearchParams(f).toString() : "";
    const d = await getJSON<{ results: Row[] }>(`${B}/${qs}`).catch(() => null);
    setRows(d?.results ?? []);
    setComments({});
  }, []);

  useEffect(() => {
    getJSON<{ results: ClientRow[] }>(`${B}/clients/`).then((d) => setClients(d?.results ?? [])).catch(() => setClients([]));
    load(null);
  }, [load]);

  const onClient = async (v: string) => {
    setClient(v); setState("Select"); setUnit("ALL"); setUnits([]); setStates([]);
    const d = await getJSON<{ results: { state_name: string }[] }>(
      `${B}/states/?client_code=${encodeURIComponent(v === "Select" ? "ALL" : v)}`).catch(() => null);
    setStates((d?.results ?? []).map((s) => s.state_name));
  };
  const onState = async (v: string) => {
    setState(v); setUnit("ALL"); setUnits([]);
    if (v === "Select") return;
    const d = await getJSON<{ results: UnitRow[] }>(
      `${B}/units/?client_code=${encodeURIComponent(client === "Select" ? "ALL" : client)}&state=${encodeURIComponent(v)}`).catch(() => null);
    setUnits(d?.results ?? []);
  };

  const show = async () => {
    if (client === "Select") { alert("Please Select Client Name"); return; }
    if (state === "Select") { alert("Please Select State Name"); return; }
    if (unit === "ALL") { alert("Please Select Unit Name"); return; }
    if (!start) { alert("Please Select Start Date"); return; }
    if (!end) { alert("Please Select End Date"); return; }
    const f = { client_code: client, unit_code: unit, start: toLegacy(start), end: toLegacy(end) };
    setFilter(f);
    setBusy(true); await load(f); setBusy(false);
  };

  const decide = async (r: Row, kind: "approve" | "reject") => {
    const comment = (comments[r.leave_id] || "").trim();
    if (!comment) { alert("Please enter comment !!!"); return; }
    setBusy(true);
    const res = await mk(`${B}/${kind}/`, { leave_id: r.leave_id, comment });
    if (res.ok) {
      alert(kind === "approve" ? "Approve Employee Leave successfully !!!" : "Reject Employee Leave successfully !!!");
      await load(filter);
    } else {
      alert(await responseMessage(res, "Data not field proper format!!!"));
    }
    setBusy(false);
  };

  return (
    <div className="container-fluid">
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: 4, backgroundColor: "#fff" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "8.33%" }}></div>
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>Employee Leave Details</div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); window.open("/html/Employee_leave_check.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>
        <div className="panel-body" style={{ padding: 15 }}>
          <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 15, alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 150px" }}>
                <b>Client Name :</b><span style={{ color: "red" }}> *</span>
                <select className="form-control" style={sel} value={client} onChange={(e) => onClient(e.target.value)}>
                  <option value="Select">Select</option>
                  {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <b>State Name :</b><span style={{ color: "red" }}> *</span>
                <select className="form-control" style={sel} value={state} onChange={(e) => onState(e.target.value)}>
                  <option value="Select">Select</option>
                  <option value="ALL">ALL</option>
                  {states.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <b>Unit Name :</b><span style={{ color: "red" }}> *</span>
                <select className="form-control" style={sel} value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="ALL">ALL</option>
                  {units.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <b>Start Date :</b><span style={{ color: "red" }}> *</span>
                <input type="date" className="form-control" style={sel} value={start} max={end || undefined}
                  onChange={(e) => setStart(e.target.value)} />
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <b>End Date :</b><span style={{ color: "red" }}> *</span>
                <input type="date" className="form-control" style={sel} value={end} min={start || undefined}
                  onChange={(e) => setEnd(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-primary" disabled={busy} onClick={show}>Show</button>
                <Link href="/Home" className="btn btn-danger" style={{ textDecoration: "none" }}>Close</Link>
              </div>
            </div>
          </div>

          <div className="dt-btns no-print" style={{ marginBottom: 8 }}>
            <ExportButtons filename="EMPLOYEE_LEAVE_DETAILS" columns={cols} rows={rows} />
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff", fontSize: "small" }}>
              <thead style={{ background: "#006699", color: "white" }}>
                <tr>
                  <th>Approval</th><th>Reject</th><th>Comment</th>
                  {cols.map((c) => <th key={c.key}>{c.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={cols.length + 3} style={{ textAlign: "center", color: "#777", padding: 12 }}>No records</td></tr>}
                {rows.map((r) => (
                  <tr key={r.leave_id}>
                    <td><button className="btn btn-success btn-xs" disabled={busy} onClick={() => decide(r, "approve")}>Approval</button></td>
                    <td><button className="btn btn-danger btn-xs" disabled={busy} onClick={() => decide(r, "reject")}>Reject</button></td>
                    <td>
                      <input className="form-control" style={{ height: 28, minWidth: 140 }}
                        value={comments[r.leave_id] ?? r.status_comment ?? ""}
                        onChange={(e) => setComments((p) => ({ ...p, [r.leave_id]: e.target.value }))} />
                    </td>
                    {cols.map((c) => <td key={c.key}>{String((r as unknown as Record<string, unknown>)[c.key] ?? "")}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
