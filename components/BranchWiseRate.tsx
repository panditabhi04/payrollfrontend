"use client";

/**
 * Branch Wise Rate — exact replica of legacy Unit_grade_rate_updation.aspx.
 *
 * Same headings (UNIT GRADE RATE UPDATION / Unit Grade Rate Updation Details),
 * same Client/Unit dropdowns (unit display "STATECODE_NAME_ADD1"), same readonly
 * State/City/Location boxes, same 34-column grid (UNIT NAME / UNIT CODE /
 * GRADE CODE / GRADE DESCRIPTION / BASIC-DA-HRA-WASHING-CONV-HEAD06-15 /
 * LHEAD1-5 / DHEAD1-10) with unit head-names as column labels, same buttons
 * (Save/Close only — no Update/Delete/Export exist on this screen), same
 * validation (Req_validation "Please Select Unit "), same success message.
 *
 * Exact legacy behaviors preserved: unit panel + Save hidden until a client is
 * chosen; selecting a unit ensures missing (unit, grade) combos then fills the
 * grid; UNIT CODE / GRADE CODE / HRA columns hidden (RowDataBound Cells 1/2/6
 * — the HRA one is a legacy off-by index quirk, kept with this note); columns
 * whose unit head-name is empty hidden (RemoveEmptyColumns); rate cells have
 * NO numeric filter (legacy has none); save posts the whole matrix with zero
 * cell validation.
 *
 * Data honesty: head display names come from the legacy unit row (SELECT-only);
 * the ue_/ul_/ud_ columns do not exist in this clone (verified against
 * INFORMATION_SCHEMA — legacy itself throws there), so every head column
 * arrives hidden until a unit carries head names.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import { API_BASE_URL } from "@/lib/api/client";
import { Sel, Field, levelForMenu, errMsg, type Opt } from "@/components/formkit";

const BASE = "/api/payroll/unit-grade-rates";
const MENU = "Branch Wise Rate";

const E_LABELS = ["BASIC", "DA", "HRA", "WASHING", "CONV", "HEAD06", "HEAD07", "HEAD08",
  "HEAD09", "HEAD10", "HEAD11", "HEAD12", "HEAD13", "HEAD14", "HEAD15"];
const L_LABELS = ["LHEAD1", "LHEAD2", "LHEAD3", "LHEAD4", "LHEAD5"];
const D_LABELS = ["DHEAD1", "DHEAD2", "DHEAD3", "DHEAD4", "DHEAD5", "DHEAD6", "DHEAD7",
  "DHEAD8", "DHEAD9", "DHEAD10"];
const E_KEYS = Array.from({ length: 15 }, (_, i) => `e_head${String(i + 1).padStart(2, "0")}`);
const L_KEYS = Array.from({ length: 5 }, (_, i) => `l_head${String(i + 1).padStart(2, "0")}`);
const D_KEYS = Array.from({ length: 10 }, (_, i) => `d_head${String(i + 1).padStart(2, "0")}`);
const ALL_KEYS = [...E_KEYS, ...L_KEYS, ...D_KEYS];
const ALL_LABELS = [...E_LABELS, ...L_LABELS, ...D_LABELS];
// RowDataBound hides Cells 1 (UNIT CODE), 2 (GRADE CODE) and 6 (HRA = E_HEAD03).
const ALWAYS_HIDDEN = new Set(["unit_code", "grade_code", "e_head03"]);

interface UnitOpt { unit_code: string; unit_name: string; state_name: string; unit_add1: string; client_code: string }
interface MatrixRow {
  unit_name: string; unit_code: string; grade_code: string; grade_desc: string;
  [k: string]: string;
}

export default function BranchWiseRate() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [clients, setClients] = useState<{ client_code: string; client_name: string }[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [stateCodes, setStateCodes] = useState<Record<string, string>>({});
  const [client, setClient] = useState("Select");
  const [unit, setUnit] = useState("Select");
  const [place, setPlace] = useState({ state: "", city: "", location: "" });
  const [headNames, setHeadNames] = useState<string[]>([]);
  const [rows, setRows] = useState<MatrixRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const level = levelForMenu(me?.permissions, MENU, !!me?.is_staff);
  const canSave = level >= 1;

  useEffect(() => { getMe().then((m) => { setMe(m); setAuthChecked(true); }); }, []);
  useEffect(() => {
    (async () => {
      try {
        const [c, u, s] = await Promise.all([
          fetch(`${API_BASE_URL}/api/masters/clients/?page_size=all`, { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" }),
          fetch(`${API_BASE_URL}/api/masters/units/lookup/`, { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" }),
          fetch(`${API_BASE_URL}/api/masters/states/lookup/`, { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" }),
        ]);
        if (c.ok) setClients(((await c.json()) as { results: { client_code: string; client_name: string }[] }).results ?? []);
        if (u.ok) setUnits(((await u.json()) as { units: UnitOpt[] }).units ?? []);
        if (s.ok) {
          const d = (await s.json()) as { codes?: Record<string, string>; results?: { state_name: string; state_code: string }[] };
          if (d.codes) {
            setStateCodes(d.codes);
          } else {
            const m: Record<string, string> = {};
            (d.results ?? []).forEach((x) => { m[x.state_name] = x.state_code; });
            setStateCodes(m);
          }
        }
      } catch { /* dropdowns stay at Select */ }
    })();
  }, []);

  const unitDisplay = (x: UnitOpt) =>
    `${stateCodes[x.state_name] ?? ""}_${x.unit_name}_${x.unit_add1}`;

  const onClient = (v: string) => {
    setClient(v); setUnit("Select");
    setPlace({ state: "", city: "", location: "" });
    setHeadNames([]); setRows([]);
  };

  const onUnit = async (v: string) => {
    setUnit(v);
    if (!v || v === "Select") { setPlace({ state: "", city: "", location: "" }); setHeadNames([]); setRows([]); return; }
    setLoading(true);
    try {
      const r = await fetch(
        `${API_BASE_URL}${BASE}/matrix/?client=${encodeURIComponent(client)}&unit=${encodeURIComponent(v)}`,
        { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" });
      if (!r.ok) { setHeadNames([]); setRows([]); return; }
      const d = (await r.json()) as {
        state: string; city: string; location: string; head_names: string[]; rows: MatrixRow[];
      };
      setPlace({ state: d.state, city: d.city, location: d.location });
      setHeadNames(d.head_names ?? []);
      setRows(d.rows ?? []);
    } finally { setLoading(false); }
  };

  const setCell = (i: number, k: string, v: string) =>
    setRows((p) => p.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  const onSave = async () => {
    if (!unit || unit === "Select") { alert("Please Select Unit "); return; }
    setBusy(true);
    try {
      const m = document.cookie.match(new RegExp("(^|; )csrftoken=([^;]+)"));
      await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
      const res = await fetch(`${API_BASE_URL}${BASE}/save-matrix/`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": m ? decodeURIComponent(m[2]) : "" },
        body: JSON.stringify({ client, unit, rows }),
      });
      if (res.ok) {
        alert("Unit Grade Rate Saved successfully!");
        // legacy finally{}: reset client/unit and the read-only boxes
        setClient("Select"); setUnit("Select");
        setPlace({ state: "", city: "", location: "" }); setHeadNames([]); setRows([]);
      }
      else if (res.status === 403) alert("You do not have permission for this action.");
      else {
        let msg = "";
        try { msg = errMsg(await res.json()); } catch { /* keep */ }
        alert(msg || "Save failed.");
      }
    } finally { setBusy(false); }
  };

  const clientOpts: Opt[] = [{ v: "Select", t: "Select" }, ...clients.map((c) => ({ v: c.client_code, t: c.client_name }))];
  const unitOpts: Opt[] = [{ v: "Select", t: "Select" }, ...units.filter((u) => u.client_code === client).map((u) => ({ v: u.unit_code, t: unitDisplay(u) }))];
  const visibleHeads = ALL_KEYS.map((k, i) => ({ key: k, label: headNames[i] || ALL_LABELS[i], hidden: ALWAYS_HIDDEN.has(k) || !(headNames[i] || "").trim() }));

  if (authChecked && !me) {
    return <div className="lg-panel"><div className="lg-panel-head">Branch Wise Rate</div>
      <div style={{ padding: 16 }}>🔐 Sign in required. <Link href="/login">Go to login</Link></div></div>;
  }

  return (
    <div className="lg-panel">
      <div className="lg-panel-head" style={{ textAlign: "center" }}>UNIT GRADE RATE UPDATION</div>
      <div className="lg-panel-body">
        <div className="lg-form cols3">
          <Sel label="Client :" req value={client} onChange={onClient} opts={clientOpts} />
        </div>
        {client !== "Select" && <>
          <div className="lg-form cols3">
            <Sel label="Unit :" req value={unit} onChange={onUnit} opts={unitOpts} />
            <Field label="State :"><input className="lg-control" value={place.state} readOnly /></Field>
            <Field label="City :"><input className="lg-control" value={place.city} readOnly /></Field>
            <Field label="Location :"><input className="lg-control" value={place.location} readOnly /></Field>
          </div>
          <div className="lg-btns center">
            {canSave && <button className="lg-btn lg-btn-green" disabled={busy} onClick={onSave}>Save</button>}
            <Link href="/" className="lg-btn lg-btn-red" style={{ textDecoration: "none" }}>Close</Link>
          </div>
        </>}
        {loading ? <p>Loading…</p> : rows.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <div className="dt-scroll"><table className="dt-grid">
              <thead><tr>
                <th>UNIT NAME</th><th>GRADE DESCRIPTION</th>
                {visibleHeads.filter((c) => !c.hidden).map((c) => <th key={c.key}>{c.label}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.unit_code}-${r.grade_code}`}>
                    <td>{r.unit_name}</td><td>{r.grade_desc}</td>
                    {visibleHeads.filter((c) => !c.hidden).map((c) => (
                      <td key={c.key}><input className="lg-control" style={{ width: 50 }} value={r[c.key] ?? ""} onChange={(e) => setCell(i, c.key, e.target.value)} /></td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table></div>
          </div>
        )}
      </div>
    </div>
  );
}
