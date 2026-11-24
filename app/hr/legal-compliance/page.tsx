"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getJSON, mk } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

const B = "/api/hr/legal-compliance";

interface ClientOpt { client_code: string; client_name: string; }
interface UnitOpt { unit_code: string; unit_name: string; state_name: string; }
interface EmpOpt { emp_code: string; emp_name: string; }

export default function LegalCompliancePage() {
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [emps, setEmps] = useState<EmpOpt[]>([]);
  
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [unit, setUnit] = useState("Select");
  const [emp, setEmp] = useState("Select");
  
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [listOpen, setListOpen] = useState<{ title: string; rows: any[] } | null>(null);

  // the four count links open the grid behind them (gv_rem_emp_count / appro_emp_count / appro_emp_legal / reject_emp_legal)
  const openList = async (bucket: number, title: string) => {
    const qs = new URLSearchParams({ bucket: String(bucket) });
    if (client && client !== "Select") qs.set("client_code", client);
    if (state && state !== "Select") qs.set("state_name", state);
    const d = await getJSON<{ results: any[] }>(`${B}/count-list/?${qs.toString()}`);
    setListOpen({ title, rows: d?.results ?? [] });
  };

  // Legacy recomputes the four counts per selected client+state (chk_legal_document(comp,client,state,flag)).
  const loadCounts = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (client && client !== "Select") qs.set("client_code", client);
      if (state && state !== "Select") qs.set("state_name", state);
      const data = await getJSON<Record<string, number>>(`${B}/counts/?${qs.toString()}`);
      setCounts(data ?? {});
    } catch (e) { console.error(e); }
  }, [client, state]);

  useEffect(() => {
    getJSON<{ results: ClientOpt[] }>("/api/masters/clients/?page_size=all").then(d => setClients(d?.results ?? []));
  }, []);
  useEffect(() => { loadCounts(); }, [loadCounts]);

  useEffect(() => {
    if (!client || client === "Select") { 
      setStates([]); setUnits([]); setState("Select"); setUnit("Select"); setEmp("Select"); setEmps([]); 
      return; 
    }
    getJSON<{ units: UnitOpt[]; states: string[] }>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(client)}`).then((d) => {
      const rs = d?.units ?? [];
      setUnits(rs);
      setStates([...(d?.states ?? Array.from(new Set(rs.map(u => u.state_name).filter(Boolean))))].sort());
      setState("Select"); setUnit("Select"); setEmp("Select"); setEmps([]);
    });
  }, [client]);

  useEffect(() => {
    setUnit("Select"); setEmp("Select"); setEmps([]);
  }, [state]);

  useEffect(() => {
    if (!unit || unit === "Select") { setEmps([]); setEmp("Select"); return; }
    // Legacy fills the dropdown only with employees forwarded by admin (legal_flag != 0),
    // Permanent + not-left — exactly what the purpose-built list endpoint returns.
    const qs = new URLSearchParams({ unit_code: unit });
    if (client && client !== "Select") qs.set("client_code", client);
    getJSON<{ results: EmpOpt[] }>(`${B}/?${qs.toString()}`).then((d) => {
      const rs = d?.results ?? [];
      setEmps(rs);
      setEmp("Select");
      if (d && rs.length === 0) alert("This Branch Employee Can Not Approved By Admin!!.");
    });
  }, [unit, client]);

  const pickEmp = async (eCode: string) => {
    setEmp(eCode);
    setMsg("");
    if (!eCode || eCode === "Select") {
      setDetail(null);
      return;
    }
    try {
      // Purpose-built review payload (personal + masked KYC + statutory ids).
      const d = await getJSON<any>(`${B}/review/?emp_code=${encodeURIComponent(eCode)}`);
      setDetail(d ? d : null);
      setReason(d?.reject_reason && d.reject_reason !== "Approve By Leagal" ? d.reject_reason : "");
    } catch {
      setDetail(null);
    }
  };

  const validateReject = (): boolean => {
    if (!emp || emp === "Select") {
      alert("Employee Can Not Selected ..!!");
      return false;
    }
    if (!reason.trim()) {
      alert("Please Enter Reject Reason !!!");
      return false;
    }
    return confirm("Are you sure you want to Reject?");
  };

  const validateApprove = (): boolean => {
    if (!emp || emp === "Select") {
      alert("Employee Can Not Selected ..!!");
      return false;
    }
    return confirm("Are you Sure You Want to Approve Record");
  };

  const act = async (kind: "approve" | "reject") => {
    if (kind === "approve" && !validateApprove()) return;
    if (kind === "reject" && !validateReject()) return;

    setMsg(`Processing ${kind}...`);
    try {
      const r = await mk(`${B}/${kind}/`, { emp_code: emp, reject_reason: reason });
      const b = await r.json().catch(() => ({}));
      setMsg(r.ok ? (b.status ?? `Record ${kind} successfully!`) : (b.detail || (Array.isArray(b) ? String(b[0] ?? "") : "") || (b && typeof b === "object" ? String(Object.values(b)[0] ?? "") : "") || "Request failed."));
      if (r.ok) {
        loadCounts();
        setReason("");
        setEmp("Select");
        setDetail(null);
      }
    } catch (e) {
      setMsg("Error communicating with server.");
    }
  };

  // Safe getter for deeply nested properties (detail.kyc.aadhaar_no, detail.mobile_no)
  const docUrl = (type: string): string => {
    const u = detail?.documents?.[type] as string | undefined;
    if (!u) return "";
    return u.startsWith("http") ? u : `${API_BASE_URL}${u}`;
  };
  const DocCell = ({ type }: { type: string }) => {
    const u = docUrl(type);
    return u ? (
      <>
        <a href={u} target="_blank" rel="noreferrer"><img src={u} alt={type} width="100px" height="100px" style={{ objectFit: "cover" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /></a><br />
        <a className="btn btn-link" style={{ marginLeft: "24px" }} href={u} download target="_blank" rel="noreferrer">Download</a>
      </>
    ) : <span style={{ color: "#888" }}>Not uploaded</span>;
  };
  const exportCsv = async () => {
    if (!client || client === "Select") { alert("No Matching Records Found."); return; }
    try {
      const resp = await fetch(`${API_BASE_URL}${B}/export-excel/?client_code=${encodeURIComponent(client)}`, { credentials: "include" });
      const body = await resp.json().catch(() => null);
      if (!resp.ok) {
        // real reason from the server (DRF returns a list or {detail})
        alert((Array.isArray(body) ? String(body[0] ?? "") : body?.detail) || `No Matching Records Found. (server returned HTTP ${resp.status})`);
        return;
      }
      const d = body as { columns: string[]; rows: any[][]; filename: string } | null;
      if (!d || !d.rows || d.rows.length === 0) { alert("No Matching Records Found."); return; }
      const esc = (v: any) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const html = `<style> .textmode { } </style><table border=1><tr>${d.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>` +
        d.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") + "</table>";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" }));
      a.download = d.filename || "Employee_Details.xls";
      document.body.appendChild(a); a.click(); a.remove();
    } catch { alert("No Matching Records Found."); }
  };

  const getVal = (...keys: string[]) => {
    if (!detail) return "";
    for (const key of keys) {
      if (detail[key]) return detail[key];
      if (detail.kyc && detail.kyc[key]) return detail.kyc[key];
    }
    return "";
  };

  return (
    <>
      <link rel="stylesheet" href="https://maxcdn.bootstrapcdn.com/bootstrap/3.3.7/css/bootstrap.min.css" />
      <div className="container-fluid">
        <div className="panel panel-primary" style={{ backgroundColor: "white" }}>
        
        <div className="panel-heading">
          <div className="row">
            <div className="col-sm-1"></div>
            <div className="col-sm-9">
              <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase">
                <b>Legal/Compliances</b>
              </div>
            </div>
            <div className="col-sm-2 text-right">
              <Link href="#" onClick={(e) => { e.preventDefault(); }}>
                <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
              </Link>
            </div>
          </div>
        </div>
        
        <div className="panel-body">
          <div className="container-fluid" style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "25px 25px 25px 25px", marginBottom: "20px", marginTop: "20px" }}>
          <div className="row">
            <div id="dialog"></div>
            <div className="col-sm-1 col-xs-12"></div>
            
            <div className="col-sm-2 col-xs-12">
              <b> Client Name :</b>
              <select className="form-control" value={client} onChange={(e) => setClient(e.target.value)}>
                <option value="Select">Select</option>
                {clients.map(x => <option key={x.client_code} value={x.client_code}>{x.client_name}</option>)}
              </select>
            </div>
            
            <div className="col-sm-2 col-xs-12">
              <b> State Name :</b>
              <select className="form-control" value={state} onChange={(e) => setState(e.target.value)}>
                <option value="Select">Select</option>
                {states.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            
            <div className="col-sm-2 col-xs-12">
              <b> Branch Name :</b>
              <select className="form-control" value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="Select">Select</option>
                {units.filter(u => state === "Select" || u.state_name === state).map(x => <option key={x.unit_code} value={x.unit_code}>{x.unit_name}</option>)}
              </select>
            </div>
            
            <div className="col-sm-2 col-xs-12">
              <b> Employee Name :</b>
              <select className="form-control" value={emp} onChange={(e) => pickEmp(e.target.value)}>
                <option value="Select">Select</option>
                {emps.map(x => <option key={x.emp_code} value={x.emp_code}>{x.emp_code} - {x.emp_name}</option>)}
              </select>
            </div>

            <div className="col-sm-1 col-xs-12"></div>

            <div>
              <div className="col-sm-3 col-xs-12">
                <table className="table table-striped" border={1} style={{ borderColor: "#c7c5c5", background: "#fff", marginBottom: "0" }}>
                    <tbody>
                      <tr><th><a href="#" onClick={e => { e.preventDefault(); void openList(0, "Employee Not Approve By Admin"); }}><span style={{ color: "red" }}><b>{counts.rem_emp_count ?? 0}</b></span>Employee Not Approve By Admin </a></th></tr>
                      <tr><th><a href="#" onClick={e => { e.preventDefault(); void openList(1, "Employee Approve By Admin"); }}><span style={{ color: "red" }}><b>{counts.appro_emp_count ?? 0}</b></span>Employee Approve By Admin </a></th></tr>
                      <tr><th><a href="#" onClick={e => { e.preventDefault(); void openList(2, "Employee Approve By Legal"); }}><span style={{ color: "red" }}><b>{counts.appro_emp_legal ?? 0}</b></span>Employee Approve By Legal </a></th></tr>
                      <tr><th><a href="#" onClick={e => { e.preventDefault(); void openList(3, "Employee Reject By Legal"); }}><span style={{ color: "red" }}><b>{counts.reject_emp_legal ?? 0}</b></span>Employee Reject By Legal </a></th></tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <br />
            
            <div>
              {msg && <div style={{ color: "green", fontWeight: "bold", textAlign: "center", marginBottom: "15px", padding: "10px", background: "#dff0d8", border: "1px solid #d6e9c6", borderRadius: "4px" }}>{msg}</div>}
              
              <div className="row">
                <div className="col-sm-1 col-xs-12"></div>
                <div className="col-sm-2 col-xs-12">
                   <b>Employee Name :</b> 
                   <input className="form-control" readOnly value={getVal("emp_name")} />
                </div>
                <div className="col-sm-2 col-xs-12">
                   <b>Father Name :</b>
                   <input className="form-control" readOnly value={getVal("father_name")} />
                </div>
                <div className="col-sm-2 col-xs-12">
                  <b>Date Of Birth :</b>
                  <input className="form-control" readOnly value={getVal("dob")} />
                </div>
                <div className="col-sm-2 col-xs-12">
                    <b>Date Of Joining  :</b>
                    <input className="form-control" readOnly value={getVal("doj")} />
                </div>
                <div className="col-sm-2 col-xs-12">
                    <b>Gender  :</b>
                    <input className="form-control" readOnly value={getVal("gender")} />
                </div>
              </div>
              <br />
              <div className="row">
                <div className="col-sm-1 col-xs-12"></div>
                <div className="col-sm-2 col-xs-12">
                    Adhar Number :
                    <input className="form-control" readOnly value={getVal("aadhaar_masked", "aadhaar_no", "adhar_no")} />
                </div>
                <div className="col-sm-2 col-xs-12">
                    Account Holder Name :
                    <input className="form-control" readOnly value={getVal("account_holder", "account_holder_name", "bank_account_name")} />
                </div>
                <div className="col-sm-2 col-xs-12">
                    Bank Name :
                    <input className="form-control" readOnly value={getVal("bank_name")} />
                </div>
                <div className="col-sm-2 col-xs-12">
                    Bank Account Number :
                    <input className="form-control" readOnly value={getVal("bank_account_masked", "account_no", "bank_account_no")} />
                </div>
                <div className="col-sm-2 col-xs-12">
                    Bank IFSC Code :
                    <input className="form-control" readOnly value={getVal("ifsc_no", "ifsc_code", "bank_ifsc")} />
                </div>
              </div>
              <br />
              <div className="row">
                <div className="col-sm-1 col-xs-12"></div>
                <div className="col-sm-2 col-xs-12">
                    Mobile No  :
                    <input className="form-control" readOnly value={getVal("mobile_no")} />
                </div>
                <div className="col-sm-2 col-xs-12">
                    UAN Number :
                    <input className="form-control" readOnly value={getVal("uan_no", "uan_number")} />
                </div>
                <div className="col-sm-2 col-xs-12">
                    ESIC Number :
                    <input className="form-control" readOnly value={getVal("esic_no", "esic_number")} />
                </div>
                <div className="col-sm-2 col-xs-12">
                    PF Number :
                    <input className="form-control" readOnly value={getVal("pf_no", "pf_number")} />
                </div>
                <div className="col-sm-2 col-xs-12">
                    Designation :
                    <input className="form-control" readOnly value={getVal("designation")} />
                </div>
              </div>
              <br />
              <div className="row">
                <div className="col-sm-1 col-xs-12"></div>
                <div className="col-sm-2 col-xs-12">
                    Reject Reason :
                    <textarea className="form-control" style={{ height: "50px" }} value={reason} onChange={e => setReason(e.target.value)} />
                </div>
              </div>
              <br />
              <br />
              
              <div className="panel panel-primary">
                <div className="container-fluid">
                  <div className="row">
                      <br />
                      <div className="col-sm-1 col-xs-12"></div>
                      <div className="col-sm-2 col-xs-12">
                          Profile Photo(Passport Size) :<br />
                      </div>
                      <div className="col-sm-2 col-xs-12">
                          <DocCell type="Original Photo(Passport Size)" />
                      </div>
                      <div className="col-sm-1 col-xs-12">
                          Adhar Photo :<br />
                      </div>
                      <div className="col-sm-2 col-xs-12">
                          <DocCell type="Original Aadhar Card" />
                      </div>
                      <div className="col-sm-1 col-xs-12">
                          Bank Passbook:<br />
                      </div>
                      <div className="col-sm-2 col-xs-12">
                          <DocCell type="Bank Passbook" />
                      </div>
                  </div>
                  <hr />
                  <div className="row">
                      <div className="col-sm-1 col-xs-12"></div>
                      <div className="col-sm-2 col-xs-12">
                          <span style={{ marginLeft: "7em" }}>Joining Kit :</span><br />
                      </div>
                      <div className="col-sm-2 col-xs-12">
                          <DocCell type="emp_signature" />
                      </div>
                      <div className="col-sm-1 col-xs-12">
                          Address Proof Photo :<br />
                      </div>
                      <div className="col-sm-2 col-xs-12">
                          <DocCell type="original_Address_Proof" />
                      </div>
                      <div className="col-sm-1 col-xs-12">
                          Police Varification :<br />
                      </div>
                      <div className="col-sm-2 col-xs-12">
                          <DocCell type="original_police_document" />
                      </div>
                  </div>
                  <hr />
                  <div className="row">
                        <div className="col-sm-2 col-xs-12"></div>
                       <div className="col-sm-1 col-xs-12">
                          Pan Card :<br />
                      </div>
                      <div className="col-sm-2 col-xs-12">
                          <DocCell type="Pan Card" />
                      </div>
                  </div>
                  <br />
                </div>
                
                <div className="row text-center">
                  <button className="btn btn-primary" onClick={() => act("approve")}>Approve</button>&nbsp;
                  <button className="btn btn-primary" onClick={() => act("reject")}>Reject</button>&nbsp;
                  <button className="btn btn-primary" onClick={exportCsv} style={{ width: "200px" }}>Export Excel</button>
                </div>
                <br />
              </div>
            </div>

          </div>
        </div>
        </div>
      </div>
      {listOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000 }} onClick={() => setListOpen(null)}>
          <div style={{ background: "#fff", maxWidth: 800, margin: "60px auto", padding: 16, borderRadius: 6, maxHeight: "80vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
            <h4 style={{ textAlign: "center" }}>{listOpen.title}</h4>
            <table className="table table-striped" border={1}>
              <thead><tr><th>Client Name</th><th>State Name</th><th>Branch Name</th><th>Employee Name</th></tr></thead>
              <tbody>
                {listOpen.rows.map((r, i) => <tr key={i}><td>{r.client_name}</td><td>{r.state_name}</td><td>{r.branch_name}</td><td>{r.emp_name}</td></tr>)}
                {listOpen.rows.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center" }}>No records</td></tr>}
              </tbody>
            </table>
            <div className="text-center"><button type="button" className="btn btn-danger" onClick={() => setListOpen(null)}>CLOSE</button></div>
          </div>
        </div>
      )}
    </>
  );
}
