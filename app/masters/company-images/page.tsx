"use client";
import React, { useEffect, useState, useCallback } from "react";
import { getJSON, rm } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

// Legacy CompanyMaster.aspx / clientmaster.aspx document upload (pay_images, ~/Images/).
// Real file upload/download; filename = <comp_code>_<description>_<ext> (server-generated).
interface Img { id: number; description: string; file_name: string; file_url: string; client_code?: string; }

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : "";
}

export default function CompanyImagesPage() {
  const [rows, setRows] = useState<Img[]>([]);
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const data = await getJSON<{ results: Img[] }>("/api/masters/company-images/");
    setRows((data?.results as Img[]) ?? []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const upload = async () => {
    if (!desc.trim()) { setMsg("Please Enter Document Description"); return; }
    if (!file) { setMsg("Please Select File To Upload"); return; }
    await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
    const fd = new FormData();
    fd.append("description", desc); fd.append("file", file);
    const r = await fetch(`${API_BASE_URL}/api/masters/company-images/`, {
      method: "POST", credentials: "include",
      headers: { "X-CSRFToken": getCookie("csrftoken") }, body: fd,
    });
    if (r.ok) { setMsg("Record added successfully!!"); setDesc(""); setFile(null); load(); }
    else { const b = await r.json().catch(() => ({})); setMsg(JSON.stringify(b)); }
  };
  const del = async (id: number) => {
    const r = await rm(`/api/masters/company-images/${id}/`);
    setMsg(r.ok ? "Record deleted successfully !!" : `Delete failed (${r.status})`); load();
  };

  return (
    <div className="lg-panel">
      <div className="lg-panel-head">Company Document / Images</div>
      <div className="lg-panel-body">
      {msg && <div style={{ color: "#424D7A", margin: "8px 0" }}>{msg}</div>}
      <div style={{ border: "1px solid #ddd", padding: 10, marginBottom: 12, maxWidth: 520 }}>
        <div><label>Description: <input value={desc} onChange={(e) => setDesc(e.target.value)} /></label></div>
        <div><label>File: <input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label></div>
        <button onClick={upload} style={{ marginTop: 6 }}>Upload</button>
      </div>
      <table className="dt-grid">
        <thead><tr><th>Description</th><th>File Name</th><th>Download</th><th>Action</th></tr></thead>
        <tbody>
          {rows.map((i) => (
            <tr key={i.id}>
              <td>{i.description}</td><td>{i.file_name}</td>
              <td><a href={`${API_BASE_URL}/api/masters/company-images/${i.id}/download/`} target="_blank" rel="noreferrer">Download</a></td>
              <td><button onClick={() => del(i.id)}>Delete</button></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center" }}>No documents</td></tr>}
        </tbody>
      </table>
      </div>
    </div>
  );
}
