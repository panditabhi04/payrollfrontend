"use client";
import React, { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getJSON, getJSONStrict, mk, patchJSON, rm, responseMessage } from "@/lib/api/legacy-fetch";

// Legacy Shiftassign.aspx: Shift Name + Shift From / Shift To (h:mm AM/PM), the
// "Send Emails to Employees" checkbox (applies at once to every shift of the company/unit),
// Add / Edit / Delete / New / Close and a clickable shift grid.
const API = "/api/masters/shifts/";
interface Shift { id: number; shift_name: string; shift_from: string; shift_to: string }

// legacy onblur validation(): any entered time is shown as "h:mm AM/PM"
export function to12h(v: string): string {
  const t = (v || "").trim().toUpperCase();
  const m = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)?$/);
  if (!m) return v;
  let hh = parseInt(m[1], 10); const mm = m[2]; let ap = m[3];
  if (!ap) { ap = hh >= 12 ? "PM" : "AM"; hh = hh % 12 || 12; }
  const pad = hh < 10 ? "0" + hh : String(hh);
  return `${pad}:${mm} ${ap}`;
}

export default function ShiftMaster() {
  const router = useRouter();
  const [rows, setRows] = useState<Shift[]>([]);
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [sendEmail, setSendEmail] = useState(false);
  const [selected, setSelected] = useState<Shift | null>(null);

  const load = useCallback(async () => {
    const d = await getJSON<{ results: Shift[] }>(API + "?page_size=1000");
    setRows(d?.results ?? []);
    const f = await getJSON<{ checked: boolean }>(API + "send-email/");
    setSendEmail(!!f?.checked);
    setName(""); setFrom(""); setTo(""); setSelected(null);
  }, []);
  useEffect(() => { load(); }, [load]);

  const fail = async (r: Response, fallback: string) => {
    const msg = await responseMessage(r, fallback);
    alert(msg);
  };

  const add = async () => {
    const r = await mk(API, { shift_name: name, shift_from: from, shift_to: to });
    if (r.ok) alert("Record added successfully!!"); else await fail(r, "Record adding failed...");
    await load();
  };
  const edit = async () => {
    if (!selected) return;
    const r = await patchJSON(`${API}${selected.id}/`, { shift_name: name, shift_from: from, shift_to: to });
    if (r.ok) alert("Record updated successfully!!"); else await fail(r, "Record updation failed!!");
    await load();
  };
  const del = async () => {
    if (!selected) return;
    const r = await rm(`${API}${selected.id}/`);
    if (r.ok) alert("Record deleted successfully!!"); else await fail(r, "Record deletion failed!!");
    await load();
  };
  const toggleEmail = async (checked: boolean) => {
    setSendEmail(checked);
    const r = await mk(API + "send-email/", { checked });
    if (!r.ok) { setSendEmail(!checked); await fail(r, "Request failed."); }
  };
  const pick = (s: Shift) => { setSelected(s); setName(s.shift_name); setFrom(to12h(s.shift_from)); setTo(to12h(s.shift_to)); };

  return (
    <div className="container-fluid">
      <div className="panel panel-primary">
        <div className="panel-heading" style={{ textAlign: "center", fontWeight: "bold", textTransform: "uppercase", fontSize: "small" }}>Shift Creation</div>
        <div className="panel-body">
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="col-md-3"><label>Shift Name <span style={{ color: "red" }}>*</span></label>
              <input className="form-control" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} /></div>
            <div className="col-md-2"><label>Shift From <span style={{ color: "red" }}>*</span></label>
              <input className="form-control" value={from} placeholder="hh:mm AM/PM" onChange={(e) => setFrom(e.target.value)} onBlur={() => setFrom(to12h(from))} /></div>
            <div className="col-md-2"><label>Shift To <span style={{ color: "red" }}>*</span></label>
              <input className="form-control" value={to} placeholder="hh:mm AM/PM" onChange={(e) => setTo(e.target.value)} onBlur={() => setTo(to12h(to))} /></div>
            <div className="col-md-3" style={{ paddingTop: 25 }}>
              <label><input type="checkbox" checked={sendEmail} onChange={(e) => toggleEmail(e.target.checked)} /> Send Emails to Employees</label>
            </div>
          </div>
          <div style={{ marginBottom: 15 }}>
            {!selected && <button type="button" className="btn btn-primary" onClick={add}>Add</button>}{" "}
            {selected && <button type="button" className="btn btn-primary" onClick={edit}>Edit</button>}{" "}
            {selected && <button type="button" className="btn btn-danger" onClick={del}>Delete</button>}{" "}
            <button type="button" className="btn btn-default" onClick={() => { setSelected(null); setName(""); setFrom(""); setTo(""); }}>New</button>{" "}
            <button type="button" className="btn btn-danger" onClick={() => router.push("/")}>Close</button>
          </div>
          <table className="table table-striped table-bordered table-hover">
            <thead style={{ background: "#224173", color: "white" }}>
              <tr><th>Shift Name</th><th>Shift From</th><th>Shift To</th></tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} onClick={() => pick(s)} style={{ cursor: "pointer" }}>
                  <td>{s.shift_name}</td><td>{to12h(s.shift_from)}</td><td>{to12h(s.shift_to)}</td>
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center" }}>No Records Found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
