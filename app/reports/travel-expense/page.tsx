"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { getJSONStrict } from "@/lib/api/legacy-fetch";

// Menu "Reports" (id 111, tooltip "Travel Plan & Expense Reports", click_evt expense_report.aspx).
// The legacy file does not exist; this is a read-only report over travel plans and expense claims.
const API = "/api/reports/travel-expense/";
interface Data { filename: string; columns: string[]; rows: (string | number)[][]; count: number }
const STATUSES = ["", "Draft", "Submitted", "Approved", "Rejected", "Seeking Clarification"];

export default function TravelExpenseReportPage() {
  const router = useRouter();
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [status, setStatus] = useState(""); const [emp, setEmp] = useState("");
  const [data, setData] = useState<Data | null>(null);

  const show = async () => {
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to) p.set("to", to);
    if (status) p.set("status", status);
    if (emp.trim()) p.set("emp_code", emp.trim());
    try {
      const d = await getJSONStrict<Data>(`${API}?${p.toString()}`);
      setData(d);
      if (d.rows.length === 0) alert("No Matching Records Found.");
    } catch (e: any) { alert(e?.message || "Request failed."); }
  };
  const exportXls = () => {
    if (!data || data.rows.length === 0) { alert("No Matching Records Found."); return; }
    const esc = (x: unknown) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = `<table border=1><tr>${data.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>` +
      data.rows.map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`).join("") + "</table>";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + html], { type: "application/vnd.ms-excel" }));
    a.download = data.filename; document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <div className="container-fluid">
      <div className="panel panel-primary">
        <div className="panel-heading" style={{ textAlign: "center", fontWeight: "bold", textTransform: "uppercase", fontSize: "small" }}>Travel Plan &amp; Expense Reports</div>
        <div className="panel-body">
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="col-md-2"><label>From Date</label><input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div className="col-md-2"><label>To Date</label><input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            <div className="col-md-2"><label>Plan Status</label>
              <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)}>
                {STATUSES.map((s) => <option key={s} value={s}>{s || "All"}</option>)}
              </select></div>
            <div className="col-md-2"><label>Employee Code</label><input className="form-control" value={emp} onChange={(e) => setEmp(e.target.value)} /></div>
            <div className="col-md-4" style={{ paddingTop: 25 }}>
              <button type="button" className="btn btn-primary" onClick={show}>Show</button>{" "}
              <button type="button" className="btn btn-primary" onClick={exportXls}>Export</button>{" "}
              <button type="button" className="btn btn-danger" onClick={() => router.push("/")}>Close</button>
            </div>
          </div>
          {data && (
            <div style={{ overflowX: "auto" }}>
              <table className="table table-striped table-bordered table-hover">
                <thead style={{ background: "#224173", color: "white" }}>
                  <tr><th>Sr No.</th>{data.columns.map((c) => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {data.rows.map((r, i) => (<tr key={i}><td>{i + 1}</td>{r.map((x, j) => <td key={j}>{x}</td>)}</tr>))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
