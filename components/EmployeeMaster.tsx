"use client";

/**
 * Employee Master — faithful 1:1 replica of the legacy IHMS EmployeeMaster.aspx.
 *
 * Same title, same 12-tab layout, same field labels, same dropdown option values,
 * same required (*) markers, same client-side validation MESSAGES and ORDER
 * (ported from update_validation1 / the code-behind alerts), same button row and
 * same search-grid columns.
 *
 * Persistence:
 *   - Safe HR/directory fields  -> /api/hr/employees   (modern core CRUD).
 *   - Aadhaar / PAN / bank / nominee / family (KYC)     -> /api/hr/employee-kyc
 *     (existing SECURE module: encrypted at rest, duplicate blind-index checks,
 *      2-level bank approval). Plaintext is never returned, so on edit these
 *      fields show masked/blank and are re-entered — matching the secure design.
 *   - Aadhaar strip search -> /api/hr/employee-kyc/aadhaar-search/ (blind-hash
 *     lookup, exact legacy messages; bank shown masked).
 *   - Rejoin -> /api/hr/employees/rejoin/ (exact legacy date messages + flag).
 *   - Admin Approve -> /api/hr/employees/approve/ (legal_flag=1,
 *     'Approve By Admin', exact legacy message).
 *   - Reason for Updation -> comments column with the legacy "@#$%" history.
 *   - Relieving letter renders printable HTML (replaces the Crystal .rpt,
 *     same tech-stack migration as Offer/Joining letters).
 *   - Tabs that have no modern backing store yet (Documents upload, Uniform,
 *     Dublicate Id, Rating, References, extra Qualifications/Skills, KRA,
 *     police/rent dates) render exactly as in legacy and are marked with a note.
 *     Nothing is faked: their values are captured in the form but not persisted
 *     until their dedicated module exists.
 */

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import { API_BASE_URL } from "@/lib/api/client";
import { listItems, createItem, updateItem, deleteItem } from "@/lib/api/crud";
import ExportButtons from "@/components/ExportButtons";
import { upload as uploadForm } from "@/lib/api/legacy-fetch";
import { openPrintHtml } from "@/components/hrPrint";

const EMP_BASE = "/api/hr/employees";
const KYC_BASE = "/api/hr/employee-kyc";
const MENU = "Employee Master";

/* ---------------- exact legacy dropdown option sets ---------------- */
const EMP_TYPES = [
  { v: "Select", t: "Select" },
  { v: "Permanent", t: "Permanent" },
  { v: "PermanentReliever", t: "Permanent Reliever" },
  { v: "Reliever", t: "Reliever" },
  { v: "Staff", t: "Staff" },
  { v: "Temporary", t: "Temporary" },
  { v: "RM", t: "Repair & Maintenance" },
];
const DEPARTMENTS = ["Select", "HR Department", "Admin", "Finance", "Operation", "Sales"];
const RELATIONS = ["Select", "Father", "Husband"];
const GENDERS = [{ v: "0", t: "Select" }, { v: "M", t: "Male" }, { v: "F", t: "Female" }];
const SHIFTWISE = ["Select", "Regular", "Shiftwise"];
const MATERIAL_PAYMENT = [{ v: "0", t: "No" }, { v: "1", t: "Yes" }];
const NFD_IFD = [
  { v: "Select", t: "Select Transfer" },
  { v: "N", t: "NEFT TRANSFER" },
  { v: "I", t: "INTERNAL TRANSFER" },
  { v: "C", t: "CASH" },
];
const MARITAL = [{ v: "Select", t: "Select" }, { v: "M", t: "Married" }, { v: "U", t: "UnMarried" }];
const RELIGIONS = ["Select", "General", "OBC", "SC", "ST", "NT", "Other"];
const BLOOD_GROUPS = ["Select", "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"];
const UNIFORM_DESIGN = [
  { v: "0", t: "Select" }, { v: "1", t: "Housekeeping" }, { v: "2", t: "Security_Guard" }, { v: "3", t: "Common" },
];
const PRODUCT_TYPES = [
  "Select", "Uniform", "Shoes", "Sweater", "ID_Card", "Raincoat", "Torch",
  "Whistle", "Baton", "Belt", "Pantry_Jacket", "Apron",
];
const SET_OPTS = ["Select", "0", "1", "2"];
const DUP_ID_SET = ["Select", "1"];
// Flexible + 0:00 .. 23:30 in 30-min steps (legacy ddl_intime)
const IN_TIMES = ["Flexible", ...Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2), m = i % 2 === 0 ? "00" : "30";
  return `${h}:${m}`;
})];

const RM_TYPES = new Set(["Permanent", "PermanentReliever", "Staff", "Temporary", "RM"]);
// North-East states — exempt from the Aadhaar requirement (legacy EmployeeMaster.aspx).
const NE_STATES = new Set(["Arunachal Pradesh", "Assam", "Manipur", "Meghalaya", "Mizoram", "Mizoram ", "Nagaland", "Sikkim", "Tripura"]);

/* ---------------- types ---------------- */
type Tab = "home" | "menu1" | "menu9" | "menu6" | "menu7" | "menu2" | "menu4" | "menu5" | "menu11" | "menu12" | "menu13";
const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "Contact Details" },
  { id: "menu1", label: "Employee Details" },
  { id: "menu9", label: "Family Details" },
  { id: "menu6", label: "Bank Account Details" },
  { id: "menu7", label: "Personal Details" },
  { id: "menu2", label: "Qualification Details" },
  { id: "menu4", label: "Rating Details" },
  { id: "menu5", label: "Documents" },
  { id: "menu11", label: "KRA" },
  { id: "menu12", label: "Uniform Details" },
  { id: "menu13", label: "Dublicate Id Card" },
];

interface EmpRow {
  id: number; emp_code: string; ihmscode: string; emp_name: string; designation_code: string;
  client_code: string; client_name?: string; emp_current_state: string; unit_code: string; unit_name?: string;
  employee_type: string; emp_mobile_no: string; birth_date: string | null;
  joining_date: string | null;
}

/* Aadhaar strip match (legacy gv_search_adharcardno row) */
interface AdharRow {
  emp_code: string; emp_name: string; client_code: string;
  emp_current_state: string; unit_code: string; employee_type: string;
  joining_date: string; left_date: string; original_bank_account_no: string;
  bank_name: string;
}

// full form state (legacy field ids -> friendly keys). Blank string = empty.
type Form = Record<string, string>;
const EMPTY: Form = {
  emp_code: "", employee_type: "Select", department: "Select", client_code: "",
  clientwisestate: "", unit_code: "", designation: "", id_as_per_dob: "", ihms_code: "",
  emp_name: "", father_name: "", relation: "Select", birth_date: "", gender: "0",
  reporting_to: "", role: "", working_hours: "", in_time: "Flexible", email: "",
  police_start: "", police_end: "", rent_start: "", rent_end: "",
  shiftwise_emp: "Select", material_payment: "0",
  // contact
  present_address: "", present_state: "", present_city: "", present_pincode: "",
  mobile1: "", mobile2: "", mobile3: "",
  perm_address: "", perm_state: "", perm_city: "", perm_pincode: "",
  perm_mobile1: "", perm_mobile2: "", perm_mobile3: "",
  ref1_name: "", ref1_mobile: "", ref1_email: "", ref1_address: "",
  ref2_name: "", ref2_mobile: "", ref2_email: "", ref2_address: "",
  // employee details
  confirmation_date: "", joining_date: "", work_state: "", work_city: "",
  police_station: "", aadhaar: "", pan: "", reason_for_left: "", left_date: "",
  // bank
  bank_holder: "", bank_name: "", branch_location: "", other_bank_ac: "",
  original_bank_ac: "", ifsc: "", nfd_ifd: "Select", nominee_name: "",
  nominee_relation: "", nominee_dob: "", nominee_address: "",
  // personal
  nationality: "INDIAN", identity_mark: "", mother_tongue: "", hobbies: "",
  passport_no: "", driving_licence_no: "", weight: "0", marital_status: "Select",
  religion: "Select", place_of_birth: "", language_known: "", area_of_expertise: "",
  handicap: "", height: "0", blood_group: "Select",
  // qualification
  number_of_child: "",
  qualification_1: "", qualification_2: "", qualification_3: "", qualification_4: "", qualification_5: "",
  year_1: "", year_2: "", year_3: "", year_4: "", year_5: "",
  skill_1: "", skill_2: "", skill_3: "", skill_4: "", skill_5: "",
  exp_1: "0", exp_2: "0", exp_3: "0", exp_4: "0", exp_5: "0",
  // rating
  fine: "0", advance: "",
  // KRA
  kra: "",
  // uniform
  uni_designation: "0", uni_type: "0", uni_set: "0", uni_size: "", uni_issue: "", uni_expiry: "",
  // dublicate id
  dup_set: "Select", dup_from: "", dup_to: "",
};

interface Opt { v: string; t: string }
interface UniRow { type: string; sets: number | string; size: string; start: string; end: string; remaining?: number; dispatched?: boolean }
interface DesignationCount { state: string; designation: string; unit_code: string; hours: string }

function levelFor(me: Me | null): number {
  if (!me) return 0;
  if (me.is_staff) return 4;
  const map: Record<string, number> = { R: 1, U: 2, C: 3, D: 4 };
  return me.permissions.filter((p) => p.menu === MENU && !p.needs_review)
    .reduce((mx, p) => Math.max(mx, map[p.permission] ?? 0), 0);
}

