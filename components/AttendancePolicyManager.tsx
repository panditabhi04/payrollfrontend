"use client";

import { useEffect, useState, FormEvent, CSSProperties } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import { listItems, createItem, updateItem, deleteItem, ApiError, type Paginated } from "@/lib/api/crud";

const BASE = "/api/attendance/policies";

interface Shift { in_time: string; out_time: string; }
interface Policy {
  id: number;
  comp_code: string;
  policy_id: string;
  policy_name: string;
  start_date: string | null;
  end_date: string | null;
  working_hours: string;
  short_hours: string;
  late_in: string;
  late_out: string;
  early_in: string;
  early_out: string;
  weak_off: string;
  minimum_ot_hours: string;
  max_ot_hours: string;
  ot_rate: string;
  gender: string;
  deduction_policy: string;
  comp_off: string;
  approval_required: string;
  auto_shift: string;
  general_remark: string;
  roll: string;
  transaction: string;
  reminders: string;
  timing: string;
  limits_of_hours: string;
  punch_regularization: string;
  period: string;
  od: string;
  submitted?: boolean;
  shifts: (Shift & { id?: number })[];
}

const EMPTY = {
  policy_name: "", start_date: "", end_date: "", working_hours: "8", short_hours: "4", 
  late_in: "0", late_out: "0", early_in: "0", early_out: "0", weak_off: "0", minimum_ot_hours: "0", 
  max_ot_hours: "0", ot_rate: "0", gender: "0", deduction_policy: "", comp_off: "", 
  approval_required: "0", auto_shift: "false", general_remark: "",
  roll: "0", transaction: "0", reminders: "0", timing: "", limits_of_hours: "", punch_regularization: "", period: "", od: "0"
};

