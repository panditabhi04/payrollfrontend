"use client";
// 1:1 port of Android_Attendances_Logs.aspx — wired to the full android-logs-portal backend.
// 3 tabs: Android Attendance Logs (Type: Attendance / Attendance Excel / Work / Employee Current
// Location), Fire Extinguisher Details (grid + Approve/Reject/Move/Delete), Feedback Letter
// (Send Link / Report / Download). Filters cascade Client->State->Branch via filter-options.
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getJSON, mk } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

const B = "/api/attendance/android-logs-portal";
const enc = encodeURIComponent;
const toDMY = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "");       // yyyy-mm-dd -> dd/mm/yyyy
const monToMY = (m: string) => (m ? (() => { const [y, mm] = m.split("-"); return `${mm}/${y}`; })() : ""); // yyyy-mm -> mm/yyyy

interface Opt { v: string; t: string; }

function parseBreakArray(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (!trimmed || trimmed === "-") return [];
    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return [trimmed];
      }
    }
    return [trimmed];
  }
  return [val];
}

function extractTimeStr(item: any, isStart: boolean): string {
  if (item === null || item === undefined) return "";
  if (typeof item === "object") {
    const t = isStart
      ? (item.start_time || item.start || item.time || item.in_time || item.in || item.break_in)
      : (item.end_time || item.end || item.time || item.out_time || item.out || item.break_out);
    return t ? String(t).trim() : "";
  }
  return String(item).trim();
}

function formatBreakIn(starts: any): string {
  const arr = parseBreakArray(starts);
  if (!arr.length) return "-";
  const times = arr.map((item, idx) => {
    const t = extractTimeStr(item, true);
    if (!t || t === "-") return "-";
    return arr.length > 1 ? `#${idx + 1}: ${t}` : t;
  }).filter((x) => x !== "-");
  return times.length ? times.join(", ") : "-";
}

function formatBreakOut(starts: any, ends: any): string {
  const sArr = parseBreakArray(starts);
  const eArr = parseBreakArray(ends);
  if (!sArr.length && !eArr.length) return "-";

  const maxLen = Math.max(sArr.length, eArr.length);
  const items: string[] = [];
  for (let idx = 0; idx < maxLen; idx++) {
    const e = extractTimeStr(eArr[idx], false);
    const val = e && e !== "-" ? e : (idx === sArr.length - 1 && sArr.length > eArr.length ? "Running" : "-");
    items.push(maxLen > 1 ? `#${idx + 1}: ${val}` : val);
  }
  const filtered = items.filter((x) => x !== "-");
  return filtered.length ? filtered.join(", ") : "-";
}

function formatBreaks(starts: any, ends: any): string {
  let sArr: any[] = [];
  let eArr: any[] = [];
  try { sArr = Array.isArray(starts) ? starts : (starts ? JSON.parse(starts) : []); } catch { sArr = []; }
  try { eArr = Array.isArray(ends) ? ends : (ends ? JSON.parse(ends) : []); } catch { eArr = []; }
  if (!sArr || !sArr.length) return "-";
  return sArr.map((sItem: any, idx: number) => {
    const s = typeof sItem === "object" ? (sItem.start_time || sItem.time) : sItem;
    const eItem = eArr[idx];
    const e = typeof eItem === "object" ? (eItem.end_time || eItem.time) : eItem;
    const bNo = (typeof sItem === "object" && sItem.break_no) ? sItem.break_no : idx + 1;
    return `B${bNo}: ${s}-${e || "running"}`;
  }).join("; ");
}

// Type-mode -> endpoint + columns + row mapping (legacy GradeGridView / excel / work / location)
type Mode = { ep: string; cols: string[]; row: (r: any, i: number, img: (f: string, overrideFolder?: string) => React.ReactNode) => React.ReactNode[] };
const MODES: Record<string, Mode> = {
  "Attendance": {
    ep: "attendance-logs",
    cols: ["Sr No.", "EMP-NAME", "CLIENT NAME", "STATE NAME", "UNIT NAME", "ADDRESS", "BREAK-IN", "BREAK-OUT", "OUTSIDE IN-TIME", "OUTSIDE OUT-TIME", "IN", "OUT"],
    row: (r, i, img) => {
      const bIn = r.break_start ?? r.break_in ?? r.break_in_time ?? r.Break_In ?? r.Break_Start ?? r.break_starts;
      const bOut = r.break_end ?? r.break_out ?? r.break_out_time ?? r.Break_Out ?? r.Break_End ?? r.break_ends;
      return [
        i + 1,
        r.EMP_NAME,
        r.client_name,
        r.state_name,
        r.unit_name,
        r.address,
        formatBreakIn(bIn),
        formatBreakOut(bIn, bOut),
        r.camera_intime || r.attendances_intime || "-",
        r.camera_outtime || r.attendances_outtime || "-",
        img(r.Attendances_intime_images || r.Camera_intime_images || r.camera_intime_images),
        img(r.Attendances_outtime_images || r.Camera_outtime_images || r.camera_outtime_images),
      ];
    },
  },
  "Attendance Excel": {
    ep: "attendance-excel",
    cols: ["Sr No.", "EMP CODE", "EMP NAME", "CLIENT NAME", "STATE NAME", "UNIT NAME", "ADDRESS", "DATE-TIME", "BREAK-IN", "BREAK-OUT", "Outside In Time", "Outside Out Time"],
    row: (r, i) => {
      const bIn = r.break_start ?? r.break_in ?? r["Break In Time"] ?? r["Branch In Time"];
      const bOut = r.break_end ?? r.break_out ?? r["Break Out Time"] ?? r["Branch Out Time"];
      return [
        i + 1,
        r.EMP_CODE,
        r.EMP_NAME,
        r.client_name,
        r.state_name,
        r.unit_name,
        r.ADDRESS,
        r.Date_Time,
        formatBreakIn(bIn),
        formatBreakOut(bIn, bOut),
        r["Outside In Time"] || "-",
        r["Outside Out Time"] || "-",
      ];
    },
  },
  "Work": {
    ep: "work-images",
    cols: ["Sr No.", "EMP-NAME", "STATE-NAME", "BRANCH", "DATE-TIME", "IMAGE"],
    row: (r, i, img) => [i + 1, r.EMP_NAME, r.state_name, r.unit_name, r.datecurrent, img(r.image_name, "working_images/")],
  },
  "Employee Current Location": {
    ep: "current-location",
    cols: ["Sr No.", "Emp-Name", "State-Name", "Current-Latitude", "Current-Longitude", "Current-Date", "Address"],
    row: (r, i) => [i + 1, r.emp_code, r.state_name, r.cur_latitude, r.cur_longtitude, r.cur_date, r.cur_address],
  },
};

