"use client";
/* =====================================================================
 * ASSIGN CLIENT — 1:1 port of Assign_Client.aspx (+ Assign_Client.aspx.cs).
 * Client List + Branch List / Employee List radios, four multi-select
 * listboxes (clients | branches | employees | selected), >>, >, <, <<
 * move buttons, Submit + Close.
 * Backend: /api/masters/client-assigns/* (legacy dropdown sources,
 * modern assignment track).
 * ===================================================================== */
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api/client";

const BASE = "/api/masters/client-assigns";

type Opt = { code: string; name: string };

async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE_URL}${path}`, { credentials: "include", cache: "no-store" });
  if (!r.ok) {
    let msg = `Request failed (${r.status})`;
    try {
      const b = await r.json();
      if (typeof b === "string" && b) msg = b;
      else if (Array.isArray(b) && b.length) msg = String(b[0]);
      else if (b?.detail) msg = String(b.detail);
      else if (b?.message) msg = String(b.message);
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  return (await r.json()) as T;
}

async function postJSON(path: string, body: any): Promise<any> {
  const csrf = await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" })
    .then((r) => r.json()).catch(() => null);
  const m = document.cookie.match(/(^|; )csrftoken=([^;]+)/);
  const r = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": (csrf as any)?.csrfToken || (m ? decodeURIComponent(m[2]) : "") },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as any)?.message || (d as any)?.detail || `Request failed (${r.status})`);
  return d;
}

const listStyle: React.CSSProperties = { height: 300, width: "100%", fontSize: 12 };
const moveBtn: React.CSSProperties = {
  backgroundColor: "#D3D3D3", border: "1px solid #00008B", borderRadius: 8,
  color: "#000", fontSize: 12, cursor: "pointer", padding: "4px 14px", fontWeight: "bold",
};

export default function ClientAssign() {
  const router = useRouter();
  const [clients, setClients] = useState<Opt[]>([]);
  const [selClients, setSelClients] = useState<string[]>([]);
  const [branches, setBranches] = useState<Opt[]>([]);
  const [selBranches, setSelBranches] = useState<string[]>([]);
  const [left, setLeft] = useState<Opt[]>([]);
  const [selLeft, setSelLeft] = useState<string[]>([]);
  const [right, setRight] = useState<Opt[]>([]);
  const [selRight, setSelRight] = useState<string[]>([]);
  const [mode, setMode] = useState<"branch" | "employee" | "">("");

  useEffect(() => {
    getJSON<{ results: Opt[] }>(`${BASE}/assign-clients/`)
      .then((d) => setClients(d.results || []))
      .catch((e: any) => alert(e.message));
  }, []);

  const pick = (e: React.ChangeEvent<HTMLSelectElement>) =>
    Array.from(e.target.selectedOptions).map((o) => o.value);

  // rdb_branch_list_CheckedChanged: branches of selected clients, clear left box.
  const onBranchMode = async () => {
    setMode("branch");
    const codes = selClients.filter((c) => c && c !== "Select");
    try {
      const d = await getJSON<{ results: Opt[]; message?: string }>(
        `${BASE}/assign-branches/?clients=${encodeURIComponent(codes.join(","))}`);
      if (d.message && (d.results || []).length === 0) alert(d.message);
      setBranches(d.results || []);
      setSelBranches([]);
      setLeft([]);
      setSelLeft([]);
    } catch (e: any) { alert(e.message); }
  };

  // rdb_employee_CheckedChanged: employees of selected branches.
  const onEmployeeMode = async () => {
    setMode("employee");
    const codes = selBranches.filter((c) => c && c !== "Select");
    try {
      const d = await getJSON<{ results: Opt[]; message?: string }>(
        `${BASE}/assign-employees/?units=${encodeURIComponent(codes.join(","))}`);
      if (d.message && (d.results || []).length === 0) alert(d.message);
      setLeft(d.results || []);
      setSelLeft([]);
    } catch (e: any) { alert(e.message); }
  };

  // brnallleft_Click: all left -> right. allriht_click: all right -> left.
  const moveAllLeft = () => {
    if (left.length === 0) return;
    setRight((r) => [...r, ...left.filter((o) => !r.some((x) => x.code === o.code))]);
    setLeft([]);
    setSelLeft([]); setSelRight([]);
  };
  const moveAllRight = () => {
    if (right.length === 0) return;
    setLeft((l) => [...l, ...right.filter((o) => !l.some((x) => x.code === o.code))]);
    setRight([]);
    setSelLeft([]); setSelRight([]);
  };
  // btnright_click: selected left -> right. btnleft_click: selected right -> left.
  const moveSelLeft = () => {
    if (selLeft.length === 0) return;
    const moving = left.filter((o) => selLeft.includes(o.code));
    setRight((r) => [...r, ...moving.filter((o) => !r.some((x) => x.code === o.code))]);
    setLeft((l) => l.filter((o) => !selLeft.includes(o.code)));
    setSelLeft([]); setSelRight([]);
  };
  const moveSelRight = () => {
    if (selRight.length === 0) return;
    const moving = right.filter((o) => selRight.includes(o.code));
    setLeft((l) => [...l, ...moving.filter((o) => !l.some((x) => x.code === o.code))]);
    setRight((r) => r.filter((o) => !selRight.includes(o.code)));
    setSelLeft([]); setSelRight([]);
  };

  // btnSubmit_click: selected clients x selected branches x right-box employees.
  const submit = async () => {
    // validate(): first selected client value == "Select" -> "Please Select Employee."
    if (selClients.length === 0 || selClients[0] === "Select") {
      alert("Please Select Employee.");
      return;
    }
    try {
      const d = await postJSON(`${BASE}/`, {
        client_codes: selClients,
        unit_codes: selBranches,
        emp_codes: right.map((o) => o.code),
      });
      alert(d.message || "Client Assign Successfully !!!");
    } catch (e: any) {
      alert(e.message || "Client Assign Failed");
    } finally {
      setRight([]);
      setSelRight([]);
    }
  };

  return (
    <div className="container-fluid">
      <div className="panel panel-primary" style={{ border: "1px solid #337ab7", borderRadius: 4 }}>
        <div className="panel-heading" style={{ background: "#337ab7", color: "#fff", padding: "10px 15px", borderRadius: "3px 3px 0 0" }}>
          <div className="row" style={{ display: "flex", alignItems: "center" }}>
            <div className="col-sm-1" style={{ flex: 1 }}></div>
            <div className="col-sm-9" style={{ flex: 9, textAlign: "center", fontSize: "small", textTransform: "uppercase" }}><b>Assign Client</b></div>
            <div className="col-sm-2 text-right" style={{ flex: 2, textAlign: "right", fontSize: 10 }}>
              <span title="Help" style={{ cursor: "help" }}>?</span>
            </div>
          </div>
        </div>
        <div className="panel-body" style={{ padding: 15 }}>
          <div className="row" style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
            <div className="col-sm-2 col-xs-12" style={{ flex: 2, marginTop: 10 }}>
              <b>Client List</b>
            </div>
            <div className="col-sm-2 col-xs-12" style={{ flex: 2 }}>
              <label style={{ fontWeight: "normal", fontSize: 12 }}>
                <input type="radio" name="assign-mode" checked={mode === "branch"} onChange={onBranchMode} />&nbsp;&nbsp;Branch List
              </label>
            </div>
            <div className="col-md-2 col-sm-3 col-xs-12" style={{ flex: 2 }}>
              <label style={{ fontWeight: "normal", fontSize: 12 }}>
                <input type="radio" name="assign-mode" checked={mode === "employee"} onChange={onEmployeeMode} />&nbsp;&nbsp;Employee List
              </label>
            </div>
            <div className="col-sm-2 col-xs-12" style={{ flex: 2 }}></div>
            <div className="col-md-3 col-sm-3 col-xs-12" style={{ flex: 3, marginTop: 10 }}></div>
          </div>
          <br />
          <div className="row" style={{ display: "flex", flexWrap: "wrap" }}>
            <div className="col-sm-2 col-xs-12" style={{ flex: 2, minWidth: 140 }}>
              <select multiple className="form-control text_box" style={listStyle} value={selClients} onChange={(e) => setSelClients(pick(e))}>
                <option value="Select">Select</option>
                {clients.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-sm-2 col-xs-12" style={{ flex: 2, minWidth: 140 }}>
              <select multiple className="form-control text_box" style={listStyle} value={selBranches} onChange={(e) => setSelBranches(pick(e))}>
                {branches.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
              </select>
            </div>
            <div className="col-sm-3 col-xs-12" style={{ flex: 3, minWidth: 160 }}>
              <select multiple style={{ ...listStyle, border: "1px solid #ccc", borderRadius: 4 }} value={selLeft} onChange={(e) => setSelLeft(pick(e))}>
                {left.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
              </select>
            </div>
            <div className="col-sm-1 col-xs-12" style={{ flex: 1, minWidth: 70, textAlign: "center" }}>
              <br /><br />
              <div className="row" style={{ marginBottom: 8 }}>
                <button type="button" value=">>" onClick={moveAllLeft} style={moveBtn}>&gt;&gt;</button>
              </div>
              <br />
              <div className="row" style={{ marginBottom: 8 }}>
                <button type="button" value="<" onClick={moveSelLeft} style={moveBtn}>&gt;</button>
              </div>
              <br />
              <div className="row" style={{ marginBottom: 8 }}>
                <button type="button" value="<" onClick={moveSelRight} style={moveBtn}>&lt;</button>
              </div>
              <br />
              <div className="row" style={{ marginBottom: 8 }}>
                <button type="button" value="<<" onClick={moveAllRight} style={moveBtn}>&lt;&lt;</button>
              </div>
            </div>
            <div className="col-sm-3 col-xs-12" style={{ flex: 3, minWidth: 160 }}>
              <select multiple style={{ ...listStyle, border: "1px solid #ccc", borderRadius: 4 }} value={selRight} onChange={(e) => setSelRight(pick(e))}>
                {right.map((o) => <option key={o.code} value={o.code}>{o.name}</option>)}
              </select>
            </div>
          </div>
          <br />
          <div className="row text-center" style={{ textAlign: "center" }}>
            <button type="button" onClick={submit} className="btn btn-primary" style={{ ...btnPrimary, marginRight: 8 }}>Submit</button>
            <button type="button" onClick={() => router.push("/")} className="btn btn-danger" style={btnDanger}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = { background: "#337ab7", color: "#fff", border: "1px solid #2e6da4", borderRadius: 4, padding: "6px 18px", fontWeight: "bold", fontSize: 12, cursor: "pointer" };
const btnDanger: React.CSSProperties = { background: "#d9534f", color: "#fff", border: "1px solid #d43f3a", borderRadius: 4, padding: "6px 18px", fontWeight: "bold", fontSize: 12, cursor: "pointer" };
