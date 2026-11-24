"use client";
/* =====================================================================
 * HO PORTAL — 1:1 port of HO_Login.aspx (+ HO_Login.aspx.cs).
 * Header: WELCOME TO IH&MS | Login | LogOut | Zone Name | Region Name |
 * Branch Name (cascading, ALL allowed).
 * 15 tabs (exact legacy order/labels):
 * Employee Attendance | Work Photo | Deployment Details | Heads Info |
 * Monthly Attendance | Employee KYC | Feedback | Files |
 * Visit Report By FO | R & M | Current Attendance | Summary Report |
 * Raise Complaint | Fire Extinguisher Info | R&M Service
 * Backend: /api/masters/portal/ho/* (legacy tables, parameterized).
 * ===================================================================== */
import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api/client";

// Mutable on purpose: the portal base follows the login type (HO / Zone / Region) resolved from
// /api/masters/portal/context/ before any tab renders.
let BASE = "/api/masters/portal/ho";
const SEL = "Select";
const ALL = "ALL";

type Row = Record<string, any>;

function val(r: Row, name: string): any {
  if (r[name] !== undefined && r[name] !== null) return r[name];
  const want = name.toLowerCase();
  for (const k of Object.keys(r)) {
    if (k.toLowerCase() === want) return (r as Row)[k];
  }
  return "";
}

async function errMsg(r: Response): Promise<string> {
  let b: any = null;
  try { b = await r.json(); } catch { /* non-JSON */ }
  if (typeof b === "string" && b) return b;
  if (Array.isArray(b) && b.length) return String(b[0]);
  if (b && typeof b === "object") {
    if (typeof b.detail === "string" && b.detail) return b.detail;
    if (Array.isArray(b.detail) && b.detail.length) return String(b.detail[0]);
    const nf = (b as any).non_field_errors;
    if (Array.isArray(nf) && nf.length) return String(nf[0]);
    for (const v of Object.values(b)) {
      const s = Array.isArray(v) ? v[0] : v;
      if (typeof s === "string" && s) return s;
    }
  }
  return `Request failed (${r.status})`;
}

function errText(b: any, status: number): string {
  if (typeof b === "string" && b) return b;
  if (Array.isArray(b) && b.length) return String(b[0]);
  if (b && typeof b === "object") {
    if (typeof b.detail === "string" && b.detail) return b.detail;
    if (Array.isArray(b.detail) && b.detail.length) return String(b.detail[0]);
    const nf = (b as any).non_field_errors;
    if (Array.isArray(nf) && nf.length) return String(nf[0]);
    for (const v of Object.values(b)) {
      const s = Array.isArray(v) ? v[0] : v;
      if (typeof s === "string" && s) return s;
    }
  }
  return `Request failed (${status})`;
}

async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE_URL}${path}`, { credentials: "include", cache: "no-store" });
  if (!r.ok) throw new Error(await errMsg(r));
  return (await r.json()) as T;
}

async function csrfToken(): Promise<string> {
  const csrf = await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" })
    .then((r) => r.json()).catch(() => null);
  const m = typeof document !== "undefined" ? document.cookie.match(/(^|; )csrftoken=([^;]+)/) : null;
  return (csrf as any)?.csrfToken || (m ? decodeURIComponent(m[2]) : "");
}

async function postJSON(path: string, body: any): Promise<any> {
  const r = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": await csrfToken() },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(errText(d, r.status));
  return d;
}

async function postForm(path: string, form: FormData): Promise<any> {
  const r = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST", credentials: "include",
    headers: { "X-CSRFToken": await csrfToken() },
    body: form,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(errText(d, r.status));
  return d;
}

const th: React.CSSProperties = { background: "#006699", color: "#fff", fontWeight: "bold", textTransform: "uppercase", fontSize: 11, padding: "6px 8px", whiteSpace: "nowrap" };
const td: React.CSSProperties = { color: "#000066", background: "#fff", fontSize: 11, padding: "5px 8px", borderTop: "1px solid #ddd" };
const inp: React.CSSProperties = { width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid #ccc", borderRadius: 4 };
const lbl: React.CSSProperties = { fontWeight: "bold", fontSize: 12, color: "#000" };
const btnP: React.CSSProperties = { background: "#337ab7", color: "#fff", border: "1px solid #2e6da4", borderRadius: 4, padding: "6px 18px", fontWeight: "bold", fontSize: 12, cursor: "pointer" };
const btnD: React.CSSProperties = { background: "#d9534f", color: "#fff", border: "1px solid #d43f3a", borderRadius: 4, padding: "6px 18px", fontWeight: "bold", fontSize: 12, cursor: "pointer" };

function Exports({ id, cols, rows, cell }: { id: string; cols: string[]; rows: Row[]; cell: (r: Row, c: string) => any }) {
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
        a.href = URL.createObjectURL(blob); a.download = `${id}.csv`;
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

function Grid({ id, cols, rows, cell, img }: { id: string; cols: string[]; rows: Row[]; cell: (r: Row, c: string) => any; img?: (r: Row, c: string) => string | null }) {
  const [zoom, setZoom] = useState<string | null>(null);
  if (rows.length === 0) return <p style={{ fontSize: 12 }}>No records</p>;
  return (
    <>
      <Exports id={id} cols={cols} rows={rows} cell={cell} />
      <div style={{ overflow: "auto", maxHeight: 450, border: "1px solid #ccc" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr>{cols.map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {cols.map((c) => {
                  const src = img ? img(r, c) : null;
                  return (
                    <td key={c} style={td}>
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={src} alt="" width={50} height={50} style={{ cursor: "pointer", objectFit: "cover" }}
                          onClick={() => setZoom(src)} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      ) : String(cell(r, c) ?? "")}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" style={{ maxWidth: "80vw", maxHeight: "80vh", background: "#fff", padding: 4 }} />
        </div>
      )}
    </>
  );
}

const media = (sub: string, f: any) => (f ? `${API_BASE_URL}/media/${sub}/${encodeURIComponent(String(f))}` : "");
const ph = (txt: string) => `https://via.placeholder.com/50?text=${encodeURIComponent(txt)}`;

const ddmmyyyyToISO = (s: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s.trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};
const isoToDdmmyyyy = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
};
const mmyyyyToMonth = (s: string) => {
  const m = /^(\d{2})\/(\d{4})$/.exec(s.trim());
  return m ? `${m[2]}-${m[1]}` : "";
};
const monthToMmyyyy = (s: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  return m ? `${m[2]}/${m[1]}` : "";
};
function DateInput({ value, onChange, width }: { value: string; onChange: (s: string) => void; width?: number }) {
  return (
    <input type="date" style={{ ...inp, width: width ?? 150 }} value={ddmmyyyyToISO(value)}
      onChange={(e) => onChange(isoToDdmmyyyy(e.target.value))} />
  );
}
function MonthInput({ value, onChange, width }: { value: string; onChange: (s: string) => void; width?: number }) {
  return (
    <input type="month" style={{ ...inp, width: width ?? 130 }} value={mmyyyyToMonth(value)}
      onChange={(e) => onChange(monthToMmyyyy(e.target.value))} />
  );
}

export type Scope = { zone: string; region: string; unit: string; client: string };
const hq = (s: Scope, extra = "") => {
  const p = new URLSearchParams();
  if (s.zone) p.set("zone", s.zone);
  if (s.region) p.set("region", s.region);
  if (s.unit) p.set("unit_code", s.unit);
  if (s.client) p.set("client_code", s.client);
  const q = p.toString();
  return q + (extra ? (q ? "&" : "") + extra : "");
};

const TABS = ["Employee Attendance", "Work Photo", "Deployment Details", "Heads Info", "Monthly Attendance", "Employee KYC", "Feedback", "Files", "Visit Report By FO", "R & M", "Current Attendance", "Summary Report", "Raise Complaint", "Fire Extinguisher Info", "R&M Service"];

