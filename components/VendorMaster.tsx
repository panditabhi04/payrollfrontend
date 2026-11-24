"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DataTable, { DTColumn } from "./DataTable";
import { Field, Sel, Txt, Opt, errMsg } from "./formkit";
import { API_BASE_URL } from "@/lib/api/client";

interface VendorRow {
  id: number;
  comp_code: string;
  vend_id: string;
  vend_name: string;
  phone1: string;
  txtbillstate: string;
  txtbillcity: string;
  gst: string;
}

interface ContactRow {
  salutation: string;
  txtfirstname: string;
  txtlastname: string;
  txteaddress: string;
  txtworkphonno: string;
  txtmobileno: string;
  txtdesignation1: string;
  txtdept: string;
}

interface VendorDetail extends Record<string, any> {
  id: number;
  contacts: ContactRow[];
  cities: { state: string; city: string }[];
  client_codes: string[];
}

// Exact legacy ListItem Value/Text pairs (VendorMaster.aspx).
const NATION_OPTS: Opt[] = [
  { v: "0", t: "Select" },
  { v: "1", t: "Indian" },
  { v: "2", t: "International" },
];
const VTYPE_OPTS: Opt[] = [
  { v: "0", t: "Select" },
  { v: "1", t: "Private" },
  { v: "2", t: "Public" },
  { v: "3", t: "Company" },
  { v: "4", t: "Firm" },
  { v: "5", t: "Proprietorship" },
];
const CATEGORY_OPTS: Opt[] = [
  { v: "0", t: "Select" },
  { v: "Electrical", t: "Electrical" },
  { v: "Plumbing", t: "Plumbing" },
  { v: "Carpentry", t: "Carpentry" },
  { v: "Civil", t: "Civil" },
  { v: "Pest_Control", t: "Pest Control" },
  { v: "HVAC", t: "HVAC" },
  { v: "Stationery", t: "Stationery" },
  { v: "Chemical_Supplier", t: "Chemical Supplier" },
  { v: "Shoes", t: "Shoes" },
  { v: "Uniform", t: "Uniform" },
  { v: "Housekeeping_services", t: "Housekeeping services" },
  { v: "Courier", t: "Courier" },
  { v: "Other", t: "Other" },
];
const STATUS_OPTS: Opt[] = [
  { v: "A", t: "Active" },
  { v: "D", t: "Deactive" },
];
const SALUT_OPTS: Opt[] = [
  { v: "Select Salutation", t: "Select Salutation" },
  { v: "Mr.", t: "Mr." },
  { v: "Mrs.", t: "Mrs." },
  { v: "Ms.", t: "Ms." },
  { v: "Miss.", t: "Miss." },
  { v: "Dr.", t: "Dr." },
];
// Footer vendor-type filter (legacy ddl_typevendor): the TEXT is sent.
const FILTER_TYPES: Opt[] = [
  { v: "0", t: "Select" },
  { v: "Electrical", t: "Electrical" },
  { v: "Plumbing", t: "Plumbing" },
  { v: "Carpentry", t: "Carpentry" },
  { v: "Civil", t: "Civil" },
  { v: "Pest Control", t: "Pest Control" },
  { v: "HVAC", t: "HVAC" },
];

// Legacy keystroke masks (VendorMaster.aspx).
const allowAlphabet = (v: string) => v.replace(/[^A-Za-z.\s]/g, "");
const allowAlphabet1 = (v: string) => v.replace(/[^A-Za-z0-9]/g, "");
const allowAlphabet3 = (v: string) => v.replace(/[^A-Za-z.\s]/g, "");
const allowAlphabetAddr = (v: string) => v.replace(/[^A-Za-z0-9\s&,.\-/:;=\\]/g, "");
const isNumber = (v: string) => v.replace(/[^0-9]/g, "");
const isNumberTotal = (v: string) => v.replace(/[^0-9.]/g, "");
const emailKeys = (v: string) => v.replace(/[^A-Za-z0-9\s@,;.]/g, "");
const EMAIL_RE = /^([a-zA-Z0-9_.-])+@(([a-zA-Z0-9-])+.)+([a-zA-Z0-9]{2,4})+$/;

