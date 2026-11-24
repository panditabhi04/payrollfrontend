"use client";
/* =====================================================================
 * UNIT PORTAL — 1:1 port of Unit_Login.aspx (+ Unit_Login.aspx.cs).
 * Header: WELCOME TO IH&MS | Login (UNIT_CODE) | LogOut | Branch Name
 * dropdown | State | City | Location(Place/City) | Address | Zone |
 * Region Name (all read-only, from pay_unit_master).
 * 15 tabs (exact legacy order/labels):
 * Attendance Photo | Android Attendance | Employee Current Location |
 * Work Photo | Designation | Heads Info | Monthly Attendance |
 * Employee Documents | Feedback (Rating 1-10) | R & M | Files |
 * Visit Report By FO | Raise Complaint | FeedBack | Fire Extinguisher Info
 * Backend: /api/masters/portal/unit/* (legacy tables, parameterized).
 * ===================================================================== */
import React, { useEffect, useState } from "react";
import { API_BASE_URL } from "@/lib/api/client";

const BASE = "/api/masters/portal/unit";
const SEL = "Select";

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
  // DRF returns 400s as {"detail": "..."} OR ["..."] OR field-dicts —
  // surface the real text instead of a generic "Request failed (400)".
  let b: any = null;
  try { b = await r.json(); } catch { /* HTML / non-JSON body */ }
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
    try {
      const t = JSON.stringify(b);
      if (t && t !== "{}") return t.slice(0, 300);
    } catch { /* ignore */ }
  }
  return `Request failed (${r.status})`;
}

