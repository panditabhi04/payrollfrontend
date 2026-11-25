"use client";
import React, { useState, useCallback, useEffect } from "react";
import { getJSONStrict, mk, upload, responseMessage } from "@/lib/api/legacy-fetch";
import { downloadAuthed } from "@/components/hrPrint";

// Legacy ihms_employee_details.aspx ("Resource Recruitment"): candidate import, approval /
// rejection workflow, appointment letter, join-employee, e-mail update and HA-BA mapping.
// Data and workflow come from /api/hr/resource-recruitment/ (legacy table pay_rm_emp_details).
const B = "/api/hr/resource-recruitment";

const KYC_TYPES: [string, string][] = [
  ["ALL", "ALL"], ["0", "Link Not Sent"], ["1", "Link Sent"], ["2", "Emp Data Updated"], ["3", "IHMS Approved"],
  ["4", "Offer Letter Sent"], ["5", "Offer Letter Accepted"], ["6", "Offer Letter Rejected"], ["7", "ZM Approved"],
  ["8", "ZM Rejected"], ["9", "IH&MS Rejected"], ["10", "Joining Letter Sent"], ["11", "Employee Joined"],
  ["12", "Appointment Letter Accepted"], ["13", "Appointment Letter Rejected"], ["14", "Appointment Letter Sent"],
  ["15", "Approved by Licensing Team"], ["16", "Rejected by Licensing Team"],
];

type Cand = {
  id: number; emp_code: string; emp_name: string; state_name: string; unit_code: string; designation: string;
  email_id: string; mob_no2: string; pan_number: string; send_email_flag: number; status: string; in_bucket: string;
  rejected_reason: string; father_name: string; dob: string; joining_date: string;
  so_jso_code: string; so_jso_name: string; rm_code: string; rm_name: string; zonal_code: string;
};
type Tab = "candidates" | "link" | "email" | "mapping" | "sendmail";
type MapRow = { emp_name: string; emp_code: string; so_jso_name: string; so_jso_code: string; rm_code: string; rm_name: string; cluster_code: string; cluster_name: string; zone_name: string };
type LinkGroup = { key: string; label: string; count: number; rows: Record<string, string>[] };

