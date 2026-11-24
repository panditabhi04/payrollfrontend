"use client";

/**
 * Operation Management - 1:1 port of Operation_management.aspx.
 *  Tab 1 "Assign Field Officer": pay_op_management (assign / remove a field officer to branches).
 *  Tab 2 "Travelling Schedule" : pay_op_management_details (stage rows, Submit, Send Mail, grids).
 * Every button talks to /api/transactions/operation-assignments/ ; nothing is simulated.
 */
import React, { useCallback, useEffect, useState } from "react";
import { getJSON as apiGet, mk as apiPost } from "@/lib/api/legacy-fetch";
import { drfErrorText, apiGet as apiGetStrict } from "@/lib/api/client";

const BASE = "/api/transactions/operation-assignments";
type Row = Record<string, any>;
type Opt = { v: string; t: string };

const TIMES = [
  "Flexible", "0:00", "0:30", "1:00", "1:30", "2:00", "2:30", "3:00", "3:30", "4:00", "4:30", "5:00", "5:30",
  "6:00", "6:30", "7:00", "7:30", "8:00", "8:30", "9:00", "9:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30", "21:00", "21:30", "22:00", "22:30", "23:00", "23:30",
];

const th: React.CSSProperties = { padding: "8px", border: "1px solid #ccc" };
const hdr: React.CSSProperties = { backgroundColor: "#006699", color: "white", fontWeight: "bold" };

/** POST helper: resolves with the JSON body, rejects with the server's own message text. */
async function post<T = any>(path: string, body: unknown): Promise<T> {
  const r = await apiPost(path, body);
  let data: any = null;
  try { data = await r.json(); } catch { /* empty body */ }
  if (!r.ok) throw new Error(drfErrorText(data) || `Request failed (${r.status})`);
  return data as T;
}

/** GET helper that surfaces failures instead of silently showing an empty list. */
async function get<T = any>(path: string): Promise<T | null> {
  return apiGet<T>(path);
}

const dmy = (iso: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : iso;
};

