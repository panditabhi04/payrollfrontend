"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getJSON } from "@/lib/api/legacy-fetch";
// Legacy summary_Report.aspx ("Summary Report"): Client -> State -> Branch cascade with
// Total Employee Count and Attendance Count (read-only).
const B = "/api/reports/summary-report";
type Opt = { code: string; name: string };

export default function SummaryReportPage() {
  const router = useRouter();
  const [clients, setClients] = useState<Opt[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [branches, setBranches] = useState<Opt[]>([]);
  const [client, setClient] = useState("Select"); const [state, setState] = useState("Select"); const [unit, setUnit] = useState("Select");
  const [emp, setEmp] = useState(0); const [att, setAtt] = useState(0);

  useEffect(() => { getJSON<{ clients: Opt[] }>(`${B}/options/`).then((d) => setClients(d?.clients ?? [])); }, []);

  const counts = async (c: string, s: string, u: string) => {
    const q = new URLSearchParams();
    if (c !== "Select") q.set("client_code", c);
    if (s !== "Select") q.set("state", s);
    if (u !== "Select") q.set("unit_code", u);
    const d = await getJSON<{ total_employee_count: number; attendance_count: number }>(`${B}/counts/?${q.toString()}`);
    setEmp(d?.total_employee_count ?? 0); setAtt(d?.attendance_count ?? 0);
  };

  const onClient = async (c: string) => {
    setClient(c); setState("Select"); setUnit("Select"); setBranches([]); setStates([]);
    if (c === "Select") { setEmp(0); setAtt(0); return; }
    const d = await getJSON<{ states: string[] }>(`${B}/options/?client_code=${encodeURIComponent(c)}`);
    setStates(d?.states ?? []);
    counts(c, "Select", "Select");
  };
  const onState = async (s: string) => {
    setState(s); setUnit("Select"); setBranches([]);
    if (s === "Select") { counts(client, "Select", "Select"); return; }
    const d = await getJSON<{ branches: Opt[] }>(`${B}/options/?client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(s)}`);
    setBranches(d?.branches ?? []);
    counts(client, s, "Select");
  };
  const onUnit = (u: string) => { setUnit(u); counts(client, state, u); };

  return (
    <div className="lg-panel">
      <div className="lg-panel-head">Summary Report</div>
      <div className="lg-panel-body">
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div><div>Client Name : <span style={{ color: "red" }}>*</span></div>
            <select value={client} onChange={(e) => onClient(e.target.value)}>
              <option value="Select">Select</option>
              {clients.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
            </select></div>
          <div><div>State : <span style={{ color: "red" }}>*</span></div>
            <select value={state} onChange={(e) => onState(e.target.value)}>
              <option value="Select">Select</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></div>
          <div><div>Branch Name : <span style={{ color: "red" }}>*</span></div>
            <select value={unit} onChange={(e) => onUnit(e.target.value)}>
              <option value="Select">Select</option>
              {branches.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
            </select></div>
          <div><div>Total Employee Count :</div><input value={emp} disabled readOnly /></div>
          <div><div>Attendance Count :</div><input value={att} disabled readOnly /></div>
        </div>
        <div style={{ marginTop: 16 }}><button onClick={() => router.push("/")}>Close</button></div>
      </div>
    </div>
  );
}
