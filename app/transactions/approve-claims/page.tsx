"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { mk } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";
import {
  cityLabel, fmtDDMMYYYY, isNumberKey, MSG,
} from "@/lib/travel/travel-legacy";

/* Legacy app_rej_claim.aspx (Approve/Reject Claims grid, manager scope) +
   p_app_rej_claim.aspx (Approve/Reject Claims details popup).
   Grid columns, buttons and alert strings are verbatim copies of the legacy pages. */

const TP = () => "/api/transactions/travel-plans/";
const EC = () => "/api/transactions/expense-claims/";

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

export default function ApproveClaimsPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [msg, setMsg] = useState("");
  const [approveEp, setApproveEp] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([
      fetchAll<Plan>(`${TP()}?scope=approve`), fetchAll<Claim>(`${EC()}?scope=manage`)]);
    setPlans(p); setClaims(c);
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const map = new Map<string, { ep: string; legs: Plan[]; claims: Claim[] }>();
    for (const p of plans) {
      const ep = (p.expenses_id || "").trim() || `P${p.id}`;
      if (!map.has(ep)) map.set(ep, { ep, legs: [], claims: [] });
      map.get(ep)!.legs.push(p);
    }
    for (const c of claims) {
      const ep = (c.expenses_id || "").trim() || `C${c.id}`;
      if (!map.has(ep)) map.set(ep, { ep, legs: [], claims: [] });
      map.get(ep)!.claims.push(c);
    }
    // legacy grid is an INNER JOIN with pay_add_expenses: only travel groups that have a (non-draft) claim
    return [...map.values()].filter((g) => g.claims.length > 0);
  }, [plans, claims]);

  return (
    <div>
      <div className="tv-panel">
        <div className="tv-head">
          <div className="tv-head-row">
            <div className="tv-head-side"></div>
            <div className="tv-head-title">
              Approve / Reject Claims
            </div>
            <div className="tv-head-help">
              <a href="#" onClick={(e) => { e.preventDefault(); window.open("html/app_rej_claim.html", "popUpWindow", "height=500,width=600,left=100,top=100"); }}>
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
                  <th>Mode</th><th>Travel Type</th><th>Type</th><th>City Type</th><th>Date</th>
                  <th>From Destination</th><th>To Destination</th><th>From Date</th><th>To Date</th>
                  <th>Status</th><th>Claim Amount</th><th>App Amount</th>
                  <th>Last Modified</th><th>Comments</th><th>Edit</th>
                </tr>
              </thead>
              <tbody>
                {groups.map((g) => {
                  const first = [...g.legs].sort((a, b) => a.id - b.id)[0];
                  const last = [...g.legs].sort((a, b) => a.id - b.id)[g.legs.length - 1];
                  const fc = g.claims[0];
                  return (
                    <tr key={g.ep} style={{ color: "#000066" }}>
                      <td>{first?.travel_mode}</td><td>{fc?.travel_type || first?.travel_type}</td>
                      <td>{fc?.type || first?.type}</td>
                      <td>{cityLabel(fc?.city_type || first?.city_type || "")}</td>
                      <td>{fmtDDMMYYYY(fc?.date)}</td>
                      <td>{first?.from_designation}</td><td>{last?.to_designation}</td>
                      <td>{fmtDDMMYYYY(first?.from_date)}</td><td>{fmtDDMMYYYY(last?.to_date)}</td>
                      <td>{fc?.status || first?.expense_status}</td>
                      <td>{g.claims.reduce((s, c) => s + num(c.amount), 0) || ""}</td>
                      <td>{g.claims.reduce((s, c) => s + num(c.app_amount), 0) || ""}</td>
                      <td>{first?.modified_by || fc?.modified_by}</td>
                      <td>{fc?.comments || first?.comments}</td>
                      <td>{["Approved", "Rejected"].includes(String(fc?.status)) ? null : (
                        <a href="#" onClick={(e) => { e.preventDefault(); setApproveEp(g.ep); }}>Details</a>)}</td>
                    </tr>
                  );
                })}
                {groups.length === 0 && <tr><td colSpan={15} style={{ textAlign: "center" }}>No claims for approval</td></tr>}
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
        <ApproveClaimModal
          expensesId={approveEp} plans={plans} claims={claims}
          onClose={() => { setApproveEp(null); load(); }}
        />
      )}
    </div>
  );
}

/* ============ Approve/Reject popup (p_app_rej_claim) ============ */

