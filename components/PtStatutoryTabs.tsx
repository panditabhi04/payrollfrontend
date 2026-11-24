"use client";

/**
 * PTSlabMaster.aspx statutory tabs (PF, ESIC, Labour Office, TDS Master) - ported 1:1 from
 * the legacy markup/JS: same labels, same grids, same button sets, same alerts.
 * Persistence: /api/payroll/pf-details, /labour-office, /tds-master (server enforces the same
 * validation texts, so the alerts below show the server's verbatim legacy message).
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { listItems, createItem, updateItem, deleteItem } from "@/lib/api/crud";
import { Sel, Txt, onlyDec, errMsg, type Opt } from "@/components/formkit";
import { API_BASE_URL } from "@/lib/api/client";

const PF = "/api/payroll/pf-details";
const LAB = "/api/payroll/labour-office";
const TDS = "/api/payroll/tds-master";

const say = (data: unknown, ok: string, fail: string) => {
  const d = data as { status?: string } | undefined;
  return (d && d.status) || ok || errMsg(data) || fail;
};

/* ------------------------------------------------------------------ PF */
interface PfRow { id: number; sr_no: string; type: string; pf_account: number; pension_account: number; admin_charge: number; edil_chares: number; total: number }
const PF_EMPTY = { type: "Select", pf_account: "", pension_account: "", admin_charge: "", edli: "", total: "" };

