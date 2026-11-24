"use client";
import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { getJSON, mk, upload } from "@/lib/api/legacy-fetch";
import ExportButtons from "@/components/ExportButtons";

// Legacy Employee_salary_details.aspx ("Employee Salary Details" / Employee Compliance), 1:1.
//
// Top bar:  Select Month (ONE month-year picker, defaults to the current month like
//           d.getCurrentMonthYear()) -> Client -> State -> Branch -> Employee Type -> Employee.
// Tabs:     Compliances -> [Employee Details | Allowance | Deduction/Fine].
//           ESIC Flag "No" reveals Group Insurance / Policy Id / Start / End date (display_panel()).
//           Payment Status Unhold/Hold; Remark appears only for Hold.
// Grid:     employee list under the filters (show_gridview) with Search; click a row to load it
//           for Update (Reason for Updation panel + Update button replace Save).
// Messages: exact legacy alerts. Save/Update write the legacy employee master (statutory ids, flags,
//           allowances, bank block) and pay_pro_master; Export / Import (bottom) are the legacy bank-details
//           Excel export / import.
const B = "/api/hr/employee-compliance";
const EMP_TYPES = ["Select", "Permanent", "Reliever", "Staff", "Temporary", "Left"];
const FINE_DESCS = ["Select", "Uniform/Shoes/Id", "Salary Deduction", "Attendance Penalty", "Other"];
const FLAGS = ["Select", "Yes", "No"];

type Fine = { id: number; fine: string; fine_description: string; description_list: string; date: string; month: number; year: number };
interface ClientOpt { client_code: string; client_name: string; }
interface UnitOpt { unit_code: string; unit_name: string; state_name?: string; unit_city?: string; unit_add1?: string; }
interface EmpOpt { emp_code: string; emp_name: string; employee_type?: string; left_date?: string | null; }
interface GridRow { emp_code: string; emp_name: string; client_code: string; client_name: string; state: string; unit_code: string; unit_name: string; employee_type: string; }

// legacy key filters
const money = (v: string) => v.replace(/[^0-9.]/g, "");
const digits = (v: string) => v.replace(/[^0-9]/g, "");
const addr = (v: string) => v.replace(/[^A-Za-z0-9 &,\-./:;=\\]/g, "");
const alphaSp = (v: string) => v.replace(/[^A-Za-z ,.]/g, "");

const curMonth = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
// <input type="month"> value (YYYY-MM) -> legacy "MM/YYYY"
const toMMYYYY = (ym: string) => (ym && ym.includes("-") ? `${ym.slice(5, 7)}/${ym.slice(0, 4)}` : "");

const CEMPTY = {
  uan_number: "", new_pan: "", bank_account: "", esic_number: "", esic_flag: "Select", pf_number: "", pf_flag: "Select",
  bank_holder_name: "", ifsc_code: "", bank_name: "", bank_branch: "",
  group_insurance: "", esic_policy_id: "", policy_start_date: "", policy_end_date: "",
  cca: "0", cca_desc: "0", advance_payment: "0", advance_desc: "0",
  gratuity: "0", special_allow: "0", conveyance_amount: "0",
};

async function getList<T>(path: string): Promise<T[]> {
  const d = await getJSON<{ results: T[] }>(path);
  return d?.results ?? [];
}
// DRF errors arrive as ["msg"] or {detail: "msg"}.
const errText = (b: unknown): string => {
  if (Array.isArray(b)) return String(b[0] ?? "");
  if (b && typeof b === "object") {
    const o = b as Record<string, unknown>;
    if (typeof o.detail === "string") return o.detail;
    const first = Object.values(o)[0];
    if (Array.isArray(first)) return String(first[0] ?? "");
    if (typeof first === "string") return first;
  }
  return "";
};

