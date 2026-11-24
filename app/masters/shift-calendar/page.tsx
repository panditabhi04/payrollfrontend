"use client";
import React, { useEffect, useState } from "react";
import { getJSON, mk, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";
// Legacy shift_calender.aspx ("Shift Calendar"). Month grid: assign a shift per employee per day.
const B = "/api/masters/shift-calendar";
type Shift = { id: number; shift_name: string };
type Hdr = { day: number; dow: string };
type Row = { emp_code: string; emp_name: string; days: Record<string, number> };
type Data = { month_label: string; month_days: number; day_headers: Hdr[]; shifts: Shift[]; results: Row[] };
export default function ShiftCalendarPage() {
  const [client, setClient] = useState("Select"); const [unit, setUnit] = useState("ALL");
  const [monthYear, setMonthYear] = useState("");
  const [clients, setClients] = useState<{ code: string; name: string }[]>([]);
  const [units, setUnits] = useState<{ code: string; name: string }[]>([]);
  const [month, setMonth] = useState(""); const [year, setYear] = useState("");
  const [data, setData] = useState<Data | null>(null); const [msg, setMsg] = useState("");
  useEffect(() => {
    getJSON<{ clients: { code: string; name: string }[] }>(`${B}/filters/`).then((d) => setClients(d?.clients ?? []));
  }, []);
  const onClient = async (c: string) => {
    setClient(c); setUnit("ALL"); setData(null);
    if (c === "Select") { setUnits([]); return; }
    const d = await getJSON<{ units: { code: string; name: string }[] }>(`${B}/filters/?client_code=${encodeURIComponent(c)}`);
    setUnits(d?.units ?? []);
  };
  const [panel, setPanel] = useState<null | { title: string; head: string[]; rows: (string | number)[][] }>(null);
  const curMonth = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`; };
  const process = async (my?: string) => {
    if (client === "Select") { alert("Please Select Client Name !!"); return; }
    // Legacy: blank month/year = current month.
    const mYear = my || monthYear || curMonth();
    if (!monthYear || my) setMonthYear(mYear);
    const [y, m] = mYear.split("-");
    setMonth(String(Number(m))); setYear(y);
    const r = await mk(`${B}/process/`, { client_code: client, unit_code: unit, month: Number(m), year: Number(y) });
    if (!r.ok) { alert(await responseMessage(r, "Process failed.")); return; }
    const b: Data = await r.json(); setData(b);
  };
  const shiftMonth = (delta: number) => {
    const [y, m] = (monthYear || curMonth()).split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    process(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };
  const qs = () => `unit_code=${encodeURIComponent(unit === "ALL" ? "" : unit)}&month=${month}&year=${year}`;
  const showHeadcount = async () => {
    const d = await getJSON<{ header: string; days: number[]; results: { shift_name: string; counts: number[] }[] }>(
      `${B}/headcount/?${qs()}`);
    if (!d) { alert("Unable to load shift head count."); return; }
    setPanel({ title: d.header, head: ["Shift", ...d.days.map(String)],
      rows: d.results.map((r) => [r.shift_name, ...r.counts]) });
  };
  const showShifts = async () => {
    const d = await getJSON<{ columns: string[]; results: { shift_name: string; shift_from: string; shift_to: string }[] }>(
      `${B}/available_shifts/`);
    if (!d) { alert("Unable to load shifts."); return; }
    setPanel({ title: "Available Shifts", head: d.columns,
      rows: d.results.map((r) => [r.shift_name, r.shift_from, r.shift_to]) });
  };
  const exportXlsx = async (reporting: boolean) => {
    const r = await fetch(`${API_BASE_URL}${B}/export/?${qs()}${reporting ? "&reporting=1" : ""}`, { credentials: "include" });
    if (!r.ok) { alert(await responseMessage(r, "Export failed.")); return; }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(await r.blob());
    a.download = `shift_${month}_${year}.xlsx`;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const setDay = (emp: string, day: number, val: number) => {
    setData((d) => d && ({ ...d, results: d.results.map((r) => r.emp_code === emp
      ? { ...r, days: { ...r.days, [`day${String(day).padStart(2, "0")}`]: val } } : r) }));
  };
  const saveRow = async (r: Row) => {
    const resp = await mk(`${B}/update_row/`, { unit_code: (r as Row & { unit_code?: string }).unit_code ?? "", emp_code: r.emp_code, month, year, days: r.days });
    if (!resp.ok) { alert(await responseMessage(resp, "Shift save failed.")); return; }
    const b = await resp.json(); setMsg(b.status ?? "Shift saved.");
  };
  return (
    <div style={{ padding: 16, overflowX: "auto" }}>
      <div className="lg-panel-head">Shift Calender</div>
      <div className="lg-panel-body">
      <div style={{ margin: "8px 0", display: "flex", gap: 8 }}>
        <label>Client:</label>
        <select className="form-control" style={{ width: 220 }} value={client} onChange={(e) => onClient(e.target.value)}>
          <option value="Select">Select</option>
          {clients.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
        <label>Branch:</label>
        <select className="form-control" style={{ width: 300 }} value={unit} onChange={(e) => setUnit(e.target.value)}>
          {(units.length ? units : [{ code: "ALL", name: "ALL" }]).map((u) => <option key={u.code} value={u.code}>{u.name}</option>)}
        </select>
        <label>Month Year:</label><input type="month" className="form-control" style={{ width: 160 }} value={monthYear} onChange={(e) => setMonthYear(e.target.value)} />
        <button className="btn btn-primary" onClick={() => process()}>Process</button>
      </div>
      {data && (
        <div style={{ margin: "8px 0", display: "flex", gap: 8, alignItems: "center" }}>
          <button className="btn btn-default" title="Previous month" onClick={() => shiftMonth(-1)}>&lt;</button>
          <button className="btn btn-default" title="Next month" onClick={() => shiftMonth(1)}>&gt;</button>
          <button className="btn btn-info" onClick={showHeadcount}>Shift Wise Employee Calculation</button>
          <button className="btn btn-info" onClick={showShifts}>Available Shifts</button>
          <button className="btn btn-success" onClick={() => exportXlsx(false)}>All Employee Excel</button>
          <button className="btn btn-success" onClick={() => exportXlsx(true)}>Reporting Employee Excel</button>
        </div>
      )}
      {panel && (
        <div className="panel panel-primary" style={{ margin: "8px 0", overflowX: "auto" }}>
          <div className="panel-heading" style={{ display: "flex", justifyContent: "space-between" }}>
            <span>{panel.title}</span>
            <button className="btn btn-danger btn-xs" onClick={() => setPanel(null)}>Close</button>
          </div>
          <table className="dt-grid">
            <thead><tr>{panel.head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
            <tbody>
              {panel.rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j}>{c}</td>)}</tr>)}
              {panel.rows.length === 0 && <tr><td colSpan={panel.head.length}>No records found</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {msg && <p style={{ color: "green" }}>{msg}</p>}
      {data && (
        <>
          <b>{data.month_label}</b>
          <table className="dt-grid">
            <thead><tr><th>Employee</th>{data.day_headers.map((h) => <th key={h.day}>{h.day} {h.dow}</th>)}<th></th></tr></thead>
            <tbody>
              {data.results.map((r) => (
                <tr key={r.emp_code}><td>{r.emp_name}</td>
                  {data.day_headers.map((h) => {
                    const key = `day${String(h.day).padStart(2, "0")}`;
                    return (
                      <td key={h.day}>
                        <select value={r.days[key] ?? 0} onChange={(e) => setDay(r.emp_code, h.day, Number(e.target.value))}>
                          <option value={0}>-</option>
                          {data.shifts.map((s) => <option key={s.id} value={s.id}>{s.shift_name}</option>)}
                        </select>
                      </td>
                    );
                  })}
                  <td><button onClick={() => saveRow(r)}>Save</button></td></tr>
              ))}
              {data.results.length === 0 && <tr><td colSpan={data.month_days + 2}>No employees</td></tr>}
            </tbody>
          </table>
        </>
      )}
      </div>
    </div>
  );
}