export default function ResourceRecruitmentPage() {
  const [tab, setTab] = useState<Tab>("candidates");
  const [flag, setFlag] = useState("ALL");
  const [stateName, setStateName] = useState("Select");
  const [unitCode, setUnitCode] = useState("Select");
  const [rows, setRows] = useState<Cand[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [branches, setBranches] = useState<{ unit_code: string; unit_name: string }[]>([]);
  const [linkGroups, setLinkGroups] = useState<LinkGroup[] | null>(null);
  const [linkOpen, setLinkOpen] = useState<string>("");
  const [lClient, setLClient] = useState("BJH");
  const [lState, setLState] = useState("Select");
  const [lUnit, setLUnit] = useState("Select");
  const [lBranches, setLBranches] = useState<{ unit_code: string; unit_name: string }[]>([]);
  const [emailInfo, setEmailInfo] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  // daily reports (legacy ddl_kyc_type for Daily_Report / Daily_full_Report)
  const [reportKyc, setReportKyc] = useState("Select");
  // candidate documents + details panels
  const [docFor, setDocFor] = useState<Cand | null>(null);
  const [docs, setDocs] = useState<{ doc_type: string; label: string; uploaded: boolean; file_name: string }[]>([]);
  const [docFiles, setDocFiles] = useState<Record<string, File | null>>({});
  const [detFor, setDetFor] = useState<Cand | null>(null);
  const [det, setDet] = useState<Record<string, string>>({});
  const [joined, setJoined] = useState<{ code: string; token: string } | null>(null);
  // update e-mail tab
  const [pan, setPan] = useState(""); const [newEmail, setNewEmail] = useState(""); const [shiftTo, setShiftTo] = useState("");
  // HA-BA mapping tab
  const [haCodes, setHaCodes] = useState("");
  const [mapRows, setMapRows] = useState<MapRow[]>([]);
  // View History popup (lnkView -> offer_letter_details.aspx)
  const [hist, setHist] = useState<{ name: string; cells: { label: string; value: string }[] } | null>(null);
  // Send Email tab (bulk HA/BA mail)
  const [mClient, setMClient] = useState("BJH");
  const [mState, setMState] = useState("Select");
  const [mUnit, setMUnit] = useState("Select");
  const [mBranches, setMBranches] = useState<{ unit_code: string; unit_name: string }[]>([]);
  const [mFile, setMFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    if (stateName === "Select") { alert("Please Select State Name"); return; }
    if (unitCode === "Select") { alert("Please Select Branch Name"); return; }
    setBusy(true);
    try {
      const q = new URLSearchParams({ send_email_flag: flag, state_name: stateName, unit_code: unitCode });
      const d = await getJSONStrict<{ results: Cand[]; message?: string }>(`${B}/list_candidates/?${q}`);
      setRows(d.results ?? []);
      if (d.message) alert(d.message);
    } catch (e: any) { alert(e.message); setRows([]); } finally { setBusy(false); }
  }, [flag, stateName, unitCode]);

  // bind_states(): states / branches of the client (BJH) from the masters
  useEffect(() => {
    getJSONStrict<{ results: { state_name: string }[] }>(`${B}/options/?kind=states&client_code=BJH`)
      .then((d) => setStates((d.results ?? []).map((x) => x.state_name))).catch(() => setStates([]));
  }, []);
  const onState = async (s: string) => {
    setStateName(s); setUnitCode("Select"); setBranches([]);
    if (s === "Select") return;
    try {
      const d = await getJSONStrict<{ results: { unit_code: string; unit_name: string }[] }>(
        `${B}/options/?kind=units&client_code=BJH&state_name=${encodeURIComponent(s === "ALL" ? "" : s)}`);
      setBranches(d.results ?? []);
    } catch { setBranches([]); }
  };
  const onLState = async (s: string) => {
    setLState(s); setLUnit("Select"); setLBranches([]);
    if (s === "Select") return;
    try {
      const d = await getJSONStrict<{ results: { unit_code: string; unit_name: string }[] }>(
        `${B}/options/?kind=units&client_code=${lClient}&state_name=${encodeURIComponent(s === "ALL" ? "" : s)}`);
      setLBranches(d.results ?? []);
    } catch { setLBranches([]); }
  };
  const showLinks = async () => {
    if (lState === "Select") { alert("Please Select State Name"); return; }
    if (lUnit === "Select") { alert("Please Select Branch Name"); return; }
    try {
      const q = new URLSearchParams({ client_code: lClient, state_name: lState, unit_code: lUnit });
      const d = await getJSONStrict<{ results: LinkGroup[] }>(`${B}/link_summary/?${q}`);
      setLinkGroups(d.results ?? []); setLinkOpen("");
    } catch (e: any) { alert(e.message); }
  };
  const lookupEmail = async () => {
    if (!pan.trim()) { alert("NO Records Found !!"); return; }
    try {
      const d = await getJSONStrict<{ status: string; emp_name: string; email_id: string }>(
        `${B}/email-lookup/?pan_number=${encodeURIComponent(pan.trim())}`);
      setEmailInfo(`Status: ${d.status} | Name: ${d.emp_name} | Old Email: ${d.email_id}`);
    } catch (e: any) { setEmailInfo(""); alert(e.message); }
  };

  const post = async (path: string, body: Record<string, unknown> | FormData, isForm = false) => {
    const r = isForm ? await upload(`${B}/${path}/`, body as FormData) : await mk(`${B}/${path}/`, body);
    if (!r.ok) { alert(await responseMessage(r, "Operation Failed, Please try again")); return null; }
    const b = await r.json().catch(() => ({} as any));
    alert(b.status || "Done");
    return b;
  };

  const doImport = async () => {
    if (!file) { alert("Please Upload Excel file !!!"); return; }
    const fd = new FormData(); fd.append("file", file);
    const b = await post("import_excel", fd, true);
    if (b) { setFile(null); load(); }
  };
  const act = async (id: number, kind: string, extra: Record<string, unknown> = {}) => {
    const b = await post(kind, { id, ...extra });
    if (b) load();
  };
  const reject = (c: Cand) => {
    const reason = (reasons[c.id] || "").trim();
    if (!reason) { alert("Please Enter Reject Reason !!"); return; }
    act(c.id, "reject", { rejected_reason: reason });
  };
  const del = (c: Cand) => {
    if (!confirm("Are you Sure You Want to Delete Record")) return;
    act(c.id, "delete_candidate");
  };
  const join = async (c: Cand) => {
    const b = await post("join_employee", { id: c.id });
    if (b) {
      if (b.login_setup_token) setJoined({ code: b.login_id ?? b.emp_code, token: b.login_setup_token });
      load();
    }
  };
  const report = (full: boolean) => {
    const q = reportKyc !== "Select" ? `?kyc_type=${encodeURIComponent(reportKyc)}` : "";
    void downloadAuthed(`${B}/${full ? "full_daily_report" : "daily_report"}/${q}`, full ? "Daily_full_Report.xlsx" : "Daily_Report.xlsx");
  };
  const openDocs = async (c: Cand) => {
    setDocFor(c); setDocFiles({});
    try {
      const d = await getJSONStrict<{ results: typeof docs }>(`${B}/documents/?id=${c.id}`);
      setDocs(d.results ?? []);
    } catch (e: any) { alert(e.message); setDocFor(null); }
  };
  const uploadDoc = async (docType: string) => {
    const f = docFiles[docType];
    if (!f) { alert("Please Select file first !!!"); return; }
    const fd = new FormData(); fd.append("id", String(docFor!.id)); fd.append("doc_type", docType); fd.append("file", f);
    const b = await post("upload-document", fd, true);
    if (b && docFor) openDocs(docFor);
  };
  const openDetails = (c: Cand) => {
    setDetFor(c);
    setDet({ father_name: c.father_name ?? "", dob: c.dob ?? "", joining_date: c.joining_date ?? "", pan_number: c.pan_number ?? "" });
  };
  const saveDetails = async () => {
    const b = await post("update_details", { id: detFor!.id, ...det });
    if (b) { setDetFor(null); load(); }
  };
  const updateEmail = async () => {
    if (!pan.trim()) { alert("NO Records Found !!"); return; }
    if (!newEmail.trim() || !/^\S+@\S+\.\S+$/.test(newEmail.trim())) { alert("Please enter valid email id...!!!"); return; }
    await post("update_email", { pan_number: pan.trim(), email_id: newEmail.trim(), shift_to: shiftTo });
  };
  const showMapping = async () => {
    try {
      const d = await getJSONStrict<{ results: MapRow[] }>(`${B}/ba_lookup/?codes=${encodeURIComponent(haCodes)}`);
      setMapRows(d.results ?? []);
    } catch (e: any) { alert(e.message); setMapRows([]); }
  };
  const editMap = (i: number, k: keyof MapRow, v: string) =>
    setMapRows((rs) => rs.map((r, j) => (j === i ? { ...r, [k]: v } : r)));
  const saveMapRow = async (r: MapRow) => {
    const b = await post("ba_mapping", {
      emp_code: r.emp_code, so_jso_code: r.so_jso_code, so_jso_name: r.so_jso_name,
      rm_code: r.rm_code, rm_name: r.rm_name, zonal_code: r.zone_name
    });
    if (b) showMapping();
  };
  const showHistory = async (c: Cand) => {
    try {
      const d = await getJSONStrict<{ emp_name: string; history: { label: string; value: string }[] }>(`${B}/history/?id=${c.id}`);
      setHist({ name: d.emp_name, cells: d.history });
    } catch (e: any) { alert(e.message); }
  };
  const onMState = async (st: string) => {
    setMState(st); setMUnit("Select"); setMBranches([]);
    if (st === "Select" || st === "ALL") return;
    try {
      const d = await getJSONStrict<{ results: { unit_code: string; unit_name: string }[] }>(
        `${B}/options/?kind=units&client_code=${mClient}&state_name=${encodeURIComponent(st)}`);
      setMBranches(d.results ?? []);
    } catch { setMBranches([]); }
  };
  const sendHaBaMail = async () => {
    if (!mFile) { alert("Please upload one file atleast..!!!"); return; }
    const fd = new FormData();
    fd.append("client_code", mClient); fd.append("state_name", mState); fd.append("unit_code", mUnit); fd.append("file", mFile);
    const b = await post("send_ha_ba_email", fd, true);
    if (b) { setMState("Select"); setMUnit("Select"); setMFile(null); }
  };

  const th = { padding: 4 } as const;
  return (
    <div className="lg-panel">
      <div className="lg-panel-head">Resource Recruitment</div>
      <div className="lg-panel-body">
        <div style={{ margin: "4px 0", textAlign: "right" }}><button onClick={() => { window.location.href = "/"; }}>Close</button></div>
        <div style={{ display: "flex", gap: 6, margin: "6px 0" }}>
          {([["candidates", "Employee KYC Details"], ["link", "Send Link"], ["email", "Update Email"], ["mapping", "HA-BA Mapping"], ["sendmail", "Send Email"]] as [Tab, string][]).map(([k, t]) => (
            <button key={k} onClick={() => setTab(k)} style={{ fontWeight: tab === k ? "bold" : "normal" }}>{t}</button>
          ))}
        </div>

        {tab === "candidates" && (
          <>
            <div style={{ margin: "6px 0" }}>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <button onClick={doImport}>Upload Excel Sheet</button>
            </div>
            <div style={{ margin: "6px 0", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <label>KYC Type:</label>
              <select value={flag} onChange={(e) => setFlag(e.target.value)}>
                {KYC_TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
              </select>
              <label>State Name:</label>
              <select value={stateName} onChange={(e) => onState(e.target.value)}>
                <option value="Select">Select</option><option value="ALL">ALL</option>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <label>Branch Name:</label>
              <select value={unitCode} onChange={(e) => setUnitCode(e.target.value)}>
                <option value="Select">Select</option><option value="ALL">ALL</option>
                {branches.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name || u.unit_code}</option>)}
              </select>
              <button onClick={load} disabled={busy}>Show</button>
              <span style={{ marginLeft: 12 }}>Report KYC Type:</span>
              <select value={reportKyc} onChange={(e) => setReportKyc(e.target.value)}>
                <option value="Select">Select</option><option>NG Global Approved</option>
                <option>Employee Joined</option><option>Emp Data Updated</option>
              </select>
              <button onClick={() => report(false)}>Daily Report</button>
              <button onClick={() => report(true)}>Full Daily Report</button>
            </div>
            {joined && (
              <div className="em-note" style={{ margin: "6px 0" }}>
                Employee <b>{joined.code}</b> joined. The login has no password; one-time setup token (shown once, give it to the employee for
                <code> /password-setup</code>): <code>{joined.token}</code> <button onClick={() => setJoined(null)}>Dismiss</button>
              </div>
            )}
            <div style={{ overflowX: "auto" }}>
              <table className="dt-grid">
                <thead><tr>
                  <th style={th}>Id</th><th>Emp Code</th><th>Name</th><th>Father Name</th><th>DOB</th><th>State</th>
                  <th>Branch</th><th>Designation</th><th>Mobile</th><th>Email</th><th>PAN</th><th>Joining Date</th>
                  <th>Status</th><th>Bucket</th><th>Reject Reason</th><th>Action</th>
                </tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td><td>{r.emp_code}</td><td>{r.emp_name}</td><td>{r.father_name}</td><td>{r.dob}</td>
                      <td>{r.state_name}</td><td>{(r as any).unit_name || r.unit_code}</td><td>{r.designation}</td><td>{r.mob_no2}</td>
                      <td>{r.email_id}</td><td>{r.pan_number}</td><td>{r.joining_date}</td>
                      <td>{r.status}</td><td>{r.in_bucket}</td>
                      <td><input value={reasons[r.id] ?? r.rejected_reason ?? ""} style={{ width: 130 }}
                        onChange={(e) => setReasons((m) => ({ ...m, [r.id]: e.target.value }))} /></td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        <button onClick={() => act(r.id, "approve")}>Approve</button>{" "}
                        <button onClick={() => reject(r)}>Reject</button>{" "}
                        <button onClick={() => act(r.id, "appointment")}>Appointment</button>{" "}
                        <button onClick={() => join(r)}>Join</button>{" "}
                        <button onClick={() => openDocs(r)}>Documents</button>{" "}
                        <button onClick={() => openDetails(r)}>Details</button>{" "}
                        <button onClick={() => showHistory(r)}>View</button>{" "}
                        <button onClick={() => del(r)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={16}>Click Show to list candidates.</td></tr>}
                </tbody>
              </table>
            </div>
            {docFor && (
              <div style={{ border: "1px solid #ccc", padding: 10, margin: "10px 0" }}>
                <b>Documents - {docFor.emp_name}</b>
                <table className="dt-grid">
                  <thead><tr><th>Document</th><th>Status</th><th>File</th><th>Upload (JPG, PNG, ZIP, PDF, JPEG)</th></tr></thead>
                  <tbody>
                    {docs.map((d) => (
                      <tr key={d.doc_type}>
                        <td>{d.label}</td><td>{d.uploaded ? "Uploaded" : "Not uploaded"}</td>
                        <td>{d.uploaded
                          ? <a href="#" onClick={(e) => { e.preventDefault(); void downloadAuthed(`${B}/download-document/?id=${docFor.id}&doc_type=${d.doc_type}`, d.file_name || "document"); }}>{d.file_name || "Download"}</a>
                          : ""}</td>
                        <td>
                          <input type="file" accept=".jpg,.jpeg,.png,.pdf,.zip,.rar" onChange={(e) => setDocFiles((m) => ({ ...m, [d.doc_type]: e.target.files?.[0] ?? null }))} />{" "}
                          <button onClick={() => uploadDoc(d.doc_type)}>Save</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <button onClick={() => setDocFor(null)}>Close</button>
              </div>
            )}
            {hist && (
              <div style={{ border: "1px solid #ccc", padding: 10, margin: "10px 0" }}>
                <b>Status history - {hist.name}</b>
                <div style={{ overflowX: "auto" }}>
                  <table className="dt-grid">
                    <thead><tr><th>Sr No.</th>{hist.cells.map((h) => <th key={h.label}>{h.label}</th>)}</tr></thead>
                    <tbody><tr><td>1</td>{hist.cells.map((h) => <td key={h.label}>{h.value}</td>)}</tr></tbody>
                  </table>
                </div>
                <button onClick={() => setHist(null)}>Close</button>
              </div>
            )}
            {detFor && (
              <div style={{ border: "1px solid #ccc", padding: 10, margin: "10px 0" }}>
                <b>Candidate details - {detFor.emp_name}</b>
                <div style={{ display: "grid", gridTemplateColumns: "200px 280px 200px 280px", gap: 6, margin: "6px 0" }}>
                  {([["father_name", "Father Name"], ["dob", "Date Of Birth (dd/mm/yyyy)"], ["joining_date", "Joining Date (dd/mm/yyyy)"],
                  ["pan_number", "Pan Number"], ["adhar_no", "Adhar Number"], ["present_address", "Present Address"],
                  ["pin_code", "PinCode"], ["mob_no1", "Mobile Number"], ["zone_name", "Zone"], ["zm_name", "Zonal Name"],
                  ["cluster_name", "Cluster Name"], ["client_branch_code", "Location Code"], ["background", "Background"],
                  ["company_name", "Company Name"], ["premium", "Premium (annualised in Crs)"], ["years_in_business", "Years in Business"],
                  ["no_of_active_customers", "No of Active Customers"], ["companies_associated", "Companies associated"],
                  ["current_club_memberships", "Current club Memberships"], ["fresh_business_commitment", "Annual Business commitment fresh business"],
                  ["roll_over_commitment", "Annual Business commitment Roll Over"]] as [string, string][]).map(([k, label]) => (
                    <React.Fragment key={k}>
                      <label>{label}:</label>
                      <input value={det[k] ?? ""} onChange={(e) => setDet((m) => ({ ...m, [k]: e.target.value }))} />
                    </React.Fragment>
                  ))}
                </div>
                <button onClick={saveDetails}>Update</button>{" "}<button onClick={() => setDetFor(null)}>Close</button>
              </div>
            )}
          </>
        )}

        {tab === "link" && (
          <>
            <div style={{ margin: "6px 0", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <label>Client:</label>
              <select value={lClient} onChange={(e) => setLClient(e.target.value)}><option value="BJH">BJH</option></select>
              <label>State Name:</label>
              <select value={lState} onChange={(e) => onLState(e.target.value)}>
                <option value="Select">Select</option><option value="ALL">ALL</option>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <label>Branch Name:</label>
              <select value={lUnit} onChange={(e) => setLUnit(e.target.value)}>
                <option value="Select">Select</option><option value="ALL">ALL</option>
                {lBranches.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name || u.unit_code}</option>)}
              </select>
              <button onClick={showLinks}>Send Link</button>
            </div>
            {linkGroups && (
              <div>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", margin: "8px 0" }}>
                  {linkGroups.map((g) => (
                    <button key={g.key} onClick={() => setLinkOpen(linkOpen === g.key ? "" : g.key)}
                      style={{ fontWeight: linkOpen === g.key ? "bold" : "normal" }}>{g.label}: {g.count}</button>
                  ))}
                </div>
                {linkGroups.filter((g) => g.key === linkOpen).map((g) => (
                  <table className="dt-grid" key={g.key}>
                    <thead><tr><th>Employee Name</th><th>Mobile</th><th>RM Name</th><th>Send Link By</th><th>Branch Manager</th><th>Status</th></tr></thead>
                    <tbody>
                      {g.rows.length === 0 ? <tr><td colSpan={6}>No Records</td></tr> : g.rows.map((r, i) => (
                        <tr key={i}><td>{r.emp_name}</td><td>{r.mob_no2}</td><td>{r.rm_name}</td><td>{r.send_link_by}</td><td>{r.branch_manager}</td><td>{r.send_email_flag}</td></tr>
                      ))}
                    </tbody>
                  </table>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "email" && (
          <div style={{ display: "grid", gridTemplateColumns: "180px 280px", gap: 8, maxWidth: 520, margin: "10px 0" }}>
            <label>PAN Number:</label><span><input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} maxLength={10} /> <button onClick={lookupEmail}>Show</button></span>
            {emailInfo && <><span></span><span>{emailInfo}</span></>}
            <label>New Email Id:</label><input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <label>Shift To:</label>
            <select value={shiftTo} onChange={(e) => setShiftTo(e.target.value)}>
              <option value="">Keep current status</option>
              <option value="2">Emp Data Updated</option>
              <option value="3">IHMS Approved</option>
            </select>
            <span></span><button onClick={updateEmail}>Update Email</button>
          </div>
        )}

        {tab === "mapping" && (
          <div style={{ margin: "10px 0" }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <label>Enter HA Codes (comma separated):</label>
              <input value={haCodes} onChange={(e) => setHaCodes(e.target.value)} style={{ width: 360 }} />
              <button onClick={showMapping}>Show</button>
            </div>
            {mapRows.length > 0 && (
              <div style={{ overflowX: "auto", marginTop: 8 }}>
                <table className="dt-grid">
                  <thead><tr><th>Employee Name</th><th>Employee Code</th><th>SO/JSO Name</th><th>SO/JSO Code</th><th>RM Code</th>
                    <th>RM Name</th><th>Cluster Name</th><th>Cluster Code</th><th>Zonal Code</th><th>Action</th></tr></thead>
                  <tbody>
                    {mapRows.map((r, i) => (
                      <tr key={r.emp_code}>
                        <td>{r.emp_name}</td><td>{r.emp_code}</td>
                        <td><input value={r.so_jso_name} onChange={(e) => editMap(i, "so_jso_name", e.target.value)} /></td>
                        <td><input value={r.so_jso_code} onChange={(e) => editMap(i, "so_jso_code", e.target.value)} /></td>
                        <td><input value={r.rm_code} onChange={(e) => editMap(i, "rm_code", e.target.value)} /></td>
                        <td><input value={r.rm_name} onChange={(e) => editMap(i, "rm_name", e.target.value)} /></td>
                        <td>{r.cluster_name}</td><td>{r.cluster_code}</td>
                        <td><input value={r.zone_name} onChange={(e) => editMap(i, "zone_name", e.target.value)} /></td>
                        <td><button onClick={() => saveMapRow(r)}>Update</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === "sendmail" && (
          <div style={{ margin: "10px 0", display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label>Client Name:</label>
            <select value={mClient} onChange={(e) => setMClient(e.target.value)}><option value="BJH">BJH</option></select>
            <label>State:</label>
            <select value={mState} onChange={(e) => onMState(e.target.value)}>
              <option value="Select">Select</option><option value="ALL">ALL</option>
              {states.map((s2) => <option key={s2} value={s2}>{s2}</option>)}
            </select>
            <label>Branch Name:</label>
            <select value={mUnit} onChange={(e) => setMUnit(e.target.value)}>
              <option value="Select">Select</option><option value="ALL">ALL</option>
              {mBranches.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name || u.unit_code}</option>)}
            </select>
            <input type="file" onChange={(e) => setMFile(e.target.files?.[0] ?? null)} />
            <button onClick={sendHaBaMail}>Send Email</button>
          </div>
        )}
      </div>
    </div>
  );
}
