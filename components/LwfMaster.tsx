"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DataTable, { DTColumn } from "./DataTable";
import { Field, Sel, Txt, Opt } from "./formkit";
import { getJSON, mk, putJSON, rm } from "@/lib/api/legacy-fetch";

interface LwfRow {
  id: number;
  state_name: string;
  app_lwf_act: string;
  category_employees: string;
  contract_labours: string;
  period: string;
  last_day_submission: string;
  employee_contribution: number | null;
  employer_contribution: number | null;
  total_contribution: number | null;
}

// Exact legacy static state list, in order (lwf_master.aspx ddl_state).
const STATE_OPTS: Opt[] = [
  { v: "Select State", t: "Select State" },
  { v: "Andhra Pradesh", t: "Andhra Pradesh" },
  { v: "Chattisgarh", t: "Chattisgarh" },
  { v: "Goa", t: "Goa" },
  { v: "Gujarat", t: "Gujarat" },
  { v: "Haryana", t: "Haryana" },
  { v: "Karnataka", t: "Karnataka" },
  { v: "Madhya Pradesh", t: "Madhya Pradesh" },
  { v: "Maharashtra", t: "Maharashtra" },
  { v: "New Delhi", t: "New Delhi" },
  { v: "Punjab", t: "Punjab" },
  { v: "Tamil Nadu", t: "Tamil Nadu" },
  { v: "West Bengal", t: "West Bengal" },
  { v: "UT of Chandigarh", t: "UT of Chandigarh" },
];

// Exact legacy contract list; first item wins as default (yes).
const CONTRACT_OPTS: Opt[] = [
  { v: "yes", t: "yes" },
  { v: "no", t: "no" },
];

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

