"use client";

/**
 * Leave Master — 1:1 replica of the legacy LeaveMaster.aspx (pay_policy_master +
 * pay_leave_master + pay_holiday_master). Policy header (name + start/end), a
 * Leave tab (leave types grid) and a Holidays tab (holiday grid), then the policy
 * list. Submit = create, Update = edit, Delete, Clear, Close. "Provision" fires the
 * modern balance-provisioning action (pay_leave_emp_balance) per policy.
 */

import { useEffect, useState, useCallback, type CSSProperties } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import { listItems, createItem, updateItem, deleteItem, ApiError, type Paginated } from "@/lib/api/crud";
import { API_BASE_URL } from "@/lib/api/client";
import { getJSON } from "@/lib/api/legacy-fetch";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}
async function postAction(path: string) {
  await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST", credentials: "include",
    headers: { "X-CSRFToken": getCookie("csrftoken") ?? "" },
  });
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, data };
}

const BASE = "/api/leave/policies";
const MENU = "Leave Apply";

interface LeaveType {
  leave_name: string; abbreviation: string; gender: string; max_no_of_leave: string;
  carry_forward: string; leave_accural: string; advance_request: string; backdated_request: string;
}
interface Holiday { holiday_type: string; holiday_name: string; holiday_date: string; holiday_state: string; }
interface Policy {
  id: number; comp_code: string; policy_name: string; start_date: string | null; end_date: string | null;
  submitted: boolean; leave_types: (LeaveType & { id: number })[]; holidays: (Holiday & { id: number })[];
}

const emptyLeaveInput = () => ({ leave_name: "Select Leave", abbreviation: "", gender: "Select Gender", max_no_of_leave: "", carry_forward: "", leave_accural: "0", advance_request: "Select", backdated_request: "Select" });
const emptyHolidayInput = () => ({ holiday_type: "Select", holiday_state: "", holiday_name: "", holiday_date: "" });

function levelFor(me: Me | null): number {
  if (!me) return 0;
  if (me.is_staff) return 4;
  const map: Record<string, number> = { R: 1, U: 2, C: 3, D: 4 };
  return me.permissions.filter((p) => p.menu === MENU && !p.needs_review)
    .reduce((mx, p) => Math.max(mx, map[p.permission] ?? 0), 0);
}

