"use client";

import { memo } from "react";

export const Msg = memo(function Msg({ text, ok }: { text: string; ok: boolean }) {
  if (!text) return null;
  return (
    <div style={{ margin: "0 0 10px", padding: "6px 12px", borderRadius: 4, fontSize: 12,
      color: ok ? "#2e7d32" : "#c62828", background: ok ? "#e8f5e9" : "#ffebee",
      border: `1px solid ${ok ? "#a5d6a7" : "#ef9a9a"}` }}>{text}</div>
  );
});

export const Lab = memo(function Lab({ children, req }: { children: React.ReactNode; req?: boolean }) {
  return <b>{children}{req && <span className="text-red"> *</span>}</b>;
});

export const Sel = memo(function Sel({ value, onChange, opts, style }: { value: string; onChange: (v: string) => void; opts: { v: string; t: string }[]; style?: React.CSSProperties }) {
  return (
    <select className="form-control" value={value} onChange={(e) => onChange(e.target.value)} style={style}>
      {opts.map((o) => (<option key={o.v + o.t} value={o.v}>{o.t}</option>))}
    </select>
  );
});

export const Txt = memo(function Txt({ value, onChange, ph, style, readOnly, className = "form-control" }: { value: string; onChange?: (v: string) => void; ph?: string; style?: React.CSSProperties; readOnly?: boolean; className?: string }) {
  return (
    <input type="text" className={className} value={value} placeholder={ph}
      readOnly={readOnly} onChange={(e) => onChange?.(e.target.value)} style={style} />
  );
});

const pad2 = (n: number) => String(n).padStart(2, "0");

/* Legacy '.date-picker' (month-only, dateFormat 'mm/yy' = MM/YYYY, maxDate 0 -> no future month).
   The value handed to the parent stays the legacy text the backend expects. */
export const MonthPick = memo(function MonthPick({ value, onChange, style }: { value: string; onChange: (v: string) => void; style?: React.CSSProperties }) {
  const m = /^(\d{1,2})\/(\d{4})$/.exec((value || "").trim());
  const iso = m ? `${m[2]}-${pad2(Number(m[1]))}` : "";
  const now = new Date();
  return (
    <input type="month" className="form-control" value={iso} style={style}
      max={`${now.getFullYear()}-${pad2(now.getMonth() + 1)}`}
      onChange={(e) => {
        const v = e.target.value;           // YYYY-MM
        onChange(v ? `${v.slice(5, 7)}/${v.slice(0, 4)}` : "");
      }} />
  );
});

/* Legacy '.date-picker1' / '.date-pickers' (dateFormat 'yy/mm/dd' = YYYY/MM/DD). Accepts stored
   values as YYYY/MM/DD, YYYY-MM-DD or DD/MM/YYYY and always emits YYYY/MM/DD. */
export function toIsoDate(value: string): string {
  const s = (value || "").trim();
  let m = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/.exec(s);
  if (m) return `${m[1]}-${pad2(Number(m[2]))}-${pad2(Number(m[3]))}`;
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/.exec(s);
  if (m) return `${m[3]}-${pad2(Number(m[2]))}-${pad2(Number(m[1]))}`;
  return "";
}

export const DatePick = memo(function DatePick({ value, onChange, style }: { value: string; onChange: (v: string) => void; style?: React.CSSProperties }) {
  return (
    <input type="date" className="form-control" value={toIsoDate(value)} style={style}
      onChange={(e) => onChange(e.target.value ? e.target.value.replace(/-/g, "/") : "")} />
  );
});

export const Btn = memo(function Btn({ children, onClick, danger, style, className = "it-btn" }: { children: React.ReactNode; onClick: () => void; danger?: boolean; style?: React.CSSProperties; className?: string }) {
  return (
    <button type="button" className={danger ? "btn btn-danger" : className} onClick={onClick} style={style}>
      {children}
    </button>
  );
});

export const DropBanner = memo(function DropBanner({ errs }: { errs: (string | undefined)[] }) {
  const list = errs.filter(Boolean) as string[];
  if (list.length === 0) return null;
  return (
    <div style={{ background: "#fff3cd", border: "1px solid #ffc107", color: "#856404", padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 12, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
      <span>{list.join(" ")}</span>
      <button type="button" className="btn btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => window.location.reload()}>Refresh</button>
    </div>
  );
});

type Opt = { v: string; t: string };
type Row = Record<string, any>;

export function val(r: Row, name: string): any {
  if (r[name] !== undefined && r[name] !== null) return r[name];
  const want = name.toLowerCase();
  for (const k of Object.keys(r)) {
    if (k.toLowerCase() === want) return (r as Row)[k];
  }
  return "";
}

export function rowId(r: Row, i: number): string {
  const v = val(r, "Id");
  return String(v !== "" ? v : i);
}