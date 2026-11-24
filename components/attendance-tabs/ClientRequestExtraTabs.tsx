"use client";
// Client Request Form -> Dispatch tab. 1:1 port of legacy client_request_form.aspx #menu1:
//   MaterialDispatchTab (Material Type = Material), InvoiceTab (Invoice), DuplicateIdTab (Duplicate ID-Card).
// Each export is self-contained. Optional prop onTypeChange lets the host page switch tabs when the
// user changes the "Material Type" dropdown (as the legacy page did); without it the type is fixed.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { getJSON, mk, patchJSON, responseMessage } from "@/lib/api/legacy-fetch";

type Kind = "1" | "2" | "3";
interface Opt { value: string; label: string; }
export interface DispatchTabProps { onTypeChange?: (kind: Kind) => void; }

const PREFIX: Record<Kind, string> = { "1": "req-material-dispatch", "2": "req-invoice", "3": "req-duplicate-id" };
const TYPE_OPTS: Opt[] = [{ value: "1", label: "Material" }, { value: "2", label: "Invoice" }, { value: "3", label: "Duplicate ID-Card" }];
const THROUGH_OPTS: Opt[] = [{ value: "1", label: "By Courier" }, { value: "2", label: "By Hand" }, { value: "3", label: "By Postal" }];
const BILLING_OPTS: Opt[] = [
  { value: "ALL", label: "ALL" }, { value: "1", label: "Manpower" }, { value: "2", label: "Material" }, { value: "3", label: "Conveyance" },
  { value: "4", label: "DeepClean" }, { value: "5", label: "Pest Control Billing" }, { value: "6", label: "Machine Rent Bill" }, { value: "7", label: "Arrears Billing" },
];
const lbl: React.CSSProperties = { fontWeight: 700 };
const red: React.CSSProperties = { color: "red" };
const SEL = "Select";

const EMPTY = {
  dispatch_through: SEL, material_dispatch_date: "", client_code: SEL, state_name: SEL, unit_code: SEL, emp_code: SEL,
  material_uniform_size: "", material_uniform_set: SEL, material_shoes_size: SEL, material_shoes_set: SEL, material_id_card: SEL,
  dublicate_id_card: SEL, material_person_name: "", material_receiver_name: "", material_shipping_address: "",
  billing_type: SEL, month_year: "", invoice_branch_name: "",
};
type Form = typeof EMPTY;

// ---------------------------------------------------------------- small widgets
function Field({ label, req, children }: { label: string; req?: boolean; children: React.ReactNode }) {
  return (
    <div className="col-sm-2 col-xs-12" style={{ marginBottom: 10 }}>
      <b style={lbl}>{label}</b>{req && <span style={red}> *</span>}
      {children}
    </div>
  );
}

