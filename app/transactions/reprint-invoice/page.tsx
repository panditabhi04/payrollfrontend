"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getJSON } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";
import { Field, Sel } from "@/components/formkit";

// Legacy reprint_invoice.aspx (menus "Reprint Invoice" / "Reprint Invoice Detail"). Month + Client +
// (Region for DHFL/BAGIC) + State + Branch -> Show lists the billed invoices (pay_report_gst, one per
// invoice_no) with the per-invoice downloads. The Financecopy / Breakup / Attendance links exist only
// for the bill types the legacy page supports.
const LIST = "/api/transactions/reprint-invoice/";
const REPRINT = "/api/transactions/reprint-invoice/download/";

interface InvRow {
  invoice_no: string; invoice_date: string; region: string; state_name: string;
  unit_code: string; unit_name: string; type: string; month_year: string; billing_amt: number;
  downloads: { financecopy: boolean; breakup: boolean; attendance: boolean };
}
interface ClientOpt { client_code: string; client_name: string; }
interface UnitOpt { unit_code: string; unit_name: string; state_name: string; zone?: string; }

const REGION_CLIENTS = ["DHFL", "BAGIC"];

export default function ReprintInvoicePage() {
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [monthYear, setMonthYear] = useState("");
  const [client, setClient] = useState("Select");
  const [region, setRegion] = useState("Select");
  const [state, setState] = useState("ALL");
  const [unit, setUnit] = useState("Select");
  const [rows, setRows] = useState<InvRow[]>([]);
  const [msg, setMsg] = useState("");

  const showRegion = REGION_CLIENTS.includes(client);
  const regionOn = showRegion && region !== "Select" && region !== "ALL";

  useEffect(() => {
    getJSON<{ results: ClientOpt[] }>("/api/masters/clients/?page_size=all").then((d) =>
      setClients(d?.results ?? []));
  }, []);
  useEffect(() => {
    setRows([]);
    if (!client || client === "Select") { setUnits([]); setRegions([]); return; }
    getJSON<{ units: UnitOpt[] }>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(client)}`).then((d) => {
      setUnits(d?.units ?? []);
    });
    if (REGION_CLIENTS.includes(client)) {
      getJSON<{ results: { region: string; type: string }[] }>(
        `/api/masters/zones/?client_code=${encodeURIComponent(client)}&page_size=all`).then((d) => {
        setRegions([...new Set((d?.results ?? []).map((z) => z.region).filter(Boolean))].sort());
      });
    } else setRegions([]);
  }, [client]);

  const scoped = units.filter((u) => !regionOn || (u.zone || "") === region);
  const states = [...new Set(scoped.map((u) => u.state_name).filter(Boolean))].sort();

  const onShow = async () => {
    if (!monthYear.trim()) { setMsg("Please Select month & year "); return; }
    if (!client || client === "Select") { setMsg("Please Select Client Name "); return; }
    if (!state || state === "Select") { setMsg("Please Select State Name "); return; }
    if (!unit || unit === "Select") { setMsg("Please Select Branch Name "); return; }
    setMsg("");
    const q = new URLSearchParams({ monthYear, client, state, unit });
    if (showRegion) q.set("region", region);
    const d = await getJSON<InvRow[]>(`${LIST}?${q.toString()}`);
    const list = Array.isArray(d) ? d : [];
    setRows(list);
    if (list.length === 0) setMsg("No Matching Records Found for this month.");
  };

  const dl = (kind: string, invoice_no: string) =>
    `${API_BASE_URL}${REPRINT}?kind=${kind}&invoice_no=${encodeURIComponent(invoice_no)}`;
  const link = (kind: string, no: string, green = false) => (
    <a className={green ? "lg-btn lg-btn-green" : "lg-btn"} style={{ textDecoration: "none" }}
      href={dl(kind, no)} target="_blank" rel="noopener noreferrer">Download</a>
  );

  return (
    <div className="lg-panel">
      <div className="lg-panel-head" style={{ textAlign: "center" }}>Reprint Invoice Detail</div>
      <div className="lg-panel-body">
        {msg && <div className="em-note">{msg}</div>}
        <div className="lg-form cols3">
          <Field label="Select Month :"><input type="month" className="lg-control" value={monthYear} onChange={(e) => setMonthYear(e.target.value)} /></Field>
          <Sel label="Client Name :" req value={client} onChange={(v) => { setClient(v); setRegion("Select"); setState("ALL"); setUnit("Select"); }} opts={[{ v: "Select", t: "Select" }, ...clients.map((c) => ({ v: c.client_code, t: c.client_name }))]} />
          {showRegion && (
            <Sel label="Region :" value={region} onChange={(v) => { setRegion(v); setState("ALL"); setUnit("Select"); }} opts={[{ v: "Select", t: "Select" }, { v: "ALL", t: "ALL" }, ...regions.map((r) => ({ v: r, t: r }))]} />
          )}
          <Sel label="State Name :" req value={state} onChange={(v) => { setState(v); setUnit("Select"); }} opts={[{ v: "Select", t: "Select" }, { v: "ALL", t: "ALL" }, ...states.map((s) => ({ v: s, t: s }))]} />
          <Sel label="Branch Name :" value={unit} onChange={setUnit} opts={[{ v: "Select", t: "Select" }, { v: "ALL", t: "ALL" }, ...scoped.filter((u) => state === "ALL" || state === "Select" || u.state_name === state).map((u) => ({ v: u.unit_code, t: u.unit_name }))]} />
        </div>
        <div className="lg-btns center">
          <button className="lg-btn lg-btn-green" onClick={onShow}>Show</button>
          <Link href="/" className="lg-btn lg-btn-red" style={{ textDecoration: "none" }}>Close</Link>
        </div>
        <table className="dt-grid">
          <thead><tr>
            <th>Sr No.</th><th>Invoice No</th><th>Invoice Date</th><th>Region</th><th>State Name</th>
            <th>Branch Name</th><th>Billing Type</th><th>Month - Year</th><th>Total Amount</th>
            <th>Download Invoices</th><th>Download Financecopy</th><th>Download Breakup</th><th>Download Attendance</th>
          </tr></thead>
          <tbody>
            {rows.map((g, i) => (
              <tr key={g.invoice_no}>
                <td>{i + 1}</td><td>{g.invoice_no}</td><td>{g.invoice_date}</td><td>{g.region}</td>
                <td>{g.state_name}</td><td>{g.unit_name}</td><td>{g.type}</td>
                <td>{g.month_year}</td><td>{Number(g.billing_amt).toFixed(2)}</td>
                <td>{link("invoice", g.invoice_no, true)}</td>
                <td>{g.downloads?.financecopy && link("financecopy", g.invoice_no)}</td>
                <td>{g.downloads?.breakup && link("breakup", g.invoice_no)}</td>
                <td>{g.downloads?.attendance && link("attendance", g.invoice_no)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={13} style={{ textAlign: "center" }}>Select month, client, state and branch, then Show</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