async function getJSON<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API_BASE_URL}${path}`, { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch { return null; }
}

export default function EmployeeMaster() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  /* legacy step-by-step visibility: "landing" (pnl_buttons + search grid; newpanel hidden),
     "adhar" (panel_adhar_card after "Add Employee"), "form" (newpanel/employee_data entry form). */
  const [view, setView] = useState<"landing" | "adhar" | "form">("landing");
  const [f, setF] = useState<Form>({ ...EMPTY });
  const [selected, setSelected] = useState<EmpRow | null>(null);
  const [rows, setRows] = useState<EmpRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, string>>({});  // document_type -> file_url
  /* legacy panel_adhar_card strip */
  const [adharMode, setAdharMode] = useState<"other_state" | "northeast">("other_state");
  const [adharNo, setAdharNo] = useState("");
  const [adharRows, setAdharRows] = useState<AdharRow[]>([]);
  const [adharBox, setAdharBox] = useState(true);
  const [rejoinDates, setRejoinDates] = useState<Record<string, string>>({});
  /* legacy reason_panel */
  const [reasonUpdate, setReasonUpdate] = useState("");
  const [reasonHistory, setReasonHistory] = useState<string[]>([]);
  /* legacy btn_approve visibility after approval */
  const [approvedHide, setApprovedHide] = useState(false);
  const [legalFlag, setLegalFlag] = useState(0);
  /* legacy pnl_buttons action bar (screenshot): Receiver Type + 10 green actions + Close */
  const [receiverType, setReceiverType] = useState<"0" | "1" | "2">("0");
  const [leftMode, setLeftMode] = useState(false);
  const [dispatchRows, setDispatchRows] = useState<Record<string, string>[]>([]);
  const [showDispatch, setShowDispatch] = useState(false);
  const [approvalRows, setApprovalRows] = useState<Record<string, any>[]>([]);
  const [showApproval, setShowApproval] = useState(false);
  const [resendRows, setResendRows] = useState<Record<string, any>[]>([]);
  const [resendChecked, setResendChecked] = useState<Record<string, boolean>>({});
  const [showResend, setShowResend] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadMsg, setUploadMsg] = useState("");
  /* Uniform / ID-card staging rows (legacy gv_product_details) + one-time login setup token */
  const [uniformRows, setUniformRows] = useState<UniRow[]>([]);
  const [uniformLoaded, setUniformLoaded] = useState(true);
  const [provision, setProvision] = useState<{ login: string; token: string } | null>(null);
  const [uploadIssues, setUploadIssues] = useState<Record<string, string>[]>([]);

  // dropdown data
  const [clients, setClients] = useState<Opt[]>([]);
  const [designCounts, setDesignCounts] = useState<DesignationCount[]>([]);
  const [allUnits, setAllUnits] = useState<{ unit_code: string; unit_name: string; state_name: string }[]>([]);
  // Branch Name lists branches of the chosen client. If a state is selected, filter by state;
  // otherwise show all branches of this client (e.g. U007 and U008) so the user can pick directly.
  const units: Opt[] = (f.clientwisestate
    ? allUnits.filter((u) => (u.state_name || "").trim().toLowerCase() === f.clientwisestate.trim().toLowerCase())
    : allUnits
  ).map((u) => ({ v: u.unit_code, t: `${u.unit_code} - ${u.unit_name}` }));
  const [states, setStates] = useState<string[]>([]);        // present/perm state master
  const [stateCities, setStateCities] = useState<Record<string, string[]>>({});
  const [roles, setRoles] = useState<string[]>([]);
  const [grades, setGrades] = useState<{ grade_code: string; grade_desc: string; employee_type: string }[]>([]);
  const [famTouched, setFamTouched] = useState(false);

  const level = levelFor(me);
  const canCreate = level >= 3, canUpdate = level >= 2, canDelete = level >= 4;

  // legacy SearchGridView_SelectedIndexChanged: an approved Permanent employee (legal_flag 1/2) is read-only
  const editLocked = !!selected && selected.employee_type === "Permanent" && (legalFlag === 1 || legalFlag === 2);

  const set = (k: string, v: string) => {
    if (k.startsWith("fam_")) setFamTouched(true);
    setF((p) => ({ ...p, [k]: v }));
  };

  useEffect(() => { getMe().then((m) => { setMe(m); setAuthChecked(true); }); }, []);

  /* ---- static/global dropdowns ---- */
  useEffect(() => {
    getJSON<{ results: { client_code: string; client_name: string }[] }>("/api/masters/clients/?page_size=all")
      .then((d) => setClients((d?.results ?? []).map((c) => ({ v: c.client_code, t: c.client_name }))));
    // Unpaginated lookup (paginated list is capped at 200 of 5,393 rows).
    getJSON<{ states: string[]; cities: Record<string, string[]> }>("/api/masters/states/lookup/")
      .then((d) => {
        if (d && Array.isArray(d.states)) {
          setStates([...d.states].sort());
          setStateCities(d.cities ?? {});
        } else {
          getJSON<{ results: { state_name: string; city: string }[] }>("/api/masters/states/?page_size=all")
            .then((f2) => {
              const rs = f2?.results ?? [];
              setStates(Array.from(new Set(rs.map((s) => s.state_name))).sort());
              const cities: Record<string, string[]> = {};
              rs.forEach((s) => { (cities[s.state_name] ||= []).push(s.city); });
              setStateCities(cities);
            });
        }
      });
    getJSON<string[]>("/api/hr/roles/").then((d) => setRoles(d ?? []));
    getJSON<{ grades: { grade_code: string; grade_desc: string; employee_type: string }[] }>("/api/hr/grades/lookup/")
      .then((d) => setGrades(d?.grades ?? []));
  }, []);

  /* ---- cascade: client -> designation-counts (state/designation/hours) + units ---- */
  useEffect(() => {
    if (!f.client_code) { setDesignCounts([]); setAllUnits([]); return; }
    getJSON<{ results: DesignationCount[] }>(`/api/masters/client-designation-counts/lookup/?client_code=${encodeURIComponent(f.client_code)}`)
      .then((d) => setDesignCounts(d?.results ?? []));
    getJSON<{ units: { unit_code: string; unit_name: string; state_name: string }[] }>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(f.client_code)}&assigned=1`)
      .then((d) => setAllUnits(d?.units ?? []));
  }, [f.client_code]);

  const clientStates = Array.from(
    new Set([
      ...designCounts.map((d) => d.state),
      ...allUnits.map((u) => u.state_name),
    ].filter(Boolean))
  ).sort();
  // A designation-count row with a blank unit_code is a CLIENT-LEVEL designation
  // (applies to every branch), so it must stay visible even once a specific Branch
  // is picked — not only branch-specific rows. (legacy showed blank-unit designations
  // for all branches.)
  const unitMatch = (du: string) => !f.unit_code || !du || du === f.unit_code;
  // Legacy ddl_grade: option value = GRADE_CODE, text = designation (pay_designation_count.DESIGNATION
  // joined to pay_grade_master.grade_desc). The stored value is the grade code.
  const descToCode = (desc: string): string => {
    const cands = grades.filter((g) => g.grade_desc === desc);
    const typed = cands.find((g) => g.employee_type === f.employee_type);
    return (typed ?? cands[0])?.grade_code ?? "";
  };
  const codeToDesc = (code: string): string =>
    grades.find((g) => g.grade_code === code)?.grade_desc ?? code;
  const desigList = Array.from(new Set(
    designCounts.filter((d) => unitMatch(d.unit_code)).map((d) => d.designation).filter(Boolean),
  )).sort().map((d) => ({ v: descToCode(d) || d, t: d }));
  const designations: Opt[] = desigList.length > 0
    ? desigList
    : grades.map((g) => ({ v: g.grade_code, t: g.grade_desc }));
  // A count row matches the picked designation by grade desc (legacy
  // pay_designation_count convention, e.g. 'CCTV OPERATOR') OR by grade code
  // (rows created from the modern Client Master store e.g. 'CCTV').
  const desigMatch = (rowDesig: string) => {
    if (!f.designation) return true;
    return rowDesig === codeToDesc(f.designation) || rowDesig === f.designation;
  };
  const workHours = Array.from(new Set(
    designCounts.filter((d) => desigMatch(d.designation) && unitMatch(d.unit_code))
      .map((d) => d.hours).filter(Boolean),
  )).sort();

  // Legacy ddl_grade_SelectedIndexChanged (add_emp.aspx.cs): picking a
  // designation rebinds Working Hours to that designation's hours, with the
  // first item auto-selected. Preserve the current selection when it is
  // still offered; never wipe while the lookups are still loading.
  const workHoursKey = workHours.join("|");
  useEffect(() => {
    if (!designCounts.length) return;
    setF((p) => {
      if (workHours.includes(p.working_hours)) return p;
      if (p.designation && workHours.length) return { ...p, working_hours: workHours[0] };
      if (p.designation && !workHours.length) return p.working_hours === "" ? p : { ...p, working_hours: "" };
      return p;
    });
    // workHours is derived above; the joined key is its stable dep.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workHoursKey, designCounts.length, f.designation]);

  /* ---- grid ---- */
  const loadGrid = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await listItems<EmpRow>(EMP_BASE, { pageSize: 100, search: q || undefined });
      setRows(res.results);
    } catch { setRows([]); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { if (authChecked && me) loadGrid(""); }, [authChecked, me, loadGrid]);

  /* ---- Employee Code auto-generate (legacy btnnew_Click): preview the next code
     for a NEW employee from the server (EMP_SERIES_INIT + running number). ---- */
  const loadNextCode = useCallback(async () => {
    const d = await getJSON<{ emp_code: string }>(`${EMP_BASE}/next-code/`);
    if (d?.emp_code) setF((p) => ({ ...p, emp_code: d.emp_code }));
  }, []);
  useEffect(() => { if (authChecked && me) loadNextCode(); }, [authChecked, me, loadNextCode]);

  /* ---- Employee documents (legacy Documents tab uploads -> mandatory on Save) ---- */
  const loadDocs = useCallback(async (empCode: string) => {
    if (!empCode) { setUploadedDocs({}); return; }
    const d = await getJSON<{ results: { document_type: string; file_url: string }[] }>(
      `/api/hr/employee-documents/?emp_code=${encodeURIComponent(empCode)}&page_size=all`);
    const m: Record<string, string> = {};
    (d?.results ?? []).forEach((r) => { m[r.document_type] = r.file_url || ""; });
    setUploadedDocs(m);
  }, []);
  useEffect(() => { loadDocs(f.emp_code); }, [f.emp_code, loadDocs]);

  // Legacy single "Upload" button: upload all the selected files in one go, then
  // refresh from the server so the thumbnails are server-driven and persist.
  const uploadAll = async (files: Record<string, File>): Promise<boolean> => {
    if (!f.emp_code) { alert("Employee Code missing."); return false; }
    const entries = Object.entries(files);
    if (entries.length === 0) { alert("Please Select File To Upload"); return false; }
    setBusy(true);
    let ok = true;
    try {
      for (const [documentType, file] of entries) {
        const fd = new FormData();
        fd.append("emp_code", f.emp_code);
        fd.append("document_type", documentType);
        fd.append("file", file);
        const r = await fetch(`${API_BASE_URL}/api/hr/employee-documents/`, {
          method: "POST", credentials: "include", body: fd,
        });
        if (!r.ok) {
          const b = await r.json().catch(() => ({}));
          alert(errMsg(b) || `Upload failed for ${documentType}`);
          ok = false;
        }
      }
      await loadDocs(f.emp_code);
    } finally { setBusy(false); }
    return ok;
  };

  /* ---- clear / select ---- */
  const clearForm = () => { setFamTouched(false); setLegalFlag(0); setSelected(null); setF({ ...EMPTY }); setUniformRows([]); setUniformLoaded(true); setTab("home"); setReasonUpdate(""); setApprovedHide(false); loadNextCode(); };

  /* legacy btnclose/post-save: hide the entry panel (newpanel.Visible=false) and return to
     the landing list (pnl_buttons + search grid). */
  const backToLanding = () => {
    clearForm();
    setAdharRows([]); setAdharNo(""); setAdharMode("other_state"); setAdharBox(true);
    setShowDispatch(false); setShowApproval(false); setShowResend(false);
    setView("landing");
  };

  const selectRow = async (r: EmpRow) => {
    // load the full core record (detail lookup is by numeric id)
    const full = await getJSON<Record<string, string | null>>(`${EMP_BASE}/${r.id}/`);
    const g = (k: string) => (full?.[k] ?? "") as string;
    setSelected(r);
    setF({
      ...EMPTY,
      emp_code: g("emp_code"), employee_type: g("employee_type") || "Select",
      department: g("dept_code") || "Select", client_code: g("client_code"),
      unit_code: g("unit_code"), designation: g("grade_code") || g("designation_code"), ihms_code: g("ihmscode"),
      id_as_per_dob: g("id_as_per_dob"), branch_location: g("bank_branch"), nominee_address: g("nominee_address"),
      clientwisestate: g("client_wise_state"), role: g("role"),
      working_hours: g("working_hours"), in_time: g("in_time") || "Flexible",
      material_payment: g("material_payment") || "0",
      emp_name: g("emp_name"), father_name: g("emp_father_name"),
      relation: g("father_relation") || "Select", birth_date: g("birth_date") || "",
      gender: g("gender") || "0", reporting_to: g("reporting_to"), email: g("emp_email_id"),
      shiftwise_emp: g("shift_type") || "Select",
      present_address: g("emp_current_address"), present_state: g("emp_current_state"), present_city: g("emp_current_city"),
      mobile1: g("emp_mobile_no"), mobile2: g("emp_mobile_no2"),
      perm_address: g("emp_perm_address"), perm_state: g("emp_perm_state"), perm_city: g("emp_perm_city"),
      confirmation_date: g("confirmation_date") || "", joining_date: g("joining_date") || "",
      work_state: g("location"), work_city: g("location_city"),
      reason_for_left: g("left_reason"), left_date: g("left_date") || "",
      nationality: g("emp_nationality") || "INDIAN", marital_status: g("emp_marrital_status") || "Select",
      religion: g("emp_religion") || "Select", blood_group: g("emp_blood_group") || "Select",
      qualification_1: g("qualification_1") || g("emp_qualification"),
      mobile3: g("emp_mobile_no3"), present_pincode: g("emp_current_pin"), perm_pincode: g("emp_perm_pin"),
      perm_mobile1: g("perm_mobile_no1"), perm_mobile2: g("perm_mobile_no2"), perm_mobile3: g("perm_mobile_no3"),
      ref1_name: g("refname1"), ref1_mobile: g("refmobile1"), ref1_email: g("refemail1"), ref1_address: g("refaddress1"),
      ref2_name: g("refname2"), ref2_mobile: g("refmobile2"), ref2_email: g("refemail2"), ref2_address: g("refaddress2"),
      hobbies: g("emp_hobbies"), weight: g("emp_weight") || "0", height: g("emp_height") || "0",
      identity_mark: g("emp_identitymark"), mother_tongue: g("emp_mothertongue"),
      place_of_birth: g("emp_place_of_birth"), language_known: g("emp_language_known"),
      area_of_expertise: g("emp_area_of_expertise"), handicap: g("emp_details_of_handicap"),
      number_of_child: g("no_of_child"), kra: g("kra"),
      police_station: g("police_station_name"), fine: g("fine") || "0", advance: g("emp_advance_payment"),
      police_start: g("police_verification_start_date"), police_end: g("police_verification_end_date"),
      rent_start: g("rent_agreement_start_date"), rent_end: g("rent_agreement_end_date"),
      nfd_ifd: g("nfd_code") || "Select",
      qualification_2: g("qualification_2"), qualification_3: g("qualification_3"),
      qualification_4: g("qualification_4"), qualification_5: g("qualification_5"),
      year_1: g("year_of_passing_1"), year_2: g("year_of_passing_2"), year_3: g("year_of_passing_3"),
      year_4: g("year_of_passing_4"), year_5: g("year_of_passing_5"),
      skill_1: g("key_skill_1"), skill_2: g("key_skill_2"), skill_3: g("key_skill_3"),
      skill_4: g("key_skill_4"), skill_5: g("key_skill_5"),
      exp_1: g("experience_month_1") || "0", exp_2: g("experience_month_2") || "0", exp_3: g("experience_month_3") || "0",
      exp_4: g("experience_month_4") || "0", exp_5: g("experience_month_5") || "0",
    });
    /* legacy reason_updt(type 1): split COMMENTS on "@#$%" into the history list */
    setReasonHistory(String(g("comments") || "").split("@#$%").map((s) => s.trim()).filter(Boolean));
    setReasonUpdate("");
    setApprovedHide(false);
    setFamTouched(false);
    setLegalFlag(Number(g("legal_flag") || 0));
    setTab("home");
    /* Uniform / ID-card rows of the employee (legacy pay_document_details); never sent back on
       save unless they were loaded, so a failed load cannot wipe the stored rows */
    setUniformLoaded(false);
    getJSON<{ results: UniRow[] }>(`${EMP_BASE}/uniform/?emp_code=${encodeURIComponent(g("emp_code"))}`).then((u) => {
      if (u) { setUniformRows(u.results ?? []); setUniformLoaded(true); }
    });
    /* legacy: selecting a grid row sets newpanel.Visible=true (the entry form appears) */
    setView("form");
  };

  /* ---- validation: exact legacy update_validation1 order + messages ---- */
  const goTab = (t: Tab) => setTab(t);
  const validate = (): string | null => {
    // On EDIT, the secure/KYC fields (Aadhaar, PAN, bank, nominee) are never returned
    // in plaintext and street address of an older record may be blank — so a blank value
    // means "keep what's stored", not "missing". Those required-checks apply on CREATE
    // only (`editing` gate). Format checks still run whenever a value IS entered.
    const editing = !!selected;
    if (f.employee_type === "Select" || !f.employee_type) return "Please Select Employee Type !!!";
    if (f.department === "Select" || !f.department) return "Please Select Department type !!!";
    if (!f.client_code) return "Please Select Client Name !!!";
    if (!f.clientwisestate) return "Please Select State !!!";
    if (!f.unit_code) return "Please Select Branch Name !!!";
    if (!f.designation) return "Please Select Designation !!!";
    if (!f.emp_name.trim()) return "Please Enter Employee Name";
    if (!f.father_name.trim()) return "Please Enter Father/ Husband Name";
    if (!f.birth_date) return "Please Select Date of Birth";
    if (f.birth_date) {
      const bd = new Date(f.birth_date), t = new Date();
      let age = t.getFullYear() - bd.getFullYear();
      if (t.getMonth() < bd.getMonth() || (t.getMonth() === bd.getMonth() && t.getDate() < bd.getDate())) age--;
      if (age < 18 || age > 55) return "Please check Date of Birth !!! Employee should be 18 to 55 Years old";
    }
    if (f.gender === "0" || !f.gender) return "Please Select Gender";
    if (!f.role) return "Please Select Role !!!";
    if (!f.working_hours) return "Please Enter Working Hours.";
    // Legacy update_validation1 step 13: present address/state/blood/city/mobile are
    // required only for the permanent-set types (Reliever is exempt).
    if (RM_TYPES.has(f.employee_type)) {
      if (!editing && !f.present_address.trim()) { goTab("home"); return "Please Enter Present Address"; }
      if (!f.present_state) { goTab("home"); return "Please Select State  !!!"; }
      if (f.blood_group === "Select" || !f.blood_group) { goTab("menu7"); return "Please Select Blood Group  !!!"; }
      if (!f.present_city) { goTab("home"); return "Please Enter Present  City"; }
      if (!f.mobile1.trim()) { goTab("home"); return "Please Enter Mobile Number"; }
    }
    if (!f.joining_date) { goTab("menu1"); return "Please Select Joining Date"; }
    if (!editing && RM_TYPES.has(f.employee_type) && !f.pan.trim()) { goTab("menu1"); return "Please Enter Pan Number"; }
    if (!f.work_state.trim()) { goTab("menu1"); return "Please Enter Work State"; }
    if (!f.work_city.trim()) { goTab("menu1"); return "Please Enter Work City"; }
    // North-East states are exempt from the Aadhaar requirement (legacy NE short-circuit).
    if (!editing && RM_TYPES.has(f.employee_type) && !NE_STATES.has(f.clientwisestate) && !f.aadhaar.trim()) { goTab("menu1"); return "Please Enter Adhar Card Number"; }
    if (f.aadhaar.trim() && f.aadhaar.trim().length !== 12) { goTab("menu1"); return "Please Enter Valid Adhar Card Number"; }
    if (f.left_date && !f.reason_for_left.trim()) { goTab("menu1"); return "Please enter reason for resign"; }
    if (f.reason_for_left.trim() && !f.left_date) { goTab("menu1"); return "Please select Left Date"; }
    if (f.left_date && f.joining_date && f.left_date < f.joining_date) { goTab("menu1"); return "Left date should be after than joining date "; }
    if (!editing && !f.bank_holder.trim()) { goTab("menu6"); return "Please Enter Bank Account Holder Name"; }
    if (!editing && !f.original_bank_ac.trim()) { goTab("menu6"); return "Please Enter Original Bank Account Number"; }
    if (!editing && !f.ifsc.trim()) { goTab("menu6"); return "Please Enter Bank IFSC Code"; }
    if (f.ifsc.trim() && f.ifsc.trim().length !== 11) { goTab("menu6"); return "Please Enter Valid IFSC Code"; }
    if (!editing && f.nfd_ifd === "Select") { goTab("menu6"); return "Please Select NFD/IFD"; }
    if (!f.nationality.trim()) { goTab("menu7"); return "Please Enter Nationality"; }
    // Legacy btn_add_Click: on CREATE the mandatory documents must be uploaded first.
    // Legacy btn_add_Click: on CREATE only Photo + Aadhar + PAN (Reliever: Bank Passbook) are needed.
    // The full required-document check is on the Documents tab Upload button, not on Save / Update.
    if (!editing) {
      const mandatory = f.employee_type === "Reliever"
        ? ["Bank Passbook"]
        : ["Original Photo(Passport Size)", "Original Aadhar Card", "Pan Card"];
      if (mandatory.some((m) => !uploadedDocs[m])) {
        goTab("menu5");
        return f.employee_type === "Reliever"
          ? "Please Upload Bank PassBook Of Employee "
          : "Please Upload Original photo and Aadhar card and Pan Card of Employee";
      }
    }
    return null;
  };

  /* ---- payload mapping (core safe fields only) ---- */
  const corePayload = () => ({
    emp_code: f.emp_code.trim(),
    employee_type: f.employee_type === "Select" ? "" : f.employee_type,
    dept_code: f.department === "Select" ? "" : f.department,
    client_code: f.client_code,
    unit_code: f.unit_code,
    designation_code: f.designation,   // grade code (legacy ddl_grade value)
    grade_code: f.designation,
    bank_branch: f.branch_location.trim(),
    nominee_address: f.nominee_address.trim(),
    reporting_to: f.reporting_to,
    ihmscode: f.ihms_code.trim(),
    client_wise_state: f.clientwisestate,
    role: f.role,
    working_hours: f.working_hours,
    in_time: f.in_time === "Flexible" ? "Flexible" : f.in_time,
    material_payment: f.material_payment,
    emp_name: f.emp_name.trim(),
    emp_father_name: f.father_name.trim(),
    father_relation: f.relation === "Select" ? "" : f.relation,
    birth_date: f.birth_date || null,
    gender: f.gender === "0" ? "" : f.gender,
    emp_email_id: f.email.trim(),
    shift_type: f.shiftwise_emp === "Select" ? "" : f.shiftwise_emp,
    emp_current_address: f.present_address.trim(),
    emp_current_state: f.present_state,
    emp_current_city: f.present_city,
    emp_mobile_no: f.mobile1.trim(),
    emp_mobile_no2: f.mobile2.trim(),
    emp_perm_address: f.perm_address.trim(),
    emp_perm_state: f.perm_state,
    emp_perm_city: f.perm_city,
    confirmation_date: f.confirmation_date || null,
    joining_date: f.joining_date || null,
    location: f.work_state.trim(),
    location_city: f.work_city.trim(),
    left_reason: f.reason_for_left.trim(),
    left_date: f.left_date || null,
    emp_nationality: f.nationality.trim(),
    emp_marrital_status: f.marital_status === "Select" ? "" : f.marital_status,
    emp_religion: f.religion === "Select" ? "" : f.religion,
    emp_blood_group: f.blood_group === "Select" ? "" : f.blood_group,
    emp_qualification: f.qualification_1.trim(),
    // remaining legacy pay_employee_master columns (non-secret)
    emp_mobile_no3: f.mobile3.trim(), emp_current_pin: f.present_pincode.trim(),
    emp_perm_pin: f.perm_pincode.trim(),
    perm_mobile_no1: f.perm_mobile1.trim(), perm_mobile_no2: f.perm_mobile2.trim(), perm_mobile_no3: f.perm_mobile3.trim(),
    refname1: f.ref1_name.trim(), refmobile1: f.ref1_mobile.trim(), refemail1: f.ref1_email.trim(), refaddress1: f.ref1_address.trim(),
    refname2: f.ref2_name.trim(), refmobile2: f.ref2_mobile.trim(), refemail2: f.ref2_email.trim(), refaddress2: f.ref2_address.trim(),
    emp_hobbies: f.hobbies.trim(), emp_weight: f.weight, emp_height: f.height,
    emp_identitymark: f.identity_mark.trim(), emp_mothertongue: f.mother_tongue.trim(),
    emp_place_of_birth: f.place_of_birth.trim(), emp_language_known: f.language_known.trim(),
    emp_area_of_expertise: f.area_of_expertise.trim(), emp_details_of_handicap: f.handicap.trim(),
    no_of_child: f.number_of_child.trim(), kra: f.kra,
    police_station_name: f.police_station.trim(), fine: f.fine, emp_advance_payment: f.advance.trim(),
    police_verification_start_date: f.police_start, police_verification_end_date: f.police_end,
    rent_agreement_start_date: f.rent_start, rent_agreement_end_date: f.rent_end,
    nfd_code: f.nfd_ifd === "Select" ? "" : f.nfd_ifd,
    qualification_1: f.qualification_1.trim(), qualification_2: f.qualification_2.trim(),
    qualification_3: f.qualification_3.trim(), qualification_4: f.qualification_4.trim(),
    qualification_5: f.qualification_5.trim(),
    year_of_passing_1: f.year_1.trim(), year_of_passing_2: f.year_2.trim(), year_of_passing_3: f.year_3.trim(),
    year_of_passing_4: f.year_4.trim(), year_of_passing_5: f.year_5.trim(),
    key_skill_1: f.skill_1.trim(), key_skill_2: f.skill_2.trim(), key_skill_3: f.skill_3.trim(),
    key_skill_4: f.skill_4.trim(), key_skill_5: f.skill_5.trim(),
    experience_month_1: f.exp_1, experience_month_2: f.exp_2, experience_month_3: f.exp_3,
    experience_month_4: f.exp_4, experience_month_5: f.exp_5,
  });

  // secure KYC upsert (only if any sensitive value supplied)
  const kycPayload = () => {
    const p: Record<string, unknown> = { emp_code: f.emp_code.trim() };
    if (f.aadhaar.trim()) p.aadhaar = f.aadhaar.trim();
    if (f.pan.trim()) p.pan = f.pan.trim();
    if (f.passport_no.trim()) p.passport = f.passport_no.trim();
    if (f.driving_licence_no.trim()) p.driving_licence = f.driving_licence_no.trim();
    if (f.other_bank_ac.trim()) p.bank_account = f.other_bank_ac.trim();
    if (f.original_bank_ac.trim()) p.original_bank_account = f.original_bank_ac.trim();
    if (f.bank_holder.trim()) p.bank_holder_name = f.bank_holder.trim();
    if (f.bank_name.trim()) p.bank_name = f.bank_name.trim();
    if (f.ifsc.trim()) p.ifsc = f.ifsc.trim();
    if (f.nominee_name.trim()) p.nominee_name = f.nominee_name.trim();
    if (f.nominee_relation.trim()) p.nominee_relation = f.nominee_relation.trim();
    if (f.nominee_dob.trim()) p.nominee_dob = f.nominee_dob.trim();
    if (famTouched) p.family = familyPayload();
    return p;
  };

  /* Family tab -> secure KYC `family` list (encrypted JSON). Only sent once the operator touched
     a family cell: on edit the stored values come back masked, so an untouched tab must not wipe them. */
  const familyPayload = () => {
    const rel = ["Father", "Mother", "Wife", "Husband", "Child", "Child", "Child"];
    const out: Record<string, string>[] = [];
    for (let i = 1; i <= 7; i++) {
      const m = {
        name: (f[`fam_name${i}`] ?? "").trim(), relation: f[`fam_rel${i}`] ?? rel[i - 1],
        dob: f[`fam_dob${i}`] ?? "", pan: (f[`fam_pan${i}`] ?? "").trim(),
        aadhaar: (f[`fam_adh${i}`] ?? "").trim(), mobile: (f[`fam_mob${i}`] ?? "").trim(),
      };
      if (m.name || m.dob || m.pan || m.aadhaar || m.mobile) out.push(m);
    }
    return out;
  };

  const upsertKyc = async () => {
    const p = kycPayload();
    if (Object.keys(p).length <= 1) return; // only emp_code -> nothing sensitive entered
    // does KYC already exist?
    const existing = await getJSON<{ results: { id: number }[] }>(`${KYC_BASE}/?emp_code=${encodeURIComponent(f.emp_code.trim())}`);
    const id = existing?.results?.[0]?.id;
    if (id) await updateItem(KYC_BASE, id, p);
    else await createItem(KYC_BASE, p);
  };

  /* Authoritative mandatory-document check against the SERVER (legacy btn_add_Click).
     validate() already checks the locally-known uploads, but re-verifying here closes
     any gap where the uploadedDocs snapshot lags what is actually stored, so a NEW
     employee can never be saved without its documents. Exact legacy messages. */
  const serverMissingMandatoryDocs = async (empCode: string): Promise<string | null> => {
    const mandatory = f.employee_type === "Reliever"
      ? ["Bank Passbook"]
      : ["Original Photo(Passport Size)", "Original Aadhar Card", "Pan Card"];
    const d = await getJSON<{ results: { document_type: string }[] }>(
      `/api/hr/employee-documents/?emp_code=${encodeURIComponent(empCode)}&page_size=all`);
    const have = new Set((d?.results ?? []).map((r) => r.document_type));
    if (mandatory.some((m) => !have.has(m))) {
      return f.employee_type === "Reliever"
        ? "Please Upload Bank PassBook Of Employee "
        : "Please Upload Original photo and Aadhar card and Pan Card of Employee";
    }
    return null;
  };

  const onSave = async () => {
    /* legacy update_validation1() starts with the CCA confirm */
    if (!confirm("Please confirm if having CCA else ignore this message.")) return;
    const err = validate(); if (err) { alert(err); return; }
    /* legacy btn_add_Click: mandatory documents must exist before the create (re-checked
       against the server here, not just the local snapshot). */
    const docErr = await serverMissingMandatoryDocs(f.emp_code.trim());
    if (docErr) { goTab("menu5"); alert(docErr); return; }
    setBusy(true);
    try {
      const res = await createItem<{ emp_code: string; login_setup_token?: string; login_id?: string }>(EMP_BASE, { ...corePayload(), kyc: kycPayload(), uniform: uniformRows });
      if (res.ok) {
        const tok = (res.data as { login_setup_token?: string; login_id?: string } | null);
        if (tok?.login_setup_token) setProvision({ login: tok.login_id ?? f.emp_code, token: tok.login_setup_token });
        alert("Record Added Successfully !!");
        clearForm(); setView("landing"); loadGrid(search);
      } else if (res.status === 403) alert("You do not have permission for this action.");
      else alert(errMsg(res.data) || "Record adding failed...");
    } finally { setBusy(false); }
  };

  const onUpdate = async () => {
    if (!selected) { alert("Select a record to update."); return; }
    const err = validate(); if (err) { alert(err); return; }
    /* legacy update_validation() tail: reason for updation is mandatory */
    if (!reasonUpdate.trim()) { alert("Please Specify Reason For Updation !!!"); return; }
    setBusy(true);
    try {
      const res = await updateItem<{ emp_code: string }>(EMP_BASE, selected.id, { ...corePayload(), kyc: kycPayload(), reason_update: reasonUpdate.trim(), ...(uniformLoaded ? { uniform: uniformRows } : {}) });
      if (res.ok) {
        alert("Record updated successfully!!");
        clearForm(); setView("landing"); loadGrid(search);
      } else if (res.status === 403) alert("You do not have permission for this action.");
      else alert(errMsg(res.data) || "Record updation failed...");
    } finally { setBusy(false); }
  };

  /* legacy btn_approve_Click (update_validation2 + R_validation confirm) */
  const onApprove = async () => {
    if (!selected) { alert("Record not Available"); return; }
    const err = validate(); if (err) { alert(err); return; }
    if (!reasonUpdate.trim()) { alert("Please Specify Reason For Updation !!!"); return; }
    if (!confirm("Are you Sure You Want to Approve Record")) { alert("Record not Available"); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}${EMP_BASE}/approve/`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ emp_code: selected.emp_code }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        alert(data.status || "Employee Details Approve Succsefully ..!!");
        /* legacy hides Save/Update/Upload/Approve after approval */
        setApprovedHide(true);
        loadGrid(search);
      } else if (r.status === 403) alert("You do not have permission for this action.");
      else alert(errMsg(data) || "Approval failed...");
    } finally { setBusy(false); }
  };

  const onDelete = async () => {
    if (!selected) { alert("Record not Available"); return; }
    /* legacy Rqvd_validation(): cancel also alerts "Record not Available" */
    if (!confirm("Are you Sure You Want to Delete Record")) { alert("Record not Available"); return; }
    setBusy(true);
    try {
      const res = await deleteItem(EMP_BASE, selected.id);
      if (res.ok) { alert("Record deleted successfully!!"); clearForm(); setView("landing"); loadGrid(search); }
      else if (res.status === 403) alert("Only administrators can delete a record.");
      else alert(errMsg(res.data) || "Record deletion failed...");
    } finally { setBusy(false); }
  };

  const onLeft = () => {
    if (!f.left_date) { alert("please Select Left Date"); return; }
    if (!f.reason_for_left.trim()) { alert("please Enter Reason For Resign"); return; }
    /* legacy Left_button() tail: reason for updation is mandatory */
    if (!reasonUpdate.trim()) { alert("Please Specify Reason For Updation !!!"); return; }
    onUpdate();
  };

  /* ---- Aadhaar strip (legacy panel_adhar_card) ---- */
  const doAdharSearch = async () => {
    /* legacy adhar_val() */
    if (adharNo.trim().length !== 12) { alert("Adhar Card Number is not Valid !"); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}${KYC_BASE}/aadhaar-search/`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ aadhaar: adharNo.trim() }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) setAdharRows([data as AdharRow]);
      else { setAdharRows([]); alert(errMsg(data) || "Same Adharcard Number Employee Not Found"); }
    } finally { setBusy(false); }
  };

  /* legacy btn_adhar_add_emp (add_new_emp): panel_adhar_card hides, newpanel shows
     (blank form + Aadhaar prefilled) */
  const adharAddEmployee = () => {
    clearForm();
    set("aadhaar", adharNo.trim());
    setTab("menu1");
    setView("form");
  };

  /* legacy Link_Click (Rejoin): validate date, set flag, load employee into form */
  const doRejoin = async (row: AdharRow) => {
    /* legacy gv_search_adharcardno: only a LEFT employee can be re-opened (rejoin); a working one is "already found" */
    if (!row.left_date) { alert("Same Adharcard Number Emplyee All Ready Found"); return; }
    const dt = (rejoinDates[row.emp_code] || "").trim();
    if (!dt) { alert("Please enter Rejoin Date."); return; }
    if (row.left_date) {
      const [ly, lm, ld] = row.left_date.split("-").map(Number);
      const [ry, rm, rd] = dt.split("-").map(Number);
      const left = new Date(ly, (lm || 1) - 1, ld || 1);
      const rej = new Date(ry, (rm || 1) - 1, rd || 1);
      if (left >= rej) {
        const [y, m, d] = row.left_date.split("-");
        alert(`please Enter rejoining date greater than Left Date ${d}/${m}/${y}`);
        return;
      }
    }
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}${EMP_BASE}/rejoin/`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ emp_code: row.emp_code, rejoin_date: dt }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) { alert(errMsg(data) || "Rejoin failed..."); return; }
      /* legacy: getEmployee + clear the left fields for the re-edit */
      const res = await listItems<EmpRow>(EMP_BASE, { pageSize: 5, search: row.emp_code });
      const found = res.results.find((x) => x.emp_code === row.emp_code);
      if (found) {
        await selectRow(found);
        set("left_date", ""); set("reason_for_left", "");
      }
      loadGrid(search);
    } finally { setBusy(false); }
  };

  /* ---- pnl_buttons action bar (legacy EmployeeMaster.aspx pnl_buttons, screenshot 1:1) ---- */
  const rtValidate = (): boolean => {
    /* legacy RT_validation(): "Please Select Receiver Type" */
    if (receiverType === "0") { alert("Please Select Receiver Type"); return false; }
    return true;
  };
  const downloadCsv = (filename: string, header: string[], lines: string[][]) => {
    const esc = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [header.map(esc).join(","), ...lines.map((r) => r.map(esc).join(","))].join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  };
  type FullEmp = EmpRow & {
    left_date?: string | null; emp_father_name?: string; birth_date?: string | null;
    joining_date?: string | null; client_code?: string; emp_current_state?: string;
    unit_code?: string; employee_type?: string; emp_mobile_no?: string; legal_flag?: number;
    ap_status?: string; grade_code?: string; designation_code?: string;
  };
  const fetchAllEmps = async (): Promise<FullEmp[]> => {
    const d = await getJSON<{ results: FullEmp[] }>(`${EMP_BASE}/?page_size=all${search ? `&search=${encodeURIComponent(search)}` : ""}`);
    return d?.results ?? [];
  };
  const receiverFiltered = (list: FullEmp[]): FullEmp[] => {
    if (receiverType === "1") return list.filter((e) => !e.left_date);
    if (receiverType === "2") return list.filter((e) => !!e.left_date);
    return list;
  };

  /* legacy btn_add_employee_Click: pnl_buttons hides, panel_adhar_card (Aadhaar strip) shows.
     The full entry form is NOT shown yet — it appears after "Add Employee" in the strip. */
  const barAddEmployee = () => {
    clearForm();
    setShowDispatch(false); setShowApproval(false); setShowResend(false);
    setAdharRows([]); setAdharNo(""); setAdharMode("other_state"); setAdharBox(true);
    setView("adhar");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  /* legacy btn_dispatch_details_Click: receiver filter + dispatch grid */
  const barDispatch = async () => {
    if (!rtValidate()) return;
    setBusy(true);
    try {
      const all = await fetchAllEmps();
      const list = receiverFiltered(all);
      setRows(list);
      setLeftMode(receiverType === "2");
      /* dispatch info comes from the modern document store (uniform/shoes/ID sizes) */
      const docs = await getJSON<{ results: Record<string, any>[] }>(`/api/hr/document-details/?page_size=all`);
      const byEmp: Record<string, Record<string, string>> = {};
      (docs?.results ?? []).forEach((d) => {
        const m = (byEmp[d.emp_code] ||= {});
        m[String(d.document_type)] = String(d.size ?? "");
      });
      setDispatchRows(list.map((e) => ({
        emp_code: e.emp_code, emp_name: e.emp_name, client_code: e.client_code ?? "",
        unit_code: e.unit_code ?? "", designation: e.designation_code ?? e.grade_code ?? "",
        Uniform: byEmp[e.emp_code]?.Uniform ?? "", Shoes: byEmp[e.emp_code]?.Shoes ?? "",
        ID_Card: byEmp[e.emp_code]?.ID_Card ?? "",
      })));
      setShowDispatch(true); setShowApproval(false); setShowResend(false);
      if (list.length === 0) alert("No Matching Records Found.");
    } finally { setBusy(false); }
  };
  /* legacy btn_emp_Export_Click: receiver filter + Employee_Details.xls */
  const barExportExcel = async () => {
    if (!rtValidate()) return;
    setBusy(true);
    try {
      const all = await fetchAllEmps();
      const list = receiverFiltered(all);
      if (list.length === 0) { alert("No Matching Records Found."); return; }
      downloadCsv("Employee_Details.xls",
        ["STATE_NAME", "CLIENT_NAME", "UNIT_NAME", "EMP_CODE", "EMP_NAME", "FATHER_NAME",
          "JOINING_DATE", "BIRTH_DATE", "GRADE_DESC", "MOBILE_NO", "TYPE", "STATUS"],
        list.map((e) => [e.emp_current_state ?? "", e.client_name || e.client_code || "", e.unit_name || e.unit_code || "",
        e.emp_code, e.emp_name, e.emp_father_name ?? "", e.joining_date ?? "",
        e.birth_date ?? "", e.designation_code ?? e.grade_code ?? "",
        e.emp_mobile_no ?? "", e.employee_type ?? "", e.left_date ? "Left" : "Continue"]));
    } finally { setBusy(false); }
  };
  /* legacy btn_history_click: left-employee grid, header switches to LEFT DATE */
  const barLeftEmployee = async () => {
    setBusy(true);
    try {
      const all = await fetchAllEmps();
      const list = all.filter((e) => !!e.left_date);
      if (list.length === 0) alert("Record not found for this company!!");
      setRows(list);
      setLeftMode(true);
      setShowDispatch(false); setShowApproval(false); setShowResend(false);
    } finally { setBusy(false); }
  };
  /* legacy btn_rem_documents_Click: Remaining_Documents.xls (Yes/No per document) */
  const barRemainingDocs = async () => {
    setBusy(true);
    try {
      const docs = await getJSON<{ results: Record<string, any>[] }>(`/api/hr/document-details/?page_size=all`);
      const drows = docs?.results ?? [];
      if (drows.length === 0) { alert("No Matching Records Found."); return; }
      const byEmp: Record<string, Record<string, string>> = {};
      const empName: Record<string, string> = {};
      drows.forEach((d) => {
        (byEmp[d.emp_code] ||= {})[String(d.document_type)] = "Yes";
        if (d.emp_code && !empName[d.emp_code]) empName[d.emp_code] = "";
      });
      const all = await fetchAllEmps();
      const names: Record<string, string> = {};
      all.forEach((e) => { names[e.emp_code] = e.emp_name; });
      const types = ["Uniform", "Shoes", "ID_Card", "Apron"];
      const codes = Object.keys(byEmp);
      if (codes.length === 0) { alert("No Matching Records Found."); return; }
      downloadCsv("Remaining_Documents.xls", ["EMP_CODE", "EMP_NAME", ...types],
        codes.map((c) => [c, names[c] ?? "", ...types.map((t) => byEmp[c][t] ?? "No")]));
    } finally { setBusy(false); }
  };
  /* legacy btn_emp_approve_Click: approval grid (legal_flag != 0, active) */
  const barApproval = async () => {
    setBusy(true);
    try {
      const all = await fetchAllEmps();
      const list = all.filter((e) => !e.left_date && Number(e.legal_flag ?? 0) !== 0);
      setApprovalRows(list as Record<string, any>[]);
      setShowApproval(true); setShowDispatch(false); setShowResend(false);
      if (list.length === 0) alert("No Matching Records Found.");
    } finally { setBusy(false); }
  };
  const barApproveOne = async (emp_code: string) => {
    if (!confirm("Are you Sure You Want to Approve Record")) { alert("Record not Available"); return; }
    setBusy(true);
    try {
      const r = await fetch(`${API_BASE_URL}${EMP_BASE}/approve/`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ emp_code }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.ok) {
        alert((data as { status?: string }).status || "Employee Details Approve Succsefully ..!!");
        setApprovalRows((p) => p.filter((x) => x.emp_code !== emp_code));
        loadGrid(search);
      } else alert(errMsg(data) || "Approval failed...");
    } finally { setBusy(false); }
  };
  /* legacy btn_resend_material_Click: expired ID/Shoes/Uniform grid */
  const barResend = async () => {
    setBusy(true);
    try {
      const docs = await getJSON<{ results: Record<string, any>[] }>(`/api/hr/document-details/?page_size=all`);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const rows0 = (docs?.results ?? []).filter((d) => {
        if (!["ID_Card", "Shoes", "Uniform"].includes(String(d.document_type))) return false;
        if (Number(d.year_complete ?? 0) !== 0) return false;
        const ed = String(d.end_date ?? "").trim();
        if (!ed) return false;
        const dt = new Date(ed.includes("/") ? ed.split("/").reverse().join("-") : ed);
        return !isNaN(dt.getTime()) && dt <= today;
      });
      setResendRows(rows0);
      const chk: Record<string, boolean> = {};
      rows0.forEach((d) => { chk[`${d.emp_code}__${d.document_type}`] = false; });
      setResendChecked(chk);
      setShowResend(true); setShowDispatch(false); setShowApproval(false);
      if (rows0.length === 0) alert("No Matching Records Found.");
    } finally { setBusy(false); }
  };
  const barResendApprove = async () => {
    const picked = resendRows.filter((d) => resendChecked[`${d.emp_code}__${d.document_type}`]);
    if (picked.length === 0) { alert("Please select atleast one record."); return; }
    setBusy(true);
    try {
      let n = 0;
      for (const d of picked) {
        if (!d.id) continue;
        const r = await fetch(`${API_BASE_URL}/api/hr/document-details/${d.id}/`, {
          method: "PATCH", credentials: "include",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({ dispatch_flag: 1 }),
        });
        if (r.ok) n++;
      }
      if (n > 0) {
        alert("Material Approved Successfully !!");
        barResend();
      } else alert("Approval failed...");
    } finally { setBusy(false); }
  };
  /* legacy btn_uniform_details_Click: client-wise uniform/shoes/ID xlsx (needs client) */
  const barUniformDetails = async () => {
    if (!f.client_code) { alert("Please Select Client!!"); return; }
    setBusy(true);
    try {
      const r = await fetch(
        `${API_BASE_URL}/api/hr/uniform-tracking/export/?client_code=${encodeURIComponent(f.client_code)}`,
        { credentials: "include", headers: { Accept: "application/json" } });
      if (!r.ok) { alert("No Matching Records Found."); return; }
      const blob = await r.blob();
      if (!blob.size) { alert("No Matching Records Found."); return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "CLIENTWISE_MANUAL_EXCEL.xls";
      document.body.appendChild(a); a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
    } finally { setBusy(false); }
  };
  /* legacy btn_employee_details_Click: All Employee Details xlsx */
  const barAllDetails = async () => {
    setBusy(true);
    try {
      const d = await getJSON<{ results: Record<string, any>[] }>(
        `/api/hr/employee-details/?page_size=all${f.client_code ? `&client_code=${encodeURIComponent(f.client_code)}` : ""}${f.unit_code ? `&unit_code=${encodeURIComponent(f.unit_code)}` : ""}`);
      const list = d?.results ?? [];
      if (list.length === 0) { alert("No Matching Records Found."); return; }
      downloadCsv("EMPLOYEE_DETAILS_EXCEL-SHEET.xls",
        ["EMP_CODE", "EMP_NAME", "UNIT_CODE", "CLIENT_CODE", "GRADE_CODE", "DESIGNATION", "STATUS", "MOBILE_NO"],
        list.map((e) => [e.emp_code ?? "", e.emp_name ?? "", e.unit_code ?? "",
        e.client_code ?? "", e.grade_code ?? "", e.designation_code ?? "",
        e.status ?? "", e.emp_mobile_no ?? ""]));
    } finally { setBusy(false); }
  };
  /* legacy emp_upload_Click (mp1 popup -> employee_upload.aspx): the file (.xlsx / .csv in the legacy
     EMPLOYEE_UPLOAD template order) is processed SERVER-SIDE, row by row, with the legacy comments;
     rows that fail are returned and offered as the legacy "Issues_Employee_add" download. */
  const [uploadDummy, setUploadDummy] = useState(false);
  /* "update" mode: the Employee sheet downloaded from here, corrected, and uploaded again - every row updates the employee with that Emp Code */
  const [uploadMode, setUploadMode] = useState<"new" | "update">("new");
  const [updClient, setUpdClient] = useState("");
  const [updStatus, setUpdStatus] = useState("active");
  const [updState, setUpdState] = useState("");
  const [updMonth, setUpdMonth] = useState("");
  const [updYear, setUpdYear] = useState(String(new Date().getFullYear()));
  const [updStates, setUpdStates] = useState<string[]>([]);
  /* the States of the employees' branches (of the chosen client) for the State dropdown of the download */
  useEffect(() => {
    if (!showUpload || uploadMode !== "update") return;
    (async () => {
      try {
        const r = await fetch(`${API_BASE_URL}${EMP_BASE}/update-export-states/?client=${encodeURIComponent(updClient)}`, { credentials: "include", cache: "no-store" });
        const b = await r.json().catch(() => null);
        const list = (b?.states ?? []) as string[];
        setUpdStates(list);
        setUpdState((cur) => (cur && !list.includes(cur) ? "" : cur));
      } catch { setUpdStates([]); }
    })();
  }, [showUpload, uploadMode, updClient]);
  const saveBlob = (blob: Blob, name: string) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
  };
  const updDownloadSheet = async () => {
    setBusy(true);
    try {
      const q = new URLSearchParams({ status: updStatus });
      if (updClient) q.set("client", updClient);
      if (updState) q.set("state", updState);
      if (updMonth) { q.set("month", updMonth); q.set("year", updYear); }
      const r = await fetch(`${API_BASE_URL}${EMP_BASE}/update-export/?${q.toString()}`, { credentials: "include", cache: "no-store" });
      if (!r.ok) { const b = await r.json().catch(() => null); setUploadMsg(errMsg(b) || "No Matching Records Found."); return; }
      saveBlob(await r.blob(), "EMPLOYEE_UPDATE_SHEET.xlsx");
      setUploadMsg("Sheet downloaded. Correct the yellow columns (leave a cell blank to keep the saved value), save it and upload it here.");
    } finally { setBusy(false); }
  };
  const updDownloadProblems = async () => {
    if (!uploadFile) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile); fd.append("error_excel", "1");
      const res = await uploadForm(`${EMP_BASE}/update-upload/`, fd);
      if (!res.ok) { setUploadMsg(errMsg(await res.json().catch(() => null)) || "Could not make the problem sheet."); return; }
      saveBlob(await res.blob(), "EMPLOYEE_UPDATE_PROBLEMS.xls");
    } finally { setBusy(false); }
  };
  const barUpdateSubmit = async (dryRun: boolean) => {
    if (!uploadFile) { alert("Please Select File To Upload"); return; }
    if (!/\.(xlsx|xls|csv)$/i.test(uploadFile.name)) { alert("Please upload a valid excel file."); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      if (dryRun) fd.append("dry_run", "1");
      const res = await uploadForm(`${EMP_BASE}/update-upload/`, fd);
      const body = await res.json().catch(() => null);
      if (!res.ok) { setUploadMsg(errMsg(body) || "Employee Update Upload Failed"); setUploadIssues([]); return; }
      const issues = (body?.issues ?? []) as Record<string, string>[];
      setUploadIssues(issues);
      setUploadMsg((dryRun ? "Check completed, nothing was saved: " : "Employee Update File Uploaded Successfully... ")
        + `${body?.updated ?? 0} employees ${dryRun ? "will be updated" : "updated"}, ${body?.unchanged ?? 0} without any change, ${issues.length} with problems.`
        + (!dryRun && body?.backup_file ? ` Backup of the old values: ${body.backup_file}` : ""));
      if (!dryRun && (body?.updated ?? 0) > 0) loadGrid(search);
    } finally { setBusy(false); }
  };
  const barUploadSubmit = async (dryRun = false) => {
    if (uploadMode === "update") { await barUpdateSubmit(dryRun); return; }
    if (!uploadFile) { alert("Please Select File To Upload"); return; }
    if (!/\.(xlsx|csv)$/i.test(uploadFile.name)) { alert("Please upload a valid excel file."); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      if (dryRun) fd.append("dry_run", "1");
      if (uploadDummy) fd.append("dummy", "1");
      const res = await uploadForm(`${EMP_BASE}/bulk-upload/`, fd);
      const body = await res.json().catch(() => null);
      if (!res.ok) { setUploadMsg(errMsg(body) || "Employee File Upload Failed"); return; }
      const issues = (body?.issues ?? []) as Record<string, string>[];
      setUploadIssues(issues);
      setUploadMsg(dryRun
        ? `Check completed, nothing was saved: ${body?.added ?? 0} rows are ready to load, ${issues.length} with issues.`
        : `Employee File Uploaded Successfully... ${body?.added ?? 0} added, ${issues.length} with issues.`);
      if (!dryRun && (body?.added ?? 0) > 0) loadGrid(search);
      if (issues.length > 0) {
        const cols = (body?.columns ?? Object.keys(issues[0])) as string[];
        downloadCsv("Issues_Employee_add.xls", cols, issues.map((r) => cols.map((c) => String(r[c] ?? ""))));
      }
    } finally { setBusy(false); }
  };

  /* ---- Send Relieving Letter (printable HTML replaces the Crystal relive_letter.rpt) ---- */
  const onRelieving = async () => {
    if (!selected) { alert("Record not Available"); return; }
    if ((selected.employee_type || "") !== "Permanent") { alert("Employee Should be Permanent!!"); return; }
    /* printable letter rendered by the server (company letterhead, relieving text, signature block) */
    await openPrintHtml(`/api/hr/print/letter/?kind=relieving&emp_codes=${encodeURIComponent(selected.emp_code)}`);
  };

  /* legacy btn_add_employeeIcard_Click: ID card of the selected employee */
  const onIdCard = async () => {
    if (!selected) { alert("Record not Available"); return; }
    await openPrintHtml(`/api/hr/print/id-card/?first=1&emp_codes=${encodeURIComponent(selected.emp_code)}`);
  };

  /* ---- department auto-fill (legacy ddl_show_hide): non-Staff types => HR Department, disabled ---- */
  const onEmpType = (v: string) => {
    setF((p) => ({ ...p, employee_type: v, department: v === "Staff" ? "Select" : (v === "Select" ? "Select" : "HR Department") }));
  };
  const deptDisabled = f.employee_type !== "Staff" && f.employee_type !== "Select";

  if (authChecked && !me) {
    return <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", textAlign: "center", fontWeight: "bold" }}>Employee Master</div>
        <div style={{ padding: 16 }}>🔐 Sign in required. <Link href="/login">Go to login</Link></div>
      </div>
    </div>;
  }

  return (
    <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px", backgroundColor: "#fff" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "8.33%" }}></div>
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
            EMPLOYEE INFORMATION
          </div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); }} style={{ color: "#fff", fontSize: "10px" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>
        <br />
        <div className="panel-body" style={{ padding: "15px", background: "beige", minHeight: "500px" }}>

          {/* ============ VIEW 1 — LANDING: action bar + result grids (legacy default: newpanel.Visible=false, pnl_buttons shown) ============ */}
          {view === "landing" && (<>
            {provision && (
              <div className="em-note" style={{ margin: "8px 0" }}>
                Login <b>{provision.login}</b> created with no password. One-time setup token (shown once - hand it to the employee
                so they can set their password at <code>/password-setup</code>): <code>{provision.token}</code>{" "}
                <button className="lg-btn" onClick={() => setProvision(null)}>Dismiss</button>
              </div>
            )}
            {/* ============ ACTION BAR (legacy pnl_buttons, screenshot 1:1) ============ */}
            <div className="container-fluid" style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "25px", marginBottom: "20px", textAlign: "center" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", justifyContent: "center", alignItems: "flex-end" }}>
                <div style={{ minWidth: "180px", textAlign: "left" }}>
                  <label style={{ fontWeight: "bold", fontSize: "13px" }}>Receiver Type : <span style={{ color: "red" }}>*</span></label>
                  <select className="form-control" value={receiverType} onChange={(e) => setReceiverType(e.target.value as "0" | "1" | "2")} style={{ width: "100%", height: "40px", fontSize: "14px" }}>
                    <option value="0">Select</option>
                    <option value="1">Continue</option>
                    <option value="2">Left</option>
                  </select>
                </div>
                <button className="lg-btn lg-btn-green" disabled={busy} onClick={() => { setShowUpload(true); setUploadMsg(""); }}>Employee Upload</button>
                <button className="lg-btn lg-btn-green" disabled={busy} onClick={barDispatch}>Dispatch Details</button>
                <button className="lg-btn lg-btn-green" disabled={busy} onClick={barAddEmployee}>Add Employee</button>
                <button className="lg-btn lg-btn-green" disabled={busy} onClick={barExportExcel}>Export To Excel</button>
                <button className="lg-btn lg-btn-green" disabled={busy} onClick={barLeftEmployee}>Left Employee</button>
              </div>
              <div className="lg-btns center" style={{ marginTop: "14px" }}>
                <button className="lg-btn lg-btn-green" disabled={busy} onClick={barRemainingDocs}>Remaining Documents</button>
                <button className="lg-btn lg-btn-green" disabled={busy} onClick={barApproval}>Approval/Rejection</button>
                <button className="lg-btn lg-btn-green" disabled={busy} onClick={barResend}>Resend Material</button>
                <button className="lg-btn lg-btn-green" disabled={busy} onClick={barUniformDetails}>Uniform/Shoes/Id Details</button>
                <button className="lg-btn lg-btn-green" disabled={busy} onClick={barAllDetails}>All Employee Details</button>
              </div>
              <div className="lg-btns center" style={{ marginTop: "6px" }}>
                <Link href="/" className="lg-btn lg-btn-red" style={{ textDecoration: "none" }}>Close</Link>
              </div>
            </div>

            {/* ---- Employee Upload popup (legacy mp1 -> p_upload_employee.aspx) ---- */}
            {showUpload && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <div style={{ background: "#fff", borderRadius: "8px", padding: "20px", width: "520px", maxWidth: "92vw" }}>
                  <h4 style={{ marginTop: 0 }}>Employee Upload</h4>
                  <div style={{ marginBottom: "8px", fontSize: "13px" }}>
                    <label style={{ marginRight: "16px" }}><input type="radio" checked={uploadMode === "new"} onChange={() => { setUploadMode("new"); setUploadMsg(""); setUploadIssues([]); }} /> New employees</label>
                    <label><input type="radio" checked={uploadMode === "update"} onChange={() => { setUploadMode("update"); setUploadMsg(""); setUploadIssues([]); }} /> Update existing employees (by Emp Code)</label>
                  </div>
                  {uploadMode === "update" && (
                    <div style={{ border: "1px solid #ddd", borderRadius: "6px", padding: "8px", marginBottom: "8px", fontSize: "12px", color: "#333" }}>
                      <div><b>Step 1.</b> Download the employee sheet (State / client / status / month wise - a month gives everyone in that month's attendance; ordered State, then branch ES1, ES2 ... and the employees as in the MD's sheet), fill the real details in the yellow columns (the compulsory ones: Employee Name, Department Type, Father Name, Date of Birth, Gender, Blood Group, Nationality, Mobile No, Present Address / City / State, Work State / City, Working Hours, Aadhar No, PAN No, Bank A/C Number, Bank Account Holder Name, Bank Name, IFSC Code, NFD/IFD Transfer). A blank cell keeps the saved value; masked Aadhar / account / UAN (XXXX1234) are ignored unless you type the full number.</div>
                      <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "6px", flexWrap: "wrap" }}>
                        <select className="form-control" style={{ width: "auto" }} value={updClient} onChange={(e) => setUpdClient(e.target.value)}>
                          <option value="">All clients</option>
                          {clients.filter((c) => c.v && c.v !== "Select").map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}
                        </select>
                        <select className="form-control" style={{ width: "auto" }} value={updState} onChange={(e) => setUpdState(e.target.value)}>
                          <option value="">All states</option>
                          {updStates.map((st) => <option key={st} value={st}>{st}</option>)}
                        </select>
                        <select className="form-control" style={{ width: "auto" }} value={updStatus} onChange={(e) => setUpdStatus(e.target.value)}>
                          <option value="active">Continue</option><option value="left">Left</option><option value="all">All</option>
                        </select>
                        <select className="form-control" style={{ width: "auto" }} value={updMonth} onChange={(e) => setUpdMonth(e.target.value)} title="Employees in that month's attendance">
                          <option value="">All months</option>
                          {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
                        </select>
                        {updMonth && (
                          <select className="form-control" style={{ width: "auto" }} value={updYear} onChange={(e) => setUpdYear(e.target.value)}>
                            {[0, 1, 2].map((k) => String(new Date().getFullYear() - k)).map((y) => <option key={y} value={y}>{y}</option>)}
                          </select>
                        )}
                        <button className="lg-btn lg-btn-green" disabled={busy} onClick={updDownloadSheet}>Download employee sheet</button>
                      </div>
                      <div style={{ marginTop: "6px" }}><b>Step 2.</b> Choose the edited file (.xlsx / .xls / .csv), press <b>Check only</b> and then <b>Upload</b>. The old values are saved in a backup file on the server before every upload. Changing bank details sends them for bank approval again.</div>
                    </div>
                  )}
                  {uploadMode === "new" && <p style={{ fontSize: "12px", color: "#555" }}>Columns (in this order): Client Name, Branch City, Employee Name, Father Name, Employee Type, Designation, Date of Birth (dd-mm-yyyy), Joining Date (dd-mm-yyyy), Mobile Number, Address, City, State, Aadhar Card / Enrollment No, Bank A/C Number, Bank Account Holder Name, Bank Name, Branch Location Name, IFSC Code. <a href={`${API_BASE_URL}${EMP_BASE}/bulk-template/`}>Download template</a>
                    <br />A sheet with a header row that has <b>Employee Name</b> and <b>Branch Name</b> (e.g. the Employee_List export: Father Name, Employee Type, DATE_OF_BIRTH, GENDER, designation, Address, State, Present city, MOBILE_NO, joining date, Aadhar No, UAN Number, Emp Code, Attendance ID, Unit State) is read by column name: the branch is matched by Branch Name and a given Emp Code is kept. Use <b>Check only</b> first to see what would load.</p>}
                  <input type="file" accept={uploadMode === "update" ? ".xlsx,.xls,.csv" : ".xlsx,.csv"} onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)} />
                  <div style={{ marginTop: "8px", fontSize: "12px", color: "#333" }}>{uploadFile?.name ?? "No file chosen"}</div>
                  {uploadMode === "new" && <label style={{ display: "block", marginTop: "8px", fontSize: "12px" }}>
                    <input type="checkbox" checked={uploadDummy} onChange={(e) => setUploadDummy(e.target.checked)} />{" "}
                    Fill blank values with DUMMY data (Father Name, Mobile, Address, Aadhar, Bank details) - for testing only;
                    the employee is flagged in Comments, replace before any real payment.
                  </label>}
                  {uploadMsg && <div className="lg-alert" style={{ marginTop: "8px" }}>{uploadMsg}</div>}
                  {uploadIssues.length > 0 && (
                    <div style={{ marginTop: "8px", maxHeight: "160px", overflow: "auto", fontSize: "12px" }}>
                      {uploadIssues.map((r, i) => <div key={i}>{uploadMode === "update" ? `Row ${r["Row"]}: ${r["Emp Code"]} ${r["Employee Name"]}` : r["Employee Name"]} - {r["Comments"]}</div>)}
                    </div>
                  )}
                  <div className="lg-btns" style={{ marginTop: "12px", justifyContent: "flex-end" }}>
                    <button className="lg-btn" onClick={() => setShowUpload(false)}>Close</button>
                    {uploadMode === "update" && uploadIssues.length > 0 && <button className="lg-btn" disabled={busy} onClick={updDownloadProblems}>Download problems (Excel)</button>}
                    <button className="lg-btn" disabled={busy} onClick={() => barUploadSubmit(true)}>Check only (no save)</button>
                    <button className="lg-btn lg-btn-green" disabled={busy} onClick={() => barUploadSubmit(false)}>Upload</button>
                  </div>
                </div>
              </div>
            )}

            {/* ---- Dispatch grid (legacy gv_dispatch_details) ---- */}
            {showDispatch && (
              <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "6px", padding: "12px", marginBottom: "16px" }}>
                <h4 style={{ marginTop: 0 }}>Dispatch Details ({receiverType === "1" ? "Continue" : receiverType === "2" ? "Left" : "All"})</h4>
                <div style={{ overflowX: "auto" }}>
                  <table className="lg-grid">
                    <thead><tr><th>EMP CODE</th><th>NAME</th><th>CLIENT</th><th>UNIT</th><th>DESIGNATION</th><th>UNIFORM SIZE</th><th>SHOES SIZE</th><th>ID CARD</th></tr></thead>
                    <tbody>
                      {dispatchRows.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center" }}>No records</td></tr>}
                      {dispatchRows.map((r) => (
                        <tr key={r.emp_code}>
                          <td>{r.emp_code}</td><td>{r.emp_name}</td><td>{r.client_code}</td><td>{r.unit_code}</td>
                          <td>{r.designation}</td><td>{r.Uniform}</td><td>{r.Shoes}</td><td>{r.ID_Card}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ---- Approval grid (legacy Panel_app_gv) ---- */}
            {showApproval && (
              <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "6px", padding: "12px", marginBottom: "16px" }}>
                <h4 style={{ marginTop: 0 }}>Approval / Rejection (legal_flag != 0, active)</h4>
                <div style={{ overflowX: "auto" }}>
                  <table className="lg-grid">
                    <thead><tr><th>EMP CODE</th><th>NAME</th><th>STATUS</th><th></th></tr></thead>
                    <tbody>
                      {approvalRows.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center" }}>No records</td></tr>}
                      {approvalRows.map((r) => (
                        <tr key={String(r.emp_code)}>
                          <td>{String(r.emp_code)}</td><td>{String(r.emp_name ?? "")}</td>
                          <td>{String(r.ap_status ?? "")}</td>
                          <td><button className="lg-btn lg-btn-green" disabled={busy} onClick={() => barApproveOne(String(r.emp_code))}>Approve</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ---- Resend grid (legacy gv_approve_resend) ---- */}
            {showResend && (
              <div style={{ background: "#fff", border: "1px solid #ddd", borderRadius: "6px", padding: "12px", marginBottom: "16px" }}>
                <h4 style={{ marginTop: 0 }}>Resend Material (expired ID / Shoes / Uniform)</h4>
                <div style={{ overflowX: "auto" }}>
                  <table className="lg-grid">
                    <thead><tr><th></th><th>EMP CODE</th><th>DOCUMENT</th><th>START</th><th>END</th></tr></thead>
                    <tbody>
                      {resendRows.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center" }}>No records</td></tr>}
                      {resendRows.map((d, i) => {
                        const k = `${d.emp_code}__${d.document_type}`;
                        return (
                          <tr key={`${k}_${i}`}>
                            <td><input type="checkbox" checked={!!resendChecked[k]} onChange={(e) => setResendChecked((p) => ({ ...p, [k]: e.target.checked }))} /></td>
                            <td>{String(d.emp_code ?? "")}</td><td>{String(d.document_type ?? "")}</td>
                            <td>{String(d.start_date ?? "")}</td><td>{String(d.end_date ?? "")}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="lg-btns" style={{ marginTop: "10px" }}>
                  <button className="lg-btn lg-btn-green" disabled={busy} onClick={barResendApprove}>Approve Resend</button>
                </div>
              </div>
            )}
          </>)}

          {/* ============ REASON FOR UPDATION (legacy reason_panel, shown on select) — form view ============ */}
          {view === "form" && selected && (
            <div className="panel panel-primary" style={{ marginBottom: 12 }}>
              <br />
              <div className="panel-heading">
                <div style={{ color: "white", fontWeight: "bold", fontSize: 15 }}>Reason for Updation</div>
              </div>
              <div className="panel-body container">
                <div className="row">
                  <select multiple className="form-control" style={{ width: "100%", height: 140 }} value={[]} onChange={() => { }}>
                    {reasonHistory.map((r, i) => <option key={i} value={i}>{`${i + 1}.  ${r}`}</option>)}
                  </select>
                  <textarea className="form-control" rows={4} style={{ width: "100%", marginTop: 8 }}
                    placeholder="Enter Reason for Updation"
                    value={reasonUpdate} onChange={(e) => setReasonUpdate(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {/* ============ VIEW 2 — AADHAAR STRIP (legacy panel_adhar_card; shown after "Add Employee", before the entry form) ============ */}
          {view === "adhar" && (<>
            <div className="row" style={{ marginBottom: 8 }}>
              <div className="col-sm-12 col-xs-12 text-right">
                <button className="lg-btn lg-btn-red" type="button" onClick={backToLanding}>← Back to Employee List</button>
              </div>
            </div>
            <div className="row">
              <div className="col-sm-3 col-xs-12"></div>
              <div className="col-sm-2 col-xs-12">
                <b>Select State :</b><span className="text-red"> *</span>
                <select className="form-control" value={adharMode}
                  onChange={(e) => {
                    const v = e.target.value as "other_state" | "northeast";
                    setAdharMode(v);
                    /* legacy ddl_adhar_search_SelectedIndexChanged visibility */
                    setAdharBox(v === "other_state");
                    if (v === "northeast") setAdharRows([]);
                  }}>
                  <option value="other_state">Other State</option>
                  <option value="northeast">North East</option>
                </select>
              </div>
              {adharBox && (
                <div className="col-sm-2 col-xs-12" style={{ textAlign: "left" }}>
                  <label style={{ fontWeight: "bold" }}>Search Adhar Card Number :</label>
                  <input className="form-control" maxLength={12} value={adharNo}
                    onChange={(e) => setAdharNo(e.target.value.replace(/[^0-9]/g, ""))} />
                </div>
              )}
              {adharBox && (
                <div className="col-sm-1 col-xs-12" style={{ marginTop: "1.5em" }}>
                  <button className="btn btn-primary" disabled={busy} onClick={doAdharSearch}>Search</button>
                </div>
              )}
              {(!adharBox || adharRows.length === 0) && (
                <div className="col-sm-1 col-xs-12" style={{ marginTop: "1.5em" }}>
                  <button className="btn btn-large" disabled={busy} onClick={adharAddEmployee}>Add Employee</button>
                </div>
              )}
            </div>
            <br />

            {adharBox && adharRows.length > 0 && (
              <div className="container-fluid">
                <div className="panel grid-view" style={{ background: "#fff", width: "100%" }}>
                  <table className="table" style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th>LEFT DATE</th><th>EMP CODE</th><th>CLIENT NAME</th><th>STATE NAME</th>
                        <th>UNIT NAME</th><th>NAME</th><th>TYPE</th><th>JOINING DATE.</th>
                        <th>Bank Account No</th><th>Bank Name</th><th>Rejoin Date</th><th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {adharRows.map((r) => (
                        <tr key={r.emp_code}>
                          <td>{r.left_date}</td><td>{r.emp_code}</td><td>{r.client_code}</td>
                          <td>{r.emp_current_state}</td><td>{r.unit_code}</td><td>{r.emp_name}</td>
                          <td>{r.employee_type}</td><td>{r.joining_date}</td>
                          <td>{r.original_bank_account_no}</td><td>{r.bank_name}</td>
                          <td>
                            <input className="form-control" style={{ width: 125 }} type="date"
                              value={rejoinDates[r.emp_code] ?? ""}
                              onChange={(e) => setRejoinDates((p) => ({ ...p, [r.emp_code]: e.target.value }))} />
                          </td>
                          <td><button className="btn btn-primary" disabled={busy} onClick={() => doRejoin(r)}>Rejoin</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>)}

          {/* ============ VIEW 3 — ENTRY FORM (legacy newpanel/employee_data): header + tabs + buttons ============ */}
          {view === "form" && (<>
            {/* ============ EMPLOYEE INFORMATION (header block — legacy 6-up col-sm-2 grid) ============ */}
            <div className="em-secttitle">EMPLOYEE INFORMATION</div>
            <div className="container-fluid" style={{ background: "var(--form-wrap, #faf8ef)", borderRadius: 10, border: "1px solid #fff", padding: 15, marginBottom: 12 }}>
              {/* Row 1 */}
              <div className="row">
                <HCell label="Employee Code :">
                  <input className="lg-control" maxLength={20} value={f.emp_code} readOnly
                    title="Auto-generated (company series + running number)"
                    style={{ background: "#eee" }} />
                </HCell>
                <HCell label="Employee Type :" req>
                  <SelCtl value={f.employee_type} onChange={onEmpType} opts={EMP_TYPES.map((e) => ({ v: e.v, t: e.t }))} />
                </HCell>
                <HCell label="Department Type :" req>
                  <SelCtl value={f.department} onChange={(v) => set("department", v)} opts={DEPARTMENTS.map((d) => ({ v: d, t: d }))} disabled={deptDisabled} />
                </HCell>
                <HCell label="Client Name :" req>
                  <SelCtl value={f.client_code}
                    onChange={(v) => setF((p) => ({ ...p, client_code: v, clientwisestate: "", unit_code: "", designation: "", working_hours: "" }))}
                    opts={[{ v: "", t: "Select" }, ...clients]} />
                </HCell>
                <HCell label="State :" req>
                  <SelCtl value={f.clientwisestate}
                    onChange={(v) => setF((p) => ({ ...p, clientwisestate: v, unit_code: "", designation: "", working_hours: "" }))}
                    opts={[{ v: "", t: "Select" }, ...clientStates.map((s) => ({ v: s, t: s }))]} />
                </HCell>
                <HCell label="Branch Name :" req>
                  <SearchSelCtl value={f.unit_code}
                    onChange={(v) => {
                      const pickedUnit = allUnits.find((u) => u.unit_code === v);
                      setF((p) => ({
                        ...p,
                        unit_code: v,
                        clientwisestate: pickedUnit?.state_name || p.clientwisestate,
                        designation: "",
                        working_hours: "",
                      }));
                    }}
                    opts={[{ v: "", t: "Select" }, ...units]} />
                </HCell>
              </div>
              {/* Row 2 */}
              <div className="row">
                <HCell label="Designation :" req>
                  <SelCtl value={f.designation}
                    onChange={(v) => {
                      setF((p) => ({ ...p, designation: v }));
                      // legacy ddl_grade change: the branch must have a billing policy for this designation
                      if (v && f.unit_code) {
                        getJSON<{ exists: boolean }>(`/api/hr/branch-policy-check/?client_code=${encodeURIComponent(f.client_code)}&unit_code=${encodeURIComponent(f.unit_code)}&designation=${encodeURIComponent(v)}`)
                          .then((d) => { if (d && d.exists === false) { alert("Please create branch Policy......"); setF((p) => ({ ...p, designation: "" })); } })
                          .catch(() => { });
                      }
                    }}
                    opts={[{ v: "", t: "Select" }, ...designations]} />
                </HCell>
                <HCell label="Employee ID As Per DOJ :">
                  <input className="lg-control" maxLength={20} value={f.id_as_per_dob} readOnly disabled />
                </HCell>
                <HCell label="IHMS Code :">
                  <input className="lg-control" value={f.ihms_code} onChange={(e) => set("ihms_code", e.target.value)} />
                </HCell>
                <HCell label="Employee Name :" req>
                  <input className="lg-control" maxLength={50} value={f.emp_name}
                    onChange={(e) => set("emp_name", e.target.value.replace(/[^A-Za-z\s]/g, ""))} />
                </HCell>
                <HCell label="Father / Husband Name :" req>
                  <input className="lg-control" maxLength={50} value={f.father_name}
                    onChange={(e) => set("father_name", e.target.value.replace(/[^A-Za-z\s]/g, ""))} />
                </HCell>
                <HCell label="Relation :">
                  <SelCtl value={f.relation} onChange={(v) => set("relation", v)} opts={RELATIONS.map((r) => ({ v: r, t: r }))} />
                </HCell>
              </div>
              {/* Row 3 */}
              <div className="row">
                <HCell label="Date of Birth :" req>
                  <input type="date" className="lg-control" value={f.birth_date} onChange={(e) => set("birth_date", e.target.value)} />
                </HCell>
                <HCell label="Gender :" req>
                  <SelCtl value={f.gender} onChange={(v) => set("gender", v)} opts={GENDERS} />
                </HCell>
                <HCell label="Reporting To :">
                  <SelCtl value={f.reporting_to} onChange={(v) => set("reporting_to", v)}
                    opts={[{ v: "", t: "Select" }, ...Array.from(new Set(rows.map((r) => r.emp_name).filter(Boolean))).sort().map((n) => ({ v: n, t: n }))]} />
                </HCell>
                <HCell label="Role :" req>
                  <SelCtl value={f.role} onChange={(v) => set("role", v)}
                    opts={[{ v: "", t: "--Select Role--" }, ...roles.map((r) => ({ v: r, t: r }))]} />
                </HCell>
                <HCell label="Working Hours :" req>
                  <SelCtl value={f.working_hours} onChange={(v) => set("working_hours", v)}
                    opts={[{ v: "", t: "Select" }, ...workHours.map((h) => ({ v: h, t: h }))]} />
                </HCell>
                <HCell label="IN Time :">
                  <SelCtl value={f.in_time} onChange={(v) => set("in_time", v)} opts={IN_TIMES.map((t) => ({ v: t, t }))} />
                </HCell>
              </div>
              {/* Row 4 */}
              <div className="row">
                <HCell label="Email-Id :">
                  <input className="lg-control" maxLength={70} value={f.email} onChange={(e) => set("email", e.target.value)} />
                </HCell>
                <HCell label="Police Verification Start Date :">
                  <input type="date" className="lg-control" value={f.police_start} onChange={(e) => set("police_start", e.target.value)} />
                </HCell>
                <HCell label="Police Verification End Date :">
                  <input type="date" className="lg-control" value={f.police_end} onChange={(e) => set("police_end", e.target.value)} />
                </HCell>
                <HCell label="Rent Agreement Start Date :">
                  <input type="date" className="lg-control" value={f.rent_start} onChange={(e) => set("rent_start", e.target.value)} />
                </HCell>
                <HCell label="Rent Agreement End Date :">
                  <input type="date" className="lg-control" value={f.rent_end} onChange={(e) => set("rent_end", e.target.value)} />
                </HCell>
                <HCell label="Shiftwise Employee :" req>
                  <SelCtl value={f.shiftwise_emp} onChange={(v) => set("shiftwise_emp", v)} opts={SHIFTWISE.map((s) => ({ v: s, t: s }))} />
                </HCell>
              </div>
              {/* Row 5 */}
              <div className="row">
                <HCell label="Material Payment :" req>
                  <SelCtl value={f.material_payment} onChange={(v) => set("material_payment", v)} opts={MATERIAL_PAYMENT} />
                </HCell>
              </div>
            </div>

            {/* ============ TABS ============ */}
            <div className="em-tabs">
              {TABS.map((t) => (
                <div key={t.id} className={`em-tab ${tab === t.id ? "active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</div>
              ))}
            </div>
            <div className="em-tabpane">
              {tab === "home" && <ContactTab f={f} set={set} setF={setF} states={states} stateCities={stateCities} />}
              {tab === "menu1" && <EmployeeDetailsTab f={f} set={set} />}
              {tab === "menu9" && <FamilyTab f={f} set={set} />}
              {tab === "menu6" && <BankTab f={f} set={set} />}
              {tab === "menu7" && <PersonalTab f={f} set={set} />}
              {tab === "menu2" && <QualificationTab f={f} set={set} />}
              {tab === "menu4" && <RatingTab f={f} set={set} />}
              {tab === "menu5" && <DocumentsTab empCode={f.emp_code} uploaded={uploadedDocs} onUploadAll={uploadAll} busy={busy} empType={f.employee_type} />}
              {tab === "menu11" && <KraTab f={f} set={set} />}
              {tab === "menu12" && <UniformTab f={f} set={set} rows={uniformRows} setRows={(r) => { setUniformRows(r); setUniformLoaded(true); }} />}
              {tab === "menu13" && <DupIdTab f={f} set={set} emp={selected?.emp_code ?? ""} />}
            </div>

            {/* ============ BUTTON ROW (legacy: Save/Approve/Update/Left/Delete/Send Relieving Letter/Close) ============ */}
            <div className="lg-btns center">
              {canCreate && !selected && !approvedHide && <button className="lg-btn lg-btn-green" disabled={busy} onClick={onSave}>Save</button>}
              {canUpdate && selected && !approvedHide && !editLocked && selected.employee_type === "Permanent" && <button className="lg-btn lg-btn-green" disabled={busy} onClick={onApprove}>Approve</button>}
              {canUpdate && selected && !editLocked && !approvedHide && <button className="lg-btn lg-btn-green" disabled={busy} onClick={onUpdate}>Update</button>}
              {selected && (legalFlag === 1 || legalFlag === 2) && <button className="lg-btn lg-btn-primary" disabled={busy} onClick={onLeft}>Left</button>}
              {canDelete && selected && !editLocked && <button className="lg-btn lg-btn-red" disabled={busy} onClick={onDelete}>Delete</button>}
              {selected && <button className="lg-btn lg-btn-green" disabled={busy} onClick={onRelieving}>Send Relieving Letter</button>}
              {selected && <button className="lg-btn lg-btn-green" disabled={busy} onClick={onIdCard}>Employee ID Card</button>}
              <button type="button" className="lg-btn lg-btn-red" onClick={backToLanding}>Close</button>
            </div>
          </>)}

          {/* ============ SEARCH GRID (SearchGridView) — landing view ============ */}
          {view === "landing" && (<>
            <div className="dt-top" style={{ marginTop: 10 }}>
              <div className="dt-search">
                <span>Search Employee:</span>
                <input value={search} onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { setLeftMode(false); setShowDispatch(false); setShowApproval(false); setShowResend(false); loadGrid(search); } }}
                  placeholder="EMP CODE / NAME / MOBILE" />
                <button className="lg-btn" onClick={() => { setLeftMode(false); setShowDispatch(false); setShowApproval(false); setShowResend(false); loadGrid(search); }}>Search</button>
              </div>
            </div>
            <div className="dt-btns no-print" style={{ marginBottom: 8 }}>
              <ExportButtons
                filename="employees"
                columns={[
                  { key: "emp_code", label: "EMP CODE" },
                  { key: "emp_name", label: "NAME" },
                  { key: "designation_code", label: "DESIGNATION" },
                  { key: "client_name", label: "CLIENT NAME" },
                  { key: "emp_current_state", label: "State" },
                  { key: "unit_name", label: "UNIT NAME" },
                  { key: "employee_type", label: "TYPE" },
                  { key: "emp_mobile_no", label: "MOBILE NO." },
                  { key: "birth_date", label: "BIRTH DATE" },
                  { key: "joining_date", label: "JOINING DATE" },
                ]}
                rows={rows}
              />
            </div>
            {loading ? <p>Loading…</p> : (
              <div className="dt-scroll"><table className="dt-grid">
                <thead>
                  <tr>
                    <th>EMP CODE</th><th>IHMS ID</th><th>NAME</th><th>DESIGNATION</th>
                    <th>CLIENT NAME</th><th>State</th><th>UNIT NAME</th><th>TYPE</th>
                    <th>MOBILE NO.</th><th>{leftMode ? "LEFT DATE" : "BIRTH DATE"}</th><th>JOINING DATE</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={11} style={{ textAlign: "center", color: "#777" }}>No employees</td></tr>}
                  {rows.map((r) => (
                    <tr key={r.id} className={selected?.id === r.id ? "dt-selected" : ""}
                      style={{ cursor: "pointer" }} onClick={() => selectRow(r)}>
                      <td>{r.emp_code}</td><td>{r.ihmscode}</td><td>{r.emp_name}</td>
                      <td>{r.designation_code}</td><td>{r.client_name || r.client_code}</td><td>{r.emp_current_state}</td>
                      <td>{r.unit_name || r.unit_code}</td><td>{r.employee_type}</td><td>{r.emp_mobile_no}</td>
                      <td>{leftMode ? ((r as FullEmp).left_date ?? r.birth_date ?? "") : (r.birth_date ?? "")}</td><td>{r.joining_date ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
          )}
        </>)}
        </div>
      </div>
    </div>
  );
}

