"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getJSON, mk, responseMessage } from "@/lib/api/legacy-fetch";

/**
 * Transaction.aspx material grid: per employee ID / UNIFORM / SHOES / PANTY_J / APRON "Process" and "Hold"
 * links with the dispatch status (New Request / dispatch / Hold) and the hold reason.  Served by
 * /api/transactions/material-hold/ on pay_document_details.dispatch_flag.  Legacy alerts come from the server
 * (hold link: "<X> Alredy Diapatch"; Hold: "Please Enter Reason !!", " Material Hold Successfully ",
 * "Already Material Disptch ", "Already Material Hold ").
 */
const B = "/api/transactions/material-hold";
const DOCS: { type: string; label: string; process: string; hold: string }[] = [
  { type: "ID_Card", label: "ID", process: "ID Process", hold: "ID Hold" },
  { type: "Uniform", label: "UNIFORM", process: "UNIFORM Process", hold: "UNIFORM Hold" },
  { type: "Shoes", label: "SHOES", process: "SHOES Process", hold: "SHOES Hold" },
  { type: "Pantry_Jacket", label: "PANTY_J", process: "PANTY_J Process", hold: "PANTY_J Hold" },
  { type: "Apron", label: "APRON", process: "APRON  Process", hold: "APRON Hold" },
];

interface Doc { present: boolean; no_of_set: string; size: string; flag: string; status: string; comment: string }
interface Row { emp_code: string; emp_name: string; unit_name: string; [k: string]: any }
interface ClientOpt { client_code: string; client_name: string }
interface UnitOpt { unit_code: string; unit_name: string; state_name: string }
export interface ProcessPrefill {
  client_code: string; state_name: string; unit_code: string; document_type: string; no_of_set: string;
  emp_code: string; emp_name: string; size: string; designation: string; item_code: string; item_name: string;
  description: string; unit: string; vat: number | null; item_type: string;
}

