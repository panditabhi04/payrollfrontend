"use client";

/**
 * Client Billing - MATERIAL and CONVEYANCE billing families (grade_unit_billing.aspx #menu2 / #menu3).
 * Buttons, prompts, grids and alerts follow the legacy page; every action calls the real
 * /api/payroll/client-billing/mc-* endpoints (process / Finance approval / finance copy / bill / final invoice / report).
 */
import { useEffect, useState } from "react";
import { getJSONStrict, mk, responseMessage } from "@/lib/api/legacy-fetch";
import { BILLING_API, downloadBlob } from "./ClientBillingPanels";

export const MC_BILLING_TYPES = ["Material Billing", "Conveyance Billing"];
export const isMcBillingType = (t: string): t is "Material Billing" | "Conveyance Billing" => MC_BILLING_TYPES.includes(t);

export interface McContext {
  client: string; clientName: string; state: string; unit: string; month: string; // month = YYYY-MM
}

interface ApprovalRow {
  unit_code: string; emp_code?: string; emp_name?: string; client_name: string; state_name: string; branch_name: string;
  month_year: string; material_status?: string; status?: string; attendance_file: string; material_reject_reason?: string;
  reject_reason?: string;
}
interface Approvals { contract_type?: number; results: ApprovalRow[]; can_approve: boolean; driver?: boolean }
interface QtyRow {
  id: number; unit_code1: string; branch_name: string; material_name: string; rate: string; handling_charges_amount: string;
  handling_percent: string; handling_applicable: string; state_name: string; new_policy_name: string; start_date: string;
  end_date: string; designation: string; quantity: string;
}
interface BranchRow { client_name: string; state_name: string; unit_name: string }
interface Report {
  not_approved_admin: BranchRow[]; approved_admin: BranchRow[]; approved_finance: BranchRow[]; rejected_finance: BranchRow[];
}
interface TxRow {
  items: string; rate: number; quantity: number; unit: string; amount: number; branch: string; gst_pct: number;
  gst_amount: number; total: number;
}
interface ProcessResult { count: number; branches: number; amount: number; message: string }

const money = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(v || 0);
const STATUS_BG = (s?: string) => ((s || "").toUpperCase() === "APPROVE BY FINANCE" ? "#90EE90" : (s || "").toUpperCase() === "REJECT BY FINANCE" ? "#FF4C4C" : undefined);