/* ================= small presentational helpers ================= */
const onlyNum = (v: string) => v.replace(/[^0-9]/g, "");
const onlyAlpha = (v: string) => v.replace(/[^A-Za-z\s]/g, "");

/* ===== legacy-grid presentational helpers (exact EmployeeMaster.aspx Bootstrap-3 layout) ===== */

/* control-only <select> (full-width, no label) for inline use inside a grid cell */
function SelCtl({ value, onChange, opts, disabled }: {
  value: string; onChange: (v: string) => void; opts: Opt[]; disabled?: boolean;
}) {
  return (
    <select className="lg-control" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {opts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
    </select>
  );
}

/* searchable drop-down: type part of a code / name to narrow the list, click a row to choose it */
function SearchSelCtl({ value, onChange, opts, disabled }: {
  value: string; onChange: (v: string) => void; opts: Opt[]; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  // the list stays open while searching; it closes only on a click outside, Escape, or choosing a branch
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) {setOpen(false); setQ(""); }
    };
          document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  const cur = opts.find((o) => o.v === value);
  const shown = opts.filter((o) => o.v !== "" && o.t.toLowerCase().includes(q.trim().toLowerCase()));
          return (
          <div ref={box} style={{ position: "relative" }}>
            <input className="lg-control" disabled={disabled} placeholder="Search branch..."
              value={open ? q : (cur && cur.v ? cur.t : "")}
              onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
              onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); setQ(""); } if (e.key === "Enter") e.preventDefault(); }}
              onChange={(e) => { setQ(e.target.value); setOpen(true); }} />
            {open && (
              <div tabIndex={-1} style={{
                position: "absolute", zIndex: 50, left: 0, minWidth: "100%", width: 420, maxWidth: "90vw", top: "100%", maxHeight: 300, overflowY: "auto", fontSize: 14,
                background: "#fff", border: "1px solid #ccc", boxShadow: "0 4px 10px rgba(0,0,0,.15)"
              }}>
                <div tabIndex={0} style={{ padding: "6px 10px", cursor: "pointer", color: "#666" }}
                  onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(""); setOpen(false); setQ(""); }}>Select</div>
                {shown.length === 0 && <div style={{ padding: "6px 10px", color: "#999" }}>No match</div>}
                {shown.map((o) => (
                  <div key={o.v} tabIndex={0} style={{ padding: "6px 10px", cursor: "pointer", background: o.v === value ? "#e8f0fe" : undefined }}
                    onMouseDown={(e) => e.preventDefault()} onClick={() => { onChange(o.v); setOpen(false); setQ(""); }}>{o.t}</div>
                ))}
              </div>
            )}
          </div>
          );
}

