"use client";

import React, { useState, useEffect, useCallback, memo } from "react";
import { useClients, useStates, useBranches } from "./hooks";
import Grid from "./Grid";
import { Msg, Lab, Sel, Txt, Btn, DropBanner, val, rowId, DatePick } from "./ui";
import { apiGet } from "@/lib/api/client";

const BASE = "/api/masters/it-master";
const SEL = "Select";
type Row = Record<string, any>;

function errText(r: Response, fallback: string) {
  return r.json().catch(() => ({})).then((e: any) => e?.detail || e?.non_field_errors?.[0] || (Array.isArray(e) ? e[0] : fallback));
}

const TabContract = memo(function TabContract() {
  const { opts: clients, err: clientErr, refresh: refreshClients } = useClients();
  const [client, setClient] = useState(SEL);
  const [state, setState] = useState("SELECT");
  const [branch, setBranch] = useState(SEL);
  const { opts: statesRaw, err: stateErr, refresh: refreshStates } = useStates(client);
  const { opts: branchesRaw, err: branchErr, refresh: refreshBranches } = useBranches(client, state === "SELECT" ? "" : state);
  const states = statesRaw.filter((s) => s.v.toUpperCase() !== SEL.toUpperCase());
  const branches = branchesRaw.filter((b) => b.v !== SEL && b.v !== "ALL");
  const [rows, setRows] = useState<Row[]>([]);
  const [ed, setEd] = useState<Record<number, { s: string; e: string; us: string; ue: string }>>({});
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState({ text: "", ok: true });

  const load = useCallback(async () => {
    if (!client || client === SEL) { setRows([]); return; }
    try {
      const data = await apiGet<{ results: Row[] }>(`${BASE}/contract/?client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}&unit_code=${encodeURIComponent(branch === SEL ? "" : branch)}`);
      const list = (data?.results ?? []) as Row[];
      setRows(list); setSel({});
      setEd(Object.fromEntries(list.map((r, i) => [i, { s: String(val(r, "Start_Date") ?? ""), e: String(val(r, "end_date") ?? ""), us: String(val(r, "unit_start_date") ?? ""), ue: String(val(r, "unit_end_date") ?? "") }])));
    } catch (e: any) {
      const m = String(e?.message ?? "");
      const hasStatus = /^API \d+ for /.test(m);
      const t = hasStatus ? `Failed to load contract (${m.match(/API (\d+)/)?.[1]})` : m;
      setMsg({ text: t, ok: false });
    }
  }, [client, state, branch]);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(async (r: Row, i: number) => {
    if (!window.confirm("Are you Sure You Want to Approve This Record")) return;
    const v = ed[i] ?? { s: "", e: "", us: "", ue: "" };
    try {
      const d = await apiGet<{ message?: string }>(`${BASE}/contract-update/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        id: val(r, "Id"), client_code: client, state, unit_code: branch === SEL ? "" : branch,
        start_date: v.s, end_date: v.e, unit_start_date: v.us, unit_end_date: v.ue,
      }) });
      if (d?.message) { window.alert(d.message); setMsg({ text: d.message, ok: true }); }
      load();
    } catch (e: any) {
      const msgText = e?.message ?? "Update failed";
      window.alert(msgText);
      setMsg({ text: msgText, ok: false });
    }
  }, [client, state, branch, ed, load]);

  const cols = ["Id", "Sr No.", "State Name", "Unit Name", "Designation", "Start Date", "End Date", "Unit Start Date", "Unit End Date", "Update Dates"];
  const renderCell = useCallback((r: Row, c: string, i: number) => {
    if (c === "Sr No.") return i + 1;
    const m: Record<string, string> = { "State Name": "STATE", "Unit Name": "UNIT_NAME", "Designation": "DESIGNATION" };
    if (m[c]) return val(r, m[c]);
    const v = ed[i] ?? { s: "", e: "", us: "", ue: "" };
    const set = (k: "s" | "e" | "us" | "ue", val: string) => setEd((p) => ({ ...p, [i]: { ...v, [k]: val } }));
    if (c === "Start Date") return (<DatePick value={v.s} onChange={(x) => set("s", x)} style={{ minWidth: 130 }} />);
    if (c === "End Date") return (<DatePick value={v.e} onChange={(x) => set("e", x)} style={{ minWidth: 130 }} />);
    if (c === "Unit Start Date") return (<DatePick value={v.us} onChange={(x) => set("us", x)} style={{ minWidth: 130 }} />);
    if (c === "Unit End Date") return (<DatePick value={v.ue} onChange={(x) => set("ue", x)} style={{ minWidth: 130 }} />);
    return (<Btn onClick={() => update(r, i)} style={{ width: "fit-content", whiteSpace: "nowrap" }}>UpdateDate</Btn>);
  }, [ed, update]);

  const handleClientChange = useCallback((v: string) => { setClient(v); setState("SELECT"); setBranch(SEL); }, []);
  const handleStateChange = useCallback((v: string) => { setState(v); setBranch(SEL); }, []);

  return (
    <div>
      <Msg text={msg.text} ok={msg.ok} />
      <DropBanner errs={[clientErr, stateErr, branchErr]} />
      <div className="row" style={{ marginBottom: 10 }}>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Client Name :</Lab><Sel value={client} onChange={handleClientChange} opts={clients} /></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10 }}><Lab req>State Name:</Lab><Sel value={state} onChange={handleStateChange} opts={[{ v: "SELECT", t: "SELECT" }, ...states]} /></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10 }}><b>Branch Name:</b><Sel value={branch} onChange={setBranch} opts={[{ v: SEL, t: SEL }, { v: "ALL", t: "ALL" }, ...branches]} /></div>
      </div>
      <Grid id="gv_count_increase" cols={cols} rows={rows} hiddenIdCol renderCell={renderCell} />
    </div>
  );
});

export default TabContract;