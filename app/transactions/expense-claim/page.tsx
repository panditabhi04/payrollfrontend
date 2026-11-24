"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getJSON, mk, patchJSON, rm, upload } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";
import {
  TravelPolicy, isOn, modeOptions, typeOptions, presetAmountForType, cityOptions,
  perDayLimit, cityLabel, fmtDDMMYYYY, todayISO, daysBetween, rangesOverlap,
  isNumberKey, isLetterKey, isAddressKey, MSG, overLimit, overPerDay, overPerDay2,
  actualOverPerDay, hotelGreater, hotelLess, planExists, claimDateExists, policyBetween,
} from "@/lib/travel/travel-legacy";

/* Legacy apply_expencess.aspx (own grid) + p_add_new_travel_plan2.aspx (New Travelling
   Plan popup) + p_add_expencess1.aspx (New Claim Expense popup).
   Tables: apply_travel_plan + pay_add_expenses.
   All alert/confirm strings are verbatim copies of the legacy JavaScript. */

const TP = () => "/api/transactions/travel-plans/";
const EC = () => "/api/transactions/expense-claims/";
const MY_POLICY = () => "/api/masters/travel-emp-policies/my_policy/";

interface Plan {
  id: number; expenses_id: string; emp_code: string; emp_name: string;
  travel_mode: string; type: string; travel_type: string;
  from_designation: string; to_designation: string;
  from_date?: string | null; to_date?: string | null;
  exception_case: string; adv_amount: string; currency: string; total_km: string;
  city_type: string; add_description: string; comments?: string;
  expense_status: string; modified_by?: string; created_at?: string;
}
interface Claim {
  id: number; expenses_id: string; emp_code: string;
  date?: string | null; merchant: string; amount: string;
  description?: string; status: string; comments?: string;
  app_amount?: string; particular?: string; type?: string; travel_type?: string;
  travel_amount?: string; city_type?: string; attachment?: string | null;
  modified_by?: string; created_at?: string;
}

