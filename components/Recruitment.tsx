"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import LegacyRequirements from "@/components/LegacyRequirements";
import {
  getJSON, getJSONStrict, postJSON as apiPost, putJSON as apiPut, upload, responseMessage,
} from "@/lib/api/legacy-fetch";

/**
 * Employee Recruitment (legacy new_employee_requirnment.aspx).
 * API: /api/hr/recruitments/ (the apps.employees router is mounted at /api/hr/).
 * Legacy Req_validation alerts are reproduced in the legacy order and wording; the server
 * enforces the same list again when a candidate is moved into the Employee Master.
 */
const API = "/api/hr/recruitments/";

const EMPLOYEE_TYPES = [
  { v: "Permanent", t: "Permanent" }, { v: "PermanentReliever", t: "Permanent Reliever" },
  { v: "Reliever", t: "Reliever" }, { v: "Staff", t: "Staff" }, { v: "Temporary", t: "Temporary" },
  { v: "RM", t: "Repair & Maintenance" },
];
const BLOOD_GROUPS = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];

type Opt = { v: string; t: string };

const BLANK = {
  id: "", employee_type: "", client_name: "", unit_name: "", grade: "", supervisor_code: "",
  new_employee_name: "", father_name: "", gender: "", dob: "", doj: "", blood_group: "",
  working_hours: "", mobile_no: "", address: "", branch_name: "", account_no: "", ifsc_code: "",
  bank_holder_name: "", aadhaar: "",
};