function Select({ value, onChange, options, placeholder = true, disabled }: { value: string; onChange: (v: string) => void; options: Opt[]; placeholder?: boolean; disabled?: boolean }) {
  return (
    <select className="form-control" value={value} disabled={disabled} onChange={e => onChange(e.target.value)}>
      {placeholder && <option value={SEL}>{SEL}</option>}
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

const th: React.CSSProperties = { background: "#224173", color: "#fff", padding: "6px 8px", fontSize: "x-small", textTransform: "uppercase", whiteSpace: "nowrap" };
const td: React.CSSProperties = { padding: "6px 8px", fontSize: "x-small" };

function Grid({ cols, rows, onEdit, search, setSearch }: {
  cols: { head: string; key: string }[]; rows: any[]; onEdit: (r: any) => void; search: string; setSearch: (s: string) => void;
}) {
  const words = search.toLowerCase().split(" ").filter(Boolean);
  const shown = rows.filter(r => {
    if (!words.length) return true;
    const hay = cols.map(c => String(r[c.key] ?? "")).join(" ").toLowerCase();
    return words.every(w => hay.includes(w));          // legacy Search_Gridview_*: every word must match
  });
  return (
    <>
      <div className="row">
        <div className="col-sm-10 col-xs-12" />
        <div className="col-sm-2 col-xs-12" style={{ marginBottom: 8 }}>
          <b style={lbl}>Search :</b>
          <input className="form-control" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>
      <div style={{ overflowX: "auto", border: "none" }}>
        <table className="table" style={{ width: "100%", background: "#fff", border: "1px solid #ccc", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Sr No.</th>
              {cols.map(c => <th key={c.key + c.head} style={th}>{c.head}</th>)}
              <th style={th}>Edit</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={r.id} style={{ background: i % 2 ? "#fff" : "#EFF3FB" }}>
                <td style={td}>{i + 1}</td>
                {cols.map(c => <td key={c.key + c.head} style={td}>{String(r[c.key] ?? "")}</td>)}
                <td style={td}>
                  {r.can_edit && <button type="button" className="btn btn-primary" style={{ color: "white", padding: "2px 10px" }} onClick={() => onEdit(r)}>Edit</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- shared engine
function DispatchTab({ kind, onTypeChange }: { kind: Kind } & DispatchTabProps) {
  const base = `/api/attendance/${PREFIX[kind]}/`;
  const [f, setF] = useState<Form>({ ...EMPTY });
  const [editId, setEditId] = useState<number | null>(null);
  const [clients, setClients] = useState<Opt[]>([]);
  const [states, setStates] = useState<Opt[]>([]);
  const [branches, setBranches] = useState<Opt[]>([]);
  const [emps, setEmps] = useState<Opt[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<Form>) => setF(s => ({ ...s, ...p }));

  // select_client(): clients with client_active_close = 0
  useEffect(() => {
    (async () => {
      const d = await getJSON<{ results: any[] }>(`${base}lookup/clients/`);
      setClients((d?.results ?? []).map(c => ({ value: c.client_code, label: c.client_name })));
    })();
  }, [base]);

  const loadList = useCallback(async (s: Form) => {
    if (s.dispatch_through === SEL || s.client_code === SEL || (kind === "2" && s.billing_type === SEL)) { setRows([]); return; }
    const q = new URLSearchParams({ dispatch_through: s.dispatch_through, client_code: s.client_code });
    if (kind === "2") q.set("billing_type", s.billing_type);
    const d = await getJSON<{ results: any[] }>(`${base}?${q.toString()}`);
    setRows(d?.results ?? []);
  }, [base, kind]);

  const loadStates = async (client: string) => {
    const d = await getJSON<{ results: string[] }>(`${base}lookup/states/?client_code=${encodeURIComponent(client)}`);
    setStates([{ value: "ALL", label: "ALL" }, ...(d?.results ?? []).map(s => ({ value: s, label: s }))]);
  };
  const loadBranches = async (client: string, state: string) => {
    const d = await getJSON<{ results: any[] }>(`${base}lookup/branches/?client_code=${encodeURIComponent(client)}&state_name=${encodeURIComponent(state)}`);
    setBranches([{ value: "ALL", label: "ALL" }, ...(d?.results ?? []).map(b => ({ value: b.unit_code, label: b.unit_name }))]);
  };
  const loadEmps = async (client: string, state: string, unit: string) => {
    const d = await getJSON<{ results: any[]; shipping_address?: string }>(
      `${base}lookup/employees/?client_code=${encodeURIComponent(client)}&state_name=${encodeURIComponent(state)}&unit_code=${encodeURIComponent(unit)}`);
    setEmps((d?.results ?? []).map(e => ({ value: e.emp_code, label: e.emp_name })));
    return d?.shipping_address ?? "";
  };
  const loadInvoiceShipping = async (client: string, state: string, billing: string) => {
    const d = await getJSON<{ shipping_address?: string }>(
      `${base}lookup/invoice-shipping/?client_code=${encodeURIComponent(client)}&state_name=${encodeURIComponent(state)}&billing_type=${encodeURIComponent(billing)}`);
    return d?.shipping_address ?? "";
  };

  // ---- cascade handlers (ddl_*_SelectedIndexChanged)
  const onThrough = (v: string) => { const n = { ...f, dispatch_through: v }; setF(n); loadList(n); };
  const onClient = async (v: string) => {
    const n = { ...f, client_code: v, state_name: SEL, unit_code: SEL, emp_code: SEL, invoice_branch_name: "" };
    setF(n); setStates([]); setBranches([]); setEmps([]);
    if (v === SEL) { setRows([]); return; }
    await loadStates(v);
    loadList(n);
  };
  const onState = async (v: string) => {
    set({ state_name: v, unit_code: SEL, emp_code: SEL, invoice_branch_name: "" });
    setBranches([]); setEmps([]);
    if (v === SEL) return;
    await loadBranches(f.client_code, v);
    if (kind === "2") { const a = await loadInvoiceShipping(f.client_code, v, f.billing_type); set({ material_shipping_address: a }); }
  };
  const onBranch = async (v: string) => {
    const label = branches.find(b => b.value === v)?.label ?? "";
    set({ unit_code: v, emp_code: SEL, invoice_branch_name: v === SEL ? "" : label });
    if (kind === "2" || v === SEL) return;
    setEmps([]);
    const addr = await loadEmps(f.client_code, f.state_name, v);
    set({ material_shipping_address: addr });
  };
  const onEmp = (v: string) => {
    set({ emp_code: v });
    if (v !== SEL) set({ emp_code: v, material_receiver_name: emps.find(e => e.value === v)?.label ?? "" });
  };
  const onBilling = async (v: string) => {
    const n = { ...f, billing_type: v };
    setF(n); loadList(n);
    if (f.state_name !== SEL && f.client_code !== SEL) { const a = await loadInvoiceShipping(f.client_code, f.state_name, v); set({ material_shipping_address: a }); }
  };

  // ---- client-side validation, same order + text as legacy material_validation()/Invoice_validation()
  const validate = (): string | null => {
    if (f.dispatch_through === SEL) return "Please Select Dispatch Through";
    if (kind === "2") {
      if (f.billing_type === SEL || f.billing_type === "ALL") return "Please Select Billing Type";
      if (f.client_code === SEL) return "Please Select Client Name";
      if (f.state_name === SEL) return "Please Select State Name";
      if (f.unit_code === SEL) return "Please Select Location Name";
      if (!f.month_year) return "Please Enter Month/Year";
      if (!f.material_dispatch_date) return "Please Enter Invoice Requested On Date";
      if (!f.material_shipping_address.trim()) return "Please Enter Invoice Shipping Address";
      if (f.dispatch_through === "2" && !f.material_person_name.trim()) return "Please Enter Invoice Person Name";
      return null;
    }
    if (!f.material_dispatch_date) return "Please Enter Requested On Date";
    if (f.client_code === SEL) return "Please Select Client Name";
    if (f.state_name === SEL) return "Please Select State Name";
    if (f.unit_code === SEL) return "Please Select Location Name";
    if (f.emp_code === SEL) return "Please Select Employee Name";
    if (kind === "3") {
      if (f.dublicate_id_card === SEL) return "Please Select Dublicate Id Card";
    } else {
      if (!f.material_uniform_size.trim()) return "Please Enter Uniform Size";
      if (f.material_uniform_set === SEL) return "Please Select Uniform Set";
      if (f.material_shoes_size === SEL) return "Please Select Shoes Size";
      if (f.material_shoes_set === SEL) return "Please Select Shoes Set";
      if (f.material_id_card === SEL) return "Please Select New Id Card";
    }
    if (f.dispatch_through === "2" && !f.material_person_name.trim()) return "Please Enter Person Name";
    if (!f.material_receiver_name.trim()) return "Please Enter Receiver Name";
    if (!f.material_shipping_address.trim()) return "Please Enter Shipping Address";
    return null;
  };

  const payload = () => {
    const p: Record<string, string> = { material_type: kind };
    (Object.keys(f) as (keyof Form)[]).forEach(k => { p[k] = f[k] === SEL ? "" : f[k]; });
    if (kind === "2" && f.month_year) { const [y, m] = f.month_year.split("-"); p.month_year = `${m}/${y}`; }
    return p;
  };

  const clear = () => { setF({ ...EMPTY }); setEditId(null); setStates([]); setBranches([]); setEmps([]); setRows([]); };

  const run = async (act: "save" | "update" | "approve") => {
    const err = validate();
    if (err) { window.alert(err); return; }
    setBusy(true);
    try {
      let r: Response;
      if (act === "save") r = await mk(base, payload());
      else if (act === "update") r = await patchJSON(`${base}${editId}/`, payload());
      else r = await mk(`${base}approve/`, payload());
      if (!r.ok) { window.alert(await responseMessage(r, act === "save" ? "Record Save failed!!" : "Record Not Updated!!")); }
      else {
        const body = await r.json().catch(() => ({} as any));
        window.alert(body?.detail || (act === "save" ? "Record Save successfully !!" : act === "update" ? "Record Updated successfully!!" : "Record Approve successfully!!"));
      }
      if (act === "approve" && r.ok) { clear(); }          // legacy text_clear_material()/text_clear_invoice()
      else { await loadList(f); }
    } finally { setBusy(false); }
  };

  // link_edit_*_Click: load the row into the form and replay the cascades
  const onEdit = async (r: any) => {
    setBusy(true);
    try {
      await loadStates(r.client_code);
      await loadBranches(r.client_code, r.state_name);
      if (kind !== "2") await loadEmps(r.client_code, r.state_name, r.unit_code);
      const [mm, yy] = String(r.month_year || "").split("/");
      const through = THROUGH_OPTS.find(o => o.label === r.dispatch_through)?.value ?? SEL;
      setEditId(r.id);
      setF({
        ...EMPTY,
        dispatch_through: through, material_dispatch_date: r.material_dispatch_date_iso || "",
        client_code: r.client_code, state_name: r.state_name, unit_code: r.unit_code, emp_code: r.emp_code || SEL,
        material_uniform_size: r.material_uniform_size || "", material_uniform_set: r.material_uniform_set || SEL,
        material_shoes_size: r.material_shoes_size || SEL, material_shoes_set: r.material_shoes_set || SEL,
        material_id_card: r.material_id_card || SEL, dublicate_id_card: r.dublicate_id_card || SEL,
        material_person_name: r.material_person_name || "", material_receiver_name: r.material_receiver_name || "",
        material_shipping_address: r.material_shipping_address || "",
        billing_type: r.billing_type_code || SEL, month_year: mm && yy ? `${yy}-${mm}` : "", invoice_branch_name: r.invoice_branch_name || "",
      });
    } finally { setBusy(false); }
  };

  const cols = useMemo(() => {
    if (kind === "1") return [
      ["Material Type", "material_type"], ["Dispatch Through", "dispatch_through"], ["Client Name", "client_name"], ["State Name", "state_name"],
      ["Location Name", "unit_name"], ["Employee Name", "emp_name"], ["Request on Date", "material_dispatch_date"], ["Uniform Size", "material_uniform_size"],
      ["Uniform Set", "material_uniform_set"], [" Shoes Size", "material_shoes_size"], ["Shoes Set", "material_shoes_set"], [" Receiver Name", "material_receiver_name"],
      [" Shipping Address", "material_shipping_address"], ["Reason", "material_hold_reason"], ["Status", "approve_record"],
    ];
    if (kind === "2") return [
      ["Material Type", "material_type"], ["Dispatch Through", "dispatch_through"], ["Client Name", "client_name"], ["State Name", "state_name"],
      ["Location Name", "invoice_branch_name"], ["Requested On Date", "material_dispatch_date"], ["Month/Year", "month_year"], ["Billing Type", "billing_type"],
      ["Person Name", "material_person_name"], ["Material Shipping Address", "material_shipping_address"], ["Reason", "material_hold_reason"], ["Status", "approve_record"],
    ];
    return [
      ["Material Type", "material_type"], ["Dispatch Through", "dispatch_through"], ["Client Name", "client_name"], ["State Name", "state_name"],
      ["Location Name", "unit_name"], ["Employee Name", "emp_name"], ["Requested On Date", "material_dispatch_date"], [" Receiver Name", "material_receiver_name"],
      ["Person Name", "material_person_name"], [" Shipping Address", "material_shipping_address"], ["Reason", "material_hold_reason"], ["Status", "approve_record"],
    ];
  }, [kind]).map(([head, key]) => ({ head, key }));

  const byHand = f.dispatch_through === "2";
  const typeSelect = (
    <Field label="Material Type:" req>
      <select className="form-control" value={kind} disabled={!onTypeChange} onChange={e => onTypeChange?.(e.target.value as Kind)}>
        <option value={SEL}>{SEL}</option>
        {TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );

  return (
    <div className="container-fluid" style={{ border: "none" }}>
      <br />
      <div className="row">
        {typeSelect}
        <Field label="Dispatch Through:" req><Select value={f.dispatch_through} onChange={onThrough} options={THROUGH_OPTS} /></Field>
      </div>

      {kind !== "2" && (
        <div className="panel panel-primary" style={{ border: "none" }}>
          <div className="container-fluid" style={{ border: "none" }}>
            <br />
            <div className="row">
              <Field label="Request On Date :" req>
                <input className="form-control" type="date" value={f.material_dispatch_date} onChange={e => set({ material_dispatch_date: e.target.value })} />
              </Field>
              <Field label="client Name:" req><Select value={f.client_code} onChange={onClient} options={clients} /></Field>
              <Field label="State Name:" req><Select value={f.state_name} onChange={onState} options={states} /></Field>
              <Field label="Location Name:" req><Select value={f.unit_code} onChange={onBranch} options={branches} /></Field>
              <Field label="Employee Name:" req><Select value={f.emp_code} onChange={onEmp} options={emps} /></Field>
              {kind === "1" && (
                <Field label="Uniform Size:"><input className="form-control" maxLength={100} value={f.material_uniform_size} onChange={e => set({ material_uniform_size: e.target.value })} /></Field>
              )}
            </div>
            <br />
            <div className="row">
              {kind === "1" && (
                <>
                  <Field label="Uniform Set:" req><Select value={f.material_uniform_set} onChange={v => set({ material_uniform_set: v })} options={[{ value: "1", label: "1" }, { value: "2", label: "2" }]} /></Field>
                  <Field label="Shoes size:" req><Select value={f.material_shoes_size} onChange={v => set({ material_shoes_size: v })} options={["5", "6", "7", "8", "9", "10"].map(x => ({ value: x, label: x }))} /></Field>
                  <Field label="Shoes Set:" req><Select value={f.material_shoes_set} onChange={v => set({ material_shoes_set: v })} options={[{ value: "1", label: "1" }]} /></Field>
                  <Field label="New ID Card:" req><Select value={f.material_id_card} onChange={v => set({ material_id_card: v })} options={[{ value: "0", label: "0" }, { value: "1", label: "1" }]} /></Field>
                </>
              )}
              {kind === "3" && (
                <Field label="Duplicate ID Card:" req><Select value={f.dublicate_id_card} onChange={v => set({ dublicate_id_card: v })} options={[{ value: "1", label: "1" }]} /></Field>
              )}
              {byHand && (
                <Field label="Person Name:"><input className="form-control" value={f.material_person_name} onChange={e => set({ material_person_name: e.target.value })} /></Field>
              )}
              <Field label="Receiver Name:"><input className="form-control" value={f.material_receiver_name} onChange={e => set({ material_receiver_name: e.target.value })} /></Field>
            </div>
            <br />
            <div className="row">
              <Field label="Shipping address:">
                <textarea className="form-control" rows={6} maxLength={200} value={f.material_shipping_address} onChange={e => set({ material_shipping_address: e.target.value })} />
              </Field>
            </div>
            <br />
          </div>
        </div>
      )}

      {kind === "2" && (
        <div className="panel panel-primary" style={{ border: "none" }}>
          <div className="container-fluid" style={{ border: "none" }}>
            <div className="row">
              <br />
              <Field label="Billing Type:" req><Select value={f.billing_type} onChange={onBilling} options={BILLING_OPTS} /></Field>
              <Field label="client Name:" req><Select value={f.client_code} onChange={onClient} options={clients} /></Field>
              <Field label="State Name:" req><Select value={f.state_name} onChange={onState} options={states} /></Field>
              <Field label="Location Name:" req><Select value={f.unit_code} onChange={onBranch} options={branches} /></Field>
              <Field label="Month/Year:" req>
                <input className="form-control" type="month" value={f.month_year} onChange={e => set({ month_year: e.target.value })} />
              </Field>
              <Field label="Request On Date :" req>
                <input className="form-control" type="date" value={f.material_dispatch_date} onChange={e => set({ material_dispatch_date: e.target.value })} />
              </Field>
            </div>
            <br />
            <div className="row">
              <Field label="Invoice Shipping address:">
                <textarea className="form-control" rows={6} maxLength={200} value={f.material_shipping_address} onChange={e => set({ material_shipping_address: e.target.value })} />
              </Field>
              {byHand && (
                <Field label="Person Name:"><input className="form-control" value={f.material_person_name} onChange={e => set({ material_person_name: e.target.value })} /></Field>
              )}
            </div>
            <br />
          </div>
        </div>
      )}

      <div className="row text-center" style={{ width: "100%", marginBottom: 15 }}>
        {editId === null && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run("save")}>Submit</button>}{" "}
        {editId !== null && <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run("update")}>Update</button>}{" "}
        <button type="button" className="btn btn-primary" disabled={busy} onClick={() => run("approve")}>Approve</button>{" "}
        <button type="button" className="btn btn-danger" onClick={clear}>Close</button>
      </div>

      <Grid cols={cols} rows={rows} onEdit={onEdit} search={search} setSearch={setSearch} />
    </div>
  );
}

export function MaterialDispatchTab(props: DispatchTabProps) { return <DispatchTab kind="1" {...props} />; }
export function InvoiceTab(props: DispatchTabProps) { return <DispatchTab kind="2" {...props} />; }
export function DuplicateIdTab(props: DispatchTabProps) { return <DispatchTab kind="3" {...props} />; }