export default function EmployeeCompliancePage() {
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [emps, setEmps] = useState<EmpOpt[]>([]);
  const [month, setMonth] = useState(curMonth());
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [unit, setUnit] = useState("Select");
  const [empType, setEmpType] = useState("Select");
  const [emp, setEmp] = useState("Select");
  const [c, setC] = useState({ ...CEMPTY });
  const [payStatus, setPayStatus] = useState("0");
  const [remark, setRemark] = useState("");
  const [fines, setFines] = useState<Fine[]>([]);
  const [fine, setFine] = useState("0");
  const [dlist, setDlist] = useState("Select");
  const [fdesc, setFdesc] = useState("");
  const [fmonth, setFmonth] = useState("");
  const [grid, setGrid] = useState<GridRow[]>([]);
  const [gridSearch, setGridSearch] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [tab, setTab] = useState("Employee Details");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setC((p) => ({ ...p, [k]: v }));
  const importRef = useRef<HTMLInputElement>(null);
  const bankRef = useRef<HTMLInputElement>(null);
  const focus = (id: string) => document.getElementById(id)?.focus?.();

  const TABS = ["Employee Details", "Allowance", "Deduction/Fine"];

  // ------------------------------------------------------------------ loaders
  useEffect(() => {
    getList<ClientOpt>("/api/masters/clients/?page_size=all").then((rs) => setClients(rs));
  }, []);

  const loadStates = async (clientCode: string) => {
    if (!clientCode || clientCode === "Select") { setStates([]); return; }
    const d = await getJSON<{ states: string[] }>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(clientCode)}`);
    setStates(d?.states ?? []);
  };
  const loadUnits = async (clientCode: string, st: string) => {
    if (!clientCode || clientCode === "Select" || !st || st === "Select") { setUnits([]); return; }
    const d = await getJSON<{ units: UnitOpt[] }>(
      `/api/masters/units/lookup/?client_code=${encodeURIComponent(clientCode)}&state=${encodeURIComponent(st)}`);
    setUnits(d?.units ?? []);
  };
  // legacy ddlunitselect_SelectedIndexChanged: Left -> left_date set, otherwise type match and still on roll
  const loadEmps = async (unitCode: string, type: string) => {
    if (!unitCode || unitCode === "Select" || !type || type === "Select") { setEmps([]); return; }
    const d = await getJSON<{ employees: EmpOpt[] }>(`/api/hr/employees/lookup/?unit_code=${encodeURIComponent(unitCode)}`);
    const all = d?.employees ?? [];
    setEmps(all.filter((e) => (type === "Left" ? !!e.left_date : e.employee_type === type && !e.left_date)));
  };
  const loadGrid = async (cl: string, st: string, un: string, ty: string, em: string) => {
    const qs = new URLSearchParams();
    if (cl && cl !== "Select") qs.set("client_code", cl);
    if (st && st !== "Select") qs.set("state", st);
    if (un && un !== "Select") qs.set("unit_code", un);
    if (ty && ty !== "Select") qs.set("employee_type", ty);
    if (em && em !== "Select") qs.set("emp_code", em);
    const d = await getJSON<{ results: GridRow[] }>(`${B}/grid/?${qs.toString()}`);
    setGrid(d?.results ?? []);
  };
  const loadFines = async (code: string) => {
    const f = await getJSON<{ results: Fine[] }>(`${B}/list_fines/?emp_code=${encodeURIComponent(code)}`);
    setFines(f?.results ?? []);
  };

  // legacy ddlemployee_SelectedIndexChanged
  const pickEmp = async (code: string): Promise<void> => {
    setEmp(code);
    if (!code || code === "Select") { textClear(false); setFines([]); return; }
    const d = await getJSON<Record<string, unknown>>(`${B}/detail/?emp_code=${encodeURIComponent(code)}`);
    if (d) {
      const nc = { ...CEMPTY } as Record<string, string>;
      for (const k of Object.keys(nc)) { const v = d[k]; if (v !== undefined && v !== null) nc[k] = String(v); }
      if (!FLAGS.includes(nc.esic_flag)) nc.esic_flag = "Select";
      if (!FLAGS.includes(nc.pf_flag)) nc.pf_flag = "Select";
      setC(nc as typeof CEMPTY);
      setPayStatus(String(d.payment_status ?? "0"));
      setRemark(String(d.remark ?? ""));
      setReasons(Array.isArray(d.reasons) ? (d.reasons as string[]) : []);
    }
    await loadFines(code);
  };

  // legacy text_clear(): clears the data boxes, keeps Client / State / Branch / Type
  const textClear = (resetEmp = true) => {
    setC({ ...CEMPTY, group_insurance: "", esic_policy_id: "", policy_start_date: "", policy_end_date: "" });
    setPayStatus("0"); setRemark("");
    setFine("0"); setDlist("Select"); setFdesc(""); setFmonth("");
    if (resetEmp) setEmp("Select");
  };

  // ------------------------------------------------------------------ cascade handlers
  const onClient = async (v: string) => {
    setClient(v); setState("Select"); setUnit("Select"); setEmp("Select"); setEmps([]); setUnits([]); setFines([]);
    textClear(false);
    await loadStates(v);
    loadGrid(v, "Select", "Select", empType, "Select");
  };
  const onState = async (v: string) => {
    setState(v); setUnit("Select"); setEmp("Select"); setEmps([]); setFines([]);
    textClear(false);
    await loadUnits(client, v);
    loadGrid(client, v, "Select", empType, "Select");
  };
  const onUnit = async (v: string) => {
    setUnit(v); setEmp("Select"); setFines([]);
    textClear(false);
    await loadEmps(v, empType);
    loadGrid(client, state, v, empType, "Select");
  };
  const onType = async (v: string) => {
    setEmpType(v); setEmp("Select"); setFines([]);
    textClear(false);
    await loadEmps(unit, v);
    loadGrid(client, state, unit, v, "Select");
  };
  const onEmp = async (v: string) => {
    await pickEmp(v);
    loadGrid(client, state, unit, empType, v);
  };

  // legacy GridView_pageload_SelectedIndexChanged: row click loads the employee for Update
  const selectRow = async (r: GridRow) => {
    setEditMode(true);
    setReason("");
    setClient(r.client_code);
    const sd = await getJSON<{ states: string[] }>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(r.client_code)}`);
    setStates(sd?.states ?? []);
    setState(r.state || "Select");
    const ud = await getJSON<{ units: UnitOpt[] }>(
      `/api/masters/units/lookup/?client_code=${encodeURIComponent(r.client_code)}&state=${encodeURIComponent(r.state)}`);
    setUnits(ud?.units ?? []);
    setUnit(r.unit_code);
    setEmpType(r.employee_type || "Select");
    const ed = await getJSON<{ employees: EmpOpt[] }>(`/api/hr/employees/lookup/?unit_code=${encodeURIComponent(r.unit_code)}`);
    const t = r.employee_type;
    setEmps((ed?.employees ?? []).filter((e) => (t === "Left" ? !!e.left_date : e.employee_type === t && !e.left_date)));
    await pickEmp(r.emp_code);
  };

  // ------------------------------------------------------------------ validations (legacy alerts, same order)
  const chkMonth = (): boolean => {
    if (!client || client === "Select") { alert("Please Select Client "); focus("ec_client"); return false; }
    if (!state || state === "Select") { alert("Please Select State "); focus("ec_state"); return false; }
    if (!unit || unit === "Select") { alert("Please Select Branch "); focus("ec_unit"); return false; }
    if (!empType || empType === "Select") { alert("Please Select Employee Type "); focus("ec_type"); return false; }
    if (!month) { alert("Please Select month & year "); focus("ec_month"); return false; }
    if (!emp || emp === "Select") { alert("Please Select Employee "); focus("ec_emp"); return false; }
    return true;
  };

  const payload = () => ({
    emp_code: emp, employee_type: empType, ...c,
    esic_flag: c.esic_flag === "Select" ? "" : c.esic_flag,
    pf_flag: c.pf_flag === "Select" ? "" : c.pf_flag,
    payment_status: payStatus, remark, month: toMMYYYY(month),
  });

  const onSave = async () => {
    if (!chkMonth()) return;
    if (payStatus === "1" && !remark.trim()) { alert("Please Enter Remark"); focus("ec_remark"); return; }
    setBusy(true);
    try {
      const r = await mk(`${B}/save_compliance/`, payload());
      const b = await r.json().catch(() => ({}));
      if (r.ok) { alert("Record Save successfully!!"); textClear(true); setReasons([]); loadGrid(client, state, unit, empType, "Select"); }
      else alert(errText(b) || "Record Save failed");
    } finally { setBusy(false); }
  };

  const onUpdate = async () => {
    if (!reason.trim()) { alert("Please Specify Reason For Updation !!!"); focus("ec_reason"); return; }
    if (payStatus === "1" && !remark.trim()) { alert("Please Enter Remark"); focus("ec_remark"); return; }
    setBusy(true);
    try {
      const r = await mk(`${B}/update_compliance/`, { ...payload(), reason });
      const b = await r.json().catch(() => ({}));
      if (r.ok) {
        alert("Record Updated Sucessfully");
        textClear(true); setReasons([]); setReason(""); setEditMode(false);
        setClient("Select"); setState("Select"); setUnit("Select"); setEmpType("Select"); setEmp("Select");
        setStates([]); setUnits([]); setEmps([]); setFines([]);
        loadGrid("Select", "Select", "Select", "Select", "Select");
      } else alert(errText(b) || "Record Update failed");
    } finally { setBusy(false); }
  };

  // legacy deduction() + add_lnk_file_Click
  const addFine = async () => {
    if (!fine.trim() || fine.trim() === "0") { alert("Please Enter Fine"); focus("ec_fine"); return; }
    if (!dlist || dlist === "Select") { alert("Please Select Discription list "); focus("ec_dlist"); return; }
    if (dlist === "Other" && (!fdesc.trim() || fdesc.trim() === "0")) { alert("Please Enter Fine Description"); focus("ec_fdesc"); return; }
    if (!fmonth) { alert("Please Enter Date"); focus("ec_fmonth"); return; }
    if (!chkMonth()) return;
    const mm = Number(fmonth.slice(5, 7)), yy = Number(fmonth.slice(0, 4));
    const r = await mk(`${B}/add_fine/`, {
      emp_code: emp, client_code: client, unit_code: unit, state, employee_type: empType, fine,
      description_list: dlist, fine_description: fdesc, month: mm, year: yy, date: toMMYYYY(fmonth),
    });
    const b = await r.json().catch(() => ({}));
    if (r.ok) alert(b.status ?? " Employee Files Successfully Added... !!!");
    else alert(errText(b) || " Employee Files Addition Failed... !!!");
    setFine(""); setFdesc(""); setFmonth(""); setDlist("Select");
    loadFines(emp);
  };
  const delFine = async (id: number) => {
    if (!confirm("Are you Sure You Want to Delete Record")) return;
    const r = await mk(`${B}/delete_fine/`, { id });
    if (!r.ok) { const b = await r.json().catch(() => ({})); alert(errText(b) || "Record not Available"); return; }
    loadFines(emp);
  };

  // Excel (HTML-table .xls) download of {filename, columns, rows} like the legacy Repeater export
  const downloadXls = (d: { filename: string; columns: string[]; rows: unknown[][] }) => {
    const esc = (x: unknown) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const html = `<table border=1><tr>${d.columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr>` +
      d.rows.map((r) => `<tr>${r.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`).join("") + "</table>";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" }));
    a.download = d.filename; document.body.appendChild(a); a.click(); a.remove();
  };
  // legacy btn_export_Click: bank account / IFSC / holder of every active employee
  const exportBank = async () => {
    const d = await getJSON<{ filename: string; columns: string[]; rows: unknown[][] }>(`${B}/bank_export/`);
    if (!d) { alert("No Matching Records Found."); return; }
    downloadXls(d);
  };
  // legacy btn_import_Click: update bank details from the exported sheet; rejected rows are downloaded back
  const onImportBank = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const fd = new FormData(); fd.append("file", file);
    const r = await upload(`${B}/bank_import/`, fd);
    const b = await r.json().catch(() => ({}));
    if (!r.ok) { alert(errText(b) || "Import failed"); return; }
    if (b.rows && b.rows.length) downloadXls(b);
    alert(`Bank details updated for ${b.updated} employee(s)${b.rejected_count ? `, ${b.rejected_count} rejected (see downloaded file)` : ""}.`);
  };

  // Real client-side CSV export of the fines grid (DataTables export on the legacy grid).
  const exportFines = () => {
    const cols: (keyof Fine)[] = ["id", "fine", "fine_description", "description_list", "date", "month", "year"];
    const head = ["ID", "Fine", "Fine Description", "Description", "Date", "Month", "Year"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [head.join(","), ...fines.map((f) => cols.map((k) => esc(f[k])).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url; a.download = `employee_compliance_${emp || "fines"}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  // Real CSV import (deduction upload): each row is created through the real add_fine API.
  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!emp || emp === "Select") { alert("Please Select Employee "); e.target.value = ""; return; }
      const text = await file.text();
      const lines = text.split("\n").map((l) => l.replace(/\r/g, "").trim()).filter(Boolean);
      let ok = 0, fail = 0;
      for (const line of lines) {
        const cols = line.split(",").map((s) => s.replace(/^"|"$/g, "").trim());
        if (cols[0].toLowerCase() === "fine" || cols[0].toLowerCase() === "id") continue;   // header
        const [fineAmt, descList, fineDesc, mon, yr] = cols;
        if (!fineAmt || !mon || !yr) { fail++; continue; }
        const r = await mk(`${B}/add_fine/`, { emp_code: emp, client_code: client, unit_code: unit, state, employee_type: empType, fine: fineAmt, description_list: descList || "Select", fine_description: fineDesc || "", month: mon, year: yr, date: `${String(mon).padStart(2, "0")}/${yr}` });
        if (r.ok) ok++; else fail++;
      }
      alert(`Import done: ${ok} added${fail ? `, ${fail} failed` : ""}.`);
      loadFines(emp);
    }
    e.target.value = "";
  };

  const shownGrid = grid.filter((r) => {
    const q = gridSearch.trim().toLowerCase();
    if (!q) return true;
    const hay = [r.client_name, r.state, r.unit_name, r.employee_type, r.emp_name, r.emp_code].join(" ").toLowerCase();
    return q.split(" ").every((w) => hay.includes(w));
  });

  const unitLabel = (u: UnitOpt) => [u.unit_city, u.unit_add1, u.unit_name].filter(Boolean).join("_") || u.unit_code;
  const esicNo = c.esic_flag === "No";

  return (
    <div className="container-fluid">
      <div className="panel panel-primary">
        <div className="panel-heading">
          <div className="row">
            <div className="col-sm-1"></div>
            <div className="col-sm-9">
              <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase"><b>Employee Salary Details</b></div>
            </div>
            <div className="col-sm-2 text-right">
              <a href="#" onClick={(e) => { e.preventDefault(); window.open("html/Employee_salary_details.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }} style={{ fontSize: "10px" }}>
                <img src="/Images/help_ico.png" alt="Help" width={20} height={20} title="Help" />
              </a>
            </div>
          </div>
        </div>
        {editMode && (
          <div className="panel panel-primary" style={{ backgroundColor: "#f3f1fe", borderRadius: 10, border: "1px solid white" }}>
            <div className="panel-heading">
              <div style={{ color: "white", fontWeight: "bold", fontSize: 15 }}>Reason for Updation</div>
            </div>
            <div className="panel-body container">
              <div className="row">
                <select className="form-control" multiple size={9} style={{ width: "100%" }} disabled>
                  {reasons.map((h, i) => <option key={i}>{`${i + 1}.  ${h}`}</option>)}
                </select>
                <textarea id="ec_reason" className="form-control" rows={4} cols={50} placeholder="Enter Reason for Updation"
                  value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        <div className="panel-body">
          <div className="container-fluid" style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: 10, padding: 25, marginBottom: 20, marginTop: 20 }}>
            <div className="row">
              <div className="col-sm-2 col-xs-12">
                <b>Select Month :</b><span className="text-red">*</span>
                <input id="ec_month" type="month" className="form-control date-picker" value={month} max={curMonth()}
                  onChange={(e) => setMonth(e.target.value)} />
              </div>
              <div className="col-sm-2 col-xs-12 text-left">
                <b>Client Name : </b>
                <select id="ec_client" className="form-control" value={client} onChange={(e) => onClient(e.target.value)}>
                  <option value="Select">Select</option>
                  {clients.map((x) => <option key={x.client_code} value={x.client_code}>{x.client_name}</option>)}
                </select>
              </div>
              <div className="col-sm-2 col-xs-12 text-left">
                <b>State Name :</b>
                <select id="ec_state" className="form-control text_box" value={state} onChange={(e) => onState(e.target.value)}>
                  <option value="Select">Select</option>
                  {states.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-sm-2 col-xs-12 text-left">
                <b>Branch Name : </b>
                <select id="ec_unit" className="form-control" value={unit} onChange={(e) => onUnit(e.target.value)}>
                  <option value="Select">Select</option>
                  {units.map((x) => <option key={x.unit_code} value={x.unit_code}>{unitLabel(x)}</option>)}
                </select>
              </div>
              <div className="col-sm-2 col-xs-12 text-left">
                <b>Employee Type :</b>
                <select id="ec_type" className="form-control" value={empType} onChange={(e) => onType(e.target.value)}>
                  {EMP_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
              </div>
              <div className="col-sm-2 col-xs-12 text-left">
                <b>Employee Name :</b>
                <select id="ec_emp" className="form-control" value={emp} onChange={(e) => onEmp(e.target.value)}>
                  <option value="Select">Select</option>
                  {emps.map((x) => <option key={x.emp_code} value={x.emp_code}>{x.employee_type === "Reliever" ? `${x.emp_name}-Reliever` : x.emp_name}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div id="tabs" style={{ background: "#f3f1fe", padding: 20, border: "1px solid #e2e2dd", margin: 15, borderRadius: 10 }}>
            <div className="em-tabs"><div className="em-tab active">Compliances</div></div>
            <div style={{ background: "white", padding: 20, border: "1px solid #e2e2dd", margin: "0 0 15px", borderRadius: 10 }}>
              <div className="em-tabs">
                {TABS.map((t) => <div key={t} className={`em-tab ${tab === t ? "active" : ""}`} onClick={() => setTab(t)}><b>{t}</b></div>)}
              </div>

              {tab === "Employee Details" && (
                <div className="em-tabpane">
                  <div className="row">
                    <div className="col-sm-2 col-xs-12"><b>Employee Code :</b>
                      <input className="form-control" maxLength={100} value={emp === "Select" ? "" : emp} readOnly onChange={() => { }} /></div>
                    <div className="col-sm-2 col-xs-12"><b>UAN Number :</b>
                      <input className="form-control" maxLength={100} value={c.uan_number} onChange={(e) => set("uan_number", addr(e.target.value))} /></div>
                    <div className="col-sm-2 col-xs-12"><b>PAN Number : </b>
                      <input className="form-control" maxLength={10} value={c.new_pan} onChange={(e) => set("new_pan", e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())} /></div>
                    <div className="col-sm-2 col-xs-12"><b>ESIC Number : </b>
                      <input className="form-control" maxLength={17} value={c.esic_number} onChange={(e) => set("esic_number", digits(e.target.value))} /></div>
                    <div className="col-sm-2 col-xs-12 text-left"><b>ESIC Flag :</b>
                      <select className="form-control" value={c.esic_flag} onChange={(e) => set("esic_flag", e.target.value)}>
                        {FLAGS.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select></div>
                    <div className="col-sm-2 col-xs-12"><b>PF Number :</b>
                      <input className="form-control" value={c.pf_number} onChange={(e) => set("pf_number", addr(e.target.value))} /></div>
                  </div>
                  <div className="row">
                    <div className="col-sm-2 col-xs-12 text-left"><b>PF Flag :</b>
                      <select className="form-control" value={c.pf_flag} onChange={(e) => set("pf_flag", e.target.value)}>
                        {FLAGS.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select></div>
                    <div className="col-sm-2 col-xs-12"><b>Bank Account Number :</b>
                      <input className="form-control" value={c.bank_account} onChange={(e) => set("bank_account", digits(e.target.value))} /></div>
                    <div className="col-sm-2 col-xs-12"><b>Account Holder Name : </b>
                      <input className="form-control" value={c.bank_holder_name} onChange={(e) => set("bank_holder_name", alphaSp(e.target.value))} /></div>
                    <div className="col-sm-2 col-xs-12"><b>Bank IFSC Code : </b>
                      <input className="form-control" maxLength={11} value={c.ifsc_code} onChange={(e) => set("ifsc_code", e.target.value.replace(/[^A-Za-z0-9 ]/g, ""))} /></div>
                    <div className="col-sm-2 col-xs-12"><b>Bank Name :</b>
                      <input className="form-control text_box" maxLength={50} value={c.bank_name} onChange={(e) => set("bank_name", alphaSp(e.target.value))} /></div>
                    <div className="col-sm-2 col-xs-12"><b>Branch Location Name :</b>
                      <input className="form-control text_box" maxLength={200} value={c.bank_branch} onChange={(e) => set("bank_branch", addr(e.target.value))} /></div>
                  </div>
                  <div className="row">
                    {esicNo && (
                      <>
                        <div className="col-sm-2 col-xs-12"><b>Group Insurance :</b>
                          <input className="form-control text_box" maxLength={5} value={c.group_insurance} onChange={(e) => set("group_insurance", money(e.target.value))} /></div>
                        <div className="col-sm-2 col-xs-12"><b>Policy Id:</b>
                          <input className="form-control text_box" maxLength={5} value={c.esic_policy_id} onChange={(e) => set("esic_policy_id", money(e.target.value))} /></div>
                        <div className="col-sm-2 col-xs-12"><b>Start Date</b>
                          <input type="date" className="form-control" value={c.policy_start_date} onChange={(e) => set("policy_start_date", e.target.value)} /></div>
                        <div className="col-sm-2 col-xs-12"><b>End Date</b>
                          <input type="date" className="form-control" min={c.policy_start_date} value={c.policy_end_date} onChange={(e) => set("policy_end_date", e.target.value)} /></div>
                      </>
                    )}
                    <div className="col-sm-2 col-xs-12 text-left"><b>Payment Status :</b>
                      <select className="form-control" value={payStatus} onChange={(e) => setPayStatus(e.target.value)}>
                        <option value="0">Unhold</option>
                        <option value="1">Hold</option>
                      </select></div>
                    {payStatus === "1" && (
                      <div className="col-sm-2 col-xs-12"><b>Remark</b>
                        <textarea id="ec_remark" className="form-control" placeholder="Remark" value={remark} onChange={(e) => setRemark(e.target.value)} /></div>
                    )}
                  </div>
                </div>
              )}

              {tab === "Allowance" && (
                <div className="em-tabpane">
                  <div className="row">
                    <div className="col-sm-2 col-xs-12"><b>CCA :</b>
                      <input className="form-control text_box" maxLength={10} value={c.cca} onChange={(e) => set("cca", money(e.target.value))} /></div>
                    <div className="col-sm-2 col-xs-12"><b>CCA Description :</b>
                      <input className="form-control text_box" value={c.cca_desc} onChange={(e) => set("cca_desc", addr(e.target.value))} /></div>
                    <div className="col-sm-2 col-xs-12"><b>Advance :</b>
                      <input className="form-control" value={c.advance_payment} onChange={(e) => set("advance_payment", money(e.target.value))} /></div>
                    <div className="col-sm-2 col-xs-12"><b>Advance Description :</b>
                      <input className="form-control text_box" value={c.advance_desc} onChange={(e) => set("advance_desc", addr(e.target.value))} /></div>
                  </div>
                  <div className="row">
                    <div className="col-sm-2 col-xs-12"><b>Gratuity:</b>
                      <input className="form-control text_box" maxLength={5} value={c.gratuity} onChange={(e) => set("gratuity", money(e.target.value))} /></div>
                    <div className="col-sm-2 col-xs-12"><b>Special Allowance :</b>
                      <input className="form-control text_box" maxLength={5} value={c.special_allow} onChange={(e) => set("special_allow", money(e.target.value))} /></div>
                    <div className="col-sm-2 col-xs-12"><b>Conveyance Amount :</b>
                      <input className="form-control" value={c.conveyance_amount} onChange={(e) => set("conveyance_amount", money(e.target.value))} /></div>
                  </div>
                </div>
              )}

              {tab === "Deduction/Fine" && (
                <div className="em-tabpane">
                  <div className="row">
                    <div className="col-sm-2 col-xs-12"><b>Fine :</b>
                      <input id="ec_fine" className="form-control text_box" maxLength={7} value={fine} onChange={(e) => setFine(money(e.target.value))} /></div>
                    <div className="col-md-2 col-xs-12"><b>Description :</b> <span style={{ color: "red" }}>*</span>
                      <select id="ec_dlist" className="form-control text_box" value={dlist}
                        onChange={(e) => { setDlist(e.target.value); if (e.target.value !== "Other") setFdesc(""); }}>
                        {FINE_DESCS.map((x) => <option key={x} value={x}>{x}</option>)}
                      </select></div>
                    <div className="col-sm-2 col-xs-12"><b>Fine Description :</b>
                      <input id="ec_fdesc" className="form-control text_box" disabled={dlist !== "Other"} value={fdesc} onChange={(e) => setFdesc(addr(e.target.value))} /></div>
                    <div className="col-sm-2 col-xs-12"><b>Month :</b>
                      <input id="ec_fmonth" type="month" className="form-control date-picker" value={fmonth} max={curMonth()} onChange={(e) => setFmonth(e.target.value)} /></div>
                    <div className="col-sm-2 col-xs-12">
                      <br />
                      <button title="Add Item" onClick={addFine} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      <b>File Upload :</b>
                      <input type="file" accept=".csv" onChange={onImportFile} />
                      <span style={{ color: "red", fontSize: 8, fontWeight: "bold" }}>Only CSV</span>
                    </div>
                  </div>
                  <ExportButtons
                    filename={`fines_${emp || "all"}`}
                    columns={[
                      { key: "id", label: "id" },
                      { key: "fine", label: "fine" },
                      { key: "fine_description", label: "fine_description" },
                      { key: "description_list", label: "description_list" },
                      { key: "date", label: "date" },
                    ]}
                    rows={fines}
                  />
                  <div className="dt-scroll">
                    <table className="table">
                      <thead>
                        <tr className="text-uppercase" style={{ backgroundColor: "#006699", color: "White", fontWeight: "bold" }}>
                          <th></th><th>Sr No.</th><th>Fine</th><th>Fine Description</th><th>Fine Description list </th><th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fines.map((x, i) => (
                          <tr key={x.id}>
                            <td><button className="btn btn-danger btn-xs" title="Delete" onClick={() => delFine(x.id)}>✕</button></td>
                            <td>{i + 1}</td><td>{x.fine}</td><td>{x.fine_description}</td><td>{x.description_list}</td><td>{x.date}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            <div className="row text-center">
              {!editMode && <button className="btn btn-primary" disabled={busy} onClick={onSave}> Save </button>}{" "}
              {editMode && <button className="btn btn-primary" disabled={busy} onClick={onUpdate}> Update </button>}{" "}
              <button className="btn btn-primary" onClick={exportBank}> Export </button>{" "}
              <button className="btn btn-primary" onClick={() => bankRef.current?.click()}> Import </button>{" "}
              <input ref={bankRef} type="file" accept=".xls,.xlsx,.csv" style={{ display: "none" }} onChange={onImportBank} />
              <Link href="/Home" className="btn btn-danger" style={{ textDecoration: "none" }}>Close</Link>
            </div>

            <div className="container" style={{ width: "100%" }}>
              <div className="row">
                <div className="col-sm-10 col-xs-12"></div>
                <div className="col-sm-2 col-xs-12">
                  Search :
                  <input className="form-control" value={gridSearch} onChange={(e) => setGridSearch(e.target.value)} />
                </div>
              </div>
              <div style={{ overflowY: "auto", maxHeight: 250, overflowX: "hidden" }}>
                <table className="table">
                  <thead>
                    <tr className="text-uppercase" style={{ backgroundColor: "#006699", color: "White", fontWeight: "bold" }}>
                      <th>Sr No.</th><th>Client name</th><th>state name</th><th>unit name</th><th>Employee type</th><th>Employee Name</th><th>Employee Code</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shownGrid.map((r, i) => (
                      <tr key={r.emp_code} style={{ cursor: "pointer" }} onClick={() => selectRow(r)}>
                        <td>{i + 1}</td><td>{r.client_name}</td><td>{r.state}</td><td>{r.unit_name}</td>
                        <td>{r.employee_type}</td><td>{r.emp_name}</td><td>{r.emp_code}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
