"use client";
import React, { useCallback, useEffect, useState } from "react";
import { getJSON, mk, rm, upload, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

// Legacy consumable.aspx ("Consumable Material Dispatch", pay_consumable_dispatch_history):
// Month / Client / [Region] / State / Branch -> Process creates one row per branch; per row choose
// Material Type, Dispatch Date, Remark and upload the challan (JPG/PNG/JPEG/PDF), then Save.
// The history grid below lists the saved records of the client + month (download / delete).
const B = "/api/transactions/consumable-dispatch/";
const MATERIALS = ["Chemicals", "Housekeeping Materials", "Uniform", "Pantry Jacket", "Apron", "Shoes", "ID Card", "Machine", "Other"];
const REGION_CLIENT_NAMES = ["Piramal Capital & Housing Finance Limited", "BAJAJ ALLIANZ GENERAL INSURANCE COMPANY LTD."];

interface GridRow {
  id: number; month_year: string; client_name: string; region: string; state: string; unit_code: string; unit_name: string;
  material_type: string; dispatch_date: string; status: string; consumable_file: string; remark: string; file: string;
}
interface Edit { checked?: boolean; material?: string; date?: string; remark?: string; file?: File | null }
const today = () => new Date().toISOString().slice(0, 10);
// <input type="month"> gives YYYY-MM; the legacy text box is MM/YYYY
const toMY = (m: string) => (/^\d{4}-\d{2}$/.test(m) ? `${m.slice(5)}/${m.slice(0, 4)}` : "");

export default function ConsumableDispatchPage() {
  const [month, setMonth] = useState("");
  const [clients, setClients] = useState<{ client_code: string; client_name: string }[]>([]);
  const [client, setClient] = useState("Select");
  const [regions, setRegions] = useState<string[]>([]);
  const [region, setRegion] = useState("Select");
  const [states, setStates] = useState<string[]>([]);
  const [state, setState] = useState("Select");
  const [units, setUnits] = useState<{ unit_code: string; unit_name: string }[]>([]);
  const [unit, setUnit] = useState("Select");
  const [grid, setGrid] = useState<GridRow[] | null>(null);
  const [edits, setEdits] = useState<Record<number, Edit>>({});
  const [history, setHistory] = useState<GridRow[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);

  const clientName = clients.find((c) => c.client_code === client)?.client_name ?? "";
  const showRegion = REGION_CLIENT_NAMES.includes(clientName);
  const my = toMY(month);
  const setEdit = (id: number, p: Edit) => setEdits((e) => ({ ...e, [id]: { ...(e[id] || {}), ...p } }));
  const alertMsg = (t: string) => window.alert(t);

  useEffect(() => {
    getJSON<{ results: typeof clients }>(`${B}clients/`).then((d) => setClients(d?.results ?? []));
  }, []);

  const loadHistory = useCallback(async (c: string, m: string) => {
    if (!c || c === "Select" || !m) { setHistory([]); return; }
    const d = await getJSON<{ rows: GridRow[] }>(`${B}history/?client_code=${encodeURIComponent(c)}&month_year=${encodeURIComponent(m)}`);
    setHistory(d?.rows ?? []); setShowHistory(true);
  }, []);
  useEffect(() => { loadHistory(client, my); }, [client, my, loadHistory]);

  const pickClient = async (code: string) => {
    setClient(code); setState("Select"); setStates([]); setUnit("Select"); setUnits([]); setRegion("Select"); setRegions([]); setGrid(null);
    if (!code || code === "Select") return;
    const [s, r] = await Promise.all([
      getJSON<{ results: string[] }>(`${B}states/?client_code=${encodeURIComponent(code)}`),
      getJSON<{ results: string[] }>(`${B}regions/?client_code=${encodeURIComponent(code)}`),
    ]);
    setStates(s?.results ?? []); setRegions(r?.results ?? []);
  };
  const pickRegion = async (r: string) => {
    setRegion(r); setState("Select"); setUnit("Select"); setUnits([]);
    if (r === "Select") return;
    const d = await getJSON<{ results: string[] }>(`${B}region-states/?client_code=${encodeURIComponent(client)}&region=${encodeURIComponent(r)}`);
    setStates(d?.results ?? []);
  };
  const pickState = async (s: string) => {
    setState(s); setUnit("Select"); setUnits([]);
    if (s === "Select") return;
    const d = await getJSON<{ results: typeof units }>(
      `${B}branches/?client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(s)}&region=${encodeURIComponent(region === "Select" ? "" : region)}`);
    setUnits(d?.results ?? []);
  };

  const process = async () => {
    // C_validation(): verbatim order
    if (!month) return alertMsg("Please Select Month And Year");
    if (client === "Select") return alertMsg("Please Select Client Name");
    if (state === "Select") return alertMsg("Please Select State Name");
    if (unit === "Select") return alertMsg("Please Select Branch Name");
    setBusy(true);
    const r = await mk(`${B}process/`, {
      month_year: my, client_code: client, client_name: clientName, region: showRegion && region !== "Select" ? region : "",
      state, unit_code: unit, unit_name: units.find((u) => u.unit_code === unit)?.unit_name ?? "",
    });
    setBusy(false);
    if (!r.ok) { alertMsg(await responseMessage(r, "Failed")); return; }
    const d = await r.json();
    if (d.message) alertMsg(d.message);
    setEdits({});
    setGrid(d.rows ?? []);
    if ((d.rows ?? []).length) setShowHistory(false); else loadHistory(client, my);
  };

  const reloadGrid = async () => {
    const d = await getJSON<{ rows: GridRow[] }>(
      `${B}grid/?client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}&unit_code=${encodeURIComponent(unit)}&month_year=${encodeURIComponent(my)}`);
    setGrid(d?.rows ?? []);
  };

  const ticked = () => (grid ?? []).filter((r) => edits[r.id]?.checked);
  // material_approve_validation()
  const needOne = () => { if (!ticked().length) { alertMsg("Please select atleast one Record "); return false; } return true; };

  const doUpload = async () => {
    if (!needOne()) return;
    for (const r of ticked()) {
      const f = edits[r.id]?.file;
      if (!f) { alertMsg(" Please select correct record !!!"); continue; }
      const fd = new FormData();
      fd.append("id", String(r.id)); fd.append("file", f);
      const res = await upload(`${B}upload-file/`, fd);
      alertMsg(res.ok ? "File uploaded Succsefully !!!" : await responseMessage(res, "Failed"));
    }
    reloadGrid();
  };

  const doSave = async () => {
    if (!needOne()) return;
    const items = ticked().map((r) => ({ id: r.id, material_type: edits[r.id]?.material ?? "", dispatch_date: edits[r.id]?.date ?? "", remark: edits[r.id]?.remark ?? r.remark ?? "" }));
    const res = await mk(`${B}save/`, { items });
    if (!res.ok) { alertMsg(await responseMessage(res, "Failed")); return; }
    const d = await res.json();
    (d.messages ?? []).forEach((m: string) => alertMsg(m));
    if (d.saved > 0) { setGrid(null); loadHistory(client, my); } else reloadGrid();
  };

  const del = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this Record?")) return;
    const r = await rm(`${B}${id}/`);
    if (r.ok) alertMsg("Record Deleted Successfully... !!!"); else alertMsg(await responseMessage(r, "Failed"));
    loadHistory(client, my);
    if (grid) reloadGrid();
  };

  const download = async (id: number, name: string) => {
    if (!name) { alertMsg("Attachment File Cannot Be Uploaded !!!"); return; }
    try {
      const res = await fetch(`${API_BASE_URL}${B}${id}/download/`, { credentials: "include" });
      if (!res.ok) { alertMsg("File Can not Found!!."); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href);
    } catch { alertMsg("File Can not Found!!."); }
  };

  const allChecked = !!grid?.length && grid.every((r) => edits[r.id]?.checked);

  return (
    <div className="panel panel-primary">
      <div className="panel-heading text-center text-uppercase"><b>Consumable Material Dispatch</b></div>
      <div className="panel-body">
        <div className="panel panel-primary" style={{ background: "beige", borderColor: "#c4c0c0" }}>
          <div className="panel-body">
            <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
              <div style={{ minWidth: 150 }}><b>Month :</b><span className="text-red"> *</span>
                <input type="month" className="form-control" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
              <div style={{ minWidth: 200 }}><b>Client Name :</b><span className="text-red"> *</span>
                <select className="form-control" value={client} onChange={(e) => pickClient(e.target.value)}>
                  <option value="Select">Select</option>
                  {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
                </select></div>
              {showRegion && (
                <div style={{ minWidth: 150 }}><b>Region :</b><span className="text-red"> *</span>
                  <select className="form-control" value={region} onChange={(e) => pickRegion(e.target.value)}>
                    <option value="Select">Select</option><option value="ALL">ALL</option>
                    {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select></div>
              )}
              <div style={{ minWidth: 170 }}><b>State Name :</b><span className="text-red"> *</span>
                <select className="form-control" value={state} onChange={(e) => pickState(e.target.value)}>
                  <option value="Select">Select</option>
                  {states.map((s) => <option key={s} value={s}>{s}</option>)}
                </select></div>
              <div style={{ minWidth: 200 }}><b>Branch Name :</b><span className="text-red"> *</span>
                <select className="form-control" value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="Select">Select</option><option value="ALL">ALL</option>
                  {units.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
                </select></div>
              <div><button type="button" className="btn btn-primary" disabled={busy} onClick={process}>Process</button></div>
            </div>
          </div>
        </div>

        {grid && grid.length > 0 && (
          <div className="container-fluid grid-view">
            <table className="table">
              <thead><tr>
                <th>Delete</th>
                <th><label><input type="checkbox" checked={allChecked}
                  onChange={(e) => setEdits(Object.fromEntries((grid ?? []).map((r) => [r.id, { ...(edits[r.id] || {}), checked: e.target.checked }])))} /> SELECT RECORD</label></th>
                <th>Sr No.</th><th>Month</th><th>Client Name</th><th>Region</th><th>State</th><th>Branch Name</th>
                <th>Material Type</th><th>Dispatch Date</th>
                <th>FILE (Only JPG, PNG,JPEG and PDF files will be uploaded.)</th><th>Uploaded File (Yes/No)</th><th>DOWNLOAD</th><th>Remark</th>
              </tr></thead>
              <tbody>
                {grid.map((r, i) => {
                  const e = edits[r.id] || {};
                  return (
                    <tr key={r.id}>
                      <td><button type="button" className="btn btn-link" onClick={() => del(r.id)} title="Delete">&#128465;</button></td>
                      <td><input type="checkbox" checked={!!e.checked} onChange={(ev) => setEdit(r.id, { checked: ev.target.checked })} /></td>
                      <td>{i + 1}</td><td>{r.month_year}</td><td>{r.client_name}</td><td>{r.region}</td><td>{r.state}</td><td>{r.unit_name}</td>
                      <td><select className="form-control" style={{ width: 150 }} value={e.material ?? ""} onChange={(ev) => setEdit(r.id, { material: ev.target.value })}>
                        <option value="">Select</option>
                        {MATERIALS.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select></td>
                      <td><input type="date" className="form-control" max={today()} value={e.date ?? ""} onChange={(ev) => setEdit(r.id, { date: ev.target.value })} /></td>
                      <td><input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(ev) => setEdit(r.id, { file: ev.target.files?.[0] ?? null })} /></td>
                      <td>{r.file}</td>
                      <td><button type="button" className="btn btn-primary btn-xs" onClick={() => download(r.id, r.consumable_file)}>DOWNLOAD</button></td>
                      <td><input type="text" className="form-control" maxLength={50} value={e.remark ?? r.remark ?? ""} onChange={(ev) => setEdit(r.id, { remark: ev.target.value })} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="row text-center">
              <button type="button" className="btn btn-primary" onClick={doSave}>Save</button>{" "}
              <button type="button" className="btn btn-primary" onClick={doUpload}>Upload</button>
            </div>
          </div>
        )}

        {showHistory && (
          <div className="container-fluid" style={{ overflow: "auto", maxHeight: 300 }}>
            <table className="table">
              <thead><tr>
                <th>Delete</th><th>Sr No.</th><th>Month</th><th>Client Name</th><th>Region</th><th>State</th><th>Branch Name</th>
                <th>Material Type</th><th>Dispatch Date</th><th>Status</th><th>File Name</th><th>Remark</th>
              </tr></thead>
              <tbody>
                {history.map((r, i) => (
                  <tr key={r.id}>
                    <td><button type="button" className="btn btn-link" onClick={() => del(r.id)} title="Delete">&#128465;</button></td>
                    <td>{i + 1}</td><td>{r.month_year}</td><td>{r.client_name}</td><td>{r.region}</td><td>{r.state}</td><td>{r.unit_name}</td>
                    <td>{r.material_type}</td><td>{r.dispatch_date}</td><td>{r.status}</td>
                    <td><button type="button" className="btn btn-link" onClick={() => download(r.id, r.consumable_file)}>{r.consumable_file}</button></td>
                    <td>{r.remark}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
