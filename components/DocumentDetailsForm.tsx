"use client";
import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import { getJSON, getJSONStrict, mk, patchJSON, rm, responseMessage } from "@/lib/api/legacy-fetch";

// Legacy Document_Details.aspx: a read-only Sr. No., employee drop-down, Reporting To (filled from the
// employee), the fixed document list, issue / end dates, Save / Update / Delete / Cancel / Close and a
// click-to-select grid. Messages are the legacy alerts verbatim.
const B = "/api/hr/document-details";
const MENU = "Android Document";
const DOC_LIST = ["Uniform", "Shoes", "Police Varification Document", "Present Address Proof"];

type Row = { id: number; sr_no: string; emp_code: string; emp_name: string; reporting_to: string; document_type: string; start_date: string; end_date: string };
type Emp = { emp_code: string; emp_name: string };

const toIso = (v: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(v || "");
  return m ? `${m[3]}-${m[2]}-${m[1]}` : (/^\d{4}-\d{2}-\d{2}$/.test(v || "") ? v : "");
};
const toDmy = (v: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
};

function levelFor(me: Me | null): number {
  if (!me) return 0;
  if (me.is_staff) return 4;
  const map: Record<string, number> = { R: 1, U: 2, C: 3, D: 4 };
  return me.permissions.filter((p) => p.menu.trim() === MENU && !p.needs_review)
    .reduce((mx, p) => Math.max(mx, map[p.permission] ?? 0), 0);
}

