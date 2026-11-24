"use client";

/**
 * Client Billing - the DEEP CLEAN, PEST CONTROL and OT billing tabs of grade_unit_billing.aspx
 * (#menu4 / #menu5 / #menu13): the legacy buttons, the client-side validations and alerts (verbatim),
 * and the "Approve OT By Admin" grid. Every action calls /api/payroll/client-billing-dcpo/ (real compute,
 * persist, Excel / PDF output); nothing here is mocked.
 */
import { useCallback, useEffect, useState } from "react";
import { getJSON, mk, responseMessage } from "@/lib/api/legacy-fetch";
import { BILLING_API, downloadBlob, type BillingScope } from "./ClientBillingPanels";

const API = "/api/payroll/client-billing-dcpo";

export const FAMILY_BILLING_TYPES = ["Deep Clean Billing", "Pest Control Billing", "OT Billing"];
export const isFamilyBillingType = (t: string) => FAMILY_BILLING_TYPES.includes(t);

export interface FamilyCtx {
  client: string; clientName: string; state: string; unit: string; month: string; // month = "YYYY-MM"
  scope: BillingScope | null; fields: Record<string, unknown>;
  invoiceNo: string; billDate: string;
  setInvoiceNo: (v: string) => void; setMessage: (m: string) => void;
}

const money2 = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(v || 0);

// ---------------------------------------------------------------------------------------- legacy JS validations
function useChecks(ctx: FamilyCtx) {
  const say = (m: string) => { ctx.setMessage(m); alert(m); return false; };
  /** Req_validationAll(): client (ALL allowed) + month. */
  const all = () => {
    if (!ctx.client) return say("Please Select Client Name ");
    if (!ctx.month) return say("Please Select month & year ");
    return true;
  };
  /** Req_validation(): client must not be ALL. */
  const single = () => {
    if (!ctx.client || ctx.client === "ALL") return say("Please Select Client Name ");
    if (!ctx.month) return say("Please Select month & year ");
    return true;
  };
  /** Req_validation1(): + invoice no and bill date. */
  const withInvoice = () => {
    if (!single()) return false;
    if (!ctx.invoiceNo.trim()) return say("Please Enter Invoice No ");
    if (!ctx.billDate) return say("Please Enter Bill Date ");
    return true;
  };
  /** req_validation_process(). */
  const process = () => {
    if (!ctx.client || ctx.client === "ALL") return say("Please Select Client Name ");
    if (!ctx.state) return say("Please Select State Name ");
    if (ctx.clientName === "Reliance Capital Ltd." && ctx.unit === "ALL") return say("Please Select Branch Name ");
    if (!ctx.month) return say("Please Select month & year ");
    return true;
  };
  /** Req_invoice_validation1(): + a single state. */
  const invoice = () => {
    if (!single()) return false;
    if (ctx.state === "ALL") return say("Please Select State Name ");
    if (!ctx.invoiceNo.trim()) return say("Please Enter Invoice No ");
    if (!ctx.billDate) return say("Please Enter Bill Date ");
    return true;
  };
  return { say, all, single, withInvoice, process, invoice };
}

function body(ctx: FamilyCtx, extra: Record<string, unknown> = {}) {
  const [y, m] = ctx.month.split("-");
  return { ...ctx.fields, client_code: ctx.client, state: ctx.state, unit_code: ctx.unit || "ALL",
    month: Number(m), year: Number(y), ...extra };
}

function query(ctx: FamilyCtx, extra: Record<string, unknown> = {}) {
  const p = new URLSearchParams();
  Object.entries(body(ctx, extra)).forEach(([k, v]) => { if (v !== undefined && v !== null) p.set(k, String(v)); });
  return p.toString();
}

const BTN = { minHeight: 40, padding: "0 14px", fontFamily: "Georgia, serif", fontSize: 15 } as const;

