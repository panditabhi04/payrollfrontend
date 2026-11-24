"use client";
import React, { useEffect, useState, useCallback } from "react";
import { getJSON, mk } from "@/lib/api/legacy-fetch";

// Shared Send Email / Softcopy Mail composer. Legacy Pay_Send_Email.aspx / softcopy_email_send.aspx.
// Fail-closed: shows the REAL provider result (never fakes "sent").
interface Log { id: number; to_email: string; subject: string; status: string; error: string; reference?: string; sent_by: string; created_at: string; }

export default function EmailComposer({ endpoint, title }: { endpoint: string; title: string }) {
  const [rows, setRows] = useState<Log[]>([]);
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ to_email: "", cc_email: "", subject: "", body: "", reference: "" });

  const load = useCallback(async () => {
    const d = await getJSON<{ results: Log[] } | Log[]>(endpoint);
    setRows((Array.isArray(d) ? d : d?.results ?? []) as Log[]);
  }, [endpoint]);
  useEffect(() => { load(); }, [load]);

  const send = async () => {
    const r = await mk(endpoint, form);
    const b = await r.json().catch(() => ({}));
    if (r.ok) setMsg("Email sent");
    else if (r.status === 503) setMsg(`Not sent — ${b.status || "provider unavailable"}: ${b.error || ""}`);
    else setMsg(b.detail || JSON.stringify(b));
    load();
  };
  const F = (k: keyof typeof form, label: string) => (
    <div><label>{label}: <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} style={{ width: 320 }} /></label></div>);

  return (
    <div style={{ padding: 16 }}>
      <h2>{title}</h2>
      {msg && <div style={{ color: "#b45309", margin: "8px 0" }}>{msg}</div>}
      <div style={{ border: "1px solid #ddd", padding: 10, marginBottom: 12, maxWidth: 560 }}>
        {F("to_email", "To (comma-separated)")}
        {F("cc_email", "CC")}
        {F("subject", "Subject")}
        {F("reference", "Reference")}
        <div><label>Body:<br /><textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} cols={50} /></label></div>
        <button onClick={send} style={{ marginTop: 6 }}>Send</button>
        <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>Delivery status reflects the real SMTP provider result (fail-closed if not configured).</div>
      </div>
      <table border={1} cellPadding={6} style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead><tr><th>To</th><th>Subject</th><th>Status</th><th>Error</th><th>By</th><th>Date</th></tr></thead>
        <tbody>
          {rows.map((l) => (
            <tr key={l.id}>
              <td>{l.to_email}</td><td>{l.subject}</td>
              <td style={{ color: l.status === "Sent" ? "#15803d" : "#b91c1c" }}>{l.status}</td>
              <td>{l.error}</td><td>{l.sent_by}</td><td>{l.created_at?.slice(0, 19).replace("T", " ")}</td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center" }}>No emails</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
