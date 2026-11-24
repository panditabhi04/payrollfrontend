"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getJSON, mk, patchJSON, rm } from "@/lib/api/legacy-fetch";

// Old travel_policy_master.aspx — Travel Policy Master (1:1 with the legacy master
// screen: NO New button, Unit field, assignment block or policy grid — those live
// on other screens in the legacy app).
// Header: "Existing Policy Name" dropdown (select = new, pick = edit) + Policy Name
// + Start/End dates. Bootstrap justified tab buttons (Travel Mode / Approval /
// Lodging & Boarding with Food Service / Claims / Payment), white well content,
// bordered mode table, checkboxes with conditional amount boxes (Bus / Owned
// Vehicle / Local Conveyance / Hotel / Fooding / Expenses). Save as Draft / Submit
// / Delete / Close.
const POL = () => "/api/masters/travel-policies/";

const CHECKS_ON = ["chk_bus", "chk_owned_vehicle", "cb_car", "cb_bike", "chk_local_conveyance",
  "cb_ac", "cb_nonac", "cb_citybus", "chk_hotel", "chk_fooding", "chk_expenses_allowed",
  "hotel_budget", "hotel_standard", "hotel_twostar", "hotel_threestar", "hotel_fivestar",
  "breakfast", "cb_lunch", "cb_dinner", "cb_inside", "cb_outside"];
// Every checkbox field — sent as "1"/"0" so an UNCHECK propagates on edit (plain empty
// values are dropped from the body, which previously made unchecking impossible).
const CHECKBOX_KEYS = new Set<string>([
  "chk_air", "chk_bus", "chk_train_t1", "chk_train_t2", "chk_train_t3", "chk_cabtaxi", "chk_auto",
  "cb_ac", "cb_nonac", "cb_citybus", "chk_owned_vehicle", "cb_car", "cb_bike", "chk_local_conveyance",
  "chk_auto_approval", "chk_escalation_approval", "chk_app_cancel_if_approved", "chk_app_cancel_if_ticket_confirmed",
  "chk_hotel", "chk_fooding", "chk_expenses_allowed", "hotel_budget", "hotel_standard", "hotel_twostar",
  "hotel_threestar", "hotel_fivestar", "chk_laundry", "breakfast", "cb_lunch", "cb_dinner",
  "cb_inside", "cb_outside", "chk_female_upgrade",
  "chk_payment_air", "chk_payment_bus", "chk_payment_train", "chk_payment_taxi", "chk_payment_hotel",
]);
const blank = () => {
  const f: Record<string, string> = {
    policy_name: "", unit_code: "", start_date: "", end_date: "",
    chk_air: "", chk_bus: "", cb_ac: "", cb_nonac: "", cb_citybus: "",
    ac: "", nonac: "", citybus: "", chk_train_t1: "", chk_train_t2: "", chk_train_t3: "",
    chk_cabtaxi: "", chk_auto: "", chk_owned_vehicle: "", cb_car: "", v_car: "",
    cb_bike: "", v_bike: "", owned_vehicle_kms: "", chk_local_conveyance: "",
    local_conveyance_limit: "", approval_level: "", approval_days_before: "",
    chk_auto_approval: "", app_days_before_travel: "", chk_escalation_approval: "",
    app_escalation_approval: "", app_escalation_level: "", not_approved_emailid: "",
    chk_app_cancel_if_approved: "", chk_app_cancel_if_ticket_confirmed: "",
    cancellation_days: "", exception_case_approval_level: "", chk_hotel: "",
    hotel_budget: "", hotel_budget_from: "", hotel_budget_to: "", hotel_standard: "",
    hotel_standard_from: "", hotel_standard_to: "", hotel_twostar: "", hotel_twostar_from: "",
    hotel_twostar_to: "", hotel_threestar: "", hotel_threestar_from: "", hotel_threestar_to: "",
    hotel_fivestar: "", hotel_fivestar_from: "", hotel_fivestar_to: "", chk_laundry: "",
    chk_fooding: "", cb_breakfast: "", breakfast: "", cb_lunch: "", lunch: "",
    cb_dinner: "", dinner: "", chk_expenses_allowed: "", cb_inside: "", per_day_limit: "",
    cb_outside: "", outside_limit: "", chk_female_upgrade: "", female_percent: "",
    claim_max_days: "", late_claim_days: "", claim_exception_case: "",
    payment_process_days: "", chk_payment_air: "", chk_payment_bus: "",
    chk_payment_train: "", chk_payment_taxi: "", chk_payment_hotel: "",
  };
  CHECKS_ON.forEach((k) => { f[k] = "1"; });
  return f;
};
const isChecked = (v: unknown) => ["1", "true", "True", "Y", "y"].includes(String(v ?? ""));