/* stacked cell for the 6-up header block (label on top, inside a col-sm-{w}) */
          function HCell({label, req, w = 2, children}: {label: string; req?: boolean; w?: number; children: ReactNode }) {
  return (
          <div className={`col-sm-${w} col-xs-12 emf`}>
            <b>{label}</b>{req && <span className="text-red"> *</span>}
            {children}
          </div>
          );
}

/* horizontal field = label[col-sm-{lw}] + control[col-sm-{cw}] as sibling columns (#menu1 / #menu6) */
          function HRow({label, req, lw = 2, cw = 3, children}: {
            label: string; req?: boolean; lw?: number; cw?: number; children: ReactNode;
}) {
  return (
          <>
            <label className={`col-sm-${lw} col-xs-12 emf-label`}><b>{label}</b>{req && <span className="text-red"> *</span>}</label>
            <div className={`col-sm-${cw} col-xs-12 emf`}>{children}</div>
          </>
          );
}

/* side field (stacked inside a col-sm-6 half) = label[col-sm-{lw}] + control[col-sm-{cw}] (#home / #menu7) */
          function SRow({label, req, lw = 4, cw = 8, right, children}: {
            label: string; req?: boolean; lw?: number; cw?: number; right?: boolean; children: ReactNode;
}) {
  return (
          <div className="row emf-srow">
            <label className={`col-sm-${lw} col-xs-12 emf-label ${right ? "text-right" : ""}`}><b>{label}</b>{req && <span className="text-red"> *</span>}</label>
            <div className={`col-sm-${cw} col-xs-12`}>{children}</div>
          </div>
          );
}

          type TabProps = {f: Form; set: (k: string, v: string) => void };

          /* ---- Contact Details ---- */
          function ContactTab({f, set, setF, states, stateCities}: TabProps & {
            setF: React.Dispatch<React.SetStateAction<Form>>; states: string[]; stateCities: Record<string, string[]>;
}) {
  const copyPresent = () => setF((p) => ({
              ...p, perm_address: p.present_address, perm_state: p.present_state, perm_city: p.present_city,
            perm_pincode: p.present_pincode, perm_mobile1: p.mobile1, perm_mobile2: p.mobile2, perm_mobile3: p.mobile3,
  }));
            const stOpts = [{v: "", t: "Select" }, ...states.map((s) => ({v: s, t: s }))];
            const presentCityOpts = [{v: "", t: "Select" }, ...(stateCities[f.present_state] ?? []).map((c) => ({v: c, t: c }))];
            const permCityOpts = [{v: "", t: "Select" }, ...(stateCities[f.perm_state] ?? []).map((c) => ({v: c, t: c }))];
            return (
            <>
              {/* top action row — right-aligned Copy Present Address (legacy col-sm-12 text-right) */}
              <div className="row">
                <div className="col-sm-12 col-xs-12 text-right" style={{ marginBottom: 8 }}>
                  <button className="lg-btn lg-btn-primary" type="button" onClick={copyPresent}>Copy Present Address</button>
                </div>
              </div>
              {/* two halves: Present | Permanent */}
              <div className="row">
                <div className="col-sm-6 col-xs-12">
                  <SRow label="Present Address :" req>
                    <input className="lg-control" maxLength={225} value={f.present_address} onChange={(e) => set("present_address", e.target.value)} />
                  </SRow>
                  <SRow label="State :" req>
                    <SelCtl value={f.present_state} onChange={(v) => { set("present_state", v); set("present_city", ""); }} opts={stOpts} />
                  </SRow>
                  <SRow label="Present City :" req>
                    <SelCtl value={f.present_city} onChange={(v) => set("present_city", v)} opts={presentCityOpts} />
                  </SRow>
                  <SRow label="Pin code :">
                    <input className="lg-control" maxLength={6} value={f.present_pincode} onChange={(e) => set("present_pincode", onlyNum(e.target.value))} />
                  </SRow>
                  <SRow label="Mobile Number1 :" req>
                    <input className="lg-control" maxLength={10} value={f.mobile1} onChange={(e) => set("mobile1", onlyNum(e.target.value))} />
                  </SRow>
                  <SRow label="Mobile Number2 :">
                    <input className="lg-control" maxLength={10} value={f.mobile2} onChange={(e) => set("mobile2", onlyNum(e.target.value))} />
                  </SRow>
                  <SRow label="Mobile Number3 :">
                    <input className="lg-control" maxLength={10} value={f.mobile3} onChange={(e) => set("mobile3", onlyNum(e.target.value))} />
                  </SRow>
                </div>
                <div className="col-sm-6 col-xs-12">
                  <SRow label="Permanant Address :">
                    <input className="lg-control" maxLength={225} value={f.perm_address} onChange={(e) => set("perm_address", e.target.value)} />
                  </SRow>
                  <SRow label="State :">
                    <SelCtl value={f.perm_state} onChange={(v) => { set("perm_state", v); set("perm_city", ""); }} opts={stOpts} />
                  </SRow>
                  <SRow label="Permanant City :">
                    <SelCtl value={f.perm_city} onChange={(v) => set("perm_city", v)} opts={permCityOpts} />
                  </SRow>
                  <SRow label="Pincode :">
                    <input className="lg-control" maxLength={6} value={f.perm_pincode} onChange={(e) => set("perm_pincode", onlyNum(e.target.value))} />
                  </SRow>
                  <SRow label="Mobile Number1 :">
                    <input className="lg-control" maxLength={10} value={f.perm_mobile1} onChange={(e) => set("perm_mobile1", onlyNum(e.target.value))} />
                  </SRow>
                  <SRow label="Mobile Number2 :">
                    <input className="lg-control" maxLength={10} value={f.perm_mobile2} onChange={(e) => set("perm_mobile2", onlyNum(e.target.value))} />
                  </SRow>
                  <SRow label="Mobile Number3 :">
                    <input className="lg-control" maxLength={10} value={f.perm_mobile3} onChange={(e) => set("perm_mobile3", onlyNum(e.target.value))} />
                  </SRow>
                </div>
              </div>
              {/* Reference Details sub-panel — two halves */}
              <div className="panel panel-default" style={{ marginTop: 12 }}>
                <div className="panel-heading"><b>Reference Details</b></div>
                <div className="panel-body">
                  <div className="row">
                    <div className="col-sm-6 col-xs-12">
                      <SRow label="Contact Name 1 :">
                        <input className="lg-control" maxLength={30} value={f.ref1_name} onChange={(e) => set("ref1_name", onlyAlpha(e.target.value))} />
                      </SRow>
                      <SRow label="Mobile No 1 :">
                        <input className="lg-control" maxLength={10} value={f.ref1_mobile} onChange={(e) => set("ref1_mobile", onlyNum(e.target.value))} />
                      </SRow>
                      <SRow label="Email Id 1 :">
                        <input className="lg-control" maxLength={200} value={f.ref1_email} onChange={(e) => set("ref1_email", e.target.value)} />
                      </SRow>
                      <SRow label="Address 1 :">
                        <textarea className="lg-control" rows={6} value={f.ref1_address} onChange={(e) => set("ref1_address", e.target.value)} />
                      </SRow>
                    </div>
                    <div className="col-sm-6 col-xs-12">
                      <SRow label="Contact Name 2 :">
                        <input className="lg-control" maxLength={50} value={f.ref2_name} onChange={(e) => set("ref2_name", onlyAlpha(e.target.value))} />
                      </SRow>
                      <SRow label="Mobile No 2 :">
                        <input className="lg-control" maxLength={10} value={f.ref2_mobile} onChange={(e) => set("ref2_mobile", onlyNum(e.target.value))} />
                      </SRow>
                      <SRow label="Email Id 2 :">
                        <input className="lg-control" maxLength={50} value={f.ref2_email} onChange={(e) => set("ref2_email", e.target.value)} />
                      </SRow>
                      <SRow label="Address 2 :">
                        <textarea className="lg-control" rows={6} value={f.ref2_address} onChange={(e) => set("ref2_address", e.target.value)} />
                      </SRow>
                    </div>
                  </div>
                </div>
              </div>
              <div className="em-note">Reference &amp; extra contact numbers are captured on the form exactly as legacy; the core record persists the primary address, present/permanent state &amp; city and mobile numbers.</div>
            </>
            );
}

            /* ---- Employee Details ---- */
            function EmployeeDetailsTab({f, set}: TabProps) {
  return (
            <>
              <div className="row">
                <HRow label="Confirmation Date :"><input type="date" className="lg-control" value={f.confirmation_date} onChange={(e) => set("confirmation_date", e.target.value)} /></HRow>
                <HRow label="Joining Date :" req><input type="date" className="lg-control" value={f.joining_date} onChange={(e) => set("joining_date", e.target.value)} /></HRow>
              </div>
              <div className="row">
                <HRow label="Working State :" req><input className="lg-control" maxLength={50} value={f.work_state} onChange={(e) => set("work_state", onlyAlpha(e.target.value))} /></HRow>
                <HRow label="Working City :" req><input className="lg-control" maxLength={50} value={f.work_city} onChange={(e) => set("work_city", onlyAlpha(e.target.value))} /></HRow>
              </div>
              <div className="row">
                <HRow label="Police Station Name :"><input className="lg-control" maxLength={225} value={f.police_station} onChange={(e) => set("police_station", e.target.value)} /></HRow>
                <HRow label="Aadhar Card / Enrollment No :" req><input className="lg-control" maxLength={12} value={f.aadhaar} onChange={(e) => set("aadhaar", onlyNum(e.target.value))} /></HRow>
              </div>
              <div className="row">
                <HRow label="PAN Number :" req><input className="lg-control" maxLength={10} value={f.pan} onChange={(e) => set("pan", e.target.value.toUpperCase())} /></HRow>
                <HRow label="Reason For Resign :"><input className="lg-control" maxLength={40} value={f.reason_for_left} onChange={(e) => set("reason_for_left", e.target.value)} /></HRow>
              </div>
              <div className="row">
                <HRow label="Left Date :"><input type="date" className="lg-control" value={f.left_date} onChange={(e) => set("left_date", e.target.value)} /></HRow>
              </div>
              <div className="em-note">Aadhaar &amp; PAN are stored via the secure KYC module (encrypted at rest, duplicate-checked) — never in plaintext. On editing an existing employee they show blank for re-entry by design.</div>
            </>
            );
}

            /* ---- Family Details ---- */
            function FamilyTab({f, set}: TabProps) {
  const rows = [
            {i: 1, rel: "Father" }, {i: 2, rel: "Mother" }, {i: 3, rel: "Wife" },
            {i: 4, rel: "Husband" }, {i: 5, rel: "Child" }, {i: 6, rel: "Child" }, {i: 7, rel: "Child" },
            ];
            return (
            <>
              <div className="row" style={{ marginBottom: 10 }}>
                <label className="col-lg-1 col-md-4 col-sm-6 col-xs-12 text-right emf-label"><b>Number of Child :</b></label>
                <div className="col-lg-1 col-md-4 col-sm-6 col-xs-12">
                  <input className="lg-control" value={f.number_of_child} onChange={(e) => set("number_of_child", onlyNum(e.target.value))} />
                </div>
              </div>
              <table className="lg-grid">
                <thead><tr><th>Name</th><th>Relation</th><th>DOB</th><th>PAN No</th><th>Aadhar No</th><th>Mobile No</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.i}>
                      <td><input className="lg-control" maxLength={50} value={f[`fam_name${r.i}`] ?? ""} readOnly={r.i === 1}
                        onChange={(e) => set(`fam_name${r.i}`, e.target.value)} /></td>
                      <td><input className="lg-control" maxLength={50} value={f[`fam_rel${r.i}`] ?? r.rel} readOnly
                        onChange={(e) => set(`fam_rel${r.i}`, e.target.value)} /></td>
                      <td><input type="date" className="lg-control" value={f[`fam_dob${r.i}`] ?? ""} onChange={(e) => set(`fam_dob${r.i}`, e.target.value)} /></td>
                      <td><input className="lg-control" maxLength={20} value={f[`fam_pan${r.i}`] ?? ""} onChange={(e) => set(`fam_pan${r.i}`, e.target.value.toUpperCase())} /></td>
                      <td><input className="lg-control" maxLength={20} value={f[`fam_adh${r.i}`] ?? ""} onChange={(e) => set(`fam_adh${r.i}`, onlyNum(e.target.value))} /></td>
                      <td><input className="lg-control" maxLength={10} value={f[`fam_mob${r.i}`] ?? ""} onChange={(e) => set(`fam_mob${r.i}`, onlyNum(e.target.value))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="em-note">Family / dependent KYC persists via the secure encrypted module.</div>
            </>
            );
}

            /* ---- Bank Account Details ---- */
            function BankTab({f, set}: TabProps) {
  return (
            <>
              <div className="row">
                <HRow label="Bank Account Holder Name :" req><input className="lg-control" maxLength={50} value={f.bank_holder} onChange={(e) => set("bank_holder", onlyAlpha(e.target.value))} /></HRow>
                <HRow label="Bank Name :"><input className="lg-control" maxLength={50} value={f.bank_name} onChange={(e) => set("bank_name", onlyAlpha(e.target.value))} /></HRow>
              </div>
              <div className="row">
                <HRow label="Branch Location Name :"><input className="lg-control" maxLength={200} value={f.branch_location} onChange={(e) => set("branch_location", e.target.value)} /></HRow>
                <HRow label="Other Bank A/C Number :"><input className="lg-control" maxLength={20} value={f.other_bank_ac} onChange={(e) => set("other_bank_ac", onlyNum(e.target.value))} /></HRow>
              </div>
              <div className="row">
                <HRow label="Original Bank A/C Number :" req><input className="lg-control" maxLength={20} value={f.original_bank_ac} onChange={(e) => set("original_bank_ac", onlyNum(e.target.value))} /></HRow>
                <HRow label="IFSC Code :" req><input className="lg-control" maxLength={11} value={f.ifsc} onChange={(e) => set("ifsc", e.target.value.toUpperCase())} /></HRow>
              </div>
              <div className="row">
                <HRow label="NFD/IFD :" req><SelCtl value={f.nfd_ifd} onChange={(v) => set("nfd_ifd", v)} opts={NFD_IFD} /></HRow>
                <HRow label="Nominee Name :"><input className="lg-control" value={f.nominee_name} onChange={(e) => set("nominee_name", onlyAlpha(e.target.value))} /></HRow>
              </div>
              <div className="row">
                <HRow label="Nominee Relation :"><input className="lg-control" maxLength={20} value={f.nominee_relation} onChange={(e) => set("nominee_relation", onlyAlpha(e.target.value))} /></HRow>
                <HRow label="Nominee Birth Date :"><input type="date" className="lg-control" value={f.nominee_dob} onChange={(e) => set("nominee_dob", e.target.value)} /></HRow>
              </div>
              <div className="row">
                <HRow label="Nominee Address :"><input className="lg-control" maxLength={300} value={f.nominee_address} onChange={(e) => set("nominee_address", e.target.value)} /></HRow>
              </div>
              <div className="em-note">Bank &amp; nominee details persist via the secure module and enter the 2-level bank-approval workflow (changing bank fields resets it to pending).</div>
            </>
            );
}

            /* ---- Personal Details ---- */
            function PersonalTab({f, set}: TabProps) {
  return (
            <div className="row">
              <div className="col-sm-6 col-xs-12">
                <SRow label="Nationality :" req right><input className="lg-control" maxLength={20} value={f.nationality} onChange={(e) => set("nationality", onlyAlpha(e.target.value))} /></SRow>
                <SRow label="Identitymark :" right><input className="lg-control" maxLength={30} value={f.identity_mark} onChange={(e) => set("identity_mark", e.target.value)} /></SRow>
                <SRow label="Mother Tongue :" right><input className="lg-control" maxLength={30} value={f.mother_tongue} onChange={(e) => set("mother_tongue", e.target.value)} /></SRow>
                <SRow label="Hobbies :" right><input className="lg-control" maxLength={100} value={f.hobbies} onChange={(e) => set("hobbies", e.target.value)} /></SRow>
                <SRow label="Passport No :" right><input className="lg-control" maxLength={20} value={f.passport_no} onChange={(e) => set("passport_no", e.target.value)} /></SRow>
                <SRow label="Driving Licence No :" right><input className="lg-control" maxLength={30} value={f.driving_licence_no} onChange={(e) => set("driving_licence_no", e.target.value)} /></SRow>
                <SRow label="Weight (in Kg) :" right cw={6}><input className="lg-control" value={f.weight} onChange={(e) => set("weight", e.target.value)} /></SRow>
                <SRow label="Marital Status :" right><SelCtl value={f.marital_status} onChange={(v) => set("marital_status", v)} opts={MARITAL} /></SRow>
              </div>
              <div className="col-sm-6 col-xs-12">
                <SRow label="Religion :" right><SelCtl value={f.religion} onChange={(v) => set("religion", v)} opts={RELIGIONS.map((r) => ({ v: r, t: r }))} /></SRow>
                <SRow label="Place Of Birth :" right><input className="lg-control" maxLength={50} value={f.place_of_birth} onChange={(e) => set("place_of_birth", e.target.value)} /></SRow>
                <SRow label="Language Known :" right><input className="lg-control" maxLength={100} value={f.language_known} onChange={(e) => set("language_known", e.target.value)} /></SRow>
                <SRow label="Area Of Expertise :" right><input className="lg-control" maxLength={20} value={f.area_of_expertise} onChange={(e) => set("area_of_expertise", e.target.value)} /></SRow>
                <SRow label="Details Of Handicap :" right><input className="lg-control" maxLength={20} value={f.handicap} onChange={(e) => set("handicap", e.target.value)} /></SRow>
                <SRow label="Height (in Feets) :" right><input className="lg-control" value={f.height} onChange={(e) => set("height", e.target.value)} /></SRow>
                <SRow label="Blood Group :" req right><SelCtl value={f.blood_group} onChange={(v) => set("blood_group", v)} opts={BLOOD_GROUPS.map((b) => ({ v: b, t: b }))} /></SRow>
              </div>
            </div>
            );
}

            /* ---- Qualification Details ---- */
            function QualificationTab({f, set}: TabProps) {
  const qMax = [20, 15, 20, 15, 15];
            return (
            <div className="row">
              <div className="col-sm-6 col-xs-12 em-half">
                <h3 style={{ textAlign: "center", color: "var(--brand-accent)", fontSize: 16, fontWeight: 700 }}>Qualification</h3>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div className="row" key={i}>
                    <HCell label={`Qualification${i} :`} w={8}>
                      <input className="lg-control" maxLength={qMax[i - 1]} value={f[`qualification_${i}`]} onChange={(e) => set(`qualification_${i}`, e.target.value)} />
                    </HCell>
                    <HCell label={i === 1 ? "Year of passing" : " "} w={4}>
                      <input className="lg-control" maxLength={4} value={f[`year_${i}`]} onChange={(e) => set(`year_${i}`, onlyNum(e.target.value))} />
                    </HCell>
                  </div>
                ))}
              </div>
              <div className="col-sm-6 col-xs-12">
                <h3 style={{ textAlign: "center", color: "var(--brand-accent)", fontSize: 16, fontWeight: 700 }}>Skill</h3>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div className="row" key={i}>
                    <HCell label={`Key Skill${i} :`} w={8}>
                      <input className="lg-control" value={f[`skill_${i}`]} onChange={(e) => set(`skill_${i}`, e.target.value)} />
                    </HCell>
                    <HCell label={i === 1 ? "Experience in months" : " "} w={4}>
                      <input className="lg-control" value={f[`exp_${i}`]} onChange={(e) => set(`exp_${i}`, onlyNum(e.target.value))} />
                    </HCell>
                  </div>
                ))}
              </div>
            </div>
            );
}

            /* ---- Rating Details ---- */
            function RatingTab({f, set}: TabProps) {
  return (
            <>
              <div className="row">
                <HCell label="Fine :" w={2}><input className="lg-control" value={f.fine} readOnly /></HCell>
                <HCell label="Advance :" w={2}><input className="lg-control" value={f.advance} onChange={(e) => set("advance", onlyNum(e.target.value))} /></HCell>
              </div>
              <div className="em-note">Fine is read-only (applied by the payroll/transaction module); Advance is editable, as in the legacy page.</div>
            </>
            );
}

            /* ---- Documents ---- */
            // Mandatory documents (legacy btn_add_Click): non-Reliever = Photo+Aadhar+Pan; Reliever = Bank Passbook.
            // Required before Save / Update (and Approve): same list as the backend required_documents().
            const REQUIRED_DOCS_ALL = ["Original Photo(Passport Size)", "Original Aadhar Card", "Pan Card", "Bank Passbook",
            "Original Proof of Present Address", "Joining Kit", "Original Police Verification Document"];
            const REQUIRED_DOCS_RELIEVER = ["Bank Passbook", "Original Proof of Present Address", "Joining Kit"];
