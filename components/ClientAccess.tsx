"use client";
/* =====================================================================
 * CLIENT ASSIGN (staff access) — 1:1 port of client_access.aspx
 * (+ client_access.aspx.cs, legacy menu "Client Assign").
 * Top: Department Type -> Employee Name -> Employee ID (readonly) ->
 * Client Name -> State -> Branch Having/Not-Having Staff boxes, then
 * Save / Remove / Clear / Close. Bottom: Employee Wise / Client Wise /
 * State Wise filters over the access grid (csv/print/copy/colvis).
 * Backend: /api/masters/client-access/* (legacy tables, parameterized).
 * ===================================================================== */
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api/client";

const BASE = "/api/masters/client-access";
const SEL = "Select";

type Row = Record<string, any>;
type Opt = { code: string; name: string };

function val(r: Row, name: string): any {
  if (r[name] !== undefined && r[name] !== null) return r[name];
  const want = name.toLowerCase();
  for (const k of Object.keys(r)) {
    if (k.toLowerCase() === want) return (r as Row)[k];
  }
  return "";
}

async function errText(r: Response, fallback: string): Promise<string> {
  const d = await r.json().catch(() => null);
  if (typeof d === "string" && d) return d;
  if (Array.isArray(d) && d.length) return String(d[0]);
  if (d && typeof d === "object") {
    if (typeof (d as any).detail === "string") return (d as any).detail;
    if (typeof (d as any).message === "string") return (d as any).message;
  }
  return `${fallback} (${r.status})`;
}

