"use client";
// Port of petty_cash.aspx ("Petty Cash"): request form + Show Details grid + Approve.
import React, { useEffect, useState, useCallback } from "react";
import { getJSON, upload, mk, responseMessage } from "@/lib/api/legacy-fetch";

const B = "/api/transactions/petty-cash-android";

interface Req {
  id: number; client_name: string; unit_code: string; unit_name: string; emp_code: string; emp_name: string;
  reporting_emp_code: string; reporting_emp_name: string; item: string; shop: string; amount: number; status: string;
}

export default function PettyCashAndroidPage() {
  const [clients, setClients] = useState<{ client_code: string; client_name: string }[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [units, setUnits] = useState<{ unit_code: string; unit_name: string }[]>([]);
  const [emps, setEmps] = useState<{ emp_code: string; emp_name: string }[]>([]);
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [unit, setUnit] = useState("Select");
  const [emp, setEmp] = useState("Select");
  const [reqDate, setReqDate] = useState("");
  const [item, setItem] = useState("");
  const [shop, setShop] = useState("");
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [rows, setRows] = useState<Req[] | null>(null);
  const [checked, setChecked] = useState<Record<number, boolean>>({});

  useEffect(() => {
    getJSON<{ results: any[] }>(`${B}/options/?kind=clients`).then((d) => setClients(d?.results ?? []));
  }, []);

  const onClient = async (c: string) => {
    setClient(c); setState("Select"); setUnit("Select"); setEmp("Select"); setStates([]); setUnits([]); setEmps([]);
    if (c === "Select") return;
    const d = await getJSON<{ results: { state_name: string }[] }>(`${B}/options/?kind=states&client_code=${encodeURIComponent(c)}`);
    setStates((d?.results ?? []).map((x) => x.state_name));
  };
  const onState = async (s: string) => {
    setState(s); setUnit("Select"); setEmp("Select"); setUnits([]); setEmps([]);
    if (s === "Select") return;
    const d = await getJSON<{ results: any[] }>(`${B}/options/?kind=units&client_code=${encodeURIComponent(client)}&state=${encodeURIComponent(s)}`);
    setUnits(d?.results ?? []);
  };
  const onUnit = async (u: string) => {
    setUnit(u); setEmp("Select"); setEmps([]);
    if (u === "Select") return;
    const d = await getJSON<{ results: any[] }>(`${B}/options/?kind=employees&client_code=${encodeURIComponent(client)}&unit_code=${encodeURIComponent(u)}`);
    setEmps(d?.results ?? []);
  };

  const loadRows = useCallback(async () => {
    const d = await getJSON<{ results: Req[] }>(`${B}/requests/`);
    setRows(d?.results ?? []);
    setChecked({});
  }, []);

  // uniform_entery_val()
  const validate = () => {
    if (client === "Select" || client === "ALL") return "Please Select Client Name";
    if (state === "Select") return "Please Select State Name";
    if (unit === "Select") return "Please Select Branch Name";
    if (emp === "Select" || emp === "ALL") return "Please Select Employee Name";
    if (!reqDate) return "Please Select Request Date";
    if (!item.trim()) return "Please Enter Item Name";
    if (!shop.trim()) return "Please Enter Shop Name";
    if (!amount.trim()) return "Please Enter Amount";
    if (!file) return "Please Upload Attendence Excel File";
    return "";
  };

  const submit = async () => {
    const v = validate();
    if (v) { alert(v); return; }
    const fd = new FormData();
    fd.append("client_code", client); fd.append("state", state); fd.append("unit_code", unit);
    fd.append("emp_code", emp); fd.append("item", item); fd.append("shop", shop); fd.append("amount", amount);
    fd.append("request_date", reqDate.split("-").reverse().join("/"));
    fd.append("qr_image", file as File);
    const r = await upload(`${B}/submit/`, fd);
    if (!r.ok) { alert(await responseMessage(r)); return; }
    alert("Request Send Successfully...!!!");
    setClient("Select"); setState("Select"); setUnit("Select"); setEmp("Select");
    setReqDate(""); setItem(""); setShop(""); setAmount(""); setFile(null); setFileKey((k) => k + 1);
    setStates([]); setUnits([]); setEmps([]);
    if (rows) loadRows();
  };

  const approve = async () => {
    const ids = Object.entries(checked).filter(([, v]) => v).map(([k]) => Number(k));
    const r = await mk(`${B}/approve/`, { ids });
    const b = await r.json().catch(() => ({} as any));
    if (!r.ok) { alert(await responseMessage(r)); return; }
    if (b.status) alert(b.status);
    loadRows();
  };

  const allChecked = !!rows && rows.length > 0 && rows.every((r) => checked[r.id]);

  return (
    <div className="container-fluid">
      <div className="panel panel-primary">
        <div className="panel-heading text-center text-uppercase"><b>Petty Cash</b></div>
        <div className="panel-body">
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="col-sm-3"><b>Client Name</b>
              <select className="form-control" value={client} onChange={(e) => onClient(e.target.value)}>
                <option value="Select">Select</option>
                {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
              </select></div>
            <div className="col-sm-3"><b>State Name</b>
              <select className="form-control" value={state} onChange={(e) => onState(e.target.value)}>
                <option value="Select">Select</option>
                {states.map((s) => <option key={s} value={s}>{s}</option>)}
              </select></div>
            <div className="col-sm-3"><b>Branch Name</b>
              <select className="form-control" value={unit} onChange={(e) => onUnit(e.target.value)}>
                <option value="Select">Select</option>
                {units.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
              </select></div>
            <div className="col-sm-3"><b>Requester Name</b>
              <select className="form-control" value={emp} onChange={(e) => setEmp(e.target.value)}>
                <option value="Select">Select</option>
                {emps.map((x) => <option key={x.emp_code} value={x.emp_code}>{x.emp_name}</option>)}
              </select></div>
          </div>
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="col-sm-2"><b>Request Date</b>
              <input type="date" className="form-control" value={reqDate} onChange={(e) => setReqDate(e.target.value)} /></div>
            <div className="col-sm-3"><b>Item Name</b>
              <input className="form-control" maxLength={50} value={item} onChange={(e) => setItem(e.target.value)} /></div>
            <div className="col-sm-3"><b>Shop Name</b>
              <input className="form-control" maxLength={50} value={shop} onChange={(e) => setShop(e.target.value)} /></div>
            <div className="col-sm-2"><b>Amount</b>
              <input className="form-control" inputMode="decimal" value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} /></div>
            <div className="col-sm-2"><b>Scanner</b>
              <input key={fileKey} type="file" accept=".jpg,.jpeg,.png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
          </div>
          <div className="text-center" style={{ marginBottom: 15 }}>
            <button className="btn btn-primary" onClick={submit}>Submit</button>&nbsp;
            <button className="btn btn-primary" onClick={loadRows}>Show Details</button>&nbsp;
            <button className="btn btn-danger" onClick={() => { window.location.href = "/"; }}>Close</button>
          </div>

          {rows && (
            <div style={{ overflowX: "auto" }}>
              <table className="table table-bordered table-striped">
                <thead style={{ background: "#006699", color: "#fff" }}>
                  <tr>
                    <th><input type="checkbox" checked={allChecked}
                      onChange={(e) => setChecked(Object.fromEntries(rows.map((r) => [r.id, e.target.checked])))} /></th>
                    <th>Client Name</th><th>Unit Code</th><th>Unit Name</th><th>Emp Code</th><th>Emp Name</th>
                    <th>Reporting Emp Code</th><th>Reporting Emp Name</th><th>Item</th><th>Shop</th><th>Amount</th><th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={12} className="text-center">No records</td></tr>
                  ) : rows.map((r) => (
                    <tr key={r.id}>
                      <td><input type="checkbox" checked={!!checked[r.id]}
                        onChange={(e) => setChecked({ ...checked, [r.id]: e.target.checked })} /></td>
                      <td>{r.client_name}</td><td>{r.unit_code}</td><td>{r.unit_name}</td><td>{r.emp_code}</td>
                      <td>{r.emp_name}</td><td>{r.reporting_emp_code}</td><td>{r.reporting_emp_name}</td>
                      <td>{r.item}</td><td>{r.shop}</td><td>{r.amount}</td><td>{r.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="text-center">
                <button className="btn btn-success" onClick={approve}>Approve</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
