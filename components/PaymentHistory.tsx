"use client";

/**
 * Payment History — 1:1 port of payment_history.aspx.
 * Submit = compute billing (legacy final_billing) + insert a payment_history row
 * (via /api/masters/task-master/salary_search/). Receiving Amount = select a grid
 * row, enter receipt + date, Save = PATCH the row (balance auto = billing - received).
 */

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getJSON as apiGet, mk as apiPost } from "@/lib/api/legacy-fetch";
import { updateItem } from "@/lib/api/crud";

interface ClientOpt { client_code: string; client_name: string }
interface PayRow {
  sr_no: number; client_code: string; client_name: string; state: string;
  billing_amt: string; month_year: string; received_amt: string; balance_amt: string;
}
const BASE = "/api/transactions/payment-history";
const num = (v: unknown) => { const n = parseFloat(String(v ?? "0")); return isNaN(n) ? 0 : n; };
// <input type="month"> gives "YYYY-MM"; legacy expects "MM/YYYY".
// <input type="date"> gives "YYYY-MM-DD"; legacy date-picker1 format is dd/mm/yy.
const toDDMMYYYY = (d: string) => (d && d.includes("-") ? d.split("-").reverse().join("/") : d);
const toMMYYYY = (d: string) => (d && d.includes("-") ? `${d.split("-")[1]}/${d.split("-")[0]}` : d);

