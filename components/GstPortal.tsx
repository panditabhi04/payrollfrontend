"use client";
/* =====================================================================
 * GST REPORTS — 1:1 port of GSTReports.aspx.
 * Header "GST REPORTS" + help (html/GSTReports.html), beige filter box
 * (Select Month/Year * + mm/yy box + 5 buttons), B2B grid + HSN grid
 * (#006699 headers, X-Small, max-height 300px scroll) with DataTable
 * buttons (excel filename b2b/hsn + .xls / csv / print / copy / colvis).
 * Validation date_Val(): "Please Select month & year ". Empty result:
 * "No Matching Records Found.". Downloads b2b.xls / hsn.xls /
 * GSTR3B_<mm>_<yyyy>.xls with exact legacy columns.
 * Backend: /api/transactions/gst-portal/* (legacy pay_report_gst).
 * ===================================================================== */
import React, { useState } from "react";
import { apiGet, API_BASE_URL } from "@/lib/api/client";

const BASE = "/api/transactions/gst-portal";

type Row = Record<string, any>;

function Msg({ text, ok }: { text: string; ok: boolean }) {
  if (!text) return null;
  return (
    <div style={{ margin: "0 0 10px", padding: "6px 12px", borderRadius: 4, fontSize: 12,
      color: ok ? "#2e7d32" : "#c62828", background: ok ? "#e8f5e9" : "#ffebee",
      border: `1px solid ${ok ? "#a5d6a7" : "#ef9a9a"}` }}>{text}</div>
  );
}
function val(r: Row, name: string): any {
  if (r[name] !== undefined && r[name] !== null) return r[name];
  const want = name.toLowerCase();
  for (const k of Object.keys(r)) {
    if (k.toLowerCase() === want) return (r as Row)[k];
  }
  return "";
}
/* Month box: SINGLE box with calendar popup (legacy readonly textbox +
 * jQuery mm/yy picker). Native month picker opens the calendar; the value
 * is kept as mm/yy for the API. */
function MonthBox({ value, onChange }: { value: string; onChange: (mmYY: string) => void }) {
  const toMonth = (s: string) => {
    const m = (s || "").match(/^(\d{2})\/(\d{2,4})$/);
    if (!m) return "";
    const yyyy = m[2].length === 2 ? `20${m[2]}` : m[2];
    return `${yyyy}-${m[1]}`;
  };
  return (
    <input type="month" className="form-control date-picker1" value={toMonth(value)}
      onChange={(e) => {
        const m = (e.target.value || "").match(/^(\d{4})-(\d{2})$/);
        if (m) onChange(`${m[2]}/${m[1].slice(2)}`);
        else onChange("");
      }} title="Select Month/Year" />
  );
}

function downloadXls(d: { filename: string; columns: string[]; rows: any[][] }) {  const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `<table border=1><tr>${d.columns.map((c) => `<th align=left>${esc(c)}</th>`).join("")}</tr>` +
    d.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") + `</table>`;
  const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = d.filename;
  document.body.appendChild(a); a.click(); a.remove();
}

