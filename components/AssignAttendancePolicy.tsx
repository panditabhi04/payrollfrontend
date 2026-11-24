"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getJSON as apiGet, mk as apiPost } from "@/lib/api/legacy-fetch";

interface Policy {
  id: string;
  txt_policy_name: string;
}

interface Item {
  code: string;
  name: string;
}

export default function AssignAttendancePolicy() {
  const [loading, setLoading] = useState(false);
  
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState("0");
  
  const [selectionType, setSelectionType] = useState("");
  // checklistcox: clients / branches to pick; choosing them loads their employees (legacy per-employee list)
  const [pickItems, setPickItems] = useState<Item[]>([]);
  const [picked, setPicked] = useState<string[]>([]);

  const [leftItems, setLeftItems] = useState<Item[]>([]);
  const [rightItems, setRightItems] = useState<Item[]>([]);
  
  const [selectedLeft, setSelectedLeft] = useState<string[]>([]);
  const [selectedRight, setSelectedRight] = useState<string[]>([]);
  // emp_code -> name, so picking a policy can show its current assignees by name.
  const [empNameMap, setEmpNameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchPolicies();
    fetchEmpNames();
  }, []);

  const fetchPolicies = async () => {
    try {
      // Dropdown value is the legacy Policy_Id (Pnnn) — that is what the assignment stores.
      const res = await apiGet<{ results: { policy_id: string; policy_name: string }[] }>(`/api/attendance/policies/?page_size=all`);
      setPolicies((res?.results ?? []).map((p) => ({ id: p.policy_id, txt_policy_name: p.policy_name })));
    } catch { setPolicies([]); }
  };

  const fetchEmpNames = async () => {
    try {
      const d = await apiGet<{ results: { code: string; name: string }[] }>(`/api/attendance/assignments/assignable_employees/`);
      const m: Record<string, string> = {};
      (d?.results ?? []).forEach((e) => { m[e.code] = e.name; });
      setEmpNameMap(m);
    } catch { /* names fall back to codes */ }
  };

  // Legacy ddlpolicies_SelectedIndexChanged: show employees already assigned to the picked
  // policy in the right list.
  const loadAssigned = async (policyId: string) => {
    if (!policyId || policyId === "0") { setRightItems([]); return; }
    try {
      const d = await apiGet<{ results: { emp_code: string }[] }>(`/api/attendance/assignments/?policy_id=${encodeURIComponent(policyId)}&page_size=all`);
      const assigned = (d?.results ?? []).map((r) => ({ code: r.emp_code, name: empNameMap[r.emp_code] || r.emp_code }));
      setRightItems(assigned);
      setLeftItems((prev) => prev.filter((i) => !assigned.some((a) => a.code === i.code)));
    } catch { setRightItems([]); }
  };

  const handleSelectionTypeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSelectionType(val);
    setLeftItems([]); setSelectedLeft([]); setSelectedRight([]); setPicked([]); setPickItems([]);
    setLoading(true);
    try {
      if (val === "Employee List") {
        // Legacy checkemp_click: all active comp employees into the left listbox.
        const d = await apiGet<{ results: { code: string; name: string }[] }>(`/api/attendance/assignments/assignable_employees/`);
        const assigned = new Set(rightItems.map((r) => r.code));
        setLeftItems((d?.results ?? []).filter((x) => !assigned.has(x.code)));
      } else if (val === "Client List") {
        const d = await apiGet<{ results: { client_code: string; client_name: string }[] }>(`/api/masters/clients/?page_size=all`);
        setPickItems((d?.results ?? []).map((c) => ({ code: c.client_code, name: c.client_name })));
      } else if (val === "Branch List") {
        const d = await apiGet<{ results: { unit_code: string; unit_name: string; branch_status?: string | number | null }[] }>(`/api/masters/units/?page_size=all`);
        // legacy ChecUnit_click lists only branch_status=0 units
        setPickItems((d?.results ?? []).filter((u) => ["", "0"].includes(String(u.branch_status ?? "0"))).map((u) => ({ code: u.unit_code, name: u.unit_name })));
      }
    } catch { setLeftItems([]); } finally { setLoading(false); }
  };

  // Legacy checklistcox_OnSelectedIndexChanged: the employees of the ticked clients / branches
  // fill the left listbox; the user then picks the employees to assign.
  const onPick = async (code: string, on: boolean) => {
    const next = on ? [...picked, code] : picked.filter((c) => c !== code);
    setPicked(next);
    if (next.length === 0) { setLeftItems([]); return; }
    setLoading(true);
    try {
      const key = selectionType === "Client List" ? "client_code" : "unit_code";
      const all: Item[] = [];
      for (const c of next) {
        const d = await apiGet<{ results: { code: string; name: string }[] }>(`/api/attendance/assignments/assignable_employees/?${key}=${encodeURIComponent(c)}`);
        all.push(...(d?.results ?? []));
      }
      const seen = new Set(rightItems.map((r) => r.code));
      setLeftItems(all.filter((x, i, a) => !seen.has(x.code) && a.findIndex((y) => y.code === x.code) === i));
    } catch { setLeftItems([]); } finally { setLoading(false); }
  };

  const handleMoveRight = () => {
    const toMove = leftItems.filter(item => selectedLeft.includes(item.code));
    setRightItems([...rightItems, ...toMove]);
    setLeftItems(leftItems.filter(item => !selectedLeft.includes(item.code)));
    setSelectedLeft([]);
  };

  const handleMoveAllRight = () => {
    setRightItems([...rightItems, ...leftItems]);
    setLeftItems([]);
    setSelectedLeft([]);
  };

  const handleMoveLeft = () => {
    const toMove = rightItems.filter(item => selectedRight.includes(item.code));
    setLeftItems([...leftItems, ...toMove]);
    setRightItems(rightItems.filter(item => !selectedRight.includes(item.code)));
    setSelectedRight([]);
  };

  const handleMoveAllLeft = () => {
    setLeftItems([...leftItems, ...rightItems]);
    setRightItems([]);
    setSelectedRight([]);
  };

  const handleSubmit = async () => {
    // Legacy validate() + btnSubmit_click: policy required; assign the right-list to the policy.
    if (selectedPolicy === "0" || !selectedPolicy) { alert("Please select Policy."); return; }
    if (rightItems.length === 0) { alert("Employees adding failed to Policy."); return; }
    const codes = rightItems.map((i) => i.code);
    const payload: Record<string, unknown> = { policy_id: selectedPolicy, emp_codes: codes };
    setLoading(true);
    try {
      const r = await apiPost(`/api/attendance/assignments/assign/`, payload);
      if (r.ok) {
        alert("Employees added successfully to Policy.");   // legacy exact message
        setRightItems([]); setSelectedRight([]);
      } else {
        const b = await r.json().catch(() => ({}));
        alert(Array.isArray(b) ? b[0] : (b.detail || b.non_field_errors?.[0] || "Employees adding failed to Policy."));
      }
    } catch {
      alert("Employees adding failed to Policy.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    window.location.href = "/";
  };

  const handleCalculation = async () => {
    // Legacy btnsalarycalculation_Click: rebuild the muster P/HD/A from the Android punch logs of
    // the employees assigned to the chosen policy.
    if (!selectedPolicy || selectedPolicy === "0") { alert("Please select Policy."); return; }
    setLoading(true);
    try {
      const res = await apiPost("/api/attendance/assignments/calculation/", { policy_id: selectedPolicy });
      const b = await res.json().catch(() => ({}));
      if (res.ok) {
        alert(`${b.status} Employees: ${b.employees}, muster rows: ${b.muster_rows}, days written: ${b.days_written}`
          + (b.skipped_locked_rows ? `, locked (approved / month-end) rows skipped: ${b.skipped_locked_rows}` : ""));
      } else {
        alert(Array.isArray(b) ? b[0] : (b.detail || b.non_field_errors?.[0] || "Calculation failed."));
      }
    } catch {
      alert("Calculation failed.");
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="container-fluid" style={{ maxWidth: "99%", margin: "0 auto", padding: "20px" }}>
      {loading && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(204, 204, 204, 0.7)", zIndex: 9999 }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>Loading...</div>
        </div>
      )}

      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "8.33%" }}></div>
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
            ASSIGN ATTANDANCE POLICY
          </div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); window.open("/html/assign_attendance_policy.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }} style={{ color: "#fff", fontSize: "10px" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>

        <div className="panel-body" style={{ padding: "15px" }}>
          <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "25px", marginBottom: "20px", marginTop: "20px" }}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: "0 0 16.66%", marginTop: "10px" }}><b>Select Policies :</b></div>
              <div style={{ flex: "0 0 16.66%" }}>
                <select value={selectedPolicy} onChange={(e) => { setSelectedPolicy(e.target.value); loadAssigned(e.target.value); }} className="form-control" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }}>
                  <option value="0">Select Policy</option>
                  {policies.map(p => <option key={p.id} value={p.id}>{p.txt_policy_name}</option>)}
                </select>
              </div>
              <div style={{ flex: "0 0 8.33%" }}></div>
              <div style={{ flex: "0 0 16.66%", marginTop: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer", fontWeight: "normal" }}>
                  <input type="radio" name="selectionType" value="Employee List" checked={selectionType === "Employee List"} onChange={handleSelectionTypeChange} />
                  &nbsp;&nbsp;Employee List
                </label>
              </div>
              <div style={{ flex: "0 0 16.66%", marginTop: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer", fontWeight: "normal" }}>
                  <input type="radio" name="selectionType" value="Client List" checked={selectionType === "Client List"} onChange={handleSelectionTypeChange} />
                  &nbsp;&nbsp;Client List
                </label>
              </div>
              <div style={{ flex: "0 0 16.66%", marginTop: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer", fontWeight: "normal" }}>
                  <input type="radio" name="selectionType" value="Branch List" checked={selectionType === "Branch List"} onChange={handleSelectionTypeChange} />
                  &nbsp;&nbsp;Branch List
                </label>
              </div>
            </div>
            
            <br />
            <br />
            
            <div className="row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: "0 0 25%", maxHeight: "300px", overflow: "auto", paddingRight: "8px" }}>
                {(selectionType === "Client List" || selectionType === "Branch List") && pickItems.map((it) => (
                  <label key={it.code} style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "normal" }}>
                    <input type="checkbox" checked={picked.includes(it.code)} onChange={(e) => onPick(it.code, e.target.checked)} />{it.name}
                  </label>
                ))}
              </div>
              <div style={{ flex: "0 0 25%" }}>
                <select multiple size={15} style={{ width: "100%", height: "300px", padding: "5px", border: "1px solid #ccc" }}
                  value={selectedLeft} onChange={(e) => setSelectedLeft(Array.from(e.target.selectedOptions, option => option.value))}
                >
                  {leftItems.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                </select>
              </div>
              <div style={{ flex: "0 0 8.33%" }}></div>
              <div style={{ flex: "0 0 16.66%", textAlign: "center" }}>
                <div style={{ marginBottom: "15px" }}><button onClick={handleMoveAllRight} className="btn btn-primary" style={{ padding: "6px 15px", backgroundColor: "#428bca", borderColor: "#357ebd", color: "#fff", borderRadius: "4px" }}>&gt;&gt;</button></div>
                <div style={{ marginBottom: "15px" }}><button onClick={handleMoveRight} className="btn btn-primary" style={{ padding: "6px 15px", backgroundColor: "#428bca", borderColor: "#357ebd", color: "#fff", borderRadius: "4px" }}>&gt;</button></div>
                <div style={{ marginBottom: "15px" }}><button onClick={handleMoveLeft} className="btn btn-primary" style={{ padding: "6px 15px", backgroundColor: "#428bca", borderColor: "#357ebd", color: "#fff", borderRadius: "4px" }}>&lt;</button></div>
                <div style={{ marginBottom: "15px" }}><button onClick={handleMoveAllLeft} className="btn btn-primary" style={{ padding: "6px 15px", backgroundColor: "#428bca", borderColor: "#357ebd", color: "#fff", borderRadius: "4px" }}>&lt;&lt;</button></div>
              </div>
              <div style={{ flex: "0 0 25%" }}>
                <select multiple size={15} style={{ width: "100%", height: "300px", padding: "5px", border: "1px solid #ccc" }}
                  value={selectedRight} onChange={(e) => setSelectedRight(Array.from(e.target.selectedOptions, option => option.value))}
                >
                  {rightItems.map(item => <option key={item.code} value={item.code}>{item.name}</option>)}
                </select>
              </div>
            </div>
            
            <br />
            <br />
            
            <div style={{ textAlign: "center" }}>
              <button onClick={handleSubmit} className="btn btn-primary" style={{ backgroundColor: "#428bca", borderColor: "#357ebd", color: "#fff", padding: "6px 12px", borderRadius: "4px", marginRight: "10px", cursor: "pointer" }}>Submit</button>
              <button onClick={handleClose} className="btn btn-danger" style={{ backgroundColor: "#d9534f", borderColor: "#d43f3a", color: "#fff", padding: "6px 12px", borderRadius: "4px", marginRight: "10px", cursor: "pointer" }}>Close</button>
              <button onClick={handleCalculation} className="btn" style={{ padding: "6px 12px", borderRadius: "4px", cursor: "pointer", border: "1px solid #ccc" }}>Calculation</button>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}
