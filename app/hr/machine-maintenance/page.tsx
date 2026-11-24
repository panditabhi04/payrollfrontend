"use client";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getJSON, mk, patchJSON, rm } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

// Legacy Machin_Maintainance_Tracking.aspx — "Machin Maintainance and Tracking".
// Tab1 "Machin Tracking"  -> pay_machine_rental_details shape (machine + client +
//   state + location + rental window), grid rebinds per selected client.
// Tab2 "Machin Servicing / Maintainance" -> pay_machine_servicing_details
//   (machine + servicing window + warranty + next servicing + document upload),
//   row click loads the record into the form (hidden txt_id), Save / Update /
//   Delete / Close, IMAGE column with zoom dialog.
// Dropdowns carry REAL backend data: machines (item-masters product_service=
// Machine), clients (masters clients), states + locations (units lookup cascade).
const MT = "/api/transactions/machine-tracking/";
const MS = "/api/transactions/machine-servicing/";
// Machine dropdown: page-scoped lookup (legacy Machine_list equivalent —
// product_service='Machine', caller's company). Gated by this page's menu,
// so whoever can open the page sees the machines.
const MACHINES_URL = "/api/transactions/machine-options/";
// Legacy client()/ddl_client/ddl_state cascades: clients with material_rental_policy = '1' inside the user's
// reporting series; states and active branches from pay_client_state_role_grade.
const CLIENTS_URL = "/api/transactions/machine-options/clients/";
const STATES_URL = "/api/transactions/machine-options/states/";
const LOCATIONS_URL = "/api/transactions/machine-options/locations/";

interface MachineOpt { item_code: string; item_name: string }
interface ClientOpt { client_code: string; client_name: string }
interface UnitOpt { unit_code: string; unit_name: string }
interface TrackRow {
  id: number; machine_code: string; machine_name: string; client_code: string;
  state: string; unit_code: string; rental_from?: string | null; rental_to?: string | null;
  client_name?: string; unit_name?: string;
}
interface ServiceRow {
  id: number; machine_code: string; machine_name: string;
  servicing_from_date?: string | null; servicing_to_date?: string | null;
  warranty_type?: string; warranty_in?: string; next_servicing_date?: string | null;
  image?: string; file_url?: string;
}

