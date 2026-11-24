"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getJSON, mk } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

// 1:1 port of Payslip.aspx ("For Company Salary Slips"): Select Date, Client, State, Branch (ALL),
// Salary Slip (PDF of the paid payroll rows), UAN/PF/ESIC pending sheet, employee list + Send Email, Close.
const B = "/api/payroll/payslip";
const MONTHS = ["", "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
type Opt = { v: string; t: string };

export default function PayslipPage() {
  const router = useRouter();
  const now = new Date();
  const [monthYear, setMonthYear] = useState(`${String(now.getMonth() + 1).padStart(2, "0")}/${now.getFullYear()}`);
  const [clients, setClients] = useState<Opt[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [units, setUnits] = useState<Opt[]>([]);
  const [emps, setEmps] = useState<Opt[]>([]);
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [unit, setUnit] = useState("ALL");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getJSON<{ results: { client_name: string; client_code: string }[] }>(`${B}/clients/`).then((d) =>
      setClients((d?.results ?? []).map((c) => ({ v: c.client_code, t: c.client_name }))));
  }, []);

  const q = (extra: Record<string, string>) => new URLSearchParams({ monthYear, ...extra }).toString();
  const pickClient = async (c: string) => {
    setClient(c); setState("Select"); setUnit("ALL"); setUnits([]); setEmps([]); setStates([]);
    if (c === "Select") return;
    const d = await getJSON<{ results: string[] }>(`${B}/states/?${q({ client: c })}`);
    setStates(d?.results ?? []);
  };
  const pickState = async (s: string) => {
    setState(s); setUnit("ALL"); setEmps([]);
    if (s === "Select") { setUnits([]); return; }
    const d = await getJSON<{ results: { unit_name: string; unit_code: string }[] }>(`${B}/units/?${q({ client, state: s })}`);
    setUnits((d?.results ?? []).map((u) => ({ v: u.unit_code, t: u.unit_name })));
  };
  const pickUnit = async (u: string) => {
    setUnit(u); setPicked([]);
    if (u === "ALL") { setEmps([]); return; }
    const d = await getJSON<{ results: { emp_code: string; emp_name: string }[] }>(`${B}/employees/?${q({ unit: u })}`);
    setEmps((d?.results ?? []).map((e) => ({ v: e.emp_code, t: e.emp_name })));
  };

  // Req_validation10
  const validate = () => {
    if (client === "Select") { window.alert("Please Select Client Name !!!"); return false; }
    if (state === "Select") { window.alert("Please Select State Name !!!"); return false; }
    if (!/^\d{2}\/\d{4}$/.test(monthYear)) { window.alert("Please Select Date"); return false; }
    return true;
  };
  const errOf = async (r: Response) => {
    const b = await r.json().catch(() => null);
    return (Array.isArray(b) ? String(b[0]) : b?.detail) || "Request failed";
  };
  const salarySlip = async () => {
    if (!validate()) return;
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}${B}/pdf/?${q({ client, state, unit })}`, { credentials: "include" });
      if (!r.ok) { window.alert(await errOf(r)); return; }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `Salary_${MONTHS[parseInt(monthYear.slice(0, 2), 10)]}_${monthYear.slice(3)}.pdf`;
      a.click();
    } finally { setBusy(false); }
  };
  const pending = async () => {
    if (client === "Select") { window.alert("Please Select Client Name !!!"); return; }
    const r = await fetch(`${API_BASE_URL}${B}/pending_export/?client=${encodeURIComponent(client)}`, { credentials: "include" });
    if (!r.ok) { window.alert(await errOf(r)); return; }
    const d = await r.json();
    const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const html = `<table border=1><tr>${d.columns.map((c: string) => `<th>${esc(c)}</th>`).join("")}</tr>` +
      d.rows.map((row: any[]) => `<tr>${row.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") + "</table>";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + html], { type: "application/vnd.ms-excel" }));
    a.download = d.filename; a.click();
  };
  const sendEmail = async () => {
    if (!validate()) return;
    if (picked.length === 0) { window.alert("Please Select Employee !!!"); return; }
    const r = await mk(`${B}/send_email/`, { client, state, unit, monthYear, emp_codes: picked });
    if (r.ok) { const d = await r.json().catch(() => ({} as any)); window.alert(d?.status || "Email Sent Successfully !!"); }
    else window.alert(await errOf(r));
  };

  return (
    <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: 4, background: "#fff" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
          Salary Slip
        </div>
        <div className="panel-body" style={{ padding: 15 }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="col-sm-2 col-xs-12"><b>Select Date :</b><span className="text-red"> *</span>
              <input className="form-control" placeholder="MM/YYYY" maxLength={7} value={monthYear}
                onChange={(e) => { setMonthYear(e.target.value); setClient("Select"); setState("Select"); setUnit("ALL"); }} /></div>
            <div className="col-sm-3 col-xs-12"><b>Client Name :</b><span className="text-red"> *</span>
              <select className="form-control" value={client} onChange={(e) => pickClient(e.target.value)}>
                <option value="Select">Select</option>
                {clients.map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}
              </select></div>
            <div className="col-sm-2 col-xs-12"><b>State Name :</b><span className="text-red"> *</span>
              <select className="form-control" value={state} onChange={(e) => pickState(e.target.value)}>
                <option value="Select">Select</option>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></div>
            <div className="col-sm-3 col-xs-12"><b>Branch Name :</b>
              <select className="form-control" value={unit} onChange={(e) => pickUnit(e.target.value)}>
                <option value="ALL">ALL</option>
                {units.map((u) => <option key={u.v} value={u.v}>{u.t}</option>)}
              </select></div>
            {emps.length > 0 && (
              <div className="col-sm-2 col-xs-12"><b>Employee :</b>
                <select multiple className="form-control" value={picked} style={{ height: 120 }}
                  onChange={(e) => setPicked(Array.from(e.target.selectedOptions).map((o) => o.value))}>
                  {emps.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                </select></div>
            )}
          </div>
          <div>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={salarySlip} style={{ marginRight: 8 }}>Salary Slip</button>
            <button type="button" className="btn btn-primary" onClick={pending} style={{ marginRight: 8 }}>UAN/PF/ESIC Pending</button>
            {emps.length > 0 && <button type="button" className="btn btn-primary" onClick={sendEmail} style={{ marginRight: 8 }}>Send Email</button>}
            <button type="button" className="btn btn-danger" onClick={() => router.push("/Home")}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
