"use client";
import React, { useEffect, useState } from "react";
import { getJSON, getJSONStrict, mk, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

// Legacy site_audit_detail.aspx. Feedback type switch (Site Audit / Supervisor Through Feedback),
// Client > State > Branch > Supervisor filters (each change re-filters the grid), photo grid and
// Approve / Reject (with reason) / Complete actions.
const SA = "/api/masters/site-audit-detail/";
type Row = Record<string, any>;
const Q = [1, 2, 3, 4, 5, 6];
const R10 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export default function SiteAuditDetail() {
  const [type, setType] = useState("Select");
  const [clients, setClients] = useState<{ client_code: string; client_name: string }[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [units, setUnits] = useState<{ unit_code: string; unit_name: string }[]>([]);
  const [sups, setSups] = useState<{ emp_code: string; emp_name: string }[]>([]);
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [unit, setUnit] = useState("Select");
  const [sup, setSup] = useState("Select");
  const [rows, setRows] = useState<Row[]>([]);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  useEffect(() => {
    (async () => {
      const d = await getJSON<{ results: any[] }>(`${SA}clients/`);
      setClients(d?.results ?? []);
    })();
  }, []);

  const load = async (t: string, c: string, s: string, u: string, e: string) => {
    const p = new URLSearchParams({ type: t === "1" ? "1" : "2" });
    if (c !== "Select") p.set("client_code", c);
    if (s !== "Select") p.set("state", s);
    if (u !== "Select") p.set("unit_code", u);
    if (e !== "Select") p.set("emp_code", e);
    try {
      const d = await getJSONStrict<{ results: Row[] }>(`${SA}?${p.toString()}`);
      setRows(d.results);
      if (d.results.length === 0) alert("No Records Found");
    } catch (er: any) {
      setRows([]);
      alert(er?.message || "Request failed.");
    }
  };

  const onType = (v: string) => {
    setType(v); setClient("Select"); setState("Select"); setUnit("Select"); setSup("Select");
    setStates([]); setUnits([]); setSups([]); setRejectId(null);
    if (v !== "Select") load(v, "Select", "Select", "Select", "Select"); else setRows([]);
  };
  const onClient = async (v: string) => {
    setClient(v); setState("Select"); setUnit("Select"); setSup("Select"); setUnits([]); setSups([]);
    if (v === "Select") { setStates([]); return; }
    const d = await getJSON<{ results: { state_name: string }[] }>(`${SA}states/?client_code=${encodeURIComponent(v)}`);
    setStates((d?.results ?? []).map((r) => r.state_name));
    load(type, v, "Select", "Select", "Select");
  };
  const onState = async (v: string) => {
    setState(v); setUnit("Select"); setSup("Select"); setSups([]);
    const d = await getJSON<{ results: any[] }>(`${SA}units/?client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(v)}`);
    setUnits(d?.results ?? []);
    load(type, client, v, "Select", "Select");
  };
  const onUnit = async (v: string) => {
    setUnit(v); setSup("Select");
    const d = await getJSON<{ results: any[] }>(`${SA}supervisors/?unit_code=${encodeURIComponent(v)}`);
    setSups(d?.results ?? []);
    load(type, client, state, v, "Select");
  };
  const onSup = (v: string) => { setSup(v); load(type, client, state, unit, v); };
  const reload = () => load(type, client, state, unit, sup);

  const act = async (kind: "approve" | "complete" | "reject", id: number, confirmText: string, extra: Record<string, any> = {}) => {
    if (!confirm(confirmText)) { alert("Record not Available"); return; }
    const r = await mk(`${SA}${kind}/`, { id, type: type === "1" ? "1" : "2", ...extra });
    if (!r.ok) { alert(await responseMessage(r)); return; }
    const d = await r.json().catch(() => ({}));
    if (d?.detail) alert(d.detail);
    setRejectId(null); setComment("");
    await reload();
  };
  const doReject = () => {
    if (!comment.trim()) { alert("Please Enter Reason !!"); return; }
    if (rejectId !== null) act("reject", rejectId, "Are you Sure You Want to reject Record", { comment });
  };

  const img = (v: any) => {
    if (!v) return "";
    const url = `${API_BASE_URL}/media/site_audit/${v}`;
    return (<a href={url} target="_blank" rel="noreferrer"><img src={url} alt="" width={50} height={50} /></a>);
  };
  const canAR = (s: string) => ["Pending", "Completed", "Mail Send", ""].includes(s);

  const audit = type === "1";
  return (
    <div className="container-fluid">
      <div className="panel panel-primary">
        <div className="panel-heading" style={{ textAlign: "center", fontWeight: "bold", textTransform: "uppercase", fontSize: "small" }}>Site Audit</div>
        <div className="panel-body">
          <div className="row" style={{ background: "#f3f1fe", border: "1px solid #ddd9d9", borderRadius: 10, padding: 15, marginBottom: 20 }}>
            <div className="col-sm-2"><b>Name :</b> <span style={{ color: "red" }}>*</span>
              <select className="form-control" value={type} onChange={(e) => onType(e.target.value)}>
                <option value="Select">Select</option><option value="1">Site Audit</option><option value="2">Supervisor Through Feedback</option>
              </select></div>
            <div className="col-sm-2"><b>Client Name :</b> <span style={{ color: "red" }}>*</span>
              <select className="form-control" value={client} onChange={(e) => onClient(e.target.value)}>
                <option value="Select">Select</option>
                {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
              </select></div>
            <div className="col-sm-2"><b>State :</b> <span style={{ color: "red" }}>*</span>
              <select className="form-control" value={state} onChange={(e) => onState(e.target.value)}>
                <option value="Select">Select</option>{states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></div>
            <div className="col-sm-2"><b>Branch Name :</b> <span style={{ color: "red" }}>*</span>
              <select className="form-control" value={unit} onChange={(e) => onUnit(e.target.value)}>
                <option value="Select">Select</option>{units.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
              </select></div>
            <div className="col-sm-2"><b>Supervisor Name :</b> <span style={{ color: "red" }}>*</span>
              <select className="form-control" value={sup} onChange={(e) => onSup(e.target.value)}>
                <option value="Select">Select</option>{sups.map((s) => <option key={s.emp_code} value={s.emp_code}>{s.emp_name}</option>)}
              </select></div>
          </div>

          {rejectId !== null && (
            <div className="row" style={{ marginBottom: 15 }}>
              <div className="col-sm-4" />
              <div className="col-sm-3"><span>Comment :</span>
                <textarea className="form-control" value={comment} onChange={(e) => setComment(e.target.value)} /></div>
              <div className="col-sm-3">
                <button type="button" className="btn btn-primary" style={{ marginTop: 30 }} onClick={doReject}> Reject </button>{" "}
                <button type="button" className="btn btn-default" style={{ marginTop: 30 }} onClick={() => { setRejectId(null); setComment(""); }}>Cancel</button>
              </div>
            </div>
          )}

          {type !== "Select" && (
            <div style={{ overflowX: "auto" }}>
              <table className="table table-striped table-bordered table-hover">
                <thead style={{ background: "#224173", color: "white" }}>
                  {audit ? (
                    <tr><th>Id</th><th>State Name</th><th>Branch Name</th><th>Visit Date</th><th>Employee</th><th>Grade</th>
                      {Q.map((n) => <React.Fragment key={n}><th>Question {n}</th><th>Image {n}</th></React.Fragment>)}
                      <th>Location</th><th>Comment</th><th>Remark</th><th>Status</th><th>Action</th></tr>
                  ) : (
                    <tr><th>Id</th><th>State Name</th><th>Branch Name</th><th>Date</th><th>Employee</th>
                      {R10.map((n) => <th key={n}>Question {n}</th>)}
                      <th>Remark</th><th>Status</th><th>Action</th></tr>
                  )}
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td><td>{r.state_name}</td><td>{r.unit_name}</td>
                      {audit ? (
                        <>
                          <td>{r.visit_date}</td><td>{r.emp_code}</td><td>{r.grade_name}</td>
                          {Q.map((n) => <React.Fragment key={n}><td>{r[`que_${n}_ans`]}</td><td>{img(r[`que_${n}_path`])}</td></React.Fragment>)}
                          <td>{r.location}</td><td>{r.comment}</td><td>{r.remark}</td>
                        </>
                      ) : (
                        <>
                          <td>{r.cur_date}</td><td>{r.emp_name}</td>
                          {R10.map((n) => <td key={n}>{r[`que_${n}_ans`]}</td>)}
                          <td>{r.remark}</td>
                        </>
                      )}
                      <td>{r.Status}</td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {canAR(r.Status) && (
                          <>
                            <a href="#" className="btn btn-primary btn-xs" onClick={(e) => { e.preventDefault(); act("approve", r.id, "Are you Sure You Want to Approved Record"); }}>Approved</a>{" "}
                            <a href="#" className="btn btn-primary btn-xs" onClick={(e) => { e.preventDefault(); if (confirm("Are you Sure You Want to Approved Record")) { setRejectId(r.id); setComment(r.comment ?? ""); } else alert("Record not Available"); }}>Reject</a>{" "}
                          </>
                        )}
                        {r.Status === "Approved" && (
                          <a href="#" className="btn btn-primary btn-xs" onClick={(e) => { e.preventDefault(); act("complete", r.id, "Are you Sure You Want to Complete this Record"); }}>Complete</a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