// Legacy ValidateSingleInput extension set (client onchange, both uploads).
const CLIENT_UP_EXTS = [".jpg", ".jpeg", ".gif", ".pdf", ".png"];

// Legacy Page_Load terms boilerplate (txt_terms_condition initial text).
const TERMS_DEFAULT = "1. Free of cost Delivery.\n 2. One Year Comprehensive warranty to be provided from the date of delivery.\n 3. Quarterly Inspection for the machine to be done for a period of one year.\n 4. GST/TAXS Including.\n 5. Commissioning & Training: Will be done by your Engineer at our site.\n 6. 24% Interest per annum will be charged on Invoice value if the same will not be received as per agreement terms from the date of Invoice.\n 7. Any Correction in Final Invoice will not be considered after 7 days from the date of Invoice.\n 8. This Transaction is subject to Courts In Pune Only.\n";

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

async function getJSON<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include", headers: { Accept: "application/json" }, cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

async function sendVendor(path: string, method: string, fields: Record<string, string>,
  contacts: ContactRow[], cities: { state: string; city: string }[],
  clientCodes: string[], bankFile: File | null, taxFile: File | null): Promise<Response> {
  await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
  const headers: Record<string, string> = {
    "X-CSRFToken": getCookie("csrftoken") ?? "",
  };
  let body: BodyInit;
  if (bankFile || taxFile) {
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.append(k, v ?? "");
    fd.append("contacts", JSON.stringify(contacts));
    fd.append("cities", JSON.stringify(cities));
    fd.append("client_codes", JSON.stringify(clientCodes));
    if (bankFile) fd.append("bank_file", bankFile);
    if (taxFile) fd.append("tax_file", taxFile);
    body = fd;
  } else {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify({ ...fields, contacts, cities, client_codes: clientCodes });
  }
  return await fetch(`${API_BASE_URL}${path}`, {
    method, credentials: "include", headers, body,
  });
}

async function delVendor(id: number): Promise<Response> {
  await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
  return await fetch(`${API_BASE_URL}/api/masters/vendors/${id}/`, {
    method: "DELETE",
    credentials: "include",
    headers: { "X-CSRFToken": getCookie("csrftoken") ?? "" },
  });
}

interface FormState { [k: string]: string }

const EMPTY: FormState = {
  vend_id: "", vend_name: "", vandor_type_nation: "0", vendor_type_na: "0",
  vend_add1: "", contact_person_1: "", phone1: "", contact_person_2: "", phone2: "",
  vendor_email_id: "", vendor_type: "0", credit_period: "", area_to_served: "",
  agrement_start_date: "", agrement_end_date: "", new_vendor_id: "",
  terms_and_conditions: TERMS_DEFAULT, gst: "", pan_no: "",
  vend_add2: "", active_status: "A", type: "", total_dues: "0", opening_balance: "0",
  sac_code: "", comp_registration_num: "", hsm_code: "",
  bank_name: "", bank_account_name: "", account_number: "", ifsc_code: "",
  txtbillattention: "", txtbillcountry: "", txtbillstate: "Select", txtbillcity: "Select",
  txtbillzipcode: "", txtbilladdress: "", txtbillfax: "",
  txtsattention: "", txtsaddress: "", txtssstate: "Select", txtscity: "Select",
  txtszipcode: "", txtscountry: "", txtsfax: "",
};

const EMPTY_CONTACT: ContactRow = {
  salutation: "Select Salutation", txtfirstname: "", txtlastname: "", txteaddress: "",
  txtworkphonno: "", txtmobileno: "", txtdesignation1: "", txtdept: "",
};

const textOf = (opts: Opt[], v: string) => opts.find((o) => o.v === v)?.t ?? v;

