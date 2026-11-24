"use client";

/**
 * Client Billing (grade_unit_billing.aspx) - the panels that sit around the Manpower Billing buttons:
 *   Approve Attendance By Admin (Finance attendance approval / rejection grid)
 *   Branch Having No Deployment (approve / hold)
 *   Notification panels (attendance_status: the eight category grids)
 *   Bill Upload tab (All State Bill, PF Challan / ECR, ESIC Upload, Scanned Bill Upload)
 * Texts, confirms and alerts are the legacy ones, verbatim. All data comes from the
 * /api/payroll/client-billing/ endpoints (no local mock).
 */
import { useEffect, useState } from "react";
import { getJSON, mk, responseMessage, upload as uploadFile } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

export const BILLING_API = "/api/payroll/client-billing";

export interface BillingScope {
  client_code: string;
  state: string;
  unit_code: string;
  month: number;
  year: number;
  billing_id?: string;
  billing_process?: string;
  region?: string;
}

function qs(scope: BillingScope, extra: Record<string, string> = {}) {
  const p = new URLSearchParams();
  p.set("client_code", scope.client_code);
  p.set("state", scope.state);
  p.set("unit_code", scope.unit_code || "ALL");
  p.set("month", String(scope.month));
  p.set("year", String(scope.year));
  if (scope.billing_id) p.set("billing_id", scope.billing_id);
  if (scope.billing_process) p.set("billing_process", scope.billing_process);
  if (scope.region) p.set("region", scope.region);
  Object.entries(extra).forEach(([k, v]) => p.set(k, v));
  return p.toString();
}

export async function downloadBlob(url: string, fallbackName: string) {
  const r = await fetch(`${API_BASE_URL}${url}`, { credentials: "include" });
  if (!r.ok) throw new Error(await responseMessage(r, "File Not Available !!!"));
  const cd = r.headers.get("Content-Disposition") || "";
  const m = /filename="?([^";]+)"?/.exec(cd);
  const objectUrl = URL.createObjectURL(await r.blob());
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = m ? m[1] : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

// --------------------------------------------------------------------------- Finance approval grid
interface ApprovalRow {
  unit_code: string; client_name: string; state_name: string; branch_name: string; month_year: string;
  status: string; attendance_file: string; rejected_reason: string; previously_rejected: boolean;
}

