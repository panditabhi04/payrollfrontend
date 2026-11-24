"use client";
import React, { useEffect, useState, useCallback } from "react";
import { getJSON, mk, patchJSON, rm } from "@/lib/api/legacy-fetch";

interface Leave {
  leave_id: number; emp_code: string; emp_name?: string; leave_apply_date?: string;
  leave_type: string; leave_reason?: string; reporing_to?: string; manager?: string;
  from_date?: string; to_date?: string; no_of_days?: string; half_day_type?: string;
  leave_status?: string; status_comment?: string; leave_approved_date?: string; carry_forword?: string;
}
interface BalanceRow { abbreviation: string; leave_name: string; max_no_of_leave: string; balance_leave: string; carry_forward: string; }


const EMPTY = {
  leave_type: "Select", manager: "", leave_reason: "", half_day: "NA", half_date: "", pl_cl: "PL",
  balance_leave: "", carry_forward: "", from_date: "", to_date: "", no_of_days: "",
};

const fmt = (v?: string) => (v ? String(v).slice(0, 10) : "");

export default function LeaveApplicationsPage() {
  const [rows, setRows] = useState<Leave[]>([]);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ ...EMPTY });
  const [editingId, setEditingId] = useState<number | null>(null);
  const [leaveTypes, setLeaveTypes] = useState<BalanceRow[]>([]);

  const load = useCallback(async () => {
    const data = await getJSON<{ results: Leave[] }>(`/api/leave/applications/`);
    setRows((data?.results as Leave[]) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  // Legacy leaveTypeFill: leave types from the employee's assigned policy (+ balance/carry).
  useEffect(() => {
    getJSON<{ results: BalanceRow[]; manager?: string }>(`/api/leave/applications/my-balances/`).then((d) => {
      setLeaveTypes(d?.results ?? []);
      // Legacy txt_manager is read-only and comes from the employee master (reporting_to).
      if (d?.manager) setForm((f) => ({ ...f, manager: d.manager as string }));
    });
  }, []);

  // Legacy: the hard-coded Casual/Privilege/... ListItems are commented out; types come only from the policy.
  const typeOptions = leaveTypes.map((b) => ({ v: b.abbreviation, t: b.leave_name || b.abbreviation }));

  // Legacy ddl_leave_type_TextChanged: on type select fill Balance Leave + Carry Forward.
  const onLeaveType = (v: string) => {
    const b = leaveTypes.find((x) => x.abbreviation === v);
    setForm((f) => ({ ...f, leave_type: v, balance_leave: b?.balance_leave ?? f.balance_leave, carry_forward: b?.carry_forward ?? f.carry_forward }));
  };

  const showHalf = form.leave_type === "F";       // HalfDay Leave → First/Second half + PL/CL
  const showDelivery = form.leave_type === "ML";  // Maternity → Delivery Date

  const calcDays = () => {
    if (!form.from_date || !form.to_date) { alert("Please select Start Date and End Date to calculate."); return; }
    // Legacy: 1 + weekdays (Mon–Fri) in [from, to).
    const from = new Date(form.from_date), to = new Date(form.to_date);
    if (to < from) { alert("select start date must be in proper format"); setForm((f) => ({ ...f, no_of_days: "" })); return; }
    let count = 0; const d = new Date(from);
    while (d < to) { const wd = d.getDay(); if (wd !== 0 && wd !== 6) count++; d.setDate(d.getDate() + 1); }
    setForm((f) => ({ ...f, no_of_days: String(1 + count) }));
  };

  const validate = () => {
    if (form.leave_type === "Select" || !form.leave_type) { alert("Please Select Type Leave !!!"); return false; }
    if (!form.leave_reason.trim()) { alert("Please Enter Reason For Leave"); return false; }
    if (!String(form.balance_leave ?? "").trim()) { alert("Please Enter Balance Leave"); return false; }
    if (!form.from_date) { alert("Please Select Start Date"); return false; }
    if (!form.to_date) { alert("Please Select End Date"); return false; }
    if (!form.no_of_days) { alert("Please Enter Number Of Days"); return false; }
    return true;
  };

  const halfType = () => (showHalf ? form.half_day : showDelivery ? form.half_date : "");

  const apply = async () => {
    if (!validate()) return;
    const payload = {
      leave_type: form.leave_type, leave_reason: form.leave_reason,
      manager: form.manager, reporing_to: form.manager,
      from_date: form.from_date, to_date: form.to_date,
      half_day_type: halfType(), carry_forword: form.carry_forward,
    };
    const r = await mk("/api/leave/applications/", payload);
    if (r.ok) { setMsg("Leave Apply successfully!!"); clearForm(); load(); }
    else { const b = await r.json().catch(() => ({})); setMsg(errText(b)); }
  };

  const update = async () => {
    if (editingId == null) return;
    if (!validate()) return;
    const payload = {
      leave_type: form.leave_type, leave_reason: form.leave_reason,
      manager: form.manager, reporing_to: form.manager,
      from_date: form.from_date, to_date: form.to_date, half_day_type: halfType(),
    };
    const r = await patchJSON(`/api/leave/applications/${editingId}/`, payload);
    if (r.ok) { setMsg("Record Updated Successfully..."); clearForm(); load(); }
    else { const b = await r.json().catch(() => ({})); setMsg(errText(b)); }
  };

  // Legacy btn_leave_cancel_Click: Cancel Leave deletes the leave transaction.
  const cancelLeave = async () => {
    if (editingId == null) return;
    if (!confirm("Are you sure you want to Cancel Leave? This action cannot be undone.")) return;
    const r = await rm(`/api/leave/applications/${editingId}/`);
    if (r.ok) { setMsg("Record deleted Successfully..."); clearForm(); load(); }
    else { const b = await r.json().catch(() => ({})); setMsg(errText(b)); }
  };

  // Legacy LeaveTypeGridView_SelectedIndexChanged: load a row into the form for edit.
  const selectRow = (l: Leave) => {
    onLeaveType(l.leave_type || "Select");
    setForm((f) => ({
      ...f, leave_type: l.leave_type || "Select", leave_reason: l.leave_reason || "",
      manager: l.manager || l.reporing_to || "", from_date: fmt(l.from_date), to_date: fmt(l.to_date),
      no_of_days: l.no_of_days || "", carry_forward: l.carry_forword || "",
      half_day: l.leave_type === "F" ? (l.half_day_type || "NA") : "NA",
      half_date: l.leave_type === "ML" ? fmt(l.half_day_type) : "",
    }));
    setEditingId(l.leave_id);
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clearForm = () => { setForm((f) => ({ ...EMPTY, manager: f.manager })); setEditingId(null); setMsg(""); };

  const errText = (b: unknown): string => {
    if (!b) return "Failed.";
    if (typeof b === "string") return b;
    if (Array.isArray(b)) return b.join(" · ");
    const o = b as Record<string, unknown>;
    if (typeof o.detail === "string") return o.detail;
    return Object.values(o).map((v) => (Array.isArray(v) ? v.join(", ") : String(v))).join(" · ") || "Failed.";
  };

  return (
    <section style={{ padding: "15px", fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #337ab7", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#337ab7", color: "#fff", padding: "10px 15px", textAlign: "center", textTransform: "uppercase", fontSize: "small", fontWeight: "bold" }}>
          EMPLOYEE LEAVE APPLY FORM
        </div>

        <div className="panel-body" style={{ padding: "20px" }}>
          {msg && <div style={{ color: "green", fontWeight: "bold", textAlign: "center", marginBottom: "15px" }}>{msg}</div>}

          <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "25px", marginBottom: "20px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", marginBottom: "20px" }}>
              <div style={{ flex: 1, minWidth: "150px" }}>
                <b>Leave Type :</b>
                <select className="form-control" value={form.leave_type} onChange={(e) => onLeaveType(e.target.value)} style={{ width: "100%", height: "34px" }}>
                  <option value="Select">Select</option>
                  {typeOptions.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: "150px" }}>
                <b>Reporting To :</b>
                <input type="text" className="form-control" value={form.manager} readOnly style={{ width: "100%", height: "34px" }} />
              </div>
              <div style={{ flex: 2, minWidth: "250px" }}>
                <b>Reason For Leave :</b>
                <input type="text" className="form-control" maxLength={200} value={form.leave_reason} onChange={(e) => setForm({ ...form, leave_reason: e.target.value })} style={{ width: "100%", height: "34px" }} />
              </div>
              {/* Legacy: shown only for HalfDay (F) / Maternity (ML) */}
              {(showHalf || showDelivery) && (
                <div style={{ flex: 1, minWidth: "150px" }}>
                  <b>{showDelivery ? "Delivery Date :" : "Half :"}</b>
                  {showHalf && (
                    <select className="form-control" value={form.half_day} onChange={(e) => setForm({ ...form, half_day: e.target.value })} style={{ width: "100%", height: "34px" }}>
                      <option value="NA">Select Half</option><option value="FH">First Half</option><option value="SH">Second Half</option>
                    </select>
                  )}
                  {showDelivery && (
                    <input type="date" className="form-control" value={form.half_date} onChange={(e) => setForm({ ...form, half_date: e.target.value })} style={{ width: "100%", height: "34px" }} />
                  )}
                </div>
              )}
              {showHalf && (
                <div style={{ flex: 1, minWidth: "120px" }}>
                  <b>Leave Type :</b>
                  <select className="form-control" value={form.pl_cl} onChange={(e) => setForm({ ...form, pl_cl: e.target.value })} style={{ width: "100%", height: "34px" }}>
                    <option value="PL">PL</option><option value="CL">CL</option>
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end" }}>
              <div style={{ flex: 1, minWidth: "120px" }}>
                <b>Balance Leave :</b>
                <input type="text" className="form-control" readOnly value={form.balance_leave} style={{ width: "100%", height: "34px", background: "#eee" }} />
              </div>
              <div style={{ flex: 1, minWidth: "120px" }}>
                <b>Carry Forword :</b>
                <input type="text" className="form-control" readOnly value={form.carry_forward} style={{ width: "100%", height: "34px", background: "#eee" }} />
              </div>
              <div style={{ flex: 1, minWidth: "150px" }}>
                <b>Start Date :</b>
                <input type="date" className="form-control" value={form.from_date} onChange={(e) => setForm({ ...form, from_date: e.target.value })} style={{ width: "100%", height: "34px" }} />
              </div>
              <div style={{ flex: 1, minWidth: "150px" }}>
                <b>End Date :</b>
                <input type="date" className="form-control" value={form.to_date} onChange={(e) => setForm({ ...form, to_date: e.target.value })} style={{ width: "100%", height: "34px" }} />
              </div>
              <div style={{ flex: 1, minWidth: "120px" }}>
                <button className="btn btn-primary" onClick={calcDays} style={{ width: "100%", height: "34px", background: "#337ab7", color: "#fff", border: "none", borderRadius: "4px" }}>Calculate</button>
              </div>
              <div style={{ flex: 1, minWidth: "120px" }}>
                <b>Number Of Days :</b>
                <input type="text" className="form-control" readOnly value={form.no_of_days} style={{ width: "100%", height: "34px", background: "#eee" }} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "30px" }}>
              {editingId != null && <button className="btn btn-primary" style={btnBlue} onClick={cancelLeave}>Cancel Leave</button>}
              {editingId == null && <button className="btn btn-primary" style={btnBlue} onClick={apply}>Save</button>}
              {editingId != null && <button className="btn btn-primary" style={btnBlue} onClick={update}>Update</button>}
              <button className="btn btn-primary" style={btnBlue} onClick={clearForm}>Clear</button>
              <button className="btn btn-danger" style={btnRed} onClick={() => { window.location.href = "/"; }}>Close</button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff", border: "1px solid #ddd" }}>
              <thead style={{ background: "#006699", color: "white" }}>
                <tr>
                  <th style={th}>ID</th><th style={th}>LEAVE APPLY DATE</th><th style={th}>LEAVE TYPE</th>
                  <th style={th}>LEAVE REASON</th><th style={th}>REPORTING TO</th><th style={th}>START DATE</th>
                  <th style={th}>END DATE</th><th style={th}>NO OF DAYS</th><th style={th}>LEAVE STATUS</th>
                  <th style={th}>STATUS COMMENT</th><th style={th}>LEAVE APPROVED DATE</th><th style={th}>HALF DAY TYPE</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.leave_id} onClick={() => selectRow(l)}
                    style={{ cursor: "pointer", background: editingId === l.leave_id ? "#eaf3ff" : undefined }}>
                    <td style={td}>{l.leave_id}</td><td style={td}>{fmt(l.leave_apply_date)}</td><td style={td}>{l.leave_type}</td>
                    <td style={td}>{l.leave_reason}</td><td style={td}>{l.manager || l.reporing_to}</td><td style={td}>{fmt(l.from_date)}</td>
                    <td style={td}>{fmt(l.to_date)}</td><td style={td}>{l.no_of_days}</td><td style={td}>{l.leave_status}</td>
                    <td style={td}>{l.status_comment}</td><td style={td}>{fmt(l.leave_approved_date)}</td><td style={td}>{l.half_day_type}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr><td colSpan={12} style={{ textAlign: "center", padding: "15px" }}>No records found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

const th: React.CSSProperties = { padding: "8px", textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "8px" };
const btnBlue: React.CSSProperties = { background: "#337ab7", border: "1px solid #2e6da4", color: "#fff", padding: "6px 12px", borderRadius: "4px" };
const btnRed: React.CSSProperties = { background: "#d9534f", border: "1px solid #d43f3a", color: "#fff", padding: "6px 12px", borderRadius: "4px" };
