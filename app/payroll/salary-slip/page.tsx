"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getJSON, postJSON } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

const SA = "/api/payroll/salary-slip-actions";

interface ClientOpt { client_code: string; client_name: string; }
interface UnitOpt { unit_code: string; unit_name: string; state_name: string; }
interface EmpOpt { emp_code: string; emp_name: string; }

export default function SalarySlipPage() {
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [emps, setEmps] = useState<EmpOpt[]>([]);
  
  const [monthYear, setMonthYear] = useState("");
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [unit, setUnit] = useState("Select");
  const [emp, setEmp] = useState("Select");
  const [fromMonth, setFromMonth] = useState("0");
  const [toMonth, setToMonth] = useState("");
  
  const [gridData, setGridData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getJSON<{ results: ClientOpt[] }>("/api/masters/clients/?page_size=all").then((d) =>
      setClients(d?.results ?? []));
  }, []);

  useEffect(() => {
    if (!client || client === "Select") { setUnits([]); setStates([]); return; }
    getJSON<{ units: UnitOpt[]; states: string[] }>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(client)}`).then((d) => {
      const rs = d?.units ?? [];
      setUnits(rs);
      setStates([...(d?.states ?? Array.from(new Set(rs.map((u) => u.state_name).filter(Boolean))))].sort());
    });
  }, [client]);

  useEffect(() => {
    if (!unit || unit === "Select") { setEmps([]); return; }
    getJSON<{ employees: EmpOpt[] }>(`/api/hr/employees/lookup/?unit_code=${encodeURIComponent(unit)}`).then((d) =>
      setEmps((d?.employees ?? []).map((e) => ({ emp_code: e.emp_code, emp_name: e.emp_name }))));
  }, [unit]);

  const filteredUnits = state === "Select" ? units : units.filter((u) => u.state_name === state);

  const validateEmail = () => {
    if (client === "Select") {
      alert("Please Select Client Name");
      return false;
    }
    if (!monthYear) {
      alert("Please Select Month/Year");
      return false;
    }
    return true;
  };

  const empMode = emp !== "Select";

  const validateEmail1 = () => {
    if (!monthYear && !empMode) {
      alert("Please Select Month/Year");
      return false;
    }
    if (client === "Select") {
      alert("Please Select Client Name");
      return false;
    }
    const r = window.confirm("Are you sure you want Resend Record ?");
    return r;
  };

  const scope = () => ({ client, state, unit, monthYear });

  const refreshGrid = async () => {
    if (client === "Select" || !monthYear) return;
    const q = new URLSearchParams({ client, monthYear });
    if (state !== "Select") q.set("state", state);
    if (unit !== "Select") q.set("unit", unit);
    const d = await getJSON<{ results: any[] }>(`${SA}/emails_not_sent/?${q.toString()}`);
    setGridData(d?.results ?? []);
  };

  const handleSalarySlipEmail = async () => {
    if (!validateEmail()) return;
    setLoading(true);
    try {
      const res = await postJSON(`${SA}/send_email/`, scope());
      const data = await res.json().catch(() => ({}));
      alert(data?.status || (data as any)?.detail || (Array.isArray(data) ? String((data as any)[0]) : "") || (res.ok ? "Done" : "Email Not Sent!!"));
      if (res.ok) await refreshGrid();
    } catch (e: any) { alert("Error: " + e.message); }
    setLoading(false);
  };

  const handleEmailsNotSent = async () => {
    if (!validateEmail()) return;
    setLoading(true);
    try { await refreshGrid(); } catch (e: any) { alert("Error: " + e.message); }
    setLoading(false);
  };

  // stream the real salary-slip PDF (reportlab)
  const downloadPdf = async (extra: Record<string, string> = {}) => {
    const q = new URLSearchParams({ client, ...(monthYear ? { monthYear } : {}), ...extra });
    if (state !== "Select") q.set("state", state);
    if (unit !== "Select") q.set("unit", unit);
    const r = await fetch(`${API_BASE_URL}${SA}/download_slip/?${q.toString()}`, { credentials: "include" });
    if (!r.ok) { const eb = await r.json().catch(() => ({} as any)); alert(eb?.detail || (Array.isArray(eb) ? String(eb[0]) : "") || "Download failed"); return; }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `Salary_slip_${client}_${extra.emp ? (extra.to_month_year || "") : monthYear}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const handleDownloadSalarySlip = async () => {
    if (!validateEmail1()) return;
    setLoading(true);
    try {
      // employee selected -> single-employee slip for the From/To month range (legacy create_salary_pdf_emp_wise)
      await downloadPdf(empMode ? { emp, from_month: fromMonth, to_month_year: toMonth } : {});
    } catch (e: any) { alert("Error: " + e.message); }
    setLoading(false);
  };

  const handleResendSlip = async () => {
    if (!validateEmail1()) return;
    setLoading(true);
    try {
      const res = await postJSON(`${SA}/resend_slip/`, scope());  // no id -> bulk resend
      const data = await res.json().catch(() => ({}));
      alert(data?.status || (data as any)?.detail || (Array.isArray(data) ? String((data as any)[0]) : "") || (res.ok ? "Done" : "Email Not Sent!!"));
      if (res.ok) await refreshGrid();
    } catch (e: any) { alert("Error: " + e.message); }
    setLoading(false);
  };

  const handleEmployeeWiseSalary = async () => {
    if (!validateEmail1()) return;
    setLoading(true);
    try {
      // real send: POST employee_wise (mails each paid employee's slip to the branch head)
      const res = await postJSON(`${SA}/employee_wise/`, scope());
      const data = await res.json().catch(() => ({}));
      alert(data?.status || (data as any)?.detail || (Array.isArray(data) ? String((data as any)[0]) : "") || (res.ok ? "Done" : "Email Not Sent!!"));
      if (res.ok) await refreshGrid();
    } catch (e: any) { alert("Error: " + e.message); }
    setLoading(false);
  };

  const handleDelete = async (row: any) => {
    if (!window.confirm("Are you Sure You Want to Delete Record")) return;
    const res = await postJSON(`${SA}/delete_issue/`, { id: row.id });
    const data = await res.json().catch(() => ({}));
    alert(data?.status || (res.ok ? "Record deleted successfully!!" : "Record not Available"));
    if (res.ok) await refreshGrid();
  };

  const handleSendEmailRecord = async (row: any) => {
    if (!window.confirm("Are you sure you want send email?")) return;
    setLoading(true);
    try {
      const res = await postJSON(`${SA}/resend_slip/`, { id: row.id });
      const data = await res.json().catch(() => ({}));
      alert(data?.status || (res.ok ? "Email Sent successfully!!" : "Email Not Sent!!"));
      if (res.ok) await refreshGrid();
    } catch (e: any) { alert("Error: " + e.message); }
    setLoading(false);
  };

  return (
    <section className="app-content">
      {loading && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(204,204,204,0.5)", zIndex: 9999, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <h2 style={{ color: "#333", backgroundColor: "#fff", padding: "20px", borderRadius: "5px", border: "1px solid #ccc" }}>Processing... Please wait</h2>
        </div>
      )}
      <div className="lg-panel">
        
        {/* Header */}
        <div className="lg-panel-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div></div>
          <b style={{ fontSize: "16px", textTransform: "uppercase" }}>SALARY SLIP</b>
          <a href="#" onClick={(e) => { e.preventDefault(); window.open("/html/paypro_upload.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }}>
            <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
          </a>
        </div>
        
        {/* Body */}
        <div className="lg-panel-body">
          <div className="shadow">
            <div style={{ background: "#f3f1fe", padding: "25px", border: "1px solid #e2e2dd", marginBottom: "20px", marginTop: "20px", borderRadius: "10px" }}>
              
              {/* Tabs */}
              <ul style={{ listStyleType: "none", padding: 0, margin: "0 0 20px 0", borderBottom: "1px solid #ccc" }}>
                <li style={{ display: "inline-block", padding: "10px 15px", background: "#fff", borderTop: "2px solid #337ab7", borderLeft: "1px solid #ccc", borderRight: "1px solid #ccc", borderBottom: "1px solid #fff", marginBottom: "-1px" }}>
                  <b>Send Email</b>
                </li>
              </ul>
              
              {/* Filters */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-start" }}>
                {!empMode && (<div style={{ width: "12%" }}>
                  <b>Month/Year:</b><span style={{ color: "red" }}>*</span>
                  <input type="month" className="lg-control" value={monthYear} onChange={e => setMonthYear(e.target.value)} />
                </div>)}
                <div style={{ width: "15%" }}>
                  <b>Client Name :</b><span style={{ color: "red" }}>*</span>
                  <select className="lg-control" value={client} onChange={e => { setClient(e.target.value); setState("Select"); setUnit("Select"); setEmp("Select"); }}>
                    <option value="Select">Select</option>
                    {clients.map(c => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
                  </select>
                </div>
                <div style={{ width: "15%" }}>
                  <b>Select State :</b>
                  <select className="lg-control" value={state} onChange={e => { setState(e.target.value); setUnit("Select"); setEmp("Select"); }}>
                    <option value="Select">Select</option>
                    {states.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ width: "15%" }}>
                  <b>Select Branch :</b>
                  <select className="lg-control" value={unit} onChange={e => { setUnit(e.target.value); setEmp("Select"); }}>
                    <option value="Select">Select</option>
                    {filteredUnits.map(u => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
                  </select>
                </div>
                <div style={{ width: "15%" }}>
                  <b>Select Employee Name :</b>
                  <select className="lg-control" value={emp} onChange={e => setEmp(e.target.value)}>
                    <option value="Select">Select</option>
                    {emps.map(e => <option key={e.emp_code} value={e.emp_code}>{e.emp_name}</option>)}
                  </select>
                </div>
                {empMode && (<><div style={{ width: "14%" }}>
                  <b>FromMonth:</b>
                  <select className="lg-control" value={fromMonth} onChange={e => setFromMonth(e.target.value)}>
                    <option value="0">Select Month</option>
                    {Array.from({length: 12}).map((_, i) => {
                      const m = (i + 1).toString().padStart(2, '0');
                      return <option key={m} value={m}>{m}</option>;
                    })}
                  </select>
                </div>
                <div style={{ width: "12%" }}>
                  <b>To Month:</b>
                  <input type="month" className="lg-control" value={toMonth} onChange={e => { setToMonth(e.target.value); if (fromMonth === "0" && e.target.value) setFromMonth(e.target.value.slice(5, 7)); }} />
                </div></>)}
              </div>

              {/* Buttons */}
              <div style={{ marginTop: "20px" }}>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                  {!empMode && <button className="lg-btn lg-btn-primary" style={{ width: "15%" }} onClick={handleSalarySlipEmail} disabled={loading}>Salary Slip Email</button>}
                  {!empMode && <button className="lg-btn lg-btn-primary" style={{ width: "15%" }} onClick={handleEmailsNotSent} disabled={loading}>Emails Not Sent</button>}
                  <button className="lg-btn lg-btn-primary" style={{ width: "15%" }} onClick={handleDownloadSalarySlip} disabled={loading}>Download Salary Slip</button>
                  {!empMode && <button className="lg-btn lg-btn-primary" style={{ width: "15%" }} onClick={handleResendSlip} disabled={loading}>Resend Slip</button>}
                  <button className="lg-btn lg-btn-primary" style={{ width: "18%" }} onClick={handleEmployeeWiseSalary} disabled={loading}>Send Employeewise Salary</button>
                </div>
              </div>
            </div>

            {/* Grid */}
            <div style={{ marginTop: "20px", overflowX: "auto" }}>
              <table className="lg-grid">
                <thead>
                  <tr>
                    <th>DELETE</th>
                    <th>Sr No.</th>
                    <th>ID</th>
                    <th>CLIENT</th>
                    <th>STATE</th>
                    <th>BRANCH</th>
                    <th>MONTH</th>
                    <th>BRANCH</th>
                    <th>MONTH</th>
                    <th>YEAR</th>
                    <th>REASON</th>
                    <th>SEND EMAIL</th>
                  </tr>
                </thead>
                <tbody>
                  {gridData.length === 0 ? (
                    <tr>
                      <td colSpan={12} style={{ textAlign: "center" }}>No records</td>
                    </tr>
                  ) : (
                    gridData.map((row, index) => (
                      <tr key={index}>
                        <td style={{ textAlign: "center" }}>
                          <a href="#" onClick={(e) => { e.preventDefault(); handleDelete(row); }}>
                            <img src="/Images/delete_icon.png" alt="delete" width="15" height="15" />
                          </a>
                        </td>
                        <td>{index + 1}</td>
                        <td>{row.id}</td>
                        <td>{row.client}</td>
                        <td>{row.state}</td>
                        <td>{row.branch}</td>
                        <td>{row.month}</td>
                        <td>{row.branch}</td>
                        <td>{row.month}</td>
                        <td>{row.year}</td>
                        <td>{row.reason}</td>
                        <td style={{ textAlign: "center" }}>
                          <a href="#" onClick={(e) => { e.preventDefault(); handleSendEmailRecord(row); }} style={{ color: "#337ab7", textDecoration: "none" }}>SEND EMAIL</a>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

          </div>

          <div style={{ textAlign: "center", marginTop: "20px" }}>
            <Link href="/" className="lg-btn lg-btn-danger">Close</Link>
          </div>

        </div>
      </div>
    </section>
  );
}
