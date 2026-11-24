"use client";

import React, { useState, useCallback, memo } from "react";
import { useClients, useStates, useBranches } from "./hooks";
import { Msg, Lab, Sel, Txt, Btn, DropBanner, val, rowId, DatePick } from "./ui";
import { apiGet } from "@/lib/api/client";

const BASE = "/api/masters/it-master";
const SEL = "Select";
type Row = Record<string, any>;

function errText(r: Response, fallback: string) {
  return r.json().catch(() => ({})).then((e: any) => e?.detail || e?.non_field_errors?.[0] || (Array.isArray(e) ? e[0] : fallback));
}

const TabStrength = memo(function TabStrength() {
  const { opts: clients, err: clientErr, refresh: refreshClients } = useClients();
  const [f, setF] = useState({ date: "", person: "", client: SEL, state: SEL, branch: SEL, count: "", reason: "", updated: "" });
  const { opts: states, err: stateErr, refresh: refreshStates } = useStates(f.client);
  const { opts: branches, err: branchErr, refresh: refreshBranches } = useBranches(f.client, f.state);
  const [msg, setMsg] = useState({ text: "", ok: true });

  const set = useCallback((k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v })), []);
  const branchName = branches.find((b) => b.v === f.branch)?.t ?? "";

  const valid = useCallback((excelOnly: boolean) => {
    if (!f.date) { window.alert("Please Select Date.....!"); return false; }
    if (excelOnly) return true;
    if (!f.person) { window.alert("Please Enter Person Name who is requested for Increase Count....!"); return false; }
    if (f.client === SEL) { window.alert("Please Select Client"); return false; }
    if (f.state === SEL) { window.alert("Please Select State"); return false; }
    if (f.branch === SEL) { window.alert("Please Select Branch"); return false; }
    if (!f.count) { window.alert("Please Enter Count Number..... "); return false; }
    if (!f.reason) { window.alert("Please Enter Reason ..... "); return false; }
    if (!f.updated) { window.alert("Please Enter Updated Person Name...... "); return false; }
    return true;
  }, [f]);

  const save = useCallback(async () => {
    if (!valid(false)) return;
    try {
      const resp = await apiGet(`${BASE}/strength-save/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        date: f.date, person_name: f.person, client_name: clients.find((c) => c.v === f.client)?.t ?? f.client,
        state_name: f.state, unit_code: f.branch, unit_name: branchName, count: f.count, reason: f.reason, updated_by: f.updated,
      }) });
      window.alert("Record Save successfully!!");
      setMsg({ text: "Record Save successfully!!", ok: true });
      setF({ date: "", person: "", client: SEL, state: SEL, branch: SEL, count: "", reason: "", updated: "" });
    } catch (e: any) {
      const t = String(e?.message || "Save failed");
      window.alert(t);
      setMsg({ text: t, ok: false });
    }
  }, [f, clients, branchName, valid]);

  const excel = useCallback(async () => {
    if (!valid(true)) return;
    try {
      const data = await apiGet<{ results: Row[] }>(`${BASE}/strength-export/?date=${encodeURIComponent(f.date)}`);
      const list = (data?.results ?? []) as Row[];
      if (list.length === 0) { const t = "No Matching Records Found."; window.alert(t); setMsg({ text: t, ok: false }); return; }
      // Legacy btn_get_excel_count_Click / MyTemplate: yellow title row, then SR NO., CLIENT NAME, STATE NAME,
      // BRANCH NAME, COUNT, REASON, UPDATE BY, UPDATE DATE (no comp_code / unit_code columns).
      const esc = (v: any) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const heads = ["SR NO.", "CLIENT NAME", "STATE NAME", "BRANCH NAME", "COUNT", "REASON", "UPDATE BY", "UPDATE DATE"];
      const keys = ["client_name", "state_name", "unit_name", "count", "reason", "updated_by", "updated_date"];
      const html = `<table border=1><tr><th bgcolor=yellow colspan=8>Count Increase Excel </th></tr>` +
        `<tr>${heads.map((h) => `<th>${h}</th>`).join("")}</tr>` +
        list.map((r, k) => `<tr><td>${k + 1}</td>${keys.map((c) => `<td>${esc(val(r, c))}</td>`).join("")}</tr>`).join("") + `</table>`;
      const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = "CountIncrease.xls";
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e: any) {
      const t = String(e?.message || "Export failed");
      window.alert(t);
      setMsg({ text: t, ok: false });
    }
  }, [f, valid]);

  const handleClientChange = useCallback((v: string) => { set("client", v); set("state", SEL); set("branch", SEL); }, [set]);
  const handleStateChange = useCallback((v: string) => { set("state", v); set("branch", SEL); }, [set]);

  return (
    <div>
      <Msg text={msg.text} ok={msg.ok} />
      <DropBanner errs={[clientErr, stateErr, branchErr]} />
      <div className="row" style={{ marginBottom: 10 }}>
        <div className="col-md-2 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Select Date:</Lab><DatePick value={f.date} onChange={(v) => set("date", v)} /></div>
        <div className="col-md-2 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Who Requested For Strength Count Increase (Person Name)?</Lab><Txt value={f.person} onChange={(v) => set("person", v)} /><br /></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Client Name:</Lab><Sel value={f.client} onChange={handleClientChange} opts={clients} /></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10 }}><Lab req>State Name:</Lab><Sel value={f.state} onChange={handleStateChange} opts={states} /></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Branch Name :</Lab><Sel value={f.branch} onChange={(v) => set("branch", v)} opts={branches} /></div>
      </div>
      <div className="row" style={{ marginBottom: 10 }}>
        <div className="col-md-2 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Count(Number)</Lab><Txt value={f.count} onChange={(v) => set("count", v)} /><br /></div>
        <div className="col-md-2 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Reason</Lab><Txt value={f.reason} onChange={(v) => set("reason", v)} /><br /></div>
        <div className="col-md-2 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Who Update Record ?</Lab><Txt value={f.updated} onChange={(v) => set("updated", v)} /><br /></div>
      </div>
      <div className="row text-center" style={{ marginTop: 15 }}>
        <div className="col-xs-6 col-sm-3"><Btn onClick={save} style={{ width: "100%", minWidth: 140 }}>Save</Btn></div>
        <div className="col-xs-6 col-sm-3"><Btn onClick={excel} style={{ width: "100%", minWidth: 140 }}>Get Excel</Btn></div>
      </div>
      <br /><br />
    </div>
  );
});

export default TabStrength;