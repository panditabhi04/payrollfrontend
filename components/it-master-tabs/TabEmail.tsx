"use client";

import React, { useState, useCallback, memo } from "react";
import Grid from "./Grid";
import { Msg, Lab, Txt, Btn, val, rowId } from "./ui";
import { apiGet } from "@/lib/api/client";

const BASE = "/api/masters/it-master";
type Row = Record<string, any>;

function errText(r: Response, fallback: string) {
  return r.json().catch(() => ({})).then((e: any) => e?.detail || e?.non_field_errors?.[0] || (Array.isArray(e) ? e[0] : fallback));
}

const TabEmail = memo(function TabEmail() {
  const [emp, setEmp] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [vals, setVals] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState({ text: "", ok: true });

  const check = useCallback(async () => {
    if (!emp) { window.alert("Please Enter EMPLOYEE CODE"); return; }
    try {
      const data = await apiGet<{ results: Row[] }>(`${BASE}/email-search/?emp_code=${encodeURIComponent(emp)}`);
      const list = (data?.results ?? []) as Row[];
      setRows(list);
      setVals(Object.fromEntries(list.map((r, i) => [i, String(val(r, "EMP_EMAIL_ID") ?? "")])));
    } catch (e: any) {
      const m = String(e?.message ?? "");
      const hasStatus = /^API \d+ for /.test(m);
      const t = hasStatus ? `Failed to load email (${m.match(/API (\d+)/)?.[1]})` : m;
      setMsg({ text: t, ok: false });
    }
  }, [emp]);

  const update = useCallback(async (r: Row, i: number) => {
    const v = vals[i] ?? "";
    if (!v) { window.alert("Please Enter Email ....!!!"); return; }
    try {
      const resp = await apiGet(`${BASE}/email-update/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emp_name: r.EMP_NAME, email: v }) });
      window.alert("Record Updated Successfully... !!!");
      setMsg({ text: "Record Updated Successfully... !!!", ok: true });
      check();
    } catch (e: any) {
      const t = String(e?.message || "Update failed");
      window.alert(t);
      setMsg({ text: t, ok: false });
    }
  }, [vals, check]);

  const cols = ["Sr No.", "Employee Name", "Client Name", "State Name", "Branch Name", "Employee Type", "Email Update"];
  const renderCell = useCallback((r: Row, c: string, i: number) => {
    if (c === "Sr No.") return i + 1;
    if (c === "Email Update") return (<span style={{ display: "flex", flexDirection: "column", gap: 6 }}><Txt value={vals[i] ?? ""} onChange={(v) => setVals((p) => ({ ...p, [i]: v }))} style={{ minWidth: 140 }} /><Btn onClick={() => update(r, i)} style={{ width: "fit-content", whiteSpace: "nowrap" }}>Update</Btn></span>);
    const m: Record<string, string> = { "Employee Name": "EMP_NAME", "Client Name": "client_name", "State Name": "EMP_PERM_STATE", "Branch Name": "UNIT_NAME", "Employee Type": "Employee_type" };
    return val(r, m[c] ?? c);
  }, [vals, update]);

  return (
    <div>
      <Msg text={msg.text} ok={msg.ok} />
      <div className="row" style={{ marginBottom: 10 }}>
        <div className="col-md-2 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Employee Code :</Lab><Txt value={emp} onChange={setEmp} /><br /></div>
        <div className="col-sm-2 col-xs-12" style={{ marginBottom: 10, marginTop: 25 }}><Btn onClick={check}>Check</Btn></div>
      </div>
      <Grid id="grd_email_update" cols={cols} rows={rows} renderCell={renderCell} />
    </div>
  );
});

export default TabEmail;