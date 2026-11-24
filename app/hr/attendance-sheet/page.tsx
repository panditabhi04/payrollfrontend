"use client";
import React, { useState, useCallback } from "react";
import { getJSON, postJSON, upload } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";
import { loadRoleScope, RoleScope, scopeClient, scopeUnit } from "@/lib/roleScope";
import { useRouter } from "next/navigation";
import "./attendance-sheet.css";
import FeedbackUpdateTab from "@/components/attendance-tabs/FeedbackUpdateTab";
import ShiftwiseTab from "@/components/attendance-tabs/ShiftwiseTab";
import MaterialAmountTab from "@/components/attendance-tabs/MaterialAmountTab";
import MaterialChallanTab from "@/components/attendance-tabs/MaterialChallanTab";
import RmServiceTab from "@/components/attendance-tabs/RmServiceTab";
import AdminExpensesTab from "@/components/attendance-tabs/AdminExpensesTab";
import ConveyanceTab from "@/components/attendance-tabs/ConveyanceTab";
import OtSheetTab from "@/components/attendance-tabs/OtSheetTab";

// DRF error bodies come as ["msg"], {"detail":"msg"} or {"field":["msg"]}: show the message text only.
const apiMsg = (b: any, fb: string): string => {
  const pick = (v: any): string | null => {
    if (v == null) return null;
    if (typeof v === "string") return v;
    if (Array.isArray(v)) return v.length ? pick(v[0]) : null;
    if (typeof v === "object") { if (v.detail) return pick(v.detail); for (const k of Object.keys(v)) { const m = pick(v[k]); if (m) return m; } }
    return null;
  };
  return pick(b) || fb;
};

const AS = () => "/api/attendance/muster-sheet/";

interface Row {
  emp_code: string; 
  emp_name: string; 
  designation?: string;
  type?: string;
  left_date?: string;
  left_reason?: string;
}
interface ClientItem { client_code: string; client_name: string; }
interface StateItem { state_name: string; }
interface UnitItem { unit_code: string; unit_name: string; client_code: string; state_name: string; }

// Legacy emp_sample.aspx Month/Year textbox (CssClass "date-picker", mm/yy, readonly,
// yearRange "1990:+0"): month+year only, 1990..current year, future never selectable.
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"];
const MIN_MY_YEAR = 1990;

