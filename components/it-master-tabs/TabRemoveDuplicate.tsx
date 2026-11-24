"use client";

import React, { useState, useCallback, memo } from "react";
import Grid from "./Grid";
import { Msg, Lab, Txt, Btn, val, rowId, MonthPick } from "./ui";
import { apiGet } from "@/lib/api/client";

const BASE = "/api/masters/it-master";
type Row = Record<string, any>;

function errText(r: Response, fallback: string) {
  return r.json().catch(() => ({})).then((e: any) => e?.detail || e?.non_field_errors?.[0] || (Array.isArray(e) ? e[0] : fallback));
}

const TabRemoveDuplicate = memo(function TabRemoveDuplicate() {
  const [month, setMonth] = useState("");
  const [unit, setUnit] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [msg, setMsg] = useState({ text: "", ok: true });

  const check = useCallback(async () => {
    if (!month) { window.alert("Please Enter Date "); return; }
    if (!unit) { window.alert("Please Enter Branch CODE"); return; }
    try {
      const data = await apiGet<{ results: Row[] }>(`${BASE}/muster/?month=${encodeURIComponent(month)}&unit_code=${encodeURIComponent(unit)}`);
      setRows(data?.results ?? []);
    } catch (e: any) {
      const m = String(e?.message ?? "");
      const hasStatus = /^API \d+ for /.test(m);
      const t = hasStatus ? `Failed to load muster (${m.match(/API (\d+)/)?.[1]})` : m;
      setMsg({ text: t, ok: false });
    }
  }, [month, unit]);

  const del = useCallback(async (r: Row) => {
    if (!window.confirm("Are you sure you want to delete this Record?")) return;
    try {
      await apiGet(`${BASE}/muster-delete/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month, unit_code: unit, emp_code: r.emp_code, flag: r.flag }) });
      window.alert("Record Deleted Successfully... !!!");
      setMsg({ text: "Record Deleted Successfully... !!!", ok: true });
      check();
    } catch (e: any) {
      const msgText = e?.message ?? "Delete failed";
      window.alert(msgText);
      setMsg({ text: msgText, ok: false });
    }
  }, [month, unit, check]);

  const cols = ["Delete", "Sr No.", "Employee Code", "Unit Code", "Flag", "Invoice Flag", "STATUS"];
  const renderCell = useCallback((r: Row, c: string, i: number) => {
    if (c === "Delete") return r.status === "Billing done" ? null : (
      <button type="button" onClick={() => del(r)} style={{ background: "none", border: "none", cursor: "pointer" }} title="Delete">
        <img alt="" height={15} src="/Images/delete_icon.png" width={15} />
      </button>);
    if (c === "Sr No.") return i + 1;
    const m: Record<string, string> = { "Employee Code": "emp_code", "Unit Code": "unit_code", "Flag": "flag", "Invoice Flag": "invoice_flag", "STATUS": "status" };
    return val(r, m[c] ?? c);
  }, [del]);

  return (
    <div>
      <Msg text={msg.text} ok={msg.ok} />
      <div className="row" style={{ marginBottom: 10 }}>
        <div className="col-md-2 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Select Month :</Lab><MonthPick value={month} onChange={setMonth} /></div>
        <div className="col-md-2 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Branch Code :</Lab><Txt value={unit} onChange={setUnit} /></div>
        <div className="col-sm-2 col-xs-12" style={{ marginBottom: 10, marginTop: 25 }}><Btn onClick={check} style={{ width: "100%", minWidth: 100 }}>Check</Btn></div>
      </div>
      <Grid id="gv_attendance" cols={cols} rows={rows} renderCell={renderCell} />
    </div>
  );
});

export default TabRemoveDuplicate;