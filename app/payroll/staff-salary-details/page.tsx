"use client";
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getJSON, mk } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

// 1:1 port of staff_salary_details.aspx ("Staff Employee Salary"). Client/Unit/Employee cascade,
// 15 earning + 5 lumpsum + 10 deduction heads (earning labels from the salary structure),
// PF/ESIC/LWF flags, saved-records grid with row-select edit, and the monthly Salary Calculation.
const B = "/api/payroll/staff-salary-details";
const HEADS = Array.from({ length: 15 }, (_, i) => `head${i + 1}`);
const LHEADS = Array.from({ length: 5 }, (_, i) => `lhead${i + 1}`);
const DHEADS = Array.from({ length: 10 }, (_, i) => `dhead${i + 1}`);
const zero = (ks: string[]) => Object.fromEntries(ks.map((k) => [k, "0"]));

interface ClientOpt { client_code: string; client_name: string; }
interface UnitOpt { unit_code: string; unit_name: string; }
interface EmpOpt { emp_code: string; emp_name: string; }
type SMap = Record<string, string>;

const inp: React.CSSProperties = { width: "100%", height: "34px", borderRadius: "4px", border: "1px solid #ccc" };
const sect: React.CSSProperties = { background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "20px", marginBottom: "20px" };
const btn: React.CSSProperties = { background: "#337ab7", color: "#fff", border: "1px solid #2e6da4", padding: "6px 20px", borderRadius: "4px", marginRight: "8px" };

