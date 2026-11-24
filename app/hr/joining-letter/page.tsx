"use client";
import { openPrintHtml } from "@/components/hrPrint";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getJSON, mk } from "@/lib/api/legacy-fetch";
import { listItems } from "@/lib/api/crud";

// Old send_joining_letter.aspx — "Employee Joining Letter / Client Feedback Email".
// 5 tabs: Joining / Feedback / Relieving / Termination / Offer. Status grids read the
// letter send-register; Download prints the letters; Report downloads CSV.
const LOG = "/api/hr/letter-log/";
type Tab = "joining" | "feedback" | "relieving" | "termination" | "offer";

interface Emp {
  emp_code: string; emp_name: string; client_code: string; unit_code: string;
  joining_date?: string; left_date?: string; left_reason?: string; emp_email_id?: string;
  employee_type?: string; legal_flag?: number | string;
  grade_code?: string; [k: string]: unknown;
}
interface LogRow {
  kind: string; emp_code: string; emp_name: string; client_code: string; state_name: string;
  unit_code: string; month: string; year: string; amount: string; action_date: string;
  note: string; percent: string; status: string; sent_date: string; sent_date_str?: string;
}
interface UnitRow { unit_code: string; unit_name: string; state_name: string }
interface ClientRow { client_code: string; client_name: string }

async function fetchAll<T>(base: string, filters: Record<string, string>): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= 10; page++) {
    const r = await listItems<T>(base, { page, pageSize: 500, filters }).catch(() => null);
    if (!r || r.results.length === 0) break;
    all.push(...r.results);
    if (all.length >= (r.count ?? 0) || r.results.length < 500) break;
  }
  return all;
}

