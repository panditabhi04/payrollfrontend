"use client";
/* =====================================================================
 * EMPLOYEE VIEW DETAILS — 1:1 port of Employee_view_details.aspx.
 * Header EMPLOYEE VIEW DETAILS + button bar, filter form (code/type/
 * department/client/state/branch/designation + personal/job fields),
 * 12 tabs (Contact/Employee/Family/Bank/Personal/Qualification/Rating/
 * Documents/KRA/Uniform/Duplicate Id Card + hidden Loan), search +
 * left-employee + aadhaar + counts, full add/update/delete/approve/
 * left/rejoin/export flows.
 * Backend: /api/hr/employee-details/legacy-* (legacy tables).
 * ===================================================================== */
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api/client";
import { openPrintHtml } from "@/components/hrPrint";

const BASE = "/api/hr/employee-details";
const SEL = "Select";

type Row = Record<string, any>;
type Opt = { code: string; name: string };

function val(r: Row, name: string): any {
  if (r[name] !== undefined && r[name] !== null) return r[name];
  const want = name.toLowerCase();
  for (const k of Object.keys(r)) {
    if (k.toLowerCase() === want) return (r as Row)[k];
  }
  return "";
}

async function errText(r: Response, fallback: string): Promise<string> {
  const d = await r.json().catch(() => null);
  if (typeof d === "string" && d) return d;
  if (Array.isArray(d) && d.length) return String(d[0]);
  if (d && typeof d === "object") {
    if (typeof (d as any).detail === "string") return (d as any).detail;
    if (typeof (d as any).message === "string") return (d as any).message;
  }
  return `${fallback} (${r.status})`;
}

async function getJSON<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE_URL}${path}`, { credentials: "include", cache: "no-store" });
  if (!r.ok) throw new Error(await errText(r, "Request failed"));
  return (await r.json()) as T;
}

async function csrfToken(): Promise<string> {
  const csrf = await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" })
    .then((r) => r.json()).catch(() => null);
  const m = typeof document !== "undefined" ? document.cookie.match(/(^|; )csrftoken=([^;]+)/) : null;
  return (csrf as any)?.csrfToken || (m ? decodeURIComponent(m[2]) : "");
}

async function postJSON(path: string, body: any): Promise<any> {
  const r = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json", "X-CSRFToken": await csrfToken() },
    body: JSON.stringify(body),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as any)?.message || (d as any)?.detail || `Request failed (${r.status})`);
  return d;
}

async function postForm(path: string, form: FormData): Promise<any> {
  const r = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST", credentials: "include",
    headers: { "X-CSRFToken": await csrfToken() },
    body: form,
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as any)?.message || (d as any)?.detail || `Request failed (${r.status})`);
  return d;
}

const th: React.CSSProperties = { background: "#006699", color: "#fff", fontWeight: "bold", textTransform: "uppercase", fontSize: 11, padding: "6px 8px", whiteSpace: "nowrap" };
const td: React.CSSProperties = { color: "#000066", background: "#fff", fontSize: 11, padding: "5px 8px", borderTop: "1px solid #ddd" };
const inp: React.CSSProperties = { width: "100%", padding: "6px 8px", fontSize: 12, border: "1px solid #ccc", borderRadius: 4 };
const lbl: React.CSSProperties = { fontWeight: "bold", fontSize: 12, color: "#000" };
const btnP: React.CSSProperties = { background: "#337ab7", color: "#fff", border: "1px solid #2e6da4", borderRadius: 4, padding: "6px 14px", fontWeight: "bold", fontSize: 12, cursor: "pointer" };
const btnD: React.CSSProperties = { background: "#d9534f", color: "#fff", border: "1px solid #d43f3a", borderRadius: 4, padding: "6px 14px", fontWeight: "bold", fontSize: 12, cursor: "pointer" };
const btnW: React.CSSProperties = { background: "#f0ad4e", color: "#fff", border: "1px solid #eea236", borderRadius: 4, padding: "6px 14px", fontWeight: "bold", fontSize: 12, cursor: "pointer" };

const ddmmyyyyToISO = (s: string) => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((s || "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};
const isoToDdmmyyyy = (s: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : (s || "");
};
function DateInput({ value, onChange, width }: { value: string; onChange: (s: string) => void; width?: number }) {
  return <input type="date" style={{ ...inp, width: width ?? "100%" }} value={ddmmyyyyToISO(value)} onChange={(e) => onChange(isoToDdmmyyyy(e.target.value))} />;
}
function MonthInput({ value, onChange, width }: { value: string; onChange: (s: string) => void; width?: number }) {
  const m = /^(\d{2})\/(\d{4})$/.exec((value || "").trim());
  return <input type="month" style={{ ...inp, width: width ?? "100%" }} value={m ? `${m[2]}-${m[1]}` : ""}
    onChange={(e) => { const x = /^(\d{4})-(\d{2})$/.exec(e.target.value); onChange(x ? `${x[2]}/${x[1]}` : ""); }} />;
}

function Exports({ id, cols, rows, cell }: { id: string; cols: string[]; rows: Row[]; cell: (r: Row, c: string) => any }) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});
  const [showM, setShowM] = useState(false);
  const vis = cols.filter((c) => !hidden[c]);
  const q = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
  const b: React.CSSProperties = { fontSize: 11, padding: "3px 10px", border: "1px solid #aaa", background: "#f5f5f5", cursor: "pointer", borderRadius: 3 };
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap", position: "relative" }}>
      <button type="button" style={b} onClick={() => {
        const blob = new Blob(["\ufeff" + vis.map(q).join(",") + "\r\n" + rows.map((r) => vis.map((c) => q(cell(r, c))).join(",")).join("\r\n")], { type: "text/csv" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = `${id}.csv`;
        document.body.appendChild(a); a.click(); a.remove();
      }}>csv</button>
      <button type="button" style={b} onClick={() => window.print()}>print</button>
      <button type="button" style={b} onClick={() => {
        navigator.clipboard?.writeText([vis.join("\t"), ...rows.map((r) => vis.map((c) => cell(r, c)).join("\t"))].join("\n")).catch(() => undefined);
      }}>copyHtml5</button>
      <button type="button" style={b} onClick={() => setShowM((s) => !s)}>colvis</button>
      {showM && (
        <div style={{ background: "#fff", border: "1px solid #ccc", padding: 8, position: "absolute", zIndex: 5, top: 26, left: 0 }}>
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

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 6, maxWidth: wide ? 1100 : 700, width: "100%", maxHeight: "85vh", overflow: "auto", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <b style={{ fontSize: 14 }}>{title}</b>
          <button type="button" style={btnD} onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

const TABS = ["Contact Details", "Employee Details", "Family Details", "Bank Account Details", "Personal Details", "Qualification Details", "Rating Details", "Documents", "KRA", "Uniform Details", "Dublicate Id Card"];
const EMP_TYPES = ["Select", "Permanent", "Permanent Reliever", "Reliever", "Staff", "Temporary", "Repair & Maintenance"];
const DEPTS = ["Select", "HR Department", "Admin", "Finance", "Operation", "Sales"];
const INTIMES = ["Flexible", ...Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(1, "0")}:${i % 2 === 0 ? "00" : "30"}`)];

type FormState = Record<string, string>;
const blankForm = (): FormState => ({
  emp_code: "", emp_type: SEL, department: SEL, client: SEL, state: SEL, city: SEL, unit: SEL, grade: SEL,
  id_as_per_dob: "", ihmscode: "", emp_name: "", father_name: "", relation: SEL, birth_date: "", gender: SEL,
  reporting: SEL, role: SEL, working_hours: SEL, intime: "Flexible", email: "", police_station: "",
  police_start: "", police_end: "", rent_start: "", rent_end: "", shiftwise: SEL,
  mobile1: "", mobile2: "", mobile3: "", present_address: "", present_state: SEL, present_city: SEL, present_pin: "",
  perm_address: "", perm_state: SEL, perm_city: SEL, perm_pin: "", perm_mobile1: "", perm_mobile2: "", perm_mobile3: "",
  ref1_name: "", ref1_mobile: "", ref1_email: "", ref1_address: "", ref2_name: "", ref2_mobile: "", ref2_email: "", ref2_address: "",
  confirm_date: "", joining_date: "", location: "", location_city: "", aadhaar: "", pan: "", left_reason: "", left_date: "", reason_update: "",
  fine: "0", advance: "0", bank_holder: "", bank_name: "", bank_branch: "", bank_other_ac: "", bank_ac: "", ifsc: "",
  transfer: SEL, nominee_name: "", nominee_relation: "", nominee_dob: "", nominee_address: "",
  nationality: "INDIAN", identitymark: "", mother_tongue: "", hobbies: "", passport: "", driving: "", weight: "0",
  birth_place: "", language: "", expertise: "", handicap: "", height: "0", mise: "", passport_valid: "", visa_valid: "",
  marital: "", religion: SEL, blood: SEL, visa_country: SEL,
  qual1: "", qual_year1: "", qual2: "", qual_year2: "", qual3: "", qual_year3: "", qual4: "", qual_year4: "", qual5: "", qual_year5: "",
  skill1: "", skill_exp1: "0", skill2: "", skill_exp2: "0", skill3: "", skill_exp3: "0", skill4: "", skill_exp4: "0", skill5: "", skill_exp5: "0",
  kra: "",
});
const famDefaults: Record<string, string> = {};
["Father", "Mother", "Wife", "Husband", "Child", "Child", "Child"].forEach((r, i) => { famDefaults[`fam_rel${i + 1}`] = r; });

