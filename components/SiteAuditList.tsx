"use client";
/* Site Audit (legacy site_audit_detail.aspx): audits arrive from the Android app,
 * so the web page only lists them and lets an authorised user Reject with a reason. */
import React, { useCallback, useEffect, useState } from "react";
import { getJSON, mk, responseMessage } from "@/lib/api/legacy-fetch";

type Audit = {
  id: number; emp_code: string | null; grade_name: string | null; location: string | null;
  que_1_ans: string | null; que_2_ans: string | null; que_3_ans: string | null;
  que_4_ans: string | null; que_5_ans: string | null; que_6_ans: string | null;
  comment: string | null; remark: string | null; reject: number | null;
};

export default function SiteAuditList() {
  const [rows, setRows] = useState<Audit[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<Audit | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const q = search.trim() ? `?search=${encodeURIComponent(search.trim())}` : "";
    const d = await getJSON<{ results?: Audit[] } | Audit[]>(`/api/masters/site-audits/${q}`);
    setRows(Array.isArray(d) ? d : d?.results ?? []);
    setLoading(false);
  }, [search]);
  useEffect(() => { load(); }, [load]);

  const reject = async () => {
    if (!sel) return;
    if (!reason.trim()) { alert("Please Enter Reason !!"); return; }
    if (!confirm("Are you Sure You Want to reject Record")) return;
    const res = await mk(`/api/masters/site-audits/${sel.id}/reject/`, { comment: reason.trim() });
    if (res.ok) { alert("Record Rejected Successfully!!"); setSel(null); setReason(""); load(); }
    else alert(await responseMessage(res, "Record rejection failed..."));
  };

  return (
    <div className="container-fluid">
      <div className="panel panel-primary">
        <div className="panel-heading" style={{ textAlign: "center", fontSize: "small", textTransform: "uppercase" }}><b>Site Audit</b></div>
        <div className="panel-body">
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="col-sm-4">
              <input className="form-control" placeholder="Search employee / location" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="col-sm-2"><button className="btn btn-primary" onClick={load}>Show</button></div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="table table-bordered">
              <thead><tr>
                <th></th><th>Emp Code</th><th>Grade</th><th>Location</th>
                <th>Q1</th><th>Q2</th><th>Q3</th><th>Q4</th><th>Q5</th><th>Q6</th><th>Comment</th><th>Status</th>
              </tr></thead>
              <tbody>
                {loading && <tr><td colSpan={12}>Loading...</td></tr>}
                {!loading && rows.length === 0 && <tr><td colSpan={12}>No records found.</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} className={sel?.id === r.id ? "info" : ""}>
                    <td><input type="radio" name="audit" checked={sel?.id === r.id} onChange={() => { setSel(r); setReason(""); }} /></td>
                    <td>{r.emp_code}</td><td>{r.grade_name}</td><td>{r.location}</td>
                    <td>{r.que_1_ans}</td><td>{r.que_2_ans}</td><td>{r.que_3_ans}</td>
                    <td>{r.que_4_ans}</td><td>{r.que_5_ans}</td><td>{r.que_6_ans}</td>
                    <td>{r.comment}</td><td>{r.reject ? "Rejected" : "Accepted"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sel && !sel.reject && (
            <div className="row" style={{ marginTop: 10 }}>
              <div className="col-sm-6">
                <textarea className="form-control" placeholder="Reason" value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
              <div className="col-sm-2"><button className="btn btn-primary" onClick={reject}>Reject</button></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
