"use client";

// Reusable grid that mimics the legacy jQuery DataTables used across Celtpayroll:
// "Show N entries", global Search, CSV / Print / Copy / Column-visibility buttons,
// sortable headers, pagination, striped rows, selected-row highlight.

import { useEffect, useMemo, useState, type ReactNode } from "react";

export interface DTColumn<T> {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  value?: (row: T) => string; // text used for search/sort/export (defaults to String(row[key]))
}

interface Props<T> {
  columns: DTColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  onRowClick?: (row: T) => void;
  selectedKey?: string | number | null;
}

export default function DataTable<T>({ columns, rows, rowKey, onRowClick, selectedKey }: Props<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [colMenu, setColMenu] = useState(false);

  const cellText = (col: DTColumn<T>, row: T): string =>
    col.value ? col.value(row) : String((row as Record<string, unknown>)[col.key] ?? "");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let data = rows;
    if (q) {
      data = rows.filter((r) => columns.some((c) => cellText(c, r).toLowerCase().includes(q)));
    }
    if (sortKey) {
      const col = columns.find((c) => c.key === sortKey);
      if (col) {
        data = [...data].sort((a, b) => {
          const av = cellText(col, a), bv = cellText(col, b);
          const an = parseFloat(av), bn = parseFloat(bv);
          const cmp = (!isNaN(an) && !isNaN(bn)) ? an - bn : av.localeCompare(bv);
          return sortDir === "asc" ? cmp : -cmp;
        });
      }
    }
    return data;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, search, sortKey, sortDir, columns]);

  const total = filtered.length;
  // Progressive painting: first 400 rows immediately, then grow each animation frame until all are shown.
  const [renderLimit, setRenderLimit] = useState(400);
  useEffect(() => { setRenderLimit(400); }, [filtered]);
  useEffect(() => {
    if (renderLimit >= filtered.length) return;
    const id = requestAnimationFrame(() => setRenderLimit((n) => n + 600));
    return () => cancelAnimationFrame(id);
  }, [renderLimit, filtered]);
  const pageRows = filtered.length > renderLimit ? filtered.slice(0, renderLimit) : filtered;
  const visibleCols = columns.filter((c) => !hidden.has(c.key));

  const toggleSort = (key: string) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  const exportCsv = () => {
    const head = visibleCols.map((c) => `"${c.label}"`).join(",");
    const body = filtered.map((r) => visibleCols.map((c) => `"${cellText(c, r).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[head, ...body].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "export.csv"; a.click();
    URL.revokeObjectURL(a.href);
  };

  const copyTable = async () => {
    const head = visibleCols.map((c) => c.label).join("\t");
    const body = filtered.map((r) => visibleCols.map((c) => cellText(c, r)).join("\t"));
    try { await navigator.clipboard.writeText([head, ...body].join("\n")); alert("Copied to clipboard"); }
    catch { alert("Copy failed"); }
  };

  const printTable = () => {
    const head = `<tr>${visibleCols.map((c) => `<th>${c.label}</th>`).join("")}</tr>`;
    const body = filtered.map((r) => `<tr>${visibleCols.map((c) => `<td>${cellText(c, r)}</td>`).join("")}</tr>`).join("");
    const w = window.open("", "_blank");
    if (w) {
      w.document.write(`<table border="1" cellpadding="6" style="border-collapse:collapse;font-family:sans-serif;font-size:13px">${head}${body}</table>`);
      w.document.close(); w.print();
    }
  };

  return (
    <div className="dt">
      <div className="dt-top">
        <div className="dt-left">
          <span style={{ fontWeight: 700 }}>Total: {rows.length}{search.trim() ? ` (Showing ${total} of ${rows.length})` : ""}</span>
        </div>
        <div className="dt-search">
          <span>Search:</span>
          <input value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="dt-btns">
        <button className="dt-exp" onClick={exportCsv}>CSV</button>
        <button className="dt-exp" onClick={exportCsv} style={{background: "#218838"}}>Excel</button>
        <button className="dt-exp" onClick={printTable} style={{background: "#dc3545", borderColor: "#dc3545"}}>Print</button>
        <button className="dt-exp" onClick={copyTable} style={{background: "#5a5a5a", borderColor: "#5a5a5a"}}>Copy</button>
        <div style={{ position: "relative", display: "inline-block" }}>
          <button className="dt-exp" onClick={() => setColMenu(!colMenu)}>Column visibility</button>
          {colMenu && (
            <div className="dt-colmenu">
              {columns.map((c) => (
                <label key={c.key} style={{ display: "block", padding: "4px 8px", fontSize: 13, whiteSpace: "nowrap" }}>
                  <input type="checkbox" checked={!hidden.has(c.key)}
                    onChange={() => {
                      const n = new Set(hidden);
                      n.has(c.key) ? n.delete(c.key) : n.add(c.key);
                      setHidden(n);
                    }} /> {c.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="dt-scroll">
      <table className="dt-grid">
        <thead>
          <tr>
            {visibleCols.map((c) => (
              <th key={c.key} onClick={() => toggleSort(c.key)} style={{ cursor: "pointer" }}>
                {c.label}
                <span className="dt-sort">{sortKey === c.key ? (sortDir === "asc" ? " ▲" : " ▼") : " ⇅"}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pageRows.length === 0 && <tr><td colSpan={visibleCols.length} style={{ textAlign: "center", color: "#888" }}>No matching records found</td></tr>}
          {/* all filtered rows; large sets are painted in chunks (see renderLimit) */}
          {pageRows.map((r) => {
            const k = rowKey(r);
            return (
              <tr key={k} onClick={() => onRowClick?.(r)}
                className={selectedKey === k ? "dt-selected" : ""} style={{ cursor: onRowClick ? "pointer" : "default" }}>
                {visibleCols.map((c) => <td key={c.key}>{c.render ? c.render(r) : cellText(c, r)}</td>)}
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <div className="dt-foot">
        <span>
          <b>Total: {rows.length} records</b>
          {search.trim() ? ` (Showing ${total} of ${rows.length})` : ""}
        </span>
      </div>
    </div>
  );
}
