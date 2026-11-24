"use client";
import React, { useState } from "react";
import { getJSON } from "@/lib/api/legacy-fetch";

// Legacy ItemInventoryquery.aspx - "Inventory Status Itemwise". The grid is empty on load; Process runs the
// stock query (alert 'Stock Is Empty' when nothing matches), clicking a row lists that item's INWARD/OUTWARD
// movements, SHOW on a movement opens the size-details popup, Clear empties the grids, Close goes Home.
const ST = "/api/transactions/stock-report/";

type Row = Record<string, any>;
const CODE_COLS = ["ITEM CODE", "ITEM NAME", "VENDOR NAME", "STOCK", "STOCK VALUE"];
const KEYS: Record<string, string> = { "ITEM CODE": "ITEM_CODE", "ITEM NAME": "ITEM_NAME", "VENDOR NAME": "CUST_NAME", "STOCK": "STOCK", "STOCK VALUE": "STOCK_VAL" };
const MOVE_COLS = ["TASK_CODE", "DOC_DATE", "VENDOR_NAME", "SIZE", "RECEIPT", "BILL TOTAL"];
const MOVE_KEYS: Record<string, string> = { "BILL TOTAL": "BILL_TOTAL" };

function Exports({ id, cols, rows, cell }: { id: string; cols: string[]; rows: Row[]; cell: (r: Row, c: string) => any }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [showM, setShowM] = useState(false);
  const vis = cols.filter((c) => !hidden[c]);
  const q = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", position: "relative" }}>
      <button type="button" className="btn btn-default btn-xs" onClick={() => {
        const blob = new Blob(["﻿" + vis.map(q).join(",") + "\r\n" + rows.map((r) => vis.map((c) => q(cell(r, c))).join(",")).join("\r\n")], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = `${id}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
      }}>csv</button>
      <button type="button" className="btn btn-default btn-xs" onClick={() => window.print()}>print</button>
      <button type="button" className="btn btn-default btn-xs" onClick={() => {
        navigator.clipboard?.writeText([vis.join("\t"), ...rows.map((r) => vis.map((c) => cell(r, c)).join("\t"))].join("\n")).catch(() => undefined);
      }}>copyHtml5</button>
      <button type="button" className="btn btn-default btn-xs" onClick={() => setShowM((s) => !s)}>colvis</button>
      {showM && (
        <div style={{ background: "#fff", border: "1px solid #ccc", padding: 8, position: "absolute", top: 26, zIndex: 5 }}>
          {cols.map((c) => (
            <label key={c} style={{ display: "block", fontSize: 12 }}>
              <input type="checkbox" checked={!hidden[c]} onChange={() => setHidden((h) => ({ ...h, [c]: !h[c] }))} /> {c}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export default function StockPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [sel, setSel] = useState<number | null>(null);
  const [moves, setMoves] = useState<Row[] | null>(null);
  const [popup, setPopup] = useState<{ size: string; rows: Row[] } | null>(null);

  const openHelp = () => {
    window.open("/html/ItemInventoryquery.html", "popUpWindow",
      "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No");
  };

  const process = async () => {
    const d = await getJSON<{ results: Row[]; message: string }>(`${ST}process/`);
    const list = d?.results ?? [];
    if (!list.length) { window.alert("Stock Is Empty"); return; }
    setRows(list); setSel(null); setMoves(null);
  };
  const clear = () => { setRows([]); setSel(null); setMoves(null); setPopup(null); };

  const pick = async (i: number) => {
    setSel(i);
    const r = rows[i];
    const d = await getJSON<{ results: Row[] }>(
      `${ST}details/?item_code=${encodeURIComponent(r.ITEM_CODE)}&vendor=${encodeURIComponent(r.CUST_NAME ?? "")}`);
    setMoves(d?.results ?? []);
  };
  const show = async (m: Row) => {
    const size = String(m.SIZE ?? "");
    const d = await getJSON<{ results: Row[] }>(`${ST}size-details/?size=${encodeURIComponent(size)}`);
    setPopup({ size, rows: d?.results ?? [] });
  };

  return (
    <div className="container-fluid" style={{ fontSize: 10 }}>
      <div className="panel panel-primary" style={{ backgroundColor: "white" }}>
        <div className="panel-heading">
          <div className="row">
            <div className="col-lg-11 col-md-11 col-sm-11 col-xs-12">
              <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase"><b>Inventory Status Itemwise</b></div>
            </div>
            <div className="col-lg-1 col-md-1 col-sm-1 col-xs-12 text-right">
              <button type="button" className="btn btn-link" style={{ padding: 0 }} onClick={openHelp} title="Help">
                <img src="/Images/help_ico.png" width={20} height={20} alt="Help" />
              </button>
            </div>
          </div>
        </div>
        <div className="panel-body">
          <div className="container-fluid" style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: 10, padding: 15, margin: "20px 15px" }}>
            <div className="row text-center">
              <button type="button" className="btn btn-primary" style={{ fontSize: 10 }} onClick={process}>Process</button>{" "}
              <button type="button" className="btn btn-primary" style={{ fontSize: 10 }} onClick={clear}>Clear</button>{" "}
              <button type="button" className="btn btn-danger" style={{ fontSize: 10 }} onClick={() => { window.location.href = "/Home"; }}>Close</button>
            </div>
            <br />
            {rows.length > 0 && (
              <div style={{ maxHeight: 500, overflowY: "auto" }}>
                <Exports id="gv_itemquery" cols={CODE_COLS} rows={rows} cell={(r, c) => r[KEYS[c]]} />
                <table id="gv_itemquery" className="table" style={{ width: "100%", background: "#fff", border: "1px solid #ccc", fontSize: "x-small" }}>
                  <thead style={{ background: "#006699", color: "#fff", textTransform: "uppercase" }}>
                    <tr>{CODE_COLS.map((c) => <th key={c}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} onClick={() => pick(i)}
                        style={{ cursor: "pointer", color: sel === i ? "#fff" : "#000066", background: sel === i ? "#669999" : "#fff", fontWeight: sel === i ? 700 : 400 }}>
                        {CODE_COLS.map((c) => <td key={c}>{r[KEYS[c]]}</td>)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <br />
            {moves !== null && (
              <div>
                <Exports id="gv_itemdetails" cols={MOVE_COLS} rows={moves} cell={(r, c) => r[MOVE_KEYS[c] ?? c]} />
                <table id="gv_itemdetails" className="table" style={{ width: "100%", background: "#fff", border: "1px solid #ccc" }}>
                  <thead style={{ background: "#006699", color: "#fff", textTransform: "uppercase" }}>
                    <tr><th>Show</th>{MOVE_COLS.map((c) => <th key={c}>{c}</th>)}</tr>
                  </thead>
                  <tbody>
                    {moves.map((m, i) => (
                      <tr key={i} style={{ color: "#000066" }}>
                        <td><a href="#" onClick={(e) => { e.preventDefault(); show(m); }}>SHOW</a></td>
                        {MOVE_COLS.map((c) => <td key={c}>{m[MOVE_KEYS[c] ?? c]}</td>)}
                      </tr>
                    ))}
                    {moves.length === 0 && <tr><td colSpan={MOVE_COLS.length + 1} style={{ textAlign: "center", color: "#999" }}>No records</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {popup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setPopup(null)}>
          <div style={{ background: "#fff", borderRadius: 6, width: "70%", maxHeight: "80%", overflow: "auto", padding: 12 }} onClick={(e) => e.stopPropagation()}>
            <table className="table table-bordered" style={{ width: "100%", fontSize: "x-small" }}>
              <thead style={{ background: "#337AB7", color: "#fff" }}>
                <tr><th>Sr No.</th><th>emp_code</th><th>No_of_set</th><th>size</th><th>dispatch_date</th></tr>
              </thead>
              <tbody>
                {popup.rows.map((r, i) => (
                  <tr key={i}><td>{i + 1}</td><td>{r.emp_code}</td><td>{r.No_of_set}</td><td>{r.size}</td><td>{r.dispatch_date}</td></tr>
                ))}
                {popup.rows.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "#999" }}>No records</td></tr>}
              </tbody>
            </table>
            <div className="row text-center">
              <button type="button" className="btn btn-danger" onClick={() => setPopup(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
