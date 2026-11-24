"use client";
/* =====================================================================
 * SERVICE REQUEST — 1:1 port of IHMS_Services.aspx.
 * 4 tabs: Feedback | Client Request | Supervisor Request |
 * Raised Complaints. Exact controls, exact validation strings, exact
 * grid columns, csv/print/copy/colvis exports (tabs 2-4; tab 1 has none
 * in legacy). Backend: /api/masters/service-portal/* (legacy tables).
 * ===================================================================== */
import React, { useEffect, useState } from "react";
import { getJSON, mk, upload } from "@/lib/api/legacy-fetch";
import { API_BASE_URL, apiGet } from "@/lib/api/client";

const BASE = "/api/masters/service-portal";
const SEL = "Select";

type Row = Record<string, any>;
type Opt = { v: string; t: string };

const SERVICE_TYPES: Opt[] = [{ v: SEL, t: SEL }, { v: "Electrical", t: "Electrical" },
  { v: "Plumbing", t: "Plumbing" }, { v: "Carpentry", t: "Carpentry" },
  { v: "Civil", t: "Civil" }, { v: "Pest_Control", t: "Pest_Control" }, { v: "HVAC", t: "HVAC" }];

function Msg({ text, ok }: { text: string; ok: boolean }) {
  if (!text) return null;
  return (
    <div style={{ margin: "0 0 10px", padding: "6px 12px", borderRadius: 4, fontSize: 12,
      color: ok ? "#2e7d32" : "#c62828", background: ok ? "#e8f5e9" : "#ffebee",
      border: `1px solid ${ok ? "#a5d6a7" : "#ef9a9a"}` }}>{text}</div>
  );
}
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
async function need<T>(path: string, setWarn: (s: string) => void): Promise<T | null> {
  let r: Response;
  try {
    r = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include", headers: { Accept: "application/json" }, cache: "no-store",
    });
  } catch {
    setWarn("Cannot reach the backend at all — please check that the Django server is running, then Refresh.");
    return null;
  }
  if (r.ok) {
    setWarn("");
    try { return (await r.json()) as T; } catch { return {} as T; }
  }
  let detail = "";
  try {
    const b = await r.json();
    detail = (b as any)?.detail || "";
  } catch { /* HTML */ }
  if (r.status === 404) setWarn("Data not loading (404) — please restart the backend server for /api/masters/service-portal/*, then Refresh.");
  else if (r.status === 403) setWarn("Access denied (403) — your session may have expired. Please log in again and refresh.");
  else if (detail) setWarn(`Server says: ${detail}`);
  else setWarn("Failed to load data (server error) — please check the backend logs and the legacy DB connection.");
  return null;
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
function Exports({ id, cols, rows, cell }: { id: string; cols: string[]; rows: Row[]; cell: (r: Row, c: string) => any }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [showM, setShowM] = useState(false);
  const vis = cols.filter((c) => !hidden[c]);
  const q = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  return (
    <div className="dt-btns" style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", position: "relative" }}>
      <button type="button" className="dt-exp" onClick={() => {
        const blob = new Blob(["\ufeff" + vis.map(q).join(",") + "\r\n" + rows.map((r) => vis.map((c) => q(cell(r, c))).join(",")).join("\r\n")], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = `${id}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
      }}>csv</button>
      <button type="button" className="dt-exp" onClick={() => window.print()}>print</button>
      <button type="button" className="dt-exp" onClick={() => {
        navigator.clipboard?.writeText([vis.join("\t"), ...rows.map((r) => vis.map((c) => cell(r, c)).join("\t"))].join("\n")).catch(() => undefined);
      }}>copyHtml5</button>
      <button type="button" className="dt-exp" onClick={() => setShowM((s) => !s)}>colvis</button>
      {showM && (
        <div className="dt-colmenu" style={{ background: "#fff", border: "1px solid #ccc", padding: 8, position: "absolute", zIndex: 5 }}>
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

/* ================= TAB 1: Feedback ================= */
function TabFeedback({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [clients, setClients] = useState<Opt[]>([]);
  const [client, setClient] = useState(SEL);
  const [zones, setZones] = useState<Opt[]>([]);
  const [zone, setZone] = useState(SEL);
  const [zusers, setZusers] = useState<Opt[]>([]);
  const [zuser, setZuser] = useState(SEL);
  const [rusers, setRusers] = useState<Opt[]>([]);
  const [ruser, setRuser] = useState(SEL);
  const [branches, setBranches] = useState<Opt[]>([]);
  const [buser, setBuser] = useState(SEL);
  const [rows, setRows] = useState<Row[]>([]);
  const [warn, setWarn] = useState("");
  const q = encodeURIComponent;
  const load = async (cc: string, z = "", u = "", by = "") => {
    const d = await need<{ results: Row[] }>(
      `${BASE}/fb-grid/?client_code=${q(cc === SEL ? "" : cc)}&zone=${q(z === SEL ? "" : z)}&user=${q(u)}&by=${by}`, setWarn);
    if (d) setRows(((d?.results ?? []) as Row[]));
  };
  useEffect(() => {
    (async () => {
      const d = await need<{ results: Row[] }>(`${BASE}/fb-clients/`, setWarn);
      if (!d) return;
      const list = ((d?.results ?? []) as Row[]);
      setClients(list.map((c) => ({ v: String(val(c, "code")), t: String(val(c, "name")) })));
    })();
    load(SEL);
  }, []);
  const opts = (rows: Row[], v: string, t: string): Opt[] =>
    [{ v: SEL, t: SEL }, ...rows.map((r) => ({ v: String(val(r, v)), t: String(val(r, t)) }))];
  // ddl_client_SelectedIndexChanged1: zones + branches of the client, grid reloaded for the client
  const pick = async (v: string) => {
    setClient(v); setZone(SEL); setZuser(SEL); setRuser(SEL); setBuser(SEL);
    setZones([]); setZusers([]); setRusers([]); setBranches([]);
    load(v);
    if (v === SEL) return;
    const z = await need<{ results: Row[] }>(`${BASE}/fb-zones/?client_code=${q(v)}`, setWarn);
    if (z) setZones(opts(z.results ?? [], "zone", "zone"));
    const b = await need<{ results: Row[] }>(`${BASE}/fb-branches/?client_code=${q(v)}`, setWarn);
    if (b) setBranches(opts(b.results ?? [], "code", "name"));
  };
  // ddl_zone_name_SelectedIndexChanged: zone users + region users of the zone
  const pickZone = async (v: string) => {
    setZone(v); setZuser(SEL); setRuser(SEL); setZusers([]); setRusers([]);
    load(client, v);
    if (v === SEL) return;
    const zu = await need<{ results: Row[] }>(`${BASE}/fb-zone-users/?client_code=${q(client)}&zone=${q(v)}`, setWarn);
    if (zu) setZusers(opts(zu.results ?? [], "code", "name"));
    const ru = await need<{ results: Row[] }>(`${BASE}/fb-region-users/?client_code=${q(client)}&zone=${q(v)}`, setWarn);
    if (ru) setRusers(opts(ru.results ?? [], "code", "name"));
  };
  const del = async (id: any) => {
    const r = await mk(`${BASE}/fb-delete/`, { id });
    if (r.ok) {
      if (buser !== SEL) load(client, zone, buser, "branch");
      else if (ruser !== SEL) load(client, zone, ruser, "region_user");
      else if (zuser !== SEL) load(client, zone, zuser, "zone_user");
      else load(client, zone);
    } else { const t = await errText(r, "Delete failed"); window.alert(t); show(t, false); }
  };
  const dl = (name: string) => {
    if (!name) { window.alert("Atachment File Cannot Be Uploaded !!!"); return; }
    window.open(`${API_BASE_URL}${BASE}/fb-file/?name=${encodeURIComponent(name)}`, "_blank");
  };
  // USER ID / ID are hidden columns in the legacy grid (RowDataBound Cells[1], Cells[2])
  const cols = ["USER NAME", "FEEDBACK", "SUGGESTION", "FEEDBACK DATE", "ATTACHMENT FILE"];
  const Dd = ({ label, value, list, onChange }: { label: string; value: string; list: Opt[]; onChange: (v: string) => void }) => (
    <div className="col-sm-2 col-xs-12"><b>{label}</b>
      <select className="form-control" value={value} onChange={(e) => onChange(e.target.value)}>
        {(list.length ? list : [{ v: SEL, t: SEL }]).map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
      </select></div>
  );
  return (
    <div>
      <DropBanner errs={[warn]} />
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <Dd label="Client Name :" value={client} list={[{ v: SEL, t: SEL }, ...clients]} onChange={pick} />
        <Dd label="Zone :" value={zone} list={zones} onChange={pickZone} />
        <Dd label="Zone User Name :" value={zuser} list={zusers}
          onChange={(v) => { setZuser(v); if (v !== SEL) load(client, zone, v, "zone_user"); else load(client, zone); }} />
        <Dd label="Region User Name :" value={ruser} list={rusers}
          onChange={(v) => { setRuser(v); if (v !== SEL) load(client, zone, v, "region_user"); else load(client, zone); }} />
        <Dd label="Branch FeedBack :" value={buser} list={branches}
          onChange={(v) => { setBuser(v); if (v !== SEL) load(client, zone, v, "branch"); else load(client, zone); }} />
      </div>
      <br />
      <div className="grid-view">
        <table id="gv_feedback" className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
          <thead><tr><th>DELETE FEEDBACK</th>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={val(r, "id") || i}>
                <td><button type="button" className="it-btn" onClick={() => del(val(r, "id"))}>Delete</button></td>
                {cols.map((c) => (
                  <td key={c}>{c === "ATTACHMENT FILE"
                    ? (val(r, c) ? <button type="button" style={{ background: "none", border: "none", color: "#337ab7", cursor: "pointer", textDecoration: "underline" }} onClick={() => dl(val(r, c))}>Download</button> : "")
                    : val(r, c)}</td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= TAB 2: Client Request ================= */
function TabService({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [form, setForm] = useState({ id: "", client: "", branch: "", service: SEL, comment: "", date: "", status: "", unit: "" });
  const [files, setFiles] = useState<FileList | null>(null);
  const [warn, setWarn] = useState("");
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const load = async () => {
    const d = await need<{ results: Row[] }>(`${BASE}/svc-grid/`, setWarn);
    if (d) setRows(((d?.results ?? []) as Row[]));
  };
  useEffect(() => { load(); }, []);
  const select = async (id: any) => {
    const d = await need<any>(`${BASE}/svc-select/?id=${encodeURIComponent(String(id))}`, setWarn);
    const r = (d as any)?.row ?? {};
    if (r && (r.id || r.Id)) {
      setForm({
        id: String(val(r, "id")), client: String(val(r, "client_code")),
        branch: String(val(r, "unit_code")), service: String(val(r, "services") || SEL), comment: String(val(r, "additional_comment")),
        date: String(val(r, "date")), status: String(val(r, "status")), unit: String(val(r, "unit_code")),
      });
    }
  };
  const submit = async () => {
    const fd = new FormData();
    fd.append("id", form.id); fd.append("unit_code", form.unit);
    if (files) { for (let i = 0; i < files.length; i++) fd.append("files", files[i]); }
    const r = await upload(`${BASE}/svc-submit/`, fd);
    if (r.ok) { window.alert("Data Send Succesfully !!!"); show("Data Send Succesfully !!!", true); setFiles(null); load(); }
    else { const t = await errText(r, "Submit failed"); window.alert(t); show(t, false); }
  };
  const cols = ["ID", "CLIENT", "BRANCH", "REQUEST SERVICE", "COMMENT", "REQUEST DATE", "STATUS"];
  const m: Record<string, string> = { "ID": "id", "CLIENT": "client_code", "BRANCH": "unit_code", "REQUEST SERVICE": "services", "COMMENT": "additional_comment", "REQUEST DATE": "date", "STATUS": "status" };
  return (
    <div>
      <DropBanner errs={[warn]} />
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div className="col-sm-2 col-xs-12"><b>Client :</b>
          <input type="text" className="form-control" value={form.client} readOnly /></div>
        <div className="col-sm-2 col-xs-12"><b>Branch :</b>
          <input type="text" className="form-control" value={form.branch} readOnly /></div>
        <div className="col-sm-2 col-xs-12"><b>Services :</b>
          <select className="form-control" value={form.service} disabled onChange={(e) => set("service", e.target.value)}>
            {(SERVICE_TYPES.some((o) => o.v === form.service) ? SERVICE_TYPES : [...SERVICE_TYPES, { v: form.service, t: form.service }])
              .map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Comment :</b>
          <textarea className="form-control" cols={5} rows={2} value={form.comment} readOnly onChange={(e) => set("comment", e.target.value)} /></div>
        <div className="col-sm-2 col-xs-12"><b>Request Date :</b>
          <input type="text" className="form-control" value={form.date} readOnly /></div>
        <div className="col-sm-2 col-xs-12"><b>Status :</b>
          <input type="text" className="form-control" value={form.status} readOnly /></div>
        <div className="col-sm-2 col-xs-12"><b>Upload Documents :</b>
          <input type="file" multiple className="text_box" onChange={(e) => setFiles(e.target.files)} /></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" className="it-btn" onClick={submit}> Submit </button>
        <button type="button" className="it-btn" onClick={() => setForm({ id: "", client: "", branch: "", service: SEL, comment: "", date: "", status: "", unit: "" })}>Clear</button>
        <button type="button" className="btn btn-danger" onClick={() => { window.location.href = "/Home"; }}>Close</button>
      </div>
      <br />
      <div className="grid-view">
        <Exports id="gv_ihms_service" cols={cols} rows={rows} cell={(r, c) => val(r, m[c])} />
        <table id="gv_ihms_service" className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
          <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={val(r, "id") || i} onClick={() => select(val(r, "id"))} style={{ cursor: "pointer" }}>
                {cols.map((c) => <td key={c}>{val(r, m[c])}</td>)}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= TAB 3: Supervisor Request ================= */
function TabSupervisor({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [clients, setClients] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [states, setStates] = useState<Opt[]>([{ v: "Select State", t: "Select State" }]);
  const [branches, setBranches] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [vendors, setVendors] = useState<Opt[]>([{ v: "Select Vendor Name", t: "Select Vendor Name" }]);
  const [f, setF] = useState({ client: SEL, state: "Select State", branch: SEL, service: SEL, vtype: SEL, vendor: "Select Vendor Name", spec: "", make: "", model: "", amount: "", id: "", flag: "" });
  const [files, setFiles] = useState<FileList | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [warn, setWarn] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const loadGrid = async () => {
    const d = await need<{ results: Row[] }>(`${BASE}/sup-grid/`, setWarn);
    if (d) setRows(((d?.results ?? []) as Row[]));
  };
  useEffect(() => {
    (async () => {
      const d = await need<{ results: Row[] }>(`${BASE}/sup-clients/`, setWarn);
      if (!d) return;
      const list = ((d?.results ?? []) as Row[]);
      setClients([{ v: SEL, t: SEL }, ...list.map((c) => ({ v: String(val(c, "code")), t: String(val(c, "name")) }))]);
    })();
    loadGrid();
  }, []);
  useEffect(() => {
    (async () => {
      if (!f.client || f.client === SEL) { setStates([{ v: "Select State", t: "Select State" }]); return; }
      const d = await need<{ results: Row[] }>(`${BASE}/sup-states/?client_code=${encodeURIComponent(f.client)}`, setWarn);
      if (!d) return;
      const list = ((d?.results ?? []) as Row[]);
      setStates([{ v: "Select State", t: "Select State" },
        ...list.map((s) => ({ v: String(val(s, "state")), t: String(val(s, "state")) }))]);
    })();
  }, [f.client]);
  useEffect(() => {
    (async () => {
      if (!f.client || f.client === SEL || !f.state || f.state === "Select State") { setBranches([{ v: SEL, t: SEL }]); return; }
      const d = await need<{ results: Row[] }>(
        `${BASE}/sup-branches/?client_code=${encodeURIComponent(f.client)}&state=${encodeURIComponent(f.state)}`, setWarn);
      if (!d) return;
      const list = ((d?.results ?? []) as Row[]);
      setBranches([{ v: SEL, t: SEL }, ...list.map((b) => ({ v: String(val(b, "code")), t: String(val(b, "name")) }))]);
    })();
  }, [f.client, f.state]);
  useEffect(() => {
    (async () => {
      if (!f.branch || f.branch === SEL) { setVendors([{ v: "Select Vendor Name", t: "Select Vendor Name" }]); return; }
      const d = await need<{ results: Row[] }>(`${BASE}/sup-vendors/?unit_code=${encodeURIComponent(f.branch)}`, setWarn);
      if (!d) return;
      const list = ((d?.results ?? []) as Row[]);
      setVendors([{ v: "Select Vendor Name", t: "Select Vendor Name" },
        ...list.map((x) => ({ v: String(val(x, "code")), t: String(val(x, "name")) }))]);
    })();
  }, [f.branch]);
  // Req_validation()
  const valid = () => {
    if (!f.client || f.client === SEL) { window.alert("Please Select Client Name"); return false; }
    if (!f.service || f.service === SEL) { window.alert("Please Select Service Type"); return false; }
    if (!f.vtype || f.vtype === SEL) { window.alert("Please Select Vendor Type"); return false; }
    if (!f.spec) { window.alert("Please Enter Product Specificaton"); return false; }
    if (!f.make) { window.alert("Please Enter Type"); return false; }
    if (!f.model) { window.alert("Please Enter Model Number"); return false; }
    if (!f.amount) { window.alert("Please Enter Costing Amount"); return false; }
    return true;
  };
  const draft = async () => {
    if (!valid()) return;
    const fd = new FormData();
    Object.entries({ client_code: f.client, unit_code: f.branch, state_name: f.state, services: f.service, vendor_type: f.vtype, vendor_code: f.vendor, product_specification: f.spec, type_make: f.make, model_no: f.model, costing_amount: f.amount }).forEach(([k, v]) => fd.append(k, v));
    if (files) { for (let i = 0; i < files.length; i++) fd.append("files", files[i]); }
    const r = await upload(`${BASE}/sup-draft/`, fd);
    if (r.ok) { window.alert("Record added successfully!!"); show("Record added successfully!!", true); loadGrid(); }
    else { const t = await errText(r, "Save failed"); window.alert(t); show(t, false); }
  };
  const submit = async () => {
    if (!window.confirm("Once you Submit you cannot make changes?")) return;
    const r = await mk(`${BASE}/sup-submit/`, {
      id: f.id, client_code: f.client, state_name: f.state, unit_code: f.branch, services: f.service,
      vendor_type: f.vtype, vendor_code: f.vendor, product_specification: f.spec, type_make: f.make,
      model_no: f.model, costing_amount: f.amount,
    });
    if (r.ok) { window.alert("Record added successfully!!"); show("Record added successfully!!", true); loadGrid(); }
    else { const t = await errText(r, "Submit failed"); window.alert(t); show(t, false); }
  };
  const select = async (id: any) => {
    const d = await need<any>(`${BASE}/sup-select/?id=${encodeURIComponent(String(id))}`, setWarn);
    const r = (d as any)?.row ?? {};
    if (r && (r.id || r.Id)) {
      setF((p) => ({
        ...p, client: String(val(r, "client_code")), branch: String(val(r, "unit_code")),
        state: String(val(r, "state_name")), service: String(val(r, "services")),
        vtype: String(val(r, "vendor_type")), vendor: String(val(r, "vendor_code")),
        spec: String(val(r, "product_specification")), make: String(val(r, "type_make")),
        model: String(val(r, "model_no")), amount: String(val(r, "costing_amount")),
        id: String(val(r, "id")), flag: String(val(r, "flag") ?? ""),
      }));
    }
  };
  const showBtns = f.flag === "" || f.flag === "0";
  const cols = ["ID", "CLIENT", "UNIT", "STATE", "SERVICE", "VENDOR TYPE", "VENDOR", "SPECIFICATION", "TYPE/MAKE", "MODEL NO", "AMOUNT"];
  const m: Record<string, string> = { "ID": "id", "CLIENT": "client_code", "UNIT": "UNIT", "STATE": "state_name", "SERVICE": "services", "VENDOR TYPE": "vendor_type", "VENDOR": "VENDOR", "SPECIFICATION": "product_specification", "TYPE/MAKE": "type_make", "MODEL NO": "model_no", "AMOUNT": "costing_amount" };
  const alphaNum = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (k.length !== 1) return;
    if (/^[A-Za-z0-9 \t]$/.test(k)) return;
    e.preventDefault();
  };
  return (
    <div>
      <DropBanner errs={[warn]} />
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div className="col-sm-2 col-xs-12"><b>Client Name</b>
          <select className="form-control" value={f.client} onChange={(e) => set("client", e.target.value)}>
            {clients.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Select State</b>
          <select className="form-control" value={f.state} onChange={(e) => set("state", e.target.value)}>
            {states.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Branch Name</b>
          <select className="form-control" value={f.branch} onChange={(e) => set("branch", e.target.value)}>
            {branches.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Service type</b>
          <select className="form-control" value={f.service} onChange={(e) => set("service", e.target.value)}>
            {SERVICE_TYPES.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Vendor type</b>
          <select className="form-control" value={f.vtype} onChange={(e) => set("vtype", e.target.value)}>
            {SERVICE_TYPES.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Vendor Name</b>
          <select className="form-control" value={f.vendor} onChange={(e) => set("vendor", e.target.value)}>
            {vendors.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Product specification</b>
          <input type="text" className="form-control" value={f.spec} onChange={(e) => set("spec", e.target.value)} onKeyPress={alphaNum} /></div>
        <div className="col-sm-2 col-xs-12"><b>Type/Make</b>
          <input type="text" className="form-control" value={f.make} onChange={(e) => set("make", e.target.value)} onKeyPress={alphaNum} /></div>
        <div className="col-sm-2 col-xs-12"><b>Model No</b>
          <input type="text" className="form-control" value={f.model} onChange={(e) => set("model", e.target.value)} onKeyPress={alphaNum} /></div>
        <div className="col-sm-2 col-xs-12"><b>Costing/Amount</b>
          <input type="text" className="form-control" value={f.amount} onChange={(e) => set("amount", e.target.value)} onKeyPress={alphaNum} /></div>
        <div className="col-sm-2 col-xs-12"><b>Documents</b>
          <input type="file" multiple onChange={(e) => setFiles(e.target.files)} /></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {showBtns && <button type="button" className="it-btn" onClick={draft}> Save As Draft </button>}
        {showBtns && <button type="button" className="it-btn" onClick={submit}> Submit </button>}
        <button type="button" className="it-btn" onClick={() => setF({ client: SEL, state: "Select State", branch: SEL, service: SEL, vtype: SEL, vendor: "Select Vendor Name", spec: "", make: "", model: "", amount: "", id: "", flag: "" })}>Clear</button>
        <button type="button" className="btn btn-danger" onClick={() => { window.location.href = "/Home"; }}>Close</button>
      </div>
      <br />
      <div className="grid-view">
        <Exports id="gv_superviser" cols={cols} rows={rows} cell={(r, c) => val(r, m[c])} />
        <table id="gv_superviser" className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
          <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={val(r, "id") || i} onClick={() => select(val(r, "id"))} style={{ cursor: "pointer" }}>
                {cols.map((c) => <td key={c}>{val(r, m[c])}</td>)}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={11} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============ Complaint_category.aspx / Add_New_Complaints.aspx popups ============ */
function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
      onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 6, width: "80%", maxHeight: "80%", overflow: "auto", padding: 12 }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <b>{title}</b>
          <button type="button" className="btn btn-danger" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}
const alphaNumKey = (e: React.KeyboardEvent) => {
  if (e.key.length === 1 && !/^[A-Za-z0-9 \t]$/.test(e.key)) e.preventDefault();
};
// AllowAlphabet_address from Add_New_Complaints.aspx
const addressKey = (e: React.KeyboardEvent) => {
  if (e.key.length === 1 && !/^[A-Za-z0-9 &,\-./:;=\\]$/.test(e.key)) e.preventDefault();
};

function CategoryModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [cat, setCat] = useState("");
  const [warn, setWarn] = useState("");
  const load = async () => {
    const d = await need<{ results: Row[] }>(`${BASE}/cat-list/`, setWarn);
    if (d) setRows(d.results ?? []);
  };
  useEffect(() => { load(); }, []);
  const save = async () => {
    if (!cat) { window.alert("Please Enter category !!"); return; }
    const r = await mk(`${BASE}/cat-add/`, { category: cat });
    if (r.ok) window.alert("Record Added Successfully... !!");
    else window.alert((await errText(r, "Record Added Faill.... !!")));
    setCat(""); load();
  };
  const del = async (id: any) => {
    const r = await mk(`${BASE}/cat-delete/`, { id });
    if (!r.ok) window.alert(await errText(r, "Delete failed"));
    load();
  };
  return (
    <ModalShell title="Add Category" onClose={onClose}>
      <DropBanner errs={[warn]} />
      <div className="row" style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
        <div className="col-sm-4 col-xs-12">Add Category: <span style={{ color: "red" }}>*</span>
          <input type="text" className="form-control" value={cat} onChange={(e) => setCat(e.target.value)} onKeyPress={alphaNumKey} /></div>
        <div><button type="button" className="btn btn-primary" onClick={save}>Save</button></div>
      </div>
      <br />
      <table className="table table-bordered" style={{ width: "70%", background: "#fff" }}>
        <thead style={{ background: "#337AB7", color: "#fff" }}><tr><th></th><th>Sr No.</th><th>Category</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={val(r, "id") || i}>
              <td><button type="button" className="btn btn-primary" onClick={() => del(val(r, "id"))}>Delete</button></td>
              <td>{i + 1}</td><td>{val(r, "category")}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", color: "#999" }}>No records</td></tr>}
        </tbody>
      </table>
    </ModalShell>
  );
}

function ComplaintModal({ onClose }: { onClose: () => void }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [cats, setCats] = useState<Row[]>([]);
  const [name, setName] = useState("");
  const [cat, setCat] = useState(SEL);
  const [pri, setPri] = useState(SEL);
  const [warn, setWarn] = useState("");
  const load = async () => {
    const d = await need<{ results: Row[] }>(`${BASE}/cmp-list/`, setWarn);
    if (d) setRows(d.results ?? []);
  };
  useEffect(() => {
    load();
    (async () => {
      const d = await need<{ results: Row[] }>(`${BASE}/cat-list/`, setWarn);
      if (d) setCats(d.results ?? []);
    })();
  }, []);
  const save = async () => {
    if (!name) { window.alert("Please Enter Complaints!!!"); return; }
    if (cat === SEL) { window.alert("Please Select Complaint Category !!!"); return; }
    if (pri === SEL) { window.alert("Please Select Complaint Priority !!!"); return; }
    const r = await mk(`${BASE}/cmp-add/`, { name, comp_category: cat, priority: pri });
    if (r.ok) window.alert("Record Added Successfully... !!");
    else window.alert((await errText(r, "Record Added Faill.... !!")));
    setName(""); setCat(SEL); setPri(SEL); load();
  };
  const del = async (id: any) => {
    const r = await mk(`${BASE}/cmp-delete/`, { id });
    if (!r.ok) window.alert(await errText(r, "Delete failed"));
    load();
  };
  return (
    <ModalShell title="Add New Complaints" onClose={onClose}>
      <DropBanner errs={[warn]} />
      <div className="row" style={{ display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="col-sm-3 col-xs-12">Add Complaints: <span style={{ color: "red" }}>*</span>
          <input type="text" className="form-control" value={name} onChange={(e) => setName(e.target.value)} onKeyPress={addressKey} /></div>
        <div className="col-sm-3 col-xs-12">Complaint Category : <span style={{ color: "red" }}>*</span>
          <select className="form-control" value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value={SEL}>{SEL}</option>
            {cats.map((c, i) => <option key={i} value={String(val(c, "category"))}>{String(val(c, "category"))}</option>)}
          </select></div>
        <div className="col-sm-3 col-xs-12">Priority : <span style={{ color: "red" }}>*</span>
          <select className="form-control" value={pri} onChange={(e) => setPri(e.target.value)}>
            {[SEL, "TOP", "MEDIUM", "LOW"].map((o) => <option key={o} value={o}>{o}</option>)}
          </select></div>
        <div><button type="button" className="btn btn-primary" onClick={save}>Save</button></div>
      </div>
      <br />
      <table className="table table-bordered" style={{ width: "100%", background: "#fff" }}>
        <thead style={{ background: "#337AB7", color: "#fff" }}><tr><th></th><th>Sr No.</th><th>Complaint</th><th>Category</th><th>Priority</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={val(r, "id") || i}>
              <td><button type="button" className="btn btn-primary" onClick={() => del(val(r, "id"))}>Delete</button></td>
              <td>{i + 1}</td><td>{val(r, "name")}</td><td>{val(r, "comp_category")}</td><td>{val(r, "priority")}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "#999" }}>No records</td></tr>}
        </tbody>
      </table>
    </ModalShell>
  );
}

/* ================= TAB 4: Raised Complaints ================= */
function TabComplaints({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [clients, setClients] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [states, setStates] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [branches, setBranches] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [client, setClient] = useState(SEL);
  const [state, setState] = useState(SEL);
  const [branch, setBranch] = useState(SEL);
  const [rows, setRows] = useState<Row[]>([]);
  const [comments, setComments] = useState<Record<number, string>>({});
  const [warn, setWarn] = useState("");
  const [catOpen, setCatOpen] = useState(false);
  const [compOpen, setCompOpen] = useState(false);
  const loadGrid = async (cc: string, st: string, br: string) => {
    const d = await need<{ results: Row[] }>(
      `${BASE}/comp-grid/?client_code=${encodeURIComponent(cc)}&state=${encodeURIComponent(st)}&unit_code=${encodeURIComponent(br)}`,
      setWarn);
    if (!d) return;
    const list = ((d?.results ?? []) as Row[]);
    setRows(list);
    setComments(Object.fromEntries(list.map((r, i) => [i, String(val(r, "comment") ?? "")])));
  };
  useEffect(() => {
    (async () => {
      const d = await need<{ results: Row[] }>(`${BASE}/comp-clients/`, setWarn);
      if (!d) return;
      const list = ((d?.results ?? []) as Row[]);
      setClients([{ v: SEL, t: SEL }, ...list.map((c) => ({ v: String(val(c, "code")), t: String(val(c, "name")) }))]);
    })();
    loadGrid("", "", "");
  }, []);
  useEffect(() => {
    (async () => {
      if (!client || client === SEL) { setStates([{ v: SEL, t: SEL }]); return; }
      const d = await need<{ results: Row[] }>(`${BASE}/comp-states/?client_code=${encodeURIComponent(client)}`, setWarn);
      if (!d) return;
      const list = ((d?.results ?? []) as Row[]);
      setStates([{ v: SEL, t: SEL }, ...list.map((s) => ({ v: String(val(s, "state")), t: String(val(s, "state")) }))]);
    })();
  }, [client]);
  useEffect(() => {
    (async () => {
      if (!client || client === SEL) { setBranches([{ v: SEL, t: SEL }]); return; }
      const d = await need<{ results: Row[] }>(
        `${BASE}/comp-branches/?client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}`, setWarn);
      if (!d) return;
      const list = ((d?.results ?? []) as Row[]);
      setBranches([{ v: SEL, t: SEL }, ...list.map((b) => ({ v: String(val(b, "code")), t: String(val(b, "name")) }))]);
    })();
  }, [client, state]);
  const resolve = async (r: Row, i: number) => {
    if (!window.confirm("Are you sure want to resolve ?")) return;
    const c = comments[i] ?? "";
    if (!c) { window.alert(" First Enter Comment"); return; }
    const resp = await mk(`${BASE}/comp-resolve/`, { id: val(r, "No"), comment: c });
    if (resp.ok) { show("Resolved", true); loadGrid(client, state, branch); }
    else { const t = await errText(resp, "Resolve failed"); window.alert(t); show(t, false); }
  };
  const cols = ["No.", "client name", "REGION", "State", "Branch name", "Type Of Complaint", "Priority",
    "Complaint Raise Date", "Complaint Resolved Date", "Status", "Remark From Client", "COMMENT", ""];
  return (
    <div>
      <DropBanner errs={[warn]} />
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div className="col-sm-2 col-xs-12"><b>Client Name</b>
          <select className="form-control" value={client} onChange={(e) => {
            const v = e.target.value; setClient(v); setState(SEL); setBranch(SEL); loadGrid(v, SEL, SEL);
          }}>
            {clients.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>State Name</b>
          <select className="form-control" value={state} onChange={(e) => {
            const v = e.target.value; setState(v); setBranch(SEL); loadGrid(client, v, SEL);
          }}>
            {states.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Branch Name</b>
          <select className="form-control" value={branch} onChange={(e) => {
            const v = e.target.value; setBranch(v); loadGrid(client, state, v);
          }}>
            {branches.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12" style={{ alignSelf: "flex-end" }}>
          <button type="button" className="it-btn" onClick={() => setCatOpen(true)}>ADD NEW CATEGORY</button></div>
        <div className="col-sm-2 col-xs-12" style={{ alignSelf: "flex-end" }}>
          <button type="button" className="it-btn" onClick={() => setCompOpen(true)}>ADD NEW COMPLAINTS</button></div>
      </div>
      <br />
      <div className="grid-view">
        <Exports id="unitcomplaintGridView" cols={cols.filter((c) => c)} rows={rows}
          cell={(r, c) => (c === "No." ? "" : c === "COMMENT" ? (comments[rows.indexOf(r)] ?? "") : val(r, c))} />
        <table id="unitcomplaintGridView" className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
          <thead><tr>{cols.map((c, i) => <th key={i}>{c || "Resolve"}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={val(r, "No") || i}>
                <td>{i + 1}</td>
                <td>{val(r, "client name")}</td><td>{val(r, "REGION")}</td><td>{val(r, "State")}</td>
                <td>{val(r, "Branch name")}</td><td>{val(r, "Type Of Complaint")}</td>
                <td>{val(r, "Priority")}</td><td>{val(r, "Complaint Raise Date")}</td>
                <td>{val(r, "Complaint Resolved Date")}</td><td>{val(r, "Status")}</td>
                <td style={{ width: 200 }}>{val(r, "Remark From Client")}</td>
                <td><input type="text" className="form-control" style={{ width: 150 }} value={comments[i] ?? ""}
                  onChange={(e) => setComments((p) => ({ ...p, [i]: e.target.value }))} /></td>
                <td>{String(val(r, "Status")).toLowerCase() === "new" || String(val(r, "Status")) === "New" ? (
                  <button type="button" className="it-btn" onClick={() => resolve(r, i)}>Resolve</button>
                ) : null}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={13} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
      {catOpen && <CategoryModal onClose={() => setCatOpen(false)} />}
      {compOpen && <ComplaintModal onClose={() => setCompOpen(false)} />}
    </div>
  );
}

/* ================= shell ================= */
const TABS = [
  { key: "tabs-1", label: "Feedback" },
  { key: "tabs-2", label: "Client Request" },
  { key: "tabs-3", label: "Supervisor Request" },
  { key: "tabs-4", label: "Raised Complaints" },
];

export default function ServicePortal() {
  const [hidtab, setHidtab] = useState("tabs-1");
  const [msg, setMsg] = useState({ text: "", ok: true });
  const show = (text: string, ok = true) => setMsg({ text, ok });
  const openHelp = () => {
    window.open("/html/DepartmentMaster.html", "popUpWindow",
      "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No");
  };
  return (
    <div className="container-fluid itmaster">
      <div className="lg-panel" style={{ marginBottom: 0 }}>
        <div className="lg-panel-head">
          <div className="row">
            <div className="col-sm-10">
              <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase"><b>SERVICE REQUEST</b></div>
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
        <Msg text={msg.text} ok={msg.ok} />
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
            {hidtab === "tabs-1" && <TabFeedback show={show} />}
            {hidtab === "tabs-2" && <TabService show={show} />}
            {hidtab === "tabs-3" && <TabSupervisor show={show} />}
            {hidtab === "tabs-4" && <TabComplaints show={show} />}
          </div>
        </div>
      </div>
    </div>
  );
}