function DataGrid({ id, name, cols, rows }: { id: string; name: string; cols: string[]; rows: any[][] }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [showM, setShowM] = useState(false);
  const visIdx = cols.map((_, i) => i).filter((i) => !hidden[cols[i]]);
  const q = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const dl = (filename: string, type: string, text: string) => {
    const blob = new Blob(["\ufeff" + text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const excel = () => {
    const html = `<table border=1><tr>${visIdx.map((i) => `<th>${cols[i]}</th>`).join("")}</tr>` +
      rows.map((r) => `<tr>${visIdx.map((i) => `<td>${r[i] ?? ""}</td>`).join("")}</tr>`).join("") + `</table>`;
    dl(`${name}.xls`, "application/vnd.ms-excel", html);
  };
  const csv = () => {
    dl(`${name}.csv`, "text/csv",
      visIdx.map((i) => q(cols[i])).join(",") + "\r\n" +
      rows.map((r) => visIdx.map((i) => q(r[i])).join(",")).join("\r\n"));
  };
  const copy = () => {
    navigator.clipboard?.writeText(
      [visIdx.map((i) => cols[i]).join("\t"),
       ...rows.map((r) => visIdx.map((i) => r[i]).join("\t"))].join("\n")).catch(() => undefined);
  };
  const print = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>${name}</title></head><body><table border=1><tr>${visIdx.map((i) => `<th>${cols[i]}</th>`).join("")}</tr>${rows.map((r) => `<tr>${visIdx.map((i) => `<td>${r[i] ?? ""}</td>`).join("")}</tr>`).join("")}</table><script>window.print()</script></body></html>`);
    w.document.close();
  };
  return (
    <div>
      <div className="dt-btns" style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", position: "relative" }}>
        <button type="button" className="btn-primary dt-exp" onClick={excel}>excel</button>
        <button type="button" className="dt-exp" onClick={csv}>csv</button>
        <button type="button" className="dt-exp" onClick={print}>print</button>
        <button type="button" className="dt-exp" onClick={copy}>copyHtml5</button>
        <button type="button" className="dt-exp" onClick={() => setShowM((s) => !s)}>colvis</button>
        {showM && (
          <div className="dt-colmenu" style={{ background: "#fff", border: "1px solid #ccc", padding: 8, position: "absolute", zIndex: 5 }}>
            {cols.map((c) => (
              <label key={c} style={{ display: "block", fontSize: 12 }}>
                <input type="checkbox" checked={!hidden[c]} onChange={() => setHidden((h) => ({ ...h, [c]: !h[c] }))} /> {c}
              </label>
            ))}
          </div>
        )}
      </div>
      <div className="grid-view" style={{ height: "auto", maxHeight: 300, width: "auto", overflowY: "auto", overflowX: "hidden" }}>
        <table id={id} className="table dt-grid" style={{ width: "100%", background: "#fff", fontSize: "x-small", color: "#333333" }}>
          <thead><tr>{visIdx.map((i) => <th key={cols[i]}>{cols[i]}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>{visIdx.map((j) => <td key={cols[j]}>{r[j]}</td>)}</tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={visIdx.length || 1} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function GstPortal() {
  const [month, setMonth] = useState("");
  const [b2b, setB2b] = useState<{ columns: string[]; rows: any[][] }>({ columns: [], rows: [] });
  const [hsn, setHsn] = useState<{ columns: string[]; rows: any[][] }>({ columns: [], rows: [] });
  const [msg, setMsg] = useState({ text: "", ok: true });
  const show = (text: string, ok = true) => setMsg({ text, ok });

  // date_Val()
  const needMonth = () => {
    if (!month) { window.alert("Please Select month & year "); return false; }
    return true;
  };
  const fail = async (e: any, url: string) => {
    let t = "No Matching Records Found.";
    try {
      const r = await fetch(url, { credentials: "include" });
      const b = await r.json().catch(() => ({} as any));
      t = (b as any)?.detail || (b as any)?.non_field_errors?.[0] || t;
    } catch { /* keep default */ }
    window.alert(t); show(t, false);
  };
  const load = async (kind: "b2b" | "hsn") => {
    if (!needMonth()) return;
    try {
      const d = await apiGet<any>(`${BASE}/${kind}/?month=${encodeURIComponent(month)}`, { credentials: "include" });
      if (kind === "b2b") setB2b({ columns: d.columns, rows: d.rows });
      else setHsn({ columns: d.columns, rows: d.rows });
    } catch (e) {
      if (kind === "b2b") setB2b({ columns: [], rows: [] });
      else setHsn({ columns: [], rows: [] });
      fail(e, `${BASE}/${kind}/?month=${encodeURIComponent(month)}`);
    }
  };
  const csvFile = async (kind: "b2b" | "hsn") => {
    if (!needMonth()) return;
    try {
      const d = await apiGet<any>(`${BASE}/${kind}/?month=${encodeURIComponent(month)}${kind === "b2b" ? "&file=1" : ""}`, { credentials: "include" });
      downloadXls(d);
    } catch (e) {
      fail(e, `${BASE}/${kind}/?month=${encodeURIComponent(month)}`);
    }
  };
  const gstr3b = async () => {
    if (!needMonth()) return;
    // legacy fills the GSTR3B.xlsm filing template and downloads GSTR3B_<mm>_<yyyy>.xlsm
    const url = `${API_BASE_URL}${BASE}/gstr3b-file/?month=${encodeURIComponent(month)}`;
    try {
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) { await fail(null, url); return; }
      const blob = await r.blob();
      const cd = r.headers.get("Content-Disposition") || "";
      const m = cd.match(/filename="?([^";]+)"?/);
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = m ? m[1] : "GSTR3B.xlsm";
      document.body.appendChild(a); a.click(); a.remove();
      show("Report downloaded", true);
    } catch (e) {
      fail(e, url);
    }
  };
  const openHelp = () => {
    window.open("html/GSTReports.html", "popUpWindow",
      "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No");
  };
  return (
    <div className="container-fluid itmaster">
      <div className="lg-panel" style={{ marginBottom: 0 }}>
        <div className="lg-panel-head">
          <div className="row">
            <div className="col-sm-1"></div>
            <div className="col-sm-9">
              <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase"><b>GST REPORTS</b></div>
            </div>
            <div className="col-sm-2 text-right">
              <button type="button" onClick={openHelp} style={{ background: "transparent", border: "none", cursor: "pointer" }} title="Help">
                <img src="/Images/help_ico.png" width={20} height={20} alt="Help" />
              </button>
            </div>
          </div>
        </div>
        <div className="lg-panel-body">
          <Msg text={msg.text} ok={msg.ok} />
          <div className="container-fluid" style={{ background: "beige", border: "1px solid #e2e2dd", borderRadius: 10 }}>
            <br />
            <div className="row" style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-evenly" }}>
              <div style={{ width: 230 }}>
                <b> Select Month/Year :</b>
                <span className="text-red">*</span>
                <MonthBox value={month} onChange={setMonth} />
              </div>
              <div>
                <button type="button" className="it-btn btn-large" style={{ minWidth: 150 }} onClick={() => load("b2b")}>GST Grid View</button>
              </div>
              <div>
                <button type="button" className="it-btn btn-large" style={{ minWidth: 150 }} onClick={() => csvFile("b2b")}>GST B2B CSV FILE</button>
              </div>
              <div>
                <button type="button" className="it-btn btn-large" style={{ minWidth: 150 }} onClick={() => load("hsn")}>GST HSN Grid View</button>
              </div>
              <div>
                <button type="button" className="it-btn btn-large" style={{ minWidth: 150 }} onClick={() => csvFile("hsn")}>GST HSN CSV File</button>
              </div>
              <div>
                <button type="button" className="it-btn btn-large" style={{ minWidth: 150 }} onClick={gstr3b}>GSTR3B Excel</button>
              </div>
            </div>
            <br />
            <div className="row">
              <div className="container-fluid" id="divgv_gstr1_b2b_csv">
                <br />
                {b2b.columns.length > 0 && <DataGrid id="gv_gstr1_b2b_csv" name="b2b" cols={b2b.columns} rows={b2b.rows} />}
                <br />
              </div>
            </div>
            <br />
            <div className="row">
              <div className="container-fluid" id="div_hsn_codecsv">
                <br />
                {hsn.columns.length > 0 && <DataGrid id="gv_hsncodecsv" name="hsn" cols={hsn.columns} rows={hsn.rows} />}
              </div>
            </div>
          </div>
          <br />
        </div>
        <br />
      </div>
    </div>
  );
}
