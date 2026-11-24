"use client";
import React, { useCallback, useEffect, useState } from "react";
import { getJSON } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

// Port of salary_paid_report.aspx: month + client/state/branch -> salary paid grid
// (pay_pro_master) + "Client Attendance" export.
const B = "/api/payroll/salary-paid-report";

interface Row {
  state_name: string; unit_name: string; emp_name: string; grade: string; employee_type: string;
  month: string; year: string; emp_advance_payment: string; fine: string; deduction: string;
  total_days_present: string; payment: string; date: string; bank_holder_name: string;
  bank_account_no: string; ifsc_code: string; status: string; salary_date: string;
}
const COLS: [string, keyof Row][] = [
  ["state name", "state_name"], ["Branch name", "unit_name"], ["Employee Name", "emp_name"],
  ["Designation", "grade"], ["Employee Type", "employee_type"], ["Month", "month"], ["Year", "year"],
  ["EMP ADVANCE PAYMENT", "emp_advance_payment"], ["fine", "fine"], ["DEDUCTION", "deduction"],
  ["No Of Paid Days", "total_days_present"], ["Take Home", "payment"], ["Date", "date"],
  ["Bank holder name", "bank_holder_name"], ["Bank Account no", "bank_account_no"],
  ["IFSC CODE", "ifsc_code"], ["Status", "status"], ["Salary Date", "salary_date"],
];

function currentMonthYear() {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function SalaryPaidReportPage() {
  const [monthYear, setMonthYear] = useState(currentMonthYear());
  const [clients, setClients] = useState<{ client_code: string; client_name: string }[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [units, setUnits] = useState<{ unit_code: string; unit_name: string }[]>([]);
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("ALL");
  const [unit, setUnit] = useState("ALL");
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    getJSON<{ results: any[] }>(`${B}/options/?kind=clients`).then((d) => setClients(d?.results ?? []));
  }, []);

  const load = useCallback(async (c: string, s: string, u: string, my: string) => {
    if (c === "Select" || !/^\d{2}\/\d{4}$/.test(my)) { setRows([]); return; }
    const q = new URLSearchParams({ month_year: my, client_code: c, state: s, unit_code: u });
    const d = await getJSON<{ results: Row[] }>(`${B}/report/?${q.toString()}`);
    setRows(d?.results ?? []);
  }, []);

  const onClient = async (c: string) => {
    setClient(c); setState("ALL"); setUnit("ALL"); setStates([]); setUnits([]);
    if (c === "Select") { setRows([]); return; }
    const [st, un] = await Promise.all([
      getJSON<{ results: { state_name: string }[] }>(`${B}/options/?kind=states&client_code=${encodeURIComponent(c)}`),
      getJSON<{ results: any[] }>(`${B}/options/?kind=units&client_code=${encodeURIComponent(c)}`),
    ]);
    setStates((st?.results ?? []).map((x) => x.state_name));
    setUnits(un?.results ?? []);
    load(c, "ALL", "ALL", monthYear);
  };
  const onState = async (s: string) => {
    setState(s); setUnit("ALL");
    const un = await getJSON<{ results: any[] }>(
      `${B}/options/?kind=units&client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(s)}`);
    setUnits(un?.results ?? []);
    load(client, s, "ALL", monthYear);
  };
  const onUnit = (u: string) => { setUnit(u); load(client, state, u, monthYear); };
  const onMonth = (m: string) => { setMonthYear(m); load(client, state, unit, m); };

  // req_validation(): 'Please Select Month/Year', 'Please Select Client'
  const clientAttendance = () => {
    if (!/^\d{2}\/\d{4}$/.test(monthYear)) { alert("Please Select Month/Year"); return; }
    if (client === "Select") { alert("Please Select Client"); return; }
    if (state === "ALL" || unit === "ALL") {
      alert("Please select client, state and branch.");
      return;
    }
    const [mm, yy] = monthYear.split("/");
    const q = new URLSearchParams({
      report_type: "attendance", client_code: client, state, unit_code: unit, month: String(parseInt(mm, 10)), year: yy,
    });
    window.open(`${API_BASE_URL}/api/payroll/client-billing/manpower-report/?${q.toString()}`, "_blank");
  };

  return (
    <div className="container-fluid">
      <div className="panel panel-primary">
        <div className="panel-heading text-center text-uppercase"><b>Salary Paid Report</b></div>
        <div className="panel-body">
          <div className="row" style={{ marginBottom: 15 }}>
            <div className="col-sm-2 col-xs-12">
              <b>Select Month :</b> <span style={{ color: "red" }}>*</span>
              <input className="form-control" placeholder="mm/yyyy" value={monthYear}
                onChange={(e) => onMonth(e.target.value)} maxLength={7} />
            </div>
            <div className="col-sm-2 col-xs-12">
              <b>Client :</b> <span style={{ color: "red" }}>*</span>
              <select className="form-control" value={client} onChange={(e) => onClient(e.target.value)}>
                <option value="Select">Select</option>
                {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
              </select>
            </div>
            <div className="col-sm-2 col-xs-12">
              <b>State :</b> <span style={{ color: "red" }}>*</span>
              <select className="form-control" value={state} onChange={(e) => onState(e.target.value)}>
                <option value="ALL">ALL</option>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-sm-2 col-xs-12">
              <b>Branch :</b> <span style={{ color: "red" }}>*</span>
              <select className="form-control" value={unit} onChange={(e) => onUnit(e.target.value)}>
                <option value="ALL">ALL</option>
                {units.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
              </select>
            </div>
            <div className="col-sm-2 col-xs-12" style={{ marginTop: 17 }}>
              <button type="button" className="btn btn-primary" onClick={clientAttendance}>Client Attendance</button>
            </div>
          </div>
          <div style={{ overflowX: "auto", maxHeight: 500 }}>
            <table className="table table-bordered table-striped">
              <thead style={{ background: "#006699", color: "#fff" }}>
                <tr>{COLS.map(([h]) => <th key={h} className="text-uppercase">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>{COLS.map(([h, k]) => <td key={h}>{r[k] ?? ""}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
