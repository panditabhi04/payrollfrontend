"use client";
/**
 * Stipend Business — 1:1 port of Stipend_emp_business.aspx.
 * Two tabs (Stipend Billing / Stipend Salary). Billing: upload bill, Finance Copy (xlsx),
 * Final Invoice. Salary: process stipend salary. State+Branch cascade from the client,
 * constrained Lot / Service-Charge / GST dropdowns, exact legacy validations.
 */
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getJSON, mk, upload, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

const B = "/api/payroll/stipend-business";
type Grid = { results: Record<string, unknown>[]; count: number };
interface ClientOpt { client_code: string; client_name: string }
interface UnitOpt { unit_code: string; unit_name: string; state_name: string }
const XL_TYPES = [["0", "Employee XL"], ["1", "Without Ac/No XL"], ["2", "ALL"]];

const LOTS = ["Select", ...Array.from({ length: 26 }, (_, i) => `Lot${i + 1}`)];
const SC_OPTS = ["Select", "No", ...Array.from({ length: 10 }, (_, i) => String(i + 1))];
const GST_OPTS = ["Select", "No", "5", "12", "18", "28"];
// "Select"/"No" -> 0 for the backend (numeric percent).
const pct = (v: string) => (v === "Select" || v === "No" ? "0" : v);