async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE_URL}${path}`, { credentials: "include", cache: "no-store" });
  if (!r.ok) throw new Error(await errText(r, "Request failed"));
  return (await r.json()) as T;
}

async function postJSON(path: string, body: any): Promise<any> {
  const csrf = await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" })
    .then((r) => r.json()).catch(() => null);
  const m = document.cookie.match(/(^|; )csrftoken=([^;]+)/);
  const r = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": (csrf as any)?.csrfToken || (m ? decodeURIComponent(m[2]) : "") },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as any)?.message || (d as any)?.detail || `Request failed (${r.status})`);
  return d;
}

const th: React.CSSProperties = { background: "#006699", color: "#fff", fontWeight: "bold", textTransform: "uppercase", fontSize: 11, padding: "6px 8px", whiteSpace: "nowrap" };
const td: React.CSSProperties = { color: "#000066", background: "#fff", fontSize: 11, padding: "5px 8px", borderTop: "1px solid #ddd" };
const inp: React.CSSProperties = { width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid #ccc", borderRadius: 4 };
const lbl: React.CSSProperties = { fontWeight: "bold", fontSize: 12, color: "#000" };
const btnP: React.CSSProperties = { background: "#337ab7", color: "#fff", border: "1px solid #2e6da4", borderRadius: 4, padding: "6px 18px", fontWeight: "bold", fontSize: 12, cursor: "pointer" };
const btnD: React.CSSProperties = { background: "#d9534f", color: "#fff", border: "1px solid #d43f3a", borderRadius: 4, padding: "6px 18px", fontWeight: "bold", fontSize: 12, cursor: "pointer" };
const DEPTS = [SEL, "HR Department", "Admin", "Finance", "Operation", "Sales"];

function Exports({ rows }: { rows: Row[] }) {
  const cols = ["Department", "Staff Assign", "CLIENT NAME", "STATE NAME", "BRANCH NAME"];
  const cell = (r: Row, c: string) => val(r, c === "Staff Assign" ? "Staff_Assign" : c === "CLIENT NAME" ? "CLIENT_NAME" : c === "STATE NAME" ? "STATE_NAME" : c === "BRANCH NAME" ? "BRANCH_NAME" : "Department");
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [showM, setShowM] = useState(false);
  const vis = cols.filter((c) => !hidden[c]);
  const q = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const b: React.CSSProperties = { fontSize: 11, padding: "3px 10px", border: "1px solid #aaa", background: "#f5f5f5", cursor: "pointer", borderRadius: 3 };
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", position: "relative" }}>
      <button type="button" style={b} onClick={() => {
        const blob = new Blob(["\ufeff" + vis.map(q).join(",") + "\r\n" + rows.map((r) => vis.map((c) => q(cell(r, c))).join(",")).join("\r\n")], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = "client_access.csv";
        document.body.appendChild(a); a.click(); a.remove();
      }}>csv</button>
      <button type="button" style={b} onClick={() => window.print()}>print</button>
      <button type="button" style={b} onClick={() => {
        navigator.clipboard?.writeText([vis.join("\t"), ...rows.map((r) => vis.map((c) => cell(r, c)).join("\t"))].join("\n")).catch(() => undefined);
      }}>copyHtml5</button>
      <button type="button" style={b} onClick={() => setShowM((s) => !s)}>colvis</button>
      {showM && (
        <div style={{ background: "#fff", border: "1px solid #ccc", padding: 8, position: "absolute", zIndex: 5, top: 26, left: 0 }}>
          {cols.map((c) => (
            <label key={c} style={{ display: "block", fontSize: 12 }}>
              <input type="checkbox" checked={!hidden[c]} onChange={() => setHidden((h) => ({ ...h, [c]: !h[c] }))} /> {c}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClientAccess() {
  const router = useRouter();
  // top form
  const [dept, setDept] = useState(SEL);
  const [staff, setStaff] = useState<Opt[]>([]);
  const [emp, setEmp] = useState("Select Staff");
  const [empCode, setEmpCode] = useState("");
  const [clients, setClients] = useState<Opt[]>([]);
  const [client, setClient] = useState(SEL);
  const [states, setStates] = useState<string[]>([]);
  const [state, setState] = useState(SEL);
  const [having, setHaving] = useState<Opt[]>([]);
  const [selHaving, setSelHaving] = useState<string[]>([]);
  const [without, setWithout] = useState<Opt[]>([]);
  const [selWithout, setSelWithout] = useState<string[]>([]);
  // bottom grid filters
  const [fEmps, setFEmps] = useState<Opt[]>([]);
  const [fEmp, setFEmp] = useState("Select Staff");
  const [fClients, setFClients] = useState<Opt[]>([]);
  const [fClient, setFClient] = useState(SEL);
  const [fStates, setFStates] = useState<string[]>([]);
  const [fState, setFState] = useState(SEL);
  const [rows, setRows] = useState<Row[]>([]);

  const pick = (e: React.ChangeEvent<HTMLSelectElement>) =>
    Array.from(e.target.selectedOptions).map((o) => o.value);

  const loadGrid = async (e: string, c: string, s: string) => {
    // Legacy always filters by the selected employee; without one the grid is empty.
    if (!e) { setRows([]); return; }
    try {
      const d = await getJSON<{ results: Row[] }>(
        `${BASE}/grid/?emp=${encodeURIComponent(e)}&client=${encodeURIComponent(c)}&state=${encodeURIComponent(s)}`);
      setRows(d.results || []);
    } catch { /* ignore */ }
  };

  // Page_Load: bottom employee filter.
  useEffect(() => {
    getJSON<{ results: Opt[] }>(`${BASE}/filter-employees/`)
      .then((d) => setFEmps(d.results || []))
      .catch(() => undefined);
  }, []);

  // ddl_department change: text_clear1 + staff list.
  const changeDept = async (v: string) => {
    setDept(v);
    setEmp("Select Staff"); setEmpCode("");
    setClients([]); setClient(SEL);
    setStates([]); setState(SEL);
    setHaving([]); setWithout([]); setSelHaving([]); setSelWithout([]);
    if (!v || v === SEL) { setStaff([]); return; }
    try {
      const d = await getJSON<{ results: Opt[]; message?: string }>(`${BASE}/staff-by-department/?department=${encodeURIComponent(v)}`);
      if (d.message && (d.results || []).length === 0) alert(d.message);
      setStaff(d.results || []);
    } catch (e: any) { alert(e.message); }
  };

  // emp change: code = value, clear + client list (legacy always reloads clients).
  const changeEmp = async (v: string) => {
    setEmp(v); setEmpCode(v === "Select Staff" ? "" : v);
    setClients([]); setClient(SEL);
    setStates([]); setState(SEL);
    setHaving([]); setWithout([]); setSelHaving([]); setSelWithout([]);
    try {
      const d = await getJSON<{ results: Opt[] }>(`${BASE}/assign-clients/`);
      setClients(d.results || []);
    } catch (e: any) { alert(e.message); }
  };

  // client change: clear states/branches, load states (+Select, +ALL).
  // Legacy "Select" branch does nothing (keeps previous lists).
  const changeClient = async (v: string) => {
    setClient(v);
    if (!v || v === SEL) return;
    setStates([]); setState(SEL);
    setHaving([]); setWithout([]); setSelHaving([]); setSelWithout([]);
    try {
      const d = await getJSON<{ results: string[] }>(`${BASE}/client-states/?client=${encodeURIComponent(v)}`);
      setStates(d.results || []);
    } catch (e: any) { alert(e.message); }
  };

  // state change: load both branch boxes (legacy runs for any value;
  // "Select" simply matches zero branches).
  const changeState = async (v: string) => {
    setState(v);
    setHaving([]); setWithout([]); setSelHaving([]); setSelWithout([]);
    try {
      const d = await getJSON<{ without: Opt[]; having: Opt[] }>(
        `${BASE}/branches/?client=${encodeURIComponent(client)}&state=${encodeURIComponent(v)}&emp=${encodeURIComponent(emp)}`);
      setWithout(d.without || []);
      setHaving(d.having || []);
    } catch (e: any) { alert(e.message); }
  };

  // Save (Req_validation + btn_submit_click).
  const save = async () => {
    if (!dept || dept === SEL) { alert("Please Select Department Type"); return; }
    if (!emp || emp === "Select Staff") { alert("Please Select Employee Name"); return; }
    if (!client || client === SEL) { alert("Please Select Client Name"); return; }
    if (!state || state === SEL) { alert("Please Select State"); return; }
    try {
      const d = await postJSON(`${BASE}/assign/`, {
        department: dept, emp, client, branches: selWithout,
      });
      alert(d.message);
      const savedEmp = emp, savedClient = client, savedState = state;
      // keep the form as it is and reload both branch boxes: the branches just assigned now show in "Branch Having Staff"
      setSelHaving([]); setSelWithout([]);
      try {
        const br = await getJSON<{ without: Opt[]; having: Opt[] }>(
          `${BASE}/branches/?client=${encodeURIComponent(savedClient)}&state=${encodeURIComponent(savedState)}&emp=${encodeURIComponent(savedEmp)}`);
        setWithout(br.without || []);
        setHaving(br.having || []);
      } catch { /* ignore */ }
      const f = await getJSON<{ results: Opt[] }>(`${BASE}/filter-employees/`).catch(() => ({ results: [] as Opt[] }));
      setFEmps(f.results || []);
      // show what was just assigned: the bottom grid is switched to this employee / client / state
      setFEmp(savedEmp); setFClient(savedClient); setFState(savedState === "ALL" ? SEL : savedState);
      const fc = await getJSON<{ results: Opt[] }>(`${BASE}/filter-clients/?emp=${encodeURIComponent(savedEmp)}`).catch(() => ({ results: [] as Opt[] }));
      setFClients(fc.results || []);
      const fs = await getJSON<{ results: string[] }>(
        `${BASE}/filter-states/?emp=${encodeURIComponent(savedEmp)}&client=${encodeURIComponent(savedClient)}`).catch(() => ({ results: [] as string[] }));
      setFStates(fs.results || []);
      await loadGrid(savedEmp, savedClient, savedState === "ALL" ? "" : savedState);
    } catch (e: any) { alert(e.message); }
  };

  // Remove (R_remove_validation + btn_delete_click).
  const remove = async () => {
    if (selHaving.length === 0) { alert("Please Select Branch Having Staff"); return; }
    if (!confirm("Are you Sure You Want to Delete Record")) { alert("Record not Available"); return; }
    try {
      const d = await postJSON(`${BASE}/remove/`, {
        department: dept, emp, client, branches: selHaving,
      });
      alert(d.message);
      clearTop();
      const f = await getJSON<{ results: Opt[] }>(`${BASE}/filter-employees/`).catch(() => ({ results: [] as Opt[] }));
      setFEmps(f.results || []);
    } catch (e: any) { alert(e.message); }
  };

  // text_clear.
  const clearTop = () => {
    setDept(SEL); setStaff([]); setEmp("Select Staff"); setEmpCode("");
    setClients([]); setClient(SEL); setStates([]); setState(SEL);
    setHaving([]); setWithout([]); setSelHaving([]); setSelWithout([]);
  };

  // ---- bottom filters (legacy queries "Select"/"" values as-is -> empty grid) ----
  const changeFEmp = async (v: string) => {
    setFEmp(v); setFClient(SEL); setFState(SEL); setFClients([]); setFStates([]);
    if (!v || v === "Select Staff") { setRows([]); return; }
    loadGrid(v, "", "");
    try {
      const d = await getJSON<{ results: Opt[] }>(`${BASE}/filter-clients/?emp=${encodeURIComponent(v)}`);
      setFClients(d.results || []);
    } catch (e: any) { alert(e.message); }
  };
  const changeFClient = async (v: string) => {
    setFClient(v); setFState(SEL); setFStates([]);
    if (!v || v === SEL) { setRows([]); return; }
    loadGrid(fEmp === "Select Staff" ? "" : fEmp, v, "");
    try {
      const d = await getJSON<{ results: string[] }>(
        `${BASE}/filter-states/?emp=${encodeURIComponent(fEmp)}&client=${encodeURIComponent(v)}`);
      setFStates(d.results || []);
    } catch (e: any) { alert(e.message); }
  };
  const changeFState = (v: string) => {
    setFState(v);
    if (!v || v === SEL) { setRows([]); return; }
    loadGrid(fEmp === "Select Staff" ? "" : fEmp, fClient === SEL ? "" : fClient, v);
  };

  const cell = (r: Row, c: string) =>
    c === "Department" ? (val(r, "Department") || val(r, "department")) : c === "Staff Assign" ? (val(r, "Staff_Assign") || val(r, "Staff Assign")) : c === "CLIENT NAME" ? (val(r, "CLIENT_NAME") || val(r, "CLIENT NAME")) : c === "STATE NAME" ? (val(r, "STATE_NAME") || val(r, "STATE NAME")) : (val(r, "BRANCH_NAME") || val(r, "BRANCH NAME"));

  return (
    <div className="container-fluid">
      <div className="panel panel-primary" style={{ border: "1px solid #337ab7", borderRadius: 4 }}>
        <div className="panel-heading" style={{ background: "#337ab7", color: "#fff", padding: "10px 15px", borderRadius: "3px 3px 0 0" }}>
          <div className="row" style={{ display: "flex", alignItems: "center" }}>
            <div className="col-sm-1" style={{ flex: 1 }}></div>
            <div className="col-sm-9" style={{ flex: 9, textAlign: "center", fontSize: "small", textTransform: "uppercase" }}><b>CLIENT ASSIGN</b></div>
            <div className="col-sm-2 text-right" style={{ flex: 2, textAlign: "right", fontSize: 10 }}>
              <span title="Help" style={{ cursor: "help" }}>?</span>
            </div>
          </div>
        </div>
        <br />
        <div className="panel-body" style={{ padding: 15 }}>
          <div className="container-fluid" style={{ background: "#f3f1fe", borderRadius: 10, border: "1px solid white", marginBottom: 15, marginTop: 15 }}>
            <br />
            <div className="row" style={{ display: "flex", flexWrap: "wrap" }}>
              <div className="col-sm-2 col-xs-12" style={{ flex: 2, minWidth: 150 }}>
                <b> Department Type :</b><span className="text-red"> </span>
                <select className="form-control" style={inp} value={dept} onChange={(e) => changeDept(e.target.value)}>
                  {DEPTS.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="col-sm-2 col-xs-12" style={{ flex: 2, minWidth: 150 }}>
                <b> Employee Name :</b>
                <select className="form-control" style={{ ...inp, width: "100%" }} value={emp} onChange={(e) => changeEmp(e.target.value)}>
                  <option value="Select Staff">Select Staff</option>
                  {staff.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
                </select>
              </div>
              <div className="col-sm-2 col-xs-12" style={{ flex: 2, minWidth: 130 }}>
                <b> Employee ID :</b>
                <input className="form-control" style={{ ...inp, width: "100%" }} value={empCode} readOnly />
              </div>
              <div className="col-sm-2 col-xs-12" style={{ flex: 2, minWidth: 150 }}>
                <b> Client Name : </b>
                <select className="form-control" style={{ ...inp, fontSize: "x-small" }} value={client} onChange={(e) => changeClient(e.target.value)}>
                  <option value={SEL}>{SEL}</option>
                  {clients.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
                </select>
              </div>
              <div className="col-sm-2 col-xs-12" style={{ flex: 2, minWidth: 130 }}>
                <b>  State : </b>
                <select className="form-control" style={{ ...inp, fontSize: "x-small" }} value={state} onChange={(e) => changeState(e.target.value)}>
                  <option value={SEL}>{SEL}</option>
                  {states.includes("ALL") ? null : <option value="ALL">ALL</option>}
                  {states.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <br /><br />
            <div className="row" style={{ display: "flex", flexWrap: "wrap" }}>
              <div className="col-sm-2 col-xs-12" style={{ flex: 2 }}></div>
              <div className="col-sm-4 col-xs-12 text-left" style={{ flex: 4, minWidth: 220 }}>
                <b> Branch Having Staff :</b>
                <div className="form-control" style={{ ...inp, height: "auto", padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "3px 10px", borderBottom: "1px solid #ddd", background: "#f5f5f5", textAlign: "right" }}>
                    <a href="#" style={{ fontWeight: "bold", fontSize: 12 }}
                  onClick={(e) => { e.preventDefault(); setSelHaving(selHaving.length === having.length ? [] : having.map((o) => o.code)); }}>
                  {having.length > 0 && selHaving.length === having.length ? "Clear All" : "Select All"}</a>
                  </div>
                  <select multiple className="form-control" style={{ ...inp, height: 150, border: "none", borderRadius: 0, boxShadow: "none", margin: 0 }} value={selHaving} onChange={(e) => setSelHaving(pick(e))}>
                  {having.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
                </select>
                </div>
              </div>
              <div className="col-sm-4 col-xs-12 text-left" style={{ flex: 4, minWidth: 220 }}>
                <b> Branch Not Having Staff :</b>
                <div className="form-control" style={{ ...inp, height: "auto", padding: 0, overflow: "hidden" }}>
                  <div style={{ padding: "3px 10px", borderBottom: "1px solid #ddd", background: "#f5f5f5", textAlign: "right" }}>
                    <a href="#" style={{ fontWeight: "bold", fontSize: 12 }}
                  onClick={(e) => { e.preventDefault(); setSelWithout(selWithout.length === without.length ? [] : without.map((o) => o.code)); }}>
                  {without.length > 0 && selWithout.length === without.length ? "Clear All" : "Select All"}</a>
                  </div>
                  <select multiple className="form-control" style={{ ...inp, height: 150, border: "none", borderRadius: 0, boxShadow: "none", margin: 0 }} value={selWithout} onChange={(e) => setSelWithout(pick(e))}>
                  {without.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
                </select>
                </div>
              </div>
            </div>
            <br /><br />
          </div>
          <br />
          <div className="row text-center" style={{ textAlign: "center" }}>
            <button type="button" onClick={save} className="btn btn-primary" style={{ ...btnP, marginRight: 8 }}>Save</button>
            <button type="button" onClick={remove} className="btn btn-primary" style={{ ...btnP, marginRight: 8 }}>Remove</button>
            <button type="button" onClick={clearTop} className="btn btn-primary" style={{ ...btnP, marginRight: 8 }}>Clear</button>
            <button type="button" onClick={() => router.push("/")} className="btn btn-danger" style={btnD}>Close</button>
          </div>
          <br /><br />
          <div className="container-fluid" style={{ background: "#f3f1fe", borderRadius: 10, border: "1px solid white", padding: 10, marginBottom: 15, marginTop: 15 }}>
            <br />
            <div className="row" style={{ display: "flex", flexWrap: "wrap" }}>
              <div className="col-sm-2 col-xs-12" style={{ flex: 2, minWidth: 150 }}>
                <b>  Employee Wise :</b>
                <select className="form-control" style={{ ...inp, width: "100%" }} value={fEmp} onChange={(e) => changeFEmp(e.target.value)}>
                  <option value="Select Staff">Select Staff</option>
                  {fEmps.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
                </select>
              </div>
              <div className="col-sm-2 col-xs-12" style={{ flex: 2, minWidth: 150 }}>
                <b> Client Wise : </b>
                <select className="form-control" style={{ ...inp, fontSize: "x-small" }} value={fClient} onChange={(e) => changeFClient(e.target.value)}>
                  <option value={SEL}>{SEL}</option>
                  {fClients.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
                </select>
              </div>
              <div className="col-sm-2 col-xs-12" style={{ flex: 2, minWidth: 130 }}>
                <b>State Wise : </b>
                <select className="form-control" style={{ ...inp, fontSize: "x-small" }} value={fState} onChange={(e) => changeFState(e.target.value)}>
                  <option value={SEL}>{SEL}</option>
                  {fStates.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <br />
            <div className="container">
              <div className="container-fluid" style={{ background: "white", borderRadius: 10, border: "1px solid white", padding: 20, marginBottom: 15, marginTop: 15 }}>
                <Exports rows={rows} />
                <div style={{ height: "auto", maxHeight: 300, overflowX: "hidden", overflowY: "auto" }}>
                  <table className="table" style={{ borderCollapse: "collapse", width: "100%", background: "white" }}>
                    <thead>
                      <tr>{["Department", "Staff Assign", "CLIENT NAME", "STATE NAME", "BRANCH NAME"].map((c) => <th key={c} style={th}>{c}</th>)}</tr>
                    </thead>
                    <tbody>
                      {rows.map((r, i) => (
                        <tr key={i}>
                          {["Department", "Staff Assign", "CLIENT NAME", "STATE NAME", "BRANCH NAME"].map((c) => (
                            <td key={c} style={td}>{String(cell(r, c) ?? "")}</td>
                          ))}
                        </tr>
                      ))}
                      {rows.length === 0 && <tr><td style={td} colSpan={5}>No records</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
            <br />
          </div>
        </div>
      </div>
    </div>
  );
}
