"use client";

import React, { useCallback, useEffect, useState } from "react";
import { getJSON, mk, upload, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

/**
 * Return_material.aspx "Dispatch Bill" entry form (receiver type Material / Invoice / Dublicate Id Card) writing
 * pay_dispatch_billing via /api/transactions/dispatch-billing/.  Same fields, same Save / Update flow, same alerts
 * (served by the backend), grids per receiver type with row select = legacy Edit and stamp-copy download links.
 */
const B = "/api/transactions/dispatch-billing";
const BY = [["Select", "Select"], ["0", "By Curier"], ["1", "By Postal"], ["2", "By Hand"]];
const INV_TYPES = [["0", "Select"], ["5", "ALL"], ["1", "Manpower"], ["2", "Material"], ["3", "Conveyance"], ["4", "DeepClean"]];

const toDMY = (iso: string) => (iso && iso.includes("-") ? iso.split("-").reverse().join("/") : iso);
const fromDMY = (d: string) => (d && d.includes("/") ? d.split("/").reverse().join("-") : d);

async function dl(id: number, column: string, name: string) {
  const r = await fetch(`${API_BASE_URL}${B}/download/?id=${id}&column=${column}`, { credentials: "include" });
  if (!r.ok) { alert(await responseMessage(r, "Attachment file not found !!!")); return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await r.blob()); a.download = name; a.click();
}

type F = Record<string, string>;
const BLANK: F = {
  receiver_type: "0", billing_type: "0", month: "", dispatch_by: "Select", client_code: "Select", state_name: "Select",
  unit_code: "Select", emp_code: "Select", designation: "", invoice_no: "", invoice_date: "", grand_total: "",
  receiver_name: "", receiving_date: "", dispatch_date: "", pod_number: "", shipping_address: "",
  sec_dispatch_date: "", sec_pod_number: "", sec_receiver_name: "", sec_receiving_date: "",
  dub_dispatch_date: "", sec_du_pod: "", dub_receiver_name: "", du_receiver_date: "",
  dub_dispatch_date3: "", third_du_pod: "", dub_receiver_name_third: "", du_receiver_date_third: "",
  id_no: "", id_no_set: "", bill_rtn_date: "", region: "Select",
};

export default function DispatchBillingForm() {
  const [f, setF] = useState<F>({ ...BLANK });
  const [clients, setClients] = useState<{ client_name: string; client_code: string }[]>([]);
  const [states, setStates] = useState<string[]>(["Select"]);
  const [units, setUnits] = useState<{ unit_code: string; label: string }[]>([]);
  const [emps, setEmps] = useState<{ emp_name: string; emp_code: string }[]>([]);
  const [desigs, setDesigs] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [editing, setEditing] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const rt = f.receiver_type, by = f.dispatch_by;

  useEffect(() => {
    getJSON<{ results: any[] }>(`${B}/options/?kind=clients`).then((d) => setClients(d?.results ?? []));
  }, []);

  const loadRows = useCallback(async (client = f.client_code, type = f.receiver_type) => {
    if (!client || client === "Select" || type === "0") { setRows([]); return; }
    const d = await getJSON<{ results: any[] }>(`${B}/rows/?client_code=${encodeURIComponent(client)}&receiver_type=${type}`);
    setRows(d?.results ?? []);
  }, [f.client_code, f.receiver_type]);

  const loadStates = async (client: string, type: string, month: string) => {
    const d = await getJSON<{ results: string[] }>(
      `${B}/options/?kind=states&client_code=${encodeURIComponent(client)}&receiver_type=${type}&month=${encodeURIComponent(month)}`);
    setStates(d?.results ?? ["Select"]);
  };
  const onType = (v: string) => {
    setF({ ...BLANK, receiver_type: v }); setEditing(false); setRows([]); setStates(["Select"]); setUnits([]); setEmps([]); setRegions([]);
  };
  const onClient = async (v: string) => {
    setF((p) => ({ ...p, client_code: v, state_name: "Select", unit_code: "Select", emp_code: "Select" }));
    setUnits([]); setEmps([]);
    if (v === "Select") { setStates(["Select"]); setRows([]); return; }
    if (rt === "2" && !f.month.trim()) { alert("Please Enter Month"); }
    await loadStates(v, rt, f.month);
    loadRows(v, rt);
    if (rt === "2") {
      const g = await getJSON<{ results: string[] }>(`${B}/options/?kind=regions&client_code=${encodeURIComponent(v)}`);
      setRegions(g?.results ?? []);
    } else setRegions([]);
  };
  // ddl_region_SelectedIndexChanged: the states of the chosen region
  const onRegion = async (v: string) => {
    setF((p) => ({ ...p, region: v, state_name: "Select", unit_code: "Select" }));
    setUnits([]);
    if (v === "Select") return;
    const d = await getJSON<{ results: string[] }>(
      `${B}/options/?kind=region_states&client_code=${encodeURIComponent(f.client_code)}&region=${encodeURIComponent(v)}`);
    setStates(d?.results ?? ["Select"]);
  };
  const onState = async (v: string) => {
    setF((p) => ({ ...p, state_name: v, unit_code: "Select", emp_code: "Select" }));
    if (rt === "2" && v !== "Select") {
      // legacy: final_state_bill1() then inv_flag(); the state drops back to "Select" when either alert fires
      if (!f.month.trim()) { alert("Please Enter Month"); setF((p) => ({ ...p, state_name: "Select" })); return; }
      if (f.billing_type && f.billing_type !== "0") {
        const g = await getJSON<any>(`${B}/options/?kind=state_guard&client_code=${encodeURIComponent(f.client_code)}&state_name=${encodeURIComponent(v)}&billing_type=${f.billing_type}&month=${encodeURIComponent(f.month)}&region=${encodeURIComponent(f.region)}`);
        if (g?.error) { alert(g.error); setF((p) => ({ ...p, state_name: "Select" })); setUnits([]); return; }
      }
    }
    const d = await getJSON<{ results: any[] }>(
      `${B}/options/?kind=units&client_code=${encodeURIComponent(f.client_code)}&state_name=${encodeURIComponent(v)}&month=${encodeURIComponent(rt === "2" ? f.month : "")}`);
    setUnits(d?.results ?? []);
  };
  const fillInvoice = async (state: string, unit: string, billing: string, month: string) => {
    if (rt !== "2" || state === "Select" || !billing || billing === "0" || !month) return;
    const d = await getJSON<any>(`${B}/options/?kind=invoice_info&client_code=${encodeURIComponent(f.client_code)}&state_name=${encodeURIComponent(state)}&unit_code=${encodeURIComponent(unit)}&billing_type=${billing}&month=${encodeURIComponent(month)}&region=${encodeURIComponent(f.region)}`);
    if (d?.error) { alert(d.error); set("state_name", "Select"); return; }
    setF((p) => ({ ...p, invoice_no: d?.invoice_no ?? "", invoice_date: d?.invoice_date ?? "", grand_total: d?.grand_total ?? "" }));
  };
  const onUnit = async (v: string) => {
    set("unit_code", v);
    const q = `client_code=${encodeURIComponent(f.client_code)}&state_name=${encodeURIComponent(f.state_name)}&unit_code=${encodeURIComponent(v)}`;
    const e = await getJSON<{ results: any[] }>(`${B}/options/?kind=employees&${q}`);
    setEmps(e?.results ?? []);
    const s = await getJSON<{ shipping_address: string }>(`${B}/options/?kind=shipping&${q}&receiver_type=${rt}&billing_type=${f.billing_type}`);
    if (s?.shipping_address) set("shipping_address", s.shipping_address);
    fillInvoice(f.state_name, v, f.billing_type, f.month);
  };
  const onEmp = async (v: string) => {
    set("emp_code", v);
    const d = await getJSON<{ results: string[] }>(
      `${B}/options/?kind=designations&client_code=${encodeURIComponent(f.client_code)}&state_name=${encodeURIComponent(f.state_name)}&unit_code=${encodeURIComponent(f.unit_code)}&emp_code=${encodeURIComponent(v)}`);
    const list = d?.results ?? [];
    setDesigs(list);
    if (list.length) set("designation", list[0]);
  };

  const body = () => ({ ...f });
  const send = async (kind: "save" | "update") => {
    let r: Response;
    if (kind === "update") {
      const fd = new FormData();
      Object.entries(body()).forEach(([k, v]) => fd.append(k, v));
      if (file) fd.append("file", file);
      r = await upload(`${B}/update/`, fd);
    } else {
      r = await mk(`${B}/save/`, body());
    }
    if (!r.ok) { alert(await responseMessage(r, "Failed")); return; }
    const j = await r.json().catch(() => ({} as any));
    alert(((j.messages && j.messages.length ? j.messages : [j.status]).filter(Boolean)).join("\n") || "Done");
    setFile(null); loadRows();
    if (kind === "save") setF((p) => ({ ...BLANK, receiver_type: p.receiver_type, client_code: p.client_code }));
    else setEditing(false);
  };

  // legacy row Edit: load the grid row back into the form
  const edit = (r: any) => {
    setEditing(true);
    if (rt === "1") {
      setF((p) => ({ ...p, unit_code: r.unit_code, emp_code: r.emp_code, designation: r.designation, state_name: r.state_dispatch,
        dispatch_by: r.dispatch_by, bill_rtn_date: "", dispatch_date: r.dispatch_date, receiving_date: r.receiving_date,
        receiver_name: r.receiver_name_invoice, pod_number: r.pod_no, shipping_address: r.shipping_address,
        sec_dispatch_date: r.sec_dispatch_date, sec_pod_number: r.sec_pod_no, sec_receiver_name: r.sec_receiver_name,
        sec_receiving_date: r.sec_receiving_date }));
    } else if (rt === "2") {
      setF((p) => ({ ...p, unit_code: r.unit_code, state_name: r.state_dispatch, dispatch_by: r.dispatch_by, invoice_no: r.invoice_no,
        invoice_date: r.invoice_date, grand_total: r.grand_total, dispatch_date: r.dispatch_date, receiving_date: r.receiving_date,
        receiver_name: r.receiver_name_invoice, pod_number: r.pod_no, shipping_address: r.shipping_address, month: r.month,
        billing_type: r.invoice_type || p.billing_type }));
    } else {
      setF((p) => ({ ...p, unit_code: r.unit_code, emp_code: r.emp_code, state_name: r.state_name, designation: r.designation,
        shipping_address: r.shipping_address, id_no_set: r.id_no_set, id_no: r.dublicate_id }));
    }
  };

  const row = (cells: React.ReactNode[]) => <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, margin: "6px 0" }}>{cells}</div>;
  const inp = (label: string, k: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label key={k}>{label} :<input value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} {...extra} /></label>
  );
  const dt = (label: string, k: string) => (
    <label key={k}>{label} :<input type="date" value={fromDMY(f[k] ?? "")} onChange={(e) => set(k, toDMY(e.target.value))} /></label>
  );
  const isInv = rt === "2", isMat = rt === "1", isDup = rt === "3";

  return (
    <div style={{ border: "1px solid #ddd", padding: 10, marginBottom: 14 }}>
      <b>Dispatch Billing</b>
      {row([
        <label key="rt">Receiver Type :
          <select value={rt} onChange={(e) => onType(e.target.value)}>
            <option value="0">Select</option><option value="1">Material</option><option value="2">Invoice</option>
            <option value="3">Dublicate Id Card</option>
          </select></label>,
        ...(isInv ? [<label key="bt">Billing Type :
          <select value={f.billing_type} onChange={(e) => { set("billing_type", e.target.value); fillInvoice(f.state_name, f.unit_code, e.target.value, f.month); }}>
            {INV_TYPES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>,
          <label key="mo">Month :<input placeholder="mm/yyyy" maxLength={7} value={f.month} onChange={(e) => set("month", e.target.value)} /></label>] : []),
        <label key="by">Dispatch By :
          <select value={by} onChange={(e) => set("dispatch_by", e.target.value)}>
            {BY.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select></label>,
        <label key="cl">Client Name :
          <select value={f.client_code} onChange={(e) => onClient(e.target.value)}>
            <option value="Select">Select</option>
            {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}</select></label>,
        ...(isInv && regions.length > 1 ? [<label key="rg">Region :
          <select value={f.region} onChange={(e) => onRegion(e.target.value)}>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>] : []),
        <label key="st">State Name :
          <select value={f.state_name} onChange={(e) => onState(e.target.value)}>
            {states.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>,
        <label key="br">Branch Name :
          <select value={f.unit_code} onChange={(e) => onUnit(e.target.value)}>
            <option value="Select">Select</option><option value="ALL">ALL</option>
            {units.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.label}</option>)}</select></label>,
        ...(!isInv ? [<label key="em">Employee Name :
          <select value={f.emp_code} onChange={(e) => onEmp(e.target.value)}>
            <option value="Select">Select</option><option value="ALL">ALL</option>
            {emps.map((e) => <option key={e.emp_code} value={e.emp_code}>{e.emp_name}</option>)}</select></label>,
          <label key="de">Designation :
            <select value={f.designation} onChange={(e) => set("designation", e.target.value)}>
              {desigs.map((d) => <option key={d} value={d}>{d}</option>)}</select></label>] : []),
      ])}
      {isInv && row([inp("Invoice Number", "invoice_no"), dt("Invoice Date", "invoice_date"), inp("Grand Total", "grand_total")])}
      {row([
        dt(isDup ? "Dublicate Dispatch Date" : "Dispatch Date", isDup ? "bill_rtn_date" : "dispatch_date"),
        ...(by === "2" ? [inp(isDup ? "Receiver Name" : "Receiver Name", "receiver_name"), dt("Receiving Date", "receiving_date")] : []),
        ...(by === "0" ? [inp("POD Number", "pod_number")] : []),
        ...(!isDup || true ? [<label key="sa">Shipping Address :<textarea maxLength={50} value={f.shipping_address}
          onChange={(e) => set("shipping_address", e.target.value)} /></label>] : []),
        ...(isDup ? [inp("ID", "id_no", { maxLength: 2 }), inp("ID No Set", "id_no_set", { maxLength: 2 })] : []),
        <label key="fl">Report Receiving :<input type="file" accept=".jpg,.jpeg,.png,.pdf,.zip" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>,
      ])}
      {isMat && row([
        dt("Second Dispatch Date", "sec_dispatch_date"),
        ...(by === "0" ? [inp("Second POD Number", "sec_pod_number")] : []),
        inp("Second Receiver Name", "sec_receiver_name"), dt("Second Receiving Date", "sec_receiving_date"),
      ])}
      {isDup && row([
        dt("Second Dublicate Dispatch Date", "dub_dispatch_date"), inp("Second Dublicate POD Number", "sec_du_pod"),
        inp("Receiver Name", "dub_receiver_name"), dt("Receiving Date", "du_receiver_date"),
        dt("Third Dublicate Dispatch Date", "dub_dispatch_date3"), inp("Third Dublicate POD Number", "third_du_pod"),
        inp("Third Receiver Name", "dub_receiver_name_third"), dt("Third Receiving Date", "du_receiver_date_third"),
      ])}
      <div style={{ textAlign: "center", margin: "8px 0" }}>
        {!editing && !isDup && <button onClick={() => send("save")}>Save</button>}{" "}
        {(editing || isDup) && <button onClick={() => send("update")}>Update</button>}{" "}
        <button onClick={() => { setF({ ...BLANK, receiver_type: rt }); setEditing(false); setFile(null); }}>Clear</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="dt-grid">
          <thead><tr>
            <th>No.</th><th>Client Name</th><th>State</th><th>Branch</th>
            {isMat && <><th>Employee</th><th>Designation</th></>}
            {isDup && <><th>Employee</th><th>Designation</th><th>Id No Set</th></>}
            {isInv && <><th>Month</th><th>Invoice Type</th><th>Invoice No</th><th>Invoice Date</th><th>Grand Total</th></>}
            {!isDup && <><th>Dispatch By</th><th>Dispatch Date</th><th>Receiving Date</th><th>Receiver Name</th><th>POD</th></>}
            {isDup && <><th>Dispatch Date 1</th><th>POD 1</th><th>Dispatch Date 2</th><th>POD 2</th><th>Dispatch Date 3</th><th>POD 3</th></>}
            <th>Shipping Address</th><th>Edit</th><th>Stamp copy</th>
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td><td>{r.client_name}</td><td>{r.state_dispatch || r.state_name}</td><td>{r.unit_name}</td>
                {isMat && <><td>{r.emp_name}</td><td>{r.designation}</td></>}
                {isDup && <><td>{r.emp_name}</td><td>{r.designation}</td><td>{r.id_no_set}</td></>}
                {isInv && <><td>{r.month}</td><td>{r.invoice_type_name}</td><td>{r.invoice_no}</td><td>{r.invoice_date}</td><td>{r.grand_total}</td></>}
                {!isDup && <><td>{r.dispatch_by_name}</td><td>{r.dispatch_date}</td><td>{r.receiving_date}</td><td>{r.receiver_name_invoice}</td><td>{r.pod_no}</td></>}
                {isDup && <><td>{r.dispatch_date_du}</td><td>{r.du_pod1}</td><td>{r.dispatch_date_du2}</td><td>{r.du_pod_no2}</td><td>{r.dispatch_date_du3}</td><td>{r.du_pod_no3}</td></>}
                <td>{r.shipping_address}</td>
                <td><a href="#" onClick={(e) => { e.preventDefault(); edit(r); }}>Edit</a></td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {isInv && r.invoice_stamp_copy && <a href="#" onClick={(e) => { e.preventDefault(); dl(r.id, "invoice_stamp_copy", r.invoice_stamp_copy); }}>Download</a>}
                  {isMat && r.stamp_copy && <a href="#" onClick={(e) => { e.preventDefault(); dl(r.id, "stamp_copy", r.stamp_copy); }}>Download</a>}
                  {isMat && r.second_stamp_copy && <> <a href="#" onClick={(e) => { e.preventDefault(); dl(r.id, "second_stamp_copy", r.second_stamp_copy); }}>2nd</a></>}
                  {isDup && r.du_stamp_copy && <a href="#" onClick={(e) => { e.preventDefault(); dl(r.id, "du_stamp_copy", r.du_stamp_copy); }}>1</a>}
                  {isDup && r.du_stamp_copy2 && <> <a href="#" onClick={(e) => { e.preventDefault(); dl(r.id, "du_stamp_copy2", r.du_stamp_copy2); }}>2</a></>}
                  {isDup && r.du_stamp_copy3 && <> <a href="#" onClick={(e) => { e.preventDefault(); dl(r.id, "du_stamp_copy3", r.du_stamp_copy3); }}>3</a></>}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={16}>No records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
