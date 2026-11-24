"use client";

import React, { useState } from "react";
import Link from "next/link";
import { getJSONStrict as apiGet } from "@/lib/api/legacy-fetch";
import { openPrintHtml } from "@/components/hrPrint";

export default function PfForm() {
  const [loading, setLoading] = useState(false);
  const [searchCode, setSearchCode] = useState("");
  const [employees, setEmployees] = useState<any[]>([]);
  const [picked, setPicked] = useState<string>("");
  // legacy: the search panel is hidden until FORM_NO_11 is clicked
  const [showSearch, setShowSearch] = useState(false);

  const handleSearch = async () => {
    if (!searchCode.trim()) {
      alert("Please Enter Employee Code");
      return;
    }
    setLoading(true);
    try {
      const res = await apiGet(`/api/hr/pf-form/?search=${encodeURIComponent(searchCode)}`);
      setEmployees(res.results || []);
      if (!res.results || res.results.length === 0) {
        alert("Record not found for this company!!");
      }
    } catch (err: any) {
      alert("Error fetching records: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  /* Printable EPF Form 11 / Form 2 rendered by the server (replaces the Crystal PFReturn_Form layout). */
  const handlePrint = async (empCode: string, formType: string) => {
    setLoading(true);
    try {
      await openPrintHtml(`/api/hr/print/pf-form/?emp_code=${encodeURIComponent(empCode)}&form=${formType === "FORM_NO_2" ? "2" : "11"}&pdf=1`);
    } finally {
      setLoading(false);
    }
  };

  const target = () => picked || (employees.length > 0 ? employees[0].emp_code : "");

  return (
    <div className="container-fluid" style={{ maxWidth: "99%", margin: "0 auto", padding: "20px" }}>
      {loading && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(204, 204, 204, 0.7)", zIndex: 9999 }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>Loading...</div>
        </div>
      )}

      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ flex: "1", textAlign: "center", fontSize: "small", fontWeight: "bold" }}>
            EMPLOYEE PF FORM
          </div>
          <div style={{ textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); window.open("html/EMPLOYEE PF FORM.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }} style={{ color: "#fff" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>
        
        <div className="panel-body" style={{ padding: "15px" }}>
          <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "25px", marginBottom: "20px", marginTop: "20px" }}>
            
            <div className="row" style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "20px" }}>
              <button className="btn btn-default" style={{ padding: "10px 20px" }} onClick={() => setShowSearch(true)}>FORM_NO_11</button>
              <button className="btn btn-default" style={{ padding: "10px 20px" }} onClick={() => { if (target()) handlePrint(target(), "FORM_NO_2"); else alert("Search for an employee first"); }}>FORM_NO_2</button>
              <button className="btn btn-danger" style={{ padding: "10px 20px", backgroundColor: "#d9534f", color: "white", border: "1px solid #d43f3a" }} onClick={() => window.location.href = "/"}>Close</button>
            </div>

            {showSearch && (<>
            <br />
            <div className="row" style={{ display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "20px" }}>
              <div style={{ textAlign: "right", marginRight: "10px" }}>
                <b>Employee Code/Name :</b>
              </div>
              <div style={{ width: "200px", marginRight: "10px" }}>
                <input 
                  type="text" 
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value)}
                  className="form-control" 
                  maxLength={10} 
                  style={{ width: "100%", padding: "6px 12px" }}
                />
              </div>
              <div>
                <button onClick={handleSearch} className="btn btn-primary" style={{ backgroundColor: "#337ab7", color: "white", padding: "6px 12px", border: "1px solid #2e6da4", borderRadius: "4px" }}>Search</button>
              </div>
            </div>

            <br />
            {employees.length > 0 && (
              <div style={{ maxHeight: "250px", overflow: "auto" }}>
                <table className="table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#006699", color: "white" }}>
                      <th style={{ padding: "8px", border: "1px solid #ddd" }}>Edit</th>
                      <th style={{ padding: "8px", border: "1px solid #ddd" }}>ID</th>
                      <th style={{ padding: "8px", border: "1px solid #ddd" }}>Employee Name</th>
                      <th style={{ padding: "8px", border: "1px solid #ddd" }}>Joining Date</th>
                      <th style={{ padding: "8px", border: "1px solid #ddd" }}>Designation</th>
                      <th style={{ padding: "8px", border: "1px solid #ddd" }}>LOCATION</th>
                      <th style={{ padding: "8px", border: "1px solid #ddd" }}>Birth Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {employees.map((emp, i) => (
                      <tr key={i} onClick={() => setPicked(emp.emp_code)} style={{ cursor: "pointer", borderBottom: "1px solid #ddd", backgroundColor: picked === emp.emp_code ? "#d9edf7" : i % 2 === 0 ? "#fff" : "#f9f9f9" }}>
                        <td style={{ padding: "8px", border: "1px solid #ddd", textAlign: "center" }}>
                          <button 
                            style={{ background: "none", border: "none", color: "#337ab7", textDecoration: "underline", cursor: "pointer" }}
                            onClick={() => handlePrint(emp.emp_code, "FORM_NO_11")}
                          >
                            PRINT
                          </button>
                        </td>
                        <td style={{ padding: "8px", border: "1px solid #ddd" }}>{emp.emp_code}</td>
                        <td style={{ padding: "8px", border: "1px solid #ddd" }}>{emp.emp_name}</td>
                        <td style={{ padding: "8px", border: "1px solid #ddd" }}>{emp.joining_date || ""}</td>
                        <td style={{ padding: "8px", border: "1px solid #ddd" }}>{emp.grade_code || ""}</td>
                        <td style={{ padding: "8px", border: "1px solid #ddd" }}>{emp.location || ""}</td>
                        <td style={{ padding: "8px", border: "1px solid #ddd" }}>{emp.birth_date || ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            </>)}
          </div>
        </div>
      </div>
    </div>
  );
}