const requiredDocs = (empType: string) => (empType === "Reliever" ? REQUIRED_DOCS_RELIEVER : REQUIRED_DOCS_ALL);
const missingDocsMsg = (missing: string[]) => "Please upload these documents first: " + missing.join(", ") + ".";
            const MANDATORY_DOCS = new Set(REQUIRED_DOCS_ALL);
            // Documents the Admin Approve step needs (legacy check_document1 + Police Verification, added on request): they are
            // not needed to Save, but Approve is refused until they are uploaded, so they are marked "**" on the slots.
            const APPROVE_DOCS = new Set(["Original Proof of Present Address", "Bank Passbook", "Joining Kit", "Pan Card",
            "Original Police Verification Document"]);

            function docFullUrl(url: string): string {
  return url.startsWith("http") ? url : `${API_BASE_URL.replace(/\/+$/, "")}/${url.replace(/^\/+/, "")}`;
}

            function DocSlot({label, uploaded, pending, onSelect, busy, empCode}: {
              label: string | null; uploaded: Record<string, string>; pending: Record<string, File>;
  onSelect: (t: string, f: File | null) => void; busy: boolean; empCode: string;
}) {
  if (!label) return (
            <>
              <div className="col-sm-2 col-xs-12" /><div className="col-sm-1 col-xs-12" /><div className="col-sm-2 col-xs-12" />
            </>
            );
            const url = uploaded[label];
            const sel = pending[label];
            const req = MANDATORY_DOCS.has(label);
            const needApprove = APPROVE_DOCS.has(label);
            return (
            <>
              <div className="col-sm-2 col-xs-12 emf"><b style={{ fontSize: 12 }}>{label} :</b>{req && <span className="text-red"> *</span>}</div>
              <div className="col-sm-1 col-xs-12 emf">
                <input type="file" accept=".jpg,.jpeg,.png,.pdf" disabled={busy || !empCode}
                  style={{ fontSize: 11, width: "100%" }}
                  onChange={(e) => {
                    const picked = e.target.files?.[0] ?? null;
                    // legacy: the Original Photo slot takes only a JPG; a wrong file is refused at once and the slot is cleared
                    if (picked && label === "Original Photo(Passport Size)" && !/\.jpe?g$/i.test(picked.name)) {
                      alert("Please select only JPG Photo !!!");
                      e.target.value = "";
                      onSelect(label, null);
                      return;
                    }
                    onSelect(label, picked);
                  }} />
                {sel && <div style={{ fontSize: 10, color: "#337ab7" }}>selected: {sel.name}</div>}
              </div>
              <div className="col-sm-2 col-xs-12 emf" style={{ fontSize: 11 }}>
                {url ? (() => {
                  const full = docFullUrl(url);
                  const isPdf = full.toLowerCase().split("?")[0].endsWith(".pdf");
                  return (
                    <a href={full} target="_blank" rel="noreferrer" title="Click to view full">
                      {isPdf
                        ? <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 100, height: 100, border: "1px solid #ccc", background: "#f7f7f7", color: "green" }}>PDF ✓</span>
                        : <img src={full} alt={label} width={100} height={100} style={{ objectFit: "cover", border: "1px solid #ccc" }} />}
                    </a>
                  );
                })() : <span style={{ color: req ? "#d9534f" : "#aaa" }}>{req ? "Required" : "Not uploaded"}</span>}
              </div>
            </>
            );
}
            function DocumentsTab({empCode, uploaded, onUploadAll, busy, empType}: {
              empCode: string; uploaded: Record<string, string>; empType: string;
            onUploadAll: (files: Record<string, File>) => Promise<boolean>; busy: boolean;
}) {
  const [pending, setPending] = useState<Record<string, File>>({ });
                // legacy pairs: left slot | right slot (last row single)
                const pairs: [string, string | null][] = [
                ["Duplicate Photo(Passport Size)", "Original Photo(Passport Size)"],
                ["Duplicate Aadhar Card", "Original Aadhar Card"],
                ["Duplicate Police Verification Document", "Original Police Verification Document"],
                ["Duplicate Proof of Present Address", "Original Proof of Present Address"],
                ["Passport", "Joining Kit"],
                ["10th Marksheet", "Form No 11"],
                ["Diploma Certificate", "Form No 2"],
                ["Post Graduation Certificate", "Bank Passbook"],
                ["Degree Certificate", "Driving Liscence"],
                ["NOC Form", "Education Certificate"],
                ["Pan Card", "Biodata"],
                ["Medical Document", "12th Marksheet"],
                ["TIC Document", null],
                ];
  const onSelect = (t: string, file: File | null) => {
                  setPending((p) => {
                    const n = { ...p };
                    if (file) n[t] = file; else delete n[t];
                    return n;
                  });
  };
  const doUpload = async () => {
    // Validation lives on the Upload button: every required document must be on file (already uploaded) or
    // selected now, otherwise nothing is uploaded and the popup names what is still missing.
    const missing = requiredDocs(empType).filter((d) => !uploaded[d] && !pending[d]);
                if (missing.length) {alert(missingDocsMsg(missing)); return; }
                const ok = await onUploadAll(pending);
                if (ok) setPending({ });  // keep selections if an upload failed
  };
                const pendingCount = Object.keys(pending).length;
                return (
                <>
                  {!empCode && <div className="em-note">Documents can be uploaded only after the Employee Code is set.</div>}
                  <div className="container-fluid">
                    {pairs.map(([l, r], i) => (
                      <div className="row" key={i} style={{ marginBottom: 6 }}>
                        <DocSlot label={l} uploaded={uploaded} pending={pending} onSelect={onSelect} busy={busy} empCode={empCode} />
                        <div className="col-sm-2 col-xs-12" />
                        <DocSlot label={r} uploaded={uploaded} pending={pending} onSelect={onSelect} busy={busy} empCode={empCode} />
                      </div>
                    ))}
                  </div>
                  {/* legacy single centered Upload button */}
                  <div className="row"><div className="col-sm-12 col-xs-12" style={{ textAlign: "center", marginTop: 10 }}>
                    <button className="lg-btn lg-btn-green" type="button" disabled={busy || !empCode || pendingCount === 0} onClick={doUpload}>
                      Upload{pendingCount > 0 ? ` (${pendingCount})` : ""}
                    </button>
                  </div></div>
                  <p className="em-hint" style={{ textAlign: "center" }}>Only JPG, PNG, PDF files will be uploaded.</p>
                  <div className="em-note"><b>Required ( <span className="text-red">*</span> ):</b> Save and Update are blocked until every required document is uploaded. Non-Reliever: Original Photo, Aadhar, PAN, Bank Passbook, Address Proof, Joining Kit and Police Verification. Reliever: Bank Passbook, Address Proof and Joining Kit. Select the files and click <b>Upload</b>.</div>
                </>
                );
}

                /* ---- KRA ---- */
                function KraTab({f, set}: TabProps) {
  return (
                <div className="row">
                  <label className="col-lg-2 col-md-4 col-sm-6 col-xs-12 text-right emf-label"><b>Key Responsibility Area :</b></label>
                  <div className="col-lg-6 col-md-6 col-sm-6 col-xs-12">
                    <textarea className="lg-control" rows={6} value={f.kra} onChange={(e) => set("kra", e.target.value)} />
                  </div>
                </div>
                );
}

                /* ---- Uniform Details (legacy gv_product_details staging: rows are saved with Save / Update) ---- */
                const UNI_GROUPS: Record<string, string> = {"1": "Housekeeping", "2": "Security_Guard", "3": "Common" };
                const UNI_PRODUCTS: Record<string, string[]> = {
                  "1": ["Uniform", "Shoes", "Sweater", "ID_Card", "Raincoat", "Pantry_Jacket", "Apron"],
                "2": ["Uniform", "Shoes", "Sweater", "ID_Card", "Raincoat", "Torch", "Baton", "Belt", "Pantry_Jacket", "Apron"],
                "3": ["Uniform", "Shoes", "Sweater", "ID_Card", "Raincoat", "Apron"],
};
                const UNI_MAX_SETS: Record<string, number> = {Uniform: 2, Shoes: 1, Sweater: 1, ID_Card: 1, Raincoat: 1, Torch: 5, Baton: 5, Belt: 5, Pantry_Jacket: 2, Apron: 2 };
                const UNI_NO_SIZE = new Set(["ID_Card", "Torch", "Baton", "Belt"]);
