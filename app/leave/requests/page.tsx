"use client";
import React, { useEffect, useState, useCallback } from "react";
import { getJSON, mk } from "@/lib/api/legacy-fetch";

interface Leave {
  leave_id: number; emp_code: string; emp_name?: string; leave_apply_date?: string;
  leave_type: string; leave_reason?: string; manager?: string; reporing_to?: string;
  from_date?: string; to_date?: string; no_of_days?: string;
  month_end?: number | string; leave_status?: string; status_comment?: string; leave_approved_date?: string;
}

const fmt = (v?: string) => (v ? String(v).slice(0, 10) : "");
// Legacy status dropdown: In Progress / Approved / Rejected. Pending maps to "In Progress".
const toDropdown = (s?: string) => (s === "Approved" || s === "Rejected" ? s : "In Progress");

const EMPTY = {
  emp_code: "", emp_name: "", leave_apply_date: "", leave_type: "", leave_reason: "",
  from_date: "", to_date: "", no_of_days: "", status: "In Progress", comment: "",
};

export default function LeaveRequestsPage() {
  const [rows, setRows] = useState<Leave[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [msg, setMsg] = useState("");

  // Legacy loadgrid(): leaves routed to this manager (reporing_to = login id).
  const load = useCallback(async () => {
    const d = await getJSON<{ results: Leave[] }>(`/api/leave/applications/?scope=manage`);
    setRows((d?.results as Leave[]) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const selectRow = (l: Leave) => {
    if (String(l.month_end ?? 0) === "1") { alert("Month End Process completed, You cannot make changes !!"); return; }
    setForm({
      emp_code: l.emp_code || "", emp_name: l.emp_name || "", leave_apply_date: fmt(l.leave_apply_date),
      leave_type: l.leave_type || "", leave_reason: l.leave_reason || "",
      from_date: fmt(l.from_date), to_date: fmt(l.to_date), no_of_days: l.no_of_days || "",
      status: toDropdown(l.leave_status), comment: l.status_comment || "",
    });
    setSelectedId(l.leave_id);
    setMsg("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const clearForm = () => { setForm({ ...EMPTY }); setSelectedId(null); setMsg(""); };

  // Legacy btn_edit_Click: set LEAVE_STATUS + comment (+ balance deduct/refund on the backend).
  const update = async () => {
    if (selectedId == null) { alert("Please select a leave request from the list."); return; }
    if (!form.comment.trim()) { alert("Please Enter Leave Comments."); return; }
    const action = form.status === "Approved" ? "approve" : form.status === "Rejected" ? "reject" : "in-progress";
    const r = await mk(`/api/leave/applications/${selectedId}/${action}/`, { status_comment: form.comment.trim() });
    if (r.ok) { setMsg("Record Updated Successfully..."); clearForm(); load(); }
    else {
      const b = await r.json().catch(() => ({}));
      const o = b as Record<string, unknown>;
      setMsg(typeof o.detail === "string" ? o.detail : `Update failed (${r.status})`);
    }
  };

  return (
    <section style={{ padding: "15px", fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #337ab7", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#337ab7", color: "#fff", padding: "10px 15px", textAlign: "center", textTransform: "uppercase", fontSize: "small", fontWeight: "bold" }}>
          Leave Request
        </div>

        <div className="panel-body" style={{ padding: "20px" }}>
          {msg && <div style={{ color: "green", fontWeight: "bold", textAlign: "center", marginBottom: "15px" }}>{msg}</div>}

          <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "25px", marginBottom: "20px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", marginBottom: "20px" }}>
              <F label="Employee Code :"><input className="form-control" readOnly value={form.emp_code} style={ro} /></F>
              <F label="Employee Name :"><input className="form-control" readOnly value={form.emp_name} style={ro} /></F>
              <F label="Leave Apply Date :"><input className="form-control" readOnly value={form.leave_apply_date} style={ro} /></F>
              <F label="Leave Type :"><input className="form-control" readOnly value={form.leave_type} style={ro} /></F>
              <F label="Reason :" flex={2}><input className="form-control" readOnly value={form.leave_reason} style={ro} /></F>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end" }}>
              <F label="Start Date :"><input className="form-control" readOnly value={form.from_date} style={ro} /></F>
              <F label="End Date :"><input className="form-control" readOnly value={form.to_date} style={ro} /></F>
              <F label="No. Of Days :"><input className="form-control" readOnly value={form.no_of_days} style={ro} /></F>
              <F label="Leave Status :">
                <select className="form-control" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={{ width: "100%", height: "34px" }}>
                  <option value="In Progress">In Progress</option>
                  <option value="Approved">Approved</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </F>
              <F label="Comments :" flex={2}>
                <input className="form-control" maxLength={200} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} style={{ width: "100%", height: "34px" }} />
              </F>
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "30px" }}>
              <button className="btn btn-primary" style={btnBlue} onClick={update}>Update</button>
              <button className="btn btn-primary" style={btnBlue} onClick={clearForm}>Clear</button>
              <button className="btn btn-danger" style={btnRed} onClick={() => { window.location.href = "/"; }}>Close</button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff", border: "1px solid #ddd", fontSize: "12px" }}>
              <thead style={{ background: "#006699", color: "white" }}>
                <tr>
                  <th style={th}>EMPLOYEE CODE</th><th style={th}>EMPLOYEE NAME</th><th style={th}>LEAVE APPLY DATE</th>
                  <th style={th}>LEAVE TYPE</th><th style={th}>LEAVE REASON</th><th style={th}>FROM DATE</th>
                  <th style={th}>TO DATE</th><th style={th}>NO OF DAYS</th><th style={th}>LEAVE STATUS</th>
                  <th style={th}>STATUS COMMENT</th><th style={th}>LAST UPDATED</th><th style={th}>ID</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.leave_id} onClick={() => selectRow(l)}
                    style={{ cursor: "pointer", background: selectedId === l.leave_id ? "#eaf3ff" : undefined }}>
                    <td style={td}>{l.emp_code}</td><td style={td}>{l.emp_name}</td><td style={td}>{fmt(l.leave_apply_date)}</td>
                    <td style={td}>{l.leave_type}</td><td style={td}>{l.leave_reason}</td><td style={td}>{fmt(l.from_date)}</td>
                    <td style={td}>{fmt(l.to_date)}</td><td style={td}>{l.no_of_days}</td><td style={td}>{l.leave_status}</td>
                    <td style={td}>{l.status_comment}</td><td style={td}>{fmt(l.leave_approved_date)}</td><td style={td}>{l.leave_id}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={12} style={{ textAlign: "center", padding: "15px" }}>No records found.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function F({ label, flex = 1, children }: { label: string; flex?: number; children: React.ReactNode }) {
  return (
    <div style={{ flex, minWidth: flex > 1 ? "250px" : "150px" }}>
      <b>{label}</b>
      {children}
    </div>
  );
}

const ro: React.CSSProperties = { width: "100%", height: "34px", background: "#eee" };
const th: React.CSSProperties = { padding: "8px", textTransform: "uppercase" };
const td: React.CSSProperties = { padding: "8px" };
const btnBlue: React.CSSProperties = { background: "#337ab7", border: "1px solid #2e6da4", color: "#fff", padding: "6px 12px", borderRadius: "4px" };
const btnRed: React.CSSProperties = { background: "#d9534f", border: "1px solid #d43f3a", color: "#fff", padding: "6px 12px", borderRadius: "4px" };
