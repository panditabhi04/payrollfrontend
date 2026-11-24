"use client";
import React, { useCallback, useEffect, useState } from "react";
import { openPrintHtml } from "@/components/hrPrint";
import { getJSON, mk, rm, responseMessage } from "@/lib/api/legacy-fetch";
import OfferLetterExtras, { EXTRA_TABS, type ExtraPanel } from "@/components/OfferLetterExtras";

// Legacy Offerletter.aspx: Offer letter panel (auto code, designation/state/city lists, grid with
// row select, Save / Delete / Move to Appointment Letter / Print) + Appointment letter panel.
// Increment / Relieving / Experience / Warning / Termination / Uniform / Joining panels live in
// OfferLetterExtras.tsx (backend apps/employees/offer_extras.py).
const OFFER = "/api/hr/offer-letters/";
const APPT = "/api/hr/appointment-letters/";

interface Letter {
  id: number; emp_code: string; emp_name: string; joining_date?: string; address?: string;
  grade_code?: string; salary_per_month?: string; state?: string; city?: string; flag?: string;
}
const EMPTY = { emp_code: "", emp_name: "", joining_date: "", address: "", grade_code: "", salary_per_month: "", state: "", city: "" };
const SEL = "Select";

export default function OfferLetterHub() {
  const [tab, setTab] = useState<"offer" | "appointment" | ExtraPanel>("offer");
  const [rows, setRows] = useState<Letter[]>([]);
  const [appt, setAppt] = useState<Letter[]>([]);
  const [form, setForm] = useState({ ...EMPTY });
  const [sel, setSel] = useState<Letter | null>(null);
  const [msg, setMsg] = useState("");
  const [grades, setGrades] = useState<{ grade_code: string; grade_desc: string }[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [cities, setCities] = useState<Record<string, string[]>>({});

  const list = async <T,>(url: string): Promise<T[]> => {
    const d = await getJSON<{ results: T[] } | T[]>(`${url}?page_size=all`);
    return (Array.isArray(d) ? d : d?.results ?? []) as T[];
  };
  const nextCode = useCallback(async () => {
    const d = await getJSON<{ emp_code: string }>(`${OFFER}next-code/`);
    setForm((f) => ({ ...f, emp_code: d?.emp_code ?? "" }));
  }, []);
  const load = useCallback(async () => {
    setRows(await list<Letter>(OFFER));
    setAppt(await list<Letter>(APPT));
  }, []);
  useEffect(() => {
    load(); nextCode();
    getJSON<{ grades: { grade_code: string; grade_desc: string }[] }>("/api/hr/grades/lookup/").then((d) => setGrades(d?.grades ?? []));
    getJSON<{ states: string[]; cities: Record<string, string[]> }>("/api/masters/states/lookup/").then((d) => {
      setStates(d?.states ?? []); setCities(d?.cities ?? {});
    });
  }, [load, nextCode]);

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const clear = () => { setSel(null); setForm({ ...EMPTY }); nextCode(); };
  const say = (t: string) => { setMsg(t); window.alert(t); };

  const valid = (): boolean => {
    const checks: [string, string][] = [
      [form.emp_name.trim(), "Please Enter Employee Name"], [form.joining_date, "Please Enter Joining Date"],
      [form.address.trim(), "Please Enter Address"], [form.grade_code === SEL ? "" : form.grade_code, "Please Enter Designation"],
      [form.salary_per_month.trim(), "Please Enter Sallary Per Month"],
      [form.state === SEL ? "" : form.state, "Please Select State"], [form.city === SEL ? "" : form.city, "Please Select City"],
    ];
    for (const [v, m] of checks) if (!v) { window.alert(m); return false; }
    return true;
  };
  const save = async () => {
    if (!valid()) return;
    const r = await mk(OFFER, form);
    if (r.ok) { say("Offer Letter Save Successfully!!"); clear(); load(); }
    else say(await responseMessage(r, " Offer Letter Save failed..."));
  };
  const del = async () => {
    if (!sel) { window.alert("Please select a record from the grid."); return; }
    if (!window.confirm("Are you Sure You Want to Delete Record")) return;
    const r = await rm(`${OFFER}${sel.id}/`);
    if (r.ok) { say("Successfully Delete !!"); clear(); load(); }
    else say("Deletion failed !!");
  };
  const move = async () => {
    if (!sel) { window.alert("Please select a record from the grid."); return; }
    const r = await mk(`${OFFER}${sel.id}/move-to-appointment/`, {});
    if (r.ok) { say("Move to appointment letter successfully!!"); clear(); load(); }
    else say(await responseMessage(r, "Record move to appointment letter failed..."));
  };
  const print = (base: string, id?: number) => {
    if (!id) { window.alert("Please select a record from the grid."); return; }
    void openPrintHtml(`${base}${id}/print/`);
  };
  const pick = (l: Letter) => {
    setSel(l);
    setForm({
      emp_code: l.emp_code, emp_name: l.emp_name, joining_date: (l.joining_date || "").slice(0, 10),
      address: l.address || "", grade_code: l.grade_code || "", salary_per_month: l.salary_per_month || "",
      state: l.state || "", city: l.city || "",
    });
  };
  const delAppt = async (l: Letter) => {
    if (!window.confirm("Are you Sure You Want to Delete Record")) return;
    const r = await rm(`${APPT}${l.id}/`);
    if (r.ok) { say("Successfully Delete !!"); load(); } else say("Deletion failed !!");
  };

  const th: React.CSSProperties = { padding: 8, border: "1px solid #ddd", textTransform: "uppercase", fontSize: 11 };
  const td: React.CSSProperties = { padding: 8, border: "1px solid #ddd" };
  const grid = (data: Letter[], offer: boolean) => (
    <div style={{ overflowX: "auto" }}>
      <table className="table table-striped table-bordered table-hover" style={{ width: "100%", fontSize: 12, background: "#fff" }}>
        <thead style={{ background: "#224173", color: "white" }}>
          <tr>{["Emp Code", "Name", "Joining Date", "Address", "Designation", "Salary", "State", "City", "Action"].map((h) => <th key={h} style={th}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((l) => (
            <tr key={l.id} onClick={offer ? () => pick(l) : undefined}
              style={{ cursor: offer ? "pointer" : undefined, background: sel?.id === l.id ? "#d9edf7" : undefined }}>
              <td style={td}>{l.emp_code}</td><td style={td}>{l.emp_name}</td><td style={td}>{(l.joining_date || "").slice(0, 10)}</td>
              <td style={td}>{l.address}</td>
              <td style={td}>{grades.find((g) => g.grade_code === l.grade_code)?.grade_desc || l.grade_code}</td>
              <td style={td}>{l.salary_per_month}</td><td style={td}>{l.state}</td><td style={td}>{l.city}</td>
              <td style={td}>
                {offer
                  ? <button className="btn btn-xs btn-primary" onClick={(e) => { e.stopPropagation(); print(OFFER, l.id); }}>Print</button>
                  : <>
                    <button className="btn btn-xs btn-primary" onClick={() => print(APPT, l.id)}>Print</button>{" "}
                    <button className="btn btn-xs btn-danger" onClick={() => delAppt(l)}>Delete</button>
                  </>}
              </td>
            </tr>
          ))}
          {data.length === 0 && <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#666" }}>No letters found</td></tr>}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      <div className="panel panel-primary">
        <div className="panel-heading" style={{ textAlign: "center", fontWeight: "bold", textTransform: "uppercase", fontSize: "small" }}>
          {tab === "offer" ? "Offer Letter" : tab === "appointment" ? "Appointment Letter" : (EXTRA_TABS.find((t) => t.key === tab)?.label ?? "Letters")}
        </div>
        <div className="panel-body" style={{ background: "beige", minHeight: 500 }}>
          <div style={{ marginBottom: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className={`btn ${tab === "offer" ? "btn-primary" : "btn-default"}`} onClick={() => setTab("offer")}>Offer Letter</button>
            <button className={`btn ${tab === "appointment" ? "btn-primary" : "btn-default"}`} onClick={() => setTab("appointment")}>Appointment Letter</button>
            {EXTRA_TABS.map((t) => (
              <button key={t.key} className={`btn ${tab === t.key ? "btn-primary" : "btn-default"}`} onClick={() => setTab(t.key)}>{t.label}</button>
            ))}
          </div>
          {msg && <div style={{ color: "green", fontWeight: "bold", textAlign: "center", marginBottom: 12, padding: 8, background: "#dff0d8", border: "1px solid #d6e9c6", borderRadius: 4 }}>{msg}</div>}
          {tab === "offer" ? (
            <>
              <div style={{ background: "#fff", padding: 15, border: "1px solid #ccc", borderRadius: 4, marginBottom: 16 }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 15, marginBottom: 15 }}>
                  <div style={{ flex: "1 1 200px" }}><b>Employee Code :</b><input className="form-control" readOnly value={form.emp_code} /></div>
                  <div style={{ flex: "1 1 200px" }}><b>Employee Name :</b><input className="form-control" value={form.emp_name} onChange={(e) => set("emp_name", e.target.value.replace(/[^a-zA-Z .]/g, ""))} /></div>
                  <div style={{ flex: "1 1 200px" }}><b>Joining Date :</b><input type="date" className="form-control" value={form.joining_date} onChange={(e) => set("joining_date", e.target.value)} /></div>
                  <div style={{ flex: "1 1 200px" }}><b>Address :</b><input className="form-control" value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
                  <div style={{ flex: "1 1 200px" }}><b>Designation :</b>
                    <select className="form-control" value={form.grade_code || SEL} onChange={(e) => set("grade_code", e.target.value === SEL ? "" : e.target.value)}>
                      <option value={SEL}>{SEL}</option>
                      {grades.map((g) => <option key={g.grade_code} value={g.grade_code}>{g.grade_desc}</option>)}
                    </select></div>
                  <div style={{ flex: "1 1 200px" }}><b>Salary Per Month :</b><input className="form-control" value={form.salary_per_month} onChange={(e) => set("salary_per_month", e.target.value.replace(/[^0-9.]/g, ""))} /></div>
                  <div style={{ flex: "1 1 200px" }}><b>State :</b>
                    <select className="form-control" value={form.state || SEL} onChange={(e) => setForm((f) => ({ ...f, state: e.target.value === SEL ? "" : e.target.value, city: "" }))}>
                      <option value={SEL}>{SEL}</option>
                      {states.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select></div>
                  <div style={{ flex: "1 1 200px" }}><b>City :</b>
                    <select className="form-control" value={form.city || SEL} onChange={(e) => set("city", e.target.value === SEL ? "" : e.target.value)}>
                      <option value={SEL}>{SEL}</option>
                      {(cities[form.state] ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select></div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button className="btn btn-primary" onClick={save} disabled={!!sel}>Save</button>
                  <button className="btn btn-danger" onClick={del} disabled={!sel}>Delete</button>
                  <button className="btn btn-info" onClick={move} disabled={!sel}>Move to Appointment Letter</button>
                  <button className="btn btn-success" onClick={() => print(OFFER, sel?.id)} disabled={!sel}>Print</button>
                  <button className="btn btn-default" onClick={clear}>Clear</button>
                </div>
              </div>
              {grid(rows, true)}
            </>
          ) : tab === "appointment" ? grid(appt, false) : <OfferLetterExtras panel={tab} />}
        </div>
      </div>
    </div>
  );
}
