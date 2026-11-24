"use client";
// Port of Return_material.aspx: six tabs - Return Material, Dispatch Bill, Dispatch Inventory,
// Send Email, Courier, Uniform Entry.  All data comes from /api/transactions/return-console/
// (legacy tables pay_transaction, pay_return_material_*, pay_bill_invoices, pay_document_details,
// pay_courier_tracking, pay_dispatch_billing).
import React, { useCallback, useEffect, useState } from "react";
import { getJSON, mk, upload, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";
import DispatchBillingForm from "@/components/DispatchBillingForm";

const B = "/api/transactions/return-console";
type Tab = "return" | "bill" | "inventory" | "email" | "courier" | "uniform";
const TABS: [Tab, string][] = [["return", "Return Material"], ["bill", "Dispatch Bill"], ["inventory", "Dispatch Inventory"],
  ["email", "Send Email"], ["courier", "Courier"], ["uniform", "Uniform Entry"]];

interface Opt { client_code: string; client_name: string }
interface Unit { unit_code: string; unit_name: string }
interface Line { item_type: string; item_code: string; particular: string; description: string; quantity: number | string; return_qty: number | string; pod_num: string }

const toDMY = (iso: string) => (iso ? iso.split("-").reverse().join("/") : "");
const fromDMY = (d: string) => (d && d.includes("/") ? d.split("/").reverse().join("-") : "");

async function dl(path: string, name: string) {
  const r = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  if (!r.ok) { alert(await responseMessage(r, "Attachment file not found !!!")); return; }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(await r.blob()); a.download = name; a.click();
}

// ----------------------------------------------------------------------------- cascade hook
function useCascade(source: "invoice" | "master", clientKind: "clients" | "all_clients") {
  const [clients, setClients] = useState<Opt[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  useEffect(() => {
    getJSON<{ results: Opt[] }>(`${B}/lookup/?kind=${clientKind}`).then((d) => setClients(d?.results ?? []));
  }, [clientKind]);
  const loadStates = async (client: string) => {
    setStates([]); setUnits([]);
    if (!client || client === "Select") return;
    const d = await getJSON<{ results: { state_name: string }[] }>(`${B}/lookup/?kind=states&client_code=${encodeURIComponent(client)}&source=${source}`);
    setStates((d?.results ?? []).map((x) => x.state_name));
  };
  const loadUnits = async (client: string, state: string) => {
    setUnits([]);
    if (!client || client === "Select" || !state || state === "Select") return;
    const d = await getJSON<{ results: Unit[] }>(`${B}/lookup/?kind=units&client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}&source=${source}`);
    setUnits(d?.results ?? []);
  };
  return { clients, states, units, loadStates, loadUnits };
}

// ----------------------------------------------------------------------------- Return tab
function ReturnTab() {
  const cas = useCascade("invoice", "clients");
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [unit, setUnit] = useState("Select");
  const [invoices, setInvoices] = useState<string[]>([]);
  const [invoice, setInvoice] = useState("Select");
  const [mtype, setMtype] = useState("Select");
  const [rdate, setRdate] = useState("");
  const [by, setBy] = useState("");
  const [reason, setReason] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [hist, setHist] = useState<any[]>([]);

  const loadHist = useCallback(async () => {
    const d = await getJSON<{ results: any[] }>(`${B}/returns/`);
    setHist(d?.results ?? []);
  }, []);
  useEffect(() => { loadHist(); }, [loadHist]);

  const onClient = async (c: string) => { setClient(c); setState("Select"); setUnit("Select"); setInvoices([]); setInvoice("Select"); setLines([]); await cas.loadStates(c); };
  const onState = async (s: string) => { setState(s); setUnit("Select"); setInvoices([]); setInvoice("Select"); setLines([]); await cas.loadUnits(client, s); };
  const onUnit = async (u: string) => {
    setUnit(u); setInvoice("Select"); setLines([]);
    if (u === "Select") { setInvoices([]); return; }
    const d = await getJSON<{ results: { invoice_no: string }[] }>(`${B}/lookup/?kind=invoices&client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(state)}&unit_code=${encodeURIComponent(u)}`);
    setInvoices((d?.results ?? []).map((x) => x.invoice_no));
  };
  const onInvoice = async (n: string) => {
    setInvoice(n); setLines([]);
    if (n === "Select") return;
    const d = await getJSON<{ results: Line[] }>(`${B}/lookup/?kind=lines&invoice_no=${encodeURIComponent(n)}`);
    setLines(d?.results ?? []);
  };
  // validation_num(): per-row cap shown at once
  const setRet = (i: number, v: string) => {
    const l = lines[i];
    if (Number(v) > Number(l.quantity)) { alert("Return Quantity Should not be greater than Quantity!"); return; }
    setLines(lines.map((x, k) => (k === i ? { ...x, return_qty: v } : x)));
  };

  const save = async () => {
    let err = "";
    if (client === "Select") err = "Please Enter Client Name!!!";
    else if (state === "Select") err = "Please Select State Name!!!";
    else if (unit === "Select") err = "Please Select Branch Name!!!";
    else if (invoice === "Select") err = "Please Enter Invoice Number Number !!";
    else if (!rdate) err = "Please Enter Return Date !!";
    else if (!by.trim()) err = "Please Enter Acepted Porson Name !!";
    else if (!reason.trim()) err = "Please Enter Reason !!";
    if (err) { alert(err); return; }
    const r = await mk(`${B}/return-save/`, {
      client_code: client, state, unit_code: unit, invoice_no: invoice, material_type: mtype === "Select" ? "" : mtype,
      return_date: toDMY(rdate), accepted_by: by, reason, lines,
    });
    if (!r.ok) { alert(await responseMessage(r, "Material Return Fail...")); return; }
    alert("Material Return Successfully...");
    setInvoice("Select"); setLines([]); setRdate(""); setBy(""); setReason(""); loadHist();
  };

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <label>Client Name<select value={client} onChange={(e) => onClient(e.target.value)}>
          <option>Select</option>{cas.clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}</select></label>
        <label>State Name<select value={state} onChange={(e) => onState(e.target.value)}>
          <option>Select</option>{cas.states.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Branch Name<select value={unit} onChange={(e) => onUnit(e.target.value)}>
          <option>Select</option>{cas.units.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}</select></label>
        <label>Invoice Number<select value={invoice} onChange={(e) => onInvoice(e.target.value)}>
          <option>Select</option>{invoices.map((n) => <option key={n}>{n}</option>)}</select></label>
        <label>Material Type<select value={mtype} onChange={(e) => setMtype(e.target.value)}>
          <option>Select</option><option value="chemicals">Chemicals</option>
          <option value="housekeeping_material">Housekeeping Materials</option><option value="Uniform">Uniform</option>
          <option value="Shoes">Shoes</option><option value="Other">Other</option></select></label>
        <label>Return Date<input type="date" value={rdate} onChange={(e) => setRdate(e.target.value)} /></label>
        <label>Accepted By<input value={by} onChange={(e) => setBy(e.target.value.replace(/[^A-Za-z .]/g, ""))} /></label>
        <label>Reason<textarea value={reason} onChange={(e) => setReason(e.target.value)} /></label>
      </div>
      {lines.length > 0 && (
        <table className="dt-grid" style={{ marginTop: 8 }}>
          <thead><tr><th>Item Type</th><th>Item Code</th><th>Item Name</th><th>Description</th><th>Quantity</th><th>Return Qty</th><th>POD No</th></tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}><td>{l.item_type}</td><td>{l.item_code}</td><td>{l.particular}</td><td>{l.description}</td><td>{l.quantity}</td>
                <td><input size={5} value={String(l.return_qty)} onChange={(e) => setRet(i, e.target.value.replace(/[^0-9.]/g, ""))} /></td>
                <td><input size={10} value={l.pod_num} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, pod_num: e.target.value } : x)))} /></td></tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ margin: "8px 0" }}>
        <button onClick={save}>Save</button>{" "}<button onClick={() => { window.location.href = "/"; }}>Close</button>
      </div>
      <table className="dt-grid">
        <thead><tr><th>Invoice</th><th>Client</th><th>State</th><th>Branch</th><th>Return Date</th><th>Accepted By</th><th>Reason</th></tr></thead>
        <tbody>
          {hist.map((o) => (<tr key={o.id}><td>{o.invoice_no}</td><td>{o.client_name}</td><td>{o.state}</td><td>{o.branch_name}</td><td>{o.return_date}</td><td>{o.accepted_by}</td><td>{o.reason}</td></tr>))}
          {hist.length === 0 && <tr><td colSpan={7}>No returns</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ----------------------------------------------------------------------------- Dispatch Bill / Inventory (shared editor)
function DispatchEditor({ kind }: { kind: "bill" | "inventory" }) {
  const [rows, setRows] = useState<any[]>([]);
  const [sel, setSel] = useState<any | null>(null);
  const [dd, setDd] = useState(""); const [rd, setRd] = useState(""); const [pod, setPod] = useState(""); const [addr, setAddr] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const load = useCallback(async () => {
    const d = await getJSON<{ results: any[] }>(`${B}/${kind === "bill" ? "bills" : "inventory"}/`);
    setRows(d?.results ?? []);
  }, [kind]);
  useEffect(() => { load(); }, [load]);
  const edit = (r: any) => { setSel(r); setDd(fromDMY(r.dispatch_date)); setRd(fromDMY(r.receiving_date)); setPod(r.pod_number); setAddr(r.shipping_address); setFile(null); };
  const save = async () => {
    if (!sel) return;
    if (dd && rd && dd > rd) { alert("Receiving date should be greater than dispatch date!!!"); return; }
    const fd = new FormData();
    fd.append("dispatch_date", toDMY(dd)); fd.append("receiving_date", toDMY(rd)); fd.append("pod_number", pod); fd.append("shipping_address", addr);
    if (kind === "bill") fd.append("invoice_number", sel.invoice_number); else fd.append("id", String(sel.id));
    if (file) fd.append("file", file);
    const r = await upload(`${B}/${kind === "bill" ? "bill-save" : "inventory-save"}/`, fd);
    if (!r.ok) { alert(await responseMessage(r, "Failed")); return; }
    alert("Data updated Successfully !!!"); setSel(null); load();
  };
  return (
    <div>
      <div style={{ overflowX: "auto" }}>
        <table className="dt-grid">
          <thead><tr><th>No.</th><th>Client Name</th><th>State Name</th><th>Branch Name</th>
            {kind === "bill" ? <><th>Month</th><th>Year</th><th>Bill Type</th><th>Invoice Number</th></> : <><th>EMP NAME</th><th>Document Type</th></>}
            <th>POD Number</th><th>Dispatch Date</th><th>Receiving Date</th><th>Edit</th><th>Download</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id}><td>{i + 1}</td><td>{r.client_name}</td><td>{r.state_name}</td><td>{r.unit_name}</td>
                {kind === "bill" ? <><td>{r.month}</td><td>{r.year}</td><td>{r.bill_type}</td><td>{r.invoice_number}</td></> : <><td>{r.emp_name}</td><td>{r.document_type}</td></>}
                <td>{r.pod_number}</td><td>{r.dispatch_date}</td><td>{r.receiving_date}</td>
                <td><a href="#" onClick={(e) => { e.preventDefault(); edit(r); }}>Edit</a></td>
                <td>{r.shipping_file ? <a href="#" onClick={(e) => { e.preventDefault(); dl(`${B}/${kind === "bill" ? "bill-download" : "inventory-download"}/?id=${r.id}`, r.shipping_file); }}>Download</a> : ""}</td></tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={12}>No records</td></tr>}
          </tbody>
        </table>
      </div>
      {sel && (
        <div style={{ border: "1px solid #ccc", padding: 10, marginTop: 10 }}>
          <b>{kind === "bill" ? `Invoice : ${sel.invoice_number}` : `Employee : ${sel.emp_name} (${sel.document_type})`}</b>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, margin: "6px 0" }}>
            <label>Dispatch Date<input type="date" value={dd} onChange={(e) => setDd(e.target.value)} /></label>
            <label>Receiving Date<input type="date" value={rd} onChange={(e) => setRd(e.target.value)} /></label>
            <label>POD Number<input value={pod} onChange={(e) => setPod(e.target.value)} /></label>
            <label>Shipping Address<textarea maxLength={50} value={addr} onChange={(e) => setAddr(e.target.value)} /></label>
            <label>Report Receiving<input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          </div>
          <button onClick={save}>Save</button>{" "}<button onClick={() => setSel(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------------------------- Courier
function CourierTab() {
  const cas = useCascade("master", "all_clients");
  const blank = { id: "", category: "0", date: "", client_code: "Select", state: "Select", unit_code: "Select", address: "", weight: "", units: "0", packet: "", pod_no: "", deliver: "0" };
  const [f, setF] = useState<any>(blank);
  const [rows, setRows] = useState<any[]>([]);
  const load = useCallback(async () => { const d = await getJSON<{ results: any[] }>(`${B}/courier/`); setRows(d?.results ?? []); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: string, v: string) => setF((p: any) => ({ ...p, [k]: v }));
  const pickRow = async (r: any) => {
    setF({ id: String(r.id), category: r.category_code, date: r.date, client_code: r.client_code, state: r.state_courier, unit_code: r.unit_code,
      address: r.address, weight: r.weight, units: r.units_code || "0", packet: r.packet, pod_no: r.pod_no, deliver: r.deliver_code || "0" });
    await cas.loadStates(r.client_code); await cas.loadUnits(r.client_code, r.state_courier);
  };
  const validate = () => {
    if (f.category === "0") return "Please Select Courier Category";
    if (!f.date) return "Please Select Courier Date";
    if (f.client_code === "Select") return "Please Select Courier Client Name";
    if (f.state === "Select") return "Please Select Courier State Name";
    if (f.unit_code === "Select") return "Please Select Courier Branch Name";
    if (!f.address.trim()) return "Please Enter Courier Address";
    if (!f.weight.trim()) return "Please Enter Courier Weight";
    if (!f.packet.trim()) return "Please Enter Courier Packet";
    return "";
  };
  const run = async (path: string, ok: string) => {
    const e = validate(); if (e && path !== "courier-delete") { alert(e); return; }
    const r = await mk(`${B}/${path}/`, f);
    if (!r.ok) { alert(await responseMessage(r, "Failed")); return; }
    alert(ok); setF(blank); load();
  };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <label>Category<select value={f.category} onChange={(e) => set("category", e.target.value)}>
          <option value="0">Select</option><option value="1">Uniform</option><option value="2">Shoes</option><option value="3">Id Card</option><option value="4">Documents</option></select></label>
        <label>Date<input type="date" value={fromDMY(f.date) || f.date} onChange={(e) => set("date", toDMY(e.target.value))} /></label>
        <label>Client Name<select value={f.client_code} onChange={async (e) => { set("client_code", e.target.value); set("state", "Select"); set("unit_code", "Select"); await cas.loadStates(e.target.value); }}>
          <option>Select</option>{cas.clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}</select></label>
        <label>State Name<select value={f.state} onChange={async (e) => { set("state", e.target.value); set("unit_code", "Select"); await cas.loadUnits(f.client_code, e.target.value); }}>
          <option>Select</option>{cas.states.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Branch Name<select value={f.unit_code} onChange={(e) => set("unit_code", e.target.value)}>
          <option>Select</option>{cas.units.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}</select></label>
        <label>Address<textarea value={f.address} onChange={(e) => set("address", e.target.value)} /></label>
        <label>Weight<input value={f.weight} onChange={(e) => set("weight", e.target.value.replace(/[^0-9.]/g, ""))} />
          <select value={f.units} onChange={(e) => set("units", e.target.value)}><option value="0">Kg</option><option value="1">Gram</option></select></label>
        <label>Packet<input value={f.packet} onChange={(e) => set("packet", e.target.value.replace(/[^0-9]/g, ""))} /></label>
        <label>POD No<input value={f.pod_no} onChange={(e) => set("pod_no", e.target.value)} /></label>
        <label>Deliver<select value={f.deliver} onChange={(e) => set("deliver", e.target.value)}><option value="0">No</option><option value="1">Yes</option></select></label>
      </div>
      <div style={{ margin: "8px 0" }}>
        {!f.id && <button onClick={() => run("courier-save", " Courier Added Successfully... !!!")}>Save</button>}
        {f.id && <><button onClick={() => run("courier-update", "Courier  Updated Successfully")}>Update</button>{" "}
          <button onClick={() => { if (confirm("Are you Sure You Want to Delete Record")) run("courier-delete", "Courier  Deleted Successfully"); }}>Delete</button>{" "}</>}
        <button onClick={() => setF(blank)}>Clear</button>
      </div>
      <table className="dt-grid">
        <thead><tr><th>Category</th><th>State</th><th>Weight</th><th>Packet</th><th>POD No</th><th>Date</th><th>Address</th><th>Client Name</th><th>Branch</th><th>Deliver</th><th>Units</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => pickRow(r)}>
              <td>{r.category}</td><td>{r.state_courier}</td><td>{r.weight}</td><td>{r.packet}</td><td>{r.pod_no}</td><td>{r.date}</td>
              <td>{r.address}</td><td>{r.client_name}</td><td>{r.unit_name}</td><td>{r.deliver}</td><td>{r.units}</td></tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={11}>No records</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ----------------------------------------------------------------------------- Uniform Entry
function UniformTab() {
  const cas = useCascade("master", "all_clients");
  const blank = { id: "", emp_type: "0", client_code: "Select", state: "Select", unit_code: "Select", emp_code: "Select", dispatch_by: "Select", dispatch_date: "", delivery_date: "", pod_no: "", no_of_set: "", remark: "" };
  const [f, setF] = useState<any>(blank);
  const [emps, setEmps] = useState<{ emp_code: string; emp_name: string }[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const load = useCallback(async () => { const d = await getJSON<{ results: any[] }>(`${B}/uniform/`); setRows(d?.results ?? []); }, []);
  useEffect(() => { load(); }, [load]);
  const set = (k: string, v: string) => setF((p: any) => ({ ...p, [k]: v }));
  const loadEmps = async (client: string, unit: string) => {
    setEmps([]);
    if (client === "Select" || unit === "Select") return;
    const d = await getJSON<{ results: any[] }>(`/api/transactions/petty-cash-android/options/?kind=employees&client_code=${encodeURIComponent(client)}&unit_code=${encodeURIComponent(unit)}`);
    setEmps(d?.results ?? []);
  };
  const submit = async () => {
    const need: [string, string, string[]][] = [
      ["emp_type", "Please Select Employee Type", ["0", "Select"]], ["client_code", "Please Select Client Name", ["Select"]],
      ["state", "Please Select State Name", ["Select"]], ["unit_code", "Please Select Branch Name", ["Select"]],
      ["emp_code", "Please Select Employee Name", ["Select"]], ["dispatch_by", "Please Select dispatch by", ["Select"]],
      ["dispatch_date", "Please Select Dispatch Date", [""]], ["delivery_date", "Please Select Delivery Date", [""]],
      ["pod_no", "Please Enter POD No", [""]], ["no_of_set", "Please Enter NO of Set", [""]], ["remark", "Please Enter Remark", [""]]];
    for (const [k, m, bad] of need) if (bad.includes(String(f[k]).trim())) { alert(m); return; }
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => fd.append(k, k.endsWith("_date") ? toDMY(String(v)) : String(v)));
    if (file) fd.append("file", file);
    const r = await upload(`${B}/uniform-save/`, fd);
    if (!r.ok) { alert(await responseMessage(r, "Failed")); return; }
    const b = await r.json(); alert(b.status); setF(blank); setFile(null); setEmps([]); load();
  };
  const pickRow = async (r: any) => {
    await cas.loadStates(r.client_code); await cas.loadUnits(r.client_code, r.state_dispatch); await loadEmps(r.client_code, r.unit_code);
    setF({ id: String(r.id), emp_type: "2", client_code: r.client_code, state: r.state_dispatch, unit_code: r.unit_code, emp_code: r.emp_code,
      dispatch_by: r.dispatch_by_code, dispatch_date: fromDMY(r.dispatch_date), delivery_date: fromDMY(r.receiving_date), pod_no: r.pod_no, no_of_set: r.no_of_set, remark: r.remark });
  };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
        <label>Employee Type<select value={f.emp_type} onChange={(e) => set("emp_type", e.target.value)}>
          <option value="0">Select</option><option value="3">All</option><option value="1">Left</option><option value="2">Permanent</option><option value="4">Old Employee</option></select></label>
        <label>Client Name<select value={f.client_code} onChange={async (e) => { setF({ ...f, client_code: e.target.value, state: "Select", unit_code: "Select", emp_code: "Select" }); await cas.loadStates(e.target.value); }}>
          <option>Select</option>{cas.clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}</select></label>
        <label>State Name<select value={f.state} onChange={async (e) => { setF({ ...f, state: e.target.value, unit_code: "Select", emp_code: "Select" }); await cas.loadUnits(f.client_code, e.target.value); }}>
          <option>Select</option>{cas.states.map((s) => <option key={s}>{s}</option>)}</select></label>
        <label>Branch Name<select value={f.unit_code} onChange={async (e) => { setF({ ...f, unit_code: e.target.value, emp_code: "Select" }); await loadEmps(f.client_code, e.target.value); }}>
          <option>Select</option>{cas.units.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}</select></label>
        <label>Employee Name<select value={f.emp_code} onChange={(e) => set("emp_code", e.target.value)}>
          <option>Select</option>{emps.map((x) => <option key={x.emp_code} value={x.emp_code}>{x.emp_name}</option>)}</select></label>
        <label>Dispatch By<select value={f.dispatch_by} onChange={(e) => set("dispatch_by", e.target.value)}>
          <option>Select</option><option value="0">By Courier</option><option value="1">By Postal</option><option value="2">By Hand</option></select></label>
        <label>Dispatch Date<input type="date" value={f.dispatch_date} onChange={(e) => set("dispatch_date", e.target.value)} /></label>
        <label>Delivery Date<input type="date" value={f.delivery_date} onChange={(e) => set("delivery_date", e.target.value)} /></label>
        <label>POD No<input value={f.pod_no} onChange={(e) => set("pod_no", e.target.value)} /></label>
        <label>No. of Set<input value={f.no_of_set} onChange={(e) => set("no_of_set", e.target.value.replace(/[^0-9]/g, ""))} /></label>
        <label>Remark<input value={f.remark} onChange={(e) => set("remark", e.target.value)} /></label>
        <label>Attachment<input type="file" accept=".jpg,.jpeg,.png,.pdf,.zip,.rar" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
      </div>
      <div style={{ margin: "8px 0" }}>
        <button onClick={submit}>{f.id ? "Update" : "Submit"}</button>{" "}<button onClick={() => { setF(blank); setFile(null); }}>Clear</button>
      </div>
      <table className="dt-grid">
        <thead><tr><th>Client</th><th>State</th><th>Branch</th><th>Employee</th><th>Type</th><th>Dispatch By</th><th>Dispatch Date</th><th>Delivery Date</th><th>POD No</th><th>Sets</th><th>Remark</th><th>Download</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} style={{ cursor: "pointer" }} onClick={() => pickRow(r)}>
              <td>{r.client_name}</td><td>{r.state_dispatch}</td><td>{r.unit_name}</td><td>{r.emp_code}</td><td>{r.employee_type}</td><td>{r.dispatch_by}</td>
              <td>{r.dispatch_date}</td><td>{r.receiving_date}</td><td>{r.pod_no}</td><td>{r.no_of_set}</td><td>{r.remark}</td>
              <td>{r.attachment ? <a href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); dl(`${B}/uniform-download/?id=${r.id}`, r.attachment); }}>Download</a> : ""}</td></tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={12}>No records</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ----------------------------------------------------------------------------- Send Email
function EmailTab() {
  const cas = useCascade("master", "all_clients");
  const [client, setClient] = useState("Select");
  const send = async () => {
    if (client === "Select") { alert("Please Select Client."); return; }
    const r = await mk(`${B}/send-email/`, { client_code: client });
    alert(r.ok ? "Email Sent successfully!!" : await responseMessage(r, "Error in Sending Email !!"));
  };
  return (
    <div>
      <label>Client <select value={client} onChange={(e) => setClient(e.target.value)}>
        <option>Select</option>{cas.clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}</select></label>{" "}
      <button onClick={send}>Send Email</button>
      <p style={{ color: "#a94442", marginTop: 8 }}>
        Branch-head letter mailing needs the letter PDF template and an SMTP relay, which are not configured here;
        the action reports that honestly and never claims a message was sent.
      </p>
    </div>
  );
}

export default function ReturnMaterialPage() {
  const [tab, setTab] = useState<Tab>("return");
  return (
    <div className="lg-panel">
      <div className="lg-panel-head">Return Material</div>
      <div className="lg-panel-body">
        <div style={{ display: "flex", gap: 6, margin: "6px 0 10px" }}>
          {TABS.map(([k, t]) => (
            <button key={k} onClick={() => setTab(k)} style={{ fontWeight: tab === k ? "bold" : "normal" }}>{t}</button>
          ))}
        </div>
        {tab === "return" && <ReturnTab />}
        {tab === "bill" && <><DispatchBillingForm /><DispatchEditor kind="bill" /></>}
        {tab === "inventory" && <DispatchEditor kind="inventory" />}
        {tab === "email" && <EmailTab />}
        {tab === "courier" && <CourierTab />}
        {tab === "uniform" && <UniformTab />}
      </div>
    </div>
  );
}
