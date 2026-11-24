"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getJSON, getJSONStrict } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

// Legacy client_dashboard.aspx: Client / State / Branch drop-downs, 12 KPI cards (some with
// Dispatch / Pending sub-counts) and a drill-down grid per card (modal in legacy).
const CD = "/api/masters/client-dashboard/";

interface Opt { unit_code: string; unit_name: string }
interface Filters { clients: { client_name: string; client_code: string }[]; states: string[]; units: Opt[] }
interface Grid { tile: string; columns: string[]; headers: string[]; results: Record<string, any>[]; count: number }

// image folders used by the legacy page (served from /media/<folder>/)
const IMG_FOLDER: Record<string, string> = {
  image_name: "working_images", fire_upload: "fire_extinguisher",
  EMP_ADHAR_PAN: "EMP_Images", EMP_10TH_MARKSHEET: "EMP_Images", EMP_12TH_MARKSHEET: "EMP_Images",
  FormNo_2: "EMP_Images", FormNo_11: "EMP_Images", emp_signature: "EMP_Images", original_photo: "EMP_Images",
  original_adhar_card: "EMP_Images", original_address_proof: "EMP_Images", bank_passbook: "EMP_Images",
};

interface Card { key: string; label: string; icon: string; cls: string; subs?: { key: string; label: string }[]; title: string }
const CARDS: Card[] = [
  { key: "total_emp", label: "Total Employee", icon: "fa-user", cls: "#448aff", title: "Total Employee" },
  { key: "android", label: "Andriod Attendance", icon: "fa-mobile", cls: "#ffb64d", title: "Todays Present Employee" },
  { key: "cleaning", label: "Cleaning Images", icon: "fa-picture-o", cls: "#9ccc65", title: "Cleaning Images" },
  { key: "id_card", label: "ID Card Status", icon: "fa-id-card", cls: "#ff5252", title: "ID CARD",
    subs: [{ key: "id_dispatch", label: "Dispatch" }, { key: "id_pending", label: "Pending" }] },
  { key: "tracking", label: "Employee Tracking", icon: "fa-map-marker", cls: "#448aff", title: "Employe Tracking" },
  { key: "kyc", label: "KYC Details", icon: "fa-file-text", cls: "#ffb64d", title: "KYC Document" },
  { key: "branch", label: "Total Branch", icon: "fa-building", cls: "#9ccc65", title: "Total Branch" },
  { key: "uniform", label: "Uniform Status", icon: "fa-shopping-bag", cls: "#ff5252", title: "Uniform Details",
    subs: [{ key: "uniform_dispatch", label: "Dispatch" }, { key: "uniform_pending", label: "Pending" }] },
  { key: "material", label: "Consumable Material", icon: "fa-cubes", cls: "#448aff", title: "Consumable Material Details",
    subs: [{ key: "material_dispatch", label: "Dispatch" }, { key: "material_pending", label: "Pending" }] },
  { key: "deep", label: "Deep Clean Images", icon: "fa-picture-o", cls: "#ffb64d", title: "Deep Cleaning Images" },
  { key: "pest", label: "Pest Control Images", icon: "fa-bug", cls: "#9ccc65", title: "Pest Control Images" },
  { key: "fire", label: "Fire Extinguisher", icon: "fa-fire-extinguisher", cls: "#ff5252", title: "Fire Extinguisher" },
];
const TITLES: Record<string, string> = {
  id_dispatch: "ID CARD", id_pending: "ID CARD", uniform_dispatch: "Uniform Details", uniform_pending: "Uniform Details",
  material_dispatch: "Consumable Material Details", material_pending: "Consumable Material Details",
};

