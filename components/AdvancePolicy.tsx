"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import { listItems, createItem, updateItem, deleteItem, ApiError } from "@/lib/api/crud";
import { getJSON, mk, upload } from "@/lib/api/legacy-fetch";
import { loadRoleScope, RoleScope, scopeClient, scopeUnit } from "@/lib/roleScope";
import ExportButtons from "@/components/ExportButtons";

const BASE = "/api/payroll/advance-policy";
const VENDOR_BASE = "/api/payroll/vendor-advance";
const MENU = "Advance Payment";

interface VendorAdvanceRow {
  id: number;
  vendor_code: string;
  vendor_name: string;
  po_no: string;
  invoice_no: string;
  amount: number | null;
  date: string;
  description: string;
  payment_mode: string;
  cheque_no: string;
  cheque_received_by: string;
  utr_no: string;
  pay_flag: number | null;
}

const SERVICES = ["Select", "Reliver Payment", "Self Advance", "Deep Cleaning", "Material Purchase", "Temporary Man Power", "Deployment", "Visit", "Others"];
const USER_TYPES = ["Select", "Employee", "Field_Officer"];

interface AdvancePolicyModel {
  policy_id: number;
  comp_code: string;
  client_code: string;
  state_name: string;
  branch_code: string;
  user_type: string;
  emp_code: string;
  advance_service: string;
  pay_to_emp_code: string;
  amount: number | null;
  date: string;
  comment: string;
  status: string;
  payment_mode: number | null;
  installation: number | null;
  remaing_advance: number | null;
  month: number | null;
  year: number | null;
  deduction_amount: number | null;
  pay_flag: number | null;
  client_name?: string;   // resolved server-side for the grid (legacy shows names)
  branch_name?: string;
  emp_name?: string;
}

function levelFor(me: Me | null): number {
  if (!me) return 0;
  if (me.is_staff) return 4;
  const map: Record<string, number> = { R: 1, U: 2, C: 3, D: 4 };
  return me.permissions.filter((p) => p.menu === MENU && !p.needs_review)
    .reduce((mx, p) => Math.max(mx, map[p.permission] ?? 0), 0);
}

