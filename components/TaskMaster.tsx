"use client";

/*
 * Task Master — 1:1 port of legacy task_master.aspx (+ task_master.aspx.cs).
 * Read-only 6-tab deployment/compliance dashboard. Tabs, labels (legacy typos kept:
 * "Brach Name", "No Of Diployed Employee"), cascades, grid columns, Done/Pending colouring,
 * Search validations and panel visibility all reproduced from the legacy source.
 * Data comes from /api/masters/task-master (real legacy SQL; no mock, no placeholder).
 */
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getJSON, mk } from "@/lib/api/legacy-fetch";

const BASE = "/api/masters/task-master";
type Opt = { v: string; t: string };
type Row = Record<string, unknown>;

const DONE = "#adff2f";   // legacy Color.GreenYellow
const PEND = "#ff0000";   // legacy Color.Red

async function tmGet<T = any>(path: string): Promise<T | null> {
  return getJSON<T>(`${BASE}/${path}`);
}

// Done/Pending cell (legacy RowDataBound): empty -> "Pending" (red), else "Done" (green).
function StatusCell({ value }: { value: unknown }) {
  const filled = value !== null && value !== undefined && String(value).trim() !== "";
  return (
    <td style={{ background: filled ? DONE : PEND, textAlign: "center", border: "1px solid #ddd", padding: "6px" }}>
      {filled ? "Done" : "Pending"}
    </td>
  );
}

interface Panels { client: boolean; branch: boolean; employee: boolean; billing: boolean; salary: boolean; compliances: boolean; }
type TabKey = "client" | "branch" | "employee" | "billing" | "salary" | "compliances";
const TAB_LABEL: Record<TabKey, string> = {
  client: "Client", branch: "Branch/Location", employee: "Employee",
  billing: "Billing", salary: "Salary", compliances: "Employee Compliances",
};
const TAB_ORDER: TabKey[] = ["client", "branch", "employee", "billing", "salary", "compliances"];