const errText = async (r: Response, fb: string) => { const b = await r.json().catch(() => ({} as any)); return (b as any)?.message || (b as any)?.detail || fb; };

// variant "logs"    = Android_Attendances_Logs.aspx    : Android Attendance Logs, Fire Extinguisher Details, Feedback Letter
// variant "details" = Android_Attendances_Details.aspx : Android Attendance Logs, Monthly Attendance Calendar,
//                      Attendance Percentage Count (its Fire / Feedback controls are Visible="false" in the markup)
export default function AndroidLogReview({ variant = "logs" }: { variant?: "logs" | "details" }) {
  const [activeTab, setActiveTab] = useState(0);
  const showTab = (i: number) => (variant === "details" ? [0, 3, 4].includes(i) : [0, 1, 2].includes(i));
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [clients, setClients] = useState<Opt[]>([]);

  useEffect(() => {
    getJSON<{ results: { client_code: string; client_name: string }[] }>(`${B}/filter-options/?kind=clients`)
      .then((d) => setClients([{ v: "ALL", t: "ALL" }, ...(d?.results ?? []).map((c) => ({ v: c.client_code, t: c.client_name }))]))
      .catch(() => { });
  }, []);

  const loadStates = useCallback(async (client: string): Promise<string[]> => {
    const p1 = getJSON<{ results: { state_name: string }[] }>(`${B}/filter-options/?kind=states&client_code=${enc(client)}`).catch(() => null);
    const p2 = getJSON<{ units: { unit_code: string; unit_name: string; state_name: string }[] }>(
      client && client !== "ALL"
        ? `/api/masters/units/lookup/?client_code=${enc(client)}&assigned=1`
        : `/api/masters/units/lookup/?assigned=1`
    ).catch(() => null);
    const p3 = client && client !== "ALL"
      ? getJSON<{ results: { state: string }[] }>(`/api/masters/client-designation-counts/lookup/?client_code=${enc(client)}`).catch(() => null)
      : null;

    const [d1, d2, d3] = await Promise.all([p1, p2, p3]);

    const set = new Set<string>();
    (d1?.results ?? []).forEach((s) => s.state_name && set.add(s.state_name.trim()));
    (d2?.units ?? []).forEach((u) => u.state_name && set.add(u.state_name.trim()));
    (d3?.results ?? []).forEach((dc) => dc.state && set.add(dc.state.trim()));

    return Array.from(set).filter(Boolean).sort();
  }, []);

  const loadBranches = useCallback(async (client: string, state: string): Promise<Opt[]> => {
    const p1 = getJSON<{ results: { unit_code: string; unit_name: string }[] }>(`${B}/filter-options/?kind=branches&client_code=${enc(client)}&state_name=${enc(state)}`).catch(() => null);
    const p2 = getJSON<{ units: { unit_code: string; unit_name: string; state_name: string }[] }>(
      client && client !== "ALL"
        ? `/api/masters/units/lookup/?client_code=${enc(client)}&assigned=1`
        : `/api/masters/units/lookup/?assigned=1`
    ).catch(() => null);

    const [d1, d2] = await Promise.all([p1, p2]);

    const map = new Map<string, string>();
    (d1?.results ?? []).forEach((u) => map.set(u.unit_code, u.unit_name));
    (d2?.units ?? []).forEach((u) => {
      const matchState = !state || state === "ALL" || (u.state_name || "").trim().toLowerCase() === state.trim().toLowerCase();
      if (matchState && !map.has(u.unit_code)) {
        map.set(u.unit_code, `${u.unit_code} - ${u.unit_name}`);
      }
    });

    return Array.from(map.entries()).map(([v, t]) => ({ v, t }));
  }, []);

  const [zoomSrc, setZoomSrc] = useState("");
  const imgLink = (base: string) => (fname: string, overrideFolder?: string) => {
    if (!fname) return "-";
    const cleanFname = String(fname).trim();
    if (!cleanFname || cleanFname === "-") return "-";
    const folder = overrideFolder || (cleanFname.includes("_Working_") ? "attendance_images/" : base || "attendance_images/");
    const src = cleanFname.startsWith("http")
      ? cleanFname
      : cleanFname.startsWith("/media/")
        ? `${API_BASE_URL}${cleanFname}`
        : cleanFname.startsWith("attendance_images/") || cleanFname.startsWith("working_images/")
          ? `${API_BASE_URL}/media/${cleanFname}`
          : `${API_BASE_URL}/media/${folder.endsWith("/") ? folder : folder + "/"}${cleanFname}`;
    return (
      <img src={src} alt="" width={60} height={60}
        style={{ cursor: "pointer", objectFit: "cover", borderRadius: "4px", border: "1px solid #ccc" }} title="Click to zoom"
        onClick={() => setZoomSrc(src)}
        onError={(e) => {
          const target = e.currentTarget;
          if (target.src.includes("/attendance_images/")) {
            target.src = target.src.replace("/attendance_images/", "/working_images/");
            return;
          } else if (target.src.includes("/working_images/")) {
            target.src = target.src.replace("/working_images/", "/attendance_images/");
            return;
          }
          target.style.display = "none";
          if (target.parentElement) {
            target.parentElement.textContent = "-";
          }
        }} />
    );
  };

  // ---------- Tab 0: Android Attendance Logs ----------
  const [attType, setAttType] = useState("Attendance");
  const [client, setClient] = useState("ALL");
  const [state, setState] = useState("Select");
  const [unit, setUnit] = useState("Select");
  const [states, setStates] = useState<string[]>([]);
  const [branches, setBranches] = useState<Opt[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [imgBase, setImgBase] = useState("");
  const [shownMode, setShownMode] = useState("Attendance");

  useEffect(() => { setState("Select"); setUnit("Select"); setBranches([]); loadStates(client).then(setStates); }, [client, loadStates]);
  useEffect(() => { setUnit("Select"); if (state === "Select") { setBranches([]); return; } loadBranches(client, state).then(setBranches); }, [client, state, loadBranches]);

  const handleShow = async () => {
    if (!state || state === "Select") { alert("Please Select State"); return; }
    if (!unit || unit === "Select") { alert("Please Select Branch Name"); return; }
    if (!fromDate || !toDate) { alert("Please select both From Date and To Date"); return; }
    const m = MODES[attType];
    setLoading(true); setMsg("");
    try {
      if (state === "ALL") {
        // Backend attendance-logs fails if state_name=ALL directly.
        // Fetch for each state and merge results seamlessly.
        const targetStates = states.length > 0 ? states : [""];
        const results = await Promise.all(
          targetStates.map(async (st) => {
            const qs = new URLSearchParams({
              client_code: client,
              state_name: st,
              unit_code: unit,
              from_date: toDMY(fromDate),
              to_date: toDMY(toDate),
            });
            return getJSON<{ results: any[]; image_base?: string }>(`${B}/${m.ep}/?${qs.toString()}`).catch(() => null);
          })
        );
        const combined = results.flatMap((d) => d?.results ?? []);
        const base = results.find((d) => d?.image_base)?.image_base ?? "";
        setRows(combined);
        setImgBase(base);
        setShownMode(attType);
        if (combined.length === 0) setMsg("No Records");
      } else {
        const qs = new URLSearchParams({ client_code: client, state_name: state, unit_code: unit, from_date: toDMY(fromDate), to_date: toDMY(toDate) });
        const d = await getJSON<{ results: any[]; image_base?: string }>(`${B}/${m.ep}/?${qs.toString()}`);
        setRows(d?.results ?? []); setImgBase(d?.image_base ?? ""); setShownMode(attType);
        if ((d?.results ?? []).length === 0) setMsg("No Records");
      }
    } catch (e: any) {
      setRows([]); setMsg(String(e?.message || "Failed to load.").slice(0, 160));
    } finally { setLoading(false); }
  };

  const mode = MODES[shownMode];
  const cells = rows.map((r, i) => mode.row(r, i, imgLink(imgBase)));
  const exportGrid = (kind: "csv" | "print" | "copy", cols: string[], data: React.ReactNode[][], name: string) => {
    if (kind === "print") { window.print(); return; }
    const text = (c: React.ReactNode) => (typeof c === "object" ? "" : String(c ?? ""));
    const matrix = [cols, ...data.map((r) => r.map(text))];
    if (kind === "copy") { navigator.clipboard?.writeText(matrix.map((r) => r.join("\t")).join("\n")).catch(() => undefined); return; }
    const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + matrix.map((r) => r.map(q).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8;" }));
    a.download = `${name}.csv`; document.body.appendChild(a); a.click(); a.remove();
  };

  // ---------- Tab 1: Fire Extinguisher Details ----------
  const [fClient, setFClient] = useState("ALL");
  const [fState, setFState] = useState("Select");
  const [fStates, setFStates] = useState<string[]>([]);
  const [fireRows, setFireRows] = useState<any[]>([]);
  const [fireImg, setFireImg] = useState("");
  const [fireSel, setFireSel] = useState<Set<number>>(new Set());
  useEffect(() => { setFState("Select"); loadStates(fClient).then(setFStates); }, [fClient, loadStates]);

  const fireShow = async () => {
    setLoading(true); setMsg("");
    try {
      const qs = new URLSearchParams({ client_code: fClient, state_name: fState === "Select" ? "" : fState });
      const d = await getJSON<{ results: any[]; image_base?: string }>(`${B}/fire-photos/?${qs.toString()}`);
      setFireRows(d?.results ?? []); setFireImg(d?.image_base ?? ""); setFireSel(new Set());
    } catch (e: any) { setFireRows([]); setMsg(String(e?.message || "Failed").slice(0, 160)); }
    finally { setLoading(false); }
  };
  const fireAct = async (op: "approve" | "reject" | "move" | "delete", id?: number) => {
    const ids = id != null ? [id] : [...fireSel];
    if (ids.length === 0) { alert("Please select atleast one Record "); return; }
    let reason = "";
    if (op === "reject") { reason = window.prompt("Please Enter Reject Reason") || ""; if (!reason) { alert("Please Enter Reject Reason"); return; } }
    if (op === "delete" && !confirm("Are you sure You want to  Delete ?")) return;
    const r = await mk(`${B}/fire-action/`, { op, ids, reason });
    const b = await r.json().catch(() => ({} as any));
    alert(((b as any)?.message || (r.ok ? "Done" : "Failed")) + ((b as any)?.warning ? String.fromCharCode(10) + (b as any).warning : ""));
    if (r.ok) fireShow();
  };
  const toggleFire = (id: number) => setFireSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  // ---------- Tab 2: Feedback Letter ----------
  const [fbClient, setFbClient] = useState("Select");
  const [fbState, setFbState] = useState("Select");
  const [fbUnit, setFbUnit] = useState("ALL");
  const [fbStates, setFbStates] = useState<string[]>([]);
  const [fbBranches, setFbBranches] = useState<Opt[]>([]);
  const [fbMonth, setFbMonth] = useState("");
  const [fbRows, setFbRows] = useState<any[]>([]);
  useEffect(() => { setFbState("Select"); setFbUnit("ALL"); if (fbClient === "Select") { setFbStates([]); return; } loadStates(fbClient).then(setFbStates); }, [fbClient, loadStates]);
  useEffect(() => { setFbUnit("ALL"); if (fbClient === "Select" || fbState === "Select") { setFbBranches([]); return; } loadBranches(fbClient, fbState).then(setFbBranches); }, [fbClient, fbState, loadBranches]);

  const fbParams = () => new URLSearchParams({ client_code: fbClient, state_name: fbState === "Select" ? "" : fbState, unit_code: fbUnit, monthyear: monToMY(fbMonth) });
  const fbReport = async () => {
    if (fbClient === "Select") { alert("Please Select Client."); return; }
    if (!fbMonth) { alert("Please Select Month/Year."); return; }
    setLoading(true); setMsg("");
    try { const d = await getJSON<{ results: any[] }>(`${B}/feedback-report/?${fbParams().toString()}`); setFbRows(d?.results ?? []); if ((d?.results ?? []).length === 0) setMsg("No Records"); }
    catch (e: any) { setFbRows([]); setMsg(String(e?.message || "Failed").slice(0, 160)); }
    finally { setLoading(false); }
  };
  const fbSend = async () => {
    if (fbClient === "Select") { alert("Please Select Client."); return; }
    if (!fbMonth) { alert("Please Select Month/Year."); return; }
    const r = await mk(`${B}/feedback-send/`, { client_code: fbClient, state_name: fbState === "Select" ? "" : fbState, unit_code: fbUnit, monthyear: monToMY(fbMonth) });
    alert(await errText(r, r.ok ? "Email Sent successfully!!" : "Failed"));
  };
  const fbDownload = async () => {
    if (fbClient === "Select") { alert("Please Select Client."); return; }
    if (fbState === "Select") { alert("Please Select State"); return; }
    if (!fbMonth) { alert("Please Select Month/Year."); return; }
    try {
      const d = await getJSON<{ results: any[]; message?: string }>(`${B}/feedback-download/?${fbParams().toString()}`);
      if (!d?.results?.length) { alert(d?.message || "No Matching Records Found."); return; }
      const cols = Object.keys(d.results[0]);
      const q = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
      const csv = [cols.map(q).join(","), ...d.results.map((r) => cols.map((c) => q(String(r[c] ?? ""))).join(","))].join("\r\n");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "application/vnd.ms-excel" }));
      a.download = `Feedback_${fbClient}.xls`; document.body.appendChild(a); a.click(); a.remove();
    } catch (e: any) { alert(String(e?.message || "Failed").slice(0, 160)); }
  };

  // ---------- Tab 3: Monthly Attendance Calendar (Android_Attendances_Details.aspx) ----------
  const [mcMonth, setMcMonth] = useState("");
  const [mcClient, setMcClient] = useState("Select");
  const [mcState, setMcState] = useState("ALL");
  const [mcUnit, setMcUnit] = useState("ALL");
  const [mcStates, setMcStates] = useState<string[]>([]);
  const [mcBranches, setMcBranches] = useState<Opt[]>([]);
  const [mcCols, setMcCols] = useState<string[]>([]);
  const [mcRows, setMcRows] = useState<any[]>([]);
  useEffect(() => { setMcState("ALL"); setMcUnit("ALL"); if (mcClient === "Select") { setMcStates([]); return; } loadStates(mcClient).then(setMcStates); }, [mcClient, loadStates]);
  useEffect(() => { setMcUnit("ALL"); if (mcClient === "Select" || mcState === "ALL" || mcState === "Select") { setMcBranches([]); return; } loadBranches(mcClient, mcState).then(setMcBranches); }, [mcClient, mcState, loadBranches]);
  const mcShow = async () => {
    if (!mcMonth || mcClient === "Select") { alert("Please Select Client Name"); return; }
    setLoading(true); setMsg("");
    try {
      const qs = new URLSearchParams({ month_year: monToMY(mcMonth), client_code: mcClient, state_name: mcState, unit_code: mcUnit });
      const d = await getJSON<{ results: any[]; columns: string[] }>(`${B}/monthly-calendar/?${qs.toString()}`);
      setMcCols(d?.columns ?? []); setMcRows(d?.results ?? []);
      if ((d?.results ?? []).length === 0) setMsg("No Records");
    } catch (e: any) { setMcRows([]); setMsg(String(e?.message || "Failed to load.").slice(0, 160)); }
    finally { setLoading(false); }
  };

  // ---------- Tab 4: Attendance Percentage Count ----------
  const [apClient, setApClient] = useState("");
  const [apFrom, setApFrom] = useState("");
  const [apTo, setApTo] = useState("");
  const [apRows, setApRows] = useState<any[]>([]);
  useEffect(() => { if (!apClient && clients.length > 1) setApClient(clients[1].v); }, [clients, apClient]);
  const apShow = async () => {
    if (!apClient) { alert("Please Select Client Name"); return; }
    if (!apFrom || !apTo) { alert("Please select both From Date and To Date"); return; }
    setLoading(true); setMsg("");
    try {
      const qs = new URLSearchParams({ client_code: apClient, from_date: toDMY(apFrom), to_date: toDMY(apTo) });
      const d = await getJSON<{ results: any[] }>(`${B}/attendance-percent/?${qs.toString()}`);
      setApRows(d?.results ?? []); if ((d?.results ?? []).length === 0) setMsg("No Records");
    } catch (e: any) { setApRows([]); setMsg(String(e?.message || "Failed to load.").slice(0, 160)); }
    finally { setLoading(false); }
  };

  const sel = { width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px", marginTop: "5px" } as React.CSSProperties;
  const tabStyle = (i: number) => ({ display: "block", padding: "10px 15px", backgroundColor: activeTab === i ? "#fff" : "transparent", border: "1px solid #ddd", borderBottom: activeTab === i ? "none" : "1px solid #ddd", borderRadius: "4px 4px 0 0", color: activeTab === i ? "#555" : "#428bca", fontWeight: activeTab === i ? "bold" : "normal", cursor: "pointer" } as React.CSSProperties);
  const th = { padding: "4px", textAlign: "left" as const, background: "#006699", color: "#fff" };
  const td = { padding: "4px", borderBottom: "1px solid #ccc" };
  const expBtns = (cols: string[], data: React.ReactNode[][], name: string) => (
    <div style={{ marginBottom: 6 }}>
      {(["copy", "csv", "print"] as const).map((k) => <button key={k} className="btn btn-default btn-xs" style={{ marginRight: 6 }} onClick={() => exportGrid(k, cols, data, name)}>{k.toUpperCase()}</button>)}
    </div>
  );

  return (
    <div className="container-fluid" style={{ maxWidth: "99%", margin: "0 auto", padding: "20px" }}>
      {loading && <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(204,204,204,0.7)", zIndex: 9999 }}><div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>Loading...</div></div>}

      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between" }}>
          <div style={{ width: "8.33%" }}></div>
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>ANDROID ATTENDANCES LOGS</div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); window.open("/html/Android.html", "popUpWindow", "height=500,width=600,scrollbars=yes"); }} style={{ color: "#fff" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>
      </div>

      {msg && <div style={{ color: "#a94442", fontWeight: "bold", textAlign: "center", margin: "10px 0" }}>{msg}</div>}

      <div id="tabs" style={{ background: "beige", border: "1px solid #ddd", borderRadius: "4px", padding: "10px", marginTop: "20px" }}>
        <ul style={{ listStyleType: "none", padding: 0, margin: 0, display: "flex", borderBottom: "1px solid #ddd", marginBottom: "15px" }}>
          <li style={{ marginRight: "5px" }}><a onClick={() => setActiveTab(0)} style={tabStyle(0)}>Android Attendance Logs</a></li>
          {showTab(1) && <li style={{ marginRight: "5px" }}><a onClick={() => setActiveTab(1)} style={tabStyle(1)}>Fire Extinguisher Details</a></li>}
          {showTab(2) && <li style={{ marginRight: "5px" }}><a onClick={() => setActiveTab(2)} style={tabStyle(2)}>Feedback Letter</a></li>}
          {showTab(3) && <li style={{ marginRight: "5px" }}><a onClick={() => setActiveTab(3)} style={tabStyle(3)}>Monthly Attendance Calendar</a></li>}
          {showTab(4) && <li style={{ marginRight: "5px" }}><a onClick={() => setActiveTab(4)} style={tabStyle(4)}>Attendance Percentage Count</a></li>}
        </ul>

        {activeTab === 0 && (
          <div style={{ backgroundColor: "#fff", padding: "15px", border: "1px solid #ddd", borderTop: "none" }}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", marginBottom: "15px" }}>
              <div style={{ flex: "0 0 16.66%", paddingRight: "15px" }}><b>Type :</b>
                <select value={attType} onChange={(e) => setAttType(e.target.value)} className="form-control" style={sel}>{Object.keys(MODES).map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              <div style={{ flex: "0 0 16.66%", paddingRight: "15px" }}><b>Client Name :</b>
                <select value={client} onChange={(e) => setClient(e.target.value)} className="form-control" style={sel}>{clients.map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}</select></div>
              <div style={{ flex: "0 0 16.66%", paddingRight: "15px" }}><b>State :</b><span style={{ color: "red" }}>*</span>
                <select value={state} onChange={(e) => setState(e.target.value)} className="form-control" style={sel}><option value="Select">Select</option><option value="ALL">ALL</option>{states.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
              <div style={{ flex: "0 0 16.66%", paddingRight: "15px" }}><b>Branch Name :</b>
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className="form-control" style={sel}><option value="Select">Select</option><option value="ALL">ALL</option>{branches.map((u) => <option key={u.v} value={u.v}>{u.t}</option>)}</select></div>
              <div style={{ flex: "0 0 16.66%", paddingRight: "15px" }}><b>From Date :</b><input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="form-control" style={sel} /></div>
              <div style={{ flex: "0 0 16.66%", paddingRight: "15px" }}><b>To Date :</b><input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="form-control" style={sel} /></div>
            </div>
            <div style={{ textAlign: "center", marginBottom: "15px" }}>
              <button onClick={handleShow} className="btn btn-primary" style={{ backgroundColor: "#428bca", borderColor: "#357ebd", color: "#fff", marginRight: "10px" }}>Show</button>
              <button onClick={() => (window.location.href = "/Home")} className="btn btn-danger" style={{ backgroundColor: "#d9534f", borderColor: "#d43f3a", color: "#fff" }}>Close</button>
            </div>
            {expBtns(mode.cols, cells, `android_${shownMode}`)}
            <div style={{ overflowX: "auto", maxHeight: "400px" }} className="table-responsive">
              <table className="table" style={{ borderCollapse: "collapse", width: "100%", fontSize: "x-small", border: "1px solid #CCC" }}>
                <thead><tr style={{ fontWeight: "bold" }}>{mode.cols.map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
                <tbody>
                  {cells.map((row, i) => (
                    // legacy GradeGridView_RowDataBound_location: a row of Employee Current Location opens the map
                    <tr key={i}
                      style={shownMode === "Employee Current Location" ? { cursor: "pointer" } : undefined}
                      onClick={shownMode === "Employee Current Location" ? () => {
                        const r = rows[i];
                        if (r && r.cur_latitude && r.cur_longtitude)
                          window.open(`https://www.google.com/maps?q=${enc(String(r.cur_latitude))},${enc(String(r.cur_longtitude))}`, "_blank");
                      } : undefined}>
                      {row.map((c, j) => <td key={j} style={td}>{c}</td>)}
                    </tr>
                  ))}
                  {cells.length === 0 && <tr><td colSpan={mode.cols.length} style={{ padding: "10px", textAlign: "center" }}>No records found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 1 && (
          <div style={{ backgroundColor: "#fff", padding: "15px", border: "1px solid #ddd", borderTop: "none" }}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", marginBottom: "15px", alignItems: "flex-end" }}>
              <div style={{ flex: "0 0 20%", paddingRight: "15px" }}><b>Client Name :</b>
                <select value={fClient} onChange={(e) => setFClient(e.target.value)} className="form-control" style={sel}>{clients.map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}</select></div>
              <div style={{ flex: "0 0 20%", paddingRight: "15px" }}><b>Select State :</b>
                <select value={fState} onChange={(e) => setFState(e.target.value)} className="form-control" style={sel}><option value="Select">Select</option><option value="ALL">ALL</option>{fStates.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
              <div style={{ flex: "0 0 10%" }}><button className="btn btn-primary" style={{ backgroundColor: "#428bca", borderColor: "#357ebd", color: "#fff" }} onClick={fireShow}>SHOW</button></div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <button className="btn btn-success btn-sm" style={{ marginRight: 6 }} onClick={() => fireAct("approve")}>APPROVE</button>
              <button className="btn btn-danger btn-sm" style={{ marginRight: 6 }} onClick={() => fireAct("reject")}>REJECT</button>
              <button className="btn btn-warning btn-sm" onClick={() => fireAct("move")}>Move</button>
            </div>
            <div style={{ overflowX: "auto", maxHeight: "400px" }} className="table-responsive">
              <table className="table" style={{ borderCollapse: "collapse", width: "100%", fontSize: "x-small", border: "1px solid #CCC" }}>
                <thead><tr style={{ fontWeight: "bold" }}>
                  <th style={th}>Delete</th><th style={th}>SELECT CLIENT</th><th style={th}>Sr No.</th><th style={th}>Client Name</th><th style={th}>State Name</th>
                  <th style={th}>Unit Name</th><th style={th}>Emp Code</th><th style={th}>Emp Name</th><th style={th}>Type</th><th style={th}>Date</th><th style={th}>Image</th><th style={th}>Status</th><th style={th}>Reject Reason</th>
                </tr></thead>
                <tbody>
                  {fireRows.map((r, i) => (
                    <tr key={r.id}>
                      <td style={td}><button className="btn btn-danger btn-xs" onClick={() => fireAct("delete", r.id)}>✕</button></td>
                      <td style={{ ...td, textAlign: "center" }}><input type="checkbox" checked={fireSel.has(r.id)} onChange={() => toggleFire(r.id)} /></td>
                      <td style={td}>{i + 1}</td><td style={td}>{r.client_name}</td><td style={td}>{r.state_name}</td><td style={td}>{r.unit_name}</td>
                      <td style={td}>{r.emp_code}</td><td style={td}>{r.emp_name}</td><td style={td}>{r.type_name}</td><td style={td}>{r.curr_date}</td>
                      <td style={td}>{r.image_path ? <a href={`${API_BASE_URL}/media/${fireImg}${r.image_path}`} target="_blank" rel="noreferrer">View</a> : "-"}</td>
                      <td style={td}>{r.approve_fire}</td><td style={td}>{r.reject_reason}</td>
                    </tr>
                  ))}
                  {fireRows.length === 0 && <tr><td colSpan={13} style={{ padding: "10px", textAlign: "center" }}>No records found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 2 && (
          <div style={{ backgroundColor: "#fff", padding: "15px", border: "1px solid #ddd", borderTop: "none" }}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", marginBottom: "15px", alignItems: "flex-end" }}>
              <div style={{ flex: "0 0 20%", paddingRight: "15px" }}><b>Client Name :</b>
                <select value={fbClient} onChange={(e) => setFbClient(e.target.value)} className="form-control" style={sel}><option value="Select">Select</option>{clients.filter((c) => c.v !== "ALL").map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}</select></div>
              <div style={{ flex: "0 0 20%", paddingRight: "15px" }}><b>Select State :</b>
                <select value={fbState} onChange={(e) => setFbState(e.target.value)} className="form-control" style={sel}><option value="Select">Select</option><option value="ALL">ALL</option>{fbStates.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
              <div style={{ flex: "0 0 20%", paddingRight: "15px" }}><b>Branch Name :</b>
                <select value={fbUnit} onChange={(e) => setFbUnit(e.target.value)} className="form-control" style={sel}><option value="ALL">ALL</option>{fbBranches.map((u) => <option key={u.v} value={u.v}>{u.t}</option>)}</select></div>
              <div style={{ flex: "0 0 15%", paddingRight: "15px" }}><b>Feedback Month :</b><input type="month" value={fbMonth} onChange={(e) => setFbMonth(e.target.value)} className="form-control" style={sel} /></div>
            </div>
            <div style={{ textAlign: "center", marginBottom: "15px" }}>
              <button className="btn btn-primary" style={{ marginRight: 8, backgroundColor: "#428bca", borderColor: "#357ebd", color: "#fff" }} onClick={fbSend}>Send Feedback Link</button>
              <button className="btn btn-primary" style={{ marginRight: 8, backgroundColor: "#428bca", borderColor: "#357ebd", color: "#fff" }} onClick={fbReport}>Report</button>
              <button className="btn btn-primary" style={{ backgroundColor: "#428bca", borderColor: "#357ebd", color: "#fff" }} onClick={fbDownload}>Download</button>
            </div>
            <div style={{ overflowX: "auto", maxHeight: "400px" }} className="table-responsive">
              <table className="table" style={{ borderCollapse: "collapse", width: "100%", fontSize: "x-small", border: "1px solid #CCC" }}>
                <thead><tr style={{ fontWeight: "bold" }}>
                  <th style={th}>Sr No.</th><th style={th}>Client Name</th><th style={th}>State Name</th><th style={th}>Month</th><th style={th}>Year</th><th style={th}>Unit Name</th><th style={th}>Email Sent</th><th style={th}>Percent</th>
                </tr></thead>
                <tbody>
                  {fbRows.map((r, i) => (
                    <tr key={i}><td style={td}>{i + 1}</td><td style={td}>{r.client_name}</td><td style={td}>{r.state_name}</td><td style={td}>{r.month}</td><td style={td}>{r.year}</td><td style={td}>{r.unit_name}</td><td style={td}>{r.email_sent}</td><td style={td}>{r.percent}</td></tr>
                  ))}
                  {fbRows.length === 0 && <tr><td colSpan={8} style={{ padding: "10px", textAlign: "center" }}>No records found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 3 && (
          <div style={{ backgroundColor: "#fff", padding: "15px", border: "1px solid #ddd", borderTop: "none" }}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", marginBottom: "15px" }}>
              <div style={{ flex: "0 0 16.66%", paddingRight: "15px" }}><b>Select Month :</b><span style={{ color: "red" }}>*</span>
                <input type="month" value={mcMonth} onChange={(e) => setMcMonth(e.target.value)} className="form-control" style={sel} /></div>
              <div style={{ flex: "0 0 16.66%", paddingRight: "15px" }}><b>Client Name :</b><span style={{ color: "red" }}>*</span>
                <select value={mcClient} onChange={(e) => setMcClient(e.target.value)} className="form-control" style={sel}><option value="Select">Select</option>{clients.map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}</select></div>
              <div style={{ flex: "0 0 16.66%", paddingRight: "15px" }}><b>State Name :</b>
                <select value={mcState} onChange={(e) => setMcState(e.target.value)} className="form-control" style={sel}><option value="ALL">ALL</option>{mcStates.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
              <div style={{ flex: "0 0 16.66%", paddingRight: "15px" }}><b>Branch Name :</b>
                <select value={mcUnit} onChange={(e) => setMcUnit(e.target.value)} className="form-control" style={sel}><option value="ALL">ALL</option>{mcBranches.map((u) => <option key={u.v} value={u.v}>{u.t}</option>)}</select></div>
            </div>
            <div style={{ textAlign: "center", marginBottom: "15px" }}>
              <button onClick={mcShow} className="btn btn-primary" style={{ backgroundColor: "#428bca", borderColor: "#357ebd", color: "#fff" }}>Show</button>
            </div>
            {mcRows.length > 0 && expBtns(["Sr. No.", ...mcCols], mcRows.map((r, i) => [i + 1, ...mcCols.map((c) => r[c])]), "monthly_attendance_calendar")}
            <div style={{ overflowX: "auto", maxHeight: "400px" }} className="table-responsive">
              <table className="table" style={{ borderCollapse: "collapse", width: "100%", fontSize: "x-small", border: "1px solid #CCC" }}>
                <thead><tr style={{ fontWeight: "bold" }}><th style={th}>Sr. No.</th>{mcCols.map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
                <tbody>
                  {mcRows.map((r, i) => (
                    <tr key={i}><td style={td}>{i + 1}</td>{mcCols.map((c) => <td key={c} style={{ ...td, ...(r[c] === "P" ? { background: "green" } : r[c] === "W" ? { background: "pink" } : {}) }}>{r[c]}</td>)}</tr>
                  ))}
                  {mcRows.length === 0 && <tr><td colSpan={Math.max(mcCols.length + 1, 1)} style={{ padding: "10px", textAlign: "center" }}>No records found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 4 && (
          <div style={{ backgroundColor: "#fff", padding: "15px", border: "1px solid #ddd", borderTop: "none" }}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", marginBottom: "15px", alignItems: "flex-end" }}>
              <div style={{ flex: "0 0 20%", paddingRight: "15px" }}><b>Client Name :</b>
                <select value={apClient} onChange={(e) => setApClient(e.target.value)} className="form-control" style={sel}>{clients.filter((c) => c.v !== "ALL").map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}</select></div>
              <div style={{ flex: "0 0 16.66%", paddingRight: "15px" }}><b>From Date :</b><input type="date" value={apFrom} onChange={(e) => setApFrom(e.target.value)} className="form-control" style={sel} /></div>
              <div style={{ flex: "0 0 16.66%", paddingRight: "15px" }}><b>To Date :</b><input type="date" value={apTo} onChange={(e) => setApTo(e.target.value)} className="form-control" style={sel} /></div>
              <div style={{ flex: "0 0 10%" }}><button className="btn btn-primary" style={{ backgroundColor: "#428bca", borderColor: "#357ebd", color: "#fff" }} onClick={apShow}>SHOW</button></div>
            </div>
            <div style={{ overflowX: "auto", maxHeight: "400px" }} className="table-responsive">
              <table className="table" style={{ borderCollapse: "collapse", width: "100%", fontSize: "x-small", border: "1px solid #CCC" }}>
                <thead><tr style={{ fontWeight: "bold" }}><th style={th}>SR. NO.</th><th style={th}>Date</th><th style={th}>employee count</th><th style={th}>Total Android Attendence</th><th style={th}>Attendance Percentage</th></tr></thead>
                <tbody>
                  {apRows.map((r, i) => (<tr key={i}><td style={td}>{i + 1}</td><td style={td}>{r.attend_date}</td><td style={td}>{r.emp_cnt}</td><td style={td}>{r.total_attendence}</td><td style={td}>{r.atte_per}</td></tr>))}
                  {apRows.length === 0 && <tr><td colSpan={5} style={{ padding: "10px", textAlign: "center" }}>No records found</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
      {zoomSrc && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setZoomSrc("")}>
          <div style={{ background: "#fff", padding: 10, borderRadius: 4, maxWidth: "90vw", maxHeight: "90vh" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontWeight: "bold", marginBottom: 6 }}>Zoomed Image</div>
            <img src={zoomSrc} alt="" style={{ maxWidth: "85vw", maxHeight: "75vh" }} />
            <div style={{ textAlign: "center", marginTop: 8 }}><button type="button" className="btn btn-danger" onClick={() => setZoomSrc("")}>Close</button></div>
          </div>
        </div>
      )}
    </div>
  );
}