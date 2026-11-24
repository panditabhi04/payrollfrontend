"use client";
/* =====================================================================
 * Vendor Master — 1:1 port of VendorMaster.aspx (NOT the generic CRUD).
 * Header "Vendor Master" + "Vendor Master Details", help
 * (html/VendorMaster.html), 12 tabs in legacy order, footer buttons
 * Save/Update/Delete/Clear/Export To Excel/Close, filters + main
 * VendorGridView (select row loads everything). Exact validation strings.
 * Backend: /api/masters/vendor-portal/* (legacy vendor tables).
 * ===================================================================== */
import React, { useEffect, useState } from "react";
import { getJSON, mk, upload } from "@/lib/api/legacy-fetch";
import { API_BASE_URL, apiGet } from "@/lib/api/client";

const BASE = "/api/masters/vendor-portal";
const SEL = "Select";
const ALL = "ALL";

type Row = Record<string, any>;
type Opt = { v: string; t: string };

const EMAIL_RE = /^([a-zA-Z0-9_.-])+@(([a-zA-Z0-9-])+.)+([a-zA-Z0-9]{2,4})+$/;
const NATION_OPTS: Opt[] = [{ v: "0", t: SEL }, { v: "1", t: "Indian" }, { v: "2", t: "International" }];
const VTYPE_ALL: Opt[] = [{ v: "0", t: SEL }, { v: "1", t: "Private" }, { v: "2", t: "Public" },
  { v: "3", t: "Company" }, { v: "4", t: "Firm" }, { v: "5", t: "Proprietorship" }];
const CATEGORIES: Opt[] = [
  { v: SEL, t: SEL },
  { v: "Electrical", t: "Electrical" }, { v: "Plumbing", t: "Plumbing" },
  { v: "Carpentry", t: "Carpentry" }, { v: "Civil", t: "Civil" },
  { v: "Pest_Control", t: "Pest Control" }, { v: "HVAC", t: "HVAC" },
  { v: "Stationery", t: "Stationery" }, { v: "Chemical_Supplier", t: "Chemical Supplier" },
  { v: "Shoes", t: "Shoes" }, { v: "Uniform", t: "Uniform" },
  { v: "Housekeeping_services", t: "Housekeeping services" }, { v: "Courier", t: "Courier" },
  { v: "Other", t: "Other" },
];
const SALUTS = ["Select Salutation", "Mr.", "Mrs.", "Ms.", "Miss.", "Dr."];
const ITEM_TYPES = [SEL, "chemicals", "housekeeping_material", "Uniform", "pantry_jacket", "Apron",
  "Shoes", "ID_Card", "Machine", "Other"];
