"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getJSON, mk, patchJSON } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

// 1:1 port of Emp_Document_Verification.aspx ("Employee Document Verification").
// Detail mode switches between the document grid and the Adhar Card Details grid.
const B = "/api/hr/document-verification";

interface DocRow {
  id: number; emp_code: string; emp_name: string; client_name: string; unit_name: string;
  working_city: string; image_name: string; image_raw: string; comments: string;
  image_path: string; image_url: string; status: string; reject: number;
}
interface AdharRow {
  id: number; emp_code: string; emp_name: string; udi: string; name: string; gender: string;
  village_tahasil: string; district: string; state: string; post_code: string; dob: string;
}

export default function DocumentVerificationPage() {
  const [detail, setDetail] = useState("Document Verification");
  const [docRows, setDocRows] = useState<DocRow[]>([]);
  const [adharRows, setAdharRows] = useState<AdharRow[]>([]);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");
  const [zoom, setZoom] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  const loadDocs = useCallback(async () => {
    const [d1, d2] = await Promise.all([
      getJSON<{ results: DocRow[] }>(`${B}/documents/`).catch(() => null),
      getJSON<{ results?: any[] } | any[]>("/api/hr/android-documents/?page_size=all").catch(() => null),
    ]);

    let list: DocRow[] = d1?.results ? [...d1.results] : [];
    const rawList2: any[] = Array.isArray(d2) ? d2 : (d2?.results ?? []);

    if (rawList2.length > 0) {
      const existingIds = new Set(list.map((r) => `${r.emp_code}_${r.id}`));
      const labelMap: Record<string, string> = {
        police_verification_form: "Police Verification form",
        adhar_card_upload: "Adhar Card",
        Pan_card_upload: "Pan Card",
        joining_form: "Joining form",
        form_11: "Form 11",
        form_2: "Form 2",
        bank_passbook: "Bank passbook",
        passprt_size_photo: "Passport size photo",
        Employee_photo_upload: "Employee Id card",
      };
      const statusMap: Record<number, string> = { 0: "Pending", 1: "Reject", 2: "Approved" };

      for (const r of rawList2) {
        if (r.image_name === "adhar_card_scanning") continue;
        const key = `${r.emp_code}_${r.id}`;
        if (!existingIds.has(key)) {
          const rawName = r.image_name || "";
          const p = (r.image_path || "").replace(/\\/g, "/").trim();
          let imgUrl = "";
          if (p.startsWith("http://") || p.startsWith("https://")) {
            imgUrl = p;
          } else if (p.startsWith("employee_docs/") || p.startsWith("employee_documents/") || p.startsWith("Temp_images/") || p.startsWith("EMP_Images/")) {
            imgUrl = `/media/${p}`;
          } else if (p) {
            imgUrl = `/media/Temp_images/${p}`;
          }

          list.push({
            id: r.id,
            emp_code: r.emp_code || "",
            emp_name: r.emp_name || "",
            client_name: r.client_name || "-",
            unit_name: r.unit_name || "-",
            working_city: r.working_city || "-",
            image_name: labelMap[rawName] || rawName.replace(/_/g, " "),
            image_raw: rawName,
            comments: r.comments || "",
            image_path: p,
            image_url: imgUrl,
            status: statusMap[r.reject] || "Pending",
            reject: r.reject ?? 0,
          });
        }
      }
    }

    setDocRows(list);
  }, []);

  const loadAdhar = useCallback(async () => {
    const [d1, d2] = await Promise.all([
      getJSON<{ results: AdharRow[] }>(`${B}/adhar/`).catch(() => null),
      getJSON<{ results?: any[] } | any[]>("/api/hr/android-documents/?page_size=all").catch(() => null),
    ]);

    let list: AdharRow[] = d1?.results ? [...d1.results] : [];
    const rawList2: any[] = Array.isArray(d2) ? d2 : (d2?.results ?? []);
    if (rawList2.length > 0) {
      const existingIds = new Set(list.map((r) => r.id));
      for (const r of rawList2) {
        if (r.image_name === "adhar_card_scanning" || r.field1) {
          if (!existingIds.has(r.id)) {
            list.push({
              id: r.id,
              emp_code: r.emp_code || "",
              emp_name: r.emp_name || "",
              udi: r.field1 || "",
              name: r.field2 || "",
              gender: r.field3 || "",
              village_tahasil: r.field4 || "",
              district: r.field5 || "",
              state: r.field6 || "",
              post_code: r.field7 || "",
              dob: r.field8 || "",
            });
          }
        }
      }
    }
    setAdharRows(list);
  }, []);

  useEffect(() => { loadDocs(); }, [loadDocs]);
  useEffect(() => { if (detail === "Adhar Card Details") loadAdhar(); }, [detail, loadAdhar]);

  const approve = async (row: DocRow) => {
    if (!confirm("Are you Sure You Want to Approve Record")) return;
    let r = await mk(`${B}/approve/`, { id: row.id });
    if (!r.ok) {
      r = await patchJSON(`/api/hr/android-documents/${row.id}/`, { reject: 2, comments: "Approved Document", android_flag: 1 });
    }
    const b = await r.json().catch(() => ({} as any));
    if (r.ok) { if (b.status) alert(b.status); else alert("Record Approved Successfully"); setMsg(b.status ?? "Record Approved"); loadDocs(); }
    else alert(b.detail || JSON.stringify(b));
  };

  const startReject = (row: DocRow) => {
    if (!confirm("Are you Sure You Want to reject Record")) return;
    setRejectId(row.id); setComment("");
    window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
  };

  const submitReject = async () => {
    if (rejectId == null) return;
    if (!comment.trim()) { alert("Please Enter Reason !!"); return; }
    let r = await mk(`${B}/reject/`, { id: rejectId, comment });
    if (!r.ok) {
      r = await patchJSON(`/api/hr/android-documents/${rejectId}/`, { reject: 1, comments: comment, android_flag: 1 });
    }
    const b = await r.json().catch(() => ({} as any));
    if (r.ok) { alert(b.status ?? "Record Reject Successfully"); if (b.warning) alert(b.warning); setMsg(b.status ?? ""); setRejectId(null); setComment(""); loadDocs(); }
    else alert(b.detail || JSON.stringify(b));
  };

  const term = search.trim().toLowerCase();
  const filteredDocs = term
    ? docRows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(term)))
    : docRows;
  const filteredAdhar = term
    ? adharRows.filter((r) => Object.values(r).some((v) => String(v).toLowerCase().includes(term)))
    : adharRows;

  return (
    <>
      <div className="container-fluid">
        <div className="panel panel-primary" style={{ backgroundColor: "white" }}>
          <div className="panel-heading">
            <div className="row">
              <div className="col-sm-1"></div>
              <div className="col-sm-9">
                <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase">
                  <b>Employee Document Verification</b>
                </div>
              </div>
              <div className="col-sm-2 text-right">
                <Link href="#" onClick={(e) => { e.preventDefault(); window.open("/html/Emp_Document_Verification.html", "Help", "width=800,height=600,scrollbars=yes"); }}>
                  <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
                </Link>
              </div>
            </div>
          </div>

          <div className="panel-body">
            {msg && <div style={{ color: "green", fontWeight: "bold", textAlign: "center", marginBottom: 12 }}>{msg}</div>}

            <div className="container-fluid" style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: 10, padding: 20, marginBottom: 20 }}>
              <div className="row" style={{ marginBottom: 15 }}>
                <div className="col-sm-3 col-xs-12">
                  <b>Detail: <span style={{ color: "red" }}>*</span></b>
                  <select className="form-control" value={detail} onChange={(e) => { setDetail(e.target.value); setRejectId(null); }}>
                    <option value="Select">Select</option>
                    <option value="Document Verification">Document Verification</option>
                    <option value="Adhar Card Details">Adhar Card Details</option>
                  </select>
                </div>
                <div className="col-sm-3 col-xs-12 pull-right">
                  <b>Search :</b>
                  <input className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" />
                </div>
              </div>

              {detail !== "Adhar Card Details" && (
                <div style={{ overflowX: "auto" }}>
                  <table className="table table-bordered table-striped" style={{ background: "#fff" }}>
                    <thead style={{ background: "#424D7A", color: "#fff" }}>
                      <tr>
                        <th>Id</th><th>EMP CODE</th><th>EMP NAME</th><th>Client Name</th><th>Unit Name</th>
                        <th>Working City</th><th>IMAGE NAME</th><th>COMMENTS</th><th>VIEW</th><th>STATUS</th>
                        <th>Approved</th><th>Reject</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDocs.length === 0 ? (
                        <tr><td colSpan={12} style={{ textAlign: "center" }}>No records</td></tr>
                      ) : filteredDocs.map((r) => (
                        <tr key={r.id}>
                          <td>{r.id}</td><td>{r.emp_code}</td><td>{r.emp_name}</td><td>{r.client_name}</td>
                          <td>{r.unit_name}</td><td>{r.working_city}</td><td>{r.image_name}</td><td>{r.comments}</td>
                          <td style={{ textAlign: "center" }}>
                            <img src={r.image_url ? `${API_BASE_URL}${r.image_url}` : "/Images/placeholder.png"} width={50} height={50}
                              alt="doc" style={{ cursor: "pointer", objectFit: "cover" }}
                              onClick={() => setZoom(r.image_url ? `${API_BASE_URL}${r.image_url}` : "/Images/placeholder.png")} />
                          </td>
                          <td>{r.status}</td>
                          <td style={{ textAlign: "center" }}><button className="btn btn-success btn-xs" onClick={() => approve(r)}>Approved</button></td>
                          <td style={{ textAlign: "center" }}><button className="btn btn-danger btn-xs" onClick={() => startReject(r)}>Reject</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {rejectId != null && (
                    <div className="panel panel-default" style={{ marginTop: 15, maxWidth: 420 }}>
                      <div className="panel-body">
                        <b>Comment :</b>
                        <textarea className="form-control" rows={3} value={comment} onChange={(e) => setComment(e.target.value)} />
                        <div style={{ marginTop: 10 }}>
                          <button className="btn btn-danger" onClick={submitReject}>Reject</button>&nbsp;
                          <button className="btn btn-default" onClick={() => { setRejectId(null); setComment(""); }}>Cancel</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {detail === "Adhar Card Details" && (
                <div style={{ overflowX: "auto" }}>
                  <h4 className="text-center"><b>Adhar Card Details</b></h4>
                  <table className="table table-bordered table-striped" style={{ background: "#fff" }}>
                    <thead style={{ background: "#424D7A", color: "#fff" }}>
                      <tr>
                        <th>Id</th><th>EMP CODE</th><th>EMP NAME</th><th>UDI</th><th>Name</th><th>Gender</th>
                        <th>Village Tahasil</th><th>District</th><th>State</th><th>Post Code</th><th>Date Of Birth</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAdhar.length === 0 ? (
                        <tr><td colSpan={11} style={{ textAlign: "center" }}>No records</td></tr>
                      ) : filteredAdhar.map((r) => (
                        <tr key={r.id}>
                          <td>{r.id}</td><td>{r.emp_code}</td><td>{r.emp_name}</td><td>{r.udi}</td><td>{r.name}</td>
                          <td>{r.gender}</td><td>{r.village_tahasil}</td><td>{r.district}</td><td>{r.state}</td>
                          <td>{r.post_code}</td><td>{r.dob}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="text-center">
              <Link href="/" className="btn btn-danger">Close</Link>
            </div>
          </div>
        </div>
      </div>

      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", padding: 10, borderRadius: 6, maxWidth: "90%", maxHeight: "90%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <b>Zoomed Image</b>
              <button className="btn btn-default btn-xs" onClick={() => setZoom(null)}>✕</button>
            </div>
            <img src={zoom} alt="Zoomed" style={{ maxWidth: "80vw", maxHeight: "75vh", objectFit: "contain" }} />
          </div>
        </div>
      )}
    </>
  );
}
