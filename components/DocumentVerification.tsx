"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import { listItems, updateItem, ApiError } from "@/lib/api/crud";
import { API_BASE_URL } from "@/lib/api/client";
import DataTable, { type DTColumn } from "@/components/DataTable";

const BASE = "/api/hr/android-documents";
const MENU = "Android Document";

interface DocumentVerification {
  id: number;
  emp_code: string;
  emp_name: string;
  image_name: string;
  image_path: string;
  cur_date: string;
  comments: string;
  reject: number; // 0=Pending, 1=Reject, 2=Approved
  android_flag: number;
}

function levelFor(me: Me | null): number {
  if (!me) return 0;
  if (me.is_staff) return 4;
  const map: Record<string, number> = { R: 1, U: 2, C: 3, D: 4 };
  return me.permissions.filter((p) => p.menu === MENU && !p.needs_review)
    .reduce((mx, p) => Math.max(mx, map[p.permission] ?? 0), 0);
}

export default function DocumentVerification() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [rows, setRows] = useState<DocumentVerification[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  
  // Dialog state for viewing image
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  const level = levelFor(me);
  const canUpdate = level >= 2;

  useEffect(() => { getMe().then((m) => { setMe(m); setAuthChecked(true); }); }, []);

  // Grid Mode
  const [mode, setMode] = useState<"Document" | "Adhar">("Document");

  const loadGrid = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listItems<DocumentVerification>(BASE, { pageSize: 500 });
      let data = res.results;
      if (mode === "Adhar") {
        data = data.filter((d) => d.image_name === "adhar_card_scanning");
      } else {
        data = data.filter((d) => d.image_name !== "adhar_card_scanning");
      }
      setRows(data);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, [mode]);

  useEffect(() => {
    if (authChecked) {
      loadGrid();
    }
  }, [authChecked, loadGrid, mode]);

  const handleApprove = async (id: number) => {
    if (!confirm("Are you Sure You Want to Approve Record")) return;
    try {
      await updateItem(BASE, id, { reject: 2, comments: "Approved Document", android_flag: 1 });
      alert("Approve Images Successfully !!!");
      loadGrid();
    } catch (e: any) {
      alert("Images Approve Fail !!!");
    }
  };

  const handleReject = async (id: number) => {
    const reason = prompt("Reason For Rejection!");
    if (!reason) return;
    try {
      await updateItem(BASE, id, { reject: 1, comments: reason });
      alert("Rejected Successfully");
      loadGrid();
    } catch (e: any) {
      alert("Reject Fail");
    }
  };

  const [uploadEmpCode, setUploadEmpCode] = useState("");
  const [uploadDocType, setUploadDocType] = useState("passprt_size_photo");
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile || !uploadEmpCode) return alert("Select file and enter employee code");
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("emp_code", uploadEmpCode);
      fd.append("image_name", uploadDocType);
      fd.append("file", uploadFile);
      const res = await fetch(API_BASE_URL + BASE + "/", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) throw new Error("Upload failed");
      alert("Document uploaded successfully");
      setUploadFile(null);
      setUploadEmpCode("");
      loadGrid();
    } catch (e: any) {
      alert("Upload error: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (path: string) => {
    if (!path) return "";
    return `${API_BASE_URL}/api/hr/android-documents/${path.split('/').pop()?.split('?')[0]}/download/`; // We would need the obj ID for download, wait, the API download uses pk. Let's just point to MEDIA_URL if possible, or use the download endpoint. Actually, download needs ID.
  };
  
  // Update DT_COLS_DOC image render
  const DT_COLS_DOC: DTColumn<DocumentVerification>[] = [
    { key: "emp_code", label: "Employee Code", value: (r) => r.emp_code },
    { key: "emp_name", label: "Employee Name", value: (r) => r.emp_name },
    { key: "image_name", label: "Document Name", value: (r) => {
      const map: Record<string, string> = {
        "police_verification_form": "Police Verification form",
        "adhar_card_upload": "Adhar Card",
        "Pan_card_upload": "Pan Card",
        "joining_form": "Joining form",
        "form_11": "Form 11",
        "form_2": "Form 2",
        "bank_passbook": "Bank passbook",
        "passprt_size_photo": "Passport size photo",
        "Employee_photo_upload": "Employee Id card",
        "Attendance_Selfie": "Attendance Selfie",
      };
      return map[r.image_name] || r.image_name;
    }},
    { key: "status", label: "Status", value: (r) => {
      if (r.reject === 0) return "Pending";
      if (r.reject === 1) return "Reject";
      if (r.reject === 2) return "Approved";
      return "";
    }},
    { key: "comments", label: "Comments", value: (r) => r.comments || "" },
    { key: "image", label: "Image", render: (r) => (
      r.image_path ? (
        <img 
          src={`${API_BASE_URL}${BASE}/${r.id}/download/`} 
          alt="Document" 
          style={{ width: "50px", height: "50px", cursor: "pointer", objectFit: "cover" }}
          onClick={() => setZoomImage(`${API_BASE_URL}${BASE}/${r.id}/download/`)}
        />
      ) : null
    )},
    {
      key: "actions",
      label: "Action",
      render: (r) => (
        <div className="flex gap-2">
          {r.reject === 0 && canUpdate && (
            <>
              <button className="btn btn-success btn-xs" onClick={() => handleApprove(r.id)}>Approve</button>
              <button className="btn btn-danger btn-xs" onClick={() => handleReject(r.id)}>Reject</button>
            </>
          )}
        </div>
      ),
    },
  ];

  const DT_COLS_ADHAR: DTColumn<DocumentVerification>[] = [
    { key: "emp_code", label: "Employee Code", value: (r) => r.emp_code },
    { key: "emp_name", label: "Employee Name", value: (r) => r.emp_name },
    { key: "field1", label: "Field1", value: (r) => (r as any).field1 || "" },
    { key: "field2", label: "Field2", value: (r) => (r as any).field2 || "" },
    { key: "field3", label: "Field3", value: (r) => (r as any).field3 || "" },
    { key: "field4", label: "Field4", value: (r) => (r as any).field4 || "" },
    { key: "field5", label: "Field5", value: (r) => (r as any).field5 || "" },
    { key: "field6", label: "Field6", value: (r) => (r as any).field6 || "" },
    { key: "field7", label: "Field7", value: (r) => (r as any).field7 || "" },
    { key: "field8", label: "Field8", value: (r) => (r as any).field8 || "" },
  ];

  if (!authChecked) return <div className="p-4">Loading...</div>;
  if (!me) return <div className="p-4"><Link href="/login">Please log in</Link></div>;
  if (level < 1) return <div className="p-4 text-red-500">Permission denied (requires {MENU} read).</div>;

  return (
    <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      {canUpdate && (
        <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px", marginBottom: "20px" }}>
          <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px" }}>
            <b style={{ fontSize: "14px" }}>Upload Employee Document / Selfie</b>
          </div>
          <div className="panel-body" style={{ padding: "15px" }}>
            <form onSubmit={handleUpload} style={{ display: "flex", gap: "15px", alignItems: "flex-end", flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: "150px" }}>
                <b>Employee Code</b><br/>
                <input type="text" className="form-control" value={uploadEmpCode} onChange={e=>setUploadEmpCode(e.target.value)} required />
              </div>
              <div style={{ flex: 1, minWidth: "150px" }}>
                <b>Document Type</b><br/>
                <select className="form-control" value={uploadDocType} onChange={e=>setUploadDocType(e.target.value)}>
                  <option value="passprt_size_photo">Passport size photo</option>
                  <option value="adhar_card_upload">Aadhaar Card</option>
                  <option value="Pan_card_upload">PAN Card</option>
                  <option value="bank_passbook">Bank Passbook</option>
                  <option value="police_verification_form">Police Verification Form</option>
                  <option value="Employee_photo_upload">Employee ID Card</option>
                  <option value="Attendance_Selfie">Attendance Selfie</option>
                </select>
              </div>
              <div style={{ flex: 1, minWidth: "150px" }}>
                <b>File</b><br/>
                <input type="file" className="form-control" onChange={e=>setUploadFile(e.target.files?.[0]||null)} required accept="image/*,.pdf" />
              </div>
              <div style={{ paddingBottom: "2px" }}>
                <button type="submit" className="btn btn-primary" disabled={loading}>Upload</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px", marginBottom: "20px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "8.33%" }}></div>
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
            EMPLOYEE DOCUMENT VERIFICATION
          </div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); window.open("/html/Emp_Document_Verification.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }} style={{ color: "#fff", fontSize: "10px" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>
        
        <div className="panel-body" style={{ padding: "15px" }}>
          <div className="container-fluid" style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "15px", marginBottom: "20px", marginTop: "20px" }}>
            <div className="row">
              <div className="col-sm-3 col-xs-12">
                <b>Detail:</b> <span style={{ color: "red" }}>*</span><br />
                <select className="form-control" style={{ maxWidth: "250px" }} value={mode} onChange={(e) => setMode(e.target.value as any)}>
                  <option value="Document">Document Verification</option>
                  <option value="Adhar">Adhar Card Details</option>
                </select>
              </div>
            </div>
          </div>
          
          <div className="container-fluid" style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "15px", marginBottom: "10px", marginTop: "10px" }}>
            {notice && <div className="alert alert-info">{notice}</div>}
            {mode === "Adhar" && <h2 style={{ textAlign: "center", marginBottom: "15px" }}><b>Adhar Card Details</b></h2>}
            <div className="grid-view" style={{ height: "auto", overflowY: "auto", overflowX: "hidden" }}>
              <DataTable<any> columns={mode === "Document" ? DT_COLS_DOC : DT_COLS_ADHAR as any} rows={rows} rowKey={(r) => r.id} />
            </div>
          </div>
        </div>
      </div>
      
      {zoomImage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded max-w-3xl w-full">
            <div className="flex justify-between items-center mb-4">
              <h5 className="font-bold">Zoomed Image</h5>
              <button className="text-xl" onClick={() => setZoomImage(null)}>&times;</button>
            </div>
            <div className="text-center">
              <img src={zoomImage} alt="Zoomed" className="max-w-full max-h-[70vh] mx-auto" />
            </div>
            <div className="text-right mt-4">
              <button className="btn btn-secondary" onClick={() => setZoomImage(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