function ApproveClaimModal({ expensesId, claims, onClose }: {
  expensesId: string; plans: Plan[]; claims: Claim[]; onClose: () => void;
}) {
  const rows = useMemo(
    () => claims.filter((c) => (c.expenses_id || "") === expensesId).sort((a, b) => a.id - b.id),
    [claims, expensesId]);
  const [amounts, setAmounts] = useState<Record<number, string>>({});
  const [comments, setComments] = useState("");

  const setApp = async (c: Claim, v: string) => {
    const val = v === "" ? "0" : v;
    // Legacy txt_comment_TextChanged: approved must not exceed claimed; only app_amount is stored
    // (the claim status is NOT changed here).
    if (num(val) > num(c.amount)) {
      alert(`Please Enter Approved Amount Less Then Or Equal To Claimed Amount ${num(c.amount)}`);
      setAmounts({ ...amounts, [c.id]: "0" });
      await mk(`${EC()}${c.id}/set-amount/`, { app_amount: "0" });
      return;
    }
    const r = await mk(`${EC()}${c.id}/set-amount/`, { app_amount: val });
    if (!r.ok) { alert(await readErr(r)); return; }
    setAmounts({ ...amounts, [c.id]: val });
  };

  const act = async (kind: "approve" | "reject" | "clarify") => {
    if (kind === "reject" || kind === "clarify") {
      if (!comments.trim()) { alert(MSG.REJECT_COMMENT_CLAIM); return; }
    }
    const open = rows.filter((c) => OPEN.includes(String(c.status)));
    if (open.length === 0) return;              // nothing to act on: no false success
    const amts: Record<string, string> = {};
    if (kind === "approve") {
      for (const c of open) {
        const app = amounts[c.id] ?? String(c.app_amount ?? c.amount ?? "0");
        if (num(app) <= 0) { alert("Enter Approve Amount!!"); return; }
        if (num(app) > num(c.amount)) {
          alert(`Please Enter Approved Amount Less Then Or Equal To Claimed Amount ${num(c.amount)}`);
          return;
        }
        amts[String(c.id)] = app;
      }
    }
    // one atomic server-side call for the whole expense group (legacy updates by Expenses_id)
    const r = await mk(`${EC()}decide/`, { expenses_id: expensesId, decision: kind, comments, amounts: amts });
    if (!r.ok) { alert(await readErr(r)); return; }
    alert(kind === "approve" ? "Add Claim Approved!!" : kind === "reject" ? "Claim Rejected!!" : "Claim Will Not Approve!!");
    onClose();
  };

  const total = rows.reduce((s, c) => s + num(amounts[c.id] ?? c.app_amount ?? 0), 0);

  return (
    <Modal title="Approve/Reject Claims" onClose={onClose} wide>
      <div className="tv-scroll" style={{ maxHeight: 300, overflow: "scroll" }}>
        <table className="tv-table" style={{ background: "#fff" }}>
          <thead><tr style={{ backgroundColor: "#006699", color: "#fff", fontWeight: "bold" }}>
            <th>#</th><th>Date</th><th>City Type</th><th>Travel type</th><th>Type</th>
            <th>Merchant</th><th>Claimed Amount</th><th>Approved Amount</th>
            <th>Description</th><th>Status</th><th>Comments</th><th>Attachments</th><th>DOWNLOAD FILE</th>
          </tr></thead>
          <tbody>
            {rows.map((c, i) => (
              <tr key={c.id} style={{ color: "#000066" }}>
                <td>{i + 1}</td><td>{fmtDDMMYYYY(c.date)}</td>
                <td>{cityLabel(c.city_type || "")}</td><td>{c.travel_type}</td><td>{c.type}</td>
                <td>{c.merchant}</td><td>{c.amount}</td>
                <td>
                  <input className="tv-input" style={{ height: 25, width: 80 }}
                    value={amounts[c.id] ?? String(c.app_amount ?? c.amount ?? "0")}
                    onChange={(e) => setAmounts({ ...amounts, [c.id]: e.target.value })}
                    onKeyPress={(e) => { if (!isNumberKey(e.key)) e.preventDefault(); }}
                    onBlur={(e) => { if (OPEN.includes(String(c.status)) && e.target.value !== String(c.app_amount ?? "")) setApp(c, e.target.value); }} />
                </td>
                <td>{c.description}</td><td>{c.status}</td><td>{c.comments}</td>
                <td>{c.attachment ? String(c.attachment).split("/").pop() : ""}</td>
                <td>{c.attachment && (
                  <a className="tv-btn tv-btn-primary" style={{ color: "white" }} target="_blank" rel="noreferrer"
                    href={attachmentHref(String(c.attachment))}>
                    DOWNLOAD
                  </a>)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={13} style={{ textAlign: "center" }}>No claims</td></tr>}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr style={{ fontWeight: "bold" }}>
              <td colSpan={6} style={{ textAlign: "right" }}>Total:</td>
              <td>{rows.reduce((s, c) => s + num(c.amount), 0)}</td>
              <td>{total}</td><td colSpan={5}></td>
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
        <button className="tv-btn tv-btn-primary" onClick={() => act("approve")}>Approve</button>
        <button className="tv-btn tv-btn-primary" onClick={() => act("clarify")}>Seeking Clarification</button>
        <button className="tv-btn tv-btn-primary" onClick={() => act("reject")}>Reject</button>
      </div>
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

const OPEN = ["Submitted", "Seeking Clarification"];

// The API returns an absolute media URL for attachments; older rows may be relative paths.
function attachmentHref(a: string): string {
  if (/^https?:\/\//i.test(a)) return a;
  if (a.startsWith("/")) return `${API_BASE_URL}${a}`;
  return `${API_BASE_URL}/media/${a.replace(/^media\//, "")}`;
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