export default function AttendancePolicyManager() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [data, setData] = useState<Paginated<Policy> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  
  const [form, setForm] = useState<Record<string, any>>({ ...EMPTY });
  const [shifts, setShifts] = useState<Shift[]>([{ in_time: "", out_time: "" }]);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("inout"); // inout or other

  useEffect(() => { getMe().then((m) => { setMe(m); setAuthChecked(true); }); }, []);
  const load = async () => {
    setLoading(true); setError(null);
    try { setData(await listItems<Policy>(BASE, { pageSize: 100 })); }
    catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setError("auth");
      else setError(e instanceof Error ? e.message : "Failed to load");
    } finally { setLoading(false); }
  };
  useEffect(() => { if (authChecked && me) load(); else if (authChecked && !me) setLoading(false); }, [authChecked, me]);

  const selectExistingPolicy = (id: string) => {
    if (!id || id === "0") {
      setForm({ ...EMPTY });
      setShifts([{ in_time: "", out_time: "" }]);
      return;
    }
    const p = data?.results.find(x => x.id.toString() === id);
    if (!p) return;
    
    setForm({
      id: p.id,
      policy_name: p.policy_name || "",
      start_date: p.start_date || "",
      end_date: p.end_date || "",
      working_hours: p.working_hours || "8",
      short_hours: p.short_hours || "4",
      late_in: p.late_in || "0",
      late_out: p.late_out || "0",
      early_in: p.early_in || "0",
      early_out: p.early_out || "0",
      weak_off: p.weak_off || "0",
      minimum_ot_hours: p.minimum_ot_hours || "",
      max_ot_hours: p.max_ot_hours || "",
      ot_rate: p.ot_rate || "",
      gender: p.gender || "0",
      deduction_policy: p.deduction_policy || "",
      comp_off: p.comp_off || "",
      approval_required: p.approval_required || "0",
      auto_shift: p.auto_shift === "1" || p.auto_shift === "true" || p.auto_shift === "YES" ? "true" : "false",
      general_remark: p.general_remark || "",
      roll: p.roll || "0",
      transaction: p.transaction || "0",
      reminders: p.reminders || "0",
      timing: p.timing || "",
      limits_of_hours: p.limits_of_hours || "",
      punch_regularization: p.punch_regularization || "",
      period: p.period || "",
      od: p.od || "0",
    });
    setShifts(p.shifts?.length ? p.shifts.map(({ id, ...s }) => s) : [{ in_time: "", out_time: "" }]);
    setFormErr(null);
  };

  const submit = async (isDraft: boolean) => {
    if (!form.policy_name) { alert("Policy Name cannot be blank !!!"); return; }
    if (!form.working_hours) { alert("working_hours cannot be blank !!!"); return; }
    if (!form.short_hours) { alert("shorthours cannot be blank !!!"); return; }
    
    if (!isDraft && !confirm("Once you Submit you cannot make changes ?")) return;

    setSaving(true); setFormErr(null); setNotice(null);
    // All fields now persist 1:1 with the legacy attandance_police_master (Roll/Transaction/
    // Reminders/Timing/Limit of Hours/Punch Regularization/Period/OD included). Draft keeps
    // submitted=false; Submit sets submitted=true (legacy SUBMIT flag).
    const body: Record<string, any> = {
      ...form,
      working_hours: String(form.working_hours || "8").trim(),
      short_hours: String(form.short_hours || "4").trim(),
      late_in: String(form.late_in != null && form.late_in !== "" ? form.late_in : "0").trim(),
      late_out: String(form.late_out != null && form.late_out !== "" ? form.late_out : "0").trim(),
      early_in: String(form.early_in != null && form.early_in !== "" ? form.early_in : "0").trim(),
      early_out: String(form.early_out != null && form.early_out !== "" ? form.early_out : "0").trim(),
      auto_shift: form.auto_shift === "true" ? "YES" : "NO",
      submitted: !isDraft,
      shifts: shifts.filter(s => (s.in_time || "").trim() !== "" || (s.out_time || "").trim() !== ""),
    };
    if (!body.start_date) body.start_date = null;
    if (!body.end_date) body.end_date = null;

    try {
      const res = form.id ? await updateItem<Policy>(BASE, form.id, body) : await createItem<Policy>(BASE, body);
      if (res.ok) { 
        setNotice(!isDraft ? "Travel Policy Submitted Successfully..." : form.id ? "Attendence Policy Update Successfully..." : "Travel Policy Saved Successfully..."); 
        load();
        setForm({ ...EMPTY });
        setShifts([{ in_time: "", out_time: "" }]);
      }
      else if (res.status === 403) setFormErr("You do not have permission for this action.");
      else {
        const d = (res.data ?? {}) as unknown as Record<string, unknown>;
        setFormErr(typeof d.detail === "string" ? d.detail
          : Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(" · ") || "Save failed.");
      }
    } finally { setSaving(false); }
  };

  const remove = async () => {
    if (!form.id) return;
    if (!confirm(`Are you sure you want to delete this Policy?`)) return;
    const res = await deleteItem(BASE, form.id);
    if (res.ok) { 
      setNotice("Record deleted successfully !!"); 
      load(); 
      setForm({ ...EMPTY });
      setShifts([{ in_time: "", out_time: "" }]);
    }
    else if (res.status === 403) alert("Only administrators can delete.");
    else { const d = (res.data ?? {}) as unknown as Record<string, unknown>; alert(typeof d.detail === "string" ? d.detail : "Record deletion failed !!"); }
  };

  if (authChecked && !me) return <section><h2 style={{ marginTop: 0 }}>Attendance Policies</h2>
    <div style={authBox}>🔐 <strong>Sign in required.</strong>{" "}<Link href="/login" style={btnPrimary}>Go to login</Link></div></section>;

  return (
    <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px", marginBottom: "20px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "8.33%" }}></div>
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
            ATTENDANCE POLICY MASTER
          </div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); window.open("/html/Attendance_policy_master.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }} style={{ color: "#fff", fontSize: "10px" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>
        <div className="panel-body" style={{ padding: "15px" }}>
          <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "15px", marginBottom: "20px" }}>
            <div className="panel panel-primary" style={{ border: "1px solid #337ab7", borderRadius: "4px", padding: "15px", backgroundColor: "#fff" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end" }}>
                <div style={{ flex: 1, minWidth: "150px" }}>
                  <b>Existing Policy Name</b> <span style={{ color: "red" }}>*</span><br/>
                  <select className="form-control" style={inputStyle} value={form.id || "0"} onChange={(e) => selectExistingPolicy(e.target.value)}>
                    <option value="0">--Select--</option>
                    {data?.results.map(p => <option key={p.id} value={p.id}>{p.policy_name}</option>)}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: "150px" }}>
                  <input type="text" className="form-control" style={inputStyle} placeholder="New Policy Name :" value={form.policy_name} onChange={e => setForm({...form, policy_name: e.target.value})} />
                </div>
                <div style={{ flex: 1, minWidth: "150px" }}>
                  <input type="date" className="form-control" style={inputStyle} value={form.start_date || ""} onChange={e => setForm({...form, start_date: e.target.value})} />
                </div>
                <div style={{ flex: 1, minWidth: "150px" }}>
                  <input type="date" className="form-control" style={inputStyle} value={form.end_date || ""} onChange={e => setForm({...form, end_date: e.target.value})} />
                </div>
                <div style={{ flex: 1, minWidth: "150px", fontSize: "12px", fontWeight: "bold" }}>
                  If End Date blank policy will not expire.
                </div>
              </div>
            </div>

            <br />
            
            <ul style={{ listStyle: "none", padding: "20px", margin: 0, background: "#f3f1fe", borderRadius: "10px", display: "flex", gap: "5px", borderBottom: "1px solid #ddd" }}>
              <li style={{ cursor: "pointer", padding: "10px 15px", border: activeTab === "inout" ? "1px solid #ddd" : "none", borderBottom: activeTab === "inout" ? "none" : "", backgroundColor: activeTab === "inout" ? "#fff" : "transparent", fontWeight: "bold" }} onClick={() => setActiveTab("inout")}>
                In/Out Time Details
              </li>
              <li style={{ cursor: "pointer", padding: "10px 15px", border: activeTab === "other" ? "1px solid #ddd" : "none", borderBottom: activeTab === "other" ? "none" : "", backgroundColor: activeTab === "other" ? "#fff" : "transparent", fontWeight: "bold" }} onClick={() => setActiveTab("other")}>
                Other Details
              </li>
            </ul>

            <div style={{ padding: "20px", backgroundColor: "#fff", border: "1px solid #ddd", borderTop: "none" }}>
              {activeTab === "inout" && (
                <div style={{ display: "flex", gap: "20px" }}>
                  <div>
                    <b>In Time :</b><br/>
                    <input
                      type="text"
                      style={inputStyle}
                      placeholder="e.g. 9 or 09"
                      value={shifts[0]?.in_time ?? ""}
                      onChange={e => setShifts([{ in_time: e.target.value, out_time: shifts[0]?.out_time ?? "" }])}
                    />
                  </div>
                  <div>
                    <b>Out Time :</b><br/>
                    <input
                      type="text"
                      style={inputStyle}
                      placeholder="e.g. 18 or 17"
                      value={shifts[0]?.out_time ?? ""}
                      onChange={e => setShifts([{ in_time: shifts[0]?.in_time ?? "", out_time: e.target.value }])}
                    />
                  </div>
                </div>
              )}

              {activeTab === "other" && (
                <div>
                  <div style={rowStyle}>
                    <div style={colStyle}><b>Working Hours :</b> <span style={{ color: "red" }}>*</span></div>
                    <div style={colStyle}><input type="text" style={inputStyle} value={form.working_hours} onChange={e => setForm({...form, working_hours: e.target.value})} /></div>
                    <div style={colStyle}><b>Roll :</b></div>
                    <div style={colStyle}>
                      <select style={inputStyle} value={form.roll} onChange={e => setForm({...form, roll: e.target.value})}>
                        <option value="0">Select</option><option value="1">Glatt</option><option value="2">Third Party</option><option value="3">Peace rate</option>
                      </select>
                    </div>
                    <div style={colStyle}><b>Transaction :</b></div>
                    <div style={colStyle}>
                      <select style={inputStyle} value={form.transaction} onChange={e => setForm({...form, transaction: e.target.value})}>
                        <option value="0">Select</option><option value="1">Pay Sheet</option><option value="2">Invoice Party</option>
                      </select>
                    </div>
                  </div>

                  <div style={rowStyle}>
                    <div style={colStyle}><b>Week Off :</b></div>
                    <div style={colStyle}>
                      <select style={inputStyle} value={form.weak_off} onChange={e => setForm({...form, weak_off: e.target.value})}>
                        <option value="0">Select</option>
                        <option value="1">All_Sunday_and_1_3_Saturday</option>
                        <option value="2">All_Sunday_and_2_4_Saturday</option>
                      </select>
                    </div>
                    <div style={colStyle}><b>Early In :</b></div>
                    <div style={colStyle}><input type="text" style={inputStyle} value={form.early_in} onChange={e => setForm({...form, early_in: e.target.value})} /></div>
                    <div style={colStyle}><b>Early Out :</b></div>
                    <div style={colStyle}><input type="text" style={inputStyle} value={form.early_out} onChange={e => setForm({...form, early_out: e.target.value})} /></div>
                  </div>

                  <div style={rowStyle}>
                    <div style={colStyle}><b>Let_In :</b></div>
                    <div style={colStyle}><input type="text" style={inputStyle} value={form.late_in} onChange={e => setForm({...form, late_in: e.target.value})} /></div>
                    <div style={colStyle}><b>Let_Out :</b></div>
                    <div style={colStyle}><input type="text" style={inputStyle} value={form.late_out} onChange={e => setForm({...form, late_out: e.target.value})} /></div>
                    <div style={colStyle}><b>Reminders:</b></div>
                    <div style={colStyle}>
                      <select style={inputStyle} value={form.reminders} onChange={e => setForm({...form, reminders: e.target.value})}>
                        <option value="0">Select</option><option value="1">Daily</option><option value="2">Weekly Party</option><option value="3">Monthly</option>
                      </select>
                    </div>
                  </div>

                  <div style={rowStyle}>
                    <div style={colStyle}><b>Deduction Policy :</b></div>
                    <div style={colStyle}><input type="text" style={inputStyle} value={form.deduction_policy} onChange={e => setForm({...form, deduction_policy: e.target.value})} /></div>
                    <div style={colStyle}><b>Short Hours :</b> <span style={{ color: "red" }}>*</span></div>
                    <div style={colStyle}><input type="text" style={inputStyle} value={form.short_hours} onChange={e => setForm({...form, short_hours: e.target.value})} /></div>
                    <div style={colStyle}><b>Gender :</b></div>
                    <div style={colStyle}>
                      <select style={inputStyle} value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}>
                        <option value="0">Male</option><option value="1">Female</option>
                      </select>
                    </div>
                  </div>

                  <div style={rowStyle}>
                    <div style={colStyle}><b>Timings :</b></div>
                    <div style={colStyle}><input type="text" style={inputStyle} value={form.timing} onChange={e => setForm({...form, timing: e.target.value})} /></div>
                    <div style={colStyle}><b>Limit of Hours :</b></div>
                    <div style={colStyle}><input type="text" style={inputStyle} value={form.limits_of_hours} onChange={e => setForm({...form, limits_of_hours: e.target.value})} /></div>
                    <div style={colStyle}><b>Punch Regularization :</b></div>
                    <div style={colStyle}><input type="text" style={inputStyle} value={form.punch_regularization} onChange={e => setForm({...form, punch_regularization: e.target.value})} /></div>
                  </div>

                  <div style={rowStyle}>
                    <div style={colStyle}><b>Period :</b></div>
                    <div style={colStyle}><input type="text" style={inputStyle} value={form.period} onChange={e => setForm({...form, period: e.target.value})} /></div>
                    <div style={colStyle}><b>OD :</b></div>
                    <div style={colStyle}>
                      <select style={inputStyle} value={form.od} onChange={e => setForm({...form, od: e.target.value})}>
                        <option value="0">Select</option><option value="1">YES</option><option value="2">NO</option>
                      </select>
                    </div>
                    <div style={colStyle}><b>Minimum OT hrs :</b></div>
                    <div style={colStyle}><input type="text" style={inputStyle} value={form.minimum_ot_hours} onChange={e => setForm({...form, minimum_ot_hours: e.target.value})} /></div>
                  </div>

                  <div style={rowStyle}>
                    <div style={colStyle}><b>Max OT Hrs :</b></div>
                    <div style={colStyle}><input type="text" style={inputStyle} value={form.max_ot_hours} onChange={e => setForm({...form, max_ot_hours: e.target.value})} /></div>
                    <div style={colStyle}><b>Approval Required :</b></div>
                    <div style={colStyle}>
                      <select style={inputStyle} value={form.approval_required} onChange={e => setForm({...form, approval_required: e.target.value})}>
                        <option value="0">Select</option><option value="1">YES</option><option value="2">NO</option>
                      </select>
                    </div>
                    <div style={colStyle}><b>Comp Off :</b></div>
                    <div style={colStyle}><input type="text" style={inputStyle} value={form.comp_off} onChange={e => setForm({...form, comp_off: e.target.value})} /></div>
                  </div>

                  <div style={rowStyle}>
                    <div style={colStyle}><b>OT Rate :</b></div>
                    <div style={colStyle}><input type="text" style={inputStyle} value={form.ot_rate} onChange={e => setForm({...form, ot_rate: e.target.value})} /></div>
                    <div style={colStyle}><b>General Remarks :</b></div>
                    <div style={colStyle}><input type="text" style={inputStyle} value={form.general_remark} onChange={e => setForm({...form, general_remark: e.target.value})} /></div>
                    <div style={colStyle}><b>Auto Shift :</b></div>
                    <div style={colStyle}><input type="checkbox" checked={form.auto_shift === "true"} onChange={e => setForm({...form, auto_shift: e.target.checked ? "true" : "false"})} /></div>
                  </div>
                </div>
              )}
            </div>

            <div style={{ textAlign: "center", marginTop: "40px", fontSize: "14px" }}>
              Note: You can save as Draft many times as you want but once you submit you cannot make changes.<br/>
              After Submit Successfully Then You Get Details In Apply Travelling Plan.
            </div>

            {notice && <p style={{ color: "#166534", background: "#dcfce7", padding: "10px", borderRadius: "6px", textAlign: "center", marginTop: "20px" }}>{notice}</p>}
            {formErr && <p style={{ color: "crimson", textAlign: "center", marginTop: "20px" }}>{formErr}</p>}

            <div style={{ display: "flex", justifyContent: "center", gap: "10px", marginTop: "30px" }}>
              <button style={btnDefault} onClick={() => submit(true)} disabled={saving}>{form.id ? "Update" : "Save as Draft"}</button>
              <button style={btnPrimary} onClick={() => submit(false)} disabled={saving}>Submit</button>
              {form.id && <button style={btnPrimary} onClick={remove} disabled={saving}>Delete</button>}
              <button style={btnDanger} onClick={() => { window.location.href = "/"; }}>Close</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const inputStyle: CSSProperties = { width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px", boxSizing: "border-box", height: "34px" };
const rowStyle: CSSProperties = { display: "flex", flexWrap: "wrap", marginBottom: "15px", alignItems: "center" };
const colStyle: CSSProperties = { flex: "0 0 16.666667%", maxWidth: "16.666667%", padding: "0 15px", boxSizing: "border-box" };
const btnDefault: CSSProperties = { padding: "10px 16px", fontSize: "18px", borderRadius: "6px", border: "1px solid #ccc", background: "#fff", cursor: "pointer" };
const btnPrimary: CSSProperties = { padding: "6px 12px", fontSize: "14px", borderRadius: "4px", border: "1px solid #2e6da4", background: "#337ab7", color: "#fff", cursor: "pointer" };
const btnDanger: CSSProperties = { padding: "6px 12px", fontSize: "14px", borderRadius: "4px", border: "1px solid #d43f3a", background: "#d9534f", color: "#fff", cursor: "pointer" };
const authBox: CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", padding: 16, borderRadius: 8, fontSize: 14, maxWidth: 560 };
