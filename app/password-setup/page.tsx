"use client";

import { useState } from "react";
import { passwordSetup } from "@/lib/api/auth";

export default function PasswordSetupPage() {
  const [token, setToken] = useState("");
  const [pw, setPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(null); setErr(null);
    try {
      const { ok, data } = await passwordSetup(token, pw);
      if (ok) {
        setMsg("Password set. You can now sign in.");
        setToken(""); setPw("");
      } else {
        const d = (data as { detail: string | string[] }).detail;
        setErr(Array.isArray(d) ? d.join(" ") : d || "Invalid or expired token.");
      }
    } catch {
      setErr("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 420, margin: "8vh auto" }}>
      <h1 style={{ fontSize: 22 }}>Set your password</h1>
      <p style={{ color: "#666", fontSize: 14 }}>
        Enter the single-use setup token you were issued and choose a strong password.
        Legacy passwords are never reused.
      </p>
      <form onSubmit={onSubmit} style={{ display: "grid", gap: 12, marginTop: 16 }}>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13 }}>Setup token</span>
          <input value={token} onChange={(e) => setToken(e.target.value)} style={inp} required />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 13 }}>New password</span>
          <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" style={inp} required />
        </label>
        {err && <div style={{ color: "crimson", fontSize: 14 }}>{err}</div>}
        {msg && <div style={{ color: "green", fontSize: 14 }}>{msg} <a href="/login">Sign in →</a></div>}
        <button type="submit" disabled={loading} style={btn}>{loading ? "Saving…" : "Set password"}</button>
      </form>
    </main>
  );
}

const inp: React.CSSProperties = { padding: "8px 10px", border: "1px solid #ccc", borderRadius: 6 };
const btn: React.CSSProperties = { padding: "9px 14px", border: "none", background: "#00b712", color: "#fff", borderRadius: 6, cursor: "pointer" };
