"use client";
// 1:1 port of cash_voucher1.aspx ("Cash Voucher") — requester create + self-approve + edit/delete
// + own-voucher grid + report. (The finance payment screen finance_dept.aspx lives at /finance-dept.)
import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { getJSON, mk, upload } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";
import CashVoucherApprovals from "@/components/CashVoucherApprovals";
import { createItem, updateItem, deleteItem } from "@/lib/api/crud";

const B = "/api/transactions/cash-vouchers";
const DEBITED = [
  { v: "0", t: "Select" },
  { v: "OFFICE Expenses", t: "OFFICE EXPENSES" },
  { v: "LEGAL EXPENSES", t: "LEGAL EXPENSES" },
  { v: "COMPUTER_PRINTER EXPENSES", t: "COMPUTER_PRINTER EXPENSES" },
  { v: "TRAVELLING EXPENSES", t: "TRAVELLING EXPENSES" },
  { v: "FOOD AND REFRESHMENT EXPENSES", t: "FOOD AND REFRESHMENT EXPENSES" },
  { v: "POSTAGE AND TELEGRAM EXPENSES", t: "POSTAGE AND TELEGRAM EXPENSES" },
  { v: "OTHERS", t: "OTHERS" },
];
const REJECTED = new Set(["3", "5", "7"]);

interface Row {
  id: number; cash_rs: number; receiver_name: string; request_date: string; narration: string;
  debited_to: string; status: string; status_label: string; rejection_reason: string;
  soft_copy_file: string;
}

const inp: React.CSSProperties = { width: "100%", height: "34px", borderRadius: "4px", border: "1px solid #ccc" };

