"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getJSON } from "@/lib/api/legacy-fetch";
import { copyGrid, excelGrid, pdfGrid } from "@/lib/gridExport";
// Legacy Datatable.aspx ("REPORTS"): technician directory on load, technician/domain dropdown filters,
// and a functionality dropdown (Daily / Auditor / Team report) shown in a separate result table.
const B = "/api/masters/search";
type Rep = { label?: string; columns: string[]; rows: (string | number | null)[][]; count: number };
/** DataTables "csv" button equivalent */
const csvGrid = (name: string, cols: string[], rows: (string | number | null)[][]) => {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [cols, ...rows].map((r) => r.map(q).join(",")).join("\r\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" }));
  a.download = `${name}.csv`; document.body.appendChild(a); a.click(); a.remove();
};
const toLegacy = (v: string) => (v ? v.split("-").reverse().join("/") : "");

export default function SearchPage() {
  const router = useRouter();
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [tech, setTech] = useState("Select"); const [dom, setDom] = useState("Select");
  const [techs, setTechs] = useState<{ emp_code: string; emp_name: string }[]>([]);
  const [doms, setDoms] = useState<string[]>([]);
  const [func, setFunc] = useState("0");
  const [grid, setGrid] = useState<Rep | null>(null);
  const [rep, setRep] = useState<Rep | null>(null);
  const [popup, setPopup] = useState(false);
  const [msg, setMsg] = useState("");

  const loadGrid = async (t: string, d: string) => {
    const q = new URLSearchParams();
    if (t !== "Select") q.set("technician", t);
    if (d !== "Select") q.set("domain", d);
    setGrid(await getJSON<Rep>(`${B}/technicians/?${q.toString()}`));
  };

  useEffect(() => {
    getJSON<{ technicians: { emp_code: string; emp_name: string }[]; domains: string[] }>(`${B}/technician_options/`).then((d) => {
      setTechs(d?.technicians ?? []); setDoms(d?.domains ?? []);
    });
    loadGrid("Select", "Select");
  }, []);

  const runFunc = async (kind: string) => {
    setFunc(kind);
    if (kind === "0") return;
    const q = from && to ? `?from_date=${toLegacy(from)}&to_date=${toLegacy(to)}` : "";
    const d = await getJSON<Rep>(`${B}/${kind}/${q}`);
    setRep(d); setGrid(null);
    setFunc("0"); // legacy resets the dropdown to "Select Functionality" after rendering
  };

  const cur = rep ?? grid;
  const rows = cur ? cur.rows.map((r) => r.map((v) => (v == null ? "" : v))) : [];

  return (
    <div className="lg-panel">
      <div className="lg-panel-head">REPORTS</div>
      <div className="lg-panel-body">
        <div style={{ margin: "8px 0", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label>From Date :</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <label>To Date :</label><input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          <label>Technician Wise :</label>
          <select value={tech} onChange={(e) => { setTech(e.target.value); setRep(null); loadGrid(e.target.value, dom); }}>
            <option value="Select">Select</option>
            {techs.map((t) => <option key={t.emp_code} value={t.emp_code}>{t.emp_name}</option>)}
          </select>
          <label>Domain Wise:</label>
          <select value={dom} onChange={(e) => { setDom(e.target.value); setRep(null); loadGrid(tech, e.target.value); }}>
            <option value="Select">Select</option>
            {doms.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <label>Please select the functionality to search :</label>
          <select value={func} onChange={(e) => runFunc(e.target.value)}>
            <option value="0">Select Functionality</option>
            <option value="daily">Daily Report</option>
            <option value="auditor">Auditor Report</option>
            <option value="team">Team Report</option>
          </select>
          <button onClick={() => router.push("/")}>CLOSE</button>
          <button onClick={() => setPopup(true)}>Status Count</button>
        </div>
        {popup && (
          <div style={{ border: "3px solid #000", background: "#fff", padding: 10, width: 320, margin: "8px 0" }}>
            <p>The Status Count view (p_Status_Count.aspx) is not part of the legacy application files, so no status counts are available here. Use the Team Report for status counts.</p>
            <button onClick={() => setPopup(false)}>Close</button>
          </div>
        )}
        {msg && <p>{msg}</p>}
        {cur && (
          <>
            {rep?.label && <b style={{ textDecoration: "underline" }}>{rep.label}</b>}
            <div style={{ margin: "6px 0", display: "flex", gap: 6 }}>
              <button onClick={async () => setMsg((await copyGrid(cur.columns, rows)) ? "Copied to clipboard." : "Copy failed.")}>Copy</button>
              <button onClick={() => excelGrid("Reports", cur.columns, rows)}>Excel</button>
              <button onClick={() => pdfGrid(rep?.label || "Reports", cur.columns, rows)}>PDF</button>
              <button onClick={() => csvGrid("Reports", cur.columns, rows)}>CSV</button>
              <button onClick={() => window.print()}>Print</button>
            </div>
            <div style={{ overflow: "auto", maxHeight: 420 }}>
              <table className="dt-grid">
                <thead><tr>{cur.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{String(v)}</td>)}</tr>)}
                  {cur.count === 0 && <tr><td colSpan={cur.columns.length}>No data available in table</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
