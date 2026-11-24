"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getJSON, mk, patchJSON, rm } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";
import {
  TravelPolicy, modeOptions, typeOptions, presetAmountForType, cityOptions,
  perDayLimit, cityLabel, fmtDDMMYYYY, todayISO, daysBetween, rangesOverlap,
  isNumberKey, isAddressKey, MSG, overLimit, policyBetween, planExists,
} from "@/lib/travel/travel-legacy";

/* Shared travel-plan panel + bits used by:
 * - app/transactions/expense-claim/page.tsx (inside the "New Travelling Plan" modal)
 * - app/hr/travel-plan/page.tsx (inline "My Plans" form)
 * Faithful port of p_add_new_travel_plan2.aspx(.cs). */

export const TP = () => "/api/transactions/travel-plans/";
export const EC = () => "/api/transactions/expense-claims/";
export const MY_POLICY = () => "/api/masters/travel-emp-policies/my_policy/";

export interface Plan {
  id: number; expenses_id: string; emp_code: string; emp_name: string;
  travel_mode: string; type: string; travel_type: string;
  from_designation: string; to_designation: string;
  from_date?: string | null; to_date?: string | null;
  exception_case: string; adv_amount: string; currency: string; total_km: string;
  city_type: string; add_description: string; comments?: string;
  expense_status: string; modified_by?: string; created_at?: string;
}
export interface Claim {
  id: number; expenses_id: string; emp_code: string;
  date?: string | null; merchant: string; amount: string;
  description?: string; status: string; comments?: string;
  app_amount?: string; particular?: string; type?: string; travel_type?: string;
  travel_amount?: string; city_type?: string; attachment?: string | null;
  modified_by?: string; created_at?: string;
}

export async function fetchAll<T>(path: string): Promise<T[]> {
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

export const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export async function readErr(r: Response): Promise<string> {
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

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

export async function loadMyPolicy(): Promise<TravelPolicy | null> {
  const d = await getJSON<{ policy: TravelPolicy }>(MY_POLICY());
  return d?.policy ?? null;
}

export function Modal({ title, children, onClose, wide }: {
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

/* ================= Travelling Plan form + legs grid (p_add_new_travel_plan2) ================= */

export function TravelPlanPanel({ expensesId, policy, allPlans, onGroupChange }: {
  expensesId: string; policy: TravelPolicy | null; allPlans: Plan[];
  onGroupChange?: (ep: string) => void;
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
    const p = await fetchAll<Plan>(TP());
    const rows = p.filter((x) => (x.expenses_id || "") === id).sort((a, b) => a.id - b.id);
    setLegs(rows);
    setDraftOnly(rows.length === 0 || rows.every((r) => r.expense_status === "Draft"));
    onGroupChange?.(id);
  }, [onGroupChange]);

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
    const s = String(policy.start_date || "").slice(0, 10);
    const e = String(policy.end_date || "").slice(0, 10);
    if (s && (fromDate < s || toDate < s || (e && (fromDate > e || toDate > e)))) {
      alert(policyBetween(fmtDDMMYYYY(s), e ? fmtDDMMYYYY(e) : ""));
      return false;
    }
    if (type !== "Select" && mode !== "Owned Vehicle") {
      const preset = presetAmountForType(policy, type);
      if (preset !== "" && num(amount) > num(preset)) {
        alert(`You can not exeed beyond the limit ${preset}`);
        return false;
      }
    }
    const limit = perDayLimit(policy, city === "1" ? "1" : city === "2" ? "2" : "");
    const days = daysBetween(fromDate, toDate);
    const total = (limit || 0) * days;
    if (total !== 0 && num(amount) > total) { alert(`You can not exeed beyond the limit ${limit}`); return false; }
    if ((limit || 0) > 0 && days <= 0 && num(amount) > (limit || 0)) {
      alert(`You can not exeed beyond the limit ${limit}`); return false;
    }
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
    currency: currency === "Select" ? "" : currency,
    total_km: totalKm || 0, adv_amount: amount,
    add_description: descr,
    expenses_id: ep || undefined,
    submit,
  });

  const saveDraft = async () => {
    if (!reqValid()) return;
    if (!policyChecks()) return;
    const body = payload(false);
    let r: Response;
    if (editingId) r = await patchJSON(`${TP()}${editingId}/`, body);
    else r = await mk(TP(), body);
    if (!r.ok) { alert(await readErr(r)); return; }
    const saved = await r.json().catch(() => ({}));
    const newEp = (saved?.expenses_id as string) || ep;
    if (roundTrip && newEp) {
      const back = {
        ...body, from_designation: destTo.trim(), to_designation: destFrom.trim(),
        from_date: toDate, to_date: toDate, expenses_id: newEp, submit: false,
      };
      await mk(TP(), back);
    }
    if (!ep && newEp) setEp(newEp);
    alert(editingId ? "Record updated successfully!!" : MSG.PLAN_SAVED);
    clearForm();
    reloadLegs(newEp);
  };

  const submitAll = async () => {
    if (!window.confirm(MSG.SUBMIT_CONFIRM)) return;
    if (!ep) return;
    await reloadLegs(ep);
    const drafts = legs.filter((l) => l.expense_status === "Draft");
    for (const l of drafts) await mk(`${TP()}${l.id}/submit/`, {});
    alert(MSG.PLAN_SUBMITTED);
    reloadLegs(ep);
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
    setTotalKm(String(l.total_km ?? "") === "0" || !l.total_km ? "" : String(l.total_km));
    setAmount(String(l.adv_amount ?? ""));
    setDescr(l.add_description || "");
    setCity(l.city_type || "Select");
    setEditingId(l.id);
  };

  const deleteLeg = async (id: number) => {
    if (!window.confirm(MSG.DEL_PLAN)) return;
    const r = await rm(`${TP()}${id}/`);
    if (!r.ok) { alert(await readErr(r)); return; }
    reloadLegs(ep);
  };

  const total = legs.reduce((s, l) => s + num(l.adv_amount), 0);

  return (
    <>
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
    </>
  );
}
