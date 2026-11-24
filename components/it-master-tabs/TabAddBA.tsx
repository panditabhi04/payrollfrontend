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

const TabAddBA = memo(function TabAddBA() {
  const [emp, setEmp] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [news, setNews] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState({ text: "", ok: true });

  const showGrid = useCallback(async () => {
    try {
      const data = await apiGet<{ results: Row[] }>(`${BASE}/ba-search/?emp_code=${encodeURIComponent(emp)}`);
      const list = (data?.results ?? []) as Row[];
      setRows(list); setNews(Object.fromEntries(list.map((r, i) => [i, String(val(r, "EMP_CODE") ?? "")])));
    } catch (e: any) {
      const m = String(e?.message ?? "");
      const hasStatus = /^API \d+ for /.test(m);
      const t = hasStatus ? `Failed to load BA search (${m.match(/API (\d+)/)?.[1]})` : m;
      setMsg({ text: t, ok: false });
    }
  }, [emp]);

  const update = useCallback(async (r: Row, i: number) => {
    const v = news[i] ?? "";
    if (!v) { window.alert("Please Enter EMP_CODE....!!!"); return; }
    try {
      const resp = await apiGet(`${BASE}/ba-update/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ old_emp_code: emp, new_emp_code: v }) });
      window.alert("Record Updated Successfully... !!!");
      setMsg({ text: "Record Updated Successfully... !!!", ok: true });
      showGrid();
    } catch (e: any) {
      const t = String(e?.message || "Update failed");
      window.alert(t);
      setMsg({ text: t, ok: false });
    }
  }, [emp, news, showGrid]);

  const cols = ["Sr No.", "Employee Name", "EMP CODE", "NEW_EMP_CODE", "Client Name", "UNIT CODE", "UNIT NAME", "Joining Date", "UPDATE"];
  const renderCell = useCallback((r: Row, c: string, i: number) => {
    if (c === "Sr No.") return i + 1;
    if (c === "NEW_EMP_CODE") return (<b><Txt value={news[i] ?? ""} onChange={(v) => setNews((p) => ({ ...p, [i]: v }))} /></b>);
    if (c === "UPDATE") return (<Btn onClick={() => update(r, i)} style={{ width: "fit-content", whiteSpace: "nowrap" }}>Update</Btn>);
    const m: Record<string, string> = { "Employee Name": "EMP_NAME", "EMP CODE": "EMP_CODE", "Client Name": "CLIENT_NAME", "UNIT CODE": "UNIT_CODE", "UNIT NAME": "UNIT_NAME", "Joining Date": "JOINING_DATE" };
    return val(r, m[c] ?? c);
  }, [news, update]);

  return (
    <div>
      <Msg text={msg.text} ok={msg.ok} />
      <div className="row" style={{ marginBottom: 10 }}>
        <div className="col-md-2 col-xs-12" style={{ marginBottom: 10 }}><Lab req>emp_code:</Lab><Txt value={emp} onChange={setEmp} /></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10, marginTop: 25 }}><Btn onClick={showGrid}>SHOW</Btn></div>
      </div>
      <br />
      <Grid id="gdv_add_ba" cols={cols} rows={rows} renderCell={renderCell} />
    </div>
  );
});

export default TabAddBA;