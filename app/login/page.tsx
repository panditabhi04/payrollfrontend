"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/lib/api/auth";
import "./login.css";

// The app is shared by many offices, so nothing company-specific is hard-coded here. A deployment may
// optionally brand its own login screen with NEXT_PUBLIC_BRAND_NAME / NEXT_PUBLIC_BRAND_LOGO.
const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || "";
const BRAND_LOGO = process.env.NEXT_PUBLIC_BRAND_LOGO || "";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPw, setShowPw] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim()) {
      alert("Please Enter Login ID !!!");
      return;
    }
    if (!password) {
      alert("Please Enter Password !!!");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { ok, status, data } = await login(username, password);
      if (ok) {
        router.push("/");
        return;
      }
      if (status === 403 && (data as { must_change_password?: boolean }).must_change_password) {
        router.push("/password-setup");
        return;
      }
      setError("Invalid credentials."); // generic, no enumeration
    } catch {
      setError("Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="lg2-stage">
      <section className="lg2-shell">
        <aside className="lg2-brand">
          {BRAND_LOGO && <img src={BRAND_LOGO} alt={BRAND_NAME || "Logo"} className="lg2-logo" />}
          <div className="lg2-eyebrow">Payroll &amp; HR Management</div>
          <h1 className="lg2-title">{BRAND_NAME ? `Welcome To ${BRAND_NAME}` : "Welcome"}</h1>
          <p className="lg2-sub">Sign in to manage payroll, attendance, billing and compliance for your organisation.</p>
          <span className="lg2-cube lg2-cube-a" aria-hidden="true" />
          <span className="lg2-cube lg2-cube-b" aria-hidden="true" />
          <span className="lg2-cube lg2-cube-c" aria-hidden="true" />
        </aside>

        <div className="lg2-card">
          <div className="lg2-card-head">Welcome!!!</div>
          <form onSubmit={onSubmit} className="lg2-form">
            <label className="lg2-field">
              <span>Login ID</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" required autoFocus />
            </label>
            <label className="lg2-field">
              <span>Password</span>
              <div className="lg2-pw">
                <input type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                <button type="button" className="lg2-eye" onClick={() => setShowPw(!showPw)} aria-label={showPw ? "Hide password" : "Show password"} tabIndex={-1}>
                  {showPw ? "Hide" : "Show"}
                </button>
              </div>
            </label>
            {error && <div className="lg2-error">{error}</div>}
            <button type="submit" disabled={loading} className="lg2-btn">{loading ? "Signing in…" : "Sign in"}</button>
            <p className="lg2-first">
              <a href="/login/privacy-policy">Privacy Policy</a> and <a href="/login/terms-and-conditions">Terms and Conditions</a>
            </p>
          </form>
        </div>
      </section>
      <footer className="lg2-footer">
        Copyright &copy; 2020 CeltSoft. All rights reserved.
      </footer>
    </main>
  );
}
