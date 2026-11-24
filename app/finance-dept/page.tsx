"use client";
import React, { useEffect, useState, useCallback, useRef } from "react";
import { getJSON, mk } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

const STATUS: Record<string, string> = {
  "0": "Waiting For Approval", "1": "Self Approved", "2": "Approved By Accounts",
  "3": "Rejected By Accounts", "4": "Approved By HOD", "5": "Rejected By HOD",
  "6": "Approved By Authorised Signatory", "7": "Rejected By Authorised Signatory", "8": "Paid",
};
const PAYMENT_METHODS = ["Cash", "UPI"];

interface Voucher {
  id: number; cash_rs: number; receiver_name: string; debited_to: string; narration?: string;
  status: string; status_label?: string; rejection_reason?: string; cash_login_id?: string;
  payment_method?: string; payment_date?: string; request_date?: string; soft_copy_file?: string;
}
interface PettyCashRow {
  id: number; add_amount: number; available_balance: number; cash_added_by: string; cash_added_date: string;
}

export default function FinanceDeptPage() {
  const [activeTab, setActiveTab] = useState<"approval" | "petty" | "report">("approval");
  const [rows, setRows] = useState<Voucher[]>([]);
  const [pettyRows, setPettyRows] = useState<PettyCashRow[]>([]);
  const [balance, setBalance] = useState<string>("0.00");
  const [msg, setMsg] = useState({ text: "", ok: true });
  const [loading, setLoading] = useState(true);
  const [payRows, setPayRows] = useState<Record<number, { pm: string; pd: string }>>({});
  const [reportFrom, setReportFrom] = useState("");
  const [reportTo, setReportTo] = useState("");
  const [reportType, setReportType] = useState<"ALL" | "1" | "2">("ALL");
  const [pettyAmount, setPettyAmount] = useState("");
  const [pettyBy, setPettyBy] = useState("");
  const [pettyDate, setPettyDate] = useState("");
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const tableRef = useRef<HTMLTableElement>(null);
  const pettyTableRef = useRef<HTMLTableElement>(null);

  const showMsg = (text: string, ok = true) => setMsg({ text, ok });
  const openHelp = () => {
    window.open("/html/CompanyMaster.html", "popUpWindow",
      "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No");
  };

  const loadApproval = useCallback(async () => {
    try {
      const data = await getJSON<{ results: Voucher[] }>(
        `/api/transactions/cash-vouchers/?queue=finance`);
      setRows((data?.results as Voucher[]) ?? []);

      const b = await getJSON<{ available_balance: string }>("/api/transactions/cash-vouchers/available_balance/");
      setBalance(b?.available_balance ?? "0.00");
    } catch (e) {
      showMsg("Failed to load data", false);
    }
  }, []);

  const loadPetty = useCallback(async () => {
    try {
      const data = await getJSON<{ results: PettyCashRow[] }>(
        `/api/transactions/cash-vouchers/petty_cash/`);
      setPettyRows((data?.results as PettyCashRow[]) ?? []);
    } catch (e) {
      showMsg("Failed to load petty cash", false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadApproval(), loadPetty()]);
    setLoading(false);
  }, [loadApproval, loadPetty]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const act = async (id: number, action: string, extra: Record<string, string> = {}) => {
    let payload: Record<string, string> = { ...extra };
    if (action.endsWith("reject")) {
      const reason = window.prompt("Rejection Reason") || "";
      if (!reason) return;
      payload.rejection_reason = reason;
    }
    const r = await mk(`/api/transactions/cash-vouchers/${id}/${action}/`, payload);
    if (r.ok) {
      const data = await r.json().catch(() => ({}));
      if (data.available_balance) setBalance(data.available_balance);
      showMsg("Amount Paid Successfully... !!!", true);
      loadAll();
    } else {
      const err = await r.json().catch(() => ({}));
      const errMsg = Array.isArray(err) ? err[0] : (err?.detail || err?.non_field_errors?.[0] || `Action failed (${r.status})`);
      showMsg(errMsg, false);
      window.alert(errMsg);
    }
  };

  // Legacy btn_print_Click -> cash_voucher_invoice report; the server renders the voucher.
  const printVoucher = async (v: Voucher) => {
    const w = window.open("", "_blank", "width=800,height=600");
    if (!w) { showMsg("Please allow pop-ups to print the voucher", false); return; }
    try {
      const r = await fetch(`${API_BASE_URL}/api/transactions/cash-vouchers/${v.id}/print/`, { credentials: "include" });
      if (!r.ok) {
        w.close();
        const e = await r.json().catch(() => ({} as any));
        showMsg(e?.detail || `Print failed (${r.status})`, false);
        return;
      }
      if ((r.headers.get("content-type") || "").includes("pdf")) {      // legacy cash_voucher_invoice layout (PDF)
        w.location.href = URL.createObjectURL(await r.blob());
        return;
      }
      w.document.open(); w.document.write(await r.text()); w.document.close(); w.focus(); w.print();
    } catch {
      w.close();
      showMsg("Print failed", false);
    }
  };

  const downloadProof = async (v: Voucher) => {
    try {
      const r = await fetch(`${API_BASE_URL}/api/transactions/cash-vouchers/${v.id}/proof/`, { credentials: "include" });
      if (!r.ok) { showMsg("File Can not Found!!.", false); return; }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = v.soft_copy_file || "attachment"; a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      showMsg("File Can not Found!!.", false);
    }
  };

  const handlePay = (id: number) => {
    const pr = payRows[id] || { pm: "Cash", pd: "" };
    // Legacy validate_pay(): confirm first, then at least one checked record is required.
    if (!window.confirm("Are you Sure You Want to Pay This Record")) return;
    if (!Object.values(selected).some(Boolean)) { window.alert("Please select atleast one Record "); return; }
    if (!pr.pd) { window.alert("Please Enter Payment Date ....!!!"); return; }
    act(id, "finance_paid", { payment_method: pr.pm, payment_date: pr.pd });
  };

  const handlePettySubmit = async () => {
    // Legacy petty_cash() client validation (exact messages), then real petty_cash_add.
    if (!pettyAmount) { showMsg("Please Enter Amount", false); return; }
    if (!pettyBy) { showMsg("Please Enter Name", false); return; }
    if (!pettyDate) { showMsg("Please Select Date", false); return; }
    const r = await mk(`/api/transactions/cash-vouchers/petty_cash_add/`, {
      add_amount: pettyAmount, cash_added_by: pettyBy, cash_added_date: pettyDate.split("-").reverse().join("/"),
    });
    if (r.ok) {
      const d = await r.json().catch(() => ({}));
      if (d.available_balance != null) setBalance(String(d.available_balance));
      showMsg("Record Added Successfully", true);
      setPettyAmount(""); setPettyBy(""); setPettyDate("");
      loadAll();
    } else {
      const err = await r.json().catch(() => ({}));
      showMsg(Array.isArray(err) ? err[0] : (err?.detail || err?.non_field_errors?.[0] || "Failed to add petty cash"), false);
    }
  };

  const handleReport = async () => {
    // Legacy Valid_date(): both dates are required client-side; the server report applies no date filter.
    if (!reportFrom) { window.alert("Please Select Date"); return; }
    if (!reportTo) { window.alert("Please Select Date"); return; }
    try {
      const r = await fetch(`${API_BASE_URL}/api/transactions/cash-vouchers/finance_report/?type=${reportType}`,
        { credentials: "include" });
      if (!r.ok) {
        const e = await r.json().catch(() => null);
        const t = Array.isArray(e) ? e[0] : (e?.detail || "Failed to generate report");
        window.alert(t);
        return;
      }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "Report.xls"; a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.alert("Failed to generate report");
    }
  };

  if (loading) {
    return (
      <div className="container-fluid" style={{ fontSize: "10px" }}>
        <div className="panel panel-primary">
          <div className="panel-heading">
            <div className="row">
              <div className="col-sm-10">
                <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase"><b>CASH VOUCHER RECEIPT</b></div>
              </div>
              <div className="col-sm-2 text-right">
                <button type="button" className="btn btn-link" style={{ color: "#fff", padding: 0 }} onClick={openHelp} title="Help">
                  <img src="/Images/help_ico.png" width="20" height="20" alt="Help" />
                </button>
              </div>
            </div>
          </div>
        </div>
        <div id="tabs" style={{ background: "#f3f1fe", padding: "20px" }}>
          Loading...
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "approval", label: "Approval", active: activeTab === "approval" },
    { id: "petty", label: "Petty Cash Bank", active: activeTab === "petty" },
    { id: "report", label: "Report", active: activeTab === "report" },
  ];

  return (
    <div className="container-fluid" style={{ fontSize: "10px" }}>
      <div className="panel panel-primary">
        <div className="panel-heading">
          <div className="row">
            <div className="col-sm-10">
              <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase"><b>CASH VOUCHER RECEIPT</b></div>
            </div>
            <div className="col-sm-2 text-right">
              <button type="button" className="btn btn-link" style={{ color: "#fff", padding: 0 }} onClick={openHelp} title="Help">
                <img src="/Images/help_ico.png" width="20" height="20" alt="Help" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div id="tabs" style={{ background: "#f3f1fe", padding: "20px", borderRadius: "10px", border: "1px solid white" }}>
        <ul className="nav nav-tabs" style={{ borderBottom: "1px solid #ddd" }}>
          {tabs.map(t => (
            <li key={t.id} className={t.active ? "active" : ""} style={{ fontWeight: "bold" }}>
              <a data-toggle="tab" href="#" onClick={e => { e.preventDefault(); setActiveTab(t.id as any); }}>
                <b>{t.label}</b>
              </a>
            </li>
          ))}
        </ul>

        {/* Tab 1: Approval */}
        <div id="home" className="tab-pane" style={{ display: activeTab === "approval" ? "block" : "none", color: "black" }}>
          {msg.text && (
            <div className={`alert ${msg.ok ? "alert-success" : "alert-danger"}`} style={{ fontSize: "10px", padding: "6px 12px", marginBottom: 10 }}>
              {msg.text}
            </div>
          )}

          <div className="row" style={{ marginBottom: "20px" }}>
            <div className="col-sm-2 col-xs-12">
              <b> Available Balance </b><span className="text-red"></span>
              <input type="text" className="form-control text_box" value={balance} readOnly style={{ width: "100%", fontSize: "10px" }} />
            </div>
          </div>

          <div className="panel panel-default" style={{ overflowX: "auto" }}>
            <table ref={tableRef} id="gv_cash_voucher" className="table table-bordered table-striped" style={{ width: "100%", background: "white", border: "1px solid #ccc", fontSize: "10px" }}>
              <thead style={{ background: "#006699", color: "white", fontWeight: "bold", textTransform: "uppercase" }}>
                <tr>
                  <th style={{ padding: "5px", textAlign: "center", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", whiteSpace: "nowrap" }}>
                    <input type="checkbox" id="chk_gv_header"
                      checked={rows.filter(r => r.status !== "8").length > 0 && rows.filter(r => r.status !== "8").every(r => selected[r.id])}
                      onChange={e => { const m: Record<number, boolean> = {}; if (e.target.checked) rows.forEach(r => { if (r.status !== "8") m[r.id] = true; }); setSelected(m); }} />
                    <label htmlFor="chk_gv_header" style={{ margin: 0 }}>SELECT</label>
                  </th>
                  <th style={{ padding: "5px", textAlign: "center", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", whiteSpace: "nowrap", display: "none" }}>Id</th>
                  <th style={{ padding: "5px", textAlign: "center", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", whiteSpace: "nowrap" }}>Sr No.</th>
                  <th style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", whiteSpace: "nowrap" }}>Amount</th>
                  <th style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", whiteSpace: "nowrap" }}>Receiver Name</th>
                  <th style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", whiteSpace: "nowrap" }}>Debited To</th>
                  <th style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", whiteSpace: "nowrap" }}>Request Date</th>
                  <th style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", whiteSpace: "nowrap" }}>Narration</th>
                  <th style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", whiteSpace: "nowrap" }}>Payment Method</th>
                  <th style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", whiteSpace: "nowrap" }}>Payment Date</th>
                  <th style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", whiteSpace: "nowrap" }}>Status</th>
                  <th style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", whiteSpace: "nowrap", textAlign: "center" }}>Image</th>
                  <th style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", whiteSpace: "nowrap", textAlign: "center" }}>Action</th>
                  <th style={{ padding: "5px", borderBottom: "1px solid #aaa", whiteSpace: "nowrap", textAlign: "center" }}>Print</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v, idx) => {
                  const isPaid = v.status === "8";
                  const pd = v.payment_date === "00/00/0000" ? "" : v.payment_date;
                  return (
                    <tr key={v.id} style={{ background: idx % 2 === 0 ? "#ffffff" : "white", color: "#000066" }}>
                      <td style={{ padding: "5px", textAlign: "center", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa" }}>
                        <input type="checkbox" className="chk_client" disabled={isPaid} checked={!!selected[v.id]} onChange={e => setSelected(p => ({ ...p, [v.id]: e.target.checked }))} />
                      </td>
                      <td style={{ padding: "5px", textAlign: "center", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", display: "none" }}>{v.id}</td>
                      <td style={{ padding: "5px", textAlign: "center", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa" }}>{idx + 1}</td>
                      <td style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa" }}>{Number(v.cash_rs).toLocaleString("en-IN")}</td>
                      <td style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa" }}>{v.receiver_name}</td>
                      <td style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa" }}>{v.debited_to}</td>
                      <td style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa" }}>{v.request_date}</td>
                      <td style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa" }}>{v.narration}</td>
                      <td style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa" }}>
                        <select
                          className="form-control text_box"
                          value={payRows[v.id]?.pm || "Cash"}
                          onChange={e => setPayRows(p => ({ ...p, [v.id]: { ...(payRows[v.id] || { pm: "Cash", pd: "" }), pm: e.target.value } }))}
                          style={{ width: "100%", fontSize: "10px" }}
                          disabled={isPaid}
                        >
                          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa" }}>
                        {isPaid ? (
                          <input type="text" className="form-control date-pickers" value={pd || ""} readOnly disabled
                            style={{ width: "100%", fontSize: "10px" }} />
                        ) : (
                          <input
                            type="date"
                            className="form-control date-pickers"
                            value={payRows[v.id]?.pd || ""}
                            onChange={e => setPayRows(p => ({ ...p, [v.id]: { ...(p[v.id] || { pm: "Cash", pd: "" }), pd: e.target.value } }))}
                            style={{ width: "100%", fontSize: "10px", cursor: "pointer" }}
                          />
                        )}
                      </td>
                      <td style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa" }}>
                        <span style={{
                          padding: "2px 6px", borderRadius: "3px", fontSize: "9px", fontWeight: "600",
                          background: isPaid ? "#e8f5e9" : v.status === "3" || v.status === "5" || v.status === "7" ? "#ffebee" : "#fff8e1",
                          color: isPaid ? "#2e7d32" : v.status === "3" || v.status === "5" || v.status === "7" ? "#c62828" : "#f57f17",
                        }}>{v.status_label || STATUS[v.status] || v.status}</span>
                      </td>
                      <td style={{ padding: "5px", textAlign: "center", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa" }}>
                        {v.soft_copy_file && (
                          <>
                            <button type="button" onClick={() => downloadProof(v)} className="btn btn-link" style={{ padding: "0 4px", fontSize: "10px", color: "red" }}>Download</button>
                          </>
                        )}
                      </td>
                      <td style={{ padding: "5px", textAlign: "center", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa" }}>
                        {!isPaid && (
                          <button
                            type="button"
                            className="btn btn-primary"
                            style={{ fontSize: "10px", padding: "2px 8px", color: "white" }}
                            onClick={() => handlePay(v.id)}
                          >
                            Pay
                          </button>
                        )}
                      </td>
                      <td style={{ padding: "5px", textAlign: "center", borderBottom: "1px solid #aaa" }}>
                        <button type="button" className="btn btn-primary" style={{ fontSize: "10px", padding: "2px 8px", color: "white" }} onClick={() => printVoucher(v)}>Print</button>
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={13} style={{ textAlign: "center", color: "#999", padding: "20px", fontSize: "10px" }}>No records</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tab 2: Petty Cash Bank */}
        <div id="menu2" className="tab-pane" style={{ display: activeTab === "petty" ? "block" : "none", color: "black" }}>
          <div className="row" style={{ marginBottom: "10px" }}>
            <div className="col-sm-2 col-xs-12 text-left">
              <b>Add Amount:</b> <span style={{ color: "red" }}>*</span>
              <input type="text" className="form-control text_box" value={pettyAmount} onChange={e => setPettyAmount(e.target.value)} onKeyPress={e => { if (!/[\d.]/.test(e.key)) e.preventDefault(); }} style={{ fontSize: "10px" }} />
            </div>
            <div className="col-sm-2 col-xs-12 text-left">
              <b>Available Balance:</b> <span style={{ color: "red" }}>*</span>
              <input type="text" className="form-control text_box" value={String((Number(balance) || 0) + (Number(pettyAmount) || 0))} readOnly style={{ fontSize: "10px" }} />
            </div>
            <div className="col-sm-2 col-xs-12 text-left">
              <b>Cash Added By</b> <span style={{ color: "red" }}>*</span>
              <input type="text" className="form-control text_box" value={pettyBy} onChange={e => setPettyBy(e.target.value)} maxLength={50} onKeyPress={e => { if (!/^[a-zA-Z ]$/.test(e.key)) e.preventDefault(); }} style={{ fontSize: "10px" }} />
            </div>
            <div className="col-sm-2 col-xs-12">
              <b>Cash Added Date :</b><span style={{ color: "red" }}>*</span>
              <input type="date" className="form-control date-pickers" value={pettyDate} onChange={e => setPettyDate(e.target.value)} style={{ fontSize: "10px", cursor: "pointer" }} />
            </div>
          </div>
          <div className="row text-center" style={{ marginBottom: "10px" }}>
            <button type="button" className="btn btn-primary" onClick={handlePettySubmit} style={{ fontSize: "10px" }}>Submit</button>
            <button type="button" className="btn btn-danger" style={{ marginLeft: "10px", fontSize: "10px" }} onClick={() => { window.location.href = "/Home"; }}>Close</button>
          </div>

          <div className="panel panel-default" style={{ overflowX: "auto" }}>
            <table ref={pettyTableRef} id="gv_petty_cash" className="table table-bordered table-striped" style={{ width: "100%", background: "white", border: "1px solid #ccc", fontSize: "10px" }}>
              <thead style={{ background: "#006699", color: "white", fontWeight: "bold", textTransform: "uppercase" }}>
                <tr>
                  <th style={{ padding: "5px", textAlign: "center", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", whiteSpace: "nowrap" }}>Sr No.</th>
                  <th style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", whiteSpace: "nowrap" }}>Id</th>
                  <th style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", whiteSpace: "nowrap" }}>Add Amount</th>
                  <th style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", whiteSpace: "nowrap" }}>Available Balance</th>
                  <th style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", whiteSpace: "nowrap" }}>Cash Added By</th>
                  <th style={{ padding: "5px", borderBottom: "1px solid #aaa", whiteSpace: "nowrap" }}>Cash Added Date</th>
                </tr>
              </thead>
              <tbody>
                {pettyRows.map((v, idx) => (
                  <tr key={v.id} style={{ background: idx % 2 === 0 ? "#ffffff" : "white", color: "#000066" }}>
                    <td style={{ padding: "5px", textAlign: "center", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa" }}>{idx + 1}</td>
                    <td style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa" }}>{v.id}</td>
                    <td style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", textAlign: "right" }}>{Number(v.add_amount).toLocaleString("en-IN")}</td>
                    <td style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa", textAlign: "right" }}>{Number(v.available_balance).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    <td style={{ padding: "5px", borderRight: "1px solid #aaa", borderBottom: "1px solid #aaa" }}>{v.cash_added_by}</td>
                    <td style={{ padding: "5px", borderBottom: "1px solid #aaa" }}>{v.cash_added_date}</td>
                  </tr>
                ))}
                {pettyRows.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "#999", padding: "20px", fontSize: "10px" }}>No records</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tab 3: Report */}
        <div id="menu6" className="tab-pane" style={{ display: activeTab === "report" ? "block" : "none", color: "black" }}>
          <div className="row" style={{ marginBottom: "10px" }}>
            <div className="col-sm-1 col-xs-12">
              <b>From Date :</b>
              <input type="date" className="form-control date-picker1" value={reportFrom} onChange={e => setReportFrom(e.target.value)} style={{ width: "130px", fontSize: "10px", cursor: "pointer" }} />
            </div>
            <div className="col-sm-1 col-xs-12">
              <b>To Date :</b>
              <input type="date" className="form-control date-picker2" value={reportTo} onChange={e => setReportTo(e.target.value)} style={{ width: "130px", fontSize: "10px", cursor: "pointer" }} />
            </div>
            <div className="col-sm-2 col-xs-12" style={{ marginTop: "22px" }}>
              <select className="form-control" value={reportType} onChange={e => setReportType(e.target.value as any)} style={{ fontSize: "10px" }}>
                <option value="ALL">ALL</option>
                <option value="1">PAID</option>
                <option value="2">UNPAID</option>
              </select>
            </div>
            <div className="col-sm-2 col-xs-12" style={{ marginTop: "22px" }}>
              <button type="button" className="btn btn-primary btn-block" onClick={handleReport} style={{ fontSize: "10px", padding: "6px 12px" }}>Report</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}