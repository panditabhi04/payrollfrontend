"use client";
// Sheet-wise attendance upload (bulk attendance page, third tab): one .xlsx, one sheet per branch,
// rows by employee NAME, day-wise marks. Backend: POST /api/attendance/bulk-attendance/sheet-upload/.
import React, { useState } from "react";
import { getJSON, upload, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

interface ClientItem { client_code: string; client_name: string; }
interface SheetResult {
  sheet: string; branch: string; unit_code: string; rows: number; saved: number;
  unmatched: string[]; notes: string[]; error: string;
}
interface Verification { manpower_in_file: number; manpower_matched: number; days_in_file: number; days_in_upload: number; match: boolean; }
interface Issue { sheet: string; branch: string; row: number | string; name: string; problem: string; }
interface Result { dry_run: boolean; saved: number; file_rows: number; sheets: SheetResult[]; message: string; verification?: Verification; issues?: Issue[]; }

const inp: React.CSSProperties = { marginTop: 5 };

export default function SheetWiseAttendance() {
  const [my, setMy] = useState("");                 // yyyy-mm
  const [client, setClient] = useState("Select");
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [autoFit, setAutoFit] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [res, setRes] = useState<Result | null>(null);

  React.useEffect(() => {
    getJSON<{ results: ClientItem[] }>(`/api/attendance/bulk-legacy/options/?kind=clients`).then((d) => setClients(d?.results ?? []));
  }, []);

  const downloadFormat = async () => {
    if (!my) { alert("Please Select Month/Year"); return; }
    if (client === "Select") { alert("Please Select Client"); return; }
    const q = `month_year=${encodeURIComponent(`${parseInt(my.split("-")[1], 10)}/${my.split("-")[0]}`)}&client_code=${encodeURIComponent(client)}`;
    const r = await fetch(`${API_BASE_URL}/api/attendance/bulk-attendance/sheet-template/?${q}`, { credentials: "include" });
    if (!r.ok) { alert(await responseMessage(r, "Download failed.")); return; }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    // state-wise: one Excel per state in a ZIP; the server names the file
    const cd = r.headers.get("Content-Disposition") || "";
    a.download = (cd.match(/filename="?([^";]+)"?/) || [])[1] || "Sheetwise_Attendance_Format.zip";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // every problem of the file (sheet, branch, row, employee, what is wrong) as an Excel sheet
  const downloadIssues = async () => {
    if (!my || client === "Select" || !file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("month_year", `${parseInt(my.split("-")[1], 10)}/${my.split("-")[0]}`);
    fd.append("client_code", client);
    if (autoFit) fd.append("auto_fit", "1");
    fd.append("error_excel", "1");
    const r = await upload(`/api/attendance/bulk-attendance/sheet-upload/`, fd);
    if (!r.ok) { alert(await responseMessage(r, "Download failed.")); return; }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ATTENDANCE_UPLOAD_PROBLEMS.xls";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const run = async (dry: boolean) => {
    if (!my) { alert("Please Select Month/Year"); return; }
    if (client === "Select") { alert("Please Select Client"); return; }
    if (!file) { alert("Please Upload File"); return; }
    if (!/\.xlsx$/i.test(file.name)) { alert("Please upload a valid excel file."); return; }
    setBusy(true); setMsg(""); setRes(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("month_year", `${parseInt(my.split("-")[1], 10)}/${my.split("-")[0]}`);
      fd.append("client_code", client);
      if (dry) fd.append("dry_run", "1");
      if (autoFit) fd.append("auto_fit", "1");
      const r = await upload(`/api/attendance/bulk-attendance/sheet-upload/`, fd);
      if (!r.ok) { const m = await responseMessage(r, "Upload failed."); setMsg(m); alert(m); return; }
      const b = (await r.json()) as Result;
      setRes(b); setMsg(b.message);
    } finally { setBusy(false); }
  };

  return (
    <>
      <p style={{ fontSize: 12, color: "#555" }}>
        One Excel file (.xlsx), <b>one sheet per branch</b>. Row 2 of every sheet must read
        &quot;Attendance Sheet for the month of SEPTEMBER-2026 Of &lt;client&gt; at &lt;Branch Name&gt;&quot;, then a header row
        <b>SL. NO. | NAME | Employees Status | RANK | 1 … last day</b>, then one employee per row (Employees Status = PERMANENT or
        RELIEVER; marks P, A, W …). Employees are matched by <b>name</b> and status. A file that does not follow this format is refused with a message.
        <b> PP</b> = the employee keeps one P and the second P goes to a Reliever of that branch. A blank day is Absent
        (Sunday = Weekly Off for a regular employee, Absent for a Reliever). Every sheet is saved with the normal
        Bulk Attendance rules; use <b>Check only</b> first.
      </p>
      <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end", marginBottom: "20px" }}>
        <div style={{ flex: "1 1 150px" }}><b>Month / Year :</b><span style={{ color: "red" }}>*</span>
          <input type="month" className="form-control" style={inp} value={my} onChange={(e) => setMy(e.target.value)} /></div>
        <div style={{ flex: "1 1 240px" }}><b>Client Name :</b><span style={{ color: "red" }}>*</span>
          <select className="form-control" style={inp} value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="Select">Select</option>
            {clients.map((x) => <option key={x.client_code} value={x.client_code}>{x.client_name}</option>)}
          </select></div>
        <div style={{ flex: "1 1 260px" }}><b>Upload file :</b><span style={{ color: "red" }}>*</span>
          <input type="file" accept=".xlsx" className="form-control" style={{ ...inp, padding: "4px" }}
            onChange={(e) => setFile(e.target.files?.[0] || null)} /></div>
      </div>
      <p style={{ textAlign: "center", marginBottom: 6, fontSize: 13 }}>
        <b>All rules are always checked:</b> a Reliever&apos;s present days not more than 30, Relievers&apos; present days together not more than the
        regular employees&apos; absent days, total present days not more than seat x days, and people present on a day not more
        than that day&apos;s strength (a row named STRENGTH / the bottom row of the sheet, else the one saved on the
        Attendance Sheet, else the branch seat).
      </p>
      <label style={{ display: "block", textAlign: "center", marginBottom: 12, fontSize: 13, }}>
        <input type="checkbox" checked={autoFit} onChange={(e) => setAutoFit(e.target.checked)} />{" "}
        <b>Auto-adjust Reliever days</b> to the limits (max 30 days each, and together not more than the regular employees&apos; absent days).
        Extra P days are removed from the end of the month; every change is listed below.
      </label>
      <div style={{ textAlign: "center", display: "flex", justifyContent: "center", gap: "10px" }}>
        <button className="btn btn-default" disabled={busy} onClick={downloadFormat}>Download Excel format</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => run(true)}>{busy ? "Working..." : "Check only (no save)"}</button>
        <button className="btn btn-primary" disabled={busy} onClick={() => run(false)}>{busy ? "Working..." : "Upload"}</button>
      </div>
      {msg && <div style={{ marginTop: 15, fontWeight: "bold", textAlign: "center" }}>{msg}</div>}
      {res?.verification && (
        <div style={{ marginTop: 15, textAlign: "center" }}>
          <table className="table table-bordered" style={{ width: "auto", margin: "0 auto" }}>
            <thead><tr><th></th><th>Manpower count</th><th>Days count</th></tr></thead>
            <tbody>
              <tr><td>In the file</td><td>{res.verification.manpower_in_file}</td><td>{res.verification.days_in_file}</td></tr>
              <tr><td>{res.dry_run ? "Will be saved" : "Saved"}</td><td>{res.verification.manpower_matched}</td><td>{res.verification.days_in_upload}</td></tr>
            </tbody>
          </table>
          <div style={{ fontWeight: "bold", color: res.verification.match ? "#2e7d32" : "#c62828" }}>
            {res.verification.match ? "Verified: manpower count and days count match the file." : "NOT verified: the counts above do not match the file. Check the notes / rule messages below."}
          </div>
        </div>
      )}
      {res && (res.issues?.length ?? 0) > 0 && (
        <div style={{ marginTop: 15, textAlign: "center" }}>
          <span style={{ color: "#c62828", fontWeight: "bold", marginRight: 10 }}>{res.issues!.length} problem(s) found in this file.</span>
          <button className="btn btn-warning" disabled={busy} onClick={downloadIssues}>Download problem list (Excel)</button>
        </div>
      )}
      {res && (
        <div style={{ marginTop: 15, overflowX: "auto" }}>
          <table className="table table-bordered table-striped">
            <thead><tr><th>Sheet</th><th>Branch</th><th>Rows in sheet</th><th>{res.dry_run ? "Ready to save" : "Saved"}</th><th>Not found in system</th><th>Notes / Rule message</th></tr></thead>
            <tbody>
              {res.sheets.map((s, i) => (
                <tr key={i}>
                  <td>{s.sheet}</td>
                  <td>{s.unit_code ? `${s.unit_code} - ` : ""}{s.branch}</td>
                  <td>{s.rows}</td>
                  <td>{s.saved}</td>
                  <td>{s.unmatched.join(", ")}</td>
                  <td style={{ color: s.error ? "#a94442" : undefined }}>{[s.error, ...s.notes].filter(Boolean).join(" | ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