export default function StaffSalaryDetailsPage() {
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [emps, setEmps] = useState<EmpOpt[]>([]);
  const [client, setClient] = useState("Select");
  const [unit, setUnit] = useState("Select");
  const [emp, setEmp] = useState("Select");
  const [empName, setEmpName] = useState("");
  const [job, setJob] = useState("Select");
  const [status, setStatus] = useState("Select");
  const [ctc, setCtc] = useState("0");

  const [heads, setHeads] = useState<SMap>(() => zero(HEADS));
  const [lheads, setLheads] = useState<SMap>(() => zero(LHEADS));
  const [dheads, setDheads] = useState<SMap>(() => zero(DHEADS));
  const [labels, setLabels] = useState<SMap>({});
  const [monthTotal, setMonthTotal] = useState("0");

  const [pfE, setPfE] = useState("Select");
  const [pfR, setPfR] = useState("Select");
  const [esicE, setEsicE] = useState("Select");
  const [esicR, setEsicR] = useState("Select");
  const [lwf, setLwf] = useState("Select");
  const [lwfMA, setLwfMA] = useState("Select");

  const [rows, setRows] = useState<SMap[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState<"item1" | "item2">("item1");

  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [proc, setProc] = useState<SMap[]>([]);
  const [procMsg, setProcMsg] = useState("");
  const [saved, setSaved] = useState<SMap[]>([]);
  const [savedLabels, setSavedLabels] = useState<SMap>({});

  useEffect(() => {
    getJSON<{ results: ClientOpt[] }>("/api/masters/clients/?page_size=all")
      // legacy client_list(): only client_code = 'staff'
      .then((d) => setClients((d?.results ?? []).filter((c) => (c.client_code || "").toLowerCase() === "staff"))).catch(() => {});
  }, []);
  useEffect(() => {
    if (!client || client === "Select") { setUnits([]); return; }
    getJSON<{ units: UnitOpt[] }>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(client)}`)
      .then((d) => setUnits(d?.units ?? [])).catch(() => {});
  }, [client]);

  const loadGrid = useCallback(async () => {
    if (!unit || unit === "Select") { setRows([]); return; }
    const d = await getJSON<{ results: SMap[] }>(`${B}/?unit_code=${encodeURIComponent(unit)}`).catch(() => null);
    setRows(d?.results ?? []);
  }, [unit]);

  useEffect(() => {
    if (!unit || unit === "Select") { setEmps([]); setRows([]); return; }
    getJSON<{ employees: EmpOpt[] }>(`/api/hr/employees/lookup/?unit_code=${encodeURIComponent(unit)}`)
      .then((d) => setEmps(d?.employees ?? [])).catch(() => {});
    loadGrid();
  }, [unit, loadGrid]);

  const loadSaved = useCallback(async () => {
    if (!unit || unit === "Select") { setSaved([]); return; }
    const d = await getJSON<{ results: SMap[]; labels: SMap }>(`${B}/pro_list/?unit_code=${encodeURIComponent(unit)}`).catch(() => null);
    setSaved(d?.results ?? []); setSavedLabels(d?.labels ?? {});
  }, [unit]);
  useEffect(() => { loadSaved(); }, [loadSaved]);

  const pickEmp = (code: string) => {
    setEmp(code);
    setEmpName(emps.find((e) => e.emp_code === code)?.emp_name ?? "");
  };

  const calculate = async () => {
    if (!unit || unit === "Select") { alert("Please select unit name !!!"); return; }
    if (!ctc || ctc === "0") { alert("Please Enter Amount !!"); return; }
    const d = await getJSON<{ heads: SMap; labels: SMap; month_total: string }>(
      `${B}/calculate/?unit_code=${encodeURIComponent(unit)}&ctc_amount=${encodeURIComponent(ctc)}`).catch(() => null);
    if (d) { setHeads({ ...zero(HEADS), ...d.heads }); setLabels(d.labels ?? {}); setMonthTotal(d.month_total); }
  };

  const validateSave = (): string | null => {
    if (client === "Select") return "Please select client name !!!";
    if (unit === "Select") return "Please select unit name !!!";
    if (emp === "Select") return "Please Select Employee !!";
    if (job === "Select") return "Please Select Jobtype !!";
    if (status === "Select") return "Please Select Employee Status !!";
    if (!ctc || ctc === "0") return "Please Enter Amount !!";
    return null;
  };

  const payload = () => ({
    client_code: client, unit_code: unit, emp_code: emp, emp_name: empName || emp,
    job_type: job, status, ctc_amount: ctc, heads, month_total: monthTotal,
    ...lheads, ...dheads,
    pf_employee_flag: pfE, pf_employer_flag: pfR, esic_employee_flag: esicE,
    esic_employer_flag: esicR, lwf_flag: lwf, lwf_month_act: lwfMA,
  });

  const clear = () => {
    setEmp("Select"); setEmpName(""); setJob("Select"); setStatus("Select"); setCtc("0");
    setHeads(zero(HEADS)); setLheads(zero(LHEADS)); setDheads(zero(DHEADS)); setLabels({}); setMonthTotal("0");
    setPfE("Select"); setPfR("Select"); setEsicE("Select"); setEsicR("Select"); setLwf("Select"); setLwfMA("Select");
    setEditMode(false);
  };

  const save = async () => {
    const e = validateSave(); if (e) { alert(e); return; }
    const r = await mk(`${B}/save/`, payload());
    const b = await r.json().catch(() => ({} as SMap));
    if (r.ok) { alert(b.status ?? "Record added successfully!!"); setMsg(b.status ?? ""); clear(); loadGrid(); }
    else alert(b.detail || JSON.stringify(b));
  };
  const update = async () => {
    const e = validateSave(); if (e) { alert(e); return; }
    const r = await mk(`${B}/update_detail/`, payload());
    const b = await r.json().catch(() => ({} as SMap));
    if (r.ok) { alert(b.status ?? "Update Successfully !!"); setMsg(b.status ?? ""); clear(); loadGrid(); }
    else alert(b.detail || JSON.stringify(b));
  };

  const selectRow = (row: SMap) => {
    setEmp(row.emp_code); setEmpName(row.emp_name || ""); setJob(row.job_type || "Select");
    setStatus(row.status || "Select"); setCtc(String(row.ctc_amount || "0"));
    setHeads(Object.fromEntries(HEADS.map((h) => [h, String(row[h] ?? "0")])));
    setLheads(Object.fromEntries(LHEADS.map((h) => [h, String(row[h] ?? "0")])));
    setDheads(Object.fromEntries(DHEADS.map((h) => [h, String(row[h] ?? "0")])));
    setMonthTotal(String(row.month_total || "0"));
    setPfE(row.pf_employee_flag || "Select"); setPfR(row.pf_employer_flag || "Select");
    setEsicE(row.esic_employee_flag || "Select"); setEsicR(row.esic_employer_flag || "Select");
    setLwf(row.lwf_flag || "Select"); setLwfMA(row.lwf_month_act || "Select");
    setEditMode(true); setTab("item1");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const runProcess = async () => {
    if (client === "Select") { alert("Please select client name !!!"); return; }
    if (unit === "Select") { alert("Please select unit name !!!"); return; }
    if (!month || !year) { alert("Please select month year !!!"); return; }
    const r = await mk(`${B}/process/`, { unit_code: unit, month, year });
    const b = await r.json().catch(() => ({} as SMap & { results?: SMap[] }));
    setProcMsg((b as SMap).status ?? ((b as SMap).detail || JSON.stringify(b)));
    setProc((b as { results?: SMap[] }).results ?? []);
    if (r.ok) loadSaved();
  };
  const salaryPdf = () => {
    if (client === "Select") { alert("Please select client name !!!"); return; }
    if (unit === "Select") { alert("Please select unit name !!!"); return; }
    if (!month || !year) { alert("Please select month year !!!"); return; }
    window.open(`${API_BASE_URL}${B}/salary_pdf/?unit_code=${encodeURIComponent(unit)}&month=${month}&year=${year}${emp !== "Select" ? `&emp_code=${encodeURIComponent(emp)}` : ""}`, "_blank");
  };

  const headCell = (map: SMap, setMap: (m: SMap) => void, key: string, label: string) => (
    <div key={key} style={{ flex: "1 1 160px", maxWidth: "200px" }}>
      <b>{label} :</b>
      <input type="text" className="form-control" value={map[key]}
        onChange={(e) => setMap({ ...map, [key]: e.target.value.replace(/[^0-9.]/g, "") })} style={inp} />
    </div>
  );
  const ynSel = (val: string, set: (v: string) => void) => (
    <select className="form-control" value={val} onChange={(e) => set(e.target.value)} style={inp}>
      <option value="Select">Select</option><option value="yes">Yes</option><option value="no">No</option>
    </select>
  );

  return (
    <section style={{ padding: "15px" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #337ab7", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#337ab7", color: "#fff", padding: "10px 15px", textAlign: "center" }}>
          <b>STAFF EMPLOYEE SALARY</b>
        </div>
        <div className="panel-body" style={{ padding: "20px" }}>
          {msg && <div style={{ color: "green", fontWeight: "bold", textAlign: "center", marginBottom: "15px" }}>{msg}</div>}

          {/* top: client + unit cascade (outside tabs) */}
          <div style={sect}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 220px" }}>
                <b>Client Name:</b><span style={{ color: "red" }}> * </span>
                <select className="form-control" value={client} onChange={(e) => { setClient(e.target.value); setUnit("Select"); setEmp("Select"); }} style={inp}>
                  <option value="Select">Select</option>
                  {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 220px" }}>
                <b>Unit Name:</b><span style={{ color: "red" }}> * </span>
                <select className="form-control" value={unit} onChange={(e) => { setUnit(e.target.value); setEmp("Select"); }} style={inp}>
                  <option value="Select">Select</option>
                  {units.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* tabs */}
          <div style={{ display: "flex", borderBottom: "1px solid #ccc", marginBottom: "15px" }}>
            {([["item1", "Employee Salary Details"], ["item2", "Salary Calculations"]] as const).map(([k, t]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                background: tab === k ? "#fff" : "#424D7A", color: tab === k ? "#333" : "#fff",
                border: "1px solid #ccc", borderBottom: tab === k ? "1px solid #fff" : "1px solid #ccc",
                padding: "10px 15px", cursor: "pointer", fontWeight: tab === k ? "bold" : "normal",
                borderRadius: "4px 4px 0 0", marginRight: "2px",
              }}>{t}</button>
            ))}
          </div>

          {tab === "item1" && (
            <>
              <div style={sect}>
                <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <b>Employee List:</b>
                    <select className="form-control" value={emp} onChange={(e) => pickEmp(e.target.value)} style={inp} disabled={editMode}>
                      <option value="Select">Select</option>
                      {emps.map((x) => <option key={x.emp_code} value={x.emp_code}>{x.emp_code} - {x.emp_name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: "1 1 160px" }}>
                    <b>Job Type</b>
                    <select className="form-control" value={job} onChange={(e) => setJob(e.target.value)} style={inp}>
                      <option value="Select">Select</option><option value="permanent">Permanent</option><option value="contract">Contract</option>
                    </select>
                  </div>
                  <div style={{ flex: "1 1 160px" }}>
                    <b>Status</b>
                    <select className="form-control" value={status} onChange={(e) => setStatus(e.target.value)} style={inp}>
                      <option value="Select">Select</option><option value="monthly">Monthly</option><option value="daily">Daily</option>
                    </select>
                  </div>
                  <div style={{ flex: "1 1 160px" }}>
                    <b>CTC(Annual Income)</b>
                    <input type="text" className="form-control" value={ctc} onChange={(e) => setCtc(e.target.value.replace(/[^0-9.]/g, ""))} onBlur={() => { if (ctc && ctc !== "0") calculate(); }} style={inp} />
                  </div>
                  <div style={{ flex: "0 0 auto" }}>
                    <button className="btn btn-primary" onClick={calculate} style={btn}>Calculate</button>
                  </div>
                </div>
              </div>

              <div style={sect}>
                <h4 style={{ color: "#337ab7", borderBottom: "1px solid #ccc", paddingBottom: "8px" }}>Earning Heads</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "15px" }}>
                  {HEADS.map((h, i) => headCell(heads, setHeads, h, labels[h] || `Head${i + 1}`))}
                  <div style={{ flex: "1 1 160px", maxWidth: "200px" }}>
                    <b>Total :</b>
                    <input type="text" className="form-control" value={monthTotal} onChange={(e) => setMonthTotal(e.target.value.replace(/[^0-9.]/g, ""))} style={{ ...inp, fontWeight: "bold", color: "green" }} />
                  </div>
                </div>
              </div>

              <div style={sect}>
                <h4 style={{ color: "#337ab7", borderBottom: "1px solid #ccc", paddingBottom: "8px" }}>Lumpsum Heads</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "15px" }}>
                  {LHEADS.map((h, i) => headCell(lheads, setLheads, h, `Lumpsum${i + 1}`))}
                </div>
              </div>

              <div style={sect}>
                <h4 style={{ color: "#337ab7", borderBottom: "1px solid #ccc", paddingBottom: "8px" }}>Deduction Heads</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "15px" }}>
                  {DHEADS.map((h, i) => headCell(dheads, setDheads, h, `Deduction${i + 1}`))}
                </div>
              </div>

              <div style={sect}>
                <h4 style={{ color: "#337ab7", borderBottom: "1px solid #ccc", paddingBottom: "8px" }}>Tax Deductions</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "15px" }}>
                  <div style={{ flex: "1 1 160px", maxWidth: "200px" }}><b>PF Employee :</b>{ynSel(pfE, setPfE)}</div>
                  <div style={{ flex: "1 1 160px", maxWidth: "200px" }}><b>PF Employer :</b>{ynSel(pfR, setPfR)}</div>
                  <div style={{ flex: "1 1 160px", maxWidth: "200px" }}><b>ESIC Employee :</b>{ynSel(esicE, setEsicE)}</div>
                  <div style={{ flex: "1 1 160px", maxWidth: "200px" }}><b>ESIC Employer :</b>{ynSel(esicR, setEsicR)}</div>
                  <div style={{ flex: "1 1 160px", maxWidth: "200px" }}><b>LWF :</b>{ynSel(lwf, setLwf)}</div>
                  <div style={{ flex: "1 1 160px", maxWidth: "200px" }}>
                    <b>LWF Monthly/Actual :</b>
                    <select className="form-control" value={lwfMA} onChange={(e) => setLwfMA(e.target.value)} style={inp}>
                      <option value="Select">Select</option><option value="Monthly">Monthly</option><option value="Actual">Actual</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                {!editMode && <button className="btn btn-primary" onClick={save} style={btn}>Save</button>}
                {editMode && <button className="btn btn-primary" onClick={update} style={btn}>Update</button>}
                <button className="btn btn-primary" onClick={clear} style={btn}>Clear</button>
                <Link href="/" className="btn btn-danger" style={{ ...btn, background: "#d9534f", border: "1px solid #d43f3a", textDecoration: "none", display: "inline-block" }}>Close</Link>
              </div>

              {/* saved records grid */}
              <div style={{ overflowX: "auto" }}>
                <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff", border: "1px solid #ddd" }}>
                  <thead style={{ background: "#224173", color: "white" }}>
                    <tr><th style={{ padding: "8px" }}>Sr No.</th><th style={{ padding: "8px" }}>EMP CODE</th><th style={{ padding: "8px" }}>EMP NAME</th><th style={{ padding: "8px" }}>JOB TYPE</th><th style={{ padding: "8px" }}>STATUS</th><th style={{ padding: "8px" }}>CTC</th><th style={{ padding: "8px" }}>TOTAL</th><th style={{ padding: "8px" }}>EDIT</th></tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.emp_code}>
                        <td style={{ padding: "8px" }}>{i + 1}</td><td style={{ padding: "8px" }}>{r.emp_code}</td>
                        <td style={{ padding: "8px" }}>{r.emp_name}</td><td style={{ padding: "8px" }}>{r.job_type}</td>
                        <td style={{ padding: "8px" }}>{r.status}</td><td style={{ padding: "8px" }}>{r.ctc_amount}</td>
                        <td style={{ padding: "8px" }}>{r.month_total}</td>
                        <td style={{ padding: "8px" }}><button className="btn btn-primary btn-xs" onClick={() => selectRow(r)}>Edit</button></td>
                      </tr>
                    ))}
                    {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "#777", padding: "10px" }}>No records</td></tr>}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "item2" && (
            <div style={sect}>
              <h4 style={{ color: "#337ab7", borderBottom: "1px solid #ccc", paddingBottom: "8px" }}>Salary Calculations</h4>
              <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end" }}>
                <div style={{ flex: "1 1 180px", maxWidth: "240px" }}>
                  <b>Month/Year :</b><span style={{ color: "red" }}> * </span>
                  <input type="month" className="form-control" value={year && month ? `${year}-${month.padStart(2, "0")}` : ""}
                    onChange={(e) => { if (e.target.value) { const [y, m] = e.target.value.split("-"); setYear(y); setMonth(parseInt(m, 10).toString()); } else { setYear(""); setMonth(""); } }} style={inp} />
                </div>
                <div style={{ flex: "0 0 auto" }}>
                  <button className="btn btn-primary" onClick={runProcess} style={btn}>Salary Calculation</button>
                  <button className="btn btn-primary" onClick={salaryPdf} style={btn}>Salary PDF</button>
                </div>
              </div>
              {procMsg && <div style={{ color: "green", fontWeight: "bold", margin: "12px 0" }}>{procMsg}</div>}
              {proc.length > 0 && (
                <div style={{ marginTop: "15px", overflowX: "auto" }}>
                  <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff", border: "1px solid #ddd", fontSize: "12px" }}>
                    <thead style={{ background: "#006699", color: "white" }}>
                      <tr>
                        <th style={{ padding: "6px" }}>EMP CODE</th><th style={{ padding: "6px" }}>EMP NAME</th>
                        <th style={{ padding: "6px" }}>PRESENT</th><th style={{ padding: "6px" }}>DAYS</th>
                        <th style={{ padding: "6px" }}>EARNINGS</th><th style={{ padding: "6px" }}>PF (E)</th>
                        <th style={{ padding: "6px" }}>PF (R)</th><th style={{ padding: "6px" }}>ESIC (E)</th>
                        <th style={{ padding: "6px" }}>ESIC (R)</th><th style={{ padding: "6px" }}>PT</th>
                        <th style={{ padding: "6px" }}>LWF</th><th style={{ padding: "6px" }}>ADVANCE</th>
                        <th style={{ padding: "6px" }}>NET SALARY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proc.map((p, i) => (
                        <tr key={i}>
                          <td style={{ padding: "6px" }}>{p.emp_code}</td><td style={{ padding: "6px" }}>{p.emp_name}</td>
                          <td style={{ padding: "6px" }}>{p.present_days}</td><td style={{ padding: "6px" }}>{p.month_days}</td>
                          <td style={{ padding: "6px" }}>{p.tot_earnings}</td><td style={{ padding: "6px" }}>{p.pf_employee}</td>
                          <td style={{ padding: "6px" }}>{p.pf_employer}</td><td style={{ padding: "6px" }}>{p.esic_employee}</td>
                          <td style={{ padding: "6px" }}>{p.esic_employer}</td><td style={{ padding: "6px" }}>{p.professional_tax}</td>
                          <td style={{ padding: "6px" }}>{p.lwf}</td><td style={{ padding: "6px" }}>{p.advance_payment}</td>
                          <td style={{ padding: "6px", fontWeight: "bold" }}>{p.net_salary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {saved.length > 0 && (
                <div style={{ marginTop: "15px", overflowX: "auto" }}>
                  <h5 style={{ color: "#337ab7" }}>Saved salary calculations</h5>
                  <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff", border: "1px solid #ddd", fontSize: "12px" }}>
                    <thead style={{ background: "#006699", color: "white" }}>
                      <tr>
                        <th style={{ padding: "6px" }}>MONTH</th><th style={{ padding: "6px" }}>EMP CODE</th><th style={{ padding: "6px" }}>EMP NAME</th>
                        <th style={{ padding: "6px" }}>PRESENT</th>
                        {HEADS.filter((h) => savedLabels[h]).map((h) => <th key={h} style={{ padding: "6px" }}>{savedLabels[h]}</th>)}
                        <th style={{ padding: "6px" }}>EARNINGS</th><th style={{ padding: "6px" }}>PF (E)</th><th style={{ padding: "6px" }}>ESIC (E)</th>
                        <th style={{ padding: "6px" }}>PT</th><th style={{ padding: "6px" }}>LWF</th><th style={{ padding: "6px" }}>ADVANCE</th><th style={{ padding: "6px" }}>NET SALARY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {saved.map((p, i) => (
                        <tr key={i}>
                          <td style={{ padding: "6px" }}>{p.month}/{p.year}</td><td style={{ padding: "6px" }}>{p.emp_code}</td><td style={{ padding: "6px" }}>{p.emp_name}</td>
                          <td style={{ padding: "6px" }}>{p.present_days}</td>
                          {HEADS.filter((h) => savedLabels[h]).map((h, k) => <td key={h} style={{ padding: "6px" }}>{p[`de_head${HEADS.indexOf(h) + 1}`]}</td>)}
                          <td style={{ padding: "6px" }}>{p.tot_earnings}</td><td style={{ padding: "6px" }}>{p.pf_employee}</td><td style={{ padding: "6px" }}>{p.esic_employee}</td>
                          <td style={{ padding: "6px" }}>{p.professional_tax}</td><td style={{ padding: "6px" }}>{p.lwf}</td><td style={{ padding: "6px" }}>{p.advance_payment}</td>
                          <td style={{ padding: "6px", fontWeight: "bold" }}>{p.net_salary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <div style={{ textAlign: "center", marginTop: "20px" }}>
                <Link href="/" className="btn btn-danger" style={{ ...btn, background: "#d9534f", border: "1px solid #d43f3a", textDecoration: "none", display: "inline-block" }}>Close</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
