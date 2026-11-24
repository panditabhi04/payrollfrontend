"use client";
import React, { useState, useEffect } from "react";
import { getJSON, postJSON } from "@/lib/api/legacy-fetch";

// Legacy employee_email_update.aspx: update pay_employee_master.EMP_EMAIL_ID by employee.
// Uses the existing employee CRUD API (PATCH emp_email_id). Comp-scoped by identity server-side.
interface Emp { emp_code: string; unit_code: string; unit_name: string; state_name: string; emp_name: string; grade_code: string; joining_date: string; emp_email_id?: string; }
interface ClientItem { client_code: string; client_name: string; }
interface UnitItem { unit_code: string; unit_name: string; }

const EMAIL_RE = /^\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*$/;
const BASE = "/api/hr/employee-email-update";

async function errText(r: Response | null, fallback: string): Promise<string> {
  if (!r) return fallback;
  try {
    const d = await r.json();
    if (Array.isArray(d)) return String(d[0]);
    if (d && typeof d === "object") {
      const v = (d as any).detail ?? (d as any).message ?? Object.values(d)[0];
      return Array.isArray(v) ? String(v[0]) : String(v ?? fallback);
    }
  } catch { /* ignore */ }
  return fallback;
}

export default function EmployeeEmailUpdatePage() {
  const [client, setClient] = useState("");
  const [state, setState] = useState("");
  const [unit, setUnit] = useState("");

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);

  const [rows, setRows] = useState<Emp[] | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState("");
  const [isErr, setIsErr] = useState(false);

  const say = (m: string, err = false) => { setMsg(m); setIsErr(err); if (typeof window !== "undefined") window.alert(m); };

  useEffect(() => {
    getJSON<{results: ClientItem[]}>(`${BASE}/clients/`).then(d => setClients(d?.results || []));
  }, []);

  const onClient = async (c: string) => {
    setClient(c); setState(""); setUnit(""); setStates([]); setUnits([]); setRows(null);
    if (!c) return;
    const d = await getJSON<{results: string[]}>(`${BASE}/states/?client_code=${encodeURIComponent(c)}`);
    setStates(d?.results || []);
  };

  const onState = async (st: string) => {
    setState(st); setUnit(""); setUnits([]);
    if (!st || !client) return;
    const d = await getJSON<{results: UnitItem[]}>(`${BASE}/units/?client_code=${encodeURIComponent(client)}&state_name=${encodeURIComponent(st)}`);
    setUnits(d?.results || []);
  };

  const search = async () => {
    // mail_Send_employee() client-side validations
    if (!client) { say("Please Enter Client Name", true); return; }
    if (!state) { say("Please Enter State Name ", true); return; }
    if (!unit) { say("Please Enter Branch Name", true); return; }
    const params = new URLSearchParams({ client_code: client, state_name: state, unit_code: unit });
    const data = await getJSON<{ results: Emp[] }>(`${BASE}/check/?${params.toString()}`);
    const list = data?.results ?? [];
    setRows(list);
    setEdits(Object.fromEntries(list.map((e) => [e.emp_code, e.emp_email_id ?? ""])));
    setMsg("");
  };

  const save = async (e: Emp) => {
    const email = (edits[e.emp_code] ?? "").trim();
    if (!email) { say("please enter proper email id", true); return; }
    if (!EMAIL_RE.test(email)) { say("Please Enter Valid Email id", true); return; }
    const r = await postJSON(`${BASE}/update_email/`, { emp_code: e.emp_code, email });
    if (r.ok) { const d = await r.json().catch(() => null); say(d?.message || "Update successfully!!"); }
    else say(await errText(r, "Not Updated!!"), true);
  };

  return (
    <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px", backgroundColor: "#fff" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "8.33%" }}></div>
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
            Employee Mail Id Update
          </div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <a href="#" onClick={(e) => { e.preventDefault(); }} style={{ color: "#fff", fontSize: "10px" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </a>
          </div>
        </div>
        
        <div className="panel-body" style={{ padding: "15px", background: "beige", minHeight: "500px" }}>
          {msg && <div style={{ color: isErr ? "#a94442" : "green", fontWeight: "bold", textAlign: "center", marginBottom: "15px", padding: "10px", background: isErr ? "#f2dede" : "#dff0d8", border: isErr ? "1px solid #ebccd1" : "1px solid #d6e9c6", borderRadius: "4px" }}>{msg}</div>}
          
          <div style={{ background: "#fff", padding: "15px", border: "1px solid #ccc", borderRadius: "4px", marginBottom: "20px" }}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ fontWeight: "bold", fontSize: "13px" }}>Client Name <span style={{ color: "red" }}>*</span></label>
                <select className="form-control" value={client} onChange={e => onClient(e.target.value)} style={{ height: "34px", width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }}>
                  <option value="">Select</option>
                  {clients.map(c => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ fontWeight: "bold", fontSize: "13px" }}>State Name <span style={{ color: "red" }}>*</span></label>
                <select className="form-control" value={state} onChange={e => onState(e.target.value)} style={{ height: "34px", width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }}>
                  <option value="">Select</option>
                  {states.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <label style={{ fontWeight: "bold", fontSize: "13px" }}>Branch Name <span style={{ color: "red" }}>*</span></label>
                <select className="form-control" value={unit} onChange={e => setUnit(e.target.value)} style={{ height: "34px", width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }}>
                  <option value="">Select</option>
                  {units.map(u => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
                </select>
              </div>
              <div>
                <button className="btn btn-success" style={{ background: "#00a32a", color: "white", fontWeight: "bold", border: "none", padding: "6px 20px", borderRadius: "4px", height: "34px" }} onClick={search}>Check Employee</button>
              </div>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="table table-striped table-bordered table-hover" style={{ borderCollapse: "collapse", width: "100%", fontSize: "12px", background: "#fff", border: "1px solid #ddd" }}>
              <thead style={{ background: "#224173", color: "white" }}>
                <tr>
                  <th style={{ padding: "8px", textTransform: "uppercase", fontSize: "11px", border: "1px solid #ddd" }}>Sr No</th>
                  <th style={{ padding: "8px", textTransform: "uppercase", fontSize: "11px", border: "1px solid #ddd" }}>Emp Code</th>
                  <th style={{ padding: "8px", textTransform: "uppercase", fontSize: "11px", border: "1px solid #ddd" }}>Branch Name</th>
                  <th style={{ padding: "8px", textTransform: "uppercase", fontSize: "11px", border: "1px solid #ddd" }}>State</th>
                  <th style={{ padding: "8px", textTransform: "uppercase", fontSize: "11px", border: "1px solid #ddd" }}>Employee Name</th>
                  <th style={{ padding: "8px", textTransform: "uppercase", fontSize: "11px", border: "1px solid #ddd" }}>Designation</th>
                  <th style={{ padding: "8px", textTransform: "uppercase", fontSize: "11px", border: "1px solid #ddd" }}>Joining Date</th>
                  <th style={{ padding: "8px", textTransform: "uppercase", fontSize: "11px", border: "1px solid #ddd" }}>Email Id</th>
                  <th style={{ padding: "8px", textTransform: "uppercase", fontSize: "11px", border: "1px solid #ddd", width: "100px", textAlign: "center" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {(rows ?? []).map((e, i) => (
                  <tr key={e.emp_code}>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>{i + 1}</td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>{e.emp_code}</td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>{e.unit_name}</td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>{e.state_name}</td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>{e.emp_name}</td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>{e.grade_code}</td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}>{e.joining_date}</td>
                    <td style={{ padding: "8px", border: "1px solid #ddd" }}><input className="form-control" value={edits[e.emp_code] ?? ""} onChange={(ev) => setEdits({ ...edits, [e.emp_code]: ev.target.value })} style={{ width: "100%", padding: "4px 8px", border: "1px solid #ccc", borderRadius: "4px" }} /></td>
                    <td style={{ padding: "8px", border: "1px solid #ddd", textAlign: "center" }}><button className="btn btn-xs btn-primary" style={{ background: "#337ab7", border: "1px solid #2e6da4", color: "#fff", borderRadius: "3px", padding: "2px 8px" }} onClick={() => save(e)}>UPDATE</button></td>
                  </tr>
                ))}
                {rows !== null && rows.length === 0 && <tr><td colSpan={9} style={{ padding: "8px", textAlign: "center", color: "#666" }}>No records found</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
