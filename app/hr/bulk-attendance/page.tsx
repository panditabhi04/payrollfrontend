"use client";
// Port of upload_bulk_attendance.aspx: "Bulk Attendance" (totals sheet -> pay_attendance_muster,
// approve with head-count checks, attachment, rejected grid) and "Bulk Incentive" (= Conveyance:
// policy check, pay_conveyance_amount_history, approve, conveyance images).
import React, { useState, useCallback } from "react";
import { getJSON, upload, mk, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";
import SheetWiseAttendance from "@/components/SheetWiseAttendance";

const B = "/api/attendance/bulk-legacy";

interface ClientItem { client_code: string; client_name: string; }
interface UnitItem { unit_code: string; unit_name: string; state_name: string; }
interface ResultRow { emp_code: string; unit_code: string; present: string; absent: string; weekoffs: string; comments: string; row?: string[]; emp_name?: string; incentive?: string; }
interface RejRow { unit_code: string; client_name: string; state_name: string; branch_name: string; month_year: string; file_name: string; rejected_reason: string; }

export default function BulkAttendancePage() {
  const [activeTab, setActiveTab] = useState<"att" | "inc" | "sheet">("att");

  // Bulk Attendance filters
  const [my, setMy] = useState("");              // yyyy-mm
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [unit, setUnit] = useState("Select");
  // Bulk Incentive filters
  const [imy, setImy] = useState("");
  const [iclient, setIclient] = useState("Select");
  const [istate, setIstate] = useState("Select");
  const [iunit, setIunit] = useState("Select");

  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [desc, setDesc] = useState("");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [incFile, setIncFile] = useState<File | null>(null);
  const [incImg, setIncImg] = useState<File | null>(null);

  const [clients, setClients] = useState<ClientItem[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [istates, setIstates] = useState<string[]>([]);
  const [iunits, setIunits] = useState<UnitItem[]>([]);

  const [uploaded, setUploaded] = useState(false);
  const [results, setResults] = useState<ResultRow[] | null>(null);
  const [rejected, setRejected] = useState<RejRow[]>([]);
  const [msgRaw, setMsgRaw] = useState("");
  const [msgOk, setMsgOk] = useState(true);
  const [busy, setBusy] = useState(false);
  const setMsg = (m: string, ok?: boolean) => {
    setMsgRaw(m);
    setMsgOk(ok !== undefined ? ok : /success|uploaded|approved|saved/i.test(m) && !/not |fail|cannot|already|invalid|no matching|no record|please/i.test(m));
  };

  const toMY = (v: string) => (v ? `${v.split("-")[1]}/${v.split("-")[0]}` : "");

  React.useEffect(() => {
    getJSON<{ results: ClientItem[] }>(`${B}/options/?kind=clients`).then((d) => setClients(d?.results ?? []));
  }, []);

  const loadStates = async (c: string, set: (s: string[]) => void) => {
    if (c === "Select") { set([]); return; }
    const d = await getJSON<{ results: { state_name: string }[] }>(`${B}/options/?kind=states&client_code=${encodeURIComponent(c)}`);
    set((d?.results ?? []).map((x) => x.state_name));
  };
  const loadUnits = async (c: string, s: string, set: (u: UnitItem[]) => void) => {
    if (c === "Select" || s === "Select") { set([]); return; }
    const d = await getJSON<{ results: UnitItem[] }>(`${B}/options/?kind=units&client_code=${encodeURIComponent(c)}&state=${encodeURIComponent(s)}`);
    set(d?.results ?? []);
  };

  const validate = useCallback((tab: "att" | "inc", needFile: File | null | undefined, wantFile: boolean) => {
    const [m, c, s, u] = tab === "att" ? [my, client, state, unit] : [imy, iclient, istate, iunit];
    if (!m) { alert("Please Select Month/Year"); return false; }
    if (!c || c === "Select") { alert("Please Select Client"); return false; }
    if (!s || s === "Select") { alert("Please Select State"); return false; }
    if (!u || u === "Select") { alert("Please Select Branch"); return false; }
    if (wantFile && !needFile) { alert("Please Upload File"); return false; }
    return true;
  }, [my, client, state, unit, imy, iclient, istate, iunit]);

  const post = async (path: string, fd: FormData) => {
    const r = await upload(`${B}/${path}`, fd);
    return r;
  };
  const baseForm = (tab: "att" | "inc") => {
    const fd = new FormData();
    const [m, c, s, u] = tab === "att" ? [my, client, state, unit] : [imy, iclient, istate, iunit];
    fd.append("month_year", toMY(m)); fd.append("client_code", c); fd.append("state", s); fd.append("unit_code", u);
    return fd;
  };

  const downloadFormat = async () => {
    if (!validate("att", null, false)) return;
    const q = new URLSearchParams({ month_year: toMY(my), client_code: client, state, unit_code: unit });
    const r = await fetch(`${API_BASE_URL}${B}/download-format/?${q.toString()}`, { credentials: "include" });
    if (!r.ok) { setMsg(await responseMessage(r, "Failed to download format"), false); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await r.blob()); a.download = "BULK_ATTENDANCE_UPLOAD_FORMAT.xlsx"; a.click();
  };

  // the uploaded rows with their Comments as an Excel sheet (the rows that were not uploaded are coloured)
  const downloadResult = async (rows: ResultRow[]) => {
    const fd = new FormData();
    fd.append("results", JSON.stringify(rows.map((x) => ({ emp_code: x.emp_code, unit_code: x.unit_code, present: x.present, absent: x.absent, weekoffs: x.weekoffs, comments: x.comments }))));
    const r = await post("result-excel/", fd);
    if (!r.ok) { setMsg(await responseMessage(r, "Failed to download the result"), false); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await r.blob());
    a.download = "Bulk_Attendance_Result.xls"; document.body.appendChild(a); a.click(); a.remove();
  };

  const uploadAttendance = async () => {
    if (!validate("att", csvFile, true)) return;
    const ext = (csvFile!.name.match(/\.[^.]+$/)?.[0] || "").toLowerCase();
    if (![".xls", ".xlsx", ".csv"].includes(ext)) { alert("Please upload a valid excel file."); return; }
    setBusy(true); setMsg("");
    try {
      const fd = baseForm("att"); fd.append("file", csvFile!);
      const r = await post("upload/", fd);
      if (!r.ok) { setMsg(await responseMessage(r, "Upload failed."), false); return; }
      const b = await r.json();
      setResults(b.results ?? []);
      setUploaded(!!b.uploaded);
      if ((b.results ?? []).length) downloadResult(b.results);
      setMsg(b.uploaded ? b.message : "No attendance was uploaded - see the Comments column.", !!b.uploaded);
      if (b.uploaded) setCsvFile(null);
    } finally { setBusy(false); }
  };

  const loadRejected = async () => {
    const q = new URLSearchParams({ month_year: toMY(my), client_code: client, state, unit_code: unit });
    const d = await getJSON<{ results: RejRow[] }>(`${B}/rejected/?${q.toString()}`);
    setRejected(d?.results ?? []);
  };

  const approveRecord = async () => {
    if (!validate("att", null, false)) return;
    if (!confirm("Are you Sure You Want to Approve Record")) { alert("Record not Available"); return; }
    setBusy(true);
    try {
      const r = await post("approve/", baseForm("att"));
      if (!r.ok) { const m = await responseMessage(r, "Approve failed"); setMsg(m, false); alert(m); return; }
      const b = await r.json();
      setMsg(b.status); alert(b.status);
      loadRejected();
    } finally { setBusy(false); }
  };

  const uploadAttachment = async () => {
    if (!validate("att", null, false)) return;
    if (!docFile) { alert("Please Upload File"); return; }
    setBusy(true);
    try {
      const fd = baseForm("att"); fd.append("file", docFile); fd.append("description", desc);
      const r = await post("attachment/", fd);
      if (!r.ok) { const m = await responseMessage(r, "Upload failed."); setMsg(m, false); alert(m); return; }
      const b = await r.json();
      setMsg(b.status); alert(b.status);
      setDocFile(null); setDesc("");
    } finally { setBusy(false); }
  };

  const downloadAttachment = async (fileName: string, unitName: string) => {
    if (!fileName) { alert("Attachment File Cannot Be Uploaded !!!"); return; }
    const q = new URLSearchParams({ file_name: fileName, unit_name: unitName });
    const r = await fetch(`${API_BASE_URL}${B}/download-attachment/?${q.toString()}`, { credentials: "include" });
    if (!r.ok) { alert(await responseMessage(r, "Attachment File Cannot Be Uploaded !!!")); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await r.blob()); a.download = `${unitName}-Attendance${fileName.slice(fileName.lastIndexOf("."))}`; a.click();
  };

  // ---- Bulk Incentive (Conveyance)
  const uploadIncentive = async () => {
    if (!validate("inc", incFile, true)) return;
    const ext = (incFile!.name.match(/\.[^.]+$/)?.[0] || "").toLowerCase();
    if (![".xls", ".xlsx", ".csv"].includes(ext)) { alert("Please upload a valid excel file."); return; }
    setBusy(true); setMsg("");
    try {
      const fd = baseForm("inc"); fd.append("file", incFile!);
      const r = await post("incentive-upload/", fd);
      if (!r.ok) { const m = await responseMessage(r, "Upload failed."); setMsg(m, false); return; }
      const b = await r.json();
      setResults(b.results ?? []);
      setMsg(b.message || "No conveyance was saved - see the Comments column.", !!b.uploaded);
      if (b.message) alert(b.message);
      if (b.uploaded) setIncFile(null);
    } finally { setBusy(false); }
  };
  const approveIncentive = async () => {
    if (!validate("inc", null, false)) return;
    setBusy(true);
    try {
      const r = await post("incentive-approve/", baseForm("inc"));
      if (!r.ok) { const m = await responseMessage(r, "Approve failed"); setMsg(m, false); alert(m); return; }
      const b = await r.json();
      setMsg(b.status); alert(b.status);
    } finally { setBusy(false); }
  };
  const uploadIncImages = async () => {
    if (!validate("inc", null, false)) return;
    if (!incImg) { alert("Please Upload File"); return; }
    setBusy(true);
    try {
      const fd = baseForm("inc"); fd.append("file", incImg);
      const r = await post("incentive-images/", fd);
      if (!r.ok) { const m = await responseMessage(r, "Upload failed."); setMsg(m, false); alert(m); return; }
      const b = await r.json();
      setMsg(b.status); alert(b.status); setIncImg(null);
    } finally { setBusy(false); }
  };

  const filters = (tab: "att" | "inc") => {
    const isA = tab === "att";
    const [m, c, s, u] = isA ? [my, client, state, unit] : [imy, iclient, istate, iunit];
    const stList = isA ? states : istates;
    const unList = isA ? units : iunits;
    const setM = isA ? setMy : setImy;
    const onClient = (v: string) => {
      if (isA) { setClient(v); setState("Select"); setUnit("Select"); setUnits([]); loadStates(v, setStates); }
      else { setIclient(v); setIstate("Select"); setIunit("Select"); setIunits([]); loadStates(v, setIstates); }
    };
    const onState = (v: string) => {
      if (isA) { setState(v); setUnit("Select"); loadUnits(client, v, setUnits); }
      else { setIstate(v); setIunit("Select"); loadUnits(iclient, v, setIunits); }
    };
    return (
      <>
        <div style={{ flex: "1 1 150px" }}><b>Month / Year :</b><span style={{ color: "red" }}>*</span>
          <input type="month" className="form-control" style={inp} value={m} onChange={(e) => setM(e.target.value)} /></div>
        <div style={{ flex: "1 1 200px" }}><b>Client Name :</b><span style={{ color: "red" }}>*</span>
          <select className="form-control" style={inp} value={c} onChange={(e) => onClient(e.target.value)}>
            <option value="Select">Select</option>
            {clients.map((x) => <option key={x.client_code} value={x.client_code}>{x.client_name}</option>)}
          </select></div>
        <div style={{ flex: "1 1 150px" }}><b>State Name :</b><span style={{ color: "red" }}>*</span>
          <select className="form-control" style={inp} value={s} onChange={(e) => onState(e.target.value)}>
            <option value="Select">Select</option><option value="ALL">ALL</option>
            {stList.map((x) => <option key={x} value={x}>{x}</option>)}
          </select></div>
        <div style={{ flex: "1 1 200px" }}><b>Branch Name :</b><span style={{ color: "red" }}>*</span>
          <select className="form-control" style={inp} value={u}
            onChange={(e) => (isA ? setUnit(e.target.value) : setIunit(e.target.value))}
            onFocus={() => { if (s === "ALL" && unList.length === 0) loadUnits(c, s, isA ? setUnits : setIunits); }}>
            <option value="Select">Select</option><option value="ALL">ALL</option>
            {unList.map((x) => <option key={x.unit_code} value={x.unit_code}>{x.unit_name}</option>)}
          </select></div>
      </>
    );
  };

  return (
    <section style={{ padding: "15px", fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px", backgroundColor: "#fff" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", textAlign: "center", textTransform: "uppercase", fontSize: "small", fontWeight: "bold" }}>
          EMPLOYEE ATTENDANCE
        </div>
        <br />
        <div style={{ background: "beige", padding: "15px", minHeight: "500px" }}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", borderBottom: "1px solid #ccc" }}>
            {([["att", "Bulk Attendance"], ["inc", "Bulk Incentive"], ["sheet", "Excel Sheet-wise (by name)"]] as const).map(([k, t]) => (
              <li key={k} style={{ marginBottom: "-1px" }}>
                <a href="#" onClick={(e) => { e.preventDefault(); setActiveTab(k); setMsg(""); setResults(null); }}
                  style={{ display: "block", padding: "10px 15px", textDecoration: "none", background: activeTab === k ? "#fff" : "#eee", color: activeTab === k ? "#555" : "#00547E", border: "1px solid #ccc", borderBottomColor: activeTab === k ? "transparent" : "#ccc", borderRadius: "4px 4px 0 0", fontWeight: activeTab === k ? "bold" : "normal" }}>{t}</a>
              </li>
            ))}
          </ul>

          <div style={{ background: "#fff", border: "1px solid #ccc", borderTop: "none", padding: "20px" }}>
            {msgRaw && <div style={{ color: msgOk ? "green" : "#a94442", fontWeight: "bold", textAlign: "center", marginBottom: "15px", padding: "10px", background: msgOk ? "#dff0d8" : "#f2dede", border: msgOk ? "1px solid #d6e9c6" : "1px solid #ebccd1", borderRadius: "4px" }}>{msgRaw}</div>}

            {activeTab === "sheet" && <SheetWiseAttendance />}

            {activeTab === "att" && (
              <>
                <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end", marginBottom: "20px" }}>
                  {filters("att")}
                  <div style={{ flex: "1 1 200px" }}><b>Upload file</b>
                    <input type="file" accept=".xls,.xlsx,.csv" className="form-control" style={{ ...inp, padding: "4px" }} onChange={(e) => setCsvFile(e.target.files?.[0] || null)} />
                  </div>
                </div>
                <div style={{ textAlign: "center", display: "flex", justifyContent: "center", gap: "10px" }}>
                  <button className="btn btn-primary" style={btn} onClick={downloadFormat} disabled={busy}>Download</button>
                  <button className="btn btn-primary" style={btn} onClick={uploadAttendance} disabled={busy}>{busy ? "Working..." : "Upload"}</button>
                  <button className="btn btn-primary" style={btn} onClick={approveRecord} disabled={busy}>Approve</button>
                </div>

                {uploaded && (
                  <div style={{ marginTop: 24, background: "#f7f7f7", borderRadius: 4, padding: 12 }}>
                    <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end" }}>
                      <div style={{ flex: "1 1 200px" }}><b>Description :</b>
                        <input type="text" className="form-control" style={inp} maxLength={200} value={desc} onChange={(e) => setDesc(e.target.value)} />
                      </div>
                      <div style={{ flex: "1 1 300px" }}><b>File to Upload :</b>
                        <input type="file" accept=".jpg,.jpeg,.png,.pdf,.rar,.zip" className="form-control" style={{ ...inp, padding: "4px" }} onChange={(e) => setDocFile(e.target.files?.[0] || null)} />
                        <b style={{ color: "#f00", fontSize: 12 }}>Note :</b> <span style={{ fontSize: 12 }}>Only JPG, PNG, JPEG and PDF files will be uploaded.</span>
                      </div>
                      <div style={{ marginBottom: 20 }}>
                        <button className="btn btn-primary" style={btn} onClick={uploadAttachment} disabled={busy}>Upload</button>
                      </div>
                    </div>
                  </div>
                )}

                {results && (
                  <div style={{ marginTop: 20, overflowX: "auto" }}>
                    <table className="table table-bordered table-striped">
                      <thead style={{ background: "#006699", color: "#fff" }}>
                        <tr><th>Employee Code</th><th>Branch Code</th><th>TOTAL PRESENT DAYS</th><th>TOTAL ABSENT DAYS</th><th>TOTAL WEEKOFFS</th><th>Comments</th></tr>
                      </thead>
                      <tbody>
                        {results.map((x, i) => (
                          <tr key={i}><td>{x.emp_code}</td><td>{x.unit_code}</td><td>{x.present}</td><td>{x.absent}</td><td>{x.weekoffs}</td><td>{x.comments}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {rejected.length > 0 && (
                  <div style={{ marginTop: 20, overflowX: "auto" }}>
                    <table className="table table-bordered table-striped">
                      <thead style={{ background: "#006699", color: "#fff" }}>
                        <tr><th>CLIENT NAME</th><th>STATE NAME</th><th>BRANCH NAME</th><th>MONTH YEAR</th><th>Attendance_file</th><th>DOWNLOAD</th><th>REJECTED REASON</th></tr>
                      </thead>
                      <tbody>
                        {rejected.map((x, i) => (
                          <tr key={i}>
                            <td>{x.client_name}</td><td>{x.state_name}</td><td>{x.branch_name}</td><td>{x.month_year}</td><td>{x.file_name}</td>
                            <td><a href="#" onClick={(e) => { e.preventDefault(); downloadAttachment(x.file_name, x.branch_name); }}>Attendance Sheet</a></td>
                            <td>{x.rejected_reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {activeTab === "inc" && (
              <>
                <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end", marginBottom: "20px" }}>
                  {filters("inc")}
                  <div style={{ flex: "1 1 200px" }}><b>Upload file</b>
                    <input type="file" accept=".xls,.xlsx,.csv" className="form-control" style={{ ...inp, padding: "4px" }} onChange={(e) => setIncFile(e.target.files?.[0] || null)} />
                  </div>
                </div>
                <div style={{ textAlign: "center", display: "flex", justifyContent: "center", gap: "10px" }}>
                  <button className="btn btn-primary" style={btn} onClick={uploadIncentive} disabled={busy}>{busy ? "Working..." : "Upload"}</button>
                  <button className="btn btn-primary" style={btn} onClick={approveIncentive} disabled={busy}>Approve</button>
                </div>

                <div style={{ marginTop: 24, background: "#f7f7f7", borderRadius: 4, padding: 12 }}>
                  <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end" }}>
                    <div style={{ flex: "1 1 300px" }}><b>File to Upload :</b>
                      <input type="file" accept=".jpg,.jpeg,.png,.pdf,.zip" className="form-control" style={{ ...inp, padding: "4px" }} onChange={(e) => setIncImg(e.target.files?.[0] || null)} />
                      <b style={{ color: "#f00", fontSize: 12 }}>Note :</b> <span style={{ fontSize: 12 }}>Only JPG, PNG, JPEG and PDF files will be uploaded.</span>
                    </div>
                    <div style={{ marginBottom: 20 }}>
                      <button className="btn btn-primary" style={btn} onClick={uploadIncImages} disabled={busy}>Upload</button>
                    </div>
                  </div>
                </div>

                {results && (
                  <div style={{ marginTop: 20, overflowX: "auto" }}>
                    <table className="table table-bordered table-striped">
                      <thead style={{ background: "#006699", color: "#fff" }}>
                        <tr><th>Employee Code</th><th>Employee Name</th><th>Branch Code</th><th>INCENTIVE</th><th>Comments</th></tr>
                      </thead>
                      <tbody>
                        {results.map((x, i) => (
                          <tr key={i}><td>{x.emp_code}</td><td>{x.emp_name}</td><td>{x.unit_code}</td><td>{x.incentive}</td><td>{x.comments}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const inp: React.CSSProperties = { width: "100%", height: "34px", borderRadius: "4px", border: "1px solid #ccc" };
const btn: React.CSSProperties = { background: "#337ab7", border: "1px solid #2e6da4", color: "#fff", padding: "6px 20px", borderRadius: "4px", minWidth: "120px" };
