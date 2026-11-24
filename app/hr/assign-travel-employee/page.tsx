"use client";
// Travelling_Management.aspx — Travelling Management (Assign Employee).
// Policy + Designation dropdowns drive a dual-listbox: the LEFT list is the
// available Staff of the chosen designation (not yet on any policy), the RIGHT
// list is the Staff already on the selected policy. >> / > move left->right,
// < / << move right->left (staged client-side). Submit makes the right list the
// policy's exact roster (legacy btnSubmit_click). A searchable grid lists the
// assigned employees (Policy name / Employee Name / Designation). Backend:
// /api/masters/travel-emp-policies/{designations,available_employees,
// assigned_employees,grid,assign}/ + /travel-policies/for_assign/.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getJSON, mk } from "@/lib/api/legacy-fetch";

const POL_FOR_ASSIGN = "/api/masters/travel-policies/for_assign/";
const EMP = "/api/masters/travel-emp-policies";

interface Policy { id: number; policy_name: string }
interface Emp { code: string; name: string }
interface GridRow { policy_name: string; emp_name: string; grade_desc: string }

export default function AssignTravelEmployeePage() {
  const router = useRouter();
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [designations, setDesignations] = useState<string[]>([]);
  const [policyId, setPolicyId] = useState("");
  const [designation, setDesignation] = useState("");
  const [left, setLeft] = useState<Emp[]>([]);
  const [right, setRight] = useState<Emp[]>([]);
  const [leftSel, setLeftSel] = useState<string[]>([]);
  const [rightSel, setRightSel] = useState<string[]>([]);
  const [grid, setGrid] = useState<GridRow[]>([]);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");

  const loadInit = useCallback(async () => {
    try {
      const [pol, des] = await Promise.all([
        getJSON<Policy[]>(POL_FOR_ASSIGN),
        getJSON<string[]>(`${EMP}/designations/`),
      ]);
      setPolicies(pol ?? []);
      setDesignations(des ?? []);
    } catch { /* unauthenticated / offline — leave empty */ }
  }, []);
  useEffect(() => { loadInit(); }, [loadInit]);

  const loadAssigned = useCallback(async (pid: string) => {
    const r = await getJSON<Emp[]>(`${EMP}/assigned_employees/?policy=${encodeURIComponent(pid)}`);
    setRight(r ?? []); setRightSel([]);
  }, []);
  const loadGrid = useCallback(async (pid: string) => {
    const g = await getJSON<GridRow[]>(`${EMP}/grid/?policy=${encodeURIComponent(pid)}`);
    setGrid(g ?? []);
  }, []);

  const onPolicy = async (id: string) => {
    setPolicyId(id); setDesignation(""); setLeft([]); setLeftSel([]); setMsg("");
    if (!id) { setRight([]); setRightSel([]); setGrid([]); return; }
    await Promise.all([loadAssigned(id), loadGrid(id)]);
  };

  const onDesignation = async (d: string) => {
    setDesignation(d); setLeftSel([]);
    if (!d) { setLeft([]); return; }
    const a = await getJSON<Emp[]>(`${EMP}/available_employees/?designation=${encodeURIComponent(d)}`);
    // keep anyone already staged on the right out of the available list
    const onRight = new Set(right.map((e) => e.code));
    setLeft((a ?? []).filter((e) => !onRight.has(e.code)));
  };

  // ---- dual-listbox transfers (staged client-side; persisted on Submit) ----
  const moveRight = (all: boolean) => {
    const picks = all ? left : left.filter((e) => leftSel.includes(e.code));
    if (!all && picks.length === 0) { alert("Please Select EMP NAME"); return; }   // legacy Req_validation()
    if (picks.length === 0) return;
    const codes = new Set(picks.map((e) => e.code));
    setRight([...right, ...picks]);
    setLeft(left.filter((e) => !codes.has(e.code)));
    setLeftSel([]);
  };
  const moveLeft = (all: boolean) => {
    const picks = all ? right : right.filter((e) => rightSel.includes(e.code));
    if (!all && picks.length === 0) { alert("Please Select EMP NAME"); return; }   // legacy Req_validation1()
    if (picks.length === 0) return;
    const codes = new Set(picks.map((e) => e.code));
    setLeft([...left, ...picks]);
    setRight(right.filter((e) => !codes.has(e.code)));
    setRightSel([]);
  };

  const submit = async () => {
    if (!policyId) { alert("Please Select Policy !!!"); return; }
    if (!designation) { alert("Please Select Designation"); return; }
    const r = await mk(`${EMP}/assign/`, { policy: policyId, emp_codes: right.map((e) => e.code) });
    if (r.ok) {
      const b = await r.json().catch(() => ({}));
      setMsg((b as { status?: string }).status || "Employees added successfully to Policy.");
      setDesignation(""); setLeft([]); setLeftSel([]);
      await Promise.all([loadAssigned(policyId), loadGrid(policyId)]);
    } else {
      const b = await r.json().catch(() => null);
      setMsg(typeof b === "string" ? b : (b && (b.detail || JSON.stringify(b))) || `Failed (${r.status})`);
    }
  };

  const selOf = (e: React.ChangeEvent<HTMLSelectElement>) =>
    Array.from(e.target.selectedOptions).map((o) => o.value);

  const gridView = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return grid;
    return grid.filter((r) =>
      [r.policy_name, r.emp_name, r.grade_desc].some((v) => (v || "").toLowerCase().includes(q)));
  }, [grid, search]);

  const listStyle: React.CSSProperties = { width: "100%", height: 300, border: "1px solid #ccc" };
  const xferBtn: React.CSSProperties = { display: "block", width: 48, margin: "8px auto", padding: "6px 0" };

  return (
    <div className="container-fluid">
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: 4 }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px" }}>
          <div className="row" style={{ display: "flex", alignItems: "center" }}>
            <div style={{ flex: "0 0 8.33%" }}></div>
            <div style={{ flex: "0 0 75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
              Travelling Management
            </div>
            <div style={{ flex: "0 0 16.66%", textAlign: "right" }}>
              <Link href="#" onClick={(e) => { e.preventDefault(); window.open("/html/travelling_managment.html", "popUpWindow", "height=500,width=600,left=100,top=100"); }} style={{ color: "#fff", fontSize: 10 }}>
                <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
              </Link>
            </div>
          </div>
        </div>
        <div className="panel-body" style={{ padding: 15 }}>
          {msg && <div style={{ color: "#424D7A", fontWeight: "bold", margin: "8px 0" }}>{msg}</div>}

          <div className="container-fluid" style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: 10, padding: 15, marginBottom: 12 }}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
              <div style={{ minWidth: 240 }}>
                <b>Policies :</b>
                <select value={policyId} onChange={(e) => onPolicy(e.target.value)} className="form-control" style={{ width: "100%", height: 34 }}>
                  <option value="">Select Policy</option>
                  {policies.map((p) => (<option key={p.id} value={p.id}>{p.policy_name}</option>))}
                </select>
              </div>
              <div style={{ minWidth: 240 }}>
                <b>Designation :</b>
                <select value={designation} disabled={!policyId} onChange={(e) => onDesignation(e.target.value)} className="form-control" style={{ width: "100%", height: 34 }}>
                  <option value="">Select Designation</option>
                  {designations.map((d) => (<option key={d} value={d}>{d}</option>))}
                </select>
              </div>
            </div>
          </div>

          <div className="well" style={{ backgroundColor: "white", border: "1px solid #e3e3e3", borderRadius: 4, padding: 19, marginBottom: 16 }}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <div style={{ flex: "1 1 260px" }}>
                <select multiple value={leftSel} onChange={(e) => setLeftSel(selOf(e))} style={listStyle}>
                  {left.map((e) => (<option key={e.code} value={e.code}>{e.name}</option>))}
                </select>
              </div>
              <div style={{ flex: "0 0 70px" }}>
                <button type="button" className="btn btn-primary" style={xferBtn} title="Move all" onClick={() => moveRight(true)}>&gt;&gt;</button>
                <button type="button" className="btn btn-primary" style={xferBtn} title="Move selected" onClick={() => moveRight(false)}>&gt;</button>
                <button type="button" className="btn btn-primary" style={xferBtn} title="Remove selected" onClick={() => moveLeft(false)}>&lt;</button>
                <button type="button" className="btn btn-primary" style={xferBtn} title="Remove all" onClick={() => moveLeft(true)}>&lt;&lt;</button>
              </div>
              <div style={{ flex: "1 1 260px" }}>
                <select multiple value={rightSel} onChange={(e) => setRightSel(selOf(e))} style={listStyle}>
                  {right.map((e) => (<option key={e.code} value={e.code}>{e.name}</option>))}
                </select>
              </div>
            </div>
          </div>

          <div className="lg-btns center" style={{ marginBottom: 16 }}>
            <button onClick={submit} className="btn btn-primary lg-btn-primary">Submit</button>
            <button onClick={() => router.push("/")} className="btn btn-danger lg-btn-danger">Close</button>
          </div>

          <div className="row" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
            <div style={{ minWidth: 240 }}>
              <b>Search :</b>
              <input value={search} onChange={(e) => setSearch(e.target.value)} className="form-control" style={{ width: "100%", height: 34 }} />
            </div>
          </div>
          <div style={{ maxHeight: 300, overflow: "auto" }}>
            <table className="table lg-grid" style={{ background: "#fff", width: "100%" }}>
              <thead>
                <tr style={{ background: "#006699", color: "#fff", textTransform: "uppercase" }}>
                  <th>Policy name</th><th>Employee Name</th><th>Designation</th>
                </tr>
              </thead>
              <tbody>
                {gridView.map((r, i) => (
                  <tr key={i}>
                    <td>{r.policy_name}</td><td>{r.emp_name}</td><td>{r.grade_desc}</td>
                  </tr>
                ))}
                {gridView.length === 0 && (
                  <tr><td colSpan={3} style={{ textAlign: "center" }}>No employees assigned</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