function RecruitmentCapture() {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [f, setF] = useState<Record<string, string>>({ ...BLANK });
  const [masked, setMasked] = useState({ aadhaar: "", account: "", holder: "" });
  const [clients, setClients] = useState<Opt[]>([]);
  const [units, setUnits] = useState<Opt[]>([]);
  const [grades, setGrades] = useState<Opt[]>([]);
  const [empCodeToMove, setEmpCodeToMove] = useState("");
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [loginInfo, setLoginInfo] = useState<{ login: string; token: string } | null>(null);
  const files = useRef<Record<string, File | null>>({ adharcard: null, employee: null, police: null, bank: null });

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const onChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    set(e.target.name, e.target.value);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const res = await getJSONStrict<any>(`${API}?page_size=all`);
      setRecords(Array.isArray(res) ? res : res.results || []);
    } catch (err: any) {
      alert(err.message || "Record Display Failed...!");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    getJSON<any>("/api/masters/clients/?page_size=all")
      .then((d) => setClients((d?.results ?? []).map((c: any) => ({ v: c.client_code, t: c.client_name }))));
    getJSON<any>("/api/hr/grades/lookup/")
      .then((d) => setGrades((d?.grades ?? []).map((g: any) => ({ v: g.grade_code, t: g.grade_desc || g.grade_code }))));
  }, []);

  useEffect(() => {
    if (!f.client_name) { setUnits([]); return; }
    getJSON<any>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(f.client_name)}`)
      .then((d) => setUnits((d?.units ?? []).map((u: any) => ({ v: u.unit_code, t: `${u.unit_code} - ${u.unit_name}` }))));
  }, [f.client_name]);

  const clear = () => {
    setF({ ...BLANK });
    setMasked({ aadhaar: "", account: "", holder: "" });
    files.current = { adharcard: null, employee: null, police: null, bank: null };
  };

  // legacy Req_validation (same order and wording); the employee-code alert applies at "Move to Master"
  const validate = (): string | null => {
    const editing = !!f.id;
    const checks: [boolean, string][] = [
      [!f.employee_type, "Please Select Employee Type"],
      [!f.client_name, "Please Select Client Name"],
      [!f.unit_name, "Please Select Branch Name"],
      [!f.grade, "Please Select Designation"],
      [!f.supervisor_code.trim(), "Please Enter Supervisor Name"],
      [!f.new_employee_name.trim(), "Please Enter New Employee Name"],
      [!f.father_name.trim(), "Please Enter Father/Husband Name"],
      [!f.gender, "Please Select Gender"],
      [!f.dob, "Please Enter Date Of Birth"],
      [!f.doj, "Please Enter Date Of Joining"],
      [!f.blood_group, "Please Select Blood Group"],
      [!f.working_hours, "Please Select Working Hour"],
      [!f.mobile_no.trim(), "Please Enter Mobile Number"],
      [!f.address.trim(), "Please Enter Employee Address"],
      [!f.branch_name.trim(), "Please Enter Branch Name"],
      [!f.account_no.trim() && !(editing && masked.account), "Please Enter Bank Account Number"],
      [!f.ifsc_code.trim(), "Please Enter Bank IFSC Code"],
      [!f.bank_holder_name.trim() && !(editing && masked.holder), "Please Enter Bank Holder Name"],
      [!f.aadhaar.trim() && !(editing && masked.aadhaar), "Please Enter Aadhar Number"],
    ];
    const hit = checks.find(([bad]) => bad);
    return hit ? hit[1] : null;
  };

  const payload = () => {
    const p: Record<string, any> = {
      employee_type: f.employee_type, client_name: f.client_name, unit_name: f.unit_name, grade: f.grade,
      supervisor_code: f.supervisor_code.trim(), new_employee_name: f.new_employee_name.trim(),
      father_name: f.father_name.trim(), gender: f.gender, dob: f.dob, doj: f.doj,
      blood_group: f.blood_group, working_hours: f.working_hours, mobile_no: f.mobile_no.trim(),
      address: f.address.trim(), branch_name: f.branch_name.trim(), ifsc_code: f.ifsc_code.trim(),
    };
    // write-only PII: only sent when the user typed a new value
    if (f.aadhaar.trim()) p.aadhaar = f.aadhaar.trim();
    if (f.account_no.trim()) p.account_no = f.account_no.trim();
    if (f.bank_holder_name.trim()) p.bank_holder_name = f.bank_holder_name.trim();
    return p;
  };

  const uploadSelectedFiles = async (id: string) => {
    for (const [kind, file] of Object.entries(files.current)) {
      if (!file) continue;
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("file", file);
      const r = await upload(`${API}${id}/upload-doc/`, fd);
      if (!r.ok) throw new Error(await responseMessage(r, "Please select only JPG and PNG Images !!!"));
    }
  };

  const handleSave = async () => {
    const err = validate();
    if (err) { alert(err); return; }
    setLoading(true);
    try {
      const r = f.id ? await apiPut(`${API}${f.id}/`, payload()) : await apiPost(API, payload());
      if (!r.ok) { alert(await responseMessage(r, "Employee Added Fail !!!")); return; }
      const saved = await r.json().catch(() => ({} as any));
      await uploadSelectedFiles(String(saved.id || f.id));
      alert(f.id ? "Record updated successfully!!" : "Record added successfully!!");
      clear();
      fetchRecords();
    } catch (e: any) {
      alert(e.message || "Employee Added Fail !!!");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (r: any) => {
    setF({
      ...BLANK, id: String(r.id), employee_type: r.employee_type || "", client_name: r.client_name || "",
      unit_name: r.unit_name || "", grade: r.grade || "", supervisor_code: r.supervisor_code || "",
      new_employee_name: r.new_employee_name || "", father_name: r.father_name || "", gender: r.gender || "",
      dob: r.dob || "", doj: r.doj || "", blood_group: r.blood_group || "", working_hours: r.working_hours || "",
      mobile_no: r.mobile_no || "", address: r.address || "", branch_name: r.branch_name || "",
      ifsc_code: r.ifsc_code || "",
    });
    setMasked({ aadhaar: r.aadhaar_masked || "", account: r.account_masked || "", holder: r.bank_holder_masked || "" });
  };

  const handleMoveToMaster = async () => {
    if (!empCodeToMove.trim()) { alert("Please Enter Employee Code"); return; }
    setLoading(true);
    try {
      const r = await apiPost(`${API}${f.id}/move_to_master/`, { emp_code: empCodeToMove.trim(), employee_type: f.employee_type });
      if (!r.ok) { alert(await responseMessage(r, "Employee Added Fail !!!")); return; }
      const body = await r.json().catch(() => ({} as any));
      if (body?.login_setup_token) setLoginInfo({ login: body.login_id ?? empCodeToMove.trim(), token: body.login_setup_token });
      alert("Employee Added Successfully !!!");
      setShowMoveModal(false);
      clear();
      fetchRecords();
    } catch (e: any) {
      alert(e.message || "Employee Added Fail !!!");
    } finally {
      setLoading(false);
    }
  };

  const shown = records.filter((r) => {
    const q = search.trim().toLowerCase();
    return !q || String(r.id).includes(q) || (r.new_employee_name || "").toLowerCase().includes(q)
      || (r.mobile_no || "").includes(q);
  });
  const selected = records.find((r) => String(r.id) === f.id);
  const moved = selected && String(selected.moveto_master) === "1";

  const row = (children: React.ReactNode) => (
    <div className="row" style={{ display: "flex", flexWrap: "wrap", marginBottom: "15px", gap: "10px" }}>{children}</div>
  );
  const col = (label: string, input: React.ReactNode) => (
    <div style={{ flex: "1 1 20%" }}><label>{label}</label>{input}</div>
  );
  const sel = (name: string, opts: Opt[]) => (
    <select name={name} value={f[name]} onChange={onChange} className="form-control">
      <option value="">Select</option>
      {opts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
    </select>
  );
  const fileInput = (kind: string, label: string, stored?: string) => col(label, (
    <>
      <input type="file" accept=".jpg,.jpeg,.png" className="form-control"
        onChange={(e) => { files.current[kind] = e.target.files?.[0] || null; }} />
      {stored ? <span style={{ color: "#00aa00", fontSize: 11 }}>Uploaded</span> : null}
    </>
  ));

  return (
    <div className="container-fluid" style={{ maxWidth: "99%", margin: "0 auto", padding: "20px" }}>
      {loading && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(204, 204, 204, 0.7)", zIndex: 9999 }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>Loading...</div>
        </div>
      )}

      {loginInfo && (
        <div className="em-note" style={{ margin: "8px 0" }}>
          Login <b>{loginInfo.login}</b> created with no password. One-time setup token (shown once - give it to the employee so they
          can set a password at <code>/password-setup</code>): <code>{loginInfo.token}</code>{" "}
          <button className="btn btn-default btn-xs" onClick={() => setLoginInfo(null)}>Dismiss</button>
        </div>
      )}

      {showMoveModal && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ backgroundColor: "#fff", padding: "20px", borderRadius: "8px", minWidth: "300px" }}>
            <h4>Move to Employee Master</h4>
            <div style={{ marginBottom: "15px" }}>
              <label>Employee Code *</label>
              <input type="text" className="form-control" value={empCodeToMove} readOnly title="Auto-generated (company series + running number)" />
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn btn-default" onClick={() => setShowMoveModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleMoveToMaster}>Submit</button>
            </div>
          </div>
        </div>
      )}

      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ flex: "1", textAlign: "center", fontSize: "small", fontWeight: "bold" }}>
            EMPLOYEE RECRUITMENT
          </div>
          <div style={{ textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); window.open("html/new_employee_requirnment.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }} style={{ color: "#fff" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>

        <div className="panel-body" style={{ padding: "15px" }}>
          <div style={{ marginBottom: 10 }}>
            <input type="text" className="form-control" placeholder="Search by Id / name / mobile" value={search} onChange={(e) => setSearch(e.target.value)} style={{ maxWidth: 320 }} />
          </div>
          <div style={{ maxHeight: "260px", overflow: "auto", marginBottom: 20 }}>
            <table className="table table-bordered table-striped" style={{ width: "100%", fontSize: "12px" }}>
              <thead style={{ backgroundColor: "#006699", color: "white" }}>
                <tr><th>Action</th><th>Id</th><th>Employee Name</th><th>Client</th><th>Branch</th><th>Designation</th><th>DOB</th><th>Mobile</th><th>Status</th></tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id}>
                    <td><button className="btn btn-xs btn-info" onClick={() => handleEdit(r)}>Select</button></td>
                    <td>{r.id}</td><td>{r.new_employee_name}</td><td>{r.client_name}</td><td>{r.unit_name}</td>
                    <td>{r.grade}</td><td>{r.dob}</td><td>{r.mobile_no}</td>
                    <td>{String(r.moveto_master) === "1" ? `Moved (${r.emp_code})` : "Pending"}</td>
                  </tr>
                ))}
                {shown.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center" }}>No records found.</td></tr>}
              </tbody>
            </table>
          </div>

          {row(<>
            {col("Employee Type *", sel("employee_type", EMPLOYEE_TYPES))}
            {col("Client Name *", sel("client_name", clients))}
            {col("Branch Name *", sel("unit_name", units))}
            {col("Designation *", sel("grade", grades))}
          </>)}
          {row(<>
            {col("Supervisor Name *", <input type="text" name="supervisor_code" value={f.supervisor_code} onChange={onChange} className="form-control" maxLength={20} />)}
            {col("Employee Name *", <input type="text" name="new_employee_name" value={f.new_employee_name} onChange={onChange} className="form-control" />)}
            {col("Father/Husband Name *", <input type="text" name="father_name" value={f.father_name} onChange={onChange} className="form-control" maxLength={50} />)}
            {col("Gender *", sel("gender", [{ v: "M", t: "Male" }, { v: "F", t: "Female" }]))}
          </>)}
          {row(<>
            {col("Date of Birth *", <input type="date" name="dob" value={f.dob} onChange={onChange} className="form-control" />)}
            {col("Date of Joining *", <input type="date" name="doj" value={f.doj} onChange={onChange} className="form-control" />)}
            {col("Blood Group *", sel("blood_group", BLOOD_GROUPS.map((b) => ({ v: b, t: b }))))}
            {col("Working Hours *", sel("working_hours", [{ v: "8", t: "8" }, { v: "12", t: "12" }]))}
          </>)}
          {row(<>
            {col("Mobile No *", <input type="text" name="mobile_no" value={f.mobile_no} onChange={(e) => set("mobile_no", e.target.value.replace(/\D/g, ""))} className="form-control" maxLength={10} />)}
            {col("Address *", <textarea name="address" value={f.address} onChange={onChange} className="form-control" rows={3} maxLength={200} />)}
            {col("Bank Branch Name *", <input type="text" name="branch_name" value={f.branch_name} onChange={onChange} className="form-control" maxLength={50} />)}
            {col("Bank Account No *", <input type="text" name="account_no" value={f.account_no} onChange={(e) => set("account_no", e.target.value.replace(/\D/g, ""))} className="form-control" placeholder={masked.account} />)}
          </>)}
          {row(<>
            {col("Bank IFSC Code *", <input type="text" name="ifsc_code" value={f.ifsc_code} onChange={onChange} className="form-control" maxLength={11} />)}
            {col("Bank Holder Name *", <input type="text" name="bank_holder_name" value={f.bank_holder_name} onChange={onChange} className="form-control" placeholder={masked.holder} />)}
            {col("Aadhar No *", <input type="text" name="aadhaar" value={f.aadhaar} onChange={(e) => set("aadhaar", e.target.value.replace(/\D/g, ""))} className="form-control" maxLength={12} placeholder={masked.aadhaar} />)}
            <div style={{ flex: "1 1 20%" }} />
          </>)}
          {row(<>
            {fileInput("adharcard", "Aadhar Card (JPG/PNG)", selected?.adharcard_imgpath)}
            {fileInput("employee", "Employee Photo (JPG/PNG)", selected?.employee_imgpath)}
            {fileInput("police", "Police Verification (JPG/PNG)", selected?.police_imgpath)}
            {fileInput("bank", "Bank Passbook (JPG/PNG)", selected?.bank_imgpath)}
          </>)}

          <div style={{ textAlign: "center", marginTop: "20px", marginBottom: "20px" }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={!!moved} style={{ marginRight: "10px" }}>{f.id ? "Update" : "Save"}</button>
            {f.id && !moved && (
              <button className="btn btn-success" onClick={() => { const err = validate(); if (err) { alert(err); return; } setEmpCodeToMove(""); getJSON<{ emp_code: string }>(`${API}next-code/`).then((d) => setEmpCodeToMove(d?.emp_code ?? "")); setShowMoveModal(true); }} style={{ marginRight: "10px" }}>Move to Master</button>
            )}
            <button className="btn btn-danger" onClick={clear}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Page: the legacy requirement list (default, 1:1 with new_employee_requirnment.aspx) + the modern capture form. */
export default function Recruitment() {
  const [view, setView] = useState<"list" | "capture">("list");
  return (
    <div>
      <ul className="nav nav-tabs" style={{ margin: "10px 20px 0" }}>
        <li className={view === "list" ? "active" : ""}><a href="#" onClick={(e) => { e.preventDefault(); setView("list"); }}>Requirement List</a></li>
        <li className={view === "capture" ? "active" : ""}><a href="#" onClick={(e) => { e.preventDefault(); setView("capture"); }}>Capture Candidate</a></li>
      </ul>
      {view === "list" ? <LegacyRequirements /> : <RecruitmentCapture />}
    </div>
  );
}
