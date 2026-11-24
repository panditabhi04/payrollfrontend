"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { rm } from "@/lib/api/legacy-fetch";
import {
  TP, EC, Plan, Claim, fetchAll, num,
  TravelPlanPanel, loadMyPolicy,
} from "@/components/travel/travel-plan-panel";
import {
  TravelPolicy, cityLabel, fmtDDMMYYYY, MSG,
} from "@/lib/travel/travel-legacy";

/* Legacy apply_travel_plan own-side (New Travelling Plan inline form + own grid).
   The Approve Travel Plan screen lives on its own route (approve-travel-plan),
   exactly like legacy app_rej_travelplan.aspx. All alert/confirm strings are
   verbatim copies of the legacy JavaScript. */

export default function TravelPlanPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [policy, setPolicy] = useState<TravelPolicy | null>(null);
  const [policyChecked, setPolicyChecked] = useState(false);
  const [msg, setMsg] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [editEp, setEditEp] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPlans(await fetchAll<Plan>(TP()));
  }, []);
  const loadPolicy = useCallback(async () => {
    setPolicy(await loadMyPolicy());
    setPolicyChecked(true);
  }, []);

  useEffect(() => { load(); loadPolicy(); }, [load, loadPolicy]);

  const needPolicyAlert = () => {
    if (!policyChecked) { loadPolicy(); return true; }
    if (!policy) { alert(MSG.POLICY_MISSING); return true; }
    return false;
  };

  const openNew = () => {
    if (needPolicyAlert()) return;
    setNewOpen(true);
  };

  // Own legs grouped by expenses_id (like the legacy sub-grid per group).
  const groups = useMemo(() => {
    const map = new Map<string, Plan[]>();
    for (const p of plans) {
      const ep = (p.expenses_id || "").trim() || `P${p.id}`;
      if (!map.has(ep)) map.set(ep, []);
      map.get(ep)!.push(p);
    }
    return [...map.entries()].map(([ep, legs]) => ({
      ep, legs: legs.sort((a, b) => a.id - b.id),
    }));
  }, [plans]);

  const deleteGroup = async (ep: string) => {
    if (!window.confirm(MSG.DEL_PLAN)) return;
    const g = groups.find((x) => x.ep === ep);
    if (!g) return;
    for (const l of g.legs) {
      const r = await rm(`${TP()}${l.id}/`).catch(() => null);
      if (!r || !r.ok) { alert("Travel plan could not be deleted."); load(); return; }
    }
    // Legacy lnkdelete_Click also clears that group's claims.
    const cs = await fetchAll<Claim>(EC());
    for (const c of cs.filter((x) => (x.expenses_id || "") === ep))
      await rm(`${EC()}${c.id}/`).catch(() => null);
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

              {!newOpen && editEp === null && (
                <div className="tv-links-row">
                  <div>
                    <span className="tv-plus">+</span>{" "}
                    <a href="#" onClick={(e) => { e.preventDefault(); openNew(); }} className="tv-link">New Travelling Plan</a>
                  </div>
                </div>
              )}
              {(newOpen || editEp !== null) && (
                <div className="tv-formwrap">
                  <div className="tv-popup-title">
                    <h3><b><u>New Travelling Plan</u></b></h3>
                  </div>
                  <TravelPlanPanel
                    key={newOpen ? "new" : `edit-${editEp}`}
                    expensesId={newOpen ? "" : (editEp ?? "")}
                    policy={policy} allPlans={plans}
                    onGroupChange={() => load()}
                  />
                  <div className="tv-center">
                    <button className="tv-btn tv-btn-danger" onClick={() => { setNewOpen(false); setEditEp(null); load(); }}>Close</button>
                  </div>
                </div>
              )}
              <br />
              <div className="tv-scroll" style={{ maxHeight: 300, overflowY: "auto" }}>
                <table className="tv-table" style={{ background: "#fff" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#006699", color: "#fff", fontWeight: "bold", textTransform: "uppercase" }}>
                      <th>Mode</th><th>From</th><th>To</th><th>From Date</th><th>To Date</th>
                      <th>Reject Reason of Travel</th><th>Travel Status</th>
                      <th>Claim Amt</th><th>Travelling Expense</th><th>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => {
                      const first = g.legs[0];
                      const last = g.legs[g.legs.length - 1];
                      return (
                        <tr key={g.ep} style={{ color: "#000066" }}>
                          <td>{[...new Set(g.legs.map((l) => l.travel_mode).filter(Boolean))].join(", ")}</td>
                          <td>{first.from_designation}</td><td>{last.to_designation}</td>
                          <td>{fmtDDMMYYYY(first.from_date)}</td><td>{fmtDDMMYYYY(last.to_date)}</td>
                          <td>{last.comments || first.comments || ""}</td>
                          <td>{first.expense_status}</td>
                          <td>{g.legs.reduce((s, l) => s + num(l.adv_amount), 0) || ""}</td>
                          <td><a href="#" onClick={(e) => { e.preventDefault(); setNewOpen(false); setEditEp(g.ep); }}>Edit Travel Plan</a></td>
                          <td><a href="#" onClick={(e) => { e.preventDefault(); deleteGroup(g.ep); }}>Delete</a></td>
                        </tr>
                      );
                    })}
                    {groups.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center" }}>No travel plans</td></tr>}
                  </tbody>
                </table>
              </div>
              <br />
              <div className="tv-center">
                <button className="tv-btn tv-btn-danger" onClick={() => { setMsg(""); router.push("/Home"); }}>Close</button>
              </div>
        </div>
      </div>
    </div>
  );
}