export default function MaterialConveyanceSection({ billingType, ctx, fields, invoiceNo, billDate, setMessage }: {
  billingType: "Material Billing" | "Conveyance Billing"; ctx: McContext; fields: Record<string, unknown>;
  invoiceNo: string; billDate: string; setMessage: (m: string) => void;
}) {
  const material = billingType === "Material Billing";
  const [mType, setMType] = useState("1");              // ddl_material_bill_type: 1 Sq.Ft / 2 Tissue
  const [tQty, setTQty] = useState("0");
  const [tRate, setTRate] = useState("0");
  const [cType, setCType] = useState("1");              // ddl_conveyance_type: 1 Employee / 2 Driver
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [approvals, setApprovals] = useState<Approvals | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [qtys, setQtys] = useState<QtyRow[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [bill, setBill] = useState<{ results: TxRow[]; total: number } | null>(null);

  const driver = !material && cType === "2";
  const say = (m: string) => { setMessage(m); alert(m); };
  const [yy, mm] = ctx.month ? ctx.month.split("-") : ["", ""];
  const rowKey = (r: ApprovalRow) => (driver ? `${r.unit_code}|${r.emp_code}` : r.unit_code);

  function body(extra: Record<string, unknown> = {}) {
    return {
      client_code: ctx.client, state: ctx.state, unit_code: ctx.unit || "ALL", month: Number(mm), year: Number(yy),
      ...fields, material_type: mType, tissue_qty: tQty, tissue_rate: tRate, conveyance_type: cType, ...extra,
    };
  }
  function query(extra: Record<string, unknown> = {}) {
    const p = new URLSearchParams();
    Object.entries(body(extra)).forEach(([k, v]) => { if (v !== undefined && v !== null && typeof v !== "object") p.set(k, String(v)); });
    return p.toString();
  }

  // ---- the JS validations of the legacy buttons (texts verbatim)
  const needClient = () => { if (!ctx.client || ctx.client === "ALL") { say("Please Select Client Name "); return false; } return true; };
  const needMonth = () => { if (!ctx.month) { say("Please Select month & year "); return false; } return true; };
  const reqValidation = () => needClient() && needMonth();                             // Req_validation()
  const reqValidation1 = () => {                                                       // Req_validation1()
    if (!reqValidation()) return false;
    if (!invoiceNo.trim()) { say("Please Enter Invoice No "); return false; }
    if (!billDate) { say("Please Enter Bill Date "); return false; }
    return true;
  };
  const reqValidationAll = () => {                                                      // Req_validationAll()
    if (!ctx.client) { say("Please Select Client Name "); return false; }
    return needMonth();
  };
  const reqValidationProcess = () => {                                                  // req_validation_process()
    if (!needClient()) return false;
    if (!ctx.state) { say("Please Select State Name "); return false; }
    if (ctx.clientName === "Reliance Capital Ltd." && (ctx.unit || "ALL") === "ALL") { say("Please Select Branch Name "); return false; }
    return needMonth();
  };
  const reportValidation = () => {                                                      // report_link_validation()/driver_report_validation()
    if (ctx.state === "ALL") { say("Please Select State Name "); return false; }
    return true;
  };

  async function guarded<T>(fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(true);
    try { return await fn(); } catch (e) { say(e instanceof Error ? e.message : "Request failed."); } finally { setBusy(false); }
    return undefined;
  }
  async function post<T = any>(path: string, extra: Record<string, unknown> = {}): Promise<T> {
    const r = await mk(`${BILLING_API}/${path}/`, body(extra));
    if (!r.ok) throw new Error(await responseMessage(r, "Request failed."));
    return (await r.json()) as T;
  }
  async function get<T = any>(path: string, extra: Record<string, unknown> = {}): Promise<T> {
    return await getJSONStrict<T>(`${BILLING_API}/${path}/?${query(extra)}`);
  }
  async function postBlob(path: string, extra: Record<string, unknown>, fallback: string) {
    const r = await mk(`${BILLING_API}/${path}/`, body(extra));
    if (!r.ok) throw new Error(await responseMessage(r, "Attachment File Cannot Be Uploaded !!!"));
    const cd = r.headers.get("Content-Disposition") || "";
    const m = /filename="?([^";]+)"?/.exec(cd);
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement("a");
    a.href = url; a.download = m ? m[1] : fallback; document.body.appendChild(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---- grids
  async function loadApprovals() {
    if (!ctx.client || !ctx.month) return;
    try {
      const a = await get<Approvals>(material ? "mc-material-approvals" : "mc-conveyance-approvals");
      setApprovals(a); setChecked({});
      setReasons(Object.fromEntries((a.results ?? []).map((r) => [rowKey(r), r.material_reject_reason || r.reject_reason || ""])));
    } catch { setApprovals(null); }
  }
  async function loadQuantities() {
    if (!material || !ctx.client || !ctx.state || !ctx.month) { setQtys([]); return; }
    try {
      const q = await get<{ results: QtyRow[] }>("mc-material-quantities");
      setQtys(q.results ?? []);
    } catch { setQtys([]); }
  }
  useEffect(() => { void loadQuantities(); setReport(null); setBill(null); setResult(null); setApprovals(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.client, ctx.state, ctx.unit, ctx.month, billingType]);
  useEffect(() => { setApprovals(null); setReport(null); }, [cType]);

  // ---- buttons
  async function doProcess() {
    if (!reqValidationProcess()) return;
    await guarded(async () => {
      const extra = material ? { quantities: qtys.map((q) => ({ ...q, quantity: q.quantity || "0" })) } : {};
      const r = await post<ProcessResult & { quantity_message?: string }>(material ? "mc-material-process" : "mc-conveyance-process", extra);
      setResult(r);
      setMessage(r.message);
      if (r.quantity_message) alert(r.quantity_message);
      await loadApprovals();
      if (material) await loadQuantities();
    });
  }
  async function dl(path: string, fallback: string, validate: () => boolean = reqValidation1) {
    if (!validate()) return;
    await guarded(async () => { await downloadBlob(`${BILLING_API}/${path}/?${query()}`, fallback); await loadApprovals(); });
  }
  async function doFinal() {
    if (!reqValidation1()) return;
    await guarded(async () => {
      const j = await post<{ invoice_no: string; reused?: boolean }>(material ? "mc-material-final" : "mc-conveyance-final");
      setMessage(`Invoice ${j.invoice_no} ${j.reused ? "re-printed" : "posted to the GST register"}.`);
      await downloadBlob(`${BILLING_API}/${material ? "mc-material-invoice-copy" : "mc-conveyance-bill"}/?${query(material ? { ds: "1" } : { final: 1 })}`, material ? "Material Invoice.pdf" : "invoice.pdf");
      await loadApprovals();
    });
  }
  async function doReport() {
    if (!reportValidation()) return;
    await guarded(async () => {
      const r = await get<Report & { approvals?: Approvals }>(material ? "mc-material-report" : "mc-conveyance-report");
      setReport(r);
      if (r.approvals) { setApprovals(r.approvals); setChecked({}); }
    });
  }
  async function doActualBill() {
    if (!needClient() || !needMonth()) return;
    await guarded(async () => { setBill(await get("mc-material-actual-bill")); });
  }

  // ---- Finance approve / reject
  async function approveRows(rows: ApprovalRow[], bulk: boolean, grid: "emp" | "type") {
    const pick = rows;
    if (bulk && pick.length === 0) { alert("Please select atleast one Branch"); return; }
    if (grid === "type" && bulk) { if (!window.confirm("Are you sure want to Approve")) return; }
    else if (!window.confirm("Are you Sure You Want to Approve Branch")) { alert("Record not Available"); return; }
    await guarded(async () => {
      const j = material
        ? await post("mc-material-approve", { grid, bulk, unit_codes: pick.map((r) => r.unit_code) })
        : await post("mc-conveyance-approve", { bulk, items: pick.map((r) => ({ unit_code: r.unit_code, emp_code: r.emp_code || "" })) });
      if (j.message) alert(j.message);
      await loadApprovals();
    });
  }
  async function rejectRows(rows: ApprovalRow[], grid: "emp" | "type", single: boolean) {
    if (single && !window.confirm("Are you Sure You Want to Reject Branch")) { alert("Record not Available"); return; }
    await guarded(async () => {
      const j = material
        ? await post("mc-material-reject", { grid, unit_codes: rows.map((r) => r.unit_code),
          reasons: Object.fromEntries(rows.map((r) => [r.unit_code, reasons[rowKey(r)] || ""])) })
        : await post("mc-conveyance-reject", { items: rows.map((r) => ({ unit_code: r.unit_code, emp_code: r.emp_code || "",
          reason: reasons[rowKey(r)] || "" })) });
      if (j.message) alert(j.message);
      await loadApprovals();
    });
  }
  async function zipSelected(rows: ApprovalRow[]) {
    if (rows.length === 0) { alert("Please select atleast one Branch"); return; }
    await guarded(async () => {
      await postBlob(material ? "mc-material-zip" : "mc-conveyance-zip",
        material ? { unit_codes: rows.map((r) => r.unit_code) } : { items: rows.map((r) => ({ unit_code: r.unit_code, emp_code: r.emp_code || "" })) },
        "sheets.zip");
    });
  }
  async function downloadSheet(r: ApprovalRow) {
    if (!r.attendance_file) { alert("Attachment File Cannot Be Uploaded !!!"); return; }
    await guarded(async () => {
      await downloadBlob(`${BILLING_API}/${material ? "mc-material-download" : "mc-conveyance-download"}/?file=${encodeURIComponent(r.attendance_file)}${material ? "" : `&branch=${encodeURIComponent(r.branch_name || "")}`}`, r.attendance_file);
    });
  }

  const btn = (label: string, fn: () => void, wide?: boolean) => (
    <button key={label} className="lg-btn lg-btn-primary" disabled={busy} onClick={fn}
      style={{ minHeight: 40, padding: "0 14px", fontFamily: "Georgia, serif", fontSize: 15, width: wide ? "auto" : undefined }}>{label}</button>
  );

  const rows = approvals?.results ?? [];
  const typeGrid = material && approvals?.contract_type === 2;
  const gridTitle = material ? "Approve Material By Admin" : driver ? "Approve Driver Conveyance By Admin" : "Approve Employee Conveyance By Admin";

  return (
    <div style={{ marginTop: 12 }}>
      {material ? (
        <div style={{ display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap", marginBottom: 12 }}>
          <label className="lg-row" style={{ width: 220 }}>
            <span className="lg-label"><b>Material Bill Type :</b></span>
            <select className="lg-control" value={mType} onChange={(e) => setMType(e.target.value)}>
              <option value="1">Sq.Ft Billing</option><option value="2">Tissue Billing</option>
            </select>
          </label>
          {mType === "2" && <>
            <label className="lg-row" style={{ width: 120 }}><span className="lg-label">Tissue Qty :</span>
              <input className="lg-control" type="number" value={tQty} onChange={(e) => setTQty(e.target.value)} /></label>
            <label className="lg-row" style={{ width: 120 }}><span className="lg-label">Rate :</span>
              <input className="lg-control" type="number" value={tRate} onChange={(e) => setTRate(e.target.value)} /></label>
          </>}
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <label className="lg-row" style={{ width: 280 }}>
            <span className="lg-label">Conveyance Billing : <span className="lg-req">*</span></span>
            <select className="lg-control" value={cType} onChange={(e) => setCType(e.target.value)}>
              <option value="1">Employee Conveyance Billing</option><option value="2">Driver Convenyance Billing</option>
            </select>
          </label>
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        {btn("Process", () => void doProcess())}
        {material ? <>
          {btn("Material Finance Copy", () => void dl("mc-material-finance-copy", "Material_Finance_Copy.xls", reqValidation1))}
          {btn("Material Invoice Copy ", () => void dl("mc-material-invoice-copy", "Material Invoice.pdf"))}
          {btn("Final Invoice Print ", () => void doFinal())}
          {btn("Report ", () => void doReport())}
          {btn("Material Actual Bill", () => void doActualBill())}
          {btn("Material Actual Invoice", () => void dl("mc-material-actual-invoice", "Material Invoice.pdf"))}
          {btn("Export Material Details", () => void dl("mc-material-export", "Material_Billing.xls", reqValidation))}
        </> : driver ? <>
          {btn("Driver Finance Copy", () => void dl("mc-conveyance-finance-copy", "Driver_Conveyance_Finance_Copy.xls", reqValidation1))}
          {btn("Driver Bill", () => void dl("mc-conveyance-bill", "Conveyance.pdf"))}
          {btn("Final Driver Bill", () => void doFinal())}
          {btn("Report", () => void doReport())}
        </> : <>
          {btn("Conveyance Finance Copy", () => void dl("mc-conveyance-finance-copy", "Conveyance_Finance_Copy.xls", reqValidationAll))}
          {btn("Conveyance Bill", () => void dl("mc-conveyance-bill", "Conveyance.pdf"))}
          {btn("Final Conveyance Bill", () => void doFinal())}
          {btn("Report", () => void doReport())}
        </>}
      </div>

      {result && (
        <div className="lg-alert" role="status" style={{ background: "#dff0d8", borderColor: "#d6e9c6", color: "#3c763d", marginBottom: 10 }}>
          {result.message} {result.branches} branch(es), {money(result.amount)}.
        </div>
      )}

      {report && (
        <div style={{ marginBottom: 14 }}>
          {([["Branches Not Approved By Admin", report.not_approved_admin], ["Branches Approved By Admin", report.approved_admin],
            ["Branches Approved By Finance", report.approved_finance], ["Branches Reject By Finance", report.rejected_finance]] as const).map(([title, list]) => (
            <div key={title} style={{ marginBottom: 8 }}>
              <b>{title} ({list.length})</b>
              {list.length > 0 && (
                <table className="lg-grid" style={{ width: "100%" }}>
                  <thead><tr><th>CLIENT NAME</th><th>STATE NAME</th><th>BRANCH NAME</th></tr></thead>
                  <tbody>{list.map((b, i) => <tr key={i}><td>{b.client_name}</td><td>{b.state_name}</td><td>{b.unit_name}</td></tr>)}</tbody>
                </table>
              )}
            </div>
          ))}
        </div>
      )}

      {material && qtys.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: 14 }}>
          <table className="lg-grid" style={{ width: "100%" }}>
            <thead><tr><th>Branch Name</th><th>Material Name</th><th>Rate</th><th>Handling Charges amount</th><th>Handling Charges Percent</th><th>Quantity</th></tr></thead>
            <tbody>{qtys.map((q) => (
              <tr key={q.id}><td>{q.branch_name}</td><td>{q.material_name}</td><td>{q.rate}</td><td>{q.handling_charges_amount}</td><td>{q.handling_percent}</td>
                <td><input className="lg-control" style={{ width: 80 }} value={q.quantity}
                  onChange={(e) => setQtys((cur) => cur.map((x) => (x.id === q.id ? { ...x, quantity: e.target.value } : x)))} /></td></tr>))}</tbody>
          </table>
        </div>
      )}

      {rows.length > 0 && (
        <div className="grid-view" style={{ marginBottom: 14 }}>
          <div style={{ textAlign: "center" }}><h3>{gridTitle}</h3></div>
          <div style={{ overflowX: "auto" }}>
            <table className="lg-grid" style={{ width: "100%" }}>
              <thead><tr>
                <th><input type="checkbox" checked={rows.length > 0 && rows.every((r) => checked[rowKey(r)])}
                  onChange={(e) => setChecked(Object.fromEntries(rows.map((r) => [rowKey(r), e.target.checked])))} /> SELECT{" "}
                  <button type="button" title="Download selected sheets (zip)" onClick={() => void zipSelected(rows.filter((r) => checked[rowKey(r)]))}
                    style={{ border: 0, background: "none", cursor: "pointer" }}>&#128230;</button></th>
                <th>CLIENT NAME</th><th>STATE NAME</th><th>BRANCH NAME</th>{driver && <th>EMPLOYEE NAME</th>}<th>MONTH YEAR</th>
                <th>CURRENT STATUS</th><th>{material ? "Material_file" : "Conveyance_file"}</th><th>DOWNLOAD</th><th>APPROVE </th><th>REJECT </th><th>REJECT REASON</th>
              </tr></thead>
              <tbody>{rows.map((r) => {
                const k = rowKey(r);
                const st = r.material_status || r.status || "";
                return (
                  <tr key={k} style={{ background: STATUS_BG(st) }}>
                    <td><input type="checkbox" checked={Boolean(checked[k])} onChange={(e) => setChecked((c) => ({ ...c, [k]: e.target.checked }))} /></td>
                    <td>{r.client_name}</td><td>{r.state_name}</td><td>{r.branch_name}</td>{driver && <td>{r.emp_name}</td>}<td>{r.month_year}</td>
                    <td>{st}</td><td>{r.attendance_file}</td>
                    <td><button className="lg-btn lg-btn-primary" onClick={() => void downloadSheet(r)}>{material ? "Material Sheet" : "Conveyance Sheet"}</button></td>
                    <td><button className="lg-btn lg-btn-primary" disabled={busy} onClick={() => void approveRows([r], false, typeGrid ? "type" : "emp")}>Approve</button></td>
                    <td><button className="lg-btn lg-btn-primary" disabled={busy} onClick={() => void rejectRows([r], typeGrid ? "type" : "emp", true)}>Reject</button></td>
                    <td><input className="lg-control" style={{ width: 180 }} value={reasons[k] ?? ""}
                      onChange={(e) => setReasons((c) => ({ ...c, [k]: e.target.value }))} /></td>
                  </tr>);
              })}</tbody>
            </table>
          </div>
          {approvals?.can_approve && (
            <div style={{ textAlign: "center", marginTop: 8, display: "flex", gap: 10, justifyContent: "center" }}>
              <button className="lg-btn lg-btn-primary" disabled={busy}
                onClick={() => void approveRows(rows.filter((r) => checked[rowKey(r)]), true, typeGrid ? "type" : "emp")}>Approve</button>
              {typeGrid && <button className="lg-btn lg-btn-primary" disabled={busy}
                onClick={() => {
                  const sel = rows.filter((r) => checked[rowKey(r)]);
                  if (sel.length === 0) { alert(" Please Select At least One Record"); return; }
                  void rejectRows(sel, "type", false);
                }}>Reject</button>}
            </div>
          )}
        </div>
      )}

      {bill && (
        <div style={{ overflowX: "auto" }}>
          <table className="lg-grid" style={{ width: "100%" }}>
            <thead><tr><th>ITEMS</th><th>RATE</th><th>QUANTITY</th><th>UNIT</th><th>AMOUNT</th><th>BRANCH</th><th>GST %</th><th>GST AMOUNT</th><th>TOTAL</th></tr></thead>
            <tbody>{bill.results.map((t, i) => (
              <tr key={i}><td>{t.items}</td><td>{t.rate}</td><td>{t.quantity}</td><td>{t.unit}</td><td>{t.amount}</td><td>{t.branch}</td>
                <td>{t.gst_pct}</td><td>{t.gst_amount.toFixed(2)}</td><td>{t.total.toFixed(2)}</td></tr>))}
              {bill.results.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center" }}>No Matching Records Found.</td></tr>}</tbody>
            <tfoot><tr><th colSpan={8}>TOTAL</th><th>{bill.total.toFixed(2)}</th></tr></tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