export default function PaymentHistory() {
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [amountStates, setAmountStates] = useState<string[]>([]);
  const [prevReceived, setPrevReceived] = useState(0);
  const [prevBalance, setPrevBalance] = useState(0);

  const [selectedClient, setSelectedClient] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const [showReceiving, setShowReceiving] = useState(false);
  const [selectedSrNo, setSelectedSrNo] = useState<number | null>(null);
  const [amountClient, setAmountClient] = useState("");
  const [amountState, setAmountState] = useState("");
  const [billingAmount, setBillingAmount] = useState(0);
  const [receivingAmount, setReceivingAmount] = useState(0);
  const [receivedDate, setReceivedDate] = useState("");
  const [balanceAmount, setBalanceAmount] = useState(0);

  const [payments, setPayments] = useState<PayRow[]>([]);

  const loadGrid = useCallback(async (clientCode: string) => {
    const q = clientCode ? `?client_code=${encodeURIComponent(clientCode)}` : "";
    const res = await apiGet<{ results: PayRow[] }>(`${BASE}/${q}${q ? "&" : "?"}page_size=all`);
    setPayments(res?.results ?? (Array.isArray(res) ? (res as unknown as PayRow[]) : []));
  }, []);

  useEffect(() => {
    apiGet<{ results: ClientOpt[] }>(`${BASE}/clients/`).then((d) => setClients(d?.results ?? []));
    loadGrid("");
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ddl_client_SelectedIndexChanged / ddl_client_amount_SelectedIndexChanged: states of the client + "ALL".
  const loadStates = async (client: string): Promise<string[]> => {
    if (!client) return [];
    const d = await apiGet<{ results: string[] }>(`${BASE}/states/?client=${encodeURIComponent(client)}`);
    return ["ALL", ...(d?.results ?? [])];
  };
  const onClientChange = async (v: string) => { setSelectedClient(v); setSelectedState(""); setStates(await loadStates(v)); };
  const onAmountClientChange = async (v: string) => { setAmountClient(v); setAmountState(""); setAmountStates(await loadStates(v)); };

  // Submit = legacy validation() + final_billing + insert (btn_add1).
  const onSubmit = async () => {
    if (!selectedClient) { alert("Please select Client"); return; }
    if (!selectedState) { alert("Please select Client"); return; }  // legacy reuses this string (ALL is the only valid "Select" alternative)
    if (!filterDate) { alert("Please Select Month"); return; }
    setLoading(true);
    try {
      const clientName = clients.find((c) => c.client_code === selectedClient)?.client_name || selectedClient;
      const r = await apiPost("/api/masters/task-master/salary_search/", {
        client: selectedClient, client_name: clientName, state: selectedState, date: toMMYYYY(filterDate),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) { alert(b.detail || "Payment NOT save !!!"); return; }
      if (Number(b.billing_amount) === 0) { alert("First Complete Billing Process !!!"); }
      else { alert(b.message || "Payment Save Succsefully !!"); }
      await loadGrid("");
    } finally { setLoading(false); }
  };

  // Click a billing row -> open receiving panel populated from that row (onSelected_IndexChange).
  // Legacy: txt_receive_amount starts at 0 (a NEW receipt); balance = previous balance - receipt;
  // the saved received total = previous received (Session["recived_amt"]) + receipt.
  const selectRow = async (p: PayRow) => {
    if ((p as any).source === "legacy") { alert("This row comes from the legacy invoice ledger and is read-only here."); return; }
    setSelectedSrNo(p.sr_no);
    setAmountClient(p.client_code);
    setAmountState(p.state);
    setBillingAmount(num(p.billing_amt));
    setPrevReceived(num(p.received_amt));
    setPrevBalance(num(p.balance_amt));
    setReceivingAmount(0);
    setReceivingText("0");
    setBalanceAmount(num(p.balance_amt));
    setReceivedDate("");
    setShowReceiving(true);
    const st = await loadStates(p.client_code);
    setAmountStates(st.includes(p.state) ? st : [...st, p.state]);
  };

  // Text state so typing replaces the initial 0 (a number input kept "0" and produced 0123).
  const [receivingText, setReceivingText] = useState("0");
  const onReceivingChange = (raw: string) => {
    let v = raw.replace(/[^0-9.]/g, "");
    if (v.includes(".")) v = v.slice(0, v.indexOf(".") + 1) + v.slice(v.indexOf(".") + 1).replace(/\./g, "");
    if (/^0\d/.test(v)) v = v.replace(/^0+/, "");          // typing after the default 0 drops the leading zero
    setReceivingText(v);
    const r = num(v);
    setReceivingAmount(r);
    setBalanceAmount(prevBalance - r);
  };

  // Save = Required_validation() + persist receipt (PATCH -> balance auto-derived).
  const onSave = async () => {
    if (!amountClient) { alert("Please Select Client Name"); return; }
    if (!amountState) { alert("Please Select State Name"); return; }
    if (!receivingAmount) { alert("Please Enter Receiving Amount"); return; }
    if (!receivedDate) { alert("Please Enter Received Date"); return; }
    if (selectedSrNo == null) { alert("Please select a billing row first."); return; }
    setLoading(true);
    try {
      const res = await updateItem<PayRow>(BASE, selectedSrNo, {
        received_amt: String(prevReceived + receivingAmount), received_date: toDDMMYYYY(receivedDate), client_code: amountClient,
      });
      if (res.ok) { alert("Payment Save successfully!!"); setShowReceiving(false); await loadGrid(selectedClient); }
      else alert("Payment Save failed!!");
    } finally { setLoading(false); }
  };

  return (
    <div className="container-fluid" style={{ maxWidth: "99%", margin: "0 auto", padding: "20px", fontSize: "14px" }}>
      {loading && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(204,204,204,0.7)", zIndex: 9999 }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>Loading...</div>
        </div>
      )}

      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ flex: "1", textAlign: "center", fontSize: "small", fontWeight: "bold" }}>Payment History</div>
          <Link href="#" onClick={(e) => { e.preventDefault(); window.open("html/payment_history.html", "popUpWindow", "height=500,width=600"); }} style={{ color: "#fff" }}>
            <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
          </Link>
        </div>

        <div className="panel-body" style={{ padding: "15px" }}>
          <div className="row" style={{ display: "flex", flexWrap: "wrap", marginBottom: "20px" }}>
            <div style={{ flex: "0 0 16.66%", padding: "0 15px" }}>
              Client:<span style={{ color: "red" }}>*</span>
              <select value={selectedClient} onChange={(e) => onClientChange(e.target.value)} className="form-control" style={{ width: "100%" }}>
                <option value="">&lt;Select&gt;</option>
                {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
              </select>
            </div>
            <div style={{ flex: "0 0 16.66%", padding: "0 15px" }}>
              State:<span style={{ color: "red" }}>*</span>
              <select value={selectedState} onChange={(e) => setSelectedState(e.target.value)} className="form-control" style={{ width: "100%" }}>
                <option value="">Select</option>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ flex: "0 0 16.66%", padding: "0 15px" }}>
              Date :<span style={{ color: "red" }}>*</span>
              <input type="month" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="form-control" style={{ width: "100%" }} />
            </div>
            <div style={{ flex: "0 0 16.66%", padding: "0 15px", marginTop: "16px" }}>
              <button onClick={onSubmit} className="btn btn-primary" style={{ padding: "6px 12px" }}>Submit</button>
            </div>
          </div>

          {showReceiving && (
            <div style={{ border: "1px solid #ccc", padding: "15px", borderRadius: "4px", marginBottom: "20px" }}>
              <div className="row" style={{ display: "flex", flexWrap: "wrap", marginBottom: "15px" }}>
                <div style={{ flex: "0 0 16.66%", padding: "0 15px" }}>
                  Client:<span style={{ color: "red" }}>*</span>
                  <select value={amountClient} onChange={(e) => onAmountClientChange(e.target.value)} className="form-control" style={{ width: "100%" }}>
                    <option value="">Select</option>
                    {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
                  </select>
                </div>
                <div style={{ flex: "0 0 16.66%", padding: "0 15px" }}>
                  State:<span style={{ color: "red" }}>*</span>
                  <select value={amountState} onChange={(e) => setAmountState(e.target.value)} className="form-control" style={{ width: "100%" }}>
                    <option value="">Select</option>
                    {amountStates.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div style={{ flex: "0 0 16.66%", padding: "0 15px" }}>
                  Billing Amount :
                  <input type="text" readOnly value={billingAmount} className="form-control" style={{ width: "100%" }} />
                </div>
                <div style={{ flex: "0 0 16.66%", padding: "0 15px" }}>
                  Receiving Amount :<span style={{ color: "red" }}>*</span>
                  <input type="text" inputMode="decimal" value={receivingText} onFocus={(e) => e.target.select()} onChange={(e) => onReceivingChange(e.target.value)} onBlur={() => { if (receivingText === "") setReceivingText("0"); }} className="form-control" style={{ width: "100%" }} />
                </div>
                <div style={{ flex: "0 0 16.66%", padding: "0 15px" }}>
                  Received Date :<span style={{ color: "red" }}>*</span>
                  <input type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} className="form-control" style={{ width: "100%" }} />
                </div>
                <div style={{ flex: "0 0 16.66%", padding: "0 15px" }}>
                  Balance Amount :
                  <input type="text" readOnly value={balanceAmount} className="form-control" style={{ width: "100%" }} />
                </div>
              </div>
              <div style={{ textAlign: "center", marginBottom: "10px" }}>
                <button onClick={onSave} className="btn btn-primary" style={{ padding: "6px 12px", marginRight: "10px" }}>Save</button>
                <button onClick={() => setShowReceiving(false)} className="btn btn-danger" style={{ padding: "6px 12px" }}>Close</button>
              </div>
              <div style={{ fontSize: "12px", color: "#777", textAlign: "center" }}>Click a row in the grid below to record a receipt against it.</div>
            </div>
          )}

          <PaymentGrid rows={payments} onRowClick={selectRow} />
        </div>
      </div>
    </div>
  );
}

