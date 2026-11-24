"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api/client";

// 1:1 port of emp_salary_slip.aspx: the logged-in employee's own payslip for a month + year.
const B = "/api/payroll/emp-salary-slip";
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

export default function EmpSalarySlipPage() {
  const router = useRouter();
  const [month, setMonth] = useState("Select Month");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const show = async () => {
    // Req_validation
    if (month === "Select Month") { window.alert("Please Select Month !!!"); return; }
    if (!/^\d{4}$/.test(year.trim())) { window.alert("Please Enter Year"); return; }
    const r = await fetch(`${API_BASE_URL}${B}/pdf/?month=${month}&year=${year.trim()}`, { credentials: "include" });
    if (!r.ok) {
      const b = await r.json().catch(() => null);
      window.alert((Array.isArray(b) ? String(b[0]) : b?.detail) || "Request failed");
      return;
    }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = `Salary_${MONTHS[parseInt(month, 10) - 1]}_${year.trim()}.pdf`;
    a.click();
    setMonth("Select Month");
  };
  return (
    <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: 4, background: "#fff" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
          Employee Salary Slip
        </div>
        <div className="panel-body" style={{ padding: 15 }}>
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="col-sm-3 col-xs-12"><b>Month :</b><span className="text-red"> *</span>
              <select className="form-control" value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="Select Month">Select Month</option>
                {MONTHS.map((m, i) => <option key={m} value={String(i + 1).padStart(2, "0")}>{m}</option>)}
              </select></div>
            <div className="col-sm-2 col-xs-12"><b>Year :</b><span className="text-red"> *</span>
              <input className="form-control" maxLength={4} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))} /></div>
          </div>
          <button type="button" className="btn btn-primary" onClick={show} style={{ marginRight: 8 }}>Show</button>
          <button type="button" className="btn btn-danger" onClick={() => router.push("/Home")}>Close</button>
        </div>
      </div>
    </div>
  );
}
