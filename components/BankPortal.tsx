"use client";
/* =====================================================================
 * Balance Sheet Accounting — 1:1 port of balance_sheet_accounting.aspx.
 * Header "Balance Sheet Accounting". 4 tabs: Create Group |
 * Upload Bank statement | Bank Receipt | PO/Purches Bill (sic).
 * Exact labels/validations/grids/exports (csv/print/copy/colvis +
 * full_numbers pagination). Backend: /api/transactions/bank-portal/*.
 * Dates dd/mm/yyyy (month boxes mm/yy).
 * ===================================================================== */
import React, { useEffect, useState } from "react";
import { getJSON, mk, upload } from "@/lib/api/legacy-fetch";
import { API_BASE_URL, apiGet } from "@/lib/api/client";

const BASE = "/api/transactions/bank-portal";
const SEL = "Select";
const ALL = "ALL";

type Row = Record<string, any>;
type Opt = { v: string; t: string };

function Msg({ text, ok }: { text: string; ok: boolean }) {
  if (!text) return null;
  return (
    <div style={{ margin: "0 0 10px", padding: "6px 12px", borderRadius: 4, fontSize: 12,
      color: ok ? "#2e7d32" : "#c62828", background: ok ? "#e8f5e9" : "#ffebee",
      border: `1px solid ${ok ? "#a5d6a7" : "#ef9a9a"}` }}>{text}</div>
  );
}
function val(r: Row, name: string): any {
  if (r[name] !== undefined && r[name] !== null) return r[name];
  const want = name.toLowerCase();
  for (const k of Object.keys(r)) {
    if (k.toLowerCase() === want) return (r as Row)[k];
  }
  return "";
}
async function errText(r: Response, fallback: string) {
  const e = await r.json().catch(() => ({} as any));
  return (e as any)?.detail || (e as any)?.non_field_errors?.[0] || (Array.isArray(e) ? (e as any)[0] : fallback);
}
/* Date box: SINGLE calendar chooser (legacy readonly textbox + popup).
 * The box shows the calendar picker; the API still gets dd/mm/yyyy. */
function DateBox({ value, onChange, max }: { value: string; onChange: (ddmm: string) => void; max?: string }) {
  const toISO = (s: string) => {
    const m = (s || "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
  };
  const fromISO = (s: string) => {
    const m = (s || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
  };
  return (
    <input type="date" className="form-control date-picker1" style={{ width: "100%" }} value={toISO(value)} max={max}
      onChange={(e) => onChange(fromISO(e.target.value))} title="Choose Date" />
  );
}

/* DataTable-look grid: csv/print/copy/colvis + Show N + Search + First/Prev/N/Next/Last */
function DtGrid({ id, cols, rows, renderCell, checkKey, selected, onToggle, onToggleAll }:
{
  id: string; cols: string[]; rows: Row[];
  renderCell?: (r: Row, c: string, i: number) => React.ReactNode;
  checkKey?: string; selected?: Record<string, boolean>;
  onToggle?: (key: string, v: boolean) => void; onToggleAll?: (v: boolean) => void;
}) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [showM, setShowM] = useState(false);
  const len = -1; // all rows, no paging
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);
  const vis = cols.filter((c) => !hidden[c]);
  const cell = (r: Row, c: string, i: number) =>
    renderCell ? renderCell(r, c, i) : (c === "Sr No." ? i + 1 : val(r, c));
  const filt = rows.filter((r, i) =>
    !q || vis.some((c) => String(cell(r, c, i) ?? "").toLowerCase().includes(q.toLowerCase())));
  const per = len === -1 ? filt.length || 1 : len;
  const pages = Math.max(1, Math.ceil(filt.length / per));
  const pg = Math.min(page, pages - 1);
  const slice = len === -1 ? filt : filt.slice(pg * per, pg * per + per);
  const from = filt.length === 0 ? 0 : pg * per + 1;
  const to = Math.min(filt.length, pg * per + (len === -1 ? filt.length : per));
  const q2 = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const dl = (name: string, type: string, text: string) => {
    const blob = new Blob(["\ufeff" + text], { type });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  };
  useEffect(() => { setPage(0); }, [q, len, rows.length]);
  return (
    <div>
      <div className="dt-btns" style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", position: "relative" }}>
        <button type="button" className="dt-exp" onClick={() => dl(`${id}.csv`, "text/csv",
          vis.map(q2).join(",") + "\r\n" + filt.map((r, i) => vis.map((c) => q2(cell(r, c, i))).join(",")).join("\r\n"))}>csv</button>
        <button type="button" className="dt-exp" onClick={() => {
          const w = window.open("", "_blank"); if (!w) return;
          w.document.write(`<html><head><title>${id}</title></head><body><table border=1><tr>${vis.map((c) => `<th>${c}</th>`).join("")}</tr>${filt.map((r, i) => `<tr>${vis.map((c) => `<td>${cell(r, c, i)}</td>`).join("")}</tr>`).join("")}</table><script>window.print()</script></body></html>`);
          w.document.close();
        }}>print</button>
        <button type="button" className="dt-exp" onClick={() => {
          navigator.clipboard?.writeText([vis.join("\t"), ...filt.map((r, i) => vis.map((c) => cell(r, c, i)).join("\t"))].join("\n")).catch(() => undefined);
        }}>copyHtml5</button>
        <button type="button" className="dt-exp" onClick={() => setShowM((s) => !s)}>colvis</button>
        {showM && (
          <div className="dt-colmenu" style={{ background: "#fff", border: "1px solid #ccc", padding: 8, position: "absolute", zIndex: 5 }}>
            {cols.map((c) => (
              <label key={c} style={{ display: "block", fontSize: 12 }}>
                <input type="checkbox" checked={!hidden[c]} onChange={() => setHidden((h) => ({ ...h, [c]: !h[c] }))} /> {c}
              </label>
            ))}
          </div>
        )}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginBottom: 6 }}>
        <div style={{ fontSize: 12, fontWeight: "bold" }}>Total: {rows.length} records</div>
        <div style={{ fontSize: 12 }}>Search: <input type="text" value={q} onChange={(e) => setQ(e.target.value)}
          style={{ border: "1px solid #ccc", borderRadius: 4, padding: "4px 8px" }} /></div>
      </div>
      <div className="grid-view" style={{ overflow: "auto", maxHeight: "60vh" }}>
        <table id={id} className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
          <thead><tr>
            {checkKey && (
              <th><input type="checkbox"
                checked={slice.length > 0 && slice.every((r, i) => selected?.[String(val(r, checkKey) ?? (pg * per + i))])}
                onChange={(e) => onToggleAll?.(e.target.checked)} /> {checkKey === "x" ? "Select Customer" : "SELECT"}</th>
            )}
            {vis.map((c) => <th key={c}>{c}</th>)}
          </tr></thead>
          <tbody>
            {slice.map((r, i) => {
              const gi = pg * per + i;
              return (
                <tr key={gi}>
                  {checkKey && (
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={!!selected?.[String(val(r, checkKey === "x" ? "k" : checkKey) ?? gi)]}
                        onChange={(e) => onToggle?.(String(val(r, checkKey === "x" ? "k" : checkKey) ?? gi), e.target.checked)} />
                    </td>
                  )}
                  {vis.map((c) => <td key={c}>{cell(r, c, gi)}</td>)}
                </tr>
              );
            })}
            {slice.length === 0 && <tr><td colSpan={(vis.length || 1) + (checkKey ? 1 : 0)} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", marginTop: 6, fontSize: 12 }}>
        <div><b>Total: {rows.length} records</b>{q ? ` (Showing ${filt.length} of ${rows.length})` : ""}</div>
      </div>
    </div>
  );
}