// ---- Legacy DataTable behaviour (payment_history.aspx: DataTable with full_numbers paging, search, sorting,
// CSV / Print / Copy / Column-visibility buttons). Client-side, no extra library.
type GCol = { key: string; label: string; get: (p: PayRow) => string; bold?: boolean };
const GCOLS: GCol[] = [
  { key: "sr_no", label: "Sr No.", get: (p) => String(p.sr_no) },
  { key: "client_name", label: "Client Name", get: (p) => p.client_name ?? "" },
  { key: "state", label: "state_name", get: (p) => p.state ?? "" },
  { key: "billing_amt", label: "Billing Amount", get: (p) => String(p.billing_amt ?? "") },
  { key: "month_year", label: "Billing Month", get: (p) => p.month_year ?? "", bold: true },
  { key: "received_amt", label: "Recived Amount", get: (p) => String(p.received_amt ?? "") },
  { key: "balance_amt", label: "Balance Amount", get: (p) => String(p.balance_amt ?? "") },
  { key: "balance_amt2", label: "Balance Amount", get: (p) => String(p.balance_amt ?? "") },
];
const NUM_RE = /^-?[\d.]+$/;

function PaymentGrid({ rows, onRowClick }: { rows: PayRow[]; onRowClick: (p: PayRow) => void }) {
  const [search, setSearch] = useState("");
  const [size, setSize] = useState(10);
  const [page, setPage] = useState(0);
  const [sort, setSort] = useState<{ i: number; dir: 1 | -1 } | null>(null);
  const [hidden, setHidden] = useState<Set<number>>(new Set());
  const [colMenu, setColMenu] = useState(false);
  const [note, setNote] = useState("");

  const vis = GCOLS.map((_, i) => i).filter((i) => !hidden.has(i));
  const q = search.trim().toLowerCase();
  let data = rows.filter((p) => !q || GCOLS.some((c) => c.get(p).toLowerCase().includes(q)));
  if (sort) {
    const g = GCOLS[sort.i].get;
    data = [...data].sort((a, b) => {
      const x = g(a), y = g(b);
      const r = NUM_RE.test(x) && NUM_RE.test(y) ? parseFloat(x) - parseFloat(y) : x.localeCompare(y);
      return r * sort.dir;
    });
  }
  const pages = Math.max(1, Math.ceil(data.length / size));
  const cur = Math.min(page, pages - 1);
  const slice = data.slice(cur * size, cur * size + size);
  const from = data.length ? cur * size + 1 : 0;
  const to = Math.min(data.length, cur * size + size);

  const table = (all: PayRow[]) => [vis.map((i) => GCOLS[i].label), ...all.map((p) => vis.map((i) => GCOLS[i].get(p)))];
  const flash = (m: string) => { setNote(m); setTimeout(() => setNote(""), 2000); };
  const csv = () => {
    const body = table(data).map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + body], { type: "text/csv;charset=utf-8" }));
    a.download = "Payment History.csv"; document.body.appendChild(a); a.click(); a.remove();
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(table(data).map((r) => r.join("\t")).join("\n")); flash(`Copied ${data.length} rows to clipboard`); }
    catch { flash("Copy failed"); }
  };
  const print = () => {
    const esc = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const t = table(data);
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>Payment History</title><style>body{font-family:sans-serif}table{border-collapse:collapse;width:100%}th,td{border:1px solid #999;padding:4px 8px;font-size:12px}th{background:#006699;color:#fff;text-transform:uppercase}</style></head><body><h3>Payment History</h3><table><tr>${t[0].map((c) => `<th>${esc(c)}</th>`).join("")}</tr>${t.slice(1).map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table></body></html>`);
    w.document.close(); w.focus(); w.print();
  };

  const btn: React.CSSProperties = { marginRight: 4 };
  const th: React.CSSProperties = { padding: "8px", border: "1px solid #ccc", cursor: "pointer", whiteSpace: "nowrap", textTransform: "uppercase", userSelect: "none" };
  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <div style={{ position: "relative" }}>
          <button className="btn btn-default btn-sm" style={btn} onClick={csv}>CSV</button>
          <button className="btn btn-default btn-sm" style={btn} onClick={print}>Print</button>
          <button className="btn btn-default btn-sm" style={btn} onClick={copy}>Copy</button>
          <button className="btn btn-default btn-sm" style={btn} onClick={() => setColMenu((v) => !v)}>Column visibility</button>
          {note && <span style={{ marginLeft: 8, color: "#337ab7" }}>{note}</span>}
          {colMenu && (
            <div style={{ position: "absolute", zIndex: 20, top: "100%", left: 0, background: "#fff", border: "1px solid #ccc", borderRadius: 4, padding: 6, minWidth: 180, boxShadow: "0 2px 8px rgba(0,0,0,.2)" }}>
              {GCOLS.map((c, i) => (
                <label key={i} style={{ display: "block", fontWeight: "normal", cursor: "pointer", margin: 0, padding: "2px 4px" }}>
                  <input type="checkbox" checked={!hidden.has(i)} disabled={!hidden.has(i) && vis.length === 1}
                    onChange={() => setHidden((h) => { const n = new Set(h); if (n.has(i)) n.delete(i); else n.add(i); return n; })} /> {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
        <div>
          Search: <input type="search" className="form-control input-sm" style={{ display: "inline-block", width: 180 }} value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }} />
        </div>
      </div>
      <div style={{ marginBottom: 8 }}>
        Show{" "}
        <select className="form-control input-sm" style={{ display: "inline-block", width: 70 }} value={size} onChange={(e) => { setSize(Number(e.target.value)); setPage(0); }}>
          {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>{" "}entries
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="table table-bordered" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ccc" }}>
          <thead>
            <tr style={{ backgroundColor: "#006699", color: "white", fontWeight: "bold" }}>
              {vis.map((i) => (
                <th key={i} style={th} onClick={() => setSort((s) => (s && s.i === i ? { i, dir: (s.dir * -1) as 1 | -1 } : { i, dir: 1 }))}>
                  {GCOLS[i].label}{sort && sort.i === i ? (sort.dir === 1 ? " ▲" : " ▼") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 && <tr><td colSpan={vis.length} style={{ padding: "8px", textAlign: "center", color: "#777" }}>{rows.length ? "No matching records found" : "No data available in table"}</td></tr>}
            {slice.map((p) => (
              <tr key={p.sr_no} onClick={() => onRowClick(p)} style={{ cursor: "pointer" }}
                onMouseOver={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                onMouseOut={(e) => { e.currentTarget.style.textDecoration = "none"; }}>
                {vis.map((i) => <td key={i} style={{ padding: "8px", border: "1px solid #ccc", fontWeight: GCOLS[i].bold ? "bold" : "normal" }}>{GCOLS[i].get(p)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
        <div>Showing {from} to {to} of {data.length} entries{q && rows.length !== data.length ? ` (filtered from ${rows.length} total entries)` : ""}</div>
        <div>
          <button className="btn btn-default btn-sm" style={btn} disabled={cur === 0} onClick={() => setPage(0)}>First</button>
          <button className="btn btn-default btn-sm" style={btn} disabled={cur === 0} onClick={() => setPage(cur - 1)}>Previous</button>
          <span style={{ margin: "0 8px" }}>Page {cur + 1} of {pages}</span>
          <button className="btn btn-default btn-sm" style={btn} disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)}>Next</button>
          <button className="btn btn-default btn-sm" disabled={cur >= pages - 1} onClick={() => setPage(pages - 1)}>Last</button>
        </div>
      </div>
    </div>
  );
}