export default function MaterialHoldPanel({ onProcess }: { onProcess?: (p: ProcessPrefill) => void }) {
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [client, setClient] = useState("");
  const [state, setState] = useState("");
  const [unit, setUnit] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [pending, setPending] = useState<any[]>([]);
  const [hold, setHold] = useState<{ emp_code: string; document_type: string } | null>(null);
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    getJSON<{ results: ClientOpt[] }>("/api/masters/clients/?page_size=all").then((d) => setClients(d?.results ?? []));
  }, []);
  const loadPending = useCallback(async () => {
    const d = await getJSON<{ results: any[] }>(`${B}/pending/`).catch(() => null);
    setPending(d?.results ?? []);
  }, []);
  useEffect(() => { if (open) loadPending(); }, [open, loadPending]);

  const states = Array.from(new Set(units.map((u) => u.state_name).filter(Boolean))).sort();
  const unitsOfState = units.filter((u) => !state || u.state_name === state);

  const pickClient = async (code: string) => {
    setClient(code); setState(""); setUnit(""); setRows([]); setHold(null); setUnits([]);
    if (!code) return;
    const d = await getJSON<{ units: UnitOpt[] }>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(code)}`);
    setUnits(d?.units ?? []);
  };
  const loadGrid = async (c = client, u = unit) => {
    if (!c || !u) { setRows([]); return; }
    const d = await getJSON<{ results: Row[]; message?: string }>(`${B}/grid/?client_code=${encodeURIComponent(c)}&unit_code=${encodeURIComponent(u)}`);
    setRows(d?.results ?? []);
    if (d?.message) alert(d.message);          // legacy: alert('No Record !!!')
  };
  const pickUnit = async (u: string) => { setUnit(u); setHold(null); await loadGrid(client, u); };

  const process = async (r: Row, type: string) => {
    const d = await getJSON<ProcessPrefill & { found: boolean }>(`${B}/process/?emp_code=${encodeURIComponent(r.emp_code)}&document_type=${type}`);
    if (d?.found && onProcess) onProcess(d);
  };
  // "<X> Hold" link: refuses an already dispatched document, otherwise opens the Reason box
  const startHold = async (r: Row, type: string) => {
    // legacy R_confirm_valid(): confirm, and "Record not Available" when cancelled
    if (!window.confirm("Please Enter Hold Reason and Click on Hold Button")) { alert("Record not Available"); return; }
    const resp = await mk(`${B}/hold-check/`, { emp_code: r.emp_code, document_type: type });
    if (!resp.ok) { alert(await responseMessage(resp, "Failed")); return; }
    setReason(""); setHold({ emp_code: r.emp_code, document_type: type });
  };
  // Hold button
  const doHold = async () => {
    if (!hold) return;
    if (!reason.trim()) { alert("Please Enter Reason !!"); return; }
    const resp = await mk(`${B}/hold/`, { ...hold, comment: reason });
    if (!resp.ok) { alert(await responseMessage(resp, "Failed")); return; }
    const j = await resp.json().catch(() => ({} as any));
    if (j.status) alert(j.status);
    setHold(null); setReason("");
    await loadGrid(); loadPending();
  };

  return (
    <div style={{ border: "1px solid #ddd", padding: 10, marginBottom: 12 }}>
      <b>Material (ID Card / Uniform / Shoes / Pantry Jacket / Apron) Process &amp; Hold</b>{" "}
      <button onClick={() => setOpen(!open)}>{open ? "Hide" : "Show"}</button>
      {open && (
        <div style={{ marginTop: 8 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            <label>Client Name:{" "}
              <select value={client} onChange={(e) => pickClient(e.target.value)}>
                <option value="">Select</option>
                {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
              </select></label>
            <label>State Name:{" "}
              <select value={state} onChange={(e) => { setState(e.target.value); setUnit(""); setRows([]); }}>
                <option value="">Select</option>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></label>
            <label>Branch Name:{" "}
              <select value={unit} onChange={(e) => pickUnit(e.target.value)}>
                <option value="">Select</option>
                {unitsOfState.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
              </select></label>
          </div>

          {hold && (
            <div style={{ margin: "8px 0", padding: 8, background: "#f3f1fe" }}>
              <b>Reson :</b>{" "}
              <textarea rows={2} maxLength={200} value={reason} onChange={(e) => setReason(e.target.value)} />{" "}
              <button onClick={doHold}>Hold</button>{" "}
              <button onClick={() => { setHold(null); setReason(""); }}>Cancel</button>
            </div>
          )}

          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table className="dt-grid">
              <thead><tr>
                <th>Employee Name</th><th>Branch</th><th>Process</th><th>Hold</th><th>Status</th><th>Reson</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.emp_code}>
                    <td>{r.emp_name}</td><td>{r.unit_name}</td>
                    <td>{DOCS.map((d) => (r[d.type] as Doc)?.present && (
                      <div key={d.type}><a href="#" onClick={(e) => { e.preventDefault(); process(r, d.type); }}>{d.process}</a></div>))}</td>
                    <td>{DOCS.map((d) => (r[d.type] as Doc)?.present && (
                      <div key={d.type}><a href="#" onClick={(e) => { e.preventDefault(); startHold(r, d.type); }}>{d.hold}</a></div>))}</td>
                    <td>{DOCS.map((d) => (r[d.type] as Doc)?.present && (
                      <div key={d.type}>{(r[d.type] as Doc).status}</div>))}</td>
                    <td>{DOCS.map((d) => (r[d.type] as Doc)?.present && (
                      <div key={d.type}>{(r[d.type] as Doc).comment || " "}</div>))}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center" }}>Select a client and branch</td></tr>}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10 }}>
            <b>Pending material (not yet dispatched)</b>
            <table className="dt-grid">
              <thead><tr><th>Client</th><th>State</th><th>Branch</th><th>Employees</th></tr></thead>
              <tbody>
                {pending.map((p, i) => (
                  <tr key={i}><td>{p.client_name}</td><td>{p.state_name}</td><td>{p.unit_name}</td><td>{p.employees}</td></tr>))}
                {pending.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center" }}>No pending material</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