const COURIER = [SEL, "By Road", "By Air", "By Train"];
const WEIGHTS = [SEL, "Grm(Gram)", "Kg"];
const STEPS = [SEL, "5", "10", "15", "20", "25", "30", "35", "40"];
const BIGSTEPS = [SEL, "100", "150", "200", "250", "300", "350", "400"];

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
async function need<T>(path: string, setWarn: (s: string) => void): Promise<T | null> {
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
    setWarn("");
    try { return (await r.json()) as T; } catch { return {} as T; }
  }
  let detail = "";
  try {
    const b = await r.json();
    detail = (b as any)?.detail || "";
  } catch { /* HTML */ }
  if (r.status === 404) setWarn("Data not loading (404) — please restart the backend server for /api/masters/vendor-portal/*, then Refresh.");
  else if (r.status === 403) setWarn("Access denied (403) — your session may have expired. Please log in again and refresh.");
  else if (detail) setWarn(`Server says: ${detail}`);
  else setWarn("Failed to load data (server error) — please check the backend logs and the legacy DB connection.");
  return null;
}
function DropBanner({ errs }: { errs: (string | undefined)[] }) {
  const list = errs.filter(Boolean) as string[];
  if (list.length === 0) return null;
  return (
    <div style={{ background: "#fff3cd", border: "1px solid #ffc107", color: "#856404", padding: "8px 12px", borderRadius: 4, marginBottom: 12, fontSize: 12, display: "flex", gap: 12, alignItems: "center", justifyContent: "space-between" }}>
      <span>{list.join(" ")}</span>
      <button type="button" className="btn btn-primary" style={{ whiteSpace: "nowrap" }} onClick={() => window.location.reload()}>Refresh</button>
    </div>
  );
}
function Exports({ id, cols, rows, cell }: { id: string; cols: string[]; rows: Row[]; cell: (r: Row, c: string) => any }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [showM, setShowM] = useState(false);
  const vis = cols.filter((c) => !hidden[c]);
  const q = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  return (
    <div className="dt-btns" style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", position: "relative" }}>
      <button type="button" className="dt-exp" onClick={() => {
        const blob = new Blob(["\ufeff" + vis.map(q).join(",") + "\r\n" + rows.map((r) => vis.map((c) => q(cell(r, c))).join(",")).join("\r\n")], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = `${id}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
      }}>csv</button>
      <button type="button" className="dt-exp" onClick={() => window.print()}>print</button>
      <button type="button" className="dt-exp" onClick={() => {
        navigator.clipboard?.writeText([vis.join("\t"), ...rows.map((r) => vis.map((c) => cell(r, c)).join("\t"))].join("\n")).catch(() => undefined);
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
  );
}
/* keypress filters */
function numKey(e: React.KeyboardEvent) {
  if (e.key.length !== 1) return;
  if (/^[0-9]$/.test(e.key)) return;
  e.preventDefault();
}
function alphaKey(e: React.KeyboardEvent) {
  if (e.key.length !== 1) return;
  if (/^[A-Za-z ]$/.test(e.key)) return;
  e.preventDefault();
}
function addrKey(e: React.KeyboardEvent) {
  if (e.key.length !== 1) return;
  if (/^[A-Za-z0-9 &,.'"\-,./:;=?\\]$/.test(e.key)) return;
  e.preventDefault();
}
/* DB date (yyyy-mm-dd[ ...]) -> the dd/mm/yyyy text the date inputs use */
function toDmy(v: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (v || "");
}
function emailKey(e: React.KeyboardEvent) {
  if (e.key.length !== 1) return;
  if (/^[A-Za-z0-9@._-]$/.test(e.key)) return;
  e.preventDefault();
}
/* Legacy white rounded form box (container-fluid background white). */
function Box({ children }: { children: React.ReactNode }) {
  return (
    <div className="container-fluid" style={{ background: "white", borderRadius: 10, border: "1px solid #e2e2dd", padding: 16, marginBottom: 12 }}>
      {children}
    </div>
  );
}

export interface VendorForm {
  vend_id: string; vend_name: string; vend_name_loaded?: string; nation: string; vtype: string; address: string;
  contact1: string; phone1: string; contact2: string; phone2: string; email: string;
  category: string; credit: string; area: string; start: string; end: string; vendor_id2: string;
  terms: string; gst: string; pan: string; service_type: string; active: string; dues: string;
  opening: string; reg_no: string; sac: string;
  bill_attention: string; bill_country: string; bill_state: string; bill_city: string;
  bill_zip: string; bill_address: string; bill_fax: string;
  bank_name: string; bank_acc_name: string; acc_no: string; ifsc: string;
}
export interface Contact { salutation: string; firstname: string; lastname: string; email: string; workphone: string; mobileno: string; designation: string; department: string; }
/* Legacy default Terms & Conditions (8 lines, set on first load). */
export const DEFAULT_TERMS =
  "1. Free of cost Delivery.\n 2. One Year Comprehensive warranty to be provided from the date of delivery.\n 3. Quarterly Inspection for the machine to be done for a period of one year.\n 4. GST/TAXS Including.\n 5. Commissioning & Training: Will be done by your Engineer at our site.\n 6. 24% Interest per annum will be charged on Invoice value if the same will not be received as per agreement terms from the date of Invoice.\n 7. Any Correction in Final Invoice will not be considered after 7 days from the date of Invoice.\n 8. This Transaction is subject to Courts In Pune Only.\n";
export const EMPTY_FORM: VendorForm = {
  vend_id: "", vend_name: "", nation: "0", vtype: "0", address: "", contact1: "", phone1: "",
  contact2: "", phone2: "", email: "", category: SEL, credit: "", area: "", start: "", end: "",
  vendor_id2: "", terms: DEFAULT_TERMS, gst: "", pan: "", service_type: "", active: "A", dues: "", opening: "",
  reg_no: "", sac: "", bill_attention: "", bill_country: "", bill_state: "", bill_city: "",
  bill_zip: "", bill_address: "", bill_fax: "", bank_name: "", bank_acc_name: "", acc_no: "", ifsc: "",
};
export interface Contact { salutation: string; firstname: string; lastname: string; email: string; workphone: string; mobileno: string; designation: string; department: string; }
export const EMPTY_CONTACT: Contact = {
  salutation: "Select Salutation", firstname: "", lastname: "", email: "", workphone: "",
  mobileno: "", designation: "", department: "",
};

/* ================= main component (form state lives here; tabs edit it) ================= */
export default function VendorPortal() {
  const [hidtab, setHidtab] = useState("menu3");
  const [f, setF] = useState<VendorForm>({ ...EMPTY_FORM });
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [crow, setCrow] = useState<Contact>({ ...EMPTY_CONTACT });
  const [cities, setCities] = useState<{ state: string; city: string }[]>([]);
  const [assign, setAssign] = useState<Row[]>([]);
  const [notassign, setNotassign] = useState<Row[]>([]);
  const [taxFile, setTaxFile] = useState<File | null>(null);
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [msg, setMsg] = useState({ text: "", ok: true });
  const [warn, setWarn] = useState("");
  const [states, setStates] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [citiesDD, setCitiesDD] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [billClients, setBillClients] = useState<Row[]>([]);
  const [grid, setGrid] = useState<Row[]>([]);
  const [ftype, setFtype] = useState("0");
  const [fstate, setFstate] = useState("");
  const [fcity, setFcity] = useState("");
  const show = (text: string, ok = true) => setMsg({ text, ok });
  const set = (k: keyof VendorForm, v: string) => setF((p) => ({ ...p, [k]: v }));
  const setC = (k: keyof Contact, v: string) => setCrow((p) => ({ ...p, [k]: v }));

  const loadGrid = async () => {
    const q = `vendor_type=${ftype}&state=${encodeURIComponent(fstate)}&city=${encodeURIComponent(fcity)}`;
    const d = await need<{ results: Row[] }>(`${BASE}/grid/?${q}`, setWarn);
    if (d) setGrid(((d?.results ?? []) as Row[]));
  };
  useEffect(() => {
    (async () => {
      const nid = await need<any>(`${BASE}/next-id/`, () => undefined);
      if (nid?.vend_id) setF((p) => ({ ...p, vend_id: String(nid.vend_id) }));
      const st = await need<{ results: Row[] }>(`${BASE}/states/`, setWarn);
      if (st) setStates([{ v: SEL, t: SEL },
        ...(((st?.results ?? []) as Row[]).map((s) => ({ v: String(val(s, "code")), t: String(val(s, "state")) })))]);
      const bc = await need<{ results: Row[] }>(`${BASE}/billing-clients/`, () => undefined);
      if (bc) setBillClients(((bc?.results ?? []) as Row[]));
    })();
    loadGrid();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const loadCities = async (code: string) => {
    const d = await need<{ results: Row[] }>(`${BASE}/cities/?state_code=${encodeURIComponent(code)}`, setWarn);
    if (!d) return;
    setCitiesDD([{ v: SEL, t: SEL },
      ...(((d?.results ?? []) as Row[]).map((c) => ({ v: String(val(c, "city")), t: String(val(c, "city")) })))]);
  };
  // Req_validation() — exact order + strings
  const valid = () => {
    if (!f.vend_name) { window.alert("Please Enter Vendor Name"); return false; }
    if (!f.nation || f.nation === "0") { window.alert("Please Select Vendor Type (As per Nation)"); return false; }
    if (!f.vtype || f.vtype === "0") { window.alert("Please Select Vendor Type"); return false; }
    if (!f.address) { window.alert("Please Select Vendor Address"); return false; }
    if (!f.contact1) { window.alert("Please Select Atleast One Contact Person"); return false; }
    if (!f.phone1) { window.alert("Please Select Atleast One Contact Number"); return false; }
    if (!f.email) { window.alert("Please Enter Email Address"); return false; }
    if (!EMAIL_RE.test(f.email)) { window.alert("Please Enter valid email address"); return false; }
    if (!f.category || f.category === SEL) { window.alert("Please Select Vendor Categories"); return false; }
    if (!f.credit) { window.alert("Please Enter Credit Period (In Day) "); return false; }
    if (!f.start) { window.alert("Please Select Aggrement Start Date"); return false; }
    if (!f.end) { window.alert("Please Select Aggrement End Date"); return false; }
    if (!f.vendor_id2) { window.alert("Please Enter Vendor Id"); return false; }
    if (!f.gst) { window.alert("Please Enter GST"); return false; }
    if (!f.service_type) { window.alert("Please Enter Service Type"); return false; }
    if (!f.bill_country) { window.alert("Please Enter Billing Address Country"); return false; }
    if (!f.bill_state || f.bill_state === SEL) { window.alert("Please Select Billing Address State"); return false; }
    if (!f.bill_city || f.bill_city === SEL) { window.alert("Please Select Billing Address City"); return false; }
    if (!f.bill_address) { window.alert("Please Enter Billing Address"); return false; }
    if (!f.bank_name) { window.alert("Please Enter Bank Name"); return false; }
    if (!f.bank_acc_name) { window.alert("Please Enter Vendor Bank Account Name"); return false; }
    if (!f.acc_no) { window.alert("Please Enter Vendor Bank Account Number"); return false; }
    if (!f.ifsc) { window.alert("Please Enter Vendor Bank IFSC Code"); return false; }
    if (!taxFile && !f.vend_name_loaded) { window.alert("Please Upload File"); return false; }
    return true;
  };
  const save = async () => {
    if (!valid()) return;
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => { if (v !== undefined) fd.append(k, String(v)); });
    fd.append("contacts", JSON.stringify(contacts));
    fd.append("cities", JSON.stringify(cities));
    fd.append("assign", JSON.stringify(notassign.filter((r) => (r as any)._sel).map((r) => ({ client_code: val(r, "client_code") }))));
    if (taxFile) fd.append("file", taxFile);
    const r = await upload(`${BASE}/save/`, fd);
    if (r.ok) { window.alert("Record Added Successfully..."); show("Record Added Successfully...", true); loadGrid(); }
    else { const t = await errText(r, "Save failed"); window.alert(t); show(t, false); }
  };
  const update = async () => {
    if (!valid()) return;
    const fd = new FormData();
    Object.entries(f).forEach(([k, v]) => { if (v !== undefined) fd.append(k, String(v)); });
    fd.append("contacts", JSON.stringify(contacts));
    fd.append("cities", JSON.stringify(cities));
    fd.append("assign", JSON.stringify(notassign.filter((r) => (r as any)._sel).map((r) => ({ client_code: val(r, "client_code") }))));
    if (taxFile) fd.append("file", taxFile);
    const r = await upload(`${BASE}/update/`, fd);
    if (r.ok) {
      const t = `Vendor (${f.vend_name}) Updated Successfully...`;
      window.alert(t); show(t, true); loadGrid();
    } else { const t = await errText(r, "Update failed"); window.alert(t); show(t, false); }
  };
  const del = async () => {
    // R_validation()
    if (!window.confirm("Are you Sure You Want to Delete Record")) {
      window.alert("Record not Available"); return;
    }
    const r = await mk(`${BASE}/delete/`, { vend_id: f.vend_id, vend_name: f.vend_name });
    if (r.ok) { window.alert("Vendor Deleted Successfully..."); show("Vendor Deleted Successfully...", true); loadGrid(); }
    else { const t = await errText(r, "Delete failed"); window.alert(t); show(t, false); }
  };
  const clear = () => {
    setF({ ...EMPTY_FORM, terms: "" });
    setContacts([]); setCrow({ ...EMPTY_CONTACT }); setCities([]);
    (async () => {
      const nid = await need<any>(`${BASE}/next-id/`, () => undefined);
      if (nid?.vend_id) setF((p) => ({ ...p, vend_id: String(nid.vend_id) }));
    })();
  };
  const expo = async () => {
    const d = await need<any>(`${BASE}/export/`, setWarn);
    if (!d) return;
    const esc = (s: any) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const html = `<table border=1><tr><td></td><td></td><td></td><td></td><td>${esc(d.company)}</td></tr>` +
      `<tr><td></td><td></td><td></td><td></td><td>${esc(d.title)}</td></tr><tr></tr><tr></tr>` +
      `<tr>${d.columns.map((c: string) => `<th>${esc(c)}</th>`).join("")}</tr>` +
      d.rows.map((r: any[]) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("") + `</table>`;
    const blob = new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = d.filename;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const select = async (vid: string, vname: string) => {
    const d = await need<any>(`${BASE}/select/?vend_id=${encodeURIComponent(vid)}&vend_name=${encodeURIComponent(vname)}`, setWarn);
    if (!d) return;
    const v = (d as any).vendor ?? {};
    const g = (k: string) => String(val(v, k) ?? "");
    setF({
      vend_id: g("VEND_ID"), vend_name: g("VEND_NAME"), vend_name_loaded: g("VEND_NAME"),
      nation: g("vandor_type_nation") || "0",
      vtype: g("vendor_type_na") || "0", address: g("VEND_ADD1"), contact1: g("contact_person_1"),
      phone1: g("PHONE1"), contact2: g("contact_person_2"), phone2: g("PHONE2"),
      email: g("vendor_email_id"), category: g("vendor_type") || SEL, credit: g("CREDIT_PERIOD"),
      area: g("area_to_served"), start: toDmy(g("agrement_start_date")), end: toDmy(g("agrement_end_date")),
      vendor_id2: g("new_vendor_id"), terms: g("terms_and_conditions"), gst: g("GST"), pan: g("PAN_NO"),
      service_type: g("VEND_ADD2"), active: g("ACTIVE_STATUS") || "A", dues: g("TOTAL_DUES"),
      opening: g("OPENING_BALANCE"), reg_no: g("comp_registration_num"), sac: g("sac_code"),
      bill_attention: g("txtbillattention"), bill_country: g("txtbillcountry"),
      bill_state: g("txtbillstate"), bill_city: g("txtbillcity"), bill_zip: g("txtbillzipcode"),
      bill_address: g("txtbilladdress"), bill_fax: g("txtbillfax"), bank_name: g("bank_name"),
      bank_acc_name: g("bank_account_name"), acc_no: g("account_number"), ifsc: g("ifsc_code"),
    });
    const clist: Row[] = ((d as any).contacts ?? []) as Row[];
    setContacts(clist.map((c) => ({
      salutation: String(val(c, "salutation") || "Select Salutation"),
      firstname: String(val(c, "txtfirstname") ?? ""), lastname: String(val(c, "txtlastname") ?? ""),
      email: String(val(c, "txteaddress") ?? ""), workphone: String(val(c, "txtworkphonno") ?? ""),
      mobileno: String(val(c, "txtmobileno") ?? ""), designation: String(val(c, "txtdesignation1") ?? ""),
      department: String(val(c, "txtdept") ?? ""),
    })));
    const cylist: Row[] = ((d as any).cities ?? []) as Row[];
    setCities(cylist.map((c) => ({ state: "", city: String(val(c, "city") ?? "") })));
    setAssign((((d as any).assign ?? []) as Row[]));
    setNotassign((((d as any).notassign ?? []) as Row[]));
    loadCities(g("txtbillstate"));
  };
  // Req_validation1() for contact add
  const addContact = () => {
    if (!crow.salutation || crow.salutation === "Select Salutation") { window.alert("Please Select salutation !!!"); return; }
    if (!crow.firstname) { window.alert("Please Enter First Name   !!!"); return; }
    if (!crow.mobileno) { window.alert("Please Enter Mobile Number   !!!"); return; }
    setContacts((p) => [...p, { ...crow }]);
    setCrow({ ...EMPTY_CONTACT });
  };
  const copyBill = () => {
    // copy_add()
    setF((p) => ({ ...p }));
  };
  const openHelp = () => {
    window.open("html/VendorMaster.html", "popUpWindow",
      "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No");
  };
  const vtypes = f.nation === "2" ? VTYPE_ALL.filter((o) => o.v === "0" || o.v === "3") : VTYPE_ALL;
  const TABS = [
    { key: "menu3", label: "Vendor Info" }, { key: "home", label: "Tax Details" },
    { key: "menu1", label: "Address Details" }, { key: "menu4", label: "Bank Details" },
    { key: "menu2", label: "Contact Details" }, { key: "menu5", label: "State Details" },
    { key: "home1", label: "Weight Master" }, { key: "home2", label: "Rate Master" },
    { key: "home3", label: "Client Assign to Vendor" }, { key: "menu6", label: "Company Bank Details" },
    { key: "menu8", label: "TDS Details" }, { key: "menu7", label: "MSME" },
  ];
  const F2 = (k: keyof VendorForm, label: string, req = false, extra?: React.ReactNode) => (
    <div className="col-sm-3 col-xs-12"><b>{label}{req && <span className="text-red"> *</span>}</b>
      <input type="text" className="form-control" value={f[k]} onChange={(e) => set(k, e.target.value)} />
      {extra}</div>
  );
  const gridCols = ["COMP_CODE", "VEND_ID", "VEND_NAME", "PHONE1", "txtbillstate", "txtbillcity", "GST"];
  return (
    <div className="container-fluid itmaster vendor">
      <style>{`
        .itmaster .lg-panel{border:1px solid #337ab7;border-radius:4px;overflow:hidden;background:#fff;margin-bottom:20px;margin-top:15px;}
        .itmaster .lg-panel-head{background:linear-gradient(90deg,rgba(255,255,255,1) 0%,rgba(66,77,122,1) 35%,rgba(255,255,255,1) 100%);color:#fff;font-weight:700;font-size:small;padding:20px;letter-spacing:.5px;text-transform:uppercase;}
        .itmaster .row{margin-right:-15px;margin-left:-15px;}
        .itmaster .row::after{content:"";display:table;clear:both;}
        .itmaster .text-center{text-align:center;} .itmaster .text-right{text-align:right;} .itmaster .text-uppercase{text-transform:uppercase;} .itmaster .text-red{color:#ff0000;}
        .itmaster-tabs{background:#fff;border:1px solid #aaaaaa;padding:.2em .2em 0;}
        .itmaster-tabs>ul{display:flex;flex-wrap:wrap;margin:0;padding:.2em .2em 0;background:#fff;list-style:none;}
        .itmaster-tabs>ul>li{margin:0 2px 0 0;}
        .itmaster-tabs>ul>li>a{display:block;padding:.5em 1em;background:#424D7A;color:#fff;font-size:12px;text-decoration:none;border-top-left-radius:4px;border-top-right-radius:4px;white-space:nowrap;}
        .itmaster-tabs>ul>li.active>a{background:#fff;color:#424D7A;border:1px solid #aaaaaa;border-bottom:1px solid #fff;margin-bottom:-1px;}
        .itmaster-body{background:beige;border:1px solid #aaaaaa;border-top:none;padding:1em 1.4em;}
        .it-btn{display:inline-block;font-weight:700;text-align:center;cursor:pointer;border:none;padding:6px 20px;font-size:14px;line-height:1.42857143;border-radius:4px;background-color:#00b712;color:#fff;text-decoration:none;font-family:Verdana,Geneva,Tahoma,sans-serif;white-space:nowrap;}
        .it-btn:hover{background-color:#fff;color:#00b712;border:2px solid #00b712;padding:4px 18px;}
        .itmaster .btn-danger{color:#fff;background-color:#d9534f;border:1px solid #d43f3a;border-radius:4px;padding:6px 20px;font-size:14px;cursor:pointer;}
        .itmaster .form-control{display:block;width:100%;height:34px;padding:6px 12px;font-size:12px;color:#555;background-color:#fff;border:1px solid #ccc;border-radius:4px;font-family:Verdana,Geneva,Tahoma,sans-serif;}
        .itmaster textarea.form-control{height:auto;}
        .itmaster .table{width:100%;border-collapse:collapse;font-size:12px;background:#fff;}
        .itmaster .dt-grid th{background:#006699;color:#fff;font-weight:700;text-transform:uppercase;text-align:left;padding:8px;border:1px solid #CCCCCC;}
        .itmaster .dt-grid td{padding:7px 8px;border:1px solid #CCCCCC;color:#000066;background:#fff;}
        .itmaster .dt-exp{background:#5bc0de;color:#fff;border:1px solid #46b8da;border-radius:4px;padding:5px 12px;font-size:12px;cursor:pointer;}
        .itmaster .dt-btns{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap;position:relative;}
        .itmaster .grid-view{height:auto;max-height:400px;overflow-x:auto;overflow-y:auto;}
        .vrow{display:flex;flex-wrap:wrap;gap:12px;margin:0 0 12px 8.33333333%;}
        .vfield{flex:1 1 160px;min-width:160px;max-width:220px;}
        .vfield b{display:block;margin-bottom:4px;font-size:12px;}
      `}</style>
      <div className="lg-panel" style={{ marginBottom: 0 }}>
        <div className="lg-panel-head">
          <div className="row">
            <div className="col-lg-11 col-md-11 col-sm-11 col-xs-12">
              <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase">
                <b>Vendor Master</b>
              </div>
            </div>
            <div className="col-lg-1 col-md-1 col-sm-1 col-xs-12 text-right">
              <button type="button" onClick={openHelp} style={{ background: "transparent", border: "none", cursor: "pointer" }} title="Help">
                <img src="/Images/help_ico.png" width={20} height={20} alt="Help" />
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className="container-fluid">
        <Msg text={msg.text} ok={msg.ok} />
        <DropBanner errs={[warn]} />
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
            {hidtab === "menu3" && (
              <Box>
                <div className="row text-center"><div className="col-md-12"><h4><u>Vendor Information</u></h4></div></div>
                <div className="container">
                  <div className="row">
                    <div className="col-sm-1 col-xs-12"></div>
                    <div className="col-sm-2 col-xs-12"><b>Vendor Id :</b>
                      <input type="text" className="form-control" value={f.vend_id} readOnly /></div>
                    <div className="col-sm-2 col-xs-12"><b>Vendor Name : *</b>
                      <input type="text" className="form-control" maxLength={70} value={f.vend_name}
                        onChange={(e) => set("vend_name", e.target.value)} onKeyPress={alphaKey} /></div>
                    <div className="col-sm-2 col-xs-12"><b>Vendor Type(As per Nation): *</b>
                      <select className="form-control" value={f.nation} onChange={(e) => set("nation", e.target.value)}>
                        {NATION_OPTS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                      </select></div>
                    <div className="col-sm-2 col-xs-12"><b>Vendor Type : *</b>
                      <select className="form-control" value={f.vtype} onChange={(e) => set("vtype", e.target.value)}>
                        {vtypes.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                      </select></div>
                    <div className="col-sm-2 col-xs-12"><b>Vendor Address : *</b>
                      <input type="text" className="form-control" maxLength={100} value={f.address}
                        onChange={(e) => set("address", e.target.value)} onKeyPress={addrKey} /></div>
                  </div>
                  <br />
                  <div className="row">
                    <div className="col-sm-1 col-xs-12"></div>
                    <div className="col-sm-2 col-xs-12"><b>Contact Person 1 : *</b>
                      <input type="text" className="form-control" maxLength={100} value={f.contact1}
                        onChange={(e) => set("contact1", e.target.value)} onKeyPress={alphaKey} /></div>
                    <div className="col-sm-2 col-xs-12"><b>Contact Person Mob No.1 : *</b>
                      <input type="text" className="form-control" maxLength={10} value={f.phone1}
                        onChange={(e) => set("phone1", e.target.value)} onKeyPress={numKey} /></div>
                    <div className="col-sm-2 col-xs-12"><b>Contact Person 2 :</b>
                      <input type="text" className="form-control" maxLength={100} value={f.contact2}
                        onChange={(e) => set("contact2", e.target.value)} onKeyPress={alphaKey} /></div>
                    <div className="col-sm-2 col-xs-12"><b>Contact Person Mob No.2 :</b>
                      <input type="text" className="form-control" maxLength={10} value={f.phone2}
                        onChange={(e) => set("phone2", e.target.value)} onKeyPress={numKey} /></div>
                    <div className="col-sm-2 col-xs-12"><b>Contact Person Email ID : *</b>
                      <input type="text" className="form-control" maxLength={70} value={f.email}
                        onChange={(e) => set("email", e.target.value)} onKeyPress={emailKey} /></div>
                  </div>
                  <br />
                  <div className="row">
                    <div className="col-sm-1 col-xs-12"></div>
                    <div className="col-sm-2 col-xs-12"><b>Vendor Categories : *</b>
                      <select className="form-control" value={f.category} onChange={(e) => set("category", e.target.value)}>
                        {CATEGORIES.map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}
                      </select></div>
                    <div className="col-sm-2 col-xs-12"><b>Credit Period (In Day) : *</b>
                      <input type="text" className="form-control" maxLength={70} value={f.credit}
                        onChange={(e) => set("credit", e.target.value)} onKeyPress={numKey} /></div>
                    <div className="col-sm-2 col-xs-12"><b>Area to be Served :</b>
                      <input type="text" className="form-control" maxLength={10} value={f.area}
                        onChange={(e) => set("area", e.target.value)} onKeyPress={addrKey} /></div>
                    <div className="col-sm-2 col-xs-12"><b>Agreement Start Date: *</b>
                      <input type="date" className="form-control date-picker1" value={(() => {
                        const m = f.start.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                        return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
                      })()} onChange={(e) => {
                        const m = (e.target.value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
                        set("start", m ? `${m[3]}/${m[2]}/${m[1]}` : "");
                      }} /></div>
                    <div className="col-sm-2 col-xs-12"><b>Agreement End Date : *</b>
                      <input type="date" className="form-control date-picker2" value={(() => {
                        const m = f.end.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
                        return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
                      })()} onChange={(e) => {
                        const m = (e.target.value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
                        set("end", m ? `${m[3]}/${m[2]}/${m[1]}` : "");
                      }} /></div>
                  </div>
                  <div className="row">
                    <div className="col-sm-2 col-xs-12"><b>Vendor Id : *</b>
                      <input type="text" className="form-control" maxLength={10} value={f.vendor_id2}
                        onChange={(e) => set("vendor_id2", e.target.value)} onKeyPress={addrKey} /></div>
                    <div className="col-sm-8 col-xs-12"><b>Terms & Conditions :</b>
                      <textarea className="form-control" rows={8} style={{ height: 180 }} value={f.terms}
                        onChange={(e) => set("terms", e.target.value)} /></div>
                  </div>
                </div>
              </Box>
            )}
            {hidtab === "home" && (
              <Box>
                <h4 style={{ textAlign: "center" }}>All Taxes</h4>
                <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div className="col-sm-3 col-xs-12"><b>GST IN : *</b>
                    <input type="text" className="form-control" maxLength={15} value={f.gst}
                      onChange={(e) => set("gst", e.target.value)} /></div>
                  <div className="col-sm-3 col-xs-12"><b>PAN No :</b>
                    <input type="text" className="form-control" maxLength={10} value={f.pan}
                      onChange={(e) => set("pan", e.target.value)} /></div>
                  <div className="col-sm-3 col-xs-12"><b>Service Type : *</b>
                    <input type="text" className="form-control" maxLength={15} value={f.service_type}
                      onChange={(e) => set("service_type", e.target.value)} /></div>
                  <div className="col-sm-3 col-xs-12"><b>Active Status :</b>
                    <select className="form-control" value={f.active} onChange={(e) => set("active", e.target.value)}>
                      <option value="A">Active</option><option value="D">Deactive</option>
                    </select></div>
                  <div className="col-sm-3 col-xs-12"><b>Total Dues :</b>
                    <input type="text" className="form-control" maxLength={10} value={f.dues}
                      onChange={(e) => set("dues", e.target.value)} onKeyPress={numKey} /></div>
                  <div className="col-sm-3 col-xs-12"><b>Opening Balance :</b>
                    <input type="text" className="form-control" maxLength={10} value={f.opening}
                      onChange={(e) => set("opening", e.target.value)} onKeyPress={numKey} /></div>
                  <div className="col-sm-3 col-xs-12"><b>Registration Number :</b>
                    <input type="text" className="form-control" value={f.reg_no}
                      onChange={(e) => set("reg_no", e.target.value)} /></div>
                  <div className="col-sm-3 col-xs-12"><b>SAC Code :</b>
                    <input type="text" className="form-control" value={f.sac}
                      onChange={(e) => set("sac", e.target.value)} /></div>
                  <div className="col-sm-3 col-xs-12"><b>File Upload : *</b>
                    <input type="file" accept=".jpg,.jpeg,.gif,.pdf,.png"
                      onChange={(e) => {
                        const fl = e.target.files?.[0];
                        if (!fl) { setTaxFile(null); return; }
                        const ok = [".jpg", ".jpeg", ".gif", ".pdf", ".png"].some((x) => fl.name.toLowerCase().endsWith(x));
                        if (!ok) { window.alert(`Sorry, ${fl.name} is invalid, allowed extensions are: .jpg, .jpeg, .gif, .pdf, .png`); return; }
                        setTaxFile(fl);
                      }} />
                    <div style={{ fontSize: 11 }}>JPEG JPG GIF PDF PNG</div></div>
                </div>
              </Box>
            )}
            {hidtab === "menu1" && (
              <Box>
                <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div className="col-sm-3 col-xs-12"><b>Attention :</b>
                    <input type="text" className="form-control" maxLength={70} value={f.bill_attention}
                      onChange={(e) => set("bill_attention", e.target.value)} onKeyPress={alphaKey} /></div>
                  <div className="col-sm-3 col-xs-12"><b>Country : *</b>
                    <input type="text" className="form-control" maxLength={50} value={f.bill_country}
                      onChange={(e) => set("bill_country", e.target.value)} onKeyPress={alphaKey} /></div>
                  <div className="col-sm-3 col-xs-12"><b>State : *</b>
                    <select className="form-control" value={f.bill_state} onChange={(e) => {
                      set("bill_state", e.target.value); set("bill_city", SEL); loadCities(e.target.value);
                    }}>
                      {states.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                    </select></div>
                  <div className="col-sm-3 col-xs-12"><b>City : *</b>
                    <select className="form-control" value={f.bill_city} onChange={(e) => set("bill_city", e.target.value)}>
                      {citiesDD.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                    </select></div>
                  <div className="col-sm-3 col-xs-12"><b>Zip code :</b>
                    <input type="text" className="form-control" maxLength={6} value={f.bill_zip}
                      onChange={(e) => set("bill_zip", e.target.value)} onKeyPress={numKey} /></div>
                  <div className="col-sm-3 col-xs-12"><b>Address : *</b>
                    <textarea className="form-control" rows={4} maxLength={100} placeholder="Street1" value={f.bill_address}
                      onChange={(e) => set("bill_address", e.target.value)} onKeyPress={addrKey} /></div>
                  <div className="col-sm-3 col-xs-12"><b>Fax :</b>
                    <input type="text" className="form-control" maxLength={20} value={f.bill_fax}
                      onChange={(e) => set("bill_fax", e.target.value)} onKeyPress={numKey} /></div>
                </div>
              </Box>
            )}
            {hidtab === "menu4" && (
              <Box>
                <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div className="col-sm-3 col-xs-12"><b>Bank Name : *</b>
                    <input type="text" className="form-control" maxLength={30} value={f.bank_name}
                      onChange={(e) => set("bank_name", e.target.value)} onKeyPress={alphaKey} /></div>
                  <div className="col-sm-3 col-xs-12"><b>Vendor Bank Account Name : *</b>
                    <input type="text" className="form-control" maxLength={60} value={f.bank_acc_name}
                      onChange={(e) => set("bank_acc_name", e.target.value)} onKeyPress={alphaKey} /></div>
                  <div className="col-sm-3 col-xs-12"><b>Account Number : *</b>
                    <input type="text" className="form-control" maxLength={30} value={f.acc_no}
                      onChange={(e) => set("acc_no", e.target.value)} /></div>
                  <div className="col-sm-3 col-xs-12"><b>IFSC Code : *</b>
                    <input type="text" className="form-control" maxLength={15} value={f.ifsc}
                      onChange={(e) => set("ifsc", e.target.value)} onKeyPress={addrKey} /></div>
                  <div className="col-sm-3 col-xs-12"><b>File to Upload : Only JPG,JPEG,GIF,PDF</b>
                    <input type="file" accept=".jpg,.jpeg,.gif,.pdf,.png"
                      onChange={(e) => {
                        const fl = e.target.files?.[0];
                        if (!fl) { setBankFile(null); return; }
                        const ok = [".jpg", ".jpeg", ".gif", ".pdf", ".png"].some((x) => fl.name.toLowerCase().endsWith(x));
                        if (!ok) { window.alert(`Sorry, ${fl.name} is invalid, allowed extensions are: .jpg, .jpeg, .gif, .pdf, .png`); return; }
                        setBankFile(fl);
                      }} /></div>
                </div>
              </Box>
            )}
            {hidtab === "menu2" && (
              <Box>
                <table id="maintable" className="main_table" style={{ width: "100%" }}>
                  <thead><tr>
                    {["Salutation", "First Name", "Last Name", "Email Address", "Work Phone", "Contact Number", "Designation", "Department", "Add Row"].map((h) => <th key={h}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    <tr>
                      <td><select className="form-control" value={crow.salutation} onChange={(e) => setC("salutation", e.target.value)}>
                        {SALUTS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select></td>
                      <td><input type="text" className="form-control" maxLength={50} value={crow.firstname}
                        onChange={(e) => setC("firstname", e.target.value)} onKeyPress={alphaKey} /></td>
                      <td><input type="text" className="form-control" maxLength={50} value={crow.lastname}
                        onChange={(e) => setC("lastname", e.target.value)} onKeyPress={alphaKey} /></td>
                      <td><input type="text" className="form-control" maxLength={100} value={crow.email}
                        onChange={(e) => setC("email", e.target.value)} onKeyPress={emailKey} /></td>
                      <td><input type="text" className="form-control" maxLength={10} value={crow.workphone}
                        onChange={(e) => setC("workphone", e.target.value)} onKeyPress={numKey} /></td>
                      <td><input type="text" className="form-control" maxLength={10} value={crow.mobileno}
                        onChange={(e) => setC("mobileno", e.target.value)} onKeyPress={numKey} /></td>
                      <td><input type="text" className="form-control" maxLength={50} value={crow.designation}
                        onChange={(e) => setC("designation", e.target.value)} /></td>
                      <td><input type="text" className="form-control" maxLength={50} value={crow.department}
                        onChange={(e) => setC("department", e.target.value)} /></td>
                      <td><button type="button" onClick={addContact} title="Add Item" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20 }}>➕</button></td>
                    </tr>
                    {contacts.map((c, i) => (
                      <tr key={i}>
                        <td>{c.salutation}</td><td>{c.firstname}</td><td>{c.lastname}</td><td>{c.email}</td>
                        <td>{c.workphone}</td><td>{c.mobileno}</td><td>{c.designation}</td><td>{c.department}</td>
                        <td><button type="button" onClick={() => setContacts((p) => p.filter((_, j) => j !== i))}
                          style={{ background: "none", border: "none", cursor: "pointer" }}>❌</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Box>
            )}
            {hidtab === "menu5" && (
              <StateTab vendId={f.vend_id} show={show} />
            )}
            {hidtab === "home1" && (
              <WeightTab show={show} />
            )}
            {hidtab === "home2" && (
              <RateTab show={show} />
            )}
            {hidtab === "home3" && (
              <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div className="col-sm-3 col-xs-12"><b>Vendor Having Client</b>
                  <select multiple className="form-control" style={{ height: 150 }} value={assign.filter((r) => (r as any)._sel).map((r) => String(val(r, "client_code")))}
                    onChange={(e) => {
                      const sel = Array.from(e.target.selectedOptions).map((o) => o.value);
                      const next = assign.map((r) => ({ ...r, _sel: sel.includes(String(val(r, "client_code"))) }));
                      setAssign(next);
                    }}>
                    {assign.map((r) => <option key={String(val(r, "client_code"))} value={String(val(r, "client_code"))}>{String(val(r, "client_name"))}</option>)}
                  </select></div>
                <div className="col-sm-2 col-xs-12" style={{ alignSelf: "center" }}>
                  <button type="button" className="it-btn" onClick={async () => {
                    for (const r of assign.filter((x) => (x as any)._sel)) {
                      const resp = await mk(`${BASE}/client-unassign/`, { vend_id: f.vend_id, client_code: val(r, "client_code") });
                      if (resp.ok) { window.alert("Vendor Client Assign Removed Successfully..."); }
                      else { const t = await errText(resp, "Remove failed"); window.alert(t); }
                    }
                    if (f.vend_id) select(f.vend_id, f.vend_name);
                  }}>Remove Client Assign</button></div>
                <div className="col-sm-3 col-xs-12"><b>Vendor Not Having Client</b>
                  <select multiple className="form-control" style={{ height: 150 }}
                    onChange={(e) => {
                      const sel = Array.from(e.target.selectedOptions).map((o) => o.value);
                      const next = notassign.map((r) => ({ ...r, _sel: sel.includes(String(val(r, "client_code"))) }));
                      setNotassign(next);
                    }}>
                    {notassign.map((r) => <option key={String(val(r, "client_code"))} value={String(val(r, "client_code"))}>{String(val(r, "client_name"))}</option>)}
                  </select></div>
              </div>
            )}
            {hidtab === "menu6" && (
              <CompanyBankTab vendId={f.vend_id} show={show} />
            )}
            {hidtab === "menu8" && (
              <TdsTab vendId={f.vend_id} vendName={f.vend_name} show={show} />
            )}
            {hidtab === "menu7" && (
              <MsmeTab show={show} />
            )}
          </div>
        </div>
      </div>
      <div className="mseb_hide" style={{ marginTop: 12 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
          <button type="button" className="it-btn" onClick={save}>Save</button>
          <button type="button" className="it-btn" onClick={update}>Update</button>
          <button type="button" className="it-btn" onClick={del}>Delete</button>
          <button type="button" className="it-btn" onClick={clear}>Clear</button>
          <button type="button" className="it-btn" style={{ width: 180 }} onClick={expo}>Export To Excel</button>
          <button type="button" className="btn btn-danger" onClick={() => { window.location.href = "/Home"; }}>Close</button>
        </div>
        <br />
        <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <div className="col-sm-2 col-xs-12"><b>Vendor Type</b>
            <select className="form-control" value={ftype} onChange={(e) => { setFtype(e.target.value); loadGrid(); }}>
              <option value="0">Select</option><option value="1">Electrical</option><option value="2">Plumbing</option>
              <option value="3">Carpentry</option><option value="4">Civil</option><option value="5">Pest Control</option>
              <option value="6">HVAC</option>
            </select></div>
          <div className="col-sm-2 col-xs-12"><b>State</b>
            <select className="form-control" value={fstate} onChange={(e) => { setFstate(e.target.value); loadGrid(); }}>
              <option value="">Select</option>
              {states.filter((s) => s.v !== SEL).map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select></div>
          <div className="col-sm-2 col-xs-12"><b>City</b>
            <select className="form-control" value={fcity} onChange={(e) => { setFcity(e.target.value); loadGrid(); }}>
              <option value="">Select</option>
              {citiesDD.filter((s) => s.v !== SEL).map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
            </select></div>
        </div>
        <br />
        <div className="container-fluid" style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: 10, padding: 25, marginLeft: 5, marginRight: 5, marginBottom: 20, marginTop: 20 }}>
          <MainGrid rows={grid} select={select} />
        </div>
      </div>
    </div>
  );
}

/* ---- sub components (need show) ---- */
function StateTab({ vendId, show }: { vendId: string; show: (t: string, ok?: boolean) => void }) {
  const [states, setStates] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [state, setState] = useState(SEL);
  const [have, setHave] = useState<Row[]>([]);
  const [nothave, setNothave] = useState<Row[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const load = async () => {
    const st = await getJSON<{ results: Row[] }>(`${BASE}/states/`);
    if (st) setStates([{ v: SEL, t: SEL }, { v: ALL, t: ALL },
      ...(((st?.results ?? []) as Row[]).map((s) => ({ v: String(val(s, "code")), t: String(val(s, "state")) })))]);
    const g = await getJSON<{ results: Row[] }>(`${BASE}/vendor-states/?vend_id=${encodeURIComponent(vendId)}`);
    if (g) {
      setRows(((g?.results ?? []) as Row[]));
      setHave((((g?.results ?? []) as Row[]).map((r) => ({ city: String(val(r, "city")) }))));
    }
    if (state && state !== SEL) {
      const c = await getJSON<{ results: Row[] }>(
        `${BASE}/state-cities/?state=${encodeURIComponent(state)}&vend_id=${encodeURIComponent(vendId)}`);
      if (c) {
        const cl: Row[] = ((c?.results ?? []) as Row[]);
        setNothave(cl.map((r) => ({ city: String(val(r, "city")) })));
      }
    }
  };
  useEffect(() => { load(); }, [vendId, state]);
  void show;
  return (
    <div>
      <h4><u>State</u></h4>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div className="col-sm-2 col-xs-12"><b>State :</b>
          <select className="form-control" value={state} onChange={(e) => setState(e.target.value)}>
            {states.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-3 col-xs-12"><b>Vendor Having City :</b>
          <select multiple className="form-control" style={{ height: 150 }}>
            {have.map((r, i) => <option key={i} value={String(val(r, "city"))}>{String(val(r, "city"))}</option>)}
          </select></div>
        <div className="col-sm-3 col-xs-12"><b>Vendor Not Having City :</b>
          <select multiple className="form-control" style={{ height: 150 }}>
            {nothave.map((r, i) => <option key={i} value={String(val(r, "city"))}>{String(val(r, "city"))}</option>)}
          </select></div>
      </div>
      <br />
      <div style={{ overflowX: "auto" }}>
        <table className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
          <thead><tr><th></th><th>Sr No.</th><th>State</th><th>City</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}><td></td><td>{i + 1}</td><td>{val(r, "state")}</td><td>{val(r, "city")}</td></tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function WeightTab({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [w, setW] = useState({ courier: SEL, wait: SEL, fw: SEL, tw: SEL, fkm: SEL, tkm: SEL, rate: "" });
  const [rows, setRows] = useState<Row[]>([]);
  const set = (k: keyof typeof w, v: string) => setW((p) => ({ ...p, [k]: v }));
  const load = async () => {
    const d = await getJSON<{ results: Row[] }>(`${BASE}/weight-grid/`);
    setRows(((d?.results ?? []) as Row[]));
  };
  useEffect(() => { load(); }, []);
  const add = async () => {
    // wait_tab()
    if (!w.courier || w.courier === SEL) { window.alert("Please Select Courier Type... "); return; }
    if (!w.wait || w.wait === SEL) { window.alert("Please Select Weight... "); return; }
    if (!w.fw || w.fw === SEL) { window.alert("Please Select From Weight... "); return; }
    if (!w.tw || w.tw === SEL) { window.alert("Please Select To Weight... "); return; }
    if (!w.fkm || w.fkm === SEL) { window.alert("Please Select From Km... "); return; }
    if (!w.tkm || w.tkm === SEL) { window.alert("Please Select To Km... "); return; }
    if (!w.rate) { window.alert("Please Select Rate "); return; }
    const r = await mk(`${BASE}/weight-add/`, w);
    if (r.ok) { window.alert(" Courier weight Successfully Added.. !!!"); show(" Courier weight Successfully Added.. !!!", true); load(); }
    else { const t = await errText(r, "Save failed"); window.alert(t); show(t, false); }
  };
  const del = async (id: any) => {
    await mk(`${BASE}/weight-delete/`, { id });
    load();
  };
  const cols = ["courier_type", "wait", "from_wait", "to_wait", "from_km", "to_km", "rate"];
  return (
    <div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="col-sm-2 col-xs-12"><b>Courier Type *</b>
          <select className="form-control" value={w.courier} onChange={(e) => set("courier", e.target.value)}>
            {COURIER.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Weight *</b>
          <select className="form-control" value={w.wait} onChange={(e) => set("wait", e.target.value)}>
            {WEIGHTS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>From Weight *</b>
          <select className="form-control" value={w.fw} onChange={(e) => set("fw", e.target.value)}>
            {STEPS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>To Weight *</b>
          <select className="form-control" value={w.tw} onChange={(e) => set("tw", e.target.value)}>
            {BIGSTEPS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>From Km *</b>
          <select className="form-control" value={w.fkm} onChange={(e) => set("fkm", e.target.value)}>
            {STEPS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>To Km *</b>
          <select className="form-control" value={w.tkm} onChange={(e) => set("tkm", e.target.value)}>
            {BIGSTEPS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Rate *</b>
          <input type="text" className="form-control" value={w.rate} onChange={(e) => set("rate", e.target.value)} onKeyPress={numKey} /></div>
        <div className="col-sm-1 col-xs-12"><button type="button" onClick={add} title="Add" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20 }}>➕</button></div>
      </div>
      <br />
      <div style={{ overflowX: "auto" }}>
        <table className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
          <thead><tr><th></th><th>Sr No.</th><th>Id</th>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={val(r, "id") || i}>
                <td><button type="button" onClick={() => del(val(r, "id"))} style={{ background: "none", border: "none", cursor: "pointer" }}>❌</button></td>
                <td>{i + 1}</td><td>{val(r, "id")}</td>
                {cols.map((c) => <td key={c}>{val(r, c)}</td>)}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function RateTab({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [itype, setItype] = useState(SEL);
  const [icode, setIcode] = useState(SEL);
  const [codes, setCodes] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [size, setSize] = useState("");
  const [rate, setRate] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const load = async () => {
    const d = await getJSON<{ results: Row[] }>(`${BASE}/rate-grid/`);
    setRows(((d?.results ?? []) as Row[]));
  };
  useEffect(() => { load(); }, []);
  useEffect(() => {
    (async () => {
      if (!itype || itype === SEL) { setCodes([{ v: SEL, t: SEL }]); return; }
      const d = await getJSON<{ results: Row[] }>(`${BASE}/item-codes/?item_type=${encodeURIComponent(itype)}`);
      const list = ((d?.results ?? []) as Row[]);
      setCodes([{ v: SEL, t: SEL }, ...list.map((c) => ({ v: String(val(c, "code")), t: String(val(c, "code")) }))]);
    })();
  }, [itype]);
  useEffect(() => {
    (async () => {
      if (!icode || icode === SEL) { setSize(""); return; }
      const d = await getJSON<any>(`${BASE}/item-size/?item_type=${encodeURIComponent(itype)}&item_code=${encodeURIComponent(icode)}`);
      setSize(String((d as any)?.size ?? ""));
    })();
  }, [icode, itype]);
  const add = async () => {
    // rate_tab()
    if (!itype || itype === SEL) { window.alert("Please Select Item Type... "); return; }
    if (!icode || icode === SEL) { window.alert("Please Select Item Code... "); return; }
    if (!rate) { window.alert("Please Select Rate "); return; }
    const r = await mk(`${BASE}/rate-add/`, { item_type: itype, item_code: icode, item_size: size, rate });
    if (r.ok) { window.alert(" Courier rate Successfully Added.. !!!"); show(" Courier rate Successfully Added.. !!!", true); load(); }
    else { const t = await errText(r, "Save failed"); window.alert(t); show(t, false); }
  };
  const del = async (id: any) => {
    await mk(`${BASE}/rate-delete/`, { id });
    load();
  };
  return (
    <div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="col-sm-2 col-xs-12"><b>Item Type *</b>
          <select className="form-control" value={itype} onChange={(e) => { setItype(e.target.value); setIcode(SEL); }}>
            {ITEM_TYPES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Item Code *</b>
          <select className="form-control" value={icode} onChange={(e) => setIcode(e.target.value)}>
            {codes.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-2 col-xs-12"><b>Item Size *</b>
          <input type="text" className="form-control" value={size} readOnly /></div>
        <div className="col-sm-2 col-xs-12"><b>Rate *</b>
          <input type="text" className="form-control" value={rate} onChange={(e) => setRate(e.target.value)} onKeyPress={numKey} /></div>
        <div className="col-sm-1 col-xs-12"><button type="button" onClick={add} title="Add" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20 }}>➕</button></div>
      </div>
      <br />
      <div style={{ overflowX: "auto" }}>
        <table className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
          <thead><tr><th></th><th>Sr No.</th><th>id</th><th>item_type</th><th>item_code</th><th>item_size</th><th>rate</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={val(r, "id") || i}>
                <td><button type="button" onClick={() => del(val(r, "id"))} style={{ background: "none", border: "none", cursor: "pointer" }}>❌</button></td>
                <td>{i + 1}</td><td>{val(r, "id")}</td><td>{val(r, "item_type")}</td>
                <td>{val(r, "item_code")}</td><td>{val(r, "item_size")}</td><td>{val(r, "rate")}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function CompanyBankTab({ vendId, show }: { vendId: string; show: (t: string, ok?: boolean) => void }) {
  const [banks, setBanks] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [bank, setBank] = useState(SEL);
  const [ac, setAc] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const load = async () => {
    const b = await getJSON<{ results: Row[] }>(`${BASE}/zone-banks/`);
    if (b) setBanks([{ v: SEL, t: SEL },
      ...(((b?.results ?? []) as Row[]).map((x) => ({ v: String(val(x, "name")), t: String(val(x, "name")) })))]);
    const d = await getJSON<{ results: Row[] }>(`${BASE}/company-bank-grid/?vend_id=${encodeURIComponent(vendId)}`);
    if (d) setRows(((d?.results ?? []) as Row[]));
  };
  useEffect(() => { load(); }, [vendId]);
  const pick = async (v: string) => {
    setBank(v);
    if (!v || v === SEL) { setAc(""); return; }
    const d = await getJSON<any>(`${BASE}/zone-bank-ac/?bank=${encodeURIComponent(v)}`);
    setAc(String((d as any)?.ac ?? ""));
  };
  const add = async () => {
    // plus_validation()
    if (!bank || bank === SEL) { window.alert("Please Select Bank..!!"); return; }
    if (!vendId) { window.alert("Please Enter Vendor Name"); return; }
    const r = await mk(`${BASE}/company-bank-add/`, { bank, ac_no: ac, vend_id: vendId });
    if (r.ok) { window.alert(" Company Bank Details Successfully Added... !!!"); show(" Company Bank Details Successfully Added... !!!", true); load(); }
    else { const t = await errText(r, "Save failed"); window.alert(t); show(t, false); }
  };
  const del = async (id: any) => {
    // R_validation() confirm
    if (!window.confirm("Are you Sure You Want to Delete Record")) { window.alert("Record not Available"); return; }
    await mk(`${BASE}/company-bank-delete/`, { id });
    load();
  };
  return (
    <div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="col-sm-3 col-xs-12"><b>Payment Against Bank</b>
          <select className="form-control" value={bank} onChange={(e) => pick(e.target.value)}>
            {banks.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-3 col-xs-12"><b>Company A/C No</b>
          <input type="text" className="form-control" value={ac} readOnly /></div>
        <div className="col-sm-1 col-xs-12"><button type="button" onClick={add} title="Add" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20 }}>➕</button></div>
      </div>
      <br />
      <div className="grid-view">
        <table className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
          <thead><tr><th></th><th>Sr No.</th><th>id</th><th>Payment Against Bank</th><th>Company A/C No</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={val(r, "id") || i}>
                <td><button type="button" onClick={() => del(val(r, "id"))} style={{ background: "none", border: "none", cursor: "pointer" }}>❌</button></td>
                <td>{i + 1}</td><td>{val(r, "id")}</td><td>{val(r, "payment_ag_bank")}</td><td>{val(r, "company_ac_no")}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function TdsTab({ vendId, vendName, show }: { vendId: string; vendName: string; show: (t: string, ok?: boolean) => void }) {
  const [codes, setCodes] = useState<Opt[]>([{ v: SEL, t: SEL }]);
  const [code, setCode] = useState(SEL);
  const [rate, setRate] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const load = async () => {
    const c = await getJSON<{ results: Row[] }>(`${BASE}/tds-codes/`);
    if (c) setCodes([{ v: SEL, t: SEL },
      ...(((c?.results ?? []) as Row[]).map((x) => ({ v: String(val(x, "code")), t: String(val(x, "code")) })))]);
    const d = await getJSON<{ results: Row[] }>(`${BASE}/tds-grid/?vend_id=${encodeURIComponent(vendId)}`);
    if (d) setRows(((d?.results ?? []) as Row[]));
  };
  useEffect(() => { load(); }, [vendId]);
  const pick = async (v: string) => {
    setCode(v);
    if (!v || v === SEL) { setRate(""); return; }
    const d = await getJSON<any>(`${BASE}/tds-rate/?code=${encodeURIComponent(v)}`);
    setRate(String((d as any)?.rate ?? ""));
  };
  const add = async () => {
    // tds_validation()
    if (!vendName && !vendId) { window.alert("Please Enter Vendor Name"); return; }
    if (!code || code === SEL) { window.alert("Please Select TDS Code"); return; }
    if (!rate) { window.alert("Please Enter TDS Rate"); return; }
    const r = await mk(`${BASE}/tds-add/`, { vend_id: vendId, vend_name: vendName, tax_code: code, rate });
    if (r.ok) { window.alert(" TDS Details Added Successfully.. !!!"); show(" TDS Details Added Successfully.. !!!", true); load(); }
    else { const t = await errText(r, "Save failed"); window.alert(t); show(t, false); }
  };
  const del = async (id: any) => {
    await mk(`${BASE}/tds-delete/`, { id });
    load();
  };
  return (
    <div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="col-sm-3 col-xs-12"><b>TDS Code</b>
          <select className="form-control" value={code} onChange={(e) => pick(e.target.value)}>
            {codes.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></div>
        <div className="col-sm-3 col-xs-12"><b>TDS Rate *</b>
          <input type="text" className="form-control" value={rate} readOnly onKeyPress={addrKey} /></div>
        <div className="col-sm-1 col-xs-12"><button type="button" onClick={add} title="Add" style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20 }}>➕</button></div>
      </div>
      <br />
      <div className="grid-view">
        <table className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
          <thead><tr><th></th><th>Sr No.</th><th>id</th><th>vendor_code</th><th>vendor_name</th><th>tax_code</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={val(r, "id") || i}>
                <td><button type="button" onClick={() => del(val(r, "id"))} style={{ background: "none", border: "none", cursor: "pointer" }}>❌</button></td>
                <td>{i + 1}</td><td>{val(r, "id")}</td><td>{val(r, "vendor_code")}</td>
                <td>{val(r, "vendor_name")}</td><td>{val(r, "tax_code")}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function MsmeTab({ show }: { show: (t: string, ok?: boolean) => void }) {
  const [m, setM] = useState({ enterprise: SEL, manufacturing: SEL, services: SEL, service_code: "", udyog: "", name: "", commence: "", nic2: "", nic4: "", filing: "" });
  const [rows, setRows] = useState<Row[]>([]);
  const [selUdyog, setSelUdyog] = useState("");
  const set = (k: keyof typeof m, v: string) => setM((p) => ({ ...p, [k]: v }));
  const load = async () => {
    const d = await getJSON<{ results: Row[] }>(`${BASE}/msme-grid/`);
    setRows(((d?.results ?? []) as Row[]));
  };
  useEffect(() => { load(); }, []);
  // msme_validation()
  const valid = () => {
    if (!m.enterprise || m.enterprise === SEL) { window.alert("Please Select Type of Enterprise"); return false; }
    if (!m.manufacturing || m.manufacturing === SEL) { window.alert("Please Select Manufacturing"); return false; }
    if (!m.services || m.services === SEL) { window.alert("Please Select Vendor Services"); return false; }
    if (!m.service_code) { window.alert("Please Enter the Service Code"); return false; }
    if (!m.udyog) { window.alert("Please Enter the Udyog Aadhaar Number"); return false; }
    if (!m.name) { window.alert("Please Enter the Enterprise Name"); return false; }
    if (!m.commence) { window.alert("Please Enter the Commencement Date"); return false; }
    if (!m.nic2) { window.alert("Please Enter the NIC Two Digit"); return false; }
    if (!m.nic4) { window.alert("Please Enter the NIC Four Digit"); return false; }
    if (!m.filing) { window.alert("Please Enter the Date Filing"); return false; }
    return true;
  };
  const save = async () => {
    if (!valid()) return;
    const r = await mk(`${BASE}/msme-save/`, m);
    if (r.ok) { window.alert("Record added successfully!!"); show("Record added successfully!!", true); load(); }
    else { const t = await errText(r, "Save failed"); window.alert(t); show(t, false); }
  };
  const update = async () => {
    if (!valid()) return;
    const r = await mk(`${BASE}/msme-update/`, { ...m, id: selUdyog });
    if (r.ok) { window.alert("Record Updated Succsefully"); show("Record Updated Succsefully", true); load(); }
    else { const t = await errText(r, "Update failed"); window.alert(t); show(t, false); }
  };
  const pick = (r: Row) => {
    setM({
      enterprise: String(val(r, "type_of_enterprise") || SEL),
      manufacturing: String(val(r, "manufacturing") || SEL),
      services: String(val(r, "services") || SEL),
      service_code: String(val(r, "service_code") ?? ""),
      udyog: String(val(r, "udyog_aadhaar_no") ?? ""),
      name: String(val(r, "name_of_enterprise") ?? ""),
      commence: String(val(r, "date_of_commencement") ?? ""),
      nic2: String(val(r, "nic_two_digit") ?? ""),
      nic4: String(val(r, "nic_four_digit") ?? ""),
      filing: String(val(r, "date_of_filing") ?? ""),
    });
    setSelUdyog(String(val(r, "udyog_aadhaar_no") ?? ""));
  };
  const cols = ["ID", "Type", "Manufacturing", "Services", "Service Code", "Udyog No", "Enterprise Name",
    "Commencement", "NIC2", "NIC4", "Filing"];
  const mm: Record<string, string> = { "ID": "id", "Type": "type_of_enterprise", "Manufacturing": "manufacturing", "Services": "services", "Service Code": "service_code", "Udyog No": "udyog_aadhaar_no", "Enterprise Name": "name_of_enterprise", "Commencement": "date_of_commencement", "NIC2": "nic_two_digit", "NIC4": "nic_four_digit", "Filing": "date_of_filing" };
  const S = (v: string, opts: string[]) => (
    <select className="form-control" value={v} onChange={(e) => set(opts[0] as keyof typeof m, e.target.value)}>
      <option value={SEL}>{SEL}</option>
      {opts.slice(1).map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
  return (
    <div>
      <div className="row" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div className="col-sm-2 col-xs-12"><b>Type of Enterprise *</b>
          {S(m.enterprise, ["enterprise", SEL, "Micro", "Small", "Medium"])}</div>
        <div className="col-sm-2 col-xs-12"><b>Manufacturing *</b>
          {S(m.manufacturing, ["manufacturing", SEL, "A", "B", "C"])}</div>
        <div className="col-sm-2 col-xs-12"><b>Services *</b>
          {S(m.services, ["services", SEL, "D", "E", "F"])}</div>
        <div className="col-sm-2 col-xs-12"><b>Service Code *</b>
          <input type="text" className="form-control" value={m.service_code} onChange={(e) => set("service_code", e.target.value)} /></div>
        <div className="col-sm-2 col-xs-12"><b>Udyog Aadhaar *</b>
          <input type="text" className="form-control" value={m.udyog} onChange={(e) => set("udyog", e.target.value)} onKeyPress={addrKey} /></div>
        <div className="col-sm-2 col-xs-12"><b>Enterprise Name *</b>
          <input type="text" className="form-control" value={m.name} onChange={(e) => set("name", e.target.value)} onKeyPress={addrKey} /></div>
        <div className="col-sm-2 col-xs-12"><b>Commencement *</b>
          <input type="date" className="form-control date-picker1" value={(() => {
            const x = m.commence.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            return x ? `${x[3]}-${x[2]}-${x[1]}` : "";
          })()} onChange={(e) => {
            const x = (e.target.value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
            set("commence", x ? `${x[3]}/${x[2]}/${x[1]}` : "");
          }} /></div>
        <div className="col-sm-2 col-xs-12"><b>NIC Two *</b>
          <input type="text" className="form-control" value={m.nic2} onChange={(e) => set("nic2", e.target.value)} /></div>
        <div className="col-sm-2 col-xs-12"><b>NIC Four *</b>
          <input type="text" className="form-control" value={m.nic4} onChange={(e) => set("nic4", e.target.value)} /></div>
        <div className="col-sm-2 col-xs-12"><b>Filing *</b>
          <input type="date" className="form-control date-picker1" value={(() => {
            const x = m.filing.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
            return x ? `${x[3]}-${x[2]}-${x[1]}` : "";
          })()} onChange={(e) => {
            const x = (e.target.value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
            set("filing", x ? `${x[3]}/${x[2]}/${x[1]}` : "");
          }} /></div>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <button type="button" className="it-btn" onClick={save}>Save</button>
        <button type="button" className="it-btn" onClick={update}>Update</button>
        <button type="button" className="btn btn-danger" onClick={() => { window.location.href = "/Home"; }}>Close</button>
      </div>
      <br />
      <Exports id="gv_msme" cols={cols} rows={rows} cell={(r, c) => (c === "ID" ? val(r, "id") : val(r, mm[c]))} />
      <div className="grid-view">
        <table id="gv_msme" className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
          <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} onClick={() => pick(r)} style={{ cursor: "pointer" }}>
                {cols.map((c) => <td key={c}>{c === "ID" ? val(r, "id") : val(r, mm[c])}</td>)}
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={11} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
function MainGrid({ rows, select }: { rows: Row[]; select: (vid: string, vname: string) => void }) {
  const cols = ["COMP_CODE", "VEND_ID", "VEND_NAME", "PHONE1", "txtbillstate", "txtbillcity", "GST"];
  return (
    <div style={{ overflowX: "auto" }}>
      <Exports id="VendorGridView" cols={["Select", ...cols]} rows={rows}
        cell={(r, c) => (c === "Select" ? "" : val(r, c === "COMP_CODE" ? "COMP_CODE" : c))} />
      <table id="VendorGridView" className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
        <thead><tr><th>Select(&gt;)</th>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={val(r, "VEND_ID") || i} onClick={() => select(String(val(r, "VEND_ID")), String(val(r, "VEND_NAME")))} style={{ cursor: "pointer" }}>
              <td>&gt;</td>
              {cols.map((c) => <td key={c}>{val(r, c)}</td>)}
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
