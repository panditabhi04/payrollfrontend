"use client";

import { useEffect, useState, useCallback, type CSSProperties } from "react";
import {
  listMaster,
  getMaster,
  type MasterResource,
  type Paginated,
} from "@/lib/api/masters";

type Row = Record<string, unknown>;

export interface ColumnDef {
  key: string;
  label: string;
}

interface Props {
  resource: MasterResource;
  title: string;
  columns: ColumnDef[]; // columns shown in the table
  searchPlaceholder?: string;
  expectedCount?: number;
}

const PAGE_SIZE = 25;

export default function MasterExplorer({
  resource,
  title,
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
  const [detail, setDetail] = useState<Row | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listMaster<Row>(resource, { page, pageSize: PAGE_SIZE, search: term });
      setData(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
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
      const row = await getMaster<Row>(resource, id as number);
      setDetail(row);
    } catch {
      setDetail({ error: "Could not load detail" });
    } finally {
      setDetailLoading(false);
    }
  };


  return (
    <section>
      <header style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        {data && (
          <span style={{ color: "#666", fontSize: 14 }}>
            {data.count.toLocaleString()} records
            {expectedCount !== undefined && (
              <> · parity {data.count === expectedCount ? "✓" : "✗"} (expected {expectedCount.toLocaleString()})</>
            )}
          </span>
        )}
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setTerm(search);
        }}
        style={{ margin: "12px 0", display: "flex", gap: 8 }}
      >
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder ?? "Search…"}
          style={{ padding: "6px 10px", border: "1px solid #ccc", borderRadius: 6, minWidth: 260 }}
        />
        <button type="submit" style={btn}>Search</button>
        {term && (
          <button type="button" style={btnGhost} onClick={() => { setSearch(""); setTerm(""); setPage(1); }}>
            Clear
          </button>
        )}
      </form>

      {loading && <p>Loading…</p>}
      {error && <p style={{ color: "crimson" }}>Error: {error} <button style={btnGhost} onClick={load}>Retry</button></p>}
      {!loading && !error && data && data.results.length === 0 && <p style={{ color: "#666" }}>No records found.</p>}

      {!loading && !error && data && data.results.length > 0 && (
        <div style={{ overflow: "auto", maxHeight: "60vh" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key} style={th}>{c.label}</th>
                ))}
                <th style={th}></th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((row, i) => (
                <tr key={(row.id as number) ?? i} style={{ borderTop: "1px solid #eee" }}>
                  {columns.map((c) => (
                    <td key={c.key} style={td}>{fmt(row[c.key])}</td>
                  ))}
                  <td style={td}>
                    <button style={btnGhost} onClick={() => openDetail(row.id)}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <div style={{ marginTop: 12, fontSize: 14, fontWeight: "bold" }}>Total: {data.count} records</div>
      )}

      {(detail || detailLoading) && (
        <div style={overlay} onClick={() => { setDetail(null); }}>
          <div style={drawer} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0 }}>Detail (read-only)</h3>
              <button style={btnGhost} onClick={() => setDetail(null)}>Close</button>
            </div>
            {detailLoading && <p>Loading…</p>}
            {detail && (
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14, marginTop: 8 }}>
                <tbody>
                  {Object.entries(detail).map(([k, v]) => (
                    <tr key={k} style={{ borderTop: "1px solid #eee" }}>
                      <td style={{ ...td, fontWeight: 600, whiteSpace: "nowrap" }}>{k}</td>
                      <td style={td}>{fmt(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

const th: CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #ddd", background: "#fafafa", position: "sticky", top: 0 };
const td: CSSProperties = { padding: "8px 10px", verticalAlign: "top" };
const btn: CSSProperties = { padding: "6px 14px", border: "1px solid #00b712", background: "#00b712", color: "#fff", borderRadius: 6, cursor: "pointer" };
const btnGhost: CSSProperties = { padding: "5px 12px", border: "1px solid #ccc", background: "#fff", borderRadius: 6, cursor: "pointer" };
const overlay: CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", justifyContent: "flex-end", zIndex: 50 };
const drawer: CSSProperties = { width: "min(560px, 92vw)", height: "100%", background: "#fff", padding: 20, overflowY: "auto", boxShadow: "-4px 0 16px rgba(0,0,0,0.15)" };
