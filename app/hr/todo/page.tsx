"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getJSON, mk, patchJSON, rm } from "@/lib/api/legacy-fetch";
import { API_BASE_URL, drfErrorText } from "@/lib/api/client";
import { menuLevel } from "@/lib/menuLevel";

// ToDoList.aspx - table pay_to_do_list (company-wide list). Tabs: "To Do" and "Operation To Do".
// Buttons follow Page_Load getaccess(): R read only; U adds Update; C adds Save; D adds Delete + Export.
const TD = "/api/hr/todo/";
const MENU = "To Do List";
const FREQ = ["Select Frequency", "Daily", "Weekly", "Monthly", "Quaterly", "Half Yearly", "Yearly"];

interface Item { id: number; task_name: string; task_description: string; start_date?: string; remind_till?: string; reminder?: string; }
interface Visit { client_code: string; state: string; unit_code: string; operation_date: string; start_time: string; end_time: string; }
const blank = () => ({ task_name: "", task_description: "", start_date: "", remind_till: "", reminder: "Select Frequency" });

/** dd/mm/yyyy (grid text) -> yyyy-mm-dd (date input) */
const toIso = (s?: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};
/** AllowAlphabet1(): letters, digits, space and '-' only */
const clean = (v: string) => v.replace(/[^0-9A-Za-z \-]/g, "");

async function errMsg(r: Response, fallback: string) {
  const d = await r.json().catch(() => null);
  return drfErrorText(d) || fallback;
}

