"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getJSON, mk } from "@/lib/api/legacy-fetch";

// 1:1 port of staff_salary_structure.aspx. Client (only 'staff') -> Unit cascade, 15 earning heads
// (Head1 = BASIC, read-only), 5 lumpsum + 10 deduction heads (15 chars, alphanumeric), PF/ESIC rates
// and formulas, Save (replaces the unit's structure), grid with row-click load, Close.
const B = "/api/payroll/staff-salary-structure";
const N15 = Array.from({ length: 15 }, (_, i) => i + 1);
const N5 = Array.from({ length: 5 }, (_, i) => i + 1);
const N10 = Array.from({ length: 10 }, (_, i) => i + 1);
type S = Record<string, string>;

const blank = (): S => {
  const f: S = { head1: "BASIC", head1_per: "0", head2_per: "0",
    pf_employee: "0", pf_employer: "0", pf_employee_formula: "0", pf_employer_formula: "0",
    esic_employee: "0", esic_employer: "0", esic_employee_formula: "0", esic_employer_formula: "0" };
  return f;
};
const alnum = (v: string) => v.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 15);

export default function StaffSalaryStructurePage() {
  const router = useRouter();
  const [clients, setClients] = useState<{ client_code: string; client_name: string }[]>([]);
  const [units, setUnits] = useState<{ unit_code: string; unit_name: string }[]>([]);
  const [client, setClient] = useState("Select");
  const [unit, setUnit] = useState("Select");
  const [f, setF] = useState<S>(blank());
  const [rows, setRows] = useState<S[]>([]);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const loadGrid = useCallback(async () => {
    const d = await getJSON<{ results: S[] }>(`${B}/?page_size=all`);
    setRows(d?.results ?? []);
  }, []);
  useEffect(() => {
    getJSON<{ results: { client_code: string; client_name: string }[] }>(`${B}/clients/`).then((d) => setClients(d?.results ?? []));
    loadGrid();
  }, [loadGrid]);

  const pickClient = async (c: string, thenUnit?: string) => {
    setClient(c); setUnit("Select");
    if (c === "Select") { setUnits([]); return; }
    const d = await getJSON<{ results: { unit_code: string; unit_name: string }[] }>(`${B}/units/?client_code=${encodeURIComponent(c)}`);
    setUnits(d?.results ?? []);
    if (thenUnit) setUnit(thenUnit);
  };

  const validate = (): string | null => {
    const empty = (k: string) => (f[k] ?? "").trim() === "" || f[k] === "0";
    if (empty("head1_per")) return "Please Enter Head1(%) !!";
    if (empty("head2")) return "Please Enter Head2 !!";
    if (empty("head2_per")) return "Please Enter Head2(%) !!";
    if (empty("pf_employee")) return "Please Enter PF Employee !!";
    if (empty("pf_employer")) return "Please Enter PF Employer !!";
    if (empty("esic_employee")) return "Please Enter ESIC Employee !!";
    if (empty("esic_employer")) return "Please Enter ESIC Employer !!";
    if (unit === "Select") return "Please select unit name !!!";
    return null;
  };
  const errMsg = async (r: Response) => {
    const b = await r.json().catch(() => ({} as any));
    const pick = (x: any): string => (Array.isArray(x) ? pick(x[0]) : typeof x === "string" ? x : x && typeof x === "object" ? pick(Object.values(x)[0]) : "");
    return pick(b?.detail ?? b) || "Record adding failed...";
  };
  const save = async () => {
    const e = validate();
    if (e) { window.alert(e); return; }
    const body: S = { ...f, unit_code: unit, client_code: client };
    const r = await mk(`${B}/`, body);
    if (r.ok) { window.alert("Record added successfully!!"); setF(blank()); setUnit("Select"); loadGrid(); }
    else window.alert(await errMsg(r));
  };
  const pickRow = async (r: S) => {
    const next: S = { ...blank() };
    Object.keys(r).forEach((k) => { if (r[k] !== null && r[k] !== undefined) next[k] = String(r[k]); });
    if (!next.head1) next.head1 = "BASIC";
    setF(next);
    await pickClient(r.client_code || "staff", r.unit_code);
  };

  const head = (n: number) => (
    <div key={n} className="row" style={{ marginBottom: 6 }}>
      <div className="col-sm-3 col-xs-12">Head{n}:
        <input className="form-control text_box" value={f[`head${n}`] ?? ""} readOnly={n === 1}
          onChange={(e) => set(`head${n}`, e.target.value)} /></div>
      <div className="col-sm-2 col-xs-12">Head{n}(%):
        <input className="form-control text_box" value={f[`head${n}_per`] ?? ""} onChange={(e) => set(`head${n}_per`, e.target.value)} /></div>
    </div>
  );
  const small = (key: string, label: string) => (
    <div className="col-sm-3 col-xs-12" key={key} style={{ marginBottom: 6 }}>
      <b>{label}</b>
      <input className="form-control text_box" maxLength={15} value={f[key] ?? ""} onChange={(e) => set(key, alnum(e.target.value))} />
    </div>
  );
  const rate = (key: string, label: string) => (
    <div className="col-sm-3 col-xs-12" key={key} style={{ marginBottom: 6 }}>
      <b>{label}</b>
      <input className="form-control text_box" value={f[key] ?? ""} onChange={(e) => set(key, e.target.value)} />
    </div>
  );
  const gcols = ["client_code", "unit_code", ...N15.flatMap((n) => [`head${n}`, `head${n}_per`]),
    ...N5.map((n) => `lhead${n}`), ...N10.map((n) => `dhead${n}`),
    "pf_employee", "pf_employer", "esic_employee", "esic_employer",
    "pf_employee_formula", "pf_employer_formula", "esic_employee_formula", "esic_employer_formula"];

  return (
    <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: 4, background: "#fff" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
          Staff Salary Structure
        </div>
        <div className="panel-body" style={{ padding: 15 }}>
          <div className="row" style={{ marginBottom: 10 }}>
            <div className="col-sm-3 col-xs-12"><b>Client Name:</b>
              <select className="form-control text_box" value={client} onChange={(e) => pickClient(e.target.value)}>
                <option value="Select">Select</option>
                {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
              </select></div>
            <div className="col-sm-3 col-xs-12"><b>Unit Name:</b>
              <select className="form-control text_box" value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="Select">Select</option>
                {units.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
              </select></div>
          </div>
          <div style={{ background: "#337ab7", color: "#fff", padding: "6px 10px", marginBottom: 10 }}><b>Staff Salary Structure Details</b></div>
          {N15.map(head)}
          <h4>Lumpsum Heads</h4>
          <div className="row">{N5.map((n) => small(`lhead${n}`, `L_Head${n} :`))}</div>
          <h4>Deduction Heads</h4>
          <div className="row">{N10.map((n) => small(`dhead${n}`, `D_Head${n} :`))}</div>
          <h4>Tax Deductions</h4>
          <div className="row">
            {rate("pf_employee", "PF Employee (%) :")}{rate("pf_employer", "PF Employer (%) :")}
            {rate("pf_employee_formula", "PF Employee Formula :")}{rate("pf_employer_formula", "PF Employer Formula :")}
            {rate("esic_employee", "ESIC Employee (%) :")}{rate("esic_employer", "ESIC Employer (%) :")}
            {rate("esic_employee_formula", "ESIC Employee Formula :")}{rate("esic_employer_formula", "ESIC Employer Formula :")}
          </div>
          <div style={{ textAlign: "center", margin: "14px 0" }}>
            <button type="button" className="btn btn-primary" onClick={save} style={{ marginRight: 8 }}>Save</button>
            <button type="button" className="btn btn-danger" onClick={() => router.push("/Home")}>Close</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table className="table table-bordered table-striped" style={{ fontSize: 12, background: "#fff" }}>
              <thead><tr>{gcols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} onClick={() => pickRow(r)} style={{ cursor: "pointer" }}>
                    {gcols.map((c) => <td key={c}>{r[c] ?? ""}</td>)}
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={gcols.length} style={{ textAlign: "center" }}>No records</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