function masterToForm(m: Row): FormState {
  const f = blankForm();
  const S = (v: any) => (v === null || v === undefined ? "" : String(v));
  const D = (v: any) => isoToDdmmyyyy(S(v));
  Object.assign(f, {
    emp_code: S(val(m, "EMP_CODE")), emp_name: S(val(m, "EMP_NAME")), father_name: S(val(m, "EMP_FATHER_NAME")),
    relation: S(val(m, "FATHER_RELATION")) || SEL, birth_date: D(val(m, "BIRTH_DATE")), gender: S(val(m, "GENDER")) || SEL,
    joining_date: D(val(m, "JOINING_DATE")), confirm_date: D(val(m, "CONFIRMATION_DATE")), left_date: D(val(m, "LEFT_DATE")),
    left_reason: S(val(m, "LEFT_REASON")), emp_type: S(val(m, "Employee_type")) || SEL, department: S(val(m, "department_type")) || SEL,
    client: S(val(m, "CLIENT_CODE") || val(m, "client_code")) || SEL, unit: S(val(m, "UNIT_CODE") || val(m, "unit_code")),
    state: S(val(m, "client_wise_state")), city: S(val(m, "location")), grade: S(val(m, "GRADE_CODE")) || SEL,
    id_as_per_dob: S(val(m, "Id_as_per_dob")), ihmscode: S(val(m, "ihmscode")), reporting: S(val(m, "reporting_to")) || SEL,
    role: S(val(m, "ROLE")) || SEL, working_hours: S(val(m, "attendance_id")) || SEL, intime: S(val(m, "in_time")) || "Flexible",
    email: S(val(m, "EMP_EMAIL_ID")), police_station: S(val(m, "POLICE_STATION")),
    police_start: D(val(m, "POLICE_VER_START")), police_end: D(val(m, "POLICE_VER_END")),
    rent_start: D(val(m, "RENT_START")), rent_end: D(val(m, "RENT_END")), shiftwise: S(val(m, "SHIFTWISE")) || SEL,
    mobile1: S(val(m, "EMP_MOBILE_NO")), mobile2: S(val(m, "EMP_MOBILE_NO2")), mobile3: S(val(m, "EMP_MOBILE_NO3")),
    present_address: S(val(m, "EMP_CURRENT_ADDRESS")), present_state: S(val(m, "EMP_CURRENT_STATE")) || SEL,
    present_city: S(val(m, "EMP_CURRENT_CITY")) || SEL, present_pin: S(val(m, "EMP_CURRENT_PIN")),
    perm_address: S(val(m, "EMP_PERM_ADDRESS")), perm_state: S(val(m, "EMP_PERM_STATE")) || SEL,
    perm_city: S(val(m, "EMP_PERM_CITY")) || SEL, perm_pin: S(val(m, "EMP_PERM_PIN")),
    perm_mobile1: S(val(m, "EMP_PERM_MOBILE_NO")), perm_mobile2: S(val(m, "EMP_PERM_MOBILE_NO2")), perm_mobile3: S(val(m, "EMP_PERM_MOBILE_NO3")),
    ref1_name: S(val(m, "REFNAME1")), ref1_mobile: S(val(m, "REFMOBILE1")), ref1_email: S(val(m, "REFEMAIL1")), ref1_address: S(val(m, "REFADDRESS1")),
    ref2_name: S(val(m, "REFNAME2")), ref2_mobile: S(val(m, "REFMOBILE2")), ref2_email: S(val(m, "REFEMAIL2")), ref2_address: S(val(m, "REFADDRESS2")),
    aadhaar: S(val(m, "P_TAX_NUMBER")), pan: S(val(m, "PAN_NUMBER")),
    fine: S(val(m, "EMP_FINE") || "0"), advance: S(val(m, "EMP_ADVANCE_PAYMENT") || "0"),
    bank_holder: S(val(m, "BANK_HOLDER") || val(m, "PF_BANK_HOLDER")), bank_name: S(val(m, "PF_BANK_NAME")),
    bank_branch: S(val(m, "BANK_BRANCH")), bank_other_ac: S(val(m, "BANK_OTHER_AC")),
    bank_ac: S(val(m, "BANK_EMP_AC_CODE") || val(m, "original_bank_account_no")), ifsc: S(val(m, "PF_IFSC_CODE")),
    transfer: S(val(m, "TRANSFER_MODE")) || SEL, nominee_name: S(val(m, "PF_NOMINEE_NAME")),
    nominee_relation: S(val(m, "PF_NOMINEE_RELATION")), nominee_dob: D(val(m, "PF_NOMINEE_BDATE")), nominee_address: S(val(m, "NOMINEE_ADDRESS")),
    nationality: S(val(m, "EMP_NATIONALITY")) || "INDIAN", identitymark: S(val(m, "EMP_IDENTITYMARK")),
    mother_tongue: S(val(m, "EMP_MOTHERTONGUE")), hobbies: S(val(m, "EMP_HOBBIES")), passport: S(val(m, "EMP_PASSPORTNUMBER")),
    driving: S(val(m, "EMP_DRIVING_LICENSCE")), weight: S(val(m, "EMP_WEIGHT")) || "0", birth_place: S(val(m, "EMP_PLACE_OF_BIRTH")),
    language: S(val(m, "EMP_LANGUAGE_KNOWN")), expertise: S(val(m, "EMP_AREA_OF_EXPERTISE")), handicap: S(val(m, "EMP_DETAILS_OF_HANDICAP")),
    height: S(val(m, "EMP_HEIGHT")) || "0", mise: S(val(m, "EMP_MISE")), passport_valid: D(val(m, "EMP_PASSPORT_VALIDITY_DATE")),
    visa_valid: D(val(m, "EMP_VISA_VALIDITY_DATE")), marital: S(val(m, "MARITAL_STATUS") || val(m, "EMP_MARRITAL_STATUS")),
    religion: S(val(m, "RELIGION") || val(m, "EMP_RELIGION")) || SEL, blood: S(val(m, "BLOOD_GROUP") || val(m, "EMP_BLOOD_GROUP")) || SEL,
    visa_country: S(val(m, "VISA_COUNTRY")) || SEL, kra: S(val(m, "KRA")),
  });
  for (let i = 1; i <= 5; i++) {
    (f as any)[`qual${i}`] = S(val(m, `QUALIFICATION_${i}`));
    (f as any)[`qual_year${i}`] = S(val(m, `YEAR_OF_PASSING_${i}`));
    (f as any)[`skill${i}`] = S(val(m, `KEY_SKILL_${i}`));
    (f as any)[`skill_exp${i}`] = S(val(m, `EXPERIENCE_MONTH_${i}`)) || "0";
  }
  for (let i = 1; i <= 7; i++) {
    (f as any)[`fam_name${i}`] = S(val(m, `name${i}`));
    (f as any)[`fam_rel${i}`] = S(val(m, `relation${i}`)) || famDefaults[`fam_rel${i}`];
    (f as any)[`fam_dob${i}`] = D(val(m, `dob${i}`));
    (f as any)[`fam_pan${i}`] = S(val(m, `pan${i}`));
    (f as any)[`fam_aadhaar${i}`] = S(val(m, `adhaar${i}`));
    (f as any)[`fam_mobile${i}`] = S(val(m, `fmobile${i}`));
  }
  return f;
}