export default function TaskMaster() {
  const [panels, setPanels] = useState<Panels | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("client");
  const [clients, setClients] = useState<Opt[]>([]);

  // --- Tab 1: Client ---
  const [c1Client, setC1Client] = useState("Select");
  const [c1, setC1] = useState<{ address: string; total_employee: string; deployed: string; difference: string; designation: Row[]; pending: Row } | null>(null);

  // --- Tab 2: Branch/Location ---
  const [c2Client, setC2Client] = useState("Select");
  const [c2States, setC2States] = useState<string[]>([]);
  const [c2State, setC2State] = useState("Select");
  const [c2Branches, setC2Branches] = useState<Opt[]>([]);
  const [c2Branch, setC2Branch] = useState("Select");
  const [c2Heads, setC2Heads] = useState({ admin: "", operation: "", finance: "" });
  const [c2Loc, setC2Loc] = useState<Row[]>([]);
  const [c2Pending, setC2Pending] = useState<Row[]>([]);

  // --- Tab 3: Employee ---
  const [c3Client, setC3Client] = useState("Select");
  const [c3States, setC3States] = useState<string[]>([]);
  const [c3State, setC3State] = useState("Select");
  const [c3Branches, setC3Branches] = useState<Opt[]>([]);
  const [c3Branch, setC3Branch] = useState("Select");
  const [c3Heads, setC3Heads] = useState({ admin: "", operation: "", finance: "" });
  const [c3Grid, setC3Grid] = useState<Row[]>([]);

  // --- Tab 4: Billing ---
  const [c4Client, setC4Client] = useState("Select");
  const [c4States, setC4States] = useState<string[]>([]);
  const [c4State, setC4State] = useState("Select");
  const [c4Date, setC4Date] = useState("");
  const [c4Sub, setC4Sub] = useState<"attendance" | "policy">("attendance");
  const [c4Att, setC4Att] = useState<Row[]>([]);
  const [c4Pol, setC4Pol] = useState<Row[]>([]);

  // --- Tab 5: Salary ---
  const [c5Client, setC5Client] = useState("Select");
  const [c5States, setC5States] = useState<string[]>([]);
  const [c5State, setC5State] = useState("Select");
  const [c5Date, setC5Date] = useState("");
  const [c5Grid, setC5Grid] = useState<Row[]>([]);
  const [c5NotProcess, setC5NotProcess] = useState<string[]>([]);

  // --- Tab 6: Employee Compliances ---
  const [c6Client, setC6Client] = useState("Select");
  const [c6States, setC6States] = useState<string[]>([]);
  const [c6State, setC6State] = useState("Select");
  const [c6Branches, setC6Branches] = useState<Opt[]>([]);
  const [c6Branch, setC6Branch] = useState("Select");
  const [c6Heads, setC6Heads] = useState({ admin: "", operation: "", finance: "" });
  const [c6Grid, setC6Grid] = useState<Row[]>([]);

  const loadPaymentGrid = useCallback(async () => {
    const d = await tmGet<{ results: Row[] }>("payment_history_grid/");
    setC5Grid(d?.results ?? []);
  }, []);

  useEffect(() => {
    tmGet<Panels>("panels/").then((p) => {
      if (p) { setPanels(p); setActiveTab(TAB_ORDER.find((t) => p[t]) ?? "employee"); }
    });
    tmGet<{ results: Opt[] }>("clients/").then((d) => setClients(d?.results ?? []));
    loadPaymentGrid();
  }, [loadPaymentGrid]);

  // ===== Tab 1 cascade =====
  const onC1Client = async (v: string) => {
    setC1Client(v);
    if (!v || v === "Select") { setC1(null); return; }
    setC1(await tmGet(`client_summary/?client=${encodeURIComponent(v)}`));
  };

  // ===== Tab 2 cascade =====
  const onC2Client = async (v: string) => {
    setC2Client(v); setC2State("Select"); setC2Branch("Select"); setC2Branches([]);
    setC2Heads({ admin: "", operation: "", finance: "" }); setC2Loc([]); setC2Pending([]);
    const d = v && v !== "Select" ? await tmGet<{ results: string[] }>(`branch_states/?client=${encodeURIComponent(v)}`) : null;
    setC2States(d?.results ?? []);
  };
  const onC2State = async (v: string) => {
    setC2State(v); setC2Branch("Select"); setC2Heads({ admin: "", operation: "", finance: "" });
    if (!v || v === "Select") { setC2Branches([]); setC2Loc([]); setC2Pending([]); return; }
    const [b, loc, pend] = await Promise.all([
      tmGet<{ results: Opt[] }>(`branches/?client=${encodeURIComponent(c2Client)}&state=${encodeURIComponent(v)}`),
      tmGet<{ results: Row[] }>(`branch_location_grid/?client=${encodeURIComponent(c2Client)}&state=${encodeURIComponent(v)}`),
      tmGet<{ results: Row[] }>(`branch_pending_grid/?client=${encodeURIComponent(c2Client)}&state=${encodeURIComponent(v)}`),
    ]);
    setC2Branches(b?.results ?? []); setC2Loc(loc?.results ?? []); setC2Pending(pend?.results ?? []);
  };
  const onC2Branch = async (v: string) => {
    setC2Branch(v);
    setC2Heads(v && v !== "Select" ? (await tmGet(`heads/?unit=${encodeURIComponent(v)}`)) ?? { admin: "", operation: "", finance: "" } : { admin: "", operation: "", finance: "" });
  };

  // ===== Tab 3 cascade =====
  const onC3Client = async (v: string) => {
    setC3Client(v); setC3State("Select"); setC3Branch("Select"); setC3Branches([]); setC3Grid([]);
    setC3Heads({ admin: "", operation: "", finance: "" });
    const d = v && v !== "Select" ? await tmGet<{ results: string[] }>(`emp_states/?client=${encodeURIComponent(v)}`) : null;
    setC3States(d?.results ?? []);
  };
  const onC3State = async (v: string) => {
    setC3State(v); setC3Branch("Select"); setC3Grid([]);
    const d = v && v !== "Select" ? await tmGet<{ results: Opt[] }>(`emp_branches/?client=${encodeURIComponent(c3Client)}&state=${encodeURIComponent(v)}`) : null;
    setC3Branches(d?.results ?? []);
  };
  const onC3Branch = async (v: string) => {
    setC3Branch(v);
    if (!v || v === "Select") { setC3Grid([]); setC3Heads({ admin: "", operation: "", finance: "" }); return; }
    const [h, g] = await Promise.all([
      tmGet<{ admin: string; operation: string; finance: string }>(`heads/?unit=${encodeURIComponent(v)}`),
      tmGet<{ results: Row[] }>(`employee_grid/?unit=${encodeURIComponent(v)}`),
    ]);
    setC3Heads(h ?? { admin: "", operation: "", finance: "" });
    const rows = g?.results ?? [];
    if (rows.length === 0) alert("No Record Found !!!");   // legacy emp_namee=="" guard
    setC3Grid(rows);
  };

  // ===== Tab 4 (Billing) =====
  const onC4Client = async (v: string) => {
    setC4Client(v); setC4State("Select"); setC4Att([]); setC4Pol([]);
    const d = v && v !== "Select" ? await tmGet<{ results: string[] }>(`billing_states/?client=${encodeURIComponent(v)}`) : null;
    setC4States(d?.results ?? []);
  };
  const onC4Search = async () => {
    // legacy validation()
    if (!c4Client || c4Client === "Select") { alert("Please Select Client Name"); return; }
    if (!c4State || c4State === "Select") { alert("Please Select State Name"); return; }
    if (!c4Date) { alert("Please Select Date"); return; }
    const q = `client=${encodeURIComponent(c4Client)}&state=${encodeURIComponent(c4State)}&date=${encodeURIComponent(c4Date)}`;
    const [att, pol] = await Promise.all([
      tmGet<{ results: Row[]; message: string }>(`attendance_remaining/?${q}`),
      tmGet<{ results: Row[] }>(`policy_remaining/?client=${encodeURIComponent(c4Client)}&state=${encodeURIComponent(c4State)}`),
    ]);
    setC4Att(att?.results ?? []); setC4Pol(pol?.results ?? []);
    if (c4Sub === "attendance" && (att?.results ?? []).length === 0) alert("No Record Found !!!");
  };

  // ===== Tab 5 (Salary) =====
  const onC5Client = async (v: string) => {
    setC5Client(v); setC5State("Select"); setC5NotProcess([]);
    const d = v && v !== "Select" ? await tmGet<{ results: string[] }>(`salary_states/?client=${encodeURIComponent(v)}`) : null;
    setC5States(d?.results ?? []);
  };
  const onC5Search = async () => {
    // legacy R_validation()
    if (!c5Client || c5Client === "Select") { alert("Please Select Client Name"); return; }
    if (!c5State || c5State === "Select") { alert("Please Select State Name"); return; }
    if (!c5Date) { alert("Please Select Date"); return; }
    const name = clients.find((x) => x.v === c5Client)?.t ?? "";
    const r = await mk(`${BASE}/salary_search/`, { client: c5Client, client_name: name, state: c5State, date: c5Date });
    const body = await r.json().catch(() => ({}));
    if (r.ok) {
      if (body.billing_amount === 0) {
        setC5NotProcess(body.bill_not_process ?? []);
      } else {
        setC5NotProcess([]);
        alert("Payment Save Succsefully !!");
        loadPaymentGrid();
      }
    } else {
      alert("Payment NOT save !!!");
    }
  };

  // ===== Tab 6 (Compliances) =====
  const onC6Client = async (v: string) => {
    setC6Client(v); setC6State("Select"); setC6Branch("Select"); setC6Branches([]); setC6Grid([]);
    setC6Heads({ admin: "", operation: "", finance: "" });
    const d = v && v !== "Select" ? await tmGet<{ results: string[] }>(`emp_states/?client=${encodeURIComponent(v)}`) : null;
    setC6States(d?.results ?? []);
  };
  const onC6State = async (v: string) => {
    setC6State(v); setC6Branch("Select"); setC6Grid([]);
    const d = v && v !== "Select" ? await tmGet<{ results: Opt[] }>(`emp_branches/?client=${encodeURIComponent(c6Client)}&state=${encodeURIComponent(v)}`) : null;
    setC6Branches(d?.results ?? []);
  };
  const onC6Branch = async (v: string) => {
    setC6Branch(v);
    if (!v || v === "Select") { setC6Grid([]); setC6Heads({ admin: "", operation: "", finance: "" }); return; }
    const [h, g] = await Promise.all([
      tmGet<{ admin: string; operation: string; finance: string }>(`heads/?unit=${encodeURIComponent(v)}`),
      tmGet<{ results: Row[] }>(`compliance_grid/?unit=${encodeURIComponent(v)}`),
    ]);
    setC6Heads(h ?? { admin: "", operation: "", finance: "" });
    const rows = g?.results ?? [];
    if (rows.length === 0) alert("No Record Found !!!");
    setC6Grid(rows);
  };

  const Sel = ({ value, onChange, opts, extra }: { value: string; onChange: (v: string) => void; opts: Opt[]; extra?: string[] }) => (
    <select className="lg-control" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="Select">Select</option>
      {(extra ?? []).map((x) => <option key={x} value={x}>{x}</option>)}
      {opts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
    </select>
  );
  const SelStr = ({ value, onChange, opts, extra }: { value: string; onChange: (v: string) => void; opts: string[]; extra?: string[] }) => (
    <select className="lg-control" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="Select">Select</option>
      {(extra ?? []).map((x) => <option key={x} value={x}>{x}</option>)}
      {opts.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );

  const visibleTabs = panels ? TAB_ORDER.filter((t) => panels[t]) : [];

  return (
    <section className="app-content">
      <div className="lg-panel">
        <div className="lg-panel-head" style={{ textAlign: "center", fontSize: "small" }}>TASK MASTER</div>
        <div className="lg-panel-body">
          <div style={{ background: "#f3f1fe", padding: "20px", border: "1px solid #e2e2dd", borderRadius: "10px", marginTop: "15px" }}>
            {/* Tabs */}
            <div className="em-tabs">
              {visibleTabs.map((t) => (
                <button key={t} className={`em-tab ${activeTab === t ? "active" : ""}`} onClick={() => setActiveTab(t)}><b>{TAB_LABEL[t]}</b></button>
              ))}
            </div>

            <div className="em-tabpane" style={{ background: "white", padding: "15px", borderRadius: "0 10px 10px 10px" }}>

              {/* ===== Tab 1: Client ===== */}
              {activeTab === "client" && (
                <div>
                  <div className="lg-form cols4">
                    <div className="lg-row"><span className="lg-label">Client Name :</span><Sel value={c1Client} onChange={onC1Client} opts={clients} /></div>
                    <div className="lg-row"><span className="lg-label">Client Address :</span><input className="lg-control" readOnly value={c1?.address ?? ""} /></div>
                    <div className="lg-row"><span className="lg-label">Total Employee Count :</span><input className="lg-control" readOnly value={c1?.total_employee ?? ""} /></div>
                    <div className="lg-row"><span className="lg-label">Remaining Count For Deployment:</span><input className="lg-control" readOnly value={c1?.difference ?? ""} /></div>
                    <div className="lg-row"><span className="lg-label">No Of Diployed Employee:</span><input className="lg-control" readOnly value={c1?.deployed ?? ""} /></div>
                  </div>
                  <div className="lg-grid-wrapper" style={{ marginTop: 15, overflowX: "auto" }}>
                    <table className="lg-grid">
                      <thead><tr><th>State</th><th>Designation</th><th>Count</th><th>Hours</th></tr></thead>
                      <tbody>
                        {(c1?.designation ?? []).map((r, i) => (
                          <tr key={i}><td>{String(r.STATE ?? "")}</td><td>{String(r.DESIGNATION ?? "")}</td><td>{String(r.COUNT ?? "")}</td><td>{String(r.HOURS ?? "")}</td></tr>
                        ))}
                        {(c1?.designation ?? []).length === 0 && <tr><td colSpan={4} style={{ textAlign: "center" }}></td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div className="lg-grid-wrapper" style={{ marginTop: 15, overflowX: "auto" }}>
                    <table className="lg-grid">
                      <thead><tr><th>HEAD_Info</th><th>ZONE_Info</th><th>REGION_Info</th><th>GST_Info</th><th>Document</th></tr></thead>
                      <tbody>
                        {c1?.pending ? (
                          <tr>
                            {["HEAD_Info", "ZONE_Info", "REGION_Info", "GST_Info", "Document"].map((k) => {
                              const val = String(c1.pending[k] ?? "Pending");
                              return <td key={k} style={{ background: val === "Done" ? DONE : PEND, textAlign: "center", border: "1px solid #ddd", padding: "6px" }}>{val}</td>;
                            })}
                          </tr>
                        ) : <tr><td colSpan={5} style={{ textAlign: "center" }}></td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ===== Tab 2: Branch/Location ===== */}
              {activeTab === "branch" && (
                <div>
                  <div className="lg-form cols3">
                    <div className="lg-row"><span className="lg-label">Client Name :</span><Sel value={c2Client} onChange={onC2Client} opts={clients} /></div>
                    <div className="lg-row"><span className="lg-label">State Name :</span><SelStr value={c2State} onChange={onC2State} opts={c2States} /></div>
                    <div className="lg-row"><span className="lg-label">Branch Name :</span><Sel value={c2Branch} onChange={onC2Branch} opts={c2Branches} /></div>
                    <div className="lg-row"><span className="lg-label">Admin Staff :</span><input className="lg-control" readOnly value={c2Heads.admin} /></div>
                    <div className="lg-row"><span className="lg-label">Operation Staff :</span><input className="lg-control" readOnly value={c2Heads.operation} /></div>
                    <div className="lg-row"><span className="lg-label">Finance Staff :</span><input className="lg-control" readOnly value={c2Heads.finance} /></div>
                  </div>
                  <div className="lg-grid-wrapper" style={{ marginTop: 15, overflowX: "auto" }}>
                    <table className="lg-grid">
                      <thead><tr>
                        <th>Branch Name</th><th>Branch City</th><th>Designation</th><th>Working Hours</th><th>Employee Count</th><th>Remaining Count</th>
                        <th>LOCATION HEAD</th><th>OPERATION HEADS</th><th>FINANCE HEAD</th><th>ADMIN HEAD</th><th>OTHER</th>
                      </tr></thead>
                      <tbody>
                        {c2Loc.map((r, i) => (
                          <tr key={i}>
                            <td>{String(r.UNIT_NAME ?? "")}</td><td>{String(r.UNIT_CITY ?? "")}</td><td>{String(r.DESIGNATION ?? "")}</td>
                            <td>{String(r.HOURS ?? "")}</td><td>{String(r.Emp_count ?? "")}</td><td>{String(r.File_No ?? "")}</td>
                            <td>{[r.LocationHead_Name, r.LocationHead_mobileno, r.LocationHead_Emailid].filter(Boolean).join(" / ")}</td>
                            <td>{[r.OperationHead_Name, r.OperationHead_Mobileno, r.OperationHead_EmailId].filter(Boolean).join(" / ")}</td>
                            <td>{[r.FinanceHead_Name, r.FinanceHead_Mobileno, r.FinanceHead_EmailId].filter(Boolean).join(" / ")}</td>
                            <td>{[r.adminhead_name, r.adminhead_mobile, r.adminhead_email].filter(Boolean).join(" / ")}</td>
                            <td>{[r.OtherHead_Name, r.OtherHead_Monileno, r.OtherHead_Emailid].filter(Boolean).join(" / ")}</td>
                          </tr>
                        ))}
                        {c2Loc.length === 0 && <tr><td colSpan={11} style={{ textAlign: "center" }}></td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <div className="lg-grid-wrapper" style={{ marginTop: 15, overflowX: "auto" }}>
                    <table className="lg-grid">
                      <thead><tr><th>Branch Name</th><th>Branch City</th><th>Client Branch Code</th><th>Opus Code</th><th>Zone</th><th>Region Name</th><th>Branch Email Id</th></tr></thead>
                      <tbody>
                        {c2Pending.map((r, i) => (
                          <tr key={i}>
                            <td>{String(r.UNIT_NAME ?? "")}</td><td>{String(r.UNIT_CITY ?? "")}</td>
                            <StatusCell value={r.Client_branch_code} /><StatusCell value={r.OPus_NO} /><StatusCell value={r.txt_zone} /><StatusCell value={r.ZONE} /><StatusCell value={r.UNIT_EMAIL_ID} />
                          </tr>
                        ))}
                        {c2Pending.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center" }}></td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ===== Tab 3: Employee ===== */}
              {activeTab === "employee" && (
                <div>
                  <div className="lg-form cols3">
                    <div className="lg-row"><span className="lg-label">Client Name :</span><Sel value={c3Client} onChange={onC3Client} opts={clients} /></div>
                    <div className="lg-row"><span className="lg-label">State Name :</span><SelStr value={c3State} onChange={onC3State} opts={c3States} /></div>
                    <div className="lg-row"><span className="lg-label">Brach Name :</span><Sel value={c3Branch} onChange={onC3Branch} opts={c3Branches} /></div>
                    <div className="lg-row"><span className="lg-label">Admin Staff :</span><input className="lg-control" readOnly value={c3Heads.admin} /></div>
                    <div className="lg-row"><span className="lg-label">Operation Staff :</span><input className="lg-control" readOnly value={c3Heads.operation} /></div>
                    <div className="lg-row"><span className="lg-label">Finance Staff :</span><input className="lg-control" readOnly value={c3Heads.finance} /></div>
                  </div>
                  <div className="lg-grid-wrapper" style={{ marginTop: 15, overflowX: "auto" }}>
                    <table className="lg-grid">
                      <thead><tr>
                        <th>NAME</th><th>MOB_NO</th><th>ORIGNAL_A/C NO</th><th>NOMINEE NAME</th><th>NOMINEE RELATION</th>
                        <th>ORIGINAL PHOTO</th><th>ORIGINAL ADHAR CARD</th><th>ORIGINAL POLICE VERIFICATION</th><th>ORIGINAL PROOF OF ADDRESS</th>
                        <th>BANK PASSBOOK</th><th>EMPLOYEE SIGNATURE</th><th>UNIFORM</th><th>ID CARD</th><th>SWEATER</th>
                      </tr></thead>
                      <tbody>
                        {c3Grid.map((r, i) => (
                          <tr key={i}>
                            <td>{String(r.emp_name ?? "")}</td><td>{String(r.EMP_MOBILE_NO ?? "")}</td>
                            <StatusCell value={r.original_bank_account_no} /><StatusCell value={r.PF_NOMINEE_RELATION} /><StatusCell value={r.PF_NOMINEE_NAME} />
                            <StatusCell value={r.original_photo} /><StatusCell value={r.original_adhar_card} /><StatusCell value={r.original_policy_document} /><StatusCell value={r.original_address_proof} />
                            <StatusCell value={r.bank_passbook} /><StatusCell value={r.emp_signature} /><StatusCell value={r.UNIFORM} /><StatusCell value={r["ID CARD"]} /><StatusCell value={r.SWEATER} />
                          </tr>
                        ))}
                        {c3Grid.length === 0 && <tr><td colSpan={14} style={{ textAlign: "center" }}></td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ===== Tab 4: Billing ===== */}
              {activeTab === "billing" && (
                <div>
                  <div className="lg-form cols3">
                    <div className="lg-row"><span className="lg-label">Client Name :</span><Sel value={c4Client} onChange={onC4Client} opts={clients} /></div>
                    <div className="lg-row"><span className="lg-label">State Name :</span><SelStr value={c4State} onChange={(v) => setC4State(v)} opts={c4States} /></div>
                    <div className="lg-row"><span className="lg-label">Date :</span><input className="lg-control" placeholder="MM/YYYY" value={c4Date} onChange={(e) => setC4Date(e.target.value)} /></div>
                  </div>
                  <div className="lg-btns" style={{ marginTop: 10 }}><button className="lg-btn-primary" onClick={onC4Search}>Search</button></div>
                  <div className="em-tabs" style={{ marginTop: 15 }}>
                    <button className={`em-tab ${c4Sub === "attendance" ? "active" : ""}`} onClick={() => setC4Sub("attendance")}><b>Attendance Remaining</b></button>
                    <button className={`em-tab ${c4Sub === "policy" ? "active" : ""}`} onClick={() => setC4Sub("policy")}><b>Policy Remaining</b></button>
                  </div>
                  <div className="em-tabpane" style={{ background: "white", padding: 10 }}>
                    <table className="lg-grid">
                      <thead><tr><th>Branches</th></tr></thead>
                      <tbody>
                        {(c4Sub === "attendance" ? c4Att : c4Pol).map((r, i) => <tr key={i}><td>{String(r.CUNIT ?? "")}</td></tr>)}
                        {(c4Sub === "attendance" ? c4Att : c4Pol).length === 0 && <tr><td style={{ textAlign: "center" }}></td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ===== Tab 5: Salary ===== */}
              {activeTab === "salary" && (
                <div>
                  <div className="lg-form cols3">
                    <div className="lg-row"><span className="lg-label">Client Name :</span><Sel value={c5Client} onChange={onC5Client} opts={clients} /></div>
                    <div className="lg-row"><span className="lg-label">State Name :</span><SelStr value={c5State} onChange={(v) => setC5State(v)} opts={c5States} extra={["All"]} /></div>
                    <div className="lg-row"><span className="lg-label">Date :</span><input className="lg-control" placeholder="MM/YYYY" value={c5Date} onChange={(e) => setC5Date(e.target.value)} /></div>
                  </div>
                  <div className="lg-btns" style={{ marginTop: 10 }}><button className="lg-btn-primary" onClick={onC5Search}>Search</button></div>
                  {c5NotProcess.length > 0 && (
                    <div style={{ marginTop: 10 }}>
                      <b>Branches (billing not processed):</b>
                      <ul>{c5NotProcess.map((b, i) => <li key={i}>{b}</li>)}</ul>
                    </div>
                  )}
                  <div className="lg-grid-wrapper" style={{ marginTop: 15, overflowX: "auto" }}>
                    <table className="lg-grid">
                      <thead><tr><th>Client Name</th><th>State</th><th>Billing Amount</th><th>Billing Month</th><th>Recived Amount</th><th>Balance Amount</th></tr></thead>
                      <tbody>
                        {c5Grid.map((r, i) => (
                          <tr key={i}>
                            <td>{String(r.client_name ?? "")}</td><td>{String(r.state ?? "")}</td><td>{String(r.billing_amt ?? "")}</td>
                            <td style={{ fontWeight: "bold" }}>{String(r.month_year ?? "")}</td><td>{String(r.recived_amt ?? "")}</td><td>{String(r.balance_amt ?? "")}</td>
                          </tr>
                        ))}
                        {c5Grid.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center" }}></td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ===== Tab 6: Employee Compliances ===== */}
              {activeTab === "compliances" && (
                <div>
                  <div className="lg-form cols3">
                    <div className="lg-row"><span className="lg-label">Client Name :</span><Sel value={c6Client} onChange={onC6Client} opts={clients} /></div>
                    <div className="lg-row"><span className="lg-label">State Name :</span><SelStr value={c6State} onChange={onC6State} opts={c6States} /></div>
                    <div className="lg-row"><span className="lg-label">Brach Name :</span><Sel value={c6Branch} onChange={onC6Branch} opts={c6Branches} /></div>
                    <div className="lg-row"><span className="lg-label">Admin Staff :</span><input className="lg-control" readOnly value={c6Heads.admin} /></div>
                    <div className="lg-row"><span className="lg-label">Operation Staff :</span><input className="lg-control" readOnly value={c6Heads.operation} /></div>
                    <div className="lg-row"><span className="lg-label">Finance Staff :</span><input className="lg-control" readOnly value={c6Heads.finance} /></div>
                  </div>
                  <div className="lg-grid-wrapper" style={{ marginTop: 15, overflowX: "auto" }}>
                    <table className="lg-grid">
                      <thead><tr>
                        <th>NAME</th><th>PAN NUM</th><th>ESIC NUM</th><th>PF NUM</th><th>A/C HOLDER NAME</th><th>BANK A/C NUM</th><th>BANK IFSC CODE</th><th>CCA</th><th>GRATUITY</th><th>SPECIAL ALLOWANCE</th>
                      </tr></thead>
                      <tbody>
                        {c6Grid.map((r, i) => (
                          <tr key={i}>
                            <td>{String(r.emp_name ?? "")}</td>
                            <StatusCell value={r.EMP_NEW_PAN_NO} /><StatusCell value={r.ESIC_NUMBER} /><StatusCell value={r.PF_NUMBER} />
                            <StatusCell value={r.BANK_HOLDER_NAME} /><StatusCell value={r.original_bank_account_no} /><StatusCell value={r.PF_IFSC_CODE} />
                            <td>{String(r.cca ?? "")}</td><td>{String(r.gratuity ?? "")}</td><td>{String(r.special_allow ?? "")}</td>
                          </tr>
                        ))}
                        {c6Grid.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center" }}></td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
          <div className="lg-btns center" style={{ marginTop: 15 }}>
            <Link href="/" className="lg-btn-danger" style={{ display: "inline-flex", alignItems: "center" }}>Close</Link>
          </div>
        </div>
      </div>
    </section>
  );
}
