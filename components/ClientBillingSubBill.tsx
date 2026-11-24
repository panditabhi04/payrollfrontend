"use client";

/**
 * Client Billing - sub-billing types (R And M Service, Administrative Expenses, OT, Shiftwise,
 * Incentive, Office Rent). Buttons, prompts and alerts follow grade_unit_billing.aspx; every action
 * calls the /api/payroll/client-billing/sub-* endpoints (real compute / persist / invoice).
 */
import { useState } from "react";
import { getJSON, mk, responseMessage } from "@/lib/api/legacy-fetch";
import { BILLING_API, downloadBlob, type BillingScope } from "./ClientBillingPanels";

export interface SubBillConfig {
  kind: string; slot?: boolean; approvals?: boolean;
  process: string; finance: string; invoice: string; final: string;
}

export const SUB_BILL_TYPES: Record<string, SubBillConfig> = {
  "R And M Service": { kind: "rm", slot: true, approvals: true, process: "Process", finance: "Finance Copy", invoice: "Invoice", final: "Final Invoice" },
  "Administrative Expenses": { kind: "admin", approvals: true, process: "Process", finance: "Finance Copy", invoice: "Invoice", final: "Final Invoice" },
  "OT Billing": { kind: "ot", process: "Process", finance: "OT Finance Copy", invoice: "OT Invoice Copy", final: "Final OT Invoice Print" },
  "Shiftwise Billing": { kind: "shift", approvals: true, process: "Process", finance: "Finance Copy", invoice: "Invoice Copy", final: "Final Invoice Print" },
  "Incentive Billing": { kind: "incentive", process: "Process", finance: "Finance Copy", invoice: "Invoice Copy", final: "Final Invoice Print" },
  "Office Rent Billing": { kind: "office_rent", process: "Process", finance: "Finance Copy", invoice: "Invoice Copy", final: "Final Invoice Print" },
  // Machine Rent: legacy swaps the handlers of "Rent Finance Copy" / "Rent Invoice"; here each label runs its own report.
  "Machine Rental": { kind: "machine", process: "Process", finance: "Rent Finance Copy", invoice: "Rent Invoice", final: "Final Invoice" },
};

interface SubRow {
  id: number; state_name: string; unit_name: string; emp_code: string; emp_name: string; grade_desc: string;
  amount: number; service_charge: number; cgst: number; sgst: number; igst: number; total: number; invoice_no: string;
}
interface MachineRow {
  id: number; unit_code: string; machine_name: string; rate_type: string; rate: number; handling: string;
  handling_per: number; handling_amount: number; machine_code: string;
}
interface SubSummary { count: number; amount: number; service_charge: number; gst: number; total: number; }
interface EntryRow {
  id: number; state_name: string; unit_name: string; party_name: string; emp_code: string; amount: number;
  status: string; reject_reason: string; approve_flag: number;
}

