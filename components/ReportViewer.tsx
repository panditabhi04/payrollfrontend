"use client";

import { useEffect, useState, useCallback, type CSSProperties } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import { API_BASE_URL } from "@/lib/api/client";

interface ColumnMeta { field: string; label: string; }
interface ReportMeta { key: string; title: string; columns: ColumnMeta[]; filters: string[]; comp_scoped: boolean; }
interface Page { count: number; next: string | null; previous: string | null; results: Record<string, unknown>[]; }

async function apiGet<T>(path: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  const res = await fetch(`${API_BASE_URL}${path}`, { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" });
  let data: T | null = null;
  try { data = await res.json(); } catch { /* ignore */ }
  return { ok: res.ok, status: res.status, data };
}

export default function ReportViewer() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [reports, setReports] = useState<ReportMeta[]>([]);
  const [active, setActive] = useState<ReportMeta | null>(null);
  const [rows, setRows] = useState<Page | null>(null);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMe().then(async (m) => {
      setMe(m); setAuthChecked(true);
      if (m) {
        const res = await apiGet<ReportMeta[]>("/api/reports/");
        if (res.ok && res.data) { setReports(res.data); setActive(res.data[0] ?? null); }
        else if (res.status === 403) setError("auth");
      }
    });
  }, []);

  const loadRows = useCallback(async () => {
    if (!active) return;
    setLoading(true); setError(null);
    const q = new URLSearchParams();
    q.set("page_size", "all");
    if (search) q.set("search", search);
    for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v);
    const res = await apiGet<Page>(`/api/reports/${active.key}/?${q.toString()}`);
    if (res.ok && res.data) setRows(res.data);
    else if (res.status === 403) setError("auth");
    else setError("Failed to load report.");
    setLoading(false);
  }, [active, page, search, filters]);

  useEffect(() => { if (active) loadRows(); }, [active, loadRows]);

  const selectReport = (r: ReportMeta) => { setActive(r); setFilters({}); setSearch(""); setPage(1); setRows(null); };

  const exportUrl = (format: string) => {
    if (!active) return "#";
    const q = new URLSearchParams({ export: format });
    if (search) q.set("search", search);
    for (const [k, v] of Object.entries(filters)) if (v) q.set(k, v);
    return `${API_BASE_URL}/api/reports/${active.key}/?${q.toString()}`;
  };

  if (authChecked && !me) return <section><h2 style={{ marginTop: 0 }}>Reports</h2>
    <div style={authBox}>🔐 <strong>Sign in required.</strong>{" "}<Link href="/login" style={btn}>Go to login</Link></div></section>;
  if (error === "auth") return <section><h2 style={{ marginTop: 0 }}>Reports</h2><p style={{ color: "crimson" }}>Not authorized to view reports (needs the &quot;Reports&quot; permission).</p></section>;

  return (
    <section>
      <h2 style={{ marginTop: 0 }}>Reports</h2>
      <p style={{ color: "#666", fontSize: 13 }}>Data-backed reports from migrated data. Payroll/billing/attendance-calculation reports are gated pending verification (see inventory).</p>
      <div className="lg-form cols3" style={{ marginBottom: 16 }}>
        <div className="lg-row" style={{ gridColumn: "span 3" }}>
          <span className="lg-label" style={{ fontSize: 14, fontWeight: "bold" }}>Select Report:</span>
          <select 
            className="lg-control" 
            style={{ maxWidth: 400 }}
            value={active?.key || ""} 
            onChange={(e) => {
              const r = reports.find(x => x.key === e.target.value);
              if (r) selectReport(r);
            }}
          >
            {reports.map(r => (
              <option key={r.key} value={r.key}>{r.title}</option>
            ))}
          </select>
        </div>
      </div>

      {active && (
        <div className="lg-panel">
          <div className="lg-panel-head">{active.title}</div>
          <div className="lg-panel-body">
          <div className="lg-form cols4" style={{ marginBottom: 16 }}>
            <div className="lg-row">
              <span className="lg-label">Search</span>
              <input className="lg-control" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search…" />
            </div>
            {active.filters.map((f) => (
              <div className="lg-row" key={f}>
                <span className="lg-label">{f}</span>
                <input className="lg-control" value={filters[f] ?? ""} placeholder={f} 
                  onChange={(e) => { setFilters({ ...filters, [f]: e.target.value }); setPage(1); }} />
              </div>
            ))}
          </div>
          
          <div className="dt-top">
            <div className="dt-btns">
              <a href={exportUrl("csv")} className="lg-btn lg-btn-primary" target="_blank" rel="noopener noreferrer">⭳ CSV</a>
              <a href={exportUrl("excel")} className="lg-btn lg-btn-green" target="_blank" rel="noopener noreferrer">⭳ Excel</a>
              <a href={exportUrl("pdf")} className="lg-btn lg-btn-red" target="_blank" rel="noopener noreferrer">⭳ PDF</a>
            </div>
          </div>

          {loading && <p>Loading…</p>}
          {error && error !== "auth" && <p style={{ color: "crimson" }}>{error}</p>}
          {!loading && rows && rows.results.length === 0 && <p style={{ color: "#666" }}>No records.</p>}
          {!loading && rows && rows.results.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <div className="dt-scroll"><table className="dt-grid">
                <thead><tr>{active.columns.map((c) => <th key={c.field}>{c.label}</th>)}</tr></thead>
                <tbody>
                  {rows.results.map((row, i) => (
                    <tr key={i}>
                      {active.columns.map((c) => <td key={c.field}>{row[c.field] == null || row[c.field] === "" ? "—" : String(row[c.field])}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table></div>
            </div>
          )}
          {rows && (
            <div className="dt-foot"><b>Total: {rows.count} records</b></div>
          )}
          </div>
        </div>
      )}
    </section>
  );
}

const btn: CSSProperties = { padding: "6px 14px", border: "1px solid #00b712", background: "#00b712", color: "#fff", borderRadius: 6, cursor: "pointer", textDecoration: "none", display: "inline-block" };
const tab: CSSProperties = { padding: "6px 14px", border: "1px solid #ddd", borderRadius: 6, background: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13 };
const tabActive: CSSProperties = { background: "var(--brand-accent)", color: "#fff", borderColor: "var(--brand-accent)" };
const authBox: CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", padding: 16, borderRadius: 8, fontSize: 14, maxWidth: 560 };
