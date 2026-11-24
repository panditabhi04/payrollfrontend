"use client";
// Cash-voucher approval queues - account_department.aspx (Accounts), HOD_Approval.aspx (HOD, reporting
// chain scoped) and authorised_signatory.aspx (Authorised Signatory). The Finance "Paid" step lives at
// /finance-dept. Each queue is gated server-side by its own legacy menu; a queue the user may not open
// simply shows the server's message. Rejection requires a reason ("Please Enter Rejection Reason").
import React, { useCallback, useEffect, useState } from "react";
import { getJSON, mk } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

// account_department.aspx ddl_debt_to items (exact legacy values)
const DEBIT_TO = ["OFFICE EXPENSES", "LEGAL EXPENSES", "COMPUTER_PRINTER EXPENSES", "TRAVELLING EXPENSES",
  "FOOD AND REFRESHMENT EXPENSES", "POSTAGE AND TELEGRAM EXPENSES", "Others"];

const B = "/api/transactions/cash-vouchers";
type Level = "accounts" | "hod" | "signatory";
const LEVELS: { key: Level; label: string; actionable: string; approve: string; reject: string }[] = [
  { key: "accounts", label: "Accounts Approval", actionable: "1", approve: "accounts_approve", reject: "accounts_reject" },
  { key: "hod", label: "HOD Approval", actionable: "2", approve: "hod_approve", reject: "hod_reject" },
  { key: "signatory", label: "Authorised Signatory Approval", actionable: "4", approve: "signatory_approve", reject: "signatory_reject" },
];

interface Row {
  id: number; cash_rs: number; receiver_name: string; request_date: string; narration: string;
  debited_to: string; status: string; status_label: string; rejection_reason: string; reference_code?: string;
  soft_copy_file?: string;
}

async function errText(r: Response, fallback = "Failed"): Promise<string> {
  try {
    const b = await r.json();
    if (typeof b === "string") return b;
    if (Array.isArray(b)) return b.map(String).join(" ");
    if (b && typeof b === "object" && typeof (b as any).detail === "string") return (b as any).detail;
  } catch { /* fall through */ }
  return fallback;
}

