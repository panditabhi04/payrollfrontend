"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getJSON, getJSONStrict } from "@/lib/api/legacy-fetch";
import { copyGrid, excelGrid, pdfGrid } from "@/lib/gridExport";
// Legacy shift_report.aspx ("Shift Report"). Date-range (same month) shift grid per employee.
const B = "/api/masters/shift-reports/";
type Rep = { columns: string[]; rows: string[][]; count: number };
type Opt = { code: string; name: string };
// yyyy-mm-dd (date input) -> dd/mm/yyyy (legacy format)
const toLegacy = (v: string) => (v ? v.split("-").reverse().join("/") : "");

export default function ShiftReportsPage() {
  const router = useRouter();
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [unit, setUnit] = useState("All"); const [dept, setDept] = useState("All"); const [shift, setShift] = useState("All");
  const [units, setUnits] = useState<Opt[]>([]); const [depts, setDepts] = useState<Opt[]>([]); const [shifts, setShifts] = useState<Opt[]>([]);
  const [rep, setRep] = useState<Rep | null>(null);
  const [hidden, setHidden] = useState<Record<number, boolean>>({});
  const [showCols, setShowCols] = useState(false);
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    getJSON<{ units: Opt[]; departments: Opt[]; shifts: Opt[] }>(`${B}filters/`).then((d) => {
      setUnits(d?.units ?? []); setDepts(d?.departments ?? []); setShifts(d?.shifts ?? []);
    });
  }, []);

  const run = async () => {
    setNote("");
    // legacy req_validate() order and messages
    if (!from) { alert("Please select from date."); return; }
    if (!to) { alert("Please select to date."); return; }
    if (to.substr(5, 2) !== from.substr(5, 2)) { alert("Please select dates of same month only."); return; }
    const q = new URLSearchParams({ from_date: toLegacy(from), to_date: toLegacy(to) });
    if (unit !== "All") q.set("unit_code", unit);
    if (dept !== "All") q.set("dept_code", dept);
    if (shift !== "All") q.set("shift_id", shift);
    try {
      const d = await getJSONStrict<Rep>(`${B}?${q.toString()}`);
      setRep(d); setHidden({});
    } catch (e: any) { setRep(null); alert(e?.message || "Request failed."); }
  };

  const vis = rep ? rep.columns.map((_, i) => i).filter((i) => !hidden[i]) : [];
  const cols = rep ? vis.map((i) => rep.columns[i]) : [];
  // DataTables-style search box: case-insensitive match on any cell.
  const q = search.trim().toLowerCase();
  const rows = rep
    ? rep.rows.filter((r) => !q || r.some((v) => String(v ?? "").toLowerCase().includes(q)))
        .map((r) => vis.map((i) => r[i]))
    : [];

  return (
    <div className="lg-panel">
      <div className="lg-panel-head">Shift Report</div>
      <div className="lg-panel-body">
        <div style={{ margin: "8px 0", display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <label>From Date:</label><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          <label>To Date:</label><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          <label>Unit :</label>
          <select value={unit} onChange={(e) => setUnit(e.target.value)}>
            <option value="All">All</option>{units.map((u) => <option key={u.code} value={u.code}>{u.name}</option>)}
          </select>
          <label>Department :</label>
          <select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="All">All</option>{depts.map((u) => <option key={u.code} value={u.code}>{u.name}</option>)}
          </select>
          <label>Shift :</label>
          <select value={shift} onChange={(e) => setShift(e.target.value)}>
            <option value="All">All</option>{shifts.map((u) => <option key={u.code} value={u.code}>{u.name}</option>)}
          </select>
          <button onClick={run}>Search</button>
          <button onClick={() => router.push("/")}>Close</button>
        </div>
        {rep && (
          <>
            <div style={{ margin: "6px 0", display: "flex", gap: 6, position: "relative" }}>
              <button onClick={async () => setNote((await copyGrid(cols, rows)) ? "Copied to clipboard." : "Copy failed.")}>Copy</button>
              <button onClick={() => excelGrid("ShiftReport", cols, rows)}>Excel</button>
              <button onClick={() => pdfGrid("Shift Report", cols, rows)}>PDF</button>
              <button onClick={() => setShowCols(!showCols)}>Column visibility</button>
              {note && <span>{note}</span>}
              <span style={{ marginLeft: "auto" }}>Search: <input value={search} onChange={(e) => setSearch(e.target.value)} /></span>
              {showCols && (
                <div style={{ position: "absolute", top: 30, left: 0, zIndex: 5, background: "#fff", border: "1px solid #999", padding: 6, maxHeight: 260, overflow: "auto" }}>
                  {rep.columns.map((c, i) => (
                    <label key={c + i} style={{ display: "block" }}>
                      <input type="checkbox" checked={!hidden[i]} onChange={() => setHidden({ ...hidden, [i]: !hidden[i] })} /> {c}
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table className="dt-grid">
                <thead><tr>{cols.map((c, i) => <th key={c + i}>{c}</th>)}</tr></thead>
                <tbody>
                  {rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j}>{v}</td>)}</tr>)}
                  {rows.length === 0 && <tr><td colSpan={Math.max(cols.length, 1)}>No data available in table</td></tr>}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
