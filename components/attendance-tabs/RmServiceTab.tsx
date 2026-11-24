"use client";
/* Attendance Sheet -> "R&M Service" tab. Ported 1:1 from legacy emp_sample.aspx <div id="menu7">
   (markup + Req_validation_service / Req_save_val_service JS + btn_process_service_Click,
   btn_save_service_Click, btn_r_m_aprrove_Click, lnk_R_M_Command, lnk_R_M_download_gv_Command,
   ddl_gst_r_m_SelectedIndexChanged1, txt_*_TextChanged).
   Usage: <RmServiceTab />   (no props; self-contained). Backend: /api/attendance/rm-service/ */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { getJSON, mk, upload, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

export const RM_BASE = "/api/attendance/rm-service";

export interface ClientOpt { client_code: string; client_name: string; }
export interface BranchOpt { unit_code: string; unit_name: string; }

export const TH: React.CSSProperties = { background: "#006699", color: "#fff", textTransform: "uppercase", padding: "6px 8px", whiteSpace: "nowrap" };
export const TD: React.CSSProperties = { color: "#000066", background: "#fff", padding: "6px 8px" };

/** dd/mm/yyyy of today (legacy txt_current_date / txt_booking_date_adm). */
export function todayDMY(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}
/** yyyy-mm-dd (date input) -> dd/mm/yyyy */
export function isoToDMY(v: string): string {
  if (!v) return "";
  const [y, m, d] = v.split("-");
  return `${d}/${m}/${y}`;
}
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function num(v: string): number {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}
/** keep only digits (isNumber_acc) */
export const digits = (v: string) => v.replace(/[^0-9]/g, "");
/** digits and one dot (isNumber_dot_amt_r_m) */
export const decimal = (v: string) => {
  const c = v.replace(/[^0-9.]/g, "");
  const i = c.indexOf(".");
  return i < 0 ? c : c.slice(0, i + 1) + c.slice(i + 1).replace(/\./g, "");
};
/** letters, space, '-' and '.' (AllowAlphabet) */
export const alphabet = (v: string) => v.replace(/[^A-Za-z .\-]/g, "");
/** letters, digits and space (allowAlphaNumericSpace) */
export const alnumSpace = (v: string) => v.replace(/[^A-Za-z0-9 ]/g, "");

/** Save a file returned by an authenticated endpoint; surfaces the backend message on failure. */
export async function downloadFile(url: string, fallbackName: string) {
  const r = await fetch(`${API_BASE_URL}${url}`, { credentials: "include" });
  if (!r.ok) { alert(await responseMessage(r, "Attachment File Cannot Be Uploaded !!!")); return; }
  const cd = r.headers.get("Content-Disposition") || "";
  const m = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(cd);
  const blob = await r.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = m ? decodeURIComponent(m[1]) : fallbackName;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

/** Client / State / Branch / Month-Year selectors shared by the three tabs (legacy cascading ddls). */
export function useVendorFilters(base: string, withAll: boolean) {
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [branches, setBranches] = useState<BranchOpt[]>([]);
  const [client, setClientV] = useState("Select");
  const [state, setStateV] = useState("Select");
  const [unit, setUnit] = useState("Select");
  const [ym, setYm] = useState("");      // yyyy-mm

  useEffect(() => {
    getJSON<{ clients: ClientOpt[] }>(`${base}/options/`).then(d => setClients(d?.clients ?? []));
  }, [base]);

  const monthQ = () => (ym ? `&month=${parseInt(ym.split("-")[1], 10)}&year=${ym.split("-")[0]}` : "");

  const setClient = async (c: string) => {
    setClientV(c); setStateV("Select"); setUnit("Select"); setBranches([]); setStates([]);
    if (c === "Select") return;
    const d = await getJSON<{ states: string[] }>(`${base}/options/?client_code=${encodeURIComponent(c)}`);
    setStates(d?.states ?? []);
  };
  const loadBranches = useCallback(async (c: string, s: string) => {
    setUnit("Select"); setBranches([]);
    if (c === "Select" || s === "Select") return;
    const d = await getJSON<{ branches: BranchOpt[] }>(
      `${base}/options/?client_code=${encodeURIComponent(c)}&state=${encodeURIComponent(s)}${monthQ()}`);
    setBranches(d?.branches ?? []);
  }, [base, ym]); // eslint-disable-line react-hooks/exhaustive-deps
  const setState = (s: string) => { setStateV(s); loadBranches(client, s); };
  // branch list depends on the month (branch_close_date) -> reload when month changes
  useEffect(() => { if (client !== "Select" && state !== "Select") loadBranches(client, state); }, [ym]); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => { setClientV("Select"); setStateV("Select"); setUnit("Select"); setStates([]); setBranches([]); setYm(""); };
  const month = ym ? String(parseInt(ym.split("-")[1], 10)) : "";
  const year = ym ? ym.split("-")[0] : "";
  return { clients, states, branches, client, state, unit, ym, month, year, setClient, setState, setUnit, setYm, reset, withAll };
}

export interface RmRow {
  id: number; help_req_number: string; booked_date: string; vendor_invoice_date: string; vendor_invoice_no: string;
  gst_applicable: string; party_name: string; gross_amount: number; vendor_igst: number; vendor_cgst: number;
  vendor_sgst: number; amount: number; bank_holder_name: string; bank_acc_no: string; ifsc_code: string;
  r_m_status: string; has_file: boolean;
}

const EMPTY = {
  help_req_number: "", vendor_invoice_date: "", vendor_invoice_no: "", gst_applicable: "0", party_name: "",
  gross_amount: "0", vendor_igst: "0", vendor_cgst: "0", vendor_sgst: "0", amount: "0",
  bank_holder_name: "", bank_acc_no: "", ifsc_code: "", bank_name: "", gst_no: "", hsn_no: "", description: "",
};

const fieldStyle: React.CSSProperties = { width: "100%" };

export default function RmServiceTab() {
  const f = useVendorFilters(RM_BASE, false);
  const [slot, setSlot] = useState("Select");
  const [panel, setPanel] = useState(false);          // RandM_panel (entry form)
  const [rows, setRows] = useState<RmRow[]>([]);      // gv_rm
  const [procRows, setProcRows] = useState<RmRow[]>([]); // process_gv_r_m
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [form, setForm] = useState({ ...EMPTY });
  const [booking] = useState(todayDMY());
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof EMPTY, v: string) => setForm(p => ({ ...p, [k]: v }));
  const gstOn = form.gst_applicable === "1";

  // --- amount = gross + igst + cgst + sgst (txt_*_TextChanged) with IGST vs CGST/SGST exclusivity
  const recalc = (p: typeof EMPTY) => ({ ...p, amount: String(num(p.gross_amount) + num(p.vendor_igst) + num(p.vendor_cgst) + num(p.vendor_sgst)) });
  const onGross = (v: string) => setForm(p => recalc({ ...p, gross_amount: decimal(v) }));
  const onIgst = (v: string) => setForm(p => recalc({ ...p, vendor_igst: decimal(v), vendor_cgst: "0", vendor_sgst: "0" }));
  const onCgst = (v: string) => setForm(p => recalc({ ...p, vendor_cgst: decimal(v), vendor_igst: "0" }));
  const onSgst = (v: string) => setForm(p => recalc({ ...p, vendor_sgst: decimal(v), vendor_igst: "0" }));

  const sel = () => ({
    client_code: f.client, state: f.state, unit_code: f.unit, month: f.month, year: f.year, invoice_slot: slot,
  });
  const q = () => new URLSearchParams(sel() as Record<string, string>).toString();

  // Req_validation_service()
  const validateProcess = (): boolean => {
    if (f.client === "Select") { alert("Please Select Client"); return false; }
    if (f.state === "Select") { alert("Please Select State"); return false; }
    if (f.unit === "Select") { alert("Please Select Branch"); return false; }
    if (!f.ym) { alert("Please Select Month/Year"); return false; }
    if (slot === "Select") { alert("Please Select Invoice Slot"); return false; }
    return true;
  };

  const loadGrid = async (): Promise<{ locked: boolean } | null> => {
    const r = await fetch(`${API_BASE_URL}${RM_BASE}/process/?${q()}`, { credentials: "include" });
    if (!r.ok) { alert(await responseMessage(r)); return null; }
    const d = await r.json();
    setRows(d.rows ?? []); setProcRows(d.process_rows ?? []); setChecked(new Set());
    return d;
  };

  // btn_process_service_Click
  const onProcess = async () => {
    if (!validateProcess()) return;
    setBusy(true);
    try {
      setForm({ ...EMPTY });
      const r = await fetch(`${API_BASE_URL}${RM_BASE}/process/?${q()}`, { credentials: "include" });
      if (!r.ok) { alert(await responseMessage(r)); return; }
      const d = await r.json();
      setRows(d.rows ?? []); setProcRows(d.process_rows ?? []); setChecked(new Set());
      if (d.locked) { alert(d.message); setPanel(false); } else setPanel(true);
      if (fileRef.current) fileRef.current.value = "";
    } finally { setBusy(false); }
  };

  // Req_save_val_service()
  const validateSave = (): boolean => {
    if (!form.help_req_number) { alert("Please Enter Help Desk Request No"); return false; }
    if (!booking) { alert("Please Enter Booking Date"); return false; }
    if (!form.vendor_invoice_date) { alert("Please Enter Vendor Invoice Date"); return false; }
    if (!form.vendor_invoice_no) { alert("Please Enter Vendor Invoice Number"); return false; }
    if (!form.party_name) { alert("Please Enter Party Name"); return false; }
    if (form.gross_amount === "" || form.gross_amount === "0") { alert("Please Enter Gross amount"); return false; }
    if (form.amount === "") { alert("Please Enter amount"); return false; }
    if (!form.bank_holder_name) { alert("Please Enter Bank Holder Name"); return false; }
    if (!form.bank_acc_no) { alert("Please Enter Bank Account Number"); return false; }
    if (!form.ifsc_code) { alert("Please Enter IFSC Code"); return false; }
    if (gstOn) {
      if (!form.gst_no) { alert("Please Enter GST No."); return false; }
      if (!form.hsn_no) { alert("Please Enter HSN No."); return false; }
    }
    if (!fileRef.current?.files?.length) { alert("Please Upload File"); return false; }
    return true;
  };

  // btn_save_service_Click
  const onSave = async () => {
    if (!validateSave()) return;
    setBusy(true);
    try {
      const fd = new FormData();
      Object.entries(sel()).forEach(([k, v]) => fd.append(k, v));
      fd.append("booked_date", booking);
      fd.append("vendor_invoice_date", isoToDMY(form.vendor_invoice_date));
      (["help_req_number", "vendor_invoice_no", "gst_applicable", "party_name", "gross_amount", "vendor_igst",
        "vendor_cgst", "vendor_sgst", "bank_holder_name", "bank_acc_no", "ifsc_code", "bank_name", "gst_no",
        "hsn_no", "description"] as const).forEach(k => fd.append(k, form[k]));
      fd.append("attachment", fileRef.current!.files![0]);
      const r = await upload(`${RM_BASE}/save/`, fd);
      if (!r.ok) { alert(await responseMessage(r, "Record not saved.")); return; }
      const d = await r.json();
      (d.messages as string[] ?? []).forEach(m => alert(m));
      setRows(d.rows ?? []); setChecked(new Set());
      setForm({ ...EMPTY });
      if (fileRef.current) fileRef.current.value = "";
    } finally { setBusy(false); }
  };

  // btn_r_m_aprrove_Click
  const onApprove = async () => {
    setBusy(true);
    try {
      const r = await mk(`${RM_BASE}/approve/`, { ...sel(), ids: Array.from(checked) });
      if (!r.ok) { alert(await responseMessage(r)); return; }
      const d = await r.json();
      alert(d.message);
      setPanel(false);
      const g = await loadGrid();
      if (g?.locked) setRows([]);
    } finally { setBusy(false); }
  };

  // lnk_R_M_Command (Delete)
  const onDelete = async (id: number) => {
    if (!window.confirm("Are you sure You want Delete Record?")) return;
    const r = await mk(`${RM_BASE}/delete-row/`, { id });
    if (!r.ok) { alert(await responseMessage(r)); return; }
    await loadGrid();
  };

  const onClose = () => {
    f.reset(); setSlot("Select"); setPanel(false); setRows([]); setProcRows([]); setChecked(new Set()); setForm({ ...EMPTY });
  };

  const allChecked = rows.length > 0 && checked.size === rows.length;
  const toggleAll = () => setChecked(allChecked ? new Set() : new Set(rows.map(r => r.id)));
  const toggle = (id: number) => setChecked(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const dl = (r: RmRow) => {
    if (!r.has_file) { alert("Attachment File Cannot Be Uploaded !!!"); return; }
    downloadFile(`${RM_BASE}/download/?id=${r.id}`, "R_M-Billing_type");
  };

  const showEntryGrid = panel && rows.length > 0;
  const showProcGrid = !panel && procRows.length > 0;

  return (
    <div>
      {/* selectors */}
      <div className="row" style={{ margin: 0 }}>
        <div className="col-sm-2 col-xs-12">
          <b>Client Name : <span style={{ color: "red" }}>*</span></b>
          <select className="form-control" style={fieldStyle} value={f.client} onChange={e => { f.setClient(e.target.value); setPanel(false); }}>
            <option value="Select">Select</option>
            {f.clients.map(c => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>State :<span style={{ color: "red" }}>*</span></b>
          <select className="form-control" style={fieldStyle} value={f.state} onChange={e => { f.setState(e.target.value); setPanel(false); setRows([]); setProcRows([]); }}>
            <option value="Select">Select</option>
            {f.states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>Branch Name : <span style={{ color: "red" }}>*</span></b>
          <select className="form-control" style={fieldStyle} value={f.unit} onChange={e => f.setUnit(e.target.value)}>
            <option value="Select">Select</option>
            {f.branches.map(b => <option key={b.unit_code} value={b.unit_code}>{b.unit_name}</option>)}
          </select>
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>Month / Year :<span style={{ color: "red" }}>*</span></b>
          <input type="month" className="form-control" style={fieldStyle} value={f.ym} onChange={e => f.setYm(e.target.value)} />
        </div>
        <div className="col-sm-2 col-xs-12">
          <b>Invoice Slot :<span style={{ color: "red" }}>*</span></b>
          <select className="form-control" style={fieldStyle} value={slot} onChange={e => setSlot(e.target.value)}>
            <option value="Select">Select</option>
            <option value="1_to_15">1 to 15</option>
            <option value="16_to_30">16 to 30</option>
          </select>
        </div>
        <br />
        <div className="col-sm-2 col-xs-12">
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onProcess}>Process</button>{" "}
          <button type="button" className="btn btn-danger" onClick={onClose}>Close</button>
        </div>
      </div>
      <br /><br />

      {/* entry form (RandM_panel) */}
      {panel && (
        <div className="row" style={{ margin: 0 }}>
          <div className="container-fluid">
            <div className="row" style={{ margin: 0 }}>
              <div className="col-sm-2 col-xs-12">
                <b>HelpDesk Request No :<span style={{ color: "red" }}>*</span></b>
                <input className="form-control" value={form.help_req_number} onChange={e => set("help_req_number", e.target.value)} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>Booking Date :<span style={{ color: "red" }}>*</span></b>
                <input className="form-control" readOnly maxLength={12} value={booking} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>Vendor Invoice Date :<span style={{ color: "red" }}>*</span></b>
                <input type="date" className="form-control" max={todayISO()} value={form.vendor_invoice_date} onChange={e => set("vendor_invoice_date", e.target.value)} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>Vendor Invoice No :<span style={{ color: "red" }}>*</span></b>
                <input className="form-control" value={form.vendor_invoice_no} onChange={e => set("vendor_invoice_no", e.target.value)} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>GST Applicable: <span style={{ color: "red" }}>*</span></b>
                <select className="form-control" value={form.gst_applicable}
                  onChange={e => setForm(p => recalc({ ...p, gst_applicable: e.target.value, ...(e.target.value === "1" ? {} : { vendor_igst: "0", vendor_cgst: "0", vendor_sgst: "0" }) }))}>
                  <option value="0">Not Applicable</option>
                  <option value="1">Applicable</option>
                </select>
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>Party Name : <span style={{ color: "red" }}>*</span></b>
                <input className="form-control" value={form.party_name} onChange={e => set("party_name", alphabet(e.target.value))} />
              </div>
            </div>
            <br />
            <div className="row" style={{ margin: 0 }}>
              <div className="col-sm-2 col-xs-12">
                <b>Gross Amount :<span style={{ color: "red" }}>*</span></b>
                <input className="form-control" value={form.gross_amount} onChange={e => onGross(e.target.value)} />
              </div>
              {gstOn && (
                <>
                  <div className="col-sm-2 col-xs-12">
                    <b>IGST :</b>
                    <input className="form-control" value={form.vendor_igst} onChange={e => onIgst(e.target.value)} />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b>CGST :</b>
                    <input className="form-control" value={form.vendor_cgst} onChange={e => onCgst(e.target.value)} />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b>SGST :</b>
                    <input className="form-control" value={form.vendor_sgst} onChange={e => onSgst(e.target.value)} />
                  </div>
                </>
              )}
              <div className="col-sm-2 col-xs-12">
                <b>Amount :<span style={{ color: "red" }}>*</span></b>
                <input className="form-control" readOnly value={form.amount} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>Bank Holder Name :<span style={{ color: "red" }}>*</span></b>
                <input className="form-control" value={form.bank_holder_name} onChange={e => set("bank_holder_name", e.target.value)} />
              </div>
            </div>
            <br />
            <div className="row" style={{ margin: 0 }}>
              <div className="col-sm-2 col-xs-12">
                <b>Bank Account No :<span style={{ color: "red" }}>*</span></b>
                <input className="form-control" maxLength={30} autoComplete="off" value={form.bank_acc_no} onChange={e => set("bank_acc_no", digits(e.target.value))} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>IFSC :<span style={{ color: "red" }}>*</span></b>
                <input className="form-control" maxLength={12} value={form.ifsc_code} onChange={e => set("ifsc_code", alnumSpace(e.target.value))} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>Bank Name :</b>
                <input className="form-control" value={form.bank_name} onChange={e => set("bank_name", e.target.value)} />
              </div>
              {gstOn && (
                <>
                  <div className="col-sm-2 col-xs-12">
                    <b>GST NO :<span style={{ color: "red" }}>*</span></b>
                    <input className="form-control" value={form.gst_no} onChange={e => set("gst_no", e.target.value)} />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b>HSN CODE :</b>
                    <input className="form-control" value={form.hsn_no} onChange={e => set("hsn_no", e.target.value)} />
                  </div>
                </>
              )}
              <div className="col-sm-2 col-xs-12">
                <b>Discription :</b>
                <input className="form-control" value={form.description} onChange={e => set("description", e.target.value)} />
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
          </div>
          <br />
        </div>
      )}
      <br />

      {/* gv_rm: R&M Approve By Admin */}
      {showEntryGrid && (
        <div style={{ overflow: "auto", border: "none" }}>
          <div className="row text-center" style={{ margin: 0 }}><h3>R&amp;M Approve By Admin</h3></div>
          <table className="table" style={{ color: "#333", width: "100%" }}>
            <thead>
              <tr>
                <th style={TH}>Sr No.</th>
                <th style={TH}><label style={{ margin: 0 }}><input type="checkbox" checked={allChecked} onChange={toggleAll} /> SELECT </label></th>
                {["HELP REQ NUMBER", "BOOKING DATE", "VENDOR INVOICE DATE", "VENDOR INVOICE NO", "GST Applicable ", "PARTY NAME",
                  "GROSS AMOUNT ", "IGST", "CGST", "SGST", "AMOUNT", "BANK HOLDER NAME", "BANK ACC NUMBER ", "IFSC CODE ", "STATUS ",
                  "DOWNLOAD", "DELETE"].map(h => <th key={h} style={TH}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td style={TD}>{i + 1}</td>
                  <td style={TD}><input type="checkbox" className="center-block" checked={checked.has(r.id)} onChange={() => toggle(r.id)} /></td>
                  <td style={TD}>{r.help_req_number}</td><td style={TD}>{r.booked_date}</td>
                  <td style={TD}>{r.vendor_invoice_date}</td><td style={TD}>{r.vendor_invoice_no}</td>
                  <td style={TD}>{r.gst_applicable}</td><td style={TD}>{r.party_name}</td>
                  <td style={TD}>{r.gross_amount}</td><td style={TD}>{r.vendor_igst}</td>
                  <td style={TD}>{r.vendor_cgst}</td><td style={TD}>{r.vendor_sgst}</td>
                  <td style={TD}>{r.amount}</td><td style={TD}>{r.bank_holder_name}</td>
                  <td style={TD}>{r.bank_acc_no}</td><td style={TD}>{r.ifsc_code}</td>
                  <td style={TD}>{r.r_m_status}</td>
                  <td style={TD}><button type="button" className="btn btn-primary" style={{ color: "white", width: 100 }} onClick={() => dl(r)}>Download</button></td>
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

      {/* process_gv_r_m: approved rows (read only) */}
      {showProcGrid && (
        <div style={{ overflowX: "auto" }}>
          <table className="table" style={{ color: "#333", width: "100%" }}>
            <thead>
              <tr>
                <th style={TH}>Sr No.</th>
                {["HELP REQ NUMBER", "BOOKING DATE", "VENDOR INVOICE DATE", "VENDOR INVOICE NO", "GST Applicable ", "PARTY NAME",
                  "GROSS AMOUNT ", "IGST", "CGST", "SGST", "AMOUNT", "BANK HOLDER NAME", "BANK ACC NUMBER ", "IFSC CODE ", "STATUS ",
                  "DOWNLOAD"].map(h => <th key={h} style={TH}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {procRows.map((r, i) => (
                <tr key={r.id}>
                  <td style={TD}>{i + 1}</td>
                  <td style={TD}>{r.help_req_number}</td><td style={TD}>{r.booked_date}</td>
                  <td style={TD}>{r.vendor_invoice_date}</td><td style={TD}>{r.vendor_invoice_no}</td>
                  <td style={TD}>{r.gst_applicable}</td><td style={TD}>{r.party_name}</td>
                  <td style={TD}>{r.gross_amount}</td><td style={TD}>{r.vendor_igst}</td>
                  <td style={TD}>{r.vendor_cgst}</td><td style={TD}>{r.vendor_sgst}</td>
                  <td style={TD}>{r.amount}</td><td style={TD}>{r.bank_holder_name}</td>
                  <td style={TD}>{r.bank_acc_no}</td><td style={TD}>{r.ifsc_code}</td>
                  <td style={TD}>{r.r_m_status}</td>
                  <td style={TD}><button type="button" className="btn btn-primary" style={{ color: "white" }} onClick={() => dl(r)}>R&amp;M Sheet Download</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
