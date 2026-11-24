"use client";

import React, { useState, useCallback, memo } from "react";
import Grid from "./Grid";
import { Msg, Lab, Txt, Btn, val, rowId } from "./ui";
import { apiGet } from "@/lib/api/client";

const BASE = "/api/masters/it-master";
type Row = Record<string, any>;

const TabSojso = memo(function TabSojso() {
  const [emp, setEmp] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [days, setDays] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState({ text: "", ok: true });

  const search = useCallback(async () => {
    if (!emp) { window.alert("Please Enter EMPLOYEE CODE"); return; }
    try {
      const data = await apiGet<{ results: Row[] }>(`${BASE}/sojso/?emp_code=${encodeURIComponent(emp)}`);
      const list = (data?.results ?? []) as Row[];
      setRows(list);
      setDays(Object.fromEntries(list.map((r, i) => [i, String(val(r, "DESIGNATION_CODE") ?? "")])));
    } catch (e: any) {
      const m = String(e?.message ?? "");
      const hasStatus = /^API \d+ for /.test(m);
      const t = hasStatus ? `Failed to load SO/JSO (${m.match(/API (\d+)/)?.[1]})` : m;
      setMsg({ text: t, ok: false });
    }
  }, [emp]);

  const update = useCallback(async (r: Row, i: number) => {
    if (!window.confirm("Are you Sure You Want to Update This Record")) return;
    const v = days[i] ?? "";
    if (!v) { window.alert("Please Enter count Date....!!!"); return; }
    try {
      await apiGet(`${BASE}/sojso-update/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emp_code: r.EMP_CODE, days: v }) });
      window.alert("Record Updated Successfully... !!!");
      setMsg({ text: "Record Updated Successfully... !!!", ok: true });
      search();
    } catch (e: any) {
      const msgText = e?.message ?? "Update failed";
      window.alert(msgText);
      setMsg({ text: msgText, ok: false });
    }
  }, [days, search]);

  const cols = ["Sr No.", "Client Code", "STATE NAME", "Employee Code", "Employee NAme", "Branch Name", "Days", "No of days Change"];
  const renderCell = useCallback((r: Row, c: string, i: number) => {
    if (c === "Sr No.") return i + 1;
    if (c === "Days") return (<Txt value={days[i] ?? ""} onChange={(v) => setDays((p) => ({ ...p, [i]: v }))} style={{ width: "80px" }} />);
    if (c === "No of days Change") return (<Btn onClick={() => update(r, i)} style={{ width: "fit-content" }}>Update</Btn>);
    const m: Record<string, string> = { "Client Code": "client_code", "STATE NAME": "EMP_PERM_STATE", "Employee Code": "EMP_CODE", "Employee NAme": "EMP_NAME", "Branch Name": "unit_name" };
    return val(r, m[c] ?? c);
  }, [days, update]);

  return (
    <div>
      <Msg text={msg.text} ok={msg.ok} />
      <div className="row" style={{ marginBottom: 10 }}>
        <div className="col-md-2 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Employee Code :</Lab><Txt value={emp} onChange={setEmp} /></div>
        <div className="col-sm-2 col-xs-12" style={{ marginBottom: 10, marginTop: 25 }}><Btn onClick={search} style={{ width: "100%", minWidth: 100 }}>Search</Btn></div>
      </div>
      <Grid id="GV_SOJSODETAILS" cols={cols} rows={rows} renderCell={renderCell} />
    </div>
  );
});

export default TabSojso;