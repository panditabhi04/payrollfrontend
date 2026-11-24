"use client";

// Shared legacy-form primitives (same look as the .lg-* / .em-* classes) so each
// exact-replica master screen renders identical field rows without duplicating markup.
import type { ReactNode } from "react";

export interface Opt { v: string; t: string }

export function Field({ label, req, children }: { label: string; req?: boolean; children: ReactNode }) {
  return (
    <div className="lg-row">
      <label className="lg-label">{label}{req && <span className="lg-req"> *</span>}</label>
      {children}
    </div>
  );
}

export function Sel({ label, req, value, onChange, opts, disabled, id }: {
  label: string; req?: boolean; value: string; onChange: (v: string) => void; opts: Opt[]; disabled?: boolean; id?: string;
}) {
  return (
    <Field label={label} req={req}>
      <select id={id} className="lg-control" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {opts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
      </select>
    </Field>
  );
}

export function Txt({ label, req, value, onChange, maxLength, filter, type, readOnly, id }: {
  label: string; req?: boolean; value: string; onChange: (v: string) => void; maxLength?: number;
  filter?: (v: string) => string; type?: string; readOnly?: boolean; id?: string;
}) {
  return (
    <Field label={label} req={req}>
      <input id={id} className="lg-control" type={type} maxLength={maxLength} value={value} readOnly={readOnly}
        onChange={(e) => onChange(filter ? filter(e.target.value) : e.target.value)} />
    </Field>
  );
}

export const onlyNum = (v: string) => v.replace(/[^0-9]/g, "");
export const onlyDec = (v: string) => v.replace(/[^0-9.]/g, "");
export const onlyAlpha = (v: string) => v.replace(/[^A-Za-z\s]/g, "");
export const alnumSlash = (v: string) => v.replace(/[^A-Za-z0-9/\s]/g, "");
export const alnumSpace = (v: string) => v.replace(/[^A-Za-z0-9\s]/g, "");
// AllowAlphabet_address: letters, digits and address punctuation
export const alphaAddr = (v: string) => v.replace(/[^A-Za-z0-9\s.,\-/#()&']/g, "");
// Legacy-exact keystroke masks (clientmaster.aspx / CompanyMaster.aspx):
// AllowAlphabet = letters + . / space / - / , / @ / ;  (blocks ! * # $ % etc.)
export const alphaPunct = (v: string) => v.replace(/[^A-Za-z./\- ,/@;]/g, "");
// AllowAlphabet_Number = above + digits (blocks ! * # $ % etc.)
export const alnumPunct = (v: string) => v.replace(/[^A-Za-z0-9./\- ,/@;]/g, "");
// email() mask: letters, digits, space, Tab, @, comma, semicolon, dot
export const emailKeys = (v: string) => v.replace(/[^A-Za-z0-9\s@,;.]/g, "");

export function levelForMenu(perms: { menu: string; permission: string; needs_review?: boolean }[] | undefined, menu: string, isStaff: boolean): number {
  if (isStaff) return 4;
  const map: Record<string, number> = { R: 1, U: 2, C: 3, D: 4 };
  return (perms ?? []).filter((p) => p.menu === menu && !p.needs_review)
    .reduce((mx, p) => Math.max(mx, map[p.permission] ?? 0), 0);
}

export function errMsg(d: unknown): string {
  if (!d || typeof d !== "object") return "";
  const o = d as Record<string, unknown>;
  if (typeof o.detail === "string") return o.detail;
  return Object.entries(o).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(" · ");
}
