"use client";

import React, { useState, useCallback, memo } from "react";
import Grid from "./Grid";
import { Msg, Lab, Txt, Btn, val, rowId, DatePick } from "./ui";
import { apiGet } from "@/lib/api/client";

const BASE = "/api/masters/it-master";
type Row = Record<string, any>;

const TabEmpDates = memo(function TabEmpDates() {
  const [emp, setEmp] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [edits, setEdits] = useState<Record<number, { join: string; left: string; reason: string }>>({});
  const [msg, setMsg] = useState({ text: "", ok: true });

  const check = useCallback(async () => {
    if (!emp) { window.alert("Please Enter EMPLOYEE CODE"); return; }
    try {
      const data = await apiGet<{ results: Row[] }>(`${BASE}/employee/?emp_code=${encodeURIComponent(emp)}`);
      setRows(data?.results ?? []);
      setEdits({});
    } catch (e: any) {
      const m = String(e?.message ?? "");
      const hasStatus = /^API \d+ for /.test(m);
      const t = hasStatus ? `Failed to load employee (${m.match(/API (\d+)/)?.[1]})` : m;
      setMsg({ text: t, ok: false });
    }
  }, [emp]);

  const ed = useCallback((i: number, r: Row) => edits[i] ?? { join: String(val(r, "Join_Date") ?? ""), left: String(val(r, "left_date") ?? ""), reason: String(val(r, "LEFT_REASON") ?? "") }, [edits]);

  const upd = useCallback(async (kind: "join" | "left" | "remove", r: Row, i: number) => {
    const e = ed(i, r);
    let url = "", body: any = {};
    if (kind === "join") { if (!e.join) { window.alert("Please Enter Join Date....!!!"); return; } url = `${BASE}/employee-joining/`; body = { emp_name: r.EMP_NAME, join_date: e.join }; }
    else if (kind === "left") { if (!e.left || !e.reason) { window.alert("Please Enter Left Date and left reason....!!!"); return; } url = `${BASE}/employee-left/`; body = { emp_name: r.EMP_NAME, left_date: e.left, left_reason: e.reason }; }
    else { if (!e.left || !e.reason) { window.alert("Please Enter Left Date and Left Reason....!!!"); return; } url = `${BASE}/employee-left-remove/`; body = { emp_code: r.EMP_CODE, left_date: e.left, left_reason: e.reason }; }
    try {
      const d = await apiGet<{ message?: string }>(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      window.alert(d?.message);
      setMsg({ text: d?.message ?? "", ok: true });
      check();
    } catch (e: any) {
      const msgText = e?.message ?? "Update failed";
      window.alert(msgText);
      setMsg({ text: msgText, ok: false });
    }
  }, [ed, check]);

  const cols = ["Sr No.", "Employee Name", "Employee Code", "Client Name", "State Name", "Branch Name", "Employee Type", "Joining Date", "LEFT Date"];
  const renderCell = useCallback((r: Row, c: string, i: number) => {
    if (c === "Sr No.") return i + 1;
    const m: Record<string, string> = { "Employee Name": "EMP_NAME", "Employee Code": "EMP_CODE", "Client Name": "client_name", "State Name": "EMP_PERM_STATE", "Branch Name": "UNIT_NAME", "Employee Type": "Employee_type" };
    if (m[c]) return val(r, m[c]);
    const e = ed(i, r);
    const set = (k: "join" | "left" | "reason", v: string) => setEdits((p) => ({ ...p, [i]: { ...e, [k]: v } }));
    if (c === "Joining Date") return (<span style={{ display: "flex", flexDirection: "column", gap: 6 }}><DatePick value={e.join} onChange={(v) => set("join", v)} /><Btn onClick={() => upd("join", r, i)} style={{ width: "fit-content" }}>Update</Btn></span>);
    return (<span style={{ display: "flex", flexDirection: "column", gap: 6 }}><DatePick value={e.left} onChange={(v) => set("left", v)} /><b>LEFT REASON</b><Txt value={e.reason} onChange={(v) => set("reason", v)} /><Btn onClick={() => upd("left", r, i)} style={{ width: "fit-content" }}>Update</Btn><Btn onClick={() => upd("remove", r, i)} style={{ width: "fit-content" }}>Remove</Btn></span>);
  }, [ed, upd]);

  return (
    <div>
      <Msg text={msg.text} ok={msg.ok} />
      <div className="row" style={{ marginBottom: 10 }}>
        <div className="col-md-2 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Employee Code :</Lab><Txt value={emp} onChange={setEmp} /></div>
        <div className="col-sm-2 col-xs-12" style={{ marginBottom: 10, marginTop: 25 }}><Btn onClick={check} style={{ width: "100%", minWidth: 100 }}>Check</Btn></div>
      </div>
      <Grid id="gv_emp_details" cols={cols} rows={rows} renderCell={renderCell} />
    </div>
  );
});

export default TabEmpDates;