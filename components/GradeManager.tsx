"use client";

import { useEffect, useState, useCallback, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import {
  listHr, createHr, updateHr, deleteHr, ApiError, type Paginated,
} from "@/lib/api/hr";

interface Grade {
  id: number;
  comp_code: string;
  grade_code: string;
  grade_desc: string;
  reporting_to: string;
  working_hours: string;
  employee_type: string;
  login_person: string;
  last_modify_date: string | null;
  source: string;
}

const EMPTY = { grade_code: "", grade_desc: "", employee_type: "", working_hours: "", reporting_to: "" };
const PAGE_SIZE = 25;

export default function GradeManager() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [data, setData] = useState<Paginated<Grade> | null>(null);
  const [empType, setEmpType] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Grade | null>(null);
  const [form, setForm] = useState({ ...EMPTY });
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getMe().then((m) => { setMe(m); setAuthChecked(true); });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listHr<Grade>("grades", {
        page, pageSize: PAGE_SIZE, search,
        filters: empType ? { employee_type: empType } : {},
      });
      setData(res);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) setError("auth");
      else setError(e instanceof Error ? e.message : "Failed to load");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [page, search, empType]);

  useEffect(() => {
    if (authChecked && me) load();
    else if (authChecked && !me) setLoading(false);
  }, [authChecked, me, load]);

  const startAdd = () => { setEditing(null); setForm({ ...EMPTY, employee_type: empType }); setFormErr(null); setShowForm(true); };
  const startEdit = (g: Grade) => {
    setEditing(g);
    setForm({ grade_code: g.grade_code, grade_desc: g.grade_desc, employee_type: g.employee_type,
      working_hours: g.working_hours, reporting_to: g.reporting_to });
    setFormErr(null);
    setShowForm(true);
  };
  const cancelForm = () => { setShowForm(false); setEditing(null); setForm({ ...EMPTY }); setFormErr(null); };

  const submitForm = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFormErr(null);
    setNotice(null);
    try {
      const res = editing
        ? await updateHr<Grade>("grades", editing.id, form)
        : await createHr<Grade>("grades", form);
      if (res.ok) {
        setNotice(editing ? "Grade updated." : "Grade added.");
        cancelForm();
        load();
      } else if (res.status === 403) {
        setFormErr("You do not have permission for this action.");
      } else {
        const d = (res.data ?? {}) as unknown as Record<string, unknown>;
        const msg = typeof d.detail === "string" ? d.detail
          : Object.entries(d).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).join(" · ");
        setFormErr(msg || "Save failed.");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async (g: Grade) => {
    if (!confirm(`Delete grade "${g.grade_code}" (${g.employee_type})?`)) return;
    setNotice(null);
    const res = await deleteHr("grades", g.id);
    if (res.ok) { setNotice("Grade deleted."); load(); }
    else if (res.status === 403) alert("Only administrators can delete a grade.");
    else {
      const d = (res.data ?? {}) as unknown as Record<string, unknown>;
      alert(typeof d.detail === "string" ? d.detail : "Delete failed (grade may be assigned to employees).");
    }
  };

  if (authChecked && !me) {
    return (
      <section>
        <h2 style={{ marginTop: 0 }}>Grades</h2>
        <div style={authBox}>
          🔐 <strong>Sign in required.</strong>{" "}
          <Link href="/login" style={btn}>Go to login</Link>
        </div>
      </section>
    );
  }


  return (
    <section>
      <header style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h2 style={{ margin: 0 }}>Grades / Designations</h2>
        {data && <span style={{ color: "#666", fontSize: 14 }}>{data.count.toLocaleString()} in your company</span>}
      </header>

      {notice && <p style={{ color: "#166534", background: "#dcfce7", padding: "6px 10px", borderRadius: 6 }}>{notice}</p>}

      <div style={{ margin: "12px 0", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input value={empType} onChange={(e) => { setEmpType(e.target.value); setPage(1); }}
          placeholder="Filter employee type…" style={input} />
        <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search code / description…" style={input} />
        {!showForm && <button type="button" style={btn} onClick={startAdd}>+ Add Grade</button>}
      </div>

      {showForm && (
        <form onSubmit={submitForm} style={card}>
          <h3 style={{ marginTop: 0 }}>{editing ? `Edit grade ${editing.grade_code}` : "Add grade"}</h3>
          <div style={grid}>
            <label style={lbl}>Grade code*
              <input required value={form.grade_code} disabled={!!editing}
                onChange={(e) => setForm({ ...form, grade_code: e.target.value })} style={input} />
            </label>
            <label style={lbl}>Employee type*
              <input required value={form.employee_type} disabled={!!editing}
                onChange={(e) => setForm({ ...form, employee_type: e.target.value })} style={input} />
            </label>
            <label style={lbl}>Description
              <input value={form.grade_desc} onChange={(e) => setForm({ ...form, grade_desc: e.target.value })} style={input} />
            </label>
            <label style={lbl}>Working hours
              <input value={form.working_hours} onChange={(e) => setForm({ ...form, working_hours: e.target.value })} style={input} />
            </label>
            <label style={lbl}>Reporting to
              <input value={form.reporting_to} onChange={(e) => setForm({ ...form, reporting_to: e.target.value })} style={input} />
            </label>
          </div>
          {formErr && <p style={{ color: "crimson" }}>{formErr}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button type="submit" style={btn} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            <button type="button" style={btnGhost} onClick={cancelForm}>Cancel</button>
          </div>
        </form>
      )}

      {loading && <p>Loading…</p>}
      {error === "auth" && <p style={{ color: "crimson" }}>Not authorized to view grades.</p>}
      {error && error !== "auth" && <p style={{ color: "crimson" }}>Error: {error} <button style={btnGhost} onClick={load}>Retry</button></p>}
      {!loading && !error && data && data.results.length === 0 && <p style={{ color: "#666" }}>No grades found.</p>}

      {!loading && !error && data && data.results.length > 0 && (
        <div style={{ overflow: "auto", maxHeight: "60vh" }}>
          <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 14 }}>
            <thead>
              <tr>
                {["Grade", "Description", "Emp Type", "Hours", "Reporting To"].map((h) => <th key={h} style={th}>{h}</th>)}
                <th style={th}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.results.map((g) => (
                <tr key={g.id} style={{ borderTop: "1px solid #eee" }}>
                  <td style={td}>{g.grade_code}</td>
                  <td style={td}>{g.grade_desc || "—"}</td>
                  <td style={td}>{g.employee_type || "—"}</td>
                  <td style={td}>{g.working_hours || "—"}</td>
                  <td style={td}>{g.reporting_to || "—"}</td>
                  <td style={td}>
                    <button style={btnGhost} onClick={() => startEdit(g)}>Edit</button>{" "}
                    <button style={btnDanger} onClick={() => remove(g)}>Delete</button>
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
    </section>
  );
}

const input: CSSProperties = { padding: "6px 10px", border: "1px solid #ccc", borderRadius: 6, minWidth: 180 };
const btn: CSSProperties = { padding: "6px 14px", border: "1px solid #00b712", background: "#00b712", color: "#fff", borderRadius: 6, cursor: "pointer", textDecoration: "none", display: "inline-block" };
const btnGhost: CSSProperties = { padding: "5px 12px", border: "1px solid #ccc", background: "#fff", borderRadius: 6, cursor: "pointer" };
const btnDanger: CSSProperties = { padding: "5px 12px", border: "1px solid #dc2626", background: "#fff", color: "#dc2626", borderRadius: 6, cursor: "pointer" };
const card: CSSProperties = { border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, margin: "12px 0", background: "#fafafa" };
const grid: CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 12 };
const lbl: CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#374151" };
const th: CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #ddd", background: "#fafafa" };
const td: CSSProperties = { padding: "8px 10px", verticalAlign: "top" };
const authBox: CSSProperties = { background: "#eff6ff", border: "1px solid #bfdbfe", color: "#1e3a8a", padding: 16, borderRadius: 8, fontSize: 14, maxWidth: 560 };