/* ================= TAB 1: Create Group ================= */
function TabGroup({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [gname, setGname] = useState("");
  const [exp, setExp] = useState("Direct");
  const [groups, setGroups] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [sgroup, setSgroup] = useState(SEL);
  const [expese, setExpese] = useState("");
  const [sub, setSub] = useState("");
  const [sgroup2, setSgroup2] = useState(SEL);
  const [subs, setSubs] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [expese1, setExpese1] = useState("");
  const [sub2, setSub2] = useState(SEL);
  const [ledger, setLedger] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const loadGroups = async () => {
    const d = await getJSON<{ results: Row[] }>(`${BASE}/groups/`);
    const list = ((d?.results ?? []) as Row[]);
    const opts = [{ v: SEL, t: SEL }, ...list.map((g) => ({ v: String(val(g, "group_name")), t: String(val(g, "group_name")) }))];
    setGroups(opts);
  };
  const loadGrid = async () => {
    const d = await getJSON<{ results: Row[] }>(`${BASE}/ledger-grid/`);
    setRows(((d?.results ?? []) as Row[]));
  };
  useEffect(() => { loadGroups(); loadGrid(); }, []);
  const pickSubGroup = async (g: string, which: 1 | 2) => {
    if (which === 1) setSgroup(g); else setSgroup2(g);
    if (!g || g === SEL) {
      if (which === 1) { setSubs([{ v: SEL, t: SEL }]); setExpese(""); }
      else setExpese1("");
      return;
    }
    const e = await getJSON<any>(`${BASE}/group-expese/?group_name=${encodeURIComponent(g)}`);
    const ev = String((e as any)?.expese ?? "");
    if (which === 1) setExpese(ev); else setExpese1(ev);
    if (which === 2) {
      const d = await getJSON<{ results: Row[] }>(`${BASE}/subgroups/?group_name=${encodeURIComponent(g)}`);
      const list = ((d?.results ?? []) as Row[]);
      setSubs([{ v: SEL, t: SEL }, ...list.map((s) => ({ v: String(val(s, "subgroup_name")), t: String(val(s, "subgroup_name")) }))]);
    }
  };
  const createGroup = async () => {
    if (!gname) { window.alert("Please Enter Group Name "); return; } // Group_validation()
    const r = await mk(`${BASE}/group-create/`, { group_name: gname, expese: exp });
    if (r.ok) { window.alert("Group Create successfully!!"); show("Group Create successfully!!", true); setGname(""); loadGroups(); loadGrid(); }
    else { const t = await errText(r, "Save failed"); window.alert(t); show(t, false); }
  };
  const createSub = async () => {
    if (!sgroup || sgroup === SEL) { window.alert("Please Select Group Name "); return; }
    if (!sgroup) { window.alert("Please Create Group First "); return; }
    if (!sub) { window.alert("Please Enter Sub Group Name "); return; }
    const r = await mk(`${BASE}/subgroup-create/`, { group_name: sgroup, expese, subgroup_name: sub });
    if (r.ok) { window.alert("Sub Group Create successfully!!"); show("Sub Group Create successfully!!", true); setSub(""); loadGrid(); }
    else { const t = await errText(r, "Save failed"); window.alert(t); show(t, false); }
  };
  const createLedger = async () => {
    if (!sgroup2 || sgroup2 === SEL) { window.alert("Please Select Group Name "); return; }
    if (!sgroup2) { window.alert("Please Create Group First "); return; }
    if (!sub2 || sub2 === SEL) { window.alert("Please Select Group Name "); return; }
    if (!sub2) { window.alert("Please Create Sub Group First "); return; }
    if (!ledger) { window.alert("Please Enter Sub Group Name "); return; }
    const r = await mk(`${BASE}/ledger-create/`, { group_name: sgroup2, expese: expese1, subgroup_name: sub2, ledger_name: ledger });
    if (r.ok) { window.alert(" Ledger Create successfully!!"); show(" Ledger Create successfully!!", true); setLedger(""); loadGrid(); }
    else { const t = await errText(r, "Save failed"); window.alert(t); show(t, false); }
  };
  const cols = ["GROUP_NAME", "SUBGROUP_NAME", "LEDGER_NAME", "EXPESE"];
  return (
    <div>
      <div style={{ background: "#fff", border: "1px solid #7fa8c9", borderRadius: 6, padding: 14, marginBottom: 12 }}>
        <div className="row" style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ width: 200 }}><b>Enter Group Name :</b>
            <input type="text" className="form-control" value={gname} onChange={(e) => setGname(e.target.value)} /></div>
          <div style={{ width: 200 }}><b>Expense :</b>
            <select className="form-control" value={exp} onChange={(e) => setExp(e.target.value)}>
              <option value="Direct">Direct</option><option value="Indirect">Indirect</option>
            </select></div>
          <div><button type="button" className="it-btn btn-large" style={{ minWidth: 150 }} onClick={createGroup}>Create Group</button></div>
        </div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #7fa8c9", borderRadius: 6, padding: 14, marginBottom: 12 }}>
        <div className="row" style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ width: 200 }}><b>Group Name :</b>
            <select className="form-control" value={sgroup} onChange={(e) => pickSubGroup(e.target.value, 1)}>
              {groups.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select></div>
          <div style={{ width: 200 }}><b>Expese :</b>
            <input type="text" className="form-control" value={expese} readOnly /></div>
          <div style={{ width: 200 }}><b>Enter Sub Group Name :</b>
            <input type="text" className="form-control" value={sub} onChange={(e) => setSub(e.target.value)} /></div>
          <div><button type="button" className="it-btn btn-large" style={{ minWidth: 150 }} onClick={createSub}>Create Sub Group</button></div>
        </div>
      </div>
      <div style={{ background: "#fff", border: "1px solid #7fa8c9", borderRadius: 6, padding: 14, marginBottom: 12 }}>
        <div className="row" style={{ display: "flex", gap: 24, justifyContent: "center", flexWrap: "wrap", alignItems: "flex-end" }}>
          <div style={{ width: 200 }}><b>Group Name :</b>
            <select className="form-control" value={sgroup2} onChange={(e) => pickSubGroup(e.target.value, 2)}>
              {groups.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select></div>
          <div style={{ width: 200 }}><b>Expese :</b>
            <input type="text" className="form-control" value={expese1} readOnly /></div>
          <div style={{ width: 200 }}><b>Sub Group Name :</b>
            <select className="form-control" value={sub2} onChange={(e) => setSub2(e.target.value)}>
              {subs.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select></div>
          <div style={{ width: 200 }}><b>Enter ledger Name:</b>
            <input type="text" className="form-control" value={ledger} onChange={(e) => setLedger(e.target.value)} /></div>
          <div><button type="button" className="it-btn btn-large" style={{ minWidth: 150 }} onClick={createLedger}>Create Ledger</button></div>
        </div>
      </div>
      <DtGrid id="gv_ledger" cols={cols} rows={rows} />
    </div>
  );
}

/* ================= TAB 2: Upload Bank statement ================= */
function TabUpload({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [date, setDate] = useState("");
  const [bank, setBank] = useState(SEL);
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [loadErr, setLoadErr] = useState("");
  const todayISO = () => {
    const d = new Date();
    const p = (n: number) => (n < 10 ? "0" : "") + n;
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  };
  const load = async () => {
    const d = await getJSON<{ results: Row[] }>(`${BASE}/upload-grid/`);
    if (!d) {
      setLoadErr("Failed to load the uploaded statements — please check that the backend is running (restart it for /api/transactions/bank-portal/*), then press Refresh.");
      setRows([]);
      return;
    }
    setLoadErr("");
    setRows(((d?.results ?? []) as Row[]));
  };
  useEffect(() => { load(); }, []);
  const go = async () => {
    if (!date) { window.alert("Please Select Date"); return; } // valid_upload()
    if (!bank || bank === SEL) { window.alert("Please Select Bank"); return; }
    if (!file) { window.alert("Please Upload File"); return; }
    const fd = new FormData();
    fd.append("bank", bank); fd.append("date", date); fd.append("file", file);
    const r = await upload(`${BASE}/bank-upload/`, fd);
    if (r.ok) {
      const d = await r.json().catch(() => ({} as any));
      if ((d as any)?.message === "File Already Uploaded !!!") {
        window.alert("File Already Uploaded !!!"); show("File Already Uploaded !!!", false);
        return;
      }
      window.alert("Ledger File Uploaded Successfully...");
      show("Ledger File Uploaded Successfully...", true);
      if ((d as any)?.issues) {
        const iss = (d as any).issues;
        const html = `<table border=1><tr>${iss.columns.map((c: string) => `<th>${c}</th>`).join("")}</tr>` +
          iss.rows.map((x: any[]) => `<tr>${x.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") + `</table>`;
        const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = iss.filename;
        document.body.appendChild(a); a.click(); a.remove();
      }
      window.alert("File Uploaded Successfully !!!");
      setFile(null); setBank(SEL); setDate(""); load();
    } else { const t = await errText(r, "Upload failed"); window.alert(t); show(t, false); }
  };
  const cols = ["transaction_date", "Type", "Credit", "Debit", "Balance", "Client_Name"];
  return (
    <div>
      {loadErr && (
        <div style={{ background: "#fff3cd", border: "1px solid #ffc107", color: "#856404", padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 12, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <span>{loadErr}</span>
          <button type="button" className="btn btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => window.location.reload()}>Refresh</button>
        </div>
      )}
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="col-sm-2 col-xs-12"><b>Date :</b>
          <DateBox value={date} onChange={setDate} max={todayISO()} /></div>
        <div className="col-sm-2 col-xs-12"><b>Bank : <span className="text-red">*</span></b>
          <select className="form-control" value={bank} onChange={(e) => setBank(e.target.value)}>
            <option value={SEL}>{SEL}</option><option value="INDUSIND BANK">INDUSIND BANK</option>
            <option value="SBI BANK">SBI BANK</option><option value="Axis BANK">Axis BANK</option>
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Upload:</b>
          <input type="file" className="text_box" accept=".xls,.xlsx" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        <div className="col-sm-2 col-xs-12"><button type="button" className="it-btn btn-primary" onClick={go}>Upload</button></div>
      </div>
      <br />
      <DtGrid id="gv_upload" cols={cols} rows={rows} />
    </div>
  );
}

/* ================= TAB 3: Bank Receipt ================= */
function TabReceipt({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [atype, setAtype] = useState(SEL);
  const [rtype, setRtype] = useState(SEL);
  const [clients, setClients] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [client, setClient] = useState(SEL);
  const [byName, setByName] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [dates, setDates] = useState<Opt[]>([]);
  const [date, setDate] = useState(SEL);
  const [amounts, setAmounts] = useState<Opt[]>([]);
  const [amount, setAmount] = useState(SEL);
  const [drows, setDrows] = useState<Row[]>([]);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [dsel, setDsel] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState("");
  const [reason, setReason] = useState("");
  const [rrej, setRrej] = useState<Record<number, string>>({});
  const [srMode, setSrMode] = useState(false);
  const [warn, setWarn] = useState("");
  const need = async <T,>(path: string): Promise<T | null> => {
    let r: Response;
    try {
      r = await fetch(`${API_BASE_URL}${path}`, {
        credentials: "include", headers: { Accept: "application/json" }, cache: "no-store",
      });
    } catch {
      setWarn("Cannot reach the backend at all — please check that the Django server is running, then Refresh.");
      return null;
    }
    if (r.ok) {
      try { return (await r.json()) as T; } catch { return {} as T; }
    }
    let detail = "";
    try {
      const b = await r.json();
      detail = (b as any)?.detail || (b as any)?.non_field_errors?.[0] ||
        (Array.isArray(b) ? (b as any)[0] : "");
    } catch { /* non-JSON (HTML 500) */ }
    if (r.status === 404) setWarn("Data not loading (404) — please restart the backend server for /api/transactions/bank-portal/* and /api/transactions/account-portal/*, then Refresh.");
    else if (r.status === 403) setWarn("Access denied (403) — your session may have expired. Please log in again and refresh.");
    else if (detail) setWarn(`Server says: ${detail}`);
    else setWarn("Failed to load data (server error) — please check the backend logs and the legacy DB connection.");
    return null;
  };
  useEffect(() => {
    (async () => {
      const d = await need<{ results: Row[] }>(`${BASE}/receipt-clients/?mode=${rtype === "1" ? "other" : "client"}`);
      if (!d) return;
      setWarn("");
      const list = ((d?.results ?? []) as Row[]);
      setClients([{ v: SEL, t: SEL }, ...list.map((c) => ({ v: String(val(c, "code")), t: String(val(c, "name")) }))]);
    })();
  }, [rtype, atype]);
  const loadGrid = async (cc: string, name: boolean) => {
    if (!cc || cc === SEL) { setRows([]); return; }
    const d = await need<{ results: Row[] }>(
      `${BASE}/receipt-grid/?client=${encodeURIComponent(cc)}&by_name=${name ? "1" : "0"}`);
    if (!d) { setRows([]); return; }
    const list = ((d?.results ?? []) as Row[]);
    setRows(list); setSel({});
    setRrej(Object.fromEntries(list.map((r, i) => [i, String(val(r, "receipt_reasons") ?? "")])));
  };
  const loadDetail = async () => {
    if (!client || client === SEL) { setDrows([]); return; }
    const d = await need<{ results: Row[] }>(
      `${BASE}/receipt-detail-grid/?client_code=${encodeURIComponent(client)}&date=${encodeURIComponent(date)}&amount=${encodeURIComponent(amount)}`);
    if (!d) { setDrows([]); return; }
    setDrows(((d?.results ?? []) as Row[])); setDsel({});
  };
  useEffect(() => {
    (async () => {
      if (!client || client === SEL || atype !== "2") { setDates([]); return; }
      const d = await getJSON<{ results: Row[] }>(`${BASE}/receipt-dates/?client_code=${encodeURIComponent(client)}`);
      const list = ((d?.results ?? []) as Row[]);
      setDates(list.map((x) => ({ v: String(val(x, "d")), t: String(val(x, "d")) })));
    })();
  }, [client, atype]);
  useEffect(() => {
    (async () => {
      if (!date || date === SEL) { setAmounts([]); return; }
      const d = await getJSON<{ results: Row[] }>(
        `${BASE}/receipt-amounts/?client_code=${encodeURIComponent(client)}&date=${encodeURIComponent(date)}`);
      const list = ((d?.results ?? []) as Row[]);
      setAmounts(list.map((x) => ({ v: String(val(x, "amt")), t: String(val(x, "amt")) })));
    })();
  }, [date, client]);
  useEffect(() => { loadDetail(); }, [amount]);
  const checkedIds = (which: "m" | "d") => {
    const S = which === "m" ? sel : dsel;
    const R = which === "m" ? rows : drows;
    const out: { id: any; invoice: any; table: string; date?: string; reason?: string }[] = [];
    R.forEach((r, i) => {
      if (S[String(i)]) {
        out.push({
          id: val(r, "id"), invoice: val(r, "Invoice_No") || val(r, "invoice_no"),
          table: which === "m" ? "minibank" : "gst",
          date: which === "m" ? String(val(r, "Receive Date") || "") : undefined,
          reason: which === "m" ? (rrej[i] ?? "") : undefined,
        });
      }
    });
    return out;
  };
  const act = async (kind: "approve" | "reject" | "sr_approve" | "sr_reject") => {
    // approve_function() / Reject_function()
    if (!atype || atype === SEL) { window.alert("Please Select Account Type"); return; }
    if (atype === "1") {
      if (!rtype || rtype === SEL) { window.alert("Please Select Received From"); return; }
      if (!client || client === SEL) { window.alert("Please Select Client"); return; }
      const items = checkedIds("m");
      if (items.length === 0) { window.alert("Please select atleast one Record "); return; }
      if (kind === "reject" || kind === "sr_reject") {
        if (items.some((it) => !(it.reason || "").trim()) && !reason.trim()) {
          window.alert("Please Enter Reject Reason"); return;
        }
        if (!window.confirm("Are you Sure You Want to Reject")) return;
      }
      const r = await mk(`${BASE}/receipt-final/`, { kind, items, reason, client_code: byName ? "" : client });
      if (r.ok) {
        const t = kind.includes("reject") ? " Reject By Sr Acc Successfully !!!"
          : kind === "sr_approve" ? " Record Approve  Successfully !!!" : " Record Approve Successfully !!!";
        window.alert(t); show(t, true); loadGrid(client, byName);
      } else { const t = await errText(r, "Action failed"); window.alert(t); show(t, false); }
    } else {
      if (!client || client === SEL) { window.alert("Please Select Client"); return; }
      if (!date || date === SEL) { window.alert("Please Select Payment Receving Date "); return; }
      if (!amount || amount === SEL) { window.alert("Please Select  Amount"); return; }
      const items = checkedIds("d");
      if (items.length === 0) { window.alert("Please select atleast one Record "); return; }
      if (kind === "reject" || kind === "sr_reject") {
        if (!window.confirm("Are you Sure You Want to Reject")) return;
      }
      const r = await mk(`${BASE}/receipt-final/`, { kind, items, reason });
      if (r.ok) {
        const t = kind.includes("reject") ? " Reject By Sr Acc Successfully !!!"
          : kind === "sr_approve" ? " Record Approve  Successfully !!!" : " Record Approve Successfully !!!";
        window.alert(t); show(t, true); loadDetail();
      } else { const t = await errText(r, "Action failed"); window.alert(t); show(t, false); }
    }
  };
  const srList = async () => {
    setSrMode(true);
    const d = await getJSON<{ results: Row[] }>(
      `${BASE}/receipt-sr/?client=${encodeURIComponent(client)}&table=${atype === "2" ? "gst" : "minibank"}`);
    const list = ((d?.results ?? []) as Row[]);
    if (atype === "2") { setDrows(list); setDsel({}); } else { setRows(list); setSel({}); }
  };
  const dl = (name: string) => {
    if (!name) return;
    window.open(`/api/transactions/account-portal/receipt-file/?name=${encodeURIComponent(name)}`, "_blank");
  };
  const mcols = ["Status", "Client Name", "Receive Date", "Payment Description", "Credit Amount", "Upload_file"];
  const dcols = ["Status", "Client Name", "Invoice", "Receive Date", "Received Amount", "Billing Amount"];
  return (
    <div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="col-sm-2 col-xs-12"><b>Account Type:*</b>
          <select className="form-control" value={atype} onChange={(e) => {
            const v = e.target.value; setAtype(v); setClient(SEL); setRows([]); setDrows([]); setSrMode(false);
          }}>
            <option value={SEL}>{SEL}</option><option value="1">Receipt</option><option value="2">Receipt Details</option>
          </select></div>
        {atype === "1" && (
          <div className="col-sm-2 col-xs-12"><b>Received from :</b>
            <select className="form-control" value={rtype} onChange={(e) => {
              const v = e.target.value; setRtype(v); setClient(SEL); setRows([]);
              setByName(v === "1");
            }}>
              <option value={SEL}>{SEL}</option><option value="0">Client</option><option value="1">Other</option>
            </select></div>
        )}
        <div className="col-sm-2 col-xs-12"><b>Client Name :*</b>
          <select className="form-control" value={client} onChange={(e) => {
            const v = e.target.value; setClient(v);
            if (atype === "1") loadGrid(v, rtype === "1");
          }}>
            {clients.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        {atype === "2" && (
          <>
            <div className="col-sm-2 col-xs-12"><b>Payment Receving Date :*</b>
              <select className="form-control" value={date} onChange={(e) => setDate(e.target.value)}>
                <option value={SEL}>{SEL}</option>
                {dates.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
              </select></div>
            <div className="col-sm-2 col-xs-12"><b>Select Amount:*</b>
              <select className="form-control" value={amount} onChange={(e) => setAmount(e.target.value)}>
                <option value={SEL}>{SEL}</option>
                {amounts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
              </select></div>
          </>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div><b>Reject Reason:</b>
          <input type="text" className="form-control" value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: 220 }} /></div>
        <button type="button" className="it-btn" onClick={() => act("approve")}>APPROVE</button>
        <button type="button" className="it-btn" onClick={() => act("reject")}>REJECT</button>
        <button type="button" className="it-btn" style={{ width: 200 }} onClick={() => { srList(); }}>Sr Approved Record</button>
        <button type="button" className="it-btn" onClick={() => act("sr_reject")}>Sr Reject Record</button>
      </div>
      {srMode && <div style={{ fontSize: 11, color: "#555", marginTop: 4 }}>Showing Sr-approved records. Select rows and use REJECT for Sr Reject.</div>}
      <br />
      {warn && (
        <div style={{ background: "#fff3cd", border: "1px solid #ffc107", color: "#856404", padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 12, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
          <span>{warn}</span>
          <button type="button" className="btn btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => window.location.reload()}>Refresh</button>
        </div>
      )}
      {atype === "1" && client !== SEL && (
        <div style={{ overflowX: "auto" }}>
          <table className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
            <thead><tr><th><input type="checkbox"
              checked={rows.length > 0 && rows.every((_, i) => sel[String(i)])}
              onChange={(e) => { const n: Record<string, boolean> = {}; rows.forEach((_, i) => { n[String(i)] = e.target.checked; }); setSel(n); }} /> SELECT CLIENT</th>
              <th>DOWNLOAD FILE</th><th>REJECT REASON</th>{mcols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={String(val(r, "receipt_approve")) === "2" ? { background: "#90EE90" } : undefined}>
                  <td style={{ textAlign: "center" }}>
                    <input type="checkbox" checked={!!sel[String(i)]}
                      onChange={(e) => setSel((p) => ({ ...p, [String(i)]: e.target.checked }))} />
                  </td>
                  <td><button type="button" className="it-btn" onClick={() => dl(val(r, "Upload_file"))}>DOWNLOAD</button></td>
                  <td><input type="text" className="form-control" value={rrej[i] ?? ""}
                    onChange={(e) => setRrej((p) => ({ ...p, [i]: e.target.value }))} /></td>
                  {mcols.map((c) => <td key={c}>{c === "Status" ? val(r, "Status") : val(r, c)}</td>)}
                </tr>
              ))}
              {rows.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {atype === "2" && (
        <div>
          <div className="col-sm-2 col-xs-12"><b>Search :</b>
            <input type="text" className="form-control" value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <div style={{ overflowX: "auto", marginTop: 8 }}>
            <table className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
              <thead><tr><th><input type="checkbox"
                checked={drows.length > 0 && drows.every((_, i) => dsel[String(i)])}
                onChange={(e) => { const n: Record<string, boolean> = {}; drows.forEach((_, i) => { n[String(i)] = e.target.checked; }); setDsel(n); }} /> SELECT CLIENT</th>
                <th>Status</th><th>RECEIPT REASON</th><th>Client</th><th>Invoice</th><th>Date</th><th>Received</th><th>Billing</th></tr></thead>
              <tbody>
                {drows.filter((r) => !search || JSON.stringify(r).toLowerCase().includes(search.toLowerCase())).map((r, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={!!dsel[String(i)]}
                        onChange={(e) => setDsel((p) => ({ ...p, [String(i)]: e.target.checked }))} />
                    </td>
                    <td>{val(r, "Status")}</td>
                    <td><input type="text" className="form-control" value={val(r, "receipt_de_reasons")} readOnly /></td>
                    <td>{val(r, "client_name")}</td><td>{val(r, "invoice_no")}</td>
                    <td>{val(r, "received_date")}</td><td>{val(r, "Received Amount")}</td><td>{val(r, "Billing Amount")}</td>
                  </tr>
                ))}
                {drows.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= TAB 4: PO/Purches Bill ================= */
function TabPO({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [month, setMonth] = useState("");
  const [ptype, setPtype] = useState(SEL);
  const [customers, setCustomers] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [cust, setCust] = useState(SEL);
  const [pos, setPos] = useState<Row[]>([]);
  const [bills, setBills] = useState<Row[]>([]);
  const [psel, setPsel] = useState<Record<string, boolean>>({});
  const [bsel, setBsel] = useState<Record<string, boolean>>({});
  const [prej, setPrej] = useState<Record<number, string>>({});
  const [edits, setEdits] = useState<Record<number, { reason: string; booking: string }>>({});
  useEffect(() => {
    (async () => {
      if ((!ptype || ptype === SEL) || month.length < 5) { setCustomers([{ v: SEL, t: SEL }]); return; }
      const d = await getJSON<{ results: Row[] }>(
        `${BASE}/po-customers/?month=${encodeURIComponent(month)}&kind=${ptype === "Purchase Bill" ? "2" : "1"}`);
      const list = ((d?.results ?? []) as Row[]);
      setCustomers([{ v: SEL, t: SEL }, { v: ALL, t: ALL },
        ...list.map((c) => ({ v: String(val(c, "code")), t: String(val(c, "name")) }))]);
    })();
  }, [ptype, month]);
  const loadLists = async (cc: string) => {
    const q = `month=${encodeURIComponent(month)}&customer=${encodeURIComponent(cc)}`;
    if (ptype === "Purchase Order") {
      const d = await getJSON<{ results: Row[] }>(`${BASE}/po-list/?${q}`);
      setPos(((d?.results ?? []) as Row[])); setPsel({}); setPrej({});
    } else {
      const d = await getJSON<{ results: Row[] }>(`${BASE}/bill-list/?${q}`);
      setBills(((d?.results ?? []) as Row[])); setBsel({});
      setEdits(Object.fromEntries((((d?.results ?? []) as Row[]).map((r, i) => [i, { reason: String(val(r, "purches_bill_reject") ?? ""), booking: String(val(r, "booking_date") ?? "") }]))));
    }
  };
  const needChecked = (S: Record<string, boolean>) => Object.keys(S).filter((k) => S[k]);
  const poAct = async (kind: "approve" | "reject") => {
    const keys = needChecked(psel);
    if (keys.length === 0) { window.alert("Please Select At Least One Record"); return; }
    const items = keys.map((k) => {
      const r = pos[parseInt(k, 10)];
      return { cust: val(r, "CUST_CODE"), po: val(r, "PO_NO"), reason: prej[parseInt(k, 10)] ?? "" };
    });
    const url = kind === "approve" ? "po-approve" : "po-reject";
    if (kind === "reject" && items.some((it) => !it.reason)) {
      window.alert("Please Enter Reject Reason"); return;
    }
    const r = await mk(`${BASE}/${url}/`, { month, items });
    if (r.ok) {
      const t = kind === "approve" ? " Record Approve Successfully !!!" : " Reject By Sr Acc Successfully !!!";
      window.alert(t); show(t, true); loadLists(cust);
    } else { const t = await errText(r, "Action failed"); window.alert(t); show(t, false); }
  };
  const billAct = async (kind: "approve" | "reject") => {
    const keys = needChecked(bsel);
    if (keys.length === 0) { window.alert("Please Select At Least One Record"); return; }
    const items = keys.map((k) => {
      const i = parseInt(k, 10);
      const r = bills[i];
      const e = edits[i] ?? { reason: "", booking: "" };
      return { cust: val(r, "CUST_CODE"), doc: val(r, "DOC_NO"), reason: e.reason, booking: e.booking };
    });
    if (kind === "reject" && items.some((it) => !it.reason)) {
      window.alert("Please Enter Reject Reason"); return;
    }
    const r = await mk(`${BASE}/${kind === "approve" ? "bill-approve" : "bill-reject"}/`, { month, items });
    if (r.ok) {
      const t = kind === "approve" ? " Record Approve Successfully !!!" : " Reject By Sr Acc Successfully !!!";
      window.alert(t); show(t, true); loadLists(cust);
    } else { const t = await errText(r, "Action failed"); window.alert(t); show(t, false); }
  };
  const dl = (file: string, doc: string) => {
    if (!file) { window.alert("Attachment File Cannot Be Uploaded !!!"); return; }
    window.open(`/api/transactions/account-portal/bill-file/?name=${encodeURIComponent(file)}&doc=${encodeURIComponent(doc)}`, "_blank");
  };
  const poCols = ["PO_NO", "PO_DATE", "CUST_NAME", "GRAND_TOTAL", "final_po_flag", "po_reject_reason", "CUST_CODE"];
  const billCols = ["DOC_NO", "DOC_DATE", "CUST_NAME", "FINAL_PRICE", "final_invoice_flag", "purches_bill_reject", "CUST_CODE", "booking_date", "vendor_upload"];
  return (
    <div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="col-sm-2 col-xs-12"><b>Select Month :*</b>
          <input type="month" className="form-control date-picker" value={(() => {
            const m = (month || "").match(/^(\d{2})\/(\d{2,4})$/);
            if (!m) return "";
            return `${m[2].length === 2 ? `20${m[2]}` : m[2]}-${m[1]}`;
          })()} onChange={(e) => {
            const m = (e.target.value || "").match(/^(\d{4})-(\d{2})$/);
            setMonth(m ? `${m[2]}/${m[1].slice(2)}` : "");
          }} title="Select Month" /></div>
        <div className="col-sm-2 col-xs-12"><b>Purchase Type:*</b>
          <select className="form-control" value={ptype} onChange={(e) => { setPtype(e.target.value); setCust(SEL); setPos([]); setBills([]); }}>
            <option value={SEL}>{SEL}</option><option value="Purchase Order">Purchase Order</option><option value="Purchase Bill">Purchase Bill</option>
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Customer Name :*</b>
          <select className="form-control" value={cust} onChange={(e) => { setCust(e.target.value); loadLists(e.target.value); }}>
            {customers.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
      </div>
      <br />
      {ptype === "Purchase Order" && (
        <div>
          <div style={{ overflowX: "auto" }}>
            <table className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
              <thead><tr><th><input type="checkbox"
                checked={pos.length > 0 && pos.every((_, i) => psel[String(i)])}
                onChange={(e) => { const n: Record<string, boolean> = {}; pos.forEach((_, i) => { n[String(i)] = e.target.checked; }); setPsel(n); }} /> Select Customer</th>
                <th>PO_NO</th><th>Estimate No</th><th>Estimate Date</th><th>Vendor Name</th><th>Amount</th><th>Status</th><th>REJECT REASON</th></tr></thead>
              <tbody>
                {pos.map((r, i) => (
                  <tr key={i}>
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={!!psel[String(i)]}
                        onChange={(e) => setPsel((p) => ({ ...p, [String(i)]: e.target.checked }))} />
                    </td>
                    <td>{val(r, "PO_NO")}</td><td>{val(r, "PO_NO")}</td><td>{val(r, "PO_DATE")}</td>
                    <td>{val(r, "CUST_NAME")}</td><td>{val(r, "GRAND_TOTAL")}</td>                    <td>{val(r, "final_po_flag")}</td>
                    <td><input type="text" className="form-control" style={{ width: 150 }} value={prej[i] ?? String(val(r, "po_reject_reason") ?? "")} onChange={(e) => setPrej((p) => ({ ...p, [i]: e.target.value }))} /></td>
                  </tr>
                ))}
                {pos.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="row text-center" style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
            <button type="button" className="it-btn" style={{ width: "16%" }} onClick={() => poAct("approve")}>APPROVE PO</button>
            <button type="button" className="it-btn" onClick={() => poAct("reject")}>REJECT PO</button>
          </div>
        </div>
      )}
      {ptype === "Purchase Bill" && (
        <div>
          <div style={{ overflowX: "auto" }}>
            <table className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
              <thead><tr><th><input type="checkbox"
                checked={bills.length > 0 && bills.every((_, i) => bsel[String(i)])}
                onChange={(e) => { const n: Record<string, boolean> = {}; bills.forEach((_, i) => { n[String(i)] = e.target.checked; }); setBsel(n); }} /> Select Customer</th>
                <th>Invoice_NO</th><th>Estimate No</th><th>Estimate Date</th><th>Vendor</th><th>Amount</th><th>Status</th><th>DOWNLOAD</th><th>REJECT REASON</th><th>Booking Date</th></tr></thead>
              <tbody>
                {bills.map((r, i) => {
                  const e = edits[i] ?? { reason: "", booking: "" };
                  const set = (k: "reason" | "booking", v: string) => setEdits((p) => ({ ...p, [i]: { ...e, [k]: v } }));
                  return (
                    <tr key={i}>
                      <td style={{ textAlign: "center" }}>
                        <input type="checkbox" checked={!!bsel[String(i)]}
                          onChange={(ev) => setBsel((p) => ({ ...p, [String(i)]: ev.target.checked }))} />
                      </td>
                      <td>{val(r, "DOC_NO")}</td><td>{val(r, "DOC_NO")}</td><td>{val(r, "DOC_DATE")}</td>
                      <td>{val(r, "CUST_NAME")}</td><td>{val(r, "FINAL_PRICE")}</td><td>{val(r, "final_invoice_flag")}</td>
                      <td><button type="button" className="it-btn" onClick={() => dl(val(r, "vendor_upload"), val(r, "DOC_NO"))}>Invoice</button></td>
                      <td><input type="text" className="form-control" value={e.reason} onChange={(ev) => set("reason", ev.target.value)} /></td>
                      <td><input type="text" className="form-control date-picker1" style={{ width: "85%" }} value={e.booking} onChange={(ev) => set("booking", ev.target.value)} /></td>
                    </tr>
                  );
                })}
                {bills.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
              </tbody>
            </table>
          </div>
          <div className="row text-center" style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 8 }}>
            <button type="button" className="it-btn" onClick={() => billAct("approve")}> Approve Purchase Bill</button>
            <button type="button" className="it-btn" onClick={() => billAct("reject")}>Reject Purchase Bill </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ================= shell ================= */
const TABS = [
  { key: "menu1", label: "Create Group" }, { key: "menu2", label: "Upload Bank statement" },
  { key: "menu3", label: "Bank Receipt" }, { key: "menu4", label: "PO/Purches Bill" },
];

export default function AccountReports() {
  const [hidtab, setHidtab] = useState("menu1");
  const [msg, setMsg] = useState({ text: "", ok: true });
  const show = (text: string, ok = true) => setMsg({ text, ok });
  const openHelp = () => {
    window.open("html/Balance_Sheet.html", "popUpWindow",
      "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No");
  };
  return (
    <div className="container-fluid itmaster">
      <div className="lg-panel" style={{ marginBottom: 0 }}>
        <div className="lg-panel-head">
          <div className="row">
            <div className="col-sm-10">
              <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase"><b>Balance Sheet Accounting</b></div>
            </div>
            <div className="col-sm-2 text-right">
              <button type="button" onClick={openHelp} style={{ background: "transparent", border: "none", cursor: "pointer" }} title="Help">
                <img src="/Images/help_ico.png" width={20} height={20} alt="Help" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="container-fluid">
        <Msg text={msg.text} ok={msg.ok} />
        <div id="tabs" className="itmaster-tabs">
          <input type="hidden" id="hidtab" value={hidtab} readOnly />
          <ul>
            {TABS.map((t) => (
              <li key={t.key} className={hidtab === t.key ? "active" : ""}>
                <a data-toggle="tab" href={`#${t.key}`} onClick={(e) => { e.preventDefault(); setHidtab(t.key); }}>
                  {t.label}
                </a>
              </li>
            ))}
          </ul>
          <div id={hidtab} className="itmaster-body">
            {hidtab === "menu1" && <TabGroup show={show} />}
            {hidtab === "menu2" && <TabUpload show={show} />}
            {hidtab === "menu3" && <TabReceipt show={show} />}
            {hidtab === "menu4" && <TabPO show={show} />}
          </div>
        </div>
      </div>
    </div>
  );
}
