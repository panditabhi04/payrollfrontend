"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { getJSONStrict, postJSON, responseMessage } from "@/lib/api/legacy-fetch";

/**
 * New Employee Recruitment (legacy new_employee_requirnment.aspx): the requirement listing of
 * pay_new_employee_requirement (Client / Unit / Supervisor / New Employee Name / Designation), a Search box,
 * row select -> Employee Details / Bank Details / Document Details tabs, and the page's one action
 * "MoveToEmployeeMaster". API: /api/hr/legacy-requirements/.
 */
const API = "/api/hr/legacy-requirements/";
const EMPLOYEE_TYPES = [
  { v: "Permanent", t: "Permanent" }, { v: "PermanentReliever", t: "Permanent Reliever" },
  { v: "Reliever", t: "Reliever" }, { v: "Staff", t: "Staff" }, { v: "Temporary", t: "Temporary" },
  { v: "RM", t: "Repair & Maintenance" },
];

type Row = { id: number; client_name: string; unit_name: string; supervisor_name: string; new_employee_name: string; grade: string; moveto_employeemaster: string };
type Detail = Record<string, string | number>;
const TABS = ["Employee Details", "Bank Details", "Document Details"];

export default function LegacyRequirements() {
  const [rows, setRows] = useState<Row[]>([]);
  const [search, setSearch] = useState("");
  const [d, setD] = useState<Detail | null>(null);
  const [etype, setEtype] = useState("Select");
  const [tab, setTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [empCode, setEmpCode] = useState("");
  const [login, setLogin] = useState<{ id: string; token: string } | null>(null);

  const load = async () => {
    try { const r = await getJSONStrict<{ results: Row[] }>(API); setRows(r.results || []); }
    catch (e: any) { alert(e.message || "Record Display Failed...!"); }
  };
  useEffect(() => { load(); }, []);

  const pick = async (r: Row) => {
    try {
      const det = await getJSONStrict<Detail>(`${API}${r.id}/`);
      setD(det); setEtype("Select"); setTab(0); setLogin(null);
      const c = await getJSONStrict<{ emp_code: string }>("/api/hr/recruitments/next-code/");
      setEmpCode(c.emp_code || "");
    } catch (e: any) { alert(e.message || "Record not Available"); }
  };

  // legacy Req_validation() alert order (the remaining fields come from the stored requirement row)
  const move = async () => {
    if (!d) return;
    if (etype === "Select") { alert("Please Select Employee Type"); return; }
    setBusy(true);
    try {
      const r = await postJSON(`${API}${d.id}/move-to-master/`, { employee_type: etype, emp_code: empCode });
      if (!r.ok) { alert(await responseMessage(r, "Employee Added Fail !!!")); return; }
      const body = await r.json().catch(() => ({} as any));
      if (body?.login_setup_token) setLogin({ id: body.login_id, token: body.login_setup_token });
      alert("Employee Added Successfully !!!");
      setD(null); load();
    } finally { setBusy(false); }
  };

  const q = search.trim().toLowerCase();
  const shown = rows.filter((r) => !q || [r.client_name, r.unit_name, r.supervisor_name, r.new_employee_name, r.grade]
    .some((x) => (x || "").toLowerCase().includes(q)));
  const f = (k: string) => String(d?.[k] ?? "");
  const ro = (label: string, v: string) => (
    <div className="col-sm-3 col-xs-12 text-left" style={{ marginBottom: 10 }}>
      {label} :<span style={{ color: "red" }}> *</span>
      <input className="form-control" value={v} readOnly />
    </div>
  );
  const doc = (label: string, name: string) => (
    <div className="col-sm-3 col-xs-12 text-left" style={{ marginBottom: 10 }}>
      {label} :
      <div className="form-control" style={{ height: "auto", minHeight: 34 }}>{name ? name : "Not uploaded"}</div>
    </div>
  );

  return (
    <div className="container-fluid" style={{ maxWidth: "99%", margin: "0 auto", padding: 20 }}>
      {login && (
        <div className="em-note" style={{ margin: "8px 0" }}>
          Login <b>{login.id}</b> created with no password. One-time setup token (give it to the employee to set a password at{" "}
          <code>/password-setup</code>): <code>{login.token}</code>{" "}
          <button className="btn btn-default btn-xs" onClick={() => setLogin(null)}>Dismiss</button>
        </div>
      )}
      <div className="panel panel-primary">
        <div className="panel-heading text-center text-uppercase"><b>New Employee Recruitment</b></div>
        <div className="panel-body">
          <div style={{ color: "#555", marginBottom: 6 }}><b>New Employee Recruitment Details</b></div>
          <div className="row">
            <div className="col-sm-10 col-xs-12" />
            <div className="col-sm-2 col-xs-12">Search :
              <input className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
          <br />
          <table className="table table-bordered" style={{ width: "100%", background: "#fff" }}>
            <thead style={{ background: "#424D7A", color: "#fff" }}>
              <tr><th>Client Name</th><th>Unit Name</th><th>Supervisor Name</th><th>New Employee Name</th><th>Designation</th></tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => pick(r)}>
                  <td>{r.client_name}</td><td>{r.unit_name}</td><td>{r.supervisor_name}</td><td>{r.new_employee_name}</td><td>{r.grade}</td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center" }}>No records found.</td></tr>}
            </tbody>
          </table>

          {d && (
            <div style={{ marginTop: 16 }}>
              <ul className="nav nav-tabs">
                {TABS.map((t, i) => (
                  <li key={t} className={tab === i ? "active" : ""}>
                    <a href="#" onClick={(e) => { e.preventDefault(); setTab(i); }}>{t}</a>
                  </li>
                ))}
              </ul>
              <br />
              {tab === 0 && (
                <div className="row">
                  <div className="col-sm-3 col-xs-12 text-left" style={{ marginBottom: 10 }}>
                    Employee Type :<span style={{ color: "red" }}> *</span>
                    <select className="form-control" value={etype} onChange={(e) => setEtype(e.target.value)}>
                      <option value="Select">Select</option>
                      {EMPLOYEE_TYPES.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                    </select>
                  </div>
                  {ro("Client Name", f("client_name"))}
                  {ro("Branch Name", f("unit_name"))}
                  {ro("Employee Code", empCode)}
                  {ro("Designation", f("grade"))}
                  {ro("Supervisor Name", f("supervisor_name"))}
                  {ro("New Employee Name", f("new_employee_name"))}
                  {ro("Father/Husband Name", f("father_name"))}
                  {ro("Gender", f("gender") === "M" ? "Male" : "Female")}
                  {ro("Date Of Birth", f("dob"))}
                  {ro("Date Of Joining", f("doj"))}
                  {ro("Blood Group", f("blood_group"))}
                  {ro("Working Hours", f("working_hours"))}
                  {ro("Mobile No.", f("mobile_no"))}
                  {ro("Employee Address", f("address"))}
                </div>
              )}
              {tab === 1 && (
                <div className="row">
                  {ro("Branch Name", f("branch_name"))}
                  {ro("Account No.", f("account_no"))}
                  {ro("IFSC Code", f("ifsc_code"))}
                  {ro("Bank Holder Name", f("bank_holder_name"))}
                  {ro("Aadhar No.", f("adhar_no"))}
                </div>
              )}
              {tab === 2 && (
                <div className="row">
                  {doc("Aadhar Card", f("adharcard_imgpath"))}
                  {doc("Police Verification", f("police_imgpath"))}
                  {doc("Employee Photo", f("employee_imgpath"))}
                  {doc("Bank Passbook", f("bank_imgpath"))}
                </div>
              )}
              <div className="row text-center" style={{ marginTop: 16 }}>
                {f("moveto_employeemaster") !== "1" && (
                  <button className="btn btn-primary" style={{ width: 220 }} disabled={busy} onClick={move}>MoveToEmployeeMaster</button>
                )}{" "}
                <button className="btn btn-danger" onClick={() => setD(null)}>Close</button>
              </div>
            </div>
          )}
          {!d && (
            <div className="row text-center" style={{ marginTop: 16 }}>
              <Link href="/" className="btn btn-danger">Close</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
