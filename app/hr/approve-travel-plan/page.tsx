"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { mk } from "@/lib/api/legacy-fetch";
import {
  TP, Plan, fetchAll, num, readErr, Modal,
} from "@/components/travel/travel-plan-panel";
import {
  cityLabel, fmtDDMMYYYY, MSG,
} from "@/lib/travel/travel-legacy";

/* Legacy app_rej_travelplan.aspx (Travel Plan Approved/Rejected grid, approver scope) +
   p_app_rej_travelplan2.aspx (Approve/Reject Travel Plan details popup).
   Grid columns, buttons and alert strings are verbatim copies of the legacy pages. */

export default function ApproveTravelPlanPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [msg, setMsg] = useState("");
  const [approveEp, setApproveEp] = useState<string | null>(null);

  const load = useCallback(async () => {
    setPlans(await fetchAll<Plan>(`${TP()}?scope=approve`));
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, Plan[]>();
    for (const p of plans) {
      const ep = (p.expenses_id || "").trim() || `P${p.id}`;
      if (!map.has(ep)) map.set(ep, []);
      map.get(ep)!.push(p);
    }
    return [...map.entries()].map(([ep, legs]) => ({ ep, legs: legs.sort((a, b) => a.id - b.id) }));
  }, [plans]);

  return (
    <div>
      <div className="tv-panel">
        <div className="tv-head">
          <div className="tv-head-row">
            <div className="tv-head-side"></div>
            <div className="tv-head-title">
              Travel Plan Approved/Rejected
            </div>
            <div className="tv-head-help">
              <a href="#" onClick={(e) => { e.preventDefault(); window.open("html/travelling_managment.html", "popUpWindow", "height=500,width=600,left=100,top=100"); }}>
                <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
              </a>
            </div>
          </div>
        </div>
        <div className="tv-body">
          {msg && <div className="tv-msg">{msg}</div>}
          <div className="tv-scroll" style={{ maxHeight: 300, overflowY: "auto" }}>
            <table className="tv-table" style={{ background: "#fff" }}>
              <thead>
                <tr style={{ backgroundColor: "#006699", color: "#fff", fontWeight: "bold", textTransform: "uppercase" }}>
                  <th>Emp Name</th><th>City Type</th><th>Mode</th><th>Type</th>
                  <th>From Destination</th><th>To Destination</th><th>From Date</th><th>To Date</th>
                  <th>Advance_Amount</th><th>Description for New Travel Plan</th>
                  <th>Status</th><th>Last Modified</th><th>Comments</th><th>Reject</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const first = g.legs[0];
                  const last = g.legs[g.legs.length - 1];
                  return (
                    <tr key={g.ep} style={{ color: "#000066" }}>
                      <td>{first.emp_name || first.emp_code}</td>
                      <td>{cityLabel(first.city_type)}</td>
                      <td>{[...new Set(g.legs.map((l) => l.travel_mode).filter(Boolean))].join(", ")}</td>
                      <td>{[...new Set(g.legs.map((l) => l.type).filter(Boolean))].join(", ")}</td>
                      <td>{first.from_designation}</td><td>{last.to_designation}</td>
                      <td>{fmtDDMMYYYY(first.from_date)}</td><td>{fmtDDMMYYYY(last.to_date)}</td>
                      <td>{g.legs.reduce((s, l) => s + num(l.adv_amount), 0)}</td>
                      <td>{first.add_description}</td>
                      <td>{first.expense_status}</td>
                      <td>{first.modified_by}</td>
                      <td>{last.comments || first.comments || ""}</td>
                      <td>{g.legs.every((l) => l.expense_status === "Approved" || l.expense_status === "Rejected") ? null : (
                        <a href="#" onClick={(e) => { e.preventDefault(); setApproveEp(g.ep); }}>Details</a>)}</td>
                    </tr>
                  );
                })}
                {groups.length === 0 && <tr><td colSpan={14} style={{ textAlign: "center" }}>No travel plans for approval</td></tr>}
              </tbody>
            </table>
          </div>
          <br />
          <div className="tv-center">
            <button className="tv-btn tv-btn-danger" onClick={() => router.push("/Home")}>Close</button>
          </div>
        </div>
      </div>

      {approveEp !== null && (
        <ApproveTravelModal
          expensesId={approveEp} plans={plans}
          onClose={() => { setApproveEp(null); load(); }}
        />
      )}
    </div>
  );
}

