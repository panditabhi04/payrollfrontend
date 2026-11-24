"use client";
import React, { useState, useEffect, useCallback } from "react";
import { getJSON, mk } from "@/lib/api/legacy-fetch";

// Softcopy Mail Master — 1:1 port of softcopy_email_send.aspx. Two config tabs persisting to
// BillingEmailDetail (pay_billing_email_details) and OutstandingEmailDetail (pay_outstanding_email_details).
const B = "/api/transactions/softcopy-config";

interface BillRow { id: number; client_code: string; client_name: string; billing_type: string; billing_wise: string; region: string; state_name: string; grade_code: string; unit_code: string; branch_name: string; from_email_id: string; password: string; to_email_id: string; cc_mail_id: string; }
interface OutRow { id: number; client_code: string; client_name: string; from_mail: string; from_mail_pw: string; to_mail: string; cc_mail: string; bcc_mail: string; thanks_n_reguards: string; contact: string; designation: string; comp_name: string; billing_cycle: string; billing_tag_line: string; attendance_tag_line: string; }

export default function SoftcopyMail() {
  const [activeTab, setActiveTab] = useState("softcopy");
  const [msg, setMsg] = useState("");

  const [clients, setClients] = useState<{ v: string; t: string }[]>([]);
  const [billTypes, setBillTypes] = useState<string[]>([]);
  const [billings, setBillings] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [branches, setBranches] = useState<{ v: string; t: string }[]>([]);
  const [designations, setDesignations] = useState<string[]>(["ALL"]);

  const [gridData, setGridData] = useState<BillRow[]>([]);
  const [oGridData, setOGridData] = useState<OutRow[]>([]);

  // Tab 1 state
  const [editId, setEditId] = useState<number | null>(null);
  const [client, setClient] = useState("Select");
  const [billType, setBillType] = useState("Select");
  const [billing, setBilling] = useState("Select");
  const [region, setRegion] = useState("Select");
  const [stateName, setStateName] = useState("Select");
  const [branch, setBranch] = useState("Select");
  const [designation, setDesignation] = useState("ALL");
  const [fromMail, setFromMail] = useState("");
  const [password, setPassword] = useState("");
  const [toMail, setToMail] = useState("");
  const [ccMail, setCcMail] = useState("");

  // Tab 2 state
  const [oMode, setOMode] = useState<"Save" | "Update">("Save");
  const [oClient, setOClient] = useState("Select");
  const [oFromMail, setOFromMail] = useState("");
  const [oPassword, setOPassword] = useState("");
  const [oToMail, setOToMail] = useState("");
  const [oCcMail, setOCcMail] = useState("");
  const [oBcMail, setOBcMail] = useState("");
  const [oThanks, setOThanks] = useState("");
  const [oContact, setOContact] = useState("");
  const [oDesignation, setODesignation] = useState("");
  const [oCompany, setOCompany] = useState("IH&MS");
  const [oBillingCycle, setOBillingCycle] = useState("");
  const [oBillingTagline, setOBillingTagline] = useState("");
  const [oAttendanceTagline, setOAttendanceTagline] = useState("");

  const clientName = (code: string) => clients.find((c) => c.v === code)?.t ?? "";

  useEffect(() => {
    getJSON<{ results: { client_code: string; client_name: string }[] }>("/api/masters/clients/?page_size=all")
      .then((d) => setClients((d?.results ?? []).map((c) => ({ v: c.client_code, t: c.client_name }))))
      .catch(() => {});
  }, []);

  const loadBillingGrid = useCallback(async (c: string) => {
    if (!c || c === "Select") { setGridData([]); return; }
    const d = await getJSON<{ results: BillRow[] }>(`${B}/billing_list/?client_code=${encodeURIComponent(c)}`).catch(() => null);
    setGridData(d?.results ?? []);
  }, []);

  // Tab 1: on client change -> load bill types / billing-wise / regions (legacy bind_*), states/branches + grid.
  useEffect(() => {
    if (!client || client === "Select") {
      setBillTypes([]); setBillings([]); setRegions([]); setStates([]); setBranches([]); setGridData([]);
      return;
    }
    getJSON<{ bill_types: string[]; billing_wise: string[]; regions: string[] }>(
      `${B}/options/?client_code=${encodeURIComponent(client)}`).then((d) => {
      setBillTypes(d?.bill_types ?? []); setBillings(d?.billing_wise ?? []); setRegions(d?.regions ?? []);
    }).catch(() => {});
    getJSON<{ units: { unit_code: string; unit_name: string; state_name: string }[]; states: string[] }>(
      `/api/masters/units/lookup/?client_code=${encodeURIComponent(client)}`).then((d) => {
      const rs = d?.units ?? [];
      setStates([...(d?.states ?? Array.from(new Set(rs.map((u) => u.state_name).filter(Boolean))))].sort());
      setBranches(rs.map((u) => ({ v: u.unit_code, t: u.unit_name })));
    }).catch(() => {});
    loadBillingGrid(client);
  }, [client, loadBillingGrid]);

  // Tab 1: statewise designations depend on client + state (legacy bind_statewisedesignation).
  useEffect(() => {
    if (!client || client === "Select" || !stateName || stateName === "Select") { setDesignations(["ALL"]); return; }
    getJSON<{ results: string[] }>(`${B}/designations/?client_code=${encodeURIComponent(client)}&state_name=${encodeURIComponent(stateName)}`)
      .then((d) => setDesignations(d?.results ?? ["ALL"])).catch(() => setDesignations(["ALL"]));
  }, [client, stateName]);

  const loadOutGrid = useCallback(async (c: string) => {
    const d = await getJSON<{ results: OutRow[] }>(`${B}/outstanding_list/?client_code=${encodeURIComponent(c && c !== "Select" ? c : "")}`).catch(() => null);
    setOGridData(d?.results ?? []);
  }, []);

  // Tab 2: on client change -> auto-populate billing cycle (legacy ddl_client change) + grid.
  useEffect(() => {
    if (!oClient || oClient === "Select") { setOBillingCycle(""); loadOutGrid(""); return; }
    getJSON<{ billing_cycle: string }>(`${B}/billing_cycle/?client_code=${encodeURIComponent(oClient)}`)
      .then((d) => setOBillingCycle(d?.billing_cycle ?? "")).catch(() => {});
    loadOutGrid(oClient);
  }, [oClient, loadOutGrid]);

  const emailRegex = /^([a-zA-Z0-9_.-])+@(([a-zA-Z0-9-])+.)+([a-zA-Z0-9]{2,4})+$/;

  const clearTab1 = () => {
    setEditId(null); setClient("Select"); setBillType("Select"); setBilling("Select"); setRegion("Select");
    setStateName("Select"); setBranch("Select"); setDesignation("ALL");
    setFromMail(""); setPassword(""); setToMail(""); setCcMail("");
  };

  const handleSave = async () => {
    if (client === "Select") { alert("Please Select Client Name"); return; }
    if (billType === "Select") { alert("Please Select bill type"); return; }
    if (billing === "Select") { alert("Please Select billing"); return; }
    if (billing === "Regionwise" && region === "Select") { alert("Please Select Region"); return; }
    if (stateName === "Select") { alert("Please Select State Name"); return; }
    if (billing === "Statewisedesignation" && designation === "ALL") { alert("Please Select Satewise Designation"); return; }
    if (billing === "Branchwise" && branch === "Select") { alert("Please Select Branch Name"); return; }
    if (fromMail.trim() === "") { alert("Please Enter from mail"); return; }
    if (!emailRegex.test(fromMail)) { alert("Please provide a valid email address"); return; }
    if (password.trim() === "") { alert("Please Enter Password"); return; }
    if (toMail.trim() === "") { alert("Please Enter To mail"); return; }
    if (!emailRegex.test(toMail)) { alert("Please provide a valid email address"); return; }
    const payload = {
      id: editId ?? "", client_code: client, client_name: clientName(client), billing_type: billType,
      billing_wise: billing, region: billing === "Regionwise" ? region : "", state_name: stateName,
      grade_code: billing === "Statewisedesignation" ? designation : "",
      unit_code: billing === "Branchwise" ? branch : "",
      branch_name: billing === "Branchwise" ? (branches.find((b) => b.v === branch)?.t ?? "") : "",
      from_email_id: fromMail, password, to_email_id: toMail, cc_mail_id: ccMail,
    };
    const r = await mk(`${B}/billing_save/`, payload);
    const b = await r.json().catch(() => ({} as any));
    if (r.ok) { alert(b.status ?? "Saved"); setMsg(b.status ?? ""); const c = client; clearTab1(); loadBillingGrid(c); }
    else alert(Array.isArray(b) ? b.join(" ") : (b.detail || JSON.stringify(b)));
  };

  const editBilling = async (row: BillRow) => {
    const d = await getJSON<BillRow>(`${B}/billing_get/?id=${row.id}`).catch(() => null);
    if (!d) return;
    setEditId(d.id); setClient(d.client_code); setBillType(d.billing_type || "Select");
    setBilling(d.billing_wise || "Select"); setRegion(d.region || "Select");
    setStateName(d.state_name || "Select"); setBranch(d.unit_code || "Select");
    setDesignation(d.grade_code || "ALL"); setFromMail(d.from_email_id || "");
    setPassword(d.password || ""); setToMail(d.to_email_id || ""); setCcMail(d.cc_mail_id || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const delBilling = async (row: BillRow) => {
    if (!confirm("Are You Sure You Want To Delete Record")) return;
    const r = await mk(`${B}/billing_delete/`, { id: row.id });
    if (r.ok) loadBillingGrid(client);
  };

  const clearTab2 = () => {
    setOMode("Save"); setOClient("Select"); setOFromMail(""); setOPassword(""); setOToMail(""); setOCcMail("");
    setOBcMail(""); setOThanks(""); setOContact(""); setODesignation(""); setOBillingCycle("");
    setOBillingTagline(""); setOAttendanceTagline("");
  };

  const handleOSave = async () => {
    if (oClient === "Select") { alert("Please Select Client Name"); return; }
    if (oFromMail.trim() === "") { alert("Please Enter from mail"); return; }
    if (!emailRegex.test(oFromMail)) { alert("Please provide a valid email address"); return; }
    if (oPassword.trim() === "") { alert("Please Enter properly password......."); return; }
    if (oToMail.trim() === "") { alert("Please Enter properly to mail......."); return; }
    if (oCcMail.trim() === "") { alert("Please Enter properly CC mail......."); return; }
    if (oBcMail.trim() === "") { alert("Please Enter properly BC mail......."); return; }
    if (oThanks.trim() === "") { alert("Please Enter proper Thanks reason......."); return; }
    if (oContact.trim() === "") { alert("Please Enter 10 digits Contact Number......."); return; }
    if (oDesignation.trim() === "") { alert("Please Enter Properly Designation ......."); return; }
    if (oCompany.trim() === "") { alert("Please Enter Properly Company Name ......."); return; }
    if (oBillingCycle.trim() === "") { alert("Please Enter Properly Billing Cycle ......."); return; }
    if (oBillingTagline.trim() === "") { alert("Please Enter Properly Billing Tag Line ......."); return; }
    if (oAttendanceTagline.trim() === "") { alert("Please Enter Properly Attendence Tag Line ......."); return; }
    const payload = {
      mode: oMode, client_code: oClient, client_name: clientName(oClient), from_mail: oFromMail,
      from_mail_pw: oPassword, to_mail: oToMail, cc_mail: oCcMail, bcc_mail: oBcMail,
      thanks_n_reguards: oThanks, contact: oContact, designation: oDesignation, comp_name: oCompany,
      billing_cycle: oBillingCycle, billing_tag_line: oBillingTagline, attendance_tag_line: oAttendanceTagline,
    };
    const r = await mk(`${B}/outstanding_save/`, payload);
    const b = await r.json().catch(() => ({} as any));
    if (r.ok) { alert(b.status ?? "Saved"); setMsg(b.status ?? ""); const c = oClient; clearTab2(); loadOutGrid(c); }
    else alert(Array.isArray(b) ? b.join(" ") : (b.detail || JSON.stringify(b)));
  };

  const editOutstanding = (row: OutRow) => {
    setOMode("Update"); setOClient(row.client_code); setOFromMail(row.from_mail); setOPassword(row.from_mail_pw);
    setOToMail(row.to_mail); setOCcMail(row.cc_mail); setOBcMail(row.bcc_mail); setOThanks(row.thanks_n_reguards);
    setOContact(row.contact); setODesignation(row.designation); setOCompany(row.comp_name || "IH&MS");
    setOBillingCycle(row.billing_cycle); setOBillingTagline(row.billing_tag_line); setOAttendanceTagline(row.attendance_tag_line);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const delOutstanding = async (row: OutRow) => {
    if (!confirm("Are You Sure You Want To Delete Record")) return;
    const r = await mk(`${B}/outstanding_delete/`, { id: row.id });
    if (r.ok) loadOutGrid(oClient);
  };

  return (
    <section className="app-content">
      <div className="lg-panel">
        <div className="lg-panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div></div>
          <div style={{ textAlign: "center", flex: 1, fontSize: "small", textTransform: "uppercase" }}>
            <b>SoftCopy Send Email</b>
          </div>
          <div></div>
        </div>

        <div className="lg-panel-body">
          {msg && <div style={{ color: "green", fontWeight: "bold", textAlign: "center", marginBottom: 10 }}>{msg}</div>}
          <div style={{ background: "#f3f1fe", padding: "15px 20px", border: "1px solid #e2e2dd", marginBottom: "20px", marginTop: "10px", borderRadius: "10px" }}>

            <div className="em-tabs">
              <button className={`em-tab ${activeTab === "softcopy" ? "active" : ""}`} onClick={() => setActiveTab("softcopy")}>
                <b>Softcopy E-Mail Master</b>
              </button>
              <button className={`em-tab ${activeTab === "outstanding" ? "active" : ""}`} onClick={() => setActiveTab("outstanding")}>
                <b>Outstanding Payment E-Mail Master</b>
              </button>
            </div>

            <div className="em-tabpane" style={{ borderRadius: "0 10px 10px 10px" }}>
              {activeTab === "softcopy" && (
                <div id="menu1">
                  <div className="lg-form cols4" style={{ background: "white", padding: "15px", border: "1px solid white", borderRadius: "10px" }}>

                    <div className="lg-row">
                      <span className="lg-label">Client Name: <span className="lg-req">*</span></span>
                      <select className="lg-control" value={client} onChange={(e) => setClient(e.target.value)}>
                        <option value="Select">Select</option>
                        <option value="ALL">ALL</option>
                        {clients.map(c => <option key={c.v} value={c.v}>{c.t}</option>)}
                      </select>
                    </div>

                    <div className="lg-row">
                      <span className="lg-label">Select Bill Type: <span className="lg-req">*</span></span>
                      <select className="lg-control" value={billType} onChange={(e) => setBillType(e.target.value)}>
                        <option value="Select">Select</option>
                        {billTypes.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>

                    <div className="lg-row">
                      <span className="lg-label">Billing: <span className="lg-req">*</span></span>
                      <select className="lg-control" value={billing} onChange={(e) => setBilling(e.target.value)}>
                        <option value="Select">Select</option>
                        {billings.map(b => <option key={b} value={b}>{b}</option>)}
                      </select>
                    </div>

                    {billing === "Regionwise" && (
                      <div className="lg-row">
                        <span className="lg-label">Region: <span className="lg-req">*</span></span>
                        <select className="lg-control" value={region} onChange={(e) => setRegion(e.target.value)}>
                          <option value="Select">Select</option>
                          {regions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </div>
                    )}

                    <div className="lg-row">
                      <span className="lg-label">State Name: <span className="lg-req">*</span></span>
                      <select className="lg-control" value={stateName} onChange={(e) => setStateName(e.target.value)}>
                        <option value="Select">Select</option>
                        {states.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>

                    {billing === "Branchwise" && (
                      <div className="lg-row">
                        <span className="lg-label">Branch Name: <span className="lg-req">*</span></span>
                        <select className="lg-control" value={branch} onChange={(e) => setBranch(e.target.value)}>
                          <option value="Select">Select</option>
                          {branches.map(b => <option key={b.v} value={b.v}>{b.t}</option>)}
                        </select>
                      </div>
                    )}

                    {billing === "Statewisedesignation" && (
                      <div className="lg-row">
                        <span className="lg-label">Statewise Designation: <span className="lg-req">*</span></span>
                        <select className="lg-control" value={designation} onChange={(e) => setDesignation(e.target.value)}>
                          {designations.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="lg-form cols4" style={{ background: "white", padding: "15px", border: "1px solid white", borderRadius: "10px", marginTop: "10px" }}>
                    <div className="lg-row">
                      <span className="lg-label">From Mail Id: <span className="lg-req">*</span></span>
                      <input type="text" className="lg-control" value={fromMail} onChange={(e) => setFromMail(e.target.value)} />
                    </div>

                    <div className="lg-row">
                      <span className="lg-label">Password: <span className="lg-req">*</span></span>
                      <input type="password" className="lg-control" value={password} onChange={(e) => setPassword(e.target.value)} />
                    </div>

                    <div className="lg-row">
                      <span className="lg-label">To Mail Id: <span className="lg-req">*</span></span>
                      <input type="text" className="lg-control" value={toMail} onChange={(e) => setToMail(e.target.value)} />
                    </div>

                    <div className="lg-row">
                      <span className="lg-label">CC Mail Id:</span>
                      <textarea className="lg-control" rows={2} value={ccMail} onChange={(e) => setCcMail(e.target.value)} style={{ resize: "vertical" }}></textarea>
                    </div>
                  </div>

                  <div className="lg-btns center" style={{ marginTop: "20px" }}>
                    <button className="lg-btn-primary" onClick={handleSave}>{editId ? "Update" : "Save"}</button>
                    <button className="lg-btn-primary" onClick={clearTab1}> clear </button>
                  </div>

                  <div className="lg-grid-wrapper" style={{ marginTop: "20px", overflowX: "auto" }}>
                    <table className="lg-grid">
                      <thead>
                        <tr>
                          <th>Sr No.</th>
                          <th>Client Name</th>
                          <th>Bill Type</th>
                          <th>Billing Wise</th>
                          <th>Region</th>
                          <th>State Name</th>
                          <th>Designation</th>
                          <th>Branch Name</th>
                          <th>From Email Id</th>
                          <th>Password</th>
                          <th>To mail</th>
                          <th>CC Mail</th>
                          <th>Edit</th>
                          <th>Delete</th>
                        </tr>
                      </thead>
                      <tbody>
                        {gridData.length === 0 ? (
                          <tr><td colSpan={14} style={{ textAlign: "center" }}>No records</td></tr>
                        ) : (
                          gridData.map((row, i) => (
                            <tr key={row.id}>
                              <td>{i + 1}</td>
                              <td>{row.client_name || row.client_code}</td>
                              <td>{row.billing_type}</td>
                              <td>{row.billing_wise}</td>
                              <td>{row.region}</td>
                              <td>{row.state_name}</td>
                              <td>{row.grade_code}</td>
                              <td>{row.branch_name}</td>
                              <td>{row.from_email_id}</td>
                              <td>{row.password}</td>
                              <td>{row.to_email_id}</td>
                              <td>{row.cc_mail_id}</td>
                              <td><button className="lg-btn-primary" style={{ padding: "2px 5px", fontSize: "10px" }} onClick={() => editBilling(row)}>Edit</button></td>
                              <td><button className="lg-btn-primary" style={{ padding: "2px 5px", fontSize: "10px", background: "#d9534f" }} onClick={() => delBilling(row)}>✕</button></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}

              {activeTab === "outstanding" && (
                <div id="menu2">
                  <div className="lg-form cols4" style={{ background: "white", padding: "15px", border: "1px solid white", borderRadius: "10px" }}>

                    <div className="lg-row">
                      <span className="lg-label">Client Name: <span className="lg-req">*</span></span>
                      <select className="lg-control" value={oClient} onChange={(e) => setOClient(e.target.value)}>
                        <option value="Select">Select</option>
                        {clients.map(c => <option key={c.v} value={c.v}>{c.t}</option>)}
                      </select>
                    </div>

                    <div className="lg-row">
                      <span className="lg-label">From Mail Id: <span className="lg-req">*</span></span>
                      <input type="text" className="lg-control" value={oFromMail} onChange={(e) => setOFromMail(e.target.value)} />
                    </div>

                    <div className="lg-row">
                      <span className="lg-label">Password: <span className="lg-req">*</span></span>
                      <input type="password" className="lg-control" value={oPassword} onChange={(e) => setOPassword(e.target.value)} />
                    </div>

                    <div className="lg-row">
                      <span className="lg-label">To Mail: <span className="lg-req">*</span></span>
                      <input type="text" className="lg-control" value={oToMail} onChange={(e) => setOToMail(e.target.value)} />
                    </div>

                    <div className="lg-row">
                      <span className="lg-label">CC Mail Id:</span>
                      <input type="text" className="lg-control" value={oCcMail} onChange={(e) => setOCcMail(e.target.value)} />
                    </div>

                    <div className="lg-row">
                      <span className="lg-label">BC Mail Id:</span>
                      <input type="text" className="lg-control" value={oBcMail} onChange={(e) => setOBcMail(e.target.value)} />
                    </div>

                    <div className="lg-row">
                      <span className="lg-label">Thanks & Regards:</span>
                      <input type="text" className="lg-control" value={oThanks} onChange={(e) => setOThanks(e.target.value)} />
                    </div>

                    <div className="lg-row">
                      <span className="lg-label">Contact:</span>
                      <input type="text" className="lg-control" value={oContact} onChange={(e) => setOContact(e.target.value.replace(/[^0-9]/g, ""))} maxLength={10} />
                    </div>

                    <div className="lg-row">
                      <span className="lg-label">Designation:</span>
                      <input type="text" className="lg-control" value={oDesignation} onChange={(e) => setODesignation(e.target.value)} />
                    </div>

                    <div className="lg-row">
                      <span className="lg-label">Company Name:</span>
                      <input type="text" className="lg-control" value={oCompany} onChange={(e) => setOCompany(e.target.value)} />
                    </div>

                    <div className="lg-row">
                      <span className="lg-label">Billing Cycle:</span>
                      <input type="text" className="lg-control" value={oBillingCycle} onChange={(e) => setOBillingCycle(e.target.value)} />
                    </div>

                    <div className="lg-row">
                      <span className="lg-label">Billing Tagline:</span>
                      <input type="text" className="lg-control" value={oBillingTagline} onChange={(e) => setOBillingTagline(e.target.value)} />
                    </div>

                    <div className="lg-row">
                      <span className="lg-label">Attendance Tagline:</span>
                      <input type="text" className="lg-control" value={oAttendanceTagline} onChange={(e) => setOAttendanceTagline(e.target.value)} />
                    </div>
                  </div>

                  <div className="lg-btns center" style={{ marginTop: "20px" }}>
                    <button className="lg-btn-primary" onClick={handleOSave}>{oMode === "Update" ? "UPDATE" : "Save"}</button>
                    <button className="lg-btn-primary" onClick={clearTab2}>clear</button>
                  </div>

                  <div className="lg-grid-wrapper" style={{ marginTop: "20px", overflowX: "auto" }}>
                    <table className="lg-grid">
                      <thead>
                        <tr>
                          <th>SR.NO</th>
                          <th>Client Code</th>
                          <th>Client Name</th>
                          <th>From Mail</th>
                          <th>From mail password</th>
                          <th>To Mail</th>
                          <th>CC mail</th>
                          <th>BCC mail</th>
                          <th>Thanks & Regards</th>
                          <th>Contact</th>
                          <th>Designation</th>
                          <th>Company Name</th>
                          <th>Billing Cycle</th>
                          <th>Billing Tag Line</th>
                          <th>Attendence Tag Line</th>
                          <th>Edit</th>
                          <th>Delete</th>
                        </tr>
                      </thead>
                      <tbody>
                        {oGridData.length === 0 ? (
                          <tr><td colSpan={17} style={{ textAlign: "center" }}>No records</td></tr>
                        ) : (
                          oGridData.map((row, i) => (
                            <tr key={row.id}>
                              <td>{i + 1}</td>
                              <td>{row.client_code}</td>
                              <td>{row.client_name}</td>
                              <td>{row.from_mail}</td>
                              <td>{row.from_mail_pw}</td>
                              <td>{row.to_mail}</td>
                              <td>{row.cc_mail}</td>
                              <td>{row.bcc_mail}</td>
                              <td>{row.thanks_n_reguards}</td>
                              <td>{row.contact}</td>
                              <td>{row.designation}</td>
                              <td>{row.comp_name}</td>
                              <td>{row.billing_cycle}</td>
                              <td>{row.billing_tag_line}</td>
                              <td>{row.attendance_tag_line}</td>
                              <td><button className="lg-btn-primary" style={{ padding: "2px 5px", fontSize: "10px" }} onClick={() => editOutstanding(row)}>Edit</button></td>
                              <td><button className="lg-btn-primary" style={{ padding: "2px 5px", fontSize: "10px", background: "#d9534f" }} onClick={() => delOutstanding(row)}>✕</button></td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