export default function CashVoucherPage() {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [receiver, setReceiver] = useState("");
  const [debited, setDebited] = useState("0");
  const [narration, setNarration] = useState("");
  const [fileName, setFileName] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const d = await getJSON<{ results?: Row[] } | Row[]>(`${B}/?page_size=all`).catch(() => null);
    setRows(Array.isArray(d) ? d : (d?.results ?? []));
  }, []);
  useEffect(() => { load(); }, [load]);

  const clear = () => {
    setAmount(""); setDate(""); setReceiver(""); setDebited("0"); setNarration(""); setFileName(""); setProofFile(null);
    setEditId(null);
  };

  const validate = (): string | null => {
    if (!amount.trim()) return "Please Enter Amount";
    if (!date.trim()) return "Please Select Date";
    if (!receiver.trim()) return "Please Enter Receiver Name";
    if (debited === "0") return "Please Select Debited Reason From List";
    if (!narration.trim()) return "Please write narration";
    return null;
  };

  const body_override = { name: "" };
  const body = () => ({
    cash_rs: amount, request_date: date, receiver_name: receiver,
    debited_to: debited, narration, soft_copy_file: body_override.name || fileName,
  });

  const save = async () => {
    const e = validate(); if (e) { alert(e); return; }
    // The proof is uploaded as a real file (multipart); only the stored name goes into the voucher.
    if (proofFile) {
      const n = proofFile.name.toLowerCase();
      if (![".jpg", ".jpeg", ".png", ".pdf", ".zip"].some((x) => n.endsWith(x))) { alert("Please Upload PNG,PDF,JPEG,ZIP File... !!!"); return; }
      const fd = new FormData();
      fd.append("file", proofFile);
      const up = await upload(`${B}/upload-proof/`, fd);
      if (!up.ok) {
        const d = await up.json().catch(() => null) as any;
        alert(Array.isArray(d) ? d.join(" ") : (d?.detail || "Attachment File Cannot Be Uploaded !!!"));
        return;
      }
      const ub = await up.json();
      body_override.name = ub.file_name;
    }
    const r = editId == null ? await createItem(B, body()) : await updateItem(B, editId, body());
    if (r.ok) {
      alert(editId == null ? "Record Added Successfully... !!!" : "Update Successfully !!");
      setMsg(editId == null ? "Record Added Successfully... !!!" : "Update Successfully !!");
      clear(); load();
    } else {
      const d = r.data as { detail?: string } | string;
      alert(typeof d === "string" ? d : (d?.detail || "Save failed"));
    }
  };

  const edit = (row: Row) => {
    setEditId(row.id); setAmount(String(row.cash_rs)); setDate((row.request_date || "").slice(0, 10));
    setReceiver(row.receiver_name || ""); setDebited(row.debited_to || "0"); setNarration(row.narration || "");
    setFileName(row.soft_copy_file || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const del = async (row: Row) => {
    if (!confirm("Are you sure you want to delete this Record?")) return;
    const r = await deleteItem(B, row.id);
    if (r.ok) { setMsg("Record Deleted Successfully... !!!"); load(); }
    else { const d = r.data as { detail?: string }; alert(d?.detail || "Delete failed"); }
  };

  const toggle = (id: number) => {
    setSel((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const approve = async () => {
    if (!confirm("Are you Sure You Want to Approve This Record")) return;
    const ids = rows.filter((r) => sel.has(r.id) && String(r.status) === "0").map((r) => r.id);
    if (ids.length === 0) { alert("Please select atleast one Record "); return; }
    let ok = 0;
    for (const id of ids) { const r = await mk(`${B}/${id}/self_approve/`, {}); if (r.ok) ok++; }
    setMsg(ok > 0 ? " Record Approved Successfully ... !!!" : ""); setSel(new Set()); load();
  };

  const report = async () => {
    // Legacy exports EVERY voucher (status 0..8), not just the grid rows shown here.
    const d = await getJSON<{ results?: Array<Record<string, unknown>> }>(`${B}/report/`).catch(() => null);
    const all = d?.results ?? [];
    if (all.length === 0) { alert("This Report is only for R&M"); return; }
    const head = ["SR NO.", "Request Date", "narration", "Receiver Name", "Amount", "Debited TO", "Status", "Rejection Reason"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = all.map((r, i) => [i + 1, r.request_date, r.narration, r.receiver_name, r.cash_rs, r.debited_to, r.status_label, r.rejection_reason].map(esc).join(","));
    const csv = [head.map(esc).join(","), ...lines].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["﻿" + csv], { type: "application/vnd.ms-excel" }));
    a.download = "Cash_Voucher_Report.xls"; document.body.appendChild(a); a.click(); a.remove();
  };

  return (
    <div className="container-fluid">
      <div className="panel panel-primary" style={{ border: "1px solid #337ab7", borderRadius: "4px", backgroundColor: "#fff" }}>
        <div className="panel-heading" style={{ backgroundColor: "#337ab7", color: "#fff" }}>
          <div className="row">
            <div className="col-sm-1"></div>
            <div className="col-sm-9"><div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase"><b>Cash Voucher</b></div></div>
            <div className="col-sm-2 text-right">
              <Link href="#" onClick={(e) => { e.preventDefault(); window.open("/html/cash_voucher1.html", "popUpWindow", "height=500,width=600,scrollbars=yes"); }}>
                <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
              </Link>
            </div>
          </div>
        </div>

        <div className="panel-body">
          {msg && <div style={{ color: "green", fontWeight: "bold", textAlign: "center", marginBottom: 10 }}>{msg}</div>}
          <div style={{ background: "#f3f1fe", borderRadius: "10px", border: "1px solid #e2e2dd", padding: "15px" }}>
            <div className="row" style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end" }}>
              <div style={{ flex: "1 1 160px" }}>
                <b>Amount</b><span style={{ color: "red" }}> * </span>
                <input className="form-control" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} style={inp} />
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <b>Date :</b><span style={{ color: "red" }}>*</span>
                <input type="date" className="form-control" min={editId == null ? new Date().toLocaleDateString("en-CA") : undefined} value={date} onChange={(e) => setDate(e.target.value)} style={inp} />
              </div>
              <div style={{ flex: "1 1 160px" }}>
                <b>Name of receiver</b><span style={{ color: "red" }}> * </span>
                <input className="form-control" maxLength={50} value={receiver} onChange={(e) => setReceiver(e.target.value.replace(/[^a-zA-Z ]/g, ""))} style={inp} />
              </div>
              <div style={{ flex: "1 1 180px" }}>
                <b>Debited To</b><span style={{ color: "red" }}>*</span>
                <select className="form-control" value={debited} onChange={(e) => setDebited(e.target.value)} style={inp}>
                  {DEBITED.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                </select>
              </div>
              <div style={{ flex: "1 1 180px" }}>
                <b>Narration</b><span style={{ color: "red" }}> * </span>
                <textarea className="form-control" maxLength={300} value={narration} onChange={(e) => setNarration(e.target.value)} style={{ ...inp, height: "60px" }} />
              </div>
              <div style={{ flex: "1 1 200px" }}>
                <b>File to Upload :</b>
                <input type="file" accept=".jpg,.jpeg,.png,.pdf,.zip" className="form-control" onChange={(e) => { setProofFile(e.target.files?.[0] ?? null); }} />
                {fileName && !proofFile && <span style={{ fontSize: "11px" }}>Current file: {fileName}</span>}
                <span style={{ color: "#f00", fontSize: "11px" }}><b>Note :</b> Only JPG, PNG, JPEG, PDF and ZIP files will be uploaded.</span>
              </div>
            </div>
            <div className="row text-center" style={{ marginTop: "15px" }}>
              <button className="btn btn-primary" onClick={save}>{editId == null ? "Save" : " Update "}</button>{" "}
              <Link href="/" className="btn btn-danger" style={{ textDecoration: "none" }}>Close</Link>
            </div>
          </div>

          <br />
          <div style={{ overflowX: "auto" }}>
            <table className="table table-bordered table-striped" style={{ width: "100%", background: "#fff" }}>
              <thead style={{ background: "#006699", color: "white" }}>
                <tr>
                  <th>Delete</th><th>SELECT</th><th>Sr No.</th><th>Id</th><th>Amount</th><th>Receiver Name</th>
                  <th>Request Date</th><th>Narration</th><th>Debited To</th><th>Status</th>
                  <th>Image</th><th>Edit</th><th>reason Of rejection</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id}>
                    <td style={{ textAlign: "center" }}>{String(r.status) === "0"
                      ? <button className="btn btn-danger btn-xs" onClick={() => del(r)}>✕</button> : ""}</td>
                    <td style={{ textAlign: "center" }}>{String(r.status) === "0"
                      ? <input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} /> : ""}</td>
                    <td>{i + 1}</td><td>{r.id}</td><td>{r.cash_rs}</td><td>{r.receiver_name}</td>
                    <td>{r.request_date}</td><td>{r.narration}</td><td>{r.debited_to}</td><td>{r.status_label}</td>
                    <td style={{ textAlign: "center" }}>
                      {r.soft_copy_file
                        ? <a href={`${API_BASE_URL}${B}/${r.id}/proof/`} target="_blank" rel="noreferrer" style={{ color: "red" }}>Download</a>
                        : ""}
                    </td>
                    <td style={{ textAlign: "center" }}>{REJECTED.has(String(r.status))
                      ? <button className="btn btn-primary btn-xs" onClick={() => edit(r)}>Edit</button> : ""}</td>
                    <td>{r.rejection_reason}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={13} style={{ textAlign: "center", color: "#777", padding: "10px" }}>No records</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="row text-center" style={{ marginBottom: "10px" }}>
            <button className="btn btn-primary" onClick={approve}>Approve</button>{" "}
            <button className="btn btn-large btn-default" onClick={report}>Report</button>
          </div>
          <CashVoucherApprovals />
        </div>
      </div>
    </div>
  );
}
