"use client";

import React, { useState, useEffect, useCallback, memo } from "react";
import { useClients, useStates, useBranches } from "./hooks";
import Grid from "./Grid";
import { Msg, Lab, Sel, Txt, Btn, DropBanner, val, rowId } from "./ui";
import { apiGet } from "@/lib/api/client";

const BASE = "/api/masters/it-master";
const SEL = "Select";
type Row = Record<string, any>;

function errText(r: Response, fallback: string) {
  return r.json().catch(() => ({})).then((e: any) => e?.detail || e?.non_field_errors?.[0] || (Array.isArray(e) ? e[0] : fallback));
}

const TabBank = memo(function TabBank() {
  const { opts: clients, err: clientErr, refresh: refreshClients } = useClients();
  const [client, setClient] = useState(SEL);
  const [state, setState] = useState(SEL);
  const [unit, setUnit] = useState("ALL");
  const { opts: states, err: stateErr, refresh: refreshStates } = useStates(client);
  const { opts: branches, err: branchErr, refresh: refreshBranches } = useBranches(client, state);
  const [rows, setRows] = useState<Row[]>([]);
  const [vals, setVals] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState({ text: "", ok: true });

  const load = useCallback(async () => {
    if (!unit || unit === "ALL") { setRows([]); return; }
    try {
      const data = await apiGet<{ results: Row[] }>(`${BASE}/bank-list/?client_code=${encodeURIComponent(client)}&unit_code=${encodeURIComponent(unit)}`);
      const list = (data?.results ?? []) as Row[];
      setRows(list);
      setVals(Object.fromEntries(list.map((r, i) => [i, String(val(r, "bank_approve") ?? "")])));
    } catch (e: any) {
      const m = String(e?.message ?? "");
      const hasStatus = /^API \d+ for /.test(m);
      const t = hasStatus ? `Failed to load bank list (${m.match(/API (\d+)/)?.[1]})` : m;
      setMsg({ text: t, ok: false });
    }
  }, [client, unit]);

  useEffect(() => { load(); }, [load]);

  const update = useCallback(async (r: Row, i: number) => {
    if (!window.confirm("Are you Sure You Want to Update This Record")) return;
    const v = vals[i] ?? "";
    if (!v) { window.alert("Please Enter Bank Approve ....!!!"); return; }
    try {
      const resp = await apiGet(`${BASE}/bank-update/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emp_code: r.EMP_CODE, bank_approve: v }) });
      window.alert("Record Updated Successfully... !!!");
      setMsg({ text: "Record Updated Successfully... !!!", ok: true });
      load();
    } catch (e: any) {
      const t = String(e?.message || "Update failed");
      window.alert(t);
      setMsg({ text: t, ok: false });
    }
  }, [vals, load]);

  const cols = ["Sr No.", "client_code", "STATE NAME", "Unit Name", "EMP_CODE", "EMPLOYEE NAME", "bank approve", "No of days Change"];
  const renderCell = useCallback((r: Row, c: string, i: number) => {
    if (c === "Sr No.") return i + 1;
    if (c === "bank approve") return (<Txt value={vals[i] ?? ""} onChange={(v) => setVals((p) => ({ ...p, [i]: v }))} style={{ minWidth: 90 }} />);
    if (c === "No of days Change") return (<Btn onClick={() => update(r, i)} style={{ width: "fit-content", whiteSpace: "nowrap" }}>Update</Btn>);
    const m: Record<string, string> = { "client_code": "client_code", "STATE NAME": "EMP_PERM_STATE", "Unit Name": "UNIT_NAME", "EMP_CODE": "EMP_CODE", "EMPLOYEE NAME": "emp_name" };
    return val(r, m[c] ?? c);
  }, [vals, update]);

  const handleClientChange = useCallback((v: string) => { setClient(v); setState(SEL); setUnit("ALL"); }, []);
  const handleStateChange = useCallback((v: string) => { setState(v); setUnit("ALL"); }, []);

  return (
    <div>
      <Msg text={msg.text} ok={msg.ok} />
      <DropBanner errs={[clientErr, stateErr, branchErr]} />
      <div className="row" style={{ marginBottom: 10 }}>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Client Name :</Lab><Sel value={client} onChange={handleClientChange} opts={clients} /></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10 }}><Lab req>State Name:</Lab><Sel value={state} onChange={handleStateChange} opts={states} /></div>
        <div className="col-sm-2 col-xs-12 text-left" style={{ marginBottom: 10 }}><b>Branch Name : </b><Sel value={unit} onChange={setUnit} opts={branches} /></div>
      </div>
      <br />
      <Grid id="gv_bank_approve" cols={cols} rows={rows} renderCell={renderCell} />
    </div>
  );
});

export default TabBank;