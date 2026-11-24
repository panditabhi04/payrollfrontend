"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getJSON as apiGet, getJSONStrict, upload, responseMessage } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

export default function WorkingImages() {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  
  // Dropdown states
  const [clients, setClients] = useState<any[]>([]);
  const [states, setStates] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [allUnits, setAllUnits] = useState<{ unit_code: string; unit_name: string; state_name: string }[]>([]);

  const [formData, setFormData] = useState({
    client_name: "",
    state_name: "",
    unit_code: "",
    image_type: "Select",
    wrk_date: ""
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Legacy gv_wrk_details(): grid shows only the selected branch's images (empty until a branch is chosen).
  const fetchRecords = async (unit?: string) => {
    const uc = unit ?? formData.unit_code;
    if (!uc || uc === "Select") { setRecords([]); return; }
    setLoading(true);
    try {
      const res = await getJSONStrict<any>(`/api/hr/working-images/?unit_code=${encodeURIComponent(uc)}`);
      setRecords(Array.isArray(res) ? res : (res?.results || []));
    } catch (err: any) {
      alert("Error fetching working images: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    apiGet<{ results: { client_code: string; client_name: string }[] }>(`/api/masters/clients/?page_size=all`)
      .then((d) => setClients((d?.results ?? []).map((c) => ({ id: c.client_code, name: c.client_name })))).catch(() => setClients([]));
  }, []);

  // Branches load from the real units lookup when a client is chosen (replaces stub list).
  useEffect(() => {
    const cc = (formData as any).client_name;
    if (!cc || cc === "Select") { setAllUnits([]); setStates([]); setBranches([]); return; }
    apiGet<{ units: { unit_code: string; unit_name: string; state_name: string }[] }>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(cc)}`)
      .then((d) => {
        const us = d?.units ?? [];
        setAllUnits(us);
        setStates(Array.from(new Set(us.map((u) => u.state_name).filter(Boolean))).sort().map((s) => ({ id: s, name: s })));
      }).catch(() => { setAllUnits([]); setStates([]); });
  }, [(formData as any).client_name]);

  // Branch list depends on the chosen state (legacy ddl_state_SelectedIndexChanged)
  useEffect(() => {
    const st = formData.state_name;
    setBranches(st ? allUnits.filter((u) => u.state_name === st).map((u) => ({ id: u.unit_code, name: u.unit_name })) : []);
  }, [formData.state_name, allUnits]);

  useEffect(() => { fetchRecords(formData.unit_code); /* eslint-disable-next-line */ }, [formData.unit_code]);

  const handleInputChange = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => name === "client_name" ? { ...prev, client_name: value, state_name: "", unit_code: "" }
      : name === "state_name" ? { ...prev, state_name: value, unit_code: "" }
      : { ...prev, [name]: value });
  };

  const handleSave = async () => {
    if (formData.client_name === "Select" || !formData.client_name) {
      alert("Please Select Client From List");
      return;
    }
    if (!formData.state_name || formData.state_name === "Select") {
      alert("Please Select State From List");
      return;
    }
    if (formData.unit_code === "Select" || !formData.unit_code) {
      alert("Please Select Branch From List");
      return;
    }
    if (formData.image_type === "Select") {
      alert("Please Select Image Type List");
      return;
    }
    if (!formData.wrk_date) {
      alert("Please Select Date");
      return;
    }

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      alert("Please Select File");
      return;
    }

    setLoading(true);
    try {
      const data = new FormData();
      data.append("client_name", formData.client_name);
      data.append("state_name", formData.state_name);
      data.append("unit_code", formData.unit_code);
      data.append("image_type", formData.image_type);
      data.append("datecurrent", formData.wrk_date);
      data.append("image", file);

      const res = await upload(`/api/hr/working-images/`, data);
      if (res.ok) {
        alert(" Record  Added Successfully... !!!");
        if (fileInputRef.current) fileInputRef.current.value = "";
        fetchRecords(formData.unit_code);
        // legacy txt_clear(): reset all selections after save
        setFormData({ client_name: "", state_name: "", unit_code: "", image_type: "Select", wrk_date: "" });
      } else {
        alert(await responseMessage(res, " Please Upload file... !!!"));
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Legacy wrk_file1_Click streams the file as an attachment (download endpoint).
  const downloadImage = (id: number) => {
    window.open(`${API_BASE_URL}/api/hr/working-images/${id}/download/`, "_blank");
  };
  const isImage = (name: string) => /\.(jpe?g|png)$/i.test(name || "");

  return (
    <div className="container-fluid" style={{ maxWidth: "99%", margin: "0 auto", padding: "20px" }}>
      {loading && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(204, 204, 204, 0.7)", zIndex: 9999 }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>Loading...</div>
        </div>
      )}

      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ flex: "1", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
            Branchwise Working Images
          </div>
          <div style={{ textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); window.open("html/working_images.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }} style={{ color: "#fff" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>

        <div className="panel-body" style={{ padding: "15px" }}>
          <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "25px", marginBottom: "20px", marginTop: "20px" }}>
            
            <div className="row" style={{ display: "flex", flexWrap: "wrap", marginBottom: "15px", gap: "10px" }}>
              <div style={{ flex: "1 1 15%" }}>
                <b>Client Name :</b>
                <select name="client_name" value={formData.client_name} onChange={handleInputChange} className="form-control">
                  <option value="">Select</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 15%" }}>
                <b>State Name :</b>
                <select name="state_name" value={formData.state_name} onChange={handleInputChange} className="form-control">
                  <option value="">Select</option>
                  {states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 15%" }}>
                <b>Branch Name :</b>
                <select name="unit_code" value={formData.unit_code} onChange={handleInputChange} className="form-control">
                  <option value="">Select</option>
                  {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 15%" }}>
                <b>Image Type :</b>
                <select name="image_type" value={formData.image_type} onChange={handleInputChange} className="form-control">
                  <option value="Select">Select</option>
                  <option value="Cleaning_Images">Cleaning Images</option>
                  <option value="Deep_Cleaning_Images">Deep Cleaning Images</option>
                  <option value="Pest_Control_Images">Pest Control Images</option>
                </select>
              </div>
              <div style={{ flex: "1 1 15%" }}>
                <b>Date :</b><span style={{ color: "red" }}>*</span>
                <input type="date" name="wrk_date" value={formData.wrk_date} onChange={handleInputChange} className="form-control" />
              </div>
              <div style={{ flex: "1 1 20%" }}>
                <b>File to Upload :</b>
                <input type="file" ref={fileInputRef} className="form-control" accept=".jpg,.png,.jpeg,.pdf,.zip" />
                <div style={{ fontSize: "10px", marginTop: "5px" }}>
                  <b style={{ color: "red" }}>Note :</b> Only JPG, PNG, JPEG, PDF and ZIP files will be uploaded.
                </div>
              </div>
            </div>

            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <button className="btn btn-primary" onClick={handleSave} style={{ backgroundColor: "#337ab7", borderColor: "#2e6da4", padding: "6px 20px" }}>Save</button>
            </div>

            <div style={{ maxHeight: "400px", overflow: "auto" }}>
              <table className="table table-bordered table-striped" style={{ width: "100%", fontSize: "12px" }}>
                <thead style={{ backgroundColor: "#006699", color: "white" }}>
                  <tr>
                    <th>Sr No.</th>
                    <th>Id</th>
                    <th>Client Name</th>
                    <th>State Name</th>
                    <th>Branch Name</th>
                    <th>Type Of Image</th>
                    <th>Date</th>
                    <th>Image</th>
                  </tr>
                </thead>
                <tbody>
                  {records.map((r, i) => (
                    <tr key={r.id}>
                      <td>{i + 1}</td>
                      <td>{r.id}</td>
                      <td>{r.client_name || ""}</td>
                      <td>{r.state_name || ""}</td>
                      <td>{r.unit_name || r.unit_code}</td>
                      <td>{r.image_type}</td>
                      <td>{r.datecurrent ? new Date(r.datecurrent).toLocaleDateString("en-GB") : ""}</td>
                      <td style={{ textAlign: "center" }}>
                        {r.image_url ? (
                          <>
                            {isImage(r.image_name)
                              ? <img src={r.image_url} alt="Working" style={{ width: "50px", height: "50px", objectFit: "cover", marginBottom: "5px", cursor: "pointer" }} onClick={() => downloadImage(r.id)} />
                              : <span style={{ display: "inline-block", marginBottom: "5px", fontWeight: "bold" }}>{(r.image_name || "").split(".").pop()?.toUpperCase()}</span>}
                            <br />
                            <a style={{ color: "red", cursor: "pointer", textDecoration: "underline" }} onClick={() => downloadImage(r.id)}>Download</a>
                          </>
                        ) : "N/A"}
                      </td>
                    </tr>
                  ))}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", padding: "10px" }}>No images found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
