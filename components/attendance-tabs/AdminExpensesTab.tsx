"use client";
/* Attendance Sheet -> "Administrative Expenses" tab. Ported 1:1 from legacy emp_sample.aspx
   <div id="menu8"> (markup + Req_validation_adm / Req_save_val_administartive JS +
   btn_process_administrative_Click, btn_save_administrative_Click, btn_admin_aprrove_Click,
   lnk_admin_Command, lnk_admin_download_gv_Command(+1), txt_*_adm_TextChanged).
   Usage: <AdminExpensesTab />   (no props; self-contained). Backend: /api/attendance/admin-expenses/ */
import React, { useRef, useState } from "react";
import { mk, upload, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";
import {
  TD, TH, alnumSpace, decimal, digits, downloadFile, isoToDMY, num, todayDMY, todayISO, useVendorFilters,
} from "./RmServiceTab";

const BASE = "/api/attendance/admin-expenses";

interface AdminRow {
  id: number; booked_date: string; vendor_invoice_date: string; party_name: string; days: string;
  bank_holder_name: string; bank_acc_no: string; ifsc_code: string; gross_amount: number; vendor_sgst: number;
  vendor_cgst: number; vendor_igst: number; amount: number; vendor_invoice_no: string; admini_status: string;
  has_file: boolean;
}

const EMPTY = {
  party_name: "", days: "", gross_amount: "0", vendor_igst: "0", vendor_cgst: "0", vendor_sgst: "0", amount: "0",
  bank_holder_name: "", bank_acc_no: "", ifsc_code: "", vendor_invoice_date: "", vendor_invoice_no: "",
};

export default function AdminExpensesTab() {
  const f = useVendorFilters(BASE, false);
  const [panel, setPanel] = useState(false);              // administrative_panel
  const [rows, setRows] = useState<AdminRow[]>([]);       // gv_admin
  const [procRows, setProcRows] = useState<AdminRow[]>([]); // process_admin
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [form, setForm] = useState({ ...EMPTY });
  const [booking] = useState(todayDMY());
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof EMPTY, v: string) => setForm(p => ({ ...p, [k]: v }));
  // txt_*_adm_TextChanged: amount = gross + igst + cgst + sgst
  const money = (k: "gross_amount" | "vendor_igst" | "vendor_cgst" | "vendor_sgst", v: string) =>
    setForm(p => {
      const n = { ...p, [k]: decimal(v) };
      return { ...n, amount: String(num(n.gross_amount) + num(n.vendor_igst) + num(n.vendor_cgst) + num(n.vendor_sgst)) };
    });

  const sel = () => ({ client_code: f.client, state: f.state, unit_code: f.unit, month: f.month, year: f.year });
  const q = () => new URLSearchParams(sel() as Record<string, string>).toString();

  // Req_validation_adm()
  const validateProcess = (): boolean => {
    if (f.client === "Select") { alert("Please Select Client"); return false; }
    if (f.state === "Select") { alert("Please Select State"); return false; }
    if (f.unit === "Select") { alert("Please Select Branch"); return false; }
    if (!f.ym) { alert("Please Select Month/Year"); return false; }
    return true;
  };

  const loadGrid = async (): Promise<{ locked: boolean } | null> => {
    const r = await fetch(`${API_BASE_URL}${BASE}/process/?${q()}`, { credentials: "include" });
    if (!r.ok) { alert(await responseMessage(r)); return null; }
    const d = await r.json();
    setRows(d.rows ?? []); setProcRows(d.process_rows ?? []); setChecked(new Set());
    return d;
  };

  // btn_process_administrative_Click
  const onProcess = async () => {
    if (!validateProcess()) return;
    setBusy(true);
    try {
      setForm({ ...EMPTY });
      const r = await fetch(`${API_BASE_URL}${BASE}/process/?${q()}`, { credentials: "include" });
      if (!r.ok) { alert(await responseMessage(r)); return; }
      const d = await r.json();
      setRows(d.rows ?? []); setProcRows(d.process_rows ?? []); setChecked(new Set());
      if (d.locked) { alert(d.message); setPanel(false); } else setPanel(true);
      if (fileRef.current) fileRef.current.value = "";
    } finally { setBusy(false); }
  };

  // Req_save_val_administartive()
  const validateSave = (): boolean => {
    if (!form.party_name) { alert("Please Enter Party Name"); return false; }
    if (!form.days) { alert("Please Enter Days"); return false; }
    if (form.gross_amount === "") { alert("Please Enter Gross amount"); return false; }
    if (form.vendor_igst === "") { alert("Please Enter IGST"); return false; }
    if (form.vendor_cgst === "") { alert("Please Enter CGST"); return false; }
    if (form.vendor_sgst === "") { alert("Please Enter SGST"); return false; }
    if (form.amount === "") { alert("Please Enter amount"); return false; }
    if (!form.bank_holder_name) { alert("Please Enter Bank Holder Name"); return false; }
    if (!form.bank_acc_no) { alert("Please Enter Bank Account Number"); return false; }
    if (!form.ifsc_code) { alert("Please Enter IFSC Code"); return false; }
    if (!booking) { alert("Please Enter Booking Date"); return false; }
    if (!form.vendor_invoice_date) { alert("Please Enter Vendor Invoice Date"); return false; }
    if (!form.vendor_invoice_no) { alert("Please Enter Vendor Invoice Number"); return false; }
    if (!fileRef.current?.files?.length) { alert("Please Upload File"); return false; }
    return true;
  };

  // btn_save_administrative_Click
  const onSave = async () => {
    if (!validateSave()) return;
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(sel()).forEach(([k, v]) => fd.append(k, v));
      fd.append("booked_date", booking);
      fd.append("vendor_invoice_date", isoToDMY(form.vendor_invoice_date));
      (["party_name", "days", "gross_amount", "vendor_igst", "vendor_cgst", "vendor_sgst", "bank_holder_name",
        "bank_acc_no", "ifsc_code", "vendor_invoice_no"] as const).forEach(k => fd.append(k, form[k]));
      fd.append("attachment", fileRef.current!.files![0]);
      const r = await upload(`${BASE}/save/`, fd);
      if (!r.ok) { alert(await responseMessage(r, "Record not saved.")); return; }
      const d = await r.json();
      (d.messages as string[] ?? []).forEach(m => alert(m));
      setRows(d.rows ?? []); setChecked(new Set());
      setForm({ ...EMPTY });
      if (fileRef.current) fileRef.current.value = "";
    } finally { setBusy(false); }
  };

  // btn_admin_aprrove_Click
  const onApprove = async () => {
    setBusy(true);
    try {
      const r = await mk(`${BASE}/approve/`, { ...sel(), ids: Array.from(checked) });
      if (!r.ok) { alert(await responseMessage(r)); return; }
      const d = await r.json();
      alert(d.message);
      setPanel(false);
      const g = await loadGrid();
      if (g?.locked) setRows([]);
    } finally { setBusy(false); }
  };

  // lnk_admin_Command (Delete)
  const onDelete = async (id: number) => {
    const r = await mk(`${BASE}/delete-row/`, { id });
    if (!r.ok) { alert(await responseMessage(r)); return; }
    await loadGrid();
  };

  const onClose = () => {
    f.reset(); setPanel(false); setRows([]); setProcRows([]); setChecked(new Set()); setForm({ ...EMPTY });
  };

  const allChecked = rows.length > 0 && checked.size === rows.length;
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(rows.map(r => r.id)));
  const toggle = (id: number) => setChecked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const dl = (r: AdminRow) => {
    if (!r.has_file) { alert("Attachment File Cannot Be Uploaded !!!"); return; }
    downloadFile(`${BASE}/download/?id=${r.id}`, "Administrative-Billing_type");
  };

  const star = <span style={{ color: "red" }}>*</span>;

  return (
    <div>
      <div className="row" style={{ margin: 0 }}>
        <div className="col-sm-2 col-xs-12">
          <b>Client Name : {star}</b>
          <select className="form-control" style={{ width: "100%" }} value={f.client} onChange={e => { f.setClient(e.target.value); setPanel(false); }}>
            <option value="Select">Select</option>
            {f.clients.map(c => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>State :{star}</b>
          <select className="form-control" style={{ width: "100%" }} value={f.state} onChange={e => { f.setState(e.target.value); setPanel(false); setRows([]); setProcRows([]); }}>
            <option value="Select">Select</option>
            {f.states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>Branch Name : {star}</b>
          <select className="form-control" style={{ width: "100%" }} value={f.unit} onChange={e => f.setUnit(e.target.value)}>
            <option value="Select">Select</option>
            {f.branches.map(b => <option key={b.unit_code} value={b.unit_code}>{b.unit_name}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>Month / Year :{star}</b>
          <input type="month" className="form-control" style={{ width: "100%" }} value={f.ym} onChange={e => f.setYm(e.target.value)} />
        </div>
        <div className="col-sm-4 col-xs-12">
          <br />
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onProcess}>Process</button>{" "}
          <button type="button" className="btn btn-danger" onClick={onClose}>Close</button>
        </div>
      </div>
      <br /><br />

      {panel && (
        <div className="row" style={{ margin: 0 }}>
          <div className="container-fluid">
            <div className="row" style={{ margin: 0 }}>
              <div className="col-sm-2 col-xs-12">
                <b>Party Name : {star} </b>
                <input className="form-control" value={form.party_name} onChange={e => set("party_name", e.target.value)} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>Days :{star} </b>
                <input className="form-control" value={form.days} onChange={e => set("days", digits(e.target.value))} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>Gross Amount :{star}</b>
                <input className="form-control" value={form.gross_amount} onChange={e => money("gross_amount", e.target.value)} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>IGST :{star}</b>
                <input className="form-control" value={form.vendor_igst} onChange={e => money("vendor_igst", e.target.value)} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>CGST :{star}</b>
                <input className="form-control" value={form.vendor_cgst} onChange={e => money("vendor_cgst", e.target.value)} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>SGST :{star}</b>
                <input className="form-control" value={form.vendor_sgst} onChange={e => money("vendor_sgst", e.target.value)} />
              </div>
            </div>
            <br />
            <div className="row" style={{ margin: 0 }}>
              <div className="col-sm-2 col-xs-12">
                <b>Amount :{star}  </b>
                <input className="form-control" readOnly value={form.amount} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>Bank Holder Name : {star} </b>
                <input className="form-control" value={form.bank_holder_name} onChange={e => set("bank_holder_name", e.target.value)} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>Bank Account No :{star} </b>
                <input className="form-control" maxLength={30} autoComplete="off" value={form.bank_acc_no} onChange={e => set("bank_acc_no", digits(e.target.value))} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>IFSC :{star}  </b>
                <input className="form-control" maxLength={12} value={form.ifsc_code} onChange={e => set("ifsc_code", alnumSpace(e.target.value))} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>Booking Date :{star}</b>
                <input className="form-control" readOnly maxLength={12} value={booking} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>Vendor Invoice Date :{star}</b>
                <input type="date" className="form-control" max={todayISO()} value={form.vendor_invoice_date} onChange={e => set("vendor_invoice_date", e.target.value)} />
              </div>
            </div>
            <br />
            <div className="row" style={{ margin: 0 }}>
              <br /><br />
              <div className="col-sm-2 col-xs-12">
                <b>Vendor Invoice No :{star}</b>
                <input className="form-control" value={form.vendor_invoice_no} onChange={e => set("vendor_invoice_no", e.target.value)} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <table className="table table-striped" style={{ width: "100%" }}>
                  <tbody>
                    <tr>
                      <td>
                        File to Upload :
                        <input type="file" ref={fileRef} accept=".jpg,.jpeg,.png,.gif,.pdf,.rar,.zip" />
                        <span style={{ color: "red", fontSize: "8px", fontWeight: "bold" }}>Only JPG,JPEG,GIF,PDF</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <br />
          </div>
        </div>
      )}

      {/* gv_admin: Administrative Approve By Admin */}
      {panel && rows.length > 0 && (
        <div style={{ overflow: "auto", border: "none" }}>
          <div className="row text-center" style={{ margin: 0 }}><h3>Administrative Approve By Admin</h3></div>
          <table className="table" style={{ color: "#333", width: "100%" }}>
            <thead>
              <tr>
                <th style={TH}>Sr No.</th>
                <th style={TH}><label style={{ margin: 0 }}><input type="checkbox" checked={allChecked} onChange={toggleAll} /> SELECT </label></th>
                {["BOOKING DATE", "VENDOR INVOICE DATE", "PARTY NAME", "DAYS", "BANK HOLDER NAME", "BANK ACC NUMBER ", "IFSC CODE ",
                  "GROSS AMOUNT ", "SGST", "CGST", "IGST", "AMOUNT", "VENDOR INVOICE NO", "STATUS ", "DOWNLOAD", "DELETE"]
                  .map(h => <th key={h} style={TH}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td style={TD}>{i + 1}</td>
                  <td style={TD}><input type="checkbox" className="center-block" checked={checked.has(r.id)} onChange={() => toggle(r.id)} /></td>
                  <td style={TD}>{r.booked_date}</td><td style={TD}>{r.vendor_invoice_date}</td>
                  <td style={TD}>{r.party_name}</td><td style={TD}>{r.days}</td>
                  <td style={TD}>{r.bank_holder_name}</td><td style={TD}>{r.bank_acc_no}</td>
                  <td style={TD}>{r.ifsc_code}</td><td style={TD}>{r.gross_amount}</td>
                  <td style={TD}>{r.vendor_sgst}</td><td style={TD}>{r.vendor_cgst}</td>
                  <td style={TD}>{r.vendor_igst}</td><td style={TD}>{r.amount}</td>
                  <td style={TD}>{r.vendor_invoice_no}</td><td style={TD}>{r.admini_status}</td>
                  <td style={TD}><button type="button" className="btn btn-primary" style={{ color: "white" }} onClick={() => dl(r)}>Download</button></td>
                  <td style={TD}><button type="button" className="btn btn-primary" style={{ color: "white" }} onClick={() => onDelete(r.id)}>Delete</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <br />

      {panel && (
        <div className="row text-center" style={{ margin: 0 }}>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onSave}>Save</button>{" "}
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onApprove}>Approve</button>{" "}
          <button type="button" className="btn btn-danger" onClick={onClose}>Close</button>
        </div>
      )}

      {/* process_admin: approved rows (read only) */}
      {!panel && procRows.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ color: "#333", width: "100%" }}>
            <thead>
              <tr>
                <th style={TH}>Sr No.</th>
                {["PARTY NAME", "DAYS", "AMOUNT", "BANK ACC NUMBER ", "IFSC CODE ", "STATUS ", "DOWNLOAD"].map(h => <th key={h} style={TH}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {procRows.map((r, i) => (
                <tr key={r.id}>
                  <td style={TD}>{i + 1}</td>
                  <td style={TD}>{r.party_name}</td><td style={TD}>{r.days}</td><td style={TD}>{r.amount}</td>
                  <td style={TD}>{r.bank_acc_no}</td><td style={TD}>{r.ifsc_code}</td><td style={TD}>{r.admini_status}</td>
                  <td style={TD}><button type="button" className="btn btn-primary" style={{ color: "white" }} onClick={() => dl(r)}>Download</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