export default function HoPortal() {
  const [tab, setTab] = useState("Employee Attendance");
  const [login, setLogin] = useState("");
  const [scope, setScope] = useState<Scope>({ zone: ALL, region: ALL, unit: ALL, client: "" });
  const [zones, setZones] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [branches, setBranches] = useState<{ code: string; name: string }[]>([]);
  const [err, setErr] = useState("");
  const [ready, setReady] = useState(false);
  const [loginType, setLoginType] = useState("HO");
  const [tabs, setTabs] = useState<string[]>(TABS);

  useEffect(() => {
    (async () => {
      try {
        // Legacy Page_Load: no menu check, only the session; login_type decides the visible panels.
        const ctx = await getJSON<{ login_type: string; username: string; client_code: string; zone: string; region: string; tabs: string[] }>(`/api/masters/portal/context/`);
        BASE = `/api/masters/portal/${ctx.login_type.toLowerCase()}`;
        setLoginType(ctx.login_type);
        setLogin(ctx.username || "");
        setTabs(ctx.tabs);
        if (!ctx.tabs.includes("Employee Attendance")) setTab(ctx.tabs[0]);
        const client = ctx.client_code || "";
        // Zone / Region logins are locked to their own zone / region (no 'ALL').
        setScope((s) => ({ ...s, client, zone: ctx.zone || ALL, region: ctx.region || ALL }));
        const z = await getJSON<{ zones: string[] }>(`${BASE}/zones/?client_code=${encodeURIComponent(client)}`);
        setZones(z.zones || []);
        setReady(true);
      } catch (e: any) { setErr(e.message || "Header not loading"); }
    })();
  }, []);

  const loadRegions = async (zone: string, client: string) => {
    try {
      const d = await getJSON<{ zones: string[]; regions: string[] }>(`${BASE}/zones/?client_code=${encodeURIComponent(client)}&zone=${encodeURIComponent(zone)}`);
      setRegions(d.regions || []);
    } catch { setRegions([]); }
  };

  const loadBranches = async (zone: string, region: string) => {
    try {
      const d = await getJSON<{ results: Row[] }>(`${BASE}/units/?${hq({ zone, region, unit: "", client: scope.client })}`);
      setBranches((d.results || []).map((r) => ({ code: String(val(r, "unit_code")), name: String(val(r, "UNIT_NAME") || val(r, "unit_code")) })));
    } catch { setBranches([]); }
  };

  useEffect(() => { if (ready && scope.client) loadRegions(scope.zone, scope.client); }, [ready, scope.zone, scope.client]);
  useEffect(() => { if (ready && scope.client) loadBranches(scope.zone, scope.region); }, [ready, scope.zone, scope.region, scope.client]);
  const zoneLocked = loginType === "Zone" || loginType === "Region";
  const regionLocked = loginType === "Region";

  return (
    <div style={{ padding: 12, fontFamily: "Verdana", fontSize: 10 }}>
      <div style={{ background: "#f3f1fe", border: "1px solid gray", borderRadius: 4 }}>
        <div style={{ background: "#337ab7", color: "#fff", padding: "10px 14px", borderRadius: "4px 4px 0 0" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontWeight: "bold", fontSize: 16 }}>IH&amp;MS</div>
            <div style={{ flex: 1, textAlign: "center", fontSize: "large", fontWeight: "bold" }}>WELCOME TO IH&amp;MS</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontWeight: "bold", fontSize: 12 }}>Login :</span>
              <span style={{ background: "#337ab7", border: "1px solid #fff", padding: "4px 12px", borderRadius: 4, fontSize: 12 }}>{login}</span>
              <button type="button" style={{ ...btnP, background: "#fff", color: "#337ab7" }} onClick={async () => {
                await fetch(`${API_BASE_URL}/api/auth/logout/`, { method: "POST", credentials: "include" }).catch(() => undefined);
                window.location.href = "/login";
              }}>LogOut</button>
            </div>
          </div>
        </div>
        <div style={{ padding: 16 }}>
          {err && <p style={{ color: "red", fontSize: 12 }}>{err}</p>}
          <div style={{ background: "rgba(255,255,255,0.58)", borderRadius: 10, padding: 16 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 180, flex: 1 }}>
                <span style={lbl}>Zone Name :</span>
                <select style={inp} value={scope.zone} disabled={zoneLocked} onChange={(e) => setScope((s) => ({ ...s, zone: e.target.value, region: ALL, unit: ALL }))}>
                  {!zoneLocked && <option value={ALL}>{ALL}</option>}
                  {zones.map((z) => <option key={z} value={z}>{z}</option>)}
                </select>
              </div>
              <div style={{ minWidth: 180, flex: 1 }}>
                <span style={lbl}>Region Name :</span>
                <select style={inp} value={scope.region} disabled={regionLocked} onChange={(e) => setScope((s) => ({ ...s, region: e.target.value, unit: ALL }))}>
                  {!regionLocked && <option value={ALL}>{ALL}</option>}
                  {regions.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ minWidth: 260, flex: 2 }}>
                <span style={lbl}>Branch Name :</span>
                <select style={inp} value={scope.unit} onChange={(e) => setScope((s) => ({ ...s, unit: e.target.value }))}>
                  <option value={ALL}>{ALL}</option>
                  {branches.map((b) => <option key={b.code} value={b.code}>{b.name || b.code}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", marginTop: 12, border: "1px solid #ddd" }}>
        <ul style={{ display: "flex", gap: 2, flexWrap: "wrap", listStyle: "none", margin: 0, padding: 6, background: "#dddddd", border: "none" }}>
          {tabs.map((t) => (
            <li key={t}>
              <button type="button" onClick={() => setTab(t)}
                style={{ border: "1px solid #bbb", background: tab === t ? "#337ab7" : "#f5f5f5", color: tab === t ? "#fff" : "#000", fontSize: 11, padding: "6px 10px", cursor: "pointer", borderRadius: 3 }}><b>{t}</b></button>
            </li>
          ))}
        </ul>
        <div style={{ padding: 14 }}>
          {ready && tab === "Employee Attendance" && <TabEmpAtt scope={scope} />}
          {ready && tab === "Work Photo" && <TabWorkHO scope={scope} />}
          {ready && tab === "Deployment Details" && <TabDeployHO scope={scope} />}
          {ready && tab === "Heads Info" && <TabHeadsHO scope={scope} />}
          {ready && tab === "Monthly Attendance" && <TabMonthlyHO scope={scope} />}
          {ready && tab === "Employee KYC" && <TabKycHO scope={scope} />}
          {ready && tab === "Feedback" && <TabFeedbackHO />}
          {ready && tab === "Files" && <TabFilesHO scope={scope} />}
          {ready && tab === "Visit Report By FO" && <TabVisitHO scope={scope} />}
          {ready && tab === "R & M" && <TabRMOldHO scope={scope} />}
          {ready && tab === "Current Attendance" && <TabCurrentHO scope={scope} />}
          {ready && tab === "Summary Report" && <TabSummaryHO scope={scope} />}
          {ready && tab === "Raise Complaint" && <TabComplaintHO scope={scope} />}
          {ready && tab === "Fire Extinguisher Info" && <TabFireHO scope={scope} />}
          {ready && tab === "R&M Service" && <TabRMService scope={scope} />}
        </div>
      </div>
    </div>
  );
}

/* ================= Employee Attendance (menu16) ================= */
const ATT_TYPES = [{ v: "0", t: SEL }, { v: "1", t: "Mobile App Attendance" }, { v: "2", t: "Tab Attendance" }, { v: "3", t: "Desk Attendance" }, { v: "4", t: "Employee Tracking" }];
function TabEmpAtt({ scope }: { scope: Scope }) {
  const [type, setType] = useState("0");
  const [mtype, setMtype] = useState("0");
  const [f, setF] = useState(""); const [t, setT] = useState("");
  const [pres, setPres] = useState("0");
  const [grid, setGrid] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const show = async () => {
    if (type === "0") { alert(" Please Select Attendance Type "); return; }
    if (mtype === "0") { alert(" Please Select Month Type "); return; }
    if (mtype === "2") {
      if (!f) { alert(" Please Select From Date "); return; }
      if (!t) { alert(" Please Select To Date "); return; }
    }
    if (pres === "0") { alert(" Please Select Attendance"); return; }
    if (pres === "2" && (!scope.unit || scope.unit === ALL)) { alert(" Please Select Branch Name"); return; }
    try {
      const d = await getJSON<{ results: Row[]; grid: string; message?: string }>(
        `${BASE}/emp-attendance/?${hq(scope, `type=${type}&month_type=${mtype}&from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}&present=${pres}`)}`);
      if (d.message) alert(d.message);
      setGrid(d.grid || "");
      setRows(d.results || []);
    } catch (e: any) { alert(e.message); }
  };
  const photoCols = ["Sr No.", "BRANCH NAME", "NAME", "ADDRESS", "BRANCH IN-TIME", "BRANCH OUT_TIME", "OUTSIDE IN-TIME", "OUTSIDE OUT-TIME", "IN", "OUT"];
  const groomCols = ["Branch", "Employee Name", "Grade", "Shipt Time", "Punctuality", "Uniforms", "Cap", "Shoes", "Belt", "Id Card", "Shaving", "Hairs", "Nails", "Briefing", "InTime Image", "OutTime Image", "Remarks", "Location Address"];
  const trackCols = ["Sr No.", "Branch Name", "Emp-Name", "Current-Latitude", "Current-Longitude", "Current-Date", "Address"];
  const cols = grid === "tab" ? groomCols : grid === "tracking" ? trackCols : photoCols;
  const groomGet = (r: Row, c: string) => {
    const m: Record<string, string> = { "Branch": "unit_code", "Employee Name": "emp_name", "Grade": "grade_desc", "Shipt Time": "shifttime", "Punctuality": "punctuality", "Uniforms": "uniforms", "Cap": "cap", "Shoes": "shoes", "Belt": "belt", "Id Card": "id_card", "Shaving": "shaving", "Hairs": "hairs", "Nails": "nails", "Briefing": "briefing", "Remarks": "remarks", "Location Address": "location_add" };
    return val(r, m[c] || c);
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
        <div><span style={lbl}>Attendance Type:</span>
          <select style={{ ...inp, width: 200 }} value={type} onChange={(e) => setType(e.target.value)}>
            {ATT_TYPES.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select>
        </div>
        <div><span style={lbl}>Month Type:</span>
          <select style={{ ...inp, width: 150 }} value={mtype} onChange={(e) => setMtype(e.target.value)}>
            <option value="0">{SEL}</option><option value="1">Current Month</option><option value="2">Monthwise</option>
          </select>
        </div>
        {mtype === "2" && (
          <>
            <div><span style={lbl}>Form Date:</span><span style={{ color: "red" }}>*</span><br /><DateInput value={f} onChange={setF} width={150} /></div>
            <div><span style={lbl}>To Date:</span><span style={{ color: "red" }}>*</span><br /><DateInput value={t} onChange={setT} width={150} /></div>
          </>
        )}
        <div><span style={lbl}>Attendance:</span>
          <select style={{ ...inp, width: 130 }} value={pres} onChange={(e) => setPres(e.target.value)}>
            <option value="0">{SEL}</option><option value="1">Present</option><option value="2">Absent</option>
          </select>
        </div>
        <button type="button" style={btnP} onClick={show}>Show</button>
      </div>
      {grid !== "" && (
        <Grid id="emp-att" cols={cols} rows={rows.map((r, i) => ({ ...r, __i: i + 1 }))} cell={(r, c) => {
          if (c === "Sr No.") return r.__i;
          if (grid === "tab") return groomGet(r, c);
          if (grid === "tracking") return c === "Branch Name" ? val(r, "unit_name") : c === "Emp-Name" ? val(r, "emp_code") : c === "Current-Latitude" ? val(r, "cur_latitude") : c === "Current-Longitude" ? val(r, "cur_longtitude") : c === "Current-Date" ? val(r, "cur_date") : val(r, "cur_address");
          return c === "BRANCH NAME" ? val(r, "UNIT_NAME") : c === "NAME" ? val(r, "EMP_NAME") : c === "ADDRESS" ? val(r, "ADDRESS") : c === "BRANCH IN-TIME" ? val(r, "attendances_intime") : c === "BRANCH OUT_TIME" ? val(r, "attendances_outtime") : c === "OUTSIDE IN-TIME" ? val(r, "camera_intime") : c === "OUTSIDE OUT-TIME" ? val(r, "camera_outtime") : "";
        }} img={(r, c) => {
          if (grid === "photo") {
            if (c === "IN") { const x = val(r, "Attendances_intime_images") || val(r, "Camera_intime_images"); return x ? media("attendance_images", x) : null; }
            if (c === "OUT") { const x = val(r, "Attendances_outtime_images") || val(r, "Camera_outtime_images"); return x ? media("attendance_images", x) : null; }
          }
          if (grid === "tab") {
            if (c === "InTime Image") { const x = val(r, "intime_imgpath"); return x ? media("tab_attendance_images", x) : null; }
            if (c === "OutTime Image") { const x = val(r, "outtime_imgpath"); return x ? media("tab_attendance_images", x) : null; }
          }
          return null;
        }} />
      )}
    </div>
  );
}