async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE_URL}${path}`, { credentials: "include", cache: "no-store" });
  if (!r.ok) throw new Error(await errMsg(r));
  return (await r.json()) as T;
}

function errText(b: any, status: number): string {
  // Same shapes as errMsg() but for an already-parsed JSON body.
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

async function postJSON(path: string, body: any): Promise<any> {
  const csrf = await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" })
    .then((r) => r.json()).catch(() => null);
  const token = (csrf as any)?.csrfToken || "";
  const m = document.cookie.match(/(^|; )csrftoken=([^;]+)/);
  const r = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": token || (m ? decodeURIComponent(m[2]) : "") },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(errText(d, r.status));
  return d;
}

async function postForm(path: string, form: FormData): Promise<any> {
  const csrf = await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" })
    .then((r) => r.json()).catch(() => null);
  const token = (csrf as any)?.csrfToken || "";
  const m = document.cookie.match(/(^|; )csrftoken=([^;]+)/);
  const r = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST", credentials: "include",
    headers: { "X-CSRFToken": token || (m ? decodeURIComponent(m[2]) : "") },
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

/* ---- Date pickers with calendar popup (legacy jQuery datepicker 1:1).
 * dd/MM/yyyy fields use <input type="date">, mm/yyyy fields use
 * <input type="month">, converted to the exact legacy strings. ---- */
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

/* unit scope query-string for every tab call (unit-less logins must pass the
 * picked branch explicitly; scoped unit logins ignore it server-side). */
const uq = (unit: string) => `unit_code=${encodeURIComponent(unit)}`;

function NeedUnit() {
  return <p style={{ fontSize: 12, color: "#856404" }}>Please select Branch Name above first.</p>;
}

const TABS = ["Attendance Photo", "Android Attendance", "Employee Current Location", "Work Photo", "Designation", "Heads Info", "Monthly Attendance", "Employee Documents", "Feedback", "R & M", "Files", "Visit Report By FO", "Raise Complaint", "FeedBack", "Fire Extinguisher Info"];

export default function UnitPortal() {
  const [tab, setTab] = useState("Attendance Photo");
  const [loginUnit, setLoginUnit] = useState("");
  const [branches, setBranches] = useState<{ code: string; name: string }[]>([]);
  const [unit, setUnit] = useState("");
  const [detail, setDetail] = useState<Row>({});
  const [err, setErr] = useState("");
  const [needsUnit, setNeedsUnit] = useState(false);

  const loadHeader = async (u?: string) => {
    try {
      const d = await getJSON<{ login_unit: string; unit_code: string; branches: any[]; detail: Row; needs_unit?: boolean }>(
        `${BASE}/header/${u ? `?unit_code=${encodeURIComponent(u)}` : ""}`);
      if (d.needs_unit) {
        // Login has no unit (superuser/tester): pick the branch first —
        // the page then locks to it exactly like a legacy UNIT login.
        setNeedsUnit(true);
        setErr("");
        const br = (d.branches || []).map((b: any) => ({ code: String(val(b, "code") ?? ""), name: String(val(b, "name") ?? "") }));
        setBranches(br);
        setUnit("");
        setDetail({});
        setLoginUnit("");
        return;
      }
      setNeedsUnit(false);
      setLoginUnit(d.login_unit || "");
      const br = (d.branches || []).map((b: any) => ({ code: String(val(b, "code") ?? ""), name: String(val(b, "name") ?? "") }));
      setBranches(br);
      const resolved = d.unit_code || u || (br[0]?.code ?? "");
      setUnit(resolved);
      setDetail(d.detail || {});
      if (resolved && resolved !== (d.unit_code || "")) {
        const d2 = await getJSON<{ detail: Row }>(`${BASE}/header/?unit_code=${encodeURIComponent(resolved)}`);
        setDetail(d2.detail || {});
      }
    } catch (e: any) {
      setErr(e.message || "Header not loading");
    }
  };

  useEffect(() => { loadHeader(); }, []);

  const changeUnit = async (u: string) => {
    if (!u) return;
    setUnit(u);
    setNeedsUnit(false);
    try {
      const d = await getJSON<{ detail: Row; login_unit: string }>(`${BASE}/header/?unit_code=${encodeURIComponent(u)}`);
      setDetail(d.detail || {});
      if ((d as any).login_unit) setLoginUnit((d as any).login_unit);
    } catch (e: any) { alert(e.message); }
  };

  const D = (k: string) => String(val(detail, k) ?? "");

  return (
    <div style={{ padding: 12, fontFamily: "Verdana", fontSize: 10 }}>
      <div style={{ background: "#f3f1fe", border: "1px solid gray", borderRadius: 4 }}>
        <div style={{ background: "#337ab7", color: "#fff", padding: "10px 14px", borderRadius: "4px 4px 0 0" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div style={{ fontWeight: "bold", fontSize: 16 }}>IH&amp;MS</div>
            <div style={{ flex: 1, textAlign: "center", fontSize: "large", fontWeight: "bold" }}>WELCOME TO IH&amp;MS</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span style={{ fontWeight: "bold", fontSize: 12 }}>Login :</span>
              <span style={{ background: "#337ab7", border: "1px solid #fff", padding: "4px 12px", borderRadius: 4, fontSize: 12 }}>{loginUnit}</span>
              <button type="button" style={{ ...btnP, background: "#fff", color: "#337ab7" }} onClick={async () => {
                await fetch(`${API_BASE_URL}/api/auth/logout/`, { method: "POST", credentials: "include" }).catch(() => undefined);
                window.location.href = "/login";
              }}>LogOut</button>
            </div>
          </div>
        </div>
        <div style={{ padding: 16 }}>
          {err && <p style={{ color: "red", fontSize: 12 }}>{err}</p>}
          {needsUnit && <p style={{ color: "#856404", fontSize: 12 }}>This login has no unit attached — please select Branch Name to open that unit portal.</p>}
          <div style={{ background: "rgba(255,255,255,0.58)", borderRadius: 10, padding: 16 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <div style={{ minWidth: 220, flex: 1 }}>
                <span style={lbl}>Branch Name :</span>
                <select style={inp} value={unit} onChange={(e) => changeUnit(e.target.value)}>
                  {needsUnit && <option value="">Select</option>}
                  {branches.map((b) => <option key={b.code} value={b.code}>{b.name || b.code}</option>)}
                  {branches.length === 0 && <option value={unit}>{unit}</option>}
                </select>
              </div>
              <div style={{ minWidth: 150, flex: 1 }}><span style={lbl}>State :</span><input style={inp} readOnly value={D("STATE_NAME")} /></div>
              <div style={{ minWidth: 150, flex: 1 }}><span style={lbl}>City :</span><input style={inp} readOnly value={D("UNIT_CITY")} /></div>
              <div style={{ minWidth: 150, flex: 1 }}><span style={lbl}>Location(Place/City) :</span><input style={inp} readOnly value={D("UNIT_ADD1")} /></div>
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
              <div style={{ minWidth: 220, flex: 2 }}><span style={lbl}>Address(Street/Road/Lane) :</span><textarea style={inp} rows={2} readOnly value={D("UNIT_ADD2")} /></div>
              <div style={{ minWidth: 150, flex: 1 }}><span style={lbl}>Zone :</span><input style={inp} readOnly value={D("txt_zone")} /></div>
              <div style={{ minWidth: 150, flex: 1 }}><span style={lbl}>Region Name :</span><input style={inp} readOnly value={D("ZONE")} /></div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", marginTop: 12, border: "1px solid #ddd" }}>
        <ul style={{ display: "flex", gap: 2, flexWrap: "wrap", listStyle: "none", margin: 0, padding: 6, background: "#dddddd", border: "none" }}>
          {TABS.map((t) => (
            <li key={t}>
              <button type="button" onClick={() => setTab(t)}
                style={{ border: "1px solid #bbb", background: tab === t ? "#337ab7" : "#f5f5f5", color: tab === t ? "#fff" : "#000", fontSize: 11, padding: "6px 10px", cursor: "pointer", borderRadius: 3 }}>{t}</button>
            </li>
          ))}
        </ul>
        <div style={{ padding: 14 }}>
          {tab === "Attendance Photo" && <TabPhoto unit={unit} />}
          {tab === "Android Attendance" && <TabGroom unit={unit} />}
          {tab === "Employee Current Location" && <TabTracking unit={unit} />}
          {tab === "Work Photo" && <TabWork unit={unit} />}
          {tab === "Designation" && <TabDesignation unit={unit} />}
          {tab === "Heads Info" && <TabHeads detail={detail} />}
          {tab === "Monthly Attendance" && <TabMonthly unit={unit} />}
          {tab === "Employee Documents" && <TabDocs unit={unit} />}
          {tab === "Feedback" && <TabRating unit={unit} />}
          {tab === "R & M" && <TabService unit={unit} />}
          {tab === "Files" && <TabFiles unit={unit} />}
          {tab === "Visit Report By FO" && <TabVisit unit={unit} />}
          {tab === "Raise Complaint" && <TabComplaint unit={unit} />}
          {tab === "FeedBack" && <TabClientFeedback unit={unit} />}
          {tab === "Fire Extinguisher Info" && <TabFire unit={unit} />}
        </div>
      </div>
    </div>
  );
}

/* ================= Attendance Photo (menu0) ================= */
function TabPhoto({ unit }: { unit: string }) {
  const [f, setF] = useState(""); const [t, setT] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  if (!unit) return <NeedUnit />;
  const show = async () => {
    if (!f) { alert("Please Enter From Date"); return; }
    if (!t) { alert("Please Enter To Date"); return; }
    try {
      const d = await getJSON<{ results: Row[]; message?: string }>(`${BASE}/attendance-photo/?unit_code=${encodeURIComponent(unit)}&from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`);
      if (d.message) alert(d.message);
      setRows(d.results || []);
    } catch (e: any) { alert(e.message); }
  };
  const cols = ["Sr No.", "NAME", "ADDRESS", "BRANCH IN-TIME", "BRANCH OUT_TIME", "OUTSIDE IN-TIME", "OUTSIDE OUT-TIME", "IN", "OUT"];
  const cell = (r: Row, c: string) => {
    if (c === "Sr No.") return "";
    if (c === "NAME") return val(r, "EMP_NAME");
    if (c === "ADDRESS") return val(r, "ADDRESS");
    if (c === "BRANCH IN-TIME") return val(r, "attendances_intime");
    if (c === "BRANCH OUT_TIME") return val(r, "attendances_outtime");
    if (c === "OUTSIDE IN-TIME") return val(r, "camera_intime");
    if (c === "OUTSIDE OUT-TIME") return val(r, "camera_outtime");
    return "";
  };
  const img = (r: Row, c: string) => {
    if (c === "IN") {
      const f1 = val(r, "Attendances_intime_images") || val(r, "Camera_intime_images");
      return f1 ? media("attendance_images", f1) : null;
    }
    if (c === "OUT") {
      const f1 = val(r, "Attendances_outtime_images") || val(r, "Camera_outtime_images");
      return f1 ? media("attendance_images", f1) : null;
    }
    return null;
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
        <div><span style={lbl}>Date :</span><span style={{ color: "red" }}>*</span><br /><DateInput value={f} onChange={setF} width={150} /></div>
        <div><span style={lbl}>To Date :</span><span style={{ color: "red" }}>*</span><br /><DateInput value={t} onChange={setT} width={150} /></div>
        <button type="button" style={btnP} onClick={show}>Show</button>
      </div>
      <Grid id="att-photo" cols={cols} rows={rows.map((r, i) => ({ ...r, __i: i + 1 }))} cell={(r, c) => (c === "Sr No." ? r.__i : cell(r, c))} img={img} />
    </div>
  );
}

/* ================= Android Attendance / grooming (menu12) ================= */
function TabGroom({ unit }: { unit: string }) {
  const [f, setF] = useState(""); const [t, setT] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  if (!unit) return <NeedUnit />;
  const show = async () => {
    if (!f || !t) { alert("Please Select Date"); return; }
    try {
      const d = await getJSON<{ results: Row[] }>(`${BASE}/tab-attendance/?unit_code=${encodeURIComponent(unit)}&from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`);
      setRows(d.results || []);
    } catch (e: any) { alert(e.message); }
  };
  const cols = ["Branch", "Employee Name", "Grade", "Shipt Time", "Punctuality", "Uniforms", "Cap", "Shoes", "Belt", "Id Card", "Shaving", "Hairs", "Nails", "Briefing", "InTime Image", "OutTime Image", "Remarks", "Location Address"];
  const get = (r: Row, c: string) => {
    const m: Record<string, string> = { "Branch": "unit_code", "Employee Name": "emp_name", "Grade": "grade_desc", "Shipt Time": "shifttime", "Punctuality": "punctuality", "Uniforms": "uniforms", "Cap": "cap", "Shoes": "shoes", "Belt": "belt", "Id Card": "id_card", "Shaving": "shaving", "Hairs": "hairs", "Nails": "nails", "Briefing": "briefing", "Remarks": "remarks", "Location Address": "location_add" };
    return val(r, m[c] || c);
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
        <div><span style={lbl}>From Date:</span><span style={{ color: "red" }}>*</span><br /><DateInput value={f} onChange={setF} width={150} /></div>
        <div><span style={lbl}>To Date:</span><span style={{ color: "red" }}>*</span><br /><DateInput value={t} onChange={setT} width={150} /></div>
        <button type="button" style={btnP} onClick={show}>Show</button>
      </div>
      <Grid id="tab-att" cols={cols} rows={rows} cell={get} img={(r, c) => {
        if (c === "InTime Image") { const x = val(r, "intime_imgpath"); return x ? media("tab_attendance_images", x) : null; }
        if (c === "OutTime Image") { const x = val(r, "outtime_imgpath"); return x ? media("tab_attendance_images", x) : null; }
        return null;
      }} />
    </div>
  );
}

/* ================= Employee Current Location (menu13) ================= */
function TabTracking({ unit }: { unit: string }) {
  const [f, setF] = useState(""); const [t, setT] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  if (!unit) return <NeedUnit />;
  const show = async () => {
    if (!f) { alert("Please Select From Date"); return; }
    if (!t) { alert("Please Select To Date"); return; }
    try {
      const d = await getJSON<{ results: Row[]; message?: string }>(`${BASE}/tracking/?unit_code=${encodeURIComponent(unit)}&from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`);
      if (d.message) alert(d.message);
      setRows(d.results || []);
    } catch (e: any) { alert(e.message); }
  };
  const cols = ["Sr No.", "Emp-Name", "Current-Latitude", "Current-Longitude", "Current-Date", "Address"];
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
        <div><span style={lbl}>From Date :</span><br /><DateInput value={f} onChange={setF} width={150} /></div>
        <div><span style={lbl}>To Date :</span><br /><DateInput value={t} onChange={setT} width={150} /></div>
        <button type="button" style={btnP} onClick={show}>Show</button>
      </div>
      <Grid id="tracking" cols={cols} rows={rows.map((r, i) => ({ ...r, __i: i + 1 }))} cell={(r, c) =>
        c === "Sr No." ? r.__i : c === "Emp-Name" ? val(r, "emp_code") : c === "Current-Latitude" ? val(r, "cur_latitude") : c === "Current-Longitude" ? val(r, "cur_longtitude") : c === "Current-Date" ? val(r, "cur_date") : val(r, "cur_address")} />
    </div>
  );
}

/* ================= Work Photo (menu9) ================= */
function TabWork({ unit }: { unit: string }) {
  const [f, setF] = useState(""); const [t, setT] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  if (!unit) return <NeedUnit />;
  const show = async () => {
    if (!f) { alert("Please Enter From Date"); return; }
    if (!t) { alert("Please Enter To Date"); return; }
    try {
      const d = await getJSON<{ results: Row[] }>(`${BASE}/work_photos/?unit_code=${encodeURIComponent(unit)}&from=${encodeURIComponent(f)}&to=${encodeURIComponent(t)}`);
      setRows((d.results || []).filter((r) => {
        void f; void t; return true;
      }));
    } catch (e: any) { alert(e.message); }
  };
  const cols = ["Sr No.", "EMP NAME", "DATE-TIME", "IN"];
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
        <div><span style={lbl}>From Date :</span><span style={{ color: "red" }}>*</span><br /><DateInput value={f} onChange={setF} width={150} /></div>
        <div><span style={lbl}>To Date :</span><span style={{ color: "red" }}>*</span><br /><DateInput value={t} onChange={setT} width={150} /></div>
        <button type="button" style={btnP} onClick={show}>Show</button>
      </div>
      <Grid id="work-photo" cols={cols} rows={rows.map((r, i) => ({ ...r, __i: i + 1 }))} cell={(r, c) =>
        c === "Sr No." ? r.__i : c === "EMP NAME" ? val(r, "EMP_NAME") : c === "DATE-TIME" ? val(r, "datecurrent") : ""}
        img={(r, c) => (c === "IN" && val(r, "image_name") ? media("attendance_images", val(r, "image_name")) : null)} />
    </div>
  );
}

/* ================= Designation (menu1) ================= */
function TabDesignation({ unit }: { unit: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    if (!unit) return;
    getJSON<{ results: Row[] }>(`${BASE}/deployment/?${uq(unit)}`).then((d) => setRows(d.results || [])).catch(() => undefined);
  }, [unit]);
  if (!unit) return <NeedUnit />;
  const cols = ["Sr No.", "Designation", "Employee Count"];
  return (
    <div style={{ background: "#f3f1fe", borderRadius: 10, padding: 20 }}>
      <Grid id="designation" cols={cols} rows={rows.map((r, i) => ({ ...r, __i: i + 1 }))} cell={(r, c) =>
        c === "Sr No." ? r.__i : c === "Designation" ? (val(r, "DESIGNATION") || val(r, "designation")) : (val(r, "COUNT") || val(r, "count"))} />
    </div>
  );
}

/* ================= Heads Info (menu3) ================= */
function TabHeads({ detail }: { detail: Row }) {
  const v = (k: string) => String(val(detail, k) ?? "");
  const row = (head: string, n: string, m: string, e: string) => (
    <tr style={{ textAlign: "center", fontWeight: "bold" }}>
      <td style={td}><b>{head}</b></td>
      <td style={td}><input style={inp} readOnly placeholder="Contact Person Name" value={v(n)} /></td>
      <td style={td}><input style={inp} readOnly placeholder="Contact Person Name" value={v(m)} /></td>
      <td style={td}><input style={inp} readOnly placeholder="Contact Person Name" value={v(e)} /></td>
    </tr>
  );
  return (
    <table style={{ borderCollapse: "collapse", width: "80%", margin: "0 auto" }} className="table table-bordered">
      <thead><tr style={{ background: "#337ab7", color: "#fff", fontWeight: "bold", textAlign: "center" }}>
        <td style={th}></td><td style={th}>Operation</td><td style={th}>Finance</td><td style={th}>Location</td><td style={th}>Other</td>
      </tr></thead>
      <tbody>
        <tr style={{ textAlign: "center", fontWeight: "bold" }}>
          <td style={td}><b>Contact Person Name</b></td>
          <td style={td}><input style={inp} readOnly value={v("OperationHead_Name")} /></td>
          <td style={td}><input style={inp} readOnly value={v("FinanceHead_Name")} /></td>
          <td style={td}><input style={inp} readOnly value={v("LocationHead_Name")} /></td>
          <td style={td}><input style={inp} readOnly value={v("OtherHead_Name")} /></td>
        </tr>
        <tr style={{ textAlign: "center", fontWeight: "bold" }}>
          <td style={td}><b>Mobile No</b></td>
          <td style={td}><input style={inp} readOnly value={v("OperationHead_Mobileno")} /></td>
          <td style={td}><input style={inp} readOnly value={v("FinanceHead_Mobileno")} /></td>
          <td style={td}><input style={inp} readOnly value={v("LocationHead_mobileno")} /></td>
          <td style={td}><input style={inp} readOnly value={v("OtherHead_Monileno")} /></td>
        </tr>
        <tr style={{ textAlign: "center", fontWeight: "bold" }}>
          <td style={td}><b>Email Id</b></td>
          <td style={td}><input style={inp} readOnly value={v("OperationHead_EmailId")} /></td>
          <td style={td}><input style={inp} readOnly value={v("FinanceHead_EmailId")} /></td>
          <td style={td}><input style={inp} readOnly value={v("LocationHead_Emailid")} /></td>
          <td style={td}><input style={inp} readOnly value={v("OtherHead_Emailid")} /></td>
        </tr>
        {void row}
      </tbody>
    </table>
  );
}

/* ================= Monthly Attendance (menu4) ================= */
function TabMonthly({ unit }: { unit: string }) {
  const [my, setMy] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [days, setDays] = useState<string[]>([]);
  if (!unit) return <NeedUnit />;
  const show = async () => {
    if (!my) { alert("Please Select Month"); return; }
    const m = my.slice(0, 2); const y = my.slice(3);
    try {
      const d = await getJSON<{ results: Row[]; day_columns: string[] }>(`${BASE}/monthly_attendance/?${uq(unit)}&month=${m}&year=${y}`);
      setRows(d.results || []); setDays(d.day_columns || []);
    } catch (e: any) { alert(e.message); }
  };
  const cols = ["STATE", "Branch_Name", "CITY", "CLIENT_CODE", "EMPLOYEE_NAME", "DESIGNATION", ...days, "PRESENT_DAYS", "ABSENT", "TOTAL_DAYS"];
  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 10 }}>
        <div><span style={lbl}>Select Month :</span><span style={{ color: "red" }}>*</span><br /><MonthInput value={my} onChange={setMy} width={150} /></div>
        <button type="button" style={btnP} onClick={show}> SHOW </button>
      </div>
      <Grid id="monthly" cols={cols} rows={rows} cell={(r, c) => val(r, c) ?? val(r, c.toLowerCase())} />
    </div>
  );
}

/* ================= Employee Documents (menu5) ================= */
function TabDocs({ unit }: { unit: string }) {
  const [emps, setEmps] = useState<{ code: string; name: string }[]>([]);
  const [emp, setEmp] = useState(SEL);
  const [docs, setDocs] = useState<Row | null>(null);
  useEffect(() => {
    if (!unit) return;
    getJSON<{ results: Row[] }>(`${BASE}/employees/?${uq(unit)}`).then((d) =>
      setEmps((d.results || []).map((r) => ({ code: String(val(r, "code")), name: String(val(r, "name")) })))).catch(() => undefined);
  }, [unit]);
  if (!unit) return <NeedUnit />;
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

/* ================= Feedback rating 1-10 (menu6, legacy hidden) ================= */
function TabRating({ unit }: { unit: string }) {
  const [rating, setRating] = useState("");
  const [sug, setSug] = useState("");
  const [file, setFile] = useState<File | null>(null);
  if (!unit) return <NeedUnit />;
  const submit = async () => {
    if (!rating) { alert("Please select rating"); return; }
    if (!sug) { alert("Please Enter Sugession"); return; }
    const fd = new FormData();
    fd.append("rating", rating); fd.append("suggestion", sug);
    if (file) fd.append("file", file);
    try { const d = await postForm(`${BASE}/feedback-rating/?${uq(unit)}`, fd); alert(d.message || "Feedback Submitted Successfully"); setRating(""); setSug(""); setFile(null); }
    catch (e: any) { alert(e.message); }
  };
  return (
    <div>
      <p style={{ fontSize: 13, color: "#000" }}><b>We thank you for your participation for using our services</b></p>
      <p style={{ fontSize: 14, color: "#000", textAlign: "center" }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
          <span key={n}>&nbsp;<input type="radio" name="rating" checked={rating === String(n)} onChange={() => setRating(String(n))} />&nbsp;{n} &nbsp;</span>
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

/* ================= R & M (menu7) ================= */
const SERVICES = [SEL, "Electrical", "Plumbing", "Carpentry", "Civil", "Pest_Control", "HVAC"];
function TabService({ unit }: { unit: string }) {
  const [svc, setSvc] = useState(SEL);
  const [cats, setCats] = useState<string[]>([]);
  const [cat, setCat] = useState("");
  const [pri, setPri] = useState(SEL);
  const [comment, setComment] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const load = async () => {
    if (!unit) return;
    try { const d = await getJSON<{ results: Row[] }>(`${BASE}/service-grid/?${uq(unit)}`); setRows(d.results || []); }
    catch { /* ignore */ }
  };
  useEffect(() => { load(); }, [unit]);
  if (!unit) return <NeedUnit />;
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
    if (!svc || svc === SEL) { alert("Please Select Services !!!"); return; }
    if (!pri || pri === SEL) { alert("Please Select Priority  !!!"); return; }
    if (!comment) { alert("Please Enter Additional Comment !!!"); return; }
    try {
      const d = await postJSON(`${BASE}/service-submit/?${uq(unit)}`, { services: svc, priority: pri, additional_comment: comment, category: cat });
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
      <Exports id="service" cols={cols} rows={rows} cell={(r, c) =>
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

/* ================= Files (menu8) ================= */
function TabFiles({ unit }: { unit: string }) {
  const [month, setMonth] = useState("");
  const [svcId, setSvcId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [services, setServices] = useState<Row[]>([]);
  useEffect(() => {
    if (!unit) return;
    getJSON<{ results: Row[] }>(`${BASE}/service-grid/?${uq(unit)}`).then((d) => { setRows([]); setServices(d.results || []); }).catch(() => undefined);
  }, [unit]);
  if (!unit) return <NeedUnit />;
  const show = async () => {
    if (!svcId) { alert("Please select request"); return; }
    try {
      const d = await getJSON<{ results: Row[] }>(`${BASE}/service-files/?${uq(unit)}&id=${encodeURIComponent(svcId)}`);
      setRows(d.results || []);
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
        <div><b>Request No :</b>
          <select style={{ ...inp, width: 220 }} value={svcId} onChange={(e) => setSvcId(e.target.value)}>
            <option value="">Select</option>
            {services.map((r) => <option key={String(val(r, "Id"))} value={String(val(r, "Id"))}>{String(val(r, "Id"))} - {String(val(r, "services"))}</option>)}
          </select>
        </div>
        <button type="button" style={btnP} onClick={show}>Show</button>
      </div>
      <div style={{ overflow: "auto", maxHeight: 300, border: "1px solid #ccc" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><th style={th}>No.</th><th style={th}>Download File</th><th style={th}>Quotation By</th><th style={th}>Date</th><th style={th}></th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={td}>{i + 1}</td>
                <td style={td}>{val(r, "Value") ? <a href={String(val(r, "Value"))} target="_blank" rel="noreferrer">Download</a> : ""}</td>
                <td style={td}>{val(r, "created_by")}</td>
                <td style={td}>{val(r, "create_date")}</td>
                <td style={td}><button type="button" style={btnP} onClick={() => del(val(r, "id"))}>Delete</button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td style={td} colSpan={5}>No records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= Visit Report By FO (menu10) ================= */
function TabVisit({ unit }: { unit: string }) {
  const [sups, setSups] = useState<{ code: string; name: string }[]>([]);
  const [sup, setSup] = useState(SEL);
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    if (!unit) return;
    getJSON<{ results: Row[] }>(`${BASE}/supervisors/?${uq(unit)}`).then((d) =>
      setSups((d.results || []).map((r) => ({ code: String(val(r, "code")), name: String(val(r, "name")) })))).catch(() => undefined);
  }, [unit]);
  if (!unit) return <NeedUnit />;
  const show = async () => {
    if (!sup || sup === SEL) { alert("Please Select Supervisor Name"); return; }
    try {
      const d = await getJSON<{ results: Row[]; message?: string }>(`${BASE}/visit-report/?${uq(unit)}&supervisor=${encodeURIComponent(sup)}`);
      if (d.message) alert(d.message);
      setRows(d.results || []);
    } catch (e: any) { alert(e.message); }
  };
  const cols = ["Employee_Name", "Grade_name", "Question_1", "IMAGE", "Question_2", "IMAGE", "Question_3", "IMAGE", "Question_4", "IMAGE", "Question_5", "IMAGE", "Question_6", "IMAGE", "Remark", "location", "Comment", "Status"];
  const qmap: Record<string, [string, string]> = {
    "Question_1": ["que_1_ans", "que_1_path"], "Question_2": ["que_2_ans", "que_2_path"],
    "Question_3": ["que_3_ans", "que_3_path"], "Question_4": ["que_4_ans", "que_4_path"],
    "Question_5": ["que_5_ans", "que_5_path"], "Question_6": ["que_6_ans", "que_6_path"],
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 10 }}>
        <div><span style={lbl}>Supervisor Name :</span>
          <select style={{ ...inp, width: 220 }} value={sup} onChange={(e) => setSup(e.target.value)}>
            <option value={SEL}>{SEL}</option>
            {sups.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
          </select>
        </div>
        <button type="button" style={btnP} onClick={show}> Show </button>
      </div>
      <Grid id="visit" cols={cols} rows={rows} cell={(r, c) => {
        if (c === "Employee_Name") return val(r, "emp_code");
        if (c === "Grade_name") return val(r, "grade_name");
        if (c === "Remark") return val(r, "remark");
        if (c === "location") return val(r, "location");
        if (c === "Comment") return val(r, "comment");
        if (c === "Status") return val(r, "Status");
        if (c === "IMAGE") return "";
        return val(r, qmap[c]?.[0] || c);
      }} img={(r, c) => {
        if (c !== "IMAGE") return null;
        return null;
      }} />
      {rows.length > 0 && (
        <div style={{ overflow: "auto", marginTop: 8 }}>
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
    </div>
  );
}

/* ================= Raise Complaint (menu11) ================= */
function TabComplaint({ unit }: { unit: string }) {
  const [pri, setPri] = useState(SEL);
  const [cats, setCats] = useState<string[]>([]);
  const [cat, setCat] = useState(SEL);
  const [types, setTypes] = useState<string[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [remark, setRemark] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const loadGrid = async () => {
    if (!unit) return;
    try { const d = await getJSON<{ results: Row[] }>(`${BASE}/complaint-grid/?${uq(unit)}`); setRows(d.results || []); }
    catch { /* ignore */ }
  };
  useEffect(() => {
    getJSON<{ results: Row[] }>(`${BASE}/complaint-categories/`).then((d) =>
      setCats((d.results || []).map((r) => String(val(r, "name"))))).catch(() => undefined);
    loadGrid();
  }, [unit]);
  if (!unit) return <NeedUnit />;
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
    if (!remark) { alert("Please Enter Remark"); return; }
    const names = types.filter((t) => checked[t]);
    try {
      const d = await postJSON(`${BASE}/complaint-send/?${uq(unit)}`, { priority: pri, category: cat, remark, names });
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
            <div style={{ alignSelf: "flex-end" }}><button type="button" style={btnP} onClick={send}>SEND</button></div>
          </div>
        )}
      </div>
      <Exports id="complaints" cols={["No.", "Type Of Complaint", "Priority", "Complaint Raised Date", "Complaint Resolved Date", "Status", "Remark", "Reply From IHMS"]} rows={rows}
        cell={(r, c) => c === "No." ? val(r, "Id") : c === "Type Of Complaint" ? val(r, "complaint_name") : c === "Priority" ? val(r, "priority") : c === "Complaint Raised Date" ? val(r, "date") : c === "Complaint Resolved Date" ? val(r, "resole_date") : c === "Status" ? val(r, "status") : c === "Remark" ? val(r, "Remark") : val(r, "comment")} />
      <div style={{ overflow: "auto", maxHeight: 450, border: "1px solid #ccc" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><th style={th}>No.</th><th style={th}>Type Of Complaint</th><th style={th}>Priority</th><th style={th}>Complaint Raised Date</th><th style={th}>Complaint Resolved Date</th><th style={th}>Status</th><th style={th}>Remark</th><th style={th}>Reply From IHMS</th><th style={th}></th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td style={td}>{val(r, "Id")}</td>
                <td style={td}>{val(r, "complaint_name")}</td>
                <td style={td}>{val(r, "priority")}</td>
                <td style={td}>{val(r, "date")}</td>
                <td style={td}>{val(r, "resole_date")}</td>
                <td style={td}>{val(r, "status")}</td>
                <td style={{ ...td, minWidth: 200 }}>{val(r, "Remark")}</td>
                <td style={{ ...td, minWidth: 200 }}>{val(r, "comment")}</td>
                <td style={td}>{String(val(r, "status")) === "Resolve" && (
                  <button type="button" style={{ color: "#337ab7", background: "none", border: "none", cursor: "pointer", fontSize: 11 }} onClick={() => complete(val(r, "Id"))}>Complete</button>
                )}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td style={td} colSpan={9}>No records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ================= FeedBack client (menu14) ================= */
const RATE_OPTS = [{ v: "100", t: "Excellent" }, { v: "95", t: "Very Good" }, { v: "90", t: "Good" }, { v: "80", t: "Satisfactory" }, { v: "70", t: "Poor" }];
function TabClientFeedback({ unit }: { unit: string }) {
  const [dt, setDt] = useState("");
  const [f1, setF1] = useState("100"); const [f2, setF2] = useState("100"); const [f3, setF3] = useState("100");
  const [f4, setF4] = useState("100"); const [f5, setF5] = useState("100");
  const pct = `${((parseInt(f1) + parseInt(f2) + parseInt(f3) + parseInt(f4) + parseInt(f5)) / 5)}%`;
  if (!unit) return <NeedUnit />;
  const submit = async () => {
    if (!dt) { alert("Please Select Feedback Month"); return; }
    try {
      const d = await postJSON(`${BASE}/feedback-client/?${uq(unit)}`, { feedback_date: dt, f1, f2, f3, f4, f5 });
      alert(d.message);
    } catch (e: any) { alert(e.message); }
  };
  const row2 = (q: string, v: string, set: (s: string) => void) => (
    <div style={{ display: "flex", gap: 12, marginBottom: 10, justifyContent: "flex-end" }}>
      <div style={{ minWidth: 320, textAlign: "right", fontWeight: "bold", fontSize: 12 }}>{q}</div>
      <select style={{ ...inp, width: 180 }} value={v} onChange={(e) => set(e.target.value)}>
        {RATE_OPTS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
      </select>
      <div style={{ width: 120 }}></div>
    </div>
  );
  return (
    <div>
      <div style={{ marginBottom: 12 }}><b>Feedback Date :</b><br /><MonthInput value={dt} onChange={setDt} width={150} /></div>
      {row2("ARE THE EMPLOYEES GROOMED PROPERLY", f1, setF1)}
      {row2("CLEANING AND HYGIENE STANDARDS MAINTAINED AT SITE", f2, setF2)}
      {row2("DO THE EMPLOYEES KNOW THEIR DUTIES", f3, setF3)}
      {row2("BEHAVIOR AND ATTITUDE OF EMPLOYEE", f4, setF4)}
      {row2("SUPPORT FROM TEAM (FO/ADMIN)", f5, setF5)}
      <div style={{ display: "flex", gap: 12, marginBottom: 12, justifyContent: "center" }}>
        <span style={{ fontWeight: "bold", fontSize: 14 }}>Percentage : </span><b>{pct}</b>
      </div>
      <div style={{ textAlign: "center", display: "flex", gap: 8, justifyContent: "center" }}>
        <button type="button" style={btnP} onClick={submit}>Submit</button>
        <button type="button" style={btnD} onClick={() => { setDt(""); setF1("100"); setF2("100"); setF3("100"); setF4("100"); setF5("100"); }}>Close</button>
      </div>
    </div>
  );
}

/* ================= Fire Extinguisher (item15) ================= */
function TabFire({ unit }: { unit: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    if (!unit) return;
    getJSON<{ results: Row[] }>(`${BASE}/fire_extinguisher/?${uq(unit)}`).then((d) => setRows(d.results || [])).catch(() => undefined);
  }, [unit]);
  if (!unit) return <NeedUnit />;
  const cols = ["Sr No.", "Types Of Extiguisher", "Renewal Date", "Expiry date", "Weight In KG", "Vender Name", "Vender Contact Number", "Fire Equipment Report"];
  return (
    <Grid id="fire" cols={cols} rows={rows.map((r, i) => ({ ...r, __i: i + 1 }))} cell={(r, c) =>
      c === "Sr No." ? r.__i : c === "Types Of Extiguisher" ? val(r, "fire_ex_type") : c === "Renewal Date" ? val(r, "renewal_date") : c === "Expiry date" ? val(r, "expiry_date") : c === "Weight In KG" ? val(r, "weight_in_kg") : c === "Vender Name" ? val(r, "vender_name") : c === "Vender Contact Number" ? val(r, "vender_no") : ""}
      img={(r, c) => (c === "Fire Equipment Report" && val(r, "fire_upload") ? media("fire_extinguisher", val(r, "fire_upload")) : null)} />
  );
}
