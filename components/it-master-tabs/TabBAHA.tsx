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

const TabBAHA = memo(function TabBAHA() {
  const [ha, setHa] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [ed, setEd] = useState<Record<number, Row>>({});
  const [msg, setMsg] = useState({ text: "", ok: true });

  const showGrid = useCallback(async () => {
    if (!ha.trim()) { window.alert("Please Enter HA-Code "); return; }
    try {
      const data = await apiGet<{ results: Row[] }>(`${BASE}/baha-search/?ha_codes=${encodeURIComponent(ha)}`);
      const list = (data?.results ?? []) as Row[];
      setRows(list); setEd({});
    } catch (e: any) {
      const m = String(e?.message ?? "");
      const hasStatus = /^API \d+ for /.test(m);
      const t = hasStatus ? `Failed to load BA-HA search (${m.match(/API (\d+)/)?.[1]})` : m;
      setMsg({ text: t, ok: false });
    }
  }, [ha]);

  const update = useCallback(async (r: Row, i: number) => {
    if (!ha.trim()) { window.alert("Please Enter HA-Code "); return; }
    const v = e2(i, r);
    try {
      const resp = await apiGet(`${BASE}/baha-update/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ emp_code: r.emp_code, ...v }) });
      window.alert("Updated Successfully!!");
      setMsg({ text: "Updated Successfully!!", ok: true });
      showGrid();
    } catch (e: any) {
      const t = String(e?.message || "Update failed");
      window.alert(t);
      setMsg({ text: t, ok: false });
    }
  }, [ha, showGrid]);

  const e2 = useCallback((i: number, r: Row) => ed[i] ?? { so_jso_code: val(r, "so_jso_code"), so_jso_name: val(r, "so_jso_name"), rm_code: val(r, "rm_code"), rm_name: val(r, "rm_name"), zone_name: val(r, "zone_name") }, [ed]);

  const cols = ["Sr. No.", "emp_code", "emp_name", "so_jso_code", "so_jso_code ", "so_jso_name", "so_jso_name ", "rm_code", "rm_code ", "rm_name", "rm_name ", "cluster_name", "cluster_code", "zone_name", "zone_name ", "UPDATE"];
  const renderCell = useCallback((r: Row, c: string, i: number) => {
    if (c === "Sr. No.") return i + 1;
    if (c === "UPDATE") return (<Btn onClick={() => update(r, i)} style={{ width: "fit-content", whiteSpace: "nowrap" }}>UPDATE</Btn>);
    const key = c.trim();
    const v = e2(i, r);
    const set = (k: string, val: string) => setEd((p) => ({ ...p, [i]: { ...v, [k]: val } }));
    if (c !== key && ["so_jso_code", "so_jso_name", "rm_code", "rm_name", "zone_name"].includes(key)) {
      return (<Txt value={String((v as Row)[key] ?? "")} onChange={(x) => set(key, x)} />);
    }
    return val(r, key);
  }, [e2, update]);

  return (
    <div>
      <Msg text={msg.text} ok={msg.ok} />
      <div className="row" style={{ marginBottom: 10 }}>
        <div className="col-md-2 col-xs-12" style={{ marginBottom: 10 }}><Lab req>HA Code :</Lab>
          <textarea className="form-control" value={ha} onChange={(e) => setHa(e.target.value)} rows={3} /></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10, marginTop: 25 }}><Btn onClick={showGrid}>SHOW</Btn></div>
      </div>
      <div className="container-fluid"><div className="grid-view">
        <Grid id="gv_ba_map" cols={cols} rows={rows} renderCell={renderCell} />
      </div></div>
    </div>
  );
});

export default TabBAHA;