// ---------------------------------------------------------------------------------------- Deep Clean / Pest Control
export function DeepCleanPestSection({ ctx, family }: { ctx: FamilyCtx; family: "deepclean" | "pest" }) {
  const chk = useChecks(ctx);
  const [busy, setBusy] = useState(false);
  const isDc = family === "deepclean";

  async function download(path: string, fallback: string, extra: Record<string, unknown> = {}) {
    try { await downloadBlob(`${API}/${family}/${path}/?${query(ctx, extra)}`, fallback); }
    catch (e) { chk.say(e instanceof Error ? e.message : "No Matching Records Found."); }
  }

  async function post(path: string) {
    setBusy(true);
    try {
      const r = await mk(`${API}/${family}/${path}/`, body(ctx));
      if (!r.ok) { chk.say(await responseMessage(r, "Request failed.")); return null; }
      return await r.json();
    } finally { setBusy(false); }
  }

  async function doProcess() {
    if (!chk.process()) return;
    const j = await post("process");
    if (j) ctx.setMessage(`${j.message} ${j.branches} branch(es), total ${money2(j.amount)}.`);
  }

  async function doFinal() {
    if (!chk.withInvoice()) return;
    const j = await post("final");
    if (!j) return;
    if (j.invoice_no) ctx.setInvoiceNo(j.invoice_no);
    ctx.setMessage(j.message);
    await download("invoice", isDc ? "Deep Clean.pdf" : "PestControl Invoice.pdf", { ds: "1" });
  }

  return (
    <div className="row text-center" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
      <button className="lg-btn lg-btn-primary" style={BTN} disabled={busy} onClick={() => void doProcess()}>Process</button>
      {isDc ? (
        <>
          <button className="lg-btn lg-btn-primary" style={BTN} disabled={busy}
            onClick={() => { if (chk.all()) void download("finance-copy", "Deep_Cleaning_Finance_Copy.xls"); }}>Deep Clean Finance Copy</button>
          <button className="lg-btn lg-btn-primary" style={BTN} disabled={busy}
            onClick={() => { if (chk.withInvoice()) void download("invoice", "Deep Clean.pdf"); }}>Deep Cleaning Bill</button>
          <button className="lg-btn lg-btn-primary" style={BTN} disabled={busy} onClick={() => void doFinal()}>Final Deep Cleaning Bill</button>
        </>
      ) : (
        <>
          <button className="lg-btn lg-btn-primary" style={BTN} disabled={busy}
            onClick={() => { if (chk.withInvoice()) void download("finance-copy", "PestControl_Finance_Copy.xls"); }}>Pest Control Finance Copy</button>
          <button className="lg-btn lg-btn-primary" style={BTN} disabled={busy}
            onClick={() => { if (chk.withInvoice()) void download("invoice", "PestControl Invoice.pdf"); }}>Invoice Copy </button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------------------- OT Billing
interface OtGridRow {
  unit_code: string; client_name: string; state_name: string; branch_name: string; month_year: string;
  status: string; ot_file: string; rejected_reason: string;
}
interface SubRow {
  id: number; state_name: string; unit_name: string; emp_code: string; emp_name: string; grade_desc: string;
  amount: number; service_charge: number; cgst: number; sgst: number; igst: number; total: number; invoice_no: string;
}
interface SubSummary { count: number; amount: number; service_charge: number; gst: number; total: number; }

export function OtSection({ ctx }: { ctx: FamilyCtx }) {
  const chk = useChecks(ctx);
  const [busy, setBusy] = useState(false);
  const [grid, setGrid] = useState<OtGridRow[]>([]);
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [rows, setRows] = useState<SubRow[]>([]);
  const [summary, setSummary] = useState<SubSummary | null>(null);
  const ready = Boolean(ctx.client && ctx.client !== "ALL" && ctx.month && ctx.state);

  const loadGrid = useCallback(async () => {
    if (!ready) { setGrid([]); return; }
    const g = await getJSON<{ results: OtGridRow[] }>(`${API}/ot/grid/?${query(ctx)}`);
    const list = g?.results ?? [];
    setGrid(list);
    setReasons(Object.fromEntries(list.map((r) => [r.unit_code, r.rejected_reason || ""])));
    setPicked({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, ctx.client, ctx.state, ctx.unit, ctx.month]);

  useEffect(() => { void loadGrid(); }, [loadGrid]);

  async function loadRows() {
    if (!ready) return;
    const g = await getJSON<{ results: SubRow[]; summary: SubSummary }>(`${BILLING_API}/sub-grid/?${query(ctx, { kind: "ot" })}`);
    setRows(g?.results ?? []);
    setSummary(g?.summary ?? null);
  }

  async function dl(path: string, fallback: string, base = API + "/ot") {
    try { await downloadBlob(`${base}/${path}/?${query(ctx, base === API + "/ot" ? {} : { kind: "ot" })}`, fallback); }
    catch (e) { chk.say(e instanceof Error ? e.message : "No Matching Records Found."); }
    await loadGrid();
  }

  async function post(url: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const r = await mk(url, body(ctx, extra));
      if (!r.ok) { chk.say(await responseMessage(r, "Request failed.")); return null; }
      return await r.json();
    } finally { setBusy(false); }
  }

  async function doProcess() {
    if (!chk.process()) return;
    const j = await post(`${BILLING_API}/sub-process/`, { kind: "ot", invoice_slot: "" });
    if (j) ctx.setMessage(`OT Billing: ${j.count} row(s) processed. Amount ${money2(j.amount)}, service charge ${money2(j.service_charge)}, GST ${money2(j.gst)}, total ${money2(j.total)}.`);
    await loadRows();
    await loadGrid();
  }

  async function doFinal() {
    if (!chk.withInvoice()) return;
    if (!window.confirm(` Invoice No : ${ctx.invoiceNo} And Billing Date : ${ctx.billDate}\n\n Are you sure want to Final Invoice Print?`)) return;
    const j = await post(`${BILLING_API}/sub-final-invoice/`, { kind: "ot", invoice_slot: "" });
    if (j) {
      const m = `Invoice ${j.invoice_no} ${j.reused ? "re-printed" : "posted to the GST register"}. Total ${money2(j.total)}.`;
      ctx.setMessage(m); alert(m);
      if (j.invoice_no) ctx.setInvoiceNo(j.invoice_no);
      // legacy Final OT Invoice Print (DS_FLAG = 1): the posted invoice downloads as DG_<invoice no>_<state>.pdf
      try { await downloadBlob(`${BILLING_API}/sub-invoice-copy/?${query(ctx, { kind: "ot", final: "1" })}`, "Invoice.pdf"); }
      catch (e) { chk.say(e instanceof Error ? e.message : "No Matching Records Found."); }
    }
    await loadRows();
    await loadGrid();
  }

  async function decide(approve: boolean) {
    const units = grid.filter((r) => picked[r.unit_code]).map((r) => r.unit_code);
    if (units.length === 0) { alert("Please select atleast one Branch"); return; }
    if (!window.confirm(approve ? "Are you Sure You Want to Approve Record" : "Are you Sure You Want to Reject Record")) {
      alert("Record not Available"); return;
    }
    const j = await post(`${API}/ot/${approve ? "approve" : "reject"}/`, { unit_codes: units, reasons });
    if (j?.messages) j.messages.forEach((m: string) => alert(m));
    else if (j?.message) alert(j.message);
    await loadGrid();
  }

  const allPicked = grid.length > 0 && grid.every((r) => picked[r.unit_code]);

  return (
    <div style={{ marginTop: 6 }}>
      <div className="row text-center" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <button className="lg-btn lg-btn-primary" style={BTN} disabled={busy} onClick={() => void doProcess()}>Process</button>
        <button className="lg-btn lg-btn-primary" style={BTN} disabled={busy}
          onClick={() => { if (chk.all()) void dl("ot-sheet", "OT_SHEET.xls"); }}>OT Sheet</button>
        <button className="lg-btn lg-btn-primary" style={BTN} disabled={busy}
          onClick={() => { if (chk.all()) void dl("break-up", "OT_RATE_BREAKUP.xls"); }}>OT Break Up</button>
        <button className="lg-btn lg-btn-primary" style={BTN} disabled={busy}
          onClick={() => { if (chk.withInvoice()) void dl("finance-copy", "FINANCE_COPY.xls"); }}> OT Finance Copy</button>
        <button className="lg-btn lg-btn-primary" style={BTN} disabled={busy}
          onClick={() => { if (chk.invoice()) void dl("sub-invoice-copy", "Invoice.pdf", BILLING_API); }}>OT Invoice Copy</button>
        <button className="lg-btn lg-btn-primary" style={BTN} disabled={busy} onClick={() => void doFinal()}>Final OT Invoice Print</button>
        <button className="lg-btn lg-btn-primary" style={BTN} disabled={busy}
          onClick={() => { if (chk.withInvoice()) void dl("client-sheet", "OT_Client_Sheet.xls"); }}>OT Client Sheet</button>
        <button className="lg-btn" style={BTN} disabled={busy} onClick={() => { void loadRows(); void loadGrid(); }}>Show</button>
      </div>

      {rows.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: 12 }}>
          <table className="lg-grid" style={{ width: "100%" }}>
            <thead><tr><th>State</th><th>Branch</th><th>Code</th><th>Name</th><th>Designation</th><th>Amount</th><th>Service Charge</th>
              <th>CGST</th><th>SGST</th><th>IGST</th><th>Total</th><th>Invoice No.</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.id}><td>{r.state_name}</td><td>{r.unit_name}</td><td>{r.emp_code}</td><td>{r.emp_name}</td><td>{r.grade_desc}</td>
                <td>{money2(r.amount)}</td><td>{money2(r.service_charge)}</td><td>{money2(r.cgst)}</td><td>{money2(r.sgst)}</td>
                <td>{money2(r.igst)}</td><td>{money2(r.total)}</td><td>{r.invoice_no}</td></tr>))}</tbody>
            {summary && <tfoot><tr><th colSpan={5}>TOTAL ({summary.count})</th><th>{money2(summary.amount)}</th><th>{money2(summary.service_charge)}</th>
              <th colSpan={3}>{money2(summary.gst)}</th><th>{money2(summary.total)}</th><th /></tr></tfoot>}
          </table>
        </div>
      )}

      {grid.length > 0 && (
        <div className="grid-view" style={{ marginTop: 14 }}>
          <div className="row text-center" style={{ textAlign: "center" }}><h3>Approve OT By Admin</h3></div>
          <div style={{ overflowX: "auto" }}>
            <table className="lg-grid table" style={{ width: "100%" }}>
              <thead><tr>
                <th>
                  <label><input type="checkbox" checked={allPicked}
                    onChange={(e) => setPicked(Object.fromEntries(grid.map((r) => [r.unit_code, e.target.checked])))} /> SELECT </label>
                  {" "}
                  <button type="button" className="lg-btn" title="Download the OT sheets as a zip file" disabled={busy}
                    onClick={() => {
                      const units = grid.filter((r) => picked[r.unit_code]).map((r) => r.unit_code).join(",");
                      void downloadBlob(`${API}/ot/sheet-zip/?${query(ctx, { unit_codes: units })}`, "OT.zip")
                        .catch((e) => chk.say(e instanceof Error ? e.message : "Attachment File Cannot Be Downloaded !!!"));
                    }}>ZIP</button>
                </th>
                <th>CLIENT NAME</th><th>STATE NAME</th><th>BRANCH NAME</th><th>MONTH YEAR</th><th>CURRENT STATUS</th>
                <th>DOWNLOAD</th><th>REJECT REASON</th></tr></thead>
              <tbody>{grid.map((r) => {
                const st = r.status.toUpperCase();
                const bg = st === "APPROVE BY FINANCE" ? "#90EE90" : st === "REJECT BY FINANCE" ? "#FF4C4C" : st === "REJECT BY MD" ? "#FACC2E" : undefined;
                return (
                  <tr key={r.unit_code} style={{ background: bg }}>
                    <td><input type="checkbox" checked={Boolean(picked[r.unit_code])}
                      onChange={(e) => setPicked((c) => ({ ...c, [r.unit_code]: e.target.checked }))} /></td>
                    <td>{r.client_name}</td><td>{r.state_name}</td><td>{r.branch_name}</td><td>{r.month_year}</td><td>{r.status}</td>
                    <td>
                      <button type="button" className="lg-btn lg-btn-primary" style={{ width: "90%", color: "white" }}
                        onClick={() => {
                          if (!r.ot_file) { alert("Attachment File Cannot Be Downloaded !!!"); return; }
                          void downloadBlob(`${API}/ot/sheet-file/?${query(ctx, { unit_code: r.unit_code })}`, "OT_File")
                            .catch((e) => chk.say(e instanceof Error ? e.message : "Attachment File Cannot Be Downloaded !!!"));
                        }}>OT Sheet</button>
                    </td>
                    <td><input className="lg-control form-control" style={{ width: 180 }} value={reasons[r.unit_code] ?? ""}
                      onChange={(e) => setReasons((c) => ({ ...c, [r.unit_code]: e.target.value }))} /></td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
          <div className="row text-center" style={{ textAlign: "center", marginTop: 8, display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="lg-btn lg-btn-primary" disabled={busy} onClick={() => void decide(true)}>Approve</button>
            <button className="lg-btn lg-btn-primary" disabled={busy} onClick={() => void decide(false)}>Reject</button>
          </div>
        </div>
      )}
    </div>
  );
}