export default function CashVoucherApprovals({ only }: { only?: Level } = {}) {
  const [level, setLevel] = useState<Level>(only ?? "accounts");
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState("");
  // account_department.aspx row editors: Debited To, Narration and the inline rejection reason
  const [edits, setEdits] = useState<Record<number, { debited_to?: string; narration?: string; reason?: string }>>({});
  const setEdit = (id: number, patch: { debited_to?: string; narration?: string; reason?: string }) =>
    setEdits((p) => ({ ...p, [id]: { ...(p[id] || {}), ...patch } }));
  const cur = LEVELS.find((l) => l.key === level)!;

  const load = useCallback(async () => {
    setMsg("");
    const r = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000"}${B}/?queue=${level}`, { credentials: "include", cache: "no-store" });
    if (!r.ok) { setRows([]); setMsg(await errText(r, `Failed (${r.status})`)); return; }
    const d = await r.json();
    setRows(Array.isArray(d) ? d : (d?.results ?? []));
  }, [level]);
  useEffect(() => { load(); }, [load]);

  const act = async (id: number, action: string, reject: boolean) => {
    const body: Record<string, string> = {};
    if (level === "hod" || level === "signatory") {
      // HOD_Approval.aspx / authorised_signatory.aspx: inline reason textbox + legacy confirm / success texts
      const ed = edits[id] || {};
      if (reject) {
        if (!window.confirm("Are you sure you want to Reject this Record?")) return;
        const reason = (ed.reason ?? "").trim();
        if (!reason) { window.alert("Please Enter Rejection Reason....!!!"); return; }
        body.rejection_reason = reason;
      } else if (!window.confirm("Are you sure you want to Approve this Record?")) return;
      const r = await mk(`${B}/${id}/${action}/`, body);
      if (r.ok) {
        const t = reject ? " Request Reject Successfully... !!!" : " Request Approved Successfully... !!!";
        setMsg(t); window.alert(t); load();
      } else { const t = await errText(r); setMsg(t); window.alert(t); }
      return;
    }
    if (level === "accounts") {
      // account_department.aspx: inline reason textbox + legacy confirm / success texts
      const ed = edits[id] || {};
      const row = rows.find((x) => x.id === id);
      if (reject) {
        if (!window.confirm("Are you sure you want to Reject this Record?")) return;
        const reason = (ed.reason ?? "").trim();
        if (!reason) { window.alert("Please Enter Rejection Reason....!!!"); return; }
        body.rejection_reason = reason;
      } else {
        if (!window.confirm("Are you sure you want to Approve this Record?")) return;
        body.debited_to = ed.debited_to ?? (DEBIT_TO.includes((row?.debited_to || "").trim()) ? (row?.debited_to || "").trim() : DEBIT_TO[0]);
        body.narration = ed.narration ?? row?.narration ?? "";
      }
      const r = await mk(`${B}/${id}/${action}/`, body);
      if (r.ok) {
        const t = reject ? " Request Reject Successfully... !!!" : " Request Approved Successfully... !!!";
        setMsg(t); window.alert(t); load();
      } else { const t = await errText(r); setMsg(t); window.alert(t); }
      return;
    }
    // (every level is handled above)
  };

  // btn_tally_report_Click: Accounts_Report.xls (status 1,2,3); HOD: btn_tally_report_Click3 HOD_Report.xls (2,4,5);
  // Authorised Signatory: Authorised_Signatory_Report.xls (4,6,7)
  const report = async () => {
    try {
      const ep = level === "hod" ? "hod_report" : level === "signatory" ? "signatory_report" : "accounts_report";
      const fn = level === "hod" ? "HOD_Report.xls" : level === "signatory" ? "Authorised_Signatory_Report.xls" : "Accounts_Report.xls";
      const r = await fetch(`${API_BASE_URL}${B}/${ep}/`, { credentials: "include" });
      if (!r.ok) { window.alert(await errText(r, `Failed (${r.status})`)); return; }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = fn; a.click();
      URL.revokeObjectURL(a.href);
    } catch { window.alert("Failed to generate report"); }
  };

  // link_soft_copy_Click: authenticated download of the stored attachment
  const download = async (r: Row) => {
    try {
      const res = await fetch(`${API_BASE_URL}${B}/${r.id}/proof/`, { credentials: "include" });
      if (!res.ok) { window.alert("File Can not Found!!."); return; }
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = r.soft_copy_file || "attachment"; a.click();
      URL.revokeObjectURL(a.href);
    } catch { window.alert("File Can not Found!!."); }
  };

  return (
    <div style={{ marginTop: 18 }}>
      {!only && <div style={{ margin: "8px 0" }}>
        {LEVELS.map((l) => (
          <button key={l.key} className="btn btn-default" onClick={() => setLevel(l.key)}
            style={{ marginRight: 6, fontWeight: l.key === level ? 700 : 400 }}>{l.label}</button>
        ))}
      </div>}
      {msg && <div style={{ color: "#424D7A", margin: "6px 0" }}>{msg}</div>}
      <div style={{ overflowX: "auto" }}>
        <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff" }}>
          <thead style={{ background: "#006699", color: "white" }}>
            <tr><th>Sr No.</th><th>Reference</th><th>Amount</th><th>Receiver Name</th>
              {level === "accounts" ? <th>Debited To</th> : null}
              <th>Request Date</th><th>Narration</th>
              {level !== "accounts" ? <th>Debited To</th> : null}
              <th>Status</th>
              {level === "accounts" || level === "hod" || level === "signatory" ? <th>Image</th> : null}
              <th>Action</th><th>Reason Of Rejection</th></tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const actionable = String(r.status) === cur.actionable;
              const ed = edits[r.id] || {};
              const curDebit = ed.debited_to ?? (DEBIT_TO.includes((r.debited_to || "").trim()) ? (r.debited_to || "").trim() : DEBIT_TO[0]);
              return (
                <tr key={r.id}>
                  <td>{i + 1}</td><td>{r.reference_code}</td><td>{r.cash_rs}</td><td>{r.receiver_name}</td>
                  {level === "accounts" && <td>
                    <select className="form-control text_box" style={{ width: "100%" }} disabled={!actionable}
                      value={curDebit} onChange={(e) => setEdit(r.id, { debited_to: e.target.value })}>
                      {DEBIT_TO.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select></td>}
                  <td>{r.request_date}</td>
                  <td>{level === "accounts"
                    ? <input type="text" className="form-control" style={{ width: 180 }} disabled={!actionable} maxLength={255}
                        value={ed.narration ?? r.narration ?? ""} onChange={(e) => setEdit(r.id, { narration: e.target.value })} />
                    : r.narration}</td>
                  {level !== "accounts" && <td>{r.debited_to}</td>}
                  <td>{r.status_label}</td>
                  {(level === "accounts" || level === "hod" || level === "signatory") && <td style={{ textAlign: "center" }}>
                    {r.soft_copy_file ? <button type="button" className="btn btn-link" style={{ color: "red", padding: 0 }} onClick={() => download(r)}>Download</button> : null}
                  </td>}
                  <td>{actionable && <>
                    <button className="btn btn-primary btn-xs" onClick={() => act(r.id, cur.approve, false)}>Approve</button>{" "}
                    <button className="btn btn-primary btn-xs" onClick={() => act(r.id, cur.reject, true)}>Reject</button></>}</td>
                  <td>{(level === "accounts" || level === "hod" || level === "signatory") && actionable
                    ? <input type="text" className="form-control" style={{ width: 180 }} maxLength={255}
                        value={ed.reason ?? r.rejection_reason ?? ""} onChange={(e) => setEdit(r.id, { reason: e.target.value })} />
                    : r.rejection_reason}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={11} style={{ textAlign: "center", color: "#777", padding: 10 }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
      {(level === "accounts" || level === "hod" || level === "signatory") && (
        <div className="row text-center" style={{ marginTop: 8 }}>
          <button type="button" className="btn btn-large btn-default" onClick={report}>Report</button>
        </div>
      )}
    </div>
  );
}