export function FinanceApprovalPanel({ scope, loadKey, onFeedback }: {
  scope: BillingScope | null; loadKey: number; onFeedback?: (unit: string) => void;
}) {
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [fbApplicable, setFbApplicable] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!scope) { setRows([]); return; }
    const d = await getJSON<{ results: ApprovalRow[]; feedback_applicable: boolean }>(
      `${BILLING_API}/attendance-approvals/?${qs(scope)}`);
    const list = d?.results ?? [];
    setRows(list);
    setFbApplicable(Boolean(d?.feedback_applicable));
    setChecked({});
    setReasons(Object.fromEntries(list.map((r) => [r.unit_code, r.rejected_reason || ""])));
  }
  useEffect(() => { if (loadKey > 0) void load(); /* eslint-disable-next-line */ }, [loadKey]);

  async function act(path: string, body: Record<string, unknown>): Promise<string> {
    if (!scope) return "";
    setBusy(true);
    try {
      const r = await mk(`${BILLING_API}/${path}/`, { ...scope, ...body });
      if (!r.ok) { const m = await responseMessage(r, "Request failed."); alert(m); return ""; }
      const j = await r.json();
      if (j.message) alert(j.message);
      return j.message || "";
    } finally { setBusy(false); await load(); }
  }

  const selected = rows.filter((r) => checked[r.unit_code]).map((r) => r.unit_code);

  function approveSelected() {
    if (selected.length === 0) { alert("Please select atleast one Branch"); return; }
    if (!window.confirm("Are you Sure You Want to Approve Record")) { alert("Record not Available"); return; }
    void act("approve-attendance", { unit_codes: selected });
  }
  function rejectSelected() {
    if (selected.length === 0) { alert("Please select atleast one Branch"); return; }
    if (!window.confirm("Are you Sure You Want to Reject Record")) { alert("Record not Available"); return; }
    void act("reject-attendance", { items: selected.map((u) => ({ unit_code: u, reason: reasons[u] || "" })), bulk: true });
  }
  async function download(unit: string) {
    if (!scope) return;
    try {
      await downloadBlob(`${BILLING_API}/attendance-file/?client_code=${encodeURIComponent(scope.client_code)}&unit_code=${encodeURIComponent(unit)}&month=${scope.month}&year=${scope.year}`, "attendance");
    } catch (e) { alert(e instanceof Error ? e.message : "Attachment File Cannot Be Uploaded !!!"); }
  }

  async function downloadZip() {
    if (!scope) return;
    try {
      await downloadBlob(`${BILLING_API}/attendance-zip/?${qs(scope)}`, "attendance.zip");
    } catch (e) { alert(e instanceof Error ? e.message : "Attachment File Cannot Be Uploaded !!!"); }
  }

  if (rows.length === 0) return null;
  const tint = (r: ApprovalRow) => {
    const s = r.status.toUpperCase();
    return s === "APPROVE BY FINANCE" ? "#90EE90" : s === "REJECT BY FINANCE" ? "#FF4C4C" : r.previously_rejected ? "#FACC2E" : undefined;
  };
  return (
    <div className="grid-view" style={{ marginTop: 18 }}>
      <div style={{ textAlign: "center" }}><h3>Approve Attendance By Admin</h3></div>
      <div style={{ overflowX: "auto" }}>
        <table className="lg-grid" style={{ width: "100%" }}>
          <thead><tr>
            <th><label><input type="checkbox" checked={rows.length > 0 && selected.length === rows.length}
              onChange={(e) => setChecked(Object.fromEntries(rows.map((r) => [r.unit_code, e.target.checked])))} /> SELECT </label>
              <input type="image" src="/Images/winzip.png" alt="Download all attendance sheets (zip)" title="Download all attendance sheets (zip)" width={25} onClick={() => void downloadZip()} /></th>
            <th>CLIENT NAME</th><th>STATE NAME</th><th>BRANCH NAME</th><th>MONTH YEAR</th><th>CURRENT STATUS</th>
            <th>DOWNLOAD</th><th>REJECT REASON</th>
            {fbApplicable && <th>FEEDBACK LINK</th>}
          </tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.unit_code} style={{ background: tint(r) }}>
                <td><input type="checkbox" aria-label={`Select ${r.branch_name}`} checked={Boolean(checked[r.unit_code])}
                  onChange={(e) => setChecked((c) => ({ ...c, [r.unit_code]: e.target.checked }))} /></td>
                <td>{r.client_name}</td><td>{r.state_name}</td><td>{r.branch_name}</td><td>{r.month_year}</td>
                <td>{r.status}</td>
                <td><button className="lg-btn lg-btn-primary" onClick={() => void download(r.unit_code)}>Attendance Sheet</button></td>
                <td><input className="lg-control" style={{ width: 180 }} value={reasons[r.unit_code] ?? ""}
                  onChange={(e) => setReasons((c) => ({ ...c, [r.unit_code]: e.target.value }))} /></td>
                {fbApplicable && <td><a href="#feedback" onClick={(e) => { e.preventDefault(); onFeedback?.(r.unit_code); }}
                  style={{ color: "blue", fontWeight: "bold" }}>View Feedback Report</a></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ textAlign: "center", marginTop: 10, display: "flex", gap: 10, justifyContent: "center" }}>
        <button className="lg-btn lg-btn-primary" disabled={busy} onClick={approveSelected}>Approve</button>
        <button className="lg-btn lg-btn-primary" disabled={busy} onClick={rejectSelected}>Reject</button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- Feedback panel (View Feedback Report)
interface FeedbackRow { unit_code: string; feedback: string; good: string; satisfactory: string; need_improvement: string; any_other_remark: string; }