/* ================= Work Photo (menu9) ================= */
function TabWorkHO({ scope }: { scope: Scope }) {
  const [f, setF] = useState(""); const [t, setT] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [done, setDone] = useState(false);
  const show = async () => {
    if (!f) { alert("Please Enter From Date"); return; }
    if (!t) { alert("Please Enter To Date"); return; }
    try {
      const d = await getJSON<{ results: Row[]; message?: string }>(`${BASE}/work_photos/?${hq(scope, `from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`)}`);
      if ((d as any).message) alert((d as any).message);
      setRows(d.results || []); setDone(true);
    } catch (e: any) { alert(e.message); }
  };
  const cols = ["Sr No.", "BRANCH NAME", "NAME", "WORK TIME", "WORK TIME IMAGE"];
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
        <div><span style={lbl}>From Date :</span><span style={{ color: "red" }}>*</span><br /><DateInput value={f} onChange={setF} width={150} /></div>
        <div><span style={lbl}>To Date :</span><span style={{ color: "red" }}>*</span><br /><DateInput value={t} onChange={setT} width={150} /></div>
        <button type="button" style={btnP} onClick={show}>Show</button>
      </div>
      {done && (
        <Grid id="ho-work" cols={cols} rows={rows.map((r, i) => ({ ...r, __i: i + 1 }))} cell={(r, c) =>
          c === "Sr No." ? r.__i : c === "BRANCH NAME" ? val(r, "UNIT_NAME") : c === "NAME" ? (val(r, "EMP_NAME") || val(r, "EMP_CODE")) : c === "WORK TIME" ? val(r, "datecurrent") : ""}
          img={(r, c) => (c === "WORK TIME IMAGE" && val(r, "image_name") ? media("attendance_images", val(r, "image_name")) : null)} />
      )}
    </div>
  );
}

/* ================= Deployment Details (menu1) ================= */
function TabDeployHO({ scope }: { scope: Scope }) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    getJSON<{ results: Row[] }>(`${BASE}/deployment/?${hq(scope)}`).then((d) => setRows(d.results || [])).catch(() => setRows([]));
  }, [scope.zone, scope.region, scope.unit, scope.client]);
  const cols = ["Sr No.", "Branch Name", "Designation", "Employee Count", "Working Hours", "START DATE", "END DATE"];
  return (
    <Grid id="ho-deploy" cols={cols} rows={rows.map((r, i) => ({ ...r, __i: i + 1 }))} cell={(r, c) =>
      c === "Sr No." ? r.__i : c === "Branch Name" ? (val(r, "UNIT_NAME") || val(r, "unit_name")) : c === "Designation" ? (val(r, "DESIGNATION") || val(r, "designation")) : c === "Employee Count" ? (val(r, "COUNT") || val(r, "count")) : c === "Working Hours" ? (val(r, "HOURS") || val(r, "hours")) : c === "START DATE" ? (val(r, "unit_start_date")) : val(r, "unit_end_date")} />
  );
}

/* ================= Heads Info (menu3) ================= */
function TabHeadsHO({ scope }: { scope: Scope }) {
  const [detail, setDetail] = useState<Row>({});
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    setLoaded(false); setDetail({});
    if (!scope.unit || scope.unit === ALL) return;
    getJSON<{ detail: Row }>(`${BASE}/unit-detail/?${hq(scope)}`).then((d) => { setDetail(d.detail || {}); setLoaded(true); }).catch(() => undefined);
  }, [scope.unit, scope.client]);
  if (!scope.unit || scope.unit === ALL) return <p style={{ fontSize: 12 }}> Please Select Branch Name</p>;
  if (!loaded) return <p style={{ fontSize: 12 }}>Loading...</p>;
  const v = (k: string) => String(val(detail, k) ?? "");
  const cell = (value: string, placeholder: string) => <td style={td}><input style={inp} readOnly placeholder={placeholder} value={value} /></td>;
  return (
    <table style={{ borderCollapse: "collapse", width: "90%", margin: "0 auto" }} className="table table-bordered">
      <thead><tr style={{ background: "#337ab7", color: "#fff", fontWeight: "bold", textAlign: "center" }}>
        <td style={th}></td><td style={th}>Operation</td><td style={th}>Finance</td><td style={th}>Location</td><td style={th}>Admin Head</td><td style={th}>Other</td>
      </tr></thead>
      <tbody>
        <tr style={{ textAlign: "center", fontWeight: "bold" }}>
          <td style={td}><b>Contact Person Name</b></td>
          {cell(v("OperationHead_Name"), "Contact Person Name")}
          {cell(v("FinanceHead_Name"), "Contact Person Name")}
          {cell(v("LocationHead_Name"), "Contact Person Name")}
          {cell(v("adminhead_name"), "Contact Person Name")}
          {cell(v("OtherHead_Name"), "Contact Person Name")}
        </tr>
        <tr style={{ textAlign: "center", fontWeight: "bold" }}>
          <td style={td}><b>Mobile No</b></td>
          {cell(v("OperationHead_Mobileno"), "Mobile No")}
          {cell(v("FinanceHead_Mobileno"), "Mobile No")}
          {cell(v("LocationHead_mobileno"), "Mobile No")}
          {cell(v("adminhead_mobile"), "Mobile No")}
          {cell(v("OtherHead_Monileno"), "Mobile No")}
        </tr>
        <tr style={{ textAlign: "center", fontWeight: "bold" }}>
          <td style={td}><b>Email Id</b></td>
          {cell(v("OperationHead_EmailId"), "Email Id")}
          {cell(v("FinanceHead_EmailId"), "Email Id")}
          {cell(v("LocationHead_Emailid"), "Email Id")}
          {cell(v("adminhead_email"), "Email Id")}
          {cell(v("OtherHead_Emailid"), "Email Id")}
        </tr>
      </tbody>
    </table>
  );
}

/* ================= Monthly Attendance (menu4) ================= */
function TabMonthlyHO({ scope }: { scope: Scope }) {
  const [my, setMy] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const show = async () => {
    if (!my) { alert("Please Select Month"); return; }
    const m = my.slice(0, 2); const y = my.slice(3);
    try {
      const d = await getJSON<{ results: Row[]; day_columns: string[]; message?: string }>(`${BASE}/monthly_attendance/?${hq(scope, `month=${m}&year=${y}`)}`);
      if ((d as any).message) alert((d as any).message);
      setRows(d.results || []); setDays(d.day_columns || []); setDone(true);
    } catch (e: any) { alert(e.message); }
  };
  const cols = ["STATE", "Branch_Name", "CITY", "CLIENT_CODE", "EMPLOYEE_NAME", "DESIGNATION", ...days, "PRESENT_DAYS", "ABSENT", "TOTAL_DAYS"];
  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 10 }}>
        <div><span style={lbl}>Select Month :</span><span style={{ color: "red" }}>*</span><br /><MonthInput value={my} onChange={setMy} width={150} /></div>
        <button type="button" style={btnP} onClick={show}> SHOW </button>
      </div>
      {done && <Grid id="ho-monthly" cols={cols} rows={rows} cell={(r, c) => val(r, c) ?? val(r, c.toLowerCase())} />}
    </div>
  );
}

/* ================= Employee KYC (menu5) ================= */
function TabKycHO({ scope }: { scope: Scope }) {
  const [emps, setEmps] = useState<{ code: string; name: string }[]>([]);
  const [emp, setEmp] = useState(SEL);
  const [docs, setDocs] = useState<Row | null>(null);
  useEffect(() => {
    setEmps([]); setEmp(SEL); setDocs(null);
    if (!scope.unit || scope.unit === ALL) return;
    getJSON<{ results: Row[] }>(`${BASE}/employees/?${hq(scope)}`).then((d) =>
      setEmps((d.results || []).map((r) => ({ code: String(val(r, "code")), name: String(val(r, "name")) })))).catch(() => undefined);
  }, [scope.unit, scope.client]);
  const show = async () => {
    if (!emp || emp === SEL) { alert("Please Select Employee"); return; }
    try {
      const d = await getJSON<{ documents: Row }>(`${BASE}/kyc/?emp_code=${encodeURIComponent(emp)}`);
      setDocs(d.documents || null);
    } catch (e: any) { alert(e.message); }
  };
  const card = (title: string, file: any, fallback: string) => (
    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
      <div style={{ minWidth: 200 }}><b>{title} :</b></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={file ? media("emp_images", file) : ph(fallback)} alt={title} width={100} height={100}
        onError={(e) => { (e.target as HTMLImageElement).src = ph(fallback); }} style={{ border: "1px solid #ccc", objectFit: "cover" }} />
    </div>
  );
  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 14 }}>
        <div><span style={lbl}>Select Employee :</span><span style={{ color: "red" }}>*</span>
          <select style={{ ...inp, width: 220 }} value={emp} onChange={(e) => setEmp(e.target.value)}>
            <option value={SEL}>{SEL}</option>
            {emps.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
          </select>
        </div>
        <button type="button" style={{ ...btnP, width: 200 }} onClick={show}>SHOW DOCUMENTS</button>
      </div>
      {docs && (
        <div style={{ display: "grid", gap: 16 }}>
          {card("Photo(Passport Size)", val(docs, "original_photo"), "photo")}
          {card("Aadhar Card", val(docs, "original_adhar_card"), "aadhar")}
          {card("Police Verification Document", val(docs, "original_policy_document"), "police")}
          {card("Address Proof", val(docs, "original_address_proof"), "address")}
        </div>
      )}
    </div>
  );
}

