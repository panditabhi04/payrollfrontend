"use client";

import React, { useState, useMemo, useCallback, memo } from "react";

type Row = Record<string, any>;
type RenderCellFn = (r: Row, c: string, i: number) => React.ReactNode;

interface GridProps {
  id: string;
  cols: string[];
  rows: Row[];
  renderCell?: RenderCellFn;
  checkKey?: boolean;
  selected?: Record<string, boolean>;
  onToggle?: (key: string, v: boolean) => void;
  onToggleAll?: (v: boolean) => void;
  hiddenIdCol?: boolean;
}

function dl(name: string, type: string, text: string) {
  const blob = new Blob(["\ufeff" + text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const Grid = memo(function Grid({
  id,
  cols,
  rows,
  renderCell,
  checkKey,
  selected = {},
  onToggle,
  onToggleAll,
  hiddenIdCol,
}: GridProps) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [showColvis, setShowColvis] = useState(false);

  const vis = useMemo(() => cols.filter((c) => !hidden[c]), [cols, hidden]);
  const keyOf = useCallback((r: Row, i: number) => {
    const v = r.Id ?? r.id ?? r.ID ?? i;
    return String(v);
  }, []);

  const allChecked = useMemo(() => {
    if (!checkKey || rows.length === 0) return false;
    return rows.every((r, i) => selected[keyOf(r, i)]);
  }, [checkKey, rows, selected, keyOf]);

  const cellText = useCallback((r: Row, c: string) => {
    if (c === "Sr No." || c === "Sr. No." || c === "No.") return "";
    return r[c] ?? r[c.toLowerCase()] ?? "";
  }, []);

  const csv = useCallback(() => {
    const q = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const header = vis.map(q).join(",");
    const body = rows.map((r) => vis.map((c) => q(cellText(r, c))).join(",")).join("\r\n");
    dl(`${id}.csv`, "text/csv", header + "\r\n" + body);
  }, [id, vis, rows, cellText]);

  const copy = useCallback(() => {
    const t = [vis.join("\t"), ...rows.map((r) => vis.map((c) => cellText(r, c)).join("\t"))].join("\n");
    navigator.clipboard?.writeText(t).catch(() => undefined);
  }, [vis, rows, cellText]);

  const print = useCallback(() => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<html><head><title>${id}</title><style>table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px;font-size:11px}</style></head><body><table><tr>${vis.map((c) => `<th>${c}</th>`).join("")}</tr>${rows.map((r) => `<tr>${vis.map((c) => `<td>${cellText(r, c)}</td>`).join("")}</tr>`).join("")}</table><script>window.print()</script></body></html>`);
    w.document.close();
  }, [id, vis, rows, cellText]);

  return (
    <div className="grid-view">
      <div className="dt-btns" style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", position: "relative" }}>
        <button type="button" className="dt-exp" onClick={csv}>csv</button>
        <button type="button" className="dt-exp" onClick={print}>print</button>
        <button type="button" className="dt-exp" onClick={copy}>copyHtml5</button>
        <button type="button" className="dt-exp" onClick={() => setShowColvis((s) => !s)}>colvis</button>
        {showColvis && (
          <div className="dt-colmenu" style={{ background: "#fff", border: "1px solid #ccc", padding: 8, position: "absolute", zIndex: 5 }}>
            {cols.map((c) => (
              <label key={c} style={{ display: "block", fontSize: 12 }}>
                <input type="checkbox" checked={!hidden[c]} onChange={() => setHidden((h) => ({ ...h, [c]: !h[c] }))} /> {c}
              </label>
            ))}
          </div>
        )}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table id={id} className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
          <thead>
            <tr>
              {checkKey && (
                <th>
                  <input type="checkbox" checked={!!allChecked} onChange={(e) => onToggleAll?.(e.target.checked)} /> SELECT
                </th>
              )}
              {vis.map((c, ci) => (
                <th key={c} style={hiddenIdCol && ci === 0 ? { display: "none" } : undefined}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={keyOf(r, i)}>
                {checkKey && (
                  <td style={{ textAlign: "center" }}>
                    <input type="checkbox" checked={!!selected[keyOf(r, i)]} onChange={(e) => onToggle?.(keyOf(r, i), e.target.checked)} />
                  </td>
                )}
                {vis.map((c, ci) => (
                  <td key={c} style={hiddenIdCol && ci === 0 ? { display: "none" } : undefined}>
                    {renderCell ? renderCell(r, c, i) : (c === "Sr No." || c === "Sr. No." || c === "No." ? i + 1 : cellText(r, c))}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={(vis.length || 1) + (checkKey ? 1 : 0)} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export default Grid;