async function fetchAll<T>(path: string): Promise<T[]> {
  const out: T[] = [];
  let url: string | null = `${API_BASE_URL}${path}`;
  let guard = 0;
  while (url && guard < 100) {
    guard += 1;
    const r: Response = await fetch(url, { credentials: "include", cache: "no-store" });
    if (!r.ok) break;
    const b: any = await r.json();
    if (Array.isArray(b)) { out.push(...(b as T[])); break; }
    out.push(...((b?.results ?? []) as T[]));
    url = (b?.next as string | null) || null;
  }
  return out;
}

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export default function ExpenseClaimPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [policy, setPolicy] = useState<TravelPolicy | null>(null);
  const [policyChecked, setPolicyChecked] = useState(false);
  const [msg, setMsg] = useState("");
  const [travelModal, setTravelModal] = useState<string | null>(null); // expenses_id or "" for new
  const [claimModal, setClaimModal] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([fetchAll<Plan>(TP()), fetchAll<Claim>(EC())]);
    setPlans(p); setClaims(c);
  }, []);
  const loadPolicy = useCallback(async () => {
    const d = await getJSON<{ policy: TravelPolicy }>(MY_POLICY());
    setPolicy(d?.policy ?? null);
    setPolicyChecked(true);
  }, []);

  useEffect(() => { load(); loadPolicy(); }, [load, loadPolicy]);

  const needPolicy = useCallback(() => {
    if (!policyChecked) return true; // still loading — caller re-checks after load
    if (!policy) {
      alert(MSG.POLICY_MISSING);
      return true;
    }
    return false;
  }, [policy, policyChecked]);

  const openTravel = (ep: string) => {
    if (needPolicy()) { loadPolicy(); return; }
    if (!policy) { alert(MSG.POLICY_MISSING); return; }
    setTravelModal(ep);
  };
  const openClaim = (ep: string) => {
    if (!policyChecked) { loadPolicy(); return; }
    if (!policy) { alert(MSG.POLICY_MISSING); return; }
    setClaimModal(ep);
  };

  /* ---- combined own grid, grouped by expenses_id like the legacy SQL ---- */
  const groups = useMemo(() => {
    type G = {
      key: string; ep: string; legs: Plan[]; claims: Claim[];
      mode: string; from: string; to: string; fromDate: string; toDate: string;
      travelComments: string; travelStatus: string;
      claimAmt: number; appAmt: number; claimStatus: string; claimComments: string; claimDate: string;
    };
    const map = new Map<string, G>();
    const mk = (key: string, ep: string): G => ({
      key, ep, legs: [], claims: [], mode: "", from: "", to: "", fromDate: "", toDate: "",
      travelComments: "", travelStatus: "", claimAmt: 0, appAmt: 0,
      claimStatus: "", claimComments: "", claimDate: "",
    });
    for (const p of plans) {
      const ep = (p.expenses_id || "").trim();
      const key = ep || `P${p.id}`;
      if (!map.has(key)) map.set(key, mk(key, ep));
      map.get(key)!.legs.push(p);
    }
    for (const c of claims) {
      const ep = (c.expenses_id || "").trim();
      const key = ep || `C${c.id}`;
      if (!map.has(key)) map.set(key, mk(key, ep));
      map.get(key)!.claims.push(c);
    }
    const rows = [...map.values()];
    for (const g of rows) {
      g.legs.sort((a, b) => a.id - b.id);
      const first = g.legs[0];
      const last = g.legs[g.legs.length - 1];
      if (first) {
        g.mode = [...new Set(g.legs.map((l) => l.travel_mode).filter(Boolean))].join(", ");
        g.from = first.from_designation || "";
        g.to = last?.to_designation || "";
        g.fromDate = fmtDDMMYYYY(first.from_date);
        g.toDate = fmtDDMMYYYY(last?.to_date);
        g.travelComments = last?.comments || first.comments || "";
        g.travelStatus = first.expense_status || "";
      }
      if (g.claims.length) {
        g.claimAmt = g.claims.reduce((s, c) => s + num(c.amount), 0);
        g.appAmt = g.claims.reduce((s, c) => s + (String(c.status) === "Approved" ? num(c.app_amount) : 0), 0);
        g.claimStatus = [...new Set(g.claims.map((c) => c.status).filter(Boolean))].join(", ");
        const withC = g.claims.find((c) => (c.comments || "").trim());
        g.claimComments = withC?.comments || "";
        const dates = g.claims.map((c) => c.created_at || "").filter(Boolean).sort();
        g.claimDate = fmtDDMMYYYY(dates[dates.length - 1]?.slice(0, 10));
      }
    }
    return rows;
  }, [plans, claims]);

  const deleteGroup = async (ep: string, key: string) => {
    if (!window.confirm(MSG.DEL_PLAN)) return;
    const g = groups.find((x) => x.key === key);
    if (!g) return;
    let failed = "";
    for (const l of g.legs) {
      const r = await rm(`${TP()}${l.id}/`).catch(() => null);
      if (!r || !r.ok) failed = failed || (r ? await readErr(r) : "Delete failed.");
    }
    for (const c of g.claims) {
      const r = await rm(`${EC()}${c.id}/`).catch(() => null);
      if (!r || !r.ok) failed = failed || (r ? await readErr(r) : "Delete failed.");
    }
    if (failed) alert(failed);
    load();
  };

  return (
    <div>
      <div className="tv-panel">
        <div className="tv-head">
          <div className="tv-head-row">
            <div className="tv-head-side"></div>
            <div className="tv-head-title">
              Add Travel Plan
            </div>
            <div className="tv-head-help">
              <a href="#" onClick={(e) => { e.preventDefault(); window.open("html/add_travel_plan.html", "popUpWindow", "height=500,width=600,left=100,top=100"); }}>
                <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
              </a>
            </div>
          </div>
        </div>
        <div className="tv-body">
          {msg && <div className="tv-msg">{msg}</div>}

              <div className="tv-links-row">
                <div>
                  <span className="tv-plus">+</span>{" "}
                  <a href="#" onClick={(e) => { e.preventDefault(); openTravel(""); }} className="tv-link">New Travelling Plan</a>
                </div>
                <div style={{ textAlign: "right" }}>
                  <a href="#" onClick={(e) => { e.preventDefault(); openClaim(""); }} className="tv-link">New Claim Expense</a>{" "}
                  <span className="tv-plus">+</span>
                </div>
              </div>
              <br /><br />
              <div className="tv-scroll" style={{ maxHeight: 300, overflowY: "auto" }}>
                <table className="tv-table" style={{ background: "#fff" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#006699", color: "#fff", fontWeight: "bold", textTransform: "uppercase" }}>
                      <th>Mode</th><th>From</th><th>To</th><th>From Date</th><th>To Date</th>
                      <th>Reject Reason of Travel</th><th>Travel Status</th><th>Claim Amt</th>
                      <th>Approved Amt</th><th>Claim Status</th><th>Reject Reason of Claim</th>
                      <th>Claim Date</th><th>Travelling Expense</th><th>Delete</th><th>Claim Expense</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g.key} style={{ color: "#000066" }}>
                        <td>{g.mode}</td><td>{g.from}</td><td>{g.to}</td>
                        <td>{g.fromDate}</td><td>{g.toDate}</td>
                        <td>{g.travelComments}</td><td>{g.travelStatus}</td>
                        <td>{g.claimAmt || ""}</td><td>{g.appAmt || ""}</td>
                        <td>{g.claimStatus}</td><td>{g.claimComments}</td><td>{g.claimDate}</td>
                        <td><a href="#" onClick={(e) => { e.preventDefault(); openTravel(g.ep); }}>Edit Travel Plan</a></td>
                        <td><a href="#" onClick={(e) => { e.preventDefault(); deleteGroup(g.ep, g.key); }}>Delete</a></td>
                        <td><a href="#" onClick={(e) => { e.preventDefault(); openClaim(g.ep); }}>Edit Claim Expense</a></td>
                      </tr>
                    ))}
                    {groups.length === 0 && <tr><td colSpan={15} style={{ textAlign: "center" }}>No travel plans</td></tr>}
                  </tbody>
                </table>
              </div>
              <br />
              <div className="tv-center">
                <button className="tv-btn tv-btn-danger" onClick={() => router.push("/Home")}>Close</button>
              </div>
        </div>
      </div>

      {travelModal !== null && (
        <TravelPlanModal
          expensesId={travelModal} policy={policy} allPlans={plans}
          onClose={() => { setTravelModal(null); load(); }}
        />
      )}
      {claimModal !== null && (
        <ClaimExpenseModal
          expensesId={claimModal} policy={policy} allPlans={plans} allClaims={claims}
          onClose={() => { setClaimModal(null); load(); }}
        />
      )}
    </div>
  );
}

/* ================= New Travelling Plan (p_add_new_travel_plan2) ================= */

