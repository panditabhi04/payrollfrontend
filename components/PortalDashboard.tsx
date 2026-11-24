"use client";
import React, { useState } from "react";
import { getJSON } from "@/lib/api/legacy-fetch";
// Shared role-scoped portal dashboard (HO_Login / Unit_Login). Read-only legacy data.
// scope ∈ ho | zone | region | unit. Zone/Region require zone/region params.
type Grid = { columns?: string[]; results: Record<string, unknown>[]; count?: number };

export default function PortalDashboard({ scope, title }: { scope: string; title: string }) {
  const B = `/api/masters/portal/${scope}`;
  const [zone, setZone] = useState(""); const [region, setRegion] = useState("");
  const [unit, setUnit] = useState(""); const [month, setMonth] = useState(""); const [year, setYear] = useState("");
  const [grid, setGrid] = useState<Grid | null>(null); const [err, setErr] = useState("");
  const scopeQs = () => {
    const p = new URLSearchParams();
    if (zone) p.set("zone", zone); if (region) p.set("region", region); if (unit) p.set("unit_code", unit);
    return p.toString();
  };
  const run = async (feature: string, extra = "") => {
    setErr("");
    const d = await getJSON<Grid>(`${B}/${feature}/?${scopeQs()}${extra}`);
    if (!d) { setErr("Check required scope (zone/region) for this portal."); setGrid(null); return; }
    setGrid(d);
  };
  const cols = grid?.columns ?? (grid?.results[0] ? Object.keys(grid.results[0]) : []);
  return (
    <div style={{ padding: 16 }}>
      <h2>{title}</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "8px 0" }}>
        {scope !== "unit" && <><label>Zone:</label><input value={zone} onChange={(e) => setZone(e.target.value)} /></>}
        {(scope === "region") && <><label>Region:</label><input value={region} onChange={(e) => setRegion(e.target.value)} /></>}
        <label>Unit:</label><input value={unit} onChange={(e) => setUnit(e.target.value)} />
        <label>Month:</label><input style={{ width: 50 }} value={month} onChange={(e) => setMonth(e.target.value)} />
        <label>Year:</label><input style={{ width: 70 }} value={year} onChange={(e) => setYear(e.target.value)} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <button onClick={() => run("deployment")}>Deployment</button>
        <button onClick={() => run("summary")}>Summary (Coverage)</button>
        <button onClick={() => run("monthly_attendance", `&month=${month}&year=${year}`)}>Monthly Attendance</button>
        <button onClick={() => run("attendance_logs")}>Attendance Logs</button>
        <button onClick={() => run("work_photos")}>Work Photos</button>
        <button onClick={() => run("fire_extinguisher")}>Fire Extinguisher</button>
      </div>
      {err && <p style={{ color: "red" }}>{err}</p>}
      {grid && (
        <table border={1} cellPadding={4} style={{ borderCollapse: "collapse" }}>
          <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {grid.results.map((r, i) => (
              <tr key={i}>{cols.map((c) => <td key={c}>{String((r as Record<string, unknown>)[c] ?? "")}</td>)}</tr>
            ))}
            {grid.results.length === 0 && <tr><td colSpan={Math.max(cols.length, 1)}>No records</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}
