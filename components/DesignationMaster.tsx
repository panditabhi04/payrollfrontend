"use client";

// Faithful replica of the legacy GradeMaster.aspx ("Designation Master") screen:
// same title, field labels, dropdown values, required (*) markers, validation
// messages, buttons (New/Save/Update/Delete/Clear/Close) and grid columns.
// Backed by the existing /api/hr/grades API (grade_code=Designation Code,
// grade_desc=Designation Description, reporting_to=Reporting To,
// working_hours=Categories, employee_type=Employee Type).

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import { listItems, createItem, updateItem, deleteItem, ApiError } from "@/lib/api/crud";
import DataTable, { type DTColumn } from "@/components/DataTable";

const BASE = "/api/hr/grades";
const MENU = "Designation Master";   // role-matrix name of GradeMaster.aspx (backend gate uses the same)
// exact legacy Employee Type options (value / display) — "RM" shows as "Repair & Maintenance"
const EMP_TYPES: { value: string; label: string }[] = [
  { value: "Select", label: "Select" },
  { value: "Permanent", label: "Permanent" },
  { value: "Staff", label: "Staff" },
  { value: "Temporary", label: "Temporary" },
  { value: "RM", label: "Repair & Maintenance" },
];
const CATEGORIES = ["Select", "Unskilled", "Semiskilled", "Skilled", "HighlySkilled"];

interface Grade {
  id: number; grade_code: string; grade_desc: string; reporting_to: string;
  working_hours: string; employee_type: string;
}

const DT_COLS: DTColumn<Grade>[] = [
  { key: "grade_code", label: "DESIGNATION CODE", value: (g) => g.grade_code },
  { key: "grade_desc", label: "DESIGNATION DESCRIPTION", value: (g) => g.grade_desc || "" },
  { key: "reporting_to", label: "REPORTING TO", value: (g) => g.reporting_to || "" },
  { key: "working_hours", label: "CATEGORIES", value: (g) => g.working_hours || "" },
];

function levelFor(me: Me | null): number {
  if (!me) return 0;
  if (me.is_staff) return 4;
  const map: Record<string, number> = { R: 1, U: 2, C: 3, D: 4 };
  return me.permissions.filter((p) => p.menu === MENU && !p.needs_review)
    .reduce((mx, p) => Math.max(mx, map[p.permission] ?? 0), 0);
}