// Legacy advance dates are dd/mm/yyyy text; <input type=date> needs yyyy-mm-dd.
function toIsoDate(v?: string | null): string {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
}
function toLegacyDate(v: string): string {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

export default function AdvancePolicyComponent() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [rows, setRows] = useState<AdvancePolicyModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<AdvancePolicyModel | null>(null);
  const [activeTab, setActiveTab] = useState<"employee" | "vendor">("employee");

  const [clients, setClients] = useState<{ v: string; t: string }[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [branches, setBranches] = useState<{ v: string; t: string; st: string }[]>([]);
  const [empList, setEmpList] = useState<{ v: string; t: string }[]>([]);

  // Employee Form State
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [branch, setBranch] = useState("Select");
  const [userType, setUserType] = useState("Select");
  const [empCode, setEmpCode] = useState("Select");
  const [foCode, setFoCode] = useState("Select");          // Field_Officer (pay_op_management)
  const [foList, setFoList] = useState<{ v: string; t: string }[]>([]);
  const [advanceService, setAdvanceService] = useState("Select");
  const [amount, setAmount] = useState<number | "">("");
  const [date, setDate] = useState("");
  const [scope, setScope] = useState<RoleScope | null>(null);
  const [comment, setComment] = useState("");
  const [paymentMode, setPaymentMode] = useState("0");
  const [installation, setInstallation] = useState<number | "">("");
  
  // Vendor Advance (legacy advance_policy.aspx '#menu2' -> /api/payroll/vendor-advance)
  const [vendorList, setVendorList] = useState<{ v: string; t: string }[]>([]);
  const [vendor, setVendor] = useState("Select");
  const [poList, setPoList] = useState<{ v: string; t: string }[]>([]);
  const [po, setPo] = useState("Select");
  const [invoiceList, setInvoiceList] = useState<{ v: string; t: string }[]>([]);
  const [invoice, setInvoice] = useState("Select");
  const [vAmount, setVAmount] = useState<number | "">("");
  const [vDate, setVDate] = useState("");
  const [vComment, setVComment] = useState("");
  const [vPaymentMode, setVPaymentMode] = useState("0");
  const [chequeNo, setChequeNo] = useState("");
  const [chequeRby, setChequeRby] = useState("");
  const [utrNo, setUtrNo] = useState("");
  const [vendorRows, setVendorRows] = useState<VendorAdvanceRow[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState<number | null>(null);
  const [advReport, setAdvReport] = useState<Record<string, unknown>[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const [msg, setMsg] = useState("");

  const level = levelFor(me);
  const canCreate = level >= 3;
  const canUpdate = level >= 2;
  const canDelete = !!me?.is_staff || level >= 4;

  const loadGrid = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listItems<AdvancePolicyModel>(BASE, { pageSize: 500 });
      setRows(res.results);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Legacy grv_vendor1(): id, vendor_name, po_no, invoice_no, amount, date (comp-scoped server-side).
  const loadVendorGrid = useCallback(async () => {
    try {
      const res = await listItems<VendorAdvanceRow>(VENDOR_BASE, { pageSize: 500 });
      setVendorRows(res.results);
    } catch {
      setVendorRows([]);
    }
  }, []);

  useEffect(() => {
    getMe().then((m) => { setMe(m); setAuthChecked(true); });
    loadGrid();
    loadRoleScope().then((sc) => {
      setScope(sc);
      getJSON<{ results: { client_code: string; client_name: string }[] }>("/api/masters/clients/?page_size=all").then((d) =>
        setClients((d?.results ?? []).filter((c) => scopeClient(sc, c.client_code))
          .map((c) => ({ v: c.client_code, t: c.client_name }))));
    });
    
    // Vendors (legacy vendor_name(): pay_vendor_master, active, text "VEND_ID - VEND_NAME")
    getJSON<{ results: { v: string; t: string }[] }>(`${VENDOR_BASE}/vendors/`).then((d) =>
      setVendorList(d?.results ?? [])
    ).catch(() => {});
    loadVendorGrid();
  }, [loadGrid, loadVendorGrid]);

  useEffect(() => {
    if (!client || client === "Select") { setStates([]); setBranches([]); return; }
    getJSON<{ units: { unit_code: string; unit_name: string; state_name: string }[]; states: string[] }>(
      `/api/masters/units/lookup/?client_code=${encodeURIComponent(client)}`).then((d) => {
      const rs = d?.units ?? [];
      const okUnits = rs.filter((u) => scopeUnit(scope, client, u.unit_code));
      setStates(Array.from(new Set(okUnits.map((u) => u.state_name).filter(Boolean))).sort());
      setBranches(okUnits.map((u) => ({ v: u.unit_code, t: u.unit_name, st: u.state_name })));
    });
  }, [client, scope]);

  useEffect(() => {
    if (!branch || branch === "Select") { setEmpList([]); return; }
    getJSON<{ employees: { emp_code: string; emp_name: string; employee_type: string }[] }>(
      `/api/hr/employees/lookup/?unit_code=${encodeURIComponent(branch)}`).then((d) => {
      let rs = d?.employees ?? [];
      if (advanceService === "Reliver Payment") rs = rs.filter((e) => (e.employee_type || "").toLowerCase().includes("reliev"));
      else rs = rs.filter((e) => !(e.employee_type || "").toLowerCase().includes("reliev"));
      setEmpList(rs.map((e) => ({ v: e.emp_code, t: `${e.emp_code} - ${e.emp_name}` })));
    });
  }, [branch, advanceService]);

  useEffect(() => {
    if (userType !== "Field_Officer" || !branch || branch === "Select") { setFoList([]); return; }
    getJSON<{ results: { v: string; t: string }[] }>(
      `${BASE}/field_officers/?unit_code=${encodeURIComponent(branch)}`).then((d) => setFoList(d?.results ?? []));
  }, [userType, branch]);

  // Vendor -> PO cascade (legacy ddl_vendor_SelectedIndexChanged: pay_transaction_po by CUST_NAME=vendor text).
  useEffect(() => {
    if (!vendor || vendor === "Select") { setPoList([]); return; }
    const vText = vendorList.find((x) => x.v === vendor)?.t ?? "";
    getJSON<{ results: { v: string; t: string }[] }>(
      `${VENDOR_BASE}/pos/?vendor_text=${encodeURIComponent(vText)}`).then((d) =>
      setPoList(d?.results ?? [])).catch(() => setPoList([]));
  }, [vendor, vendorList]);

  // PO -> Invoice cascade (legacy ddl_po_SelectedIndexChanged: pay_transactionp distinct DOC_NO by CUST_CODE+pur_order_no).
  useEffect(() => {
    if (!vendor || vendor === "Select" || !po || po === "Select") { setInvoiceList([]); return; }
    getJSON<{ results: { v: string; t: string }[] }>(
      `${VENDOR_BASE}/invoices/?vendor_code=${encodeURIComponent(vendor)}&po_no=${encodeURIComponent(po)}`).then((d) =>
      setInvoiceList(d?.results ?? [])).catch(() => setInvoiceList([]));
  }, [vendor, po]);

  const clearForm = () => {
    setSelected(null);
    setClient("Select");
    setState("Select");
    setBranch("Select");
    setUserType("Select");
    setEmpCode("Select"); setFoCode("Select");
    setAdvanceService("Select");
    setAmount("");
    setDate("");
    setComment("");
    setPaymentMode("0");
    setInstallation("");
    setMsg("");
  };

  const clearVendorForm = () => {
    setSelectedVendorId(null);
    setVendor("Select");
    setPo("Select");
    setInvoice("Select");
    setPoList([]);
    setInvoiceList([]);
    setVAmount("");
    setVDate("");
    setVComment("");
    setVPaymentMode("0");
    setChequeNo("");
    setChequeRby("");
    setUtrNo("");
    setMsg("");
  }

  // Legacy grv_vendor_SelectedIndexChanged: load the row into the form (edit mode hides Save).
  const selectVendorRow = (r: VendorAdvanceRow) => {
    setSelectedVendorId(r.id);
    setVendor(r.vendor_code || "Select");
    setPo(r.po_no || "Select");
    setInvoice(r.invoice_no || "Select");
    setVAmount(r.amount ?? "");
    setVDate(r.date || "");
    setVComment(r.description || "");
    setVPaymentMode(r.payment_mode || "0");
    setChequeNo(r.cheque_no || "");
    setChequeRby(r.cheque_received_by || "");
    setUtrNo(r.utr_no || "");
  }

  const selectRow = (d: AdvancePolicyModel) => {
    setSelected(d);
    setClient(d.client_code || "Select");
    setState(d.state_name || "Select");
    setBranch(d.branch_code || "Select");
    setUserType(d.user_type || "Select");
    setEmpCode(d.pay_to_emp_code || d.emp_code || "Select");
    setFoCode(d.user_type === "Field_Officer" ? (d.emp_code || "Select") : "Select");
    setAdvanceService(d.advance_service || "Select");
    setAmount(d.amount ?? "");
    setDate(toIsoDate(d.date));
    setComment(d.comment || "");
    setPaymentMode(d.payment_mode != null ? String(d.payment_mode) : "0");
    setInstallation(d.installation ?? "");
  };

  const validate = (): string | null => {
    if (!client || client === "Select") return "Please Select Client !!";
    if (!state || state === "Select") return "Please Select State !!";
    if (!branch || branch === "Select") return "Please Select Branch Name !!";
    if (!userType || userType === "Select") return "Please Select User Type !!";
    if (userType === "Field_Officer" && (!foCode || foCode === "Select")) return "Please Select Employee !!";
    if (!empCode || empCode === "Select") return "Please Select Employee !!";
    if (!advanceService || advanceService === "Select") return "Please Select Service !!";
    if (amount === "" || Number(amount) <= 0) return "Please Enter Amount !!";
    if (!date) return "Please Select Date !!";
    return null;
  };

  // Exact mirror of legacy save_vendor() (advance_policy.aspx): same order, same messages
  // (including the legacy double-space quirks). Amount check is empty-only, as in legacy.
  const validateVendor = (): string | null => {
    if (!vendor || vendor === "Select") return "Please Select Vendor Name !!";
    if (!po || po === "Select") return "Please Select PO Number !!";
    if (!invoice || invoice === "Select") return "Please Select Invoice Number !!";
    if (vAmount === "") return "Please Enter Amount !!";
    if (!vDate) return "Please Select Date !!";
    if (vPaymentMode === "1") {
      if (!chequeNo) return "Please Enter Cheque Number !!";
      if (!chequeRby) return "Please Enter Cheque Received By  !!";
    } else if (vPaymentMode === "2") {
      if (!utrNo) return "Please Enter UTR Number !!";
    } else {
      return "Please select Payment Mode  !!";
    }
    return null;
  }

  const payload = () => ({
    client_code: client,
    state_name: state,
    branch_code: branch,
    user_type: userType,
    emp_code: userType === "Field_Officer" ? foCode : empCode,
    pay_to_emp_code: empCode,
    advance_service: advanceService,
    amount: amount === "" ? null : amount,
    date: toLegacyDate(date),   // legacy stores dd/mm/yyyy text
    comment: comment,
    payment_mode: paymentMode === "0" || paymentMode === "" ? null : Number(paymentMode),
    installation: installation === "" ? null : installation,
  });

  const showErr = (e: unknown, fallback: string) => {
    if (e instanceof ApiError && e.data) {
      const msgs = Object.values(e.data as Record<string, unknown>).flat();
      setMsg(String(msgs[0] || fallback));
    } else {
      setMsg(fallback);
    }
  };

  // crud helpers return {ok,status,data} (they do NOT throw) — always gate on res.ok
  // so a server error never shows a fake success. Backend validation text is surfaced.
  const errText = (data: unknown, fallback: string): string => {
    if (data && typeof data === "object") {
      const msgs = Object.values(data as Record<string, unknown>).flat();
      if (msgs.length) return String(msgs[0]);
    }
    return fallback;
  };

  const onSave = async () => {
    const err = validate();
    if (err) { alert(err); return; }
    const res = await createItem(BASE, payload());
    if (res.ok) { setMsg("Record added successfully!!"); clearForm(); loadGrid(); }
    else setMsg(errText(res.data, "Record added failed !!"));
  };

  const onUpdate = async () => {
    if (!selected) return;
    if (!confirm("Are You Sure you Want To Update Record !!!")) return;
    const err = validate();
    if (err) { alert(err); return; }
    const res = await updateItem(BASE, selected.policy_id, payload());
    if (res.ok) { setMsg("Policy Updated Succsefully"); clearForm(); loadGrid(); }  // legacy string
    else setMsg(errText(res.data, "Policy NOT updated !!"));
  };

  const onDelete = async (policy_id: number) => {
    // legacy OnClientClick confirm
    if (!confirm("Are You Sure You Want To Delete Record")) return;
    const res = await deleteItem(BASE, policy_id);
    if (res.ok) {
      setMsg("Policy Deleted Succsefully !!");                 // legacy string
      if (selected && selected.policy_id === policy_id) clearForm();
      loadGrid();
    } else {
      const m = errText(res.data, "Policy NOT Deleted !!");    // legacy pay_flag guard message
      setMsg(m); alert(m);
    }
  };

  const onAdvanceReport = async () => {
    // Legacy btn_advreport_Click — advance report for the selected employee.
    const d = await getJSON<{ results: Record<string, unknown>[] }>(`${BASE}/advance_report/?emp=${encodeURIComponent(empCode === "Select" ? "" : empCode)}`);
    setAdvReport(d?.results ?? []);
  };

  // Blank CSV in the exact 14-column layout upload_csv reads (the legacy page had no format file).
  // With a Branch selected, one row per employee of that branch is pre-filled; Amount, Date and
  // Description stay blank for the user to fill (a row left blank is rejected as "Fill All Details").
  const onDownloadFormat = () => {
    const clean = (s: string) => String(s ?? "").replace(/[,\r\n]/g, " ").trim();
    const header = ["SR", "Client Name", "State", "Branch Name", "User Type", "Advance Type", "Employee Code",
      "Employee Name", "Amount", "Date (ddmmyyyy)", "Payment Mode", "Description", "Month", "Year"];
    const lines = [header.join(",")];
    const clientName = clients.find((c) => c.v === client)?.t ?? "";
    const branchName = branches.find((b) => b.v === branch)?.t ?? "";
    if (clientName && state !== "Select" && branchName) {
      const now = new Date();
      empList.forEach((e, i) => {
        const name = e.t.includes(" - ") ? e.t.split(" - ").slice(1).join(" - ") : e.t;
        lines.push([String(i + 1), clean(clientName), clean(state), clean(branchName), "Employee", "Self Advance", e.v,
          clean(name), "", "", "Full Payment", "", String(now.getMonth() + 1), String(now.getFullYear())].join(","));
      });
    }
    const blob = new Blob(["﻿" + lines.join("\r\n") + "\r\n"], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = branchName ? `advance_upload_${clean(branchName).replace(/\s+/g, "_")}.csv` : "advance_upload_format.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const onUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { alert("Please Upload File"); return; }   // legacy upload_validation()
    if (!file.name.toLowerCase().endsWith(".csv")) { alert("Please upload a valid csv file."); return; }
    const fd = new FormData();
    fd.append("file", file);
    const r = await upload(`${BASE}/upload_csv/`, fd);
    const b = await r.json().catch(() => ({}));
    if (r.ok) {
      const errs = (b.errors ?? []) as { sr: string; reason: string }[];
      alert("File Uploaded Successfully !!!" + (errs.length ? `\n\nRows not imported:\n${errs.map((e) => `SR ${e.sr}: ${e.reason}`).join("\n")}` : ""));
      if (fileRef.current) fileRef.current.value = "";
      loadGrid();
    } else {
      alert(typeof b === "object" && b.detail ? String(b.detail) : "Upload failed.");
    }
  };

  const onVendorSave = async () => {
    const err = validateVendor();
    if (err) { alert(err); return; }
    try {
      await createItem(VENDOR_BASE, {
        vendor_code: vendor,
        vendor_name: vendorList.find((x) => x.v === vendor)?.t ?? vendor,
        po_no: po,
        invoice_no: invoice,
        amount: vAmount === "" ? null : vAmount,
        date: vDate,
        description: vComment,
        payment_mode: vPaymentMode,
        cheque_no: chequeNo,
        cheque_received_by: chequeRby,
        utr_no: utrNo,
      });
      alert("Vendor Advance Save Succsefully");   // legacy message (typo preserved)
      clearVendorForm();
      loadVendorGrid();
    } catch (e: unknown) {
      if (e instanceof ApiError && e.data) {
        const msgs = Object.values(e.data as Record<string, unknown>).flat();
        alert(String(msgs[0] || "Vendor Advance Not Save Succsefully"));
      } else {
        alert("Vendor Advance Not Save Succsefully");
      }
    }
  }

  const onVendorDelete = async () => {
    if (selectedVendorId == null) return;
    // Legacy btn_vendor_delete OnClientClick="return Delete_record()" confirm.
    if (!confirm("Are You Sure You Want To Delete Record")) return;
    const res = await deleteItem(VENDOR_BASE, selectedVendorId);  // {ok,status,data}, no throw
    if (res.ok) {
      alert("Vendor Advance Delete Succsefully");   // legacy message (typo preserved)
      clearVendorForm();
      loadVendorGrid();
    } else {
      const d = res.data as Record<string, unknown> | undefined;
      const msgs = d && typeof d === "object" ? Object.values(d).flat() : [];
      // Legacy guard: pay_flag==1 -> "Vendor Advance already deduct cant delete record"
      alert(String(msgs[0] || "Vendor Advance Not Delete Succsefully"));
    }
  }

  if (!authChecked) return null;

  const emi = amount !== "" && installation !== "" && Number(installation) > 0
    ? (Number(amount) / Number(installation)).toFixed(2) : "";

  return (
    <section className="app-content">
      <div className="lg-panel">
        
        <div className="lg-panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div></div>
          <div style={{ textAlign: "center", flex: 1, fontSize: "small" }}>
            ADVANCE POLICY
          </div>
          <div></div>
        </div>
        
        <div className="lg-panel-body">
          {level === 0 ? (
            <div style={{ color: "red", fontWeight: "bold", textAlign: "center" }}>You do not have permission to access Advance Policy.</div>
          ) : (
            <>
              {msg && <div className="lg-alert" style={{ textAlign: "center", fontWeight: "bold" }}>{msg}</div>}

              <div style={{ background: "#f3f1fe", padding: "15px 20px", border: "1px solid #e2e2dd", marginBottom: "20px", marginTop: "10px", borderRadius: "10px" }}>
                <div className="em-tabs">
                  <button className={`em-tab ${activeTab === "employee" ? "active" : ""}`} onClick={() => setActiveTab("employee")}><b>Employee Adavance</b></button>
                  <button className={`em-tab ${activeTab === "vendor" ? "active" : ""}`} onClick={() => setActiveTab("vendor")}><b>Vendor Advance</b></button>
                </div>

                <div className="em-tabpane" style={{ borderRadius: "0 10px 10px 10px" }}>
                  {activeTab === "employee" && (
                    <div id="menu1">
                      <div className="lg-form cols4" style={{ background: "white", padding: "15px", border: "1px solid white", borderRadius: "10px" }}>
                        <div className="lg-row">
                          <span className="lg-label">Client : <span className="lg-req">*</span></span>
                          <select className="lg-control" value={client} onChange={(e) => { setClient(e.target.value); setState("Select"); setBranch("Select"); }}>
                            <option value="Select">Select</option>
                            {clients.map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}
                          </select>
                        </div>
                        <div className="lg-row">
                          <span className="lg-label">State : <span className="lg-req">*</span></span>
                          <select className="lg-control" value={state} onChange={(e) => { setState(e.target.value); setBranch("Select"); }}>
                            <option value="Select">Select</option>
                            {states.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div className="lg-row">
                          <span className="lg-label">Branch Name : <span className="lg-req">*</span></span>
                          <select className="lg-control" value={branch} onChange={(e) => setBranch(e.target.value)}>
                            <option value="Select">Select</option>
                            {branches.filter((b) => state === "Select" || b.st === state).map((b) => <option key={b.v} value={b.v}>{b.t}</option>)}
                          </select>
                        </div>
                        <div className="lg-row">
                          <span className="lg-label">User Type: <span className="lg-req">*</span></span>
                          <select className="lg-control" value={userType} onChange={(e) => setUserType(e.target.value)}>
                            {USER_TYPES.map((u) => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>

                        <div className="lg-row">
                          <span className="lg-label">Advance For Service: <span className="lg-req">*</span></span>
                          <select className="lg-control" value={advanceService} onChange={(e) => setAdvanceService(e.target.value)}>
                            {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        {userType === "Field_Officer" && (
                          <div className="lg-row">
                            <span className="lg-label">Field Officer: <span className="lg-req">*</span></span>
                            <select className="lg-control" value={foCode} onChange={(e) => setFoCode(e.target.value)}>
                              <option value="Select">Select</option>
                              {foList.map((f) => <option key={f.v} value={f.v}>{f.t}</option>)}
                            </select>
                          </div>
                        )}
                        <div className="lg-row">
                          <span className="lg-label">Employee Name: <span className="lg-req">*</span></span>
                          <select className="lg-control" value={empCode} onChange={(e) => setEmpCode(e.target.value)}>
                            <option value="Select">Select</option>
                            {empList.map((e) => <option key={e.v} value={e.v}>{e.t}</option>)}
                          </select>
                        </div>
                        <div className="lg-row">
                          <span className="lg-label">Amount : <span className="lg-req">*</span></span>
                          <input type="number" className="lg-control" value={amount} onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))} />
                        </div>
                        <div className="lg-row">
                          <span className="lg-label">Date : <span className="lg-req">*</span></span>
                          <input type="date" className="lg-control" max={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} />
                        </div>

                        <div className="lg-row">
                          <span className="lg-label">Description :</span>
                          <textarea className="lg-control" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} style={{ resize: "vertical" }} />
                        </div>
                        <div className="lg-row">
                          <span className="lg-label">Payment Mode :</span>
                          <select className="lg-control" value={paymentMode} onChange={(e) => setPaymentMode(e.target.value)}>
                            <option value="0">Select</option>
                            <option value="1">Installment</option>
                            <option value="2">Full Payment</option>
                          </select>
                        </div>
                        {paymentMode === "1" ? (
                          <>
                            <div className="lg-row">
                              <span className="lg-label">No of Installment :</span>
                              <input type="number" className="lg-control" value={installation} onChange={(e) => setInstallation(e.target.value === "" ? "" : Number(e.target.value))} />
                            </div>
                            <div className="lg-row">
                              <span className="lg-label">Deduction Amt :</span>
                              <input type="text" className="lg-control" value={emi} readOnly style={{ background: "#eee" }} />
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="lg-row"></div>
                            <div className="lg-row"></div>
                          </>
                        )}
                      </div>
                      
                      <div className="lg-btns center" style={{ marginTop: "20px" }}>
                        {canCreate && !selected && <button className="lg-btn-primary" onClick={onSave}>Save</button>}
                        {canUpdate && selected && <button className="lg-btn-primary" onClick={onUpdate}>Update</button>}
                        {selected && <button className="lg-btn-danger" onClick={() => onDelete(selected.policy_id)}>Delete</button>}
                        <button className="lg-btn-primary" onClick={onAdvanceReport} style={{ width: "15%" }}>Advance Report</button>
                        <Link href="/" className="lg-btn-danger" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>Close</Link>
                      </div>

                      <div className="lg-form cols4" style={{ background: "transparent", border: "none", padding: "0 15px" }}>
                        <div className="lg-row" style={{ gridColumn: "span 2", marginTop: "9px" }}>
                          <span className="lg-label">Upload Format :</span>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <button className="lg-btn-primary" onClick={onDownloadFormat} style={{ whiteSpace: "nowrap" }}>Download Format</button>
                            <small style={{ color: "#555" }}>
                              Select Client, State and Branch first to get that branch&apos;s employees pre-filled. Fill Amount (whole number),
                              Date (ddmmyyyy, e.g. 15102026) and Description; delete the rows of employees without an advance. Save as CSV and Upload.
                            </small>
                          </div>
                        </div>
                        <div className="lg-row" style={{ marginTop: "9px" }}>
                          <span className="lg-label">File Upload : <span className="lg-req">*</span></span>
                          <input type="file" ref={fileRef} accept=".csv" />
                        </div>
                        <div className="lg-row" style={{ marginTop: "24px" }}>
                          <button className="lg-btn-primary" onClick={onUpload}>Upload</button>
                        </div>
                      </div>

                      {advReport.length > 0 && (
                        <div className="lg-grid-wrapper" style={{ marginTop: "15px", overflowX: "auto" }}>
                          <table className="lg-grid">
                            <thead><tr><th>Client</th><th>Branch</th><th>Employee Name</th><th>Advance Amount</th><th>Advance Deduct Month</th><th>Deduct Amount</th><th>Balance</th></tr></thead>
                            <tbody>
                              {advReport.map((r, i) => (
                                <tr key={i}>
                                  <td>{String(r.client_code ?? "")}</td><td>{String(r.branch_code ?? "")}</td><td>{String(r.pay_to_emp_code ?? "")}</td>
                                  <td>{String(r.amount ?? "")}</td><td>{String(r.month_year ?? "")}</td><td>{String(r.emp_advance ?? "")}</td><td>{String(r.remaing_advance ?? "")}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}

                      <br />
                      <div className="lg-grid-wrapper" style={{ marginTop: "20px", overflowX: "auto" }}>
                        <div style={{ textAlign: "right", marginBottom: "10px" }}>
                          <ExportButtons filename="advance_policy" columns={[{key: "client_code", label: "Client"}, {key: "pay_to_emp_code", label: "Employee"}, {key: "amount", label: "Amount"}, {key: "remaing_advance", label: "Remaining"}]} rows={rows} />
                        </div>
                        
                        {loading ? <p>Loading…</p> : (
                          <table className="lg-grid">
                            <thead>
                              <tr>
                                <th>CLIENT NAME</th>
                                <th>STATE NAME</th>
                                <th>BRANCH</th>
                                <th>USER TYPE</th>
                                <th>EMP NAME</th>
                                <th>ADVANCE SERVICE</th>
                                <th>AMOUNT</th>
                                <th>DATE</th>
                                <th>COMMENT</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rows.map((d) => (
                                <tr key={d.policy_id} className={selected?.policy_id === d.policy_id ? "lg-selected" : ""} onClick={() => selectRow(d)} style={{ cursor: "pointer" }}>
                                  <td>{d.client_name || d.client_code}</td>
                                  <td>{d.state_name}</td>
                                  <td>{d.branch_name || d.branch_code}</td>
                                  <td>{d.user_type}</td>
                                  <td>{d.emp_name || d.pay_to_emp_code}</td>
                                  <td>{d.advance_service}</td>
                                  <td>{d.amount ?? ""}</td>
                                  <td>{d.date || ""}</td>
                                  <td>{d.comment || ""}</td>
                                </tr>
                              ))}
                              {rows.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center" }}>No advance policies</td></tr>}
                            </tbody>
                          </table>
                        )}
                      </div>

                    </div>
                  )}

                  {activeTab === "vendor" && (
                    <div id="menu2">
                      <div className="lg-form cols3" style={{ background: "white", padding: "15px", border: "1px solid white", borderRadius: "10px" }}>
                        <div className="lg-row">
                          <span className="lg-label">Vendor Name : <span className="lg-req">*</span></span>
                          <select className="lg-control" value={vendor} onChange={(e) => setVendor(e.target.value)}>
                            <option value="Select">Select</option>
                            {vendorList.map((v) => <option key={v.v} value={v.v}>{v.t}</option>)}
                          </select>
                        </div>
                        <div className="lg-row">
                          <span className="lg-label">PO NO : <span className="lg-req">*</span></span>
                          <select className="lg-control" value={po} onChange={(e) => setPo(e.target.value)}>
                            <option value="Select">Select</option>
                            {poList.map((p) => <option key={p.v} value={p.v}>{p.t}</option>)}
                          </select>
                        </div>
                        <div className="lg-row">
                          <span className="lg-label">Invoice No : <span className="lg-req">*</span></span>
                          <select className="lg-control" value={invoice} onChange={(e) => setInvoice(e.target.value)}>
                            <option value="Select">Select</option>
                            {invoiceList.map((i) => <option key={i.v} value={i.v}>{i.t}</option>)}
                          </select>
                        </div>

                        <div className="lg-row">
                          <span className="lg-label">Amount : <span className="lg-req">*</span></span>
                          <input type="number" className="lg-control" value={vAmount} onChange={(e) => setVAmount(e.target.value === "" ? "" : Number(e.target.value))} />
                        </div>
                        <div className="lg-row">
                          <span className="lg-label">Date : <span className="lg-req">*</span></span>
                          <input type="date" className="lg-control" value={vDate} onChange={(e) => setVDate(e.target.value)} />
                        </div>
                        <div className="lg-row">
                          <span className="lg-label">Description :</span>
                          <textarea className="lg-control" rows={2} value={vComment} onChange={(e) => setVComment(e.target.value)} style={{ resize: "vertical" }} />
                        </div>

                        <div className="lg-row">
                          <span className="lg-label">Payment Mode :</span>
                          <select className="lg-control" value={vPaymentMode} onChange={(e) => setVPaymentMode(e.target.value)}>
                            <option value="0">Select</option>
                            <option value="1">Cheque</option>
                            <option value="2">Online</option>
                          </select>
                        </div>
                        {vPaymentMode === "1" ? (
                          <>
                            <div className="lg-row">
                              <span className="lg-label">Cheque NO :</span>
                              <input type="text" className="lg-control" value={chequeNo} onChange={(e) => setChequeNo(e.target.value)} />
                            </div>
                            <div className="lg-row">
                              <span className="lg-label">Cheque Received By :</span>
                              <input type="text" className="lg-control" value={chequeRby} onChange={(e) => setChequeRby(e.target.value)} />
                            </div>
                          </>
                        ) : vPaymentMode === "2" ? (
                          <>
                            <div className="lg-row">
                              <span className="lg-label">UTR No :</span>
                              <input type="text" className="lg-control" value={utrNo} onChange={(e) => setUtrNo(e.target.value)} />
                            </div>
                            <div className="lg-row"></div>
                          </>
                        ) : (
                          <>
                            <div className="lg-row"></div>
                            <div className="lg-row"></div>
                          </>
                        )}
                      </div>

                      <div className="lg-btns center" style={{ marginTop: "20px" }}>
                        {/* Legacy: Save hidden once a row is selected (edit mode); Delete + Close remain. */}
                        {canCreate && selectedVendorId == null && <button className="lg-btn-primary" onClick={onVendorSave}>Save</button>}
                        {canDelete && selectedVendorId != null && <button className="lg-btn-primary" onClick={onVendorDelete}>Delete</button>}
                        <Link href="/" className="lg-btn-danger" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center" }}>Close</Link>
                      </div>
                      <br />

                      <div className="lg-grid-wrapper" style={{ marginTop: "20px", overflowX: "auto" }}>
                        <table className="lg-grid">
                          <thead>
                            <tr>
                              <th>VENDOR NAME</th>
                              <th>PO NUMBER</th>
                              <th>INVOICE NUMBER</th>
                              <th>AMOUNT</th>
                              <th>DATE</th>
                            </tr>
                          </thead>
                          <tbody>
                            {vendorRows.map((r) => (
                              <tr key={r.id} className={selectedVendorId === r.id ? "lg-selected" : ""} onClick={() => selectVendorRow(r)} style={{ cursor: "pointer" }}>
                                <td>{r.vendor_name}</td>
                                <td>{r.po_no}</td>
                                <td>{r.invoice_no}</td>
                                <td>{r.amount ?? ""}</td>
                                <td>{r.date || ""}</td>
                              </tr>
                            ))}
                            {vendorRows.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center" }}>No Vendor advance policies</td></tr>}
                          </tbody>
                        </table>
                      </div>

                    </div>
                  )}
                </div>

              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