function TravelPlanModal({ expensesId, policy, allPlans, onClose }: {
  expensesId: string; policy: TravelPolicy | null; allPlans: Plan[]; onClose: () => void;
}) {
  const [ep, setEp] = useState(expensesId);
  const [city, setCity] = useState("Select");
  const [mode, setMode] = useState("Select");
  const [exception, setException] = useState(false);
  const [type, setType] = useState("Select");
  const [destFrom, setDestFrom] = useState("");
  const [destTo, setDestTo] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [roundTrip, setRoundTrip] = useState(false);
  const [currency, setCurrency] = useState("Select");
  const [totalKm, setTotalKm] = useState("");
  const [amount, setAmount] = useState("");
  const [amountLocked, setAmountLocked] = useState(false);
  const [descr, setDescr] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [legs, setLegs] = useState<Plan[]>([]);
  const [draftOnly, setDraftOnly] = useState(true);

  const modes = useMemo(() => modeOptions(policy, exception), [policy, exception]);
  const types = useMemo(() => typeOptions(policy, mode), [policy, mode]);
  const cities = useMemo(() => cityOptions(policy), [policy]);
  const showRate = mode === "Owned Vehicle";

  const reloadLegs = useCallback(async (id: string) => {
    if (!id) { setLegs([]); setDraftOnly(true); return; }
    const [p] = await Promise.all([fetchAll<Plan>(TP())]);
    const rows = p.filter((x) => (x.expenses_id || "") === id).sort((a, b) => a.id - b.id);
    setLegs(rows);
    setDraftOnly(rows.length === 0 || rows.every((r) => r.expense_status === "Draft"));
  }, []);

  useEffect(() => { reloadLegs(ep); }, [ep, reloadLegs]);

  const clearForm = () => {
    setDestFrom(""); setDestTo(""); setFromDate(""); setToDate("");
    setCurrency("Select"); setTotalKm(""); setAmount(""); setAmountLocked(false);
    setDescr(""); setEditingId(null); setRoundTrip(false);
  };

  const onModeChange = (v: string) => {
    setMode(v); setType("Select"); setAmount(""); setTotalKm(""); setAmountLocked(false);
  };
  const onTypeChange = (v: string) => {
    setType(v);
    if (mode === "Bus") setAmount(presetAmountForType(policy, v));
    else setAmount("");
    setAmountLocked(false); setTotalKm("");
  };
  const onKmChange = (v: string) => {
    setTotalKm(v);
    if (policy && (type === "Car" || type === "Bike")) {
      const rate = num(type === "Car" ? policy.v_car : policy.v_bike);
      const km = num(v);
      if (km > 0) { setAmount(String(rate * km)); setAmountLocked(true); }
      else { setAmount(""); setAmountLocked(false); }
    }
  };

  // Legacy Req_validation() — verbatim order + messages.
  const reqValid = () => {
    if (!destFrom.trim()) { alert(MSG.DEST_FROM); return false; }
    if (!destTo.trim()) { alert(MSG.DEST_TO); return false; }
    if (!fromDate) { alert(MSG.FROM_DATE); return false; }
    if (!toDate) { alert(MSG.TO_DATE); return false; }
    if (currency === "Select") { alert(MSG.CURRENCY); return false; }
    if (!amount.trim()) { alert(MSG.AMOUNT); return false; }
    return true;
  };

  const policyChecks = (): boolean => {
    if (!policy) return true;
    // Policy effective window (legacy btn_save_Click date-range check).
    const s = String(policy.start_date || "").slice(0, 10);
    const e = String(policy.end_date || "").slice(0, 10);
    if (s && (fromDate < s || toDate < s || (e && (fromDate > e || toDate > e)))) {
      alert(policyBetween(fmtDDMMYYYY(s), e ? fmtDDMMYYYY(e) : ""));
      return false;
    }
    // Mode-type limit (legacy: You can not exeed beyond the limit <val2>).
    if (type !== "Select" && mode !== "Owned Vehicle") {
      const preset = presetAmountForType(policy, type);
      if (preset !== "" && num(amount) > num(preset)) {
        alert(overLimit(preset));
        return false;
      }
    }
    // Per-day limit x days (legacy inside/outside limit logic).
    const limit = perDayLimit(policy, city === "1" ? "1" : city === "2" ? "2" : "");
    const days = daysBetween(fromDate, toDate);
    const total = (limit || 0) * days;
    if (total !== 0 && num(amount) > total) { alert(overLimit(limit)); return false; }
    if (num(amount) > (limit || 0) && (limit || 0) > 0 && days <= 0) { alert(overLimit(limit)); return false; }
    // Overlapping plan (legacy: The Travel Plan already exist from ... to ...).
    const clash = allPlans.find((p) =>
      (p.expenses_id || "") !== (ep || "") &&
      p.from_date && p.to_date && rangesOverlap(fromDate, toDate, p.from_date.slice(0, 10), p.to_date.slice(0, 10)));
    if (clash?.from_date && clash?.to_date) {
      alert(planExists(fmtDDMMYYYY(clash.from_date), fmtDDMMYYYY(clash.to_date)));
      return false;
    }
    return true;
  };

  const payload = (submit: boolean) => ({
    city_type: city === "Select" ? "" : city,
    travel_mode: mode === "Select" ? "" : mode,
    exception_case: exception ? "Yes" : "No",
    type: type === "Select" ? "" : type,
    from_designation: destFrom.trim(),
    to_designation: destTo.trim(),
    from_date: fromDate, to_date: toDate,
    curreny_id: undefined, currency: currency === "Select" ? "" : currency,
    total_km: totalKm || 0, adv_amount: amount,
    add_description: descr,
    expenses_id: ep || undefined,
    submit,
  });

  const saveDraft = async () => {
    if (!reqValid()) return;
    if (!policyChecks()) return;
    const body = payload(false) as Record<string, unknown>;
    delete body.curreny_id;
    let r: Response;
    if (editingId) r = await patchJSON(`${TP()}${editingId}/`, body);
    else r = await mk(TP(), body);
    if (!r.ok) { alert(await readErr(r)); return; }
    const saved = await r.json().catch(() => ({}));
    const newEp = (saved?.expenses_id as string) || ep;
    // Legacy Round Trip: second leg with From/To swapped on the To date.
    if (roundTrip && !editingId && newEp) {
      const back = { ...body, from_designation: destTo.trim(), to_designation: destFrom.trim(), from_date: toDate, to_date: toDate, expenses_id: newEp, submit: false };
      await mk(TP(), back);
    }
    if (!ep && newEp) setEp(newEp);
    alert(MSG.PLAN_SAVED);
    clearForm();
    reloadLegs(newEp);
  };

  const submitAll = async () => {
    if (!window.confirm(MSG.SUBMIT_CONFIRM)) return;
    const target = ep;
    if (!target) return;
    await reloadLegs(target);
    const drafts = legs.filter((l) => l.expense_status === "Draft");
    for (const l of drafts) await mk(`${TP()}${l.id}/submit/`, {});
    alert(MSG.PLAN_SUBMITTED);
    reloadLegs(target);
  };

  const editLeg = (l: Plan) => {
    setException(l.exception_case === "Yes");
    setMode(l.travel_mode || "Select");
    setType(l.type || "Select");
    setDestFrom(l.from_designation || "");
    setDestTo(l.to_designation || "");
    setFromDate((l.from_date || "").slice(0, 10));
    setToDate((l.to_date || "").slice(0, 10));
    setCurrency(l.currency || "Select");
    setTotalKm(String(l.total_km ?? "") === "0" ? "" : String(l.total_km ?? ""));
    setAmount(String(l.adv_amount ?? ""));
    setDescr(l.add_description || "");
    setCity(l.city_type || "Select");
    setEditingId(l.id);
  };

  const deleteLeg = async (id: number) => {
    if (!window.confirm(MSG.DEL_PLAN)) return;
    await rm(`${TP()}${id}/`);
    reloadLegs(ep);
  };

  const total = legs.reduce((s, l) => s + num(l.adv_amount), 0);

  return (
    <Modal title="New Travelling Plan" onClose={onClose} wide>
      <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 20 }}>
        <div className="tv-field"><b>City Type:</b>
          <select className="tv-input" value={city} onChange={(e) => setCity(e.target.value)}>
            <option>Select</option>
            {cities.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="tv-field"><b>Mode:</b>
          <select className="tv-input" value={mode} onChange={(e) => onModeChange(e.target.value)}>
            <option>Select</option>
            {modes.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <br />
          <label><input type="checkbox" checked={exception} onChange={(e) => { setException(e.target.checked); setMode("Select"); setType("Select"); setAmount(""); }} /> Exception</label>
        </div>
        <div className="tv-field"><b>Types:</b>
          <select className="tv-input" value={type} onChange={(e) => onTypeChange(e.target.value)}>
            <option>Select</option>
            {types.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="tv-field"><b>Destination From:</b>
          <input className="tv-input" maxLength={50} value={destFrom}
            onChange={(e) => setDestFrom(e.target.value)}
            onKeyPress={(e) => { if (!isAddressKey(e.key)) e.preventDefault(); }} />
        </div>
        <div className="tv-field"><b>DestinationTo:</b>
          <input className="tv-input" maxLength={50} value={destTo}
            onChange={(e) => setDestTo(e.target.value)}
            onKeyPress={(e) => { if (!isAddressKey(e.key)) e.preventDefault(); }} />
        </div>
        <div className="tv-field"><b>From Date:</b>
          <input type="date" className="tv-input" value={fromDate} min={todayISO()}
            onChange={(e) => { setFromDate(e.target.value); if (toDate && e.target.value > toDate) setToDate(e.target.value); }} />
        </div>
        <div className="tv-field"><b>To Date:</b>
          <input type="date" className="tv-input" value={toDate} min={fromDate || todayISO()}
            onChange={(e) => setToDate(e.target.value)} />
        </div>
        <div className="tv-field"><br />
          <label><input type="checkbox" checked={roundTrip} onChange={(e) => setRoundTrip(e.target.checked)} /> Round Trip</label>
        </div>
      </div>
      <br />
      <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <div className="tv-field"><b>Currency:</b>
          <select className="tv-input" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="Select">Select</option>
            <option value="RS">RS</option>
          </select>
        </div>
        {showRate && (
          <div className="tv-field"><b>Total KM:</b>
            <input className="tv-input" value={totalKm}
              onChange={(e) => onKmChange(e.target.value.replace(/[^0-9.]/g, ""))} />
          </div>
        )}
        <div className="tv-field"><b>Amount:</b>
          <input className="tv-input" maxLength={7} value={amount} readOnly={amountLocked}
            onChange={(e) => setAmount(e.target.value)}
            onKeyPress={(e) => { if (!isNumberKey(e.key)) e.preventDefault(); }} />
        </div>
        <div className="tv-field tv-field-wide"><b>Description about Travel Plan:</b>
          <textarea className="tv-input" value={descr} onChange={(e) => setDescr(e.target.value)}
            onKeyPress={(e) => { if (!isAddressKey(e.key)) e.preventDefault(); }} />
        </div>
      </div>
      <br /><br />
      <div className="tv-center">
        {draftOnly && <button className="tv-btn tv-btn-primary" onClick={saveDraft}>Save As Draft</button>}{" "}
        {draftOnly && legs.length > 0 && <button className="tv-btn tv-btn-primary" onClick={submitAll}>Submit</button>}
      </div>
      <br />
      <div><div>
        <div className="tv-formwrap">
          <div className="tv-scroll" style={{ maxHeight: 200, overflow: "scroll" }}>
            <table className="tv-table" style={{ background: "#fff" }}>
              <thead><tr style={{ backgroundColor: "#006699", color: "#fff", fontWeight: "bold" }}>
                <th></th><th>#</th><th>City</th><th>Mode</th><th>Type</th><th>Exception</th>
                <th>Form Destination</th><th>To Destination</th><th>From Date</th><th>To Date</th>
                <th>Currency</th><th>Amount</th><th>Description</th>
              </tr></thead>
              <tbody>
                {legs.map((l, i) => (
                  <tr key={l.id} onClick={() => l.expense_status === "Draft" && editLeg(l)}
                    style={{ cursor: l.expense_status === "Draft" ? "pointer" : undefined }}>
                    <td>{l.expense_status === "Draft" && (
                      <a href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); deleteLeg(l.id); }} title="Delete">🗑</a>)}
                    </td>
                    <td>{i + 1}</td>
                    <td>{cityLabel(l.city_type)}</td><td>{l.travel_mode}</td><td>{l.type}</td>
                    <td>{l.exception_case}</td><td>{l.from_designation}</td><td>{l.to_designation}</td>
                    <td>{fmtDDMMYYYY(l.from_date)}</td><td>{fmtDDMMYYYY(l.to_date)}</td>
                    <td>{l.currency}</td><td>{l.adv_amount}</td><td>{l.add_description}</td>
                  </tr>
                ))}
                {legs.length === 0 && <tr><td colSpan={13} style={{ textAlign: "center" }}>No legs added</td></tr>}
              </tbody>
              {legs.length > 0 && (
                <tfoot><tr style={{ fontWeight: "bold" }}>
                  <td colSpan={11} style={{ textAlign: "right" }}>Total:</td><td>{total}</td><td></td>
                </tr></tfoot>
              )}
            </table>
          </div>
        </div>
      </div></div>
    </Modal>
  );
}

