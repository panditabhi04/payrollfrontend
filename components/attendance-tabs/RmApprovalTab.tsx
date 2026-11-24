"use client";
/* Attendance Approval -> tab 3 "R&M Approval". Ported 1:1 from legacy Days_approval.aspx <div id="menu3">
   (r_m_validation / approval_r_m / rejection_r_m JS + ddl_client_r_m / ddl_state_r_m selection,
   btn_show_r_m_Click, gv_rm_approval, btn_r_m_aprrove_Click, btn_r_m_reject_Click,
   lnk_R_M_download_gv_Command). It approves/rejects the same rows entered in the Attendance Sheet
   "R&M Service" tab. Usage: <RmApprovalTab />  (no props; self-contained).
   Backend: /api/attendance/rm-approval/ */
import React, { useState } from "react";
import { mk, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";
import { TD, TH, downloadFile, useVendorFilters } from "./RmServiceTab";

const BASE = "/api/attendance/rm-approval";

interface ApprovalRow {
  ref: string; id: number; state_name: string; unit_name: string; unit_code: string; help_req_number: string;
  booked_date: string; vendor_invoice_date: string; vendor_invoice_no: string; gst_applicable: string;
  party_name: string; gross_amount: number; vendor_cgst: number; vendor_sgst: number; vendor_igst: number;
  amount: number; bank_holder_name: string; bank_acc_no: string; ifsc_code: string; pc_code: string;
  r_m_status: string; has_file: boolean; reject_reason: string; source: string;
}

export default function RmApprovalTab() {
  const f = useVendorFilters(BASE, true);
  const [slot, setSlot] = useState("Select");
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [shown, setShown] = useState(false);              // gv_r_m / btn_r_m visible
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const sel = () => ({ client_code: f.client, state: f.state, unit_code: f.unit, month: f.month, year: f.year, invoice_slot: slot });

  // r_m_validation()
  const validate = (): boolean => {
    if (!f.ym) { alert("Please Select Month/Year"); return false; }
    if (f.client === "Select") { alert("Please Select Client Name"); return false; }
    if (f.state === "Select") { alert("Please Select State Name"); return false; }
    if (f.unit === "Select") { alert("Please Select Branch Name"); return false; }
    if (slot === "Select") { alert("Please Select Invoice Slot"); return false; }
    return true;
  };

  const load = async (): Promise<boolean> => {
    const r = await fetch(`${API_BASE_URL}${BASE}/?${new URLSearchParams(sel() as Record<string, string>).toString()}`, { credentials: "include" });
    if (!r.ok) { alert(await responseMessage(r)); return false; }
    const d = await r.json();
    const list: ApprovalRow[] = d.results ?? [];
    setRows(list);
    setReasons(Object.fromEntries(list.map(x => [x.ref, x.reject_reason || ""])));
    setChecked(new Set());
    return true;
  };

  // btn_show_r_m_Click
  const onShow = async () => {
    if (!validate()) return;
    setBusy(true);
    try { if (await load()) setShown(true); } finally { setBusy(false); }
  };

  const allChecked = rows.length > 0 && checked.size === rows.length;
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(rows.map(r => r.ref)));
  const toggle = (ref: string) => setChecked(p => { const n = new Set(p); n.has(ref) ? n.delete(ref) : n.add(ref); return n; });

  // approval_r_m() + btn_r_m_aprrove_Click
  const onApprove = async () => {
    if (!window.confirm("Are you Sure You Want to Approve This Record")) return;
    if (checked.size === 0) { alert("Please select atleast one Record "); return; }
    setBusy(true);
    try {
      const r = await mk(`${BASE}/approve/`, { ...sel(), ids: Array.from(checked) });
      if (!r.ok) { alert(await responseMessage(r)); await load(); return; }
      const d = await r.json();
      alert(d.message);
      await load();
    } finally { setBusy(false); }
  };

  // rejection_r_m() + btn_r_m_reject_Click
  const onReject = async () => {
    if (!window.confirm("Are you Sure You Want to Reject This Record")) return;
    if (checked.size === 0) { alert("Please select atleast one Record "); return; }
    setBusy(true);
    try {
      const r = await mk(`${BASE}/reject/`, { ...sel(), ids: Array.from(checked), reasons });
      if (!r.ok) { alert(await responseMessage(r)); await load(); return; }
      const d = await r.json();
      alert(d.message);
      await load();
    } finally { setBusy(false); }
  };

  const dl = (r: ApprovalRow) => {
    if (!r.has_file || r.source !== "modern") { alert("Attachment File Cannot Be Uploaded !!!"); return; }
    downloadFile(`${BASE}/download/?id=${r.id}`, "R_M-Billing_type");
  };

  const star = <span style={{ color: "red" }}>*</span>;
  const heads = ["STATE NAME", "BRANCH NAME", "HELP REQ NUMBER", "BOOKING DATE", "VENDOR INVOICE DATE", "VENDOR INVOICE NO",
    "GST Applicable ", "PARTY NAME", "GROSS AMOUNT ", "CGST", "SGST", "IGST", "AMOUNT", "BANK HOLDER NAME", "BANK ACC NUMBER ",
    "IFSC CODE ", "PC Code ", "STATUS ", "DOWNLOAD", "REJECT REASON"];

  return (
    <div>
      <div className="row" style={{ margin: 0 }}>
        <div className="col-sm-2 col-xs-12">
          <b>Month / Year :{star}</b>
          <input type="month" className="form-control" style={{ width: "100%" }} value={f.ym} onChange={e => f.setYm(e.target.value)} />
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>Client Name :</b> {star}
          <select className="form-control" style={{ width: "100%" }} value={f.client} onChange={e => { f.setClient(e.target.value); setShown(false); setRows([]); }}>
            <option value="Select">Select</option>
            {f.clients.map(c => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>State :</b>{star}
          <select className="form-control" style={{ width: "100%" }} value={f.state} onChange={e => f.setState(e.target.value)}>
            <option value="Select">Select</option>
            {f.client !== "Select" && <option value="All">All</option>}
            {f.states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>Branch Name : {star}</b>
          <select className="form-control" style={{ width: "100%" }} value={f.unit} onChange={e => f.setUnit(e.target.value)}>
            <option value="Select">Select</option>
            {f.branches.length > 0 && <option value="All">All</option>}
            {f.branches.map(b => <option key={b.unit_code} value={b.unit_code}>{b.unit_name}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-10">
          <b>Invoice Slot :{star}</b>
          <select className="form-control" style={{ width: "100%" }} value={slot} onChange={e => setSlot(e.target.value)}>
            <option value="Select">Select</option>
            <option value="1_to_15">1 to 15</option>
            <option value="16_to_30">16 to 30</option>
          </select>
        </div>
        <br />
        <div className="col-sm-2 col-xs-12">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onShow}>Show</button>
        </div>
      </div>
      <br />

      {shown && (
        <div>
          <div className="row text-center" style={{ margin: 0 }}><h3>R&amp;M Approve By HO</h3></div>
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ color: "#333", width: "100%" }}>
              <thead>
                <tr>
                  <th style={TH}>Sr No.</th>
                  <th style={TH}><label style={{ margin: 0 }}><input type="checkbox" checked={allChecked} onChange={toggleAll} /> SELECT </label></th>
                  {heads.map(h => <th key={h} style={TH}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td style={TD} colSpan={heads.length + 2}>No records found... !!!</td></tr>
                )}
                {rows.map((r, i) => {
                  const bg = r.r_m_status.toUpperCase() === "APPROVE BY ADMIN" ? "#90EE90" : "#fff";
                  const cell = { ...TD, background: bg };
                  return (
                    <tr key={r.ref}>
                      <td style={cell}>{i + 1}</td>
                      <td style={cell}><input type="checkbox" className="center-block" checked={checked.has(r.ref)} onChange={() => toggle(r.ref)} /></td>
                      <td style={cell}>{r.state_name}</td><td style={cell}>{r.unit_name}</td>
                      <td style={cell}>{r.help_req_number}</td><td style={cell}>{r.booked_date}</td>
                      <td style={cell}>{r.vendor_invoice_date}</td><td style={cell}>{r.vendor_invoice_no}</td>
                      <td style={cell}>{r.gst_applicable}</td><td style={cell}>{r.party_name}</td>
                      <td style={cell}>{r.gross_amount}</td><td style={cell}>{r.vendor_cgst}</td>
                      <td style={cell}>{r.vendor_sgst}</td><td style={cell}>{r.vendor_igst}</td>
                      <td style={cell}>{r.amount}</td><td style={cell}>{r.bank_holder_name}</td>
                      <td style={cell}>{r.bank_acc_no}</td><td style={cell}>{r.ifsc_code}</td>
                      <td style={cell}>{r.pc_code}</td><td style={cell}>{r.r_m_status}</td>
                      <td style={cell}><button type="button" className="btn btn-primary" style={{ color: "white", width: "auto" }} onClick={() => dl(r)}>Download</button></td>
                      <td style={cell}>
                        <input className="form-control" style={{ width: 180 }} value={reasons[r.ref] ?? ""}
                          onChange={e => setReasons(p => ({ ...p, [r.ref]: e.target.value }))} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <br />
          <div className="row text-center" style={{ margin: 0 }}>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={onApprove}>Approve</button>{" "}
            <button type="button" className="btn btn-primary" disabled={busy} onClick={onReject}>Reject</button>
          </div>
        </div>
      )}
    </div>
  );
}
