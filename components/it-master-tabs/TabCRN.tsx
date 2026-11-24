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

const TabCRN = memo(function TabCRN() {
  const [crn, setCrn] = useState("");
  const [maxCrn, setMaxCrn] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [news, setNews] = useState<Record<number, string>>({});
  const [msg, setMsg] = useState({ text: "", ok: true });

  const showGrid = useCallback(async () => {
    if (!crn) { window.alert("Please Enter CRN Number...... "); return; }
    try {
      const data = await apiGet<{ results: Row[] }>(`${BASE}/crn-search/?crn=${encodeURIComponent(crn)}`);
      const list = (data?.results ?? []) as Row[];
      setRows(list); setSel({}); setNews({});
    } catch (e: any) {
      const m = String(e?.message ?? "");
      const hasStatus = /^API \d+ for /.test(m);
      const t = hasStatus ? `Failed to load CRN search (${m.match(/API (\d+)/)?.[1]})` : m;
      setMsg({ text: t, ok: false });
    }
  }, [crn]);

  const maxNo = useCallback(async () => {
    try {
      const data = await apiGet<{ max_crn: string }>(`${BASE}/crn-max/`);
      const mx = String((data as any)?.max_crn ?? "");
      setMaxCrn(mx);
      let n = parseInt(mx || "0", 10) || 0;
      setNews(Object.fromEntries(rows.map((_, i) => [i, String(n++)])));
    } catch (e: any) {
      const m = String(e?.message ?? "");
      const hasStatus = /^API \d+ for /.test(m);
      const t = hasStatus ? `Failed to load max CRN (${m.match(/API (\d+)/)?.[1]})` : m;
      setMsg({ text: t, ok: false });
    }
  }, [rows]);

  const update = useCallback(async () => {
    const items = rows.map((r, i) => ({ r, i })).filter(({ i }) => sel[String(i)]);
    if (items.length === 0) { window.alert("Please Select Atleast One Record........"); return; }
    try {
      await apiGet(`${BASE}/crn-update/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: items.map(({ r, i }) => ({ old: r.pay_pro_no, new: news[i] ?? "" })) }) });
      window.alert("Update CRN Number Successfully!!");
      setMsg({ text: "Update CRN Number Successfully!!", ok: true });
      showGrid();
    } catch (e: any) {
      const msgText = e?.message ?? "Update failed";
      window.alert(msgText);
      setMsg({ text: msgText, ok: false });
    }
  }, [rows, sel, news, showGrid]);

  const cols = ["Sr. No.", "ID", "COMP CODE", "EMP CODE", "MONTH", "YEAR", "TYPE", "STATUS", "OLD PAY PRO NUMBER", "NEW PAY PRO NUMBER", "BANK", "EMP CODE ", "START DATE", "END DATE", "MANUAL PAYMENT ID", "PAYMENT TYPE"];
  const renderCell = useCallback((r: Row, c: string, i: number) => {
    if (c === "Sr. No.") return i + 1;
    if (c === "NEW PAY PRO NUMBER") return (<Txt value={news[i] ?? ""} onChange={(v) => setNews((p) => ({ ...p, [i]: v }))} style={{ minWidth: 110 }} />);
    const m: Record<string, string> = { "ID": "Id", "COMP CODE": "comp_code", "EMP CODE": "emp_code", "MONTH": "month", "YEAR": "year", "TYPE": "type", "STATUS": "status", "OLD PAY PRO NUMBER": "pay_pro_no", "BANK": "bank", "START DATE": "start_date", "END DATE": "end_date", "MANUAL PAYMENT ID": "manual_payment_id", "PAYMENT TYPE": "payment_type" };
    return val(r, m[c.trim()] ?? c);
  }, [news]);

  return (
    <div>
      <Msg text={msg.text} ok={msg.ok} />
      <div className="row" style={{ marginBottom: 10 }}>
        <div className="col-md-2 col-xs-12" style={{ marginBottom: 10 }}><Lab req>CRN NUMBER :</Lab><Txt value={crn} onChange={setCrn} /><br /></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10, marginTop: 25 }}><Btn onClick={showGrid}>SHOW</Btn></div>
        <div className="col-md-2 col-xs-12" style={{ marginBottom: 10 }}><Lab req>MAX NUMBER :</Lab><Txt value={maxCrn} readOnly /><br /></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10, marginTop: 25 }}><Btn onClick={maxNo}>MAX CRN</Btn></div>
      </div>
      <br /><br />
      <div className="container-fluid" style={{ background: "#f3f1fe", borderRadius: 10, border: "1px solid white", marginLeft: 10, marginRight: 10 }}>
        <Grid id="gvd_crn_number" cols={cols} rows={rows} checkKey selected={sel}
          onToggle={(k, v) => setSel((p) => ({ ...p, [k]: v }))}
          onToggleAll={(v) => { const n: Record<string, boolean> = {}; rows.forEach((_, i) => { n[String(i)] = v; }); setSel(n); }}
          renderCell={renderCell} />
        <div className="row text-center" style={{ marginTop: 15 }}>
          <div className="col-xs-6 col-sm-3"><Btn onClick={update} style={{ width: "100%", minWidth: 160 }}>UPDATE CRN NO</Btn></div>
        </div>
      </div>
    </div>
  );
});

export default TabCRN;