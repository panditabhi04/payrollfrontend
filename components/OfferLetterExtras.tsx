"use client";
import React, { useCallback, useEffect, useState } from "react";
import { openPrintHtml } from "@/components/hrPrint";
import { getJSON, mk, responseMessage } from "@/lib/api/legacy-fetch";

// Legacy Offerletter.aspx panels that sit beside Offer / Appointment letter:
// Increment, Relieving, Experience, Warning (+ Move To Terminate), Termination, Uniform and the
// Joining Letter print panel. Backend: apps/employees/offer_extras.py (/api/hr/offer-letter-extras/).
const X = "/api/hr/offer-letter-extras";

export type ExtraPanel = "increment" | "relieving" | "experience" | "warning" | "termination" | "uniform" | "joining";
export const EXTRA_TABS: { key: ExtraPanel; label: string }[] = [
  { key: "increment", label: "Increment Letter" },
  { key: "relieving", label: "Relieving Letter" },
  { key: "experience", label: "Experience Letter" },
  { key: "warning", label: "Warning Letter" },
  { key: "termination", label: "Termination Letter" },
  { key: "uniform", label: "Uniform Letter" },
  { key: "joining", label: "Joining Letter" },
];

interface Opt { value: string; label: string }
const SEL = "Select";
const th: React.CSSProperties = { padding: 8, border: "1px solid #ddd", textTransform: "uppercase", fontSize: 11 };
const td: React.CSSProperties = { padding: 8, border: "1px solid #ddd" };
const card: React.CSSProperties = { background: "#fff", padding: 15, border: "1px solid #ccc", borderRadius: 4, marginBottom: 16 };
const dmy = (iso: string) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : iso);
const toIso = (v: string) => (/^\d{2}\/\d{2}\/\d{4}$/.test(v) ? `${v.slice(6, 10)}-${v.slice(3, 5)}-${v.slice(0, 2)}` : v.slice(0, 10));
const today = () => new Date().toISOString().slice(0, 10);
const plus60 = () => { const d = new Date(); d.setDate(d.getDate() + 60); return d.toISOString().slice(0, 10); };
// legacy AllowAlphabet_address(): letters, digits, space, & , - . / : ; = \
const addrOnly = (v: string) => v.replace(/[^A-Za-z0-9 &,\-./:;=\\\n]/g, "");
const numOnly = (v: string) => v.replace(/[^0-9.]/g, "");
const alertMsg = (m: string) => { if (m) window.alert(m); };

function Field({ label, children, w = 240 }: { label: string; children: React.ReactNode; w?: number }) {
  return <div style={{ flex: `1 1 ${w}px` }}><b>{label}</b>{children}</div>;
}