export function FeedbackPanel({ scope, unit, onClose }: { scope: BillingScope | null; unit: string; onClose: () => void }) {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  useEffect(() => {
    if (!scope || !unit) return;
    void (async () => {
      const d = await getJSON<{ results: FeedbackRow[] }>(`${BILLING_API}/feedback-rows/?${qs(scope, { unit_code: unit })}`);
      setRows(d?.results ?? []);
    })();
    // eslint-disable-next-line
  }, [unit]);
  async function decide(approve: boolean) {
    if (!scope) return;
    const r = await mk(`${BILLING_API}/feedback-decide/`, { ...scope, unit_code: unit, approve });
    if (!r.ok) { alert(await responseMessage(r, "Request failed.")); return; }
    alert((await r.json()).message);
    onClose();
  }
  return (
    <div className="grid-view" style={{ marginTop: 14, width: "60%", marginLeft: "auto", marginRight: "auto" }}>
      <table className="lg-grid" style={{ width: "100%" }}>
        <thead><tr><th>Sr No.</th><th>Particular</th><th>GOOD</th><th>Satisfactory</th><th>Need Improvement</th><th>Any Other Remark</th></tr></thead>
        <tbody>{rows.map((r, i) => (
          <tr key={i}><td>{i + 1}</td><td>{r.feedback}</td>
            <td><input type="checkbox" readOnly checked={r.good === "Yes"} disabled={r.good !== "Yes"} /></td>
            <td><input type="checkbox" readOnly checked={r.satisfactory === "Yes"} disabled={r.satisfactory !== "Yes"} /></td>
            <td><input type="checkbox" readOnly checked={r.need_improvement === "Yes"} disabled={r.need_improvement !== "Yes"} /></td>
            <td>{r.any_other_remark}</td></tr>))}
          {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center" }}>No feedback recorded for this branch.</td></tr>}</tbody>
      </table>
      <div style={{ textAlign: "center", marginTop: 8, display: "flex", gap: 10, justifyContent: "center" }}>
        <button className="lg-btn lg-btn-primary" style={{ width: "20%" }} onClick={() => void decide(true)}>Approve Feedback</button>
        <button className="lg-btn lg-btn-primary" style={{ width: "20%" }} onClick={() => void decide(false)}>Reject Feedback</button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- Deployment panel
interface DeploymentRow { client_name: string; state_name: string; unit_name: string; unit_code: string; }

export function DeploymentPanel({ scope, loadKey }: { scope: BillingScope | null; loadKey: number }) {
  const [rows, setRows] = useState<DeploymentRow[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!scope) { setRows([]); return; }
    const d = await getJSON<{ results: DeploymentRow[] }>(`${BILLING_API}/deployment-grid/?${qs(scope)}`);
    setRows(d?.results ?? []);
    setChecked({});
  }
  useEffect(() => { if (loadKey > 0) void load(); /* eslint-disable-next-line */ }, [loadKey]);

  async function act(path: string, confirmText: string) {
    const units = rows.filter((r) => checked[r.unit_code]).map((r) => r.unit_code);
    if (!window.confirm(confirmText)) return;
    if (units.length === 0) { alert("Please select atleast one Record "); return; }
    if (!scope) return;
    setBusy(true);
    try {
      const r = await mk(`${BILLING_API}/${path}/`, { ...scope, unit_codes: units });
      if (!r.ok) { alert(await responseMessage(r, "Request failed.")); return; }
      const j = await r.json();
      if (j.message) alert(j.message);
    } finally { setBusy(false); await load(); }
  }

  if (rows.length === 0) return null;
  const shown = rows.filter((r) => !search || `${r.client_name} ${r.state_name} ${r.unit_name} ${r.unit_code}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <div className="grid-view" style={{ marginTop: 18 }}>
      <div style={{ textAlign: "center" }}><h3>Branch Having No Deployment</h3></div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, alignItems: "center" }}>
        <b>Search :</b><input className="lg-control" style={{ width: 200 }} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="lg-grid" style={{ width: "100%" }}>
          <thead><tr><th>Sr No.</th>
            <th><label><input type="checkbox" checked={rows.length > 0 && rows.every((r) => checked[r.unit_code])}
              onChange={(e) => setChecked(Object.fromEntries(rows.map((r) => [r.unit_code, e.target.checked])))} /> SELECT RECORD</label></th>
            <th>CLIENT NAME</th><th>STATE NAME</th><th>BRANCH NAME</th></tr></thead>
          <tbody>{shown.map((r, i) => (
            <tr key={r.unit_code}><td>{i + 1}</td>
              <td><input type="checkbox" aria-label={`Select ${r.unit_name}`} checked={Boolean(checked[r.unit_code])}
                onChange={(e) => setChecked((c) => ({ ...c, [r.unit_code]: e.target.checked }))} /></td>
              <td>{r.client_name}</td><td>{r.state_name}</td><td>{r.unit_name}</td></tr>))}</tbody>
        </table>
      </div>
      <div style={{ textAlign: "center", marginTop: 10, display: "flex", gap: 10, justifyContent: "center" }}>
        <button className="lg-btn lg-btn-primary" disabled={busy} onClick={() => void act("approve-deployment", "Are you Sure You Want to Approve This Record")}>Approve</button>
        <button className="lg-btn lg-btn-primary" disabled={busy} onClick={() => void act("hold-deployment", "Are you Sure You Want to Hold This Record")}>Hold</button>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- Check Client Billing
interface StatusRow { client_name: string; billing_name: string; state_name: string; unit_name: string; designation: string; status: string; }

export function BillingStatusPanel({ scope, loadKey }: { scope: BillingScope | null; loadKey: number }) {
  const [rows, setRows] = useState<StatusRow[] | null>(null);
  useEffect(() => {
    if (loadKey === 0 || !scope || !scope.billing_id) return;
    void (async () => {
      const d = await getJSON<{ results: StatusRow[] }>(`${BILLING_API}/billing-status-grid/?${qs(scope)}`);
      setRows(d?.results ?? []);
    })();
    // eslint-disable-next-line
  }, [loadKey]);
  if (!rows) return null;
  return (
    <div style={{ marginTop: 14 }}>
      <div style={{ background: "#337ab7", color: "#fff", padding: "6px 12px" }}><b>Check Client Billing </b></div>
      <div style={{ overflowX: "auto" }}>
        <table className="lg-grid" style={{ width: "100%" }}>
          <thead><tr><th>Client Name</th><th>Billing Type</th><th>State Name</th><th>Branch Name</th><th>Designation</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r, i) => <tr key={i}><td>{r.client_name}</td><td>{r.billing_name}</td><td>{r.state_name}</td>
              <td>{r.unit_name}</td><td>{r.designation}</td><td>{r.status}</td></tr>)}
            {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center" }}>No billing rules configured for this Billing Type.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --------------------------------------------------------------------------- Notification panel
interface NotifyCat { key: string; title: string; count: number; emp_count: number | null; rows: Record<string, string>[]; }

export function NotificationPanel({ scope, loadKey }: { scope: BillingScope | null; loadKey: number }) {
  const [cats, setCats] = useState<NotifyCat[] | null>(null);
  useEffect(() => {
    if (loadKey === 0 || !scope) return;
    void (async () => {
      const d = await getJSON<{ categories: NotifyCat[] }>(`${BILLING_API}/notification-report/?${qs(scope)}`);
      setCats(d?.categories ?? []);
    })();
    // eslint-disable-next-line
  }, [loadKey]);
  if (!cats) return null;
  return (
    <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
      {cats.map((c) => (
        <div key={c.key} style={{ border: "1px solid #006699", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ background: "#006699", color: "#fff", padding: "6px 12px" }}>
            <b>{c.title}</b> - Branches: {c.count}{c.emp_count !== null && c.emp_count !== undefined ? ` | Employees: ${c.emp_count}` : ""}
          </div>
          {c.rows.length > 0 && (
            <table className="lg-grid" style={{ width: "100%", margin: 0 }}>
              <thead><tr><th>Branch</th>
                {c.key === "rejected" && <><th>Rejected Reason</th><th>Rejected Date</th><th>Rejected By</th></>}
                {c.key === "closed" && <th>Branch Close Date</th>}</tr></thead>
              <tbody>{c.rows.map((r, i) => (
                <tr key={i}><td>{r.cunit}</td>
                  {c.key === "rejected" && <><td>{r.rejected_reason}</td><td>{r.rejected_date}</td><td>{r.rejected_by}</td></>}
                  {c.key === "closed" && <td>{r.branch_close_date}</td>}</tr>))}</tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

// --------------------------------------------------------------------------- Bill Upload tab
interface DocRef { id: number; file_name: string; document_type: string; state_name: string; file_size: number; }
interface UploadGrid {
  states: { state_name: string; scanned_bill: DocRef | null; esic: DocRef | null }[];
  pf_challan: DocRef | null; ecr_file: DocRef | null; all_states_final: boolean;
}

export function BillUploadTab({ client, month, year, onClientSheet, notify }: {
  client: string; month: number; year: number; onClientSheet: () => void; notify: (m: string) => void;
}) {
  const [shown, setShown] = useState(false);
  const [grid, setGrid] = useState<UploadGrid | null>(null);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [attach, setAttach] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  async function load() {
    const d = await getJSON<UploadGrid>(`${BILLING_API}/bill-upload-grid/?client_code=${encodeURIComponent(client)}&month=${month}&year=${year}`);
    setGrid(d);
  }

  function show() {
    if (!client) { alert("Please Select Client Name "); return; }
    if (!month || !year) { alert("Please Select month & year "); return; }
    setShown(true);
    void load();
  }

  async function doUpload(key: string, type: string, state: string) {
    const f = files[key];
    if (!f) { alert("Please Select Document "); return; }
    const ext = f.name.split(".").pop()?.toLowerCase();
    if (ext !== "pdf" && ext !== "zip") { alert("Please select only ZIP and PDF Files !!!"); return; }
    const form = new FormData();
    form.append("client_code", client); form.append("document_type", type);
    form.append("month", String(month)); form.append("year", String(year));
    if (state) form.append("state", state);
    form.append("file", f);
    setBusy(true);
    try {
      const r = await uploadFile(`${BILLING_API}/upload-document/`, form);
      if (!r.ok) { alert(await responseMessage(r, "Request failed.")); return; }
      alert("File uploaded Succsefully !!!");
      setFiles((c) => ({ ...c, [key]: null }));
    } finally { setBusy(false); await load(); }
  }

  async function del(doc: DocRef) {
    if (!window.confirm("Are you sure you want to delete?")) return;
    setBusy(true);
    try {
      const r = await mk(`${BILLING_API}/delete-document/`, { id: doc.id });
      if (!r.ok) { alert(await responseMessage(r, "Request failed.")); return; }
      alert((await r.json()).message);
    } finally { setBusy(false); await load(); }
  }

  async function dl(doc: DocRef) {
    try { await downloadBlob(`${BILLING_API}/download-document/?id=${doc.id}`, doc.file_name); }
    catch (e) { alert(e instanceof Error ? e.message : "File Not Available !!!"); }
  }

  async function sendMail() {
    const ids = [grid?.pf_challan, grid?.ecr_file, ...(grid?.states ?? []).flatMap((s) => [s.esic, s.scanned_bill])]
      .filter((d): d is DocRef => Boolean(d) && Boolean(attach[`doc${d!.id}`])).map((d) => d.id);
    setBusy(true);
    try {
      const r = await mk(`${BILLING_API}/send-bill-mail/`, { client_code: client, month, year, document_ids: ids });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        const m = j.detail ?? (Array.isArray(j) ? j[0] : null) ?? "Mail not send.";
        alert(typeof m === "string" ? m : "Mail not send.");
        notify(typeof m === "string" ? m : "Mail not send.");
      } else { alert("Mail Send Successfully."); notify("Mail Send Successfully."); }
    } finally { setBusy(false); }
  }

  if (!shown) {
    return (
      <div className="panel panel-primary" style={{ border: "1px solid #bfbcbc", padding: 12 }}>
        <button className="lg-btn lg-btn-primary" onClick={show}>Show</button>
      </div>
    );
  }
  const slot = (label: string, doc: DocRef | null | undefined, key: string, type: string) => (
    <div style={{ display: "flex", gap: 14, alignItems: "center", justifyContent: "center", margin: "8px 0", flexWrap: "wrap" }}>
      {doc && <label><input type="checkbox" checked={Boolean(attach[`doc${doc.id}`])}
        onChange={(e) => setAttach((c) => ({ ...c, [`doc${doc.id}`]: e.target.checked }))} /> Add to Email</label>}
      <b style={{ minWidth: 100 }}>{label}</b>
      {!doc ? <>
        <input type="file" accept=".pdf,.zip" onChange={(e) => setFiles((c) => ({ ...c, [key]: e.target.files?.[0] ?? null }))} />
        <button className="lg-btn lg-btn-primary" disabled={busy} onClick={() => void doUpload(key, type, "")}>Upload</button>
      </> : <>
        <button className="lg-btn lg-btn-primary" onClick={() => void dl(doc)}>Download</button>
        <button className="lg-btn lg-btn-primary" disabled={busy} onClick={() => void del(doc)}>Delete</button>
      </>}
    </div>
  );
  const stateGrid = (title: string, pick: (s: UploadGrid["states"][number]) => DocRef | null, type: string) => (
    <>
      <div style={{ background: "#337ab7", color: "#fff", textAlign: "center", padding: 6, margin: "10px 0" }}><b>{title}</b></div>
      <div style={{ overflowX: "auto" }}>
        <table className="lg-grid" style={{ width: "100%" }}>
          <thead><tr><th>No.</th><th> SELECT </th><th>State Name</th><th>State Name</th><th>File</th><th>Upload</th><th>Download</th></tr></thead>
          <tbody>
            {(grid?.states ?? []).map((s, i) => {
              const doc = pick(s); const key = `${type}:${s.state_name}`;
              return (
                <tr key={key}><td>{i + 1}</td>
                  <td>{doc && <input type="checkbox" aria-label={`Add ${s.state_name} to email`} checked={Boolean(attach[`doc${doc.id}`])}
                    onChange={(e) => setAttach((c) => ({ ...c, [`doc${doc.id}`]: e.target.checked }))} />}</td>
                  <td>{s.state_name}</td><td>{doc ? type : ""}</td>
                  <td>{!doc && <input type="file" accept=".pdf,.zip" onChange={(e) => setFiles((c) => ({ ...c, [key]: e.target.files?.[0] ?? null }))} />}</td>
                  <td>{!doc ? <button className="lg-btn" disabled={busy} onClick={() => void doUpload(key, type, s.state_name)}>Upload</button>
                    : <button className="lg-btn" disabled={busy} onClick={() => void del(doc)}>Delete</button>}</td>
                  <td>{doc && <a href="#download" onClick={(e) => { e.preventDefault(); void dl(doc); }}>Download</a>}</td></tr>
              );
            })}
            {(grid?.states ?? []).length === 0 && <tr><td colSpan={7} style={{ textAlign: "center" }}>No states for this client.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
  return (
    <div className="panel panel-primary" style={{ border: "1px solid #bfbcbc", padding: 12 }}>
      <div style={{ marginBottom: 10 }}>
        <button className="lg-btn lg-btn-primary" style={{ width: 150 }} disabled={busy} onClick={() => void sendMail()}>Send Mail</button>
      </div>
      <div style={{ background: "#337ab7", color: "#fff", textAlign: "center", padding: 6 }}><b>All State Bill</b></div>
      <div style={{ display: "flex", gap: 20, alignItems: "center", justifyContent: "center", margin: "10px 0", flexWrap: "wrap" }}>
        {grid?.all_states_final
          ? <label><input type="checkbox" checked={Boolean(attach["all_state"])} onChange={(e) => setAttach((c) => ({ ...c, all_state: e.target.checked }))} /> Add to Email</label>
          : <span>All State bill Not Finalized</span>}
        <span>Excel Bill for All State</span>
        {grid?.all_states_final && <button className="lg-btn lg-btn-primary" onClick={onClientSheet}>Download</button>}
      </div>
      <div style={{ background: "#337ab7", color: "#fff", textAlign: "center", padding: 6 }}><b>PF Challan and ECR</b></div>
      {slot("PF CHALLAN", grid?.pf_challan, "pf", "PF_CHALLAN")}
      {slot("ECR File", grid?.ecr_file, "ecr", "ECR_FILE")}
      {stateGrid("ESIC Upload", (s) => s.esic, "ESIC")}
      {stateGrid("Scanned Bill Upload", (s) => s.scanned_bill, "SCANNED_BILL_UPLOAD")}
    </div>
  );
}
