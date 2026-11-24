"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getJSON } from "@/lib/api/legacy-fetch";
import { listItems } from "@/lib/api/crud";
import ExportButtons from "@/components/ExportButtons";
import { API_BASE_URL } from "@/lib/api/client";

// Old tab_employee_attendance_details.aspx (Tab Employee Attendance Images).
// Client/State/Branch dropdowns + Date -> grooming checklist grid with 50x50
// In/Out thumbnails (click = "Zoomed Image" dialog), Remarks, Date & Time,
// Location Address, CSV/Print export.
const AI = () => "/api/attendance/attendance-images/";
interface Row {
  unit_name: string; emp_name: string; grade_desc: string; shifttime: string;
  punctuality: string; uniforms: string; cap: string; shoes: string; belt: string;
  id_card: string; shaving: string; hairs: string; nails: string; briefing: string;
  intime_img: string; outtime_img: string; remarks: string; location_add: string; currdate: string;
}
interface ClientRow { client_code: string; client_name: string }
interface UnitRow { unit_code: string; unit_name: string; state_name: string }

function imgSrc(v: string, _base: string): string {
  if (!v) return "";
  if (/^(https?:|data:|blob:)/i.test(v)) return v;
  // photos are streamed by the API (session cookie), never from the Next public folder
  const name = v.replace(/\\/g, "/").split("/").pop() || "";
  return `${API_BASE_URL}/api/attendance/attendance-images/photo/?name=${encodeURIComponent(name)}`;
}

