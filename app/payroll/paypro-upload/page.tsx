"use client";
import React, { useState, useEffect } from "react";
import { getJSON, upload, mk } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

const B = "/api/payroll/paypro-upload";
const SA = "/api/payroll/salary-slip-actions";
interface UnitOpt { unit_code: string; unit_name: string; state_name: string; }
type Grid = { results: Record<string, unknown>[]; count: number };


// Real reason from a DRF error body: {detail}, ["msg"], {field:["msg"]}; falls back to the HTTP status.
const errMsg = (b: any, status: number, fallback: string) => {
  if (b?.detail) return String(b.detail);
  if (Array.isArray(b) && b.length) return String(b[0]);
  if (b && typeof b === "object") {
    const parts = Object.entries(b).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : String(v)}`);
    if (parts.length) return parts.join("; ");
  }
  return `${fallback} (server returned HTTP ${status})`;
};

export default function PayproUploadPage() {
  const [bank, setBank] = useState("0");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [grid, setGrid] = useState<Grid | null>(null);

  const [activeTab, setActiveTab] = useState("PayPro Upload Files");
  
  // States for Send Email tab
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [unit, setUnit] = useState("Select");
  const [clients, setClients] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [units, setUnits] = useState<any[]>([]);
  const [emailMonthYear, setEmailMonthYear] = useState("");
  const [notSent, setNotSent] = useState<Record<string, unknown>[] | null>(null);
  const [startDay, setStartDay] = useState("0");
  const [endDay, setEndDay] = useState("0");
  const [pClient, setPClient] = useState("Select");
  const [pState, setPState] = useState("Select");
  const [unitOpts, setUnitOpts] = useState<UnitOpt[]>([]);
  const [stateOpts, setStateOpts] = useState<string[]>([]);

  // Legacy ddl_client -> ddl_state -> ddl_unit cascade (pay_unit_master of the client).
  const loadScope = (cc: string) => {
    if (!cc || cc === "Select") { setUnitOpts([]); setStateOpts([]); return; }
    getJSON<{ units: UnitOpt[]; states?: string[] }>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(cc)}`).then((d) => {
      const rs = d?.units ?? [];
      setUnitOpts(rs);
      setStateOpts([...(d?.states ?? Array.from(new Set(rs.map((u) => u.state_name).filter(Boolean))))].sort());
    });
  };
  useEffect(() => { loadScope(pClient); }, [pClient]);
  useEffect(() => { loadScope(client); }, [client]);

  useEffect(() => {
    // Load clients for Send Email tab
    getJSON<{ results: any[] }>("/api/masters/clients/?page_size=all").then(r => {
      setClients(r?.results ?? []);
    });
  }, []);

  const issueXls = (cols: string[], rows: string[][], name: string) => {
    const esc = (v: any) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = `<style> .textmode { } </style><table border=1><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>` +
      rows.map((r) => `<tr>${r.map((c) => (/^\d{9,}$/.test(String(c ?? "")) ? `<td style="mso-number-format:'\@'">${esc(c)}</td>` : `<td>${esc(c)}</td>`)).join("")}</tr>`).join("") + "</table>";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
  };

  // "Process" = account+amount matching (old bank files); "Process New" = CRN matching (new Axis / IndusInd files)
  const process = async (format: "old" | "new" = "old") => {
    if (bank === "0") { alert("Please Select Bank"); return; }
    if (!month || !year) { alert("Please Select month & year "); return; }
    if (!file) { alert("Please Upload the File "); return; }

    setMsg("");
    const my = `${month.padStart(2, '0')}/${year.substring(2)}`;
    const fd = new FormData();
    fd.append("bank", bank);
    fd.append("month_year", my);
    fd.append("format", format);
    fd.append("start_day", startDay);
    fd.append("end_day", endDay);
    fd.append("file", file);

    const r = await upload(`${B}/process/`, fd);
    const b = await r.json().catch(() => ({} as any));
    if (!r.ok) { alert(errMsg(b, r.status, "Upload failed.")); return; }
    setMsg(b.status ? `${b.status} matched=${b.matched} unmatched=${b.unmatched}` : JSON.stringify(b));
    if (b.issue_rows && b.issue_rows.length) issueXls(b.issue_columns || [], b.issue_rows, b.issue_filename || "Paypro_issue.xls");
    alert("Paypro File Uploaded Successfully...");
    await load();
  };

  const load = async () => {
    if (!month || !year) { alert("Please Select month & year"); return; }
    setGrid(await getJSON<Grid>(`${B}/results/?month=${parseInt(month, 10)}&year=${year}`));
  };

  const download = async (url: string, fallbackName: string) => {
    const r = await fetch(`${API_BASE_URL}${url}`, { credentials: "include" });
    if (!r.ok) {
      const b = await r.json().catch(() => ({} as any));
      alert(b?.detail || (Array.isArray(b) ? String(b[0]) : "") || "No Matching Records Found.");
      return;
    }
    const blob = await r.blob();
    const cd = r.headers.get("Content-Disposition") || "";
    const fm = cd.match(/filename="?([^"]+)"?/);
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = fm ? fm[1] : fallbackName;
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  const needMonth = (): boolean => {
    if (!month || !year) { alert("Please Select month & year "); return false; }
    return true;
  };

  // btn_excel_Click: client / branch / employee / salary status for the month
  const btnExcel = () => { if (needMonth()) void download(`${B}/employee-excel/?month=${parseInt(month, 10)}&year=${year}`, "EMPLOYEE_SALARY_STATUS.xls"); };
  // btn_material_excel_Click reads the R&M / material payment table, which has no modern source
  const btnMaterialExcel = () => { if (needMonth()) void download(`${B}/material-report/?month=${parseInt(month, 10)}&year=${year}`, "MATERIAL_PAYMENT.xls"); };
  // ECR challans (ESIC / PF) are generated from statutory challan data that is not part of this release
  const btnESIC = () => { alert("The ESIC challan (ECR) file is not available in this version."); };
  const btnPF = () => { alert("The PF challan (ECR) file is not available in this version."); };

  // ---- Send Email tab -> salary-slip-actions (same real endpoints as the Salary Slip page) ----
  const emailScope = () => ({
    client, monthYear: emailMonthYear,
    ...(state !== "Select" ? { state } : {}), ...(unit !== "Select" ? { unit } : {}),
  });
  const emailValid = (): boolean => {
    if (client === "Select") { alert("Please Select Client Name"); return false; }
    if (!emailMonthYear) { alert("Please Select Month/Year"); return false; }
    return true;
  };
  const postSlip = async (path: string) => {
    if (!emailValid()) return;
    const r = await mk(`${SA}/${path}/`, emailScope());
    const b = await r.json().catch(() => ({} as any));
    alert(b?.status || b?.detail || (Array.isArray(b) ? String(b[0]) : "") || (r.ok ? "Done" : "Email Not Sent!!"));
  };
  const btnSendEmail = () => { void postSlip("send_email"); };
  const btnResend = () => { void postSlip("resend_slip"); };
  const btnEmailsNotSent = async () => {
    if (!emailValid()) return;
    const r = await mk(`${SA}/emails_not_sent/`, emailScope());
    const b = await r.json().catch(() => ({} as any));
    if (!r.ok) { alert(b?.detail || (Array.isArray(b) ? String(b[0]) : "") || "Request failed."); return; }
    setNotSent(b.results ?? []);
  };
  const btnDownloadSalary = () => {
    if (!emailValid()) return;
    const q = new URLSearchParams(emailScope() as Record<string, string>);
    void download(`${SA}/download_slip/?${q.toString()}`, `Salary_slip_${client}_${emailMonthYear}.pdf`);
  };


  return (
    <>
      <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css" />
      <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
        
        <div className="panel panel-primary" style={{ border: "1px solid #337ab7", borderRadius: "4px" }}>
          
          <div className="panel-heading" style={{ backgroundColor: "#337ab7", color: "#fff" }}>
            <div className="row">
              <div className="col-sm-1"></div>
              <div className="col-sm-9">
                  <div style={{ textAlign: "center", color: "#fff", fontSize: "16px" }} className="text-center text-uppercase"><b>PayPro Upload files</b></div>
              </div>
              <div className="col-sm-2 text-right">
                  <a href="#" onClick={(e) => { e.preventDefault(); }} style={{ fontSize: "10px" }}>
                      <img width="20" height="20" title="Help" src="/Images/help_ico.png" />
                  </a>
              </div>
            </div>
          </div>
          
          <div className="panel-body">
            
            <div className="shadow">
              <div id="tabs" style={{ background: "#f3f1fe", padding: "25px", border: "1px solid #e2e2dd", marginBottom: "20px", marginTop: "20px", borderRadius: "10px" }}>
                
                <ul className="nav nav-tabs" style={{ marginBottom: "15px", borderBottom: "1px solid #ddd" }}>
                  <li className={activeTab === "PayPro Upload Files" ? "active" : ""}>
                    <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab("PayPro Upload Files"); }}><b>PayPro Upload Files</b></a>
                  </li>
                  <li className={activeTab === "Send Email" ? "active" : ""}>
                    <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab("Send Email"); }}><b>Send Email</b></a>
                  </li>
                </ul>

                {activeTab === "PayPro Upload Files" && (
                  <div id="item1">
                    <br />
                    <style>{`
                      .pp-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(200px,1fr)); gap:16px 18px; align-items:end; }
                      .pp-grid label { display:block; font-weight:700; margin-bottom:4px; }
                      .pp-btns { display:flex; flex-wrap:wrap; gap:10px; margin-top:22px; }
                      .pp-btns .btn { min-width:150px; }
                      .pp-sep { border-top:1px solid #d9d6ee; margin:20px 0 4px; }
                    `}</style>
                    <div className="pp-grid">
                        <div>
                            <label>Billing Start Day:</label>
                            <select className="form-control" value={startDay} onChange={(e) => setStartDay(e.target.value)}>
                                <option value="0">Select</option>
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label>Billing End Day:</label>
                            <select className="form-control" value={endDay} onChange={(e) => setEndDay(e.target.value)}>
                                <option value="0">Select</option>
                                {Array.from({ length: 31 }, (_, i) => i + 1).map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        <div>
                            <label>Bank : <span style={{ color: "red" }}>*</span></label>
                            <select className="form-control" value={bank} onChange={(e) => setBank(e.target.value)}>
                                <option value="0">Select</option>
                                <option value="HDFC BANK">HDFC BANK</option>
                                <option value="AXIS BANK">AXIS BANK</option>
                                <option value="INDUSIND BANK">INDUSIND BANK</option>
                                <option value="ICICI BANK">ICICI BANK</option>
                                <option value="KOTAK BANK">KOTAK BANK</option>
                            </select>
                        </div>
                        <div>
                            <label>Month/Year : <span style={{ color: "red" }}>*</span></label>
                            <input
                              type="month"
                              className="form-control"
                              value={year && month ? `${year}-${month.padStart(2, '0')}` : ""}
                              onChange={(e) => {
                                if (e.target.value) {
                                  const [y, m] = e.target.value.split("-");
                                  setYear(y); setMonth(parseInt(m, 10).toString());
                                } else {
                                  setYear(""); setMonth("");
                                }
                              }}
                            />
                        </div>
                        <div>
                            <label>Client Name :</label>
                            <select className="form-control" value={pClient} onChange={(e) => { setPClient(e.target.value); setPState("Select"); }}>
                              <option value="Select">Select</option>
                              {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label>State :</label>
                            <select className="form-control" value={pState} onChange={(e) => setPState(e.target.value)}>
                              <option value="Select">Select</option>
                              {stateOpts.map((x) => <option key={x} value={x}>{x}</option>)}
                            </select>
                        </div>
                        <div>
                            <label>File : <span style={{ color: "red" }}>*</span></label>
                            <input type="file" className="form-control" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                        </div>
                    </div>

                    <div className="pp-btns">
                        <button className="btn btn-primary" onClick={() => process("old")}>Process</button>
                        <button className="btn btn-primary" onClick={() => process("new")}>Process New</button>
                        <button className="btn btn-primary" onClick={load}>Show</button>
                    </div>
                    <div className="pp-sep" />
                    <div className="pp-btns" style={{ marginTop: "14px" }}>
                        <button className="btn btn-primary" onClick={btnExcel}>Get Employee Excel</button>
                        <button className="btn btn-primary" onClick={btnMaterialExcel}>Material Payment Report</button>
                        <button className="btn btn-primary" onClick={btnESIC}>Employee ECR (ESIC)</button>
                        <button className="btn btn-primary" onClick={btnPF}>Employee ECR (PF)</button>
                    </div>
                    <br />

                    {msg && <div style={{ color: "green", fontWeight: "bold", textAlign: "center", marginBottom: "15px" }}>{msg}</div>}

                    {grid && grid.count > 0 && (
                      <div style={{ overflowX: "auto", marginTop: "10px" }}>
                        <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff" }}>
                          <thead style={{ background: "#006699", color: "white" }}>
                            <tr>{Object.keys(grid.results[0]).map((c) => <th key={c} style={{ padding: "8px", textTransform: "uppercase" }}>{c.replace(/_/g, " ")}</th>)}</tr>
                          </thead>
                          <tbody>
                            {grid.results.map((r, i) => (
                              <tr key={i}>{Object.keys(grid.results[0]).map((c) => <td key={c} style={{ padding: "8px" }}>{String(r[c] ?? "")}</td>)}</tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                    {grid && grid.count === 0 && <div style={{ textAlign: "center", color: "#777", marginTop: "10px" }}>No records for this month.</div>}

                  </div>
                )}

                {activeTab === "Send Email" && (
                  <div id="item2">
                    <br />
                    <div className="row">
                         <div className="col-sm-1 col-xs-12">
                                  <b>  Month/Year :</b><span style={{ color: "red" }}>*</span>
                                  <input type="month" className="form-control text_box" style={{ width: "95%" }} value={emailMonthYear} onChange={e => setEmailMonthYear(e.target.value)} />
                              </div>
                          <div className="col-sm-2 col-xs-12">
                            <b>  Client Name :</b><span style={{ color: "red" }}>*</span>
                              <select className="form-control" value={client} onChange={e => { setClient(e.target.value); setState("Select"); setUnit("Select"); }}>
                                <option value="Select">Select</option>
                                {clients.map(c => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
                              </select>
                          </div>

                          <div className="col-sm-2 col-xs-12">
                              <b>Select State :</b>
                              <select className="form-control" value={state} onChange={e => { setState(e.target.value); setUnit("Select"); }}>
                                <option value="Select">Select</option>
                                {stateOpts.map((x) => <option key={x} value={x}>{x}</option>)}
                              </select>
                          </div>
                          <div className="col-sm-2 col-xs-12">
                              <b>Select Branch :</b>
                              <select className="form-control" value={unit} onChange={e => setUnit(e.target.value)}>
                                <option value="Select">Select</option>
                                {unitOpts.filter((u) => state === "Select" || u.state_name === state).map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
                              </select>
                          </div>
                     </div>
                     <br />
                     <div className="row">
                          <div className="col-sm-10 col-xs-12">
                              <br />
                              <button className="btn btn-primary" style={{ width: "15%", marginRight: "4px" }} onClick={btnSendEmail}>Salary Slip Email</button>
                              <button className="btn btn-primary" style={{ width: "15%", marginRight: "4px" }} onClick={btnEmailsNotSent}>Emails Not Sent</button>
                              <button className="btn btn-primary" style={{ width: "200px", marginRight: "4px" }} onClick={btnDownloadSalary}>Download Salary Slip</button>
                              <button className="btn btn-primary" style={{ width: "15%", marginRight: "4px" }} onClick={btnResend}>Resend Slip</button>
                          </div>
                    </div>
                    {notSent && (
                      <div style={{ overflowX: "auto", marginTop: "10px" }}>
                        <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff" }}>
                          <thead style={{ background: "#006699", color: "white" }}>
                            <tr><th>CLIENT</th><th>STATE</th><th>BRANCH</th><th>MONTH</th><th>YEAR</th><th>REASON</th><th></th><th></th></tr>
                          </thead>
                          <tbody>
                            {notSent.map((r, i) => (
                              <tr key={i}><td>{String(r.client ?? "")}</td><td>{String(r.state ?? "")}</td><td>{String(r.branch ?? "")}</td><td>{String(r.month ?? "")}</td><td>{String(r.year ?? "")}</td><td>{String(r.reason ?? "")}</td>
                                <td><a href="#" onClick={async (e) => { e.preventDefault(); const rr = await mk(`${SA}/resend_slip/`, { id: r.id }); const b = await rr.json().catch(() => ({} as any)); alert(b?.status || b?.detail || (Array.isArray(b) ? String(b[0]) : "") || (rr.ok ? "Done" : "Email Not Sent!!")); void btnEmailsNotSent(); }}>SEND EMAIL</a></td>
                                <td><a href="#" onClick={async (e) => { e.preventDefault(); const rr = await mk(`${SA}/delete_issue/`, { id: r.id }); if (!rr.ok) { const b = await rr.json().catch(() => ({} as any)); alert(b?.detail || (Array.isArray(b) ? String(b[0]) : "") || "Request failed."); } void btnEmailsNotSent(); }}>Delete</a></td></tr>
                            ))}
                            {notSent.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center" }}>No records.</td></tr>}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
                
              </div>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