const fmtDMY = (iso?: string | null) => {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

async function multipart(method: "POST" | "PATCH", path: string, fields: Record<string, string>, file?: File | null): Promise<Response> {
  await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
  const fd = new FormData();
  Object.entries(fields).forEach(([k, v]) => fd.append(k, v));
  if (file) fd.append("service_document_file", file);
  return fetch(`${API_BASE_URL}${path}`, {
    method, credentials: "include",
    headers: { "X-CSRFToken": getCookie("csrftoken") ?? "" },
    body: fd,
  });
}

// Legacy AllowAlphabet_address(event) key filter for the Warranty textbox.
// (The legacy `(key==39 && key==34)` clause could never fire, so it is dropped;
// everything else is a literal port.)
function allowAlphabetAddress(e: React.KeyboardEvent) {
  const keyEntry = (e.which || e.keyCode) as number;
  const ok =
    ((keyEntry >= 65) && (keyEntry <= 90)) || ((keyEntry >= 97) && (keyEntry <= 122)) ||
    (keyEntry < 31) || ((keyEntry >= 48) && (keyEntry <= 57)) ||
    (keyEntry === 32) || (keyEntry === 38) ||
    (keyEntry === 44) || ((keyEntry >= 45) && (keyEntry <= 47)) ||
    (keyEntry === 58) || (keyEntry === 59) || (keyEntry === 61) || (keyEntry === 92);
  if (!ok) e.preventDefault();
}

function downloadCSV(filename: string, headers: string[], lines: string[][]) {
  const esc = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.map(esc).join(","), ...lines.map((l) => l.map(esc).join(","))].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export default function MachineMaintenancePage() {
  const router = useRouter();
  const [tab, setTab] = useState(0); // hidtab
  const [blocked, setBlocked] = useState(false);
  const [machines, setMachines] = useState<MachineOpt[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [machineError, setMachineError] = useState("");

  useEffect(() => {
    try {
      const v = window.localStorage.getItem("mm_hidtab");
      if (v === "1") setTab(1);
    } catch { /* ignore */ }
    getJSON<{ results: MachineOpt[] } | MachineOpt[]>(MACHINES_URL).then((d) => {
      const raw = (Array.isArray(d) ? d : (d?.results ?? [])) as MachineOpt[];
      // Dedupe by item_code (legacy table repeats the same ITEM_CODE twice —
      // both options would save the identical value, so one entry is enough).
      const seen = new Set<string>();
      const list = raw.filter((m) => {
        const k = (m.item_code || m.item_name || "").trim();
        if (!k || seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      setMachines(list);
      if (!list.length) setMachineError("Machine list is empty — please add items with product_service='Machine' in Item Master.");
    }).catch(() => setMachineError("Failed to load machine list — please check login / page permission."));
    getJSON<{ results: ClientOpt[] } | ClientOpt[]>(CLIENTS_URL).then((d) =>
      setClients(Array.isArray(d) ? d : (d?.results ?? [])));
  }, []);

  const pickTab = (t: number) => {
    setTab(t);
    try { window.localStorage.setItem("mm_hidtab", String(t)); } catch { /* ignore */ }
  };

  // ---------------- Tab1: Machin Tracking ----------------
  const [tMachine, setTMachine] = useState("Select");
  const [tClient, setTClient] = useState("Select");
  const [tState, setTState] = useState("Select");
  const [tLocation, setTLocation] = useState("Select");
  const [tFrom, setTFrom] = useState("");
  const [tTo, setTTo] = useState("");
  const [states, setStates] = useState<string[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [allUnits, setAllUnits] = useState<UnitOpt[]>([]);
  const [trackRows, setTrackRows] = useState<TrackRow[]>([]);
  const [tSearch, setTSearch] = useState("");
  const [tPage, setTPage] = useState(1);
  const [tHidden, setTHidden] = useState<string[]>([]); // colvis
  const tMachineRef = useRef<HTMLSelectElement>(null);
  const tClientRef = useRef<HTMLSelectElement>(null);
  const tStateRef = useRef<HTMLSelectElement>(null);
  const tLocationRef = useRef<HTMLSelectElement>(null);
  const tFromRef = useRef<HTMLInputElement>(null);
  const tToRef = useRef<HTMLInputElement>(null);

  // grid labels come from the server join (CLIENT_Name / unit_name); fall back to the dropdown lists / code
  const clientName = (code: string, r?: TrackRow) =>
    r?.client_name || (clients.find((c) => c.client_code === code)?.client_name ?? code);
  const unitName = (code: string, r?: TrackRow) =>
    r?.unit_name || (units.find((u) => u.unit_code === code)?.unit_name
      ?? allUnits.find((u) => u.unit_code === code)?.unit_name ?? code);

  const loadTrack = useCallback(async (clientCode: string) => {
    if (!clientCode || clientCode === "Select") { setTrackRows([]); return; }
    const d = await getJSON<{ results: TrackRow[] } | TrackRow[]>(`${MT}?client_code=${encodeURIComponent(clientCode)}`);
    const rows = (Array.isArray(d) ? d : (d?.results ?? [])) as TrackRow[];
    setTrackRows(rows);
    setTPage(1);
  }, []);

  const onTClient = async (v: string) => {
    setTClient(v); setTState("Select"); setTLocation("Select"); setUnits([]); setAllUnits([]); setStates([]);
    if (!v || v === "Select") { setTrackRows([]); return; }
    const d = await getJSON<string[]>(`${STATES_URL}?client_code=${encodeURIComponent(v)}`);
    setStates(Array.isArray(d) ? d : []);
    loadTrack(v); // legacy ddl_client AutoPostBack -> machine_gv(client)
  };

  const onTState = async (v: string) => {
    setTState(v); setTLocation("Select");
    if (!v || v === "Select" || !tClient || tClient === "Select") return;
    const d = await getJSON<UnitOpt[]>(
      `${LOCATIONS_URL}?client_code=${encodeURIComponent(tClient)}&state=${encodeURIComponent(v)}`);
    const list = Array.isArray(d) ? d : [];
    setUnits(list);
    setAllUnits((p) => [...p.filter((u) => !list.some((x) => x.unit_code === u.unit_code)), ...list]);
  };

  // Legacy Req_validation() — exact messages + focus order.
  const reqValidation = () => {
    if (!tMachine || tMachine === "Select") { alert("Please Select Machine Name"); tMachineRef.current?.focus(); return false; }
    if (!tClient || tClient === "Select") { alert("Please Select Machine Name"); tClientRef.current?.focus(); return false; }
    if (!tState || tState === "Select") { alert("Please Select State"); tStateRef.current?.focus(); return false; }
    if (!tLocation || tLocation === "Select") { alert("Please Select Location"); tLocationRef.current?.focus(); return false; }
    if (!tFrom) { alert("Please Select Start Date"); tFromRef.current?.focus(); return false; }
    if (!tTo) { alert("Please Select End Date"); tToRef.current?.focus(); return false; }
    return true;
  };

  const addMachine = async () => {
    if (!reqValidation()) return;
    setBlocked(true); // $.blockUI
    try {
      const m = machines.find((x) => x.item_code === tMachine);
      const r = await mk(MT, {
        machine_code: m?.item_code ?? tMachine,
        machine_name: m?.item_name ?? tMachine,
        client_code: tClient, state: tState, unit_code: tLocation,
        rental_from: tFrom, rental_to: tTo,
      });
      if (r.ok) {
        alert("Records Inserted successfully!!");
        setTMachine("Select"); setTFrom(""); setTTo("");
        setTState("Select"); setTLocation("Select");
        loadTrack(tClient);
      } else {
        const b = await r.json().catch(() => ({}));
        alert(typeof b === "string" ? b : JSON.stringify(b));
      }
    } finally { setBlocked(false); } // unblock()
  };

  const delTrack = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    const r = await rm(`${MT}${id}/`);
    if (r.ok) { alert("Records Deleted successfully!!"); loadTrack(tClient); }
    else alert(`Delete failed (${r.status})`);
  };

  // ---------------- Tab2: Machin Servicing / Maintainance ----------------
  const [sMachine, setSMachine] = useState("Select");
  const [sFrom, setSFrom] = useState("");
  const [sTo, setSTo] = useState("");
  const [sWarranty, setSWarranty] = useState("Select");
  const [sWarrantyIn, setSWarrantyIn] = useState("");
  const [sNext, setSNext] = useState("");
  const [sFile, setSFile] = useState<File | null>(null);
  const [sId, setSId] = useState(""); // txt_id (hidden)
  const [svcRows, setSvcRows] = useState<ServiceRow[]>([]);
  const [sSearch, setSSearch] = useState("");
  const [sPage, setSPage] = useState(1);
  const [sHidden, setSHidden] = useState<string[]>([]);
  const [zoom, setZoom] = useState<string | null>(null);
  const sMachineRef = useRef<HTMLSelectElement>(null);
  const sFromRef = useRef<HTMLInputElement>(null);
  const sToRef = useRef<HTMLInputElement>(null);
  const sWarrantyRef = useRef<HTMLSelectElement>(null);
  const sWarrantyInRef = useRef<HTMLInputElement>(null);
  const sNextRef = useRef<HTMLInputElement>(null);
  const sFileRef = useRef<HTMLInputElement>(null);

  const loadSvc = useCallback(async () => {
    const d = await getJSON<{ results: ServiceRow[] } | ServiceRow[]>(MS);
    setSvcRows(Array.isArray(d) ? d : (d?.results ?? []));
    setSPage(1);
  }, []);
  useEffect(() => { loadSvc(); }, [loadSvc]);

  // Legacy upload_validation() — exact messages + focus order.
  const uploadValidation = (isSave: boolean) => {
    if (!sMachine || sMachine === "Select") { alert("Please Select Machine Name"); sMachineRef.current?.focus(); return false; }
    if (!sFrom) { alert("Please Select Start Date"); sFromRef.current?.focus(); return false; }
    if (!sTo) { alert("Please Select End Date"); sToRef.current?.focus(); return false; }
    if (!sWarranty || sWarranty === "Select") { alert("Please Select Warranty Type"); sWarrantyRef.current?.focus(); return false; }
    if (!sWarrantyIn.trim()) { alert("Please Enter Warranty (In Hr/Days/Month)"); sWarrantyInRef.current?.focus(); return false; }
    if (!sNext) { alert("Please Enter next Servicing"); sNextRef.current?.focus(); return false; }
    if (isSave && !sFile) { alert("Please Select Document to Upload"); sFileRef.current?.focus(); return false; }
    if (sFile) {
      const ext = ("." + (sFile.name.split(".").pop() ?? "")).toLowerCase();
      if (![".jpg", ".jpeg", ".png", ".pdf"].includes(ext)) {
        alert("Please select only JPG and PNG Images !!!");
        sFileRef.current?.focus();
        return false;
      }
    }
    return true;
  };

  const svcFields = () => {
    const m = machines.find((x) => x.item_code === sMachine);
    return {
      machine_code: m?.item_code ?? sMachine,
      machine_name: m?.item_name ?? sMachine,
      servicing_from_date: sFrom, servicing_to_date: sTo,
      warranty_type: sWarranty, warranty_in: sWarrantyIn.trim(),
      next_servicing_date: sNext,
    };
  };

  const clearService = () => {
    setSMachine("Select"); setSFrom(""); setSTo(""); setSWarranty("Select");
    setSWarrantyIn(""); setSNext(""); setSFile(null); setSId("");
    if (sFileRef.current) sFileRef.current.value = "";
  };

  const saveService = async () => {
    if (!uploadValidation(true)) return;
    setBlocked(true);
    try {
      const r = await multipart("POST", MS, svcFields(), sFile);
      const b = await r.json().catch(() => ({}));
      if (r.ok) { alert("Records Add successfully!!"); clearService(); loadSvc(); }
      else alert((b as { detail?: string }).detail ?? JSON.stringify(b));
    } finally { setBlocked(false); }
  };

  const updateService = async () => {
    if (!sId) { alert("Please select a record from the grid"); return; }
    if (!uploadValidation(false)) return;
    setBlocked(true);
    try {
      // JSON fields first (legacy UPDATE row), then the document when chosen.
      const r = await patchJSON(`${MS}${sId}/`, svcFields());
      if (!r.ok) {
        const b = await r.json().catch(() => ({}));
        alert(JSON.stringify(b));
        return;
      }
      if (sFile) {
        const rf = await multipart("PATCH", `${MS}${sId}/`, {}, sFile);
        if (!rf.ok) {
          const b = await rf.json().catch(() => ({}));
          alert((b as { detail?: string }).detail ?? JSON.stringify(b));
          return;
        }
      }
      alert("Records Update successfully!!");
      clearService(); loadSvc();
    } finally { setBlocked(false); }
  };

  const deleteService = async () => {
    if (!sId) { alert("Please select a record from the grid"); return; }
    if (!window.confirm("Are you sure you want to delete this event?")) return;
    const r = await rm(`${MS}${sId}/`);
    if (r.ok) { alert("Records Deleted successfully!!"); clearService(); loadSvc(); }
    else alert(`Delete failed (${r.status})`);
  };

  // Legacy gv_machine_s row click -> load into form (txt_id hidden).
  const selectSvcRow = (r: ServiceRow) => {
    const code = machines.find((m) => m.item_code === r.machine_code)?.item_code
      ?? (machines.find((m) => m.item_name === r.machine_name)?.item_code ?? "Select");
    setSMachine(code !== "Select" ? code : "Select");
    setSFrom((r.servicing_from_date ?? "").slice(0, 10));
    setSTo((r.servicing_to_date ?? "").slice(0, 10));
    setSWarranty(r.warranty_type && ["Hr", "Days", "Month"].includes(r.warranty_type) ? r.warranty_type : "Select");
    setSWarrantyIn(r.warranty_in ?? "");
    setSNext((r.next_servicing_date ?? "").slice(0, 10));
    setSFile(null);
    if (sFileRef.current) sFileRef.current.value = "";
    setSId(String(r.id));
  };

  // ---- grid helpers (DataTables parity: search + full_numbers paging + export + colvis) ----
  const PAGE_SIZE = 10;
  const pager = (total: number) => (
    <div style={{ textAlign: "left", padding: "8px", background: "#2461BF", color: "#fff", fontWeight: "bold" }}>Total: {total} records</div>
  );

  const tFiltered = trackRows.filter((r) =>
    !tSearch || `${r.machine_name} ${r.machine_code} ${clientName(r.client_code, r)} ${r.state} ${unitName(r.unit_code, r)}`.toLowerCase().includes(tSearch.toLowerCase()));
    const tPageRows = tFiltered; // all rows, no paging

  const sFiltered = svcRows.filter((r) =>
    !sSearch || `${r.machine_name} ${r.machine_code} ${r.warranty_type} ${r.warranty_in}`.toLowerCase().includes(sSearch.toLowerCase()));
    const sPageRows = sFiltered; // all rows, no paging

  const toggleHidden = (list: string[], setList: (v: string[]) => void, col: string) =>
    setList(list.includes(col) ? list.filter((c) => c !== col) : [...list, col]);

  const tCols = ["Machine Name", "Client Name", "State Name", "Location", "Rental From", "Rental To"];
  const tLines = tFiltered.map((r) => [r.machine_name || r.machine_code, clientName(r.client_code, r), r.state, unitName(r.unit_code, r), fmtDMY(r.rental_from), fmtDMY(r.rental_to)]);
  const sCols = ["machine Name", "Servicing Date From", "Servicing To Date", "Warranty Type", "warranty", "Next Service Date", "IMAGE"];
  const sLines = sFiltered.map((r) => [r.machine_name || r.machine_code, fmtDMY(r.servicing_from_date), fmtDMY(r.servicing_to_date), r.warranty_type ?? "", r.warranty_in ?? "", fmtDMY(r.next_servicing_date), r.image ?? ""]);

  return (
    <div className="container-fluid">
      {blocked && (
        <div style={{ position: "fixed", inset: 0, background: "#CCCCCC", opacity: 0.7, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
          Please wait...
        </div>
      )}
      <div className="panel panel-primary">
        <div className="panel-heading">
          <div className="row">
            <div className="col-sm-1"></div>
            <div className="col-sm-9">
              <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase"><b>Machin Maintainance and Tracking</b></div>
            </div>
            <div className="col-sm-2 text-right">
              <a href="#" onClick={(e) => { e.preventDefault(); window.open("/html/Machin_Maintainance_Tracking.html", "popUpWindow", "height=500,width=600,left=100,top=100"); }} style={{ color: "#fff" }}>
                <img src="/Images/help_ico.png" alt="Help" width={20} height={20} title="Help" />
              </a>
            </div>
          </div>
        </div>
        <br />
        <div className="container-fluid">
          <div id="tabs" style={{ background: "beige" }}>
            <ul style={{ listStyle: "none", display: "flex", gap: "4px", padding: "8px 8px 0 8px", margin: 0 }}>
              <li style={{ background: tab === 0 ? "#fff" : "#e7e7fa", border: "1px solid #ccc", borderBottom: tab === 0 ? "1px solid #fff" : "1px solid #ccc", borderRadius: "4px 4px 0 0", padding: "6px 14px" }}>
                <a href="#menu1" onClick={(e) => { e.preventDefault(); pickTab(0); }} style={{ textDecoration: "none", color: "#333", fontWeight: tab === 0 ? "bold" : "normal" }}>Machin Tracking</a>
              </li>
              <li style={{ background: tab === 1 ? "#fff" : "#e7e7fa", border: "1px solid #ccc", borderBottom: tab === 1 ? "1px solid #fff" : "1px solid #ccc", borderRadius: "4px 4px 0 0", padding: "6px 14px" }}>
                <a href="#menu2" onClick={(e) => { e.preventDefault(); pickTab(1); }} style={{ textDecoration: "none", color: "#333", fontWeight: tab === 1 ? "bold" : "normal" }}>Machin Servicing / Maintainance</a>
              </li>
            </ul>

            {tab === 0 && (
              <div id="menu1">
                <div className="container-fluid" style={{ border: "1px solid white", borderRadius: "10px", backgroundColor: "#e7e7fa" }}>
                  <br />
                  <div className="row">
                    <div className="col-sm-2 col-xs-12">
                      Select Machine:
                      <select ref={tMachineRef} className="form-control" value={tMachine} onChange={(e) => setTMachine(e.target.value)}>
                        <option value="Select">Select</option>
                        {machines.map((m) => <option key={m.item_code} value={m.item_code}>{m.item_name}</option>)}
                      </select>
                      {machineError && machines.length === 0 && <div style={{ color: "#a94442", fontSize: "11px" }}>{machineError}</div>}
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      Select Client:
                      <select ref={tClientRef} className="form-control" value={tClient} onChange={(e) => onTClient(e.target.value)}>
                        <option value="Select">Select</option>
                        {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
                      </select>
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      Select State:
                      <select ref={tStateRef} className="form-control" value={tState} onChange={(e) => onTState(e.target.value)}>
                        <option value="Select">Select</option>
                        {states.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      Select Location:
                      <select ref={tLocationRef} className="form-control" value={tLocation} onChange={(e) => setTLocation(e.target.value)}>
                        <option value="Select">Select</option>
                        {units.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
                      </select>
                    </div>
                    <div className="col-sm-2 col-xs-12" style={{ width: "15%" }}>
                      Rental From Date:
                      <input ref={tFromRef} type="date" className="form-control" value={tFrom} max={tTo || undefined} onChange={(e) => setTFrom(e.target.value)} />
                    </div>
                    <div className="col-sm-2 col-xs-12" style={{ width: "10%" }}>
                      Rental To Date:
                      <input ref={tToRef} type="date" className="form-control" value={tTo} min={tFrom || undefined} onChange={(e) => setTTo(e.target.value)} />
                    </div>
                    <div className="col-sm-1 col-xs-12" style={{ marginTop: "1.5em" }}>
                      <button title="Add Item" onClick={addMachine} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
                    </div>
                  </div>
                  <br />
                  <div className="row text-center">
                    <button className="btn btn-danger" onClick={() => router.push("/Home")}>Close</button>
                  </div>
                  <br />
                </div>
                <br />
                <div className="container-fluid">
                  <div style={{ marginBottom: "8px", display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                    <button className="btn btn-primary btn-sm" onClick={() => downloadCSV("machine_tracking.csv", tCols.filter((c) => !tHidden.includes(c)), tLines.map((l) => l.filter((_, i) => !tHidden.includes(tCols[i]))))}>CSV</button>
                    <button className="btn btn-primary btn-sm" onClick={() => {
                      const heads = tCols.filter((c) => !tHidden.includes(c));
                      const body = tLines.map((l) => l.filter((_, i) => !tHidden.includes(tCols[i])));
                      const w = window.open("", "_blank");
                      if (!w) return;
                      w.document.write(`<html><head><title>Print</title></head><body><table border="1" cellpadding="4"><thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body.map((l) => `<tr>${l.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`);
                      w.document.close(); w.print();
                    }}>Print</button>
                    <button className="btn btn-primary btn-sm" onClick={async () => {
                      const heads = tCols.filter((c) => !tHidden.includes(c));
                      const body = tLines.map((l) => l.filter((_, i) => !tHidden.includes(tCols[i])));
                      try { await navigator.clipboard.writeText([heads.join("\t"), ...body.map((l) => l.join("\t"))].join("\n")); alert("Copied to clipboard"); }
                      catch { alert("Copy failed"); }
                    }}>Copy</button>
                    <details style={{ display: "inline-block" }}>
                      <summary className="btn btn-primary btn-sm" style={{ cursor: "pointer", listStyle: "none" }}>Column visibility</summary>
                      <div style={{ background: "#fff", border: "1px solid #ccc", padding: "6px", position: "absolute", zIndex: 10 }}>
                        {tCols.map((c) => (
                          <label key={c} style={{ display: "block", fontWeight: "normal" }}>
                            <input type="checkbox" checked={!tHidden.includes(c)} onChange={() => toggleHidden(tHidden, setTHidden, c)} /> {c}
                          </label>
                        ))}
                      </div>
                    </details>
                    <span style={{ marginLeft: "auto" }} />
                    <input className="form-control" style={{ width: "200px", display: "inline-block" }} placeholder="Search..." value={tSearch} onChange={(e) => { setTSearch(e.target.value); setTPage(1); }} />
                  </div>
                  <div className="grid-view">
                    <table className="table" style={{ backgroundColor: "White", borderColor: "#CCCCCC", borderWidth: "1px", width: "100%" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#507CD1", color: "White", fontWeight: "bold" }} className="text-uppercase">
                          <th></th>
                          {!tHidden.includes("Machine Name") && <th>Machine Name</th>}
                          {!tHidden.includes("Client Name") && <th>Client Name</th>}
                          {!tHidden.includes("State Name") && <th>State Name</th>}
                          {!tHidden.includes("Location") && <th>Location</th>}
                          {!tHidden.includes("Rental From") && <th>Rental From</th>}
                          {!tHidden.includes("Rental To") && <th>Rental To</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {tPageRows.map((r) => (
                          <tr key={r.id} style={{ backgroundColor: "#EFF3FB" }}>
                            <td>
                              <button title="Delete" onClick={() => delTrack(r.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#d9534f", fontSize: "14px" }}>✖</button>
                            </td>
                            {!tHidden.includes("Machine Name") && <td><span style={{ display: "inline-block", width: "100px" }}>{r.machine_name || r.machine_code}</span></td>}
                            {!tHidden.includes("Client Name") && <td>{clientName(r.client_code, r)}</td>}
                            {!tHidden.includes("State Name") && <td>{r.state}</td>}
                            {!tHidden.includes("Location") && <td>{unitName(r.unit_code, r)}</td>}
                            {!tHidden.includes("Rental From") && <td>{fmtDMY(r.rental_from)}</td>}
                            {!tHidden.includes("Rental To") && <td>{fmtDMY(r.rental_to)}</td>}
                          </tr>
                        ))}
                        {tPageRows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center" }}>{tClient === "Select" ? "Select a client to view tracking records" : "No records found"}</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  {pager(tFiltered.length)}
                </div>
              </div>
            )}

            {tab === 1 && (
              <div id="menu2">
                <div className="container-fluid" style={{ border: "1px solid white", borderRadius: "10px", backgroundColor: "#e7e7fa" }}>
                  <br />
                  <div className="row">
                    <div className="col-sm-2 col-xs-12">
                      Select Machine:
                      <select ref={sMachineRef} className="form-control" value={sMachine} onChange={(e) => setSMachine(e.target.value)}>
                        <option value="Select">Select</option>
                        {machines.map((m) => <option key={m.item_code} value={m.item_code}>{m.item_name}</option>)}
                      </select>
                      {machineError && machines.length === 0 && <div style={{ color: "#a94442", fontSize: "11px" }}>{machineError}</div>}
                    </div>
                    <div className="col-sm-2 col-xs-12" style={{ width: "15%" }}>
                      servicing Form Date:
                      <input ref={sFromRef} type="date" className="form-control" value={sFrom} max={sTo || undefined} onChange={(e) => setSFrom(e.target.value)} />
                    </div>
                    <div className="col-sm-2 col-xs-12" style={{ width: "15%" }}>
                      servicing To Date:
                      <input ref={sToRef} type="date" className="form-control" value={sTo} min={sFrom || undefined} onChange={(e) => setSTo(e.target.value)} />
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      select Warranty:
                      <select ref={sWarrantyRef} className="form-control" value={sWarranty} onChange={(e) => setSWarranty(e.target.value)}>
                        <option value="Select">Select</option>
                        <option value="Hr">Hr</option>
                        <option value="Days">Days</option>
                        <option value="Month">Month</option>
                      </select>
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      Warranty(In Hr/Days/Month):
                      <input ref={sWarrantyInRef} className="form-control" value={sWarrantyIn} onKeyPress={allowAlphabetAddress} onChange={(e) => setSWarrantyIn(e.target.value)} />
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      Next Servicing:
                      <input ref={sNextRef} type="date" className="form-control" value={sNext} onChange={(e) => setSNext(e.target.value)} />
                    </div>
                  </div>
                  <br />
                  <div className="row">
                    <div className="col-sm-2 col-xs-12">
                      <span>File to Upload :</span>
                      <input ref={sFileRef} type="file" className="text_box" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setSFile(e.target.files?.[0] ?? null)} />
                      <b style={{ color: "#f00", textAlign: "center" }}>Note :</b>{" "}
                      <span style={{ fontSize: "8px", fontWeight: "bold" }}>Only JPG, PNG and PDF files will be uploaded.</span>
                      {sFile && <div style={{ fontSize: "11px" }}>Selected: {sFile.name}</div>}
                    </div>
                    <div className="col-sm-2 col-xs-12" style={{ display: "none" }}>
                      id:
                      <input className="form-control" value={sId} readOnly />
                    </div>
                  </div>
                  <br />
                  <div className="row text-center">
                    <button className="btn btn-primary" onClick={saveService}>Save</button>{" "}
                    <button className="btn btn-primary" onClick={updateService}>Update</button>{" "}
                    <button className="btn btn-primary" onClick={deleteService}>Delete</button>{" "}
                    <button className="btn btn-danger" onClick={() => router.push("/Home")}>Close</button>
                  </div>
                  <br />
                </div>
                <br />
                <div className="container-fluid">
                  <div style={{ marginBottom: "8px", display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                    <button className="btn btn-primary btn-sm" onClick={() => downloadCSV("machine_servicing.csv", sCols.filter((c) => !sHidden.includes(c)), sLines.map((l) => l.filter((_, i) => !sHidden.includes(sCols[i]))))}>CSV</button>
                    <button className="btn btn-primary btn-sm" onClick={() => {
                      const heads = sCols.filter((c) => !sHidden.includes(c));
                      const body = sLines.map((l) => l.filter((_, i) => !sHidden.includes(sCols[i])));
                      const w = window.open("", "_blank");
                      if (!w) return;
                      w.document.write(`<html><head><title>Print</title></head><body><table border="1" cellpadding="4"><thead><tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody>${body.map((l) => `<tr>${l.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`);
                      w.document.close(); w.print();
                    }}>Print</button>
                    <button className="btn btn-primary btn-sm" onClick={async () => {
                      const heads = sCols.filter((c) => !sHidden.includes(c));
                      const body = sLines.map((l) => l.filter((_, i) => !sHidden.includes(sCols[i])));
                      try { await navigator.clipboard.writeText([heads.join("\t"), ...body.map((l) => l.join("\t"))].join("\n")); alert("Copied to clipboard"); }
                      catch { alert("Copy failed"); }
                    }}>Copy</button>
                    <details style={{ display: "inline-block" }}>
                      <summary className="btn btn-primary btn-sm" style={{ cursor: "pointer", listStyle: "none" }}>Column visibility</summary>
                      <div style={{ background: "#fff", border: "1px solid #ccc", padding: "6px", position: "absolute", zIndex: 10 }}>
                        {sCols.map((c) => (
                          <label key={c} style={{ display: "block", fontWeight: "normal" }}>
                            <input type="checkbox" checked={!sHidden.includes(c)} onChange={() => toggleHidden(sHidden, setSHidden, c)} /> {c}
                          </label>
                        ))}
                      </div>
                    </details>
                    <span style={{ marginLeft: "auto" }} />
                    <input className="form-control" style={{ width: "200px", display: "inline-block" }} placeholder="Search..." value={sSearch} onChange={(e) => { setSSearch(e.target.value); setSPage(1); }} />
                  </div>
                  <div className="grid-view">
                    <table className="table" style={{ backgroundColor: "White", borderColor: "#CCCCCC", borderWidth: "1px", width: "100%" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#507CD1", color: "White", fontWeight: "bold" }} className="text-uppercase">
                          {!sHidden.includes("machine Name") && <th>machine Name</th>}
                          {!sHidden.includes("Servicing Date From") && <th>Servicing Date From</th>}
                          {!sHidden.includes("Servicing To Date") && <th>Servicing To Date</th>}
                          {!sHidden.includes("Warranty Type") && <th>Warranty Type</th>}
                          {!sHidden.includes("warranty") && <th>warranty</th>}
                          {!sHidden.includes("Next Service Date") && <th>Next Service Date</th>}
                          {!sHidden.includes("IMAGE") && <th>IMAGE</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {sPageRows.map((r) => (
                          <tr key={r.id} onClick={() => selectSvcRow(r)}
                            style={{ backgroundColor: String(r.id) === sId ? "#D1DDF1" : "#EFF3FB", cursor: "pointer", fontWeight: String(r.id) === sId ? "bold" : "normal" }}
                            onMouseOver={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                            onMouseOut={(e) => { e.currentTarget.style.textDecoration = "none"; }}>
                            {!sHidden.includes("machine Name") && <td>{r.machine_name || r.machine_code}</td>}
                            {!sHidden.includes("Servicing Date From") && <td>{fmtDMY(r.servicing_from_date)}</td>}
                            {!sHidden.includes("Servicing To Date") && <td>{fmtDMY(r.servicing_to_date)}</td>}
                            {!sHidden.includes("Warranty Type") && <td>{r.warranty_type}</td>}
                            {!sHidden.includes("warranty") && <td>{r.warranty_in}</td>}
                            {!sHidden.includes("Next Service Date") && <td>{fmtDMY(r.next_servicing_date)}</td>}
                            {!sHidden.includes("IMAGE") && (
                              <td>
                                {r.file_url ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={`${API_BASE_URL}${r.file_url}`} alt="" width={50} height={50}
                                    style={{ cursor: "pointer" }}
                                    onClick={(e) => { e.stopPropagation(); setZoom(`${API_BASE_URL}${r.file_url}`); }} />
                                ) : ""}
                              </td>
                            )}
                          </tr>
                        ))}
                        {sPageRows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center" }}>No records found</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  {pager(sFiltered.length)}
                </div>
              </div>
            )}
          </div>
          <br />
        </div>
      </div>

      {zoom && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setZoom(null)}>
          <div style={{ background: "#fff", width: "500px", maxWidth: "95vw", border: "1px solid #ccc", borderRadius: "4px" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "8px 12px", borderBottom: "1px solid #ddd", fontWeight: "bold" }}>Zoomed Image</div>
            <div style={{ padding: "12px", textAlign: "center" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={zoom} alt="Zoomed" width={470} height={400} style={{ maxWidth: "100%", objectFit: "contain" }} />
            </div>
            <div style={{ padding: "8px 12px", borderTop: "1px solid #ddd", textAlign: "right" }}>
              <button className="btn btn-primary btn-sm" onClick={() => setZoom(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