export default function ClientDashboardPage() {
  const router = useRouter();
  const [f, setF] = useState<Filters>({ clients: [], states: [], units: [] });
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("ALL");
  const [unit, setUnit] = useState("ALL");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [open, setOpen] = useState<string>("");
  const [grid, setGrid] = useState<Grid | null>(null);
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [month, setMonth] = useState("");
  const [search, setSearch] = useState("");

  const qs = useCallback((extra: Record<string, string> = {}) => {
    const p = new URLSearchParams();
    if (client && client !== "Select") p.set("client_code", client);
    if (state && state !== "ALL") p.set("state", state);
    if (unit && unit !== "ALL") p.set("unit_code", unit);
    Object.entries(extra).forEach(([k, v]) => { if (v) p.set(k, v); });
    return p.toString();
  }, [client, state, unit]);

  useEffect(() => { (async () => { const d = await getJSON<Filters>(`${CD}filters/`); if (d) setF(d); })(); }, []);

  const loadTiles = useCallback(async () => {
    if (client === "Select") { setCounts({}); return; }
    try { setCounts(await getJSONStrict<Record<string, number>>(`${CD}tiles/?${qs()}`)); }
    catch (e: any) { setCounts({}); }
  }, [client, qs]);
  useEffect(() => { loadTiles(); }, [loadTiles]);

  const onClient = async (v: string) => {
    setClient(v); setState("ALL"); setUnit("ALL"); setOpen(""); setGrid(null);
    if (v !== "Select") {
      const d = await getJSON<Filters>(`${CD}filters/?client_code=${encodeURIComponent(v)}`);
      if (d) setF((o) => ({ ...o, states: d.states, units: [] }));
    } else setF((o) => ({ ...o, states: [], units: [] }));
  };
  const onState = async (v: string) => {
    setState(v); setUnit("ALL"); setOpen(""); setGrid(null);
    if (v !== "ALL") {
      const d = await getJSON<Filters>(`${CD}filters/?client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(v)}`);
      if (d) setF((o) => ({ ...o, units: d.units }));
    } else setF((o) => ({ ...o, units: [] }));
  };

  const showTile = async (tile: string, extra: Record<string, string> = {}) => {
    if (client === "Select") { alert("Please Select Client Name "); return; }
    setOpen(tile); setSearch("");
    try { setGrid(await getJSONStrict<Grid>(`${CD}grid/?${qs({ tile, ...extra })}`)); }
    catch (e: any) { setGrid(null); alert(e?.message || "No Records Found !!!"); }
  };
  const dmy = (iso: string) => { const [y, m, d] = iso.split("-"); return y && m && d ? `${d}/${m}/${y}` : ""; };
  const showCleaning = () => {
    showTile("cleaning", from && to ? { from: dmy(from), to: dmy(to) } : {});
  };
  const showMonth = (tile: string) => { showTile(tile, month ? { month_year: `${month.slice(5, 7)}-${month.slice(0, 4)}` } : {}); };

  const cell = (col: string, v: any) => {
    if (IMG_FOLDER[col] !== undefined) {
      if (!v) return "";
      const url = `${API_BASE_URL}/media/${IMG_FOLDER[col]}/${v}`;
      const isImg = /\.(jpe?g|png|gif|bmp)$/i.test(String(v));
      return (
        <span>
          {isImg && <img src={url} alt="" width={50} height={50} />}<br />
          <a href={url} target="_blank" rel="noreferrer" title="View"><img src="/Images/view_icon.png" alt="View" width={20} height={20} /></a>
        </span>
      );
    }
    return v === null || v === undefined ? "" : String(v);
  };

  const rows = (grid?.results ?? []).filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(s));
  });
  const openTitle = TITLES[open] || CARDS.find((c) => c.key === open)?.title || "";

  return (
    <div className="container-fluid">
      <div className="panel panel-primary">
        <div className="panel-heading" style={{ textAlign: "center", fontWeight: "bold", textTransform: "uppercase", fontSize: "small" }}>Client Dashboard</div>
        <div className="panel-body">
          <div className="row" style={{ marginBottom: 15 }}>
            <div className="col-md-3">
              <label>Client Name <span style={{ color: "red" }}>*</span></label>
              <select className="form-control" value={client} onChange={(e) => onClient(e.target.value)}>
                <option value="Select">Select</option>
                {f.clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label>State Name</label>
              <select className="form-control" value={state} onChange={(e) => onState(e.target.value)}>
                <option value="ALL">ALL</option>
                {f.states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="col-md-3">
              <label>Branch Name</label>
              <select className="form-control" value={unit} onChange={(e) => { setUnit(e.target.value); setOpen(""); setGrid(null); }}>
                <option value="ALL">ALL</option>
                {f.units.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
              </select>
            </div>
            <div className="col-md-3" style={{ paddingTop: 25 }}>
              <button type="button" className="btn btn-danger" onClick={() => router.push("/")}>Close</button>
            </div>
          </div>

          <div className="row">
            {CARDS.map((c) => (
              <div key={c.key} className="col-md-3" style={{ marginBottom: 15 }}>
                <div style={{ background: c.cls, borderRadius: 4, padding: 15, color: "#000", boxShadow: "0 2px 10px rgba(0,0,0,.1)", minHeight: 96 }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); if (c.key === "cleaning" || c.key === "deep" || c.key === "pest") { if (client === "Select") { alert("Please Select Client Name "); return; } setOpen(c.key); setGrid(null); } else showTile(c.key); }} style={{ color: "#000", textDecoration: "none", display: "block" }}>
                    <div className="row">
                      <div className="col-xs-8"><b>{c.label}</b></div>
                      <div className="col-xs-4"><b>{c.key === "cleaning" || c.key === "deep" || c.key === "pest" ? "" : (counts[c.key] ?? "")}</b></div>
                    </div>
                    <i className={`fa ${c.icon}`} style={{ fontSize: 40 }} />
                  </a>
                  {c.subs && (
                    <div style={{ marginTop: 4 }}>
                      {c.subs.map((s) => (
                        <a key={s.key} href="#" onClick={(e) => { e.preventDefault(); showTile(s.key); }} style={{ color: "#000", marginRight: 14 }}>
                          <b>{s.label} {counts[s.key] ?? ""}</b>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {open && (
            <div className="panel panel-default" style={{ marginTop: 10 }}>
              <div className="panel-heading"><b>{openTitle}</b>
                <button type="button" className="btn btn-danger btn-xs pull-right" onClick={() => { setOpen(""); setGrid(null); }}>CLOSE</button>
              </div>
              <div className="panel-body">
                {open === "cleaning" && (
                  <div className="row" style={{ marginBottom: 10 }}>
                    <div className="col-md-3"><label>From Date</label><input type="date" className="form-control" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
                    <div className="col-md-3"><label>To Date</label><input type="date" className="form-control" value={to} onChange={(e) => setTo(e.target.value)} /></div>
                    <div className="col-md-2" style={{ paddingTop: 25 }}><button type="button" className="btn btn-primary" onClick={showCleaning}>SHOW</button></div>
                  </div>
                )}
                {(open === "deep" || open === "pest") && (
                  <div className="row" style={{ marginBottom: 10 }}>
                    <div className="col-md-3"><label>Month</label><input type="month" className="form-control" value={month} onChange={(e) => setMonth(e.target.value)} /></div>
                    <div className="col-md-2" style={{ paddingTop: 25 }}><button type="button" className="btn btn-primary" onClick={() => showMonth(open)}>SHOW</button></div>
                  </div>
                )}
                {grid && (
                  <>
                    <div className="row" style={{ marginBottom: 8 }}>
                      <div className="col-md-3 pull-right"><input className="form-control" placeholder="Search" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table className="table table-striped table-bordered table-hover">
                        <thead style={{ background: "#224173", color: "white" }}>
                          <tr><th>Sr No.</th>{grid.headers.map((h) => <th key={h}>{h}</th>)}</tr>
                        </thead>
                        <tbody>
                          {rows.map((r, i) => (
                            <tr key={i}><td>{i + 1}</td>{grid.columns.map((c) => <td key={c}>{cell(c, r[c])}</td>)}</tr>
                          ))}
                          {rows.length === 0 && <tr><td colSpan={grid.headers.length + 1} style={{ textAlign: "center" }}>No Records Found !!!</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