function downloadCSV(name: string, head: string[], lines: (string | number)[][]) {
  const q = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const blob = new Blob([[head.map(q).join(","), ...lines.map((l) => l.map(q).join(","))].join("\r\n")], { type: "text/csv" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  URL.revokeObjectURL(a.href);
}

/* Letters are rendered by the server (company letterhead, reference/date block, addressee, subject,
   body, acknowledgement and signature) - see backend apps/employees/print_views.py. */
function printLetters(kind: Tab, rows: { e: Emp; amount?: string; action_date?: string; note?: string }[]) {
  const codes = rows.map((r) => encodeURIComponent(r.e.emp_code)).join(",");
  let q = `/api/hr/print/letter/?kind=${kind}&emp_codes=${codes}`;
  if (rows.length === 1) {
    const x = rows[0];
    if (x.amount) q += `&amount=${encodeURIComponent(x.amount)}`;
    if (x.action_date) q += `&action_date=${encodeURIComponent(x.action_date)}`;
    if (x.note) q += `&note=${encodeURIComponent(x.note)}`;
  }
  void openPrintHtml(q);
}

export default function JoiningLetterHub() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("joining");
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [unit, setUnit] = useState("Select");
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  // per-tab UI
  const [search, setSearch] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [amounts, setAmounts] = useState<Record<string, string>>({});
  const [term, setTerm] = useState<Record<string, { date: string; reason: string }>>({});
  const [fbMonth, setFbMonth] = useState("");
  const [leftEmp, setLeftEmp] = useState("Select");

  useEffect(() => {
    listItems<ClientRow>("/api/masters/clients", { pageSize: 500 })
      .then((d) => setClients(d.results ?? [])).catch(() => setClients([]));
  }, []);

  const unitMap = useMemo(() => {
    const m: Record<string, UnitRow> = {};
    units.forEach((u) => { m[u.unit_code] = u; });
    return m;
  }, [units]);
  const clientMap = useMemo(() => {
    const m: Record<string, string> = {};
    clients.forEach((c) => { m[c.client_code] = c.client_name; });
    return m;
  }, [clients]);

  const onClient = async (v: string) => {
    setClient(v); setState("Select"); setUnit("Select");
    setEmployees([]); setLogs([]); setChecked({}); setLeftEmp("Select");
    if (!v || v === "Select") { setStates([]); setUnits([]); return; }
    const d = await getJSON<{ units: UnitRow[]; states: string[] }>(
      `/api/masters/units/lookup/?client_code=${encodeURIComponent(v)}`).catch(() => null);
    setUnits(d?.units ?? []); setStates(d?.states ?? []);
  };
  const onState = (v: string) => { setState(v); setUnit("Select"); };
  const stateUnits = useMemo(
    () => units.filter((u) => !state || state === "Select" || u.state_name === state),
    [units, state]);

  const reloadEmployees = async () => {
    if (!client || client === "Select") { setEmployees([]); return; }
    setLoading(true);
    try {
      const f: Record<string, string> = { client_code: client };
      if (unit && unit !== "Select") f.unit_code = unit;
      const emps = await fetchAll<Emp>("/api/hr/employees", f);
      setEmployees(state && state !== "Select"
        ? emps.filter((e) => (unitMap[e.unit_code]?.state_name || "") === state)
        : emps);
    } catch { setEmployees([]); }
    finally { setLoading(false); }
  };
  const reloadLogs = async () => {
    if (!client || client === "Select") { setLogs([]); return; }
    const rows = await fetchAll<LogRow>(LOG, { client_code: client }).catch(() => []);
    setLogs(rows);
  };
  useEffect(() => {
    setChecked({}); setTerm({}); setLeftEmp("Select");
    reloadEmployees(); reloadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, state, unit]);

  // legacy display_gv_for_download: active (left_date NULL), Legal-approved (legal_flag = 2) Permanent employees
  const joiningList = useMemo(
    () => employees.filter((e) => !e.left_date && String(e.legal_flag) === "2" && e.employee_type === "Permanent"),
    [employees]);

  const logOf = (kind: string, empCode: string, month = "", year = "") =>
    logs.find((l) => l.kind === kind && l.emp_code === empCode && (l.month || "") === month && (l.year || "") === year);
  const empState = (e: Emp) => unitMap[e.unit_code]?.state_name || "";
  const empBranch = (e: Emp) => unitMap[e.unit_code]?.unit_name || e.unit_code;
  const sentStr = (l?: LogRow) => (l ? (l.status || "GENERATED") : "");
  const sentDate = (l?: LogRow) => (l ? (l.sent_date_str || l.sent_date || "") : "");

  const gridSearch = (key: string, text: string) => {
    const q = (search[key] || "").toLowerCase();
    return !q || text.toLowerCase().includes(q);
  };

  async function sendKind(kind: Tab, entries: Record<string, unknown>[], confirmFirst: boolean) {
    if (!client || client === "Select") { alert("Please Select Client."); return; }
    if (entries.length === 0) { alert("Please select atleast one Record "); return; }
    if (confirmFirst && !window.confirm("Are you sure you want send email?")) return;
    setLoading(true);
    try {
      const r = await mk(`${LOG}send/`, { kind, employees: entries });
      const d = await r.json().catch(() => ({}));
      alert(r.ok ? (d.detail || "Recorded.") : (d.detail || JSON.stringify(d) || "Failed..."));
      if (r.ok) reloadLogs();
    } finally { setLoading(false); }
  }

  const baseEntry = (e: Emp, extra: Record<string, string> = {}) => ({
    emp_code: e.emp_code, emp_name: e.emp_name, client_code: e.client_code || client,
    state_name: empState(e), unit_code: e.unit_code, email: e.emp_email_id || "",
    joining_date: e.joining_date || "", grade_code: e.grade_code || "", ...extra,
  });

  // ---- joining tab ----
  const sendJoining = () => {
    // legacy: only the ticked grid rows are mailed
    const list = joiningList.filter((e) => checked[`j_${e.emp_code}`]);
    if (list.length === 0) { alert("Please Select Atleast One Record !!!"); return; }
    sendKind("joining", list.map((e) => baseEntry(e)), true);
  };
  const reportUnsent = (kind: Tab, label: string) => {
    if (!client || client === "Select") { alert("Please Select Client."); return; }
    const rows = (kind === "joining" ? joiningList : employees).filter((e) => logOf(kind, e.emp_code)?.status !== "SENT");
    if (rows.length === 0) { alert("No Matching Records Found."); return; }
    downloadCSV(`${label}.csv`,
      ["Sr No.", "CLIENT", "STATE", "BRANCH", "EMPLOYEE", "EMP CODE"],
      rows.map((e, i) => [i + 1, e.client_code, empState(e), empBranch(e), e.emp_name, e.emp_code]));
  };

  // ---- feedback tab ----
  const fbParts = () => {
    const m = fbMonth.match(/(\d{1,2})\D+(\d{2,4})/);
    if (!m) return null;
    let [, mm, yy] = m;
    if (mm.length === 1) mm = `0${mm}`;
    if (yy.length === 2) yy = `20${yy}`;
    return { month: mm, year: yy };
  };

  const [fbReport, setFbReport] = useState<Record<string, string>[]>([]);
  const fbQuery = (p: { month: string; year: string }) => ({
    client_code: client, monthyear: `${p.month}/${p.year}`,
    state_name: state === "Select" ? "ALL" : state, unit_code: unit === "Select" ? "ALL" : unit,
  });
  const loadFbReport = async () => {
    if (!client || client === "Select") { alert("Please Select Client."); return; }
    const p = fbParts();
    if (!p) { alert("Please Select Month/Year."); return; }
    const d = await getJSON<{ results: Record<string, string>[] }>(
      `${LOG}feedback-report/?${new URLSearchParams(fbQuery(p)).toString()}`).catch(() => null);
    setFbReport(d?.results ?? []);
    if (!d || (d.results ?? []).length === 0) alert("No Matching Records Found.");
  };
  // legacy btn_send_feedback_link_Click: the link goes to the branch heads of units that have no
  // client_feedback for the month; the server says honestly when no mail server is configured.
  const sendFeedback = async () => {
    if (!client || client === "Select") { alert("Please Select Client."); return; }
    const p = fbParts();
    if (!p) { alert("Please Select Month/Year."); return; }
    setLoading(true);
    try {
      const r = await mk(`${LOG}feedback-send/`, fbQuery(p));
      const d = await r.json().catch(() => ({}));
      alert(d.message || d.detail || (r.ok ? "Email Sent successfully!!" : "Error in Sending Email !!"));
    } finally { setLoading(false); }
  };

  // ---- relieving tab ----
  const leftList = useMemo(() => employees.filter((e) => e.left_date), [employees]);
  const sendRelieving = () => {
    const sel = Object.keys(checked).filter((k) => checked[k]);
    const list = sel.length ? employees.filter((e) => sel.includes(e.emp_code))
      : leftEmp !== "Select" ? employees.filter((e) => e.emp_code === leftEmp) : [];
    if (!list.length) { alert("Please Select Left Employee."); return; }
    sendKind("relieving", list.map((e) => baseEntry(e)), false);
  };

  // ---- termination tab ----
  const termChecked = () => employees.filter((e) => checked[`t_${e.emp_code}`]);
  const sendTermination = () => {
    if (!client || client === "Select") { alert("Please Select Client."); return; }
    if (!state || state === "Select") { alert("Please Select State."); return; }
    if (!unit || unit === "Select") { alert("Please Select Branch."); return; }
    const list = termChecked();
    if (!list.length) { alert("Please select atleast one Record "); return; }
    sendKind("termination", list.map((e) => ({
      ...baseEntry(e),
      action_date: term[e.emp_code]?.date || "", note: term[e.emp_code]?.reason || "",
    })), false);
  };

  // ---- offer tab ----
  const sendOffer = () => {
    const list = employees.filter((e) => checked[`o_${e.emp_code}`]);
    if (list.length === 0) { alert("Please select atleast one Record "); return; }
    sendKind("offer", list.map((e) => ({ ...baseEntry(e), amount: amounts[e.emp_code] || "" })), true);
  };

  const toggleAll = (prefix: string, list: Emp[], on: boolean) => {
    setChecked((p) => {
      const n = { ...p };
      list.forEach((e) => { n[`${prefix}${e.emp_code}`] = on; });
      return n;
    });
  };

  const TABS: { id: Tab; label: string }[] = [
    { id: "joining", label: "Joining Letter" },
    { id: "feedback", label: "Feedback Letter" },
    { id: "relieving", label: "Relieving Letter" },
    { id: "termination", label: "Termination Letter" },
    { id: "offer", label: "Offer Letter" },
  ];

  const statusGrid = (kind: Tab, cols: string[], src: Emp[] = employees) => (
    <table className="table lg-grid" style={{ width: "100%", background: "#fff" }}>
      <thead><tr>{cols.map((c) => (<th key={c}>{c}</th>))}</tr></thead>
      <tbody>
        {src.filter((e) => gridSearch(`${kind}_st`, `${e.emp_code} ${e.emp_name} ${empBranch(e)}`)).map((e, i) => {
          const l = logOf(kind, e.emp_code);
          return (
            <tr key={e.emp_code}>
              <td>{i + 1}</td><td>{e.client_code}</td><td>{empState(e)}</td>
              <td>{empBranch(e)}</td><td>{e.emp_name}</td><td>{sentStr(l)}</td><td>{sentDate(l)}</td>
            </tr>
          );
        })}
        {src.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center" }}>Select Client to list employees</td></tr>}
      </tbody>
    </table>
  );

  const selectGrid = (kind: Tab, prefix: string, extra?: (e: Emp) => React.ReactNode, src: Emp[] = employees) => {
    const list = src.filter((e) => gridSearch(`${kind}_sel`, `${e.emp_code} ${e.emp_name} ${empBranch(e)}`));
    return (
      <>
        <div className="row" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 6 }}>
          <div>Search : <input className="form-control" value={search[`${kind}_sel`] || ""} onChange={(ev) => setSearch({ ...search, [`${kind}_sel`]: ev.target.value })} style={{ display: "inline-block", width: 180 }} /></div>
        </div>
        <div style={{ overflowY: "auto", maxHeight: 250, overflowX: "hidden" }}>
          <table className="table lg-grid" style={{ width: "100%", background: "#fff" }}>
            <thead><tr>
              <th>Sr No.</th>
              <th><input type="checkbox" onChange={(ev) => toggleAll(prefix, list, ev.target.checked)} /> SELECT RECORD</th>
              <th>STATE</th><th>BRANCH</th><th>EMPLOYEE NAME</th><th>EMPLOYEE CODE</th><th>Status</th>
              <th>unit_code</th>{extra && <th>Extra</th>}
            </tr></thead>
            <tbody>
              {list.map((e, i) => {
                const l = logOf(kind, e.emp_code);
                return (
                  <tr key={e.emp_code}>
                    <td>{i + 1}</td>
                    <td style={{ textAlign: "center" }}><input type="checkbox" checked={!!checked[`${prefix}${e.emp_code}`]} onChange={(ev) => setChecked({ ...checked, [`${prefix}${e.emp_code}`]: ev.target.checked })} /></td>
                    <td>{empState(e)}</td><td>{empBranch(e)}</td><td>{e.emp_name}</td><td>{e.emp_code}</td>
                    <td>{sentStr(l)}</td><td>{e.unit_code}</td>{extra && <td>{extra(e)}</td>}
                  </tr>
                );
              })}
              {list.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center" }}>No records</td></tr>}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const downloadChecked = (kind: Tab, prefix: string, ex: (e: Emp) => Record<string, string> = () => ({})) => {
    const list = (kind === "joining" ? joiningList : employees).filter((e) => checked[`${prefix}${e.emp_code}`]);
    if (!list.length) { alert("Please select atleast one Record "); return; }
    printLetters(kind === "offer" ? "offer" : kind as Tab,
      list.map((e) => ({ e, ...ex(e) })));
  };

  return (
    <div className="container-fluid">
      {loading && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(204,204,204,.7)", zIndex: 9999 }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>Loading...</div>
        </div>
      )}
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: 4 }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px" }}>
          <div className="row" style={{ display: "flex", alignItems: "center" }}>
            <div style={{ flex: "0 0 8.33%" }}></div>
            <div style={{ flex: "0 0 75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
              Employee Joining Letter / Client Feedback Email
            </div>
            <div style={{ flex: "0 0 16.66%", textAlign: "right" }}>
              <Link href="#" onClick={(e) => { e.preventDefault(); window.open("/html/send_joining_letter.html", "popUpWindow", "height=500,width=600,left=100,top=100"); }} style={{ color: "#fff", fontSize: 10 }}>
                <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
              </Link>
            </div>
          </div>
        </div>
        <div className="panel-body" style={{ padding: 15 }}>
          <div className="container-fluid" style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: 10, padding: 25, marginBottom: 20, marginTop: 20 }}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: "1 1 180px" }}>
                <b>Client Name :</b><span style={{ color: "red" }}>*</span>
                <select value={client} onChange={(e) => onClient(e.target.value)} className="form-control" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: 4 }}>
                  <option value="Select">Select</option>
                  {clients.map((c) => (<option key={c.client_code} value={c.client_code}>{c.client_name}</option>))}
                </select>
              </div>
              <div style={{ flex: "1 1 180px" }}>
                <b>State Name :</b>
                <select value={state} onChange={(e) => onState(e.target.value)} className="form-control" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: 4 }}>
                  <option value="Select">Select</option>
                  {states.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
              <div style={{ flex: "1 1 180px" }}>
                <b>Branch Name :</b>
                <select value={unit} onChange={(e) => setUnit(e.target.value)} className="form-control" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: 4 }}>
                  <option value="Select">Select</option>
                  {stateUnits.map((u) => (<option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>))}
                </select>
              </div>
              <div style={{ flex: "0 0 auto", alignSelf: "flex-end" }}>
                <Link href="/Home" className="btn btn-danger" style={{ textDecoration: "none" }}>Close</Link>
              </div>
            </div>
          </div>
          <br />
          <div className="container-fluid">
            <div style={{ background: "#f3f1fe", padding: 25, marginLeft: -10, marginRight: -10, borderRadius: 10, border: "1px solid #e2e2dd" }}>
              <div className="em-tabs">
                {TABS.map((t) => (
                  <button key={t.id} className={`em-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
                ))}
              </div>

              {tab === "joining" && (
                <div className="em-tabpane">
                  <div className="em-secttitle">Joining Letter</div>
                  <div className="row" style={{ marginBottom: 12 }}>
                    <button onClick={sendJoining} className="btn btn-primary lg-btn-primary" style={{ width: "auto", marginRight: 8 }}>Send Joining Letter</button>
                    <button onClick={() => reportUnsent("joining", "JOINING_UNSENT")} className="btn btn-primary lg-btn-primary" style={{ width: "auto" }}>Report</button>
                  </div>
                  {statusGrid("joining", ["Sr No.", "CLIENT", "STATE", "BRANCH", "EMPLOYEE", "LETTER SENT", "SENT DATE"], joiningList)}
                  <br />
                  {selectGrid("joining", "j_", undefined, joiningList)}
                  <div className="row text-center" style={{ textAlign: "center", marginTop: 10 }}>
                    <button onClick={() => downloadChecked("joining", "j_")} className="btn btn-primary lg-btn-primary" style={{ width: 120 }}>Download</button>
                  </div>
                </div>
              )}

              {tab === "feedback" && (
                <div className="em-tabpane">
                  <div className="em-secttitle">Feedback Letter</div>
                  <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 12 }}>
                    <div><b>Feedback Month :</b><input value={fbMonth} onChange={(e) => setFbMonth(e.target.value)} placeholder="MM/YYYY" className="form-control" style={{ width: 160 }} /></div>
                    <div><button onClick={sendFeedback} className="btn btn-primary lg-btn-primary" style={{ width: "auto" }}>Send Feedback Link</button></div>
                    <div><button onClick={loadFbReport} className="btn btn-primary lg-btn-primary" style={{ width: "auto" }}>Report</button></div>
                  </div>
                  <table className="table lg-grid" style={{ width: "100%", background: "#fff" }}>
                    <thead><tr><th>Sr No.</th><th>STATE</th><th>MONTH</th><th>YEAR</th><th>BRANCH</th><th>EMAIL SENT</th><th>FEEDBACK PERCENT</th></tr></thead>
                    <tbody>
                      {fbReport.map((r, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td><td>{r.state_name}</td><td>{r.month}</td><td>{r.year}</td>
                          <td>{r.unit_name}</td><td>{r.email_sent}</td><td>{r.percent ?? ""}</td>
                        </tr>
                      ))}
                      {fbReport.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center" }}>Select client, month and press Report</td></tr>}
                    </tbody>
                  </table>
                  <div className="row text-center" style={{ textAlign: "center", marginTop: 10 }}>
                    <button onClick={() => {
                      if (fbReport.length === 0) { alert("No Matching Records Found."); return; }
                      downloadCSV("FEEDBACK.csv", ["Sr No.", "STATE", "MONTH", "YEAR", "BRANCH", "EMAIL SENT", "FEEDBACK PERCENT"],
                        fbReport.map((r, i) => [i + 1, r.state_name, r.month, r.year, r.unit_name, r.email_sent, r.percent ?? ""]));
                    }} className="btn btn-primary lg-btn-primary" style={{ width: 120 }}>Download</button>
                  </div>
                </div>
              )}

              {tab === "relieving" && (
                <div className="em-tabpane">
                  <div className="em-secttitle">Relieving Letter</div>
                  <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 12 }}>
                    <div><b>Left Employee:</b> <span style={{ color: "red" }}>*</span>
                      <select value={leftEmp} onChange={(e) => setLeftEmp(e.target.value)} className="form-control" style={{ minWidth: 220 }}>
                        <option value="Select">Select</option>
                        {leftList.map((e) => (<option key={e.emp_code} value={e.emp_code}>{e.emp_name} - {e.emp_code}</option>))}
                      </select>
                    </div>
                    <div><button onClick={sendRelieving} className="btn btn-primary lg-btn-primary" style={{ width: "100%" }}>Send Relieving Letter</button></div>
                  </div>
                  {selectGrid("relieving", "r_")}
                  <div className="row text-center" style={{ textAlign: "center", marginTop: 10 }}>
                    <button onClick={() => downloadChecked("relieving", "r_")} className="btn btn-primary lg-btn-primary" style={{ width: 120 }}>Download</button>
                  </div>
                </div>
              )}

              {tab === "termination" && (
                <div className="em-tabpane">
                  <div className="em-secttitle">Termination Letter</div>
                  <div className="row" style={{ marginBottom: 6 }}>
                    <div style={{ textAlign: "right" }}>Search : <input className="form-control" value={search.t_main || ""} onChange={(e) => setSearch({ ...search, t_main: e.target.value })} style={{ display: "inline-block", width: 180 }} /></div>
                  </div>
                  <table className="table lg-grid" style={{ width: "100%", background: "#fff" }}>
                    <thead><tr>
                      <th><input type="checkbox" onChange={(e) => toggleAll("t_", employees, e.target.checked)} /> SELECT</th>
                      <th>Sr No.</th><th>CLIENT NAME</th><th>BRANCH NAME</th><th>EMPLOYEE NAME</th>
                      <th>EMPLOYEE CODE</th><th>Termination Date</th><th>Termination Reason</th><th>Status</th>
                    </tr></thead>
                    <tbody>
                      {employees.filter((e) => gridSearch("t_main", `${e.emp_code} ${e.emp_name} ${empBranch(e)}`)).map((e, i) => {
                        const l = logOf("termination", e.emp_code);
                        return (
                          <tr key={e.emp_code}>
                            <td style={{ textAlign: "center" }}><input type="checkbox" checked={!!checked[`t_${e.emp_code}`]} onChange={(ev) => setChecked({ ...checked, [`t_${e.emp_code}`]: ev.target.checked })} /></td>
                            <td>{i + 1}</td><td>{clientMap[e.client_code] || e.client_code}</td>
                            <td>{empBranch(e)}</td><td>{e.emp_name}</td><td>{e.emp_code}</td>
                            <td><input value={term[e.emp_code]?.date || l?.action_date || ""} onChange={(ev) => setTerm({ ...term, [e.emp_code]: { date: ev.target.value, reason: term[e.emp_code]?.reason || "" } })} placeholder="DD/MM/YYYY" className="form-control" style={{ width: 110 }} /></td>
                            <td><input value={term[e.emp_code]?.reason || l?.note || ""} onChange={(ev) => setTerm({ ...term, [e.emp_code]: { date: term[e.emp_code]?.date || "", reason: ev.target.value } })} className="form-control" style={{ width: 120 }} /></td>
                            <td>{sentStr(l)}</td>
                          </tr>
                        );
                      })}
                      {employees.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center" }}>Select Client to list employees</td></tr>}
                    </tbody>
                  </table>
                  <div className="row text-center" style={{ textAlign: "center", marginTop: 10 }}>
                    <button onClick={() => {
                      if (!client || client === "Select") { alert("Please Select Client."); return; }
                      if (!state || state === "Select") { alert("Please Select State."); return; }
                      if (!unit || unit === "Select") { alert("Please Select Branch."); return; }
                      if (employees.length === 0) { alert("No Matching Records Found."); return; }
                      downloadCSV("TERMINATION.csv", ["Sr No.", "CLIENT", "BRANCH", "EMPLOYEE", "EMP CODE", "TERMINATION DATE", "REASON", "STATUS"],
                        employees.map((e, i) => { const l = logOf("termination", e.emp_code); return [i + 1, e.client_code, empBranch(e), e.emp_name, e.emp_code, term[e.emp_code]?.date || l?.action_date || "", term[e.emp_code]?.reason || l?.note || "", sentStr(l)]; }));
                    }} className="btn btn-primary lg-btn-primary" style={{ width: "auto", marginRight: 8 }}>Report</button>
                    <button onClick={sendTermination} className="btn btn-primary lg-btn-primary" style={{ width: "20%" }}>Send Termination Letter</button>
                  </div>
                </div>
              )}

              {tab === "offer" && (
                <div className="em-tabpane">
                  <div className="em-secttitle">Offer Letter</div>
                  <div className="row" style={{ marginBottom: 12 }}>
                    <button onClick={sendOffer} className="btn btn-primary lg-btn-primary" style={{ width: "38%" }}>Send Offer Letter</button>
                  </div>
                  {statusGrid("offer", ["Sr No.", "CLIENT", "STATE", "BRANCH", "EMPLOYEE", "LETTER SENT"])}
                  <br />
                  {selectGrid("offer", "o_", (e) => (
                    <input value={amounts[e.emp_code] || ""} onChange={(ev) => setAmounts({ ...amounts, [e.emp_code]: ev.target.value })} placeholder="Amount" className="form-control" style={{ width: 100 }} />
                  ))}
                  <div className="row text-center" style={{ textAlign: "center", marginTop: 10 }}>
                    <button onClick={() => downloadChecked("offer", "o_", (e) => ({ amount: amounts[e.emp_code] || "" }))} className="btn btn-primary lg-btn-primary" style={{ width: 120 }}>Download</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
