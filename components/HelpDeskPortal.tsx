"use client";
/* =====================================================================
 * HELP DESK IHMS. — 1:1 port of help_desk.aspx (NOT the modern ticket
 * screen). 3 tabs: HELP DESK | HELP DESK ACTION | REPORT.
 * Validations, alerts, grid columns, modal counts and the
 * REPORT_HELP_DESKs.xls export are exactly as legacy. Dates dd/mm/yyyy.
 * Backend: /api/transactions/help-desk-portal/* (legacy pay_help_desk).
 * ===================================================================== */
import React, { useEffect, useState } from "react";
import { getJSON, mk, upload } from "@/lib/api/legacy-fetch";
import { API_BASE_URL, apiGet } from "@/lib/api/client";

const BASE = "/api/transactions/help-desk-portal";
const SEL = "Select";
const ALL = "ALL";

type Row = Record<string, any>;
type Opt = { v: string; t: string };

const QHEADS: Opt[] = [
  { v: SEL, t: SEL },
  { v: "Finance", t: "Finance" }, { v: "Operation", t: "Operation" },
  { v: "Admin", t: "Admin" }, { v: "Upload", t: "Upload" },
  { v: "Pf IESC", t: "Pf IESC" }, { v: "Tracing", t: "Traking" },
  { v: "FO", t: "FO" }, { v: "Supervisior Visi", t: "Supervisior Visit" },
];

function Msg({ text, ok }: { text: string; ok: boolean }) {
  if (!text) return null;
  return (
    <div style={{ margin: "0 0 10px", padding: "6px 12px", borderRadius: 4, fontSize: 12,
      color: ok ? "#2e7d32" : "#c62828", background: ok ? "#e8f5e9" : "#ffebee",
      border: `1px solid ${ok ? "#a5d6a7" : "#ef9a9a"}` }}>{text}</div>
  );
}
/* dd/mm/yyyy <-> yyyy-mm-dd (legacy datepicker shows dd/mm/yy; native calendar
 * needs yyyy-mm-dd, so convert both ways and keep dd/mm/yyyy for the API) */
