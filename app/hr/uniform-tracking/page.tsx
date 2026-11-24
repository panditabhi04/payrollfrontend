"use client";
import React, { useState, useEffect } from "react";
import { getJSON, getJSONStrict, mk, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";
import { openPrintHtml, downloadAuthed } from "@/components/hrPrint";

// Legacy Uniform_Tracking.aspx ("Uniform Tracking"): pick Client / State / Branch, then edit
// each employee's uniform / shoes / apron / ID-card sizes and set counts, and issue ID cards.
const B = "/api/hr/uniform-tracking";

type Row = {
  emp_code: string; emp_name: string; designation: string; contact_no: string; id_card_issued?: boolean;
  uniform_size: string; uniform_set: number; uniform_remaining: number; uniform_no_of_sets: number;
  shoes_size: string; shoes_set: number; shoes_remaining: number; shoes_no_of_sets: number;
  apron_size: string; apron_set: number;
  id_card_set: number; id_remaining: number; id_no_of_sets: number;
};
type Opt = { v: string; t: string };

export default function UniformTrackingPage() {
  const [clients, setClients] = useState<Opt[]>([]);
  const [units, setUnits] = useState<{ unit_code: string; unit_name: string; state_name: string }[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [unit, setUnit] = useState("Select");
  const [rows, setRows] = useState<Row[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [lot, setLot] = useState("");
  const [counts, setCounts] = useState<Record<string, number> | null>(null);
  const [busy, setBusy] = useState(false);
  const [printDate, setPrintDate] = useState("");
  const [dupRows, setDupRows] = useState<{ id: number; client_name: string; unit_name: string; emp_code: string; emp_name: string; state_name: string; id_no_set: string; from_date: string; to_date: string }[] | null>(null);
  const [dupChecked, setDupChecked] = useState<Record<number, boolean>>({});

  useEffect(() => {
    getJSON<{ results: { client_code: string; client_name: string }[] }>("/api/masters/clients/?page_size=all")
      .then((d) => setClients((d?.results ?? []).map((c) => ({ v: c.client_code, t: c.client_name }))));
  }, []);
  useEffect(() => {
    setState("Select"); setUnit("Select"); setRows([]);
    if (client === "Select") { setUnits([]); setStates([]); return; }
    getJSON<{ units: { unit_code: string; unit_name: string; state_name: string }[]; states: string[] }>(
      `/api/masters/units/lookup/?client_code=${encodeURIComponent(client)}`).then((d) => {
      const rs = d?.units ?? [];
      setUnits(rs);
      setStates([...(d?.states ?? Array.from(new Set(rs.map((u) => u.state_name).filter(Boolean))))].sort());
    });
    getJSON<Record<string, number>>(`${B}/counts/?client_code=${encodeURIComponent(client)}`).then((c) => setCounts(c));
  }, [client]);
  useEffect(() => { setUnit("Select"); setRows([]); }, [state]);

  const load = async () => {
    if (client === "Select") { alert("Please Select Client Name "); return; }
    if (unit === "Select") { alert("Please Select Branch Name"); return; }
    setBusy(true);
    try {
      const d = await getJSONStrict<{ results: Row[] }>(`${B}/?client_code=${encodeURIComponent(client)}&unit_code=${encodeURIComponent(unit)}`);
      setRows(d.results ?? []);
      setChecked({});
      if (!d.results || d.results.length === 0) alert("No Matching Records Found.");
    } catch (e: any) { alert(e.message); setRows([]); } finally { setBusy(false); }
  };

  const upd = (i: number, k: keyof Row, v: string | number) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const save = async (r: Row) => {
    // Legacy ValidateAll() (lnkinv_update OnClientClick): fires when NO row in the grid has a value.
    const anyVal = (k: string) => rows.some((x) => String((x as any)[k] ?? "") !== "");
    if (!anyVal("contact_no")) { alert("Please Enter Contact Number"); return; }
    if (!anyVal("shoes_size")) { alert("Please Enter Shoes Size"); return; }
    if (!anyVal("uniform_size")) { alert("Please Enter Uniform Size"); return; }
    if (!["uniform_set", "shoes_set", "id_card_set"].some(anyVal)) { alert("Please Enter Uniform Sets"); return; }
    if (!anyVal("apron_set")) { alert("Please Enter Apron Sets"); return; }
    const resp = await mk(`${B}/update_row/`, {
      client_code: client, unit_code: unit, emp_code: r.emp_code, contact_no: r.contact_no,
      uniform_size: r.uniform_size, uniform_set: r.uniform_set,
      shoes_size: r.shoes_size, shoes_set: r.shoes_set,
      apron_size: r.apron_size, apron_set: r.apron_set, id_card_set: r.id_card_set,
    });
    if (!resp.ok) { alert(await responseMessage(resp, "Employee Details Not Updated  ..!!")); return; }
    const b = await resp.json().catch(() => ({} as any));
    alert(b.status || "Document Details Updated Succsefully ..!!");
    load();
  };

  const issue = async () => {
    const emp_codes = Object.keys(checked).filter((k) => checked[k]);
    if (emp_codes.length === 0) { alert("Please select atleast one Employee"); return; }
    const resp = await mk(`${B}/issue_id_cards/`, { emp_codes, lot_no: lot || undefined });
    if (!resp.ok) { alert(await responseMessage(resp, " Id Card Added Failed... !!!")); return; }
    const b = await resp.json().catch(() => ({} as any));
    alert(b.status || "Id Card Added Successfully... !!!");
    load();
  };

  /* legacy Reg_validate_3 / Reg_val_dispatch: client (and branch) must be chosen first */
  const needClient = () => { if (client === "Select") { alert("Please Select Client Name "); return false; } return true; };
  const q = () => `client_code=${encodeURIComponent(client)}${state !== "Select" ? `&state=${encodeURIComponent(state)}` : ""}${unit !== "Select" ? `&unit_code=${encodeURIComponent(unit)}` : ""}`;

  /* legacy btn_clientwise_all_employee_id: ID cards of the ticked employees (issued ones) */
  const printIds = () => {
    const list = rows.filter((r) => r.id_card_issued).map((r) => r.emp_code);
    if (list.length === 0) { alert("this employee first id card not genrated :"); return; }
    void openPrintHtml(`/api/hr/print/id-card/?src=uniform&emp_codes=${list.map(encodeURIComponent).join(",")}`);
  };
  const addressList = () => {
    if (!needClient()) return;
    if (!printDate) { alert("Please Select Address Date"); return; }
    void downloadAuthed(`${B}/address-list/?${q()}&print_date=${encodeURIComponent(printDate)}`, "DISPATCH_ADDRESS_LIST.xlsx");
  };
  const showDup = async () => {
    if (!needClient()) return;
    try {
      const d = await getJSONStrict<{ results: NonNullable<typeof dupRows> }>(`${B}/duplicate-ids/?client_code=${encodeURIComponent(client)}`);
      setDupRows(d.results ?? []); setDupChecked({});
    } catch (e: any) { alert(e.message); }
  };
  const resendDup = async () => {
    const ids = Object.keys(dupChecked).filter((k) => dupChecked[Number(k)]).map(Number);
    if (ids.length === 0) { alert("Please select atleast one Employee"); return; }
    const resp = await mk(`${B}/resend-id-cards/`, { client_code: client, ids });
    if (!resp.ok) { alert(await responseMessage(resp, "Resend failed")); return; }
    const b = await resp.json().catch(() => ({} as any));
    void openPrintHtml(`/api/hr/print/id-card/?duplicate=1&emp_codes=${(b.emp_codes ?? []).map(encodeURIComponent).join(",")}`);
  };

  const num = (r: Row, k: keyof Row, i: number, w = 50) => (
    <input type="number" min={0} value={String(r[k] ?? 0)} style={{ width: w }} onChange={(e) => upd(i, k, e.target.value)} />
  );
  const txt = (r: Row, k: keyof Row, i: number, w = 60) => (
    <input value={String(r[k] ?? "")} style={{ width: w }} onChange={(e) => upd(i, k, e.target.value)} />
  );

  return (
    <div className="lg-panel">
      <div className="lg-panel-head">Uniform Tracking</div>
      <div className="lg-panel-body">
        <div style={{ margin: "8px 0", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <label>Client Name:</label>
          <select value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="Select">Select</option>
            {clients.map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}
          </select>
          <label>State Name:</label>
          <select value={state} onChange={(e) => setState(e.target.value)}>
            <option value="Select">Select</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <label>Branch Name:</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="Select">Select</option>
            {units.filter((u) => state === "Select" || u.state_name === state)
              .map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
          </select>
          <button onClick={load} disabled={busy}>Show</button>
          <a href={`${API_BASE_URL}${B}/export/?client_code=${encodeURIComponent(client === "Select" ? "" : client)}`}
            style={{ marginLeft: 8 }}>Export To Excel</a>
        </div>
        <div style={{ margin: "8px 0", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={printIds} disabled={rows.length === 0}>Client and Branch Wise Id Card</button>
          <button onClick={() => { if (needClient()) void showDup(); }}>Dublicate Id Card Record</button>
          <span>Address Date:</span>
          <input type="date" value={printDate} onChange={(e) => setPrintDate(e.target.value)} />
          <button onClick={addressList}>Address List</button>
          <button onClick={() => { if (needClient()) void downloadAuthed(`${B}/export/?client_code=${encodeURIComponent(client)}`, "UNIFORM_SHOES_DETAILS.xlsx"); }}>Uniform/Shoes Details</button>
          <button onClick={() => void downloadAuthed(`${B}/sales-register/`, "SALES_REGISTER.xlsx")}>Sales Register</button>
          <button onClick={() => { if (needClient()) void downloadAuthed(`${B}/bank-images/?${q()}`, "bank_passbook.zip"); }}>Bank Passbook Images</button>
        </div>
        {dupRows && (
          <div style={{ margin: "8px 0" }}>
            <b>Dublicate Id Card Record</b>
            <table className="dt-grid">
              <thead><tr><th>Select</th><th>Client</th><th>Branch</th><th>State</th><th>Employee</th><th>Sets</th><th>From</th><th>To</th></tr></thead>
              <tbody>
                {dupRows.length === 0 && <tr><td colSpan={8}>No records</td></tr>}
                {dupRows.map((d) => (
                  <tr key={d.id}>
                    <td><input type="checkbox" checked={!!dupChecked[d.id]} onChange={(e) => setDupChecked((m) => ({ ...m, [d.id]: e.target.checked }))} /></td>
                    <td>{d.client_name}</td><td>{d.unit_name}</td><td>{d.state_name}</td>
                    <td>{d.emp_code} - {d.emp_name}</td><td>{d.id_no_set}</td><td>{d.from_date}</td><td>{d.to_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={resendDup}>Resend Id Card</button>{" "}
            <button onClick={() => setDupRows(null)}>Close</button>
          </div>
        )}
        {counts && (
          <div style={{ margin: "6px 0", fontSize: 12 }}>
            <b>{counts.appro_emp_count}</b> Employee Approve By Admin &nbsp;|&nbsp;
            <b>{counts.appro_emp_legal}</b> Employee Approve By Legal (ID card pending) &nbsp;|&nbsp;
            <b>{counts.uniform_dispatch}</b> ID Card Dispatched &nbsp;|&nbsp;
            <b>{counts.uniform_not_dispatch}</b> ID Card Not Dispatched
          </div>
        )}
        <div style={{ overflow: "auto", maxHeight: "60vh", maxWidth: "100%" }}>
        <table className="dt-grid">
          <thead>
            <tr>
              <th>Select</th><th>Code</th><th>Name</th><th>Designation</th><th>Contact</th>
              <th>Uniform Size</th><th>Uniform Set</th><th>Uniform Remaining</th>
              <th>Shoes Size</th><th>Shoes Set</th><th>Shoes Remaining</th>
              <th>Apron Size</th><th>Apron Set</th>
              <th>ID Card Set</th><th>ID Card Remaining</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.emp_code}>
                <td><input type="checkbox" disabled={!!r.id_card_issued} checked={!!checked[r.emp_code]}
                  onChange={(e) => setChecked((m) => ({ ...m, [r.emp_code]: e.target.checked }))} /></td>
                <td>{r.emp_code}</td><td>{r.emp_name}</td><td>{r.designation}</td>
                <td><input value={r.contact_no} maxLength={10} style={{ width: 100 }} onChange={(e) => upd(i, "contact_no", e.target.value.replace(/\D/g, ""))} /></td>
                <td>{txt(r, "uniform_size", i)}</td><td>{num(r, "uniform_set", i)}</td><td>{r.uniform_remaining}</td>
                <td>{txt(r, "shoes_size", i)}</td><td>{num(r, "shoes_set", i)}</td><td>{r.shoes_remaining}</td>
                <td>{txt(r, "apron_size", i)}</td><td>{num(r, "apron_set", i)}</td>
                <td>{num(r, "id_card_set", i)}</td><td>{r.id_remaining}</td>
                <td><button onClick={() => save(r)}>Update</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={16}>Select Client and Branch, then click Show.</td></tr>}
          </tbody>
        </table>
        </div>
        {rows.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
            <label>Lot Number:</label>
            <input type="number" min={1} value={lot} style={{ width: 80 }} onChange={(e) => setLot(e.target.value)} />
            <button onClick={issue}>Generate ID Card</button>
          </div>
        )}
      </div>
    </div>
  );
}