export default function DocumentDetailsForm() {
  const [me, setMe] = useState<Me | null>(null);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [selected, setSelected] = useState<Row | null>(null);
  const [srNo, setSrNo] = useState("");
  const [emp, setEmp] = useState("");
  const [rep, setRep] = useState("");
  const [doc, setDoc] = useState("Select");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);

  const level = levelFor(me);
  const canCreate = level >= 3, canUpdate = level >= 2, canDelete = !!me?.is_staff || level >= 4;

  const loadGrid = useCallback(async () => {
    const d = await getJSON<{ results: Row[] }>(`${B}/?page_size=all`);
    setRows(d?.results ?? []);
  }, []);
  const loadSr = useCallback(async () => {
    const d = await getJSON<{ sr_no: string }>(`${B}/next-sr-no/`);
    setSrNo(d?.sr_no ?? "");
  }, []);
  const clear = useCallback(() => {
    setSelected(null); setEmp(""); setRep(""); setDoc("Select"); setStart(""); setEnd("");
    loadSr();
  }, [loadSr]);

  useEffect(() => {
    getMe().then(setMe);
    getJSON<{ employees: Emp[] }>("/api/hr/employees/lookup/").then((d) => setEmps(d?.employees ?? []));
    loadGrid(); loadSr();
  }, [loadGrid, loadSr]);

  /* legacy reporting_to_drtails(): Reporting To comes from the chosen employee */
  const pickEmp = async (code: string) => {
    setEmp(code);
    if (!code) { setRep(""); return; }
    const d = await getJSON<{ reporting_to: string }>(`${B}/reporting-to/?emp_code=${encodeURIComponent(code)}`);
    setRep(d?.reporting_to ?? "");
  };

  const select = (r: Row) => {
    setSelected(r); setSrNo(r.sr_no); setEmp(r.emp_code); setRep(r.reporting_to);
    setDoc(r.document_type || "Select"); setStart(toIso(r.start_date)); setEnd(toIso(r.end_date));
  };

  const body = () => ({
    emp_code: emp, reporting_to: rep, document_type: doc === "Select" ? "" : doc,
    start_date: toDmy(start), end_date: toDmy(end),
  });
  const valid = () => {
    if (!emp) { alert("Please Select Employee"); return false; }
    if (doc === "Select") { alert("Please Select Document Type"); return false; }
    return true;
  };

  const save = async () => {
    if (!valid()) return;
    setBusy(true);
    try {
      const r = await mk(`${B}/`, body());
      if (r.ok) { alert("Record added successfully!!"); clear(); loadGrid(); }
      else alert(await responseMessage(r, "Record adding failed!!"));
    } finally { setBusy(false); }
  };
  const update = async () => {
    if (!selected || !valid()) return;
    setBusy(true);
    try {
      const r = await patchJSON(`${B}/${selected.id}/`, body());
      if (r.ok) { alert("Record Updated Successfully..."); clear(); loadGrid(); }
      else alert(await responseMessage(r, "Record Updating Failed..."));
    } finally { setBusy(false); }
  };
  const del = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const r = await rm(`${B}/${selected.id}/`);
      if (r.ok) { alert("Record deleted successfully !!"); clear(); loadGrid(); }
      else alert(await responseMessage(r, "Record deletion failed !!"));
    } finally { setBusy(false); }
  };

  void getJSONStrict;
  return (
    <div className="container-fluid">
      <div className="panel panel-primary">
        <div className="panel-heading text-center text-uppercase"><b>DOCUMENT DETAILS</b></div>
        <div className="panel-body">
          <div className="row">
            <div className="col-sm-2 col-xs-12" />
            <div className="col-sm-2 col-xs-12">
              <b>Sr. No. :</b>
              <input className="form-control text_box" readOnly value={srNo} />
            </div>
            <div className="col-sm-2 col-xs-12">
              <b>Employee Name :</b>
              <select className="form-control text_box" value={emp} onChange={(e) => pickEmp(e.target.value)}>
                <option value="">Select</option>
                {emps.map((e) => <option key={e.emp_code} value={e.emp_code}>{e.emp_name}</option>)}
              </select>
            </div>
            <div className="col-sm-2 col-xs-12">
              <b>Reporting To :</b>
              <input className="form-control text_box" value={rep} onChange={(e) => setRep(e.target.value)} />
            </div>
          </div>
          <br />
          <div className="row">
            <div className="col-sm-2 col-xs-12" />
            <div className="col-sm-2 col-xs-12">
              <b>Document List :</b>
              <select className="form-control text_box" value={doc} onChange={(e) => setDoc(e.target.value)}>
                <option value="Select">Select</option>
                {DOC_LIST.map((d) => <option key={d} value={d}>{d}</option>)}
                {doc !== "Select" && !DOC_LIST.includes(doc) && <option value={doc}>{doc}</option>}
              </select>
            </div>
            <div className="col-sm-2 col-xs-12">
              <b>Issu Date :</b>
              <input type="date" className="form-control" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div className="col-sm-2 col-xs-12">
              <b>End Date :</b>
              <input type="date" className="form-control" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <br />
          <div style={{ overflow: "auto", maxHeight: 320 }}>
            <table className="table table-bordered">
              <thead>
                <tr><th>Sr. No.</th><th>Employee</th><th>Reporting To</th><th>Document Type</th><th>Issue Date</th><th>End Date</th></tr>
              </thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center" }}>No records</td></tr>}
                {rows.map((r) => (
                  <tr key={r.id} onClick={() => select(r)} style={{ cursor: "pointer", background: selected?.id === r.id ? "#d9edf7" : undefined }}>
                    <td>{r.sr_no}</td><td>{r.emp_code}{r.emp_name ? ` - ${r.emp_name}` : ""}</td><td>{r.reporting_to}</td>
                    <td>{r.document_type}</td><td>{r.start_date}</td><td>{r.end_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row text-center">
            {!selected && canCreate && <button className="btn btn-primary" disabled={busy} onClick={save}>Save</button>}{" "}
            {selected && canUpdate && <button className="btn btn-primary" disabled={busy} onClick={update}>Update</button>}{" "}
            {selected && canDelete && <button className="btn btn-primary" disabled={busy} onClick={del}>Delete</button>}{" "}
            <button className="btn btn-primary" onClick={clear}>Cancel</button>{" "}
            <Link href="/" className="btn btn-danger">Close</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