export function LwfMaster() {
  const [data, setData] = useState<LwfRow[]>([]);
  const [f, setF] = useState({
    lwf_id: "",
    state_name: "Select State",
    app_lwf_act: "",
    category_employees: "",
    contract_labours: "yes",
    period: "",
    last_day_submission: "",
    employee_contribution: "0",
    employer_contribution: "0",
  });
  const [selected, setSelected] = useState<LwfRow | null>(null);

  const loadGrid = () => {
    // Legacy initial grid: unfiltered, no ORDER BY.
    getJSON<{ results: LwfRow[] }>(`/api/masters/lwf-masters/?page_size=all`)
      .then((d) => setData(d?.results ?? []));
  };

  const fetchNewId = () => {
    getJSON<{ lwf_id: string }>(`/api/masters/lwf-masters/new-lwf-id/`)
      .then((d) => setF((p) => ({ ...p, lwf_id: d?.lwf_id ?? "" })));
  };

  useEffect(() => {
    loadGrid();
    fetchNewId();
  }, []);

  // Legacy cal_add(): sums the two contributions into .total_cont — a control
  // that does not exist on the page, so the write is a silent no-op.
  // Preserved exactly: compute, discard, no total box is created.
  const calAdd = () => {
    const total = parseFloat(f.employee_contribution) + parseFloat(f.employer_contribution);
    void total;
  };

  // Legacy text_Clear() + btn_new_Click (new id). Button visibility untouched.
  const clear = () => {
    setF({
      lwf_id: "", state_name: "Select State", app_lwf_act: "",
      category_employees: "", contract_labours: "yes", period: "",
      last_day_submission: "", employee_contribution: "0",
      employer_contribution: "0",
    });
    fetchNewId();
  };

  const save = async () => {
    // No validation exists in legacy — nothing to check.
    try {
      const res = await mk("/api/masters/lwf-masters/", {
        state_name: f.state_name,
        app_lwf_act: f.app_lwf_act,
        category_employees: f.category_employees,
        contract_labours: f.contract_labours,
        period: f.period,
        last_day_submission: f.last_day_submission,
        employee_contribution: f.employee_contribution,
        employer_contribution: f.employer_contribution,
      });
      const payload = await res.json().catch(() => null);
      // Legacy always shows the failure alert (INSERT commented out), then
      // reloads + clears + regenerates the id. Preserved exactly.
      if (payload?.message) alert(payload.message);
      loadGrid();
      clear();
    } catch {
      // Legacy catch{} swallows: no alert. Grid/form untouched.
      return;
    }
  };

  const update = async () => {
    if (!selected) return;
    try {
      const res = await putJSON(`/api/masters/lwf-masters/${selected.id}/`, {
        state_name: f.state_name,
        app_lwf_act: f.app_lwf_act,
        category_employees: f.category_employees,
        contract_labours: f.contract_labours,
        period: f.period,
        last_day_submission: f.last_day_submission,
        employee_contribution: f.employee_contribution,
        employer_contribution: f.employer_contribution,
      });
      const payload = await res.json().catch(() => null);
      if (payload?.message) alert(payload.message);
      loadGrid();
      clear();
      setSelected(null);
    } catch {
      return;
    }
  };

  const del = async () => {
    // No confirm dialog exists in legacy. The legacy DELETE always fails
    // (COMP_CODE does not exist) and the error is unhandled, so no message
    // is ever shown and the grid is never rebound. Preserved: attempt the
    // request; on any non-message outcome change nothing.
    if (!selected) return;
    try {
      const res = await rm(`/api/masters/lwf-masters/${selected.id}/`);
      const payload = await res.json().catch(() => null);
      if (payload?.message) {
        alert(payload.message);
        loadGrid();
        clear();
        setSelected(null);
      }
    } catch {
      return;
    }
  };

  const onRowClick = async (row: LwfRow) => {
    // Legacy row-select: full row by id (no comp filter), populates the same
    // fields (total intentionally NOT populated — commented line) with no
    // dropdown guards, then Save hidden / Update+Delete shown.
    const d = await getJSON<LwfRow>(`/api/masters/lwf-masters/${row.id}/`);
    if (!d) return;
    setSelected(row);
    setF({
      lwf_id: str(d.id),
      state_name: d.state_name || "Select State",
      app_lwf_act: d.app_lwf_act || "",
      category_employees: d.category_employees || "",
      contract_labours: d.contract_labours || "yes",
      period: d.period || "",
      last_day_submission: d.last_day_submission || "",
      employee_contribution: str(d.employee_contribution),
      employer_contribution: str(d.employer_contribution),
    });
  };

  const cols: DTColumn<LwfRow>[] = [
    { key: "state_name", label: "STATE NAME", value: (d: LwfRow) => d.state_name || "" },
    { key: "contract_labours", label: "CONTRACT LABOURS", value: (d: LwfRow) => d.contract_labours || "" },
    { key: "period", label: "PERIOD", value: (d: LwfRow) => d.period || "" },
    { key: "last_day_submission", label: "LAST DAY SUBMITION", value: (d: LwfRow) => d.last_day_submission || "" },
    { key: "employee_contribution", label: "EMPLOYEE CONTRIBUTION", value: (d: LwfRow) => str(d.employee_contribution) },
    { key: "employer_contribution", label: "EMPLOYER CONTRIBUTION", value: (d: LwfRow) => str(d.employer_contribution) },
    { key: "total_contribution", label: "TOTAL", value: (d: LwfRow) => str(d.total_contribution) },
  ];

  return (
    <div className="lg-wrap">
      <div className="lg-hdr">MLWF MASTER</div>
      <div className="lg-form-box">
        <div className="lg-row">
          <Sel label="State :" value={f.state_name} onChange={(v) => setF((p) => ({ ...p, state_name: v }))} opts={STATE_OPTS} />
          <Field label="Applicablity of the LWF Act :"><textarea className="lg-control" rows={3} value={f.app_lwf_act} onChange={(e) => setF((p) => ({ ...p, app_lwf_act: e.target.value }))} /></Field>
          <Field label="Category of Employees to be covered:"><textarea className="lg-control" rows={3} value={f.category_employees} onChange={(e) => setF((p) => ({ ...p, category_employees: e.target.value }))} /></Field>
          <Sel label="Applicability Contract Labours? :" value={f.contract_labours} onChange={(v) => setF((p) => ({ ...p, contract_labours: v }))} opts={CONTRACT_OPTS} />
          <input type="hidden" value={f.lwf_id} readOnly />
        </div>
        <div className="lg-row">
          <Txt label="Period :" value={f.period} onChange={(v) => setF((p) => ({ ...p, period: v }))} />
          <Txt label="Last Day for submission :" value={f.last_day_submission} onChange={(v) => setF((p) => ({ ...p, last_day_submission: v }))} />
          <Txt label="Employee Contribution :" value={f.employee_contribution} onChange={(v) => { setF((p) => ({ ...p, employee_contribution: v })); calAdd(); }} />
          <Txt label="Employer Contribution :" value={f.employer_contribution} onChange={(v) => { setF((p) => ({ ...p, employer_contribution: v })); calAdd(); }} />
        </div>
        <div className="lg-row" style={{ justifyContent: "center", gap: "10px", marginTop: "10px" }}>
          {!selected && <button className="btn btn-primary" onClick={save}> Save </button>}
          {selected && <button className="btn btn-primary" onClick={update}> Update </button>}
          {selected && <button className="btn btn-primary" onClick={del}> Delete </button>}
          <button className="btn btn-primary" onClick={clear}>Clear</button>
          <Link href="/" className="btn btn-danger" style={{ textDecoration: "none" }}>Close</Link>
        </div>
      </div>
      <div className="lg-form-box">
        <DataTable
          rows={data}
          columns={cols}
          rowKey={(r: LwfRow) => r.id}
          onRowClick={onRowClick}
          selectedKey={selected?.id}
        />
      </div>
    </div>
  );
}
