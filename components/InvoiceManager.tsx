"use client";

import { useEffect, useState, useCallback, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import { listItems, createItem, updateItem, deleteItem, ApiError, type Paginated } from "@/lib/api/crud";

const BASE = "/api/transactions/invoices";
const MENU = "Transaction";

interface Line { particular: string; quantity: string; rate: string; discount_amt: string; vat: string; hsn_number: string; emp_code: string; amount?: string; }
interface Invoice {
  id: number; comp_code: string; doc_no: string; cust_name: string; cust_code: string;
  customer_gst_no: string; doc_date: string | null; category: string; discount: string;
  tax_amt: string; extra_chrgs_amt: string; gross_amount: string; taxable_amt: string;
  final_price: string; lines: (Line & { id: number })[];
}

const emptyLine = (): Line => ({ particular: "", quantity: "1", rate: "0", discount_amt: "0", vat: "0", hsn_number: "", emp_code: "" });
const EMPTY_H = { cust_name: "", cust_code: "", customer_gst_no: "", doc_date: "", category: "", discount: "0", tax_amt: "0", extra_chrgs_amt: "0" };

function levelFor(me: Me | null): number {
  if (!me) return 0;
  if (me.is_staff) return 4;
  const map: Record<string, number> = { R: 1, U: 2, C: 3, D: 4 };
  return me.permissions.filter((p) => p.menu === MENU && !p.needs_review).reduce((mx, p) => Math.max(mx, map[p.permission] ?? 0), 0);
}

function num(v: string) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }

