"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getJSON, getJSONStrict, mk } from "@/lib/api/legacy-fetch";

// Legacy userDashboard.aspx (menu "DashBoard"): problem list from pay_dashboard.
// On load the server creates today's "Attendance not Received" rows; SHOW lists the open ones;
// "Closed" sets Status = 1.
const UD = "/api/masters/user-dashboard/";
interface Row { id: number; client_name: string; state: string; branch_name: string; employee_name: string; designation: string; description: string; login_date_time: string }

export default function UserDashboardPage() {
  const router = useRouter();
  const [clients, setClients] = useState<{ client_code: string; client_name: string | null }[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("ALL");
  const [type, setType] = useState("0");
  const [start, setStart] = useState(""); const [end, setEnd] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      await mk(`${UD}generate/`, {});
      const d = await getJSON<{ results: any[] }>(`${UD}clients/`);
      setClients(d?.results ?? []);
    })();
  }, []);

  const onClient = async (v: string) => {
    setClient(v); setState("ALL"); setStates([]);
    if (v !== "Select") {
      const d = await getJSON<{ results: { state_name: string }[] }>(`${UD}states/?client_code=${encodeURIComponent(v)}`);
      setStates((d?.results ?? []).map((r) => r.state_name));
    }
  };

  const show = async () => {
    const p = new URLSearchParams();
    if (client !== "Select") p.set("client_code", client);
    if (state !== "ALL") p.set("state", state);
    if (type !== "0") p.set("type", type);
    if (start) p.set("start", start);
    if (end) p.set("end", end);
    try {
      const d = await getJSONStrict<{ results: Row[] }>(`${UD}?${p.toString()}`);
      setRows(d.results);
      if (d.results.length === 0) alert("No Records Found !!!");
    } catch (e: any) { alert(e?.message || "Request failed."); }
  };

  const closeRow = async (id: number) => {
    const r = await mk(`${UD}close_item/`, { id });
    if (!r.ok) { alert("Request failed."); return; }
    await show();
  };

  const view = (rows ?? []).filter((r) => !q || Object.values(r).some((v) => String(v ?? "").toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="container-fluid">
      <div className="panel panel-primary">
        <div className="panel-heading" style={{ textAlign: "center", fontWeight: "bold", textTransform: "uppercase", fontSize: "small" }}>User Dashboard</div>
        <div className="panel-body">
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="col-md-2"><label>Client Name</label>
              <select className="form-control" value={client} onChange={(e) => onClient(e.target.value)}>
                <option value="Select">Select</option>
                {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name ?? c.client_code}</option>)}
              </select></div>
            <div className="col-md-2"><label>State Name</label>
              <select className="form-control" value={state} onChange={(e) => setState(e.target.value)}>
                <option value="ALL">ALL</option>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></div>
            <div className="col-md-2"><label>Type</label>
              <select className="form-control" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="0">Select</option><option value="1">Attendance</option>
                <option value="2">Police Verification</option><option value="3">Rent Agreement</option>
              </select></div>
            <div className="col-md-2"><label>From Date</label><input type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} /></div>
            <div className="col-md-2"><label>To Date</label><input type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} /></div>
            <div className="col-md-2" style={{ paddingTop: 25 }}>
              <button type="button" className="btn btn-primary" onClick={show}>SHOW</button>{" "}
              <button type="button" className="btn btn-danger" onClick={() => router.push("/")}>Close</button>
            </div>
          </div>
          {rows && rows.length > 0 && (
            <>
              <div className="row" style={{ marginBottom: 8 }}><div className="col-md-3 pull-right"><input className="form-control" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} /></div></div>
              <div style={{ overflowX: "auto" }}>
                <table className="table table-striped table-bordered table-hover">
                  <thead style={{ background: "#224173", color: "white" }}>
                    <tr><th>Details</th><th>id</th><th>CLIENT NAME</th><th>STATE</th><th>BRANCH NAME</th><th>EMPLOYEE NAME</th><th>DESIGNATION</th><th>DESCRIPTION</th><th>LOGIN DATE TIME</th></tr>
                  </thead>
                  <tbody>
                    {view.map((r) => (
                      <tr key={r.id}>
                        <td><a href="#" onClick={(e) => { e.preventDefault(); closeRow(r.id); }}>Closed</a></td>
                        <td>{r.id}</td><td>{r.client_name}</td><td>{r.state}</td><td>{r.branch_name}</td>
                        <td>{r.employee_name}</td><td>{r.designation}</td><td>{r.description}</td><td>{r.login_date_time}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
