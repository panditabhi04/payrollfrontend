"use client";

import { useEffect, useState, useCallback, type CSSProperties } from "react";
import Link from "next/link";
import {
  listHr,
  getHr,
  ApiError,
  type HrResource,
  type Paginated,
} from "@/lib/api/hr";

type Row = Record<string, unknown>;

export interface ColumnDef {
  key: string;
  label: string;
}

interface Props {
  resource: HrResource;
  title: string;
  /** Primary-key field on each row (employees: emp_code, grades: id, departments: dept_code). */
  idKey: string;
  columns: ColumnDef[];
  searchPlaceholder?: string;
  expectedCount?: number;
}

const PAGE_SIZE = 25;

export default function HrExplorer({
  resource,
  title,
  idKey,
  columns,
  searchPlaceholder,
  expectedCount,
}: Props) {
  const [data, setData] = useState<Paginated<Row> | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [detail, setDetail] = useState<Row | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setAuthRequired(false);
    try {
      const res = await listHr<Row>(resource, { page, pageSize: PAGE_SIZE, search: term });
      setData(res);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        setAuthRequired(true);
      } else {
        setError(e instanceof Error ? e.message : "Failed to load");
      }
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [resource, page, term]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (id: unknown) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const row = await getHr<Row>(resource, id as string);
      setDetail(row);
    } catch {
      setDetail({ error: "Could not load detail" });
    } finally {
      setDetailLoading(false);
    }
  };


  if (authRequired) {
    return (
      <section>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <div style={authBox}>
          🔐 <strong>Sign in required.</strong> HR data contains personal
          information, so these endpoints require an authenticated, active account.
          <div style={{ marginTop: 10 }}>
            <Link href="/login" style={btn}>Go to login</Link>{" "}
            <button type="button" style={btnGhost} onClick={load}>Retry</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px", backgroundColor: "#fff" }}>
        
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "8.33%" }}></div>
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
            {title}
          </div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <a href="#" onClick={(e) => { e.preventDefault(); }} style={{ color: "#fff", fontSize: "10px" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </a>
          </div>
        </div>
        
        <div className="panel-body" style={{ padding: "15px", background: "beige", minHeight: "500px" }}>
          {data && (
            <div style={{ marginBottom: "15px", color: "#333", fontSize: "12px", fontWeight: "bold" }}>
              {data.count.toLocaleString()} records found
              {expectedCount !== undefined && (
                <> (Parity: {data.count === expectedCount ? "✓ Match" : "✗ Mismatch"}, Expected: {expectedCount.toLocaleString()})</>
              )}
            </div>
          )}

      <div style={{ background: "#fff", padding: "15px", border: "1px solid #ccc", borderRadius: "4px", marginBottom: "20px" }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setTerm(search);
          }}
          className="row"
          style={{ display: "flex", gap: "15px", alignItems: "flex-end" }}
        >
          <div style={{ flex: "1 1 200px" }}>
            <label style={{ fontWeight: "bold", fontSize: "13px" }}>Search: <span style={{ color: "red" }}>*</span></label>
            <input
              className="form-control"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder ?? "Search…"}
              style={{ padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px", width: "100%", height: "34px" }}
            />
          </div>
          <div>
            <button type="submit" className="btn btn-primary" style={{ background: "#337ab7", border: "1px solid #2e6da4", color: "#fff", padding: "6px 20px", borderRadius: "4px", height: "34px" }}>Search</button>
            {term && (
              <button type="button" className="btn btn-default" style={{ marginLeft: "10px", background: "#fff", border: "1px solid #ccc", color: "#333", padding: "6px 20px", borderRadius: "4px", height: "34px" }} onClick={() => { setSearch(""); setTerm(""); setPage(1); }}>
                Clear
              </button>
            )}
          </div>
        </form>
      </div>

      {loading && <div style={{ textAlign: "center", padding: "20px", fontWeight: "bold", color: "#00547E" }}>Loading…</div>}
      {error && <div style={{ color: "crimson", padding: "15px", background: "#f2dede", border: "1px solid #ebccd1", borderRadius: "4px", marginBottom: "15px" }}>Error: {error} <button className="btn btn-xs btn-danger" onClick={load}>Retry</button></div>}
      {!loading && !error && data && data.results.length === 0 && <p style={{ color: "#666" }}>No records found.</p>}

      {!loading && !error && data && data.results.length > 0 && (
        <div style={{ overflow: "auto", maxHeight: "60vh" }}>
          <table className="table table-striped table-bordered table-hover" style={{ borderCollapse: "collapse", width: "100%", fontSize: "12px", background: "#fff", border: "1px solid #ddd" }}>
            <thead style={{ background: "#224173", color: "white" }}>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} style={{ padding: "8px", textTransform: "uppercase", fontSize: "11px", border: "1px solid #ddd" }}>{c.label}</th>
                ))}
                <th style={{ padding: "8px", textTransform: "uppercase", fontSize: "11px", border: "1px solid #ddd", width: "80px", textAlign: "center" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((row, i) => (
                <tr key={(row[idKey] as string) ?? i}>
                  {columns.map((c) => (
                    <td key={c.key} style={{ padding: "8px", border: "1px solid #ddd" }}>{fmt(row[c.key])}</td>
                  ))}
                  <td style={{ padding: "8px", border: "1px solid #ddd", textAlign: "center" }}>
                    <button type="button" className="btn btn-xs btn-primary" style={{ background: "#337ab7", border: "1px solid #2e6da4", color: "#fff", borderRadius: "3px", padding: "2px 8px" }} onClick={() => openDetail(row[idKey])}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <div style={{ marginTop: "15px", fontSize: "12px", color: "#333", fontWeight: "bold" }}>Total: {data.count} records</div>
      )}

      {(detail || detailLoading) && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1050 }} onClick={() => setDetail(null)}>
          <div style={{ background: "#fff", borderRadius: "6px", width: "600px", maxWidth: "95%", maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 5px 15px rgba(0,0,0,.5)" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ padding: "15px", borderBottom: "1px solid #e5e5e5", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f5f5f5", borderRadius: "6px 6px 0 0" }}>
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "bold" }}>Record Details</h4>
              <button type="button" onClick={() => setDetail(null)} style={{ background: "transparent", border: "none", fontSize: "20px", cursor: "pointer", opacity: 0.5 }}>&times;</button>
            </div>
            <div style={{ padding: "20px", overflowY: "auto" }}>
              {detailLoading && <p>Loading…</p>}
              {detail && (
                <table className="table table-bordered" style={{ width: "100%", fontSize: "12px", border: "1px solid #ddd", borderCollapse: "collapse" }}>
                  <tbody>
                    {Object.entries(detail).map(([k, v]) => (
                      <tr key={k}>
                        <th style={{ width: "35%", background: "#f9f9f9", padding: "8px", border: "1px solid #ddd" }}>{k}</th>
                        <td style={{ padding: "8px", border: "1px solid #ddd" }}>
                          <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "sans-serif" }}>{fmt(v)}</pre>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ padding: "15px", borderTop: "1px solid #e5e5e5", textAlign: "right" }}>
              <button type="button" className="btn btn-default" style={{ background: "#fff", border: "1px solid #ccc", padding: "6px 12px", borderRadius: "4px" }} onClick={() => setDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
      
        </div>
      </div>
    </div>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

const th: CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #ddd", background: "#fafafa", position: "sticky", top: 0 };
const td: CSSProperties = { padding: "8px 10px", verticalAlign: "top" };
const btn: CSSProperties = { padding: "6px 14px", border: "1px solid #00b712", background: "#00b712", color: "#fff", borderRadius: 6, cursor: "pointer", textDecoration: "none", display: "inline-block" };
const btnGhost: CSSProperties = { padding: "5px 12px", border: "1px solid #ccc", background: "#fff", borderRadius: 6, cursor: "pointer" };
const authBox: CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", padding: 16, borderRadius: 8, fontSize: 14, maxWidth: 560 };
const overlay: CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", justifyContent: "flex-end", zIndex: 50 };
const drawer: CSSProperties = { width: "min(560px, 92vw)", height: "100%", background: "#fff", padding: 20, overflowY: "auto", boxShadow: "-4px 0 16px rgba(0,0,0,0.15)" };