function MonthYearPicker({ month, year, onChange }: {
  month: string; year: string; onChange: (m: string, y: string) => void;
}) {
  const now = new Date();
  const curY = now.getFullYear(), curM = now.getMonth() + 1;
  const [open, setOpen] = React.useState(false);
  const [viewYear, setViewYear] = React.useState(curY);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open ]);

  const openPicker = () => {
    setViewYear(year ? parseInt(year, 10) : curY);
    setOpen(o => !o);
  };
  const pick = (m: number) => {
    onChange(m.toString(), viewYear.toString());
    setOpen(false);
  };
  const display = month && year ? `${month.padStart(2, "0")}/${year}` : "";
  return (
    <div ref={wrapRef} style={{ position: "relative", width: "100%" }}>
      <input
        className="form-control"
        readOnly
        value={display}
        placeholder="mm/yyyy"
        onClick={openPicker}
        style={{ width: "100%", height: "34px", borderRadius: "4px", border: "1px solid #ccc", cursor: "pointer", background: "#fff" }}
      />
      {open && (
        <div style={{ position: "absolute", top: "38px", left: 0, zIndex: 50, background: "#fff", border: "1px solid #428bca", borderRadius: "6px", boxShadow: "0 4px 14px rgba(0,0,0,0.25)", padding: "10px", width: "230px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <button type="button" className="btn btn-default" disabled={viewYear <= MIN_MY_YEAR}
              onClick={() => setViewYear(y => Math.max(MIN_MY_YEAR, y - 1))}
              style={{ border: "1px solid #ccc", background: viewYear <= MIN_MY_YEAR ? "#eee" : "#fff", borderRadius: "4px", padding: "2px 10px", cursor: "pointer" }}>‹</button>
            <b style={{ color: "#006699" }}>{viewYear}</b>
            <button type="button" className="btn btn-default" disabled={viewYear >= curY}
              onClick={() => setViewYear(y => Math.min(curY, y + 1))}
              style={{ border: "1px solid #ccc", background: viewYear >= curY ? "#eee" : "#fff", borderRadius: "4px", padding: "2px 10px", cursor: "pointer" }}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "4px" }}>
            {MONTH_NAMES.map((n, i) => {
              const mNo = i + 1;
              const disabled = viewYear === curY && mNo > curM;
              const selected = month === mNo.toString() && year === viewYear.toString();
              return (
                <button
                  key={n}
                  type="button"
                  disabled={disabled}
                  onClick={() => pick(mNo)}
                  style={{
                    border: "1px solid " + (selected ? "#428bca" : "#ddd"),
                    background: disabled ? "#f0f0f0" : selected ? "#428bca" : "#fff",
                    color: disabled ? "#aaa" : selected ? "#fff" : "#333",
                    borderRadius: "4px", padding: "6px 0", fontSize: "12px", fontWeight: selected ? 700 : 400,
                    cursor: disabled ? "not-allowed" : "pointer",
                  }}
                >
                  {n.slice(0, 3)}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
            <button type="button" className="btn btn-default"
              onClick={() => { onChange(curM.toString(), curY.toString()); setViewYear(curY); setOpen(false); }}
              style={{ flex: 1, border: "1px solid #5cb85c", background: "#eaffea", borderRadius: "4px", padding: "4px 0", fontSize: "12px", cursor: "pointer" }}>Current Month</button>
            <button type="button" className="btn btn-default"
              onClick={() => { onChange("", ""); setOpen(false); }}
              style={{ flex: 1, border: "1px solid #ccc", background: "#fff", borderRadius: "4px", padding: "4px 0", fontSize: "12px", cursor: "pointer" }}>Clear</button>
          </div>
        </div>
      )}
    </div>
  );
}

// Branch dropdown with a search box (type to filter; the list is long).
function SearchSelect({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);
  const cur = options.find(o => o.value === value);
  const shown = options.filter(o => o.label.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <div className="form-control" onClick={() => { setOpen(o => !o); setQ(""); }} style={{ width: "100%", height: "34px", borderRadius: "4px", border: "1px solid #ccc", cursor: "pointer", overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", background: "#fff" }}>
        {cur ? cur.label : "Select"}
      </div>
      {open && (
        <div style={{ position: "absolute", zIndex: 50, left: 0, right: 0, background: "#fff", border: "1px solid #ccc", borderRadius: "4px", boxShadow: "0 4px 10px rgba(0,0,0,.15)" }}>
          <input autoFocus className="form-control" placeholder="Search..." value={q} onChange={e => setQ(e.target.value)} style={{ width: "100%", height: "32px", border: "0", borderBottom: "1px solid #ccc", borderRadius: 0 }} />
          <div style={{ maxHeight: "260px", overflowY: "auto" }}>
            {shown.length === 0 && <div style={{ padding: "6px 10px", color: "#888" }}>No match</div>}
            {shown.map(o => (
              <div key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
                style={{ padding: "6px 10px", cursor: "pointer", background: o.value === value ? "#e6f0fa" : "#fff" }}
                onMouseEnter={e => (e.currentTarget.style.background = "#f0f0f0")} onMouseLeave={e => (e.currentTarget.style.background = o.value === value ? "#e6f0fa" : "#fff")}>
                {o.label}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AttendanceSheetPage() {
  const router = useRouter();
  const [client, setClient] = useState("");
  const [state, setState] = useState("");
  const [unit, setUnit] = useState("");
  const [month, setMonth] = useState(""); 
  const [year, setYear] = useState("");
  const [activeTab, setActiveTab] = useState("Employee Attendance");

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [states, setStates] = useState<StateItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);

  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");
  const [selectedEmps, setSelectedEmps] = useState<Set<string>>(new Set());
  const [submitBusy, setSubmitBusy] = useState(false);
  const [processBusy, setProcessBusy] = useState(false);
  const [scope, setScope] = useState<RoleScope | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  // Legacy emp_sample.aspx lock: once the timesheet is approved, no more changes.
  const [locked, setLocked] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState("");
  const [approvalBy, setApprovalBy] = useState("");   // admin who approved (legacy approve_by)
  const LOCK_MSG = "Timesheet already approved, You cannot make changes !!";
  // inline attendance marking grid (shown on Submit)
  interface AttMarkRow { emp_code: string; emp_name: string; designation?: string; type?: string; left_date?: string; days: Record<string, string>; }
  // Legacy update_joining_left_date parity: left-date ke baad ke din Absent.
  // left_date "YYYY-MM-DD" (form input) ya "DD/MM/YYYY" (master se) ho sakti hai.
  const leftDayInMonth = (leftDate: string | undefined): number | null => {
    if (!leftDate || !month || !year) return null;
    const m = parseInt(month, 10), y = parseInt(year, 10);
    let d: number | null = null;
    const iso = leftDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
    const ind = leftDate.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (iso && parseInt(iso[1], 10) === y && parseInt(iso[2], 10) === m) d = parseInt(iso[3], 10);
    else if (ind && parseInt(ind[3], 10) === y && parseInt(ind[2], 10) === m) d = parseInt(ind[1], 10);
    return d;
  };
  const isAfterLeft = (r: AttMarkRow, idx1Based: number) => {
    const ld = leftDayInMonth(r.left_date);
    return ld != null && idx1Based > ld;
  };
  const [attRows, setAttRows] = useState<AttMarkRow[]>([]);
  const [attCols, setAttCols] = useState<string[]>([]);
  // STRENGTH row (read-only on this screen): the strength of every day - the saved one (loaded with a sheet), else the branch
  // seat of that day (seatByDay, from Client Master). Attendance of a day may not exceed it.
  const [strength, setStrength] = useState<Record<string, string>>({});
  const [seatByDay, setSeatByDay] = useState<Record<string, number>>({});
  const [showAttMark, setShowAttMark] = useState(false);
  const [attFile, setAttFile] = useState<File | null>(null);
  const [attAttachUrl, setAttAttachUrl] = useState("");
  // per-client feedback grid shown with the attachment upload (legacy grd_feedback, feedback_flag = 1)
  interface FbRow { feedback: string; good: boolean; satisfactory: boolean; need_improvement: boolean; remark: string; }
  const [fbRows, setFbRows] = useState<FbRow[]>([]);
  const [hasSaved, setHasSaved] = useState(false);
  // Legacy emp_sample.aspx day-dropdown options (Set/P/A/HD/CL/PH/ML/PL/W/H) + fill_cell() colors.
  const ATT_CODES = ["", "P", "A", "HD", "CL", "PH", "ML", "PL", "W", "H"];
  const ATT_COLORS: Record<string, string> = {
    P: "#32CD32",   // LimeGreen (Present)
    A: "#FF0000",   // Red (Absent)
    HD: "#FFA500",  // Orange (Half Day)
    L: "#FFFF00",   // Yellow (Leave)
    W: "#EE82EE",   // Violet (Weekly Off)
    H: "#FFC0CB",   // Pink (Holiday)
    CL: "#FFFF00",  // Yellow (Casual Leave)
    PL: "#9ACD32",  // YellowGreen (Privilege Leave)
    ML: "#F5DEB3",  // Wheat (Medical Leave)
    PH: "#00FFFF",  // Aqua (Present on Holiday)
    CO: "#CD853F",  // Peru (Comp Off)
    WO: "#EE82EE", HO: "#FFC0CB",  // aliases for any older modern data
  };

  // --- Add OT Hrs tab ---
  interface OtRow {
    emp_code: string; emp_name: string; designation?: string; type?: string;
    present: number; ot_days: Record<string, string>; ot_hours: number | string; tot_ot: number;
  }
  const [otRows, setOtRows] = useState<OtRow[]>([]);
  const [otCols, setOtCols] = useState<string[]>([]);
  const [otMsg, setOtMsg] = useState("");
  const [otBusy, setOtBusy] = useState(false);

  // --- Conveyance tab ---
  interface ConvEmp { emp_code: string; emp_name: string; type?: string; }
  interface ConvRow { id: number; emp_code: string; emp_name: string; amount: number; status: string; bill_url: string; }
  const [convEmps, setConvEmps] = useState<ConvEmp[]>([]);
  const [convRows, setConvRows] = useState<ConvRow[]>([]);
  const [convEmp, setConvEmp] = useState("");
  const [convAmount, setConvAmount] = useState("");
  const [convFile, setConvFile] = useState<File | null>(null);
  const [convMsg, setConvMsg] = useState("");
  const [convBusy, setConvBusy] = useState(false);

  const tabs = [
    "Employee Attendance", "Add OT Hrs", "Conveyance", "Material Amount", 
    "R&M Service", "Administrative Expenses", "Material Challan Uploading", 
    "Shiftwise Attendance", "Feedback Update"
  ];

  React.useEffect(() => {
    let alive = true;
    const loadClients = () => {
      // legacy client_code(): only clients assigned to the user's reporting series (Client Assign)
      loadRoleScope().then(sc => {
        if (!alive) return;
        setScope(sc);
        getJSON<{results: ClientItem[]}>(`/api/masters/clients/?page_size=all`).then(d => {
          if (!alive) return;
          setClients((d?.results || []).filter(c => scopeClient(sc, c.client_code)));
        });
      });
    };
    loadClients();
    // A client assigned in another tab (Client Assign) must appear here without
    // a full reload — refresh whenever the page becomes visible again.
    const refresh = () => { if (!document.hidden) loadClients(); };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    getJSON<{states: string[]}>(`/api/masters/states/lookup/`).then(d =>
      setStates((d?.states ?? []).map((s) => ({ state_name: s }))));
    return () => { alive = false; document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); };
  }, []);

  React.useEffect(() => {
    if (!client || client === "Select") { setUnits([]); return; }
    getJSON<{units: UnitItem[]}>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(client)}`).then(d =>
      setUnits(d?.units ?? []));
  }, [client]);

  // --- 1:1 legacy emp_sample.aspx validations ---
  // Req_validation(): Client -> State -> Branch -> Month/Year.
  // ot_validation(): Month/Year -> Client -> State -> Branch.
  // conv_req_validation(): Month -> Client -> State -> Branch.
  // Plus: future Month/Year is never allowed (legacy picker yearRange "1990:+0").
  const selClientName = clients.find(c => c.client_code === client)?.client_name || "";
  const isFutureMY = () => {
    if (!month || !year) return false;
    const now = new Date();
    return (parseInt(year, 10) * 12 + parseInt(month, 10)) > (now.getFullYear() * 12 + (now.getMonth() + 1));
  };
  const checkMonthYear = (emptyMsg: string): boolean => {
    if (!month || !year) { alert(emptyMsg); return false; }
    if (isFutureMY()) { alert("Future Month/Year not allowed"); return false; }
    return true;
  };
  const checkClientStateBranch = (branchAllMsg: string, branchSelectMsg: string): boolean => {
    if (!client || client === "Select") { alert("Please Select Client"); return false; }
    if (!state || state === "Select") { alert("Please Select State"); return false; }
    if (!unit || unit === "Select") { alert(branchSelectMsg); return false; }
    // Legacy Req_validation: only BAJAJ ALLIANZ may process "ALL" branches together.
    if (unit === "ALL" && selClientName !== "BAJAJ ALLIANZ GENERAL INSURANCE CO. LTD") {
      alert(branchAllMsg); return false;
    }
    return true;
  };
  // Day columns after today when the selected month IS the current month —
  // future dates can never be filled (legacy: no future date entry).
  const isCurrentMY = (() => {
    if (!month || !year) return false;
    const now = new Date();
    return parseInt(year, 10) === now.getFullYear() && parseInt(month, 10) === (now.getMonth() + 1);
  })();
  const isFutureDay = (idx1Based: number) => {
    if (!isCurrentMY) return false;
    return idx1Based > new Date().getDate();
  };

  const load = useCallback(async () => {
    if (processBusy) return; // double-click guard: ek Process chalte hue dobara na chale
    if (!client || client === "Select") {
      alert("Please Select Client");
      return;
    }
    if (!state || state === "Select") {
      alert("Please Select State");
      return;
    }
    if (!unit || unit === "Select") {
      alert("Please Select Branch");
      return;
    }
    if (unit === "ALL" && selClientName !== "BAJAJ ALLIANZ GENERAL INSURANCE CO. LTD") {
      alert("Please Select Branch Name");
      return;
    }
    if (!month || !year) {
      alert("Please Select Month/Year");
      return;
    }
    if (isFutureMY()) {
      alert("Future Month/Year not allowed");
      return;
    }
    setProcessBusy(true);
    setMsg("");
    try {
    // process=1 -> server-side Process gates (branch policy / month-end), legacy messages
    const pr = await fetch(
      `${API_BASE_URL}${AS()}?unit_code=${encodeURIComponent(unit)}&month=${month}&year=${year}`
      + `&client_code=${encodeURIComponent(client)}&state_name=${encodeURIComponent(state)}&process=1`,
      { credentials: "include" });
    if (!pr.ok) {
      const eb = await pr.json().catch(() => ({}));
      alert(apiMsg(eb, "Process failed."));
      return;
    }
    const d = (await pr.json()) as { results: Row[]; approved?: boolean; approval_status?: string; approved_by?: string; alert?: string };
    const list = d?.results ?? [];
    // emp_btn_process_Click: no employee for the branch/month
    if (d?.alert) alert(d.alert);
    setRows(list);
    // Legacy gv_fullmonthot_RowDataBound: already-muster rows pre-checked hote the.
    // Isliye Process ke baad sab tick karke rakho taaki single Submit par sheet khule.
    setSelectedEmps(new Set(list.map(r => r.emp_code)));
    setShowAttMark(false); setAttRows([]); setAttCols([]); setStrength({}); setSeatByDay({});
    // Legacy: if already approved, lock the sheet and warn (no re-processing/editing).
    if (d?.approved) {
      setLocked(true);
      setApprovalStatus(d.approval_status || "Approved");
      setApprovalBy(d.approved_by || "");
      alert(LOCK_MSG + (d.approved_by ? `\nApproved By : ${d.approved_by}` : ""));
    } else {
      setLocked(false);
      setApprovalStatus("");
        setApprovalBy("");
      }
    } finally { setProcessBusy(false); }
  }, [unit, month, year, client, state, clients, processBusy]);

  // Employee Attendance: select employees + Submit (initialise their muster for the month).
  const toggleEmp = (code: string) => {
    setSelectedEmps(prev => { const n = new Set(prev); if (n.has(code)) n.delete(code); else n.add(code); return n; });
  };
  const toggleAllEmps = () => {
    setSelectedEmps(prev => prev.size === rows.length ? new Set() : new Set(rows.map(r => r.emp_code)));
  };
  const setRowField = (code: string, field: "left_date" | "left_reason", val: string) => {
    setRows(prev => prev.map(r => r.emp_code === code ? { ...r, [field]: val } : r));
  };
  // Submit = legacy emp_sample.aspx btn_process (Text="Submit") parity.
  // Legacy me Submit par Req_validation DOBARA nahi lagta tha (wo Process par lagta hai);
  // Submit par sirf: checked employees + UNCHECKED employees ke liye Left Date mandatory
  // (gridcalender_update -> "Please add Left Date for Unchecked Employees !!!"),
  // phir attendance grid khulta tha aur Submit button hide ho jata tha (Panel10.Visible=false).
  // Isliye yahan Client/State/Branch/Month repeat nahi hoga — sirf selection/left-date check.
  // Single click par sheet khulegi; double-click guard + ek baar khulne ke baad dobara nahi khulegi.
  const submitAttendance = async () => {
    if (submitBusy) return; // double-click guard: ek Submit chalte hue dobara na chale
    if (locked) { alert(LOCK_MSG); return; }
    if (rows.length === 0) { alert("No employees — click Process first."); return; }
    if (showAttMark && attRows.length > 0) { alert("Attendance already opened below — use Save / Back to employee list."); return; }
    // Kam se kam 1 employee tick hona chahiye (legacy commented check).
    if (selectedEmps.size === 0) { alert("Please Select Atleast One Employee."); return; }
    // Legacy gridcalender_update(counter=1): jo UNCHECKED hai uska Left Date mandatory
    // (BJH client exception ke sath). Bina Left Date ke Submit block hota tha.
    const isBJH = client === "BJH";
    if (!isBJH) {
      const missing = rows.filter(r => !selectedEmps.has(r.emp_code) && !(r.left_date || "").trim());
      if (missing.length > 0) { alert("Please add Left Date for Unchecked Employees !!!"); return; }
    }
    setSubmitBusy(true);
    try {
      const sel = selectedEmps;
      // Legacy gridcalender_update parity: bhari hui Left Date/Reason master me
      // save hoti hai (Submit par). Pehle ye save karo, phir grid kholo.
      const leftRows = rows
        .filter(r => (r.left_date || "").trim())
        .map(r => ({ emp_code: r.emp_code, left_date: r.left_date, left_reason: r.left_reason || "" }));
      if (leftRows.length > 0) {
        const lr = await postJSON("/api/attendance/bulk-attendance/left-update/", { rows: leftRows });
        if (!lr.ok) {
          const b = await lr.json().catch(() => ({}));
          alert(apiMsg(b, "Left details save failed."));
          return;
        }
      }
      const d = await getJSON<{ results: AttMarkRow[]; day_columns: string[]; strength?: Record<string, number>; seat_by_day?: Record<string, number> }>(
        `${AS()}?unit_code=${encodeURIComponent(unit)}&month=${month}&year=${year}`);
      const cols = d?.day_columns ?? [];
      // STRENGTH row: what was saved for the month, otherwise the seat of each day (change the days that differ)
      setSeatByDay(d?.seat_by_day ?? {});
      setStrength(Object.fromEntries(cols.map(c => {
        const v = d?.strength?.[c] ?? d?.seat_by_day?.[c];
        return [c, v == null ? "" : String(v)];
      })));
      // Future dates of the running month can never be filled — like the legacy
      // sheet, only up to today defaults to Present (P); future days stay blank.
      const nowD = new Date();
      const curMY = parseInt(year, 10) === nowD.getFullYear() && parseInt(month, 10) === (nowD.getMonth() + 1);
      const todayD = nowD.getDate();
      const leftByEmp: Record<string, string> = Object.fromEntries(rows.map(r => [r.emp_code, r.left_date || ""]));
      const ldDayOf = (ld: string): number | null => {
        if (!ld || !month || !year) return null;
        const iso = ld.match(/^(\d{4})-(\d{2})-(\d{2})/);
        const ind = ld.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (iso && +iso[1] === +year && +iso[2] === +month) return +iso[3];
        if (ind && +ind[3] === +year && +ind[2] === +month) return +ind[1];
        return null;
      };
      let rs: AttMarkRow[] = (d?.results ?? []).map(r => {
        // By default every blank day is Present (P) — saved muster values are kept as-is.
        // Legacy parity (update_joining_left_date): left-date ke baad ke din Absent.
        const days: Record<string, string> = { ...(r.days || {}) };
        const ldDay = ldDayOf(leftByEmp[r.emp_code] || "");
        cols.forEach((c, i) => {
          // Force Absent (A) for all days after Left Date — even if P was previously saved
          if (ldDay != null && (i + 1) > ldDay) days[c] = "A";
          else if (!days[c]) {
            // Sundays default to A (Absent), not W; gazetted holidays (26 Jan, 1 May, 15 Aug,
            // 2 Oct) are seeded PH when the day would otherwise be P; everything else defaults P.
            const dow = new Date(parseInt(year, 10), parseInt(month, 10) - 1, i + 1).getDay();
            const mm = parseInt(month, 10), dd = i + 1;
            const isPH = (mm === 1 && dd === 26) || (mm === 5 && dd === 1) || (mm === 8 && dd === 15) || (mm === 10 && dd === 2);
            if (dow === 0) days[c] = "A";
            else days[c] = (curMY && dd > todayD) ? "" : (isPH ? "PH" : "P");
          }
        });
        return {
          emp_code: r.emp_code, emp_name: r.emp_name, designation: r.designation, type: r.type,
          left_date: leftByEmp[r.emp_code] || "",
          days,
        };
      });
      if (sel.size > 0) rs = rs.filter(r => sel.has(r.emp_code));
      // NOTE: yahan koi "Minimum 2 employees / Reliever" rule nahi hai —
      // legacy btn_process me aisa koi check nahi tha, isliye 1 employee par bhi sheet khulegi.
      if (rs.length === 0) { alert("Please Select Atleast One Employee."); return; }
      setAttRows(rs);
      setAttCols(d?.day_columns ?? []);
      setShowAttMark(true);
      setMsg("");
      setHasSaved(false);
      loadAttachment();
    } finally { setSubmitBusy(false); }
  };

  const setAttDay = (emp: string, col: string, val: string) => {
    setAttRows(prev => prev.map(r => r.emp_code === emp ? { ...r, days: { ...r.days, [col]: val } } : r));
    setHasSaved(false);
  };
  const saveAtt = async () => {
    if (locked) { alert(LOCK_MSG); return; }
    if (attRows.length === 0) { alert("Nothing to save."); return; }
    // Legacy: Reliever max 25 Present + Reliever not counted — Regular 16 days => Reliever 15 days (month - regular)
    const relOver = attRows.filter(r => (r.type || "").trim().toLowerCase() === "reliever" && attSummary(r).present > 25).map(r => r.emp_name);
    if (relOver.length) { alert(` Releiver (${relOver.join(", ")}) have attendance more than 25 days, Please make them Permanent !!!`); return; }
    const monthDays = attCols.length;
    const totalAbsentRegular = attRows.filter(r => (r.type || "").trim().toLowerCase() !== "reliever").reduce((s, r) => s + (monthDays - attSummary(r).present), 0);
    const totalPresentReliever = attRows.filter(r => (r.type || "").trim().toLowerCase() === "reliever").reduce((s, r) => s + attSummary(r).present, 0);
    if (totalPresentReliever - totalAbsentRegular > 1e-9) { alert(`Reliever attendance is too high. Permanent absent: ${totalAbsentRegular}, Reliever present: ${totalPresentReliever}. Please reduce by ${totalPresentReliever - totalAbsentRegular}.`); return; }
    setSubmitBusy(true);
    try {
      const payloadRows = attRows.map(r => ({
        emp_code: r.emp_code,
        days: Object.fromEntries(attCols.map(c => [c.toLowerCase(), r.days[c] || ""])),
      }));
      const strengthRow = Object.fromEntries(attCols.map(c => [c.toLowerCase(), strength[c] ?? ""]));
      const resp = await postJSON("/api/attendance/bulk-attendance/upload/", { month, year, unit_code: unit, rows: payloadRows, strength: strengthRow });
      const b = await resp.json().catch(() => ({}));
      if (resp.ok) { alert(b.status || "Attendance Saved Successfully !!!"); setMsg("Attendance saved."); setHasSaved(true); }
      else if (resp.status === 403) alert("You do not have permission for this action.");
      else alert(apiMsg(b, "Save failed..."));
    } finally { setSubmitBusy(false); }
  };

  // live summary per employee (Present / Absent / Leaves / Weekly-Off / Holidays / Days)
  const attSummary = (r: AttMarkRow) => {
    const vals = attCols.map(c => (r.days[c] || "").toUpperCase());
    const n = (...codes: string[]) => vals.filter(v => codes.includes(v)).length;
    return {
      present: n("P") + n("PH") + 0.5 * n("HD"),
      absent: n("A") + 0.5 * n("HD"),
      leaves: n("L", "CL", "PL", "ML"), wo: n("W", "WO"), ho: n("H", "HO"), days: attCols.length,
    };
  };

  // attachment (signed attendance sheet) + Approve + Download Report
  const loadAttachment = useCallback(async () => {
    if (!unit || unit === "Select" || !month || !year) { setAttAttachUrl(""); return; }
    const d = await getJSON<{ file_url: string }>(`/api/attendance/attendance-attachment/?unit_code=${encodeURIComponent(unit)}&month=${month}&year=${year}`);
    setAttAttachUrl(d?.file_url || "");
    // gv_feedback(): feedback heads (or rejected answers) of the branch when the client has feedback applicable
    const fb = await getJSON<{ applicable: boolean; rows: FbRow[] }>(
      `/api/attendance/attendance-feedback/?client_code=${encodeURIComponent(client)}&state_name=${encodeURIComponent(state)}&unit_code=${encodeURIComponent(unit)}&month=${month}&year=${year}`);
    setFbRows(fb?.applicable ? (fb.rows ?? []) : []);
  }, [unit, month, year, client, state]);
  const setFb = (i: number, k: "good" | "satisfactory" | "need_improvement", v: boolean) =>
    setFbRows(rs => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const setFbAll = (k: "good" | "satisfactory" | "need_improvement", v: boolean) =>
    setFbRows(rs => rs.map(r => ({ ...r, [k]: v })));
  const uploadAttachment = async () => {
    if (!attFile) { alert("Please select a file to upload."); return; }
    setSubmitBusy(true);
    try {
      const fd = new FormData();
      fd.append("unit_code", unit); fd.append("client_code", client); fd.append("state_name", state);
      fd.append("month", month); fd.append("year", year); fd.append("file", attFile);
      if (fbRows.length > 0) fd.append("feedback", JSON.stringify(fbRows));
      const r = await upload("/api/attendance/attendance-attachment/upload/", fd);
      const b = await r.json().catch(() => ({}));
      if (r.ok) { alert(b.status || "Attendance attachment uploaded successfully !!!"); setAttFile(null); loadAttachment(); }
      else alert(apiMsg(b, "Upload failed..."));
    } finally { setSubmitBusy(false); }
  };
  const approveAtt = async () => {
    if (locked) { alert("Attendance Already Approved !!"); return; }
    if (!hasSaved && attRows.length > 0) { alert("Please save attendance before approving."); return; }
    if (attRows.length === 0 && rows.length === 0) { alert("Please save attendance before approving."); return; }
    if (!confirm("Approve attendance for this branch/month?")) return;
    setSubmitBusy(true);
    try {
      const r = await postJSON("/api/attendance/attendance-attachment/approve/", { month, year, unit_code: unit, client_code: client, state_name: state });
      const b = await r.json().catch(() => ({}));
      if (r.ok) {
        alert((b.status || "Attendance Approved Successfully !!!") + (b.approved_by ? `\nApproved By : ${b.approved_by}` : ""));
        // Legacy: lock immediately after approval — no re-save/re-approve for this month.
        // No auto-redirect to approval page — stay on sheet so user can verify lock.
        setLocked(true);
        setApprovalStatus(b.approval_status || "Approve By Admin");
        setApprovalBy(b.approved_by || "");
      }
      else alert(apiMsg(b, "Approve failed..."));
    } finally { setSubmitBusy(false); }
  };
  const downloadReport = async () => {
    if (reportBusy) return; // double-click guard: baar-baar dabane par report dobara na khule/download ho
    // Legacy req_validation parity (Attendance / Reports button): Client -> State -> Branch -> Month/Year.
    if (!client || client === "Select") { alert("Please Select Client"); return; }
    if (!state || state === "Select") { alert("Please Select State"); return; }
    if (!unit || unit === "Select") { alert("Please Select Branch"); return; }
    if (unit === "ALL" && selClientName !== "BAJAJ ALLIANZ GENERAL INSURANCE CO. LTD") {
      alert("Please Select Branch Name"); return;
    }
    if (!month || !year) { alert("Please Select Month/Year"); return; }
    if (isFutureMY()) { alert("Future Month/Year not allowed"); return; }
    setReportBusy(true);
    try {
    const r = await fetch(`${API_BASE_URL}/api/attendance/muster-sheet/?unit_code=${encodeURIComponent(unit)}&month=${month}&year=${year}&export=xls`, { credentials: "include" });
    if (!r.ok) { alert("Download failed."); return; }
    const blob = await r.blob();
    const unitName = (units.find(u => u.unit_code === unit)?.unit_name || unit).replace(/\s+/g, "_");
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `Attendance_Copy_${unitName}.xls`;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    } finally { setReportBusy(false); }
  };
  // Legacy emp_sample.aspx top-row buttons: "Attendance" (attendance sheet report) and
  // "Reports" (branch approval status) — dono Step-1 par Process ke paas hi hote the.
  const openAttendanceReport = async () => { await downloadReport(); };
  const openStatusReports = async () => {
    // Legacy btn_reports_Click -> attendance_status(): approval status dikhata tha.
    // Modern me status lock banner me dikhta hai; report file wahi attendance sheet hai.
    if (locked) {
      alert(`Attendance Status: ${approvalStatus || "Approved"}${approvalBy ? `\nApproved By : ${approvalBy}` : ""}`);
      return;
    }
    await downloadReport();
  };

  // Close: clear the selections + loaded sheet (legacy Close resets the form).
    const close = useCallback(() => {
    setClient("Select"); setState("Select"); setUnit("Select");
    setMonth(""); setYear("");
    setRows([]); setMsg("Form cleared."); setSelectedEmps(new Set());
    setLocked(false); setApprovalStatus(""); setApprovalBy("");
    setShowAttMark(false); setAttRows([]); setAttCols([]); setAttFile(null); setAttAttachUrl(""); setHasSaved(false);
    setOtRows([]); setOtCols([]); setOtMsg("");
    setConvEmps([]); setConvRows([]); setConvEmp(""); setConvAmount(""); setConvFile(null); setConvMsg("");
  }, []);

  // --- Conveyance: load (Process) + upload bill ---
  // Legacy conv_req_validation() order: Month -> Client -> State -> Branch.
  const loadConv = useCallback(async () => {
    if (!checkMonthYear("Please Select Month")) return;
    if (!checkClientStateBranch("Please Select Branch Name", "Please Select Branch Name")) return;
    setConvMsg("");
    const d = await getJSON<{ employees: ConvEmp[]; results: ConvRow[] }>(
      `/api/attendance/conveyance-bill/?unit_code=${encodeURIComponent(unit)}&month=${month}&year=${year}`);
    setConvEmps(d?.employees ?? []);
    setConvRows(d?.results ?? []);
    if ((d?.employees ?? []).length === 0) setConvMsg("No Data Found");
  }, [unit, month, year, client, state]);

  const uploadConv = async () => {
    if (!convEmp) { alert("Please select Employee."); return; }
    if (!convFile) { alert("Please Upload Employee Conveyance"); return; }
    setConvBusy(true);
    try {
      const fd = new FormData();
      fd.append("emp_code", convEmp);
      fd.append("unit_code", unit);
      fd.append("client_code", client);
      fd.append("state_name", state);
      fd.append("month", month);
      fd.append("year", year);
      fd.append("amount", convAmount || "0");
      fd.append("bill_file", convFile);
      const r = await upload("/api/attendance/conveyance-bill/upload/", fd);
      const b = await r.json().catch(() => ({}));
      if (r.ok) { alert(b.status || "Conveyance Files uploaded Successfully... !!!"); setConvFile(null); setConvAmount(""); setConvEmp(""); loadConv(); }
      else if (r.status === 403) alert("You do not have permission for this action.");
      else alert(apiMsg(b, "Upload failed..."));
    } finally { setConvBusy(false); }
  };

  // --- Add OT Hrs: Process (load) + edit + Save ---
  // Legacy ot_validation() order: Month/Year -> Client -> State -> Branch.
  const loadOt = useCallback(async () => {
    if (!checkMonthYear("Please Select Month/Year")) return;
    if (!checkClientStateBranch("Please Select Branch", "Please Select Branch")) return;
    setOtMsg("");
    const otr = await fetch(
      `${API_BASE_URL}/api/attendance/ot-muster/?unit_code=${encodeURIComponent(unit)}&month=${month}&year=${year}`,
      { credentials: "include" });
    if (!otr.ok) {
      const eb = await otr.json().catch(() => ({}));
      setOtRows([]); setOtCols([]);
      alert(apiMsg(eb, "Could not load OT data."));
      return;
    }
    const d = (await otr.json()) as { results: OtRow[]; ot_day_columns: string[] };
    setOtRows(d?.results ?? []);
    setOtCols(d?.ot_day_columns ?? []);
    if ((d?.results ?? []).length === 0) setOtMsg("No Data Found");
  }, [unit, month, year, client, state]);

  const setOtDay = (emp: string, col: string, val: string) => {
    const v = val.replace(/[^0-9.]/g, "");
    setOtRows(prev => prev.map(r => r.emp_code === emp ? { ...r, ot_days: { ...r.ot_days, [col]: v } } : r));
  };
  const setOtHours = (emp: string, val: string) => {
    const v = val.replace(/[^0-9.]/g, "");
    setOtRows(prev => prev.map(r => r.emp_code === emp ? { ...r, ot_hours: v } : r));
  };
  const otTotal = (r: OtRow) => otCols.reduce((s, c) => s + (parseFloat(r.ot_days[c] || "0") || 0), 0);

  const saveOt = async () => {
    if (!unit || unit === "Select" || !month || !year) { alert("Please Process first (select Month / Client / State / Branch)."); return; }
    if (otRows.length === 0) { alert("No rows to save."); return; }
    setOtBusy(true);
    try {
      const r = await postJSON("/api/attendance/ot-muster/save/", {
        month, year, unit_code: unit,
        rows: otRows.map(x => ({ emp_code: x.emp_code, ot_days: x.ot_days, ot_hours: x.ot_hours || 0 })),
      });
      const b = await r.json().catch(() => ({}));
      if (r.ok) { alert(b.status || "OT Saved Successfully !!!"); loadOt(); }
      else if (r.status === 403) alert("You do not have permission for this action.");
      else alert(apiMsg(b, "OT save failed..."));
    } finally { setOtBusy(false); }
  };

  // legacy ddl_client/ddl_state cascades: states and branches limited to the user's role-grade scope
  const filteredStates = client && client !== "Select"
    ? Array.from(new Set(units.filter(u => scopeUnit(scope, client, u.unit_code)).map(u => u.state_name).filter(Boolean)))
        .map(s => ({ state_name: s }))
    : [];

  const filteredUnits = units.filter(u =>
    scopeUnit(scope, client, u.unit_code) && (!state || state === "Select" || u.state_name === state)
  );

  return (
    <section style={{ padding: "15px", fontFamily: "sans-serif" }}>
      {/* Button press/hover feedback (dangerouslySetInnerHTML so React never escapes the CSS). */}
      <style dangerouslySetInnerHTML={{ __html:
        ".btn{cursor:pointer;transition:filter .1s,transform .05s}"
        + ".btn:hover{filter:brightness(0.93)}"
        + ".btn:active{transform:translateY(1px);filter:brightness(0.82)}" }} />
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px", backgroundColor: "#fff" }}>
        
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "8.33%" }}></div>
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
            EMPLOYEE ATTENDANCE
          </div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <a href="#" onClick={(e) => { e.preventDefault(); window.open("/html/emp_sample.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }} style={{ color: "#fff", fontSize: "10px" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </a>
          </div>
        </div>
        <br />

        <div className="at-body" style={{ padding: "15px", minHeight: "500px" }}>
          
          <ul className="at-tabs">
            {tabs.map(t => (
              <li key={t}>
                <a
                  href="#"
                  onClick={(e) => { e.preventDefault(); setActiveTab(t); }}
                  className={`at-tab${activeTab === t ? " on" : ""}`}
                >
                  {t}
                </a>
              </li>
            ))}
          </ul>

          <div className="at-pane">
            
            {activeTab === "Employee Attendance" && (
              <>
                {!showAttMark && (<>
                <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end", marginBottom: "20px" }}>
                  <div style={{ flex: "1 1 150px" }}>
                    <b>Month / Year :</b><span style={{ color: "red" }}>*</span>
                    <MonthYearPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y); }} />
                  </div>
                  <div style={{ flex: "1 1 200px" }}>
                    <b>Client Name :</b><span style={{ color: "red" }}>*</span>
                    <select className="form-control" value={client} onChange={e => { setClient(e.target.value); setState("Select"); setUnit("Select"); }} style={{ width: "100%", height: "34px", borderRadius: "4px", border: "1px solid #ccc" }}>
                      <option value="Select">Select</option>
                      {clients.map(c => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: "1 1 150px" }}>
                    <b>State Name :</b><span style={{ color: "red" }}>*</span>
                    <select className="form-control" value={state} onChange={e => { setState(e.target.value); setUnit("Select"); }} style={{ width: "100%", height: "34px", borderRadius: "4px", border: "1px solid #ccc" }}>
                      <option value="Select">Select</option>
                      {filteredStates.map(s => <option key={s.state_name} value={s.state_name}>{s.state_name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: "1 1 200px" }}>
                    <b>Branch Name :</b><span style={{ color: "red" }}>*</span>
                    <SearchSelect value={unit} onChange={setUnit}
                      options={[{ value: "Select", label: "Select" }, { value: "ALL", label: "ALL" }, ...filteredUnits.map(u => ({ value: u.unit_code, label: u.unit_name }))]} />
                  </div>
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button className="btn btn-success" onClick={load} disabled={processBusy} style={{ background: processBusy ? "#9bcf9b" : "#5cb85c", border: "1px solid #4cae4c", color: "#fff", padding: "6px 15px", borderRadius: "4px" }}>Process</button>
                    <button className="btn btn-primary" onClick={openAttendanceReport} disabled={reportBusy} title="Attendance sheet report (legacy Attendance button)" style={{ background: reportBusy ? "#89a7c4" : "#337ab7", border: "1px solid #2e6da4", color: "#fff", padding: "6px 15px", borderRadius: "4px" }}>Attendance</button>
                    <button className="btn btn-primary" onClick={openStatusReports} disabled={reportBusy} title="Branch approval status / report (legacy Reports button)" style={{ background: reportBusy ? "#89a7c4" : "#337ab7", border: "1px solid #2e6da4", color: "#fff", padding: "6px 15px", borderRadius: "4px" }}>Reports</button>
                    <button className="btn btn-danger" onClick={close} style={{ background: "#d9534f", border: "1px solid #d43f3a", color: "#fff", padding: "6px 15px", borderRadius: "4px" }}>Close</button>
                  </div>
                </div>
                {msg && <div style={{ margin: "0 0 14px", padding: "8px 12px", background: "#fcf8e3", border: "1px solid #faebcc", color: "#8a6d3b", borderRadius: "4px", fontSize: "13px" }}>{msg}</div>}
                {locked && <div style={{ margin: "0 0 14px", padding: "10px 12px", background: "#f2dede", border: "1px solid #ebccd1", color: "#a94442", borderRadius: "4px", fontSize: "13px", fontWeight: 700 }}>🔒 {LOCK_MSG}{approvalStatus ? ` (${approvalStatus})` : ""}{approvalBy ? ` — Approved By : ${approvalBy}` : ""}</div>}

                {rows.length > 0 && !locked && <div style={{ fontWeight: 700, color: "#006699", margin: "6px 0" }}>Step 1 — Select employees, then click Submit (single click par sheet khulegi; unchecked employee ke liye Left Date mandatory hai)</div>}
                <div style={{ overflowX: "auto" }}>
                  <table className="table table-bordered table-striped table-hover" style={{ width: "100%", background: "#fff", border: "1px solid #ddd" }}>
                    <thead style={{ background: "#006699", color: "white" }}>
                      <tr>
                        <th style={{ padding: "8px", textTransform: "uppercase" }}>SR. NO.</th>
                        <th style={{ padding: "8px", textTransform: "uppercase", textAlign: "center" }}>
                          <input type="checkbox" title="Select all" checked={rows.length > 0 && selectedEmps.size === rows.length} onChange={toggleAllEmps} /> SELECT EMPLOYEE
                        </th>
                        <th style={{ padding: "8px", textTransform: "uppercase" }}>BRANCH NAME</th>
                        <th style={{ padding: "8px", textTransform: "uppercase" }}>EMPLOYEE NAME</th>
                        <th style={{ padding: "8px", textTransform: "uppercase" }}>DESIGNATION</th>
                        <th style={{ padding: "8px", textTransform: "uppercase" }}>TYPE</th>
                        <th style={{ padding: "8px", textTransform: "uppercase" }}>LEFT DATE</th>
                        <th style={{ padding: "8px", textTransform: "uppercase" }}>LEFT REASON</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r, idx) => (
                        <tr key={r.emp_code}>
                          <td style={{ padding: "8px" }}>{idx + 1}</td>
                          <td style={{ padding: "8px", textAlign: "center" }}><input type="checkbox" checked={selectedEmps.has(r.emp_code)} onChange={() => toggleEmp(r.emp_code)} /></td>
                          <td style={{ padding: "8px" }}>{units.find(u => u.unit_code === unit)?.unit_name || unit}</td>
                          <td style={{ padding: "8px" }}>{r.emp_name}</td>
                          <td style={{ padding: "8px" }}>{r.designation || "OFFICE COORDINATOR"}</td>
                          <td style={{ padding: "8px" }}>{r.type || "Permanent"}</td>
                          <td style={{ padding: "8px" }}>
                            <input type="date" className="form-control" style={{ height: "30px", padding: "2px 6px" }} value={r.left_date || ""} onChange={e => setRowField(r.emp_code, "left_date", e.target.value)} title="Left Date is mandatory for an unchecked employee" />
                          </td>
                          <td style={{ padding: "8px" }}>
                            <input type="text" className="form-control" style={{ height: "30px", padding: "2px 6px" }} value={r.left_reason || ""} onChange={e => setRowField(r.emp_code, "left_reason", e.target.value)} placeholder="Left reason" />
                          </td>
                        </tr>
                      ))}
                      {rows.length === 0 && (
                        <tr>
                          <td colSpan={8} style={{ textAlign: "center", padding: "20px" }}>No Data Found</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={{ textAlign: "center", marginTop: "20px" }}>
                  <button className="btn btn-success" onClick={submitAttendance} disabled={submitBusy || rows.length === 0 || locked} style={{ background: (submitBusy || rows.length === 0 || locked) ? "#9bcf9b" : "#5cb85c", border: "1px solid #4cae4c", color: "#fff", padding: "6px 20px", borderRadius: "4px", fontWeight: "bold" }}>Submit</button>
                </div>
                </>)}

                {showAttMark && (
                  <div style={{ marginTop: "24px" }}>
                    <div className="at-toolbar">
                      <span className="at-step">Step 2 — Mark attendance, then Save / Approve / Attachment</span>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button className="btn btn-default" title="Mark every day Present (P) for all listed employees (days after the left date stay Absent)" onClick={() => setAttRows(prev => prev.map(r => ({ ...r, days: Object.fromEntries(attCols.map((c, i) => [c, isAfterLeft(r, i + 1) ? "A" : isFutureDay(i + 1) ? "" : "P"])) })))} style={{ border: "1px solid #32CD32", background: "#eaffea", padding: "4px 14px", borderRadius: "4px", fontWeight: 700 }}>Fill All P</button>
                        <button className="btn btn-default" onClick={() => setShowAttMark(false)} style={{ border: "1px solid #ccc", background: "#fff", padding: "4px 14px", borderRadius: "4px" }}>&larr; Back to employee list</button>
                      </div>
                    </div>
                    <div className="at-legend">
                      {([["P", "Present"], ["A", "Absent"], ["HD", "Half Day"], ["L", "Leave"], ["W", "Weekly Off"], ["H", "Holiday"], ["CL", "Casual Leave"], ["PL", "Privilege Leave"], ["ML", "Medical Leave"], ["PH", "Present on Holiday"], ["CO", "Comp Off"]] as [string, string][]).map(([code, label]) => (
                        <span key={code} className="at-chip">
                          <span className="at-swatch" style={{ background: ATT_COLORS[code] }} />
                          <b>{code}</b> = {label}
                        </span>
                      ))}
                    </div>
                    <div style={{ margin: "6px 0", fontSize: "12px", color: "#555" }}>
                      <b>STRENGTH</b> = the most people allowed on a day. It is fixed (the branch seat, or the strength loaded with the
                      sheet) and cannot be edited here; attendance of a day may not be more than it.
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table className="table table-bordered table-hover" style={{ background: "#fff", border: "1px solid #ddd", fontSize: "12px" }}>
                        <thead style={{ background: "#006699", color: "white" }}>
                          <tr>
                            <th style={{ padding: "6px" }}>SR</th>
                            <th style={{ padding: "6px" }}>EMPLOYEE</th>
                            <th style={{ padding: "6px" }}>DESIG</th>
                            {attCols.map((c, i) => <th key={c} style={{ padding: "4px", textAlign: "center", background: isFutureDay(i + 1) ? "#999" : undefined }}>{i + 1}</th>)}
                            <th style={{ padding: "6px", background: "#0066FF" }}>PRESENT</th>
                            <th style={{ padding: "6px", background: "#0066FF" }}>ABSENT</th>
                            <th style={{ padding: "6px", background: "#0066FF" }}>LEAVES</th>
                            <th style={{ padding: "6px", background: "#0066FF" }}>W-OFF</th>
                            <th style={{ padding: "6px", background: "#0066FF" }}>HOLIDAYS</th>
                            <th style={{ padding: "6px", background: "#0066FF" }}>DAYS</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ background: "#fff6bf", fontWeight: 700 }}>
                            <td colSpan={3} style={{ padding: "4px" }}>STRENGTH (max people per day{Object.keys(seatByDay).length ? " = seat" : ""})</td>
                            {attCols.map(c => (
                              <td key={c} style={{ padding: "2px", textAlign: "center" }} title={seatByDay[c] != null ? `Seat of this day: ${seatByDay[c]}` : undefined}>
                                <input value={strength[c] ?? ""} readOnly tabIndex={-1} title="Fixed - cannot be edited"
                                  style={{ width: "34px", textAlign: "center", border: "1px solid #ccc", borderRadius: "3px", padding: "2px", fontSize: "11px", fontWeight: 700, background: "#f0f0f0", color: "#333", cursor: "not-allowed" }} />
                              </td>
                            ))}
                            <td colSpan={6} />
                          </tr>
                          {attRows.map((r, idx) => { const s = attSummary(r); return (
                            <tr key={r.emp_code}>
                              <td style={{ padding: "4px" }}>{idx + 1}</td>
                              <td style={{ padding: "4px", whiteSpace: "nowrap", background: (r.type || "").trim().toLowerCase() === "reliever" ? "#fff1d6" : undefined }}>{r.emp_name}{(r.type || "").trim().toLowerCase() === "reliever" && <span title="Reliever" style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 8, background: "#f59e0b", color: "#fff", fontSize: 10, fontWeight: 700, letterSpacing: .3 }}>RELIEVER</span>}</td>
                              <td style={{ padding: "4px", background: (r.type || "").trim().toLowerCase() === "reliever" ? "#fff1d6" : undefined }}>{r.designation}</td>
                              {attCols.map((c, i) => {
                                const fd = isFutureDay(i + 1);
                                const ld = isAfterLeft(r, i + 1);
                                const dis = fd || ld;
                                return (
                                <td key={c} style={{ padding: "2px", background: dis ? "#f0f0f0" : (ATT_COLORS[r.days[c]] || "transparent") }} title={fd ? "Future date — cannot be marked" : (ld ? "After left date — Absent" : undefined)}>
                                  <select value={r.days[c] || ""} onChange={e => setAttDay(r.emp_code, c, e.target.value)}
                                    disabled={dis || locked}
                                    style={{ width: "48px", border: "1px solid #ccc", borderRadius: "3px", padding: "2px", fontSize: "11px", fontWeight: 700, background: dis ? "#f0f0f0" : (ATT_COLORS[r.days[c]] || "#fff") }}>
                                    {ATT_CODES.map(o => <option key={o} value={o}>{o || "-"}</option>)}
                                  </select>
                                </td>
                                );
                              })}
                              <td style={{ padding: "4px", textAlign: "center", fontWeight: 700 }}>{s.present}</td>
                              <td style={{ padding: "4px", textAlign: "center" }}>{s.absent}</td>
                              <td style={{ padding: "4px", textAlign: "center" }}>{s.leaves}</td>
                              <td style={{ padding: "4px", textAlign: "center" }}>{s.wo}</td>
                              <td style={{ padding: "4px", textAlign: "center" }}>{s.ho}</td>
                              <td style={{ padding: "4px", textAlign: "center" }}>{s.days}</td>
                            </tr>
                          ); })}
                          {attRows.length === 0 && <tr><td colSpan={attCols.length + 3} style={{ textAlign: "center", padding: "20px" }}>No employees</td></tr>}
                          {attRows.length > 0 && (
                            <tr style={{ background: "#eef6ff", fontWeight: 700 }}>
                              <td colSpan={3} style={{ padding: "4px" }}>PRESENT on the day (red = more than the strength)</td>
                              {attCols.map(c => {
                                const pr = attRows.reduce((t, r) => { const v = (r.days[c] || "").toUpperCase(); return t + (v === "P" || v === "PH" ? 1 : v === "HD" ? 0.5 : 0); }, 0);
                                const st = strength[c];
                                const over = st !== undefined && st !== "" && pr > Number(st);
                                return <td key={c} style={{ padding: "2px", textAlign: "center", color: over ? "#fff" : undefined, background: over ? "#d9534f" : undefined }}>{pr}</td>;
                              })}
                              <td colSpan={6} />
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                    {/* action buttons — all together, centered */}
                    <div style={{ marginTop: "18px", display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center" }}>
                      <button className="btn btn-success" onClick={saveAtt} disabled={submitBusy || locked} style={{ background: (submitBusy || locked) ? "#9bcf9b" : "#5cb85c", border: "1px solid #4cae4c", color: "#fff", padding: "6px 24px", borderRadius: "4px", fontWeight: "bold" }}>Save Attendance</button>
                      <button className="btn btn-primary" onClick={approveAtt} disabled={submitBusy || locked || !hasSaved} title={!hasSaved ? "Please save attendance first" : ""} style={{ background: (submitBusy || locked || !hasSaved) ? "#89a7c4" : "#337ab7", border: "1px solid #2e6da4", color: "#fff", padding: "6px 22px", borderRadius: "4px", fontWeight: "bold" }}>Approve</button>
                      <button className="btn btn-primary" onClick={downloadReport} disabled={reportBusy} style={{ background: reportBusy ? "#89a7c4" : "#337ab7", border: "1px solid #2e6da4", color: "#fff", padding: "6px 22px", borderRadius: "4px" }}>Download Report</button>
                    </div>
                    {/* attachment row — centered, aligned */}
                    <div style={{ marginTop: "14px", background: "#f7f7f7", padding: "12px", borderRadius: "4px", display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "center", justifyContent: "center" }}>
                      <b>Attendance Attachment :</b>
                      <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={e => setAttFile(e.target.files?.[0] ?? null)} />
                      <button className="btn btn-primary" onClick={uploadAttachment} disabled={submitBusy} style={{ background: "#337ab7", border: "1px solid #2e6da4", color: "#fff", padding: "6px 18px", borderRadius: "4px" }}>Upload</button>
                      {attAttachUrl
                        ? <a href={attAttachUrl.startsWith("http") ? attAttachUrl : `${API_BASE_URL}${attAttachUrl}`} target="_blank" rel="noreferrer" style={{ color: "green", fontWeight: 700 }}>✓ View uploaded attachment</a>
                        : <span style={{ color: "#999" }}>No attachment uploaded</span>}
                      <span style={{ fontSize: "11px", color: "#777" }}>(Only JPG, PNG, PDF)</span>
                    </div>
                    {fbRows.length > 0 && (
                      <div className="container" style={{ width: "90%", marginTop: "14px" }}>
                        <table className="table" style={{ width: "100%", background: "#fff", border: "1px solid #ccc" }}>
                          <thead style={{ background: "#006699", color: "white", textTransform: "uppercase" }}>
                            <tr>
                              <th>Sr No.</th>
                              <th style={{ fontSize: "medium", textAlign: "center" }}>Particular</th>
                              {(["good", "satisfactory", "need_improvement"] as const).map(k => (
                                <th key={k} style={{ textAlign: "center" }}>
                                  {k === "good" ? "GOOD" : k === "satisfactory" ? "Satisfactory" : "Need Improvement"}
                                  <input type="checkbox" style={{ display: "block", margin: "4px auto 0" }}
                                    checked={fbRows.every(r => r[k])} onChange={e => setFbAll(k, e.target.checked)} />
                                </th>
                              ))}
                              <th style={{ textAlign: "center" }}>Any Other Remark</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fbRows.map((r, i) => (
                              <tr key={r.feedback} style={{ color: "#000066" }}>
                                <td>{i + 1}</td>
                                <td>{r.feedback}</td>
                                {(["good", "satisfactory", "need_improvement"] as const).map(k => (
                                  <td key={k} style={{ textAlign: "center" }}>
                                    <input type="checkbox" checked={r[k]} onChange={e => setFb(i, k, e.target.checked)} />
                                  </td>
                                ))}
                                <td><input className="form-control" value={r.remark} maxLength={500}
                                  onChange={e => setFbRows(rs => rs.map((x, idx) => (idx === i ? { ...x, remark: e.target.value } : x)))} /></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {activeTab === "Add OT Hrs" && <OtSheetTab onClose={close} />}
            {activeTab === "Conveyance" && <ConveyanceTab onClose={close} />}

            {activeTab === "Material Amount" && <MaterialAmountTab />}
            {activeTab === "R&M Service" && <RmServiceTab />}
            {activeTab === "Administrative Expenses" && <AdminExpensesTab />}
            {activeTab === "Material Challan Uploading" && <MaterialChallanTab />}
            {activeTab === "Feedback Update" && <FeedbackUpdateTab />}
            {activeTab === "Shiftwise Attendance" && <ShiftwiseTab />}

            
          </div>
        </div>
      </div>
    </section>
  );
}
