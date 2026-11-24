"use client";
import React, { useState, useEffect } from "react";
import { getJSON, getJSONStrict, postJSON, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

/**
 * Employee Bank Details approval (legacy employee_bank_details_level_1.aspx = Level I,
 * employee_bank_details.aspx = Level II -- both menu entries land on /hr/kyc).
 * Rows, counts and decisions all come from /api/hr/employee-kyc/ (grid / bank-counts /
 * bank-decision); the selected Client / State / Branch is applied server-side.
 */
const KYC = "/api/hr/employee-kyc";

type Row = {
  id: number | string; emp_code: string; emp_name: string; state_name: string; unit_name: string;
  employee_type: string; bank_holder: string; bank_name: string; account_no: string; ifsc: string;
  status: string; reject_reason: string; passbook_url: string;
};
const COLS: { key: string; label: string }[] = [
  { key: "emp_name", label: "EMPLOYEE NAME" }, { key: "state_name", label: "STATE NAME" },
  { key: "unit_name", label: "BRANCH NAME" }, { key: "emp_code", label: "EMPLOYEE ID" },
  { key: "employee_type", label: "EMPLOYEE TYPE" }, { key: "bank_holder", label: "BANK HOLDER NAME" },
  { key: "bank_name", label: "BANK NAME" }, { key: "account_no", label: "ACCOUNT NO" },
  { key: "ifsc", label: "IFSC CODE" }, { key: "status", label: "Status" },
];

export default function EmployeeKycManager() {
  const [level, setLevel] = useState<"1" | "2">("2");
  const [clients, setClients] = useState<{ v: string; t: string }[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [allUnits, setAllUnits] = useState<{ unit_code: string; unit_name: string; state_name: string }[]>([]);
  const [branches, setBranches] = useState<{ v: string; t: string }[]>([]);
  const [client, setClient] = useState("Select");
  const [stateName, setStateName] = useState("Select");
  const [branch, setBranch] = useState("Select");
  const [gridData, setGridData] = useState<Row[]>([]);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [counts, setCounts] = useState({ pending: 0, approved_l1: 0, rejected: 0, approved_senior: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<number | string>>(new Set());
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [showApproved, setShowApproved] = useState(false);
  const [showCols, setShowCols] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search).get("level");
      if (q === "1") setLevel("1");
    }
    getJSON<{ results: { client_code: string; client_name: string }[] }>("/api/masters/clients/?page_size=all")
      .then((d) => setClients((d?.results ?? []).map((c) => ({ v: c.client_code, t: c.client_name }))))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    setGridData([]); setSelectedIds(new Set());
    if (!client || client === "Select" || client === "ALL") {
      setStates([]); setAllUnits([]); setBranches([]); return;
    }
    getJSON<{ units: { unit_code: string; unit_name: string; state_name: string }[]; states: string[] }>(
      `/api/masters/units/lookup/?client_code=${encodeURIComponent(client)}`).then((d) => {
      const rs = d?.units ?? [];
      setAllUnits(rs);
      setStates([...(d?.states ?? Array.from(new Set(rs.map((u) => u.state_name).filter(Boolean))))].sort());
    }).catch(() => undefined);
  }, [client]);

  useEffect(() => {
    const list = !stateName || stateName === "Select" || stateName === "ALL"
      ? allUnits : allUnits.filter((u) => u.state_name === stateName);
    setBranches(list.map((u) => ({ v: u.unit_code, t: u.unit_name })));
    setBranch("Select");
  }, [stateName, allUnits]);

  const params = () => {
    const q = new URLSearchParams({ level, client_code: client });
    q.set("state_name", stateName);
    q.set("unit_code", branch);
    if (level === "2" && showApproved) q.set("show", "all");
    return q.toString();
  };

  const loadCounts = async () => {
    const c = await getJSON<typeof counts>(`${KYC}/bank-counts/?${params()}`);
    if (c) setCounts(c);
  };

  const handleShow = async (silent = false) => {
    if (client === "Select") { alert("Please Select Client Name"); return; }
    if (stateName === "Select") { alert("Please Select State Name"); return; }
    if (branch === "Select") { alert("Please Select Branch Name"); return; }
    setBusy(true);
    try {
      const res = await getJSONStrict<{ results: Row[]; message?: string }>(`${KYC}/grid/?${params()}`);
      setGridData(res.results || []);
      setReasons({}); setSelectedIds(new Set());
      if (res.message && !silent) alert(res.message);
      loadCounts();
    } catch (e: any) {
      alert(e.message || "Failed to load data.");
      setGridData([]);
    } finally { setBusy(false); }
  };

  const decide = async (decision: "approve" | "reject") => {
    if (client === "Select") { alert("Please Select Client Name"); return; }
    if (stateName === "Select") { alert("Please Select State Name"); return; }
    if (branch === "Select") { alert("Please Select Branch Name"); return; }
    if (selectedIds.size === 0) { alert("Please select at least one record."); return; }
    const ids = Array.from(selectedIds);
    if (decision === "reject" && ids.some((id) => !(reasons[id] || "").trim())) {
      alert("Please Enter Reject Reason"); return;
    }
    if (!confirm(`Are you Sure You Want to ${decision === "approve" ? "Approve" : "Reject"} Record(s)?`)) return;
    setBusy(true);
    try {
      const r = await postJSON(`${KYC}/bank-decision/`, {
        level, decision, items: ids.map((id) => ({ id, reason: reasons[id] || "" })),
      });
      if (!r.ok) { alert(await responseMessage(r, "Request failed.")); return; }
      const d = await r.json().catch(() => ({} as any));
      alert(d.message || "Done");
      await handleShow(true);
    } finally { setBusy(false); }
  };

  const vis = COLS.filter((c) => !hidden[c.key]);
  const cell = (r: Row, key: string) => (r as any)[key] ?? "";
  const handleCSV = () => {
    const q = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [["Sr No.", ...vis.map((c) => c.label)].map(q).join(","),
      ...gridData.map((r, i) => [i + 1, ...vis.map((c) => cell(r, c.key))].map(q).join(","))];
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/csv;charset=utf-8;" }));
    a.download = "EmployeeBankDetails.csv";
    a.click();
  };
  const handleCopy = () => {
    const text = [["Sr No.", ...vis.map((c) => c.label)].join("\t"),
      ...gridData.map((r, i) => [i + 1, ...vis.map((c) => cell(r, c.key))].join("\t"))].join("\n");
    navigator.clipboard?.writeText(text).then(() => alert("Copied to clipboard!")).catch(() => alert("Copy failed."));
  };

    const currentData = gridData; // all records, no paging
  const btn: React.CSSProperties = { background: "#00b712", color: "#fff", border: "1px solid #00b712", padding: "6px 15px", fontWeight: "bold", fontSize: "12px", cursor: "pointer", borderRadius: "2px" };
  const th: React.CSSProperties = { background: "#f9f9f9", color: "#337ab7", border: "1px solid #c7c5c5", textAlign: "left", fontWeight: "normal" };
  const dl = (u: string) => (u.startsWith("http") ? u : `${API_BASE_URL}${u}`);

  return (
    <section className="app-content">
      <div className="lg-panel">
        <div className="lg-panel-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div></div>
          <div style={{ textAlign: "center", flex: 1, fontSize: "small", textTransform: "uppercase" }}>
            <b>Employee Bank Details - Level {level === "1" ? "I" : "II"}</b>
          </div>
          <div></div>
        </div>

        <div className="lg-panel-body">
          <div style={{ background: "#f3f1fe", padding: "25px", border: "1px solid #e2e2dd", marginBottom: "20px", marginTop: "10px", borderRadius: "10px" }}>
            <div className="lg-form cols4" style={{ background: "transparent", border: "none", padding: 0 }}>
              <div className="lg-row">
                <span className="lg-label">Approval Level :</span>
                <select className="lg-control" value={level} onChange={(e) => { setLevel(e.target.value as "1" | "2"); setGridData([]); setSelectedIds(new Set()); }}>
                  <option value="1">Level I</option>
                  <option value="2">Level II</option>
                </select>
                {level === "2" && (
                  <label style={{ marginLeft: "10px", fontSize: "12px" }}>
                    <input type="checkbox" checked={showApproved} onChange={(e) => { setShowApproved(e.target.checked); setGridData([]); setSelectedIds(new Set()); }} /> Show already approved
                  </label>
                )}
              </div>
              <div className="lg-row">
                <span className="lg-label">Client Name :</span>
                <select className="lg-control" value={client} onChange={(e) => setClient(e.target.value)}>
                  <option value="Select">Select</option>
                  <option value="ALL">ALL</option>
                  {clients.map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}
                </select>
              </div>
              <div className="lg-row">
                <span className="lg-label">State Name :</span>
                <select className="lg-control" value={stateName} onChange={(e) => setStateName(e.target.value)}>
                  <option value="Select">Select</option>
                  <option value="ALL">ALL</option>
                  {states.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="lg-row">
                <span className="lg-label">Branch Name :</span>
                <select className="lg-control" value={branch} onChange={(e) => setBranch(e.target.value)}>
                  <option value="Select">Select</option>
                  <option value="ALL">ALL</option>
                  {branches.map((b) => <option key={b.v} value={b.v}>{b.t}</option>)}
                </select>
              </div>
              <div className="lg-row" style={{ justifyContent: "flex-end", paddingBottom: "2px" }}>
                <button className="lg-btn-primary" onClick={() => handleShow()} disabled={busy} style={{ width: "fit-content" }}>Show</button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
              <div style={{ width: "320px" }}>
                <table className="lg-grid" style={{ marginTop: 0 }}>
                  <tbody>
                    <tr><th style={th}><span style={{ color: "red", fontWeight: "bold", marginRight: "5px" }}>{counts.pending}</span> Bank Details Pending for Approval</th></tr>
                    <tr><th style={th}><span style={{ color: "red", fontWeight: "bold", marginRight: "5px" }}>{counts.approved_l1}</span> Bank Details Aprroved By First Level</th></tr>
                    <tr><th style={th}><span style={{ color: "red", fontWeight: "bold", marginRight: "5px" }}>{counts.rejected}</span> Bank Details Rejected By Finance</th></tr>
                    <tr><th style={th}><span style={{ color: "red", fontWeight: "bold", marginRight: "5px" }}>{counts.approved_senior}</span> Bank Details Approve By Senior</th></tr>
                  </tbody>
                </table>
              </div>
            </div>

            {gridData.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "20px", position: "relative" }}>
                <div style={{ fontSize: "12px", fontWeight: "bold" }}>Total: {gridData.length} records</div>
                <div style={{ display: "flex", gap: "2px" }}>
                  <button onClick={handleCSV} style={btn}>CSV</button>
                  <button onClick={() => window.print()} style={btn}>Print</button>
                  <button onClick={handleCopy} style={btn}>Copy</button>
                  <button onClick={() => setShowCols((s) => !s)} style={btn}>Column visibility</button>
                </div>
                {showCols && (
                  <div style={{ background: "#fff", border: "1px solid #ccc", padding: 8, position: "absolute", zIndex: 5, top: 70, left: 0 }}>
                    {COLS.map((c) => (
                      <label key={c.key} style={{ display: "block", fontSize: 12 }}>
                        <input type="checkbox" checked={!hidden[c.key]} onChange={() => setHidden((h) => ({ ...h, [c.key]: !h[c.key] }))} /> {c.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="lg-grid-wrapper" style={{ marginTop: "10px", overflow: "auto" }}>
              <table className="lg-grid">
                <thead>
                  <tr>
                    <th>Sr No.</th><th>SELECT<br />
                      <input type="checkbox" title="Select all" checked={currentData.length > 0 && currentData.every((r) => selectedIds.has(r.id))}
                        onChange={(e) => setSelectedIds(e.target.checked ? new Set(currentData.map((r) => r.id)) : new Set())} /> All</th>
                    {vis.map((c) => <th key={c.key}>{c.label}</th>)}
                    <th>BANK PASSBOOK</th><th>DOWNLOAD PASSBOOK</th><th>REJECT REASON</th>
                  </tr>
                </thead>
                <tbody>
                  {currentData.length === 0 ? (
                    <tr><td colSpan={vis.length + 5} style={{ textAlign: "center" }}>No records</td></tr>
                  ) : currentData.map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td>
                      <td>
                        <input type="checkbox" checked={selectedIds.has(r.id)} onChange={(e) => {
                          const next = new Set(selectedIds);
                          if (e.target.checked) next.add(r.id); else next.delete(r.id);
                          setSelectedIds(next);
                        }} />
                      </td>
                      {vis.map((c) => <td key={c.key}>{cell(r, c.key)}</td>)}
                      <td>{r.passbook_url ? <img loading="lazy" src={dl(r.passbook_url)} alt="Passbook" width={40} height={40} style={{ objectFit: "cover" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} /> : ""}</td>
                      <td>{r.passbook_url ? <a href={dl(r.passbook_url)} target="_blank" rel="noreferrer" download style={{ color: "#337ab7" }}>Download</a> : ""}</td>
                      <td>
                        <input type="text" className="lg-control" style={{ width: "180px", margin: 0 }}
                          value={reasons[r.id] ?? r.reject_reason}
                          onChange={(e) => setReasons((m) => ({ ...m, [r.id]: e.target.value }))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {gridData.length > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", fontFamily: "Verdana, sans-serif" }}>
                <div style={{ fontSize: "12px", color: "#333", fontWeight: "bold" }}>Total: {gridData.length} records</div>
              </div>
            )}

            {gridData.length > 0 && (
              <div className="lg-btns center" style={{ marginTop: "20px" }}>
                <button className="lg-btn-primary" disabled={busy} onClick={() => decide("approve")}>Approve</button>
                <button className="lg-btn-primary" disabled={busy} onClick={() => decide("reject")}>Reject</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