export default function StipendBusinessPage() {
  const [tab, setTab] = useState<"billing" | "salary">("billing");
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [branches, setBranches] = useState<UnitOpt[]>([]);
  const [xlType, setXlType] = useState("0");
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [branch, setBranch] = useState("Select");   // unit_code
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [lot, setLot] = useState("Select");
  const [sc, setSc] = useState("5");
  const [gst, setGst] = useState("18");
  const [bill, setBill] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");
  const [grid, setGrid] = useState<Grid | null>(null);

  // Reporting-scoped lists (legacy client_code() / state / branch cascades; ALL options added).
  const myParam = () => (month && year ? `${month.padStart(2, "0")}/${year}` : "");
  useEffect(() => {
    getJSON<{ results: ClientOpt[] }>(`${B}/clients/`).then((d) => setClients(d?.results ?? []));
  }, []);
  useEffect(() => {
    setStates([]); setBranches([]); setState("Select"); setBranch("Select");
    if (!client || client === "Select") return;
    getJSON<{ results: string[] }>(`${B}/states/?client_code=${encodeURIComponent(client)}&month_year=${encodeURIComponent(myParam())}`)
      .then((d) => setStates(d?.results ?? []));
  }, [client, month, year]);
  useEffect(() => {
    setBranches([]); setBranch("Select");
    if (!client || client === "Select") return;
    getJSON<{ results: UnitOpt[] }>(`${B}/branches/?client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}&month_year=${encodeURIComponent(myParam())}`)
      .then((d) => setBranches(d?.results ?? []));
  }, [client, state, month, year]);

  // Legacy validations (exact strings), ordered as the .aspx.
  const validate = (opts: { file?: boolean; billDate?: boolean } = {}): string | null => {
    if (!month || !year) return "Please Select Month/Year";
    if (!client || client === "Select") return "Please Select Client";
    if (!state || state === "Select") return "Please Select State";
    if (!branch || branch === "Select") return "Please Select Branch";
    if (!lot || lot === "Select") return "Please Select lot ";
    if (opts.billDate && !bill) return "Please Select Bill Date";
    if (opts.file) {
      if (!file) return "Please upload a excel file.";
      if (!/\.xlsx?$/i.test(file.name)) return "Please upload a valid excel file.";
    }
    return null;
  };

  const my = () => `${month.padStart(2, "0")}/${year}`;
  const common = () => ({ client_code: client, month_year: my(), lot_name: lot, state, unit_code: branch });

  const uploadBill = async () => {
    const err = validate({ file: true }); if (err) { alert(err); return; }
    const fd = new FormData();
    Object.entries(common()).forEach(([k, v]) => fd.append(k, v));
    fd.append("service_charge", pct(sc)); fd.append("gst_per", pct(gst));
    fd.append("file", file as File);
    const r = await upload(`${B}/upload/`, fd);
    if (r.ok) {
      const b = await r.json().catch(() => ({}));
      const t = b.duplicates && b.duplicates.length ? b.duplicates[0] : (b.status || "Emaployee Details Saved Successfully ");
      setMsg(t); window.alert(t); load();
    } else { const t = await responseMessage(r, "Failed"); setMsg(t); window.alert(t); }
  };

  const financeCopy = () => {
    const err = validate(); if (err) { alert(err); return; }
    const q = new URLSearchParams({ client_code: client, month_year: my(), lot_name: lot, state, unit_code: branch });
    download(`${B}/finance_copy/?${q.toString()}`, "STIPEND FINANCE COPY.xls");
  };

  // Authenticated file download that surfaces the legacy alert text on error.
  const download = async (path: string, name: string) => {
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
      if (!res.ok) { window.alert(await responseMessage(res, "Failed")); return; }
      const blob = await res.blob();
      const cd = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") || "");   // legacy file name from the server
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = cd ? cd[1] : name; a.click(); URL.revokeObjectURL(a.href);
    } catch { window.alert("Failed"); }
  };

  const employeeXl = () => {
    const err = validate(); if (err) { window.alert(err); return; }
    const q = new URLSearchParams({ client_code: client, month_year: my(), lot_name: lot, state, unit_code: branch, xl_type: xlType });
    download(`${B}/employee_xl/?${q.toString()}`, "EMPLOYEE SALARY.xls");
  };

  const invoiceQuery = () => new URLSearchParams({
    client_code: client, month_year: my(), lot_name: lot,
    state: state, unit_code: branch }).toString();
  const invoiceCopy = () => {
    const err = validate(); if (err) { alert(err); return; }
    download(`${B}/invoice_pdf/?${invoiceQuery()}`, "Invoice.pdf");
  };

  const finalInvoice = async () => {
    const err = validate({ billDate: true }); if (err) { alert(err); return; }
    const r = await mk(`${B}/final_invoice/`, { ...common(), bill_date: bill });
    if (r.ok) {
      const b = await r.json().catch(() => ({}));
      setMsg(`${b.status || ""} ${b.invoice_no || ""}`); load();
      download(`${B}/invoice_pdf/?${invoiceQuery()}&final=1`, "Invoice.pdf");   // legacy Final Invoice (DS_FLAG 1): DG_<invoice>_<state> .pdf
    } else { const t = await responseMessage(r, "Failed"); setMsg(t); window.alert(t); }
  };

  const processSalary = async () => {
    const err = validate(); if (err) { alert(err); return; }
    const r = await mk(`${B}/process_salary/`, common());
    if (r.ok) {
      const b = await r.json().catch(() => ({}));
      const t = b.status ?? "Salary Processed Successfully"; setMsg(t); window.alert(t);
    } else { const t = await responseMessage(r, "Failed"); setMsg(t); window.alert(t); }
  };

  const load = async () => {
    const q = new URLSearchParams({ month_year: my(), lot_name: lot });
    if (client !== "Select") q.set("client_code", client);
    setGrid(await getJSON<Grid>(`${B}/bills/?${q.toString()}`));
  };

  const cols = grid && grid.results[0] ? Object.keys(grid.results[0]) : [];
  const ctl = { width: "100%", height: "34px", borderRadius: "4px", border: "1px solid #ccc" };
  const tabStyle = (t: string) => ({
    padding: "8px 18px", cursor: "pointer", fontWeight: "bold" as const,
    background: tab === t ? "#fff" : "#424d7a", color: tab === t ? "#333" : "#fff",
    border: "1px solid #ccc", borderBottom: tab === t ? "1px solid #fff" : "1px solid #ccc", borderRadius: "4px 4px 0 0",
  });

  return (
    <section style={{ padding: "15px" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #337ab7", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#337ab7", color: "#fff", padding: "10px 15px", textAlign: "center" }}>
          <b>STIPEND BUSINESS</b>
        </div>
        <div className="panel-body" style={{ padding: "20px" }}>
          <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "25px", marginBottom: "20px" }}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end", marginBottom: "15px" }}>
              <div style={{ flex: "1 1 180px" }}>
                <b>Client :</b><span style={{ color: "red" }}>*</span>
                <select className="form-control" value={client} onChange={(e) => setClient(e.target.value)} style={ctl}>
                  <option value="Select">Select</option>
                  {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <b>State :</b><span style={{ color: "red" }}>*</span>
                <select className="form-control" value={state} onChange={(e) => { setState(e.target.value); setBranch("Select"); }} style={ctl} disabled={client === "Select"}>
                  <option value="Select">Select</option>
                  <option value="ALL">ALL</option>
                  {states.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 180px" }}>
                <b>Branch :</b><span style={{ color: "red" }}>*</span>
                <select className="form-control" value={branch} onChange={(e) => setBranch(e.target.value)} style={ctl} disabled={client === "Select"}>
                  <option value="Select">Select</option>
                  <option value="ALL">ALL</option>
                  {branches.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <b>Month/Year :</b><span style={{ color: "red" }}>*</span>
                <input type="month" className="form-control" value={year && month ? `${year}-${month.padStart(2, "0")}` : ""}
                  onChange={(e) => { if (e.target.value) { const [y, m] = e.target.value.split("-"); setYear(y); setMonth(parseInt(m, 10).toString()); } else { setYear(""); setMonth(""); } }}
                  style={ctl} />
              </div>
              <div style={{ flex: "1 1 110px" }}>
                <b>Lot :</b><span style={{ color: "red" }}>*</span>
                <select className="form-control" value={lot} onChange={(e) => setLot(e.target.value)} style={ctl}>
                  {LOTS.map((l) => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 100px" }}>
                <b>SC% :</b>
                <select className="form-control" value={sc} onChange={(e) => setSc(e.target.value)} style={ctl}>
                  {SC_OPTS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 100px" }}>
                <b>GST% :</b>
                <select className="form-control" value={gst} onChange={(e) => setGst(e.target.value)} style={ctl}>
                  {GST_OPTS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 180px" }}>
                <b>Bill Date :</b>
                <input type="date" className="form-control" value={bill} onChange={(e) => setBill(e.target.value)} style={ctl} />
              </div>
              <div style={{ flex: "1 1 280px" }}>
                <b>File :</b>
                <input type="file" accept=".xls,.xlsx" className="form-control" onChange={(e) => setFile(e.target.files?.[0] ?? null)} style={{ ...ctl, padding: "4px" }} />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "3px", marginBottom: "-1px" }}>
            <div onClick={() => setTab("billing")} style={tabStyle("billing")}>Stipend Billing</div>
            <div onClick={() => setTab("salary")} style={tabStyle("salary")}>Stipend Salary</div>
          </div>

          <div style={{ border: "1px solid #ccc", borderRadius: "0 4px 4px 4px", padding: "18px", background: "#fff" }}>
            {tab === "billing" && (
              <div className="row" style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
                <button className="btn btn-primary" onClick={uploadBill}>Process</button>
                <button className="btn btn-primary" onClick={financeCopy}>Finance Copy</button>
                <button className="btn btn-primary" onClick={invoiceCopy}>Invoice Copy</button>
                <button className="btn btn-primary" onClick={finalInvoice}>Final Invoice Copy</button>
                <button className="btn btn-primary" onClick={load}>Show</button>
                <Link href="/" className="btn btn-danger" style={{ textDecoration: "none" }}>Close</Link>
              </div>
            )}
            {tab === "salary" && (
              <div className="row" style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
                <button className="btn btn-primary" onClick={processSalary}>Stipend Salary</button>
                <select className="form-control" value={xlType} onChange={(e) => setXlType(e.target.value)} style={{ width: 180 }}>
                  {XL_TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
                <button className="btn btn-primary" onClick={employeeXl}>Get Employee XL</button>
                <button className="btn btn-primary" onClick={load}>Show</button>
                <Link href="/" className="btn btn-danger" style={{ textDecoration: "none" }}>Close</Link>
              </div>
            )}

            {msg && <div style={{ color: "green", fontWeight: "bold", textAlign: "center", marginTop: "15px", padding: "10px", background: "#dff0d8", border: "1px solid #d6e9c6", borderRadius: "4px" }}>{msg}</div>}

            {grid && grid.count > 0 && (
              <div style={{ overflowX: "auto", marginTop: "20px" }}>
                <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff" }}>
                  <thead style={{ background: "#006699", color: "white" }}>
                    <tr>{cols.map((c) => <th key={c} style={{ padding: "8px", textTransform: "uppercase" }}>{c.replace(/_/g, " ")}</th>)}</tr>
                  </thead>
                  <tbody>
                    {grid.results.map((r, i) => (
                      <tr key={i}>{cols.map((c) => <td key={c} style={{ padding: "8px" }}>{String(r[c] ?? "")}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