export default function OperationManagement() {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState(0);

  // ---- tab 1 ----
  const [officers, setOfficers] = useState<Opt[]>([]);
  const [emp, setEmp] = useState("");
  const [mobile, setMobile] = useState("");
  const [states, setStates] = useState<string[]>([]);
  const [state, setState] = useState("");
  const [clients, setClients] = useState<Opt[]>([]);
  const [client, setClient] = useState("");
  const [without, setWithout] = useState<Opt[]>([]);
  const [having, setHaving] = useState<Opt[]>([]);
  const [selWithout, setSelWithout] = useState<string[]>([]);
  const [selHaving, setSelHaving] = useState<string[]>([]);
  const [assigned, setAssigned] = useState<Row[]>([]);

  // ---- tab 2 ----
  const [schedType, setSchedType] = useState("0");
  const [aOfficers, setAOfficers] = useState<Opt[]>([]);
  const [fo, setFo] = useState("");
  const [tClients, setTClients] = useState<Opt[]>([]);
  const [tClient, setTClient] = useState("");
  const [tStates, setTStates] = useState<string[]>([]);
  const [tState, setTState] = useState("");
  const [tBranches, setTBranches] = useState<Opt[]>([]);
  const [tBranch, setTBranch] = useState("");
  const [date, setDate] = useState("");
  const [start, setStart] = useState("Flexible");
  const [end, setEnd] = useState("Flexible");
  const [staged, setStaged] = useState<Row[]>([]);
  const [history, setHistory] = useState<Row[]>([]);
  const [schedules, setSchedules] = useState<Row[]>([]);

  const loadAssigned = useCallback(async () => {
    const d = await get<{ results: Row[] }>(`${BASE}/`);
    setAssigned(d?.results ?? []);
  }, []);
  const loadAssignedOfficers = useCallback(async () => {
    const d = await get<{ results: Row[] }>(`${BASE}/assigned_officers/`);
    setAOfficers((d?.results ?? []).map((r) => ({ v: String(r.emp_code), t: String(r.emp_name) })));
  }, []);
  const loadSchedules = useCallback(async () => {
    const d = await get<{ results: Row[] }>(`${BASE}/schedules/`);
    setSchedules(d?.results ?? []);
  }, []);

  useEffect(() => {
    get<{ results: Row[] }>(`${BASE}/field_officers/`)
      .then((d) => setOfficers((d?.results ?? []).map((r) => ({ v: String(r.emp_code), t: String(r.emp_name) }))));
    get<{ states: string[] }>(`/api/masters/states/lookup/`).then((d) => setStates(d?.states ?? []));
    loadAssigned();
    loadAssignedOfficers();
    loadSchedules();
  }, [loadAssigned, loadAssignedOfficers, loadSchedules]);

  // ---------------------------------------------------------------- tab 1 handlers
  const onEmp = async (v: string) => {
    setEmp(v); setMobile(""); setState(""); setClient(""); setClients([]); setWithout([]); setHaving([]);
    setSelWithout([]); setSelHaving([]);
    if (!v) return;
    const d = await get<{ mobile_no: string }>(`${BASE}/mobile/?emp_code=${encodeURIComponent(v)}`);
    setMobile(d?.mobile_no ?? "");
  };
  const onState = async (v: string) => {
    setState(v); setClient(""); setClients([]); setWithout([]); setHaving([]); setSelWithout([]); setSelHaving([]);
    if (!v) return;
    const d = await get<{ results: Row[] }>(`${BASE}/clients/?state=${encodeURIComponent(v)}`);
    setClients((d?.results ?? []).map((r) => ({ v: String(r.client_code), t: String(r.client_name) })));
  };
  const onClient = async (v: string) => {
    setClient(v); setWithout([]); setHaving([]); setSelWithout([]); setSelHaving([]);
    if (!v) return;
    const d = await get<{ without: Row[]; having: Row[] }>(
      `${BASE}/branches/?client_code=${encodeURIComponent(v)}&state=${encodeURIComponent(state)}`);
    setWithout((d?.without ?? []).map((r) => ({ v: String(r.unit_code), t: String(r.unit_name) })));
    setHaving((d?.having ?? []).map((r) => ({ v: String(r.unit_code), t: String(r.unit_name) })));
  };
  const clearAssign = () => {
    setEmp(""); setMobile(""); setState(""); setClient(""); setClients([]); setWithout([]); setHaving([]);
    setSelWithout([]); setSelHaving([]);
  };
  const refreshBranches = async (c: string, s: string) => {
    const d = await get<{ without: Row[]; having: Row[] }>(
      `${BASE}/branches/?client_code=${encodeURIComponent(c)}&state=${encodeURIComponent(s)}`);
    setWithout((d?.without ?? []).map((r) => ({ v: String(r.unit_code), t: String(r.unit_name) })));
    setHaving((d?.having ?? []).map((r) => ({ v: String(r.unit_code), t: String(r.unit_name) })));
  };

  // Validation(): Select Field Officer -> State -> Client Name, then the server's own checks.
  const save = async () => {
    if (!emp) { alert("Please Select Field Officer"); return; }
    if (!state) { alert("Please Select State"); return; }
    if (!client) { alert("Please Select Client Name"); return; }
    setLoading(true);
    try {
      const d = await post<{ message: string }>(`${BASE}/`, {
        emp_code: emp, mobile_no: mobile, state, client_code: client, unit_codes: selWithout,
      });
      alert(d.message);
      setSelWithout([]);
      await refreshBranches(client, state);
      await loadAssigned();
      await loadAssignedOfficers();
    } catch (e: any) {
      alert(e.message);
    } finally { setLoading(false); }
  };
  // R_validation(): confirm, then delete the selected "Branch Having Field Officer" entries.
  const remove = async () => {
    if (!window.confirm("Are you Sure You Want to Delete Record")) { alert("Record not Available"); return; }
    setLoading(true);
    try {
      const d = await post<{ message: string }>(`${BASE}/remove/`, { unit_codes: selHaving });
      alert(d.message);
      setSelHaving([]);
      if (client && state) await refreshBranches(client, state);
      await loadAssigned();
      await loadAssignedOfficers();
    } catch (e: any) {
      alert(e.message);
    } finally { setLoading(false); }
  };

  // ---------------------------------------------------------------- tab 2 handlers
  const onFo = async (v: string) => {
    setFo(v); setTClient(""); setTClients([]); setTState(""); setTStates([]); setTBranch(""); setTBranches([]);
    setHistory([]);
    if (!v) return;
    const c = await get<{ results: Row[] }>(`${BASE}/trav_clients/?emp_code=${encodeURIComponent(v)}`);
    setTClients((c?.results ?? []).map((r) => ({ v: String(r.client_code), t: String(r.client_name) })));
    const h = await get<{ results: Row[] }>(`${BASE}/history/?emp_code=${encodeURIComponent(v)}`);
    setHistory(h?.results ?? []);
  };
  const onTClient = async (v: string) => {
    setTClient(v); setTState(""); setTStates([]); setTBranch(""); setTBranches([]);
    if (!v) return;
    const d = await get<{ results: Row[] }>(
      `${BASE}/trav_states/?emp_code=${encodeURIComponent(fo)}&client_code=${encodeURIComponent(v)}`);
    setTStates((d?.results ?? []).map((r) => String(r.state_name)));
  };
  const onTState = async (v: string) => {
    setTState(v); setTBranch(""); setTBranches([]);
    if (!v) return;
    const d = await get<{ results: Row[] }>(
      `${BASE}/trav_branches/?emp_code=${encodeURIComponent(fo)}&client_code=${encodeURIComponent(tClient)}&state=${encodeURIComponent(v)}`);
    setTBranches((d?.results ?? []).map((r) => ({ v: String(r.unit_code), t: String(r.unit_name) })));
  };

  // req_Validation() then lnkbtn_addmoreitem_Click rules.
  const addRow = async () => {
    if (!fo) { alert("Please Select Field Officer"); return; }
    if (!tClient) { alert("Please Select Client Name"); return; }
    if (!tState) { alert("Please Select State"); return; }
    if (!tBranch) { alert("Please Select Branch"); return; }
    if (!date) { alert("Please Select Date"); return; }
    if (staged.some((r) => r.state === tState && r.unit_code === tBranch)) {
      alert("Can Not shedule Same branch ..."); return;
    }
    try {
      await apiGetStrict(`${BASE}/schedule_check/?emp_code=${encodeURIComponent(fo)}&client_code=${encodeURIComponent(tClient)}` +
        `&state=${encodeURIComponent(tState)}&unit_code=${encodeURIComponent(tBranch)}&date=${encodeURIComponent(date)}`,
        { credentials: "include" });
    } catch (e: any) {
      alert(e.message); return;
    }
    setStaged((p) => [...p, {
      client_code: tClient, emp_code: fo, unit_code: tBranch,
      emp_name: aOfficers.find((o) => o.v === fo)?.t ?? fo,
      client_name: tClients.find((c) => c.v === tClient)?.t ?? tClient,
      state: tState, unit_name: tBranches.find((b) => b.v === tBranch)?.t ?? tBranch,
      operation_date: date, start_time: start, end_time: end,
    }]);
    setFo(""); setTClient(""); setTClients([]); setTState(""); setTStates([]); setTBranch(""); setTBranches([]);
    setDate(""); setStart("Flexible"); setEnd("Flexible"); setHistory([]);
  };

  const submit = async () => {
    if (staged.length === 0) { alert("Please First Save Travelling Shedule!!!!"); return; }
    setLoading(true);
    try {
      const d = await post<{ message: string; mail?: { sent: boolean; detail: string } }>(`${BASE}/schedule/`, {
        rows: staged.map((r) => ({
          emp_code: r.emp_code, client_code: r.client_code, state: r.state, unit_code: r.unit_code,
          operation_date: r.operation_date, start_time: r.start_time, end_time: r.end_time,
        })),
      });
      alert(d.message + (d.mail && !d.mail.sent ? `\n\n${d.mail.detail}` : ""));
      setStaged([]);
      await loadSchedules();
    } catch (e: any) {
      alert(e.message);
    } finally { setLoading(false); }
  };
  const sendMail = async () => {
    if (staged.length === 0) { alert("Please Schedule Operations !!"); return; }
    setLoading(true);
    try {
      const d = await post<{ message: string }>(`${BASE}/schedule_mail/`, {
        rows: staged.map((r) => ({ ...r, operation_date: dmy(r.operation_date) })),
      });
      alert(d.message);
    } catch (e: any) {
      alert(e.message);
    } finally { setLoading(false); }
  };
  const removeSaved = async (id: number) => {
    if (!window.confirm("Are you Sure You Want to Delete Record")) { alert("Record not Available"); return; }
    try {
      await post(`${BASE}/schedule_remove/`, { id });
      await loadSchedules();
    } catch (e: any) {
      alert(e.message);
    }
  };
  const clearTravel = () => {
    setFo(""); setTClient(""); setTClients([]); setTState(""); setTStates([]); setTBranch(""); setTBranches([]);
    setDate(""); setStart("Flexible"); setEnd("Flexible"); setHistory([]);
  };
  const close = () => { window.location.href = "/"; };

  const tabStyle = (i: number): React.CSSProperties => ({
    padding: "10px 20px", cursor: "pointer", backgroundColor: tab === i ? "#fff" : "transparent",
    border: tab === i ? "1px solid #ccc" : "none", borderBottom: tab === i ? "1px solid #fff" : "none", marginBottom: "-1px",
  });
  const rowColor = (r: Row) =>
    r.state_label === "Available" ? { backgroundColor: "green", color: "#fff" }
      : r.state_label === "Reschedule" ? { backgroundColor: "red", color: "#fff" } : {};

  return (
    <div className="container-fluid" style={{ maxWidth: "99%", margin: "0 auto", padding: "20px", fontSize: "14px" }}>
      {loading && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(204,204,204,0.7)", zIndex: 9999 }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>Loading...</div>
        </div>
      )}
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: 4 }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ flex: 1, textAlign: "center", fontSize: "small", fontWeight: "bold" }}>OPERATION MANAGEMENT</div>
          <div style={{ textAlign: "right" }}>
            <a href="#" onClick={(e) => { e.preventDefault(); window.open("/html/Operation_management.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }} style={{ color: "#fff" }}>
              <img src="/Images/help_ico.png" alt="Help" width={20} height={20} />
            </a>
          </div>
        </div>

        <div style={{ padding: 15, backgroundColor: "beige" }}>
          <div style={{ display: "flex", borderBottom: "1px solid #ccc", marginBottom: 20 }}>
            <div onClick={() => setTab(0)} style={tabStyle(0)}><a style={{ textDecoration: "none", color: "#337ab7" }}>Assign Field Officer</a></div>
            <div onClick={() => setTab(1)} style={tabStyle(1)}><a style={{ textDecoration: "none", color: "#337ab7" }}>Travelling Schedule</a></div>
          </div>

          <div style={{ backgroundColor: "#fff", padding: 20, border: "1px solid #ccc", marginTop: -21 }}>
            {tab === 0 && (
              <div>
                <div style={{ textAlign: "center", marginBottom: 20 }}><h4><b>ASSIGN FIELD OFFICER</b></h4></div>
                <div className="row" style={{ marginBottom: 20 }}>
                  <div className="col-md-2 col-md-offset-1">
                    <b>Select Field Officer :</b>
                    <select value={emp} onChange={(e) => onEmp(e.target.value)} className="form-control">
                      <option value="">Select</option>
                      {officers.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                    </select>
                  </div>
                  <div className="col-md-2">
                    <b>Mobile No :</b>
                    <input type="text" value={mobile} onChange={(e) => setMobile(e.target.value)} maxLength={50} className="form-control" />
                  </div>
                  <div className="col-md-3">
                    <b>State :</b>
                    <select value={state} onChange={(e) => onState(e.target.value)} className="form-control">
                      <option value="">Select</option>
                      {states.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="col-md-3">
                    <b>Client Name :</b>
                    <select value={client} onChange={(e) => onClient(e.target.value)} className="form-control">
                      <option value="">Select</option>
                      {clients.map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}
                    </select>
                  </div>
                </div>
                <div className="row" style={{ marginBottom: 20 }}>
                  <div className="col-md-5 col-md-offset-1">
                    <b>Branch Having Field Officer :</b>
                    <select multiple value={selHaving} onChange={(e) => setSelHaving(Array.from(e.target.selectedOptions, (o) => o.value))} className="form-control" style={{ height: 150 }}>
                      {having.map((b) => <option key={b.v} value={b.v}>{b.t}</option>)}
                    </select>
                  </div>
                  <div className="col-md-5">
                    <b>Branch Not Having Field Officer :</b>
                    <select multiple value={selWithout} onChange={(e) => setSelWithout(Array.from(e.target.selectedOptions, (o) => o.value))} className="form-control" style={{ height: 150 }}>
                      {without.map((b) => <option key={b.v} value={b.v}>{b.t}</option>)}
                    </select>
                  </div>
                </div>
                <div style={{ textAlign: "center", marginBottom: 20 }}>
                  <button onClick={save} className="btn btn-primary" style={{ marginRight: 10 }}>Save</button>
                  <button onClick={remove} className="btn btn-primary" style={{ marginRight: 10 }}>Remove</button>
                  <button onClick={clearAssign} className="btn btn-primary">Clear</button>
                </div>
                <div style={{ maxHeight: 300, overflow: "auto" }}>
                  <table className="table" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ccc", fontSize: 10 }}>
                    <thead>
                      <tr style={hdr}>
                        {["ID", "UNIT CODE", "COMP CODE", "FIELD OFFICER NAME", "MOBILE NO", "CLIENT NAME", "STATE NAME", "BRANCH NAME"].map((h) => <th key={h} style={th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {assigned.map((r) => (
                        <tr key={r.id}>
                          <td style={th}>{r.id}</td><td style={th}>{r.unit_code}</td><td style={th}>{r.comp_code}</td>
                          <td style={th}>{r.field_officer_name}</td><td style={th}>{r.mobile_no}</td>
                          <td style={th}>{r.client_name}</td><td style={th}>{r.state}</td><td style={th}>{r.unit_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 1 && (
              <div>
                <h4 style={{ textAlign: "center" }}><b>TRAVELLING SCHEDULE</b></h4>
                <hr />
                <div style={{ overflowX: "auto" }}>
                  <table className="table table-responsive" border={1} style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ccc" }}>
                    <thead>
                      <tr style={{ color: "#fff", backgroundColor: "#337ab7" }}>
                        {["SCHEDULE TYPE", "FIELD OFFICER", "CLIENT", "STATE", "BRANCH", "DATE", "START TIME", "END TIME", ""].map((h, i) => <th key={i} style={{ padding: 8, textAlign: "center" }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ padding: 5 }}>
                          <select value={schedType} onChange={(e) => setSchedType(e.target.value)} className="form-control">
                            <option value="0">Normal Schedule</option>
                            <option value="1">Emergency Schedule</option>
                          </select>
                        </td>
                        <td style={{ padding: 5 }}>
                          <select value={fo} onChange={(e) => onFo(e.target.value)} className="form-control">
                            <option value="">Select</option>
                            {aOfficers.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: 5 }}>
                          <select value={tClient} onChange={(e) => onTClient(e.target.value)} className="form-control">
                            <option value="">Select</option>
                            {tClients.map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: 5 }}>
                          <select value={tState} onChange={(e) => onTState(e.target.value)} className="form-control">
                            <option value="">Select</option>
                            {tStates.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: 5 }}>
                          <select value={tBranch} onChange={(e) => setTBranch(e.target.value)} className="form-control">
                            <option value="">Select</option>
                            {tBranches.map((b) => <option key={b.v} value={b.v}>{b.t}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: 5 }}>
                          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="form-control" />
                        </td>
                        <td style={{ padding: 5 }}>
                          <select value={start} onChange={(e) => setStart(e.target.value)} className="form-control">
                            {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: 5 }}>
                          <select value={end} onChange={(e) => setEnd(e.target.value)} className="form-control">
                            {TIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: 5, textAlign: "center" }}>
                          <button onClick={addRow} style={{ background: "none", border: "none", cursor: "pointer" }}>
                            <img src="/Images/add_icon.png" alt="Add Item" />
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 20, maxHeight: 300, overflow: "auto" }}>
                  <table className="table" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ccc", fontSize: 10 }}>
                    <thead>
                      <tr style={hdr}>
                        {["", "Sr No.", "FIELD_OFFICER", "CLIENT NAME", "STATE NAME", "BRANCH NAME", "DATE", "START TIME", "END TIME"].map((h, i) => <th key={i} style={th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {staged.map((r, i) => (
                        <tr key={i}>
                          <td style={{ ...th, textAlign: "center" }}>
                            <button onClick={() => setStaged(staged.filter((_, j) => j !== i))} style={{ background: "none", border: "none", cursor: "pointer" }}>
                              <img src="/Images/delete_icon.png" alt="delete" width={15} height={15} />
                            </button>
                          </td>
                          <td style={th}>{i + 1}</td><td style={th}>{r.emp_name}</td><td style={th}>{r.client_name}</td>
                          <td style={th}>{r.state}</td><td style={th}>{r.unit_name}</td><td style={th}>{dmy(r.operation_date)}</td>
                          <td style={th}>{r.start_time}</td><td style={th}>{r.end_time}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: 20, maxHeight: 300, overflow: "auto" }}>
                  <table className="table" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ccc", fontSize: 10 }}>
                    <thead>
                      <tr style={hdr}>
                        {["FIELD OFFICER NAME", "CLIENT NAME", "STATE NAME", "BRANCH NAME", "OPERATION DATE", "START TIME", "END TIME", "Status"].map((h) => <th key={h} style={th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((r, i) => (
                        <tr key={i}>
                          <td style={th}>{r.field_officer_name}</td><td style={th}>{r.client_name}</td><td style={th}>{r.state}</td>
                          <td style={th}>{r.unit_name}</td><td style={th}>{r.operation_date}</td><td style={th}>{r.start_time}</td>
                          <td style={th}>{r.end_time}</td><td style={th}>{r.status_label}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ textAlign: "center", margin: "20px 0" }}>
                  <button onClick={submit} className="btn btn-primary" style={{ marginRight: 10 }}>Submit</button>
                  <button onClick={sendMail} className="btn btn-primary" style={{ marginRight: 10 }}>Send Mail</button>
                  <button onClick={clearTravel} className="btn btn-primary" style={{ marginRight: 10 }}>Clear</button>
                  <button onClick={close} className="btn btn-danger">Close</button>
                </div>

                <div style={{ maxHeight: 300, overflow: "auto" }}>
                  <table className="table" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ccc", fontSize: 10 }}>
                    <thead>
                      <tr style={hdr}>
                        {["", "FIELD OFFICER NAME", "CLIENT NAME", "STATE NAME", "BRANCH NAME", "OPERATION DATE", "START TIME", "END TIME", "comment", "Status"].map((h, i) => <th key={i} style={th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {schedules.map((r) => (
                        <tr key={r.id} style={rowColor(r)}>
                          <td style={{ ...th, textAlign: "center" }}>
                            <button onClick={() => removeSaved(r.id)} style={{ background: "none", border: "none", cursor: "pointer" }}>
                              <img src="/Images/delete_icon.png" alt="delete" width={15} height={15} />
                            </button>
                          </td>
                          <td style={th}>{r.field_officer_name}</td><td style={th}>{r.client_name}</td><td style={th}>{r.state}</td>
                          <td style={th}>{r.unit_name}</td><td style={th}>{r.operation_date}</td><td style={th}>{r.start_time}</td>
                          <td style={th}>{r.end_time}</td><td style={th}>{r.comment}</td><td style={th}>{r.state_label}</td>
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
    </div>
  );
}