/* ================= Feedback (menu6) ================= */
function TabFeedbackHO() {
  const [rating, setRating] = useState("");
  const [sug, setSug] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const submit = async () => {
    if (!rating) { alert("Please select rating"); return; }
    if (!sug) { alert("Please Enter Sugession"); return; }
    const fd = new FormData();
    fd.append("rating", rating); fd.append("suggestion", sug);
    if (file) fd.append("file", file);
    try { const d = await postForm(`${BASE}/feedback-ho/`, fd); alert(d.message || "Feedback Submitted Successfully"); setRating(""); setSug(""); setFile(null); }
    catch (e: any) { alert(e.message); }
  };
  return (
    <div>
      <p style={{ fontSize: 13, color: "#000" }}><b>We thank you for your participation for using our services</b></p>
      <p style={{ fontSize: 14, color: "#000", textAlign: "center" }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <span key={n}>&nbsp;<input type="radio" name="ho-rating" checked={rating === String(n)} onChange={() => setRating(String(n))} />&nbsp;{n} &nbsp;</span>
        ))}
      </p>
      <table className="table" style={{ borderCollapse: "collapse", margin: "0 auto" }} border={2}>
        <thead><tr><th style={{ background: "#ADD8E6" }}>Values</th><td style={td}>1-3</td><td style={td}>4-5</td><td style={td}>6-7</td><td style={td}>8-9</td><td style={td}>10</td></tr></thead>
        <tbody><tr><th style={{ background: "#ADD8E6" }}>Rating</th><td style={td}>Fair</td><td style={td}>Average</td><td style={td}>Good</td><td style={td}>Best</td><td style={td}>Excellent</td></tr></tbody>
      </table>
      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "flex-start" }}>
        <span style={lbl}>Suggestion :</span>
        <textarea style={{ ...inp, maxWidth: 400 }} rows={2} value={sug} onChange={(e) => setSug(e.target.value)} />
        <button type="button" style={{ ...btnP, marginTop: 22 }} onClick={submit}>Submit</button>
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 12, alignItems: "center" }}>
        <span style={lbl}>Attach File :</span>
        <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        <span style={{ fontSize: 10 }}><b>JPEG PNG PDF</b></span>
      </div>
    </div>
  );
}

