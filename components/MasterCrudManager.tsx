"use client";

import { useEffect, useState, useCallback, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import {
  listItems, createItem, updateItem, deleteItem, ApiError, type Paginated,
} from "@/lib/api/crud";
import { API_BASE_URL } from "@/lib/api/client";

type Row = Record<string, unknown>;

export interface ColumnDef { key: string; label: string; }
export interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  readOnlyOnEdit?: boolean;   // e.g. natural-key columns that legacy makes immutable
  type?: "text" | "number";
}

interface Props {
  basePath: string;            // e.g. "/api/masters/states"
  menuName: string;            // RBAC menu string (matches legacy getaccess)
  title: string;
  idKey?: string;              // default "id"
  columns: ColumnDef[];
  fields: FieldDef[];
  searchPlaceholder?: string;
  /** Optional scope note shown under the title. */
  note?: string;
  /** Exact legacy success messages (preserve legacy wording/typos). Falls back to generic. */
  messages?: { added?: string; updated?: string; deleted?: string };
}

const PAGE_SIZE = 25;

// Legacy getaccess hierarchy: R=1 view, U=2 update, C=3 create; delete = admin.
function levelFor(me: Me | null, menuName: string): number {
  if (!me) return 0;
  if (me.is_staff) return 4;
  const map: Record<string, number> = { R: 1, U: 2, C: 3, D: 4 };
  return me.permissions
    .filter((p) => p.menu === menuName && !p.needs_review)
    .reduce((mx, p) => Math.max(mx, map[p.permission] ?? 0), 0);
}

