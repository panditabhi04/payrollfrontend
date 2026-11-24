"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import { listItems } from "@/lib/api/crud";
import { apiGet } from "@/lib/api/client";
import "./Dashboard.css";

interface Named { [k: string]: unknown }
interface Summary {
  comp_code?: string; company_name?: string;
  total_employee: number; present_today: number; absent_today: number;
  birthdays_today: number; relieved_this_month: number;
}

export default function Dashboard() {
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(false);
  const [clients, setClients] = useState<Named[]>([]);
  const [units, setUnits] = useState<Named[]>([]);
  const [client, setClient] = useState("");
  const [state, setState] = useState("");
  const [unit, setUnit] = useState("");
  const [totalEmp, setTotalEmp] = useState<number | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getMe().then(async (m) => {
      setMe(m); setChecked(true);
      if (!m) return;
      try {
        const [c, e] = await Promise.all([
          listItems<Named>("/api/masters/clients", { pageSize: 200 }).catch(() => null),
          listItems<Named>("/api/hr/employees", { pageSize: 1 }).catch(() => null),
        ]);
        if (c) setClients(c.results);
        if (e) setTotalEmp(e.count);
      } catch { /* ignore */ }
    });
  }, []);

  // Branch list is loaded server-side per client with full pagination: the
  // unit table holds 3,768+ rows and the API caps page_size at 200, so a
  // single first-200 fetch drops most branches (this is why Branch stayed
  // empty for clients whose units sit beyond row 200, like BAJAJ ALLIANZ).
  useEffect(() => {
    if (!me) return;
    if (!client) { setUnits([]); return; }
    let alive = true;
    (async () => {
      const all: Named[] = [];
      let page = 1;
      for (;;) {
        const r = await listItems<Named>("/api/masters/units", { page: page, pageSize: 200, filters: { client_code: client } }).catch(() => null);
        if (!r || r.results.length === 0) break;
        all.push(...r.results);
        if (all.length >= (r.count ?? 0) || r.results.length < 200) break;
        page += 1;
        if (page > 50) break; // safety cap: 10,000 units
      }
      if (alive) setUnits(all);
    })().catch(() => { if (alive) setUnits([]); });
    return () => { alive = false; };
  }, [client, me]);

  // Live card numbers (read-only counts) — re-fetched whenever a filter changes.
  useEffect(() => {
    if (!me) return;
    let alive = true;
    const qs = new URLSearchParams();
    if (client) qs.set("client_code", client);
    if (state) qs.set("state_name", state);
    if (unit) qs.set("unit_code", unit);
    apiGet<Summary>(`/api/hr/dashboard-summary/${qs.toString() ? `?${qs}` : ""}`, { credentials: "include" })
      .then((d) => { if (alive) setSummary(d); })
      .catch(() => { if (alive) setSummary(null); });
    return () => { alive = false; };
  }, [me, client, state, unit]);

  // Presentation only: size the dashboard to exactly the space between the
  // site header and footer so the whole Home screen fits one frame.
  useEffect(() => {
    const fit = () => {
      const el = rootRef.current;
      if (!el) return;
      const hdr = document.querySelector(".ihms-header") as HTMLElement | null;
      const ftr = document.querySelector(".app-footer") as HTMLElement | null;
      const fs = ftr ? ftr.offsetHeight + parseFloat(getComputedStyle(ftr).marginTop || "0") : 0;
      el.style.setProperty("--hm-avail", `${Math.max(0, window.innerHeight - (hdr?.offsetHeight ?? 0) - fs)}px`);
    };
    fit();
    window.addEventListener("resize", fit);
    const t = window.setTimeout(fit, 400);
    return () => { window.removeEventListener("resize", fit); window.clearTimeout(t); };
  }, [checked, me]);

  const n = (v: number | undefined | null) => (v === undefined || v === null ? "—" : v);

  if (checked && !me) {
    return (
      <div className="hm-skin" ref={rootRef}>
        <div className="hm-hero hm-hero-solo">
          <div className="hm-hero-text">
            <div className="ihms-welcome hm-welcome">Welcome To IHMS</div>
          </div>
          <Link href="/login" className="ihms-btn hm-signin">Sign in to continue</Link>
        </div>
      </div>
    );
  }

  // Strict cascade like legacy (Client -> State -> Branch): State and Branch
  // stay empty until a client is chosen; both derive from that client's units.
  const stateOptions = Array.from(new Set(units.map((u) => String((u as Named).state_name ?? "")))).filter(Boolean).sort();
  // Branch follows client + state (legacy cascades Client -> State -> Branch).
  const unitOptions = units.filter((u) =>
    (!client || String(u.client_code ?? "") === client) &&
    (!state || String((u as Named).state_name ?? "") === state));

  return (
    <div className="hm-skin" ref={rootRef}>
      <section className="hm-hero">
        <div className="hm-hero-text">
          <div className="hm-eyebrow">Payroll &amp; HR Management</div>
          <div className="ihms-welcome hm-welcome" title={summary?.company_name || undefined}>
            Welcome To {summary?.company_name?.trim() || "IHMS"}
          </div>
          {me && (
            <div className="hm-user">
              <span className="hm-avatar" aria-hidden="true">{(me.username || "?").charAt(0).toUpperCase()}</span>
              <span className="hm-user-name">{me.username}</span>
              {me.role && <span className="hm-chip">{me.role}</span>}
            </div>
          )}
        </div>
        <div className="hm-hero-art" aria-hidden="true">
          <span className="hm-cube hm-cube-a" /><span className="hm-cube hm-cube-b" /><span className="hm-cube hm-cube-c" />
        </div>
      </section>

      <section className="hm-section">
        <div className="hm-section-title"><i className="fa fa-filter" aria-hidden="true"></i> Filters</div>
        <div className="ihms-filters hm-filters">
          <div className="ihms-filter">
            <label>Client Name :</label>
            <select value={client} onChange={(e) => { setClient(e.target.value); setState(""); setUnit(""); }}>
              <option value="">Select</option>
              {clients.map((c) => (
                <option key={String(c.id)} value={String(c.client_code ?? "")}>{String(c.client_name ?? c.client_code ?? "")}</option>
              ))}
            </select>
          </div>
          <div className="ihms-filter">
            <label>State Name :</label>
            <select value={state} onChange={(e) => { setState(e.target.value); setUnit(""); }}>
              <option value="">Select</option>
              {stateOptions.map((sn) => (
                <option key={sn} value={sn}>{sn}</option>
              ))}
            </select>
          </div>
          <div className="ihms-filter">
            <label>Branch Name :</label>
            <select value={unit} onChange={(e) => setUnit(e.target.value)}>
              <option value="">Select</option>
              {unitOptions.map((u) => (
                <option key={String(u.id)} value={String(u.unit_code ?? "")}>{String(u.unit_name ?? u.unit_code ?? "")}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <link href="/dashboard/css/font-awesome.css" rel="stylesheet" />

      <div className="hm-main">
      <section className="hm-section">
        <div className="hm-section-title"><i className="fa fa-th-large" aria-hidden="true"></i> Workforce Overview</div>
        <div className="hm-panel hm-overview">
          <Link href="/hr/employees" className="hm-feature hm-tone-blue">
            <span className="hm-icon hm-icon-xl"><i className="fa fa-building-o" aria-hidden="true"></i></span>
            <span className="hm-card-body">
              <span className="hm-label">Total Employee</span>
              <span className="hm-value hm-value-xl">{summary ? summary.total_employee : (totalEmp ?? "—")}</span>
            </span>
          </Link>
          <div className="hm-overview-side">
            <Link href="/hr/attendance-sheet" className="hm-stat hm-tone-green">
              <span className="hm-icon hm-icon-lg"><i className="fa fa-users" aria-hidden="true"></i></span>
              <span className="hm-card-body">
                <span className="hm-label">Present Employee</span>
                <span className="hm-value hm-value-lg">{n(summary?.present_today)}</span>
              </span>
            </Link>
            <Link href="/hr/attendance-sheet" className="hm-stat hm-tone-red">
              <span className="hm-icon hm-icon-lg"><i className="fa fa-database" aria-hidden="true"></i></span>
              <span className="hm-card-body">
                <span className="hm-label">Absent Employee</span>
                <span className="hm-value hm-value-lg">{n(summary?.absent_today)}</span>
              </span>
            </Link>
          </div>
        </div>
      </section>

      <section className="hm-section">
        <div className="hm-section-title"><i className="fa fa-bell-o" aria-hidden="true"></i> Notifications &amp; Profile</div>
        <div className="hm-panel hm-rows">
          <Link href="/hr/employees" className="hm-row hm-tone-amber">
            <span className="hm-icon"><i className="fa fa-birthday-cake" aria-hidden="true"></i></span>
            <span className="hm-row-label">Birthday Notification</span>
            <span className="hm-value hm-value-row">{n(summary?.birthdays_today)}</span>
            <i className="fa fa-angle-right hm-chev" aria-hidden="true"></i>
          </Link>
          <Link href="/hr/my-info" className="hm-row hm-tone-violet">
            <span className="hm-icon"><i className="fa fa-user-plus" aria-hidden="true"></i></span>
            <span className="hm-row-label">My Profile</span>
            <span className="hm-view">View</span>
            <i className="fa fa-angle-right hm-chev" aria-hidden="true"></i>
          </Link>
          <Link href="/hr/employees" className="hm-row hm-tone-slate">
            <span className="hm-icon"><i className="fa fa-user-secret" aria-hidden="true"></i></span>
            <span className="hm-row-label">Employee Reliver</span>
            <span className="hm-value hm-value-row">{n(summary?.relieved_this_month)}</span>
            <i className="fa fa-angle-right hm-chev" aria-hidden="true"></i>
          </Link>
          <Link href="/attendance/android-logs" className="hm-row hm-tone-blue">
            <span className="hm-icon"><i className="fa fa-android" aria-hidden="true"></i></span>
            <span className="hm-row-label">Android Attendance</span>
            <span className="hm-view">View</span>
            <i className="fa fa-angle-right hm-chev" aria-hidden="true"></i>
          </Link>
        </div>
      </section>

      </div>

      <p className="hm-note">
        <i className="fa fa-info-circle" aria-hidden="true"></i>
        Live counts: Present/Absent are today&apos;s entries in the attendance muster, Birthday is today&apos;s birthdays,
        Reliver is employees relieved this month. All follow the Client / State / Branch filters.
      </p>
    </div>
  );
}
