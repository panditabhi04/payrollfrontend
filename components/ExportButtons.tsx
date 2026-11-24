"use client";

// Shared CSV + Print/PDF buttons for every grid screen (legacy had Crystal
// Report export/print on most pages). CSV is generated from the rows already
// loaded on screen; Print opens the browser print dialog (Save as PDF).
// Server-side full-list CSV/Excel/PDF lives on the API (?export=csv|excel|pdf).

export interface ExportColumn { key: string; label: string; }

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return "";
  return String(v);
}

export function downloadCSV(filename: string, columns: ExportColumn[], rows: object[]) {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const val = (r: object, key: string) => cell((r as Record<string, unknown>)[key]);
  const lines = [
    columns.map((c) => esc(c.label)).join(","),
    ...rows.map((r) => columns.map((c) => esc(val(r, c.key))).join(",")),
  ];
  const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ExportButtons({ filename, columns, rows }: {
  filename: string;
  columns: ExportColumn[];
  rows: object[];
}) {
  return (
    <>
      <button
        type="button"
        className="lg-btn lg-btn-green no-print"
        disabled={rows.length === 0}
        onClick={() => downloadCSV(filename, columns, rows)}
        title="Download visible rows as CSV (Excel opens it)"
      >
        ⭳ CSV
      </button>
      <button
        type="button"
        className="lg-btn lg-btn-red no-print"
        onClick={() => window.print()}
        title="Print / Save as PDF"
      >
        🖨 Print / PDF
      </button>
    </>
  );
}
