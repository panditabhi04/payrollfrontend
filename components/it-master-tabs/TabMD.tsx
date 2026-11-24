"use client";

import React, { useState, useEffect, useCallback, memo } from "react";
import { useClients, useStates, useBranches } from "./hooks";
import Grid from "./Grid";
import { Msg, Lab, Sel, Txt, Btn, DropBanner, val, rowId, MonthPick } from "./ui";
import { apiGet } from "@/lib/api/client";

const BASE = "/api/masters/it-master";
const SEL = "Select";
type Row = Record<string, any>;

function errText(r: Response, fallback: string) {
  return r.json().catch(() => ({})).then((e: any) => e?.detail || e?.non_field_errors?.[0] || (Array.isArray(e) ? e[0] : fallback));
}

const TabMD = memo(function TabMD() {
  const [month, setMonth] = useState("");
  const [client, setClient] = useState(SEL);
  const [state, setState] = useState(SEL);
  const [branch, setBranch] = useState(SEL);
  const [status, setStatus] = useState("1");
  const { opts: statesRaw, err: stateErr, refresh: refreshStates } = useStates(client === "ALL" ? "" : client);
  const { opts: branchesRaw, refresh: refreshBranches } = useBranches(client === "ALL" ? "" : client, state);
  const states = statesRaw.filter((s) => s.v.toUpperCase() !== SEL.toUpperCase());
  const branches = branchesRaw.filter((b) => b.v !== SEL && b.v !== "ALL");
  const [rows, setRows] = useState<Row[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState({ text: "", ok: true });
  const [clientOpts, setClientOpts] = useState<{ v: string; t: string }[]>([{ v: SEL, t: SEL }, { v: "ALL", t: "ALL" }]);
  const [clientErr10, setClientErr10] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<{ results: Row[] }>(`${BASE}/clients/`);
        setClientErr10("");
        const list = (data?.results ?? []) as Row[];
        setClientOpts([{ v: SEL, t: SEL }, { v: "ALL", t: "ALL" }, ...list.map((c) => ({ v: String(c.client_code), t: String(c.client_name) }))]);
      } catch (e: any) {
        const m = String(e?.message ?? "");
        const s = m.match(/API (\d+)/)?.[1];
        const status = s ? parseInt(s, 10) : 0;
        setClientErr10(`Client dropdown endpoint not found (${status}) — please restart the backend server`);
      }
    })();
  }, []);

  const showGrid = useCallback(async () => {
    if (!month) { window.alert("Please Enter Date...... "); return; }
    if (client === SEL) { window.alert("Please Select Client Name...... "); return; }
    if (state === SEL) { window.alert("Please Select State Name...... "); return; }
    if (branch === SEL) { window.alert("Please Select Branch Name...... "); return; }
    try {
      const data = await apiGet<{ results: Row[] }>(`${BASE}/md-list/?month=${encodeURIComponent(month)}&client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}&unit_code=${encodeURIComponent(branch)}&status=${status}`);
      setRows(data?.results ?? []); setSel({});
    } catch (e: any) {
      const m = String(e?.message ?? "");
      const hasStatus = /^API \d+ for /.test(m);
      const t = hasStatus ? `Failed to load MD list (${m.match(/API (\d+)/)?.[1]})` : m;
      setMsg({ text: t, ok: false });
    }
  }, [month, client, state, branch, status]);

  const approve = useCallback(async () => {
    const items = rows.filter((x, i) => sel[String(i)]);
    if (items.length === 0) { window.alert("Please Select Atleast One Record........"); return; }
    try {
      const d = await apiGet<{ message?: string }>(`${BASE}/md-approve/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        invoices: items.map((x) => ({ invoice_no: x.invoice_no, bill_type: x.bill_type, month: x.month, state_name: x.state_name, manual_inv_type: x.manual_inv_type, client_code: x.client_code })),
      }) });
      window.alert(d?.message);
      setMsg({ text: d?.message ?? "", ok: true });
      showGrid();
    } catch (e: any) {
      const msgText = e?.message ?? "Approve failed";
      window.alert(msgText);
      setMsg({ text: msgText, ok: false });
    }
  }, [rows, sel, showGrid]);

  // btn_download_bulk_file ("NOT APPROVED BY MD"): flag_invoice back to 0. The aspx ignores the
  // check-boxes and rejects every listed row; ticked rows are honoured here when any are ticked.
  const reject = useCallback(async () => {
    const ticked = rows.filter((x, i) => sel[String(i)]);
    const items = ticked.length > 0 ? ticked : rows;
    if (items.length === 0) { window.alert("Please Select Atleast One Record........"); return; }
    try {
      const d = await apiGet<{ message?: string }>(`${BASE}/md-reject/`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        invoices: items.map((x) => ({ invoice_no: x.invoice_no })),
      }) });
      window.alert(d?.message);
      setMsg({ text: d?.message ?? "", ok: true });
      showGrid();
    } catch (e: any) {
      const msgText = e?.message ?? "Not Updated!!";
      window.alert(msgText);
      setMsg({ text: msgText, ok: false });
    }
  }, [rows, sel, showGrid]);

  const cols = ["Sr. No.", "CLIENT NAME", "CLIENT CODE", "STATE NAME", "BRANCH NAME", "MONTH YEAR", "INVOICE NUMBER", "INVOICE DATE", "BILLING TYPE", "MANUAL INVOICE TYPE", "TOTAL GST", "AMOUNT", "E-Invoice Status", "Softcopy Status", "STATUS"];
  const m: Record<string, string> = { "CLIENT NAME": "client_name", "CLIENT CODE": "client_code", "STATE NAME": "state_name", "BRANCH NAME": "UNIT_NAME", "MONTH YEAR": "month", "INVOICE NUMBER": "invoice_no", "INVOICE DATE": "invoice_date", "BILLING TYPE": "type", "MANUAL INVOICE TYPE": "manual_invoice_type", "TOTAL GST": "TOTAL GST", "AMOUNT": "amount", "E-Invoice Status": "einvoice_status", "Softcopy Status": "softcopy_status", "STATUS": "STATUS" };
  const renderCell = useCallback((r: Row, c: string, i: number) => {
    if (c === "Sr. No.") return i + 1;
    return val(r, m[c] ?? c);
  }, []);

  const handleClientChange = useCallback((v: string) => { setClient(v); setState(SEL); setBranch(SEL); }, []);
  const handleStateChange = useCallback((v: string) => { setState(v); setBranch(SEL); }, []);

  return (
    <div>
      <Msg text={msg.text} ok={msg.ok} />
      <DropBanner errs={[clientErr10, stateErr]} />
      <div className="row" style={{ marginBottom: 10 }}>
        <div className="col-md-2 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Select Month :</Lab><MonthPick value={month} onChange={setMonth} /></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Client Name :</Lab><Sel value={client} onChange={handleClientChange} opts={clientOpts} /></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10 }}><Lab req>State Name:</Lab><Sel value={state} onChange={handleStateChange} opts={[{ v: SEL, t: SEL }, { v: "ALL", t: "ALL" }, ...states.filter((s) => s.v !== SEL)]} /></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10 }}><Lab req>Branch Name :</Lab><Sel value={branch} onChange={setBranch} opts={[{ v: SEL, t: SEL }, { v: "ALL", t: "ALL" }, ...branches.filter((b) => b.v !== SEL && b.v !== "ALL")]} /></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10 }}><Lab req>STATUS:</Lab><Sel value={status} onChange={setStatus} opts={[{ v: "1", t: "Approved" }, { v: "2", t: "Pending" }]} /></div>
        <div className="col-lg-2 col-md-2 col-sm-3 col-xs-12" style={{ marginBottom: 10, marginTop: 25 }}><Btn onClick={showGrid}>SHOW</Btn></div>
      </div>
      <br /><br />
      <div className="container-fluid" style={{ background: "#f3f1fe", borderRadius: 10, border: "1px solid white", marginLeft: 10, marginRight: 10 }}>
        <Grid id="gvd_md_approval_in" cols={cols} rows={rows} checkKey selected={sel}
          onToggle={(k, v) => setSel((p) => ({ ...p, [k]: v }))}
          onToggleAll={(v) => { const n: Record<string, boolean> = {}; rows.forEach((_, i) => { n[String(i)] = v; }); setSel(n); }}
          renderCell={renderCell} />
        <div className="row text-center" style={{ marginTop: 15 }}>
          <div className="col-xs-6 col-sm-3"><Btn onClick={approve} style={{ width: "100%", minWidth: 160 }}>APPROVED</Btn></div>
          <div className="col-xs-6 col-sm-3"><Btn onClick={reject} style={{ width: "100%", minWidth: 160 }}>NOT APPROVED BY MD</Btn></div>
        </div>
      </div>
    </div>
  );
});

export default TabMD;