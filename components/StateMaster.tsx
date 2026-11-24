"use client";

/**
 * State Master — faithful 1:1 replica of legacy StateMaster.aspx.
 *
 * Outer tabs: STATE  |  STATE MASTER.
 * Inside STATE, inner tabs: State  |  Tier Cities.
 * Same labels, * markers, exact validation messages, buttons and grid columns.
 *
 * - State tab  -> full CRUD on /api/masters/states (state_code/city/state_name).
 *   State Name is a dropdown fed from the valid-state-name registry (legacy
 *   `SELECT DISTINCT state_name FROM state_master WHERE active='1'`).
 * - Tier Cities -> dual-listbox assigning cities to a tier; persists by PATCHing
 *   the tier column on the matching state row. State-name filter from the registry.
 * - STATE MASTER tab -> the valid state-name registry itself (legacy `state_master`):
 *   grid (Sr No. + STATE NAME) and a Submit that inserts a new name with the legacy
 *   duplicate guard, backed by /api/masters/state-names.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import { listItems, createItem, updateItem, deleteItem } from "@/lib/api/crud";
import DataTable, { type DTColumn } from "@/components/DataTable";

const BASE = "/api/masters/states";
const NAME_BASE = "/api/masters/state-names";
const MENU = "State Master";
const TIERS = [
  { v: "Select", t: "Select" }, { v: "1", t: "First Tier" }, { v: "2", t: "Second Tier" },
  { v: "3", t: "Third Tier" }, { v: "4", t: "Fourth Tier" },
];

interface St { id: number; state_code: string; state_name: string; city: string; tier: number | string | null }
interface StName { id: number; state_name: string }

const DT_COLS: DTColumn<St>[] = [
  { key: "state_code", label: "STATE CODE", value: (s) => s.state_code || "" },
  { key: "city", label: "CITY NAME", value: (s) => s.city || "" },
  { key: "state_name", label: "STATE NAME", value: (s) => s.state_name || "" },
];

function levelFor(me: Me | null): number {
  if (!me) return 0;
  if (me.is_staff) return 4;
  const map: Record<string, number> = { R: 1, U: 2, C: 3, D: 4 };
  return me.permissions.filter((p) => p.menu === MENU && !p.needs_review)
    .reduce((mx, p) => Math.max(mx, map[p.permission] ?? 0), 0);
}
const alnum = (v: string) => v.replace(/[^A-Za-z0-9 ]/g, "");

export default function StateMaster() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [outer, setOuter] = useState<"STATE" | "STATE MASTER">("STATE");
  const [inner, setInner] = useState<"State" | "Tier Cities">("State");

  const [rows, setRows] = useState<St[]>([]);
  const [registry, setRegistry] = useState<StName[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<St | null>(null);

  // State tab fields
  const [stateCode, setStateCode] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");

  // Tier Cities
  const [tier, setTier] = useState("Select");
  const [tierState, setTierState] = useState("");
  const [leftSel, setLeftSel] = useState<string[]>([]);
  const [rightSel, setRightSel] = useState<string[]>([]);

  const level = levelFor(me);
  const canCreate = level >= 3, canUpdate = level >= 2, canDelete = level >= 4;
  const canExport = level >= 4; // legacy: Export visible only at full access

  useEffect(() => { getMe().then((m) => { setMe(m); setAuthChecked(true); }); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    // Legacy binds the whole pay_state_master; fetch the full set (grid paginates client-side).
    try { const res = await listItems<St>(BASE, { pageSize: 20000 }); setRows(res.results); }
    catch { setRows([]); }
    finally { setLoading(false); }
  }, []);
  const loadRegistry = useCallback(async () => {
    try { const res = await listItems<StName>(NAME_BASE, { pageSize: 1000 }); setRegistry(res.results); }
    catch { setRegistry([]); }
  }, []);
  useEffect(() => { if (authChecked && me) { load(); loadRegistry(); } }, [authChecked, me, load, loadRegistry]);

  // Valid state names — the legacy registry (state_master, active=1).
  const registryNames = registry.map((r) => r.state_name).filter(Boolean);

  const clearState = () => { setSelected(null); setStateCode(""); setCity(""); setStateName(""); };
  const selectRow = (s: St) => { setSelected(s); setStateCode(s.state_code || ""); setCity(s.city || ""); setStateName(s.state_name || ""); };

  // State Name dropdown options: "Select" + registry; keep a selected row's name even
  // if it is not (yet) in the registry, so Update can round-trip it (legacy parity).
  const stateNameOptions = Array.from(new Set(
    [...registryNames, ...(selected?.state_name ? [selected.state_name] : [])]
  ));

  // exact legacy Req_validation()
  const reqValidation = (): string | null => {
    if (!stateCode.trim()) return "Please Enter State Code";
    if (!city.trim()) return "Please Enter City Name";
    if (!stateName.trim()) return "Please Enter the State Name";
    return null;
  };
  const payload = () => ({ state_code: stateCode.trim(), city: city.trim(), state_name: stateName.trim() });

  const onSave = async () => {
    const err = reqValidation(); if (err) { alert(err); return; }
    const res = await createItem<St>(BASE, payload());
    if (res.ok) { alert("Record added successfully!!"); clearState(); load(); }
    else if (res.status === 403) alert("You do not have permission for this action.");
    else alert("Record adding failed...");
  };
  const onUpdate = async () => {
    if (!selected) return;
    const err = reqValidation(); if (err) { alert(err); return; }
    const res = await updateItem<St>(BASE, selected.id, payload());
    if (res.ok) { alert("Record updated successfully!!"); clearState(); load(); }
    else if (res.status === 403) alert("You do not have permission for this action.");
    else alert("Record updation failed...");
  };
  const onDelete = async () => {
    if (!selected) { alert("Record not Available"); return; }
    // legacy R_validation(): confirm; on cancel -> alert "Record not Available".
    if (!confirm("Are you Sure You Want to Delete Record")) { alert("Record not Available"); return; }
    const res = await deleteItem(BASE, selected.id);
    if (res.ok) { alert("Record deleted successfully!!"); clearState(); load(); }
    else if (res.status === 403) alert("Only administrators can delete a record.");
    else { const d = res.data as Record<string, unknown>; alert(typeof d?.detail === "string" ? d.detail : "Employee exist can not delete this State"); }
  };
  const exportExcel = () => {
    // Legacy workbook: title block "STATE LIST" then STATE CODE / CITY NAME / STATE NAME header.
    const q = (v: unknown) => `"${(v ?? "").toString().replace(/"/g, '""')}"`;
    const lines = rows.map((r) => [r.state_code, r.city, r.state_name].map(q).join(","));
    const csv = [[q("STATE LIST")].join(","), "", ["STATE CODE", "CITY NAME", "STATE NAME"].map(q).join(","), ...lines].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = "State.csv"; a.click(); URL.revokeObjectURL(url);
  };


  /* ---- Tier Cities dual list ---- */
  // Legacy fill_list(): left = cities with tier 0, right = cities of the chosen tier (state filter
  // optional). The arrow buttons only shuffle items between the lists; Submit persists the tier.
  const tierRows = rows.filter((r) => (!tierState || r.state_name === tierState));
  const [leftList, setLeftList] = useState<string[]>([]);
  const [rightList, setRightList] = useState<string[]>([]);
  useEffect(() => {
    const uniq = (a: string[]) => Array.from(new Set(a)).sort();
    setLeftList(uniq(tierRows.filter((r) => Number(r.tier ?? 0) === 0 && r.city).map((r) => r.city)));
    setRightList(tier !== "Select"
      ? uniq(tierRows.filter((r) => String(r.tier ?? "") === tier && r.city).map((r) => r.city))
      : []);
    setLeftSel([]); setRightSel([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, tier, tierState]);

  // legacy select_city(): ">" requires a City Name selection (">>" has no client check).
  const moveRight = () => {
    if (leftSel.length === 0) { alert("Please Select City Name"); return; }
    setRightList((r) => Array.from(new Set([...r, ...leftSel])));
    setLeftList((l) => l.filter((c) => !leftSel.includes(c)));
    setLeftSel([]);
  };
  const moveAllRight = () => {
    if (leftSel.length === 0) { alert("Please Select City Name"); return; }
    setRightList((r) => Array.from(new Set([...r, ...leftList])));
    setLeftList([]); setLeftSel([]);
  };
  // legacy assign_city(): "<" and "<<" require an Assign City selection.
  const moveLeft = () => {
    if (rightSel.length === 0) { alert("Please Select Assign City"); return; }
    setLeftList((l) => Array.from(new Set([...l, ...rightSel])));
    setRightList((r) => r.filter((c) => !rightSel.includes(c)));
    setRightSel([]);
  };
  const moveAllLeft = () => {
    if (rightSel.length === 0) { alert("Please Select Assign City"); return; }
    setLeftList((l) => Array.from(new Set([...l, ...rightList])));
    setRightList([]); setRightSel([]);
  };
  // legacy validate() + btnSubmit_click: persist tier for every city in the Assign City list.
  const submitTier = async () => {
    if (tier === "Select") { alert("Please Select Tiers"); return; }
    if (rightList.length === 0) { alert("Please Select Assign City"); return; }
    let ok = true;
    const patchCity = async (c: string, newTier: string) => {
      for (const r of tierRows.filter((x) => x.city === c)) {
        const res = await updateItem(BASE, r.id, { tier: newTier });
        if (!res.ok) ok = false;
      }
    };
    for (const c of rightList) await patchCity(c, tier);
    // cities moved back to the left list return to tier 0 (unassigned)
    const original = tierRows.filter((r) => String(r.tier ?? "") === tier && r.city).map((r) => r.city);
    for (const c of Array.from(new Set(original)).filter((c) => !rightList.includes(c))) await patchCity(c, "0");
    alert(ok ? "City added successfully to Tier." : "City added unsuccessfully to Tier.");
    // legacy finally: reset State Name to ALL, Tiers to Select, clear both lists
    setTierState(""); setTier("Select"); setLeftList([]); setRightList([]);
    await load();
  };

  if (authChecked && !me) {
    return <div className="lg-panel"><div className="lg-panel-head">State Master</div>
      <div style={{ padding: 16 }}>🔐 Sign in required. <Link href="/login">Go to login</Link></div></div>;
  }

  return (
    <div className="lg-panel">
      <div className="lg-panel-head" style={{ textAlign: "center", position: "relative" }}>State Master
        <a href="#" title="Help" onClick={(e) => { e.preventDefault(); window.open("/html/StateD.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }}
          style={{ position: "absolute", right: 10, top: 4 }}><img src="/Images/help_ico.png" alt="Help" width="20" height="20" /></a>
      </div>
      <div className="lg-panel-body">
        {/* outer tabs */}
        <div className="em-tabs">
          {(["STATE", "STATE MASTER"] as const).map((t) => (
            <div key={t} className={`em-tab ${outer === t ? "active" : ""}`} onClick={() => setOuter(t)}>{t}</div>
          ))}
        </div>

        {outer === "STATE" && (
          <div className="em-tabpane">
            {/* inner tabs */}
            <div className="em-tabs" style={{ marginTop: 0 }}>
              {(["State", "Tier Cities"] as const).map((t) => (
                <div key={t} className={`em-tab ${inner === t ? "active" : ""}`} onClick={() => setInner(t)}>{t}</div>
              ))}
            </div>
            <div className="em-tabpane">
              {inner === "State" && (
                <>
                  <div className="lg-form cols3">
                    <div className="lg-row">
                      <label className="lg-label">State Code :<span className="lg-req"> *</span></label>
                      <input className="lg-control" maxLength={7} value={stateCode}
                        onChange={(e) => setStateCode(alnum(e.target.value))} />
                    </div>
                    <div className="lg-row">
                      <label className="lg-label">City Name :<span className="lg-req"> *</span></label>
                      <input className="lg-control" maxLength={50} value={city} onChange={(e) => setCity(alnum(e.target.value))} />
                    </div>
                    <div className="lg-row">
                      <label className="lg-label">State Name :<span className="lg-req"> *</span></label>
                      <select className="lg-control" value={stateName} onChange={(e) => setStateName(e.target.value)}>
                        <option value="">Select</option>
                        {stateNameOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="lg-btns center">
                    {canCreate && !selected && <button className="lg-btn lg-btn-green" onClick={onSave}>Save</button>}
                    {canUpdate && selected && <button className="lg-btn lg-btn-green" onClick={onUpdate}>Update</button>}
                    {canDelete && selected && <button className="lg-btn lg-btn-red" onClick={onDelete}>Delete</button>}
                    <button className="lg-btn lg-btn-green" onClick={clearState}>Clear</button>
                    {canExport && <button className="lg-btn lg-btn-primary" onClick={exportExcel}>Export To Excel</button>}
                    <Link href="/" className="lg-btn lg-btn-red" style={{ textDecoration: "none" }}>Close</Link>
                  </div>
                  {loading ? <p>Loading…</p> : (
                    <DataTable<St> columns={DT_COLS} rows={rows} rowKey={(s) => s.id} onRowClick={selectRow} selectedKey={selected?.id ?? null} />
                  )}
                </>
              )}

              {inner === "Tier Cities" && (
                <>
                  <div className="lg-form">
                    <div className="lg-row">
                      <label className="lg-label">Tiers :</label>
                      <select className="lg-control" value={tier} onChange={(e) => setTier(e.target.value)}>
                        {TIERS.map((t) => <option key={t.v} value={t.v}>{t.t}</option>)}
                      </select>
                    </div>
                    <div className="lg-row">
                      <label className="lg-label">State Name :</label>
                      <select className="lg-control" value={tierState} onChange={(e) => setTierState(e.target.value)}>
                        <option value="">ALL</option>
                        {registryNames.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", gap: 12, alignItems: "center" }}>
                    <div>
                      <label className="lg-label">City Name:</label>
                      <select multiple className="lg-control" style={{ height: 300 }}
                        value={leftSel} onChange={(e) => setLeftSel(Array.from(e.target.selectedOptions).map((o) => o.value))}>
                        {leftList.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <button className="lg-btn" onClick={moveAllRight}>&gt;&gt;</button>
                      <button className="lg-btn" onClick={moveRight}>&gt;</button>
                      <button className="lg-btn" onClick={moveLeft}>&lt;</button>
                      <button className="lg-btn" onClick={moveAllLeft}>&lt;&lt;</button>
                    </div>
                    <div>
                      <label className="lg-label">Assign City:</label>
                      <select multiple className="lg-control" style={{ height: 300 }}
                        value={rightSel} onChange={(e) => setRightSel(Array.from(e.target.selectedOptions).map((o) => o.value))}>
                        {rightList.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="lg-btns center">
                    <button className="lg-btn lg-btn-green" onClick={submitTier}>Submit</button>
                    <Link href="/" className="lg-btn lg-btn-red" style={{ textDecoration: "none" }}>Close</Link>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {outer === "STATE MASTER" && (
          <div className="em-tabpane">
            <StateMasterTab registry={registry} reload={loadRegistry} canCreate={canCreate} />
          </div>
        )}
      </div>
    </div>
  );
}

/* STATE MASTER tab: the valid state-name registry (legacy `state_master`). */
function StateMasterTab({ registry, reload, canCreate }:
  { registry: StName[]; reload: () => Promise<void>; canCreate: boolean }) {
  const [name, setName] = useState("");

  const submit = async () => {
    // legacy statevalid(): client-side empty check.
    if (!name.trim()) { alert("Please Enter State Name"); return; }
    const res = await createItem<StName>(NAME_BASE, { state_name: name.trim() });
    if (res.ok) {
      alert(" Record  Added Successfully... !!!");
      setName("");
      await reload();
    } else if (res.status === 403) {
      alert("You do not have permission for this action.");
    } else {
      const d = res.data as unknown as Record<string, unknown>;
      const msg = Array.isArray(d?.state_name) ? String(d.state_name[0]) : "";
      alert(msg || " State Name Already Exists... !!!");
    }
    // legacy btn_submit_Click always fires this trailing alert.
    alert(" Please Enter Other state_name.. !!!");
  };

  return (
    <>
      <div className="lg-form">
        <div className="lg-row">
          <label className="lg-label">STATE NAME:<span className="lg-req"> *</span></label>
          <input className="lg-control" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="lg-row" style={{ alignSelf: "end" }}>
          <button className="lg-btn lg-btn-green" onClick={submit}>Submit</button>
        </div>
      </div>
      <table className="lg-grid">
        <thead><tr><th>Sr No.</th><th>STATE NAME</th></tr></thead>
        <tbody>
          {registry.map((s, i) => <tr key={s.id}><td>{i + 1}</td><td>{s.state_name}</td></tr>)}
        </tbody>
      </table>
    </>
  );
}