const money2 = (v: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(v || 0);

export default function SubBillSection({ billingType, cfg, scope, fields, invoiceNo, billDate, setMessage }: {
  billingType: string; cfg: SubBillConfig; scope: BillingScope | null; fields: Record<string, unknown>;
  invoiceNo: string; billDate: string; setMessage: (m: string) => void;
}) {
  const [slot, setSlot] = useState("Select");
  const [rows, setRows] = useState<SubRow[]>([]);
  const [summary, setSummary] = useState<SubSummary | null>(null);
  const [entries, setEntries] = useState<EntryRow[]>([]);
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const [reasons, setReasons] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [machines, setMachines] = useState<MachineRow[]>([]);
  const [qty, setQty] = useState<Record<number, string>>({});

  const say = (m: string) => { setMessage(m); alert(m); };
  const body = () => ({ ...(scope ?? {}), ...fields, kind: cfg.kind, invoice_slot: cfg.slot ? (slot === "Select" ? "" : slot) : "" });
  const query = () => {
    const p = new URLSearchParams();
    Object.entries(body()).forEach(([k, v]) => { if (v !== undefined && v !== null) p.set(k, String(v)); });
    return p.toString();
  };

  function preCheck(needInvoice: boolean): boolean {
    if (!scope) { say("Please Select Client Name "); return false; }
    if (cfg.slot && slot === "Select") { say("Please Select Invoice Slot"); return false; }
    if (needInvoice && !invoiceNo.trim()) { say("Please Enter Invoice No "); return false; }
    if (needInvoice && !billDate) { say("Please Enter Bill Date "); return false; }
    return true;
  }

  async function load() {
    if (!scope) return;
    if (cfg.kind === "machine") {
      const m = await getJSON<{ results: MachineRow[] }>(`${BILLING_API}/machine-grid/?${query()}`);
      setMachines(m?.results ?? []);
    }
    const g = await getJSON<{ results: SubRow[]; summary: SubSummary }>(`${BILLING_API}/sub-grid/?${query()}`);
    setRows(g?.results ?? []);
    setSummary(g?.summary ?? null);
    if (cfg.approvals) {
      const e = await getJSON<{ results: EntryRow[] }>(`${BILLING_API}/sub-entries/?${query()}`);
      setEntries(e?.results ?? []);
      setChecked({});
      setReasons(Object.fromEntries((e?.results ?? []).map((r) => [r.id, r.reject_reason || ""])));
    }
  }

  async function post(path: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    try {
      const r = await mk(`${BILLING_API}/${path}/`, { ...body(), ...extra });
      if (!r.ok) { say(await responseMessage(r, "Request failed.")); return null; }
      return await r.json();
    } finally { setBusy(false); }
  }

  async function download(path: string, fallback: string, needInvoice = false, extra = "") {
    if (!preCheck(needInvoice)) return;
    try { await downloadBlob(`${BILLING_API}/${path}/?${query()}${extra}`, fallback); }
    catch (e) { say(e instanceof Error ? e.message : "No Matching Records Found."); }
  }

  async function doProcess() {
    if (!preCheck(false)) return;
    let extra: Record<string, unknown> = {};
    if (cfg.kind === "machine") {
      const picked = machines.filter((m) => (qty[m.id] ?? "").trim() !== "");
      if (picked.length === 0) { say("Please Enter Quantity"); return; }
      extra = { rows: picked.map((m) => ({ id: m.id, qty: qty[m.id] })) };
    }
    const j = await post("sub-process", extra);
    if (j) setMessage(`${billingType}: ${j.count} row(s) processed. Amount ${money2(j.amount)}, service charge ${money2(j.service_charge)}, GST ${money2(j.gst)}, total ${money2(j.total)}.`);
    await load();
  }

  async function doFinal() {
    if (!preCheck(true)) return;
    if (!window.confirm(` Invoice No : ${invoiceNo} And Billing Date : ${billDate}\n\n Are you sure want to Final Invoice Print?`)) return;
    const j = await post("sub-final-invoice");
    if (j) {
      const m = `Invoice ${j.invoice_no} ${j.reused ? "re-printed" : "posted to the GST register"}. Total ${money2(j.total)}.`;
      setMessage(m); alert(m);
      // legacy Final Invoice (DS_FLAG = 1): the posted invoice downloads as DG_<invoice no>_<state>.pdf
      await download("sub-invoice-copy", "Invoice.pdf", false, "&final=1");
    }
    await load();
  }

  async function decide(approve: boolean) {
    const ids = entries.filter((e) => checked[e.id]).map((e) => e.id);
    if (ids.length === 0) { alert("Please Select Atleast One Record"); return; }
    if (!window.confirm(approve ? "Are you Sure You Want to Approve Record" : "Are you Sure You Want to Reject Record")) return;
    const j = await post(approve ? "sub-approve" : "sub-reject", { ids, reasons });
    if (j?.message) alert(j.message);
    await load();
  }

  return (
    <div style={{ marginTop: 12 }}>
      {cfg.slot && (
        <label className="lg-row" style={{ width: 220, marginBottom: 10 }}>
          <span className="lg-label">Invoice Slot : <span className="lg-req">*</span></span>
          <select className="lg-control" value={slot} onChange={(e) => setSlot(e.target.value)}>
            <option value="Select">Select</option><option value="1_to_15">1 to 15</option><option value="16_to_30">16 to 30</option>
          </select>
        </label>
      )}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
        <button className="lg-btn lg-btn-primary" disabled={busy} onClick={() => void doProcess()}>{cfg.process}</button>
        <button className="lg-btn lg-btn-primary" disabled={busy} onClick={() => void download("sub-finance-copy", cfg.kind === "rm" ? "R&M_FINANCE_COPY.xls" : cfg.kind === "admin" ? "ADMINISTRATIVE_EXPENSE_FINANCE_COPY.xls" : cfg.kind === "machine" ? "Machine_Rental_Finance_copy.xls" : cfg.kind === "office_rent" ? "OFFICE_RENT_FINANCE_COPY.xls" : cfg.kind === "shift" ? "SHIFTWISE_FINANCE_COPY.xls" : cfg.kind === "incentive" ? "INCENTIVE_FINANCE_COPY.xls" : "finance_copy.xlsx")}>{cfg.finance}</button>
        <button className="lg-btn lg-btn-primary" disabled={busy} onClick={() => void download("sub-invoice-copy", cfg.kind === "machine" ? "TaxInvoice.pdf" : "Invoice.pdf", true)}>{cfg.invoice}</button>
        <button className="lg-btn lg-btn-primary" disabled={busy} onClick={() => void doFinal()}>{cfg.final}</button>
        {(cfg.kind === "rm" || cfg.kind === "shift") && (
          <button className="lg-btn lg-btn-primary" disabled={busy}
            onClick={() => void download("sub-invoice-copy", "Invoice.pdf", false, "&digital=1")}>Digital Invoice Print</button>
        )}
        <button className="lg-btn" disabled={busy} onClick={() => void load()}>Show</button>
      </div>
      {cfg.kind === "machine" && machines.length > 0 && (
        <div style={{ overflowX: "auto", marginBottom: 12 }}>
          <table className="lg-grid" style={{ width: "100%" }}>
            <thead><tr><th>Branch</th><th>Machine</th><th>Rate Type</th><th>Rate</th><th>Handling</th><th>Handling %</th><th>Handling Amt</th><th>Quantity</th></tr></thead>
            <tbody>{machines.map((m) => (
              <tr key={m.id}><td>{m.unit_code}</td><td>{m.machine_name}</td><td>{m.rate_type}</td><td>{m.rate}</td><td>{m.handling}</td>
                <td>{m.handling_per}</td><td>{m.handling_amount}</td>
                <td><input className="lg-control" style={{ width: 90 }} value={qty[m.id] ?? ""}
                  onChange={(e) => setQty((c) => ({ ...c, [m.id]: e.target.value }))} /></td></tr>))}</tbody>
          </table>
        </div>
      )}
      {rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
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
      {cfg.approvals && entries.length > 0 && (
        <div className="grid-view" style={{ marginTop: 14 }}>
          <div style={{ textAlign: "center" }}><h3>{billingType} Entries</h3></div>
          <div style={{ overflowX: "auto" }}>
            <table className="lg-grid" style={{ width: "100%" }}>
              <thead><tr>
                <th><input type="checkbox" checked={entries.every((e) => checked[e.id])}
                  onChange={(ev) => setChecked(Object.fromEntries(entries.map((e) => [e.id, ev.target.checked])))} /></th>
                <th>State</th><th>Branch</th><th>Party / Employee</th><th>Amount</th><th>Status</th><th>Reject Reason</th>{cfg.kind === "shift" && <th>Sheet</th>}</tr></thead>
              <tbody>{entries.map((e) => (
                <tr key={e.id} style={{ background: e.status === "Approve By Finance" ? "#90EE90" : e.status === "Reject By Finance" ? "#FF4C4C" : undefined }}>
                  <td><input type="checkbox" checked={Boolean(checked[e.id])} onChange={(ev) => setChecked((c) => ({ ...c, [e.id]: ev.target.checked }))} /></td>
                  <td>{e.state_name}</td><td>{e.unit_name}</td><td>{e.party_name || e.emp_code}</td><td>{money2(e.amount)}</td><td>{e.status}</td>
                  <td><input className="lg-control" style={{ width: 180 }} value={reasons[e.id] ?? ""}
                    onChange={(ev) => setReasons((c) => ({ ...c, [e.id]: ev.target.value }))} /></td>
                  {cfg.kind === "shift" && <td><button className="lg-btn lg-btn-primary" disabled={busy}
                    onClick={() => { void downloadBlob(`${BILLING_API}/sub-sheet/?id=${e.id}`, "Shiftwise_File").catch(() => alert("Attachment File Cannot Be Downloaded !!!")); }}>Sheet</button></td>}
                </tr>))}</tbody>
            </table>
          </div>
          <div style={{ textAlign: "center", marginTop: 8, display: "flex", gap: 10, justifyContent: "center" }}>
            <button className="lg-btn lg-btn-primary" disabled={busy} onClick={() => void decide(true)}>Approve</button>
            <button className="lg-btn lg-btn-primary" disabled={busy} onClick={() => void decide(false)}>Reject</button>
          </div>
        </div>
      )}
    </div>
  );
}
