"use client";
import React, { useEffect, useState } from "react";
import { getJSON } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

// Port of AttendanceHistory.aspx: Admin panel (device_logs IN/OUT/WH per day) and Employee panel
// (own pay_attendance_muster rows).
const B = "/api/attendance/attendance-history";
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

type Opt = Record<string, string>;
const toDMY = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "");

async function fetchOrError(path: string): Promise<{ results?: any[]; error?: string }> {
  try {
    const r = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
    const b = await r.json().catch(() => null);
    if (!r.ok) {
      const m = Array.isArray(b) ? b[0] : b?.detail || JSON.stringify(b);
      return { error: String(m) };
    }
    return b;
  } catch {
    return { error: "Request failed." };
  }
}

function toCsv(rows: any[], cols: string[]) {
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [cols.map(esc).join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
}

export default function AttendanceHistoryPage() {
  const [panel, setPanel] = useState<"admin" | "emp">("admin");
  const [depts, setDepts] = useState<Opt[]>([]);
  const [grades, setGrades] = useState<Opt[]>([]);
  const [emps, setEmps] = useState<Opt[]>([]);
  const [units, setUnits] = useState<Opt[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [dept, setDept] = useState("");
  const [grade, setGrade] = useState("");
  const [emp, setEmp] = useState("");
  const [adminRows, setAdminRows] = useState<any[]>([]);
  const [unit, setUnit] = useState("");
  const [month, setMonth] = useState("0");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [empRows, setEmpRows] = useState<any[]>([]);

  useEffect(() => {
    getJSON<{ results: Opt[] }>(`${B}/options/?kind=departments`).then((d) => setDepts(d?.results ?? []));
    getJSON<{ results: Opt[] }>(`${B}/options/?kind=grades`).then((d) => setGrades(d?.results ?? []));
    getJSON<{ results: Opt[] }>(`${B}/options/?kind=units`).then((d) => setUnits(d?.results ?? []));
  }, []);

  const onDept = async (v: string) => {
    setDept(v); setGrade(""); setEmp(""); setEmps([]);
    const d = await getJSON<{ results: Opt[] }>(`${B}/options/?kind=grades&dept_code=${encodeURIComponent(v)}`);
    setGrades(d?.results ?? []);
  };
  const onGrade = async (v: string) => {
    setGrade(v); setEmp("");
    if (!v) { setEmps([]); return; }
    const d = await getJSON<{ results: Opt[] }>(`${B}/options/?kind=employees&grade_code=${encodeURIComponent(v)}`);
    setEmps(d?.results ?? []);
  };

  // reg_validate()
  const submit = async () => {
    if (!fromDate) { alert("Please Select Form Date"); return; }
    if (!toDate) { alert("Please Select To Date"); return; }
    if (!dept) { alert("Please Select Department !!!"); return; }
    const q = new URLSearchParams({ from_date: toDMY(fromDate), to_date: toDMY(toDate), dept_code: dept, grade_code: grade, emp_code: emp });
    const d = await fetchOrError(`${B}/admin/?${q.toString()}`);
    if (d.error) { alert(d.error); return; }
    setAdminRows(d.results ?? []);
  };
  const excel = () => {
    const cols = ["emp_name", "logdate", "intime", "outtime", "WH"];
    const blob = new Blob([toCsv(adminRows, cols)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "Attendance_excel_data.csv"; a.click();
  };
  // employee_attendance()
  const submitEmp = async () => {
    if (!unit) { alert("Please Select Unit !!!"); return; }
    if (!year) { alert("Please Select To year"); return; }
    const q = new URLSearchParams({ unit_code: unit, year, month });
    const d = await fetchOrError(`${B}/employee/?${q.toString()}`);
    if (d.error) { alert(d.error); return; }
    setEmpRows(d.results ?? []);
  };

  const dayCols = Array.from({ length: 31 }, (_, i) => `DAY${String(i + 1).padStart(2, "0")}`);
  const close = () => { window.location.href = "/"; };

  return (
    <div className="container-fluid">
      <div className="panel panel-primary">
        <div className="panel-heading text-center text-uppercase"><b>Attendance History</b></div>
        <div className="panel-body">
          <div className="text-center" style={{ marginBottom: 15 }}>
            <button className={`btn ${panel === "admin" ? "btn-primary" : "btn-default"}`} onClick={() => setPanel("admin")}>Admin</button>&nbsp;
            <button className={`btn ${panel === "emp" ? "btn-primary" : "btn-default"}`} onClick={() => setPanel("emp")}>Employee</button>&nbsp;
            <button className="btn btn-danger" onClick={close}>Close</button>
          </div>

          {panel === "admin" && (
            <div>
              <div className="row" style={{ marginBottom: 15 }}>
                <div className="col-sm-2"><b>From Date</b><input type="date" className="form-control" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></div>
                <div className="col-sm-2"><b>To Date</b><input type="date" className="form-control" value={toDate} onChange={(e) => setToDate(e.target.value)} /></div>
                <div className="col-sm-2"><b>Department</b>
                  <select className="form-control" value={dept} onChange={(e) => onDept(e.target.value)}>
                    <option value="">--Select Department--</option>
                    {depts.map((d) => <option key={d.dept_code} value={d.dept_code}>{d.dept_name}</option>)}
                  </select></div>
                <div className="col-sm-3"><b>Grade</b>
                  <select className="form-control" value={grade} onChange={(e) => onGrade(e.target.value)}>
                    <option value="">--Select Grade--</option>
                    {grades.map((g) => <option key={g.grade_code} value={g.grade_code}>{g.grade_desc}</option>)}
                  </select></div>
                <div className="col-sm-3"><b>Employee Name</b>
                  <select className="form-control" value={emp} onChange={(e) => setEmp(e.target.value)}>
                    <option value="">--Select Employee--</option>
                    {emps.map((x) => <option key={x.emp_code} value={x.emp_code}>{x.emp_name}</option>)}
                  </select></div>
              </div>
              <div className="text-center" style={{ marginBottom: 15 }}>
                <button className="btn btn-primary" onClick={submit}>Submit</button>&nbsp;
                <button className="btn btn-primary" onClick={excel} disabled={adminRows.length === 0}>ExcelOutput</button>&nbsp;
                <button className="btn btn-danger" onClick={close}>Close</button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="table table-bordered table-striped">
                  <thead style={{ background: "#006699", color: "#fff" }}>
                    <tr><th>NAME</th><th>DATE</th><th>IN TIME</th><th>OUT TIME</th><th>WH</th></tr>
                  </thead>
                  <tbody>
                    {adminRows.map((r, i) => (
                      <tr key={i}><td>{r.emp_name}</td><td>{r.logdate}</td><td>{r.intime}</td><td>{r.outtime}</td><td>{r.WH}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {panel === "emp" && (
            <div>
              <div className="row" style={{ marginBottom: 15 }}>
                <div className="col-sm-3"><b>Unit Code</b>
                  <select className="form-control" value={unit} onChange={(e) => setUnit(e.target.value)}>
                    <option value="">Select Unit Code</option>
                    {units.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_code}-{u.unit_name}</option>)}
                  </select></div>
                <div className="col-sm-3"><b>Month</b>
                  <select className="form-control" value={month} onChange={(e) => setMonth(e.target.value)}>
                    <option value="0">Select Month</option>
                    {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
                  </select></div>
                <div className="col-sm-3"><b>Year</b>
                  <input className="form-control" value={year} onChange={(e) => setYear(e.target.value)} maxLength={4} /></div>
                <div className="col-sm-3" style={{ marginTop: 17 }}>
                  <button className="btn btn-primary" onClick={submitEmp}>Submit</button>&nbsp;
                  <button className="btn btn-danger" onClick={close}>Close</button>
                </div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="table table-bordered table-striped">
                  <thead style={{ background: "#006699", color: "#fff" }}>
                    <tr>
                      <th>Sr. No.</th><th>Employee Code</th><th>Employee Name</th>
                      {dayCols.map((d) => <th key={d}>{d.slice(3)}</th>)}
                      <th>Present</th><th>Absent</th><th>Leaves</th><th>Month</th><th>Year</th>
                    </tr>
                  </thead>
                  <tbody>
                    {empRows.map((r, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td><td>{r.EMP_CODE}</td><td>{r.EMP_NAME}</td>
                        {dayCols.map((d) => <td key={d}>{r[d]}</td>)}
                        <td>{r.TOT_DAYS_PRESENT}</td><td>{r.TOT_DAYS_ABSENT}</td><td>{r.TOT_LEAVES}</td>
                        <td>{r.MONTH}</td><td>{r.YEAR}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
