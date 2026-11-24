"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { getJSONStrict as apiGet, postJSON as apiPost, putJSON as apiPut, deleteJSON as apiDelete, responseMessage } from "@/lib/api/legacy-fetch";

const TD = "/api/hr/todo/";

export default function ToDoList() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("todo");
  const [todos, setTodos] = useState<any[]>([]);
  const [operationRows, setOperationRows] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    id: "",
    task_name: "",
    task_description: "",
    start_date: "",
    remind_till: "",
    reminder: "Select Frequency"
  });

  const [searchText, setSearchText] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");

  const taskNameRef = useRef<HTMLInputElement>(null);
  const taskDescRef = useRef<HTMLInputElement>(null);
  const startDateRef = useRef<HTMLInputElement>(null);
  const remindTillRef = useRef<HTMLInputElement>(null);
  const reminderRef = useRef<HTMLSelectElement>(null);

  const fetchTodos = async () => {
    setLoading(true);
    try {
      const res = await apiGet(TD);
      setTodos(Array.isArray(res) ? res : res.results || []);
    } catch (err: any) {
      alert("Error fetching ToDo List: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchOperation = async () => {
    try {
      const res = await apiGet(`/api/hr/todo/operation_schedule/`);
      setOperationRows(res?.results || []);
    } catch { setOperationRows([]); }
  };

  useEffect(() => {
    fetchTodos();
    fetchOperation();
  }, []);

  const AllowAlphabet1 = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const keyEntry = e.which || e.keyCode;
    if (((keyEntry >= 48) && (keyEntry <= 57)) || ((keyEntry >= 65) && (keyEntry <= 90)) || ((keyEntry >= 97) && (keyEntry <= 122)) || (keyEntry === 32) || keyEntry === 45 || (keyEntry === 8)) {
        return true;
    } else {
        e.preventDefault();
        return false;
    }
  };

  const isNumber = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const charCode = e.which ? e.which : e.keyCode;
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
        if (charCode === 46) {
            return true;
        }
        e.preventDefault();
        return false;
    }
    return true;
  };

  const validate = () => {
    if (formData.task_name === "") {
        alert("Please Enter the Task Name !!!");
        taskNameRef.current?.focus();
        return false;
    }
    if (formData.task_description === "") {
        alert("Please Enter Task Description !!!");
        taskDescRef.current?.focus();
        return false;
    }
    if (formData.start_date === "") {
        alert("Please Select Start Date !!!");
        startDateRef.current?.focus();
        return false;
    }
    if (formData.remind_till === "") {
        alert("Please Select Remind Till (Date) !!!");
        remindTillRef.current?.focus();
        return false;
    }
    if (formData.reminder === "Select Frequency") {
        alert("Please Select Reminder :  !!!");
        reminderRef.current?.focus();
        return false;
    }
    return true;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    if (!validate()) return;
    
    setLoading(true);
    try {
      const r = await apiPost(TD, formData);
      if (!r.ok) throw new Error(await responseMessage(r, "Record adding failed..."));
      alert("Record added successfully!!");
      handleClear();
      fetchTodos();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!formData.id) {
      alert("Please select a record to update.");
      return;
    }
    if (!validate()) return;
    
    setLoading(true);
    try {
      const r = await apiPut(`${TD}${formData.id}/`, formData);
      if (!r.ok) throw new Error(await responseMessage(r, "Record Updating Failed..."));
      alert("Record Updated Successfully...");
      handleClear();
      fetchTodos();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!formData.id) {
      alert("Please select a record to delete.");
      return;
    }
    if (!confirm("Are you sure you want to delete record?")) return;
    
    setLoading(true);
    try {
      const r = await apiDelete(`${TD}${formData.id}/`);
      if (!r.ok) throw new Error(await responseMessage(r, "Record deletion failed..."));
      alert("Record deleted successfully!!");
      handleClear();
      fetchTodos();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFormData({
      id: "",
      task_name: "",
      task_description: "",
      start_date: "",
      remind_till: "",
      reminder: "Select Frequency"
    });
  };

  // Legacy btn_search: LIKE %text% on Task_Name / Start_Date / Task_Description / Reminder
  const handleSearch = () => setAppliedSearch(searchText.trim().toLowerCase());
  const visibleTodos = todos.filter((t) => {
    if (!appliedSearch) return true;
    return [t.task_name, t.start_date, t.task_description, t.reminder]
      .some((v) => String(v ?? "").toLowerCase().includes(appliedSearch));
  });

  // Legacy btnexporttoexceldesignation_Click: TO DO LIST sheet with the 5 columns
  const handleExport = () => {
    const q = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [
      ["TO DO LIST"],
      [],
      ["Task_Name", "Task_Description", "Start_Date", "Remind_Till", "Reminder"],
      ...todos.map((t) => [t.task_name, t.task_description, t.start_date, t.remind_till, t.reminder]),
    ].map((r) => r.map(q).join(","));
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "ToDoList.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const handleSelect = (record: any) => {
    setFormData({
      id: record.id,
      task_name: record.task_name || "",
      task_description: record.task_description || "",
      start_date: record.start_date || "",
      remind_till: record.remind_till || "",
      reminder: record.reminder || "Select Frequency"
    });
  };

  return (
    <div className="container-fluid" style={{ maxWidth: "99%", margin: "0 auto", padding: "20px" }}>
      {loading && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(204, 204, 204, 0.7)", zIndex: 9999 }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>Loading...</div>
        </div>
      )}

      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ flex: "1", textAlign: "center", fontSize: "small", fontWeight: "bold" }}>
            TO DO LIST
          </div>
          <div style={{ textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); window.open("html/ToDoList.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }} style={{ color: "#fff" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>
        
        <div className="panel-body" style={{ padding: "15px" }}>
          <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "15px", marginBottom: "20px" }}>
            
            <ul className="nav nav-tabs" style={{ marginBottom: "15px", borderBottom: "1px solid #ddd" }}>
              <li className={activeTab === "todo" ? "active" : ""} style={{ display: "inline-block" }}>
                <a onClick={(e) => { e.preventDefault(); setActiveTab("todo"); }} style={{ cursor: "pointer", padding: "10px 15px", display: "block", backgroundColor: activeTab === "todo" ? "#fff" : "transparent", border: activeTab === "todo" ? "1px solid #ddd" : "none", borderBottomColor: activeTab === "todo" ? "transparent" : "#ddd" }}><b>To Do</b></a>
              </li>
              <li className={activeTab === "operation" ? "active" : ""} style={{ display: "inline-block" }}>
                <a onClick={(e) => { e.preventDefault(); setActiveTab("operation"); }} style={{ cursor: "pointer", padding: "10px 15px", display: "block", backgroundColor: activeTab === "operation" ? "#fff" : "transparent", border: activeTab === "operation" ? "1px solid #ddd" : "none", borderBottomColor: activeTab === "operation" ? "transparent" : "#ddd" }}><b>Operation To Do</b></a>
              </li>
            </ul>

            <div className="tab-content">
              {activeTab === "todo" && (
                <div>
                  <div style={{ display: "flex", gap: "8px", marginBottom: "10px", maxWidth: "500px" }}>
                    <input type="text" className="form-control" placeholder="Search ToDo List" value={searchText}
                      onChange={(e) => setSearchText(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }} />
                    <button className="btn btn-primary" onClick={handleSearch} style={{ backgroundColor: "#428BCA" }}>Search</button>
                  </div>
                  <div style={{ maxHeight: "300px", overflow: "auto", marginBottom: "20px" }}>
                    <table className="table table-bordered table-striped" style={{ width: "100%", fontSize: "12px" }}>
                      <thead style={{ backgroundColor: "#006699", color: "white" }}>
                        <tr>
                          <th>Action</th>
                          <th>ID</th>
                          <th>Task Name</th>
                          <th>Start Date</th>
                          <th>Task Description</th>
                          <th>Reminder</th>
                        </tr>
                      </thead>
                      <tbody>
                        {visibleTodos.map(t => (
                          <tr key={t.id}>
                            <td>
                              <button className="btn btn-xs btn-info" onClick={() => handleSelect(t)}>&gt;</button>
                            </td>
                            <td>{t.id}</td>
                            <td>{t.task_name}</td>
                            <td>{t.start_date}</td>
                            <td>{t.task_description}</td>
                            <td>{t.reminder}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="form-horizontal" style={{ maxWidth: "600px", margin: "0 auto" }}>
                    <div className="form-group" style={{ display: "flex", marginBottom: "15px", alignItems: "center" }}>
                      <label className="control-label" style={{ width: "150px", textAlign: "right", marginRight: "15px" }}><b>Task Name :</b></label>
                      <input type="text" name="task_name" value={formData.task_name} onChange={handleInputChange} onKeyPress={AllowAlphabet1} className="form-control" style={{ flex: 1 }} maxLength={30} ref={taskNameRef} />
                    </div>
                    <div className="form-group" style={{ display: "flex", marginBottom: "15px", alignItems: "center" }}>
                      <label className="control-label" style={{ width: "150px", textAlign: "right", marginRight: "15px" }}><b>Task Description :</b></label>
                      <input type="text" name="task_description" value={formData.task_description} onChange={handleInputChange} onKeyPress={AllowAlphabet1} className="form-control" style={{ flex: 1 }} maxLength={100} ref={taskDescRef} />
                    </div>
                    <div className="form-group" style={{ display: "flex", marginBottom: "15px", alignItems: "center" }}>
                      <label className="control-label" style={{ width: "150px", textAlign: "right", marginRight: "15px" }}><b>Start Date (YYYY-MM-DD) :</b></label>
                      <input type="date" name="start_date" value={formData.start_date} onChange={handleInputChange} className="form-control" style={{ flex: 1 }} ref={startDateRef} />
                    </div>
                    <div className="form-group" style={{ display: "flex", marginBottom: "15px", alignItems: "center" }}>
                      <label className="control-label" style={{ width: "150px", textAlign: "right", marginRight: "15px" }}><b>Remind Till (YYYY-MM-DD) :</b></label>
                      <input type="date" name="remind_till" value={formData.remind_till} onChange={handleInputChange} className="form-control" style={{ flex: 1 }} ref={remindTillRef} />
                    </div>
                    <div className="form-group" style={{ display: "flex", marginBottom: "15px", alignItems: "center" }}>
                      <label className="control-label" style={{ width: "150px", textAlign: "right", marginRight: "15px" }}><b>Reminder :</b></label>
                      <select name="reminder" value={formData.reminder} onChange={handleInputChange} className="form-control" style={{ flex: 1 }} ref={reminderRef}>
                        <option value="Select Frequency">Select Frequency</option>
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                        <option value="Quaterly">Quaterly</option>
                        <option value="Half Yearly">Half Yearly</option>
                        <option value="Yearly">Yearly</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ textAlign: "center", marginTop: "20px" }}>
                    {!formData.id && <button className="btn btn-primary" onClick={handleSave} style={{ marginRight: "10px", padding: "6px 20px" }}>Save</button>}
                    {formData.id && <button className="btn btn-primary" onClick={handleUpdate} style={{ marginRight: "10px", padding: "6px 20px" }}>Update</button>}
                    {formData.id && <button className="btn btn-primary" onClick={handleDelete} style={{ marginRight: "10px", padding: "6px 20px" }}>Delete</button>}
                    <button className="btn btn-default" onClick={handleClear} style={{ marginRight: "10px", padding: "6px 20px" }}>Clear</button>
                    <button className="btn btn-default" onClick={handleExport} style={{ marginRight: "10px", padding: "6px 20px" }}>Export To Excel</button>
                    <button className="btn btn-danger" onClick={() => window.location.href = '/'} style={{ padding: "6px 20px" }}>Close</button>
                  </div>
                </div>
              )}

              {activeTab === "operation" && (
                <div>
                  <table className="table table-bordered table-striped" style={{ width: "100%", fontSize: "12px" }}>
                    <thead style={{ backgroundColor: "#507CD1", color: "white" }}>
                      <tr>
                        <th>Sr No.</th>
                        <th>CLIENT</th>
                        <th>STATE</th>
                        <th>UNIT CODE</th>
                        <th>DATE</th>
                        <th>START TIME</th>
                        <th>END TIME</th>
                      </tr>
                    </thead>
                    <tbody>
                      {operationRows.map((r, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td>{r.client_code}</td>
                          <td>{r.state}</td>
                          <td>{r.unit_code}</td>
                          <td>{r.operation_date}</td>
                          <td>{r.start_time}</td>
                          <td>{r.end_time}</td>
                        </tr>
                      ))}
                      {operationRows.length === 0 && (
                        <tr><td colSpan={7} style={{ textAlign: "center" }}>No records found.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
