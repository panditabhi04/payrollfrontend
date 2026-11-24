"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { getJSON as apiGet, mk as apiPost } from "@/lib/api/legacy-fetch";

interface Policy { name: string; }
interface Item { code: string; name: string; }

export default function AssignLeavePolicy() {
  const [loading, setLoading] = useState(false);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [selectedPolicy, setSelectedPolicy] = useState("0");
  const [selectionType, setSelectionType] = useState("");
  const [leftItems, setLeftItems] = useState<Item[]>([]);
  const [rightItems, setRightItems] = useState<Item[]>([]);
  const [selectedLeft, setSelectedLeft] = useState<string[]>([]);
  const [selectedRight, setSelectedRight] = useState<string[]>([]);
  const [empNameMap, setEmpNameMap] = useState<Record<string, string>>({});
  // Legacy Assign_Leave_Ploicy: Client -> State -> Branch dropdowns drive the employee lists.
  const [clients, setClients] = useState<{ client_code: string; client_name: string }[]>([]);
  const [units, setUnits] = useState<{ unit_code: string; unit_name: string; state_name: string }[]>([]);
  const [client, setClient] = useState("Select");
  const [stateName, setStateName] = useState("Select");
  const [branch, setBranch] = useState("Select");
  // radiolistcox: the clients (Client List) / branches of the chosen client (Branch List) to pick from
  const [pickItems, setPickItems] = useState<Item[]>([]);
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => { fetchPolicies(); fetchEmpNames(); }, []);
  useEffect(() => {
    apiGet<{ results: { client_code: string; client_name: string }[] }>(`/api/masters/clients/?page_size=all`)
      .then((d) => setClients(d?.results ?? [])).catch(() => setClients([]));
  }, []);
  useEffect(() => {
    setStateName("Select"); setBranch("Select"); setUnits([]);
    if (client === "Select") return;
    apiGet<{ units: { unit_code: string; unit_name: string; state_name: string }[] }>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(client)}`)
      .then((d) => setUnits(d?.units ?? [])).catch(() => setUnits([]));
  }, [client]);
  const stateOptions = Array.from(new Set(units.map((u) => u.state_name).filter(Boolean)));
  const branchOptions = units.filter((u) => stateName !== "Select" && u.state_name === stateName);

  const fetchPolicies = async () => {
    try {
      const res = await apiGet<{ results: { policy_name: string }[] }>(`/api/leave/policies/?page_size=all`);
      setPolicies((res?.results ?? []).map((p) => ({ name: p.policy_name })));
    } catch { setPolicies([]); }
  };
  const fetchEmpNames = async () => {
    try {
      const d = await apiGet<{ results: { code: string; name: string }[] }>(`/api/leave/assignments/assignable_employees/`);
      const m: Record<string, string> = {};
      (d?.results ?? []).forEach((e) => { m[e.code] = e.name; });
      setEmpNameMap(m);
    } catch { /* names fall back to codes */ }
  };

  // Legacy ddlpolicies_SelectedIndexChanged: show employees already assigned to the policy.
  const loadAssigned = async (policyName: string) => {
    if (!policyName || policyName === "0") { setRightItems([]); return; }
    try {
      const d = await apiGet<{ results: { emp_code: string }[] }>(`/api/leave/assignments/?policy_name=${encodeURIComponent(policyName)}&page_size=all`);
      const assigned = (d?.results ?? []).map((r) => ({ code: r.emp_code, name: empNameMap[r.emp_code] || r.emp_code }));
      setRightItems(assigned);
      setLeftItems((prev) => prev.filter((i) => !assigned.some((a) => a.code === i.code)));
    } catch { setRightItems([]); }
  };

  // Legacy radio_validate(): policy, client, state and branch must be chosen first.
  const radioValidate = (): boolean => {
    if (!selectedPolicy || selectedPolicy === "0") { alert("Please Select Policies"); return false; }
    if (client === "Select") { alert("Please Select Client name"); return false; }
    if (stateName === "Select") { alert("Please Select State name"); return false; }
    if (branch === "Select") { alert("Please Select Branch name"); return false; }
    return true;
  };

  const loadEmployees = async (qs: string) => {
    const d = await apiGet<{ results: { code: string; name: string }[] }>(`/api/leave/assignments/assignable_employees/?${qs}`);
    const assigned = new Set(rightItems.map((r) => r.code));
    setLeftItems((d?.results ?? []).filter((e) => !assigned.has(e.code)));
  };

  const handleSelectionTypeChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (!radioValidate()) return;
    setSelectionType(val);
    setLeftItems([]); setSelectedLeft([]); setSelectedRight([]); setPicked([]); setPickItems([]);
    setLoading(true);
    try {
      if (val === "Employee List") {
        await loadEmployees(`client_code=${encodeURIComponent(client)}&unit_code=${encodeURIComponent(branch)}&staff_only=1&state=${encodeURIComponent(stateName)}`);
      } else if (val === "Client List") {
        setPickItems(clients.map((c) => ({ code: c.client_code, name: c.client_name })));
      } else if (val === "Branch List") {
        setPickItems(units.map((u) => ({ code: u.unit_code, name: u.unit_name })));
      }
    } catch { setLeftItems([]); } finally { setLoading(false); }
  };

  // radiolistcox / RadioButtonList1 selection: load the employees of the picked clients / branches.
  const onPick = async (code: string, on: boolean) => {
    const next = on ? [...picked, code] : picked.filter((c) => c !== code);
    setPicked(next);
    if (next.length === 0) { setLeftItems([]); return; }
    setLoading(true);
    try {
      const key = selectionType === "Client List" ? "client_code" : "unit_code";
      const all: Item[] = [];
      for (const c of next) {
        const d = await apiGet<{ results: { code: string; name: string }[] }>(`/api/leave/assignments/assignable_employees/?${key}=${encodeURIComponent(c)}`);
        all.push(...(d?.results ?? []));
      }
      const seen = new Set(rightItems.map((r) => r.code));
      setLeftItems(all.filter((e, i, a) => !seen.has(e.code) && a.findIndex((x) => x.code === e.code) === i));
    } catch { setLeftItems([]); } finally { setLoading(false); }
  };

  const moveRight = () => { const m = leftItems.filter((i) => selectedLeft.includes(i.code)); setRightItems([...rightItems, ...m]); setLeftItems(leftItems.filter((i) => !selectedLeft.includes(i.code))); setSelectedLeft([]); };
  const moveAllRight = () => { setRightItems([...rightItems, ...leftItems]); setLeftItems([]); setSelectedLeft([]); };
  const moveLeft = () => { const m = rightItems.filter((i) => selectedRight.includes(i.code)); setLeftItems([...leftItems, ...m]); setRightItems(rightItems.filter((i) => !selectedRight.includes(i.code))); setSelectedRight([]); };
  const moveAllLeft = () => { setLeftItems([...leftItems, ...rightItems]); setRightItems([]); setSelectedRight([]); };

  const handleSubmit = async () => {
    if (selectedPolicy === "0" || !selectedPolicy) { alert("Please select Policy."); return; }
    if (rightItems.length === 0) { alert("Employees adding failed to Policy."); return; }
    const codes = rightItems.map((i) => i.code);
    const payload: Record<string, unknown> = { policy_name: selectedPolicy, emp_codes: codes };
    setLoading(true);
    try {
      const r = await apiPost(`/api/leave/assignments/assign/`, payload);
      if (r.ok) { alert("Employees added successfully to Policy."); setRightItems([]); setSelectedRight([]); }
      else { const b = await r.json().catch(() => ({})); alert(Array.isArray(b) ? b[0] : (b.detail || "Employees adding failed to Policy.")); }
    } catch { alert("Employees adding failed to Policy."); } finally { setLoading(false); }
  };

  return (
    <div className="container-fluid" style={{ maxWidth: "99%", margin: "0 auto", padding: "20px" }}>
      {loading && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(204,204,204,0.7)", zIndex: 9999 }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>Loading...</div>
        </div>
      )}

      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "8.33%" }}></div>
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>ASSIGN LEAVE POLICY</div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); window.open("/html/travelling_managment.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }} style={{ color: "#fff", fontSize: "10px" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>

        <div className="panel-body" style={{ padding: "15px" }}>
          <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "25px", marginBottom: "20px", marginTop: "20px" }}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", marginBottom: "14px", gap: "12px" }}>
              <div style={{ flex: "1 1 200px" }}><b>Client Name :</b>
                <select value={client} onChange={(e) => setClient(e.target.value)} className="form-control" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }}>
                  <option value="Select">Select</option>
                  {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 200px" }}><b>State Name :</b>
                <select value={stateName} onChange={(e) => { setStateName(e.target.value); setBranch("Select"); }} className="form-control" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }}>
                  <option value="Select">Select</option>
                  {stateOptions.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 240px" }}><b>Branch Name :</b>
                <select value={branch} onChange={(e) => setBranch(e.target.value)} className="form-control" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }}>
                  <option value="Select">Select</option>
                  {branchOptions.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
                </select>
              </div>
            </div>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: "0 0 16.66%", marginTop: "10px" }}><b>Select Policies :</b></div>
              <div style={{ flex: "0 0 16.66%" }}>
                <select value={selectedPolicy} onChange={(e) => { setSelectedPolicy(e.target.value); loadAssigned(e.target.value); }} className="form-control" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }}>
                  <option value="0">Select Policy</option>
                  {policies.map((p) => <option key={p.name} value={p.name}>{p.name}</option>)}
                </select>
              </div>
              <div style={{ flex: "0 0 8.33%" }}></div>
              <div style={{ flex: "0 0 16.66%", marginTop: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer", fontWeight: "normal" }}>
                  <input type="radio" name="selectionType" value="Employee List" checked={selectionType === "Employee List"} onChange={handleSelectionTypeChange} />&nbsp;&nbsp;Employee List
                </label>
              </div>
              <div style={{ flex: "0 0 16.66%", marginTop: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer", fontWeight: "normal" }}>
                  <input type="radio" name="selectionType" value="Client List" checked={selectionType === "Client List"} onChange={handleSelectionTypeChange} />&nbsp;&nbsp;Client List
                </label>
              </div>
              <div style={{ flex: "0 0 16.66%", marginTop: "10px" }}>
                <label style={{ display: "flex", alignItems: "center", cursor: "pointer", fontWeight: "normal" }}>
                  <input type="radio" name="selectionType" value="Branch List" checked={selectionType === "Branch List"} onChange={handleSelectionTypeChange} />&nbsp;&nbsp;Branch List
                </label>
              </div>
            </div>

            <br />

            {(selectionType === "Client List" || selectionType === "Branch List") && pickItems.length > 0 && (
              <div style={{ maxHeight: "140px", overflow: "auto", background: "#fff", border: "1px solid #ccc", borderRadius: "4px", padding: "8px", marginBottom: "14px" }}>
                {pickItems.map((it) => (
                  <label key={it.code} style={{ display: "inline-flex", alignItems: "center", gap: "6px", marginRight: "18px", fontWeight: "normal" }}>
                    <input type="checkbox" checked={picked.includes(it.code)} onChange={(e) => onPick(it.code, e.target.checked)} />{it.name}
                  </label>
                ))}
              </div>
            )}

            <div className="row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: "0 0 25%" }} />
              <div style={{ flex: "0 0 25%" }}>
                <select multiple size={15} style={{ width: "100%", height: "300px", padding: "5px", border: "1px solid #ccc" }}
                  value={selectedLeft} onChange={(e) => setSelectedLeft(Array.from(e.target.selectedOptions, (o) => o.value))}>
                  {leftItems.map((i) => <option key={i.code} value={i.code}>{i.name}</option>)}
                </select>
              </div>
              <div style={{ flex: "0 0 8.33%" }} />
              <div style={{ flex: "0 0 16.66%", textAlign: "center" }}>
                {[[">>", moveAllRight], [">", moveRight], ["<", moveLeft], ["<<", moveAllLeft]].map(([t, fn], k) => (
                  <div key={k} style={{ marginBottom: "15px" }}>
                    <button onClick={fn as () => void} className="btn btn-primary" style={{ padding: "6px 15px", backgroundColor: "#428bca", borderColor: "#357ebd", color: "#fff", borderRadius: "4px" }}>{t as string}</button>
                  </div>
                ))}
              </div>
              <div style={{ flex: "0 0 25%" }}>
                <select multiple size={15} style={{ width: "100%", height: "300px", padding: "5px", border: "1px solid #ccc" }}
                  value={selectedRight} onChange={(e) => setSelectedRight(Array.from(e.target.selectedOptions, (o) => o.value))}>
                  {rightItems.map((i) => <option key={i.code} value={i.code}>{i.name}</option>)}
                </select>
              </div>
            </div>

            <br /><br />

            <div style={{ textAlign: "center" }}>
              <button onClick={handleSubmit} className="btn btn-primary" style={{ backgroundColor: "#428bca", borderColor: "#357ebd", color: "#fff", padding: "6px 12px", borderRadius: "4px", marginRight: "10px", cursor: "pointer" }}>Submit</button>
              <Link href="/" className="btn btn-danger" style={{ backgroundColor: "#d9534f", borderColor: "#d43f3a", color: "#fff", padding: "6px 12px", borderRadius: "4px", textDecoration: "none" }}>Close</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