const dmy = (v: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || "");
                return m ? `${m[3]}/${m[2]}/${m[1]}` : (v || "");
};

                function UniformTab({f, set, rows, setRows}: TabProps & {rows: UniRow[]; setRows: (r: UniRow[]) => void }) {
  const [sizes, setSizes] = useState<string[]>([]);
                const type = f.uni_type !== "0" ? f.uni_type : "";
  useEffect(() => {
                  setSizes([]);
                if (!type || UNI_NO_SIZE.has(type)) return;
                getJSON<{ sizes ?: string[]}>(`${EMP_BASE}/uniform-options/?type=${encodeURIComponent(type)}`).then((d) => setSizes(d?.sizes ?? []));
  }, [type]);
                  const products = UNI_PRODUCTS[f.uni_designation] ?? [];
                  const maxSets = type ? (UNI_MAX_SETS[type] ?? 1) : 0;
  const onAdd = () => {
    /* legacy req_valid() (Add) */
    if (f.uni_designation === "0") {alert("Please Select Designation !!!"); return; }
                  if (!type) {alert("Please Select product Type !!!"); return; }
                  if (!f.uni_set || f.uni_set === "0") {alert("Please Select  Number of Sets !!!"); return; }
                  if (!UNI_NO_SIZE.has(type) && !f.uni_size) {alert("Please Select  Product Size !!!"); return; }
                  if (!f.uni_issue) {alert("Please Select Issue Date"); return; }
                  if (!f.uni_expiry) {alert("Please Select Expiry Date"); return; }
    /* legacy lnk_zone_add_Click */
    if (rows.some((r) => r.type === type)) {alert("Same Type Already Inserted!!"); return; }
                  setRows([...rows, {
                    type, sets: Number(f.uni_set), size: UNI_NO_SIZE.has(type) ? "" : f.uni_size,
                  start: dmy(f.uni_issue), end: dmy(f.uni_expiry), remaining: Number(f.uni_set),
    }]);
                  set("uni_type", "0"); set("uni_set", "0"); set("uni_size", ""); set("uni_issue", ""); set("uni_expiry", "");
  };
                  return (
                  <>
                    <div className="panel panel-default">
                      <div className="panel-body">
                        <div className="row">
                          <HCell label="Select Designation :" w={2}>
                            <SelCtl value={f.uni_designation} onChange={(v) => { set("uni_designation", v); set("uni_type", "0"); set("uni_set", "0"); }}
                              opts={[{ v: "0", t: "Select" }, ...Object.entries(UNI_GROUPS).map(([v, t]) => ({ v, t }))]} />
                          </HCell>
                          <HCell label="Select Type :" w={2}>
                            <SelCtl value={f.uni_type} onChange={(v) => { set("uni_type", v); set("uni_set", "0"); set("uni_size", ""); }}
                              opts={[{ v: "0", t: "Select" }, ...products.map((p) => ({ v: p, t: p }))]} />
                          </HCell>
                          <HCell label="Number Of Set :" w={2}>
                            <SelCtl value={f.uni_set} onChange={(v) => set("uni_set", v)}
                              opts={[{ v: "0", t: "Select" }, ...Array.from({ length: maxSets }, (_, i) => ({ v: String(i + 1), t: String(i + 1) }))]} />
                          </HCell>
                          <HCell label="Size :" w={1}>
                            <SelCtl value={f.uni_size} onChange={(v) => set("uni_size", v)} disabled={!type || UNI_NO_SIZE.has(type)}
                              opts={[{ v: "", t: "Select" }, ...sizes.map((z) => ({ v: z, t: z }))]} />
                          </HCell>
                          <HCell label="Issuing Date :" w={2}><input type="date" className="lg-control" value={f.uni_issue} onChange={(e) => set("uni_issue", e.target.value)} /></HCell>
                          <HCell label="Expiry Date :" w={2}><input type="date" className="lg-control" value={f.uni_expiry} onChange={(e) => set("uni_expiry", e.target.value)} /></HCell>
                          <div className="col-sm-1 col-xs-12 emf"><b>&nbsp;</b><button className="lg-btn lg-btn-green" type="button" style={{ width: "100%" }} onClick={onAdd}>Add</button></div>
                        </div>
                      </div>
                    </div>
                    <table className="lg-grid">
                      <thead><tr><th></th><th>Sr No.</th><th>Type</th><th>Number Of Set</th><th>Size</th><th>Issue Date</th><th>Expiry Date</th><th>Remainig Number Of Set</th></tr></thead>
                      <tbody>
                        {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "#777" }}>No records</td></tr>}
                        {rows.map((r, i) => (
                          <tr key={r.type}>
                            <td>{r.dispatched
                              ? <span title="Already dispatched">-</span>
                              : <a href="#" onClick={(e) => { e.preventDefault(); setRows(rows.filter((x) => x.type !== r.type)); }}>Remove</a>}</td>
                            <td>{i + 1}</td><td>{r.type}</td><td>{r.sets}</td><td>{r.size}</td>
                            <td>{dmy(r.start)}</td><td>{dmy(r.end)}</td><td>{r.remaining ?? r.sets}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="em-note">Uniform / ID-card rows are saved with Save / Update. Approval needs Uniform + Shoes (or Apron) and an ID_Card row for Permanent employees.</div>
                  </>
                  );
}

                  /* ---- Dublicate Id Card (legacy lnk_dublicate_id_Click + gv_dublicate_id_card) ---- */
                  function DupIdTab({f, set, emp}: TabProps & {emp: string }) {
  const [rows, setRows] = useState<{ id: number; admin_id_set: string; from: string; to: string }[]>([]);
                  const DUP_BASE = "/api/hr/employee-details";
  const reload = useCallback(async () => {
    if (!emp) {setRows([]); return; }
                  const d = await getJSON<{ results: {id: number; admin_id_set: string; from: string; to: string }[] }>(
                  `${DUP_BASE}/legacy-dupid/?emp=${encodeURIComponent(emp)}`);
                  setRows(d?.results ?? []);
  }, [emp]);
  useEffect(() => {reload(); }, [reload]);
  const add = async () => {
    if (!emp) {alert("Record not Available"); return; }
                  if (!f.dup_set || f.dup_set === "Select") {alert("Please Select Dublicate Id Card Set!!!"); return; }
                  if (!f.dup_from) {alert("Please Select Issue Date"); return; }
                  const r = await fetch(`${API_BASE_URL}${DUP_BASE}/legacy-dupid-add/`, {
                    method: "POST", credentials: "include",
                  headers: {"Content-Type": "application/json", Accept: "application/json" },
                  body: JSON.stringify({
                    client: f.client_code, state: f.clientwisestate, unit: f.unit_code, emp,
                  sets: f.dup_set, from: f.dup_from, to: f.dup_to
      }),
    });
    const d = await r.json().catch(() => ({ }));
                  if (r.ok) {
                    alert(d.message || " Employee Files Successfully Added... !!!");
                  set("dup_set", "Select"); set("dup_from", ""); set("dup_to", "");
                  reload();
    } else {
                    alert(errMsg(d) || " Employee Files Addition Failed... !!!");
    }
  };
                  return (
                  <>
                    <div className="panel panel-default">
                      <div className="panel-body">
                        <div className="row">
                          <HCell label="Number Of Set :" w={2}><SelCtl value={f.dup_set} onChange={(v) => set("dup_set", v)} opts={DUP_ID_SET.map((s) => ({ v: s, t: s }))} /></HCell>
                          <HCell label="Issuing Date :" w={2}><input type="date" className="lg-control" value={f.dup_from} onChange={(e) => set("dup_from", e.target.value)} /></HCell>
                          <HCell label="Expiry Date :" w={2}><input type="date" className="lg-control" value={f.dup_to} onChange={(e) => set("dup_to", e.target.value)} /></HCell>
                          <div className="col-sm-1 col-xs-12 emf"><b>&nbsp;</b><button className="lg-btn lg-btn-green" type="button" onClick={add} style={{ width: "100%" }}>Add</button></div>
                        </div>
                      </div>
                    </div>
                    <table className="lg-grid">
                      <thead><tr><th></th><th>Sr No.</th><th>id</th><th>Number Of Set</th><th>ISSUE DATE</th><th>EXPIRY DATE</th></tr></thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={r.id}><td></td><td>{i + 1}</td><td>{r.id}</td><td>{r.admin_id_set}</td><td>{r.from}</td><td>{r.to}</td></tr>
                        ))}
                        {rows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#777" }}>No records</td></tr>}
                      </tbody>
                    </table>
                  </>
                  );
}

                  function errMsg(d: unknown): string {
  if (d == null) return "";
                  if (typeof d === "string") return d;
  // DRF `raise ValidationError("msg")` serializes to a bare array ["msg"]; render the
  // message(s) directly (not "0: msg") so the legacy alert text shows verbatim.
  if (Array.isArray(d)) return d.map((x) => errMsg(x)).filter(Boolean).join(" · ");
                  if (typeof d !== "object") return String(d);
                  const o = d as Record<string, unknown>;
                  if (typeof o.detail === "string") return o.detail;
  return Object.entries(o).map(([k, v]) => {
    const val = Array.isArray(v) ? v.map((x) => errMsg(x)).filter(Boolean).join(", ") : errMsg(v);
                  // non_field_errors and numeric index keys carry the message alone (no key prefix).
                  return k === "non_field_errors" || /^\d+$/.test(k) ? val : `${k}: ${val}`;
  }).join(" · ");
}