export default function DesignationMaster() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [empType, setEmpType] = useState("Select");
  const [rows, setRows] = useState<Grade[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Grade | null>(null);
  const [code, setCode] = useState("");
  const [desc, setDesc] = useState("");
  const [reporting, setReporting] = useState("");
  const [category, setCategory] = useState("Select");
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => { getMe().then((m) => { setMe(m); setAuthChecked(true); }); }, []);

  const loadGrid = useCallback(async (et: string) => {
    if (et === "Select") { setRows([]); return; }
    setLoading(true);
    try {
      const res = await listItems<Grade>(BASE, { pageSize: 200, filters: { employee_type: et } });
      setRows(res.results);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, []);

  const onEmpType = (et: string) => { setEmpType(et); clearForm(); loadGrid(et); };

  const clearForm = () => { setSelected(null); setCode(""); setDesc(""); setReporting(""); setCategory("Select"); };

  const selectRow = (g: Grade) => {
    setSelected(g); setCode(g.grade_code); setDesc(g.grade_desc);
    setReporting(g.reporting_to || ""); setCategory(g.working_hours || "Select");
  };

  // legacy client-side validation (exact messages)
  const validate = (): string | null => {
    if (!code.trim()) return "Please Enter Designation Code";
    if (!desc.trim()) return "Please Enter the  Designation description";
    if (empType === "Permanent" && (category === "Select" || !category)) return "Please Select Categories";
    return null;
  };

  const payload = () => ({
    grade_code: code.trim(), grade_desc: desc.trim(), reporting_to: reporting,
    working_hours: category === "Select" ? "" : category, employee_type: empType,
  });

  const onSave = async () => {
    const err = validate(); if (err) { alert(err); return; }
    setNotice(null);
    const res = await createItem<Grade>(BASE, payload());
    if (res.ok) { alert("Designation added successfully!!"); clearForm(); loadGrid(empType); }
    else if (res.status === 403) alert("You do not have permission for this action.");
    else { const d = (res.data ?? {}) as unknown as Record<string, unknown>; alert(msg(d) || "Designation adding failed..."); }
  };

  const onUpdate = async () => {
    if (!selected) { alert("Select a row to update"); return; }
    const err = validate(); if (err) { alert(err); return; }
    const res = await updateItem<Grade>(BASE, selected.id, payload());
    if (res.ok) { alert("Designation updated successfully!!"); clearForm(); loadGrid(empType); }
    else if (res.status === 403) alert("You do not have permission for this action.");
    else { const d = (res.data ?? {}) as unknown as Record<string, unknown>; alert(msg(d) || "Designation updation failed!!"); }
  };

  const onDelete = async () => {
    if (!selected) { alert("Record not Available"); return; }
    if (!confirm("Are you Sure You Want to Delete Record")) { alert("Record not Available"); return; }
    const res = await deleteItem(BASE, selected.id);
    if (res.ok) { alert("Designation deleted successfully!!"); clearForm(); loadGrid(empType); }
    else if (res.status === 403) alert("Only administrators can delete a designation.");
    else { const d = (res.data ?? {}) as unknown as Record<string, unknown>; alert(typeof d.detail === "string" ? d.detail : "Designation deletion failed!!"); }
  };

  const reportingOptions = Array.from(new Set(rows.map((r) => r.grade_code))).sort();

  if (authChecked && !me) {
    return <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", textAlign: "center", fontWeight: "bold" }}>Designation Master</div>
        <div style={{ padding: 16 }}>🔐 Sign in required. <Link href="/login">Go to login</Link></div>
      </div>
    </div>;
  }

  return (
    <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px", backgroundColor: "#fff" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "8.33%" }}></div>
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
            Designation Master
          </div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); }} style={{ color: "#fff", fontSize: "10px" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>
        <br />
        <div className="panel-body" style={{ padding: "15px", background: "beige", minHeight: "500px" }}>
          {notice && <div style={{ color: "green", fontWeight: "bold", textAlign: "center", marginBottom: "15px", padding: "10px", background: "#dff0d8", border: "1px solid #d6e9c6", borderRadius: "4px" }}>{notice}</div>}

          <div style={{ background: "#fff", padding: "15px", border: "1px solid #ccc", borderRadius: "4px", marginBottom: "20px" }}>
            <div style={{ flex: "1 1 200px" }}>
              <b>Employee Type : <span style={{ color: "red" }}>*</span></b>
              <select className="form-control" value={empType} onChange={(e) => onEmpType(e.target.value)} style={{ height: "34px", width: "300px" }}>
                {EMP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>

          {empType !== "Select" && (
            <>
              <div style={{ background: "#428bca", color: "#fff", padding: "10px 15px", marginBottom: "15px", fontWeight: "bold" }}>
                Designation Master Details
              </div>
              <div style={{ background: "#fff", padding: "15px", border: "1px solid #ccc", borderRadius: "4px", marginBottom: "20px" }}>
                <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end" }}>
                  <div style={{ flex: "1 1 200px" }}>
                    <b>Designation Code : <span style={{ color: "red" }}>*</span></b>
                    <input className="form-control" maxLength={10} value={code}
                      onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z. -]/g, ""))} style={{ height: "34px" }}
                      onBlur={() => {
                        // legacy txt_grade_TextChanged: warn when the code already exists for the employee type
                        if (!code || selected) return;
                        if (rows.some((r) => r.grade_code === code)) alert("This grade code already exist, try another.");
                      }} />
                  </div>
                  <div style={{ flex: "1 1 200px" }}>
                    <b>Designation Description : <span style={{ color: "red" }}>*</span></b>
                    <input className="form-control" maxLength={50} value={desc}
                      onChange={(e) => setDesc(e.target.value.replace(/[^A-Za-z0-9 ]/g, ""))} style={{ height: "34px" }} />
                  </div>
                  <div style={{ flex: "1 1 200px" }}>
                    <b>Reporting To :</b>
                    <select className="form-control" value={reporting} onChange={(e) => setReporting(e.target.value)} style={{ height: "34px" }}>
                      <option value="">Select Reporting</option>
                      {reportingOptions.map((rc) => <option key={rc} value={rc}>{rc}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: "1 1 200px" }}>
                    <b>Categories : <span style={{ color: "red" }}>*</span></b>
                    <select className="form-control" value={category} disabled={empType !== "Permanent"} onChange={(e) => setCategory(e.target.value)} style={{ height: "34px" }}>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <div className="row" style={{ display: "flex", justifyContent: "center", gap: "10px", marginBottom: "20px" }}>
                {!selected && <button className="btn btn-primary" onClick={onSave} style={{ background: "#337ab7", color: "#fff", border: "1px solid #2e6da4", padding: "6px 20px", borderRadius: "4px" }}>Save</button>}
                {selected && <button className="btn btn-primary" onClick={onUpdate} style={{ background: "#337ab7", color: "#fff", border: "1px solid #2e6da4", padding: "6px 20px", borderRadius: "4px" }}>Update</button>}
                {selected && <button className="btn btn-danger" onClick={onDelete} style={{ background: "#d9534f", color: "#fff", border: "1px solid #d43f3a", padding: "6px 20px", borderRadius: "4px" }}>Delete</button>}
                <button className="btn btn-warning" onClick={clearForm} style={{ background: "#f0ad4e", color: "#fff", border: "1px solid #eea236", padding: "6px 20px", borderRadius: "4px" }}>Clear</button>
                <Link href="/" className="btn btn-danger" style={{ textDecoration: "none", background: "#d9534f", color: "#fff", border: "1px solid #d43f3a", padding: "6px 20px", borderRadius: "4px" }}>Close</Link>
              </div>

              {loading ? <div style={{ textAlign: "center", padding: "20px", fontWeight: "bold", color: "#00547E" }}>Loading…</div> : (
                <DataTable<Grade>
                  columns={DT_COLS}
                  rows={rows}
                  rowKey={(g) => g.id}
                  onRowClick={selectRow}
                  selectedKey={selected?.id ?? null}
                />
              )}
            </>
          )}
          {empType === "Select" && <p style={{ color: "#666", fontStyle: "italic" }}>Please select an Employee Type to begin.</p>}
        </div>
      </div>
    </div>
  );
}

function msg(d: Record<string, unknown>): string {
  if (typeof d.detail === "string") return d.detail;
  return Object.values(d).map((v) => (Array.isArray(v) ? v.join(", ") : String(v))).join(" ");
}

// crud helpers reused; ApiError import kept for potential error handling
void ApiError;