export default function InvoiceManager() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [data, setData] = useState<Paginated<Invoice> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [header, setHeader] = useState<Record<string, string>>({ ...EMPTY_H });
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const level = levelFor(me);
  const canCreate = level >= 3, canUpdate = level >= 2, canDelete = !!me?.is_staff || level >= 4;

  useEffect(() => { getMe().then((m) => { setMe(m); setAuthChecked(true); }); }, []);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(await listItems<Invoice>(BASE, { pageSize: 50 })); }
    catch (e) { if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setError("auth"); else setError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (authChecked && me) load(); else if (authChecked && !me) setLoading(false); }, [authChecked, me, load]);

  const startAdd = () => { setEditing(null); setHeader({ ...EMPTY_H }); setLines([emptyLine()]); setFormErr(null); setShowForm(true); };
  const startEdit = (inv: Invoice) => {
    setEditing(inv);
    setHeader({ cust_name: inv.cust_name, cust_code: inv.cust_code, customer_gst_no: inv.customer_gst_no,
      doc_date: inv.doc_date ?? "", category: inv.category, discount: inv.discount, tax_amt: inv.tax_amt, extra_chrgs_amt: inv.extra_chrgs_amt });
    setLines(inv.lines.length ? inv.lines.map(({ id, amount, ...l }) => l) : [emptyLine()]);
    setFormErr(null); setShowForm(true);
  };

  const gross = lines.reduce((s, l) => s + (num(l.quantity) * num(l.rate) - num(l.discount_amt)), 0);
  const taxable = gross - num(header.discount);
  const final = taxable + num(header.tax_amt) + num(header.extra_chrgs_amt);

  const submit = async (e: FormEvent) => {
    e.preventDefault(); setSaving(true); setFormErr(null); setNotice(null);
    const body = { ...header, doc_date: header.doc_date || null, lines: lines.filter((l) => l.particular.trim()) };
    try {
      const res = editing ? await updateItem<Invoice>(BASE, editing.id, body) : await createItem<Invoice>(BASE, body);
      if (res.ok) { setNotice(editing ? "Invoice updated." : "Invoice created."); setShowForm(false); load(); }
      else if (res.status === 403) setFormErr("You do not have permission for this action.");
      else { const d = (res.data ?? {}) as unknown as Record<string, unknown>; setFormErr(typeof d.detail === "string" ? d.detail : Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(" · ") || "Save failed."); }
    } finally { setSaving(false); }
  };
  const remove = async (inv: Invoice) => {
    if (!confirm(`Delete invoice ${inv.doc_no}?`)) return;
    const res = await deleteItem(BASE, inv.id);
    if (res.ok) { setNotice("Invoice deleted."); load(); }
    else if (res.status === 403) alert("Only administrators can delete."); else alert("Delete failed.");
  };
  const setLine = (i: number, k: keyof Line, v: string) => setLines(lines.map((x, j) => j === i ? { ...x, [k]: v } : x));

  if (authChecked && !me) return <section><h2 style={{ marginTop: 0 }}>Invoices</h2><div style={authBox}>🔐 <strong>Sign in required.</strong>{" "}<Link href="/login" style={btn}>Go to login</Link></div></section>;

  return (
    <section>
      <header style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Invoices</h2>
        {data && <span style={{ color: "#666", fontSize: 14 }}>{data.count} invoices</span>}
      </header>
      <p style={{ color: "#666", fontSize: 13 }}>Sales/billing invoice documents. Totals are computed from line items (qty × rate − discount); tax and extra charges are entered.</p>
      {notice && <p style={{ color: "#166534", background: "#dcfce7", padding: "6px 10px", borderRadius: 6 }}>{notice}</p>}
      {canCreate && !showForm && <button style={btn} onClick={startAdd}>+ New Invoice</button>}

      {showForm && (
        <form onSubmit={submit} style={card}>
          <h3 style={{ marginTop: 0 }}>{editing ? `Edit ${editing.doc_no}` : "New invoice"}</h3>
          <div style={grid}>
            <label style={lbl}>Customer name*<input required value={header.cust_name} onChange={(e) => setHeader({ ...header, cust_name: e.target.value })} style={input} /></label>
            <label style={lbl}>Customer code<input value={header.cust_code} onChange={(e) => setHeader({ ...header, cust_code: e.target.value })} style={input} /></label>
            <label style={lbl}>Customer GST<input value={header.customer_gst_no} onChange={(e) => setHeader({ ...header, customer_gst_no: e.target.value })} style={input} /></label>
            <label style={lbl}>Doc date<input type="date" value={header.doc_date} onChange={(e) => setHeader({ ...header, doc_date: e.target.value })} style={input} /></label>
            <label style={lbl}>Category<input value={header.category} onChange={(e) => setHeader({ ...header, category: e.target.value })} style={input} /></label>
          </div>

          <h4>Line items</h4>
          {lines.map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6, flexWrap: "wrap", alignItems: "center" }}>
              <input placeholder="Particular" value={l.particular} onChange={(e) => setLine(i, "particular", e.target.value)} style={{ ...input, minWidth: 180 }} />
              <input placeholder="Qty" value={l.quantity} onChange={(e) => setLine(i, "quantity", e.target.value)} style={inputSm} />
              <input placeholder="Rate" value={l.rate} onChange={(e) => setLine(i, "rate", e.target.value)} style={inputSm} />
              <input placeholder="Disc" value={l.discount_amt} onChange={(e) => setLine(i, "discount_amt", e.target.value)} style={inputSm} />
              <input placeholder="VAT%" value={l.vat} onChange={(e) => setLine(i, "vat", e.target.value)} style={inputSm} />
              <input placeholder="HSN" value={l.hsn_number} onChange={(e) => setLine(i, "hsn_number", e.target.value)} style={inputSm} />
              <span style={{ fontSize: 13, minWidth: 70 }}>= {(num(l.quantity) * num(l.rate) - num(l.discount_amt)).toFixed(2)}</span>
              <button type="button" style={btnGhost} onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button type="button" style={btnGhost} onClick={() => setLines([...lines, emptyLine()])}>+ Add line</button>

          <div style={{ ...grid, marginTop: 16 }}>
            <label style={lbl}>Discount<input value={header.discount} onChange={(e) => setHeader({ ...header, discount: e.target.value })} style={input} /></label>
            <label style={lbl}>Tax amount<input value={header.tax_amt} onChange={(e) => setHeader({ ...header, tax_amt: e.target.value })} style={input} /></label>
            <label style={lbl}>Extra charges<input value={header.extra_chrgs_amt} onChange={(e) => setHeader({ ...header, extra_chrgs_amt: e.target.value })} style={input} /></label>
          </div>
          <p style={{ fontSize: 14, fontWeight: 600 }}>Gross {gross.toFixed(2)} · Taxable {taxable.toFixed(2)} · <span style={{ color: "#166534" }}>Final {final.toFixed(2)}</span></p>
          {formErr && <p style={{ color: "crimson" }}>{formErr}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={btn} disabled={saving}>{saving ? "Saving…" : "Save invoice"}</button>
            <button type="button" style={btnGhost} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {loading && <p>Loading…</p>}
      {error === "auth" && <p style={{ color: "crimson" }}>Not authorized.</p>}
      {error && error !== "auth" && <p style={{ color: "crimson" }}>Error: {error}</p>}
      {!loading && !error && data && data.results.length === 0 && <p style={{ color: "#666" }}>No invoices yet.</p>}
      {!loading && !error && data && data.results.map((inv) => (
        <div key={inv.id} style={policyCard}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap" }}>
            <strong>{inv.doc_no} · {inv.cust_name}</strong>
            <span>
              Final {Number(inv.final_price).toFixed(2)}{"  "}
              {canUpdate && <button style={btnGhost} onClick={() => startEdit(inv)}>Edit</button>}{" "}
              {canDelete && <button style={btnDanger} onClick={() => remove(inv)}>Delete</button>}
            </span>
          </div>
          <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
            {inv.doc_date ?? "—"} · {inv.lines.length} line(s) · gross {Number(inv.gross_amount).toFixed(2)} · taxable {Number(inv.taxable_amt).toFixed(2)}
          </div>
        </div>
      ))}
    </section>
  );
}

const input: CSSProperties = { padding: "6px 10px", border: "1px solid #ccc", borderRadius: 6, minWidth: 140 };
const inputSm: CSSProperties = { padding: "6px 8px", border: "1px solid #ccc", borderRadius: 6, width: 70 };
const btn: CSSProperties = { padding: "6px 14px", border: "1px solid #00b712", background: "#00b712", color: "#fff", borderRadius: 6, cursor: "pointer", textDecoration: "none", display: "inline-block" };
const btnGhost: CSSProperties = { padding: "5px 12px", border: "1px solid #ccc", background: "#fff", borderRadius: 6, cursor: "pointer" };
const btnDanger: CSSProperties = { padding: "5px 12px", border: "1px solid #dc2626", background: "#fff", color: "#dc2626", borderRadius: 6, cursor: "pointer" };
const card: CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, margin: "12px 0", background: "#fafafa" };
const policyCard: CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, margin: "8px 0", background: "#fff" };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 12 };
const lbl: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#374151" };
const authBox: CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", padding: 16, borderRadius: 8, fontSize: 14, maxWidth: 560 };