interface Policy { id: number; policy_name: string; unit_code?: string; submit: number; assigned_count: number; [k: string]: unknown }

export default function TravelPolicyPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Policy[]>([]);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState<Record<string, string>>(blank());
  const [editingId, setEditingId] = useState<number | null>(null);
  const [tab, setTab] = useState("tab1");

  const load = useCallback(async () => {
    const data = await getJSON<{ results: Policy[] } | Policy[]>(POL());
    setRows((Array.isArray(data) ? data : data?.results ?? []) as Policy[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const editing = rows.find((p) => p.id === editingId) ?? null;
  const locked = !!editing && (editing.submit === 1 || (editing.assigned_count ?? 0) > 0);

  const onNew = () => { setForm(blank()); setEditingId(null); setMsg(""); };
  const onSelectExisting = (v: string) => {
    if (!v) { onNew(); return; }
    const p = rows.find((r) => String(r.id) === v);
    if (!p) return;
    const f = blank();
    Object.keys(f).forEach((k) => { f[k] = p[k] === null || p[k] === undefined ? "" : String(p[k]); });
    setForm(f); setEditingId(p.id); setMsg("");
  };

  const readMsg = async (r: Response) => {
    try {
      const b = await r.json();
      const pick = (v: unknown): string => Array.isArray(v) ? pick(v[0]) : (v && typeof v === "object")
        ? pick((v as Record<string, unknown>).detail ?? (v as Record<string, unknown>).non_field_errors ?? Object.values(v as object)[0])
        : String(v ?? "");
      return pick(b) || `Failed (${r.status})`;
    }
    catch { return `Failed (${r.status})`; }
  };
  const numOnly = (v: string) => v.replace(/[^0-9.]/g, "");

  const save = async () => {
    // Legacy validate() — verbatim order + messages.
    if (!form.policy_name.trim()) { alert("Policy Name cannot be blank !!!"); return; }
    if (!form.start_date) { alert("Please Select Start Date !!!"); return; }
    if (!form.end_date) { alert("Please Select End Date !!!"); return; }
    if (!String(form.approval_level ?? "").trim()) { alert("Approval level cannot be blank !!!"); return; }
    // Legacy validate() also tests the Approval Email / Par Day Limit boxes, but the email box is
    // Visible=false server-side so the script throws there and the postback proceeds - they are
    // therefore not enforced.
    // Checkboxes are always sent as "1"/"0" (so an uncheck sticks on edit); numeric/text
    // fields are sent only when non-empty (empty would fail numeric validation / keep default).
    const body: Record<string, string> = {};
    Object.entries(form).forEach(([k, v]) => {
      if (CHECKBOX_KEYS.has(k)) body[k] = isChecked(v) ? "1" : "0";
      else if (v !== "") body[k] = v;
    });
    const r = editingId ? await patchJSON(`${POL()}${editingId}/`, body) : await mk(POL(), body);
    if (r.ok) {
      const saved = await r.json().catch(() => ({}));
      const t = editingId ? "Travel Policy Update Successfully..." : "Travel Policy Saved Successfully...";
      setMsg(t); window.alert(t);
      const id = (saved as Policy).id ?? editingId;
      setEditingId(id ?? null);
      if (!editingId && id) onSelectExisting(String(id)); else load();
    } else { const t = await readMsg(r); setMsg(t); window.alert(t); }
  };
  const submit = async (id?: number) => {
    const pid = id ?? editingId;
    // btn_submit_Click: 'Please Select Policy' when no existing policy is chosen
    if (!pid) { window.alert("Please Select Policy"); return; }
    if (!window.confirm("Once you Submit you cannot make changes ?")) return;
    const r = await mk(`${POL()}${pid}/submit/`, {});
    const t = r.ok ? "Travel Policy Submitted Successfully..." : await readMsg(r);
    setMsg(t); window.alert(t);
    load();
  };
  const del = async () => {
    if (!editingId) return;
    if (!window.confirm("Are you sure you want to delete this Policy?")) return;
    const r = await rm(`${POL()}${editingId}/`);
    if (r.ok) { setMsg("Record deleted successfully !!"); window.alert("Record deleted successfully !!"); onNew(); load(); }
    else {
      const t = await readMsg(r);
      const out = /already assigned/i.test(t) ? t : "Record deletion failed !!";
      setMsg(out); window.alert(out);
    }
  };
  const set = (k: string, v: string) => setForm({ ...form, [k]: v });
  const C = (k: string, label: React.ReactNode) => (
    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: "bold" }}>
      <input type="checkbox" checked={isChecked(form[k])} disabled={locked}
        onChange={(e) => set(k, e.target.checked ? "1" : "")} style={{ width: 16, height: 16 }} />{label}
    </label>
  );
  const T = (k: string, placeholder?: string, w = 160) => (
    <input value={form[k] ?? ""} disabled={locked} placeholder={placeholder}
      onChange={(e) => set(k, numOnly(e.target.value))} className="form-control" style={{ width: w }} />
  );
  const busOn = isChecked(form.chk_bus);
  const ownOn = isChecked(form.chk_owned_vehicle);
  const localOn = isChecked(form.chk_local_conveyance);
  const hotelOn = isChecked(form.chk_hotel);
  const foodOn = isChecked(form.chk_fooding);
  const expOn = isChecked(form.chk_expenses_allowed);

  const TABS = [
    { id: "tab1", label: "Travel Mode" }, { id: "tab2", label: "Approval" },
    { id: "tab3", label: "Lodging & Boarding with Food Service" },
    { id: "tab4", label: "Claims" }, { id: "tab5", label: "Payment" },
  ];
  const band = (ck: string, label: string, fk: string, tk: string) => (
    <div className="row" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
      <div style={{ minWidth: 110 }}>{C(ck, <b>{label}</b>)}</div>
      <div><b>From</b></div><div>{T(fk, "Limit/PerDay", 130)}</div>
      <div><b>To</b></div><div>{T(tk, "Limit/PerDay", 130)}</div>
    </div>
  );

  return (
    <div className="container-fluid">
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: 4 }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px" }}>
          <div className="row" style={{ display: "flex", alignItems: "center" }}>
            <div style={{ flex: "0 0 8.33%" }}></div>
            <div style={{ flex: "0 0 75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
              Travel Policy Master
            </div>
            <div style={{ flex: "0 0 16.66%", textAlign: "right" }}>
              <Link href="#" onClick={(e) => { e.preventDefault(); window.open("/html/travel_policy_master.html", "popUpWindow", "height=500,width=600,left=100,top=100"); }} style={{ color: "#fff", fontSize: 10 }}>
                <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
              </Link>
            </div>
          </div>
        </div>
        <div className="panel-body" style={{ padding: 15 }}>
          {msg && <div style={{ color: "#424D7A", fontWeight: "bold", margin: "8px 0" }}>{msg}</div>}
          <div className="container-fluid" style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: 10, padding: 15, marginBottom: 12 }}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
              <div style={{ minWidth: 220 }}>
                <b>Existing Policy Name </b><span style={{ color: "red" }}> * </span>
                <select value={editingId ? String(editingId) : ""} onChange={(e) => onSelectExisting(e.target.value)} className="form-control" style={{ width: "100%", height: 34 }}>
                  <option value="">Select</option>
                  {rows.map((p) => (<option key={p.id} value={p.id}>{p.policy_name}</option>))}
                </select>
              </div>
              <div style={{ minWidth: 200 }}>
                <b>Policy Name</b>
                <input value={form.policy_name} disabled={locked} placeholder="New Policy Name" onChange={(e) => set("policy_name", e.target.value)} className="form-control" style={{ width: "100%", height: 34 }} />
              </div>
              <div>
                <b>Start Date</b>
                <input type="date" value={form.start_date} disabled={locked} onChange={(e) => set("start_date", e.target.value)} className="form-control" style={{ height: 34 }} />
              </div>
              <div>
                <b>End Date</b>
                <input type="date" value={form.end_date} disabled={locked} onChange={(e) => set("end_date", e.target.value)} className="form-control" style={{ height: 34 }} />
              </div>
            </div>
            {locked && <div style={{ color: "#a00", fontWeight: "bold", marginTop: 8 }}>Submitted/assigned policy cannot be changed.</div>}
          </div>

          <div className="btn-pref btn-group btn-group-justified" role="group" style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {TABS.map((t) => (
              <button key={t.id} type="button" onClick={() => setTab(t.id)}
                className="btn" style={{ flex: 1, padding: "12px 6px", fontWeight: "bold", borderRadius: 4, border: "1px solid #2e6da4", cursor: "pointer",
                  background: tab === t.id ? "#337ab7" : "#fff", color: tab === t.id ? "#fff" : "#333" }}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="well" style={{ backgroundColor: "white", border: "1px solid #e3e3e3", borderRadius: 4, padding: 19, marginBottom: 20, boxShadow: "inset 0 1px 1px rgba(0,0,0,.05)" }}>
            {tab === "tab1" && (
              <div>
                <b>1. Mode Allowed : </b>
                <table border={1} className="table table-responsive lg-grid" style={{ background: "#fff" }}>
                  <tbody><tr>
                    <td>{C("chk_air", "Air")}</td><td>{C("chk_bus", "Bus")}</td>
                    <td>{C("chk_train_t1", "Train AC Tier1")}</td><td>{C("chk_train_t2", "Train AC Tier2")}</td>
                    <td>{C("chk_train_t3", "Train AC Tier3")}</td><td>{C("chk_cabtaxi", "Cab/Taxi")}</td>
                    <td>{C("chk_auto", "Auto")}</td>
                  </tr></tbody>
                </table>
                {busOn && (
                  <>
                    <div className="row" style={{ display: "flex", gap: 24, marginBottom: 8, flexWrap: "wrap" }}>
                      <div>{C("cb_ac", "AC")}</div><div>{C("cb_nonac", "Non AC")}</div><div>{C("cb_citybus", "City Bus")}</div>
                    </div>
                    <div className="row" style={{ display: "flex", gap: 24, marginBottom: 12, flexWrap: "wrap" }}>
                      <div>{T("ac", "0", 140)}</div><div>{T("nonac", "0", 140)}</div><div>{T("citybus", "0", 140)}</div>
                    </div>
                  </>
                )}
                <div className="row" style={{ display: "flex", gap: 24, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                  <div><b>2.</b> {C("chk_owned_vehicle", "Owned Vehicle")}</div>
                  <div>{C("cb_car", "Car")}</div><div>{C("cb_bike", "Bike")}</div>
                </div>
                {ownOn && (
                  <div className="row" style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                    <div>{T("v_car", "0", 140)}</div><div>{T("v_bike", "0", 140)}</div>
                    <div>{T("owned_vehicle_kms", "Kilometer/PerDay", 160)}</div>
                  </div>
                )}
                <div className="row" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div><b>3.</b> {C("chk_local_conveyance", "Local Conveyance allowed(Rs)?")}</div>
                  {localOn && <div>{T("local_conveyance_limit", "local conveyance", 160)}</div>}
                </div>
              </div>
            )}

            {tab === "tab2" && (
              <div>
                <div className="row" style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                  <div><b>Approval Level : </b><span style={{ color: "red" }}>*</span></div>
                  <div>{T("approval_level", "0", 140)}</div>
                  <div><b>Approval days Before travel :</b></div>
                  <div>{T("approval_days_before", "0", 140)}</div>
                </div>
                <div className="row" style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                  <div>{C("chk_auto_approval", "Auto Approval allowed?")}</div>
                  <div>{T("app_days_before_travel", "Days before travel", 160)}</div>
                </div>
                <div className="row" style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                  <div>{C("chk_escalation_approval", "Escalation for Approval allowed?")}</div>
                  <div>{T("app_escalation_approval", "Days before travel", 160)}</div>
                  {/* escalation level / approval e-mail / cancel flags / cancellation days / exception level are
                      Visible=false in the legacy page (Page_Load) and therefore not rendered here either */}
                </div>
              </div>
            )}

            {tab === "tab3" && (
              <div>
                <div className="row" style={{ display: "flex", gap: 24, marginBottom: 12, flexWrap: "wrap" }}>
                  <div>{C("chk_hotel", "Hotel accommodation?")}</div>
                  <div>{C("chk_fooding", "Fooding")}</div>
                  <div>{C("chk_expenses_allowed", "Expenses allowed?")}</div>
                </div>
                {hotelOn && (
                  <>
                    {band("hotel_budget", "Budget:", "hotel_budget_from", "hotel_budget_to")}
                    {band("hotel_standard", "Standard:", "hotel_standard_from", "hotel_standard_to")}
                    {band("hotel_twostar", "2 Star:", "hotel_twostar_from", "hotel_twostar_to")}
                    {band("hotel_threestar", "3 Star:", "hotel_threestar_from", "hotel_threestar_to")}
                    {band("hotel_fivestar", "5 Star:", "hotel_fivestar_from", "hotel_fivestar_to")}
                    <div style={{ marginBottom: 12 }}>{C("chk_laundry", "Laundry")}</div>
                  </>
                )}
                {foodOn && (
                  <>
                    <div className="row" style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 110 }}>{C("breakfast", "BreakFast:")}</div><div>{T("cb_breakfast", "Limit/PerDay", 130)}</div>
                    </div>
                    <div className="row" style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 110 }}>{C("cb_lunch", "Lunch:")}</div><div>{T("lunch", "Limit/PerDay", 130)}</div>
                    </div>
                    <div className="row" style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 110 }}>{C("cb_dinner", "Dinner:")}</div><div>{T("dinner", "Limit/PerDay", 130)}</div>
                    </div>
                  </>
                )}
                {expOn && (
                  <>
                    <div className="row" style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 110 }}>{C("cb_inside", "Inside City:")}</div><div>{T("per_day_limit", "Limit/PerDay", 130)}</div>
                    </div>
                    <div className="row" style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
                      <div style={{ minWidth: 110 }}>{C("cb_outside", "Outside City:")}</div><div>{T("outside_limit", "Limit/PerDay", 130)}</div>
                    </div>
                  </>
                )}
                <div className="row" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div>{C("chk_female_upgrade", "Female Upgradation?")}</div>
                  <div><b>In % :</b></div><div>{T("female_percent", "", 100)}</div>
                </div>
              </div>
            )}

            {tab === "tab4" && (
              <div>
                <div className="row" style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 300 }}><b>Claims to be submitted max in days after travel date : </b></div>
                  <div>{T("claim_max_days", "", 140)}</div>
                </div>
                <div className="row" style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 300 }}><b>Late claim escalation levels : </b></div>
                  <div>{T("late_claim_days", "", 140)}</div>
                </div>
                <div className="row" style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <div style={{ minWidth: 300 }}><b>Claim exception case days : </b></div>
                  <div>{T("claim_exception_case", "", 140)}</div>
                </div>
              </div>
            )}

            {tab === "tab5" && (
              <div>
                <div className="row" style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                  <div style={{ minWidth: 300 }}><b>Number of days to process payment : </b></div>
                  <div>{T("payment_process_days", "", 140)}</div>
                </div>
                <div><b>To be paid by company : </b></div>
                <div className="row" style={{ display: "flex", gap: 24, marginTop: 8, flexWrap: "wrap" }}>
                  <div>{C("chk_payment_air", "Air")}</div><div>{C("chk_payment_bus", "Bus")}</div>
                  <div>{C("chk_payment_train", "Train")}</div><div>{C("chk_payment_taxi", "Taxi")}</div>
                  <div>{C("chk_payment_hotel", "Hotel")}</div>
                </div>
              </div>
            )}
          </div>

          <div style={{ margin: "10px 0", fontWeight: "bold" }}>
            Note: You can save as Draft many times as you want but once you submit you cannot make changes.
          </div>
          <div className="lg-btns center">
            {!locked && <button onClick={save} className="btn btn-primary lg-btn-primary" style={{ width: "15%", minWidth: 130 }}>Save as Draft</button>}
            {!locked && <button onClick={() => submit()} className="btn btn-primary lg-btn-primary">Submit</button>}
            {editingId && <button onClick={del} className="btn btn-primary lg-btn-primary">Delete</button>}
            <button onClick={() => router.push("/")} className="btn btn-danger lg-btn-danger">Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
