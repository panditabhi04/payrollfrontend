"use client";

/**
 * Client Master — exact replica of legacy clientmaster.aspx.
 *
 * Same title/header, same 22-tab strip (Add Items / Send Email stay hidden like
 * legacy), same main-form field labels/order/types/dropdown values, same grid
 * columns, same buttons (Save/Update/Delete/Clear/Close), same validation
 * messages + order (Req_validation / new_validate / R_validation), row-select
 * for edit, reason panel + comments history on update.
 *
 * Persistence (honest, not faked):
 *   - Core + Billing/Policy fields -> /api/masters/clients (server-validated).
 *   - Designation + Services grids -> nested in the client save (legacy posts
 *     the grids with the form; update delete+reinserts, like legacy).
 *   - ESIC / Deduction / Feedback / Bank / BillCheck grids -> their child
 *     endpoints, synced on successful client save (delete-all + recreate,
 *     mirroring legacy).
 *   - Head/Zone/Region/Cluster/GST/EMAIL/Company/CompanyBank/Fire/Uniform/Club
 *     -> /api/masters/client-zone-rows (typed rows, legacy pay_zone_master
 *     with CLIENT_CODE). Email passwords + full bank account numbers are never
 *     stored in plaintext (masked, provision-user flow covers logins).
 *   - Documents -> /api/masters/company-images (real file upload/download).
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import { API_BASE_URL } from "@/lib/api/client";
import { listItems, createItem, updateItem, deleteItem } from "@/lib/api/crud";
import { Field, Sel, Txt, onlyNum, alnumSpace, alnumPunct, alphaPunct, alphaAddr, emailKeys, levelForMenu, errMsg, type Opt } from "@/components/formkit";
import ExportButtons from "@/components/ExportButtons";
import "./ClientMaster.css";

const BASE = "/api/masters/clients";
const DESIG = "/api/masters/client-designation-counts";
const SVC = "/api/masters/client-services";
const ESIC = "/api/masters/client-esic";
const DEDUCT = "/api/masters/client-deductions";
const FEED = "/api/masters/client-feedback";
const BANKD = "/api/masters/client-bank-details";
const BILLD = "/api/masters/client-billing-details";
const ZROWS = "/api/masters/client-zone-rows";
const IMGS = "/api/masters/company-images";
const GRADES = "/api/hr/grades";
const MENU = "Client Master";

// Legacy tab strip order (clientmaster.aspx #tabs). Add Items / Send Email are
// display:none in legacy and stay hidden here too.
type Tab = "documents" | "services" | "designation" | "bank" | "head" | "zonehead" | "regionhead"
  | "gst" | "additems" | "sendemail" | "company" | "billcheck" | "billing" | "esic" | "deduction" | "email" | "uniformded"
  | "companybank" | "fire" | "club" | "cluster" | "feedback";
const TABS: { id: Tab; label: string }[] = [
  { id: "documents", label: "Documents" },
  { id: "services", label: "Services Category" },
  { id: "designation", label: "Designation" },
  { id: "bank", label: "Bank Details" },
  { id: "head", label: "Head Info" },
  { id: "zonehead", label: "Zone Head Info" },
  { id: "regionhead", label: "Region Head Info" },
  { id: "gst", label: "GST Info" },
  { id: "additems", label: "Add Items" },
  { id: "sendemail", label: "Send Email" },
  { id: "company", label: "Company" },
  { id: "billcheck", label: "Bill Check List" },
  { id: "billing", label: "Billing/Policy" },
  { id: "esic", label: "ESIC" },
  { id: "deduction", label: "Deduction" },
  { id: "email", label: "EMAIL" },
  { id: "uniformded", label: "Uniform Advance Deduction" },
  { id: "companybank", label: "Company Bank Details" },
  { id: "fire", label: "Fire Extinguisher" },
  { id: "club", label: "Billing Structure Policy" },
  { id: "cluster", label: "Cluster Manager Info" },
  { id: "feedback", label: "Feedback Info" },
];

const TDS = [{ v: "0", t: "NO" }, { v: "1", t: "YES" }];
const TDS_PCT = [
  { v: "0", t: "Select" }, { v: "0.75", t: "TDS 0.75%" }, { v: "1.5", t: "TDS 1.5%" },
  { v: "1", t: "TDS 1%" }, { v: "2", t: "TDS 2%" },
];
const TDS_ON = [{ v: "0", t: "Select" }, { v: "1", t: "Billing Amount" }, { v: "2", t: "Taxable Amount" }];
const YN01 = [{ v: "0", t: "No" }, { v: "1", t: "Yes" }];
const GSTAPP = [{ v: "1", t: "Applicable" }, { v: "0", t: "Not Applicable" }];
const ANDROID = [{ v: "select", t: "Select" }, { v: "yes", t: "Yes" }, { v: "no", t: "No" }];
const GSTPAYED = [
  { v: "SEL", t: "Select" }, { v: "R", t: "Regular" }, { v: "SEWP", t: "SEZ supplies with payment" },
  { v: "SEWOP", t: "SEZ supplies without payment" }, { v: "DE", t: "Deemed Exp" },
  { v: "SCU", t: "Supplies covered under section 7 of IGST Act" },
];
const OTBILL = [{ v: "With OT", t: "With OT" }, { v: "Without OT", t: "Without OT" }];
const SEL01NA = [{ v: "select", t: "Select" }, { v: "0", t: "Not Applicable" }, { v: "1", t: "Applicable" }];
const LATLONG = [{ v: "no", t: "No" }, { v: "yes", t: "Yes" }];
const INCENT = [{ v: "0", t: "Not Applicable" }, { v: "1", t: "Applicable" }];
const MATCALC = [{ v: "0", t: "Working Days" }, { v: "1", t: "Days" }];
const OTAPP = [{ v: "0", t: "Select" }, { v: "1", t: "Fix_OT" }, { v: "2", t: "Daily" }, { v: "3", t: "Lamsump" }];
const CATS = [
  { v: "0", t: "Select" }, { v: "Highly Skilled", t: "Highly Skilled" }, { v: "Semi Skilled", t: "Semi Skilled" },
  { v: "Skilled", t: "Skilled" }, { v: "Unskilled", t: "Unskilled" },
  { v: "A", t: "A" }, { v: "B", t: "B" }, { v: "C", t: "C" },
];
const SERVICES = [
  { v: "0", t: "select" }, { v: "HK", t: "HOUSEKEEPING" }, { v: "SG", t: "SECURITY GUARD" },
  { v: "T", t: "TEMPORARY" }, { v: "RNM", t: "R&M" }, { v: "M", t: "MATERIAL" },
  { v: "C", t: "CONVENYCE" }, { v: "DC", t: "DEEP CLEANING" }, { v: "MR", t: "MACHINE RENTAL" },
];
const DEDUCT_ITEMS = [
  { v: "Select", t: "Select" }, { v: "Uniform", t: "Uniform" }, { v: "Shoes", t: "Shoes" },
  { v: "ID_Card", t: "ID Card" }, { v: "Sweater", t: "Sweater" }, { v: "Raincoat", t: "Raincoat " },
  { v: "Torch", t: "Torch" }, { v: "Whistle", t: "Whistle" }, { v: "Baton", t: "Baton" },
  { v: "Belt", t: "Belt" }, { v: "Pantry_Jacket", t: "Pantry_Jacket" }, { v: "Apron", t: "Apron" },
];
const FEEDBACKS = [
  { v: "Select", t: "Select " },
  { v: "Branch is Maintained well By our IH And MS Housekeeping Staff.", t: "Branch is Maintained well By our IH And MS Housekeeping Staff." },
  { v: "Staff Deployed is Provided with ID Card, Dress or Agency Uniform.", t: "Staff Deployed is Provided with ID Card, Dress or Agency Uniform." },
  { v: "Smartness, Discipline, Manners, Behaviour of Staff.", t: "Smartness, Discipline, Manners, Behaviour of Staff." },
  { v: "Supervisors Visit at Site.", t: "Supervisors Visit at Site." },
  { v: "Availability of Housekeeping Materials.", t: "Availability of Housekeeping Materials." },
  { v: "Overall Assessment of IH And MS.", t: "Overall Assessment of IH And MS." },
];
// Head / Zone / Region / Cluster dropdowns (legacy clientmaster.aspx)
const HEAD_TYPES = [
  { v: "Select", t: "Select" }, { v: "Admin", t: "Admin" }, { v: "Legal", t: "Legal" },
  { v: "Procurment", t: "Procurment" }, { v: "Operation", t: "Operation" },
  { v: "Finance", t: "Finance" }, { v: "Other", t: "Other" },
];
const ZONE_HEAD_TYPES = [
  { v: "Select", t: "Select" }, { v: "Admin", t: "Admin" }, { v: "Legal", t: "Legal" },
  { v: "Operation", t: "Operation" }, { v: "Finance", t: "Finance" },
  { v: "Location", t: "Location" }, { v: "Other", t: "Other" },
];
const TITLES = [{ v: "0", t: "Select" }, { v: "Mr", t: "Mr." }, { v: "Mrs", t: "Mrs." }, { v: "Ms", t: "Ms." }];
const ZONES = [
  { v: "0", t: "Select" }, { v: "East", t: "East" }, { v: "West", t: "West" }, { v: "North", t: "North" },
  { v: "South", t: "South" }, { v: "Central", t: "Central" }, { v: "North_East", t: "North-East" },
  { v: "Hyderabad", t: "Hyderabad" }, { v: "Pune", t: "Pune" }, { v: "Delhi", t: "Delhi" },
  { v: "Ahmedabad", t: "Ahmedabad" }, { v: "Bangalore", t: "Bangalore" }, { v: "Indore", t: "Indore" },
  { v: "Nagpur", t: "Nagpur" }, { v: "Mumbai", t: "Mumbai" }, { v: "Kolkata", t: "Kolkata" },
  { v: "Chennai", t: "Chennai" }, { v: "Kerala", t: "Kerala" }, { v: "MP-CG", t: "MP-CG" },
];
const CLUSTER_ZONES = [
  { v: "0", t: "Select" }, { v: "East", t: "East" }, { v: "West", t: "West" }, { v: "North", t: "North" },
  { v: "South", t: "South" }, { v: "Central", t: "Central" }, { v: "North_East", t: "North-East" },
];
const CHECKLIST_NAMES = [
  { v: "Select", t: "Select" }, { v: "1", t: "Manpower Billing" }, { v: "2", t: "Material Billing" },
  { v: "3", t: "Conveyance Billing" }, { v: "4", t: "Deep Clean Billing" }, { v: "5", t: "Pest Control Billing" },
  { v: "6", t: "Arrears Billing" }, { v: "7", t: "Machine Rental" }, { v: "8", t: "R And M Service" },
  { v: "9", t: "Administrative Expenses" }, { v: "10", t: "OT Billing" }, { v: "11", t: "Shiftwise Billing" },
  { v: "12", t: "Incentive Billing" }, { v: "13", t: "Office Rent Billing" }, { v: "14", t: "Stipend Billing" },
];
const CHECKLIST_BILLING = [
  { v: "Select", t: "Select" }, { v: "1", t: "Statewise" }, { v: "2", t: "Branchwise" },
  { v: "3", t: "Statewisedesignation" }, { v: "4", t: "Branchwisedesignation" },
  { v: "5", t: "Regionwise" }, { v: "6", t: "HO" },
];
const CLUB_OPTS = [
  { v: "", t: "Unclub" }, { v: "manpower_material", t: "Manpower + Material" },
  { v: "manpower_machine_rental", t: "Manpower + Machine Rental" },
  { v: "manpower_material_pestcontrol", t: "Manpower + Material + Pest Control" },
];
const FIRE_OPTS = [{ v: "Not Applicable", t: "Not Applicable" }, { v: "Applicable", t: "Applicable" }];
const EMAIL_RE = /^([a-zA-Z0-9_.-])+@(([a-zA-Z0-9-])+.)+([a-zA-Z0-9]{2,4})+$/;
// Legacy clientmaster.aspx.cs email grid: six fixed department rows (Field1).
const EMAIL_DEPTS = [
  "Admin", "Account", "Manager", "Legal", "Invoice/Finance", "Operation",
];

type Form = Record<string, string>;
const EMPTY: Form = {
  client_code: "", client_name: "", address1: "", address2: "", state: "Select", city: "Select",
  file_no: "", total_employee: "", reg_no: "", pan_no: "", license_no: "",
  website: "", email_id: "", password: "", iot_applicable: "0", client_phonno: "",
  penalty: "0", gst_applicable: "1", bill_amount: "0", material_calc: "0", material_days: "0",
  machine_rent_policy: "0", budget_materials: "0", tds_applicable: "0", tds_percentage: "0",
  tds_on: "0", client_active_close: "0", android_att_flag: "select", gst_payed: "SEL", gst_locationwise: "0",
  payment_bank: "Select", billing_ot: "With OT", r_and_m_service: "select",
  administrative_expense: "select", lati_long_flag: "no", absent_attendance_rate: "0",
  incentive_applicable: "0", feedback_flag: "0", material_payment_flag: "0",
  emp_salary_on_material_percent: "0", billing_type: "",
  // Billing/Policy tab (legacy: Start Day dropdown is 1-31 only, no 0/placeholder,
  // default first item = 1; End Day auto = start-1, 1->31, readonly)
  ot_applicable: "0", billing_start_day: "1", billing_end_day: "31",
  reason_for_updation: "",
};

interface Row { id?: number | string; [k: string]: string | number | undefined }
interface Co { id: number; client_code: string; client_name: string; city: string; state: string; total_employee: string }

function ge(o: Record<string, string | null> | null, k: string) { return (o?.[k] ?? "") as string; }
async function getJSON<T>(path: string): Promise<T | null> {
  try { const r = await fetch(`${API_BASE_URL}${path}`, { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" }); return r.ok ? (await r.json()) as T : null; }
  catch { return null; }
}
// Unpaginated child-row lookup (the paginated list is capped and silently drops
// rows for big clients) — every child endpoint exposes /lookup/ with {results}.
async function listByClient<T>(base: string, clientCode: string, extra = ""): Promise<T[]> {
  const d = await getJSON<{ results: T[] }>(`${base}/lookup/?client_code=${encodeURIComponent(clientCode)}${extra}`);
  return d?.results ?? [];
}

export default function ClientMaster() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<Tab>("billing");
  const [f, setF] = useState<Form>({ ...EMPTY });
  const [hasPw, setHasPw] = useState(false);
  const [selected, setSelected] = useState<Co | null>(null);
  const [rows, setRows] = useState<Co[]>([]);
  const [comments, setComments] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [busy, setBusy] = useState(false);
  const [states, setStates] = useState<string[]>([]);
  const [stateCities, setStateCities] = useState<Record<string, string[]>>({});
  const [stateCodeMap, setStateCodeMap] = useState<Record<string, string>>({});
  const [grades, setGrades] = useState<string[]>([]);
  const [banks, setBanks] = useState<string[]>([]);

  // working grids (posted with the form, like legacy ViewState grids)
  const [designations, setDesignations] = useState<Row[]>([]);
  const [services, setServices] = useState<Row[]>([]);
  const [esicRows, setEsicRows] = useState<Row[]>([]);
  const [deductRows, setDeductRows] = useState<Row[]>([]);
  const [feedRows, setFeedRows] = useState<Row[]>([]);
  const [bankRows, setBankRows] = useState<Row[]>([]);
  const [billRows, setBillRows] = useState<Row[]>([]);
  const [headRows, setHeadRows] = useState<Row[]>([]);
  const [zoneRows, setZoneRows] = useState<Row[]>([]);
  const [regionRows, setRegionRows] = useState<Row[]>([]);
  const [clusterRows, setClusterRows] = useState<Row[]>([]);
  const [gstRows, setGstRows] = useState<Row[]>([]);
  const [emailRows, setEmailRows] = useState<Row[]>([]);
  const [companyRows, setCompanyRows] = useState<Row[]>([]);
  const [companyBankRows, setCompanyBankRows] = useState<Row[]>([]);
  const [fireRows, setFireRows] = useState<Row[]>([]);
  const [uniformRows, setUniformRows] = useState<Row[]>([]);
  const [clubRows, setClubRows] = useState<Row[]>([]);
  const [itemRows, setItemRows] = useState<Row[]>([]);
  const [sendMailRows, setSendMailRows] = useState<Row[]>([]);
  const [docRows, setDocRows] = useState<Row[]>([]);
  // tab drafts
  const [dd, setDd] = useState<Record<string, string>>({ state: "Select", location: "Select", designation: "", category: "0", count: "", hours: "", start_date: "", end_date: "" });
  const [sv, setSv] = useState<Record<string, string>>({ service: "0", start_date: "", end_date: "" });
  const [es, setEs] = useState<Record<string, string>>({ esic_state: "Select", esic_address: "", esic_code: "" });
  const [dc, setDc] = useState<Record<string, string>>({ deduction_item: "Select", deduction_amount: "" });
  const [fb, setFb] = useState<Record<string, string>>({ feedback: "Select", remark: "" });
  const [bk, setBk] = useState<Record<string, string>>({ bank_name: "", account_no: "", ifsc_code: "" });
  const [bl, setBl] = useState<Record<string, string>>({ checklist_name: "Select", checklist_billing: "Select", state: "Select", invoice_shipping_address: "" });
  const [hd, setHd] = useState<Record<string, string>>({ head_type: "Select", title: "0", name: "", mobile: "", email: "", birth: "", anniversary: "", child1: "", child1_birth: "", child2: "", child2_birth: "", personal_mobile: "", personal_email: "" });
  const [zn, setZn] = useState<Record<string, string>>({ head_type: "Select", zone: "0", title: "0", name: "", mobile: "", email: "", birth: "", anniversary: "", child1: "", child1_birth: "", child2: "", child2_birth: "", personal_mobile: "", personal_email: "" });
  const [rg, setRg] = useState<Record<string, string>>({ head_type: "Select", zone: "0", region: "", title: "0", name: "", mobile: "", email: "", birth: "", anniversary: "", child1: "", child1_birth: "", child2: "", child2_birth: "", personal_mobile: "", personal_email: "" });
  const [cl, setCl] = useState<Record<string, string>>({ head_type: "Select", zone: "0", region: "", title: "0", name: "", mobile: "", email: "", birth: "", anniversary: "", child1: "", child1_birth: "", child2: "", child2_birth: "", personal_mobile: "", personal_email: "" });
  const [gs, setGs] = useState<Record<string, string>>({ gst_state: "Select", gst_loc: "", gst_type: "B2B", gst_address: "", gstin: "", pincode: "" });
  const [em, setEm] = useState<Record<string, string>>({ department: "Admin", email: "", password: "", name: "", mobile: "", designation: "", to_addr: "", cc: "", bcc: "" });
  const [cp, setCp] = useState<Record<string, string>>({ company_name: "", gst_no: "", gst_address: "" });
  const [cb, setCb] = useState<Record<string, string>>({ payment_bank: "Select", ac_no: "", from_date: "", to_date: "" });
  const [fr, setFr] = useState<Record<string, string>>({ applicable: "Not Applicable", no_of_days: "0", interval: "0" });
  const [un, setUn] = useState<Record<string, string>>({ deduction: "0", no_uniform: "1", no_shoes: "0", no_id: "0", month: "" });
  const [cbp, setCbp] = useState<Record<string, string>>({ clubbing: "" });
  const [it, setIt] = useState<Record<string, string>>({ item_name: "", quantity: "", validity: "", expiry: "" });
  const [sm, setSm] = useState<Record<string, string>>({ email_type: "Select", head_type: "Select", head_title: "Select", head_name: "Select", head_email: "" });
  const [doc, setDoc] = useState<Record<string, string>>({ description: "", start_date: "", end_date: "" });
  const [docFile, setDocFile] = useState<File | null>(null);
  // Client login provisioning (POST clients/{id}/provision-user). Admin-only UI;
  // the backend enforces admin too. Token is shown once for out-of-band delivery.
  const [provUser, setProvUser] = useState("");
  const [provResult, setProvResult] = useState<{ username: string; setup_token: string } | null>(null);
  const isAdmin = !!me?.is_staff;

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  useEffect(() => { getMe().then((m) => { setMe(m); setAuthChecked(true); }); }, []);
  useEffect(() => {
    // Unpaginated lookup (the paginated list is capped at 200 of 5,393 rows,
    // which showed only Andaman/Andhra). Falls back to the paginated list.
    getJSON<{ states: string[]; cities: Record<string, string[]> }>("/api/masters/states/lookup/").then((d) => {
      if (d && Array.isArray(d.states)) {
        setStates([...d.states].sort());
        setStateCities(d.cities ?? {});
      } else {
        getJSON<{ results: { state_name: string; city: string }[] }>("/api/masters/states/?page_size=all").then((f2) => {
          const rs = f2?.results ?? [];
          setStates(Array.from(new Set(rs.map((s) => s.state_name))).sort());
          const cities: Record<string, string[]> = {};
          rs.forEach((s) => { (cities[s.state_name] ||= []).push(s.city); });
          setStateCities(cities);
        });
      }
    });
    // Map state_code -> state_name for legacy clients that store code like "HR" instead of "Haryana"
    getJSON<{ results: { state_code: string; state_name: string }[] }>("/api/masters/states/?page_size=all").then((d) => {
      const map: Record<string, string> = {};
      (d?.results ?? []).forEach((s) => { if (s.state_code && s.state_name) { map[s.state_code] = s.state_name; map[s.state_code.toLowerCase()] = s.state_name; map[s.state_name] = s.state_name; }});
      setStateCodeMap(map);
    });
    // Full designation list (353 grades exceed the paginated-list cap).
    getJSON<{ grades: { grade_code: string }[] }>(`${GRADES}/lookup/`).then((d) => {
      setGrades((d?.grades ?? []).map((g) => g.grade_code));
    });
    // Bank-names lookup (legacy ddl_bank: distinct bank_details Field1).
    // The old company-zone-rows?row_type=bank_details call is rejected by the
    // backend (secure module), which left this dropdown EMPTY and blocked save.
    getJSON<{ bank_names: string[] }>("/api/masters/bank-names/").then((d) => {
      const names = [...new Set((d?.bank_names ?? []).map((n) => (n || "").trim()).filter(Boolean))].sort();
      // bank-names already unions every names source (modern Company Master
      // bank_details + client banks + legacy). When it is empty the company has
      // no bank yet, so leave the dropdown at just "Select" (prompting the user
      // to add a bank in Company Master). The old minibank fallback was wrong —
      // minibank.field1 is "Internal Transfer", not a bank name.
      setBanks(names);
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      // Walk all pages so the grid + Excel see the full client list.
      const all: Co[] = [];
      let page = 1;
      for (;;) {
        const res = await listItems<Co>(BASE, { page, pageSize: 200 });
        const batch = Array.isArray(res) ? (res as unknown as Co[]) : (res.results ?? []);
        all.push(...batch);
        const r = res as unknown as { next?: string | null };
        if (!r || !r.next || batch.length === 0) break;
        page += 1;
        if (page > 50) break;
      }
      setRows(all);
    } catch (e) {
      setRows([]);
      const msg = e instanceof Error ? e.message : "";
      if (/403/.test(msg)) setListError(`Permission denied (403): "${me?.username ?? "?"}" does not have Read access to Client Master.`);
      else setListError(msg || "Client list load failed.");
    } finally { setLoading(false); }
  }, [me?.username]);
  useEffect(() => { if (authChecked && me) load(); }, [authChecked, me, load]);

  const clearForm = () => {
    setSelected(null); setF({ ...EMPTY }); setHasPw(false); setComments([]);
    setDesignations([]); setServices([]); setEsicRows([]); setDeductRows([]); setFeedRows([]);
    setBankRows([]); setBillRows([]); setHeadRows([]); setZoneRows([]); setRegionRows([]);
    setClusterRows([]); setGstRows([]); setEmailRows([]); setCompanyRows([]); setCompanyBankRows([]);
    setFireRows([]); setUniformRows([]); setClubRows([]); setItemRows([]); setSendMailRows([]); setDocRows([]);
    setIt({ item_name: "", quantity: "", validity: "", expiry: "" });
    setSm({ email_type: "Select", head_type: "Select", head_title: "Select", head_name: "Select", head_email: "" });
    setTab("billing"); setProvUser(""); setProvResult(null);
  };

  const zToHead = (r: Record<string, string>) => ({
    head_type: r.field10 || "Select", title: r.field2 || "0", name: r.field1 || "",
    mobile: r.field3 || "", email: r.field4 || "", birth: r.field5 || "", anniversary: r.field6 || "",
    child1: r.field7 || "", child1_birth: r.field8 || "", child2: r.field9 || "",
    child2_birth: r.field11 || "", personal_mobile: r.field12 || "", personal_email: r.field13 || "",
    id: r.id,
  });
  const zToZone = (r: Record<string, string>) => ({
    head_type: r.field1 || "Select", zone: r.zone || "0", title: r.field11 || "0", name: r.field2 || "",
    mobile: r.field3 || "", email: r.field4 || "", birth: r.field5 || "", anniversary: r.field6 || "",
    child1: r.field7 || "", child1_birth: r.field8 || "", child2: r.field9 || "",
    child2_birth: r.field10 || "", personal_mobile: r.field12 || "", personal_email: r.field13 || "",
    id: r.id,
  });
  const zToRegion = (r: Record<string, string>) => ({
    head_type: r.field1 || "Select", zone: r.zone || "0", region: r.region || "", title: r.field2 || "0",
    name: r.field3 || "", mobile: r.field4 || "", email: r.field5 || "", birth: r.field6 || "",
    anniversary: r.field7 || "", child1: r.field8 || "", child1_birth: r.field9 || "",
    child2: r.field10 || "", child2_birth: r.field11 || "", personal_mobile: r.field12 || "",
    personal_email: r.field13 || "", id: r.id,
  });

  const selectRow = async (r: Co) => {
    const full = await getJSON<Record<string, string | null>>(`${BASE}/${r.id}/`);
    if (!full) return;
    setSelected(r);
    setProvUser(""); setProvResult(null);
    const nf = { ...EMPTY };
    for (const k of Object.keys(nf)) nf[k] = ge(full, k);
    // Legacy data stores state as code "HR" but dropdown uses name "Haryana" — translate via code map
    if (nf.state && nf.state !== "Select" && stateCodeMap[nf.state]) nf.state = stateCodeMap[nf.state];
    else if (nf.state && nf.state !== "Select" && stateCodeMap[nf.state.toUpperCase()]) nf.state = stateCodeMap[nf.state.toUpperCase()];
    nf.state ||= "Select"; nf.city ||= "Select"; nf.payment_bank ||= "Select";
    // Legacy rule: End = Start-1, 1->31. Old rows with empty End still show data.
    if (!nf.billing_end_day.trim()) {
      const n = parseInt(nf.billing_start_day, 10);
      if (n >= 1 && n <= 31) nf.billing_end_day = String(n === 1 ? 31 : n - 1);
    }
    if (!nf.billing_start_day.trim()) { nf.billing_start_day = "1"; nf.billing_end_day ||= "31"; }
    nf.password = "";
    setHasPw(!!(full as Record<string, unknown>).has_password);
    setF(nf);
    setComments((ge(full, "comments") || "").split("@#$%").map((s) => s.trim()).filter(Boolean));
    const code = ge(full, "client_code");
    const [dsg, svc, esi, ded, fdb, bnk, bil, zr, docs] = await Promise.all([
      listByClient<Row>(DESIG, code), listByClient<Row>(SVC, code), listByClient<Row>(ESIC, code),
      listByClient<Row>(DEDUCT, code), listByClient<Row>(FEED, code),
      listByClient<Row>(BANKD, code), listByClient<Row>(BILLD, code),
      listByClient<Record<string, string>>(ZROWS, code),
      listByClient<Row>(IMGS, code),
    ]);
    // Distinct by State+Designation. The client-level (page) row has no branch (unit_code empty) and
    // carries the contract count the client was saved with, so it wins over the per-branch rows that
    // Branch Master writes; a state with branch rows only shows its first branch row (counts never summed).
    const map = new Map<string, Row>();
    for (const x of dsg) {
      const key = `${String(x.state ?? "").trim().toLowerCase()}|${String(x.designation ?? "").trim().toLowerCase()}`;
      const pageLevel = !String(x.unit_code ?? "").trim();
      const have = map.get(key);
      if (!have || (pageLevel && String(have.unit_code ?? "").trim())) {
        map.set(key, { ...x, count: String(x.count ?? ""), start_date: String(x.start_date ?? ""), end_date: String(x.end_date ?? "") });
      }
    }
    setDesignations(Array.from(map.values()));
    setServices(svc.map((x) => ({ ...x })));
    setEsicRows(esi.map((x) => ({ ...x })));
    setDeductRows(ded.map((x) => ({ ...x })));
    setFeedRows(fdb.map((x) => ({ ...x })));
    setBankRows(bnk.map((x) => ({ ...x, bank_name: String(x.bank_name ?? ""), account_no: String(x.account_no ?? ""), ifsc_code: String(x.ifsc_code ?? "") })));
    setBillRows(bil.map((x) => ({
      ...x,
      checklist_name: String(x.billing_id ?? ""), checklist_billing: String(x.billingwise_id ?? ""),
      state: String((x as Row).state ?? ""), invoice_shipping_address: String(x.invoice_shipping_address ?? ""),
    })));
    const byType = (t: string) => zr.filter((z) => (z.row_type || "").toUpperCase() === t);
    setHeadRows(byType("HEAD").map(zToHead));
    setZoneRows(byType("ZONE").map(zToZone));
    setRegionRows(byType("REGION").map(zToRegion));
    setClusterRows(byType("CLUSTER").map(zToRegion));
    setGstRows(byType("GST").map((z) => ({ gst_state: z.region || "Select", gst_loc: z.field5 || "", gst_type: z.field4 || "B2B", gst_address: z.field1 || "", gstin: z.field2 || "", pincode: z.field3 || "", id: z.id })));
    setEmailRows(byType("EMAIL").map((z) => ({
      department: z.field1 || "", email: z.field2 || "", password: "", has_password: z.has_password ? "1" : "",
      name: z.field4 || "", mobile: z.field6 || "",
      designation: z.field5 || "", to_addr: z.field9 || "", cc: z.field7 || "", bcc: z.field8 || "", id: z.id,
    })));
    setCompanyRows(byType("COMPANY").map((z) => ({ company_name: z.field1 || "", gst_no: z.field2 || "", gst_address: z.field3 || "", id: z.id })));
    setCompanyBankRows(byType("COMPANYBANK").map((z) => ({ payment_bank: z.field1 || "Select", ac_no: z.field2 || "", from_date: z.field3 || "", to_date: z.field4 || "", id: z.id })));
    setFireRows(byType("FIRE").map((z) => ({ applicable: z.field1 || "Not Applicable", no_of_days: z.field2 || "0", interval: z.field3 || "0", id: z.id })));
    setUniformRows(byType("UNIFORM").map((z) => ({ deduction: z.field1 || "0", no_uniform: z.field2 || "1", no_shoes: z.field3 || "0", no_id: z.field4 || "0", month: z.field5 || "", id: z.id })));
    setClubRows(byType("CLUB").map((z) => ({ clubbing: z.field1 || "", id: z.id })));
    setItemRows(byType("ADDITEMS").map((z) => ({ item_name: z.field1 || "", quantity: z.field2 || "", validity: z.field3 || "", expiry: z.field4 || "", id: z.id })));
    setSendMailRows(byType("SENDEMAIL").map((z) => ({
      email_type: z.field1 || "Select", head_type: z.field2 || "Select", head_title: z.field3 || "Select",
      head_name: z.field4 || "Select", head_email: z.field5 || "", id: z.id,
    })));
    if (byType("CLUB").length > 0) setF((p) => ({ ...p, billing_type: byType("CLUB")[0].field1 || p.billing_type }));
    setDocRows(docs.map((x) => ({ ...x })));
    setTab("billing");
  };

  // exact legacy Req_validation()/new_validate() order (client mirror of server rules).
  // Returns "message|fieldId" so fail() can alert + focus exactly like legacy.
  const validate = (): string | null => {
    if (!f.client_code.trim()) return "Please Enter Client Code|cl_code";
    if (!f.client_name.trim()) return "Please Enter Client Name|cl_name";
    if (!f.address1.trim()) return "Please Enter Head Office Address|cl_addr1";
    if (!f.state || f.state === "Select") return "Please Select State !!|cl_state";
    else if (!f.city || f.city === "Select") return "Please Select City !!|cl_city";
    if (!f.file_no.trim() || f.file_no.trim() === "0") return "Please Enter File No. !!|cl_file";
    if (!f.total_employee.trim() || f.total_employee.trim() === "0") return "Please Enter Total Employee Count !!|cl_total";
    if (!f.billing_start_day || f.billing_start_day === "0") return "Please Select Billing Start Day in Billing / Policy Tab|bl_start";
    if (!f.billing_end_day.trim()) return "Please Enter Billing End Day in Billing / Policy Tab|bl_start";
    if (!selected && (!f.payment_bank || f.payment_bank === "Select")) return "Please Select Employee Payment Bank !!|cl_paybank";
    if (services.length === 0) return "Please Add At Least One Service Category in Services Category Tab !!|";
    if (designations.length === 0) return "Please Add At Least One Designation in Designation Tab !!|";
    if (selected && !f.reason_for_updation.trim()) return "Please Specify Reason For Updation !!!|cl_reason";
    return null;
  };
  const fail = (err: string | null): boolean => {
    if (!err) return false;
    const idx = err.lastIndexOf("|");
    const msg = idx >= 0 ? err.slice(0, idx) : err;
    const id = idx >= 0 ? err.slice(idx + 1) : "";
    if (id === "bl_start") setTab("billing");
    alert(msg);
    if (id) setTimeout(() => document.getElementById(id)?.focus?.(), 60);
    else if (msg.includes("Service Category")) setTab("services");
    else if (msg.includes("Designation")) setTab("designation");
    return true;
  };

  const payload = () => ({
    client_code: f.client_code.trim(), client_name: f.client_name.trim(),
    address1: f.address1.trim(), address2: f.address2.trim(),
    state: f.state, city: f.city, file_no: f.file_no.trim(), total_employee: f.total_employee.trim(),
    reg_no: f.reg_no.trim(), pan_no: f.pan_no.trim(), license_no: f.license_no.trim(),
    website: f.website.trim(), email_id: f.email_id.trim(),
    ...(f.password ? { password: f.password } : {}),
    iot_applicable: f.iot_applicable, client_phonno: f.client_phonno.trim(),
    penalty: f.penalty.trim(), gst_applicable: f.gst_applicable, bill_amount: f.bill_amount.trim(),
    material_calc: f.material_calc, material_days: f.material_days.trim(),
    machine_rent_policy: f.machine_rent_policy, budget_materials: f.budget_materials.trim(),
    tds_applicable: f.tds_applicable, tds_percentage: f.tds_percentage, tds_on: f.tds_on,
    client_active_close: f.client_active_close, android_att_flag: f.android_att_flag,
    gst_payed: f.gst_payed, gst_locationwise: f.gst_locationwise === "1" ? "1" : "", payment_bank: f.payment_bank === "Select" ? "" : f.payment_bank,
    billing_ot: f.billing_ot, r_and_m_service: f.r_and_m_service,
    administrative_expense: f.administrative_expense, lati_long_flag: f.lati_long_flag,
    absent_attendance_rate: f.absent_attendance_rate.trim(),
    incentive_applicable: f.incentive_applicable, feedback_flag: f.feedback_flag,
    material_payment_flag: f.material_payment_flag,
    emp_salary_on_material_percent: f.emp_salary_on_material_percent.trim(),
    billing_type: (cbp.clubbing || f.billing_type || "").trim(),
    ot_applicable: f.ot_applicable, billing_start_day: f.billing_start_day,
    billing_end_day: f.billing_end_day.trim(), reason_for_updation: f.reason_for_updation.trim(),
    designations: designations.map((r) => ({
      state: r.state, location: r.location, designation: r.designation, category: r.category,
      count: r.count, hours: r.hours, start_date: r.start_date, end_date: r.end_date,
    })),
    services: services.map((r) => ({ service: r.service, start_date: r.start_date, end_date: r.end_date })),
  });

  // Child grids persist via their endpoints, synced on successful client save
  // (delete-all + recreate = legacy delete+reinsert).
  const syncChildren = async (clientCode: string) => {
    // One atomic server call per grid (validate every row + grid-level legacy
    // checks -> delete -> re-insert). Any rejection aborts that grid and the
    // backend message is surfaced - never swallowed.
    const sync = async (base: string, want: Row[], body: (r: Row) => Record<string, string>, extra = "") => {
      const rt = new URLSearchParams(extra.replace(/^&/, "")).get("row_type") ?? "";
      const res = await createItem<Record<string, unknown>>(`${base}/replace`, {
        client_code: clientCode, row_type: rt, rows: want.map((r) => body(r)),
      });
      if (!res.ok) {
        throw new Error(res.status === 403 ? "You do not have permission for this action." : (errMsg(res.data) || `HTTP ${res.status}`));
      }
    };
    await sync(ESIC, esicRows, (r) => ({ esic_state: String(r.esic_state ?? ""), esic_address: String(r.esic_address ?? ""), esic_code: String(r.esic_code ?? "") }));
    await sync(DEDUCT, deductRows, (r) => ({ deduction_item: String(r.deduction_item ?? ""), deduction_amount: String(r.deduction_amount ?? "") }));
    await sync(FEED, feedRows, (r) => ({ client_name: f.client_name.trim(), feedback: String(r.feedback ?? ""), remark: String(r.remark ?? "") }));
    await sync(BANKD, bankRows, (r) => ({ bank_name: String(r.bank_name ?? ""), account_no: String(r.account_no ?? ""), ifsc_code: String(r.ifsc_code ?? "") }));
    await sync(BILLD, billRows, (r) => {
      const nm = CHECKLIST_NAMES.find((c) => c.v === String(r.checklist_name ?? ""))?.t ?? "";
      const bl2 = CHECKLIST_BILLING.find((c) => c.v === String(r.checklist_billing ?? ""))?.t ?? "";
      return {
        billing_name: nm, billing_id: String(r.checklist_name ?? ""),
        billing_wise: bl2, billingwise_id: String(r.checklist_billing ?? ""),
        state: String(r.state ?? ""), invoice_shipping_address: String(r.invoice_shipping_address ?? ""),
      };
    });
    const zbody = (t: string) => (r: Row) => {
      const o: Record<string, string> = { row_type: t };
      for (const k of ["zone", "region", "field1", "field2", "field3", "field4", "field5", "field6", "field7", "field8", "field9", "field10", "field11", "field12", "field13"]) o[k] = String((r as Record<string, unknown>)[k] ?? "");
      return o;
    };
    // HEAD/ZONE/REGION/CLUSTER/GST/... stored via generic zone rows
    const headZ = headRows.map((r) => ({ field10: String(r.head_type ?? ""), field2: String(r.title ?? ""), field1: String(r.name ?? ""), field3: String(r.mobile ?? ""), field4: String(r.email ?? ""), field5: String(r.birth ?? ""), field6: String(r.anniversary ?? ""), field7: String(r.child1 ?? ""), field8: String(r.child1_birth ?? ""), field9: String(r.child2 ?? ""), field11: String(r.child2_birth ?? ""), field12: String(r.personal_mobile ?? ""), field13: String(r.personal_email ?? "") }));
    const zoneZ = zoneRows.map((r) => ({ field1: String(r.head_type ?? ""), zone: String(r.zone ?? ""), field11: String(r.title ?? ""), field2: String(r.name ?? ""), field3: String(r.mobile ?? ""), field4: String(r.email ?? ""), field5: String(r.birth ?? ""), field6: String(r.anniversary ?? ""), field7: String(r.child1 ?? ""), field8: String(r.child1_birth ?? ""), field9: String(r.child2 ?? ""), field10: String(r.child2_birth ?? ""), field12: String(r.personal_mobile ?? ""), field13: String(r.personal_email ?? "") }));
    const regZ = (rows_: Row[]) => rows_.map((r) => ({ field1: String(r.head_type ?? ""), zone: String(r.zone ?? ""), region: String(r.region ?? ""), field2: String(r.title ?? ""), field3: String(r.name ?? ""), field4: String(r.mobile ?? ""), field5: String(r.email ?? ""), field6: String(r.birth ?? ""), field7: String(r.anniversary ?? ""), field8: String(r.child1 ?? ""), field9: String(r.child1_birth ?? ""), field10: String(r.child2 ?? ""), field11: String(r.child2_birth ?? ""), field12: String(r.personal_mobile ?? ""), field13: String(r.personal_email ?? "") }));
    const gstZ = gstRows.map((r) => ({ region: String(r.gst_state ?? ""), field1: String(r.gst_address ?? ""), field2: String(r.gstin ?? ""), field3: String(r.pincode ?? ""), field4: f.gst_locationwise === "1" ? String(r.gst_type ?? "B2B") : "", field5: f.gst_locationwise === "1" ? String(r.gst_loc ?? "") : "" }));
    const emailZ = emailRows.map((r) => ({ field1: String(r.department ?? ""), field2: String(r.email ?? ""), field3: String(r.password ?? ""), field4: String(r.name ?? ""), field5: String(r.designation ?? ""), field6: String(r.mobile ?? ""), field7: String(r.cc ?? ""), field8: String(r.bcc ?? ""), field9: String(r.to_addr ?? "") }));
    const compZ = companyRows.map((r) => ({ field1: String(r.company_name ?? ""), field2: String(r.gst_no ?? ""), field3: String(r.gst_address ?? "") }));
    const compBankZ = companyBankRows.map((r) => ({ field1: String(r.payment_bank ?? ""), field2: String(r.ac_no ?? ""), field3: String(r.from_date ?? ""), field4: String(r.to_date ?? "") }));
    const fireZ = fireRows.map((r) => ({ field1: String(r.applicable ?? ""), field2: String(r.no_of_days ?? ""), field3: String(r.interval ?? "") }));
    const uniformZ = uniformRows.map((r) => ({ field1: String(r.deduction ?? ""), field2: String(r.no_uniform ?? ""), field3: String(r.no_shoes ?? ""), field4: String(r.no_id ?? ""), field5: String(r.month ?? "") }));
    const clubZ = cbp.clubbing ? [{ field1: cbp.clubbing }] : clubRows.map((r) => ({ field1: String(r.clubbing ?? "") }));
    const itemZ = itemRows.map((r) => ({ field1: String(r.item_name ?? ""), field2: String(r.quantity ?? ""), field3: String(r.validity ?? ""), field4: String(r.expiry ?? "") }));
    const smZ = sendMailRows.map((r) => ({ field1: String(r.email_type ?? ""), field2: String(r.head_type ?? ""), field3: String(r.head_title ?? ""), field4: String(r.head_name ?? ""), field5: String(r.head_email ?? "") }));
    await sync(ZROWS, headZ as Row[], zbody("HEAD"), "&row_type=HEAD");
    await sync(ZROWS, zoneZ as Row[], zbody("ZONE"), "&row_type=ZONE");
    await sync(ZROWS, regZ(regionRows) as Row[], zbody("REGION"), "&row_type=REGION");
    await sync(ZROWS, regZ(clusterRows) as Row[], zbody("CLUSTER"), "&row_type=CLUSTER");
    await sync(ZROWS, gstZ as Row[], zbody("GST"), "&row_type=GST");
    await sync(ZROWS, emailZ as Row[], zbody("EMAIL"), "&row_type=EMAIL");
    await sync(ZROWS, compZ as Row[], zbody("COMPANY"), "&row_type=COMPANY");
    await sync(ZROWS, compBankZ as Row[], zbody("COMPANYBANK"), "&row_type=COMPANYBANK");
    await sync(ZROWS, fireZ as Row[], zbody("FIRE"), "&row_type=FIRE");
    await sync(ZROWS, uniformZ as Row[], zbody("UNIFORM"), "&row_type=UNIFORM");
    await sync(ZROWS, clubZ as Row[], zbody("CLUB"), "&row_type=CLUB");
    await sync(ZROWS, itemZ as Row[], zbody("ADDITEMS"), "&row_type=ADDITEMS");
    await sync(ZROWS, smZ as Row[], zbody("SENDEMAIL"), "&row_type=SENDEMAIL");
  };

  // Legacy ddl_designation_SelectedIndexChanged1: picking a Designation
  // auto-fills Start/End Date from the matching Services Category row
  // (pay_zone_master Type='SERVICES' for this client). Designation→service map:
  // SG*/SGG/SGK→SECURITY GUARD, T→TEMPORARY, RNM→R&M, M→MATERIAL, C→CONVENYCE,
  // DC→DEEP CLEANING, MR→MACHINE RENTAL, anything else (incl. HK)→HOUSEKEEPING.
  const serviceKeyForDesignation = (desig: string): { code: string; label: string } => {
    const v = (desig || "").trim().toUpperCase();
    if (v === "SG" || v === "SGG" || v.startsWith("SG")) return { code: "SG", label: "SECURITY GUARD" };
    if (v === "T") return { code: "T", label: "TEMPORARY" };
    if (v === "RNM") return { code: "RNM", label: "R&M" };
    if (v === "M") return { code: "M", label: "MATERIAL" };
    if (v === "C") return { code: "C", label: "CONVENYCE" };
    if (v === "DC") return { code: "DC", label: "DEEP CLEANING" };
    if (v === "MR") return { code: "MR", label: "MACHINE RENTAL" };
    return { code: "HK", label: "HOUSEKEEPING" };
  };
  const onDesignationPick = (v: string) => {
    // legacy clears both boxes first, then fills only if a service row matches.
    // SGK jaise naye grade codes SG-prefix se SECURITY GUARD me map hote hain.
    // Agar specific service nahi mila to pehli available service ka date fallback
    // lo taaki Start/End blank na rahe (legacy fallback jaisa).
    const { code, label } = serviceKeyForDesignation(v);
    const match =
      services.find((r) => {
        const s = String(r.service ?? "").trim().toUpperCase();
        return s === code || s === label;
      }) ?? services[0];
    setDd((p) => ({
      ...p,
      designation: v,
      start_date: match ? String(match.start_date ?? "") : "",
      end_date: match ? String(match.end_date ?? "") : "",
    }));
  };

  // exact legacy row-add validations
  const addDesignation = () => {
    if (!dd.state || dd.state === "Select") return alert("Please Select State For Designation !!");
    if (!dd.location || dd.location === "Select") return alert("Please Select Location");
    if (!dd.designation || dd.designation === "Select") return alert("Please Select Designation !!");
    if (!dd.category || dd.category === "0") return alert("Please Select Category !!");
    if (!dd.count.trim() || dd.count.trim() === "0") return alert("Please Enter Employee Count !!");
    if (!dd.hours.trim() || dd.hours.trim() === "0") return alert("Please Enter Working Hours !!");
    if (!dd.start_date) return alert("Please Select Start Date !!");

    if (designations.some(d => d.state === dd.state && d.location === dd.location && d.designation === dd.designation)) {
      return alert("This Designation already exists for this State and Location !!");
    }

    // Legacy count_emp_count() at add-time (clientmaster.aspx.cs): block the
    // row here if its count alone, or running total + new count, exceeds
    // Total No Of Employee — instead of waiting for final Save.
    {
      const total = parseInt((f.total_employee || "").trim(), 10);
      const cnt = parseInt((dd.count || "").trim(), 10);
      if (!isNaN(total) && !isNaN(cnt)) {
        if (cnt > total) {
          alert("Please Increase The Value Of Total Number Of Employee!!");
          setDd((p) => ({ ...p, count: "" }));
          return;
        }
        const running = designations.reduce((s, d) => s + (parseInt(String(d.count ?? "").trim(), 10) || 0), 0);
        if (running + cnt > total) {
          alert("Please Increase The Value Of Total Number Of Employee!!");
          setDd((p) => ({ ...p, count: "" }));
          return;
        }
      }
    }

    setDesignations((p) => [...p, { ...dd }]);
    setDd({ state: "Select", location: "Select", designation: "", category: "0", count: "", hours: "", start_date: "", end_date: "" });
  };
  const addService = () => {
    if (!sv.service || sv.service === "0") return alert("Please Select Service Category");
    if (!sv.start_date) return alert("Please Select Agreement Start Date");
    if (!sv.end_date) return alert("Please Select Agreement End Date");
    const added = { ...sv };
    setServices((p) => [...p, added]);
    // Agreement dates entered here flow into the Designation tab automatically: the open entry
    // form and every already-added designation row that belongs to this service category.
    const belongs = (desig: string) => { const k = serviceKeyForDesignation(desig); const sName = String(added.service ?? "").trim().toUpperCase(); return sName === k.code || sName === k.label; };
    setDd((p) => (p.designation && belongs(p.designation) ? { ...p, start_date: String(added.start_date ?? ""), end_date: String(added.end_date ?? "") } : p));
    setDesignations((p) => p.map((d) => (belongs(String(d.designation ?? "")) ? { ...d, start_date: String(added.start_date ?? ""), end_date: String(added.end_date ?? "") } : d)));
    setSv({ service: "0", start_date: "", end_date: "" });
  };
  const addEsic = () => {
    if (!es.esic_state || es.esic_state === "Select") return alert("Please Select ESIC State");
    if (!es.esic_address.trim()) return alert("Please Enter ESIC Office Address");
    if (!es.esic_code.trim()) return alert("Please Enter ESIC Registration Number");
    setEsicRows((p) => [...p, { ...es }]);
    setEs({ esic_state: "Select", esic_address: "", esic_code: "" });
  };
  const addDeduct = () => {
    if (!dc.deduction_item || dc.deduction_item === "Select") return alert("Please Select Deduction Item !!");
    if (!dc.deduction_amount.trim()) return alert("Please Enter Deduction Amount !!");
    setDeductRows((p) => [...p, { ...dc }]);
    setDc({ deduction_item: "Select", deduction_amount: "" });
  };
  const addFeedback = () => {
    if (!fb.feedback || fb.feedback === "Select") return alert("Please Select Feedback Name !!");
    setFeedRows((p) => [...p, { ...fb }]);
    setFb({ feedback: "Select", remark: "" });
  };
  const addBank = () => {
    if (!bk.bank_name.trim()) return alert("Please Enter Bank Name");
    if (!bk.account_no.trim()) return alert("Please Enter Bank Account Number");
    if (!bk.ifsc_code.trim()) return alert("Please Enter IFSC Code");
    setBankRows((p) => [...p, { ...bk }]);
    setBk({ bank_name: "", account_no: "", ifsc_code: "" });
  };
  const addBill = () => {
    // Legacy lnk_add_billing_Click: needs at least one designation row, and rejects a repeated billing.
    if (designations.length === 0) return alert("Please insert at list one record in designation");
    if (billRows.some((r) => String(r.checklist_name ?? "") === bl.checklist_name && String(r.checklist_billing ?? "") === bl.checklist_billing && String(r.state ?? "") === bl.state)) return alert("Same Billing already added");
    if (!bl.checklist_name || bl.checklist_name === "Select") return alert("Please Select Check List Name");
    if (!bl.checklist_billing || bl.checklist_billing === "Select") return alert("Please Select Billing ");
    if (!bl.state || bl.state === "Select") return alert("Please Select State ");
    if (!bl.invoice_shipping_address.trim()) return alert("Please Enter Shipping Address");
    setBillRows((p) => [...p, { ...bl }]);
    setBl({ checklist_name: "Select", checklist_billing: "Select", state: "Select", invoice_shipping_address: "" });
  };
  const addHead = () => {
    if (!hd.head_type || hd.head_type === "Select") return alert("Please Select Head Type !!");
    if (!hd.title || hd.title === "0") return alert("Please Select Zone Head Title !!");
    if (!hd.name.trim()) return alert("Please Enter Head Name !!");
    if (!hd.mobile.trim()) return alert("Please Enter Head Mobile No !!");
    if (!hd.email.trim()) return alert("Please Enter Head Email !!");
    if (!EMAIL_RE.test(hd.email.trim())) return alert("Please provide a valid email address");
    setHeadRows((p) => [...p, { ...hd }]);
    setHd({ head_type: "Select", title: "0", name: "", mobile: "", email: "", birth: "", anniversary: "", child1: "", child1_birth: "", child2: "", child2_birth: "", personal_mobile: "", personal_email: "" });
  };
  const addZone = () => {
    if (!zn.head_type || zn.head_type === "Select") return alert("Please Select Zone Head Type !!");
    if (!zn.zone || zn.zone === "0") return alert("Please Select Zone !!");
    if (!zn.title || zn.title === "0") return alert("Please Select Zone Head Title !!");
    if (!zn.name.trim()) return alert("Please Enter Zone Head Name !!");
    if (!zn.mobile.trim()) return alert("Please Enter Zone Head Mobile No !!");
    if (!zn.email.trim()) return alert("Please Enter Zone Head Email !!");
    if (!EMAIL_RE.test(zn.email.trim())) return alert("Please provide a valid email address");
    if (zoneRows.some((r) => String(r.zone ?? "") === zn.zone)) return alert("Can Not Create Same Zone in ...");
    setZoneRows((p) => [...p, { ...zn }]);
    setZn({ head_type: "Select", zone: "0", title: "0", name: "", mobile: "", email: "", birth: "", anniversary: "", child1: "", child1_birth: "", child2: "", child2_birth: "", personal_mobile: "", personal_email: "" });
  };
  const addRegion = () => {
    if (!rg.head_type || rg.head_type === "Select") return alert("Please Select Region Head Type !!");
    if (!rg.zone || rg.zone === "0") return alert("Please Select Zone !!");
    if (!rg.region || rg.region === "Select" || !rg.region.trim()) return alert("Please Select Region !!");
    if (!rg.title || rg.title === "0") return alert("Please Select Title !!");
    if (!rg.name.trim()) return alert("Please Select Head Name !!");
    if (!rg.mobile.trim()) return alert("Please Select Head Mobile Number !!");
    if (!rg.email.trim()) return alert("Please Select Head Email Address !!");
    if (!EMAIL_RE.test(rg.email.trim())) return alert("Please provide a valid email address");
    if (regionRows.some((r) => String(r.zone ?? "") === rg.zone && String(r.region ?? "") === rg.region)) return alert("Can Not Create Same Region in Zone...");
    setRegionRows((p) => [...p, { ...rg }]);
    setRg({ head_type: "Select", zone: "0", region: "", title: "0", name: "", mobile: "", email: "", birth: "", anniversary: "", child1: "", child1_birth: "", child2: "", child2_birth: "", personal_mobile: "", personal_email: "" });
  };
  const addCluster = () => {
    if (!cl.head_type || cl.head_type === "Select") return alert("Please Select Cluster Head Type !!");
    if (!cl.zone || cl.zone === "0") return alert("Please Select Zone !!");
    if (!cl.title || cl.title === "0") return alert("Please Select Title !!");
    if (!cl.name.trim()) return alert("Please Select Head Name !!");
    if (!cl.mobile.trim()) return alert("Please Select Head Mobile Number !!");
    if (!cl.email.trim()) return alert("Please Select Head Email Address !!");
    if (!EMAIL_RE.test(cl.email.trim())) return alert("Please provide a valid email address");
    setClusterRows((p) => [...p, { ...cl }]);
    setCl({ head_type: "Select", zone: "0", region: "", title: "0", name: "", mobile: "", email: "", birth: "", anniversary: "", child1: "", child1_birth: "", child2: "", child2_birth: "", personal_mobile: "", personal_email: "" });
  };
  const addGst = () => {
    if (!gs.gst_state || gs.gst_state === "Select") return alert("Please Select State For GST !!");
    if (!gs.gst_address.trim()) return alert("Please Enter GST Office Address !!");
    if (!gs.gstin.trim()) return alert("Please Enter GSTIN !!");
    // Location-wise GST client: one row per location, the pincode is part of the address, identical rows are fine
    if (f.gst_locationwise !== "1" && !gs.pincode.trim()) return alert("Please Enter GST PINCODE !!");
    setGstRows((p) => [...p, { ...gs }]);
    setGs({ gst_state: "Select", gst_loc: "", gst_type: "B2B", gst_address: "", gstin: "", pincode: "" });
  };
  const addEmail = () => {
    if (!em.department.trim()) return alert("Please Enter Department");
    if (!em.email.trim()) return alert("Please Enter Email");
    setEmailRows((p) => [...p, { ...em, has_password: em.password ? "1" : "" }]);
    setEm({ department: "Admin", email: "", password: "", name: "", mobile: "", designation: "", to_addr: "", cc: "", bcc: "" });
  };
  const addCompany = () => {
    if (!cp.company_name.trim()) return alert("Please Enter Company Name");
    if (!cp.gst_no.trim()) return alert("Please Enter Company GST Number");
    if (!cp.gst_address.trim()) return alert("Please Enter Company GST Address");
    if (companyRows.some((r) => String(r.gst_no ?? "") === cp.gst_no)) return alert("Can Not Insert to same GST Number!!");
    setCompanyRows((p) => [...p, { ...cp }]);
    setCp({ company_name: "", gst_no: "", gst_address: "" });
  };
  const addCompanyBank = () => {
    if (!cb.payment_bank || cb.payment_bank === "Select") return alert("Please Select Payment Against Bank");
    if (companyBankRows.some((r) => String(r.payment_bank ?? "") === cb.payment_bank && String(r.ac_no ?? "") === cb.ac_no)) return alert("This Record All Ready Added  !!");
    setCompanyBankRows((p) => [...p, { ...cb }]);
    setCb({ payment_bank: "Select", ac_no: "", from_date: "", to_date: "" });
  };
  const addFire = () => {
    if (!fr.applicable) return alert("Please Select Fire Extinguisher Applicable");
    if (fr.applicable === "Applicable") {
      if (!fr.no_of_days.trim() || fr.no_of_days.trim() === "0") return alert("Please Enter No Of Days");
      if (!fr.interval.trim() || fr.interval.trim() === "0") return alert("Please Enter Interval Time");
    }
    setFireRows((p) => [...p, { ...fr }]);
    setFr({ applicable: "Not Applicable", no_of_days: "0", interval: "0" });
  };
  const addUniform = () => {
    // Legacy link_adv_deduction_Click: exact order and texts.
    if (!un.deduction || un.deduction === "0") return alert(" Please Select Deduction Yes  !!");
    if (un.deduction === "1" && deductRows.length === 0) return alert(" First Add Deduction Amount in Deduction tab  !!");
    for (const r of uniformRows) {
      const u = String(r.no_uniform ?? ""), sh = String(r.no_shoes ?? ""), idc = String(r.no_id ?? "");
      if (u === "2") { if (un.no_uniform === u || un.no_uniform === "1") return alert(" this client uniform no of set completed ... !!!"); }
      else if (u === "1") { if (un.no_uniform !== u) return alert(" this client uniform 1 set insert select only 1 set... !!!"); }
      if (sh === "1") { if (un.no_shoes === sh) return alert(" NO Of Shoes And No Of ID Card Already Exist ... !!!"); }
      else if (sh === "0") { if (un.no_shoes !== sh) return alert(" this client Shoes 1 set completed... !!!"); }
      if (idc === "1") { if (un.no_id === idc) return alert(" this client Id Card no of set completed ... !!!"); }
      else if (idc === "0") { if (un.no_id !== idc) return alert(" this client Id Card 1 set completed... !!!"); }
    }
    if (!un.month.trim()) return alert("Please Select Month / Year");
    if (uniformRows.some((r) => String(r.month ?? "") === un.month)) return alert(" This Month Uniform Set All Ready Decided Please Select Another month ... !!!");
    setUniformRows((p) => [...p, { ...un }]);
    setUn({ deduction: "0", no_uniform: "1", no_shoes: "0", no_id: "0", month: "" });
  };
  // Legacy Req_add_items() (Add Items tab) — exact texts.
  const addItem = () => {
    if (!it.item_name.trim() || it.item_name === "Select") { alert("Please Select Item Name"); return; }
    if (!it.quantity.trim()) { alert("Please Enter Number of Quantity"); return; }
    if (!it.validity.trim()) { alert("Please Enter Validity"); return; }
    if (!it.expiry.trim()) { alert("Please Select Expiry Date"); return; }
    setItemRows((p) => [...p, { ...it }]);
    setIt({ item_name: "", quantity: "", validity: "", expiry: "" });
  };
  // Legacy send_email_valid() (Send Email tab) — exact texts.
  const addSendMail = () => {
    if (!sm.email_type || sm.email_type === "Select") { alert("Please Select Email Type"); return; }
    if (!sm.head_type || sm.head_type === "Select") { alert("Please Select Head Type"); return; }
    if (!sm.head_name || sm.head_name === "Select") { alert("Please Select Head Name"); return; }
    if (!sm.head_email.trim()) { alert("Please Enter Head Email Id"); return; }
    if (!/^([a-zA-Z0-9_.-])+@(([a-zA-Z0-9-])+.)+([a-zA-Z0-9]{2,4})+$/.test(sm.head_email.trim())) { alert("Please Enter valid email address"); return; }
    setSendMailRows((p) => [...p, { ...sm }]);
    setSm({ email_type: "Select", head_type: "Select", head_title: "Select", head_name: "Select", head_email: "" });
  };
  const onUploadDoc = async () => {
    if (!doc.description.trim()) return alert("Please Enter Description");
    if (!docFile) return alert("Please Upload File");
    if (!doc.start_date) return alert("Please Select Start Date");
    if (!doc.end_date) return alert("Please Select End Date");
    {
      const ext = (docFile.name.split(".").pop() || "").toLowerCase();
      if (!["jpg", "jpeg", "png", "pdf"].includes(ext)) return alert("Please select only JPG, PNG and PDF Files !!!");
      if (docFile.size > 3 * 1024 * 1024) return alert("Please select Maximum 3 MB File !!!");
    }
    if (!selected) return alert("Save the client first, then upload documents.");
    try {
      await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
      const m = document.cookie.match(/(^|; )csrftoken=([^;]+)/);
      const fd = new FormData();
      fd.append("description", doc.description.trim());
      fd.append("client_code", f.client_code.trim());
      fd.append("start_date", doc.start_date);
      fd.append("end_date", doc.end_date);
      fd.append("file", docFile);
      const res = await fetch(`${API_BASE_URL}${IMGS}/`, {
        method: "POST", credentials: "include",
        headers: { "X-CSRFToken": m ? decodeURIComponent(m[2]) : "" },
        body: fd,
      });
      if (res.ok) {
        alert("Document uploaded!!");
        setDoc({ description: "", start_date: "", end_date: "" }); setDocFile(null);
        setDocRows(await listByClient<Row>(IMGS, f.client_code.trim()));
      } else alert("Document upload failed...");
    } catch { alert("Document upload failed..."); }
  };

  const onSave = async () => {
    if (fail(validate())) return;
    setBusy(true);
    try {
      const res = await createItem<Co>(BASE, payload());
      if (res.ok) {
        try { await syncChildren(f.client_code.trim()); }
        catch (e) {
          alert(`Client saved, but some tab data could not be saved: ${(e as Error).message}`);
          load(); return;
        }
        alert("Client Inserted successfully!!"); clearForm(); load();
      }
      else if (res.status === 403) alert("You do not have permission for this action.");
      else alert(errMsg(res.data) || "Client failed to Insert...");
    } finally { setBusy(false); }
  };
  const onUpdate = async () => {
    if (!selected) return;
    if (fail(validate())) return;
    setBusy(true);
    try {
      const res = await updateItem<Co>(BASE, selected.id, payload());
      if (res.ok) {
        try { await syncChildren(f.client_code.trim()); }
        catch (e) {
          alert(`Client updated, but some tab data could not be saved: ${(e as Error).message}`);
          load(); return;
        }
        alert("Client updated successfully!!"); clearForm(); load();
      }
      else if (res.status === 403) alert("You do not have permission for this action.");
      else alert(errMsg(res.data) || "Client Updating failed...");
    } finally { setBusy(false); }
  };
  const onDelete = async () => {
    if (!selected) { alert("Record not Available"); return; }
    if (!confirm("Are you Sure You Want to Delete Record")) return;
    setBusy(true);
    try {
      const res = await deleteItem(BASE, selected.id);
      if (res.ok) { alert("Client deleted successfully!!"); clearForm(); load(); }
      else if (res.status === 403) alert("Only administrators can delete a record.");
      else alert(errMsg(res.data) || "Client deletion failed...");
    } finally { setBusy(false); }
  };
  const onProvisionUser = async () => {
    if (!selected) { alert("Select a client first."); return; }
    const username = provUser.trim();
    if (!username) { alert("Enter a username/email for the client login."); return; }
    setBusy(true);
    try {
      await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
      const m = document.cookie.match(/(^|; )csrftoken=([^;]+)/);
      const res = await fetch(`${API_BASE_URL}${BASE}/${selected.id}/provision-user/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": m ? decodeURIComponent(m[2]) : "" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json().catch(() => null) as { username?: string; setup_token?: string } | null;
      if (res.status === 201 && data?.setup_token) {
        setProvResult({ username: data.username ?? username, setup_token: data.setup_token });
        alert("Client login provisioned. Deliver the setup token out-of-band.");
      }
      else if (res.status === 403) alert("Only administrators can provision a client login.");
      else alert(errMsg(data) || "Provisioning failed.");
    } finally { setBusy(false); }
  };

  const stOpts: Opt[] = [{ v: "Select", t: "Select" }, ...states.map((s) => ({ v: s, t: s })), ...(f.state !== "Select" && !states.includes(f.state) ? [{ v: f.state, t: f.state }] : [])];
  const cityOpts: Opt[] = [{ v: "Select", t: "Select" }, ...(stateCities[f.state] ?? []).map((c) => ({ v: c, t: c })), ...(f.city !== "Select" && !(stateCities[f.state] ?? []).includes(f.city) ? [{ v: f.city, t: f.city }] : [])];
  const gradeOpts: Opt[] = [{ v: "Select", t: "Select" }, ...grades.map((g) => ({ v: g, t: g }))];
  const bankOpts: Opt[] = [{ v: "Select", t: "Select" }, ...banks.map((b) => ({ v: b, t: b }))];
  // Legacy txt_start_date_client: hardcoded items 1-31 only (no 0, no placeholder).
  const dayOpts: Opt[] = Array.from({ length: 31 }, (_, i) => ({ v: String(i + 1), t: String(i + 1) }));
  const onStartDay = (v: string) => {
    // Legacy billing_start_date(): end = start-1, start 1 -> 31, end readonly.
    const n = parseInt(v, 10);
    setF((p) => ({ ...p, billing_start_day: v, billing_end_day: !n ? "" : String(n === 1 ? 31 : n - 1) }));
  };

  if (authChecked && !me) {
    return <div className="lg-panel"><div className="lg-panel-head">Client Master</div>
      <div style={{ padding: 16 }}>🔐 Sign in required. <Link href="/login">Go to login</Link></div></div>;
  }

  return (
    <div className="lg-panel cl-skin">
      <div className="lg-panel-head" style={{ textAlign: "center" }}>CLIENT MASTER</div>
      <div className="lg-panel-body">

        <div className="lg-form cols3">
          <Txt label="Client Code :" req id="cl_code" value={f.client_code} onChange={(v) => set("client_code", v)} maxLength={10} filter={alnumPunct} readOnly={!!selected} />
          <Txt label="Client Name :" req id="cl_name" value={f.client_name} onChange={(v) => set("client_name", v)} maxLength={50} filter={alphaPunct} />
          <Txt label="Head Office Address :" req id="cl_addr1" value={f.address1} onChange={(v) => set("address1", v)} filter={alnumPunct} />
          <Txt label="Address2 :" value={f.address2} onChange={(v) => set("address2", v)} filter={alnumPunct} />
          <Sel label="State :" req id="cl_state" value={f.state} onChange={(v) => { set("state", v); set("city", "Select"); }} opts={stOpts} />
          <Sel label="City :" req id="cl_city" value={f.city} onChange={(v) => set("city", v)} opts={cityOpts} />
          <Txt label="File No :" req id="cl_file" value={f.file_no} onChange={(v) => set("file_no", v)} maxLength={30} filter={alnumSpace} />
          <Txt label="Total No Of Employee :" req id="cl_total" value={f.total_employee} onChange={(v) => set("total_employee", v)} maxLength={30} filter={onlyNum} />
          <Txt label="Client Registration No :" value={f.reg_no} onChange={(v) => set("reg_no", v)} maxLength={30} filter={onlyNum} />
          <Txt label="PAN No :" value={f.pan_no} onChange={(v) => set("pan_no", v)} maxLength={10} filter={alnumPunct} />
          <Txt label="Licence No :" value={f.license_no} onChange={(v) => set("license_no", v)} maxLength={30} filter={alnumPunct} />
          <Field label="Bank Account No :"><input className="lg-control" value="" disabled placeholder="use Bank Details tab (masked)" /></Field>
          <Txt label="Website :" value={f.website} onChange={(v) => set("website", v)} maxLength={50} filter={alnumPunct} />
          <Txt label="Client Email Id :" value={f.email_id} onChange={(v) => set("email_id", v)} maxLength={50} filter={emailKeys} />
          <Field label="Password :"><input className="lg-control" type="password" maxLength={50} autoComplete="new-password" value={f.password} onChange={(e) => set("password", e.target.value)} placeholder={hasPw ? "saved - leave blank to keep" : ""} /></Field>
          <Sel label="In Time/Out Time Applicable :" value={f.iot_applicable} onChange={(v) => set("iot_applicable", v)} opts={YN01} />
          <Txt label="Client Desk Phone No :" value={f.client_phonno} onChange={(v) => set("client_phonno", v)} maxLength={10} filter={onlyNum} />
          <Txt label="Penalty :" value={f.penalty} onChange={(v) => set("penalty", v)} filter={onlyNum} />
          <Sel label="GST Applicable Or Not :" value={f.gst_applicable} onChange={(v) => set("gst_applicable", v)} opts={GSTAPP} />
          <Txt label="Billing Amount :" value={f.bill_amount} onChange={(v) => set("bill_amount", v)} filter={onlyNum} />
          <Sel label="Material Calculation :" value={f.material_calc} onChange={(v) => set("material_calc", v)} opts={MATCALC} />
          <Txt label="No.Of Days :" value={f.material_days} onChange={(v) => set("material_days", v)} filter={onlyNum} readOnly={f.material_calc !== "1"} />
          <Sel label="Machine Rental Policy :" value={f.machine_rent_policy} onChange={(v) => set("machine_rent_policy", v)} opts={YN01} />
          <Txt label="Budget Materials :" value={f.budget_materials} onChange={(v) => set("budget_materials", v)} maxLength={6} filter={onlyNum} />
          <Sel label="TDS Applicable :" value={f.tds_applicable} onChange={(v) => set("tds_applicable", v)} opts={TDS} />
          <Sel label="TDS:" value={f.tds_percentage} onChange={(v) => set("tds_percentage", v)} opts={TDS_PCT} disabled={f.tds_applicable === "0"} />
          <Sel label="TDS ON:" value={f.tds_on} onChange={(v) => set("tds_on", v)} opts={TDS_ON} disabled={f.tds_applicable === "0"} />
          <Sel label="Client Active/Close:" value={f.client_active_close} onChange={(v) => set("client_active_close", v)} opts={[{ v: "0", t: "Active" }, { v: "1", t: "Close" }]} />
          <Sel label="Android Attendances :" value={f.android_att_flag} onChange={(v) => set("android_att_flag", v)} opts={ANDROID} />
          <Sel label="GST To Be Payed :" value={f.gst_payed} onChange={(v) => set("gst_payed", v)} opts={GSTPAYED} />
          <Sel label="Employee Payment Bank :" req id="cl_paybank" value={f.payment_bank} onChange={(v) => set("payment_bank", v)} opts={bankOpts} />
          <Sel label="Billing Type:" req value={f.billing_ot} onChange={(v) => set("billing_ot", v)} opts={OTBILL} />
          <Sel label="R&M Service :" value={f.r_and_m_service} onChange={(v) => set("r_and_m_service", v)} opts={SEL01NA} />
          <Sel label="Administrative Expenses :" value={f.administrative_expense} onChange={(v) => set("administrative_expense", v)} opts={SEL01NA} />
          <Sel label="Lattitude And Longitude Flag :" value={f.lati_long_flag} onChange={(v) => set("lati_long_flag", v)} opts={LATLONG} />
          <Txt label="Absent Attendance Rate :" value={f.absent_attendance_rate} onChange={(v) => set("absent_attendance_rate", v)} maxLength={6} filter={onlyNum} />
          <Sel label="Incentive Applicable :" value={f.incentive_applicable} onChange={(v) => set("incentive_applicable", v)} opts={INCENT} />
          <Sel label="Feedback Applicable :" value={f.feedback_flag} onChange={(v) => set("feedback_flag", v)} opts={YN01} />
          <Sel label="Material Payment :" value={f.material_payment_flag} onChange={(v) => set("material_payment_flag", v)} opts={YN01} />
          {f.material_payment_flag === "1" &&
            <Txt label="Employee Salary On Material % :" value={f.emp_salary_on_material_percent} onChange={(v) => set("emp_salary_on_material_percent", v)} maxLength={6} filter={onlyNum} />}
          {selected && <>
            <Txt label="Reason For Updation :" req id="cl_reason" value={f.reason_for_updation} onChange={(v) => set("reason_for_updation", v)} maxLength={250} />
            {comments.length > 0 && <Field label="Update History :">
              <select className="lg-control" size={Math.min(9, comments.length)} style={{ height: "auto" }} value="">
                {comments.map((c, i) => <option key={i} value="">{c}</option>)}
              </select>
            </Field>}
          </>}
        </div>
        <div className="em-note">Client Email Id + Password is the mailbox mails are sent from (salary slip, letters, Send Email). Password is stored encrypted. Bank Account No: use the Bank Details tab (masked).</div>

        <div className="em-tabs">
          {TABS.map((t) => <div key={t.id} className={`em-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</div>)}
        </div>
        <div className="em-tabpane">
          {tab === "billing" && <div className="lg-form">
            <Sel label="OT Applicable:" value={f.ot_applicable} onChange={(v) => set("ot_applicable", v)} opts={OTAPP} />
            <Sel label="Billing Start Day:" req id="bl_start" value={f.billing_start_day} onChange={onStartDay} opts={dayOpts} />
            <Txt label="Billing End Day:" req value={f.billing_end_day} onChange={() => {}} readOnly />
          </div>}

          {tab === "designation" && <div>
            <div className="lg-form">
              <Sel label="State :" value={dd.state} onChange={(v) => setDd((p) => ({ ...p, state: v, location: "Select" }))} opts={stOpts} />
              <Sel label="Location :" value={dd.location} onChange={(v) => setDd((p) => ({ ...p, location: v }))} opts={[{ v: "Select", t: "Select" }, ...(stateCities[dd.state] ?? []).map((c) => ({ v: c, t: c }))]} />
              <Sel label="Designation List :" value={dd.designation} onChange={onDesignationPick} opts={gradeOpts} />
              <Sel label="Categories :" value={dd.category} onChange={(v) => setDd((p) => ({ ...p, category: v }))} opts={CATS} />
              <Txt label="Count :" value={dd.count} onChange={(v) => setDd((p) => ({ ...p, count: onlyNum(v) }))} maxLength={10} />
              <Txt label="Working Hours:" value={dd.hours} onChange={(v) => setDd((p) => ({ ...p, hours: onlyNum(v) }))} maxLength={3} />
              <Field label="Start Date :"><input type="date" className="lg-control" value={dd.start_date} onChange={(e) => setDd((p) => ({ ...p, start_date: e.target.value }))} title="Auto-filled from Services Category on Designation select (changeable)" /></Field>
              <Field label="End Date :"><input type="date" className="lg-control" value={dd.end_date} readOnly title="Auto-filled from Services Category (read-only, like legacy)" /></Field>
            </div>
            <button title="Add Item" onClick={addDesignation} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
            <table className="lg-grid"><thead><tr><th></th><th>Sr No.</th><th>State</th><th>Designation</th><th>Count</th><th>Hours</th><th>START DATE</th><th>END DATE</th><th>LOCATION</th><th>Category</th></tr></thead>
              <tbody>{designations.map((r, i) => (
                <tr key={i}><td><button className="lg-btn lg-btn-red" onClick={() => { if (confirm("Are you Sure You Want to Delete Record")) setDesignations((p) => p.filter((_, j) => j !== i)); }}>✕</button></td>
                  <td>{i + 1}</td><td>{r.state}</td><td>{r.designation}</td><td>{r.count}</td><td>{r.hours}</td>
                  <td>{r.start_date}</td><td>{r.end_date}</td><td>{r.location}</td><td>{r.category}</td></tr>
              ))}</tbody></table>
          </div>}

          {tab === "services" && <div>
            <div className="lg-form">
              <Sel label="Service Category :" value={sv.service} onChange={(v) => setSv((p) => ({ ...p, service: v }))} opts={SERVICES} />
              <Field label="Agreement Start Date  :"><input type="date" className="lg-control" value={sv.start_date} onChange={(e) => setSv((p) => ({ ...p, start_date: e.target.value }))} /></Field>
              <Field label="Agreement End Date  :"><input type="date" className="lg-control" value={sv.end_date} onChange={(e) => setSv((p) => ({ ...p, end_date: e.target.value }))} /></Field>
            </div>
            <button title="Add Item" onClick={addService} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
            <table className="lg-grid"><thead><tr><th></th><th>Sr No.</th><th>Services Type</th><th>Start Date</th><th>End Date</th></tr></thead>
              <tbody>{services.map((r, i) => (
                <tr key={i}><td><button className="lg-btn lg-btn-red" onClick={() => { if (confirm("Are you Sure You Want to Delete Record")) setServices((p) => p.filter((_, j) => j !== i)); }}>✕</button></td>
                  <td>{i + 1}</td><td>{String(r.service)}</td><td>{r.start_date}</td><td>{r.end_date}</td></tr>
              ))}</tbody></table>
          </div>}

          {tab === "bank" && <div>
            <div className="lg-form">
              <Txt label="Bank Name :" value={bk.bank_name} onChange={(v) => setBk((p) => ({ ...p, bank_name: v }))} maxLength={50} filter={alphaPunct} />
              <Txt label="Bank Account No. :" value={bk.account_no} onChange={(v) => setBk((p) => ({ ...p, account_no: onlyNum(v) }))} maxLength={30} />
              <Txt label="IFSC Code :" value={bk.ifsc_code} onChange={(v) => setBk((p) => ({ ...p, ifsc_code: v }))} maxLength={15} filter={alnumPunct} />
            </div>
            <button title="Add Item" onClick={addBank} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
            <div className="em-note">Account numbers are masked on save (only last 4 digits kept), never stored in plaintext.</div>
            <table className="lg-grid"><thead><tr><th></th><th>Sr No.</th><th>Bank Name</th><th>Account No.</th><th>IFSC Code</th></tr></thead>
              <tbody>{bankRows.map((r, i) => (
                <tr key={i}><td><button className="lg-btn lg-btn-red" onClick={() => { if (confirm("Are you Sure You Want to Delete Record")) setBankRows((p) => p.filter((_, j) => j !== i)); }}>✕</button></td>
                  <td>{i + 1}</td><td>{r.bank_name}</td><td>{r.account_no}</td><td>{r.ifsc_code}</td></tr>
              ))}</tbody></table>
          </div>}

          {tab === "documents" && <div>
            <div className="lg-form">
              <Txt label="Description :" value={doc.description} onChange={(v) => setDoc((p) => ({ ...p, description: v }))} maxLength={100} />
              <Field label="File to Upload :"><input type="file" className="lg-control" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} /></Field>
              <Field label="Start Date :"><input type="date" className="lg-control" value={doc.start_date} onChange={(e) => setDoc((p) => ({ ...p, start_date: e.target.value }))} /></Field>
              <Field label="End Date :"><input type="date" className="lg-control" value={doc.end_date} onChange={(e) => setDoc((p) => ({ ...p, end_date: e.target.value }))} /></Field>
            </div>
            <button title="Add Item" onClick={onUploadDoc}>Upload</button>
            <span style={{ fontSize: 11, marginLeft: 8 }}>Note: Only JPG, PNG and PDF files will be uploaded.</span>
            <table className="lg-grid"><thead><tr><th>Sr No.</th><th>Description</th><th>Start Date</th><th>End Date</th><th>Download File</th><th>Delete</th></tr></thead>
              <tbody>{docRows.map((r, i) => (
                <tr key={i}><td>{i + 1}</td><td>{r.description}</td><td>{r.start_date}</td><td>{r.end_date}</td>
                  <td><a href={`${API_BASE_URL}${IMGS}/${r.id}/download/`}>Download</a></td>
                  <td><button className="lg-btn lg-btn-red" onClick={async () => { if (confirm("Are you Sure You Want to Delete Record")) { const dres = await deleteItem(IMGS, Number(r.id)); if (!dres.ok) { alert(errMsg(dres.data) || "Document deletion failed..."); return; } setDocRows(await listByClient<Row>(IMGS, f.client_code.trim())); } }}>Delete</button></td></tr>
              ))}</tbody></table>
          </div>}

          {tab === "head" && <div>
            <div className="lg-form">
              <Sel label="Head Type :" value={hd.head_type} onChange={(v) => setHd((p) => ({ ...p, head_type: v }))} opts={HEAD_TYPES} />
              <Sel label="Title :" value={hd.title} onChange={(v) => setHd((p) => ({ ...p, title: v }))} opts={TITLES} />
              <Txt label="Head Name :" value={hd.name} onChange={(v) => setHd((p) => ({ ...p, name: v }))} filter={alphaPunct} />
              <Txt label="Head Mobile :" value={hd.mobile} onChange={(v) => setHd((p) => ({ ...p, mobile: onlyNum(v) }))} maxLength={10} />
              <Txt label="Head Email Id :" value={hd.email} onChange={(v) => setHd((p) => ({ ...p, email: emailKeys(v) }))} />
              <Field label="Head Birth Date :"><input type="date" className="lg-control" value={hd.birth} onChange={(e) => setHd((p) => ({ ...p, birth: e.target.value }))} /></Field>
              <Field label="Marriage Anniversary :"><input type="date" className="lg-control" value={hd.anniversary} onChange={(e) => setHd((p) => ({ ...p, anniversary: e.target.value }))} /></Field>
              <Txt label="Child 1 Name :" value={hd.child1} onChange={(v) => setHd((p) => ({ ...p, child1: v }))} />
              <Field label="Birth Date :"><input type="date" className="lg-control" value={hd.child1_birth} onChange={(e) => setHd((p) => ({ ...p, child1_birth: e.target.value }))} /></Field>
              <Txt label="Child 2 Name :" value={hd.child2} onChange={(v) => setHd((p) => ({ ...p, child2: v }))} />
              <Field label="Birth Date :"><input type="date" className="lg-control" value={hd.child2_birth} onChange={(e) => setHd((p) => ({ ...p, child2_birth: e.target.value }))} /></Field>
              <Txt label="Personal Mobile Number :" value={hd.personal_mobile} onChange={(v) => setHd((p) => ({ ...p, personal_mobile: onlyNum(v) }))} maxLength={10} />
              <Txt label="Personal Email ID :" value={hd.personal_email} onChange={(v) => setHd((p) => ({ ...p, personal_email: emailKeys(v) }))} />
            </div>
            <button title="Add Item" onClick={addHead} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
            <table className="lg-grid"><thead><tr><th></th><th>Sr No.</th><th>Head Type</th><th>Head Title</th><th>Head Name</th><th>Head Mobile</th><th>Head Email</th><th>Head Birth date</th><th>Marriage Anniversary</th><th>Child 1 Name</th><th>Child1 Birth Date</th><th>Child 2 Name</th><th>Child2 Birth date</th><th>Personal MobileNo</th><th>Personal EmailID</th></tr></thead>
              <tbody>{headRows.map((r, i) => (
                <tr key={i}><td><button className="lg-btn lg-btn-red" onClick={() => { if (confirm("Are you Sure You Want to Delete Record")) setHeadRows((p) => p.filter((_, j) => j !== i)); }}>✕</button></td>
                  <td>{i + 1}</td><td>{r.head_type}</td><td>{r.title}</td><td>{r.name}</td><td>{r.mobile}</td><td>{r.email}</td><td>{r.birth}</td><td>{r.anniversary}</td><td>{r.child1}</td><td>{r.child1_birth}</td><td>{r.child2}</td><td>{r.child2_birth}</td><td>{r.personal_mobile}</td><td>{r.personal_email}</td></tr>
              ))}</tbody></table>
          </div>}

          {tab === "zonehead" && <div>
            <div className="lg-form">
              <Sel label="Zone Head Type :" value={zn.head_type} onChange={(v) => setZn((p) => ({ ...p, head_type: v }))} opts={ZONE_HEAD_TYPES} />
              <Sel label="Zone :" value={zn.zone} onChange={(v) => setZn((p) => ({ ...p, zone: v }))} opts={ZONES} />
              <Sel label="Title :" value={zn.title} onChange={(v) => setZn((p) => ({ ...p, title: v }))} opts={TITLES} />
              <Txt label="Head Name :" value={zn.name} onChange={(v) => setZn((p) => ({ ...p, name: v }))} />
              <Txt label="Head Mobile :" value={zn.mobile} onChange={(v) => setZn((p) => ({ ...p, mobile: onlyNum(v) }))} maxLength={10} />
              <Txt label="Head Email Id :" value={zn.email} onChange={(v) => setZn((p) => ({ ...p, email: emailKeys(v) }))} />
              <Field label="Head Birth Date :"><input type="date" className="lg-control" value={zn.birth} onChange={(e) => setZn((p) => ({ ...p, birth: e.target.value }))} /></Field>
              <Field label="Marriage Anniversary :"><input type="date" className="lg-control" value={zn.anniversary} onChange={(e) => setZn((p) => ({ ...p, anniversary: e.target.value }))} /></Field>
              <Txt label="Child 1 Name :" value={zn.child1} onChange={(v) => setZn((p) => ({ ...p, child1: v }))} />
              <Field label="Birth Date :"><input type="date" className="lg-control" value={zn.child1_birth} onChange={(e) => setZn((p) => ({ ...p, child1_birth: e.target.value }))} /></Field>
              <Txt label="Child 2 Name :" value={zn.child2} onChange={(v) => setZn((p) => ({ ...p, child2: v }))} />
              <Field label="Birth Date :"><input type="date" className="lg-control" value={zn.child2_birth} onChange={(e) => setZn((p) => ({ ...p, child2_birth: e.target.value }))} /></Field>
              <Txt label="Personal Mobile Number :" value={zn.personal_mobile} onChange={(v) => setZn((p) => ({ ...p, personal_mobile: onlyNum(v) }))} maxLength={10} />
              <Txt label="Personal Email ID :" value={zn.personal_email} onChange={(v) => setZn((p) => ({ ...p, personal_email: emailKeys(v) }))} />
            </div>
            <button title="Add Item" onClick={addZone} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
            <table className="lg-grid"><thead><tr><th></th><th>Sr No.</th><th>Head Type</th><th>Zone</th><th>Title</th><th>Head Name</th><th>Head Mobile</th><th>Head Email</th><th>Head Birth date</th><th>Marriage Anniversary</th><th>Child 1 Name</th><th>Child1 Birth Date</th><th>Child 2 Name</th><th>Child2 Birth date</th><th>Personal MobileNo</th><th>Personal EmailID</th></tr></thead>
              <tbody>{zoneRows.map((r, i) => (
                <tr key={i}><td><button className="lg-btn lg-btn-red" onClick={() => { if (confirm("Are you Sure You Want to Delete Record")) setZoneRows((p) => p.filter((_, j) => j !== i)); }}>✕</button></td>
                  <td>{i + 1}</td><td>{r.head_type}</td><td>{r.zone}</td><td>{r.title}</td><td>{r.name}</td><td>{r.mobile}</td><td>{r.email}</td><td>{r.birth}</td><td>{r.anniversary}</td><td>{r.child1}</td><td>{r.child1_birth}</td><td>{r.child2}</td><td>{r.child2_birth}</td><td>{r.personal_mobile}</td><td>{r.personal_email}</td></tr>
              ))}</tbody></table>
          </div>}

          {tab === "regionhead" && <div>
            <div className="lg-form">
              <Sel label="Region Head Type :" value={rg.head_type} onChange={(v) => setRg((p) => ({ ...p, head_type: v }))} opts={ZONE_HEAD_TYPES} />
              <Sel label="Zone :" value={rg.zone} onChange={(v) => setRg((p) => ({ ...p, zone: v }))} opts={CLUSTER_ZONES} />
              <Txt label="Region :" value={rg.region} onChange={(v) => setRg((p) => ({ ...p, region: v }))} />
              <Sel label="Title :" value={rg.title} onChange={(v) => setRg((p) => ({ ...p, title: v }))} opts={TITLES} />
              <Txt label="Head Name :" value={rg.name} onChange={(v) => setRg((p) => ({ ...p, name: v }))} />
              <Txt label="Head Mobile :" value={rg.mobile} onChange={(v) => setRg((p) => ({ ...p, mobile: onlyNum(v) }))} maxLength={10} />
              <Txt label="Head Email Id :" value={rg.email} onChange={(v) => setRg((p) => ({ ...p, email: emailKeys(v) }))} />
              <Field label="Head Birth Date :"><input type="date" className="lg-control" value={rg.birth} onChange={(e) => setRg((p) => ({ ...p, birth: e.target.value }))} /></Field>
              <Field label="Marriage Anniversary :"><input type="date" className="lg-control" value={rg.anniversary} onChange={(e) => setRg((p) => ({ ...p, anniversary: e.target.value }))} /></Field>
              <Txt label="Child 1 Name :" value={rg.child1} onChange={(v) => setRg((p) => ({ ...p, child1: v }))} />
              <Field label="Birth Date :"><input type="date" className="lg-control" value={rg.child1_birth} onChange={(e) => setRg((p) => ({ ...p, child1_birth: e.target.value }))} /></Field>
              <Txt label="Child 2 Name :" value={rg.child2} onChange={(v) => setRg((p) => ({ ...p, child2: v }))} />
              <Field label="Birth Date :"><input type="date" className="lg-control" value={rg.child2_birth} onChange={(e) => setRg((p) => ({ ...p, child2_birth: e.target.value }))} /></Field>
              <Txt label="Personal Mobile Number :" value={rg.personal_mobile} onChange={(v) => setRg((p) => ({ ...p, personal_mobile: onlyNum(v) }))} maxLength={10} />
              <Txt label="Personal Email ID :" value={rg.personal_email} onChange={(v) => setRg((p) => ({ ...p, personal_email: emailKeys(v) }))} />
            </div>
            <button title="Add Item" onClick={addRegion} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
            <table className="lg-grid"><thead><tr><th></th><th>Sr No.</th><th>Head Type</th><th>Zone</th><th>Region</th><th>Title</th><th>Head Name</th><th>Head Mobile</th><th>Head Email</th><th>Head Birth date</th><th>Marriage Anniversary</th><th>Child 1 Name</th><th>Child1 Birth Date</th><th>Child 2 Name</th><th>Child2 Birth date</th><th>Personal MobileNo</th><th>Personal EmailID</th></tr></thead>
              <tbody>{regionRows.map((r, i) => (
                <tr key={i}><td><button className="lg-btn lg-btn-red" onClick={() => { if (confirm("Are you Sure You Want to Delete Record")) setRegionRows((p) => p.filter((_, j) => j !== i)); }}>✕</button></td>
                  <td>{i + 1}</td><td>{r.head_type}</td><td>{r.zone}</td><td>{r.region}</td><td>{r.title}</td><td>{r.name}</td><td>{r.mobile}</td><td>{r.email}</td><td>{r.birth}</td><td>{r.anniversary}</td><td>{r.child1}</td><td>{r.child1_birth}</td><td>{r.child2}</td><td>{r.child2_birth}</td><td>{r.personal_mobile}</td><td>{r.personal_email}</td></tr>
              ))}</tbody></table>
          </div>}

          {tab === "cluster" && <div>
            <div className="lg-form">
              <Sel label="Region Head Type :" value={cl.head_type} onChange={(v) => setCl((p) => ({ ...p, head_type: v }))} opts={ZONE_HEAD_TYPES} />
              <Sel label="Zone :" value={cl.zone} onChange={(v) => setCl((p) => ({ ...p, zone: v }))} opts={CLUSTER_ZONES} />
              <Txt label="Region :" value={cl.region} onChange={(v) => setCl((p) => ({ ...p, region: v }))} />
              <Sel label="Title :" value={cl.title} onChange={(v) => setCl((p) => ({ ...p, title: v }))} opts={TITLES} />
              <Txt label="Head Name :" value={cl.name} onChange={(v) => setCl((p) => ({ ...p, name: v }))} />
              <Txt label="Head Mobile :" value={cl.mobile} onChange={(v) => setCl((p) => ({ ...p, mobile: onlyNum(v) }))} maxLength={10} />
              <Txt label="Head Email Id :" value={cl.email} onChange={(v) => setCl((p) => ({ ...p, email: emailKeys(v) }))} />
              <Field label="Head Birth Date :"><input type="date" className="lg-control" value={cl.birth} onChange={(e) => setCl((p) => ({ ...p, birth: e.target.value }))} /></Field>
              <Field label="Marriage Anniversary :"><input type="date" className="lg-control" value={cl.anniversary} onChange={(e) => setCl((p) => ({ ...p, anniversary: e.target.value }))} /></Field>
              <Txt label="Child 1 Name :" value={cl.child1} onChange={(v) => setCl((p) => ({ ...p, child1: v }))} />
              <Field label="Birth Date :"><input type="date" className="lg-control" value={cl.child1_birth} onChange={(e) => setCl((p) => ({ ...p, child1_birth: e.target.value }))} /></Field>
              <Txt label="Child 2 Name :" value={cl.child2} onChange={(v) => setCl((p) => ({ ...p, child2: v }))} />
              <Field label="Birth Date :"><input type="date" className="lg-control" value={cl.child2_birth} onChange={(e) => setCl((p) => ({ ...p, child2_birth: e.target.value }))} /></Field>
              <Txt label="Personal Mobile Number :" value={cl.personal_mobile} onChange={(v) => setCl((p) => ({ ...p, personal_mobile: onlyNum(v) }))} maxLength={10} />
              <Txt label="Personal Email ID :" value={cl.personal_email} onChange={(v) => setCl((p) => ({ ...p, personal_email: emailKeys(v) }))} />
            </div>
            <button title="Add Item" onClick={addCluster} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
            <table className="lg-grid"><thead><tr><th></th><th>Sr No.</th><th>Head Type</th><th>Zone</th><th>Region</th><th>Title</th><th>Head Name</th><th>Head Mobile</th><th>Head Email</th><th>Head Birth date</th><th>Marriage Anniversary</th><th>Child 1 Name</th><th>Child1 Birth Date</th><th>Child 2 Name</th><th>Child2 Birth date</th><th>Personal MobileNo</th><th>Personal EmailID</th></tr></thead>
              <tbody>{clusterRows.map((r, i) => (
                <tr key={i}><td><button className="lg-btn lg-btn-red" onClick={() => { if (confirm("Are you Sure You Want to Delete Record")) setClusterRows((p) => p.filter((_, j) => j !== i)); }}>✕</button></td>
                  <td>{i + 1}</td><td>{r.head_type}</td><td>{r.zone}</td><td>{r.region}</td><td>{r.title}</td><td>{r.name}</td><td>{r.mobile}</td><td>{r.email}</td><td>{r.birth}</td><td>{r.anniversary}</td><td>{r.child1}</td><td>{r.child1_birth}</td><td>{r.child2}</td><td>{r.child2_birth}</td><td>{r.personal_mobile}</td><td>{r.personal_email}</td></tr>
              ))}</tbody></table>
          </div>}

          {tab === "gst" && <div>
            <div className="lg-form">
              <Sel label="Location-wise GST :" value={f.gst_locationwise} onChange={(v) => set("gst_locationwise", v)} opts={[{ v: "0", t: "No (State-wise GST)" }, { v: "1", t: "Yes (every branch has its own GST)" }]} />
            </div>
            <div className="lg-form">
              <Sel label="Client GST State :" value={gs.gst_state} onChange={(v) => setGs((p) => ({ ...p, gst_state: v }))} opts={stOpts} />
              <Txt label="Client GST Address :" value={gs.gst_address} onChange={(v) => setGs((p) => ({ ...p, gst_address: v }))} maxLength={100} />
              <Txt label="GST IN :" value={gs.gstin} onChange={(v) => setGs((p) => ({ ...p, gstin: v }))} maxLength={30} filter={alnumPunct} />
              <Txt label="GST PINCODE :" value={gs.pincode} onChange={(v) => setGs((p) => ({ ...p, pincode: onlyNum(v) }))} maxLength={30} />
              {f.gst_locationwise === "1" && <Txt label="Location Name :" value={gs.gst_loc} onChange={(v) => setGs((p) => ({ ...p, gst_loc: v }))} maxLength={100} />}
              {f.gst_locationwise === "1" && <Sel label="GST Billing Type :" value={gs.gst_type} onChange={(v) => setGs((p) => ({ ...p, gst_type: v }))} opts={[{ v: "B2B", t: "CC / B2B" }, { v: "B2C", t: "B2C" }]} />}
            </div>
            <button title="Add Item" onClick={addGst} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
            <table className="lg-grid"><thead><tr><th></th><th>Sr No.</th><th>GST State</th>{f.gst_locationwise === "1" && <th>Location</th>}{f.gst_locationwise === "1" && <th>Billing Type</th>}<th>GST Address</th><th>GST IN</th><th>GST PINCODE</th></tr></thead>
              <tbody>{gstRows.map((r, i) => (
                <tr key={i}><td><button className="lg-btn lg-btn-red" onClick={() => { if (confirm("Are you Sure You Want to Delete Record")) setGstRows((p) => p.filter((_, j) => j !== i)); }}>✕</button></td>
                  <td>{i + 1}</td><td>{r.gst_state}</td>{f.gst_locationwise === "1" && <td>{r.gst_loc}</td>}{f.gst_locationwise === "1" && <td>{String(r.gst_type ?? "B2B") === "B2C" ? "B2C" : "CC / B2B"}</td>}<td>{r.gst_address}</td><td>{r.gstin}</td><td>{r.pincode}</td></tr>
              ))}</tbody></table>
          </div>}

          {tab === "additems" && <div>
            <div className="lg-form">
              <Txt label="Item Name :" value={it.item_name} onChange={(v) => setIt((p) => ({ ...p, item_name: v }))} maxLength={100} />
              <Txt label="Number Of Quanatity :" value={it.quantity} onChange={(v) => setIt((p) => ({ ...p, quantity: onlyNum(v) }))} maxLength={10} />
              <Txt label="Validity(In Days) :" value={it.validity} onChange={(v) => setIt((p) => ({ ...p, validity: onlyNum(v) }))} maxLength={10} />
              <Field label="Expiry Date :"><input type="date" className="lg-control" value={it.expiry} onChange={(e) => setIt((p) => ({ ...p, expiry: e.target.value }))} /></Field>
            </div>
            <button title="Add Item" onClick={addItem} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
            <table className="lg-grid"><thead><tr><th></th><th>Sr No.</th><th>Item Name</th><th>Quantity</th><th>Validity(In Days)</th><th>Expiry Date</th></tr></thead>
              <tbody>{itemRows.map((r, i) => (
                <tr key={i}><td><button className="lg-btn lg-btn-red" onClick={() => { if (confirm("Are you Sure You Want to Delete Record")) setItemRows((p) => p.filter((_, j) => j !== i)); }}>✕</button></td>
                  <td>{i + 1}</td><td>{r.item_name}</td><td>{r.quantity}</td><td>{r.validity}</td><td>{r.expiry}</td></tr>
              ))}</tbody></table>
          </div>}

          {tab === "sendemail" && <div>
            <div className="lg-form">
              <Sel label="Email Type :" value={sm.email_type} onChange={(v) => setSm((p) => ({ ...p, email_type: v, head_name: "Select" }))} opts={[{ v: "Select", t: "Select" }, { v: "Head_Info", t: "Head_Info" }, { v: "Zone_Head_Info", t: "Zone_Head_Info" }, { v: "Region_Head_Info", t: "Region_Head_Info" }]} />
              <Sel label="Head Type :" value={sm.head_type} onChange={(v) => setSm((p) => ({ ...p, head_type: v }))} opts={HEAD_TYPES} />
              <Sel label="Head Title :" value={sm.head_title} onChange={(v) => setSm((p) => ({ ...p, head_title: v }))} opts={TITLES} />
              <Sel label="Head Name :" value={sm.head_name} onChange={(v) => setSm((p) => ({ ...p, head_name: v }))} opts={[{ v: "Select", t: "Select" },
                ...Array.from(new Set([
                  ...(sm.email_type === "Zone_Head_Info" ? zoneRows.map((r) => String(r.name ?? "")) :
                    sm.email_type === "Region_Head_Info" ? regionRows.map((r) => String(r.name ?? "")) :
                    headRows.map((r) => String(r.name ?? ""))),
                ].filter(Boolean))).map((n) => ({ v: n, t: n }))]} />
              <Txt label="Head Email Id :" value={sm.head_email} onChange={(v) => setSm((p) => ({ ...p, head_email: emailKeys(v) }))} maxLength={100} />
            </div>
            <button title="Add Item" onClick={addSendMail} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
            <table className="lg-grid"><thead><tr><th></th><th>Sr No.</th><th>Head Type</th><th>Head Title</th><th>Head Name</th><th>Head Email</th></tr></thead>
              <tbody>{sendMailRows.map((r, i) => (
                <tr key={i}><td><button className="lg-btn lg-btn-red" onClick={() => { if (confirm("Are you Sure You Want to Delete Record")) setSendMailRows((p) => p.filter((_, j) => j !== i)); }}>✕</button></td>
                  <td>{i + 1}</td><td>{r.head_type}</td><td>{r.head_title}</td><td>{r.head_name}</td><td>{r.head_email}</td></tr>
              ))}</tbody></table>
          </div>}

          {tab === "company" && <div>
            <div className="lg-form">
              <Txt label="Company Name :" value={cp.company_name} onChange={(v) => setCp((p) => ({ ...p, company_name: v }))} maxLength={100} />
              <Txt label="GST No :" value={cp.gst_no} onChange={(v) => setCp((p) => ({ ...p, gst_no: v }))} maxLength={15} />
              <Txt label="GST Address :" value={cp.gst_address} onChange={(v) => setCp((p) => ({ ...p, gst_address: v }))} maxLength={300} />
            </div>
            <button title="Add Item" onClick={addCompany} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
            <table className="lg-grid"><thead><tr><th></th><th>Sr No.</th><th>Company Name</th><th>Gst No</th><th>Address</th></tr></thead>
              <tbody>{companyRows.map((r, i) => (
                <tr key={i}><td><button className="lg-btn lg-btn-red" onClick={() => { if (confirm("Are you Sure You Want to Delete Record")) setCompanyRows((p) => p.filter((_, j) => j !== i)); }}>✕</button></td>
                  <td>{i + 1}</td><td>{r.company_name}</td><td>{r.gst_no}</td><td>{r.gst_address}</td></tr>
              ))}</tbody></table>
          </div>}

          {tab === "billcheck" && <div>
            <div className="lg-form">
              <Sel label="Enter Billing Check List Name :" value={bl.checklist_name} onChange={(v) => setBl((p) => ({ ...p, checklist_name: v }))} opts={CHECKLIST_NAMES} />
              <Sel label="Billing :" value={bl.checklist_billing} onChange={(v) => setBl((p) => ({ ...p, checklist_billing: v }))} opts={CHECKLIST_BILLING} />
              <Sel label="State :" value={bl.state} onChange={(v) => setBl((p) => ({ ...p, state: v }))} opts={stOpts} />
              <Txt label="Invoice Shipping Address :" value={bl.invoice_shipping_address} onChange={(v) => setBl((p) => ({ ...p, invoice_shipping_address: v }))} />
            </div>
            <button title="Add Item" onClick={addBill} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
            <table className="lg-grid"><thead><tr><th></th><th>Sr No.</th><th>Billing Type</th><th>Check List Number</th><th>Billing</th><th>Billing wise</th><th>State</th><th>Invoice Shipping Address</th></tr></thead>
              <tbody>{billRows.map((r, i) => (
                <tr key={i}><td><button className="lg-btn lg-btn-red" onClick={() => { if (confirm("Are you Sure You Want to Delete Record")) setBillRows((p) => p.filter((_, j) => j !== i)); }}>✕</button></td>
                  <td>{i + 1}</td><td>{CHECKLIST_NAMES.find((c) => c.v === String(r.checklist_name))?.t}</td><td>{r.checklist_name}</td>
                  <td>{CHECKLIST_BILLING.find((c) => c.v === String(r.checklist_billing))?.t}</td><td>{r.checklist_billing}</td>
                  <td>{r.state}</td><td>{r.invoice_shipping_address}</td></tr>
              ))}</tbody></table>
          </div>}

          {tab === "esic" && <div>
            <div className="lg-form">
              <Sel label="ESIC State:" value={es.esic_state} onChange={(v) => setEs((p) => ({ ...p, esic_state: v }))} opts={stOpts} />
              <Txt label="ESIC Office Address :" value={es.esic_address} onChange={(v) => setEs((p) => ({ ...p, esic_address: v }))} maxLength={250} filter={alphaAddr} />
              <Txt label="ESIC Registration Number :" value={es.esic_code} onChange={(v) => setEs((p) => ({ ...p, esic_code: v }))} maxLength={17} filter={onlyNum} />
            </div>
            <button title="Add Item" onClick={addEsic} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
            <table className="lg-grid"><thead><tr><th></th><th>Sr No.</th><th>ESIC State</th><th>ESIC ADDRESS</th><th>ESIC CODE</th></tr></thead>
              <tbody>{esicRows.map((r, i) => (
                <tr key={i}><td><button className="lg-btn lg-btn-red" onClick={() => { if (confirm("Are you Sure You Want to Delete Record")) setEsicRows((p) => p.filter((_, j) => j !== i)); }}>✕</button></td>
                  <td>{i + 1}</td><td>{r.esic_state}</td><td>{r.esic_address}</td><td>{r.esic_code}</td></tr>
              ))}</tbody></table>
          </div>}

          {tab === "deduction" && <div>
            <div className="lg-form">
              <Sel label="Deduction Item :" value={dc.deduction_item} onChange={(v) => setDc((p) => ({ ...p, deduction_item: v }))} opts={DEDUCT_ITEMS} />
              <Txt label="Deduction Amount:" value={dc.deduction_amount} onChange={(v) => setDc((p) => ({ ...p, deduction_amount: v }))} maxLength={100} />
            </div>
            <button title="Add Item" onClick={addDeduct} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
            <table className="lg-grid"><thead><tr><th></th><th>Sr No.</th><th>Deduction item Name</th><th>Amount</th></tr></thead>
              <tbody>{deductRows.map((r, i) => (
                <tr key={i}><td><button className="lg-btn lg-btn-red" onClick={() => setDeductRows((p) => p.filter((_, j) => j !== i))}>✕</button></td>
                  <td>{i + 1}</td><td>{r.deduction_item}</td><td>{r.deduction_amount}</td></tr>
              ))}</tbody></table>
          </div>}

          {tab === "email" && <div>
            <div className="lg-form">
              <Sel label="Department :" value={em.department} onChange={(v) => setEm((p) => ({ ...p, department: v }))} opts={EMAIL_DEPTS.map((d) => ({ v: d, t: d }))} />
              <Txt label="Email :" value={em.email} onChange={(v) => setEm((p) => ({ ...p, email: emailKeys(v) }))} />
              <Field label="Password :"><input className="lg-control" type="password" autoComplete="new-password" value={em.password} onChange={(e) => setEm((p) => ({ ...p, password: e.target.value }))} /></Field>
              <Txt label="Name :" value={em.name} onChange={(v) => setEm((p) => ({ ...p, name: v }))} />
              <Txt label="Mobile NUM :" value={em.mobile} onChange={(v) => setEm((p) => ({ ...p, mobile: onlyNum(v) }))} maxLength={10} />
              <Txt label="Designation :" value={em.designation} onChange={(v) => setEm((p) => ({ ...p, designation: v }))} />
              <Txt label="To-Invoice Mail :" value={em.to_addr} onChange={(v) => setEm((p) => ({ ...p, to_addr: v }))} />
              <Txt label="CC-Invoice Mail :" value={em.cc} onChange={(v) => setEm((p) => ({ ...p, cc: v }))} />
              <Txt label="BCC-Invoice Mail :" value={em.bcc} onChange={(v) => setEm((p) => ({ ...p, bcc: v }))} />
            </div>
            <button title="Add Item" onClick={addEmail} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
            <div className="em-note">Invoice/Finance Email + Password is the mailbox invoice softcopy is sent from. Passwords are stored encrypted; a saved password is kept when the row is re-saved.</div>
            <table className="lg-grid"><thead><tr><th></th><th>Department</th><th>Email</th><th>Password</th><th>Name</th><th>Mobile NUM</th><th>Designation</th><th>To-Invoice Mail</th><th>CC-Invoice Mail</th><th>BCC-Invoice Mail</th></tr></thead>
              <tbody>{emailRows.map((r, i) => (
                <tr key={i}><td><button className="lg-btn lg-btn-red" onClick={() => { if (confirm("Are you Sure You Want to Delete Record")) setEmailRows((p) => p.filter((_, j) => j !== i)); }}>✕</button></td>
                  <td>{r.department}</td><td>{r.email}</td><td>{r.has_password ? "******" : ""}</td><td>{r.name}</td><td>{r.mobile}</td><td>{r.designation}</td><td>{r.to_addr}</td><td>{r.cc}</td><td>{r.bcc}</td></tr>
              ))}</tbody></table>
          </div>}

          {tab === "uniformded" && <div>
            <div className="lg-form">
              <Sel label="Deduction :" value={un.deduction} onChange={(v) => setUn((p) => ({ ...p, deduction: v }))} opts={YN01} />
              <Sel label="No Of Uniform :" value={un.no_uniform} onChange={(v) => setUn((p) => ({ ...p, no_uniform: v }))} opts={[{ v: "1", t: "1" }, { v: "2", t: "2" }]} />
              <Sel label="No Of Shoes :" value={un.no_shoes} onChange={(v) => setUn((p) => ({ ...p, no_shoes: v }))} opts={[{ v: "0", t: "0" }, { v: "1", t: "1" }]} />
              <Sel label="No Of Id Card :" value={un.no_id} onChange={(v) => setUn((p) => ({ ...p, no_id: v }))} opts={[{ v: "0", t: "0" }, { v: "1", t: "1" }]} />
              <Field label="Month / Year :"><input type="month" className="lg-control" value={un.month} onChange={(e) => setUn((p) => ({ ...p, month: e.target.value }))} /></Field>
            </div>
            <button title="Add Item" onClick={addUniform} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
            <table className="lg-grid"><thead><tr><th></th><th>Sr No.</th><th>Deduction</th><th>Uniform Set</th><th>Shoes Set</th><th>Id Card Set</th><th>Month/Year</th></tr></thead>
              <tbody>{uniformRows.map((r, i) => (
                <tr key={i}><td><button className="lg-btn lg-btn-red" onClick={() => { if (confirm("Are you Sure You Want to Delete Record")) setUniformRows((p) => p.filter((_, j) => j !== i)); }}>✕</button></td>
                  <td>{i + 1}</td><td>{r.deduction}</td><td>{r.no_uniform}</td><td>{r.no_shoes}</td><td>{r.no_id}</td><td>{r.month}</td></tr>
              ))}</tbody></table>
          </div>}

          {tab === "companybank" && <div>
            <div className="lg-form">
              <Sel label="Payment Against Bank :" value={cb.payment_bank} onChange={(v) => setCb((p) => ({ ...p, payment_bank: v }))} opts={bankOpts} />
              <Txt label="Company A/C No :" value={cb.ac_no} onChange={(v) => setCb((p) => ({ ...p, ac_no: onlyNum(v) }))} />
              <Field label="Bank Period start Date :"><input type="date" className="lg-control" value={cb.from_date} onChange={(e) => setCb((p) => ({ ...p, from_date: e.target.value }))} /></Field>
              <Field label="Bank Period End Date :"><input type="date" className="lg-control" value={cb.to_date} onChange={(e) => setCb((p) => ({ ...p, to_date: e.target.value }))} /></Field>
            </div>
            <button title="Add Item" onClick={addCompanyBank} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
            <div className="em-note">Company account numbers are masked on save, never stored in plaintext.</div>
            <table className="lg-grid"><thead><tr><th></th><th>Sr No.</th><th>Payment Against Bank</th><th>Company A/C No</th><th>Bank Start Date</th><th>Bank End Date</th></tr></thead>
              <tbody>{companyBankRows.map((r, i) => (
                <tr key={i}><td><button className="lg-btn lg-btn-red" onClick={() => { if (confirm("Are you Sure You Want to Delete Record")) setCompanyBankRows((p) => p.filter((_, j) => j !== i)); }}>✕</button></td>
                  <td>{i + 1}</td><td>{r.payment_bank}</td><td>{r.ac_no}</td><td>{r.from_date}</td><td>{r.to_date}</td></tr>
              ))}</tbody></table>
          </div>}

          {tab === "fire" && <div>
            <div className="lg-form">
              <Sel label="Fire Extinguisher Applicable :" value={fr.applicable} onChange={(v) => setFr((p) => ({ ...p, applicable: v }))} opts={FIRE_OPTS} />
              {fr.applicable === "Applicable" && <>
                <Txt label="No OF Days :" value={fr.no_of_days} onChange={(v) => setFr((p) => ({ ...p, no_of_days: onlyNum(v) }))} />
                <Txt label="Interval :" value={fr.interval} onChange={(v) => setFr((p) => ({ ...p, interval: onlyNum(v) }))} />
              </>}
            </div>
            <button title="Add Item" onClick={addFire} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
            <table className="lg-grid"><thead><tr><th></th><th>Sr No.</th><th>Fire Extinguisher Applicable</th><th>No Of Days</th><th>Interval</th></tr></thead>
              <tbody>{fireRows.map((r, i) => (
                <tr key={i}><td><button className="lg-btn lg-btn-red" onClick={() => { if (confirm("Are you Sure You Want to Delete Record")) setFireRows((p) => p.filter((_, j) => j !== i)); }}>✕</button></td>
                  <td>{i + 1}</td><td>{r.applicable}</td><td>{r.no_of_days}</td><td>{r.interval}</td></tr>
              ))}</tbody></table>
          </div>}

          {tab === "club" && <div className="lg-form">
            <Sel label="Invoice Clubbing Type :" value={cbp.clubbing || f.billing_type} onChange={(v) => { setCbp({ clubbing: v }); set("billing_type", v); }} opts={CLUB_OPTS} />
            <div className="em-note">Legacy ddl_club (Unclub / Manpower + Material / Manpower + Machine Rental / Manpower + Material + Pest Control). Saves with the client form.</div>
          </div>}

          {tab === "feedback" && <div>
            <div className="lg-form">
              <Sel label="Feedback" value={fb.feedback} onChange={(v) => setFb((p) => ({ ...p, feedback: v }))} opts={FEEDBACKS} />
              <Field label="Remark"><textarea className="lg-control" value={fb.remark} onChange={(e) => setFb((p) => ({ ...p, remark: e.target.value }))} /></Field>
            </div>
            <button title="Add Item" onClick={addFeedback} style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
            <table className="lg-grid"><thead><tr><th></th><th>Sr No.</th><th>Feedback Name</th><th>Remark</th></tr></thead>
              <tbody>{feedRows.map((r, i) => (
                <tr key={i}><td><button className="lg-btn lg-btn-red" onClick={() => setFeedRows((p) => p.filter((_, j) => j !== i))}>✕</button></td>
                  <td>{i + 1}</td><td>{r.feedback}</td><td>{r.remark}</td></tr>
              ))}</tbody></table>
          </div>}
        </div>
        <br />
        {selected && (
          <div className="container-fluid" style={{ marginBottom: 15 }}>
            <div className="panel panel-primary" style={{ backgroundColor: "#f3f1fe", borderRadius: 10, border: "1px solid white" }}>
              <div className="panel-heading">
                <div style={{ color: "white", fontWeight: "bold", fontSize: 15 }}>Reason for Updation</div>
              </div>
              <div className="panel-body container" style={{ width: "100%" }}>
                <div className="row">
                  {comments.length > 0 && (
                    <div className="col-xs-12" style={{ marginBottom: 10 }}>
                      <select className="form-control" size={Math.min(9, comments.length)} style={{ height: "auto" }} value="" onChange={() => {}}>
                        {comments.map((c, i) => <option key={i} value="">{`${i + 1}. ${c}`}</option>)}
                      </select>
                    </div>
                  )}
                  <div className="col-xs-12">
                    <textarea id="cl_reason" className="form-control" rows={4} maxLength={250} placeholder="Enter Reason for Updation"
                      value={f.reason_for_updation} onChange={(e) => set("reason_for_updation", e.target.value)} style={{ width: "100%" }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="lg-btns center">
          {!selected && <button className="lg-btn lg-btn-green" disabled={busy} onClick={onSave}>Save</button>}
          {selected && <button className="lg-btn lg-btn-green" disabled={busy} onClick={onUpdate}>Update</button>}
          {selected && <button className="lg-btn lg-btn-red" disabled={busy} onClick={onDelete}>Delete</button>}
          <button className="lg-btn lg-btn-green" onClick={clearForm}>Clear</button>
          <Link href="/" className="lg-btn lg-btn-red" style={{ textDecoration: "none" }}>Close</Link>
        </div>

        {isAdmin && selected && (
          <div className="lg-form" style={{ marginTop: 12 }}>
            <Field label="Login Username :"><input className="lg-control" value={provUser} onChange={(e) => setProvUser(e.target.value)} maxLength={150} placeholder="email for client login" /></Field>
            <div><button className="lg-btn lg-btn-green" disabled={busy} onClick={onProvisionUser}>Provision Client Login</button></div>
            {provResult && <div className="em-note">Login <b>{provResult.username}</b> provisioned. Setup token (show once, deliver out-of-band): <code>{provResult.setup_token}</code></div>}
          </div>
        )}

        <div style={{ marginBottom: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div className="dt-btns no-print" style={{ marginBottom: 0 }}>
            <ExportButtons
              filename="clients"
              columns={[
                { key: "client_name", label: "CLIENT NAME" },
                { key: "client_code", label: "CLIENT CODE" },
                { key: "state", label: "STATE" },
                { key: "city", label: "CITY" },
                { key: "total_employee", label: "TOTAL EMPLOYEE" },
              ]}
              rows={rows}
            />
          </div>
          <button type="button" className="lg-btn" disabled={loading} onClick={load}>↻ Refresh grid</button>
          {listError && <span style={{ color: "#a94442", fontSize: 12 }}>{listError}</span>}
          {!loading && !listError && <span style={{ color: "#555", fontSize: 12 }}>{rows.length} clients</span>}
        </div>
        {loading ? <p>Loading…</p> : (
          <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 420, border: "1px solid #ccc", background: "#fff" }}>
          <div className="dt-scroll"><table className="dt-grid">
            <thead><tr><th>CLIENT NAME</th><th>CLIENT CODE</th><th>STATE</th><th>CITY</th><th>TOTAL EMPLOYEE</th></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "#777" }}>No clients</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className={selected?.id === r.id ? "dt-selected" : ""} style={{ cursor: "pointer" }} onClick={() => selectRow(r)}>
                  <td>{r.client_name}</td><td>{r.client_code}</td><td>{r.state}</td><td>{r.city}</td><td>{r.total_employee}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
          </div>
        )}
      </div>
    </div>
  );
}
