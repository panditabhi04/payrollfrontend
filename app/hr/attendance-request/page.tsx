"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { mk, putJSON } from "@/lib/api/legacy-fetch";
import { apiGet } from "@/lib/api/client";
import { MaterialDispatchTab, InvoiceTab, DuplicateIdTab } from "@/components/attendance-tabs/ClientRequestExtraTabs";

// Legacy client_request_form.aspx (request) + receiver.aspx (approval). Attendance/Leave
// requests: type 1=Attendance, 2=Leave. status 0=Pending,1=Approved,3=Rejected.
const CR = () => "/api/transactions/client-requests/";
const TYPE: Record<string, string> = { "1": "Attendance", "2": "Leave" };
const STATUS: Record<number, string> = { 0: "Pending", 1: "Approved", 3: "Rejected" };

interface Req { id: number; request_for: string; attendance_date?: string; leave_from_date?: string; leave_to_date?: string; comment_box?: string; status: number; reject_reason?: string; emp_code: string; emp_name: string; }

export default function AttendanceRequestPage() {
  const [scope, setScope] = useState<"" | "approve">("");
  const [rows, setRows] = useState<Req[]>([]);
  const [msg, setMsg] = useState("");
  // extra legacy request types: "m" Material Dispatch, "i" Invoice, "d" Duplicate ID Card
  const [extra, setExtra] = useState<"" | "m" | "i" | "d">("");
  const [form, setForm] = useState({ request_for: "1", attendance_date: "", leave_from_date: "", leave_to_date: "", comment_box: "" });

  const load = useCallback(async () => {
    try {
      const d = await apiGet<{ results: Req[] } | Req[]>(`${CR()}${scope ? "?scope=approve" : ""}`, { credentials: "include" });
      setRows((Array.isArray(d) ? d : (d as { results?: Req[] })?.results ?? []) as Req[]);
      setMsg("");
    } catch (e: any) {
      const m = String(e?.message ?? e);
      if (m.includes("403")) {
        const menu = scope ? "Attendance / Leave Approval" : "Attendance / Leave Request";
        setMsg(`Access denied: your role does not have the '${menu}' menu. Please ask the admin to grant it (Role Management).`);
      } else {
        setMsg("Failed to load requests. Please try again.");
      }
      setRows([]);
    }
  }, [scope]);
  useEffect(() => { load(); }, [load]);

  const friendlyError = async (r: Response, fallbackMenu: string) => {
    const body = await r.json().catch(() => ({} as any));
    const detail = (body as any)?.detail || "";
    if (r.status === 403 || /do not have access/i.test(detail)) {
      const menu = /Approval/i.test(detail) ? "Attendance / Leave Approval" : fallbackMenu;
      return `Access denied: your role does not have the '${menu}' menu. Please ask the admin to grant it (Role Management).`;
    }
    return detail || (body as any)?.non_field_errors?.[0] || `Request failed (${r.status}). Please try again.`;
  };

  const [editId, setEditId] = useState<number | null>(null);
  const fmtD = (v?: string) => { const m = String(v ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}/${m[1]}` : (v ?? ""); };
  const EMPTY = { request_for: "1", attendance_date: "", leave_from_date: "", leave_to_date: "", comment_box: "" };

  // Legacy Req_validation (client_request_form.aspx): Request For -> Comment -> dates
  const validateForm = (): string | null => {
    if (!form.request_for) return "Please Select Request For";
    if (!form.comment_box.trim()) return "Please Add Comment";
    if (form.request_for === "1" && !form.attendance_date) return "Please Select Attendance Date";
    if (form.request_for === "2") {
      if (!form.leave_from_date) return "Please Select Leave From Date";
      if (!form.leave_to_date) return "Please Select Leave To Date";
    }
    return null;
  };
  const submit = async () => {
    const err = validateForm();
    if (err) { alert(err); setMsg(err); return; }
    const r = await mk(CR(), form);
    if (r.ok) { alert("Client Attendance Request Inserted successfully!!"); setMsg("Client Attendance Request Inserted successfully!!"); setForm(EMPTY); load(); }
    else { const m = await friendlyError(r, "Attendance / Leave Request"); alert(m); setMsg(m); }
  };
  const startEdit = (r: Req) => {
    setEditId(r.id);
    setForm({ request_for: r.request_for, attendance_date: r.attendance_date || "", leave_from_date: r.leave_from_date || "",
      leave_to_date: r.leave_to_date || "", comment_box: r.comment_box || "" });
  };
  const update = async () => {
    const err = validateForm();
    if (err) { alert(err); setMsg(err); return; }
    const r = await putJSON(`${CR()}${editId}/`, form);
    if (r.ok) { alert("Updated Successfully... !!!"); setMsg("Updated Successfully... !!!"); setEditId(null); setForm(EMPTY); load(); }
    else { const m = await friendlyError(r, "Attendance / Leave Request"); alert(m); setMsg(m); }
  };
  const act = async (id: number, a: "approve" | "reject") => {
    let body: Record<string, string> = {};
    if (a === "reject") { const c = window.prompt("Rejection reason") || ""; if (!c) return; body.reject_reason = c; }
    const r = await mk(`${CR()}${id}/${a}/`, body);
    setMsg(r.ok ? (a === "approve" ? "Record Approve successfully!!" : "Request rejected") : await friendlyError(r, "Attendance / Leave Approval"));
    load();
  };

  return (
    <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px", marginBottom: "20px", backgroundColor: "white" }}>
        
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "8.33%" }}></div>
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
            Client Request Form
          </div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); window.open("/html/client_request_form.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }} style={{ color: "#fff", fontSize: "10px" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>
        <br />

        <div className="panel-body" style={{ padding: "15px" }}>
          {msg && <div style={{ color: "#424D7A", margin: "8px 0", fontWeight: "bold", textAlign: "center" }}>{msg}</div>}
          
          <div style={{ margin: "8px 0", display: "flex", gap: "10px", justifyContent: "center" }}>
            <button onClick={() => setScope("")} className={scope === "" ? "btn btn-primary" : "btn btn-default"} style={{ border: scope === "" ? "1px solid #2e6da4" : "1px solid #ccc", background: scope === "" ? "#337ab7" : "#fff", color: scope === "" ? "#fff" : "#333", padding: "6px 20px", borderRadius: "4px" }}>My Requests</button>
            <button onClick={() => setScope("approve")} className={scope === "approve" ? "btn btn-primary" : "btn btn-default"} style={{ border: scope === "approve" ? "1px solid #2e6da4" : "1px solid #ccc", background: scope === "approve" ? "#337ab7" : "#fff", color: scope === "approve" ? "#fff" : "#333", padding: "6px 20px", borderRadius: "4px" }}>Approvals</button>
          </div>

          {extra !== "" && (() => {
            const sw = (k: "1" | "2" | "3") => setExtra(k === "1" ? "m" : k === "2" ? "i" : "d");
            return extra === "m" ? <MaterialDispatchTab onTypeChange={sw} />
              : extra === "i" ? <InvoiceTab onTypeChange={sw} /> : <DuplicateIdTab onTypeChange={sw} />;
          })()}
          {extra !== "" && <div style={{ textAlign: "center", margin: "10px 0" }}><button className="btn btn-default" onClick={() => setExtra("")}>Back to Attendance / Leave Request</button></div>}

          {extra === "" && scope === "" && (
            <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "20px", marginBottom: "20px", marginTop: "20px" }}>
              <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end" }}>
                <div style={{ flex: "1 1 150px", maxWidth: "200px" }}>
                  <b>Request For:</b> <span style={{ color: "red" }}>*</span>
                  <select className="form-control" disabled={editId !== null} value={form.request_for} onChange={(e) => { const v = e.target.value; if (v === "m" || v === "i" || v === "d") setExtra(v); else setForm({ ...form, request_for: v }); }} style={{ height: "34px", border: "1px solid #ccc", borderRadius: "4px" }}>
                    <option value="1">Attendance</option><option value="2">Leave</option>
                    <option value="m">Material Dispatch</option><option value="i">Invoice</option><option value="d">Duplicate ID Card</option>
                  </select>
                </div>
                
                {form.request_for === "1" ? (
                  <div style={{ flex: "1 1 150px", maxWidth: "200px" }}>
                    <b>Attendance Date:</b> <span style={{ color: "red" }}>*</span>
                    <input className="form-control" type="date" value={form.attendance_date} onChange={(e) => setForm({ ...form, attendance_date: e.target.value })} style={{ height: "34px", border: "1px solid #ccc", borderRadius: "4px" }} />
                  </div>
                ) : (
                  <>
                    <div style={{ flex: "1 1 150px", maxWidth: "200px" }}>
                      <b>Leave From:</b> <span style={{ color: "red" }}>*</span>
                      <input className="form-control" type="date" value={form.leave_from_date} onChange={(e) => setForm({ ...form, leave_from_date: e.target.value })} style={{ height: "34px", border: "1px solid #ccc", borderRadius: "4px" }} />
                    </div>
                    <div style={{ flex: "1 1 150px", maxWidth: "200px" }}>
                      <b>Leave To:</b> <span style={{ color: "red" }}>*</span>
                      <input className="form-control" type="date" value={form.leave_to_date} onChange={(e) => setForm({ ...form, leave_to_date: e.target.value })} style={{ height: "34px", border: "1px solid #ccc", borderRadius: "4px" }} />
                    </div>
                  </>
                )}
                
                <div style={{ flex: "1 1 200px", maxWidth: "300px" }}>
                  <b>Comment:</b> <span style={{ color: "red" }}>*</span>
                  <input className="form-control" value={form.comment_box} onChange={(e) => setForm({ ...form, comment_box: e.target.value })} style={{ height: "34px", border: "1px solid #ccc", borderRadius: "4px" }} />
                </div>
                
                <div style={{ flex: "0 0 auto", display: "flex", gap: "10px" }}>
                  {editId === null
                    ? <button className="btn btn-primary" onClick={submit} style={{ background: "#337ab7", border: "1px solid #2e6da4", color: "#fff", padding: "6px 20px", borderRadius: "4px" }}>Save</button>
                    : <button className="btn btn-primary" onClick={update} style={{ background: "#337ab7", border: "1px solid #2e6da4", color: "#fff", padding: "6px 20px", borderRadius: "4px" }}>Update</button>}
                  <Link href="/" className="btn btn-danger" style={{ background: "#d9534f", border: "1px solid #d43f3a", color: "#fff", padding: "6px 20px", borderRadius: "4px", textDecoration: "none" }}>Close</Link>
                </div>
              </div>
            </div>
          )}

          {extra === "" && <div style={{ overflowX: "auto" }}>
            <table className="table table-striped table-bordered table-hover" style={{ width: "100%", background: "#fff", border: "1px solid #ddd" }}>
              <thead style={{ background: "#224173", color: "white" }}>
                <tr>
                  <th style={{ padding: "8px", fontSize: "x-small", textTransform: "uppercase" }}>EMP</th>
                  <th style={{ padding: "8px", fontSize: "x-small", textTransform: "uppercase" }}>TYPE</th>
                  <th style={{ padding: "8px", fontSize: "x-small", textTransform: "uppercase" }}>DATE / RANGE</th>
                  <th style={{ padding: "8px", fontSize: "x-small", textTransform: "uppercase" }}>COMMENT</th>
                  <th style={{ padding: "8px", fontSize: "x-small", textTransform: "uppercase" }}>STATUS</th>
                  {scope === "" && <th style={{ padding: "8px", fontSize: "x-small", textTransform: "uppercase" }}>EDIT</th>}
                  {scope === "approve" && <th style={{ padding: "8px", fontSize: "x-small", textTransform: "uppercase", textAlign: "center" }}>ACTION</th>}
                </tr>
              </thead>
              <tbody style={{ fontSize: "x-small" }}>
          {rows.map((r) => (
            <tr key={r.id}>
                <td style={{ padding: "8px" }}>{r.emp_name || r.emp_code}</td>
                <td style={{ padding: "8px" }}>{TYPE[r.request_for]}</td>
                <td style={{ padding: "8px" }}>{r.request_for === "1" ? fmtD(r.attendance_date) : `${fmtD(r.leave_from_date)} → ${fmtD(r.leave_to_date)}`}</td>
                <td style={{ padding: "8px" }}>{r.comment_box}</td>
                <td style={{ padding: "8px" }}>{STATUS[r.status]}{r.status === 3 && r.reject_reason ? ` (${r.reject_reason})` : ""}</td>
                {scope === "" && <td style={{ padding: "8px" }}>{(r.status === 0 || r.status === 3)
                  ? <a href="#" onClick={(e) => { e.preventDefault(); startEdit(r); }}>Edit</a> : null}</td>}
                {scope === "approve" && <td style={{ padding: "8px", textAlign: "center" }}>
                  {r.status === 0 && (
                    <div style={{ display: "flex", gap: "5px", justifyContent: "center" }}>
                      <button className="btn btn-success btn-sm" onClick={() => act(r.id, "approve")} style={{ padding: "2px 8px" }}>Approve</button>
                      <button className="btn btn-danger btn-sm" onClick={() => act(r.id, "reject")} style={{ padding: "2px 8px" }}>Reject</button>
                    </div>
                  )}
                  {r.status !== 0 && <span style={{ color: "#777", fontStyle: "italic" }}>Processed</span>}
                </td>}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#777", padding: "16px 0" }}>No requests found</td></tr>}
          </tbody>
        </table>
        </div>}
        </div>
      </div>
    </div>
  );
}