export default function AttendanceImagesPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [unit, setUnit] = useState("Select");
  const [date, setDate] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");
  const [base, setBase] = useState("tab_attendance_images/");
  const [zoom, setZoom] = useState<string | null>(null);

  useEffect(() => {
    listItems<ClientRow>("/api/masters/clients", { pageSize: 500 })
      .then((d) => setClients(d.results ?? [])).catch(() => setClients([]));
  }, []);

  const onClient = async (v: string) => {
    setClient(v); setState("Select"); setUnit("Select"); setUnits([]); setStates([]);
    if (!v || v === "Select") return;
    const d = await getJSON<{ units: UnitRow[]; states: string[] }>(
      `/api/masters/units/lookup/?client_code=${encodeURIComponent(v)}`).catch(() => null);
    setUnits(d?.units ?? []); setStates(d?.states ?? []);
  };
  const onState = (v: string) => { setState(v); setUnit("Select"); };
  const stateUnits = units.filter((u) => !state || state === "Select" || u.state_name === state);

  const load = async () => {
    if (!client || client === "Select") { setMsg("Please Select Client"); return; }
    if (!state || state === "Select") { setMsg("Please Select State"); return; }
    if (!unit || unit === "Select") { setMsg("Please Select Branch"); return; }
    if (!date) { setMsg("Please Select Date"); return; }
    setMsg("");
    const d = await getJSON<{ results: Row[]; image_base?: string }>(
      `${AI()}?client_code=${encodeURIComponent(client)}&unit_code=${encodeURIComponent(unit)}&date=${date}`)
      .catch(() => null);
    setRows(d?.results ?? []);
    if (d?.image_base) setBase(d.image_base);
    if ((d?.results ?? []).length === 0) setMsg("No Matching Records Found.");
  };

  const chk = ["punctuality", "uniforms", "cap", "shoes", "belt", "id_card", "shaving", "hairs", "nails", "briefing"] as const;
  const cols = [
    { key: "unit_name", label: "Branch" }, { key: "emp_name", label: "Employee Name" },
    { key: "grade_desc", label: "Grade" }, { key: "shifttime", label: "Shift Time" },
    ...chk.map((c) => ({ key: c, label: c.replace("_", " ").toUpperCase() })),
    { key: "intime_img", label: "InTime Image" }, { key: "outtime_img", label: "OutTime Image" },
    { key: "remarks", label: "Remarks" }, { key: "currdate", label: "Date & Time" },
    { key: "location_add", label: "Location Address" },
  ];

  const thumb = (v: string) => {
    if (!v) return <span style={{ color: "#999" }}>-</span>;
    const src = imgSrc(v, base);
    return (
      <img src={src} alt={v} title="Click to zoom"
        style={{ height: 50, width: 50, objectFit: "cover", cursor: "pointer", border: "1px solid #ccc" }}
        onClick={() => setZoom(src)}
        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
    );
  };

  return (
    <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px", marginBottom: "20px", backgroundColor: "white" }}>

        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "8.33%" }}></div>
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
            Tab Employee Attendance
          </div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); window.open("/html/tab_employee_attendance_details.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }} style={{ color: "#fff", fontSize: "10px" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>
        <div className="panel-body" style={{ padding: "15px" }}>
          <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "25px", marginBottom: "20px", marginTop: "20px" }}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 160px" }}>
                <b>Client Name:</b> <span style={{ color: "red" }}>*</span>
                <select value={client} onChange={(e) => onClient(e.target.value)} className="form-control" style={{ width: "100%", height: 34, border: "1px solid #ccc", borderRadius: 4 }}>
                  <option value="Select">Select</option>
                  {clients.map((c) => (<option key={c.client_code} value={c.client_code}>{c.client_name}</option>))}
                </select>
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <b>State Name:</b> <span style={{ color: "red" }}>*</span>
                <select value={state} onChange={(e) => onState(e.target.value)} className="form-control" style={{ width: "100%", height: 34, border: "1px solid #ccc", borderRadius: 4 }}>
                  <option value="Select">Select</option>
                  {states.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <b>Branch Name:</b> <span style={{ color: "red" }}>*</span>
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className="form-control" style={{ width: "100%", height: 34, border: "1px solid #ccc", borderRadius: 4 }}>
                  <option value="Select">Select</option>
                  {stateUnits.map((u) => (<option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>))}
                </select>
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <b>Date:</b> <span style={{ color: "red" }}>*</span>
                <input className="form-control" type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: "100%", height: 34, border: "1px solid #ccc", borderRadius: 4 }} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn btn-primary lg-btn-primary" onClick={load} style={{ width: "auto", paddingLeft: 24, paddingRight: 24 }}>Show</button>
                <Link href="/Home" className="btn btn-danger lg-btn-danger" style={{ width: "auto", paddingLeft: 24, paddingRight: 24, textDecoration: "none", display: "inline-block", textAlign: "center" }}>Close</Link>
              </div>
            </div>
          </div>

          {msg && <div style={{ color: msg.startsWith("No Matching") ? "#777" : "red", fontWeight: "bold", marginBottom: 12, textAlign: "center" }}>{msg}</div>}

          <div className="dt-btns no-print" style={{ marginBottom: 8 }}>
            <ExportButtons filename="TAB_ATTENDANCE" columns={cols} rows={rows} />
          </div>
          <div style={{ overflowX: "auto", maxHeight: 320, overflowY: "auto" }}>
            <table className="table lg-grid" style={{ width: "100%", background: "#fff", fontSize: "x-small" }}>
              <thead><tr>{cols.map((c) => (<th key={c.key}>{c.label}</th>))}</tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={cols.length} style={{ textAlign: "center", color: "#777", padding: "16px 0" }}>Select client, state, branch and date, then Show</td></tr>}
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.unit_name}</td>
                    <td>{r.emp_name}</td>
                    <td>{r.grade_desc}</td>
                    <td>{r.shifttime}</td>
                    {chk.map((c) => <td key={c} style={{ textAlign: "center" }}>{r[c]}</td>)}
                    <td style={{ textAlign: "center" }}>{thumb(r.intime_img)}</td>
                    <td style={{ textAlign: "center" }}>{thumb(r.outtime_img)}</td>
                    <td>{r.remarks}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{r.currdate}</td>
                    <td>{r.location_add}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {zoom && (
        <div onClick={() => setZoom(null)}
          style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,.6)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", padding: 16, borderRadius: 6, maxWidth: "90%", textAlign: "center" }}>
            <div style={{ fontWeight: "bold", marginBottom: 10 }}>Zoomed Image</div>
            <img src={zoom} alt="Zoomed" style={{ width: 470, height: 400, maxWidth: "100%", objectFit: "contain", border: "1px solid #ccc" }} />
            <div style={{ marginTop: 10 }}>
              <button onClick={() => setZoom(null)} className="btn btn-primary lg-btn-primary" style={{ width: "auto", paddingLeft: 24, paddingRight: 24 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