function Select({ value, onChange, opts, first = SEL, disabled }: {
  value: string; onChange: (v: string) => void; opts: Opt[]; first?: string; disabled?: boolean;
}) {
  return (
    <select className="form-control" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {first && <option value={first}>{first}</option>}
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

/** Client -> Branch (ALL + branches) cascade shared by most panels. */
function useCascade(allClients: boolean) {
  const [clients, setClients] = useState<Opt[]>([]);
  const [branches, setBranches] = useState<Opt[]>([]);
  const [client, setClient] = useState(SEL);
  const [unit, setUnit] = useState("");
  useEffect(() => {
    getJSON<{ clients: { client_code: string; client_name: string }[] }>(`${X}/clients/${allClients ? "?all=1" : ""}`)
      .then((d) => setClients((d?.clients ?? []).map((c) => ({ value: c.client_code, label: c.client_name }))));
  }, [allClients]);
  const pickClient = useCallback(async (c: string) => {
    setClient(c); setUnit(""); setBranches([]);
    if (c === SEL) return [] as Opt[];
    const d = await getJSON<{ branches: { unit_code: string; label: string }[] }>(`${X}/branches/?client=${encodeURIComponent(c)}`);
    const b = (d?.branches ?? []).map((u) => ({ value: u.unit_code, label: u.label }));
    setBranches(b);
    return b;
  }, []);
  return { clients, branches, client, unit, setUnit, pickClient, setClient };
}

function BackBar({ onClose }: { onClose?: () => void }) {
  return <button className="btn btn-danger" onClick={onClose ?? (() => { window.location.href = "/"; })}>Close</button>;
}

/* ------------------------------------------------------------------ Warning letter */
interface WarnRow { id: string; emp_code: string; emp_name: string; date: string; reason: string; count: number | null; client_code: string; unit_code: string }

function WarningPanel() {
  const cas = useCascade(false);
  const [emps, setEmps] = useState<Opt[]>([]);
  const [emp, setEmp] = useState(SEL);
  const [date, setDate] = useState("");
  const [count, setCount] = useState("");
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState<WarnRow[]>([]);
  const [canTerminate, setCanTerminate] = useState(false);
  const [sel, setSel] = useState("");

  const load = useCallback(async () => {
    const d = await getJSON<{ rows: WarnRow[] }>(`${X}/warnings/`);
    setRows(d?.rows ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const loadEmps = async (unit: string) => {
    const d = await getJSON<{ employees: { emp_code: string; emp_name: string }[] }>(`${X}/employees/?unit=${encodeURIComponent(unit)}`);
    const o = (d?.employees ?? []).map((e) => ({ value: e.emp_code, label: e.emp_name }));
    setEmps(o);
    return o;
  };
  const onClient = async (c: string) => { setEmps([]); setEmp(SEL); await cas.pickClient(c); cas.setUnit("ALL"); };
  const onUnit = async (u: string) => { cas.setUnit(u); setEmp(SEL); await loadEmps(u === "ALL" ? "" : u); };
  const onEmp = async (code: string) => {
    setEmp(code); setCanTerminate(false);
    if (code === SEL) return;
    const d = await getJSON<{ count: string; message: string; can_terminate: boolean }>(`${X}/warning-count/?emp_code=${encodeURIComponent(code)}`);
    if (!d) return;
    setCount(d.count);
    if (d.message) { alertMsg(d.message); setCanTerminate(d.can_terminate); }
  };
  const clear = () => { setEmp(SEL); setDate(""); setCount("0"); setReason(""); setSel(""); setCanTerminate(false); };

  const save = async () => {
    const r = await mk(`${X}/warnings/save/`, { emp_code: emp, warring_date: dmy(date), count, reason, client_code: cas.client === SEL ? "" : cas.client, unit_code: cas.unit === "ALL" ? "ALL" : cas.unit });
    if (!r.ok) { alertMsg(await responseMessage(r, "Save failed!!")); return; }
    const d = await r.json();
    alertMsg(d.message);
    void openPrintHtml(`${X}/warnings/${d.id}/print/`);
    clear(); load();
  };
  const move = async () => {
    const r = await mk(`${X}/warnings/move-to-terminate/`, { emp_code: emp, date: dmy(date), reason, client_code: cas.client === SEL ? "" : cas.client, unit_code: cas.unit });
    alertMsg(r.ok ? (await r.json()).message : await responseMessage(r, "Termination failed!!"));
  };
  const pick = async (w: WarnRow) => {
    setSel(w.id); setDate(toIso(w.date)); setCount(String(w.count ?? "")); setReason(w.reason);
    if (w.client_code) { await cas.pickClient(w.client_code); cas.setUnit(w.unit_code); const o = await loadEmps(w.unit_code); if (o.some((x) => x.value === w.emp_code)) setEmp(w.emp_code); }
  };

  return (
    <>
      <div style={card}>
        <div style={{ fontWeight: "bold", fontSize: "small", marginBottom: 10 }}>WARNING LETTER</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 15, marginBottom: 15 }}>
          <Field label="Client Name :"><Select value={cas.client} onChange={onClient} opts={cas.clients} /></Field>
          <Field label="Branch Name :"><Select value={cas.unit || ""} onChange={onUnit} first="" opts={[{ value: "ALL", label: "ALL" }, ...cas.branches]} /></Field>
          <Field label="Employee Name :"><Select value={emp} onChange={onEmp} opts={emps} /></Field>
          <Field label="Warning Date :"><input type="date" className="form-control" max={plus60()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Count :"><input className="form-control" readOnly value={count} onChange={(e) => setCount(addrOnly(e.target.value))} /></Field>
          <Field label="Reason :" w={400}><textarea className="form-control" rows={3} value={reason} onChange={(e) => setReason(addrOnly(e.target.value))} /></Field>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!canTerminate && <button className="btn btn-primary" onClick={save}>Save</button>}
          <BackBar />
          {canTerminate && <button className="btn btn-primary" onClick={move}>Move To Terminate</button>}
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="table table-striped table-bordered table-hover" style={{ width: "100%", fontSize: 12, background: "#fff" }}>
          <thead style={{ background: "#224173", color: "white" }}>
            <tr>{["Name", "WARRING_DATE", "REASON", "COUNT"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id} onClick={() => pick(w)} style={{ cursor: "pointer", background: sel === w.id ? "#d9edf7" : undefined }}>
                <td style={td}>{w.emp_name}</td><td style={td}>{w.date}</td><td style={td}>{w.reason}</td><td style={td}>{w.count}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} style={{ ...td, textAlign: "center", color: "#666" }}>No records found</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ Termination letter */
interface TermRow { id: string; emp_code: string; emp_name: string; terminate_date: string; reason: string; client_code: string; unit_code: string }

function TerminationPanel() {
  const cas = useCascade(false);
  const [emps, setEmps] = useState<Opt[]>([]);
  const [emp, setEmp] = useState("");
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [rows, setRows] = useState<TermRow[]>([]);
  const [sel, setSel] = useState("");

  const load = useCallback(async () => {
    const d = await getJSON<{ rows: TermRow[] }>(`${X}/terminations/`);
    setRows(d?.rows ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  // legacy ddl_employee_termination(): the employee list is every employee of the company
  const loadEmps = async () => {
    const d = await getJSON<{ employees: { emp_code: string; emp_name: string }[] }>(`${X}/employees/?scope=all`);
    const o = (d?.employees ?? []).map((e) => ({ value: e.emp_code, label: e.emp_name }));
    setEmps(o);
    if (o.length) setEmp((cur) => cur || o[0].value);
    return o;
  };
  const onClient = async (c: string) => { setEmps([]); setEmp(""); await cas.pickClient(c); cas.setUnit("ALL"); };
  const onUnit = async (u: string) => { cas.setUnit(u); await loadEmps(); };
  const clear = () => { setEmps([]); setEmp(""); cas.setUnit(""); setDate(""); setReason(""); setSel(""); };

  const save = async () => {
    const r = await mk(`${X}/terminations/save/`, { emp_code: emp, terminate_date: dmy(date), reason, client_code: cas.client === SEL ? "" : cas.client, unit_code: cas.unit });
    if (!r.ok) { alertMsg(await responseMessage(r, "Save failed!!")); if (r.status === 400) clear(); return; }
    const d = await r.json();
    alertMsg(d.message);
    void openPrintHtml(`${X}/terminations/${d.id}/print/`);
    clear(); load();
  };
  const pick = async (t: TermRow) => {
    setSel(t.id);
    if (t.client_code) { await cas.pickClient(t.client_code); cas.setUnit(t.unit_code); }
    await loadEmps(); setEmp(t.emp_code); setDate(toIso(t.terminate_date)); setReason(t.reason);
  };

  return (
    <>
      <div style={card}>
        <div style={{ fontWeight: "bold", fontSize: "small", marginBottom: 10 }}>TERMINATION LETTER</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 15, marginBottom: 15 }}>
          <Field label="Client Name :"><Select value={cas.client} onChange={onClient} opts={cas.clients} /></Field>
          <Field label="Branch Name :"><Select value={cas.unit || ""} onChange={onUnit} first="" opts={[{ value: "ALL", label: "ALL" }, ...cas.branches]} /></Field>
          <Field label="Employee Name :"><Select value={emp} onChange={setEmp} first="" opts={emps} /></Field>
          <Field label="Terminate Date :"><input type="date" className="form-control" max={plus60()} value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Reason :" w={400}><textarea className="form-control" rows={3} value={reason} onChange={(e) => setReason(addrOnly(e.target.value))} /></Field>
        </div>
        <button className="btn btn-primary" onClick={save}>Save</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="table table-striped table-bordered table-hover" style={{ width: "100%", fontSize: 12, background: "#fff" }}>
          <thead style={{ background: "#224173", color: "white" }}>
            <tr>{["Name", "TERMINATION_DATE", "REASON"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((t) => (
              <tr key={t.id} onClick={() => pick(t)} style={{ cursor: "pointer", background: sel === t.id ? "#d9edf7" : undefined }}>
                <td style={td}>{t.emp_name}</td><td style={td}>{t.terminate_date}</td><td style={td}>{t.reason}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={3} style={{ ...td, textAlign: "center", color: "#666" }}>No records found</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ Increment letter */
interface IncEmp { emp_code: string; emp_name: string; grade_code: string; amount: string }
interface IncDetail { emp_code: string; emp_name: string; grade_code: string; increment_amount: string; heads: string[]; labels: string[]; grades: string[] }
interface IncRow { id: number; emp_code: string; emp_name: string; grade_code: string; year: string; amount: number }
const CALC_HEADS = [0, 1, 3]; // BASIC, HRA, CONVEY.ALLOW are computed from the increment amount (read only)

function IncrementPanel() {
  const cas = useCascade(true);
  const [emps, setEmps] = useState<IncEmp[]>([]);
  const [detail, setDetail] = useState<IncDetail | null>(null);
  const [grade, setGrade] = useState(SEL);
  const [year, setYear] = useState("");
  const [amount, setAmount] = useState("");
  const [heads, setHeads] = useState<string[]>(Array(15).fill("0"));
  const [list, setList] = useState<IncRow[] | null>(null);

  const onClient = async (c: string) => { setEmps([]); setDetail(null); await cas.pickClient(c); cas.setUnit("ALL"); };
  const onUnit = async (u: string) => {
    cas.setUnit(u); setDetail(null);
    const d = await getJSON<{ rows: IncEmp[]; message: string }>(`${X}/increment/employees/?unit=${encodeURIComponent(u)}`);
    setEmps(d?.rows ?? []);
    if (d?.message) alertMsg(d.message);
  };
  const pick = async (e: IncEmp) => {
    const d = await getJSON<IncDetail>(`${X}/increment/employee/${encodeURIComponent(e.emp_code)}/`);
    if (!d) return;
    setDetail(d); setGrade(d.grade_code || SEL); setAmount(d.increment_amount); setHeads(d.heads); setYear("");
  };
  // txtincrementamount_TextChanged: BASIC = 30% of (amount - 1600), HRA = 50% of BASIC, CONVEY.ALLOW = 1600
  const recalc = (a: string) => {
    const n = parseFloat(a);
    if (isNaN(n)) return;
    const basic = Math.round((n - 1600) * 0.3 * 100) / 100;
    setHeads((h) => { const x = [...h]; x[0] = String(basic); x[1] = String(Math.round(basic * 0.5 * 100) / 100); x[3] = "1600"; return x; });
  };
  const setHead = (i: number, v: string) => {
    const x = [...heads]; x[i] = numOnly(v); setHeads(x);
    const total = x.reduce((s, h) => s + (parseFloat(h) || 0), 0);
    if (total > (parseFloat(amount) || 0)) alertMsg("Please Enter Amount Quantity Less Than Increment Amount.");
  };
  const loadList = async () => { const d = await getJSON<{ rows: IncRow[] }>(`${X}/increment/list/`); setList(d?.rows ?? []); };
  const save = async () => {
    if (!detail) return;
    const r = await mk(`${X}/increment/save/`, { emp_code: detail.emp_code, grade_code: grade === SEL ? "" : grade, year, increment_amount: amount, heads });
    if (!r.ok) { alertMsg(await responseMessage(r, "Save failed!!")); return; }
    const d = await r.json();
    alertMsg(d.message); alertMsg(d.updated);
    void openPrintHtml(`${X}/increment/${d.id}/print/`);
    setDetail(null); await loadList();
    if (cas.unit) onUnit(cas.unit);
  };

  return (
    <>
      <div style={card}>
        <div style={{ fontWeight: "bold", fontSize: "small", marginBottom: 10 }}>INCREMENT LETTER</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 15, marginBottom: 15 }}>
          <Field label="Client Name :"><Select value={cas.client} onChange={onClient} opts={cas.clients} /></Field>
          <Field label="Branch Name :"><Select value={cas.unit || ""} onChange={onUnit} first="" opts={[{ value: "ALL", label: "ALL" }, ...cas.branches]} /></Field>
        </div>
        {emps.length > 0 && (
          <div style={{ overflowX: "auto", maxHeight: 300, overflowY: "auto", marginBottom: 12 }}>
            <table className="table table-striped table-bordered table-hover" style={{ width: "100%", fontSize: 12 }}>
              <thead style={{ background: "#224173", color: "white" }}>
                <tr>{["ID", "Employee Name", "Designation", "Amount"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {emps.map((e) => (
                  <tr key={e.emp_code} onClick={() => pick(e)} style={{ cursor: "pointer", background: detail?.emp_code === e.emp_code ? "#d9edf7" : undefined }}>
                    <td style={td}>{e.emp_code}</td><td style={td}>{e.emp_name}</td><td style={td}>{e.grade_code}</td><td style={td}>{e.amount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {detail && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 15, marginBottom: 15 }}>
              <Field label="Employee Code :"><input className="form-control" readOnly value={detail.emp_code} /></Field>
              <Field label="Employee Name :"><input className="form-control" readOnly value={detail.emp_name} /></Field>
              <Field label="Designation :"><Select value={grade} onChange={setGrade} first="Select Item" opts={detail.grades.map((g) => ({ value: g, label: g }))} /></Field>
              <Field label="Year :"><input className="form-control" maxLength={4} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ""))} /></Field>
              <Field label="Increment Amount :"><input className="form-control" maxLength={30} value={amount}
                onChange={(e) => setAmount(numOnly(e.target.value))} onBlur={() => recalc(amount)} /></Field>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 15 }}>
              {detail.labels.map((l, i) => (
                <div key={i} style={{ flex: "1 1 160px" }}>
                  <b>{l.trim()}</b>
                  <input className="form-control" maxLength={15} readOnly={CALC_HEADS.includes(i)} value={heads[i]} onChange={(e) => setHead(i, e.target.value)} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={save}>Save</button>
              <button className="btn btn-primary" onClick={() => { setDetail(null); setAmount(""); setYear(""); setHeads(Array(15).fill("0")); }}>Clear</button>
              <BackBar />
            </div>
          </>
        )}
      </div>
      {list && (
        <div style={{ overflowX: "auto" }}>
          <table className="table table-striped table-bordered" style={{ width: "100%", fontSize: 12, background: "#fff" }}>
            <thead style={{ background: "#224173", color: "white" }}>
              <tr>{["ID", "Employee Name", "Designation", "Year", "IncrementAmount"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {list.map((r) => <tr key={r.id}><td style={td}>{r.emp_code}</td><td style={td}>{r.emp_name}</td><td style={td}>{r.grade_code}</td><td style={td}>{r.year}</td><td style={td}>{r.amount}</td></tr>)}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------ Relieving / Experience */
interface LeftRow { emp_code: string; emp_name: string; joining_date: string; grade_code: string; location: string; birth_date: string }

function LeftLetterPanel({ kind }: { kind: "relieving" | "experience" }) {
  const cas = useCascade(false);
  const [rows, setRows] = useState<LeftRow[] | null>(null);
  const onClient = async (c: string) => { setRows(null); await cas.pickClient(c); cas.setUnit("ALL"); };
  const onUnit = async (u: string) => {
    cas.setUnit(u);
    const d = await getJSON<{ rows: LeftRow[]; message: string }>(`${X}/left-employees/?unit=${encodeURIComponent(u)}`);
    setRows(d?.rows ?? []);
    if (d?.message) alertMsg(d.message);
  };
  const title = kind === "relieving" ? "RELIEVING LETTER" : "EXPERIENCE LETTER";
  return (
    <div style={card}>
      <div style={{ fontWeight: "bold", fontSize: "small", marginBottom: 10 }}>{title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 15, marginBottom: 15 }}>
        <Field label="Client Name :"><Select value={cas.client} onChange={onClient} opts={cas.clients} /></Field>
        <Field label="Branch Name :"><Select value={cas.unit || ""} onChange={onUnit} first="" opts={[{ value: "ALL", label: "ALL" }, ...cas.branches]} /></Field>
      </div>
      {rows && rows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="table table-striped table-bordered table-hover" style={{ width: "100%", fontSize: 12 }}>
            <thead style={{ background: "#224173", color: "white" }}>
              <tr>{["Edit", "ID", "Employee Name", "Joining Date", "Designation", "LOCATION", "Birth_Date"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.emp_code}>
                  <td style={td}><a href="#" onClick={(e) => { e.preventDefault(); void openPrintHtml(`${X}/left-letter/${encodeURIComponent(r.emp_code)}/print/?kind=${kind}`); }}>PRINT</a></td>
                  <td style={td}>{r.emp_code}</td><td style={td}>{r.emp_name}</td><td style={td}>{r.joining_date}</td>
                  <td style={td}>{r.grade_code}</td><td style={td}>{r.location}</td><td style={td}>{r.birth_date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Uniform letter */
function UniformPanel() {
  const cas = useCascade(false);
  const [emps, setEmps] = useState<Opt[]>([]);
  const [emp, setEmp] = useState(SEL);
  const [uni, setUni] = useState<"Yes" | "No" | "">("");
  const [icard, setIcard] = useState<"Yes" | "No" | "">("");
  const [uniDate, setUniDate] = useState(today());
  const [icDate, setIcDate] = useState(today());
  const onClient = async (c: string) => { setEmps([]); setEmp(SEL); await cas.pickClient(c); cas.setUnit("ALL"); };
  const onUnit = async (u: string) => {
    cas.setUnit(u); setEmp(SEL);
    const d = await getJSON<{ employees: { emp_code: string; emp_name: string }[] }>(`${X}/employees/?unit=${encodeURIComponent(u)}`);
    setEmps((d?.employees ?? []).map((e) => ({ value: e.emp_code, label: e.emp_name })));
  };
  const submit = () => {
    if (emp === SEL) { alertMsg("Please Select Employee"); return; }
    const q = new URLSearchParams({ emp_code: emp, uniform_status: uni || "No", uniform_date: dmy(uniDate), icard_status: icard || "No", icard_date: dmy(icDate) });
    void openPrintHtml(`${X}/uniform-letter/print/?${q.toString()}`);
  };
  const radio = (name: string, v: string, set: (x: "Yes" | "No") => void, cur: string) => (
    <>
      <label style={{ marginRight: 14 }}><input type="radio" name={name} checked={cur === "Yes"} onChange={() => set("Yes")} /> <b>Yes :</b></label>
      <label><input type="radio" name={name} checked={cur === "No"} onChange={() => set("No")} /> <b>No :</b></label>
    </>
  );
  return (
    <div style={card}>
      <div style={{ fontWeight: "bold", fontSize: "small", marginBottom: 10 }}>UNIFORM LETTER</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 15, marginBottom: 15 }}>
        <Field label="Client Name :"><Select value={cas.client} onChange={onClient} opts={cas.clients} /></Field>
        <Field label="Branch Name :"><Select value={cas.unit || ""} onChange={onUnit} first="" opts={[{ value: "ALL", label: "ALL" }, ...cas.branches]} /></Field>
        <Field label="Employee Name :"><Select value={emp} onChange={setEmp} opts={emps} /></Field>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 15, marginBottom: 15, alignItems: "flex-end" }}>
        <Field label="Uniform Recieve Status :-">{<div style={{ paddingTop: 6 }}>{radio("uniform", "", setUni, uni)}</div>}</Field>
        <Field label="Received Date :"><input type="date" className="form-control" max={plus60()} value={uniDate} onChange={(e) => setUniDate(e.target.value)} /></Field>
        <Field label="ID Card Recieve Status :-">{<div style={{ paddingTop: 6 }}>{radio("icard", "", setIcard, icard)}</div>}</Field>
        <Field label="Received Date :"><input type="date" className="form-control" max={plus60()} value={icDate} onChange={(e) => setIcDate(e.target.value)} /></Field>
      </div>
      <button className="btn btn-primary" onClick={submit}>Save</button>
    </div>
  );
}

/* ------------------------------------------------------------------ Joining letter print */
function JoiningPanel() {
  const [clients, setClients] = useState<Opt[]>([]);
  const [states, setStates] = useState<Opt[]>([]);
  const [units, setUnits] = useState<Opt[]>([]);
  const [emps, setEmps] = useState<Opt[]>([]);
  const [client, setClient] = useState(SEL);
  const [state, setState] = useState(SEL);
  const [unit, setUnit] = useState(SEL);
  const [emp, setEmp] = useState(SEL);
  useEffect(() => {
    getJSON<{ clients: { client_code: string; client_name: string }[] }>(`${X}/joining/clients/`)
      .then((d) => setClients((d?.clients ?? []).map((c) => ({ value: c.client_code, label: c.client_name }))));
  }, []);
  const onClient = async (c: string) => {
    setClient(c); setState(SEL); setUnit(SEL); setEmp(SEL); setStates([]); setUnits([]); setEmps([]);
    if (c === SEL) return;
    const d = await getJSON<{ states: string[] }>(`${X}/joining/states/?client=${encodeURIComponent(c)}`);
    setStates((d?.states ?? []).map((s) => ({ value: s, label: s })));
  };
  const onState = async (s: string) => {
    setState(s); setUnit(SEL); setEmp(SEL); setUnits([]); setEmps([]);
    if (s === SEL) return;
    const d = await getJSON<{ branches: { unit_code: string; label: string }[] }>(`${X}/joining/units/?client=${encodeURIComponent(client)}&state=${encodeURIComponent(s)}`);
    setUnits((d?.branches ?? []).map((u) => ({ value: u.unit_code, label: u.label })));
  };
  const onUnit = async (u: string) => {
    setUnit(u); setEmp(SEL); setEmps([]);
    if (u === SEL) return;
    const d = await getJSON<{ employees: { emp_code: string; emp_name: string }[] }>(`${X}/joining/employees/?unit=${encodeURIComponent(u)}`);
    setEmps((d?.employees ?? []).map((e) => ({ value: e.emp_code, label: e.emp_name })));
  };
  const print = () => {
    if (emp === SEL) { alertMsg("Please Select Employee"); return; }
    void openPrintHtml(`${X}/joining-letter/print/?emp_code=${encodeURIComponent(emp)}`);
  };
  return (
    <div style={card}>
      <div style={{ fontWeight: "bold", fontSize: "small", marginBottom: 10 }}>JOINING LETTER</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 15, marginBottom: 15 }}>
        <Field label="Client Name:"><Select value={client} onChange={onClient} opts={clients} /></Field>
        <Field label="State Name:"><Select value={state} onChange={onState} opts={states} /></Field>
        <Field label="Branch Name:"><Select value={unit} onChange={onUnit} opts={units} /></Field>
        <Field label="Employee Name:"><Select value={emp} onChange={setEmp} opts={emps} /></Field>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn btn-primary" onClick={print}>Print</button>
        <BackBar />
      </div>
    </div>
  );
}

export default function OfferLetterExtras({ panel }: { panel: ExtraPanel }) {
  switch (panel) {
    case "increment": return <IncrementPanel />;
    case "relieving": return <LeftLetterPanel kind="relieving" />;
    case "experience": return <LeftLetterPanel kind="experience" />;
    case "warning": return <WarningPanel />;
    case "termination": return <TerminationPanel />;
    case "uniform": return <UniformPanel />;
    case "joining": return <JoiningPanel />;
  }
}
