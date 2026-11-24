"use client";

/**
 * Search Invoice — 1:1 port of search_invoice.aspx.
 * Party Type (Client / Vendor) auto-loads (legacy AutoPostBack) the invoices from the GST ledger
 * (client) or finalized purchase bills (vendor). DataTables-style search + CSV/Print/Copy export.
 * Read-only. Backend: /api/transactions/search-invoice/.
 */

import React, { useState, useCallback } from "react";
import Link from "next/link";
import { getJSON } from "@/lib/api/legacy-fetch";

const BASE = "/api/transactions/search-invoice";

interface ClientRow {
  client_name: string; state_name: string; month: string | number; year: string | number;
  invoice_no: string; invoice_date: string; amount: number | string; type: string;
}
interface VendorRow {
  cust_name: string; month: string | number; year: string | number; doc_no: string;
  booking_date: string; final_price: number; type: string;
}

const CLIENT_COLS = ["Sr No.", "Client Name", "State Name", "Month", "Year", "Invoice No", "Invoice Date", "Amount", "Invoice Type"];
const VENDOR_COLS = ["Sr No.", "Vendor Name", "Month", "Year", "Invoice No", "Invoice Date", "Amount", "Invoice Type"];

export default function SearchInvoicePage() {
  const [partyType, setPartyType] = useState("Select");
  const [filter, setFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadedType, setLoadedType] = useState("");
  const [clientRows, setClientRows] = useState<ClientRow[]>([]);
  const [vendorRows, setVendorRows] = useState<VendorRow[]>([]);
  // DataTables paging + column visibility (buttons.colVis)
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [colMenu, setColMenu] = useState(false);

  // Legacy ddl_party AutoPostBack: selecting Client/Vendor immediately loads all rows.
  const load = useCallback(async (party: string) => {
    if (party === "Select") {
      setLoadedType(""); setClientRows([]); setVendorRows([]);
      alert("Please Select Party Type !!!");     // ddl_party_type_SelectedIndexChanged else-branch
      return;
    }
    setLoading(true);
    try {
      const d = await getJSON<{ party_type: string; results: ClientRow[] | VendorRow[] }>(`${BASE}/?party_type=${party}`);
      if (d === null) { alert("Failed to load invoices."); }
      if (party === "Client") { setClientRows((d?.results as ClientRow[]) ?? []); setVendorRows([]); }
      else { setVendorRows((d?.results as VendorRow[]) ?? []); setClientRows([]); }
      setLoadedType(party);
    } catch (e) {
      alert((e as Error)?.message || "Failed to load invoices.");
    } finally { setLoading(false); }
  }, []);

  const onParty = (v: string) => { setPartyType(v); setFilter(""); load(v); };

  // rows -> cell matrix (for the grid + export)
  const cells: (string | number)[][] = loadedType === "Client"
    ? clientRows.map((r, i) => [i + 1, r.client_name, r.state_name, r.month, r.year, r.invoice_no, r.invoice_date, r.amount, r.type])
    : loadedType === "Vendor"
      ? vendorRows.map((r, i) => [i + 1, r.cust_name, r.month, r.year, r.doc_no, r.booking_date, r.final_price, r.type])
      : [];
  const cols = loadedType === "Client" ? CLIENT_COLS : VENDOR_COLS;
  const f = filter.trim().toLowerCase();
  const shown = f ? cells.filter((row) => row.some((c) => String(c ?? "").toLowerCase().includes(f))) : cells;
  const pages = Math.max(1, Math.ceil(shown.length / pageSize));
  const cur = Math.min(page, pages - 1);
  const pageRows = shown.slice(cur * pageSize, cur * pageSize + pageSize);
  const visIdx = cols.map((c, i) => (hidden[c] ? -1 : i)).filter((i) => i >= 0);

  const exp = (kind: "csv" | "print" | "copy") => {
    if (kind === "print") { window.print(); return; }
    const matrix = [cols, ...shown.map((r) => r.map(String))];
    if (kind === "copy") { navigator.clipboard?.writeText(matrix.map((r) => r.join("\t")).join("\n")).catch(() => undefined); return; }
    const q = (s: string) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const csv = matrix.map((r) => r.map(q).join(",")).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" }));
    a.download = `Search_Invoice_${loadedType}.csv`; document.body.appendChild(a); a.click(); a.remove();
  };

  const th = { padding: "8px", border: "1px solid #ccc", backgroundColor: "#006699", color: "#fff", fontWeight: "bold" as const };
  const td = { padding: "8px", border: "1px solid #ccc" };
  const expBtn = { marginRight: "6px", padding: "3px 10px", fontSize: "12px" };

  return (
    <div className="container-fluid" style={{ maxWidth: "99%", margin: "0 auto", padding: "20px", fontSize: "14px" }}>
      {loading && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(204,204,204,0.7)", zIndex: 9999 }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>Loading...</div>
        </div>
      )}

      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ flex: 1, textAlign: "center", fontSize: "small", fontWeight: "bold" }}>Search Invoice</div>
          <Link href="#" onClick={(e) => { e.preventDefault(); window.open("/html/SearchInvoice.html", "popUpWindow", "height=500,width=600"); }} style={{ color: "#fff" }}>
            <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
          </Link>
        </div>

        <div className="panel-body" style={{ padding: "15px" }}>
          <div className="row" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", marginBottom: "18px" }}>
            <div style={{ flex: "0 0 25%", padding: "0 15px" }}>
              <b>Select Party Type :</b><span style={{ color: "red" }}>*</span>
              <select value={partyType} onChange={(e) => onParty(e.target.value)} className="form-control" style={{ width: "100%" }}>
                <option value="Select">Select</option>
                <option value="Client">Client</option>
                <option value="Vendor">Vendor</option>
              </select>
            </div>
          </div>

          {loadedType && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "8px" }}>
                <div>
                  <button className="btn btn-default btn-xs" style={expBtn} onClick={() => exp("copy")}>Copy</button>
                  <button className="btn btn-default btn-xs" style={expBtn} onClick={() => exp("csv")}>CSV</button>
                  <button className="btn btn-default btn-xs" style={expBtn} onClick={() => exp("print")}>Print</button>
                  <span style={{ position: "relative", display: "inline-block" }}>
                    <button className="btn btn-default btn-xs" style={expBtn} onClick={() => setColMenu((v) => !v)}>Column visibility</button>
                    {colMenu && (
                      <div style={{ position: "absolute", zIndex: 5, background: "#fff", border: "1px solid #ccc", padding: 6, minWidth: 160 }}>
                        {cols.map((c) => (
                          <label key={c} style={{ display: "block", fontWeight: "normal" }}>
                            <input type="checkbox" checked={!hidden[c]} onChange={() => setHidden((p) => ({ ...p, [c]: !p[c] }))} /> {c}
                          </label>
                        ))}
                      </div>
                    )}
                  </span>
                  Show{" "}
                  <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(0); }}>
                    {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>{" "}entries
                </div>
                <div>
                  Search : <input value={filter} onChange={(e) => setFilter(e.target.value)} className="form-control" style={{ display: "inline-block", width: "200px" }} />
                </div>
              </div>
              <div style={{ maxHeight: "460px", overflow: "auto" }}>
                <table className="table" style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ccc" }}>
                  <thead><tr>{visIdx.map((i) => <th key={cols[i]} style={th}>{cols[i]}</th>)}</tr></thead>
                  <tbody>
                    {shown.length === 0 && <tr><td colSpan={visIdx.length || 1} style={{ ...td, textAlign: "center", color: "#777" }}>No records</td></tr>}
                    {pageRows.map((row, i) => (
                      <tr key={i}>{visIdx.map((j) => <td key={j} style={td}>{row[j]}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>Showing {shown.length === 0 ? 0 : cur * pageSize + 1} to {Math.min(shown.length, cur * pageSize + pageSize)} of {shown.length} entries</span>
                <span>
                  <button className="btn btn-default btn-xs" disabled={cur === 0} onClick={() => setPage(cur - 1)} style={expBtn}>Previous</button>
                  Page {cur + 1} / {pages}{" "}
                  <button className="btn btn-default btn-xs" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} style={expBtn}>Next</button>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