export function VendorMaster() {
  const [data, setData] = useState<VendorRow[]>([]);
  const [f, setF] = useState<FormState>({ ...EMPTY });
  const [selected, setSelected] = useState<VendorRow | null>(null);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [showContacts, setShowContacts] = useState(false);
  const [ci, setCi] = useState<ContactRow>({ ...EMPTY_CONTACT });
  const [assignedCities, setAssignedCities] = useState<{ state: string; city: string }[]>([]);
  const [cityState, setCityState] = useState("Select");
  const [cityPick, setCityPick] = useState<string[]>([]);
  const [clientOpts, setClientOpts] = useState<Opt[]>([]);
  const [clientPick, setClientPick] = useState<string[]>([]);
  const [assignedClients, setAssignedClients] = useState<string[]>([]);
  const [bankFile, setBankFile] = useState<File | null>(null);
  const [taxFile, setTaxFile] = useState<File | null>(null);
  const [states, setStates] = useState<{ name: string; code: string }[]>([]);
  const [stateCities, setStateCities] = useState<Record<string, string[]>>({});
  const [fltType, setFltType] = useState("0");
  const [fltState, setFltState] = useState("Select");
  const [fltCity, setFltCity] = useState("Select");

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const loadGrid = (t = fltType, s = fltState, c = fltCity) => {
    const q = new URLSearchParams();
    if (t !== "0") q.set("vendor_type", FILTER_TYPES.find((o) => o.v === t)?.t ?? t);
    if (s !== "Select") q.set("state", s);
    if (c !== "Select") q.set("city", c);
    q.set("page_size", "all");
    getJSON<{ results: VendorRow[] }>(`/api/masters/vendors/?${q.toString()}`)
      .then((d) => setData(d?.results ?? []));
  };

  const fetchNewId = () => {
    getJSON<{ vend_id: string }>(`/api/masters/vendors/new-vendor-id/`)
      .then((d) => setF((p) => ({ ...p, vend_id: d?.vend_id ?? "" })));
  };

  const refreshClients = () => {
    getJSON<{ client_name: string; client_code: string }[]>(`/api/masters/vendor-clients-lookup/`)
      .then((d) => setClientOpts((d ?? []).map((r) => ({ v: r.client_code, t: r.client_name }))));
  };

  useEffect(() => {
    loadGrid("0", "Select", "Select");
    fetchNewId();
    refreshClients();
    // Unpaginated lookup (paginated list is capped at 200 of 5,393 rows).
    getJSON<{ states: string[]; codes: Record<string, string>; cities_by_code: Record<string, string[]> }>(
      `/api/masters/states/lookup/`).then((d) => {
        if (d && Array.isArray(d.states)) {
          setStates(d.states.map((name) => ({ name, code: d.codes?.[name] ?? "" })));
          setStateCities(d.cities_by_code ?? {});
          return;
        }
        getJSON<{ results: { state_name: string; state_code: string; city: string }[] }>(
          `/api/masters/states/?page_size=all`).then((f2) => {
            const rs = f2?.results ?? [];
            const seen = new Map<string, string>();
            const cities: Record<string, string[]> = {};
            for (const r of rs) {
              if (!seen.has(r.state_name)) seen.set(r.state_name, r.state_code);
              ((cities[r.state_code] ||= []) as string[]).push(r.city);
            }
            setStates(Array.from(seen.entries()).map(([name, code]) => ({ name, code })));
            setStateCities(cities);
          });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stateOpts: Opt[] = [{ v: "Select", t: "Select" },
    ...states.map((s) => ({ v: s.code, t: s.name }))];
  const billCityOpts: Opt[] = [{ v: "Select", t: "Select" },
    ...((stateCities[f.txtbillstate] ?? []).map((c) => ({ v: c, t: c })))];
  const shipCityOpts: Opt[] = [{ v: "Select", t: "Select" },
    ...((stateCities[f.txtssstate] ?? []).map((c) => ({ v: c, t: c })))];
  const fltCityOpts: Opt[] = [{ v: "Select", t: "Select" },
    ...((stateCities[fltState] ?? []).map((c) => ({ v: c, t: c })))];
  // Legacy ChnagePlaces(): v_type shows "Select" + the option whose value == nation.
  const vtypeOpts: Opt[] = VTYPE_OPTS.filter((o) => o.v === "0" || o.v === f.vandor_type_nation);

  // Legacy text_Clear() + btnnew_Click (new id). Button visibility untouched.
  // type + ship state/city are NOT reset (commented lines) — preserved.
  // Contact rows persist in ViewState (only hidden); only add/remove/select
  // mutate them — preserved (same DB end-state via delete-all + rewrite).
  const clearFields = () => {
    setF((p) => ({
      ...EMPTY,
      txtssstate: p.txtssstate, txtscity: p.txtscity, vendor_type: p.vendor_type,
      type: p.type,
    }));
    setShowContacts(false);
    setAssignedCities([]);
    setCityPick([]);
    setClientPick([]);
    setAssignedClients([]);
    setBankFile(null);
    setTaxFile(null);
    fetchNewId();
  };

  const clearAll = () => {
    clearFields();
    setSelected(null);
  };

  const onRowClick = async (row: VendorRow) => {
    const d = await getJSON<VendorDetail>(`/api/masters/vendors/${row.id}/`);
    if (!d) return;
    setSelected(row);
    const nf: FormState = { ...EMPTY };
    for (const k of Object.keys(nf)) {
      const v = d[k];
      nf[k] = v === null || v === undefined ? "" : String(v);
    }
    setF(nf);
    setContacts(d.contacts ?? []);
    setShowContacts((d.contacts ?? []).length > 0);
    setCi({ ...EMPTY_CONTACT });
    setAssignedCities(d.cities ?? []);
    setCityPick([]);
    setAssignedClients(d.client_codes ?? []);
    setClientPick([]);
    setBankFile(null);
    setTaxFile(null);
    refreshClients();
  };

  // Legacy Req_validation() — exact order and messages, literal comparisons.
  const val = () => {
    if (f.vend_name === "") return "Please Enter Vendor Name";
    if (textOf(NATION_OPTS, f.vandor_type_nation) === "Select")
      return "Please Select Vendor Type (As per Nation)";
    if (textOf(VTYPE_OPTS, f.vendor_type_na) === "Select") return "Please Select Vendor Type";
    if (f.vend_add1 === "") return "Please Select Vendor Address";
    if (f.contact_person_1 === "") return "Please Select Atleast One Contact Person";
    if (f.phone1 === "") return "Please Select Atleast One Contact Number";
    if (f.vendor_email_id === "") return "Please Enter Email Address";
    if (!EMAIL_RE.test(f.vendor_email_id)) return "Please Enter valid email address";
    if (textOf(CATEGORY_OPTS, f.vendor_type) === "Select")
      return "Please Select Vendor Categories";
    if (f.credit_period === "") return "Please Enter Credit Period (In Day) ";
    if (f.agrement_start_date === "") return "Please Select Aggrement Start Date";
    if (f.agrement_end_date === "") return "Please Select Aggrement End Date";
    if (f.new_vendor_id === "") return "Please Enter Vendor Id";
    if (f.gst === "") return "Please Enter GST";
    if (f.vend_add2 === "") return "Please Enter Service Type";
    if (f.txtbillcountry === "") return "Please Enter Billing Address Country";
    if (textOf(stateOpts, f.txtbillstate) === "Select")
      return "Please Select Billing Address State";
    if (f.txtbillcity === "Select") return "Please Select Billing Address City";
    if (f.txtbilladdress === "") return "Please Enter Billing Address";
    if (f.bank_name === "") return "Please Enter Bank Name";
    if (f.bank_account_name === "") return "Please Enter Vendor Bank Account Name";
    if (f.account_number === "") return "Please Enter Vendor Bank Account Number";
    if (f.ifsc_code === "") return "Please Enter Vendor Bank IFSC Code";
    return "";
  };

  const payload = () => {
    const out: Record<string, string> = {};
    for (const k of Object.keys(EMPTY)) out[k] = f[k] ?? "";
    return out;
  };

  const afterWrite = (message: string | null, reset: boolean) => {
    if (message) alert(message);
    if (reset) {
      clearFields();
      setSelected(null);
      loadGrid();
    }
  };

  const save = async () => {
    const err = val();
    if (err) return alert(err);
    try {
      const res = await sendVendor("/api/masters/vendors/", "POST", payload(),
        contacts, cityPick.map((city) => ({ state: cityState, city })), clientPick,
        bankFile, taxFile);
      const body = await res.json().catch(() => null);
      const message: string | null = body?.message ?? null;
      if (message === "Enter At Least One Contact Person Details...") return alert(message);
      afterWrite(message ?? errMsg(body) ?? "Record Adding Failed...", true);
    } catch {
      alert("Record Adding Failed...");
    }
  };

  const update = async () => {
    const err = val();
    if (err) return alert(err);
    if (!selected) return;
    try {
      const res = await sendVendor(`/api/masters/vendors/${selected.id}/`, "PUT", payload(),
        contacts, cityPick.map((city) => ({ state: cityState, city })), clientPick,
        bankFile, taxFile);
      const body = await res.json().catch(() => null);
      afterWrite(body?.message ?? errMsg(body) ?? " Updated Successfully...", true);
    } catch {
      alert(" Updated Successfully...");
    }
  };

  const del = async () => {
    if (!selected) return;
    const r = confirm("Are you Sure You Want to Delete Record");
    if (!r) {
      alert("Record not Available");
      return;
    }
    try {
      const res = await delVendor(selected.id);
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        // Guard-blocked path (400): legacy text_Clear() only, edit mode kept.
        if (body?.message) alert(body.message);
        clearFields();
        return;
      }
      const message: string | null = body?.silent ? null : (body?.message ?? null);
      if (message) alert(message);
      else if (!body?.silent) alert("Vendor Deletion Failed !!");
      // Legacy delete-finally: text_Clear (ViewState contact rows persist,
      // hidden) + personal (contact inputs cleared). Preserved exactly.
      clearFields();
      setCi({ ...EMPTY_CONTACT });
      setSelected(null);
      loadGrid();
    } catch {
      alert("Vendor Deletion Failed !!");
    }
  };

  const addContact = () => {
    // Legacy Req_validation1() — exact messages.
    if (ci.salutation === "Select Salutation") return alert("Please Select salutation !!!");
    if (ci.txtfirstname === "") return alert("Please Enter First Name   !!!");
    if (ci.txtmobileno === "") return alert("Please Enter Mobile Number   !!!");
    setContacts((p) => [...p, { ...ci }]);
    setShowContacts(true);
    setCi({ ...EMPTY_CONTACT });
  };

  const checkFile = (file: File | null) => {
    if (!file) return true;
    const ext = "." + (file.name.split(".").pop() ?? "");
    if (!CLIENT_UP_EXTS.includes(ext) && !CLIENT_UP_EXTS.includes(ext.toLowerCase())) {
      alert(`Sorry, ${file.name} is invalid, allowed extensions are: ${CLIENT_UP_EXTS.join(", ")}`);
      return false;
    }
    return true;
  };

  const cols: DTColumn<VendorRow>[] = [
    { key: "vend_id", label: "VENDOR ID", value: (d: VendorRow) => d.vend_id || "" },
    { key: "vend_name", label: "VENDOR NAME", value: (d: VendorRow) => d.vend_name || "" },
    { key: "phone1", label: "PHONE NO1", value: (d: VendorRow) => d.phone1 || "" },
    { key: "txtbillstate", label: "STATE", value: (d: VendorRow) => d.txtbillstate || "" },
    { key: "txtbillcity", label: "CITY", value: (d: VendorRow) => d.txtbillcity || "" },
    { key: "gst", label: "GST", value: (d: VendorRow) => d.gst || "" },
  ];

  return (
    <div className="lg-wrap">
      <div className="lg-hdr">Vendor Master</div>
      <div className="lg-form-box">
        <div className="lg-row">
          <Txt label="Vendor Id :" value={f.vend_id} onChange={(v) => set("vend_id", v)} readOnly />
          <Txt label="Vendor Name :" req value={f.vend_name} onChange={(v) => set("vend_name", v)} filter={allowAlphabet} maxLength={70} />
          <Sel label="Vendor Type(As per Nation):" req value={f.vandor_type_nation} onChange={(v) => set("vandor_type_nation", v)} opts={NATION_OPTS} />
          <Sel label="Vendor Type :" req value={f.vendor_type_na} onChange={(v) => set("vendor_type_na", v)} opts={vtypeOpts} />
          <Txt label="Vendor Address :" req value={f.vend_add1} onChange={(v) => set("vend_add1", v)} filter={allowAlphabetAddr} maxLength={100} />
          <Txt label="Contact Person 1 :" req value={f.contact_person_1} onChange={(v) => set("contact_person_1", v)} filter={allowAlphabet} maxLength={100} />
          <Txt label="Contact Person Mob No.1 :" req value={f.phone1} onChange={(v) => set("phone1", v)} filter={isNumber} maxLength={10} />
          <Txt label="Contact Person 2 :" value={f.contact_person_2} onChange={(v) => set("contact_person_2", v)} filter={allowAlphabet} maxLength={100} />
          <Txt label="Contact Person Mob No.2 :" value={f.phone2} onChange={(v) => set("phone2", v)} filter={isNumber} maxLength={10} />
          <Txt label="Contact Person Email ID :" req value={f.vendor_email_id} onChange={(v) => set("vendor_email_id", v)} filter={emailKeys} maxLength={70} />
          <Sel label="Vendor Categories :" req value={f.vendor_type} onChange={(v) => set("vendor_type", v)} opts={CATEGORY_OPTS} />
          <Txt label="Credit Period (In Day) :" req value={f.credit_period} onChange={(v) => set("credit_period", v)} filter={isNumber} maxLength={70} />
          <Txt label="Area to be Served :" value={f.area_to_served} onChange={(v) => set("area_to_served", v)} filter={allowAlphabetAddr} maxLength={10} />
          <Txt label="Agreement Start Date:" req value={f.agrement_start_date} onChange={(v) => set("agrement_start_date", v)} filter={isNumber} maxLength={10} />
          <Txt label="Agreement End Date :" req value={f.agrement_end_date} onChange={(v) => set("agrement_end_date", v)} filter={isNumber} maxLength={10} />
          <Txt label="Vendor Id :" req value={f.new_vendor_id} onChange={(v) => set("new_vendor_id", v)} filter={allowAlphabetAddr} maxLength={10} />
          <Field label="Terms & Conditions :"><textarea className="lg-control" style={{ height: 180 }} value={f.terms_and_conditions} onChange={(e) => set("terms_and_conditions", e.target.value)} /></Field>
        </div>
        <div className="lg-row">
          <Txt label="GST IN :" req value={f.gst} onChange={(v) => set("gst", v)} filter={allowAlphabet1} maxLength={15} />
          <Txt label="PAN No :" value={f.pan_no} onChange={(v) => set("pan_no", v)} filter={allowAlphabet1} maxLength={10} />
          <Txt label="Service Type :" req value={f.vend_add2} onChange={(v) => set("vend_add2", v)} maxLength={15} />
          <Sel label="Active Status :" value={f.active_status} onChange={(v) => set("active_status", v)} opts={STATUS_OPTS} />
          <Txt label="Total Dues :" value={f.total_dues} onChange={(v) => set("total_dues", v)} filter={isNumberTotal} maxLength={10} />
          <Txt label="Opening Balance :" value={f.opening_balance} onChange={(v) => set("opening_balance", v)} filter={isNumberTotal} maxLength={10} />
          <Txt label="SAC Code :" value={f.sac_code} onChange={(v) => set("sac_code", v)} />
          <Txt label="Registration Number :" value={f.comp_registration_num} onChange={(v) => set("comp_registration_num", v)} />
          <Field label="File Upload :"><input type="file" className="lg-control" onChange={(e) => {
            const fl = e.target.files?.[0] ?? null;
            if (checkFile(fl)) setTaxFile(fl); else e.target.value = "";
          }} /></Field>
        </div>
        <div className="lg-row">
          <Txt label="Bank Name :" req value={f.bank_name} onChange={(v) => set("bank_name", v)} filter={allowAlphabet} maxLength={30} />
          <Txt label="Vendor Bank Account Name :" req value={f.bank_account_name} onChange={(v) => set("bank_account_name", v)} filter={allowAlphabet} maxLength={60} />
          <Txt label="Account Number :" req value={f.account_number} onChange={(v) => set("account_number", v)} maxLength={30} />
          <Txt label="IFSC Code :" req value={f.ifsc_code} onChange={(v) => set("ifsc_code", v)} filter={allowAlphabetAddr} maxLength={15} />
          <Field label="Bank File :"><input type="file" className="lg-control" onChange={(e) => {
            const fl = e.target.files?.[0] ?? null;
            if (checkFile(fl)) setBankFile(fl); else e.target.value = "";
          }} /></Field>
        </div>
        <div className="lg-row">
          <Txt label="Attention :" value={f.txtbillattention} onChange={(v) => set("txtbillattention", v)} filter={allowAlphabet} maxLength={70} />
          <Txt label="Country :" req value={f.txtbillcountry} onChange={(v) => set("txtbillcountry", v)} filter={allowAlphabet} maxLength={50} />
          <Sel label="State :" req value={f.txtbillstate} onChange={(v) => set("txtbillstate", v)} opts={stateOpts} />
          <Sel label="City :" req value={f.txtbillcity} onChange={(v) => set("txtbillcity", v)} opts={billCityOpts} />
          <Txt label="Zip code :" value={f.txtbillzipcode} onChange={(v) => set("txtbillzipcode", v)} filter={isNumber} maxLength={6} />
          <Txt label="Address :" req value={f.txtbilladdress} onChange={(v) => set("txtbilladdress", v)} filter={allowAlphabetAddr} maxLength={100} />
          <Txt label="Fax :" value={f.txtbillfax} onChange={(v) => set("txtbillfax", v)} filter={isNumber} maxLength={20} />
        </div>
        <div className="lg-row">
          <Txt label="Attention :" value={f.txtsattention} onChange={(v) => set("txtsattention", v)} filter={allowAlphabet} maxLength={70} />
          <Txt label="Address :" value={f.txtsaddress} onChange={(v) => set("txtsaddress", v)} filter={allowAlphabetAddr} maxLength={100} />
          <Sel label="State :" value={f.txtssstate} onChange={(v) => set("txtssstate", v)} opts={stateOpts} />
          <Sel label="City :" value={f.txtscity} onChange={(v) => set("txtscity", v)} opts={shipCityOpts} />
          <Txt label="Zip code :" value={f.txtszipcode} onChange={(v) => set("txtszipcode", v)} filter={isNumber} maxLength={7} />
          <Txt label="Country :" value={f.txtscountry} onChange={(v) => set("txtscountry", v)} filter={allowAlphabet} maxLength={50} />
          <Txt label="Fax :" value={f.txtsfax} onChange={(v) => set("txtsfax", v)} filter={isNumber} maxLength={20} />
        </div>
        <div className="lg-form-box">
          <div className="lg-hdr" style={{ fontSize: 13 }}>Contact Persons</div>
          <div className="lg-row">
            <Sel label="Salutation" value={ci.salutation} onChange={(v) => setCi((p) => ({ ...p, salutation: v }))} opts={SALUT_OPTS} />
            <Txt label="First Name" value={ci.txtfirstname} onChange={(v) => setCi((p) => ({ ...p, txtfirstname: v }))} filter={allowAlphabet} maxLength={50} />
            <Txt label="Last Name" value={ci.txtlastname} onChange={(v) => setCi((p) => ({ ...p, txtlastname: v }))} filter={allowAlphabet} maxLength={50} />
            <Txt label="Email Address" value={ci.txteaddress} onChange={(v) => setCi((p) => ({ ...p, txteaddress: v }))} filter={emailKeys} maxLength={100} />
            <Txt label="Work Phone" value={ci.txtworkphonno} onChange={(v) => setCi((p) => ({ ...p, txtworkphonno: v }))} filter={isNumber} maxLength={10} />
            <Txt label="Contact Number" value={ci.txtmobileno} onChange={(v) => setCi((p) => ({ ...p, txtmobileno: v }))} filter={isNumber} maxLength={10} />
            <Txt label="Designation" value={ci.txtdesignation1} onChange={(v) => setCi((p) => ({ ...p, txtdesignation1: v }))} filter={allowAlphabet} maxLength={50} />
            <Txt label="Department" value={ci.txtdept} onChange={(v) => setCi((p) => ({ ...p, txtdept: v }))} filter={allowAlphabet} maxLength={50} />
            <div><button className="btn btn-primary" onClick={addContact}>Add Row</button></div>
          </div>
          {showContacts && (
            <div className="dt-scroll"><table className="dt-grid">
              <thead><tr><th></th><th>Salutation</th><th>First Name</th><th>Last Name</th><th>Email</th><th>Work Phone</th><th>Mobile</th><th>Designation</th><th>Department</th></tr></thead>
              <tbody>
                {contacts.map((r, i) => (
                  <tr key={i}>
                    <td><button className="btn btn-primary" onClick={() => setContacts((p) => p.filter((_, j) => j !== i))}>x</button></td>
                    <td>{r.salutation}</td><td>{r.txtfirstname}</td><td>{r.txtlastname}</td>
                    <td>{r.txteaddress}</td><td>{r.txtworkphonno}</td><td>{r.txtmobileno}</td>
                    <td>{r.txtdesignation1}</td><td>{r.txtdept}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
          )}
        </div>
        <div className="lg-row">
          <Sel label="City State :" value={cityState} onChange={(v) => { setCityState(v); setCityPick([]); }} opts={[{ v: "Select", t: "Select" }, ...states.map((s) => ({ v: s.code, t: s.name }))]} />
          <Field label="Cities :"><select className="lg-control" multiple style={{ height: 90 }} value={cityPick} onChange={(e) => setCityPick(Array.from(e.target.selectedOptions, (o) => o.value))}>
            {(cityState === "Select" ? [] : (stateCities[cityState] ?? [])).map((c) => <option key={c} value={c}>{c}</option>)}
          </select></Field>
          {assignedCities.length > 0 && <Field label="Assigned Cities :"><span>{assignedCities.map((r) => r.city).join(", ")}</span></Field>}
          <Field label="Assign Clients :"><select className="lg-control" multiple style={{ height: 90 }} value={clientPick} onChange={(e) => setClientPick(Array.from(e.target.selectedOptions, (o) => o.value))}>
            {clientOpts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
          </select></Field>
          {assignedClients.length > 0 && <Field label="Assigned Clients :"><span>{assignedClients.join(", ")}</span></Field>}
        </div>
        <div className="lg-row" style={{ justifyContent: "center", gap: "10px", marginTop: "10px" }}>
          {!selected && <button className="btn btn-primary" onClick={save}> Save </button>}
          {selected && <button className="btn btn-primary" onClick={update}> Update </button>}
          {selected && <button className="btn btn-primary" onClick={del}> Delete </button>}
          <button className="btn btn-primary" onClick={clearFields}>Clear</button>
          <Link href="/" className="btn btn-danger" style={{ textDecoration: "none" }}>Close</Link>
        </div>
        <div className="lg-row" style={{ gap: "10px" }}>
          <Sel label="Vendor Type :" value={fltType} onChange={(v) => { setFltType(v); setFltCity("Select"); loadGrid(v, fltState, "Select"); }} opts={FILTER_TYPES} />
          <Sel label="State:" value={fltState} onChange={(v) => { setFltState(v); setFltCity("Select"); loadGrid(fltType, v, "Select"); }} opts={[{ v: "Select", t: "Select" }, ...states.map((s) => ({ v: s.code, t: s.name }))]} />
          <Sel label="City:" value={fltCity} onChange={(v) => { setFltCity(v); loadGrid(fltType, fltState, v); }} opts={fltCityOpts} />
        </div>
      </div>
      <div className="lg-form-box">
        <DataTable
          rows={data}
          columns={cols}
          rowKey={(r: VendorRow) => r.id}
          onRowClick={onRowClick}
          selectedKey={selected?.id}
        />
      </div>
      <div className="em-note">Company Bank, MSME, TDS, Rate/Wait-chart and tax-grid tabs persist via dedicated follow-up modules.</div>
    </div>
  );
}
