"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getJSON, getJSONStrict, mk, responseMessage } from "@/lib/api/legacy-fetch";

const ME = () => "/api/payroll/month-end/";
interface St { pro_master_rows: number; approved_rows: number; locked_rows: number; is_month_end: boolean; billed_invoices: number; billed_amount: number; billed_cgst: number; billed_sgst: number; billed_igst: number; }
interface PmtRow { unit_code: string; unit_name: string; emp_code: string; emp_name: string; gross: number; payment: number; payment_approve: number; reject_reason: string; month_end: number; }
const APPROVE_LABEL: Record<number, string> = { 0: "Pending", 1: "Accounts approved", 2: "MD approved", 3: "Rejected" };
interface ClientOpt { client_code: string; client_name: string; }
interface UnitOpt { unit_code: string; unit_name: string; state_name: string; }

// Legacy MonthEndProcess.aspx tab order.
const TABS = [
  { id: "billing", label: "Billing Details" },
  { id: "payment_ap", label: "Payment Details" },
  { id: "payment", label: "Payment" },
  { id: "monthend", label: "Month End" },
  { id: "minibank", label: "MiniBank" },
  { id: "arrears", label: "Arrears Bill Request" },
  { id: "vendor", label: "Vendor Details" },
  { id: "report", label: "Billing Salary Report" },
  { id: "einvoice", label: "E-Invoice Report" },
] as const;

// Honest per-tab status. The legacy MonthEndProcess.aspx bundles 9 finance modules;
// in the modern port several either live on their own screens, write legacy (read-only)
// tables, or depend on the blocked external IRP service.
const TAB_INFO: Record<string, { note: string; link?: { href: string; label: string } }> = {
  billing: {
    note: "Final-bill view, MD Approve & Edit-Enable. The invoice list and the Attendance / Finance / Invoice copies live on the Client Billing screen. The MD 'Approve' / 'Edit Enable' actions set invoice flags on legacy tables (read-only in this port), so they are not re-exposed here.",
    link: { href: "/payroll/client-billing", label: "Open Client Billing" },
  },
  payment: {
    note: "Client invoice receipt entry (receive amount against an invoice). This per-invoice receipt ledger is not ported yet; related receivables are on the Outstanding Report screen.",
    link: { href: "/transactions/outstanding-report", label: "Open Outstanding Report" },
  },
  minibank: {
    note: "Bank receipt entry into the mini-bank ledger (pay_minibank_master). In the modern app this is handled by the Account portal screen, not from the month-end hub.",
  },
  arrears: {
    note: "MD Approve / Reject of arrears bill requests. This writes legacy tables (pay_arrears_bill_request, pay_attendance_muster.arrears_flag) which are READ-ONLY in the modern port, so it cannot be made functional here without new modern-owned tables.",
  },
  vendor: {
    note: "MD 'Edit Bill Enable' un-finalizes a vendor Purchase Invoice / PO (final flag → 0). This writes legacy tables (pay_transactionp / pay_transaction_po) which are READ-ONLY in the modern port, so it is not exposed here.",
  },
  report: {
    note: "The per-employee Billing-vs-Salary PAID_UNPAID_REPORT.xls export is not ported yet — it is a large combined billing+salary report, a dedicated build.",
  },
  einvoice: {
    note: "List issued e-invoices and Cancel E-Invoice via the external IRP (OctaBills) service. This is BLOCKED on the external government IRP integration — the modern IRP provider is fail-closed — so the cancel action cannot be performed.",
  },
};