function ddmmToISO(s: string) {
  const m = (s || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}
function isoToDDMM(s: string) {
  const m = (s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}
/** Query-date box: calendar popup (native) + dd/mm/yyyy value for the API. */
function DateBox({ value, onChange }: { value: string; onChange: (ddmm: string) => void }) {
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "center", width: "100%" }}>
      <input type="text" className="form-control datepicker" value={value} placeholder="dd/mm/yyyy"
        maxLength={10} style={{ flex: 1 }} onChange={(e) => onChange(e.target.value)} />
      <input type="date" className="form-control" style={{ width: 130 }} value={ddmmToISO(value)}
        onChange={(e) => onChange(isoToDDMM(e.target.value))} title="Pick date" />
    </span>
  );
}
/** Case-insensitive cell lookup (legacy Cells[] indexing was case-insensitive). */
function val(r: Row, name: string): any {
  if (r[name] !== undefined && r[name] !== null) return r[name];
  const want = name.toLowerCase();
  for (const k of Object.keys(r)) {
    if (k.toLowerCase() === want) return (r as Row)[k];
  }
  return "";
}
async function errText(r: Response, fallback: string) {
  const e = await r.json().catch(() => ({} as any));
  return (e as any)?.detail || (e as any)?.non_field_errors?.[0] || (Array.isArray(e) ? (e as any)[0] : fallback);
}
/* Status-aware fetch (404 = backend not restarted, 403 = session, 500 = DB). */
async function loadJSON<T>(path: string): Promise<{ data?: T; status?: number }> {
  try {
    const data = await apiGet<T>(path, { credentials: "include" });
    return { data };
  } catch (e: any) {
    const m = String(e?.message ?? "");
    const s = m.match(/API (\d+)/)?.[1];
    return { status: s ? parseInt(s, 10) : 0 };
  }
}
function errFor(what: string, status?: number): string {
  if (status === 404) return `${what} endpoint not found (404) — please restart the backend server, then refresh.`;
  if (status === 403) return `Access denied (403) for the ${what} — your session may have expired. Please log in again and refresh.`;
  if (status === 500 || status === 0) return `Failed to load the ${what} (server error) — please check the backend logs and the legacy DB connection, then refresh.`;
  return `Failed to load the ${what} — please check that the backend is running and you are logged in.`;
}
function DropBanner({ errs }: { errs: (string | undefined)[] }) {
  const list = errs.filter(Boolean) as string[];
  if (list.length === 0) return null;
  return (
    <div style={{ background: "#fff3cd", border: "1px solid #ffc107", color: "#856404", padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 12, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
      <span>{list.join(" ")}</span>
      <button type="button" className="btn btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => window.location.reload()}>Refresh</button>
    </div>
  );
}

/* DataTable-style export buttons (csv / print / copyHtml5 / colvis) */
function Exports({ id, cols, rows, cell }: { id: string; cols: string[]; rows: Row[]; cell: (r: Row, c: string) => any }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [show, setShow] = useState(false);
  const vis = cols.filter((c) => !hidden[c]);
  const q = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const dl = (name: string, type: string, text: string) => {
    const blob = new Blob(["\ufeff" + text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const csv = () => dl(`${id}.csv`, "text/csv",
    vis.map(q).join(",") + "\r\n" + rows.map((r) => vis.map((c) => q(cell(r, c))).join(",")).join("\r\n"));
  const copy = () => {
    navigator.clipboard?.writeText([vis.join("\t"), ...rows.map((r) => vis.map((c) => cell(r, c)).join("\t"))].join("\n")).catch(() => undefined);
  };
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>${id}</title><style>table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px;font-size:11px}</style></head><body><table><tr>${vis.map((c) => `<th>${c}</th>`).join("")}</tr>${rows.map((r) => `<tr>${vis.map((c) => `<td>${cell(r, c)}</td>`).join("")}</tr>`).join("")}</table><script>window.print()</script></body></html>`);
    w.document.close();
  };
  return (
    <div className="dt-btns" style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", position: "relative" }}>
      <button type="button" className="dt-exp" onClick={csv}>csv</button>
      <button type="button" className="dt-exp" onClick={print}>print</button>
      <button type="button" className="dt-exp" onClick={copy}>copyHtml5</button>
      <button type="button" className="dt-exp" onClick={() => setShow((s) => !s)}>colvis</button>
      {show && (
        <div className="dt-colmenu" style={{ background: "#fff", border: "1px solid #ccc", padding: 8, position: "absolute", zIndex: 5 }}>
          {cols.map((c) => (
            <label key={c} style={{ display: "block", fontSize: 12 }}>
              <input type="checkbox" checked={!hidden[c]} onChange={() => setHidden((h) => ({ ...h, [c]: !h[c] }))} /> {c || "(action)"}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

/* Pending/Inprocess modal (legacy #Pending_Employee style popups) */
function CountModal({ title, rows, onClose }: { title: string; rows: Row[]; onClose: () => void }) {
  const cols = ["SR.NO", "Client Name", "Query Date", "Query Type", "Description", "Status"];
  const m: Record<string, string> = { "Client Name": "client_name", "Query Date": "query_date", "Query Type": "query_head", "Description": "description", "Status": "status" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 6, padding: 16, maxWidth: "90%", maxHeight: "80%", overflow: "auto", minWidth: 600 }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <b>{title}</b>
          <button type="button" className="btn btn-danger" onClick={onClose}>Close</button>
        </div>
        <table className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
          <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={val(r, "id") || i}>
                <td>{i + 1}</td>
                {cols.slice(1).map((c) => <td key={c}>{val(r, m[c])}</td>)}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= TAB 1: HELP DESK ================= */
function TabRaise() {
  const [clients, setClients] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [states, setStates] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [branches, setBranches] = useState<Opt[]>([{ v: ALL, t: ALL }]);
  const [client, setClient] = useState(SEL);
  const [state, setState] = useState(SEL);
  const [branch, setBranch] = useState(ALL);
  const [head, setHead] = useState(SEL);
  const [qdate, setQdate] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [bound, setBound] = useState(false);
  const [counts, setCounts] = useState({ p: [] as Row[], pc: 0, i: [] as Row[], ic: 0 });
  const [modal, setModal] = useState<"p" | "i" | null>(null);
  const [msg, setMsg] = useState({ text: "", ok: true });
  const [dropErr, setDropErr] = useState("");
  const [sbErr, setSbErr] = useState("");
  const show = (text: string, ok = true) => setMsg({ text, ok });

  useEffect(() => {
    (async () => {
      const { data, status } = await loadJSON<{ results: Row[] }>(`${BASE}/clients/`);
      if (!data) { setDropErr(errFor("Client dropdown", status)); return; }
      const list = ((data?.results ?? []) as Row[]);
      setClients([{ v: SEL, t: SEL }, { v: ALL, t: ALL },
        ...list.map((c) => ({ v: String(val(c, "client_code")), t: String(val(c, "client_name")) }))]);
      if (list.length === 0) {
        const dg = await loadJSON<any>("/api/masters/it-master/diagnostics/");
        const d = dg.data;
        if (d) {
          setDropErr(`Client list is empty — company '${d.comp_code ?? ""}' has ${d.active_clients_in_comp ?? 0} active clients, and login '${(d.logins_tried ?? []).join(" / ")}' has ${d.role_grade_rows_for_login ?? 0} client assignments. ` +
            ((d.role_grade_rows_for_login ?? 0) === 0
              ? "No clients are assigned to your login in the client-role mapping."
              : "Clients exist but none are active for this company."));
        } else {
          setDropErr("Client list is empty — no clients are assigned to your login, or the client master has no data for this company.");
        }
      } else {
        setDropErr("");
      }
    })();
  }, []);
  useEffect(() => {
    (async () => {
      if (!client || client === SEL) { setStates([{ v: SEL, t: SEL }]); setSbErr(""); return; }
      const { data, status } = await loadJSON<{ results: Row[] }>(`${BASE}/states/?client_code=${encodeURIComponent(client)}`);
      if (!data) { setSbErr(errFor("State dropdown", status)); return; }
      setSbErr("");
      const list = ((data?.results ?? []) as Row[]);
      setStates([{ v: SEL, t: SEL }, ...list.map((s) => ({ v: String(val(s, "state_name")), t: String(val(s, "state_name")) }))]);
    })();
  }, [client]);
  useEffect(() => {
    (async () => {
      if (!client || client === SEL) { setBranches([{ v: ALL, t: ALL }]); return; }
      const { data, status } = await loadJSON<{ results: Row[] }>(
        `${BASE}/branches/?client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}`);
      if (!data) { setSbErr(errFor("Branch dropdown", status)); return; }
      const list = ((data?.results ?? []) as Row[]);
      setBranches([{ v: ALL, t: ALL }, ...list.map((b) => ({ v: String(val(b, "unit_code")), t: String(val(b, "unit_name")) }))]);
    })();
  }, [client, state]);
  const loadGrid = async (cc: string) => {
    if (!cc || cc === SEL || cc === ALL) { setRows([]); setBound(false); return; }
    const d = await getJSON<{ results: Row[] }>(`${BASE}/grid1/?client_code=${encodeURIComponent(cc)}`);
    setRows(((d?.results ?? []) as Row[])); setBound(true);
  };
  const loadCounts = async (cc: string) => {
    const d = await getJSON<any>(`${BASE}/counts1/?client_code=${encodeURIComponent(cc === SEL ? "" : cc)}`);
    if (d) setCounts({ p: d.pending ?? [], pc: d.pending_count ?? 0, i: d.inprocess ?? [], ic: d.inprocess_count ?? 0 });
  };
  useEffect(() => { loadCounts(client); }, [client]);
  useEffect(() => { loadCounts(""); }, []);

  const submit = async () => {
    // help_desk()
    if (!client || client === SEL) { window.alert("Please Select Client Name..."); return; }
    if (!state || state === SEL) { window.alert("Please Select State..."); return; }
    if (!branch || branch === ALL) { window.alert("Please Select Branch Name"); return; }
    if (!head || head === SEL) { window.alert("Please Select Query head..."); return; }
    if (!qdate) { window.alert("Please Select Query date..."); return; }
    if (!desc) { window.alert("Please Enter Description....."); return; }
    if (!file) { window.alert("Please Upload File...."); return; }
    const fd = new FormData();
    fd.append("client_code", client);
    fd.append("client_name", clients.find((c) => c.v === client)?.t ?? "");
    fd.append("state", state);
    fd.append("unit_code", branch);
    fd.append("unit_name", branches.find((b) => b.v === branch)?.t ?? "");
    fd.append("query_head", head);
    fd.append("query_date", qdate);
    fd.append("description", desc);
    fd.append("file", file);
    const r = await upload(`${BASE}/submit/`, fd);
    if (r.ok) {
      window.alert("Record Inserted Succsefully !!!!!");
      show("Record Inserted Succsefully !!!!!", true);
      setHead(SEL); setQdate(""); setDesc(""); setFile(null);
      loadGrid(client); loadCounts(client);
    } else { const t = await errText(r, "Save failed"); window.alert(t); show(t, false); }
  };

  const imgSrc = (r: Row) => {
    const f = String(val(r, "query_attachment") || "");
    if (!f) return "";
    const u = f.toUpperCase();
    if (u.includes(".PDF")) return "/Images/pdf_format.jpg";
    if (u.includes(".ZIP")) return "/Images/winzip.png";
    return `${API_BASE_URL}/media/help_desk_file/${encodeURIComponent(f)}`;
  };
  const dlFile = (id: any) => {
    window.open(`${API_BASE_URL}${BASE}/download/?id=${encodeURIComponent(String(id))}`, "_blank");
  };
  const cols = ["Sr.No.", "ID", "COMP CODE", "CLIENT CODE", "CLIENT NAME", "STATE", "UNIT CODE", "UNIT NAME", "QUERY DATE", "QUERY HEAD", "DESCRIPTION", "Uploaded Files", "STATUS", "ACTION REMARK"];
  const cell = (r: Row, c: string): any => {
    if (c === "Sr.No.") return "";
    const m: Record<string, string> = { "ID": "id", "COMP CODE": "comp_code", "CLIENT CODE": "client_code", "CLIENT NAME": "client_name", "STATE": "state", "UNIT CODE": "unit_code", "UNIT NAME": "unit_name", "QUERY DATE": "query_date", "QUERY HEAD": "query_head", "DESCRIPTION": "description", "STATUS": "status", "ACTION REMARK": "remark" };
    return val(r, m[c] ?? c);
  };
  return (
    <div>
      <Msg text={msg.text} ok={msg.ok} />
      <DropBanner errs={[dropErr, sbErr]} />
      <div style={{ marginBottom: 8 }}>
        <a href="#Pending_Employee" onClick={(e) => { e.preventDefault(); setModal("p"); }}
          style={{ color: "red", marginRight: 16 }}>Pending Employees ({counts.pc})</a>
        <a href="#Inprocess_Employee" onClick={(e) => { e.preventDefault(); setModal("i"); }}
          style={{ color: "red" }}>Inprocess Employees ({counts.ic})</a>
      </div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12"><b>Client Name :</b>
          <select className="form-control" value={client} onChange={(e) => { const v = e.target.value; setClient(v); setState(SEL); setBranch(ALL); loadGrid(v); }}>
            {clients.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12"><b>State :</b>
          <select className="form-control" value={state} onChange={(e) => { setState(e.target.value); setBranch(ALL); }}>
            {states.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12"><b>Branch Name :</b>
          <select className="form-control" value={branch} onChange={(e) => setBranch(e.target.value)}>
            {branches.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12"><b>Query Head :</b>
          <select className="form-control" value={head} onChange={(e) => setHead(e.target.value)}>
            {QHEADS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-md-2 col-xs-12"><b>Query Date :</b><span className="text-red"> *</span>
          <DateBox value={qdate} onChange={setQdate} /></div>
        <div className="col-md-4 col-xs-12"><b>Description :</b>
          <textarea className="form-control" rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        <div className="col-md-2 col-xs-12"><b>File to Upload :</b>
          <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div style={{ fontSize: 11, color: "#555" }}>Only JPG, PNG,JPEG and PDF files will be uploaded.</div></div>
        <div className="col-sm-2 col-xs-12" style={{ alignSelf: "flex-end" }}>
          <button type="button" className="it-btn" onClick={submit}>Submit</button>
        </div>
      </div>
      <br />
      {bound && (
        <div>
          <Exports id="grid_help_desk" cols={cols.filter((c) => !["ID", "COMP CODE", "CLIENT CODE", "UNIT CODE"].includes(c))} rows={rows} cell={cell} />
          <div style={{ overflowX: "auto" }}>
            <table id="grid_help_desk" className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
              <thead><tr>
                <th>Sr.No.</th><th style={{ display: "none" }}>ID</th><th style={{ display: "none" }}>COMP CODE</th>
                <th style={{ display: "none" }}>CLIENT CODE</th><th>CLIENT NAME</th><th>STATE</th>
                <th style={{ display: "none" }}>UNIT CODE</th><th>UNIT NAME</th><th>QUERY DATE</th><th>QUERY HEAD</th>
                <th>DESCRIPTION</th><th>Uploaded Files</th><th>STATUS</th><th>ACTION REMARK</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={val(r, "id") || i}>
                    <td>{i + 1}</td><td style={{ display: "none" }}>{val(r, "id")}</td>
                    <td style={{ display: "none" }}>{val(r, "comp_code")}</td>
                    <td style={{ display: "none" }}>{val(r, "client_code")}</td>
                    <td>{val(r, "client_name")}</td><td>{val(r, "state")}</td>
                    <td style={{ display: "none" }}>{val(r, "unit_code")}</td>
                    <td>{val(r, "unit_name")}</td><td>{val(r, "query_date")}</td>
                    <td>{val(r, "query_head")}</td><td>{val(r, "description")}</td>
                    <td style={{ textAlign: "center" }}>
                      {val(r, "query_attachment") ? (
                        <span>
                          {imgSrc(r) && <img src={imgSrc(r)} height={70} width={70} alt="" style={{ display: "block", margin: "0 auto" }} />}
                          <button type="button" onClick={() => dlFile(val(r, "id"))}
                            style={{ background: "none", border: "none", cursor: "pointer" }} title="View">👁</button>
                          {" "}
                          <button type="button" onClick={() => dlFile(val(r, "id"))}
                            style={{ background: "none", border: "none", cursor: "pointer" }} title="Download">⬇</button>
                        </span>
                      ) : null}
                    </td>
                    <td>{val(r, "status")}</td><td>{val(r, "remark")}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {modal === "p" && <CountModal title="Pending Employees" rows={counts.p} onClose={() => setModal(null)} />}
      {modal === "i" && <CountModal title="Inprocess Employees" rows={counts.i} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ================= TAB 2: HELP DESK ACTION ================= */
function TabAction() {
  const [clients, setClients] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [states, setStates] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [branches, setBranches] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [heads, setHeads] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [client, setClient] = useState(SEL);
  const [state, setState] = useState(SEL);
  const [branch, setBranch] = useState(SEL);
  const [head, setHead] = useState(SEL);
  const [rows, setRows] = useState<Row[]>([]);
  const [bound, setBound] = useState(false);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [st, setSt] = useState<Record<number, string>>({});
  const [rem, setRem] = useState<Record<number, string>>({});
  const [files, setFiles] = useState<Record<number, File | null>>({});
  const [counts, setCounts] = useState({ p: [] as Row[], pc: 0, i: [] as Row[], ic: 0 });
  const [modal, setModal] = useState<"p" | "i" | null>(null);
  const [msg, setMsg] = useState({ text: "", ok: true });
  const show = (text: string, ok = true) => setMsg({ text, ok });

  useEffect(() => {
    (async () => {
      const { data, status } = await loadJSON<{ results: Row[] }>(`${BASE}/action-clients/`);
      if (!data) { show(errFor("Client dropdown", status), false); return; }
      const list = ((data?.results ?? []) as Row[]);
      setClients([{ v: SEL, t: SEL }, ...list.map((c) => ({ v: String(val(c, "client_code")), t: String(val(c, "client_name")) }))]);
    })();
  }, []);
  useEffect(() => {
    (async () => {
      if (!client || client === SEL) { setStates([{ v: SEL, t: SEL }]); return; }
      const d = await getJSON<{ results: Row[] }>(`${BASE}/action-states/?client_code=${encodeURIComponent(client)}`);
      const list = ((d?.results ?? []) as Row[]);
      setStates([{ v: SEL, t: SEL }, ...list.map((s) => ({ v: String(val(s, "state")), t: String(val(s, "state")) }))]);
    })();
  }, [client]);
  useEffect(() => {
    (async () => {
      if (!client || client === SEL) { setBranches([{ v: SEL, t: SEL }]); return; }
      const d = await getJSON<{ results: Row[] }>(
        `${BASE}/action-branches/?client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}`);
      const list = ((d?.results ?? []) as Row[]);
      setBranches([{ v: SEL, t: SEL }, ...list.map((b) => ({ v: String(val(b, "unit_name")), t: String(val(b, "unit_name")) }))]);
    })();
  }, [client, state]);
  useEffect(() => {
    (async () => {
      if (!client || client === SEL) { setHeads([{ v: SEL, t: SEL }]); return; }
      const d = await getJSON<{ results: Row[] }>(
        `${BASE}/action-heads/?client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}&unit_name=${encodeURIComponent(branch)}`);
      const list = ((d?.results ?? []) as Row[]);
      setHeads([{ v: SEL, t: SEL }, ...list.map((h) => ({ v: String(val(h, "query_head")), t: String(val(h, "query_head")) }))]);
    })();
  }, [client, state, branch]);
  const loadGrid = async (cc: string) => {
    if (!cc || cc === SEL) { setRows([]); setBound(false); return; }
    const d = await getJSON<{ results: Row[] }>(`${BASE}/grid2/?client_code=${encodeURIComponent(cc)}`);
    const list = ((d?.results ?? []) as Row[]);
    setRows(list); setBound(true); setSel({});
    setSt(Object.fromEntries(list.map((_, i) => [i, SEL])));
    setRem(Object.fromEntries(list.map((r, i) => [i, String(val(r, "remark") ?? "")])));
  };
  const loadCounts = async (cc: string) => {
    const d = await getJSON<any>(`${BASE}/counts2/?client_code=${encodeURIComponent(cc === SEL ? "" : cc)}`);
    if (d) setCounts({ p: d.pending ?? [], pc: d.pending_count ?? 0, i: d.inprocess ?? [], ic: d.inprocess_count ?? 0 });
  };
  useEffect(() => { loadCounts(client); }, [client]);
  useEffect(() => { loadCounts(""); }, []);

  const update = async () => {
    // user_menuValid(): at least one checkbox
    const items = rows.map((r, i) => ({ r, i })).filter(({ i }) => sel[String(i)]);
    if (items.length === 0) { window.alert("Please select atleast one Record "); return; }
    for (const { i } of items) {
      if (!rem[i]) { window.alert("Please Enter Remark........"); return; }
    }
    const fd = new FormData();
    fd.append("items", JSON.stringify(items.map(({ r, i }) => ({
      id: val(r, "id"), status: st[i] ?? SEL, remark: rem[i] ?? "",
    }))));
    items.forEach(({ r, i }) => {
      if (files[i]) fd.append(`close_${val(r, "id")}`, files[i] as File);
    });
    const r = await upload(`${BASE}/update-action/`, fd);
    if (r.ok) {
      window.alert("Updated Data successfully!!"); show("Updated Data successfully!!", true);
      setSel({}); loadGrid(client); loadCounts(client);
    } else { const t = await errText(r, "Update failed"); window.alert(t); show(t, false); }
  };

  const dlFile = (id: any) => {
    window.open(`${API_BASE_URL}${BASE}/download/?id=${encodeURIComponent(String(id))}`, "_blank");
  };
  const cols = ["Sr.No.", "ID", "STATE", "CLIENT NAME", "BRANCH NAME", "QUERY HEAD", "QUERY DATE", "DESCRIPTION", "Uploaded Files", "STATUS", "ACTION REMARK", "CLOSE FILE UPLOAD"];
  const cell = (r: Row, c: string): any => {
    if (c === "Sr.No.") return "";
    const m: Record<string, string> = { "ID": "id", "STATE": "state", "CLIENT NAME": "client_name", "BRANCH NAME": "unit_name", "QUERY HEAD": "query_head", "QUERY DATE": "query_date", "DESCRIPTION": "description", "STATUS": "status", "ACTION REMARK": "remark" };
    return val(r, m[c] ?? c);
  };
  return (
    <div>
      <Msg text={msg.text} ok={msg.ok} />
      <div style={{ marginBottom: 8 }}>
        <a href="#Pending_Employee_1" onClick={(e) => { e.preventDefault(); setModal("p"); }}
          style={{ color: "red", marginRight: 16 }}>Pending Employees ({counts.pc})</a>
        <a href="#Inprocess_Employee_1" onClick={(e) => { e.preventDefault(); setModal("i"); }}
          style={{ color: "red" }}>Inprocess Employees ({counts.ic})</a>
      </div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12"><b>Client Name :</b>
          <select className="form-control" value={client} onChange={(e) => { const v = e.target.value; setClient(v); setState(SEL); setBranch(SEL); setHead(SEL); loadGrid(v); }}>
            {clients.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12"><b>State :</b>
          <select className="form-control" value={state} onChange={(e) => { setState(e.target.value); setBranch(SEL); setHead(SEL); }}>
            {states.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12"><b>Branch Name :</b>
          <select className="form-control" value={branch} onChange={(e) => { setBranch(e.target.value); setHead(SEL); }}>
            {branches.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12"><b>Query Head :</b>
          <select className="form-control" value={head} onChange={(e) => setHead(e.target.value)}>
            {heads.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
      </div>
      <br />
      {bound && (
        <div>
          <Exports id="gvd_hdesk_actn2" cols={cols.filter((c) => c !== "ID")} rows={rows} cell={cell} />
          <div style={{ overflowX: "auto" }}>
            <table id="gvd_hdesk_actn2" className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
              <thead><tr>
                <th><input type="checkbox"
                  checked={rows.length > 0 && rows.every((_, i) => sel[String(i)])}
                  onChange={(e) => { const n: Record<string, boolean> = {}; rows.forEach((_, i) => { n[String(i)] = e.target.checked; }); setSel(n); }} /> SELECT INVOICE</th>
                <th>Sr.No.</th><th style={{ display: "none" }}>ID</th><th>STATE</th><th>CLIENT NAME</th>
                <th>BRANCH NAME</th><th>QUERY HEAD</th><th>QUERY DATE</th><th>DESCRIPTION</th>
                <th>Uploaded Files</th><th>STATUS</th><th>ACTION REMARK</th><th>CLOSE FILE UPLOAD</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={val(r, "id") || i}>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={!!sel[String(i)]}
                        onChange={(e) => setSel((p) => ({ ...p, [String(i)]: e.target.checked }))} />
                    </td>
                    <td>{i + 1}</td><td style={{ display: "none" }}>{val(r, "id")}</td>
                    <td>{val(r, "state")}</td><td>{val(r, "client_name")}</td><td>{val(r, "unit_name")}</td>
                    <td>{val(r, "query_head")}</td><td>{val(r, "query_date")}</td><td>{val(r, "description")}</td>
                    <td style={{ textAlign: "center" }}>
                      {val(r, "query_attachment") ? (
                        <button type="button" onClick={() => dlFile(val(r, "id"))}
                          style={{ background: "none", border: "none", cursor: "pointer" }} title="Download">⬇</button>
                      ) : null}
                    </td>
                    <td>
                      <select className="form-control" value={st[i] ?? SEL}
                        onChange={(e) => setSt((p) => ({ ...p, [i]: e.target.value }))}>
                        {[SEL, "Inprocess", "Close"].map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td>
                      <input type="text" className="form-control" value={rem[i] ?? ""}
                        onChange={(e) => setRem((p) => ({ ...p, [i]: e.target.value }))} />
                      {!(rem[i] ?? "") && <span style={{ color: "red", fontSize: 11 }}>Please Enter Remark........</span>}
                    </td>
                    <td>
                      {(st[i] === "Close") && (
                        <input type="file" onChange={(e) => setFiles((p) => ({ ...p, [i]: e.target.files?.[0] ?? null }))} />
                      )}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={11} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
              </tbody>
            </table>
          </div>
          <div id="btn_update_hdesk_actn" className="row text-center" style={{ marginTop: 8 }}>
            <button type="button" className="it-btn" onClick={update}>Update</button>
          </div>
        </div>
      )}
      {modal === "p" && <CountModal title="Pending Employees" rows={counts.p} onClose={() => setModal(null)} />}
      {modal === "i" && <CountModal title="Inprocess Employees" rows={counts.i} onClose={() => setModal(null)} />}
    </div>
  );
}

/* ================= TAB 3: REPORT ================= */
function TabReport() {
  const [clients, setClients] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [states, setStates] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [branches, setBranches] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [qtypes, setQtypes] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [client, setClient] = useState(SEL);
  const [state, setState] = useState(SEL);
  const [branch, setBranch] = useState(SEL);
  const [qtype, setQtype] = useState(SEL);
  const [msg, setMsg] = useState({ text: "", ok: true });
  const show = (text: string, ok = true) => setMsg({ text, ok });

  useEffect(() => {
    (async () => {
      const { data, status } = await loadJSON<{ results: Row[] }>(`${BASE}/action-clients/`);
      if (!data) { show(errFor("Client dropdown", status), false); return; }
      const list = ((data?.results ?? []) as Row[]);
      setClients([{ v: SEL, t: SEL }, { v: ALL, t: ALL },
        ...list.map((c) => ({ v: String(val(c, "client_code")), t: String(val(c, "client_name")) }))]);
    })();
  }, []);
  useEffect(() => {
    (async () => {
      if (!client || client === SEL) { setStates([{ v: SEL, t: SEL }]); return; }
      const d = await getJSON<{ results: Row[] }>(`${BASE}/action-states/?client_code=${encodeURIComponent(client)}`);
      const list = ((d?.results ?? []) as Row[]);
      setStates([{ v: SEL, t: SEL }, { v: ALL, t: ALL },
        ...list.map((s) => ({ v: String(val(s, "state")), t: String(val(s, "state")) }))]);
    })();
  }, [client]);
  useEffect(() => {
    (async () => {
      if (!client || client === SEL) { setBranches([{ v: SEL, t: SEL }]); return; }
      const d = await getJSON<{ results: Row[] }>(
        `${BASE}/action-branches/?client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}`);
      const list = ((d?.results ?? []) as Row[]);
      setBranches([{ v: SEL, t: SEL }, { v: ALL, t: ALL },
        ...list.map((b) => ({ v: String(val(b, "unit_name")), t: String(val(b, "unit_name")) }))]);
    })();
  }, [client, state]);
  useEffect(() => {
    (async () => {
      const d = await getJSON<{ results: Row[] }>(`${BASE}/query-types/`);
      const list = ((d?.results ?? []) as Row[]);
      setQtypes([{ v: SEL, t: SEL }, { v: ALL, t: ALL },
        ...list.map((s) => ({ v: String(val(s, "status")), t: String(val(s, "status")) }))]);
    })();
  }, []);

  const report = async () => {
    // help_desk_report()
    if (!client || client === SEL) { window.alert("Please Select Client Name..."); return; }
    if (!state || state === SEL) { window.alert("Please Select State Name..."); return; }
    if (!branch || branch === SEL) { window.alert("Please Select Branch Name..."); return; }
    if (qtype === "") { window.alert("Please Select Query Type..."); return; } // legacy dead check
    const d = await getJSON<{ results: Row[] }>(
      `${BASE}/report/?client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}&unit_name=${encodeURIComponent(branch)}&qtype=${encodeURIComponent(qtype)}`);
    const list = ((d?.results ?? []) as Row[]);
    if (list.length === 0) { const t = "No Matching Records Found."; window.alert(t); show(t, false); return; }
    const cols = ["SR.NO.", "CLIENT NAME", "STATE", "BRANCH NAME", "QUERY HEAD", "QUERY DATE", "DESCRIPTION", "UPLOAD DATE", "STATUS", "REMARK"];
    const m: Record<string, string> = { "CLIENT NAME": "client_name", "STATE": "state", "BRANCH NAME": "unit_name", "QUERY HEAD": "query_head", "QUERY DATE": "query_date", "DESCRIPTION": "description", "UPLOAD DATE": "upload_date", "STATUS": "status", "REMARK": "remark" };
    const html = `<table border=1><tr></tr><tr><th colspan=10>REPORT HELP DESK EXCEL-SHEET</th></tr><tr>${cols.map((c) => `<th>${c}</th>`).join("")}</tr>` +
      list.map((r, i) => `<tr><td>${i + 1}</td>${cols.slice(1).map((c) => `<td>${val(r, m[c])}</td>`).join("")}</tr>`).join("") +
      `</table>`;
    const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "REPORT_HELP_DESKs.xls";
    document.body.appendChild(a); a.click(); a.remove();
    show("Report downloaded", true);
  };
  return (
    <div>
      <Msg text={msg.text} ok={msg.ok} />
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12"><b>Client Name :</b>
          <select className="form-control" value={client} onChange={(e) => { setClient(e.target.value); setState(SEL); setBranch(SEL); }}>
            {clients.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12"><b>State :</b>
          <select className="form-control" value={state} onChange={(e) => { setState(e.target.value); setBranch(SEL); }}>
            {states.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12"><b>Branch Name :</b>
          <select className="form-control" value={branch} onChange={(e) => setBranch(e.target.value)}>
            {branches.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12"><b>Query Type :</b>
          <select className="form-control" value={qtype} onChange={(e) => setQtype(e.target.value)}>
            {qtypes.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12" style={{ alignSelf: "flex-end" }}>
          <button type="button" className="btn-block btn-primary it-btn" onClick={report}>REPORT</button>
        </div>
      </div>
    </div>
  );
}

/* ================= shell ================= */
const TABS = [
  { key: "menu1", label: "HELP DESK" },
  { key: "menu2", label: "HELP DESK ACTION" },
  { key: "menu3", label: "REPORT" },
];

export default function HelpDeskPortal() {
  const [hidtab, setHidtab] = useState("menu1");
  const openHelp = () => {
    window.open("html/CompanyMaster.html", "popUpWindow",
      "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No");
  };
  return (
    <div className="container-fluid itmaster">
      <div className="lg-panel">
        <div className="lg-panel-head">
          <div className="row">
            <div className="col-sm-10">
              <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase"><b>HELP DESK IHMS.</b></div>
            </div>
            <div className="col-sm-2 text-right">
              <button type="button" onClick={openHelp} style={{ background: "transparent", border: "none", cursor: "pointer" }} title="Help">
                <img src="/Images/help_ico.png" width={20} height={20} alt="Help" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="container-fluid">
        <div id="tabs" className="itmaster-tabs">
          <input type="hidden" id="hidtab" value={hidtab} readOnly />
          <ul>
            {TABS.map((t) => (
              <li key={t.key} className={hidtab === t.key ? "active" : ""}>
                <a data-toggle="tab" href={`#${t.key}`} onClick={(e) => { e.preventDefault(); setHidtab(t.key); }}>
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
          <div id={hidtab} className="itmaster-body">
            {hidtab === "menu1" && <TabRaise />}
            {hidtab === "menu2" && <TabAction />}
            {hidtab === "menu3" && <TabReport />}
          </div>
        </div>
      </div>
    </div>
  );
}