export function PfTab({ canCreate, canUpdate, canDelete }: { canCreate: boolean; canUpdate: boolean; canDelete: boolean }) {
  const [f, setF] = useState({ ...PF_EMPTY });
  const [rows, setRows] = useState<PfRow[]>([]);
  const [sel, setSel] = useState<PfRow | null>(null);
  const load = useCallback(async () => {
    try { setRows((await listItems<PfRow>(PF, { pageSize: 100 })).results); } catch { setRows([]); }
  }, []);
  useEffect(() => { load(); }, [load]);

  // addition_all_textbox(): Total = PF + Pension + Admin + EDLI
  const upd = (k: string, v: string) => setF((p) => {
    const n = { ...p, [k]: v };
    const t = ["pf_account", "pension_account", "admin_charge", "edli"].reduce((s, x) => s + (parseFloat((n as Record<string, string>)[x]) || 0), 0);
    return { ...n, total: String(Math.round(t * 1e6) / 1e6) };
  });
  const clear = () => { setSel(null); setF({ ...PF_EMPTY }); };
  const body = () => ({
    type: f.type, pf_account: f.pf_account || 0, pension_account: f.pension_account || 0,
    admin_charge: f.admin_charge || 0, edil_chares: f.edli || 0,
  });
  const pick = (r: PfRow) => {
    setSel(r);
    setF({ type: r.type || "Select", pf_account: String(r.pf_account ?? ""), pension_account: String(r.pension_account ?? ""),
      admin_charge: String(r.admin_charge ?? ""), edli: String(r.edil_chares ?? ""), total: String(r.total ?? "") });
  };
  const guard = () => { if (f.type === "Select") { alert("Select Type !!!"); return false; } return true; };

  const save = async () => {
    if (!guard()) return;
    const r = await createItem(PF, body());
    alert(r.ok ? say(r.data, "Record added successfully!!", "") : (errMsg(r.data) || "Record adding failed..."));
    clear(); load();
  };
  const update = async () => {
    if (!sel || !guard()) return;
    const r = await updateItem(PF, sel.id, body());
    alert(r.ok ? say(r.data, "Record Update successfully!!", "") : (errMsg(r.data) || "Record Update failed..."));
    clear(); load();
  };
  const del = async () => {
    if (!sel) return;
    if (!confirm("Are you Sure You Want to Delete Record")) { alert("Record not Available"); return; }
    const r = await deleteItem(PF, sel.id);
    alert(r.ok ? "Record Delete successfully!!" : (errMsg(r.data) || "Record Delete failed..."));
    clear(); load();
  };
  const typeOpts: Opt[] = [{ v: "Select", t: "Select" }, { v: "Employer", t: "Employer" }, { v: "Employee", t: "Employee" }];

  return (
    <div>
      <div className="lg-form cols3">
        <Sel label="Select Type :" req value={f.type} onChange={(v) => upd("type", v)} opts={typeOpts} />
        <Txt label="PF Account :" value={f.pf_account} onChange={(v) => upd("pf_account", v)} filter={onlyDec} maxLength={10} />
        <Txt label="Pension Account :" value={f.pension_account} onChange={(v) => upd("pension_account", v)} filter={onlyDec} maxLength={10} />
        <Txt label="Admin Charge :" value={f.admin_charge} onChange={(v) => upd("admin_charge", v)} filter={onlyDec} maxLength={10} />
        <Txt label="EDLI :" value={f.edli} onChange={(v) => upd("edli", v)} filter={onlyDec} maxLength={10} />
        <Txt label="Total :" value={f.total} onChange={(v) => setF((p) => ({ ...p, total: v }))} filter={onlyDec} maxLength={10} />
      </div>
      <div className="lg-btns center">
        {canCreate && !sel && <button className="lg-btn lg-btn-green" onClick={save}>Save</button>}
        {canUpdate && sel && <button className="lg-btn lg-btn-green" onClick={update}>Update</button>}
        {canDelete && sel && <button className="lg-btn lg-btn-red" onClick={del}>Delete</button>}
        <Link href="/" className="lg-btn lg-btn-red" style={{ textDecoration: "none" }}>Close</Link>
      </div>
      <div className="dt-scroll"><table className="dt-grid">
        <thead><tr><th>Sr No.</th><th>id</th><th>Type</th><th>PF_ACCOUNT</th><th>PENSION_ACCOUNT</th><th>ADMIN_CHARGES</th><th>EDIL_CHARGES</th><th>TOTAL</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "#777" }}>No records</td></tr>}
          {rows.map((r) => (
            <tr key={r.id} className={sel?.id === r.id ? "dt-selected" : ""} style={{ cursor: "pointer" }} onClick={() => pick(r)}>
              <td>{r.sr_no}</td><td>{r.id}</td><td>{r.type}</td><td>{r.pf_account}</td><td>{r.pension_account}</td>
              <td>{r.admin_charge}</td><td>{r.edil_chares}</td><td>{r.total}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

/* ---------------------------------------------------------------- ESIC */
/** Legacy "ESIC" tab: the aspx renders no input fields, only the Save/Clear/Update/Delete/Close
 *  buttons (their handlers run the PT-slab core-tab procedures). Rendered the same: no fields. */
export function EsicTab() {
  return (
    <div>
      <br /><br />
      <div className="lg-btns center">
        <Link href="/" className="lg-btn lg-btn-red" style={{ textDecoration: "none" }}>Close</Link>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Labour Office */
interface LabRow { id: number; state_name: string; city: string; address: string }

export function LabourOfficeTab({ states, canCreate, canUpdate, canDelete }: { states: string[]; canCreate: boolean; canUpdate: boolean; canDelete: boolean }) {
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  const [rows, setRows] = useState<LabRow[]>([]);
  const [sel, setSel] = useState<LabRow | null>(null);
  const load = useCallback(async () => {
    try { setRows((await listItems<LabRow>(LAB, { pageSize: 500 })).results); } catch { setRows([]); }
  }, []);
  useEffect(() => { load(); }, [load]);
  // legacy dropdown has no "Select" item and selects the first state by default
  useEffect(() => { if (!state && states.length) setState(states[0]); }, [states, state]);
  const clear = () => { setSel(null); setCity(""); setAddress(""); setState(states[0] ?? ""); };
  const body = () => ({ state_name: state, city, address });
  const pick = (r: LabRow) => { setSel(r); setState(r.state_name); setCity(r.city || ""); setAddress(r.address || ""); };

  const save = async () => {
    const r = await createItem(LAB, body());
    if (r.ok) { alert(say(r.data, "Record Insert Sucessfuly !!", "")); clear(); load(); }
    else alert(errMsg(r.data) || "Record adding failed...");
  };
  const update = async () => {
    if (!sel) return;
    const r = await updateItem(LAB, sel.id, body());
    if (r.ok) { alert(say(r.data, "Record Updated Succsefully", "")); clear(); load(); }
    else alert(errMsg(r.data) || "Record Updated Faild!");
  };
  const del = async () => {
    if (!sel) return;
    if (!confirm("Are you Sure You Want to Delete Record")) { alert("Record not Available"); return; }
    const r = await deleteItem(LAB, sel.id);
    alert(r.ok ? "Record Deleted Succsefully" : (errMsg(r.data) || "Record Deleted Faild!"));
    clear(); load();
  };

  return (
    <div>
      <div className="lg-form cols3">
        <Sel label="State:" value={state} onChange={setState} opts={states.map((s) => ({ v: s, t: s }))} />
        <Txt label="Labour Regional Office:" value={city} onChange={setCity} />
        <Txt label="Address:" value={address} onChange={setAddress} />
      </div>
      <div className="lg-btns center">
        {canCreate && !sel && <button className="lg-btn lg-btn-green" onClick={save}>Save</button>}
        {canUpdate && sel && <button className="lg-btn lg-btn-green" onClick={update}>Update</button>}
        {canDelete && sel && <button className="lg-btn lg-btn-red" onClick={del}>Delete</button>}
        <Link href="/" className="lg-btn lg-btn-red" style={{ textDecoration: "none" }}>Close</Link>
      </div>
      <div className="dt-scroll"><table className="dt-grid">
        <thead><tr><th>State Name</th><th>Labour Regional Office</th><th>Address</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center", color: "#777" }}>No records</td></tr>}
          {rows.map((r) => (
            <tr key={r.id} className={sel?.id === r.id ? "dt-selected" : ""} style={{ cursor: "pointer" }} onClick={() => pick(r)}>
              <td>{r.state_name}</td><td>{r.city}</td><td>{r.address}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

/* ----------------------------------------------------------- TDS Master */
interface TdsRow {
  id: number; tax_codes: string; section: string; nature_of_payment: string; threshold_limit: string;
  resident_tds_rate: number; non_resident_tds_rate: number; tds_from_date: string; tds_to_date: string;
}
const TDS_EMPTY = { from: "", to: "", code: "", section: "", nature: "", limit: "", res: "", nonres: "" };

export function TdsTab({ canCreate, canUpdate }: { canCreate: boolean; canUpdate: boolean }) {
  const [f, setF] = useState({ ...TDS_EMPTY });
  const [rows, setRows] = useState<TdsRow[]>([]);
  const [sel, setSel] = useState<TdsRow | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const load = useCallback(async () => {
    try { setRows((await listItems<TdsRow>(TDS, { pageSize: 500 })).results); } catch { setRows([]); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const clear = () => { setSel(null); setF({ ...TDS_EMPTY }); };
  const body = () => ({
    tds_from_date: f.from, tds_to_date: f.to, tax_codes: f.code, section: f.section, nature_of_payment: f.nature,
    threshold_limit: f.limit, resident_tds_rate: f.res, non_resident_tds_rate: f.nonres,
  });
  const pick = (r: TdsRow) => {
    setSel(r);
    setF({ from: r.tds_from_date || "", to: r.tds_to_date || "", code: r.tax_codes || "", section: r.section || "",
      nature: r.nature_of_payment || "", limit: r.threshold_limit || "",
      res: String(r.resident_tds_rate ?? ""), nonres: String(r.non_resident_tds_rate ?? "") });
  };
  const save = async () => {
    const r = await createItem(TDS, body());
    if (r.ok) { alert(say(r.data, "Record added successfully!!", "")); clear(); load(); }
    else alert(errMsg(r.data) || "Record adding failed...");
  };
  const update = async () => {
    if (!sel) return;
    const r = await updateItem(TDS, sel.id, body());
    if (r.ok) { alert(say(r.data, "Record Updated Succsefully", "")); clear(); load(); }
    else alert(errMsg(r.data) || "Record Updated Faild!");
  };

  return (
    <div>
      <div className="lg-form cols3">
        <Txt label="Effective From Date :" req type="date" value={f.from} onChange={(v) => set("from", v)} />
        <Txt label="Effective To Date :" req type="date" value={f.to} onChange={(v) => set("to", v)} />
        <Txt label="Tax Codes :" req value={f.code} onChange={(v) => set("code", v)} />
        <Txt label="Section :" req value={f.section} onChange={(v) => set("section", v)} />
        <Txt label="Nature of payment :" req value={f.nature} onChange={(v) => set("nature", v)} />
        <Txt label="Threshold Limit :" req value={f.limit} onChange={(v) => set("limit", v.replace(/[^0-9]/g, ""))} />
        <Txt label="Resident TDS Rate (%) :" req value={f.res} onChange={(v) => set("res", onlyDec(v))} />
        <Txt label="Non-resident TDS Rate (%) :" req value={f.nonres} onChange={(v) => set("nonres", onlyDec(v))} />
      </div>
      <div className="lg-btns center">
        {canCreate && !sel && <button className="lg-btn lg-btn-green" onClick={save}>Save</button>}
        {canUpdate && sel && <button className="lg-btn lg-btn-green" onClick={update}>Update</button>}
        <button className="lg-btn lg-btn-green" onClick={clear}>Clear</button>
        <Link href="/" className="lg-btn lg-btn-red" style={{ textDecoration: "none" }}>Close</Link>
      </div>
      <div className="dt-scroll"><table className="dt-grid">
        <thead><tr><th>Tax Codes</th><th>Section</th><th>Nature of payment</th><th>Threshold Limit</th>
          <th>Resident TDS Rate (%)</th><th>Non-resident TDS Rate (%)</th><th>Effective From Date</th><th>Effective To Date</th></tr></thead>
        <tbody>
          {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "#777" }}>No records</td></tr>}
          {rows.map((r) => (
            <tr key={r.id} className={sel?.id === r.id ? "dt-selected" : ""} style={{ cursor: "pointer" }} onClick={() => pick(r)}>
              <td>{r.tax_codes}</td><td>{r.section}</td><td>{r.nature_of_payment}</td><td>{r.threshold_limit}</td>
              <td>{r.resident_tds_rate}</td><td>{r.non_resident_tds_rate}</td><td>{r.tds_from_date}</td><td>{r.tds_to_date}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}

/** Tabs whose legacy behaviour depends on files / statutory exports that are not ported yet. */
export function NotPortedTab({ name, why }: { name: string; why: string }) {
  return (
    <div style={{ padding: 16 }}>
      <b>{name}</b> is not available in this version.<br />
      <span style={{ color: "#666" }}>{why}</span>
      <div style={{ marginTop: 12 }}><Link href="/" className="lg-btn lg-btn-red" style={{ textDecoration: "none" }}>Close</Link></div>
    </div>
  );
}

/* ------------------------------------------------------- UAN Number Details (menu8) */
const UAN = "/api/payroll/uan-export";
async function uanGet<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API_BASE_URL}${UAN}/${path}`, { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" });
    return r.ok ? ((await r.json()) as T) : null;
  } catch { return null; }
}

export function UanTab() {
  const [clients, setClients] = useState<Opt[]>([{ v: "ALL", t: "ALL" }]);
  const [states, setStates] = useState<Opt[]>([]);
  const [units, setUnits] = useState<Opt[]>([]);
  const [client, setClient] = useState("ALL");
  const [state, setState] = useState("ALL");
  const [unit, setUnit] = useState("Select Unit");

  useEffect(() => {
    (async () => {
      const d = await uanGet<{ results: { name: string; code: string }[] }>("clients/");
      if (d) setClients(d.results.map((c) => ({ v: c.code, t: c.name })));
      // legacy: the state list is filled for ALL on first load
      const s = await uanGet<{ results: string[] }>("states/?client_code=ALL");
      if (s) setStates(s.results.map((x) => ({ v: x, t: x })));
    })();
  }, []);

  // ddl_uan_client_SelectedIndexChanged
  const onClient = async (v: string) => {
    setClient(v); setState("ALL"); setUnit("Select Unit"); setUnits([]);
    const s = await uanGet<{ results: string[] }>(`states/?client_code=${encodeURIComponent(v)}`);
    setStates((s?.results ?? ["ALL"]).map((x) => ({ v: x, t: x })));
  };
  // ddl_uan_state_SelectedIndexChanged
  const onState = async (v: string) => {
    setState(v); setUnit("Select Unit");
    const u = await uanGet<{ results: { name: string; code: string }[] }>(
      `units/?client_code=${encodeURIComponent(client)}&state_name=${encodeURIComponent(v)}`);
    setUnits([{ v: "Select Unit", t: "Select Unit" }, ...((u?.results ?? []).map((x) => ({ v: x.code, t: x.name })))]);
  };

  // uan_detail_validation()
  const validate = (): boolean => {
    if (client === "ALL") { alert("Please Select Client Name"); return false; }
    if (state === "ALL") { alert("Please Select State Name"); return false; }
    if (unit === "Select Unit") { alert("Please Select Unit Name"); return false; }
    return true;
  };
  const download = async (kind: "excel" | "csv", fallback: string) => {
    if (!validate()) return;
    try {
      const q = `client_code=${encodeURIComponent(client)}&state_name=${encodeURIComponent(state)}&unit_code=${encodeURIComponent(unit)}`;
      const r = await fetch(`${API_BASE_URL}${UAN}/${kind}/?${q}`, { credentials: "include" });
      if (r.status === 403) { alert("You do not have permission for this action."); return; }
      if (!r.ok) {
        let m = "Download failed."; try { const j = await r.json(); m = (j && j.detail) || m; } catch { /* keep */ }
        alert(m); return;
      }
      const cd = r.headers.get("content-disposition") || "";
      const m = /filename="?([^";]+)"?/i.exec(cd);
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = m ? m[1] : fallback;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { alert("Download failed."); }
  };

  return (
    <div style={{ padding: 8 }}>
      <div className="lg-form cols3">
        <Sel label="Client Name" value={client} onChange={onClient} opts={clients} />
        <Sel label="State Name" value={state} onChange={onState} opts={states.length ? states : [{ v: "ALL", t: "ALL" }]} />
        <Sel label="Unit Name" value={unit} onChange={setUnit} opts={units.length ? units : [{ v: "Select Unit", t: "Select Unit" }]} />
      </div>
      <div className="lg-btns center">
        <button className="lg-btn lg-btn-green" onClick={() => download("excel", "UAN_Number_Details.xlsx")}>UAN Excel Download</button>
        <button className="lg-btn lg-btn-green" onClick={() => download("csv", "UAN.csv")}>UAN CVC Download</button>
        <Link href="/" className="lg-btn lg-btn-red" style={{ textDecoration: "none" }}>Close</Link>
      </div>
    </div>
  );
}
