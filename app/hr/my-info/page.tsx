"use client";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getJSONStrict } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

// Legacy EmployeeInfo.aspx ("My Info") -- the logged-in employee's OWN record, read-only.
// The record is resolved server-side from the authenticated login (emp_code = login id, same
// company); there is no fuzzy search and no fallback to another employee's row.
// Layout: header block + Contact / Employee / Family / Bank Account / Personal / Qualification /
// Rating / Documents / KRA / Uniform tabs. Identifiers (Aadhaar, PAN, account, passport, licence) stay masked.
type Field = { label: string; value: string };
type Tab = {
  key: string; title: string; fields?: Field[];
  documents?: { label: string; file: string }[];
  uniform?: { document_type: string; no_of_set: number | string; size: string; start_date: string; end_date: string }[];
};
interface Info { found: boolean; message?: string; header?: Field[]; tabs?: Tab[] }

export default function MyInfoPage() {
  const router = useRouter();
  const [info, setInfo] = useState<Info | null>(null);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState("contact");
  useEffect(() => {
    (async () => {
      try {
        const d = await getJSONStrict<Info>("/api/hr/employee-details/my-info/");
        if (!d.found) setMsg(d.message || "No employee record found for your login.");
        setInfo(d.found ? d : null);
      } catch (e: any) {
        setMsg(e.message || "Unable to load your information.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  const cell = { padding: "6px 8px", border: "1px solid #ddd" } as const;
  const grid = (fields: Field[]) => (
    <div className="row" style={{ display: "flex", flexWrap: "wrap" }}>
      {fields.map((f, i) => (
        <div key={i} className="col-sm-4 col-xs-12" style={{ marginBottom: 10 }}>
          <b>{f.label}</b>
          <input type="text" className="form-control text_box" readOnly value={f.value} />
        </div>
      ))}
    </div>
  );
  const cur = info?.tabs?.find((t) => t.key === active);
  return (
    <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px", backgroundColor: "#fff" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
          My Info
        </div>
        <div className="panel-body" style={{ padding: "15px", background: "beige", minHeight: "500px" }}>
          {loading && <div>Loading...</div>}
          {msg && <div style={{ color: "#b91c1c", padding: "15px", background: "#f2dede", border: "1px solid #ebccd1", borderRadius: "4px", marginBottom: "15px" }}>{msg}</div>}
          {info && (
            <>
              {grid(info.header ?? [])}
              <ul className="nav nav-tabs" style={{ marginTop: 10 }}>
                {(info.tabs ?? []).map((t) => (
                  <li key={t.key} className={active === t.key ? "active" : ""}>
                    <a href="#" onClick={(e) => { e.preventDefault(); setActive(t.key); }}><b>{t.title}</b></a>
                  </li>
                ))}
              </ul>
              <div className="tab-content" style={{ background: "#f3f1fe", padding: 20, borderRadius: 10 }}>
                {cur?.fields && grid(cur.fields)}
                {cur?.documents && (
                  <div className="row" style={{ display: "flex", flexWrap: "wrap" }}>
                    {cur.documents.map((d, i) => (
                      <div key={i} className="col-sm-3 col-xs-6" style={{ marginBottom: 14, textAlign: "center" }}>
                        <b>{d.label}</b><br />
                        {d.file ? (
                          <a href={`${API_BASE_URL}/api/hr/employee-details/my-info-file/?name=${encodeURIComponent(d.file)}`} target="_blank" rel="noreferrer">
                            <img alt={d.label} style={{ maxWidth: 120, maxHeight: 120, border: "1px solid #ccc" }}
                              src={`${API_BASE_URL}/api/hr/employee-details/my-info-file/?name=${encodeURIComponent(d.file)}`} />
                            <div>Open</div>
                          </a>
                        ) : <span style={{ color: "#888" }}>Not uploaded</span>}
                      </div>
                    ))}
                  </div>
                )}
                {cur?.uniform && (
                  <table className="table table-bordered" style={{ width: "100%", fontSize: 12, background: "#fff" }}>
                    <thead><tr>{["Document Type", "No of Set", "Size", "Start Date", "End Date"].map((h) => <th key={h} style={cell}>{h}</th>)}</tr></thead>
                    <tbody>
                      {cur.uniform.length === 0 && <tr><td style={cell} colSpan={5}>No records found.</td></tr>}
                      {cur.uniform.map((r, i) => (
                        <tr key={i}><td style={cell}>{r.document_type}</td><td style={cell}>{r.no_of_set}</td><td style={cell}>{r.size}</td><td style={cell}>{r.start_date}</td><td style={cell}>{r.end_date}</td></tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          )}
          <div style={{ marginTop: 14 }}>
            <button type="button" className="btn btn-danger" onClick={() => router.push("/Home")}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