/* ================= Files (menu8) ================= */
function TabFilesHO({ scope }: { scope: Scope }) {
  const [month, setMonth] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [done, setDone] = useState(false);
  const show = async () => {
    try {
      const d = await getJSON<{ results: Row[] }>(`${BASE}/ho-service-files/?${hq(scope)}`);
      setRows(d.results || []); setDone(true);
    } catch (e: any) { alert(e.message); }
  };
  const del = async (id: any) => {
    if (!confirm("Are you sure You want to Delete ?")) return;
    try { await postJSON(`${BASE}/service-file-delete/`, { id }); show(); } catch (e: any) { alert(e.message); }
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 10 }}>
        <div><b>Month :</b><br /><MonthInput value={month} onChange={setMonth} width={150} /></div>
        <button type="button" style={btnP} onClick={show}>Show</button>
      </div>
      {done && (
        <div style={{ overflow: "auto", maxHeight: 300, border: "1px solid #ccc" }}>
          <table style={{ borderCollapse: "collapse", width: "100%" }}>
            <thead><tr><th style={th}>No.</th><th style={th}>Download File</th><th style={th}>Quotation By</th><th style={th}>Date</th><th style={th}></th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td style={td}>{i + 1}</td>
                  <td style={td}>{val(r, "Value") ? <a href={`${API_BASE_URL}${BASE}/rm-file/?name=${encodeURIComponent(String(val(r, "Value")).split("/").pop() || "")}`} target="_blank" rel="noreferrer">Download</a> : ""}</td>
                  <td style={td}>{val(r, "created_by")}</td>
                  <td style={td}>{val(r, "create_date")}</td>
                  <td style={td}><button type="button" style={btnP} onClick={() => del(val(r, "id"))}>Delete</button></td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td style={td} colSpan={5}>No records</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ================= Visit Report By FO (menu10) ================= */
function TabVisitHO({ scope }: { scope: Scope }) {
  const [sups, setSups] = useState<{ code: string; name: string }[]>([]);
  const [sup, setSup] = useState(SEL);
  const [ftype, setFtype] = useState(SEL);
  const [rows, setRows] = useState<Row[]>([]);
  const [mode, setMode] = useState("");
  useEffect(() => {
    setSups([]); setSup(SEL);
    if (!scope.unit || scope.unit === ALL) return;
    getJSON<{ results: Row[] }>(`${BASE}/supervisors/?${hq(scope)}`).then((d) =>
      setSups((d.results || []).map((r) => ({ code: String(val(r, "code")), name: String(val(r, "name")) })))).catch(() => undefined);
  }, [scope.unit, scope.client]);
  const show = async () => {
    if (!sup || sup === SEL) { alert("Please Select Supervisor Name"); return; }
    if (!ftype || ftype === SEL) { alert("Please Select Feedback Type"); return; }
    try {
      if (ftype === "1") {
        const d = await getJSON<{ results: Row[]; message?: string }>(`${BASE}/site-audit/?${hq(scope, `supervisor=${encodeURIComponent(sup)}`)}`);
        if (d.message) alert(d.message);
        setRows(d.results || []); setMode("audit");
      } else {
        const d = await getJSON<{ results: Row[]; message?: string }>(`${BASE}/service-rating/?${hq(scope, `supervisor=${encodeURIComponent(sup)}`)}`);
        if (d.message) alert(d.message);
        setRows(d.results || []); setMode("rating");
      }
    } catch (e: any) { alert(e.message); }
  };
  const rateStatus = async (id: any, status: string, confirm_text: string) => {
    if (!confirm(confirm_text)) return;
    try { const d = await postJSON(`${BASE}/service-rating-status/`, { id, status }); alert(d.message); show(); }
    catch (e: any) { alert(e.message); }
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 10, flexWrap: "wrap" }}>
        <div><span style={lbl}>Supervisor Name :</span><span style={{ color: "red" }}>*</span>
          <select style={{ ...inp, width: 220 }} value={sup} onChange={(e) => setSup(e.target.value)}>
            <option value={SEL}>{SEL}</option>
            {sups.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        <div><span style={lbl}>Name *</span>
          <select style={{ ...inp, width: 220 }} value={ftype} onChange={(e) => setFtype(e.target.value)}>
            <option value={SEL}>{SEL}</option>
            <option value="1">Site Audit</option>
            <option value="2">Supervisor Through Feedback</option>
          </select>
        </div>
        <button type="button" style={btnP} onClick={show}> Show </button>
      </div>
      {mode === "audit" && (
        <>
          <Grid id="ho-audit" cols={["Branch Name", "Employee_Name", "Grade_name", "Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Remark", "location", "Comment", "Status"]}
            rows={rows} cell={(r, c) =>
              c === "Branch Name" ? val(r, "unit_name") : c === "Employee_Name" ? val(r, "emp_code") : c === "Grade_name" ? val(r, "grade_name") : c === "Remark" ? val(r, "remark") : c === "location" ? val(r, "location") : c === "Comment" ? val(r, "comment") : c === "Status" ? val(r, "Status") : val(r, { "Q1": "que_1_ans", "Q2": "que_2_ans", "Q3": "que_3_ans", "Q4": "que_4_ans", "Q5": "que_5_ans", "Q6": "que_6_ans" }[c] || c)} />
          {rows.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <p style={{ fontSize: 11 }}>Question images (row-wise):</p>
              {rows.map((r, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                  {[1, 2, 3, 4, 5, 6].map((n) => val(r, `que_${n}_path`) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={n} src={media("site_audit", val(r, `que_${n}_path`))} alt={`Q${n}`} width={50} height={50}
                      title={`Row ${i + 1} Q${n}`} style={{ border: "1px solid #ccc", objectFit: "cover" }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                  ) : null)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
      {mode === "rating" && (
        <>
          <Exports id="ho-rating" cols={["Branch Name", "Question_1", "Question_2", "Question_3", "Question_4", "Question_5", "Question_6", "Question_7", "Question_8", "Question_9", "Question_10", "Remark", "Status"]} rows={rows}
            cell={(r, c) => c === "Branch Name" ? val(r, "unit_name") : c === "Remark" ? val(r, "remark") : c === "Status" ? val(r, "Status") : val(r, { "Question_1": "que_1_ans", "Question_2": "que_2_ans", "Question_3": "que_3_ans", "Question_4": "que_4_ans", "Question_5": "que_5_ans", "Question_6": "que_6_ans", "Question_7": "que_7_ans", "Question_8": "que_8_ans", "Question_9": "que_9_ans", "Question_10": "que_10_ans" }[c] || c)} />
          <div style={{ overflow: "auto", maxHeight: 450, border: "1px solid #ccc" }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr><th style={th}>ID</th><th style={th}>Branch Name</th>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <th key={n} style={th}>Question_{n}</th>)}<th style={th}>Remark</th><th style={th}>Status</th><th style={th}></th><th style={th}></th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td style={td}>{val(r, "id")}</td>
                    <td style={td}>{val(r, "unit_name")}</td>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => <td key={n} style={td}>{val(r, `que_${n}_ans`)}</td>)}
                    <td style={td}>{val(r, "remark")}</td>
                    <td style={td}>{val(r, "Status")}</td>
                    <td style={td}>
                      <button type="button" style={{ color: "#337ab7", background: "none", border: "none", cursor: "pointer", fontSize: 11 }} onClick={() => rateStatus(val(r, "id"), "approved", "Are you Sure You Want to Approve Record")}>Approved</button><br />
                      <button type="button" style={{ color: "#337ab7", background: "none", border: "none", cursor: "pointer", fontSize: 11 }} onClick={() => rateStatus(val(r, "id"), "reject", "Are you Sure You Want to Reject Record")}>Reject</button>
                    </td>
                    <td style={td}>
                      <button type="button" style={{ color: "#337ab7", background: "none", border: "none", cursor: "pointer", fontSize: 11 }} onClick={() => rateStatus(val(r, "id"), "complete", "Are you Sure You Want to Complete Record")}>Complete</button>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td style={td} colSpan={16}>No records</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

/* ================= R & M (menu7, legacy service request) ================= */
const SERVICES = [SEL, "Electrical", "Plumbing", "Carpentry", "Civil", "Pest_Control", "HVAC"];
function TabRMOldHO({ scope }: { scope: Scope }) {
  const [svc, setSvc] = useState(SEL);
  const [cats, setCats] = useState<string[]>([]);
  const [cat, setCat] = useState("");
  const [pri, setPri] = useState(SEL);
  const [comment, setComment] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const branch = scope.unit && scope.unit !== ALL ? scope.unit : "";
  const load = async () => {
    if (!branch) return;
    try { const d = await getJSON<{ results: Row[] }>(`${BASE}/service-grid/?${hq({ ...scope, unit: branch })}`); setRows(d.results || []); }
    catch { /* ignore */ }
  };
  useEffect(() => { load(); }, [branch, scope.client]);
  const changeSvc = async (s: string) => {
    setSvc(s); setCats([]); setCat("");
    if (s && s !== SEL) {
      try {
        const d = await getJSON<{ results: Row[] }>(`${BASE}/service-categories/?service=${encodeURIComponent(s)}`);
        setCats((d.results || []).map((r) => String(val(r, "name"))));
      } catch { /* ignore */ }
    }
  };
  const send = async () => {
    if (!branch) { alert(" Please Select Branch Name"); return; }
    if (!svc || svc === SEL) { alert("Please Select Services !!!"); return; }
    if (!pri || pri === SEL) { alert("Please Select Priority  !!!"); return; }
    if (!comment) { alert("Please Enter Additional Comment !!!"); return; }
    try {
      const d = await postJSON(`${BASE}/service-submit/?${hq({ ...scope, unit: branch })}`, { services: svc, priority: pri, additional_comment: comment, category: cat });
      alert(d.message); setSvc(SEL); setPri(SEL); setComment(""); setCat(""); load();
    } catch (e: any) { alert(e.message); }
  };
  const cols = ["No.", "Services", "Priority", "Date", "Status", "Comments", "Action", "Download File"];
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 12 }}>
        <div><span style={lbl}>Services :</span><span style={{ color: "red" }}> *</span>
          <select style={{ ...inp, width: 160 }} value={svc} onChange={(e) => changeSvc(e.target.value)}>
            {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div><span style={lbl}>Category :</span><span style={{ color: "red" }}> *</span>
          <select style={{ ...inp, width: 160 }} value={cat} onChange={(e) => setCat(e.target.value)}>
            <option value="">Select</option>{cats.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div><span style={lbl}>Priority :</span><span style={{ color: "red" }}> *</span>
          <select style={{ ...inp, width: 140 }} value={pri} onChange={(e) => setPri(e.target.value)}>
            {[SEL, "TOP", "MEDIUM", "LOW"].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div><span style={lbl}>Additional Comment :</span><span style={{ color: "red" }}> *</span>
          <textarea style={{ ...inp, width: 220 }} rows={2} value={comment} onChange={(e) => setComment(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={{ ...btnP, width: 150 }} onClick={send}>Send Request</button>
          <button type="button" style={btnD} onClick={() => { setSvc(SEL); setPri(SEL); setComment(""); setCat(""); }}>Close</button>
        </div>
      </div>
      <Exports id="ho-service" cols={cols} rows={rows} cell={(r, c) =>
        c === "No." ? val(r, "Id") : c === "Services" ? val(r, "services") : c === "Priority" ? val(r, "priority") : c === "Date" ? val(r, "date") : c === "Status" ? val(r, "status") : c === "Comments" ? val(r, "additional_comment") : ""} />
      <div style={{ overflow: "auto", maxHeight: 450, border: "1px solid #ccc" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr>{cols.map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const st = String(val(r, "status") ?? "");
              const hideAction = st === "Quotation Approved" || st.includes("Quotation Rejected");
              return (
                <tr key={i}>
                  <td style={td}>{val(r, "Id")}</td>
                  <td style={td}>{val(r, "services")}</td>
                  <td style={td}>{val(r, "priority")}</td>
                  <td style={td}>{val(r, "date")}</td>
                  <td style={td}>{st}</td>
                  <td style={{ ...td, minWidth: 200 }}>{val(r, "additional_comment")}</td>
                  <td style={td}>
                    {!hideAction && (
                      <>
                        <button type="button" style={{ color: "#337ab7", background: "none", border: "none", cursor: "pointer", fontSize: 11 }} onClick={async () => {
                          if (!confirm(`Do you want to Approve ${val(r, "Id")}-${val(r, "services")}?`)) return;
                          try { const d = await postJSON(`${BASE}/service-approve/`, { id: val(r, "Id") }); alert(d.message); load(); }
                          catch (e: any) { alert(e.message); }
                        }}>Approved</button><br />
                        <button type="button" style={{ color: "#337ab7", background: "none", border: "none", cursor: "pointer", fontSize: 11 }} onClick={async () => {
                          if (!confirm(`Do you want to Reject ${val(r, "Id")}-${val(r, "services")}?`)) return;
                          try { const d = await postJSON(`${BASE}/service-reject/`, { id: val(r, "Id") }); alert(d.message); load(); }
                          catch (e: any) { alert(e.message); }
                        }}>Reject</button>
                      </>
                    )}
                  </td>
                  <td style={td}>{val(r, "Value") ? <a href={String(val(r, "Value"))} target="_blank" rel="noreferrer">Download</a> : ""}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td style={td} colSpan={8}>No records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= Current Attendance (menu13) ================= */
function TabCurrentHO({ scope }: { scope: Scope }) {
  const [my, setMy] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [days, setDays] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const show = async () => {
    if (!my) { alert("Please Select Month"); return; }
    const m = my.slice(0, 2); const y = my.slice(3);
    try {
      const d = await getJSON<{ results: Row[]; day_columns: string[]; message?: string }>(`${BASE}/monthly-summary/?${hq(scope, `month=${m}&year=${y}`)}`);
      if ((d as any).message) alert((d as any).message);
      const dd = await getJSON<{ day_columns: string[] }>(`${BASE}/monthly_attendance/?${hq(scope, `month=${m}&year=${y}`)}`).catch(() => ({ day_columns: [] as string[] }));
      setRows(d.results || []); setDays(dd.day_columns || []); setDone(true);
    } catch (e: any) { alert(e.message); }
  };
  const cols = ["STATE", "Branch_Name", "CITY", "CLIENT_CODE", "EMPLOYEE_NAME", "DESIGNATION", "Emp_Count", ...days, "PRESENT_DAYS", "ABSENT", "TOTAL_DAYS"];
  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 10 }}>
        <div><span style={lbl}>Select Month :</span><span style={{ color: "red" }}>*</span><br /><MonthInput value={my} onChange={setMy} width={150} /></div>
        <button type="button" style={btnP} onClick={show}> SHOW </button>
      </div>
      {done && <Grid id="ho-current" cols={cols} rows={rows} cell={(r, c) => val(r, c) ?? val(r, c.toLowerCase())} />}
    </div>
  );
}

/* ================= Summary Report (menu14) ================= */
function TabSummaryHO({ scope }: { scope: Scope }) {
  const [dt, setDt] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [totals, setTotals] = useState<{ dep: number; pres: number } | null>(null);
  const [done, setDone] = useState(false);
  const show = async () => {
    if (!dt) { alert("Please Select Month"); return; }
    try {
      const d = await getJSON<{ results: Row[]; total_deployment: number; total_present: number; message?: string }>(
        `${BASE}/summary/?${hq(scope, `date=${encodeURIComponent(dt)}`)}`);
      if ((d as any).message) alert((d as any).message);
      setRows(d.results || []); setTotals({ dep: d.total_deployment || 0, pres: d.total_present || 0 }); setDone(true);
    } catch (e: any) { alert(e.message); }
  };
  const cols = ["State", "Location", "Designation", "Deployment Count", "Present Count"];
  const cell = (r: Row, c: string) =>
    c === "State" ? (val(r, "state_name") || val(r, "STATE")) : c === "Location" ? (val(r, "unit_name") || val(r, "location")) : c === "Designation" ? (val(r, "grade_desc") || val(r, "designation")) : c === "Deployment Count" ? val(r, "deployment_count") : val(r, "present_count");
  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 10 }}>
        <div><span style={lbl}>Select Month :</span><span style={{ color: "red" }}>*</span><br /><DateInput value={dt} onChange={setDt} width={150} /></div>
        <button type="button" style={btnP} onClick={show}> SHOW </button>
      </div>
      {done && (
        <>
          <Grid id="ho-summary" cols={cols} rows={rows} cell={cell} />
          {totals && <p style={{ fontSize: 12 }}><b>Total Deployment: {totals.dep} &nbsp; Total Present: {totals.pres}</b></p>}
        </>
      )}
    </div>
  );
}

/* ================= Raise Complaint (menu15) ================= */
function TabComplaintHO({ scope }: { scope: Scope }) {
  const [pri, setPri] = useState(SEL);
  const [cats, setCats] = useState<string[]>([]);
  const [cat, setCat] = useState(SEL);
  const [types, setTypes] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [remark, setRemark] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const branch = scope.unit && scope.unit !== ALL ? scope.unit : "";
  const loadGrid = async () => {
    try { const d = await getJSON<{ results: Row[] }>(`${BASE}/ho-complaint-grid/?${hq(scope)}`); setRows(d.results || []); }
    catch { /* ignore */ }
  };
  useEffect(() => {
    getJSON<{ results: Row[] }>(`${BASE}/complaint-categories/`).then((d) =>
      setCats((d.results || []).map((r) => String(val(r, "name"))))).catch(() => undefined);
    loadGrid();
  }, [scope.zone, scope.region, scope.unit, scope.client]);
  const changePri = async (p: string) => {
    setPri(p); setCat(SEL); setTypes([]); setChecked({});
    if (p && p !== SEL) {
      try {
        const [c, t] = await Promise.all([
          getJSON<{ results: Row[] }>(`${BASE}/complaint-categories-by-priority/?priority=${encodeURIComponent(p)}`),
          getJSON<{ results: Row[] }>(`${BASE}/complaint-types/?priority=${encodeURIComponent(p)}`),
        ]);
        const cl = (c.results || []).map((r) => String(val(r, "name")));
        setCats(cl.length ? cl : cats);
        setTypes((t.results || []).map((r) => String(val(r, "name"))));
      } catch { /* ignore */ }
    }
  };
  const changeCat = async (c: string) => {
    setCat(c); setChecked({});
    try {
      const d = await getJSON<{ results: Row[] }>(`${BASE}/complaint-types/?priority=${encodeURIComponent(pri)}&category=${encodeURIComponent(c)}`);
      setTypes((d.results || []).map((r) => String(val(r, "name"))));
    } catch { /* ignore */ }
  };
  const send = async () => {
    if (!scope.region || scope.region === SEL) { alert("Please Select Region"); return; }
    if (!pri || pri === SEL) { alert("Please Select Priority"); return; }
    if (!cat || cat === SEL) { alert("Please Select Category"); return; }
    const names = types.filter((t) => checked[t]);
    if (names.length === 0) { alert("Please select atleast One Complaint Type"); return; }
    if (!branch) { alert(" Please Select Branch Name"); return; }
    if (!remark) { alert("Please Enter Remark"); return; }
    try {
      const d = await postJSON(`${BASE}/ho-complaint-send/?${hq({ ...scope, unit: branch })}`, { priority: pri, category: cat, remark, names });
      alert(d.message); setRemark(""); setPri(SEL); setCat(SEL); setTypes([]); setChecked({}); loadGrid();
    } catch (e: any) { alert(e.message); }
  };
  const complete = async (id: any) => {
    if (!confirm("Are you sure want complete?")) return;
    try { await postJSON(`${BASE}/complaint-complete/`, { id }); loadGrid(); } catch (e: any) { alert(e.message); }
  };
  return (
    <div>
      <div style={{ background: "rgba(255,255,255,0.58)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div><span style={lbl}>Priority Level:</span>
            <select style={{ ...inp, width: 160 }} value={pri} onChange={(e) => changePri(e.target.value)}>
              {[SEL, "TOP", "MEDIUM", "LOW"].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div><span style={lbl}>Complaint Category:</span>
            <select style={{ ...inp, width: 200 }} value={cat} onChange={(e) => changeCat(e.target.value)}>
              <option value={SEL}>{SEL}</option>
              {cats.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {types.length > 0 && (
          <div style={{ display: "flex", gap: 16, marginTop: 10, flexWrap: "wrap" }}>
            <div style={{ border: "1px solid #ccc", maxHeight: 200, overflow: "auto", minWidth: 260 }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead><tr><th style={th}>SR.NO</th><th style={th}>COMPLAINT TYPE</th></tr></thead>
                <tbody>
                  {types.map((t, i) => (
                    <tr key={t}>
                      <td style={td}><input type="checkbox" checked={!!checked[t]} onChange={() => setChecked((c) => ({ ...c, [t]: !c[t] }))} /> {i + 1}</td>
                      <td style={td}>{t}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div><span style={lbl}>Remark :</span><textarea style={{ ...inp, width: 240 }} rows={3} value={remark} onChange={(e) => setRemark(e.target.value)} /></div>
            <div style={{ alignSelf: "flex-end" }}><button type="button" style={btnP} onClick={send}>Register Complaint</button></div>
          </div>
        )}
      </div>
      <Exports id="ho-complaints" cols={["No.", "client name", "REGION", "state", "Branch name", "Status", "Priority", "Type Of Complaint", "Complaint Raised Date", "Complaint Resolved Date", "Remark", "Reply From IHMS"]} rows={rows}
        cell={(r, c) => c === "No." ? val(r, "Id") : c === "client name" ? val(r, "client_name") : c === "REGION" ? val(r, "ZONE") : c === "state" ? val(r, "state_name") : c === "Branch name" ? val(r, "unit_name") : c === "Status" ? val(r, "status") : c === "Priority" ? val(r, "priority") : c === "Type Of Complaint" ? val(r, "complaint_name") : c === "Complaint Raised Date" ? val(r, "date") : c === "Complaint Resolved Date" ? val(r, "resole_date") : c === "Remark" ? val(r, "Remark") : val(r, "comment")} />
      <div style={{ overflow: "auto", maxHeight: 450, border: "1px solid #ccc" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><th style={th}>No.</th><th style={th}>client name</th><th style={th}>REGION</th><th style={th}>state</th><th style={th}>Branch name</th><th style={th}>Status</th><th style={th}>Priority</th><th style={th}>Type Of Complaint</th><th style={th}>Complaint Raised Date</th><th style={th}>Complaint Resolved Date</th><th style={th}>Status</th><th style={th}>Remark</th><th style={th}>Reply From IHMS</th><th style={th}></th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={td}>{val(r, "Id")}</td>
                <td style={td}>{val(r, "client_name")}</td>
                <td style={td}>{val(r, "ZONE")}</td>
                <td style={td}>{val(r, "state_name")}</td>
                <td style={td}>{val(r, "unit_name")}</td>
                <td style={td}>{val(r, "status")}</td>
                <td style={td}>{val(r, "priority")}</td>
                <td style={td}>{val(r, "complaint_name")}</td>
                <td style={td}>{val(r, "date")}</td>
                <td style={td}>{val(r, "resole_date")}</td>
                <td style={td}><input style={inp} readOnly value={String(val(r, "status") ?? "")} /></td>
                <td style={{ ...td, minWidth: 200 }}>{val(r, "Remark")}</td>
                <td style={{ ...td, minWidth: 200 }}>{val(r, "comment")}</td>
                <td style={td}>{String(val(r, "status")) === "Resolve" && (
                  <button type="button" style={{ color: "#337ab7", background: "none", border: "none", cursor: "pointer", fontSize: 11 }} onClick={() => complete(val(r, "Id"))}>Complete</button>
                )}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td style={td} colSpan={14}>No records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= Fire Extinguisher Info (item16) ================= */
function TabFireHO({ scope }: { scope: Scope }) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    getJSON<{ results: Row[] }>(`${BASE}/fire_extinguisher/?${hq(scope)}`).then((d) => setRows(d.results || [])).catch(() => setRows([]));
  }, [scope.zone, scope.region, scope.unit, scope.client]);
  const cols = ["Sr No.", "Branch Name", "Types Of Extiguisher", "Renewal Date", "Expiry date", "Weight In KG", "Vender Name", "Vender Contact Number", "Fire Equipment Report", "Client Name"];
  return (
    <Grid id="ho-fire" cols={cols} rows={rows.map((r, i) => ({ ...r, __i: i + 1 }))} cell={(r, c) =>
      c === "Sr No." ? r.__i : c === "Branch Name" ? (val(r, "unit_name")) : c === "Types Of Extiguisher" ? val(r, "fire_ex_type") : c === "Renewal Date" ? val(r, "renewal_date") : c === "Expiry date" ? val(r, "expiry_date") : c === "Weight In KG" ? val(r, "weight_in_kg") : c === "Vender Name" ? val(r, "vender_name") : c === "Vender Contact Number" ? val(r, "vender_no") : c === "Client Name" ? val(r, "client_name") : ""}
      img={(r, c) => (c === "Fire Equipment Report" && val(r, "fire_upload") ? media("fire_extinguisher", val(r, "fire_upload")) : null)} />
  );
}

/* ================= R&M Service (menu17) ================= */
type RMKey = { client: string; state: string; branch: string; month: string; year: string; slot: string };
function TabRMService({ scope }: { scope: Scope }) {
  const [clients, setClients] = useState<{ code: string; name: string }[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [branches, setBranches] = useState<{ code: string; name: string }[]>([]);
  const [fClient, setFClient] = useState(SEL);
  const [fState, setFState] = useState(SEL);
  const [fBranch, setFBranch] = useState(SEL);
  const [fMonth, setFMonth] = useState("");
  const [fSlot, setFSlot] = useState(SEL);
  const [rows, setRows] = useState<Row[]>([]);
  const [prows, setProws] = useState<Row[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [editId, setEditId] = useState("");
  const [repRows, setRepRows] = useState<Row[]>([]);
  const [repDone, setRepDone] = useState(false);
  const [rFrom, setRFrom] = useState(""); const [rTo, setRTo] = useState("");
  const [form, setForm] = useState<Record<string, string>>({
    helpNo: "", branchPc: "", bookDate: "", invDate: "", invNo: "", gstApp: "0", party: "",
    gross: "", igst: "", cgst: "", sgst: "", amount: "", holder: "", acc: "", ifsc: "",
    bank: "", gstNo: "", hsn: "", desc: "",
  });
  const [files, setFiles] = useState<(File | null)[]>([null, null, null]);
  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  useEffect(() => {
    getJSON<{ results: Row[] }>(`${BASE}/rm-clients/`).then((d) =>
      setClients((d.results || []).map((r) => ({ code: String(val(r, "code")), name: String(val(r, "name")) })))).catch(() => undefined);
  }, []);

  const changeClient = async (c: string) => {
    setFClient(c); setFState(SEL); setFBranch(SEL); setStates([]); setBranches([]);
    if (c && c !== SEL) {
      try {
        const d = await getJSON<{ results: Row[] }>(`${BASE}/rm-states/?client_code=${encodeURIComponent(c)}`);
        setStates((d.results || []).map((r) => String(val(r, "state"))));
      } catch { /* ignore */ }
    }
  };
  const changeState = async (s: string) => {
    setFState(s); setFBranch(SEL); setBranches([]);
    if (s && s !== SEL) {
      try {
        const d = await getJSON<{ results: Row[] }>(`${BASE}/rm-branches/?client_code=${encodeURIComponent(fClient)}&state=${encodeURIComponent(s)}`);
        setBranches((d.results || []).map((r) => ({ code: String(val(r, "code")), name: String(val(r, "name")) })));
      } catch { /* ignore */ }
    }
  };

  const key = (): RMKey | null => {
    if (!fClient || fClient === SEL) { alert("Please Select Client"); return null; }
    if (!fState || fState === SEL) { alert("Please Select State"); return null; }
    if (!fBranch || fBranch === SEL) { alert("Please Select Branch"); return null; }
    if (!fMonth) { alert("Please Select Month"); return null; }
    if (!fSlot || fSlot === SEL) { alert("Please Select Invoice Slot"); return null; }
    const [mm, yy] = [fMonth.slice(0, 2), fMonth.slice(3)];
    return { client: fClient, state: fState, branch: fBranch, month: mm, year: yy, slot: fSlot };
  };
  const keyBody = (k: RMKey) => ({ client_code: k.client, state: k.state, unit_code: k.branch, month: k.month, year: k.year, slot: k.slot });

  const process = async () => {
    const k = key(); if (!k) return;
    try {
      const c = await postJSON(`${BASE}/rm-check/`, keyBody(k));
      if (c.message) alert(c.message);
      const g = await postJSON(`${BASE}/rm-grid/`, keyBody(k));
      setRows(g.results || []);
      const p = await postJSON(`${BASE}/rm-process-grid/`, keyBody(k));
      setProws(p.results || []);
      setChecked({});
    } catch (e: any) { alert(e.message); }
  };

  const grossCalc = (patch: Record<string, string>) => {
    const g = parseFloat(patch.gross ?? form.gross) || 0;
    const ig = parseFloat(patch.igst ?? form.igst) || 0;
    const cg = parseFloat(patch.cgst ?? form.cgst) || 0;
    const sg = parseFloat(patch.sgst ?? form.sgst) || 0;
    return { ...patch, amount: (g + ig + cg + sg).toFixed(2) };
  };
  const setCalc = (k: string) => (e: any) => setForm((f) => grossCalc({ ...f, [k]: e.target.value }));

  const save = async () => {
    const k = key(); if (!k) return;
    if (!form.helpNo) { alert("Please Enter Help Desk Request No"); return; }
    if (!form.bookDate) { alert("Please Enter Booking Date"); return; }
    if (!form.invDate) { alert("Please Enter Vendor Invoice Date"); return; }
    if (!form.invNo) { alert("Please Enter Vendor Invoice Number"); return; }
    if (!form.party) { alert("Please Enter Party Name"); return; }
    if (!form.gross || form.gross === "0") { alert("Please Enter Gross amount"); return; }
    if (!form.amount) { alert("Please Enter amount"); return; }
    if (!form.holder) { alert("Please Enter Bank Holder Name"); return; }
    if (!form.acc) { alert("Please Enter Bank Account Number"); return; }
    if (!form.ifsc) { alert("Please Enter IFSC Code"); return; }
    if (form.gstApp === "1") {
      if (!form.gstNo) { alert("Please Enter GST No."); return; }
      if (!form.hsn) { alert("Please Enter HSN No."); return; }
    }
    if (!files[0] && !editId) { alert("Please Upload File 1"); return; }
    const fd = new FormData();
    Object.entries({ ...keyBody(k), help_req_no: form.helpNo, branch_pc: form.branchPc, booking_date: form.bookDate, invoice_date: form.invDate, invoice_no: form.invNo, gst_applicable: form.gstApp, party_name: form.party, gross_amt: form.gross, igst: form.igst, cgst: form.cgst, sgst: form.sgst, amount: form.amount, holder_name: form.holder, bank_acc_no: form.acc, ifsc_code: form.ifsc, bank_name: form.bank, gst_no: form.gstNo, hsn_no: form.hsn, description: form.desc, edit_id: editId }).forEach(([a, b]) => fd.append(a, String(b)));
    files.forEach((f, i) => { if (f) fd.append(`file${i + 1}`, f); });
    try {
      const d = await postForm(`${BASE}/rm-save/`, fd);
      alert(d.message); setEditId(""); setFiles([null, null, null]);
      setForm({ helpNo: "", branchPc: "", bookDate: "", invDate: "", invNo: "", gstApp: "0", party: "", gross: "", igst: "", cgst: "", sgst: "", amount: "", holder: "", acc: "", ifsc: "", bank: "", gstNo: "", hsn: "", desc: "" });
      process();
    } catch (e: any) { alert(e.message); }
  };

  const editFill = async (id: any) => {
    try {
      const d = await getJSON<{ row: Row }>(`${BASE}/rm-fill/?id=${encodeURIComponent(String(id))}`);
      const r = d.row || {};
      setForm({
        helpNo: String(val(r, "help_req_number") ?? ""), branchPc: String(val(r, "branch_pc_code") ?? ""),
        bookDate: String(val(r, "booked_date") ?? ""), invDate: String(val(r, "vendor_invoice_date") ?? ""),
        invNo: String(val(r, "vendor_invoice_no") ?? ""), gstApp: String(val(r, "GST_applicable_rm") ?? "0"),
        party: String(val(r, "party_name") ?? ""), gross: String(val(r, "gross_amount") ?? ""),
        igst: String(val(r, "vendor_igst") ?? ""), cgst: String(val(r, "vendor_cgst") ?? ""),
        sgst: String(val(r, "vendor_sgst") ?? ""), amount: String(val(r, "amount") ?? ""),
        holder: String(val(r, "bank_holder_name") ?? ""), acc: String(val(r, "bank_acc_no") ?? ""),
        ifsc: String(val(r, "ifsc_code") ?? ""), bank: String(val(r, "bank_name") ?? ""),
        gstNo: String(val(r, "gst_no") ?? ""), hsn: String(val(r, "hsn_no") ?? ""), desc: String(val(r, "description") ?? ""),
      });
      setEditId(String(id));
      window.scrollTo({ top: 0 });
    } catch (e: any) { alert(e.message); }
  };

  const del = async (id: any) => {
    if (!confirm("Are you sure You want to Delete ?")) return;
    try { const d = await postJSON(`${BASE}/rm-delete/`, { id }); alert(d.message); process(); }
    catch (e: any) { alert(e.message); }
  };

  const approve = async () => {
    const ids = rows.filter((r) => checked[String(val(r, "ID"))]).map((r) => val(r, "ID"));
    if (ids.length === 0) { alert("Please select atleast one Record "); return; }
    if (!confirm("Are you Sure You Want to Approve This Record")) return;
    try { const d = await postJSON(`${BASE}/rm-approve/`, { ids }); alert(d.message); process(); }
    catch (e: any) { alert(e.message); }
  };

  const downloadReport = async () => {
    if (!rFrom) { alert("Please Enter From Date"); return; }
    if (!rTo) { alert("Please Enter To Date"); return; }
    try {
      const d = await postJSON(`${BASE}/rm-report/`, { client_code: fClient === SEL ? "" : fClient, from: rFrom, to: rTo });
      if (d.message) { alert(d.message); setRepRows([]); setRepDone(true); return; }
      setRepRows(d.results || []); setRepDone(true);
      const rows2 = d.results || [];
      if (rows2.length) {
        const cols2 = Object.keys(rows2[0]);
        const q = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
        const blob = new Blob(["\ufeff" + cols2.map(q).join(",") + "\r\n" + rows2.map((r: Row) => cols2.map((c) => q(val(r, c))).join(",")).join("\r\n")], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = "rm_report.csv";
        document.body.appendChild(a); a.click(); a.remove();
      }
    } catch (e: any) { alert(e.message); }
  };

  const dl = (name: any) => name ? `${API_BASE_URL}${BASE}/rm-file/?name=${encodeURIComponent(String(name).split("/").pop() || "")}` : "";
  const fld = (label: string, k: string, opts?: { ro?: boolean; calc?: boolean; w?: number; ph?: string; max?: number }) => (
    <div style={{ minWidth: opts?.w ?? 160, flex: 1 }}>
      <span style={lbl}>{label} :</span><span style={{ color: "red" }}>*</span>
      <input style={inp} value={(form as any)[k]} readOnly={opts?.ro} maxLength={opts?.max}
        placeholder={opts?.ph} onChange={opts?.calc ? setCalc(k) : set(k)} />
    </div>
  );
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
        <div style={{ minWidth: 180, flex: 1 }}><span style={lbl}>Client Name :</span><span style={{ color: "red" }}>*</span>
          <select style={inp} value={fClient} onChange={(e) => changeClient(e.target.value)}>
            <option value={SEL}>{SEL}</option>
            {clients.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 150, flex: 1 }}><span style={lbl}>State :</span><span style={{ color: "red" }}>*</span>
          <select style={inp} value={fState} onChange={(e) => changeState(e.target.value)}>
            <option value={SEL}>{SEL}</option>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 200, flex: 1 }}><span style={lbl}>Branch Name :</span><span style={{ color: "red" }}>*</span>
          <select style={inp} value={fBranch} onChange={(e) => setFBranch(e.target.value)}>
            <option value={SEL}>{SEL}</option>
            {branches.map((b) => <option key={b.code} value={b.code}>{b.name || b.code}</option>)}
          </select>
        </div>
        <div><span style={lbl}>Month / Year :</span><span style={{ color: "red" }}>*</span><br /><MonthInput value={fMonth} onChange={setFMonth} width={150} /></div>
        <div><span style={lbl}>Invoice Slot :</span><span style={{ color: "red" }}>*</span>
          <select style={{ ...inp, width: 130 }} value={fSlot} onChange={(e) => setFSlot(e.target.value)}>
            <option value={SEL}>{SEL}</option><option value="1_to_15">1_to_15</option><option value="16_to_30">16_to_30</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" style={btnP} onClick={process}>Process</button>
          <button type="button" style={btnP} onClick={downloadReport}>Report</button>
          <button type="button" style={btnD} onClick={() => { setRows([]); setProws([]); setEditId(""); }}>Close</button>
        </div>
      </div>

      <div style={{ background: "#f3f1fe", borderRadius: 10, padding: 12, marginBottom: 10 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          {fld("HelpDesk Request No", "helpNo")}
          {fld("Branch PC Code", "branchPc")}
          <div style={{ minWidth: 160, flex: 1 }}><span style={lbl}>Booking Date :</span><span style={{ color: "red" }}>*</span><br /><DateInput value={form.bookDate} onChange={(v) => setForm((f) => ({ ...f, bookDate: v }))} width={160} /></div>
          <div style={{ minWidth: 160, flex: 1 }}><span style={lbl}>Vendor Invoice Date :</span><span style={{ color: "red" }}>*</span><br /><DateInput value={form.invDate} onChange={(v) => setForm((f) => ({ ...f, invDate: v }))} width={160} /></div>
          {fld("Vendor Invoice No", "invNo")}
          <div style={{ minWidth: 150, flex: 1 }}><span style={lbl}>GST Applicable :</span><span style={{ color: "red" }}>*</span>
            <select style={inp} value={form.gstApp} onChange={set("gstApp")}>
              <option value="0">Not Applicable</option><option value="1">Applicable</option>
            </select>
          </div>
          {fld("Party Name", "party")}
          {fld("Gross Amount", "gross", { calc: true })}
          {fld("IGST", "igst", { calc: true })}
          {fld("CGST", "cgst", { calc: true })}
          {fld("SGST", "sgst", { calc: true })}
          {fld("Amount", "amount", { ro: true })}
          {fld("Bank Holder Name", "holder")}
          {fld("Bank Account No", "acc")}
          {fld("IFSC", "ifsc")}
          {fld("Bank Name", "bank")}
          {fld("GST NO", "gstNo")}
          {fld("HSN CODE", "hsn")}
          {fld("Discription", "desc", { w: 260 })}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          {[0, 1, 2].map((i) => (
            <div key={i}><span style={lbl}>File {i + 1} :</span>
              <input type="file" accept=".jpg,.jpeg,.png,.gif,.pdf,.rar,.zip" onChange={(e) => setFiles((f) => f.map((x, j) => (j === i ? (e.target.files?.[0] || null) : x)))} />
              <span style={{ fontSize: 10 }}>(Only JPG,JPEG,GIF,PDF)</span>
            </div>
          ))}
          <button type="button" style={btnP} onClick={save}>Save</button>
          <button type="button" style={btnP} onClick={approve}>Approve</button>
        </div>
      </div>

      <Exports id="rm" cols={["ID", "HELP REQ NUMBER", "BOOKING DATE", "VENDOR INVOICE DATE", "VENDOR INVOICE NO", "GST", "PARTY", "GROSS", "CGST", "SGST", "IGST", "AMOUNT", "HOLDER", "ACC NO", "IFSC", "STATUS", "PC Code", "REJECT REASON"]} rows={rows}
        cell={(r, c) => c === "ID" ? val(r, "ID") : c === "HELP REQ NUMBER" ? val(r, "help_req_number") : c === "BOOKING DATE" ? val(r, "booked_date") : c === "VENDOR INVOICE DATE" ? val(r, "vendor_invoice_date") : c === "VENDOR INVOICE NO" ? val(r, "vendor_invoice_no") : c === "GST" ? val(r, "GST_applicable_rm") : c === "PARTY" ? val(r, "party_name") : c === "GROSS" ? val(r, "gross_amount") : c === "CGST" ? val(r, "vendor_cgst") : c === "SGST" ? val(r, "vendor_Sgst") : c === "IGST" ? val(r, "vendor_igst") : c === "AMOUNT" ? val(r, "amount") : c === "HOLDER" ? val(r, "bank_holder_name") : c === "ACC NO" ? val(r, "bank_acc_no") : c === "IFSC" ? val(r, "ifsc_code") : c === "STATUS" ? val(r, "r_m_status") : c === "PC Code" ? val(r, "branch_pc_code") : val(r, "reject_reason")} />
      <div style={{ overflow: "auto", maxHeight: 400, border: "1px solid #ccc", marginBottom: 10 }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><th style={th}>ID</th><th style={th}>Sr No.</th><th style={th}>SELECT</th><th style={th}>HELP REQ NUMBER</th><th style={th}>BOOKING DATE</th><th style={th}>VENDOR INVOICE DATE</th><th style={th}>VENDOR INVOICE NO</th><th style={th}>GST</th><th style={th}>PARTY</th><th style={th}>GROSS</th><th style={th}>CGST</th><th style={th}>SGST</th><th style={th}>IGST</th><th style={th}>AMOUNT</th><th style={th}>HOLDER</th><th style={th}>ACC NO</th><th style={th}>IFSC</th><th style={th}>STATUS</th><th style={th}>PC Code</th><th style={th}>REJECT REASON</th><th style={th}>DOWNLOAD FILE 1</th><th style={th}>FILE 2</th><th style={th}>FILE 3</th><th style={th}>DELETE</th><th style={th}>Edit</th></tr></thead>
          <tbody>
            {rows.map((r, i) => {
              const id = String(val(r, "ID"));
              return (
                <tr key={i}>
                  <td style={td}>{id}</td><td style={td}>{i + 1}</td>
                  <td style={td}><input type="checkbox" checked={!!checked[id]} onChange={() => setChecked((c) => ({ ...c, [id]: !c[id] }))} /></td>
                  <td style={td}>{val(r, "help_req_number")}</td>
                  <td style={td}>{val(r, "booked_date")}</td>
                  <td style={td}>{val(r, "vendor_invoice_date")}</td>
                  <td style={td}>{val(r, "vendor_invoice_no")}</td>
                  <td style={td}>{val(r, "GST_applicable_rm")}</td>
                  <td style={td}>{val(r, "party_name")}</td>
                  <td style={td}>{val(r, "gross_amount")}</td>
                  <td style={td}>{val(r, "vendor_cgst")}</td>
                  <td style={td}>{val(r, "vendor_Sgst")}</td>
                  <td style={td}>{val(r, "vendor_igst")}</td>
                  <td style={td}>{val(r, "amount")}</td>
                  <td style={td}>{val(r, "bank_holder_name")}</td>
                  <td style={td}>{val(r, "bank_acc_no")}</td>
                  <td style={td}>{val(r, "ifsc_code")}</td>
                  <td style={td}>{val(r, "r_m_status")}</td>
                  <td style={td}>{val(r, "branch_pc_code")}</td>
                  <td style={td}>{val(r, "reject_reason")}</td>
                  <td style={td}>{val(r, "image_name") ? <a href={dl(val(r, "image_name"))} target="_blank" rel="noreferrer">Download</a> : ""}</td>
                  <td style={td}>{val(r, "image_name2") ? <a href={dl(val(r, "image_name2"))} target="_blank" rel="noreferrer">Download</a> : ""}</td>
                  <td style={td}>{val(r, "image_name3") ? <a href={dl(val(r, "image_name3"))} target="_blank" rel="noreferrer">Download</a> : ""}</td>
                  <td style={td}><button type="button" style={{ color: "#337ab7", background: "none", border: "none", cursor: "pointer", fontSize: 11 }} onClick={() => del(id)}>Delete</button></td>
                  <td style={td}><button type="button" style={{ color: "#337ab7", background: "none", border: "none", cursor: "pointer", fontSize: 11 }} onClick={() => editFill(id)}>Edit</button></td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td style={td} colSpan={25}>No records</td></tr>}
          </tbody>
        </table>
      </div>

      {prows.length > 0 && (
        <>
          <h4 style={{ fontSize: 13 }}>Process</h4>
          <div style={{ overflow: "auto", maxHeight: 300, border: "1px solid #ccc", marginBottom: 10 }}>
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr><th style={th}>ID</th><th style={th}>Sr No.</th><th style={th}>HELP REQ NUMBER</th><th style={th}>BOOKING DATE</th><th style={th}>VENDOR INVOICE DATE</th><th style={th}>VENDOR INVOICE NO</th><th style={th}>GST</th><th style={th}>PARTY</th><th style={th}>GROSS</th><th style={th}>CGST</th><th style={th}>SGST</th><th style={th}>IGST</th><th style={th}>AMOUNT</th><th style={th}>HOLDER</th><th style={th}>ACC NO</th><th style={th}>IFSC</th><th style={th}>STATUS</th><th style={th}>DOWNLOAD</th></tr></thead>
              <tbody>
                {prows.map((r, i) => (
                  <tr key={i}>
                    <td style={td}>{val(r, "ID")}</td><td style={td}>{i + 1}</td>
                    <td style={td}>{val(r, "help_req_number")}</td>
                    <td style={td}>{val(r, "booked_date")}</td>
                    <td style={td}>{val(r, "vendor_invoice_date")}</td>
                    <td style={td}>{val(r, "vendor_invoice_no")}</td>
                    <td style={td}>{val(r, "gst_text")}</td>
                    <td style={td}>{val(r, "party_name")}</td>
                    <td style={td}>{val(r, "gross_amount")}</td>
                    <td style={td}>{val(r, "vendor_cgst")}</td>
                    <td style={td}>{val(r, "vendor_Sgst")}</td>
                    <td style={td}>{val(r, "vendor_igst")}</td>
                    <td style={td}>{val(r, "amount")}</td>
                    <td style={td}>{val(r, "bank_holder_name")}</td>
                    <td style={td}>{val(r, "bank_acc_no")}</td>
                    <td style={td}>{val(r, "ifsc_code")}</td>
                    <td style={td}>{val(r, "r_m_status")}</td>
                    <td style={td}>{val(r, "image_name") ? <a href={dl(val(r, "image_name"))} target="_blank" rel="noreferrer">R&amp;M Sheet Download</a> : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 10 }}>
        <div><span style={lbl}>From Date:</span><br /><DateInput value={rFrom} onChange={setRFrom} width={150} /></div>
        <div><span style={lbl}>To Date:</span><span style={{ color: "red" }}>*</span><br /><DateInput value={rTo} onChange={setRTo} width={150} /></div>
        <button type="button" style={btnP} onClick={downloadReport}>Download Report</button>
      </div>
      {repDone && (
        <Grid id="rm-report" cols={repRows.length ? Object.keys(repRows[0]) : ["result"]} rows={repRows} cell={(r, c) => val(r, c)} />
      )}
    </div>
  );
}