export default function EmployeeViewDetails() {
  const router = useRouter();
  const [tab, setTab] = useState("Contact Details");
  const [form, setForm] = useState<FormState>(blankForm());
  const [emp, setEmp] = useState("");
  const [clients, setClients] = useState<Opt[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [branches, setBranches] = useState<Opt[]>([]);
  const [grades, setGrades] = useState<Opt[]>([]);
  const [staff, setStaff] = useState<Opt[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [results, setResults] = useState<Row[]>([]);
  const [searched, setSearched] = useState(false);
  const [leftRows, setLeftRows] = useState<Row[]>([]);
  const [showLeft, setShowLeft] = useState(false);
  const [counts, setCounts] = useState<{ by_state: Row[]; roster: Row[] } | null>(null);
  const [aadhaar, setAadhaar] = useState("");
  const [aadhaarState, setAadhaarState] = useState("other_state");
  const [aadhaarRows, setAadhaarRows] = useState<Row[]>([]);
  const [showAadhaar, setShowAadhaar] = useState(false);
  const [uniform, setUniform] = useState<Row[]>([]);
  const [dupid, setDupid] = useState<Row[]>([]);
  const [docs, setDocs] = useState<Record<string, string>>({});
  const [receiver, setReceiver] = useState("0");

  const set = (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const loadDropdowns = async () => {
    try {
      const d = await getJSON<{ clients: Opt[]; grades: Opt[]; staff: Opt[] }>(`${BASE}/legacy-dropdowns/`);
      setClients((d.clients || []).map((r) => ({ code: String(val(r, "code") ?? val(r, "CLIENT_CODE")), name: String(val(r, "name") ?? val(r, "CLIENT_NAME")) })));
      setGrades((d.grades || []).map((r) => ({ code: String(val(r, "code") ?? val(r, "GRADE_CODE")), name: String(val(r, "name") ?? val(r, "GRADE_DESC")) })));
      setStaff((d.staff || []).map((r) => ({ code: String(val(r, "code") ?? val(r, "EMP_CODE")), name: String(val(r, "name") ?? val(r, "EMP_NAME")) })));
    } catch { /* ignore */ }
    try {
      const r = await getJSON<string[]>(`/api/hr/roles/`);
      setRoles(Array.isArray(r) ? r : (r as any).results || []);
    } catch { /* ignore */ }
  };
  useEffect(() => { loadDropdowns(); }, []);

  const changeClient = async (v: string) => {
    setForm((f) => ({ ...f, client: v, state: SEL, city: SEL, unit: SEL }));
    if (!v || v === SEL) { setStates([]); setBranches([]); return; }
    try {
      const d = await getJSON<{ states: string[] }>(`${BASE}/legacy-dropdowns/?client=${encodeURIComponent(v)}`);
      setStates(d.states || []);
    } catch { /* ignore */ }
  };
  const changeState = async (v: string) => {
    setForm((f) => ({ ...f, state: v, city: v, unit: SEL }));
    if (!v || v === SEL) { setBranches([]); return; }
    try {
      const d = await getJSON<{ branches: Opt[] }>(`${BASE}/legacy-dropdowns/?client=${encodeURIComponent(form.client)}&state=${encodeURIComponent(v)}`);
      setBranches((d.branches || []).map((r) => ({ code: String(val(r, "code") ?? val(r, "unit_code")), name: String(val(r, "name") ?? val(r, "UNIT_NAME")) })));
    } catch { /* ignore */ }
  };

  const pickEmp = async (code: string) => {
    if (!code) return;
    setEmp(code);
    try {
      const d = await getJSON<{ master: Row; documents: Row[]; images: Row; login_role: string }>(`${BASE}/legacy-detail/?emp=${encodeURIComponent(code)}`);
      setForm((f) => ({ ...masterToForm(d.master || {}), department: f.department, reason_update: "" }));
      setUniform((d.documents || []).map((r) => ({ type: val(r, "document_type"), sets: val(r, "admin_no_of_set"), size: val(r, "size"), start: val(r, "start_date"), end: val(r, "end_date"), remaining: val(r, "remaining_no_set") })));
      const imgs = d.images || {};
      const files: Record<string, string> = {};
      Object.entries(DOC_SLOT_LABELS).forEach(([slot, cfg]) => { files[slot] = String(val(imgs, cfg.col) || ""); });
      setDocs(files);
      const du = await getJSON<{ results: Row[] }>(`${BASE}/legacy-dupid/?emp=${encodeURIComponent(code)}`).catch(() => ({ results: [] }));
      setDupid(du.results || []);
    } catch (e: any) { alert(e.message); }
  };

  const doSearch = async (left: boolean) => {
    const q = form.emp_name || form.emp_code || "";
    try {
      if (left) {
        const d = await getJSON<{ results: Row[]; message?: string }>(`${BASE}/legacy-left-search/?q=${encodeURIComponent(q)}`);
        if (d.message) alert(d.message);
        setLeftRows(d.results || []); setShowLeft(true);
      } else {
        const d = await getJSON<{ results: Row[] }>(`${BASE}/legacy-search/?q=${encodeURIComponent(q)}`);
        setResults(d.results || []); setSearched(true);
      }
    } catch (e: any) { alert(e.message); }
  };

  const clearAll = () => {
    setForm(blankForm()); setEmp(""); setResults([]); setSearched(false);
    setUniform([]); setDupid([]); setDocs({}); setStates([]); setBranches([]);
  };

  const payload = () => ({
    ...form,
    reporting: form.reporting === SEL ? "" : form.reporting,
    role: form.role === SEL ? "" : form.role,
    uniform: uniform.map((u) => ({ type: u.type, sets: u.sets, size: u.size, start: u.start, end: u.end, remaining: u.remaining })),
  });

  const doSave = async () => {
    try {
      const d = await postJSON(`${BASE}/legacy-save/`, payload());
      alert(d.message + (d.login_setup_token ? `

Login ${d.login_id} created with no password. One-time setup token (shown once, give it to the employee for /password-setup): ${d.login_setup_token}` : ""));
      setEmp(d.emp_code || ""); clearAll();
    } catch (e: any) { alert(e.message); }
  };
  const doUpdate = async () => {
    if (!emp && !form.emp_code) { alert("Please select Employee first !!!"); return; }
    try {
      const d = await postJSON(`${BASE}/legacy-update/`, { ...payload(), emp_code: emp || form.emp_code });
      alert(d.message);
    } catch (e: any) { alert(e.message); }
  };
  const doDelete = async () => {
    const code = emp || form.emp_code;
    if (!code) { alert("Please select Employee first !!!"); return; }
    if (!confirm("Are you Sure You Want to Delete Record")) { alert("Record not Available"); return; }
    try {
      const d = await postJSON(`${BASE}/legacy-delete/`, { emp_code: code });
      alert(d.message); clearAll();
    } catch (e: any) { alert(e.message); }
  };
  const doApprove = async () => {
    const code = emp || form.emp_code;
    if (!code) { alert("Please select Employee first !!!"); return; }
    try {
      const d = await postJSON(`${BASE}/legacy-approve/`, { emp: code });
      alert(d.message);
    } catch (e: any) { alert(e.message); }
  };
  const doLeft = async () => {
    const code = emp || form.emp_code;
    if (!code) { alert("Please select Employee first !!!"); return; }
    const reason = window.prompt("Enter Left Reason:", form.left_reason || "");
    if (reason === null) return;
    const ldate = window.prompt("Enter Left Date (dd/MM/yyyy):", form.left_date || "");
    if (ldate === null) return;
    try {
      const d = await postJSON(`${BASE}/legacy-left/`, { emp: code, reason, date: ldate });
      alert(d.message); pickEmp(code);
    } catch (e: any) { alert(e.message); }
  };
  const doExport = async (kind: string) => {
    try {
      const d = await getJSON<{ results: Row[]; message?: string }>(
        `${BASE}/legacy-export/?kind=${kind}&client=${encodeURIComponent(form.client === SEL ? "" : form.client)}&state=${encodeURIComponent(form.state === SEL ? "" : form.state)}&unit=${encodeURIComponent(form.unit)}`);
      if (d.message) { alert(d.message); return; }
      const rows = d.results || [];
      if (!rows.length) { alert("No Matching Records Found."); return; }
      const cols = Object.keys(rows[0]);
      const q = (s: any) => `"${String(s ?? "").replace(/"/g, '""')}"`;
      const blob = new Blob(["\ufeff" + cols.map(q).join(",") + "\r\n" + rows.map((r) => cols.map((c) => q(val(r, c))).join(",")).join("\r\n")], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `employee_${kind}.csv`;
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e: any) { alert(e.message); }
  };
  const doAadhaarSearch = async () => {
    if (!aadhaar) { alert("Please Enter Adhar Card Number"); return; }
    try {
      const d = await getJSON<{ results: Row[]; message?: string }>(`${BASE}/legacy-rejoin-search/?aadhaar=${encodeURIComponent(aadhaar)}`);
      if (d.message) alert(d.message);
      setAadhaarRows(d.results || []);
    } catch (e: any) { alert(e.message); }
  };
  const doRejoin = async (code: string) => {
    const dt = window.prompt("Enter Rejoin Date (dd/MM/yyyy):", "") ?? "";
    if (!dt) return;
    try {
      const d = await postJSON(`${BASE}/legacy-rejoin/`, { emp: code, date: dt });
      alert(d.message); doAadhaarSearch();
    } catch (e: any) { alert(e.message); }
  };

  const F = (label: string, k: string, opts?: { ro?: boolean; max?: number; type?: string; width?: number }) => (
    <div style={{ minWidth: 150, flex: 1 }}>
      <span style={lbl}>{label} :</span>
      <input style={{ ...inp, width: opts?.width }} value={(form as any)[k] || ""} readOnly={opts?.ro}
        maxLength={opts?.max} type={opts?.type || "text"} onChange={set(k)} />
    </div>
  );
  const S = (label: string, k: string, options: (string | Opt)[], req?: boolean) => (
    <div style={{ minWidth: 150, flex: 1 }}>
      <span style={lbl}>{label} :{req ? " *" : ""}</span>
      <select style={inp} value={(form as any)[k]} onChange={set(k)}>
        {options.map((o) => typeof o === "string"
          ? <option key={o} value={o}>{o}</option>
          : <option key={o.code} value={o.code}>{o.name}</option>)}
      </select>
    </div>
  );
  const DT = (label: string, k: string, req?: boolean) => (
    <div style={{ minWidth: 150, flex: 1 }}>
      <span style={lbl}>{label} :{req ? " *" : ""}</span><br />
      <DateInput value={form[k]} onChange={(v) => setForm((f) => ({ ...f, [k]: v }))} />
    </div>
  );

  return (
    <div style={{ padding: 12, fontFamily: "Verdana", fontSize: 10 }}>
      <div style={{ background: "#f3f1fe", border: "1px solid gray", borderRadius: 4 }}>
        <div style={{ background: "#337ab7", color: "#fff", padding: "10px 14px", borderRadius: "4px 4px 0 0" }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ flex: 1 }}></div>
            <div style={{ flex: 9, textAlign: "center", fontSize: "small", textTransform: "uppercase" }}><b>EMPLOYEE VIEW DETAILS</b></div>
            <div style={{ flex: 2, textAlign: "right", fontSize: 10 }}><span title="Help" style={{ cursor: "help" }}>?</span></div>
          </div>
        </div>
        <div style={{ padding: 12 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
            <span style={lbl}>Receiver Type : *</span>
            <select style={{ ...inp, width: 130 }} value={receiver} onChange={(e) => setReceiver(e.target.value)}><option value="0">Select</option><option value="1">Continue</option><option value="2">Left</option></select>
            <button type="button" style={btnP} onClick={() => router.push("/hr/employees")}>Employee Upload</button>
            <button type="button" style={btnP} onClick={() => doSearch(receiver === "2")}>Search</button>
            <button type="button" style={btnP} onClick={doSave}>Add Employee</button>
            <button type="button" style={btnP} onClick={() => doExport("active")}>Export To Excel</button>
            <button type="button" style={btnP} onClick={() => { doSearch(true); }}>Left Employee</button>
            <button type="button" style={btnP} onClick={() => doExport("remaining")}>Remaining Documents</button>
            <button type="button" style={btnP} onClick={doApprove}>Approval/Rejection</button>
            <button type="button" style={btnP} onClick={() => doExport("dispatch")}>Resend Material</button>
            <button type="button" style={btnP} onClick={() => doExport("uniform")}>Uniform/Shoes/Id Details</button>
            <button type="button" style={btnD} onClick={clearAll}>Close</button>
          </div>
          <div style={{ background: "#fff", borderRadius: 10, padding: 14 }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {F("Employee Code", "emp_code", { ro: true, max: 20 })}
              {S("Employee Type", "emp_type", EMP_TYPES, true)}
              {S("Department Type", "department", DEPTS, true)}
              <div style={{ minWidth: 150, flex: 1 }}><span style={lbl}>Client Name : *</span>
                <select style={inp} value={form.client} onChange={(e) => changeClient(e.target.value)}>
                  <option value={SEL}>{SEL}</option>
                  {clients.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </div>
              <div style={{ minWidth: 150, flex: 1 }}><span style={lbl}>State : *</span>
                <select style={inp} value={form.state} onChange={(e) => changeState(e.target.value)}>
                  <option value="0">Select</option>
                  {states.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div style={{ minWidth: 150, flex: 1 }}><span style={lbl}>Branch Name : *</span>
                <select style={inp} value={form.unit} onChange={set("unit")}>
                  <option value="">{SEL}</option>
                  {branches.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
                </select>
              </div>
              <div style={{ minWidth: 150, flex: 1 }}><span style={lbl}>Designation : *</span>
                <select style={inp} value={form.grade} onChange={set("grade")}>
                  <option value="0">Select</option>
                  {grades.map((g) => <option key={g.code} value={g.code}>{g.name}</option>)}
                </select>
              </div>
              {F("Employee ID As Per DOJ", "id_as_per_dob", { ro: true })}
              {F("IHMS Code", "ihmscode")}
              {F("Employee Name", "emp_name", { max: 50 })}
              {F("Father / Husband Name", "father_name", { max: 50 })}
              {S("Relation", "relation", [SEL, "Father", "Husband"])}
              {DT("Date of Birth", "birth_date", true)}
              {S("Gender", "gender", [{ code: "0", name: "Select" }, { code: "M", name: "Male" }, { code: "F", name: "Female" }], true)}
              <div style={{ minWidth: 150, flex: 1 }}><span style={lbl}>Reporting To :</span>
                <select style={inp} value={form.reporting} onChange={set("reporting")}>
                  <option value="0">Select</option>
                  {staff.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                </select>
              </div>
              <div style={{ minWidth: 150, flex: 1 }}><span style={lbl}>Role : *</span>
                <select style={inp} value={form.role} onChange={set("role")}>
                  <option value={SEL}>{SEL}</option>
                  {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ minWidth: 150, flex: 1 }}><span style={lbl}>Working Hours : *</span>
                <select style={inp} value={form.working_hours} onChange={(e) => {
                  set("working_hours")(e);
                  // legacy txt_workinghours_count: hours must match the branch's designation hours
                  const hv = e.target.value;
                  if (hv && hv !== "0" && form.client !== SEL && form.unit && form.unit !== SEL && form.grade !== SEL) {
                    getJSON<{ match: boolean; message: string }>(`${BASE}/legacy-hours-check/?client=${encodeURIComponent(form.client)}&unit=${encodeURIComponent(form.unit)}&grade=${encodeURIComponent(form.grade)}&hours=${encodeURIComponent(hv)}`)
                      .then((r) => { if (r && r.match === false) window.alert(r.message); }).catch(() => {});
                  }
                }}>
                  <option value="0">Select</option>
                  {["8", "9", "10", "11", "12"].map((w) => <option key={w} value={w}>{w}</option>)}
                </select>
              </div>
              <div style={{ minWidth: 150, flex: 1 }}><span style={lbl}>IN Time :</span>
                <select style={inp} value={form.intime} onChange={set("intime")}>
                  {INTIMES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              {F("Email-Id", "email", { max: 70 })}
              {DT("Police Verification Start Date", "police_start")}
              {DT("Police Verification End Date", "police_end")}
              {DT("Rent Agreement Start Date", "rent_start")}
              {DT("Rent Agreement End Date", "rent_end")}
              {S("Shiftwise Employee", "shiftwise", [SEL, "Regular", "Shiftwise"], true)}
            </div>
            {(searched || showLeft) && (
              <div style={{ marginTop: 12 }}>
                <Exports id="emp-search" cols={["EMP CODE", "NAME", "CLIENT NAME", "STATE NAME", "UNIT NAME", "TYPE", "JOINING DATE"]} rows={showLeft ? leftRows : results}
                  cell={(r, c) => c === "EMP CODE" ? (val(r, "emp_code")) : c === "NAME" ? val(r, "emp_name") : c === "CLIENT NAME" ? val(r, "client_name") : c === "STATE NAME" ? val(r, "state_name") : c === "UNIT NAME" ? val(r, "unit_name") : c === "TYPE" ? val(r, "employee_type") : (val(r, "joining_date") || val(r, "left_date"))} />
                <div style={{ overflow: "auto", maxHeight: 300, border: "1px solid #ccc" }}>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead><tr>{["EMP CODE", "NAME", "CLIENT NAME", "STATE NAME", "UNIT NAME", "TYPE", "JOINING DATE"].map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
                    <tbody>
                      {(showLeft ? leftRows : results).map((r, i) => (
                        <tr key={i} onClick={() => { pickEmp(String(val(r, "emp_code"))); setShowLeft(false); }} style={{ cursor: "pointer" }}>
                          <td style={td}>{val(r, "emp_code")}</td><td style={td}>{val(r, "emp_name")}</td>
                          <td style={td}>{val(r, "client_name")}</td><td style={td}>{val(r, "state_name")}</td>
                          <td style={td}>{val(r, "unit_name")}</td><td style={td}>{val(r, "employee_type")}</td>
                          <td style={td}>{val(r, "joining_date") || val(r, "left_date")}</td>
                        </tr>
                      ))}
                      {(showLeft ? leftRows : results).length === 0 && <tr><td style={td} colSpan={7}>No records</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", marginTop: 12, border: "1px solid #ddd" }}>
        <ul style={{ display: "flex", gap: 2, flexWrap: "wrap", listStyle: "none", margin: 0, padding: 6, background: "#dddddd" }}>
          {TABS.map((t) => (
            <li key={t}>
              <button type="button" onClick={() => setTab(t)}
                style={{ border: "1px solid #bbb", background: tab === t ? "#337ab7" : "#f5f5f5", color: tab === t ? "#fff" : "#000", fontSize: 11, padding: "6px 10px", cursor: "pointer", borderRadius: 3 }}>{t}</button>
            </li>
          ))}
        </ul>
        <div style={{ padding: 14 }}>
          {tab === "Contact Details" && <TabContact form={form} setForm={setForm} />}
          {tab === "Employee Details" && <TabEmployee form={form} setForm={setForm} />}
          {tab === "Family Details" && <TabFamily form={form} setForm={setForm} />}
          {tab === "Bank Account Details" && <TabBank form={form} setForm={setForm} />}
          {tab === "Personal Details" && <TabPersonal form={form} setForm={setForm} />}
          {tab === "Qualification Details" && <TabQualification form={form} setForm={setForm} />}
          {tab === "Rating Details" && <TabRating form={form} setForm={setForm} />}
          {tab === "Documents" && <TabDocuments emp={emp || form.emp_code} docs={docs} setDocs={setDocs} />}
          {tab === "KRA" && <TabKRA form={form} setForm={setForm} />}
          {tab === "Uniform Details" && <TabUniform emp={emp || form.emp_code} uniform={uniform} setUniform={setUniform} />}
          {tab === "Dublicate Id Card" && <TabDupId emp={emp || form.emp_code} form={form} dupid={dupid} setDupid={setDupid} />}
        </div>
        <div style={{ padding: "0 14px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={btnP} onClick={doSave}>Save</button>
          <button type="button" style={btnP} onClick={doUpdate}>Update</button>
          <button type="button" style={btnP} onClick={doDelete}>Delete</button>
          <button type="button" style={btnP} onClick={doApprove}>Approve</button>
          <button type="button" style={btnP} onClick={doLeft}>Left</button>
          <button type="button" style={btnP} onClick={() => setShowAadhaar(true)}>Rejoin</button>
          <button type="button" style={btnP} onClick={() => { setCounts(null); loadCounts(); }}>Counts</button>
          <button type="button" style={btnP} onClick={() => { const c = emp || form.emp_code; if (!c) { alert("Please select Employee first !!!"); return; } void openPrintHtml(`/api/hr/print/id-card/?emp_codes=${encodeURIComponent(c)}`); }}>ID Card</button>
          <button type="button" style={btnP} onClick={() => { const c = emp || form.emp_code; if (!c) { alert("Please select Employee first !!!"); return; } void openPrintHtml(`/api/hr/print/letter/?kind=relieving&emp_codes=${encodeURIComponent(c)}`); }}>Relieving Letter</button>
          <button type="button" style={btnD} onClick={() => router.push("/")}>Close</button>
        </div>
      </div>

      {showAadhaar && (
        <Modal title="Aadhaar Search / Rejoin" onClose={() => setShowAadhaar(false)} wide>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 10, flexWrap: "wrap" }}>
            <div><span style={lbl}>Select State : *</span>
              <select style={{ ...inp, width: 160 }} value={aadhaarState} onChange={(e) => setAadhaarState(e.target.value)}>
                <option value="other_state">Other State</option>
                <option value="northeast">North East</option>
              </select>
            </div>
            {aadhaarState !== "northeast" && (
              <>
                <div><span style={lbl}>Search Adhar Card Number :</span>
                  <input style={{ ...inp, width: 180 }} maxLength={12} value={aadhaar} onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ""))} />
                </div>
                <button type="button" style={btnP} onClick={doAadhaarSearch}>Search</button>
              </>
            )}
          </div>
          {aadhaarRows.length > 0 && (
            <div style={{ overflow: "auto", border: "1px solid #ccc" }}>
              <table style={{ borderCollapse: "collapse", width: "100%" }}>
                <thead><tr>{["LEFT DATE", "EMP CODE", "CLIENT NAME", "STATE NAME", "UNIT NAME", "NAME", "TYPE", "JOINING DATE", ""].map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
                <tbody>
                  {aadhaarRows.map((r, i) => (
                    <tr key={i}>
                      <td style={td}>{val(r, "left_date")}</td><td style={td}>{val(r, "emp_code")}</td>
                      <td style={td}>{val(r, "client_name")}</td><td style={td}>{val(r, "state_name")}</td>
                      <td style={td}>{val(r, "unit_name")}</td><td style={td}>{val(r, "emp_name")}</td>
                      <td style={td}>{val(r, "employee_type")}</td><td style={td}>{val(r, "joining_date")}</td>
                      <td style={td}><button type="button" style={{ color: "#337ab7", background: "none", border: "none", cursor: "pointer", fontSize: 11 }} onClick={() => doRejoin(String(val(r, "emp_code")))}>Rejoin</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
      {counts && <CountsModal counts={counts} onClose={() => setCounts(null)} />}
    </div>
  );

  async function loadCounts() {
    try {
      const d = await getJSON<{ by_state: Row[]; roster: Row[] }>(`${BASE}/legacy-counts/`);
      setCounts(d);
    } catch (e: any) { alert(e.message); }
  }
}

/* ================= Tabs: Contact / Employee / Family / Bank / Personal / Qualification ================= */
type TabProps = { form: FormState; setForm: React.Dispatch<React.SetStateAction<FormState>> };
const upd = (setForm: TabProps["setForm"]) => (k: string) => (e: any) => setForm((f) => ({ ...f, [k]: e.target.value }));
const updv = (setForm: TabProps["setForm"]) => (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

function Field({ label, k, form, setForm, opts }: { label: string; k: string; form: FormState; setForm: TabProps["setForm"]; opts?: { ro?: boolean; max?: number; multi?: boolean; rows?: number } }) {
  return (
    <div style={{ minWidth: 160, flex: 1 }}>
      <span style={lbl}>{label} :</span>
      {opts?.multi
        ? <textarea style={inp} rows={opts.rows || 2} maxLength={opts?.max} value={form[k] || ""} onChange={upd(setForm)(k)} />
        : <input style={inp} maxLength={opts?.max} readOnly={opts?.ro} value={form[k] || ""} onChange={upd(setForm)(k)} />}
    </div>
  );
}
function Sel({ label, k, form, setForm, options }: { label: string; k: string; form: FormState; setForm: TabProps["setForm"]; options: string[] }) {
  return (
    <div style={{ minWidth: 160, flex: 1 }}>
      <span style={lbl}>{label} :</span>
      <select style={inp} value={form[k] || SEL} onChange={upd(setForm)(k)}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
function DateF({ label, k, form, setForm }: { label: string; k: string; form: FormState; setForm: TabProps["setForm"] }) {
  return (
    <div style={{ minWidth: 160, flex: 1 }}>
      <span style={lbl}>{label} :</span><br />
      <DateInput value={form[k] || ""} onChange={(v) => updv(setForm)(k, v)} />
    </div>
  );
}

function useStateCity() {
  const [states, setStates] = useState<string[]>([SEL]);
  const [cities, setCities] = useState<Record<string, string[]>>({});
  useEffect(() => {
    getJSON<{ states: string[]; cities: Record<string, string[]> }>(`/api/masters/states/lookup/`)
      .then((d) => { setStates([SEL, ...[...(d.states || [])].sort()]); setCities(d.cities || {}); })
      .catch(() => undefined);
  }, []);
  return { states, cities };
}

function TabContact({ form, setForm }: TabProps) {
  const { states, cities } = useStateCity();
  const cityOpts = (st: string) => [SEL, ...(cities[st] || [])];
  const copyAddr = () => {
    if (!form.present_address) { alert("Please Enter Present Address"); return; }
    setForm((f) => ({ ...f, perm_address: f.present_address, perm_state: f.present_state, perm_city: f.present_city, perm_pin: f.present_pin, perm_mobile1: f.mobile1, perm_mobile2: f.mobile2, perm_mobile3: f.mobile3 }));
  };
  return (
    <div>
      <button type="button" style={btnW} onClick={copyAddr}>Copy Present Address</button>
      <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: 13 }}>Present</h4>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Field label="Present Address *" k="present_address" form={form} setForm={setForm} opts={{ max: 225 }} />
            <Sel label="State *" k="present_state" form={form} setForm={setForm} options={states} />
            <Sel label="Present City *" k="present_city" form={form} setForm={setForm} options={cityOpts(form.present_state)} />
            <Field label="Pin code" k="present_pin" form={form} setForm={setForm} opts={{ max: 6 }} />
            <Field label="Mobile Number1 *" k="mobile1" form={form} setForm={setForm} opts={{ max: 10 }} />
            <Field label="Mobile Number2" k="mobile2" form={form} setForm={setForm} opts={{ max: 10 }} />
            <Field label="Mobile Number3" k="mobile3" form={form} setForm={setForm} opts={{ max: 10 }} />
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <h4 style={{ fontSize: 13 }}>Permanent</h4>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <Field label="Permanant Address" k="perm_address" form={form} setForm={setForm} opts={{ max: 225 }} />
            <Sel label="State" k="perm_state" form={form} setForm={setForm} options={states} />
            <Sel label="Permanant City" k="perm_city" form={form} setForm={setForm} options={cityOpts(form.perm_state)} />
            <Field label="Pincode" k="perm_pin" form={form} setForm={setForm} opts={{ max: 6 }} />
            <Field label="Mobile Number1" k="perm_mobile1" form={form} setForm={setForm} opts={{ max: 10 }} />
            <Field label="Mobile Number2" k="perm_mobile2" form={form} setForm={setForm} opts={{ max: 10 }} />
            <Field label="Mobile Number3" k="perm_mobile3" form={form} setForm={setForm} opts={{ max: 10 }} />
          </div>
        </div>
      </div>
      <h4 style={{ fontSize: 13, marginTop: 12 }}>Reference Details</h4>
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Field label="Contact Name 1" k="ref1_name" form={form} setForm={setForm} opts={{ max: 30 }} />
          <Field label="Mobile No 1" k="ref1_mobile" form={form} setForm={setForm} opts={{ max: 10 }} />
          <Field label="Email Id 1" k="ref1_email" form={form} setForm={setForm} opts={{ max: 200 }} />
          <Field label="Address 1" k="ref1_address" form={form} setForm={setForm} opts={{ multi: true, rows: 6, max: 200 }} />
        </div>
        <div style={{ flex: 1, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Field label="Contact Name 2" k="ref2_name" form={form} setForm={setForm} opts={{ max: 50 }} />
          <Field label="Mobile No 2" k="ref2_mobile" form={form} setForm={setForm} opts={{ max: 10 }} />
          <Field label="Email Id 2" k="ref2_email" form={form} setForm={setForm} opts={{ max: 50 }} />
          <Field label="Address 2" k="ref2_address" form={form} setForm={setForm} opts={{ multi: true, rows: 6, max: 200 }} />
        </div>
      </div>
    </div>
  );
}

function TabEmployee({ form, setForm }: TabProps) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <DateF label="Confirmation Date" k="confirm_date" form={form} setForm={setForm} />
      <DateF label="Joining Date *" k="joining_date" form={form} setForm={setForm} />
      <Field label="Working State *" k="location" form={form} setForm={setForm} opts={{ max: 50 }} />
      <Field label="Working City *" k="location_city" form={form} setForm={setForm} opts={{ max: 50 }} />
      <Field label="Police Station Name" k="police_station" form={form} setForm={setForm} opts={{ max: 225 }} />
      <Field label="Aadhar Card / Enrollment No *" k="aadhaar" form={form} setForm={setForm} opts={{ ro: true, max: 12 }} />
      <Field label="PAN Number *" k="pan" form={form} setForm={setForm} />
      <Field label="Reason For Resign" k="left_reason" form={form} setForm={setForm} />
      <Field label="Reason For Updation *" k="reason_update" form={form} setForm={setForm} />
      <DateF label="Left Date" k="left_date" form={form} setForm={setForm} />
    </div>
  );
}

function TabFamily({ form, setForm }: TabProps) {
  const rels = ["Father", "Mother", "Wife", "Husband", "Child", "Child", "Child"];
  return (
    <div>
      <div style={{ maxWidth: 220, marginBottom: 10 }}>
        <span style={lbl}>Number of Child :</span>
        <input style={inp} value={form.child_count || ""} onChange={(e) => setForm((f) => ({ ...f, child_count: e.target.value }))} />
      </div>
      <div style={{ overflow: "auto" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr>{["Name", "Relation", "DOB", "PAN No", "Aadhar No", "Mobile No"].map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <tr key={i}>
                <td style={td}><input style={inp} value={(form as any)[`fam_name${i}`] || ""} readOnly={i === 1 || i === 4} onChange={(e) => setForm((f) => ({ ...f, [`fam_name${i}`]: e.target.value }))} /></td>
                <td style={td}><input style={inp} value={(form as any)[`fam_rel${i}`] || rels[i - 1]} readOnly={i <= 4} onChange={(e) => setForm((f) => ({ ...f, [`fam_rel${i}`]: e.target.value }))} /></td>
                <td style={td}><DateInput value={(form as any)[`fam_dob${i}`] || ""} onChange={(v) => setForm((f) => ({ ...f, [`fam_dob${i}`]: v }))} /></td>
                <td style={td}><input style={inp} value={(form as any)[`fam_pan${i}`] || ""} onChange={(e) => setForm((f) => ({ ...f, [`fam_pan${i}`]: e.target.value }))} /></td>
                <td style={td}><input style={inp} value={(form as any)[`fam_aadhaar${i}`] || ""} onChange={(e) => setForm((f) => ({ ...f, [`fam_aadhaar${i}`]: e.target.value }))} /></td>
                <td style={td}><input style={inp} value={(form as any)[`fam_mobile${i}`] || ""} onChange={(e) => setForm((f) => ({ ...f, [`fam_mobile${i}`]: e.target.value }))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabBank({ form, setForm }: TabProps) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <Field label="Bank Account Holder Name *" k="bank_holder" form={form} setForm={setForm} />
      <Field label="Bank Name" k="bank_name" form={form} setForm={setForm} />
      <Field label="Branch Location Name" k="bank_branch" form={form} setForm={setForm} />
      <Field label="Other Bank A/C Number" k="bank_other_ac" form={form} setForm={setForm} />
      <Field label="Original Bank A/C Number *" k="bank_ac" form={form} setForm={setForm} />
      <Field label="IFSC Code *" k="ifsc" form={form} setForm={setForm} />
      <Sel label="NFD/IFD *" k="transfer" form={form} setForm={setForm} options={["Select Transfer", "NEFT TRANSFER", "INTERNAL TRANSFER"]} />
      <Field label="Nominee Name" k="nominee_name" form={form} setForm={setForm} />
      <Field label="Nominee Relation" k="nominee_relation" form={form} setForm={setForm} />
      <DateF label="Nominee Birth Date" k="nominee_dob" form={form} setForm={setForm} />
      <Field label="Nominee Address" k="nominee_address" form={form} setForm={setForm} />
    </div>
  );
}

function TabPersonal({ form, setForm }: TabProps) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
      <Field label="Nationality *" k="nationality" form={form} setForm={setForm} />
      <Field label="Identitymark" k="identitymark" form={form} setForm={setForm} />
      <Field label="Mother Tongue" k="mother_tongue" form={form} setForm={setForm} />
      <Field label="Hobbies" k="hobbies" form={form} setForm={setForm} />
      <Field label="Passport No" k="passport" form={form} setForm={setForm} />
      <Field label="Driving Licence No" k="driving" form={form} setForm={setForm} />
      <Field label="Weight (in Kg)" k="weight" form={form} setForm={setForm} />
      <Field label="Place Of Birth" k="birth_place" form={form} setForm={setForm} />
      <Field label="Language Known" k="language" form={form} setForm={setForm} />
      <Field label="Area Of Expertise" k="expertise" form={form} setForm={setForm} />
      <Field label="Details Of Handicap" k="handicap" form={form} setForm={setForm} />
      <Field label="Height (in Feets)" k="height" form={form} setForm={setForm} />
      <Sel label="Marital Status" k="marital" form={form} setForm={setForm} options={["Select", "Married", "UnMarried"]} />
      <Sel label="Religion" k="religion" form={form} setForm={setForm} options={[SEL, "General", "OBC", "SC", "ST", "NT", "Other"]} />
      <Sel label="Blood Group" k="blood" form={form} setForm={setForm} options={[SEL, "A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"]} />
      <Sel label="Visa(Country)" k="visa_country" form={form} setForm={setForm} options={[SEL, "Indian", "USA", "LANDON", "CANADA"]} />
    </div>
  );
}

function TabQualification({ form, setForm }: TabProps) {
  return (
    <div style={{ display: "flex", gap: 24 }}>
      <div style={{ flex: 1, display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <React.Fragment key={i}>
            <Field label={`Qualification${i}`} k={`qual${i}`} form={form} setForm={setForm} />
            <Field label="Year of passing" k={`qual_year${i}`} form={form} setForm={setForm} />
          </React.Fragment>
        ))}
      </div>
      <div style={{ flex: 1, display: "flex", gap: 12, flexWrap: "wrap" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <React.Fragment key={i}>
            <Field label={`Key Skill${i}`} k={`skill${i}`} form={form} setForm={setForm} />
            <Field label="Experience in months" k={`skill_exp${i}`} form={form} setForm={setForm} />
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
/*__PART4__*/


function CountsModal({ counts, onClose }: { counts: { by_state: Row[]; roster: Row[] }; onClose: () => void }) {
  return (
    <Modal title="Employee Counts" onClose={onClose} wide>
      <h4 style={{ fontSize: 13 }}>State / Branch / Permanent Count</h4>
      <div style={{ overflow: "auto", maxHeight: 250, border: "1px solid #ccc", marginBottom: 12 }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr>{["State Name", "Branch Name", "Permanent Employee count"].map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
          <tbody>
            {counts.by_state.map((r, i) => (
              <tr key={i}><td style={td}>{val(r, "state_name")}</td><td style={td}>{val(r, "unit_name")}</td><td style={td}>{val(r, "permanent")}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
      <h4 style={{ fontSize: 13 }}>Roster</h4>
      <div style={{ overflow: "auto", maxHeight: 250, border: "1px solid #ccc" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr>{["Employee Name", "State Name", "Branch Name", "Employee type", "BIRTH DATE"].map((c) => <th key={c} style={th}>{c}</th>)}</tr></thead>
          <tbody>
            {counts.roster.map((r, i) => (
              <tr key={i}><td style={td}>{val(r, "emp_name")}</td><td style={td}>{val(r, "state_name")}</td><td style={td}>{val(r, "unit_name")}</td><td style={td}>{val(r, "employee_type")}</td><td style={td}>{val(r, "birth")}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

const DOC_SLOT_LABELS: Record<string, { label: string; col: string; fallback: string }> = {
  photo_upload: { label: "Duplicate Photo(Passport Size)", col: "EMP_PHOTO", fallback: "photo" },
  originalphoto: { label: "Original Photo(Passport Size)", col: "original_photo", fallback: "photo" },
  bank_upload: { label: "Duplicate Aadhar Card", col: "EMP_BANK_STATEMENT", fallback: "aadhar" },
  original_adharcard_upload: { label: "Original Aadhar Card", col: "original_adhar_card", fallback: "aadhar" },
  Police_document: { label: "Duplicate Police Verification Document", col: "POLICE_VERIFICATION_DOC", fallback: "police" },
  original_police_document: { label: "Original Police Verification Document", col: "original_policy_document", fallback: "police" },
  Address_Proof: { label: "Duplicate Proof of Present Address", col: "present_add_proof", fallback: "address" },
  original_Address_Proof: { label: "Original Proof of Present Address", col: "original_address_proof", fallback: "address" },
  Passport_upload: { label: "Passport", col: "EMP_PASSPORT", fallback: "passport" },
  emp_signature: { label: "Joining Kit", col: "emp_signature", fallback: "kit" },
  Tenth_Marksheet_upload: { label: "10th Marksheet", col: "EMP_10TH_MARKSHEET", fallback: "marksheet" },
  Formno_11: { label: "Form No 11", col: "FormNo_11", fallback: "form11" },
  Diploma_upload: { label: "Diploma Certificate", col: "EMP_DIPLOMA_CERTIFICATE", fallback: "diploma" },
  Formno_2: { label: "Form No 2", col: "FormNo_2", fallback: "form2" },
  Post_Graduation_upload: { label: "Post Graduation Certificate", col: "EMP_POST_GRADUATION_CERTIFICATE", fallback: "pg" },
  bank_passbook: { label: "Bank Passbook", col: "bank_passbook", fallback: "passbook" },
  Degree_upload: { label: "Degree Certificate", col: "EMP_DEGREE_CERTIFICATE", fallback: "degree" },
  Driving_Liscence_upload: { label: "Driving Liscence", col: "EMP_DRIVING_LISCENCE", fallback: "driving" },
  noc_form: { label: "NOC Form", col: "noc_form", fallback: "noc" },
  Education_4_upload: { label: "Education Certificate", col: "EMP_EDUCATION_CERTIFICATE", fallback: "education" },
  adhar_pan_upload: { label: "Pan Card", col: "EMP_ADHAR_PAN", fallback: "pan" },
  biodata_upload: { label: "Biodata", col: "EMP_BIODATA", fallback: "biodata" },
  medical_form: { label: "Medical Document", col: "medical_form", fallback: "medical" },
  Twelve_Marksheet_upload: { label: "12th Marksheet", col: "EMP_12TH_MARKSHEET", fallback: "marksheet" },
  itc_upload_form: { label: "TIC Document", col: "itc_upload_form", fallback: "tic" },
};
const ph = (txt: string) => `https://via.placeholder.com/100?text=${encodeURIComponent(txt)}`;

function TabRating({ form, setForm }: TabProps) {
  return (
    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", maxWidth: 500 }}>
      <Field label="Fine" k="fine" form={form} setForm={setForm} opts={{ max: 7 }} />
      <Field label="Advance" k="advance" form={form} setForm={setForm} />
    </div>
  );
}

function TabDocuments({ emp, docs, setDocs }: { emp: string; docs: Record<string, string>; setDocs: React.Dispatch<React.SetStateAction<Record<string, string>>> }) {
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [zoom, setZoom] = useState<string | null>(null);
  if (!emp) return <p style={{ fontSize: 12 }}>Please select Employee first !!!</p>;
  const uploadOne = async (slot: string) => {
    const f = files[slot];
    if (!f) { alert("Please select file !!!"); return; }
    if (slot === "originalphoto" && !/\.jpg$/i.test(f.name)) { alert("Please select only JPG Photo !!!"); return; }
    const fd = new FormData();
    fd.append("emp", emp); fd.append("slot", slot); fd.append("file", f);
    try {
      const d = await postForm(`${BASE}/legacy-upload/`, fd);
      alert(d.message); setDocs((p) => ({ ...p, [slot]: d.file }));
      setFiles((p) => ({ ...p, [slot]: null }));
    } catch (e: any) { alert(e.message); }
  };
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
        {Object.entries(DOC_SLOT_LABELS).map(([slot, cfg]) => {
          const cur = docs[slot];
          const src = cur ? `${API_BASE_URL}/api/hr/employee-details/legacy-file/?inline=1&name=${encodeURIComponent(cur)}` : ph(cfg.fallback);
          return (
            <div key={slot} style={{ border: "1px solid #ddd", borderRadius: 6, padding: 10 }}>
              <b style={{ fontSize: 12 }}>{cfg.label} :</b>
              <div style={{ margin: "6px 0" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={cfg.label} width={100} height={100} style={{ cursor: "pointer", objectFit: "cover", border: "1px solid #ccc" }}
                  onClick={() => cur && setZoom(src)} onError={(e) => { (e.target as HTMLImageElement).src = ph(cfg.fallback); }} />
              </div>
              <input type="file" accept=".jpg,.jpeg,.png,.pdf" onChange={(e) => setFiles((p) => ({ ...p, [slot]: e.target.files?.[0] || null }))} />
              <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                <button type="button" style={btnP} onClick={() => uploadOne(slot)}>Upload</button>
                {cur && <a href={`${API_BASE_URL}/api/hr/employee-details/legacy-file/?name=${encodeURIComponent(cur)}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, alignSelf: "center" }}>Download</a>}
              </div>
            </div>
          );
        })}
      </div>
      <p style={{ fontSize: 11, marginTop: 8 }}>Only JPG , PNG , PDF</p>
      {zoom && (
        <div onClick={() => setZoom(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="" style={{ maxWidth: "80vw", maxHeight: "80vh", background: "#fff", padding: 4 }} />
        </div>
      )}
    </div>
  );
}

function TabKRA({ form, setForm }: TabProps) {
  return (
    <div style={{ maxWidth: 600 }}>
      <span style={lbl}>Key Responsibility Area :</span>
      <textarea style={inp} rows={6} value={form.kra || ""} onChange={(e) => setForm((f) => ({ ...f, kra: e.target.value }))} />
    </div>
  );
}

const UNI_DESIG = ["Select", "Housekeeping", "Security_Guard", "Common"];
const UNI_TYPES = ["Select", "Uniform", "Shoes", "Sweater", "ID_Card", "Raincoat", "Torch", "Whistle", "Baton", "Belt", "Pantry_Jacket", "Apron"];
const UNI_SETS = ["Select", "0", "1", "2"];

function TabUniform({ emp, uniform, setUniform }: { emp: string; uniform: Row[]; setUniform: React.Dispatch<React.SetStateAction<Row[]>> }) {
  const [desig, setDesig] = useState(SEL);
  const [ptype, setPtype] = useState(SEL);
  const [sets, setSets] = useState(SEL);
  const [size, setSize] = useState("");
  const [sizes, setSizes] = useState<string[]>([]);
  const [issue, setIssue] = useState("");
  const [expiry, setExpiry] = useState("");
  const needSize = !["ID_Card", "Torch", "Baton", "Belt"].includes(ptype);

  useEffect(() => {
    if (ptype === "Uniform") setSizes(["S", "M", "L", "XL", "XXL"]);
    else if (ptype === "Shoes") setSizes(["6", "7", "8", "9", "10", "11"]);
    else if (ptype === "Sweater" || ptype === "Pantry_Jacket" || ptype === "Apron" || ptype === "Raincoat") setSizes(["S", "M", "L", "XL", "XXL"]);
    else setSizes([]);
    setSize("");
  }, [ptype]);

  const add = () => {
    if (!desig || desig === SEL) { alert("Please Select Designation"); return; }
    if (!ptype || ptype === SEL) { alert("Please Select Type"); return; }
    if (!sets || sets === SEL) { alert("Please Select Number Of Set"); return; }
    if (needSize && !size) { alert("Please Select Size"); return; }
    if (!issue) { alert("Please Select Issuing Date"); return; }
    if (!expiry) { alert("Please Select Expiry Date"); return; }
    if (uniform.some((u) => u.type === ptype)) { alert("Same Type Already Inserted!!"); return; }
    setUniform((u) => [...u, { type: ptype, sets, size: needSize ? size : "", start: issue, end: expiry, remaining: sets }]);
    setPtype(SEL); setSets(SEL); setSize(""); setIssue(""); setExpiry("");
  };
  const removeRow = async (t: string) => {
    setUniform((u) => u.filter((x) => x.type !== t));
    if (emp) {
      try { await postJSON(`${BASE}/legacy-uniform-delete/`, { emp, type: t }); } catch { /* local-only ok */ }
    }
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
        <div style={{ minWidth: 150, flex: 1 }}><span style={lbl}>Select Designation :</span>
          <select style={inp} value={desig} onChange={(e) => setDesig(e.target.value)}>
            {UNI_DESIG.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 150, flex: 1 }}><span style={lbl}>Select Type :</span>
          <select style={inp} value={ptype} onChange={(e) => setPtype(e.target.value)}>
            {UNI_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 130, flex: 1 }}><span style={lbl}>Number Of Set :</span>
          <select style={inp} value={sets} onChange={(e) => setSets(e.target.value)}>
            {UNI_SETS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        {needSize && (
          <div style={{ minWidth: 130, flex: 1 }}><span style={lbl}>Size :</span>
            <select style={inp} value={size} onChange={(e) => setSize(e.target.value)}>
              <option value="">Select</option>
              {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}
        <div><span style={lbl}>Issuing Date :</span><br /><DateInput value={issue} onChange={setIssue} width={150} /></div>
        <div><span style={lbl}>Expiry Date :</span><br /><DateInput value={expiry} onChange={setExpiry} width={150} /></div>
        <button type="button" style={btnP} onClick={add}>Add</button>
      </div>
      <div style={{ overflow: "auto", border: "1px solid #ccc" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><th style={th}></th><th style={th}>Sr No.</th><th style={th}>Type</th><th style={th}>Number Of Set</th><th style={th}>Size</th><th style={th}>Issue Date</th><th style={th}>Expiry Date</th><th style={th}>Remainig Number Of Set</th></tr></thead>
          <tbody>
            {uniform.map((r, i) => (
              <tr key={i}>
                <td style={td}><button type="button" style={{ color: "#c00", background: "none", border: "none", cursor: "pointer" }} onClick={() => removeRow(String(r.type))}>x</button></td>
                <td style={td}>{i + 1}</td><td style={td}>{r.type}</td><td style={td}>{r.sets}</td>
                <td style={td}>{r.size}</td><td style={td}>{r.start}</td><td style={td}>{r.end}</td><td style={td}>{r.remaining}</td>
              </tr>
            ))}
            {uniform.length === 0 && <tr><td style={td} colSpan={8}>No records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TabDupId({ emp, form, dupid, setDupid }: { emp: string; form: FormState; dupid: Row[]; setDupid: React.Dispatch<React.SetStateAction<Row[]>> }) {
  const [sets, setSets] = useState("0");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const reload = async () => {
    if (!emp) return;
    try {
      const d = await getJSON<{ results: Row[] }>(`${BASE}/legacy-dupid/?emp=${encodeURIComponent(emp)}`);
      setDupid(d.results || []);
    } catch { /* ignore */ }
  };
  const add = async () => {
    if (!sets || sets === "0" || sets === SEL) { alert("Please Select Number Of Set"); return; }
    if (!from) { alert("Please Select Issuing Date"); return; }
    if (!to) { alert("Please Select Expiry Date"); return; }
    try {
      const d = await postJSON(`${BASE}/legacy-dupid-add/`, {
        client: form.client === SEL ? "" : form.client, state: form.state === SEL ? "" : form.state,
        unit: form.unit, emp, sets, from, to,
      });
      alert(d.message); setSets("0"); setFrom(""); setTo(""); reload();
    } catch (e: any) { alert(e.message); }
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 10 }}>
        <div style={{ minWidth: 150, flex: 1 }}><span style={lbl}>Number Of Set :</span>
          <select style={inp} value={sets} onChange={(e) => setSets(e.target.value)}>
            <option value="0">Select</option><option value="1">1</option>
          </select>
        </div>
        <div><span style={lbl}>Issuing Date :</span><br /><DateInput value={from} onChange={setFrom} width={150} /></div>
        <div><span style={lbl}>Expiry Date :</span><br /><DateInput value={to} onChange={setTo} width={150} /></div>
        <button type="button" style={btnP} onClick={add}>Add</button>
      </div>
      <div style={{ overflow: "auto", border: "1px solid #ccc" }}>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead><tr><th style={th}></th><th style={th}>Sr No.</th><th style={th}>id</th><th style={th}>Number Of Set</th><th style={th}>ISSUE DATE</th><th style={th}>EXPIRY DATE</th></tr></thead>
          <tbody>
            {dupid.map((r, i) => (
              <tr key={i}>
                <td style={td}></td><td style={td}>{i + 1}</td><td style={td}>{val(r, "id")}</td>
                <td style={td}>{val(r, "admin_id_set")}</td><td style={td}>{val(r, "from")}</td><td style={td}>{val(r, "to")}</td>
              </tr>
            ))}
            {dupid.length === 0 && <tr><td style={td} colSpan={6}>No records</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