export default function MonthEndPage() {
  const [tab, setTab] = useState<string>("monthend");

  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [month, setMonth] = useState(""); const [year, setYear] = useState("");
  const [client, setClient] = useState("0");
  const [state, setState] = useState("ALL");
  const [unit, setUnit] = useState("ALL");
  const [st, setSt] = useState<St | null>(null);
  const [msg, setMsg] = useState("");
  const [pmt, setPmt] = useState<PmtRow[] | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    getJSON<{ results: ClientOpt[] }>("/api/masters/clients/?page_size=all").then((d) => setClients(d?.results ?? []));
  }, []);
  useEffect(() => {
    if (!client || client === "0") { setUnits([]); setStates([]); return; }
    getJSON<{ units: UnitOpt[]; states: string[] }>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(client)}`).then((d) => {
      const rs = d?.units ?? [];
      setUnits(rs);
      setStates([...(d?.states ?? Array.from(new Set(rs.map((u) => u.state_name).filter(Boolean))))].sort());
    });
  }, [client]);

  const slice = () => `${state !== "ALL" ? `&state=${encodeURIComponent(state)}` : ""}${unit !== "ALL" ? `&unit_code=${encodeURIComponent(unit)}` : ""}`;
  const body = () => ({
    month: Number(month), year: Number(year), client_code: client,
    ...(state !== "ALL" ? { state } : {}), ...(unit !== "ALL" ? { unit_code: unit } : {}),
  });

  const load = useCallback(async () => {
    if (!client || client === "0") { setMsg("Please Select Client Name"); return; }
    if (!month || !year) { setMsg("Please Select month & year."); return; }
    setMsg("");
    setSt(await getJSON<St>(`${ME()}status/?month=${month}&year=${year}&client_code=${encodeURIComponent(client)}${slice()}`));
  }, [month, year, client, state, unit]);

  const run = async (action: "month_end" | "month_start") => {
    if (!client || client === "0") { setMsg("Please Select Client Name"); return; }
    if (!month || !year) { setMsg("Please Select month & year."); return; }
    const r = await mk(`${ME()}${action}/`, body());
    const b = await r.json().catch(() => ({}));
    setMsg(r.ok ? b.status : await responseMessage(r)); load();
  };

  const checkSel = (): boolean => {
    if (!client || client === "0") { setMsg("Please Select Client Name"); return false; }
    if (!month || !year) { setMsg("Please Select month & year."); return false; }
    return true;
  };
  const pmtView = async () => {
    if (!checkSel()) return;
    setMsg("");
    try {
      const b = await getJSONStrict<{ results: PmtRow[] }>(`${ME()}payment-list/?month=${month}&year=${year}&client_code=${encodeURIComponent(client)}${slice()}`);
      setPmt(b.results);
    } catch (e) { setPmt(null); setMsg(e instanceof Error ? e.message : "No Matching Records Found."); }
  };
  const pmtAct = async (act: "payment-approve" | "payment-reject") => {
    if (!checkSel()) return;
    const r = await mk(`${ME()}${act}/`, { ...body(), reject_reason: reason });
    const b = await r.json().catch(() => ({}));
    const m = r.ok ? b.status : await responseMessage(r);
    if (r.ok) { setReason(""); await pmtView(); }
    setMsg(m);
  };

  return (
    <section style={{ padding: "15px", fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px", backgroundColor: "#fff" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "8.33%" }} />
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>MONTH END PROCESS</div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <a href="#" onClick={(e) => e.preventDefault()} style={{ color: "#fff", fontSize: "10px" }}>
              <img src="/Images/help_ico.png" alt="Help" width={20} height={20} title="Help" />
            </a>
          </div>
        </div>
        <br />

        <div style={{ background: "beige", padding: "10px" }}>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexWrap: "wrap", borderBottom: "1px solid #ccc" }}>
            {TABS.map((t) => (
              <li key={t.id} style={{ marginBottom: "-1px" }}>
                <a href="#" onClick={(e) => { e.preventDefault(); setTab(t.id); setMsg(""); }}
                  style={{ display: "block", padding: "9px 13px", textDecoration: "none", background: tab === t.id ? "#fff" : "#eee", color: tab === t.id ? "#555" : "#00547E", border: "1px solid #ccc", borderBottomColor: tab === t.id ? "transparent" : "#ccc", borderRadius: "4px 4px 0 0", fontWeight: tab === t.id ? "bold" : "normal", fontSize: 13 }}>{t.label}</a>
              </li>
            ))}
          </ul>

          <div style={{ background: "#fff", border: "1px solid #ccc", borderTop: "none", padding: "20px", minHeight: 300 }}>
            {tab === "monthend" || tab === "payment_ap" ? (
              <>
                <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "flex-end" }}>
                  <div style={{ flex: "0 0 16.66%", minWidth: 150 }}>
                    <b>Month/Year :</b><span style={{ color: "red" }}>*</span>
                    <input type="month" className="form-control" style={inp}
                      value={year && month ? `${year}-${month.padStart(2, "0")}` : ""}
                      onChange={(e) => { if (e.target.value) { const [y, m] = e.target.value.split("-"); setYear(y); setMonth(parseInt(m, 10).toString()); } else { setYear(""); setMonth(""); } }} />
                  </div>
                  <div style={{ flex: "0 0 16.66%", minWidth: 150 }}>
                    <b>Client Name :</b><span style={{ color: "red" }}>*</span>
                    <select className="form-control" style={inp} value={client} onChange={(e) => { setClient(e.target.value); setState("ALL"); setUnit("ALL"); }}>
                      <option value="0">Select</option>
                      {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: "0 0 16.66%", minWidth: 150 }}>
                    <b>State Name :</b>
                    <select className="form-control" style={inp} value={state} onChange={(e) => { setState(e.target.value); setUnit("ALL"); }}>
                      <option value="ALL">ALL</option>
                      {states.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: "0 0 16.66%", minWidth: 150 }}>
                    <b>Branch Name :</b>
                    <select className="form-control" style={inp} value={unit} onChange={(e) => setUnit(e.target.value)}>
                      <option value="ALL">ALL</option>
                      {units.filter((u) => state === "ALL" || u.state_name === state).map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
                    </select>
                  </div>
                  {tab === "monthend" ? (
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button className="btn btn-primary" onClick={load} style={btnBlue}>Load Status</button>
                      <button className="btn btn-large" onClick={() => run("month_end")} disabled={!st} style={btnGrey}>Month End</button>
                      <button className="btn btn-large" onClick={() => run("month_start")} disabled={!st} style={btnGrey}>Month Start</button>
                      <Link href="/" className="btn btn-danger" style={{ ...btnRed, textDecoration: "none" }}>Close</Link>
                    </div>
                  ) : (
                    <div style={{ display: "flex", gap: "6px", alignItems: "flex-end", flexWrap: "wrap" }}>
                      <button className="btn btn-primary" onClick={pmtView} style={btnBlue}>View</button>
                      <button className="btn btn-primary" onClick={() => pmtAct("payment-approve")} style={btnBlue}>Approve</button>
                      <input className="form-control" style={{ ...inp, width: 200 }} placeholder="Reject reason" value={reason} onChange={(e) => setReason(e.target.value)} />
                      <button className="btn btn-danger" onClick={() => pmtAct("payment-reject")} style={btnRed}>Reject</button>
                      <Link href="/" className="btn btn-danger" style={{ ...btnRed, textDecoration: "none" }}>Close</Link>
                    </div>
                  )}
                </div>

                {msg && <div style={{ color: "#d9534f", fontWeight: "bold", textAlign: "center", padding: "10px" }}>{msg}</div>}

                {tab === "payment_ap" && pmt && (
                  <div style={{ overflowX: "auto", marginTop: 20 }}>
                    <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff", border: "1px solid #ddd" }}>
                      <thead style={{ background: "#006699", color: "white" }}>
                        <tr><th style={{ padding: 8 }}>BRANCH</th><th style={{ padding: 8 }}>EMP CODE</th><th style={{ padding: 8 }}>EMPLOYEE</th><th style={{ padding: 8 }}>GROSS</th><th style={{ padding: 8 }}>PAYMENT</th><th style={{ padding: 8 }}>APPROVAL</th><th style={{ padding: 8 }}>REJECT REASON</th></tr>
                      </thead>
                      <tbody>
                        {pmt.map((r, i) => (
                          <tr key={i}><td style={td}>{r.unit_name}</td><td style={td}>{r.emp_code}</td><td style={td}>{r.emp_name}</td><td style={td}>{r.gross}</td><td style={td}>{r.payment}</td><td style={td}>{APPROVE_LABEL[r.payment_approve] ?? r.payment_approve}</td><td style={td}>{r.reject_reason}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {tab === "monthend" && st && (
                  <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff", border: "1px solid #ddd", marginTop: 20 }}>
                    <thead style={{ background: "#006699", color: "white" }}><tr><th style={{ padding: 8 }}>METRIC</th><th style={{ padding: 8 }}>VALUE</th></tr></thead>
                    <tbody>
                      <tr><td style={tdB}>Payroll rows</td><td style={td}>{st.pro_master_rows}</td></tr>
                      <tr><td style={tdB}>Approved rows</td><td style={td}>{st.approved_rows}</td></tr>
                      <tr><td style={tdB}>Locked (month-end) rows</td><td style={td}>{st.locked_rows}</td></tr>
                      <tr><td style={tdB}>Month End done?</td><td style={{ padding: 8, color: st.is_month_end ? "green" : "red" }}>{st.is_month_end ? "COMPLETED" : "0"}</td></tr>
                      <tr><td style={tdB}>Billed invoices</td><td style={td}>{st.billed_invoices}</td></tr>
                      <tr><td style={tdB}>Billed amount</td><td style={td}>{st.billed_amount}</td></tr>
                      <tr><td style={tdB}>GST (CGST/SGST/IGST)</td><td style={td}>{st.billed_cgst} / {st.billed_sgst} / {st.billed_igst}</td></tr>
                    </tbody>
                  </table>
                )}
              </>
            ) : (
              <div style={{ padding: "24px", background: "#fcf8e3", border: "1px solid #faebcc", borderRadius: 4, color: "#8a6d3b", lineHeight: 1.6 }}>
                <div style={{ fontWeight: "bold", fontSize: 15, marginBottom: 8 }}>{TABS.find((t) => t.id === tab)?.label}</div>
                <div>{TAB_INFO[tab]?.note}</div>
                {TAB_INFO[tab]?.link && (
                  <div style={{ marginTop: 14 }}>
                    <Link href={TAB_INFO[tab]!.link!.href} className="btn btn-primary" style={{ ...btnBlue, textDecoration: "none" }}>{TAB_INFO[tab]!.link!.label} →</Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

const inp: React.CSSProperties = { width: "100%", height: "34px", borderRadius: "4px", border: "1px solid #ccc" };
const btnBlue: React.CSSProperties = { background: "#337ab7", borderColor: "#2e6da4", color: "#fff", padding: "6px 12px", borderRadius: "4px" };
const btnGrey: React.CSSProperties = { background: "#f5f5f5", border: "1px solid #ccc", padding: "6px 12px", borderRadius: "4px" };
const btnRed: React.CSSProperties = { background: "#d9534f", borderColor: "#d43f3a", color: "#fff", padding: "6px 12px", borderRadius: "4px" };
const td: React.CSSProperties = { padding: 8 };
const tdB: React.CSSProperties = { padding: 8, fontWeight: "bold" };