export default function ToDoPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"home" | "menu1">("home");
  const [level, setLevel] = useState(0);
  const [rows, setRows] = useState<Item[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [q, setQ] = useState("");
  const [form, setForm] = useState(blank());
  const [sel, setSel] = useState<number | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const load = useCallback(async (text = "") => {
    const d = await getJSON<{ results: Item[] } | Item[]>(`${TD}${text ? `?q=${encodeURIComponent(text)}` : ""}`);
    setRows((Array.isArray(d) ? d : d?.results ?? []) as Item[]);
  }, []);
  useEffect(() => {
    menuLevel(MENU).then(setLevel);
    load();
    getJSON<{ results: Visit[] }>(`${TD}operation_schedule/`).then((d) => setVisits(d?.results ?? []));
  }, [load]);

  const clear = () => { setForm(blank()); setSel(null); };

  // validate() in the aspx, same order
  const validate = () => {
    if (!form.task_name) { alert("Please Enter the Task Name !!!"); return false; }
    if (!form.task_description) { alert("Please Enter Task Description !!!"); return false; }
    if (!form.start_date) { alert("Please Select Start Date !!!"); return false; }
    if (!form.remind_till) { alert("Please Select Remind Till (Date) !!!"); return false; }
    if (form.reminder === "Select Frequency") { alert("Please Select Reminder :  !!!"); return false; }
    return true;
  };

  const save = async () => {
    if (!validate()) return;
    const r = await mk(TD, form);
    if (r.ok) { alert("Record added successfully!!"); clear(); load(q); }
    else { alert(await errMsg(r, "Record adding failed...")); }
  };
  const update = async () => {
    if (!validate() || sel == null) return;
    const r = await patchJSON(`${TD}${sel}/`, form);
    if (r.ok) { alert("Record Updated Successfully..."); clear(); load(q); }
    else { alert(await errMsg(r, "Record Updating Failed...")); }
  };
  const del = async () => {
    if (sel == null) return;
    if (!window.confirm("Are you sure you want to delete record?")) return;
    const r = await rm(`${TD}${sel}/`);
    if (r.ok) { alert("Record deleted successfully!!"); clear(); load(q); }
    else { alert(await errMsg(r, "Record deletion failed...")); }
  };
  const pick = async (it: Item) => {
    // SearchGridView_SelectedIndexChanged: load the row into the form
    setSel(it.id);
    setForm({
      task_name: it.task_name || "", task_description: it.task_description || "",
      start_date: toIso(it.start_date), remind_till: toIso(it.remind_till),
      reminder: it.reminder || "Select Frequency",
    });
  };
  const exportXls = async () => {
    const r = await fetch(`${API_BASE_URL}${TD}export/`, { credentials: "include" });
    if (!r.ok) { alert(await errMsg(r, "Export failed")); return; }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "TO_DO_LIST.xlsx";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const canAdd = level >= 3, canEdit = level >= 2, canDelete = level >= 4, canSearch = level >= 2;
  const selected = sel != null;

  return (
    <div className="container-fluid">
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: 4 }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px" }}>
          <div className="text-center text-uppercase" style={{ fontSize: "small" }}><b>To Do List</b></div>
        </div>
        <div className="panel-body" style={{ padding: 15 }}>
          <ul className="nav nav-tabs" style={{ background: "#f3f1fe", display: "flex", gap: 4, listStyle: "none", paddingLeft: 0, borderBottom: "1px solid #ddd" }}>
            <li className={tab === "home" ? "active" : ""}><a href="#" onClick={(e) => { e.preventDefault(); setTab("home"); }} style={{ padding: "8px 14px", display: "block" }}><b>To Do</b></a></li>
            <li className={tab === "menu1" ? "active" : ""}><a href="#" onClick={(e) => { e.preventDefault(); setTab("menu1"); }} style={{ padding: "8px 14px", display: "block" }}><b>Operation To Do</b></a></li>
          </ul>

          {tab === "home" && (
            <div style={{ paddingTop: 20 }}>
              <div className="row">
                <div className="col-sm-4" />
                <div className="col-sm-3 text-left" style={{ marginLeft: 15 }}>
                  <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search ToDo List" className="form-control text_box" />
                </div>
                <div className="col-sm-2">
                  {canSearch && <button className="btn btn-primary" style={{ backgroundColor: "#428BCA" }} onClick={() => load(q)}>Search</button>}
                </div>
              </div>
              <br />
              <table className="table dt-grid" style={{ width: "100%" }}>
                <thead><tr><th></th><th>Task Name</th><th>Start Date</th><th>Task Description</th><th>Reminder</th></tr></thead>
                <tbody>
                  {rows.map((it) => (
                    <tr key={it.id} onClick={() => pick(it)} className={sel === it.id ? "dt-selected" : ""} style={{ cursor: "pointer" }}>
                      <td>&gt;</td><td>{it.task_name}</td><td>{it.start_date}</td><td>{it.task_description}</td><td>{it.reminder}</td>
                    </tr>
                  ))}
                  {rows.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center" }}>No Record Found</td></tr>}
                </tbody>
              </table>
              <br />
              {[
                ["Task Name :", <input key="n" className="form-control" maxLength={30} value={form.task_name} onChange={(e) => setForm({ ...form, task_name: clean(e.target.value) })} />],
                ["Task Description :", <input key="d" className="form-control" maxLength={50} value={form.task_description} onChange={(e) => setForm({ ...form, task_description: clean(e.target.value) })} />],
                ["Start Date :", <input key="s" type="date" min={today} className="form-control" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value, remind_till: form.remind_till && form.remind_till < e.target.value ? "" : form.remind_till })} />],
                ["Remind Till :", <input key="r" type="date" min={form.start_date || today} className="form-control" value={form.remind_till} onChange={(e) => setForm({ ...form, remind_till: e.target.value })} />],
                ["Reminder :", (
                  <select key="f" className="form-control" value={form.reminder} onChange={(e) => setForm({ ...form, reminder: e.target.value })}>
                    {FREQ.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>)],
              ].map(([label, ctl], i) => (
                <div key={i}>
                  <div className="row">
                    <div className="col-sm-3" />
                    <div className="col-sm-2 text-right"><b>{label}</b></div>
                    <div className="col-sm-3">{ctl}</div>
                  </div>
                  <br />
                </div>
              ))}
              <div className="row text-center">
                {!selected && canAdd && <button className="btn btn-primary" onClick={save} style={{ marginRight: 8 }}> Save </button>}
                {selected && canEdit && <button className="btn btn-primary" onClick={update} style={{ marginRight: 8 }}> Update </button>}
                {selected && canDelete && <button className="btn btn-primary" onClick={del} style={{ marginRight: 8 }}> Delete </button>}
                <button className="btn btn-primary" onClick={clear} style={{ marginRight: 8 }}> Clear </button>
                {canDelete && <button className="btn btn-large" onClick={exportXls} style={{ marginRight: 8 }}>Export To Excel</button>}
                <button className="btn btn-danger" onClick={() => router.push("/Home")}>Close</button>
              </div>
            </div>
          )}

          {tab === "menu1" && (
            <div style={{ paddingTop: 20 }}>
              <table className="table dt-grid" style={{ width: "100%" }}>
                <thead><tr><th>Sr No.</th><th>CLLIENT</th><th>STATE</th><th>UNIT CODE</th><th>DATE</th><th>START TIME</th><th>END TIME</th></tr></thead>
                <tbody>
                  {visits.map((v, i) => (
                    <tr key={i}>
                      <td>{i + 1}</td><td>{v.client_code}</td><td>{v.state}</td><td>{v.unit_code}</td>
                      <td>{v.operation_date}</td><td>{v.start_time}</td><td>{v.end_time}</td>
                    </tr>
                  ))}
                  {visits.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center" }}>No Record Found</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