export default function MasterCrudManager({
  basePath, menuName, title, idKey = "id", columns, fields, searchPlaceholder, note, messages,
}: Props) {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [data, setData] = useState<Paginated<Row> | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [reason, setReason] = useState("");

  const level = levelFor(me, menuName);
  const canCreate = level >= 3;
  const canUpdate = level >= 2;
  const canDelete = !!me?.is_staff || level >= 4;

  const blank = useCallback(() => Object.fromEntries(fields.map((f) => [f.key, ""])), [fields]);

  useEffect(() => { getMe().then((m) => { setMe(m); setAuthChecked(true); }); }, []);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setData(await listItems<Row>(basePath, { page, pageSize: PAGE_SIZE, search }));
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setError("auth");
      else setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally { setLoading(false); }
  }, [basePath, page, search]);

  useEffect(() => {
    if (authChecked && me) load();
    else if (authChecked && !me) setLoading(false);
  }, [authChecked, me, load]);

  const startAdd = () => { setEditing(null); setForm(blank()); setFormErr(null); setReason(""); setShowForm(true); };
  const startEdit = (row: Row) => {
    setEditing(row);
    setForm(Object.fromEntries(fields.map((f) => [f.key, row[f.key] == null ? "" : String(row[f.key])])));
    setFormErr(null); setReason(""); setShowForm(true);
  };
  const cancelForm = () => { setShowForm(false); setEditing(null); setForm(blank()); setFormErr(null); setReason(""); };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    if (editing && !reason.trim()) {
      setFormErr("Please Specify Reason For Updation !!!");
      setTimeout(() => document.getElementById("master_reason")?.focus(), 50);
      return;
    }
    setSaving(true); setFormErr(null); setNotice(null);
    try {
      const payload = { ...form, reason_for_updation: reason.trim() };
      const res = editing
        ? await updateItem<Row>(basePath, editing[idKey] as string | number, payload)
        : await createItem<Row>(basePath, payload);
      if (res.ok) { setNotice(editing ? (messages?.updated ?? `${title} updated.`) : (messages?.added ?? `${title} added.`)); cancelForm(); load(); }
      else if (res.status === 403) setFormErr("You do not have permission for this action.");
      else {
        const d = (res.data ?? {}) as unknown as Record<string, unknown>;
        const msg = typeof d.detail === "string" ? d.detail
          : Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(" · ");
        setFormErr(msg || "Save failed.");
      }
    } finally { setSaving(false); }
  };

  const remove = async (row: Row) => {
    if (!confirm(`Delete this ${title.toLowerCase()} record?`)) return;
    setNotice(null);
    const res = await deleteItem(basePath, row[idKey] as string | number);
    if (res.ok) { setNotice(messages?.deleted ?? `${title} deleted.`); load(); }
    else if (res.status === 403) alert("Only administrators can delete.");
    else {
      const d = (res.data ?? {}) as unknown as Record<string, unknown>;
      alert(typeof d.detail === "string" ? d.detail : "Delete failed (record may be referenced).");
    }
  };

  if (authChecked && !me) {
    return (
      <section>
        <h2 style={{ marginTop: 0 }}>{title}</h2>
        <div style={authBox}>🔐 <strong>Sign in required.</strong>{" "}
          <Link href="/login" style={btn}>Go to login</Link></div>
      </section>
    );
  }


  return (
    <section style={{ padding: "15px" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "8.33%" }}></div>
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
            {title}
          </div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); }} style={{ color: "#fff", fontSize: "10px" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>
      <div className="panel-body" style={{ padding: "20px" }}>
      {note && <p className="em-hint" style={{ margin: "4px 0 12px", fontStyle: "italic", color: "#666" }}>{note}</p>}
      {notice && <div style={{ color: "green", fontWeight: "bold", textAlign: "center", marginBottom: "15px", padding: "10px", background: "#dff0d8", border: "1px solid #d6e9c6", borderRadius: "4px" }}>{notice}</div>}

      <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "15px", marginBottom: "20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <b>Search:</b>
          <input className="form-control" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={searchPlaceholder ?? "Search…"} style={{ width: "250px", height: "34px", borderRadius: "4px", border: "1px solid #ccc" }} />
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          {canCreate && !showForm && <button type="button" className="btn btn-primary" onClick={startAdd} style={{ background: "#337ab7", border: "1px solid #2e6da4", color: "#fff", padding: "6px 20px", borderRadius: "4px" }}>+ Add</button>}
          <button className="btn btn-success" onClick={() => window.open(`${API_BASE_URL}${basePath}?export=csv&search=${encodeURIComponent(search)}`)} style={{ background: "#5cb85c", border: "1px solid #4cae4c", color: "#fff", padding: "6px 12px", borderRadius: "4px" }}>CSV</button>
          <button className="btn btn-success" onClick={() => window.open(`${API_BASE_URL}${basePath}?export=excel&search=${encodeURIComponent(search)}`)} style={{ background: "#5cb85c", border: "1px solid #4cae4c", color: "#fff", padding: "6px 12px", borderRadius: "4px" }}>Excel</button>
          <button className="btn btn-danger" onClick={() => window.open(`${API_BASE_URL}${basePath}?export=pdf&search=${encodeURIComponent(search)}`)} style={{ background: "#d9534f", border: "1px solid #d43f3a", color: "#fff", padding: "6px 12px", borderRadius: "4px" }}>PDF</button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={submitForm} style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "25px", marginBottom: "20px" }}>
          <h4 style={{ color: "#337ab7", borderBottom: "1px solid #ccc", paddingBottom: "10px", marginBottom: "20px" }}>{editing ? `Edit ${title}` : `Add ${title}`}</h4>
          <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "15px", alignItems: "flex-end", marginBottom: "20px" }}>
            {fields.map((f) => (
              <div key={f.key} style={{ flex: "1 1 250px" }}>
                <b>{f.label} :</b>{f.required ? <span style={{ color: "red" }}>*</span> : ""}
                <input
                  required={f.required}
                  type={f.type === "number" ? "number" : "text"}
                  value={form[f.key] ?? ""}
                  disabled={!!editing && f.readOnlyOnEdit}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  className="form-control"
                  style={{ width: "100%", height: "34px", borderRadius: "4px", border: "1px solid #ccc" }}
                />
              </div>
            ))}
          </div>
          {editing && (
            <div className="panel panel-primary" style={{ backgroundColor: "#f3f1fe", borderRadius: 10, border: "1px solid white", marginTop: 15, marginBottom: 20 }}>
              <div className="panel-heading">
                <div style={{ color: "white", fontWeight: "bold", fontSize: 15 }}>Reason for Updation</div>
              </div>
              <div className="panel-body container" style={{ width: "100%" }}>
                <div className="row">
                  <div className="col-xs-12">
                    <textarea id="master_reason" className="form-control" rows={4} maxLength={250} placeholder="Enter Reason for Updation"
                      value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: "100%", borderRadius: 4 }} />
                  </div>
                </div>
              </div>
            </div>
          )}
          {formErr && <p style={{ color: "crimson", fontWeight: "bold", marginTop: "10px" }}>{formErr}</p>}
          <div className="row" style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "20px" }}>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ background: "#337ab7", border: "1px solid #2e6da4", color: "#fff", padding: "6px 20px", borderRadius: "4px" }}>{saving ? "Saving…" : "Save"}</button>
            <button type="button" className="btn btn-default" onClick={cancelForm} style={{ background: "#fff", border: "1px solid #ccc", color: "#333", padding: "6px 20px", borderRadius: "4px" }}>Cancel</button>
          </div>
        </form>
      )}

      {loading && <p>Loading…</p>}
      {error === "auth" && <p style={{ color: "crimson" }}>Not authorized to view {title.toLowerCase()}.</p>}
      {error && error !== "auth" && <p style={{ color: "crimson" }}>Error: {error} <button className="lg-btn" onClick={load}>Retry</button></p>}
      {!loading && !error && data && data.results.length === 0 && <p style={{ color: "#666" }}>No records found.</p>}

      {!loading && !error && data && data.results.length > 0 && (
        <div style={{ overflow: "auto", maxHeight: "60vh" }}>
          <table className="table table-bordered table-striped table-hover" style={{ width: "100%", background: "#fff", border: "1px solid #ddd" }}>
            <thead style={{ background: "#006699", color: "white" }}>
              <tr>
                {columns.map((c) => <th key={c.key} style={{ padding: "8px", textTransform: "uppercase" }}>{c.label}</th>)}
                {(canUpdate || canDelete) && <th style={{ padding: "8px", textAlign: "center" }}>ACTION</th>}
              </tr>
            </thead>
            <tbody>
              {data.results.map((row, i) => (
                <tr key={(row[idKey] as string | number) ?? i}>
                  {columns.map((c) => <td key={c.key} style={{ padding: "8px" }}>{fmt(row[c.key])}</td>)}
                  {(canUpdate || canDelete) && (
                    <td style={{ padding: "8px", textAlign: "center", display: "flex", gap: "5px", justifyContent: "center" }}>
                      {canUpdate && <button className="btn btn-primary btn-sm" style={{ padding: "2px 8px" }} onClick={() => startEdit(row)}>Edit</button>}
                      {canDelete && <button className="btn btn-danger btn-sm" style={{ padding: "2px 8px" }} onClick={() => remove(row)}>Delete</button>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <div style={{ padding: "10px 0", borderTop: "1px solid #ddd", marginTop: "10px", fontWeight: "bold" }}>
          Total: {data.count} records
        </div>
      )}
      </div>
      </div>
    </section>
  );
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

const authBox: CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", padding: 16, borderRadius: 8, fontSize: 14, maxWidth: 560 };
const btn: CSSProperties = { padding: "6px 14px", border: "1px solid #00b712", background: "#00b712", color: "#fff", borderRadius: 6, cursor: "pointer", textDecoration: "none", display: "inline-block" };
