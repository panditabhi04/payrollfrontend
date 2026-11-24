"use client";
// Attendance Sheet -> "Feedback Update" tab. 1:1 port of legacy emp_sample.aspx #menu11
// (Month/Year, Client, State, Branch, Attachment, "Feedback Report" link + report panel,
// feedback-head grid with Good / Satisfactory / Need Improvement / Any Other Remark, Save).
import React, { useEffect, useRef, useState } from "react";
import { getJSON, upload, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

interface ClientItem { client_code: string; client_name: string; }
interface UnitItem { unit_code: string; unit_name: string; client_code: string; state_name: string; }
interface HeadRow { feedback: string; good: boolean; satisfactory: boolean; need_improvement: boolean; remark: string; }

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const VALID_EXT = [".jpg", ".jpeg", ".gif", ".pdf"];   // legacy ValidateSingleInput()
const lbl: React.CSSProperties = { fontWeight: 700 };
const red: React.CSSProperties = { color: "red" };

// jQuery-UI style "mm/yy" picker (legacy .date-picker / .date-picker12): month+year only, 1990..current, no future.
function MonthYear({ value, onChange }: { value: { m: string; y: string }; onChange: (v: { m: string; y: string }) => void }) {
  const now = new Date();
  const curY = now.getFullYear(), curM = now.getMonth() + 1;
  const [open, setOpen] = useState(false);
  const [vy, setVy] = useState(curY);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);
  const display = value.m && value.y ? `${value.m.padStart(2, "0")}/${value.y}` : "";
  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <input className="form-control" readOnly value={display} placeholder="mm/yyyy" style={{ cursor: "pointer", background: "#fff" }}
        onClick={() => { setVy(value.y ? parseInt(value.y, 10) : curY); setOpen(o => !o); }} />
      {open && (
        <div style={{ position: "absolute", top: 38, left: 0, zIndex: 50, background: "#fff", border: "1px solid #428bca", borderRadius: 6, boxShadow: "0 4px 14px rgba(0,0,0,.25)", padding: 10, width: 230 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <button type="button" className="btn btn-default btn-xs" disabled={vy <= 1990} onClick={() => setVy(y => y - 1)}>&lsaquo;</button>
            <b style={{ color: "#006699" }}>{vy}</b>
            <button type="button" className="btn btn-default btn-xs" disabled={vy >= curY} onClick={() => setVy(y => y + 1)}>&rsaquo;</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 4 }}>
            {MONTHS.map((n, i) => {
              const dis = vy === curY && i + 1 > curM;
              const sel = value.m === String(i + 1) && value.y === String(vy);
              return (
                <button key={n} type="button" disabled={dis} className={"btn btn-xs " + (sel ? "btn-primary" : "btn-default")}
                  onClick={() => { onChange({ m: String(i + 1), y: String(vy) }); setOpen(false); }}>{n.slice(0, 3)}</button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function FeedbackUpdateTab() {
  const [my, setMy] = useState({ m: "", y: "" });
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [branch, setBranch] = useState("Select");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [rows, setRows] = useState<HeadRow[]>([]);
  const [showGrid, setShowGrid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [fromM, setFromM] = useState("0");
  const [toMY, setToMY] = useState({ m: "", y: "" });

  useEffect(() => {
    let alive = true;
    const loadClients = () => {
      getJSON<{ results: ClientItem[] }>(`/api/masters/clients/?page_size=all`).then(d => { if (alive) setClients(d?.results || []); });
    };
    loadClients();
    // The tab fetches only on mount — a client created in another tab
    // (e.g. Client Master) would never appear until full reload. Refresh
    // whenever the page becomes visible/focused again.
    const refresh = () => { if (!document.hidden) loadClients(); };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => { alive = false; document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); };
  }, []);
  useEffect(() => {
    if (client === "Select") { setUnits([]); return; }
    getJSON<{ units: UnitItem[] }>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(client)}`).then(d => setUnits(d?.units ?? []));
  }, [client]);

  const states = Array.from(new Set(units.map(u => u.state_name).filter(Boolean))).sort();
  const branches = units.filter(u => u.state_name === state);
  const clientName = clients.find(c => c.client_code === client)?.client_name || "";

  const resetGrid = () => { setRows([]); setShowGrid(false); };
  const onClient = (v: string) => { setClient(v); setState("Select"); setBranch("Select"); resetGrid(); };
  const onState = (v: string) => { setState(v); setBranch("Select"); resetGrid(); };

  // ddl_update_feedback_branch_SelectedIndexChanged -> previous_feedback()
  const onBranch = async (v: string) => {
    setBranch(v);
    resetGrid();
    if (v === "Select") return;
    const d = await getJSON<{ applicable: boolean; results: { feedback: string }[] }>(
      `/api/attendance/feedback-update/?client_code=${encodeURIComponent(client)}`);
    if (d && d.applicable && d.results.length) {
      setRows(d.results.map(r => ({ feedback: r.feedback, good: false, satisfactory: false, need_improvement: false, remark: "" })));
      setShowGrid(true);
    }
  };

  const setCell = (i: number, f: "good" | "satisfactory" | "need_improvement", on: boolean) =>
    setRows(rs => rs.map((r, k) => k === i ? { ...r, [f]: on } : r));
  // header checkboxes (legacy jQuery): tick the whole column and clear the other two columns
  const headerPick = (f: "good" | "satisfactory" | "need_improvement", on: boolean) =>
    setRows(rs => rs.map(r => ({ ...r, good: false, satisfactory: false, need_improvement: false, [f]: on })));
  const headerState = (f: "good" | "satisfactory" | "need_improvement") => rows.length > 0 && rows.every(r => r[f]);

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] || null;
    if (f && !VALID_EXT.some(x => f.name.toLowerCase().endsWith(x))) {
      alert("Sorry, " + f.name + " is invalid, allowed extensions are: " + VALID_EXT.join(", "));
      setFileKey(k => k + 1); setFile(null); return;
    }
    setFile(f);
  };

  // feedback_validation()
  const save = async () => {
    if (!my.m || !my.y) { alert("Please Select Month/Year "); return; }
    if (client === "Select") { alert("Please Select Client Name... "); return; }
    if (state === "Select") { alert("Please Select State Name... "); return; }
    if (branch === "Select") { alert("Please Select Branch Name... "); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("month_year", `${my.m.padStart(2, "0")}/${my.y}`);
      fd.append("client_code", client);
      fd.append("state_name", state);
      fd.append("unit_code", branch);
      fd.append("rows", JSON.stringify(rows.map(r => ({
        feedback: r.feedback, good: r.good, satisfactory: r.satisfactory,
        need_improvement: r.need_improvement, remark: r.remark }))));
      if (file) fd.append("attachment", file);
      const res = await upload("/api/attendance/feedback-update/save/", fd);
      if (!res.ok) { alert(await responseMessage(res, "Request failed.")); return; }
      alert("Feedback is Save successfully.......!");
      // legacy resets Month/Year, Client, State, Branch after a successful save
      setMy({ m: "", y: "" }); setClient("Select"); setState("Select"); setBranch("Select");
      setFile(null); setFileKey(k => k + 1); resetGrid();
    } finally { setBusy(false); }
  };

  // feedback_report_validation() + btn_feedback_report_Click
  const report = async () => {
    if (client === "Select") { alert("Please Select Client Name... "); return; }
    if (fromM === "0") { alert("Please select from month !!"); return; }
    if (!toMY.m || !toMY.y) { alert("Please select to month !!"); return; }
    setBusy(true);
    try {
      const qs = new URLSearchParams({
        client_code: client, state_name: state === "Select" ? "" : state, unit_code: branch === "Select" ? "" : branch,
        from_month: fromM, to_month: `${toMY.m.padStart(2, "0")}/${toMY.y}`,
      });
      const res = await fetch(`${API_BASE_URL}/api/attendance/feedback-update/report/?${qs.toString()}`, { credentials: "include" });
      if (!res.ok) { alert(await responseMessage(res, "File Not Download...!!")); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Feedback_" + (clientName || client).replace(/[ ,.]/g, "_") + ".xls";
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="row">
        <div className="col-sm-2 col-xs-12">
          <span style={lbl}>Month / Year :</span><span style={red}>*</span>
          <MonthYear value={my} onChange={setMy} />
        </div>
        <div className="col-sm-2 col-xs-12">
          <span style={lbl}>Client Name :</span> <span style={red}>*</span>
          <select className="form-control" value={client} onChange={e => onClient(e.target.value)}>
            <option value="Select">Select</option>
            {clients.map(c => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <span style={lbl}>State Name: :</span><span style={red}>*</span>
          <select className="form-control" value={state} onChange={e => onState(e.target.value)}>
            <option value="Select">Select</option>
            {client !== "Select" && <option value="ALL">ALL</option>}
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <span style={lbl}>Branch Name:</span><span style={red}>*</span>
          <select className="form-control" value={branch} onChange={e => onBranch(e.target.value)}>
            <option value="Select">Select</option>
            {state !== "Select" && <option value="ALL">ALL</option>}
            {branches.map(u => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <span style={lbl}>Attachment :</span><span style={red}>*</span>
          <input key={fileKey} type="file" onChange={onFile} accept=".jpg,.jpeg,.gif,.pdf" />
          <b>JPEG JPG GIF PDF</b>
        </div>
      </div>

      <br /><br />
      <div className="row">
        <div className="text-center">
          <a href="#" style={{ color: "blue", fontWeight: 700 }}
            onClick={e => { e.preventDefault(); setShowReport(s => !s); }}>Feedback Report</a>
        </div>
        {showReport && (
          <div className="row">
            <div className="col-sm-8 col-md-offset-2">
              <div className="panel panel-primary" style={{ borderColor: "white", background: "white" }}>
                <br />
                <div className="row">
                  <div className="col-sm-3 col-sm-offset-1">
                    <label>From Month :</label><span style={red}>*</span>
                    <select className="form-control" value={fromM} onChange={e => setFromM(e.target.value)}>
                      <option value="0">Select Month</option>
                      {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
                    </select>
                  </div>
                  <div className="col-sm-3 col-sm-offset-1">
                    <label>To Month :</label><span style={red}>*</span>
                    <MonthYear value={toMY} onChange={setToMY} />
                  </div>
                  <div className="col-sm-3 col-sm-offset-1">
                    <br />
                    <button type="button" className="btn btn-primary text-center" disabled={busy} onClick={report}>Report</button>
                  </div>
                </div>
                <br />
              </div>
            </div>
          </div>
        )}
      </div>

      {showGrid && (
        <div className="row" style={{ marginTop: "3%", textAlign: "center", marginLeft: "15%" }}>
          <table className="table" style={{ width: "75%", background: "#fff", border: "1px solid #ccc" }}>
            <thead>
              <tr style={{ background: "#006699", color: "#fff", textTransform: "uppercase" }}>
                <th>Sr No.</th>
                <th>Particular</th>
                <th>GOOD<input type="checkbox" className="center-block" checked={headerState("good")} onChange={e => headerPick("good", e.target.checked)} /></th>
                <th>Satisfactory<input type="checkbox" className="center-block" checked={headerState("satisfactory")} onChange={e => headerPick("satisfactory", e.target.checked)} /></th>
                <th>Need Improvement<input type="checkbox" className="center-block" checked={headerState("need_improvement")} onChange={e => headerPick("need_improvement", e.target.checked)} /></th>
                <th>Any Other Remark</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ color: "#000066", background: "#fff" }}>
                  <td>{i + 1}</td>
                  <td>{r.feedback}</td>
                  <td><input type="checkbox" className="center-block" checked={r.good} onChange={e => setCell(i, "good", e.target.checked)} /></td>
                  <td><input type="checkbox" className="center-block" checked={r.satisfactory} onChange={e => setCell(i, "satisfactory", e.target.checked)} /></td>
                  <td><input type="checkbox" className="center-block" checked={r.need_improvement} onChange={e => setCell(i, "need_improvement", e.target.checked)} /></td>
                  <td><input type="text" className="center-block" value={r.remark}
                    onChange={e => setRows(rs => rs.map((x, k) => k === i ? { ...x, remark: e.target.value } : x))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="text-center" style={{ marginLeft: "-15%" }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={save}>Save</button>
          </div>
        </div>
      )}
    </div>
  );
}