export default function LeavePolicyManager() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [data, setData] = useState<Paginated<Policy> | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [policyName, setPolicyName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [leaves, setLeaves] = useState<LeaveType[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [tab, setTab] = useState<"leave" | "holidays">("leave");

  const [li, setLi] = useState(emptyLeaveInput());
  const [hi, setHi] = useState(emptyHolidayInput());

  const level = levelFor(me);
  const canCreate = level >= 3, canUpdate = level >= 2, canDelete = !!me?.is_staff || level >= 4;

  useEffect(() => { getMe().then((m) => { setMe(m); setAuthChecked(true); }); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await listItems<Policy>(BASE, { pageSize: 100 })); }
    catch { setData(null); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (authChecked && me) load(); else if (authChecked && !me) setLoading(false); }, [authChecked, me, load]);

  // ddl_state_click: distinct STATE_NAME from pay_state_master (free text only if the list cannot be read)
  const [stateNames, setStateNames] = useState<string[]>([]);
  useEffect(() => {
    getJSON<{ results: { state_name: string }[] }>("/api/masters/states/?page_size=all").then((d) => {
      const names = Array.from(new Set((d?.results ?? []).map((x) => x.state_name).filter(Boolean))).sort();
      setStateNames(names);
    });
  }, []);

  const clearForm = () => {
    setEditingId(null); setPolicyName(""); setStart(""); setEnd("");
    setLeaves([]); setHolidays([]); setLi(emptyLeaveInput()); setHi(emptyHolidayInput());
    setFormErr(null); setTab("leave");
  };

  // Legacy LinkButton1_Click (Req_val): add a leave type to the grid.
  const addLeave = () => {
    if (li.leave_name === "Select Leave") { alert("Please Select Leave Name"); return; }
    if (!li.abbreviation.trim()) { alert("Please Enter Leave Abbreviation"); return; }
    if (li.gender === "Select Gender") { alert("Please Select Gender"); return; }
    if (!li.max_no_of_leave.trim()) { alert("Please Enter MAX No. of Leave"); return; }
    if (!li.carry_forward.trim()) { alert("Please Enter Carry forward"); return; }
    if (!li.leave_accural.trim()) { alert("Please Enter Leave Accural"); return; }
    if (li.advance_request === "Select") { alert("Please Select Advance Request"); return; }
    if (li.backdated_request === "Select") { alert("Please Select Backdated Request"); return; }
    setLeaves((p) => [...p, { ...li }]);
    setLi(emptyLeaveInput());
  };
  const removeLeave = (i: number) => setLeaves((p) => p.filter((_, idx) => idx !== i));

  // Legacy lnkbtn_addmoreitem_Click (holiday_validation): add a holiday to the grid.
  const addHoliday = () => {
    if (hi.holiday_type === "Select") { alert("Please Select Holiday Name"); return; }
    if (hi.holiday_type === "State Holiday" && !hi.holiday_state.trim()) { alert("Please Select State"); return; }
    if (!hi.holiday_name.trim()) { alert("Please Enter Holiday Description"); return; }
    if (!hi.holiday_date) { alert("Please Enter Start Date"); return; }
    setHolidays((p) => [...p, { ...hi }]);
    setHi(emptyHolidayInput());
  };
  const removeHoliday = (i: number) => setHolidays((p) => p.filter((_, idx) => idx !== i));

  // Legacy Req_validation: policy name + start + end required.
  const validatePolicy = () => {
    if (!policyName.trim()) { alert("Please Enter policy name"); return false; }
    if (!start) { alert("Please Select Start Date"); return false; }
    if (!end) { alert("Please Select End Date"); return false; }
    return true;
  };

  const body = () => ({
    policy_name: policyName.trim(), start_date: start || null, end_date: end || null,
    leave_types: leaves, holidays: holidays,
  });

  const save = async () => {
    if (!validatePolicy()) return;
    if (leaves.length === 0 && holidays.length === 0) { alert(editingId ? "Add Atleast one leave or holiday..." : "Please add aleast one leave or holiday in policy!!"); return; }
    setSaving(true); setFormErr(null); setNotice(null);
    try {
      const res = editingId ? await updateItem<Policy>(BASE, editingId, body()) : await createItem<Policy>(BASE, body());
      if (res.ok) { setNotice(editingId ? "Record Updated Successfully..." : "Record added save as draft successfully!!"); clearForm(); load(); }
      else if (res.status === 403) setFormErr("You do not have permission for this action.");
      else {
        const d = (res.data ?? {}) as unknown as Record<string, unknown>;
        setFormErr(typeof d.detail === "string" ? d.detail
          : Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(" · ") || "Save failed.");
      }
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (editingId == null) return;
    if (!confirm("Are you Sure You Want to Delete Record")) { alert("Record not Available"); return; }
    const res = await deleteItem(BASE, editingId);
    if (res.ok) { setNotice("Policy deleted successfully !!"); clearForm(); load(); }
    else if (res.status === 403) alert("Only administrators can delete.");
    else alert("Policy deletion failed !!");
  };

  const selectPolicy = (p: Policy) => {
    setEditingId(p.id); setPolicyName(p.policy_name); setStart(p.start_date ?? ""); setEnd(p.end_date ?? "");
    setLeaves(p.leave_types.map(({ id, ...r }) => r));
    setHolidays(p.holidays.map(({ id, ...r }) => r));
    setLi(emptyLeaveInput()); setHi(emptyHolidayInput()); setFormErr(null); setTab("leave");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const provision = async (p: Policy) => {
    if (!confirm(`Provision leave balances for all matching employees from "${p.policy_name}"?`)) return;
    const res = await postAction(`${BASE}/${p.id}/submit/`);
    if (res.ok) {
      const d = res.data as { balances_created?: number; balances_updated?: number };
      setNotice(`Balances provisioned: ${d.balances_created ?? 0} created, ${d.balances_updated ?? 0} updated.`);
      load();
    } else if (res.status === 403) alert("You do not have permission to submit this policy.");
    else alert((res.data as { detail?: string }).detail || "Submit failed.");
  };

  if (authChecked && !me) {
    return <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: 4 }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", textAlign: "center", fontWeight: "bold" }}>Leave Master</div>
        <div style={{ padding: 16 }}>🔐 Sign in required. <Link href="/login">Go to login</Link></div>
      </div>
    </div>;
  }

  return (
    <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: 4, backgroundColor: "#fff" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px" }}>
          <div className="row">
            <div className="col-sm-1 col-xs-12" />
            <div className="col-sm-9 col-xs-12 text-center text-uppercase" style={{ fontSize: "small", fontWeight: "bold" }}>Leave Master</div>
            <div className="col-sm-2 col-xs-12 text-right">
              <Link href="#" onClick={(e) => e.preventDefault()} style={{ color: "#fff", fontSize: 10 }}>
                <img src="/Images/help_ico.png" alt="Help" width={20} height={20} title="Help" />
              </Link>
            </div>
          </div>
        </div>

        <div className="panel-body" style={{ padding: 15 }}>
          {notice && <div className="lg-alert" style={{ color: "#166534", background: "#dcfce7", padding: "8px 12px", borderRadius: 6, marginBottom: 12, textAlign: "center" }}>{notice}</div>}

          {/* ===== policy header ===== */}
          <div className="container-fluid" style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: 10, padding: 15, marginBottom: 16 }}>
            <div className="row">
              <div className="col-sm-2 col-xs-12 emf"><b>Policy Name :</b>
                <input className="form-control" maxLength={15} value={policyName} disabled={!!editingId} onChange={(e) => setPolicyName(e.target.value)} />
              </div>
              <div className="col-sm-2 col-xs-12 emf"><b>Start Date :</b>
                <input type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="col-sm-2 col-xs-12 emf"><b>End Date :</b>
                <input type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
          </div>

          {/* ===== tabs ===== */}
          <ul style={{ listStyle: "none", padding: "12px", margin: 0, background: "#f3f1fe", borderRadius: 10, display: "flex", gap: 6 }}>
            {(["leave", "holidays"] as const).map((t) => (
              <li key={t} onClick={() => setTab(t)} style={{ cursor: "pointer", padding: "8px 16px", fontWeight: "bold", borderRadius: "4px 4px 0 0", background: tab === t ? "#fff" : "transparent", border: tab === t ? "1px solid #ddd" : "none", borderBottom: tab === t ? "none" : undefined }}>
                {t === "leave" ? "Leave" : "Holidays"}
              </li>
            ))}
          </ul>

          <div style={{ background: "#fff", border: "1px solid #ddd", borderTop: "none", padding: 16 }}>
            {tab === "leave" && (<>
              <div className="row">
                <div className="col-sm-2 col-xs-12 emf"><b>Leave Name :</b>
                  <select className="form-control" value={li.leave_name} onChange={(e) => setLi({ ...li, leave_name: e.target.value })}>
                    <option value="Select Leave">Select Leave</option>
                    <option value="Casual Leave">Casual Leave</option>
                    <option value="Sick Leave">Sick Leave</option>
                  </select>
                </div>
                <div className="col-sm-2 col-xs-12 emf"><b>Abbreviation :</b>
                  <input className="form-control" maxLength={3} value={li.abbreviation} onChange={(e) => setLi({ ...li, abbreviation: e.target.value })} />
                </div>
                <div className="col-sm-2 col-xs-12 emf"><b>Gender :</b>
                  <select className="form-control" value={li.gender} onChange={(e) => setLi({ ...li, gender: e.target.value })}>
                    <option value="Select Gender">Select Gender</option>
                    <option value="M">Male</option><option value="F">Female</option><option value="B">Both</option>
                  </select>
                </div>
                <div className="col-sm-2 col-xs-12 emf"><b>MAX No. of Leave :</b>
                  <input className="form-control" maxLength={5} value={li.max_no_of_leave} onChange={(e) => setLi({ ...li, max_no_of_leave: e.target.value.replace(/[^0-9.]/g, "") })} />
                </div>
                <div className="col-sm-2 col-xs-12 emf"><b>Carry forward :</b>
                  <input className="form-control" maxLength={5} value={li.carry_forward} onChange={(e) => setLi({ ...li, carry_forward: e.target.value.replace(/[^0-9.]/g, "") })} />
                </div>
              </div>
              <div className="row">
                <div className="col-sm-2 col-xs-12 emf"><b>Leave Accural :</b>
                  <input className="form-control" maxLength={50} value={li.leave_accural} onChange={(e) => setLi({ ...li, leave_accural: e.target.value })} />
                </div>
                <div className="col-sm-2 col-xs-12 emf"><b>Advance request :</b>
                  <select className="form-control" value={li.advance_request} onChange={(e) => setLi({ ...li, advance_request: e.target.value })}>
                    <option value="Select">Select</option><option value="Yes">Yes</option><option value="No">No</option>
                  </select>
                </div>
                <div className="col-sm-2 col-xs-12 emf"><b>Backdated request :</b>
                  <select className="form-control" value={li.backdated_request} onChange={(e) => setLi({ ...li, backdated_request: e.target.value })}>
                    <option value="Select">Select</option><option value="Yes">Yes</option><option value="No">No</option>
                  </select>
                </div>
                <div className="col-sm-2 col-xs-12 emf" style={{ paddingTop: 22 }}>
                  <button type="button" className="lg-btn lg-btn-green" onClick={addLeave}>+ Add</button>
                </div>
              </div>

              <table className="table" style={{ width: "100%", background: "#fff", border: "1px solid #ddd", fontSize: 12, marginTop: 10 }}>
                <thead style={{ background: "#006699", color: "#fff" }}>
                  <tr><th style={th}>LEAVE NAME</th><th style={th}>ABBREVIATION</th><th style={th}>GENDER</th><th style={th}>MAX NO LEAVE</th><th style={th}>CARRY FORWARD</th><th style={th}>LEAVE ACCURAL</th><th style={th}>ADVANCE REQUEST</th><th style={th}>BACKDATED REQUEST</th><th style={th} /></tr>
                </thead>
                <tbody>
                  {leaves.map((l, i) => (
                    <tr key={i}>
                      <td style={td}>{l.leave_name}</td><td style={td}>{l.abbreviation}</td><td style={td}>{l.gender}</td><td style={td}>{l.max_no_of_leave}</td>
                      <td style={td}>{l.carry_forward}</td><td style={td}>{l.leave_accural}</td><td style={td}>{l.advance_request}</td><td style={td}>{l.backdated_request}</td>
                      <td style={td}><button type="button" className="lg-btn lg-btn-red" onClick={() => removeLeave(i)}>Delete</button></td>
                    </tr>
                  ))}
                  {leaves.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", padding: 12, color: "#777" }}>No leave types added</td></tr>}
                </tbody>
              </table>
            </>)}

            {tab === "holidays" && (<>
              <div className="row">
                <div className="col-sm-2 col-xs-12 emf"><b>Holiday :</b>
                  <select className="form-control" value={hi.holiday_type} onChange={(e) => setHi({ ...hi, holiday_type: e.target.value, holiday_state: e.target.value === "State Holiday" ? hi.holiday_state : "" })}>
                    <option value="Select">Select</option>
                    <option value="State Holiday">State Holiday</option>
                    <option value="National Holiday">National Holiday</option>
                  </select>
                </div>
                {hi.holiday_type === "State Holiday" && (
                  <div className="col-sm-2 col-xs-12 emf"><b>State :</b>
                    {stateNames.length > 0 ? (
                      <select className="form-control" value={hi.holiday_state} onChange={(e) => setHi({ ...hi, holiday_state: e.target.value })}>
                        <option value="">Select</option>
                        {stateNames.map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    ) : (
                      <input className="form-control" value={hi.holiday_state} onChange={(e) => setHi({ ...hi, holiday_state: e.target.value })} />
                    )}
                  </div>
                )}
                <div className="col-sm-2 col-xs-12 emf"><b>Holiday Description :</b>
                  <input className="form-control" value={hi.holiday_name} onChange={(e) => setHi({ ...hi, holiday_name: e.target.value })} />
                </div>
                <div className="col-sm-2 col-xs-12 emf"><b>Start Date :</b>
                  <input type="date" className="form-control" value={hi.holiday_date} onChange={(e) => setHi({ ...hi, holiday_date: e.target.value })} />
                </div>
                <div className="col-sm-2 col-xs-12 emf" style={{ paddingTop: 22 }}>
                  <button type="button" className="lg-btn lg-btn-green" onClick={addHoliday}>+ Add</button>
                </div>
              </div>

              <table className="table" style={{ width: "100%", background: "#fff", border: "1px solid #ddd", fontSize: 12, marginTop: 10 }}>
                <thead style={{ background: "#006699", color: "#fff" }}>
                  <tr><th style={th}>STATE</th><th style={th}>HOLIDAY</th><th style={th}>HOLIDAY DISCRIPTION</th><th style={th}>DATE</th><th style={th} /></tr>
                </thead>
                <tbody>
                  {holidays.map((h, i) => (
                    <tr key={i}>
                      <td style={td}>{h.holiday_state}</td><td style={td}>{h.holiday_type}</td><td style={td}>{h.holiday_name}</td><td style={td}>{h.holiday_date}</td>
                      <td style={td}><button type="button" className="lg-btn lg-btn-red" onClick={() => removeHoliday(i)}>Delete</button></td>
                    </tr>
                  ))}
                  {holidays.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", padding: 12, color: "#777" }}>No holidays added</td></tr>}
                </tbody>
              </table>
            </>)}
          </div>

          {formErr && <p style={{ color: "crimson", textAlign: "center", marginTop: 12 }}>{formErr}</p>}

          {/* ===== button row ===== */}
          <div className="lg-btns center" style={{ marginTop: 20 }}>
            {!editingId && canCreate && <button className="lg-btn lg-btn-green" disabled={saving} onClick={save}>Submit</button>}
            {editingId && canUpdate && <button className="lg-btn lg-btn-green" disabled={saving} onClick={save}>Update</button>}
            {editingId && canDelete && <button className="lg-btn lg-btn-red" disabled={saving} onClick={remove}>Delete</button>}
            <button className="lg-btn" onClick={clearForm}>Clear</button>
            <Link href="/" className="lg-btn lg-btn-red" style={{ textDecoration: "none" }}>Close</Link>
          </div>

          {/* ===== policy list ===== */}
          <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff", border: "1px solid #ddd", marginTop: 16 }}>
            <thead style={{ background: "#006699", color: "#fff" }}>
              <tr><th style={th}>POLICY NAME</th><th style={th}>START DATE</th><th style={th}>END DATE</th><th style={th}>LEAVE TYPES</th><th style={th}>HOLIDAYS</th><th style={th}>STATUS</th><th style={th}>ACTION</th></tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ textAlign: "center", padding: 12 }}>Loading…</td></tr>}
              {!loading && data && data.results.map((p) => (
                <tr key={p.id} style={{ cursor: "pointer", background: editingId === p.id ? "#eaf3ff" : undefined }} onClick={() => selectPolicy(p)}>
                  <td style={td}>{p.policy_name}</td><td style={td}>{p.start_date ?? ""}</td><td style={td}>{p.end_date ?? ""}</td>
                  <td style={td}>{p.leave_types.length}</td><td style={td}>{p.holidays.length}</td>
                  <td style={td}>{p.submitted ? "✓ submitted" : "draft"}</td>
                  <td style={td} onClick={(e) => e.stopPropagation()}>
                    {canUpdate && <button className="lg-btn lg-btn-green" onClick={() => provision(p)}>Provision</button>}
                  </td>
                </tr>
              ))}
              {!loading && data && data.results.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: 12, color: "#777" }}>No policies yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const th: CSSProperties = { padding: "8px", textTransform: "uppercase" };
const td: CSSProperties = { padding: "8px" };