/* ============ Approve/Reject popup (p_app_rej_travelplan2) ============ */

function ApproveTravelModal({ expensesId, plans, onClose }: {
  expensesId: string; plans: Plan[]; onClose: () => void;
}) {
  const legs = useMemo(
    () => plans.filter((p) => (p.expenses_id || "") === expensesId).sort((a, b) => a.id - b.id),
    [plans, expensesId]);
  const [comments, setComments] = useState("");

  const act = async (kind: "approve" | "reject" | "clarify") => {
    if (kind === "reject" || kind === "clarify") {
      // Legacy: alert("Please Enter Comment for Rejection !!") + confirm on Reject.
      if (!comments.trim()) { alert("Please Enter Comment for Rejection !!"); return; }
      if (kind === "reject" && !window.confirm(MSG.REJECT_TRAVEL)) return;
    } else {
      alert("Add Travel Plan Approved");
    }
    for (const l of legs) {
      if (l.expense_status !== "Submitted") continue;
      const r = await mk(`${TP()}${l.id}/${kind}/`, { comments });
      if (!r.ok) { alert(await readErr(r)); return; }
    }
    if (kind === "reject") alert("Travel Plan Rejected!!");
    if (kind === "clarify") alert("Travel Plan Updated for Clarification!!");
    onClose();
  };

  const total = legs.reduce((s, l) => s + num(l.adv_amount), 0);

  return (
    <Modal title="Approve/Reject Travel Plan" onClose={onClose} wide>
      <div className="tv-scroll" style={{ maxHeight: 300, overflow: "scroll" }}>
        <table className="tv-table" style={{ background: "#fff" }}>
          <thead><tr style={{ backgroundColor: "#006699", color: "#fff", fontWeight: "bold" }}>
            <th>#</th><th>City Type</th><th>Mode</th><th>Type</th><th>Exception</th>
            <th>Form Destination</th><th>To Destination</th><th>From Date</th><th>To Date</th>
            <th>Currency</th><th>Amount</th><th>Status</th>
          </tr></thead>
          <tbody>
            {legs.map((l, i) => (
              <tr key={l.id} style={{ color: "#000066" }}>
                <td>{i + 1}</td><td>{cityLabel(l.city_type)}</td>
                <td>{l.travel_mode}</td><td>{l.type}</td><td>{l.exception_case}</td>
                <td>{l.from_designation}</td><td>{l.to_designation}</td>
                <td>{fmtDDMMYYYY(l.from_date)}</td><td>{fmtDDMMYYYY(l.to_date)}</td>
                <td>{l.currency}</td><td>{l.adv_amount}</td><td>{l.expense_status}</td>
              </tr>
            ))}
            {legs.length === 0 && <tr><td colSpan={12} style={{ textAlign: "center" }}>No legs</td></tr>}
          </tbody>
          {legs.length > 0 && (
            <tfoot><tr style={{ fontWeight: "bold" }}>
              <td colSpan={10} style={{ textAlign: "right" }}>Total:</td><td>{total}</td><td></td>
            </tr></tfoot>
          )}
        </table>
      </div>
      <br />
      <div><b>Comments :</b>
        <textarea className="tv-input" value={comments} onChange={(e) => setComments(e.target.value)} />
      </div>
      <br />
      <div className="tv-center" style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {legs.some((l) => l.expense_status === "Submitted" || l.expense_status === "Pending") && (<>
        <button className="tv-btn tv-btn-primary" onClick={() => act("approve")}>Approve</button>
        <button className="tv-btn tv-btn-primary" onClick={() => act("clarify")}>Seeking Clarification</button>
        <button className="tv-btn tv-btn-primary" onClick={() => act("reject")}>Reject</button>
        </>)}
      </div>
    </Modal>
  );
}
