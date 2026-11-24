"use client";

import React, { useState, useEffect, useCallback, memo } from "react";
import { useClients, useStates, useBranches } from "./hooks";
import Grid from "./Grid";
import { Msg, Lab, Sel, Txt, Btn, DropBanner, val, rowId, MonthPick } from "./ui";
import { apiGet } from "@/lib/api/client";

const BASE = "/api/masters/it-master";
const SEL = "Select";
type Row = Record<string, any>;

const TabAttendanceApproval = memo(function TabAttendanceApproval() {
  const { opts: clients, err: clientErr, refresh: refreshClients } = useClients();
  const [month, setMonth] = useState("");
  const [client, setClient] = useState(SEL);
  const [state, setState] = useState(SEL);
  const [unit, setUnit] = useState("ALL");
  const { opts: states, err: stateErr, refresh: refreshStates } = useStates(client);
  const { opts: branches, err: branchErr, refresh: refreshBranches } = useBranches(client, state);
  const [rows, setRows] = useState<Row[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState({ text: "", ok: true });
  const [summary, setSummary] = useState<{ pending: number; admin_manager: number; finance: number; total: number } | null>(null);

  const load = useCallback(async () => {
    if (!client || client === SEL) { setRows([]); setSummary(null); return; }
    try {
      const data = await apiGet<{ results: Row[] }>(`${BASE}/timesheet/?month=${encodeURIComponent(month)}&client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}&unit_code=${encodeURIComponent(unit)}`);
      setRows(data?.results ?? []);
      setSel({});
      if (month.length >= 7) {
        const sm = await apiGet<{ pending: number; admin_manager: number; finance: number; total: number }>(`${BASE}/timesheet-summary/?month=${encodeURIComponent(month)}&client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}&unit_code=${encodeURIComponent(unit)}`);
        setSummary(sm ?? null);
      } else {
        setSummary(null);
      }
    } catch (e: any) {
      const m = String(e?.message ?? "");
      const hasStatus = /^API \d+ for /.test(m);
      const t = hasStatus ? `Failed to load timesheet (${m.match(/API (\d+)/)?.[1]})` : m;
      setMsg({ text: t, ok: false });
    }
  }, [client, state, unit, month]);

  useEffect(() => { load(); }, [load]);

  const approve = useCallback(async (kind: "admin" | "finance") => {
    const r = window.confirm("Are you Sure You Want to Approve This Record");
    if (!r) return;
    const ids = rows.filter((x, i) => sel[rowId(x, i)]).map((x) => val(x, "Id"));
    if (ids.length === 0) { window.alert("Please select atleast one Record "); return; }
    try {
      const d = await apiGet<{ message?: string }>(`${BASE}/timesheet-approve/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, kind }) });
      window.alert(d?.message || " Record Approved Successfully ... !!!");
      setMsg({ text: d?.message || " Record Approved Successfully ... !!!", ok: true });
      setSel({});
      load();
    } catch (e: any) {
      const msgText = e?.message ?? "Approve failed";
      window.alert(msgText);
      setMsg({ text: msgText, ok: false });
    }
  }, [rows, sel, load]);

  const cols = ["Id", "Sr No.", "CLIENT CODE", "STATE NAME", "unit code", "UNIT_NAME", "CURRENT STATUS"];
  const renderCell = useCallback((x: Row, c: string, i: number) => {
    if (c === "Sr No.") return i + 1;
    const m: Record<string, string> = { "CLIENT CODE": "CLIENT_CODE", "STATE NAME": "STATE", "unit code": "unit_code", "UNIT_NAME": "UNIT_NAME", "CURRENT STATUS": "status" };
    return val(x, m[c] ?? c);
  }, []);

  const handleClientChange = useCallback((v: string) => { setClient(v); setState(SEL); setUnit("ALL"); }, []);
  const handleStateChange = useCallback((v: string) => { setState(v); setUnit("ALL"); }, []);

  return (
    <div>
      <Msg text={msg.text} ok={msg.ok} />
      <DropBanner errs={[clientErr, stateErr, branchErr]} />
      <div className="row" style={{ marginBottom: 10 }}>
        <div className="col-md-2 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Select Month :</Lab><MonthPick value={month} onChange={setMonth} /></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Client Name :</Lab><Sel value={client} onChange={handleClientChange} opts={clients} /></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10 }}><Lab req>State Name:</Lab><Sel value={state} onChange={handleStateChange} opts={states} /></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Branch Name :</Lab><Sel value={unit} onChange={setUnit} opts={branches} /></div>
      </div>
      {summary && (
        <table className="table" style={{ width: "auto", minWidth: 420, marginBottom: 12, background: "#fff", fontSize: 12 }}>
          <thead>
            <tr>
              <th>Branches</th>
              <th style={{ textAlign: "center" }}>Pending (Admin Manager)</th>
              <th style={{ textAlign: "center" }}>Approved by Admin Manager (Finance pending)</th>
              <th style={{ textAlign: "center" }}>Approved by Finance</th>
              <th style={{ textAlign: "center" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><b>Count</b></td>
              <td style={{ textAlign: "center", color: summary.pending ? "#c62828" : undefined, fontWeight: 600 }}>{summary.pending}</td>
              <td style={{ textAlign: "center", color: summary.admin_manager ? "#e65100" : undefined, fontWeight: 600 }}>{summary.admin_manager}</td>
              <td style={{ textAlign: "center", color: summary.finance ? "#2e7d32" : undefined, fontWeight: 600 }}>{summary.finance}</td>
              <td style={{ textAlign: "center", fontWeight: 600 }}>{summary.total}</td>
            </tr>
          </tbody>
        </table>
      )}
      <div className="it-grid-alt">
        <Grid id="gv_approve_attendace" cols={cols} rows={rows} hiddenIdCol checkKey selected={sel}
          onToggle={(k, v) => setSel((p) => ({ ...p, [k]: v }))}
          onToggleAll={(v) => { const n: Record<string, boolean> = {}; rows.forEach((x, i) => { n[rowId(x, i)] = v; }); setSel(n); }}
          renderCell={renderCell} />
      </div>
      <div className="row text-center" style={{ marginTop: 15 }}>
        <div className="col-xs-6 col-sm-3"><Btn onClick={() => approve("admin")} className="it-btn" style={{ width: "100%", minWidth: 180 }}>Approve by Admin Manager</Btn></div>
        <div className="col-xs-6 col-sm-3"><Btn onClick={() => approve("finance")} className="it-btn" style={{ width: "100%", minWidth: 180 }}>Approve By Finance</Btn></div>
      </div>
    </div>
  );
});

export default TabAttendanceApproval;