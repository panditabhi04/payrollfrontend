"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getJSON } from "@/lib/api/legacy-fetch";
import { API_BASE_URL, drfErrorText } from "@/lib/api/client";

// Old reliance_image_upload.aspx — "Image Upload".
// Client/State dropdowns -> per-branch grid with 5 file columns
// (Reception/Washroom/Pantry/Common Area1/Common Area2) -> Upload / Send Email / Report / Close.
const SI = "/api/hr/site-images/";
const SLOTS = [
  { id: "image_1", label: "Reception" },
  { id: "image_2", label: "Washroom" },
  { id: "image_3", label: "Pantry" },
  { id: "image_4", label: "Common Area1" },
  { id: "image_5", label: "Common Area2" },
];

interface ClientRow { client_code: string; client_name: string }
interface UnitRow { unit_code: string; unit_name: string; state_name: string }

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

export default function SiteImagesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [units, setUnits] = useState<UnitRow[]>([]);
  const [client, setClient] = useState("Select");
  const [state, setState] = useState("Select");
  const [emailIds, setEmailIds] = useState("");
  const [files, setFiles] = useState<Record<string, File | null>>({});

  // Page_Load: only the clients assigned to the login (pay_client_state_role_grade)
  useEffect(() => {
    getJSON<{ results: ClientRow[] }>(`${SI}clients/`).then((d) => setClients(d?.results ?? []));
  }, []);

  const onClient = async (v: string) => {
    setClient(v); setState("Select"); setUnits([]); setFiles({});
    if (!v || v === "Select") { setStates([]); return; }
    const d = await getJSON<{ results: string[] }>(`${SI}states/?client_code=${encodeURIComponent(v)}`);
    setStates(d?.results ?? []);
  };

  const onState = async (v: string) => {
    setState(v); setUnits([]); setFiles({});
    if (!v || v === "Select" || !client || client === "Select") return;
    setLoading(true);
    try {
      const d = await getJSON<{ results: UnitRow[] }>(
        `${SI}units/?client_code=${encodeURIComponent(client)}&state_name=${encodeURIComponent(v)}`);
      setUnits(d?.results ?? []);
    } catch { setUnits([]); }
    finally { setLoading(false); }
  };

  const setFile = (unit: string, slot: string, f: File | null) =>
    setFiles((p) => ({ ...p, [`${unit}:${slot}`]: f }));

  const doUpload = async () => {
    const jobs: { unit: string; slot: string; file: File }[] = [];
    units.forEach((u) => SLOTS.forEach((s) => {
      const f = files[`${u.unit_code}:${s.id}`];
      if (f) jobs.push({ unit: u.unit_code, slot: s.id, file: f });
    }));
    if (jobs.length === 0) { alert("Please Select Image To Upload"); return; }
    setLoading(true);
    try {
      await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
      let ok = 0, lastErr = "";
      for (const j of jobs) {
        const fd = new FormData();
        fd.append("client_code", client === "Select" ? "" : client);
        fd.append("state_name", state === "Select" ? "" : state);
        fd.append("unit_code", j.unit);
        fd.append("slot", j.slot);
        fd.append("image", j.file);
        const r = await fetch(`${API_BASE_URL}${SI}`, {
          method: "POST", credentials: "include",
          headers: { "X-CSRFToken": getCookie("csrftoken") ?? "" }, body: fd,
        });
        if (r.ok) ok += 1;
        else {
          try { const e = await r.json(); lastErr = drfErrorText(e) || `Failed (${r.status})`; }
          catch { lastErr = `Failed (${r.status})`; }
        }
      }
      if (lastErr) alert(lastErr);
      if (ok > 0) { alert("Images uploaded successfully !!!"); setFiles({}); }
    } finally { setLoading(false); }
  };

  const doSendMail = async () => {
    setLoading(true);
    try {
      await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
      const r = await fetch(`${API_BASE_URL}${SI}send-mail/`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": getCookie("csrftoken") ?? "" },
        body: JSON.stringify({ client_code: client === "Select" ? "" : client, email_ids: emailIds }),
      });
      const d = await r.json().catch(() => ({}));
      alert(r.ok ? (d.detail || "Email sent successfully !!!") : (drfErrorText(d) || "Issue in sending Email, Please retry !!!"));
    } finally { setLoading(false); }
  };

  const doReport = async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `${API_BASE_URL}${SI}report/?client_code=${encodeURIComponent(client === "Select" ? "" : client)}`,
        { credentials: "include" });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        alert(drfErrorText(d) || "No Matching Records Found.");
        return;
      }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "WORKING_IMAGES.xls";
      a.click();
      URL.revokeObjectURL(a.href);
    } finally { setLoading(false); }
  };

  return (
    <div className="container-fluid">
      {loading && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(204,204,204,.7)", zIndex: 9999 }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>Loading...</div>
        </div>
      )}
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: 4 }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px" }}>
          <div className="row" style={{ display: "flex", alignItems: "center" }}>
            <div style={{ flex: "0 0 91.66%" }}>
              <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase"><b>Image Upload</b></div>
            </div>
            <div style={{ flex: "0 0 8.33%", textAlign: "right" }}>
              <Link href="#" onClick={(e) => { e.preventDefault(); window.open("/html/reliance_image_upload.html", "popUpWindow", "height=500,width=600,left=100,top=100"); }} style={{ color: "#fff" }}>
                <img src="/Images/help_ico.png" alt="Help" width="20" height="20" />
              </Link>
            </div>
          </div>
        </div>
        <div className="panel-body" style={{ padding: 15 }}>
          <div className="container-fluid" style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: 10, padding: 15, marginBottom: 20, marginTop: 20 }}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: "1 1 200px" }}>
                <b>Client :</b> <span style={{ color: "red" }}>*</span>
                <select value={client} onChange={(e) => onClient(e.target.value)} className="form-control" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: 4 }}>
                  <option value="Select">Select</option>
                  {clients.map((c) => (
                    <option key={c.client_code} value={c.client_code}>{c.client_name}</option>
                  ))}
                </select>
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <b>State :</b> <span style={{ color: "red" }}>*</span>
                <select value={state} onChange={(e) => onState(e.target.value)} className="form-control" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: 4 }}>
                  <option value="Select">Select</option>
                  {states.map((s) => (<option key={s} value={s}>{s}</option>))}
                </select>
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <b>Email IDs :</b> <span style={{ color: "red" }}>*</span>
                <input value={emailIds} onChange={(e) => setEmailIds(e.target.value)} className="form-control" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: 4 }} />
              </div>
            </div>
            <br />
            <div className="container-fluid">
              <div style={{ overflowX: "auto" }}>
                <table className="table lg-grid" style={{ width: "100%", backgroundColor: "#fff" }}>
                  <thead>
                    <tr>
                      <th style={{ display: "none" }}>ID</th>
                      <th>Branch Name</th>
                      {SLOTS.map((s) => (<th key={s.id}>{s.label}</th>))}
                    </tr>
                  </thead>
                  <tbody>
                    {units.map((u) => (
                      <tr key={u.unit_code}>
                        <td style={{ display: "none" }}>{u.unit_code}</td>
                        <td>{u.unit_name}</td>
                        {SLOTS.map((s) => (
                          <td key={s.id}>
                            <input type="file" accept=".jpg,.jpeg,.png" onChange={(e) => setFile(u.unit_code, s.id, e.target.files?.[0] ?? null)} />
                          </td>
                        ))}
                      </tr>
                    ))}
                    {units.length === 0 && (
                      <tr><td colSpan={6} style={{ textAlign: "center" }}>Select Client and State to list branches</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <br />
          <div className="row text-center" style={{ textAlign: "center" }}>
            {state !== "Select" && <button onClick={doUpload} className="btn btn-primary lg-btn-primary" style={{ marginRight: 8 }}>Upload</button>}
            {state !== "Select" && <button onClick={doSendMail} className="btn btn-primary lg-btn-primary" style={{ marginRight: 8 }}>Send Email</button>}
            <button onClick={doReport} className="btn btn-primary lg-btn-primary" style={{ marginRight: 8 }}>Report</button>
            <button onClick={() => router.push("/Home")} className="btn btn-danger lg-btn-danger">Close</button>
          </div>
          <br /><br />
        </div>
      </div>
    </div>
  );
}
