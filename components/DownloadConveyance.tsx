"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getJSON as apiGet, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

export default function DownloadConveyance() {
  const [loading, setLoading] = useState(false);
  const [month, setMonth] = useState("");
  
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  
  const [states, setStates] = useState<any[]>([]);
  const [selectedState, setSelectedState] = useState("");
  
  const [branches, setBranches] = useState<any[]>([]);
  const [selectedBranch, setSelectedBranch] = useState("");
  
  const [type, setType] = useState("1");
  const [activePanel, setActivePanel] = useState<number | null>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());

  // Legacy cascade (reporting-scoped): client -> states -> branches (+ALL).
  const CD = "/api/attendance/conveyance-download";
  useEffect(() => {
    setSelectedState("Select"); setSelectedBranch("Select"); setStates([]);
    if (!selectedClient || selectedClient === "Select") return;
    apiGet<{ results: string[] }>(`${CD}/states/?client_code=${encodeURIComponent(selectedClient)}`)
      .then((d) => setStates((d?.results ?? []).map((s) => ({ state_name: s })))).catch(() => setStates([]));
  }, [selectedClient]);
  useEffect(() => {
    setSelectedBranch("Select"); setBranches([]);
    if (!selectedClient || selectedClient === "Select" || !selectedState || selectedState === "Select") return;
    apiGet<{ results: { unit_code: string; unit_name: string }[] }>(
      `${CD}/branches/?client_code=${encodeURIComponent(selectedClient)}&state=${encodeURIComponent(selectedState)}&month_year=${encodeURIComponent(month)}`)
      .then((d) => setBranches((d?.results ?? []).map((u) => ({ branch_code: u.unit_code, branch_name: u.unit_name }))))
      .catch(() => setBranches([]));
  }, [selectedClient, selectedState, month]);

  const filterQuery = (t = type) =>
    `type=${t}&client_code=${encodeURIComponent(selectedClient)}&month_year=${encodeURIComponent(month)}`
    + `&state=${encodeURIComponent(selectedState)}&unit_code=${encodeURIComponent(selectedBranch)}`;

  // Authenticated file fetch (cookie session) -> browser save. Mirrors legacy 'File not Found!!.' alert.
  const saveBlob = async (url: string, fallbackName: string) => {
    const res = await fetch(`${API_BASE_URL}${url}`, { credentials: "include" });
    if (!res.ok) { alert(await responseMessage(res, "File not Found!!.")); return; }
    const blob = await res.blob();
    const cd = res.headers.get("Content-Disposition") || "";
    const m = cd.match(/filename="?([^";]+)"?/i);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = m ? m[1] : fallbackName;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const downloadOne = (file: string) => {
    if (!file) { alert("Attachment File Cannot Be Uploaded !!!"); return; }
    return saveBlob(`/api/attendance/conveyance-download/download/?${filterQuery(String(activePanel ?? type))}&file=${encodeURIComponent(file)}`, file);
  };
  const downloadZip = () => {
    const cn = clients.find((c) => c.client_code === selectedClient)?.client_name || selectedClient;
    return saveBlob(`/api/attendance/conveyance-download/zip/?${filterQuery(String(activePanel ?? type))}&client_name=${encodeURIComponent(cn)}`, "ATTENDANCE.zip");
  };

  useEffect(() => {
    apiGet<{ results: { client_code: string; client_name: string }[] }>(`${CD}/clients/`)
      .then((d) => setClients(d?.results ?? [])).catch(() => setClients([]));
  }, []);

  const handleShow = async () => {
    // Legacy validation: client + month required ("Please Select Client" / "Please Select Month").
    if (!selectedClient || selectedClient === "Select") { alert("Please Select Client"); return; }
    if (!month || month.length < 5) { alert("Please Select Month"); return; }
    setLoading(true);
    try {
      const d = await apiGet<{ results: any[]; message?: string }>(`/api/attendance/conveyance-download/?${filterQuery()}`);
      setRecords(d?.results ?? []); setPicked(new Set());
      setActivePanel(parseInt(type));
      if ((d?.results ?? []).length === 0) alert(d?.message || "NO Records Found !!!");
    } catch {
      setRecords([]); setActivePanel(parseInt(type));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid" style={{ maxWidth: "99%", margin: "0 auto", padding: "20px" }}>
      {loading && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(204, 204, 204, 0.7)", zIndex: 9999 }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>Loading...</div>
        </div>
      )}

      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "8.33%" }}></div>
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold" }}>
            EMPLOYEE ATTENDANCE
          </div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); window.open("html/download_conveyance.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }} style={{ color: "#fff", fontSize: "10px" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>

        <div className="panel-body" style={{ padding: "15px" }}>
          <div style={{ background: "#f6f3ff", border: "1px solid gray", borderRadius: "4px", padding: "20px" }}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: "0 0 16.66%", paddingRight: "15px", marginBottom: "15px" }}>
                <b>Select Month :</b><span style={{ color: "red" }}>*</span>
                <input type="text" value={month} onChange={(e) => setMonth(e.target.value)} className="form-control date-picker" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }} />
              </div>
              <div style={{ flex: "0 0 16.66%", paddingRight: "15px", marginBottom: "15px", textAlign: "left" }}>
                <b>Client Name :</b>
                <select value={selectedClient} onChange={(e) => setSelectedClient(e.target.value)} className="form-control" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }}>
                  <option value="Select">Select</option>
                  {clients.map(c => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
                </select>
              </div>
              <div style={{ flex: "0 0 16.66%", paddingRight: "15px", marginBottom: "15px", textAlign: "left" }}>
                <b>State Name :</b>
                <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)} className="form-control" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }}>
                  <option value="Select">Select</option>
                  {states.map(s => <option key={s.state_name} value={s.state_name}>{s.state_name}</option>)}
                </select>
              </div>
              <div style={{ flex: "0 0 16.66%", paddingRight: "15px", marginBottom: "15px", textAlign: "left" }}>
                <b>Branch Name :</b>
                <select value={selectedBranch} onChange={(e) => setSelectedBranch(e.target.value)} className="form-control" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }}>
                  <option value="Select">Select</option>
                  <option value="ALL">ALL</option>
                  {branches.map(b => <option key={b.branch_code} value={b.branch_code}>{b.branch_name}</option>)}
                </select>
              </div>
              <div style={{ flex: "0 0 16.66%", paddingRight: "15px", marginBottom: "15px" }}>
                <b>Select Type:</b> <span style={{ color: "red" }}>*</span>
                <select value={type} onChange={(e) => setType(e.target.value)} className="form-control" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }}>
                  <option value="1">Employee Conveyance Billing</option>
                  <option value="2">Driver Convenyance Billing</option>
                  <option value="3">Attendance</option>
                  <option value="4">Material/DeepClean/PasteControl</option>
                </select>
              </div>
            </div>
            
            <div style={{ marginTop: "15px" }}>
              <button onClick={handleShow} className="btn btn-primary" style={{ padding: "6px 12px", backgroundColor: "#ccc", color: "#000", border: "1px solid #aaa", borderRadius: "4px", width: "auto" }}>Show</button>
            </div>
          </div>
          
          <br />

          {(activePanel === 1 || activePanel === 2) && (
            <div style={{ maxHeight: "600px", overflow: "auto" }}>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ccc" }}>
                <thead>
                  <tr style={{ backgroundColor: "#5D7B9D", color: "white", fontWeight: "bold" }}>
                    <th style={{ padding: "8px", border: "1px solid #ccc", width: "50px" }}>
                      <input type="checkbox" checked={records.length > 0 && picked.size === records.length}
                        onChange={(e) => setPicked(e.target.checked ? new Set(records.map((_, i) => i)) : new Set())} /> SELECT
                      <img src="/Images/winzip.png" alt="zip" title="Download ZIP" style={{ width: 25, marginLeft: 10, cursor: "pointer" }}
                        onClick={() => { if (records.length === 0) return; downloadZip(); }} />
                    </th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>CLIENT NAME</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>STATE NAME</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>BRANCH NAME</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>EMPLOYEE NAME</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>MONTH YEAR</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>conveyance type</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>Conveyance_file</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>invoice_no</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>DOWNLOAD</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: "8px", border: "1px solid #ccc", textAlign: "center" }}><input type="checkbox" checked={picked.has(i)}
                        onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(i); else n.delete(i); return n; })} /></td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.client_name}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.state}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.branch_name}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.emp_name}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.month_year}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.conveyance}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.Attendance_file}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.invoice_no}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.Attendance_file ? <a href="#" onClick={(e) => { e.preventDefault(); downloadOne(r.Attendance_file); }}>Download</a> : ""}</td>
                    </tr>
                  ))}
                  {records.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center" }}>NO Records Found !!!</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {activePanel === 3 && (
            <div style={{ maxHeight: "600px", overflow: "auto" }}>
              <div className="text-center" style={{ textAlign: "center" }}>
                <h3>Approve Attendance By Admin</h3>
              </div>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ccc" }}>
                <thead>
                  <tr style={{ backgroundColor: "#5D7B9D", color: "white", fontWeight: "bold" }}>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>CLIENT NAME</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>STATE NAME</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>BRANCH NAME</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>MONTH YEAR</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>CURRENT STATUS</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>Attendance_file</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>DOWNLOAD</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>ID</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>unit_code</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.client_name}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.state_name}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.branch_name}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.month_year}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.status}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.Attendance_file}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.Attendance_file ? <a href="#" onClick={(e) => { e.preventDefault(); downloadOne(r.Attendance_file); }}>Download</a> : ""}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.id}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.unit_code}</td>
                    </tr>
                  ))}
                  {records.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center" }}>NO Records Found !!!</td></tr>}
                </tbody>
              </table>
            </div>
          )}

          {activePanel === 4 && (
            <div style={{ height: "200px", overflow: "auto" }}>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ccc" }}>
                <thead>
                  <tr style={{ backgroundColor: "#224173", color: "white", fontWeight: "bold" }}>
                    <th style={{ padding: "8px", border: "1px solid #ccc", width: "20px" }}>SR NO.</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>ID</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>UNIT CODE</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>STATE NAME</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>BRANCH NAME</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>MONTH/YEAR</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>STATUS</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>File Name</th>
                    <th style={{ padding: "8px", border: "1px solid #ccc" }}>DOWNLOAD</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{i + 1}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.id}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.unit_code}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.state_name}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.unit_name}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.month_year_upload}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.material_flag}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.material_upload}</td>
                      <td style={{ padding: "8px", border: "1px solid #ccc" }}>{r.material_upload ? <a href="#" onClick={(e) => { e.preventDefault(); downloadOne(r.material_upload); }}>Download</a> : ""}</td>
                    </tr>
                  ))}
                  {records.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center" }}>NO Records Found !!!</td></tr>}
                </tbody>
              </table>
            </div>
          )}
          
        </div>
      </div>
    </div>
  );
}