/* ================= New Claim Expense (p_add_expencess1) ================= */

const PARTICULARS = ["Travel", "Accomodation", "Food"];

function ClaimExpenseModal({ expensesId, policy, allPlans, allClaims, onClose }: {
  expensesId: string; policy: TravelPolicy | null; allPlans: Plan[]; allClaims: Claim[]; onClose: () => void;
}) {
  const [ep, setEp] = useState(expensesId);
  const [city, setCity] = useState("Select");
  const [particular, setParticular] = useState("Select");
  const [mode, setMode] = useState("Select");
  const [type, setType] = useState("Select");
  const [date, setDate] = useState("");
  const [merchant, setMerchant] = useState("");
  const [totalKm, setTotalKm] = useState("");
  const [amount, setAmount] = useState("0");
  const [amountLocked, setAmountLocked] = useState(false);
  const [descr, setDescr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [rows, setRows] = useState<Claim[]>([]);
  const [legs, setLegs] = useState<Plan[]>([]);
  const [draftOnly, setDraftOnly] = useState(true);

  const cities = useMemo(() => cityOptions(policy), [policy]);
  const claimModes = useMemo(() => {
    if (particular === "Travel") return modeOptions(policy, false);
    if (particular === "Food") return ["Breakfast", "Lunch", "dinner"];
    if (particular === "Accomodation") {
      if (!policy) return ["hotel_budget", "hotel_standard", "hotel_twostar", "hotel_threestar", "hotel_fivestar"];
      const out: string[] = [];
      if (isOn(policy.hotel_budget)) out.push("hotel_budget");
      if (isOn(policy.hotel_standard)) out.push("hotel_standard");
      if (isOn(policy.hotel_twostar)) out.push("hotel_twostar");
      if (isOn(policy.hotel_threestar)) out.push("hotel_threestar");
      if (isOn(policy.hotel_fivestar)) out.push("hotel_fivestar");
      return out;
    }
    return [];
  }, [particular, policy]);
  const claimTypes = useMemo(() => typeOptions(policy, mode), [policy, mode]);
  const showRate = mode === "Owned Vehicle";
  const showType = particular === "Travel" && (mode === "Bus" || mode === "Owned Vehicle");

  const reload = useCallback(async (id: string) => {
    if (!id) { setRows([]); setLegs([]); setDraftOnly(true); return; }
    const [c, p] = await Promise.all([fetchAll<Claim>(EC()), fetchAll<Plan>(TP())]);
    const cr = c.filter((x) => (x.expenses_id || "") === id);
    setRows(cr);
    setLegs(p.filter((x) => (x.expenses_id || "") === id).sort((a, b) => a.id - b.id));
    setDraftOnly(cr.length === 0 || cr.every((r) => r.status === "Draft"));
  }, []);

  useEffect(() => { reload(ep); }, [ep, reload]);

  const clearForm = () => {
    setDate(""); setMerchant(""); setTotalKm(""); setAmount("0"); setAmountLocked(false);
    setDescr(""); setFile(null); setEditingId(null);
    setParticular("Select"); setMode("Select"); setType("Select"); setCity("Select");
  };

  const onModeChange = (v: string) => {
    setMode(v); setType("Select"); setAmount("0"); setTotalKm(""); setAmountLocked(false);
  };
  const onTypeChange = (v: string) => {
    setType(v); setAmount(presetAmountForType(policy, v) || "0");
  };
  const onKmChange = (v: string) => {
    setTotalKm(v);
    if (policy && (type === "Car" || type === "Bike")) {
      const rate = num(type === "Car" ? policy.v_car : policy.v_bike);
      const km = num(v);
      if (km > 0) { setAmount(String(rate * km)); setAmountLocked(true); }
      else { setAmount("0"); setAmountLocked(false); }
    }
  };

  // Legacy Req_validation() (claim popup) — verbatim order + messages.
  const reqValid = () => {
    if (!date) { alert(MSG.CLAIM_DATE); return false; }
    if (!merchant.trim()) { alert(MSG.MERCHANT); return false; }
    if (!amount.trim()) { alert(MSG.AMOUNT); (document.getElementById("claim-amount") as HTMLInputElement | null)?.focus(); return false; }
    if (!descr.trim()) { alert(MSG.CLAIM_DESC); return false; }
    return true;
  };

  const claimChecks = (): boolean => {
    if (!policy) return true;
    // Hotel band (legacy Accomodation check).
    if (particular === "Accomodation" && mode !== "Select") {
      const from = num((policy as Record<string, unknown>)[`${mode}_from`]);
      const to = num((policy as Record<string, unknown>)[`${mode}_to`]);
      const txt = num(amount);
      if (from > txt) { alert(hotelGreater(from)); return false; }
      if (to < txt) { alert(hotelLess(to)); return false; }
    }
    // Mode-type limit for Travel (non owned-vehicle).
    if (particular === "Travel" && type !== "Select" && mode !== "Owned Vehicle") {
      const preset = presetAmountForType(policy, type);
      if (preset !== "" && num(amount) > num(preset)) { alert(overLimit(preset)); return false; }
    }
    // Per-day limit incl. same-day sum (legacy btn_add_Click).
    const limit = perDayLimit(policy, city === "1" ? "1" : city === "2" ? "2" : "");
    const sameDay = allClaims
      .filter((c) => c.id !== editingId && (c.date || "").slice(0, 10) === date)
      .reduce((s, c) => s + num(c.amount), 0);
    if (!sameDay) {
      if (num(amount) > (limit || 0) && (limit || 0) > 0) { alert(overPerDay(limit)); return false; }
    } else if ((limit || 0) < sameDay) { alert(overPerDay2(limit)); return false; }
    // Claim must be within claim_max_days of travel (legacy datevalidation).
    const maxDays = num(policy.claim_max_days || 1) || 1;
    const diffDays = Math.round((new Date(`${date}T00:00:00`).getTime() - new Date(`${todayISO()}T00:00:00`).getTime()) / 86400000);
    if (diffDays > maxDays) {
      alert(MSG.CLAIM_EXPIRED);
      return false;
    }
    // Same-date duplicate in another group (legacy: already exist ... Select another date).
    const dup = allClaims.find((c) => c.id !== editingId && (c.date || "").slice(0, 10) === date && (c.expenses_id || "") !== (ep || ""));
    if (dup?.date) { alert(claimDateExists(fmtDDMMYYYY(dup.date))); return false; }
    // Attachment gate (legacy Upload_File).
    if (file) {
      const n = file.name.toLowerCase();
      if (!n.endsWith(".jpg") && !n.endsWith(".jpeg") && !n.endsWith(".png")) { alert(MSG.ATTACH_TYPE); return false; }
      if (file.size >= 5100000) { alert(MSG.ATTACH_SIZE); return false; }
    }
    return true;
  };

  const saveDraft = async () => {
    if (!reqValid()) return;
    if (!claimChecks()) return;
    const fd = new FormData();
    fd.append("city_type", city === "Select" ? "" : city);
    fd.append("particular", particular === "Select" ? "" : particular);
    fd.append("travel_type", mode === "Select" ? "" : mode);
    fd.append("type", showType ? (type === "Select" ? "" : type) : (type === "Select" ? "" : type));
    fd.append("date", date);
    fd.append("merchant", merchant.trim());
    fd.append("amount", amount);
    fd.append("description", descr);
    if (ep) fd.append("expenses_id", ep);
    fd.append("submit", "false");
    if (file) fd.append("attachment", file);
    let r: Response;
    if (editingId) {
      // update path (legacy btnupdate_Click) — PATCH JSON then attachment via upload if changed
      const body: Record<string, unknown> = {
        city_type: city === "Select" ? "" : city,
        particular: particular === "Select" ? "" : particular,
        travel_type: mode === "Select" ? "" : mode,
        type: type === "Select" ? "" : type,
        date, merchant: merchant.trim(), amount, description: descr,
      };
      r = await patchJSON(`${EC()}${editingId}/`, body);
      if (r.ok && file) {
        const f2 = new FormData();
        f2.append("attachment", file);
        await patchJSON(`${EC()}${editingId}/`, {}); // keep ordering simple; file via multipart below
        const up = await fetch(`${API_BASE_URL}${EC()}${editingId}/`, {
          method: "PATCH",
          credentials: "include",
          headers: { "X-CSRFToken": getCookie("csrftoken") ?? "" },
          body: f2,
        });
        r = up;
      }
    } else {
      r = await upload(EC(), fd);
    }
    if (!r.ok) { alert(await readErr(r)); return; }
    const saved = await r.json().catch(() => ({}));
    const newEp = (saved?.expenses_id as string) || ep;
    if (!ep && newEp) setEp(newEp);
    alert(MSG.CLAIM_SAVED);
    clearForm();
    reload(newEp);
  };

  const submitAll = async () => {
    if (!window.confirm(MSG.SUBMIT_CONFIRM)) return;
    if (!ep) return;
    await reload(ep);
    const drafts = rows.filter((c) => c.status === "Draft");
    for (const d of drafts) await mk(`${EC()}${d.id}/submit/`, {});
    alert(MSG.CLAIM_SUBMITTED);
    reload(ep);
  };

  const editRow = (c: Claim) => {
    setDate((c.date || "").slice(0, 10));
    setCity(c.city_type || "Select");
    setMerchant(c.merchant || "");
    setAmount(String(c.amount ?? "0"));
    setDescr(c.description || "");
    setParticular(c.particular || "Select");
    setMode(c.travel_type || "Select");
    setType(c.type || "Select");
    setEditingId(c.id);
  };

  const deleteRow = async (id: number) => {
    if (!window.confirm(MSG.DEL_CLAIM)) return;
    const r = await rm(`${EC()}${id}/`);
    if (!r.ok) alert(await readErr(r));
    reload(ep);
  };

  // Inline Actual Amount edit (legacy txt_comment_TextChanged) with per-day re-check.
  const actualEdit = async (c: Claim, v: string) => {
    const val = v === "" ? "0" : v;
    if (policy && num(c.travel_amount || 0) === 0) {
      const limit = perDayLimit(policy, "");
      const others = allClaims
        .filter((x) => x.id !== c.id && (x.date || "").slice(0, 10) === (c.date || "").slice(0, 10))
        .reduce((s, x) => s + num(x.amount), 0);
      if (others + num(val) > (limit || 0) && (limit || 0) > 0) {
        alert(actualOverPerDay(limit));
        reload(ep);
        return;
      }
    }
    const r = await patchJSON(`${EC()}${c.id}/`, { amount: val });
    if (!r.ok) alert(await readErr(r));
    reload(ep);
  };

  const advTotal = legs.reduce((s, l) => s + num(l.adv_amount), 0);
  const amtTotal = rows.reduce((s, c) => s + num(c.amount), 0);
  const appTotal = rows.reduce((s, c) => s + num(c.app_amount), 0);
  const preview = file ? URL.createObjectURL(file) : "";

  return (
    <Modal title="New Claim Expense" onClose={onClose} wide>
      <div className="row row_new_exp" style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <div className="tv-field"><b>City Type:</b>
          <select className="tv-input" value={city} onChange={(e) => setCity(e.target.value)}>
            <option>Select</option>
            {cities.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="tv-field"><b>Particular :</b>
          <select className="tv-input" value={particular}
            onChange={(e) => { setParticular(e.target.value); setMode("Select"); setType("Select"); setAmount("0"); }}>
            <option value="Select">Select</option>
            {PARTICULARS.map((p) => <option key={p} value={p}>{p === "Travel" ? " Travel" : p}</option>)}
          </select>
        </div>
        <div className="tv-field">Mode :
          <select className="tv-input" value={mode} onChange={(e) => onModeChange(e.target.value)}>
            <option value="Select">Select</option>
            {claimModes.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div className="tv-field"><b>Type :</b>
          <select className="tv-input" value={type} onChange={(e) => onTypeChange(e.target.value)}>
            <option value="Select">Select</option>
            {claimTypes.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="tv-field"><b>Date:</b>
          <input type="date" className="tv-input" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="tv-field"><b>Merchant:</b>
          <input className="tv-input" value={merchant} onChange={(e) => setMerchant(e.target.value)}
            onKeyPress={(e) => { if (!isLetterKey(e.key)) e.preventDefault(); }} />
        </div>
        {showRate && (
          <div className="tv-field"><b>Total KM:</b>
            <input className="tv-input" value={totalKm}
              onChange={(e) => onKmChange(e.target.value.replace(/[^0-9.]/g, ""))} />
          </div>
        )}
      </div>
      <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 20 }}>
        <div className="tv-field"><b>Amount:</b>
          <input id="claim-amount" className="tv-input" maxLength={7} value={amount} readOnly={amountLocked}
            onChange={(e) => setAmount(e.target.value)}
            onKeyPress={(e) => { if (!isNumberKey(e.key)) e.preventDefault(); }} />
        </div>
        <div className="tv-field tv-field-wide"><b>Description:</b>
          <textarea className="tv-input" style={{ height: 35 }} value={descr} onChange={(e) => setDescr(e.target.value)}
            onKeyPress={(e) => { if (!isAddressKey(e.key)) e.preventDefault(); }} />
        </div>
      </div>
      <br />
      <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        <div className="tv-field"><br /><br /><b>Attachment :</b></div>
        <div className="tv-field tv-field-wide"><br /><br />
          <input type="file" accept=".jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div className="tv-note-red">{MSG.ATTACH_NOTE}</div>
        </div>
        <div className="tv-field"><br /><br />
          <img src={preview || "/Images/placeholder.png"} alt="" width={55} height={55} />
        </div>
      </div>
      <br />
      <div className="text-center">
        {draftOnly && <button className="tv-btn tv-btn-primary" onClick={saveDraft}> Save As Draft </button>}{" "}
        {draftOnly && rows.length > 0 && <button className="tv-btn tv-btn-primary" onClick={submitAll}>Submit</button>}
      </div>
      <br />
      <div><div>
        <div className="tv-formwrap">
          <div className="tv-scroll" style={{ maxHeight: 175, overflow: "scroll" }}>
            <table className="tv-table" style={{ background: "#fff" }}>
              <thead><tr style={{ backgroundColor: "#006699", color: "#fff", fontWeight: "bold" }}>
                <th></th><th>#</th><th>Date</th><th>City</th><th>Merchant </th>
                <th>Travel Mode </th><th>Type</th><th>Advance Amount</th>
                <th>Actual Amount</th><th>Approved Amount</th><th>Status</th>
                <th>Get Details</th><th>Attachment</th><th>DOWNLOAD FILE</th>
              </tr></thead>
              <tbody>
                {legs.map((l) => (
                  <tr key={`leg-${l.id}`} style={{ color: "#000066" }}>
                    <td></td><td></td>
                    <td>{fmtDDMMYYYY(l.from_date)}</td>
                    <td>{cityLabel(l.city_type)}</td>
                    <td>{l.travel_mode}</td><td>{l.travel_mode}</td><td>{l.type}</td>
                    <td>{l.adv_amount}</td><td>{l.adv_amount}</td><td></td>
                    <td>{l.expense_status}</td><td></td><td></td><td></td>
                  </tr>
                ))}
                {rows.map((c, i) => (
                  <tr key={c.id} style={{ color: "#000066" }}>
                    <td><a href="#" title="Delete" onClick={(e) => { e.preventDefault(); deleteRow(c.id); }}>🗑</a></td>
                    <td>{i + 1}</td>
                    <td>{fmtDDMMYYYY(c.date)}</td>
                    <td>{cityLabel(c.city_type || "")}</td>
                    <td>{c.merchant}</td><td>{c.travel_type}</td><td>{c.type}</td>
                    <td>{c.travel_amount && num(c.travel_amount) !== 0 ? c.travel_amount : ""}</td>
                    <td>
                      {c.status === "Draft"
                        ? <input className="tv-input" style={{ height: 25, width: 80 }} defaultValue={String(c.amount ?? "0")}
                            onKeyPress={(e) => { if (!isNumberKey(e.key)) e.preventDefault(); }}
                            onBlur={(e) => { if (e.target.value !== String(c.amount)) actualEdit(c, e.target.value); }} />
                        : String(c.amount ?? "")}
                    </td>
                    <td>{c.app_amount}</td><td>{c.status}</td>
                    <td><a href="#" onClick={(e) => { e.preventDefault(); editRow(c); }}>Get Details</a></td>
                    <td>{c.attachment ? String(c.attachment).split("/").pop() : ""}</td>
                    <td>{c.attachment && (
                      <a className="tv-btn tv-btn-primary" style={{ color: "white" }} target="_blank" rel="noreferrer"
                        href={`${API_BASE_URL}${String(c.attachment).startsWith("/") ? "" : "/media/"}${String(c.attachment).replace(/^\/?media\//, "")}`}>
                        DOWNLOAD
                      </a>)}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && legs.length === 0 && (
                  <tr><td colSpan={14} style={{ textAlign: "center" }}>No expenses</td></tr>)}
              </tbody>
              {(rows.length > 0 || legs.length > 0) && (
                <tfoot><tr style={{ fontWeight: "bold" }}>
                  <td colSpan={7} style={{ textAlign: "right" }}>Total:</td>
                  <td>{advTotal || ""}</td><td>{amtTotal || ""}</td><td>{appTotal || ""}</td>
                  <td colSpan={4}></td>
                </tr></tfoot>
              )}
            </table>
          </div>
        </div>
      </div></div>
    </Modal>
  );
}

/* ================= shared bits ================= */

function Modal({ title, children, onClose, wide }: {
  title: string; children: React.ReactNode; onClose: () => void; wide?: boolean;
}) {
  return (
    <div style={{
      position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.8)", zIndex: 101,
      overflowY: "auto", padding: 20,
    }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="tv-popup" style={{
        backgroundColor: "#fff", border: "3px solid black", padding: 10,
        maxWidth: wide ? 1000 : 800, margin: "0 auto",
      }}>
        <div className="tv-popup-title">
          <h3><b><u>{title}</u></b></h3>
        </div>
        {children}
        <br />
        <div className="tv-center">
          <button className="tv-btn tv-btn-danger" onClick={onClose}>Close</button>
        </div>
        <br />
      </div>
    </div>
  );
}

async function readErr(r: Response): Promise<string> {
  try {
    const b = await r.json();
    if (typeof b === "string") return b;
    if (Array.isArray(b)) return b.join(" ");
    if (b && typeof b === "object") {
      const first = Object.values(b as Record<string, unknown>)[0];
      if (typeof first === "string") return first;
      if (Array.isArray(first)) return String(first[0] ?? `Failed (${r.status})`);
      try { return JSON.stringify(b); } catch { return `Failed (${r.status})`; }
    }
    return `Failed (${r.status})`;
  } catch { return `Failed (${r.status})`; }
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}
