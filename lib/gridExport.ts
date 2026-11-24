// Client-side equivalents of the legacy DataTables export buttons (copy / excel / pdf) for a rendered grid.
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function copyGrid(columns: string[], rows: (string | number | null)[][]): Promise<boolean> {
  const text = [columns.join("\t"), ...rows.map((r) => r.map((v) => String(v ?? "")).join("\t"))].join("\n");
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

export function excelGrid(name: string, columns: string[], rows: (string | number | null)[][]) {
  const html =
    `<html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>${columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>` +
    rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("") +
    `</tbody></table></body></html>`;
  const blob = new Blob([html], { type: "application/vnd.ms-excel" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.xls`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function pdfGrid(title: string, columns: string[], rows: (string | number | null)[][]) {
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(
    `<html><head><title>${esc(title)}</title><style>body{font-family:Arial;font-size:11px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #444;padding:3px}th{background:#eee}</style></head><body><h3>${esc(title)}</h3><table><thead><tr>${columns.map((c) => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody>` +
      rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v)}</td>`).join("")}</tr>`).join("") +
      `</tbody></table></body></html>`,
  );
  w.document.close(); w.focus(); w.print();
}
