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

const TabEmpCount = memo(function TabEmpCount() {
  const { opts: clients, err: clientErr, refresh: refreshClients } = useClients();
  const [client, setClient] = useState(SEL);
  const [state, setState] = useState(SEL);
  const [unit, setUnit] = useState("ALL");
  const { opts: states, err: stateErr, refresh: refreshStates } = useStates(client);
  const { opts: branches, err: branchErr, refresh: refreshBranches } = useBranches(client, state);
  const [total, setTotal] = useState("");
  const [srows, setSrows] = useState<Row[]>([]);
  const [urows, setUrows] = useState<Row[]>([]);
  const [svals, setSvals] = useState<Record<number, string>>({});
  const [uvals, setUvals] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState({ text: "", ok: true });

  useEffect(() => {
    (async () => {
      if (!client || client === SEL) { setTotal(""); return; }
      try {
        const data = await apiGet<{ total_employee: string }>(`${BASE}/total-employee/?client_code=${encodeURIComponent(client)}`);
        setTotal(String((data as any)?.total_employee ?? ""));
      } catch (e: any) {
        const m = String(e?.message ?? "");
        const hasStatus = /^API \d+ for /.test(m);
        const t = hasStatus ? `Failed to load total employee (${m.match(/API (\d+)/)?.[1]})` : m;
        setMsg({ text: t, ok: false });
      }
    })();
  }, [client]);

  useEffect(() => {
    (async () => {
      if (!client || client === SEL || !state || state === SEL) { setSrows([]); return; }
      try {
        const data = await apiGet<{ results: Row[] }>(`${BASE}/state-counts/?client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}`);
        const list = (data?.results ?? []) as Row[];
        setSrows(list); setSvals(Object.fromEntries(list.map((r, i) => [i, String(val(r, "COUNT") ?? "")])));
      } catch (e: any) {
        const m = String(e?.message ?? "");
        const hasStatus = /^API \d+ for /.test(m);
        const t = hasStatus ? `Failed to load state counts (${m.match(/API (\d+)/)?.[1]})` : m;
        setMsg({ text: t, ok: false });
      }
    })();
  }, [client, state]);

  useEffect(() => {
    (async () => {
      if (!client || client === SEL) { setUrows([]); return; }
      try {
        const data = await apiGet<{ results: Row[] }>(`${BASE}/unit-counts/?client_code=${encodeURIComponent(client)}`);
        const list = (data?.results ?? []) as Row[];
        setUrows(list); setUvals(Object.fromEntries(list.map((r, i) => [i, String(val(r, "Emp_count") ?? "")])));
      } catch (e: any) {
        const m = String(e?.message ?? "");
        const hasStatus = /^API \d+ for /.test(m);
        const t = hasStatus ? `Failed to load unit counts (${m.match(/API (\d+)/)?.[1]})` : m;
        setMsg({ text: t, ok: false });
      }
    })();
  }, [client]);

  const updTotal = useCallback(async () => {
    if (client === SEL) { window.alert("Please Select Client"); return; }
    if (state === SEL) { window.alert("Please Select State"); return; }
    if (unit === SEL) { window.alert("Please Select Branch"); return; }
    if (!total) { window.alert("Please Enter Total Number Employee..... "); return; }
    try {
      const resp = await apiGet(`${BASE}/total-employee-update/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ client_code: client, state, unit_code: unit, total_employee: total }) });
      window.alert(" Record  Added Successfully... !!!");
      setMsg({ text: " Record  Added Successfully... !!!", ok: true });
    } catch (e: any) {
      const t = String(e?.message || "Update failed");
      window.alert(t);
      setMsg({ text: t, ok: false });
    }
  }, [client, state, unit, total]);

  const updState = useCallback(async (r: Row, i: number) => {
    try {
      const resp = await apiGet(`${BASE}/state-count-update/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: val(r, "Id"), client_code: client, count: svals[i] ?? "", old_count: val(r, "COUNT"), total_employee: total }) });
      window.alert("Record Updated Successfully... !!!");
      setMsg({ text: "Record Updated Successfully... !!!", ok: true });
    } catch (e: any) {
      const t = String(e?.message || "Update failed");
      window.alert(t);
      setMsg({ text: t, ok: false });
    }
  }, [client, svals, total]);

  const updUnit = useCallback(async (r: Row, i: number) => {
    try {
      const resp = await apiGet(`${BASE}/unit-count-update/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        id: val(r, "Id"), client_code: client, state, unit_code: unit === "ALL" ? String(val(r, "UNIT_CODE")) : unit,
        count: uvals[i] ?? "", old_count: val(r, "Emp_count"),
      }) });
      window.alert("Record Updated Successfully... !!!");
      setMsg({ text: "Record Updated Successfully... !!!", ok: true });
    } catch (e: any) {
      const t = String(e?.message || "Update failed");
      window.alert(t);
      setMsg({ text: t, ok: false });
    }
  }, [client, state, unit, uvals]);

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
      <br /><br /><br />
      <div>
        <div className="col-md-2 col-xs-12" style={{ marginBottom: 10 }}><Lab req>TOTAL EMPLOYEE :</Lab><Txt value={total} onChange={setTotal} /></div>
        <br /><Btn onClick={updTotal} style={{ width: "fit-content", minWidth: 120 }}>Update</Btn>
      </div>
      <br /><br />
      <Grid id="gv_statelist" cols={["ID", "Sr No.", "State", "Designation", "Count", "Count ", "LOCATION", "Category", "No of days Change"]} rows={srows} hiddenIdCol
        renderCell={(r, c, i) => {
          if (c === "Sr No.") return i + 1;
          if (c === "Count ") return (<Txt value={svals[i] ?? ""} onChange={(v) => setSvals((p) => ({ ...p, [i]: v }))} style={{ minWidth: 80 }} />);
          if (c === "No of days Change") return (<Btn onClick={() => updState(r, i)} style={{ width: "fit-content", whiteSpace: "nowrap" }}>Update</Btn>);
          const m: Record<string, string> = { "ID": "Id", "State": "STATE", "Designation": "DESIGNATION", "Count": "COUNT", "LOCATION": "location", "Category": "category" };
          return val(r, m[c.trim()] ?? c);
        }} />
      <Grid id="UnitGridView" cols={["ID", "No.", "Client Name", "State Name", "Branch Name", "Branch Code", "Landmark", "Street/Road/Lane", "Branch City", "Employee Count", "Total Employee Count", "Branch Status", "Update"]} rows={urows} hiddenIdCol
        renderCell={(r, c, i) => {
          if (c === "No.") return i + 1;
          if (c === "Total Employee Count") return (<Txt value={uvals[i] ?? ""} onChange={(v) => setUvals((p) => ({ ...p, [i]: v }))} style={{ minWidth: 80 }} />);
          if (c === "Update") return (<Btn onClick={() => updUnit(r, i)} style={{ width: "fit-content", whiteSpace: "nowrap" }}>Update</Btn>);
          const m: Record<string, string> = { "Client Name": "CLIENT_NAME", "State Name": "STATE_NAME", "Branch Name": "UNIT_NAME", "Branch Code": "UNIT_CODE", "Landmark": "UNIT_ADD1", "Street/Road/Lane": "UNIT_ADD2", "Branch City": "UNIT_CITY", "Employee Count": "Emp_count", "Branch Status": "branch_status" };
          return val(r, m[c] ?? c);
        }} />
    </div>
  );
});

export default TabEmpCount;