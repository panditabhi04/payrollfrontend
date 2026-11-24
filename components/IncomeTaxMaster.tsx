"use client";

/**
 * Income Tax — exact replica of legacy Income_Tax.aspx.
 *
 * Same headings (Income Tax / Income Tax Details), same search row
 * (Select Gender / Search Income Tax (Year) / New / View Data), same entry row
 * (Type / Effective Since / Lower Value / Upper Value / ITax % / Cess /
 * Surcharge / [+] icon), same grid columns (Sr.No./Gender/Effective Since/
 * Lower Value/Upper Value/I.Tax %/Cess/Surcharge, editable textboxes, delete
 * icon with no confirm), same buttons (Save/Update/Delete/Cancel/Export To
 * Excel/Close), same validation messages (Req_Validation / R_Validation /
 * name_12), same delete confirm text, same "No Record Found." label.
 *
 * Flow mirrors legacy: New reveals the entry panel (Update/Delete hidden);
 * View Data searches by gender+year (found -> edit mode, not found ->
 * "No Record Found."); Save bulk-inserts the grid stamped with the header
 * type+Since; Update deletes by header type then reinserts the grid rows;
 * Delete removes the whole header type; Export downloads the same 6 legacy
 * columns as CSV (legacy opened server-side Excel Interop — data identical).
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import { API_BASE_URL } from "@/lib/api/client";
import { listItems, deleteItem } from "@/lib/api/crud";
import { Field, Sel, Txt, onlyNum, levelForMenu, errMsg, type Opt } from "@/components/formkit";

const BASE = "/api/payroll/income-tax";
const MENU = "Income Tax";

const GENDERS: Opt[] = [
  { v: "Select Type gender", t: "Select Type gender" },
  { v: "Senior Citizen", t: "Senior Citizen" },
  { v: "Male", t: "Male" },
  { v: "Female", t: "Female" },
];
const TYPES: Opt[] = [
  { v: "Select", t: "Select" },
  { v: "Senior Citizen", t: "Senior Citizen" },
  { v: "Male", t: "Male" },
  { v: "Female", t: "Female" },
];

interface Row {
  id?: number; type: string; effective_since: string; lower_value: string;
  upper_value: string; itax: string; cess: string; surcharge: string;
}
interface Draft { type: string; since: string; lower: string; upper: string; itax: string; cess: string; surcharge: string }
const EMPTY_DRAFT: Draft = { type: "Select", since: "", lower: "", upper: "", itax: "", cess: "", surcharge: "" };

async function postJSON<T>(path: string, body: unknown): Promise<{ ok: boolean; status: number; data: T }> {
  const m = document.cookie.match(new RegExp("(^|; )csrftoken=([^;]+)"));
  await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": m ? decodeURIComponent(m[2]) : "" },
    body: JSON.stringify(body),
  });
  let data: T;
  try { data = (await res.json()) as T; } catch { data = {} as T; }
  return { ok: res.ok, status: res.status, data };
}

export default function IncomeTaxMaster() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [panel, setPanel] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [noRecord, setNoRecord] = useState(false);
  const [gender, setGender] = useState("Select Type gender");
  const [year, setYear] = useState("");
  const [d, setD] = useState<Draft>({ ...EMPTY_DRAFT });
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const level = levelForMenu(me?.permissions, MENU, !!me?.is_staff);
  const canCreate = level >= 3, canUpdate = level >= 2, canDelete = !!me?.is_staff || level >= 4;
  const setDk = (k: keyof Draft, v: string) => setD((p) => ({ ...p, [k]: v }));

  useEffect(() => { getMe().then((m) => { setMe(m); setAuthChecked(true); }); }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try { const res = await listItems<Row>(BASE, { pageSize: 1000 }); setRows(res.results); }
    catch { setRows([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (authChecked && me) loadAll(); }, [authChecked, me, loadAll]);

  const onNew = () => {
    // legacy R_Validation on New: gender + year required
    if (gender === "Select Type gender") { alert("Please Select Gender"); return; }
    if (!year.trim()) { alert("Please Select Income Tax Year"); return; }
    setPanel(true); setEditMode(false); setNoRecord(false);
    setRows([]); setD({ ...EMPTY_DRAFT });
  };

  const onView = async () => {
    // legacy Req_Validation on View Data (different texts!)
    if (gender === "Select Type gender") { alert("Select Gender"); return; }
    if (!year.trim()) { alert("Search Income Tax"); return; }
    setBusy(true);
    try {
      const res = await listItems<Row>(BASE, {
        pageSize: 1000,
        filters: { type: gender, since: year.trim() },
      });
      if (res.results.length > 0) {
        setRows(res.results); setPanel(true); setEditMode(true); setNoRecord(false);
        setD((p) => ({ ...p, type: gender }));
      } else {
        setRows([]); setPanel(false); setEditMode(false); setNoRecord(true);
      }
    } finally { setBusy(false); }
  };

  // exact legacy name_12() order (row-add gate)
  const addRow = () => {
    if (!d.type || d.type === "Select") { alert("Please Select Type !!!"); return; }
    if (!d.since.trim()) { alert("Please Enter the Effective Since !!!"); return; }
    if (!d.lower.trim()) { alert("Please Enter the Lower Value !!!"); return; }
    if (!d.upper.trim()) { alert("Please Enter the Upper Value !!!"); return; }
    if (!d.itax.trim()) { alert("Please Enter the I.Tax % !!!"); return; }
    if (!d.cess.trim()) { alert("Please Enter the Cess !!!"); return; }
    if (!d.surcharge.trim()) { alert("Please Enter the Surcharge !!!"); return; }
    setRows((p) => [...p, {
      type: d.type, effective_since: d.since.trim(), lower_value: d.lower.trim(),
      upper_value: d.upper.trim(), itax: d.itax.trim(), cess: d.cess.trim(),
      surcharge: d.surcharge.trim(),
    }]);
    setD((p) => ({ ...p, lower: "", upper: "", itax: "", cess: "", surcharge: "" }));
  };

  const dropRow = async (i: number) => {
    // legacy row icon: no confirm; deletes the DB row then drops the grid row
    const r = rows[i];
    if (r.id !== undefined) {
      const res = await deleteItem(BASE, r.id);
      if (!res.ok && res.status !== 404) { alert(errMsg(res.data) || "Record removation failed..."); return; }
      if (res.ok) alert("Selected Record Removed successfully!!");
    }
    setRows((p) => p.filter((_, j) => j !== i));
  };

  const setCell = (i: number, k: keyof Row, v: string) =>
    setRows((p) => p.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const onSave = async () => {
    // legacy Save is gated by R_Validation (search gender + year)
    if (gender === "Select Type gender") { alert("Please Select Gender"); return; }
    if (!year.trim()) { alert("Please Select Income Tax Year"); return; }
    setBusy(true);
    try {
      const res = await postJSON<{ detail: string }>(`${BASE}/save/`, {
        type: d.type, effective_since: d.since,
        rows: rows.map((r) => ({
          lower_value: r.lower_value, upper_value: r.upper_value, itax: r.itax,
          cess: r.cess, surcharge: r.surcharge,
        })),
      });
      if (res.ok) { alert("Record added successfully!"); onCancel(); loadAll(); }
      else if (res.status === 403) alert("You do not have permission for this action.");
      else alert(errMsg(res.data) || "Record adding failed...");
    } finally { setBusy(false); }
  };

  const onUpdate = async () => {
    setBusy(true);
    try {
      const res = await postJSON<{ detail: string }>(`${BASE}/replace/`, {
        type: d.type,
        rows: rows.map((r) => ({
          type: r.type, effective_since: r.effective_since, lower_value: r.lower_value,
          upper_value: r.upper_value, itax: r.itax, cess: r.cess, surcharge: r.surcharge,
        })),
      });
      if (res.ok) { alert("Record Updated Successfully..."); onCancel(); loadAll(); }
      else if (res.status === 403) alert("You do not have permission for this action.");
      else alert(errMsg(res.data) || "Record Updating Failed...");
    } finally { setBusy(false); }
  };

  const onDelete = async () => {
    if (!confirm("Are you sure you want to delete record?")) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_BASE_URL}${BASE}/by-type/?type=${encodeURIComponent(d.type)}`, {
        method: "DELETE", credentials: "include",
        headers: { "X-CSRFToken": document.cookie.match(/(^|; )csrftoken=([^;]+)/)?.[2] ?? "" },
      });
      if (res.ok) { alert("Record deleted successfully!!"); onCancel(); loadAll(); }
      else if (res.status === 403) alert("Only administrators can delete a record.");
      else {
        let msg = "Record deletion failed...";
        try { const j = (await res.json()) as { detail?: string }; if (j.detail) msg = j.detail; } catch { /* keep */ }
        alert(msg);
      }
    } finally { setBusy(false); }
  };

  const onCancel = () => {
    // legacy text_Clear: type back to Senior Citizen, Since cleared, panel hidden
    setD({ ...EMPTY_DRAFT, type: "Senior Citizen" });
    setRows([]); setPanel(false); setEditMode(false); setNoRecord(false);
  };

  const onExport = async () => {
    try {
      const r = await fetch(`${API_BASE_URL}${BASE}/export/`, { credentials: "include" });
      if (r.status === 403) { alert("You do not have permission for this action."); return; }
      if (!r.ok) { alert("Export failed."); return; }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "income_tax_list.csv";
      a.click();
      URL.revokeObjectURL(a.href);
    } catch { alert("Export failed."); }
  };

  if (authChecked && !me) {
    return <div className="lg-panel"><div className="lg-panel-head">Income Tax</div>
      <div style={{ padding: 16 }}>🔐 Sign in required. <Link href="/login">Go to login</Link></div></div>;
  }

  return (
    <div className="lg-panel">
      <div className="lg-panel-head" style={{ textAlign: "center" }}>INCOME TAX</div>
      <div className="lg-panel-body">

        <div className="lg-form cols3">
          <Sel label="Select Gender :" value={gender} onChange={setGender} opts={GENDERS} />
          <Field label="Search Income Tax (Year) :">
            <input className="lg-control" value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 2024" />
          </Field>
          <Field label="&nbsp;">
            <div style={{ display: "flex", gap: 8 }}>
              <button className="lg-btn lg-btn-green" disabled={busy} onClick={onNew}>New</button>
              <button className="lg-btn lg-btn-green" disabled={busy} onClick={onView}>View Data</button>
            </div>
          </Field>
        </div>
        {noRecord && <div style={{ color: "red", fontWeight: "bold", fontSize: 16 }}>No Record Found.</div>}

        {panel && <>
          <div className="lg-form cols3">
            <Sel label="Type :" req value={d.type} onChange={(v) => setDk("type", v)} opts={TYPES} />
            <Txt label="Effective Since : " req value={d.since} onChange={(v) => setDk("since", v)} />
            <Txt label="Lower Value :" req value={d.lower} onChange={(v) => setDk("lower", onlyNum(v))} maxLength={10} />
            <Txt label="Upper Value :" req value={d.upper} onChange={(v) => setDk("upper", onlyNum(v))} maxLength={10} />
            <Txt label="ITax % :" req value={d.itax} onChange={(v) => setDk("itax", onlyNum(v))} />
            <Txt label="Cess :" req value={d.cess} onChange={(v) => setDk("cess", onlyNum(v))} />
            <Txt label="Surcharge :" req value={d.surcharge} onChange={(v) => setDk("surcharge", onlyNum(v))} />
            <Field label="&nbsp;"><button className="lg-btn lg-btn-green" onClick={addRow} title="Add Item">＋</button></Field>
          </div>

          <table className="lg-grid"><thead><tr><th></th><th>Sr.No.</th><th>Gender</th><th>Effective Since</th><th>Lower Value</th><th>Upper Value</th><th>I.Tax %</th><th>Cess</th><th>Surcharge</th></tr></thead>
            <tbody>{rows.map((r, i) => (
              <tr key={r.id ?? `n${i}`}>
                <td><button className="lg-btn lg-btn-red" onClick={() => dropRow(i)}>✕</button></td>
                <td>{i + 1}</td>
                <td><input className="lg-control" style={{ textAlign: "center" }} value={r.type} onChange={(e) => setCell(i, "type", e.target.value)} /></td>
                <td><input className="lg-control" style={{ textAlign: "center" }} value={r.effective_since} onChange={(e) => setCell(i, "effective_since", e.target.value)} /></td>
                <td><input className="lg-control" style={{ textAlign: "center" }} value={r.lower_value} onChange={(e) => setCell(i, "lower_value", onlyNum(e.target.value))} /></td>
                <td><input className="lg-control" style={{ textAlign: "center" }} value={r.upper_value} onChange={(e) => setCell(i, "upper_value", onlyNum(e.target.value))} /></td>
                <td><input className="lg-control" style={{ textAlign: "center" }} value={r.itax} onChange={(e) => setCell(i, "itax", onlyNum(e.target.value))} /></td>
                <td><input className="lg-control" style={{ textAlign: "center" }} value={r.cess} onChange={(e) => setCell(i, "cess", onlyNum(e.target.value))} /></td>
                <td><input className="lg-control" style={{ textAlign: "center" }} value={r.surcharge} onChange={(e) => setCell(i, "surcharge", onlyNum(e.target.value))} /></td>
              </tr>
            ))}</tbody></table>

          <div className="lg-btns center">
            {canCreate && <button className="lg-btn lg-btn-green" disabled={busy} onClick={onSave}>Save</button>}
            {canUpdate && editMode && <button className="lg-btn lg-btn-green" disabled={busy} onClick={onUpdate}>Update</button>}
            {canDelete && editMode && <button className="lg-btn lg-btn-red" disabled={busy} onClick={onDelete}>Delete</button>}
            <button className="lg-btn lg-btn-green" onClick={onCancel}> Cancel </button>
            <button className="lg-btn lg-btn-green" disabled={busy} onClick={onExport}>Export To Excel</button>
            <Link href="/" className="lg-btn lg-btn-red" style={{ textDecoration: "none" }}>Close</Link>
          </div>
        </>}

        {loading ? <p>Loading…</p> : rows.length > 0 || panel ? null : (
          <div className="dt-scroll"><table className="dt-grid">
            <thead><tr><th>Sr.No.</th><th>Gender</th><th>Effective Since</th><th>Lower Value</th><th>Upper Value</th><th>I.Tax %</th><th>Cess</th><th>Surcharge</th></tr></thead>
            <tbody><tr><td colSpan={8} style={{ textAlign: "center", color: "#777" }}>Use New or View Data above</td></tr></tbody>
          </table></div>
        )}
      </div>
    </div>
  );
}
