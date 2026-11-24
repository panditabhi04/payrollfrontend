"use client";
import { openPrintHtml } from "@/components/hrPrint";
import React, { useEffect, useState, useCallback } from "react";
import { getJSON, mk, responseMessage } from "@/lib/api/legacy-fetch";

// Shared Offer / Joining letter manager. Legacy Offerletter.aspx / send_joining_letter.aspx —
// capture letter details + render a printable letter (Crystal replaced by HTML).
interface Letter { id: number; emp_code: string; emp_name: string; joining_date?: string; address?: string; grade_code?: string; salary_per_month?: string; state?: string; city?: string; system_date?: string; }

export default function LetterManager({ endpoint, title, kind }: { endpoint: string; title: string; kind: "offer" | "joining" }) {
  const [rows, setRows] = useState<Letter[]>([]);
  const [msg, setMsg] = useState("");
  const [sel, setSel] = useState<Letter | null>(null);
  const [form, setForm] = useState({ emp_code: "", emp_name: "", joining_date: "", address: "", grade_code: "", salary_per_month: "", state: "", city: "" });

  const load = useCallback(async () => {
    const d = await getJSON<{ results: Letter[] } | Letter[]>(endpoint);
    setRows((Array.isArray(d) ? d : d?.results ?? []) as Letter[]);
  }, [endpoint]);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const r = await mk(endpoint, form);
    if (r.ok) { setMsg(kind === "offer" ? "Offer Letter Save Successfully!!" : "successfully Save!!"); setForm({ emp_code: "", emp_name: "", joining_date: "", address: "", grade_code: "", salary_per_month: "", state: "", city: "" }); load(); }
    else { setMsg(await responseMessage(r, kind === "offer" ? " Offer Letter Save failed..." : "Save failed!!")); }
  };
  const F = (k: keyof typeof form, label: string, type = "text") => (
    <div><label>{label}: <input type={type} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} /></label></div>);

  return (
    <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px", backgroundColor: "#fff" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "8.33%" }}></div>
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>{title}</div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <a href="#" onClick={(e) => { e.preventDefault(); }} style={{ color: "#fff", fontSize: "10px" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </a>
          </div>
        </div>
        <br />
        <div className="panel-body" style={{ padding: "15px", background: "beige", minHeight: "500px" }}>
          {msg && <div style={{ color: "green", fontWeight: "bold", textAlign: "center", marginBottom: "15px", padding: "10px", background: "#dff0d8", border: "1px solid #d6e9c6", borderRadius: "4px" }}>{msg}</div>}

          <div style={{ background: "#428bca", color: "#fff", padding: "10px 15px", marginBottom: "15px", fontWeight: "bold" }}>New {title}</div>
          <div style={{ background: "#fff", padding: "15px", border: "1px solid #ccc", borderRadius: "4px", marginBottom: "20px" }}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end", marginBottom: "15px" }}>
              <div style={{ flex: "1 1 200px" }}><b>Employee Code :</b><input className="form-control" value={form.emp_code} onChange={(e) => setForm({ ...form, emp_code: e.target.value })} style={{ height: "34px" }} /></div>
              <div style={{ flex: "1 1 200px" }}><b>Employee Name :</b><input className="form-control" value={form.emp_name} onChange={(e) => setForm({ ...form, emp_name: e.target.value })} style={{ height: "34px" }} /></div>
              <div style={{ flex: "1 1 200px" }}><b>Joining Date :</b><input type="date" className="form-control" value={form.joining_date} onChange={(e) => setForm({ ...form, joining_date: e.target.value })} style={{ height: "34px" }} /></div>
              <div style={{ flex: "1 1 200px" }}><b>Grade :</b><input className="form-control" value={form.grade_code} onChange={(e) => setForm({ ...form, grade_code: e.target.value })} style={{ height: "34px" }} /></div>
              <div style={{ flex: "1 1 200px" }}><b>Salary / Month :</b><input className="form-control" value={form.salary_per_month} onChange={(e) => setForm({ ...form, salary_per_month: e.target.value })} style={{ height: "34px" }} /></div>
              <div style={{ flex: "1 1 200px" }}><b>State :</b><input className="form-control" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} style={{ height: "34px" }} /></div>
              <div style={{ flex: "1 1 200px" }}><b>City :</b><input className="form-control" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} style={{ height: "34px" }} /></div>
              <div style={{ flex: "1 1 200px" }}><b>Address :</b><input className="form-control" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} style={{ height: "34px" }} /></div>
            </div>
            <button className="btn btn-primary" onClick={save} style={{ background: "#337ab7", border: "1px solid #2e6da4", color: "#fff", padding: "6px 20px", borderRadius: "4px" }}>Save</button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="table table-striped table-bordered table-hover" style={{ borderCollapse: "collapse", width: "100%", fontSize: "12px", background: "#fff", border: "1px solid #ddd" }}>
              <thead style={{ background: "#224173", color: "white" }}>
                <tr>
                  <th style={{ padding: "8px", textTransform: "uppercase", fontSize: "11px", border: "1px solid #ddd" }}>Emp</th>
                  <th style={{ padding: "8px", textTransform: "uppercase", fontSize: "11px", border: "1px solid #ddd" }}>Name</th>
                  <th style={{ padding: "8px", textTransform: "uppercase", fontSize: "11px", border: "1px solid #ddd" }}>Joining</th>
                  <th style={{ padding: "8px", textTransform: "uppercase", fontSize: "11px", border: "1px solid #ddd" }}>Salary</th>
                  <th style={{ padding: "8px", textTransform: "uppercase", fontSize: "11px", border: "1px solid #ddd" }}>Grade</th>
                  <th style={{ padding: "8px", textTransform: "uppercase", fontSize: "11px", border: "1px solid #ddd", textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => (
                  <tr key={l.id}>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>{l.emp_code}</td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>{l.emp_name}</td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>{l.joining_date}</td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>{l.salary_per_month}</td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>{l.grade_code}</td>
                    <td style={{ padding: "8px", border: "1px solid #ddd", textAlign: "center" }}><button className="btn btn-xs btn-primary" style={{ background: "#337ab7", border: "1px solid #2e6da4", color: "#fff", borderRadius: "3px", padding: "2px 8px" }} onClick={() => setSel(l)}>View / Print</button></td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} style={{ padding: "8px", textAlign: "center", color: "#666" }}>No letters found</td></tr>}
              </tbody>
            </table>
          </div>

          {sel && (
            <div style={{ border: "1px solid #333", padding: 24, marginTop: 16, maxWidth: 720, background: "#fff", borderRadius: "4px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #eee", paddingBottom: "10px", marginBottom: "15px" }}>
                <b style={{ fontSize: "16px" }}>{kind === "offer" ? "OFFER LETTER" : "JOINING LETTER"}</b>
                <span>
                  <button className="btn btn-sm btn-primary" onClick={() => { void openPrintHtml(`/api/hr/print/letter/?kind=${kind}&emp_codes=${encodeURIComponent(sel.emp_code)}`); }} style={{ background: "#337ab7", color: "#fff", border: "1px solid #2e6da4", padding: "4px 12px", borderRadius: "4px", marginRight: "5px" }}>Print</button>
                  <button className="btn btn-sm btn-danger" onClick={() => setSel(null)} style={{ background: "#d9534f", color: "#fff", border: "1px solid #d43f3a", padding: "4px 12px", borderRadius: "4px" }}>&times;</button>
                </span>
              </div>
              <p style={{ marginTop: 16 }}>Date: {sel.system_date}</p>
              <p>Dear <b>{sel.emp_name}</b> ({sel.emp_code}),</p>
              <p>{sel.address}</p>
              <p>We are pleased to {kind === "offer" ? "offer you the position" : "confirm your joining"} at grade <b>{sel.grade_code}</b>
                {sel.salary_per_month ? <> with a monthly salary of <b>{sel.salary_per_month}</b></> : null}
                {sel.joining_date ? <>, effective <b>{sel.joining_date}</b></> : null}.</p>
              <p>{sel.city} {sel.state}</p>
              <p style={{ marginTop: 32 }}>Authorised Signatory</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
