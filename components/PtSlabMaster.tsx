"use client";

/**
 * PT- Slab Master — exact replica of legacy PTSlabMaster.aspx (PT-slab core tab).
 *
 * Same title, same field labels/order (State/From Amount/To Amount/Slab Amount/
 * From Month/To Month), same month dropdowns (Select Month + January..December),
 * same grid columns (ID/State Name/From Amount/To Amount/Slab Amount/From Month/
 * To Month, months shown as names with the legacy 'Januray' typo from the API),
 * same buttons (Save/Clear/Update/Delete/Export TO Excel/Close), same validation
 * messages + order (Req_validation), same To-Amount compare (clears + focuses the
 * To box), same delete confirm (Req_validation1).
 *
 * Persistence: /api/payroll/slabs (server-validated). Export downloads the same
 * 4 legacy columns as CSV (legacy opened server-side Excel Interop, which cannot
 * work over HTTP — data identical).
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import { API_BASE_URL } from "@/lib/api/client";
import { listItems, createItem, updateItem, deleteItem } from "@/lib/api/crud";
import { Sel, Txt, onlyDec, levelForMenu, errMsg, type Opt } from "@/components/formkit";
import { PfTab, EsicTab, LabourOfficeTab, TdsTab, UanTab, NotPortedTab } from "@/components/PtStatutoryTabs";
import { LwfMaster } from "@/components/LwfMaster";

// legacy tab strip (PTSlabMaster.aspx:1170-1183)
const TABS = ["PT-Slab Master", "PF", "ESIC", "LWF", "ESIC Uploading", "PF Uploading", "PT Uploading",
  "Labour Office", "UAN Number Details", "Clientwise PF-ESIC", "Bonus/Leave/Gratuity Reports", "TDS Master"];
const NOT_PORTED: Record<number, string> = {
  4: "It stores ESIC acknowledgement / challan / ECR files and builds the ESIC statement; the file store and statement are not part of this version.",
  5: "It stores PF acknowledgement / TRRN / challan / ECR files and builds the PF statement and Diff-ECR report; the file store and reports are not part of this version.",
  6: "It builds the state-wise PT report from the legacy Crystal/Excel templates, which are not part of this version.",
  9: "The PF / ESIC statement sheets for a client are not part of this version.",
  10: "The Bonus / Leave / Gratuity statutory reports are not part of this version.",
};

const BASE = "/api/payroll/slabs";
const MENU = "PT- Slab Master";

const MONTHS: Opt[] = [
  { v: "0", t: "Select Month" }, { v: "1", t: "January" }, { v: "2", t: "February" },
  { v: "3", t: "March" }, { v: "4", t: "April" }, { v: "5", t: "May" }, { v: "6", t: "June" },
  { v: "7", t: "July" }, { v: "8", t: "August" }, { v: "9", t: "September" },
  { v: "10", t: "October" }, { v: "11", t: "November" }, { v: "12", t: "December" },
];

interface Slab {
  id: number; state_name: string; from_amount: string; to_amount: string; slab_amount: string;
  from_month: number | null; to_month: number | null;
  from_month_name: string; to_month_name: string;
}
type Form = Record<string, string>;
const EMPTY: Form = {
  state_name: "Select", from_amount: "", to_amount: "", slab_amount: "",
  from_month: "0", to_month: "0",
};

export default function PtSlabMaster() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [f, setF] = useState<Form>({ ...EMPTY });
  const [selected, setSelected] = useState<Slab | null>(null);
  const [rows, setRows] = useState<Slab[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [states, setStates] = useState<string[]>([]);
  const [tab, setTab] = useState(0);

  const level = levelForMenu(me?.permissions, MENU, !!me?.is_staff);
  const canCreate = level >= 3, canUpdate = level >= 2, canDelete = !!me?.is_staff || level >= 4;
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => { getMe().then((m) => { setMe(m); setAuthChecked(true); }); }, []);
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}/api/masters/states/lookup/`, { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as { states?: string[]; results?: { state_name: string }[] };
        if (Array.isArray(d.states)) setStates([...d.states].sort());
        else setStates(Array.from(new Set((d.results ?? []).map((s) => s.state_name))).sort());
      } catch { /* states stay empty */ }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await listItems<Slab>(BASE, { pageSize: 500 }); setRows(res.results); }
    catch { setRows([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (authChecked && me) load(); }, [authChecked, me, load]);

  const clearForm = () => { setSelected(null); setF({ ...EMPTY }); };

  const selectRow = (r: Slab) => {
    setSelected(r);
    setF({
      state_name: r.state_name || "Select",
      from_amount: String(r.from_amount ?? ""), to_amount: String(r.to_amount ?? ""),
      slab_amount: String(r.slab_amount ?? ""),
      from_month: String(r.from_month ?? "0"), to_month: String(r.to_month ?? "0"),
    });
  };

  // exact legacy Req_validation() order (client mirror of the server rules)
  const validate = (): string | null => {
    if (!f.state_name || f.state_name === "Select") return "Please Select state  !!!";
    if (!f.from_amount.trim()) return "Please Enter Form Amount";
    if (!f.to_amount.trim()) return "Please Enter To Amount";
    if (!f.slab_amount.trim()) return "Please Enter the Slab Amount";
    if (!f.from_month || f.from_month === "0") return "Please Select From Month";
    if (!f.to_month || f.to_month === "0") return "Please Select To Month";
    return compareAmounts(false);
  };

  // legacy validate(): To must exceed From; clears + focuses the To box.
  const compareAmounts = (clear: boolean): string | null => {
    if (f.from_amount.trim() !== "" && f.to_amount.trim() !== "") {
      const lo = parseFloat(f.from_amount), hi = parseFloat(f.to_amount);
      if (!isNaN(lo) && !isNaN(hi) && lo >= hi) {
        if (clear) set("to_amount", "");
        return "To Amount should be greater than From Amount.";
      }
    }
    return null;
  };

  const payload = () => ({
    state_name: f.state_name, from_amount: f.from_amount.trim(), to_amount: f.to_amount.trim(),
    slab_amount: f.slab_amount.trim(),
    from_month: parseInt(f.from_month, 10), to_month: parseInt(f.to_month, 10),
  });

  const onSave = async () => {
    const err = validate(); if (err) { alert(err); return; }
    setBusy(true);
    try {
      const res = await createItem<Slab>(BASE, payload());
      if (res.ok) { alert("Record added successfully!!"); clearForm(); load(); }
      else if (res.status === 403) alert("You do not have permission for this action.");
      else alert(errMsg(res.data) || "Record adding failed...");
    } finally { setBusy(false); }
  };
  const onUpdate = async () => {
    if (!selected) return;
    const err = validate(); if (err) { alert(err); return; }
    setBusy(true);
    try {
      const res = await updateItem<Slab>(BASE, selected.id, payload());
      if (res.ok) { alert("PT Slab Updated Successfully"); clearForm(); load(); }
      else if (res.status === 403) alert("You do not have permission for this action.");
      else alert(errMsg(res.data) || "Record updating failed...");
    } finally { setBusy(false); }
  };
  const onDelete = async () => {
    if (!selected) { alert("Record not Available"); return; }
    const r = confirm("Are you Sure You Want to Delete Record");
    if (r !== true) { alert("Record not Available"); return; }
    setBusy(true);
    try {
      const res = await deleteItem(BASE, selected.id);
      if (res.ok) { alert("Record deleted successfully!!"); clearForm(); load(); }
      else if (res.status === 403) alert("Only administrators can delete a record.");
      else alert(errMsg(res.data) || "Record deletion failed...");
    } finally { setBusy(false); }
  };
  const onExport = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}${BASE}/export/`, { credentials: "include" });
      if (r.status === 403) { alert("You do not have permission for this action."); return; }
      if (!r.ok) { alert("Export failed."); return; }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "pt_slab_list.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { alert("Export failed."); }
  };

  const stOpts: Opt[] = [{ v: "Select", t: "Select" }, ...states.map((s) => ({ v: s, t: s }))];

  if (authChecked && !me) {
    return <div className="lg-panel"><div className="lg-panel-head">PT Slab Master</div>
      <div style={{ padding: 16 }}>🔐 Sign in required. <Link href="/login">Go to login</Link></div></div>;
  }

  return (
    <div className="lg-panel">
      <div className="lg-panel-head" style={{ textAlign: "center" }}>PT SLAB MASTER</div>
      <div className="lg-panel-body">
        <ul className="nav nav-tabs" style={{ marginBottom: 12, flexWrap: "wrap" }}>
          {TABS.map((t, i) => (
            <li key={t} className={tab === i ? "active" : ""}>
              <a href="#" onClick={(e) => { e.preventDefault(); setTab(i); }}><b>{t}</b></a>
            </li>
          ))}
        </ul>
        {tab === 1 && <PfTab canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete} />}
        {tab === 2 && <EsicTab />}
        {tab === 3 && <LwfMaster />}
        {tab === 7 && <LabourOfficeTab states={states} canCreate={canCreate} canUpdate={canUpdate} canDelete={canDelete} />}
        {tab === 8 && <UanTab />}
        {tab === 11 && <TdsTab canCreate={canCreate} canUpdate={canUpdate} />}
        {NOT_PORTED[tab] && <NotPortedTab name={TABS[tab]} why={NOT_PORTED[tab]} />}
        {tab === 0 && (<>
        <div className="lg-form cols3">
          <Sel label="State :" req value={f.state_name} onChange={(v) => set("state_name", v)} opts={stOpts} />
          <Txt label="From Amount :" req value={f.from_amount} onChange={(v) => set("from_amount", onlyDec(v))} maxLength={10} />
          <Txt label="To Amount :" req value={f.to_amount} onChange={(v) => {
            const nv = onlyDec(v);
            set("to_amount", nv);
          }} maxLength={10} />
          <Txt label="Slab Amount :" req value={f.slab_amount} onChange={(v) => set("slab_amount", onlyDec(v))} maxLength={10} />
          <Sel label="From Month :" req value={f.from_month} onChange={(v) => set("from_month", v)} opts={MONTHS} />
          <Sel label="To Month :" req value={f.to_month} onChange={(v) => set("to_month", v)} opts={MONTHS} />
        </div>

        <div className="lg-btns center">
          {canCreate && !selected && <button className="lg-btn lg-btn-green" disabled={busy} onClick={onSave}>Save</button>}
          <button className="lg-btn lg-btn-green" onClick={clearForm}>Clear</button>
          {canUpdate && selected && <button className="lg-btn lg-btn-green" disabled={busy} onClick={onUpdate}>Update</button>}
          {canDelete && selected && <button className="lg-btn lg-btn-red" disabled={busy} onClick={onDelete}>Delete</button>}
          {level >= 4 && <button className="lg-btn lg-btn-green" disabled={busy} onClick={onExport}>Export TO Excel</button>}
          <Link href="/" className="lg-btn lg-btn-red" style={{ textDecoration: "none" }}>Close</Link>
        </div>

        {loading ? <p>Loading…</p> : (
          <div className="dt-scroll"><table className="dt-grid">
            <thead><tr><th>ID</th><th>State Name</th><th>From Amount</th><th>To Amount</th><th>Slab Amount</th><th>From Month</th><th>To Month</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "#777" }}>No slabs</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className={selected?.id === r.id ? "dt-selected" : ""} style={{ cursor: "pointer" }} onClick={() => selectRow(r)}>
                  <td>{r.id}</td><td>{r.state_name}</td><td>{r.from_amount}</td><td>{r.to_amount}</td>
                  <td>{r.slab_amount}</td><td>{r.from_month_name}</td><td>{r.to_month_name}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
        </>)}
      </div>
    </div>
  );
}
