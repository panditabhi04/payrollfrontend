"use client";

// Legacy CompanyMaster.aspx — "COMPANY MASTER". Exact 1:1 port.
//
// Same panel-primary headings (COMPANY MASTER + help icon, Company Master
// Details), reason-for-updation panel, core form with red * markers, company
// logo block (JPG/PNG note), the 12-tab strip (Files, ESIC, LWF, PF, Bank
// Details, Offices, Info, GST Info, SAC Code Details, Reminder Email Id's,
// Mini Bank Other, Digital Signature) with every entry row + grid, the exact
// validation alerts (Req_validation / req_vali / save_validate* /
// lwf_validation / Req_gstvalidation / pincode_validation / R_validation),
// Save / Update / Delete / Clear / Close buttons and the 13-column company
// grid with click-to-load (core + logo + portal + reason history + all child
// grids + images + reminders).
//
// Persistence (all real, comp-scoped by the form's company):
//   core + logo + PFX      -> /api/masters/companies (multipart on save/update)
//   child grids            -> staged in state, bulk-saved with the company
//                            (delete+reinsert per type, exactly like legacy)
//   Files tab              -> /api/masters/company-images (upload/download/delete)
//   Reminder Email Id's    -> staged 6 dept rows incl. Password, bulk-saved
//                            (password Fernet-encrypted at rest, never shown;
//                            a blank box on update keeps the stored password)
// Password boxes always load blank (never cached into the form): a fresh add
// starts empty, and on edit a blank box keeps the stored (cached) secret —
// only a typed value overwrites it.
// Approval chain: when the saving login's role has an approval level, Save /
// Update is staged (HTTP 202) for the reporting managers; the "Approval
// Requests" panel below (legacy GridView1 + Approve / Reject, GridView2 log)
// lets the next approver approve or reject it.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getMe, type Me } from "@/lib/api/auth";
import { API_BASE_URL } from "@/lib/api/client";
import { listItems, deleteItem } from "@/lib/api/crud";
import { levelForMenu, errMsg, type Opt } from "@/components/formkit";
import DataTable from "@/components/DataTable";
import PasswordInput from "@/components/PasswordInput";
import "./CompanyMaster.css";

const BASE = "/api/masters/companies";
const ZONE = "/api/masters/company-zone-rows";
const IMG = "/api/masters/company-images";
const MENU = "Company Master";

const PAYPRO = [{ v: "Disable", t: "Disable" }, { v: "Enable", t: "Enable" }];
// Legacy ddl_e_invoicing ListItems: Value 0/YES/NO, Text Select/YES/NO.
const EINV = [{ v: "0", t: "Select" }, { v: "YES", t: "YES" }, { v: "NO", t: "NO" }];
const DS = [{ v: "0", t: "Select" }, { v: "1", t: "Applicable" }, { v: "2", t: "Not Applicable" }];
const REMINDER_DEPTS = ["Admin", "Account", "Manager", "Legal", "Invoice/Finance", "Operation"];

type Tab = "home" | "menu1" | "menu10" | "menu2" | "menu3" | "menu4" | "menu5" | "item7" | "item8" | "item9" | "item11" | "item12";
const TABS: { id: Tab; label: string }[] = [
  { id: "home", label: "Files" },
  { id: "menu1", label: "ESIC" },
  { id: "menu10", label: "LWF" },
  { id: "menu2", label: "PF" },
  { id: "menu3", label: "Bank Details" },
  { id: "menu4", label: "Offices" },
  { id: "menu5", label: "Info" },
  { id: "item7", label: "GST Info" },
  { id: "item8", label: "SAC Code Details" },
  { id: "item9", label: "Reminder Email Id's" },
  { id: "item11", label: "Mini Bank Other" },
  { id: "item12", label: "Digital Signature" },
];

// Legacy key filters (exact char sets).
const alphaAddr = (v: string) => v.replace(/[^A-Za-z0-9 &,\-./:;=?\\]/g, "");
const alphaAddr1 = (v: string) => v.replace(/[^A-Za-z0-9 &,\-./:;=?\\@#*]/g, "");
const alphaNum = (v: string) => v.replace(/[*#@$%]/g, ""); // AllowAlphabet_Number blocks only * # @ $ %
const alphaNumSlash = (v: string) => v.replace(/[^A-Za-z0-9 \t/-]/g, "");
const alphaNumSpace = (v: string) => v.replace(/[^A-Za-z0-9 ]/g, "");
const alphaOnly = (v: string) => v.replace(/[^A-Za-z]/g, "");
const seriesKeys = (v: string) => v.replace(/[^A-Za-z. \-]/g, "");
const websiteKeys = (v: string) => v.replace(/[^A-Za-z0-9 \t./]/g, "");
const emailKeys = (v: string) => v.replace(/[^A-Za-z0-9 \t@.]/g, "");
const onlyNum = (v: string) => v.replace(/[^0-9]/g, "");

interface Co {
  id: number; comp_code: string; company_name: string; city: string; state: string;
  pf_reg_no: string; pf_reg_office: string; company_pan_no: string; company_tan_no: string;
  service_tax_reg_no: string; emp_series_init: string; company_website: string;
  company_contact_no: string; company_cin_no: string;
}
interface EsicRow { state: string; address: string; code: string }
interface LwfRow { state: string; number: string; date: string; address: string }
interface BankRow { name: string; account: string; ifsc: string }
interface BranchRow { type: string; address: string; contact: string; start: string; end: string }
interface GstRow { state: string; address: string; gstin: string }
interface MiniRow { description: string }
interface ReminderRow {
  department: string; email: string; password: string; contact_name: string;
  designation: string; mobile: string; to_addr: string; cc: string; bcc: string;
}
interface ImgRow {
  id: number; description: string; file_name: string; file_url: string;
  start_date: string; end_date: string;
}

type Form = Record<string, string>;
const EMPTY: Form = {
  comp_code: "", company_name: "", address1: "", address2: "", emp_series_init: "", company_short_name: "",
  state: "Select", city: "Select", pin: "", admin_user_id: "", admin_password: "",
  file_no: "", paypro_no: "Disable", e_invoice_applicable: "0",
  portal_id: "", portal_password: "",
  pf_reg_no: "", pf_reg_office: "",
  website: "", contact_no: "", cin_no: "", pan_no: "", tan_no: "", gst_no: "",
  sac_housekeeping: "", sac_security: "",
  ds_applicable: "0", pfx_pw: "",
  reason_for_updation: "",
};

function ge(o: Record<string, string | null> | null, k: string) { return (o?.[k] ?? "") as string; }
async function getJSON<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${API_BASE_URL}${path}`, { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" });
    return r.ok ? (await r.json()) as T : null;
  } catch { return null; }
}
function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]+)"));
  return m ? decodeURIComponent(m[2]) : null;
}

const blankReminders = (): ReminderRow[] =>
  REMINDER_DEPTS.map((d) => ({
    department: d, email: "", password: "", contact_name: "",
    designation: "", mobile: "", to_addr: "", cc: "", bcc: "",
  }));

export default function CompanyMaster() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<Tab>("home");
  const [blocked, setBlocked] = useState(false);
  const [f, setF] = useState<Form>({ ...EMPTY });
  const [selected, setSelected] = useState<Co | null>(null);
  const [rows, setRows] = useState<Co[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState("");
  const [busy, setBusy] = useState(false);
  const [serverExporting, setServerExporting] = useState(false);
  const [states, setStates] = useState<string[]>([]);
  const [stateCities, setStateCities] = useState<Record<string, string[]>>({});
  const [reasonHistory, setReasonHistory] = useState<string[]>([]);
  // Whether the selected company already has secrets stored server-side.
  // On update a blank password box keeps the stored (cached) value, so the
  // user is not forced to re-type passwords on every edit. On a fresh add
  // there is nothing stored, so the boxes start empty and stay empty.
  const [storedSecrets, setStoredSecrets] = useState({ portal: false, pfx: false });
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [pfxFile, setPfxFile] = useState<File | null>(null);
  // Staged child grids (legacy ViewState tables) — bulk-saved with the company.
  const [esicRows, setEsicRows] = useState<EsicRow[]>([]);
  const [lwfRows, setLwfRows] = useState<LwfRow[]>([]);
  const [bankRows, setBankRows] = useState<BankRow[]>([]);
  const [branchRows, setBranchRows] = useState<BranchRow[]>([]);
  const [gstRows, setGstRows] = useState<GstRow[]>([]);
  const [miniRows, setMiniRows] = useState<MiniRow[]>([]);
  const [reminders, setReminders] = useState<ReminderRow[]>(blankReminders());
  const [images, setImages] = useState<ImgRow[]>([]);
  // Entry boxes per tab.
  const [esic, setEsic] = useState({ state: "Select", address: "", code: "" });
  const [lwf, setLwf] = useState({ state: "Select", number: "", date: "", address: "" });
  const [bank, setBank] = useState({ name: "", account: "", ifsc: "" });
  const [branch, setBranch] = useState({ type: "", address: "", contact: "", start: "", end: "" });
  const [gst, setGst] = useState({ state: "Select", address: "", gstin: "" });
  const [miniDesc, setMiniDesc] = useState("");
  const [doc, setDoc] = useState({ desc: "", from: "", to: "" });
  const [docFile, setDocFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const focus = (id: string) => document.getElementById(id)?.focus?.();
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const level = levelForMenu(me?.permissions, MENU, !!me?.is_staff);
  const canCreate = level >= 3, canUpdate = level >= 2, canDelete = !!me?.is_staff || level >= 4;

  useEffect(() => { getMe().then((m) => { setMe(m); setAuthChecked(true); }); }, []);
  useEffect(() => {
    try {
      const t = window.localStorage.getItem("co_hidtab");
      if (t && (TABS as { id: string }[]).some((x) => x.id === t)) setTab(t as Tab);
    } catch { /* ignore */ }
    getJSON<{ states: string[]; cities: Record<string, string[]> }>("/api/masters/states/lookup/").then((d) => {
      if (d && Array.isArray(d.states)) {
        setStates([...d.states].sort());
        setStateCities(d.cities ?? {});
      }
    });
  }, []);
  const pickTab = (t: Tab) => {
    setTab(t);
    try { window.localStorage.setItem("co_hidtab", t); } catch { /* ignore */ }
  };

  const load = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      // Backend caps page_size at 200 — walk all pages so the grid +
      // Excel always see the full company list (no frozen/half grid).
      const all: Co[] = [];
      let page = 1;
      for (;;) {
        const res = await listItems<Co>(BASE, { page, pageSize: 200 });
        const batch = Array.isArray(res)
          ? (res as unknown as Co[])
          : (res.results ?? []);
        all.push(...batch);
        const r = res as unknown as { next?: string | null };
        if (!r || !r.next || batch.length === 0) break;
        page += 1;
        if (page > 50) break; // safety cap
      }
      setRows(all);
      if (all.length === 0) setListError("");
    } catch (e) {
      setRows([]);
      const msg = e instanceof Error ? e.message : "";
      if (/403/.test(msg)) {
        setListError(`Permission denied (403): "${me?.username ?? "?"}" does not have Read access to Company Master. Log in as an admin, or grant Company Master = R/U/C in the role.`);
      } else {
        setListError(msg || "Company list load failed. Check login + Company Master permission.");
      }
    } finally { setLoading(false); }
  }, [me?.username]);
  useEffect(() => { if (authChecked && me) load(); }, [authChecked, me, load]);

  const stOpts: Opt[] = [{ v: "Select", t: "Select" }, ...states.map((s) => ({ v: s, t: s }))];
  const cityOpts: Opt[] = [{ v: "Select", t: "Select" }, ...(stateCities[f.state] ?? []).map((c) => ({ v: c, t: c }))];

  // Approval requests waiting for this login + rejection log (legacy GridView1/GridView2).
  type ApprovalRow = { id: number; comp_code: string; action: string; company_name: string; city: string; state: string;
    pf_reg_no: string; pf_reg_office: string; company_pan_no: string; company_tan_no: string; service_tax_reg_no: string;
    emp_series_init: string; company_cin_no: string; company_contact_no: string; company_website: string;
    requested_by: string; comment: string; decided_by: string; status: string };
  const [apprPending, setApprPending] = useState<ApprovalRow[]>([]);
  const [apprRejected, setApprRejected] = useState<ApprovalRow[]>([]);
  const loadApprovals = useCallback(async () => {
    const j = await getJSON<{ pending: ApprovalRow[]; rejected: ApprovalRow[] }>(`${BASE}/approvals/`);
    setApprPending(j?.pending ?? []);
    setApprRejected(j?.rejected ?? []);
  }, []);
  useEffect(() => { if (authChecked && me) loadApprovals(); }, [authChecked, me, loadApprovals]);
  const approveReq = async (id: number) => {
    if (!confirm("Approve this company request?")) return;
    setBusy(true);
    try {
      await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
      const r = await fetch(`${API_BASE_URL}${BASE}/approvals/${id}/approve/`, {
        method: "POST", credentials: "include", headers: { "X-CSRFToken": getCookie("csrftoken") ?? "" },
      });
      const b = await r.json().catch(() => ({}));
      if (r.ok) { alert("Approved successfully!!"); load(); }
      else alert(errMsg(b) || "Approval failed...");
      loadApprovals();
    } finally { setBusy(false); }
  };
  const rejectReq = async (id: number) => {
    const comment = prompt("Reason for rejection");
    if (comment === null) return;
    setBusy(true);
    try {
      await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
      const r = await fetch(`${API_BASE_URL}${BASE}/approvals/${id}/reject/`, {
        method: "POST", credentials: "include",
        headers: { "X-CSRFToken": getCookie("csrftoken") ?? "", "Content-Type": "application/json" },
        body: JSON.stringify({ comment }),
      });
      if (!r.ok) alert("Reject failed...");
      loadApprovals();
    } finally { setBusy(false); }
  };

  const clearAll = () => {
    setSelected(null);
    setF({ ...EMPTY });
    setReasonHistory([]);
    setStoredSecrets({ portal: false, pfx: false });
    setLogoUrl(""); setLogoFile(null); setPfxFile(null);
    setEsicRows([]); setLwfRows([]); setBankRows([]); setBranchRows([]);
    setGstRows([]); setMiniRows([]); setReminders(blankReminders()); setImages([]);
    setEsic({ state: "Select", address: "", code: "" });
    setLwf({ state: "Select", number: "", date: "", address: "" });
    setBank({ name: "", account: "", ifsc: "" });
    setBranch({ type: "", address: "", contact: "", start: "", end: "" });
    setGst({ state: "Select", address: "", gstin: "" });
    setMiniDesc("");
    setDoc({ desc: "", from: "", to: "" }); setDocFile(null);
    if (fileRef.current) fileRef.current.value = "";
    pickTab("home");
  };

  // ---------------- validations (exact legacy texts + focus) ----------------
  const emptyBox = (v: string) => !v.trim() || v.trim() === "&nbsp";
  // Legacy Req_validation() (Save): no admin-id/pass client checks (server gate).
  // On update (isUpdate) a blank portal/PFX password box keeps the stored
  // (cached) password, so it is only demanded when nothing is stored yet.
  const validateSave = (isUpdate = false): string | null => {
    if (!f.company_name.trim()) return "Please Enter The Company Name|co_name";
    if (!f.address1.trim()) return "Please Enter Company Address 1|co_addr1";
    if (!f.emp_series_init.trim()) return "Please Enter Employee Series|co_series";
    if (!f.state || f.state === "Select") return "Please Select State  !!!|co_state";
    if (!f.city || f.city === "Select") return "Please Enter City|co_city";
    if (f.pin.trim().length !== 6) return "Please Ente Pin Number Minimum 6 Digits|co_pin";
    if (!f.file_no.trim()) return "Please Enter The File Number|co_file";
    if (!f.e_invoice_applicable || f.e_invoice_applicable === "0" || f.e_invoice_applicable === "Select")
      return "Please Select E-invoice Applicable Or NOT  !!!|co_einv";
    if (f.e_invoice_applicable === "YES") {
      if (emptyBox(f.portal_id)) return "Please Enter Portal ID|co_portal";
      if (emptyBox(f.portal_password) && !(isUpdate && storedSecrets.portal))
        return "Please Enter Portal Password|co_portalpw";
    }
    if (!f.ds_applicable || f.ds_applicable === "0" || f.ds_applicable === "Select") {
      pickTab("item12");
      return "Please Select Digital Signature Applicable Or NOT  !!!|co_ds";
    }
    if (f.ds_applicable === "1" && emptyBox(f.pfx_pw) && !(isUpdate && storedSecrets.pfx)) {
      pickTab("item12");
      return "Please Enter PFX file Password|co_pfxpw";
    }
    return null;
  };
  // Legacy req_vali() (Update): admin id/pass + reason.
  const validateUpdate = (): string | null => {
    const base = validateSave(true);
    if (base) {
      const [msg] = base.split("|");
      if (msg === "Please Ente Pin Number Minimum 6 Digits")
        return "Please Enter Pin Number Minimum 6 Digits|co_pin";
      return base;
    }
    if (!f.admin_user_id.trim()) return "Please Enter Admin User Id|co_adminid";
    if (!f.admin_password.trim()) return "Please Enter Admin Password|co_adminpw";
    if (!f.reason_for_updation.trim()) return "Please Specify Reason For Updation !!!|co_reason";
    return null;
  };
  const fail = (err: string | null): boolean => {
    if (!err) return false;
    const [msg, id] = err.split("|");
    alert(msg);
    if (id) focus(id);
    return true;
  };

  const onPinChange = (v: string) => {
    set("pin", onlyNum(v));
  };

  // Legacy pincode_validation() fires on CHANGE (ASP.NET onchange = when the field
  // loses focus), NOT on every keystroke — so it only complains once the user has
  // finished typing, never after the first digit.
  const onPinBlur = (v: string) => {
    const n = onlyNum(v);
    if (n.length > 0 && n.length !== 6) {
      alert("Please Enter Pin Number Minimum 6 Digit");
      setTimeout(() => focus("co_pin"), 50);
    }
  };

  const onSeriesBlur = async () => {
    // Legacy txtempseriesinit_TextChanged.
    const s = f.emp_series_init.trim();
    if (!s) return;
    const d = await getJSON<{ available: boolean }>(
      `${BASE}/check-series/?series=${encodeURIComponent(s)}&comp_code=${encodeURIComponent(f.comp_code)}`);
    if (d && !d.available) {
      set("emp_series_init", "");
      focus("co_series");
      alert("Please Select Another Employee Series. It is already used");
    }
  };

  const onStateChange = (v: string) => {
    setBlocked(true); // legacy state change posts back under blockUI
    try {
      set("state", v);
      set("city", "Select");
    } finally { setBlocked(false); }
  };

  // ---------------- child-grid staging (legacy ViewState tables) ----------------
  const addEsic = () => {
    if (esic.state === "Select") { alert("Please Select State  !!!"); focus("es_state"); return; }
    if (!esic.address.trim()) { alert("Please Enter ESIC Address."); focus("es_addr"); return; }
    if (!esic.code.trim()) { alert("Please Enter ESIC Registration Code."); focus("es_code"); return; }
    setBlocked(true);
    try {
      setEsicRows((p) => [...p, { ...esic }]);
      setEsic({ state: "Select", address: "", code: "" });
    } finally { setBlocked(false); }
  };
  const addLwf = () => {
    if (lwf.state === "Select") { alert("Please Select LWF State"); focus("lw_state"); return; }
    if (!lwf.number.trim()) { alert("Please Enter LWF Registration No"); focus("lw_num"); return; }
    if (!lwf.date.trim()) { alert("Please Enter LWF Registration Date"); focus("lw_date"); return; }
    if (!lwf.address.trim()) { alert("Please Enter LWF State Office Address."); focus("lw_addr"); return; }
    if (lwfRows.some((r) => r.state === lwf.state)) {
      alert("Can Not Insert 2 same  State for one Company!!");
      return;
    }
    setBlocked(true);
    try {
      setLwfRows((p) => [...p, { ...lwf }]);
      setLwf({ state: "Select", number: "", date: "", address: "" });
    } finally { setBlocked(false); }
  };
  const addBank = () => {
    if (!bank.name.trim()) { alert("Please Enter Bank Name."); focus("bk_name"); return; }
    if (!bank.account.trim()) { alert("Please Enter Bank Account Number."); focus("bk_ac"); return; }
    if (!bank.ifsc.trim()) { alert("Please Enter Bank IFSC Code."); focus("bk_ifsc"); return; }
    setBlocked(true);
    try {
      setBankRows((p) => [...p, { ...bank }]);
      setBank({ name: "", account: "", ifsc: "" });
    } finally { setBlocked(false); }
  };
  const addBranch = () => {
    if (!branch.type.trim()) { alert("Please Enter Office Type  !!!"); focus("br_type"); return; }
    if (!branch.address.trim()) { alert("Please Enter Office Address."); focus("br_addr"); return; }
    if (!branch.contact.trim()) { alert("Please Enter Office Contact Number."); focus("br_contact"); return; }
    if (!branch.start.trim()) { alert("Please Select Start Date."); focus("br_start"); return; }
    if (!branch.end.trim()) { alert("Please Select End Date."); focus("br_end"); return; }
    setBlocked(true);
    try {
      setBranchRows((p) => [...p, { ...branch }]);
      setBranch({ type: "", address: "", contact: "", start: "", end: "" });
    } finally { setBlocked(false); }
  };
  const addGst = () => {
    if (gst.state === "Select") { alert("Please Select GST State"); focus("gs_state"); return; }
    if (!gst.address.trim()) { alert("Please Enter GST Address"); focus("gs_addr"); return; }
    if (!gst.gstin.trim()) { alert("Please Enter GST Number"); focus("gs_gstin"); return; }
    if (gstRows.some((r) => r.state === gst.state)) {
      alert("Can Not Insert 2 same GST State for one Company!!");
      return;
    }
    if (gstRows.some((r) => r.gstin === gst.gstin)) {
      alert("Can Not Insert 2 same GST Number for one Company!!");
      return;
    }
    setBlocked(true);
    try {
      setGstRows((p) => [...p, { ...gst }]);
      setGst({ state: "Select", address: "", gstin: "" });
    } finally { setBlocked(false); }
  };
  const addMini = () => {
    setBlocked(true);
    try {
      setMiniRows((p) => [...p, { description: miniDesc }]);
      setMiniDesc("");
    } finally { setBlocked(false); }
  };
  // Legacy R_validation(): plain confirm, no else-alert on this page.
  const confirmRow = () => confirm("Are you Sure You Want to Delete Record");

  // ---------------- Files tab (company images) ----------------
  const loadImages = useCallback(async (comp: string) => {
    if (!comp) { setImages([]); return; }
    const d = await getJSON<{ results: ImgRow[] } | ImgRow[]>(
      `${IMG}/?comp_code=${encodeURIComponent(comp)}&client_code=`);
    setImages(Array.isArray(d) ? d : (d?.results ?? []));
  }, []);

  const uploadDoc = async () => {
    // Legacy save_validate() + upload_documents().
    if (!doc.desc.trim()) { alert("Please enter document name"); focus("doc_desc"); return; }
    if (!docFile) { alert("Please Upload Document"); focus("doc_file"); return; }
    if (!doc.from.trim()) { alert("Please Select from Date"); focus("doc_from"); return; }
    if (!doc.to.trim()) { alert("Please Select to Date"); focus("doc_to"); return; }
    if (!f.comp_code) { alert("Please select Company first !!!"); return; }
    const ext = ("." + (docFile.name.split(".").pop() ?? "")).toLowerCase();
    if (![".jpg", ".jpeg", ".png", ".pdf"].includes(ext)) {
      alert("Please select only JPG, PNG and PDF Files !!!");
      return;
    }
    setBlocked(true);
    try {
      await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
      const fd = new FormData();
      fd.append("comp_code", f.comp_code);
      fd.append("description", doc.desc.trim());
      fd.append("start_date", doc.from.trim());
      fd.append("end_date", doc.to.trim());
      fd.append("file", docFile);
      const r = await fetch(`${API_BASE_URL}${IMG}/`, {
        method: "POST", credentials: "include",
        headers: { "X-CSRFToken": getCookie("csrftoken") ?? "" }, body: fd,
      });
      if (r.ok) {
        setDoc({ desc: "", from: "", to: "" });
        setDocFile(null);
        if (fileRef.current) fileRef.current.value = "";
        loadImages(f.comp_code);
      } else {
        const b = await r.json().catch(() => ({}));
        alert(errMsg(b) || "Upload failed");
      }
    } finally { setBlocked(false); }
  };

  const downloadImg = async (row: ImgRow) => {
    const r = await fetch(`${API_BASE_URL}${IMG}/${row.id}/download/`, { credentials: "include" });
    if (!r.ok) { alert("Download failed"); return; }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = row.file_name || "file";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const deleteImg = async (row: ImgRow) => {
    if (!confirmRow()) return;
    setBlocked(true);
    try {
      const res = await deleteItem(IMG, row.id);
      if (res.ok) {
        alert("Record deleted successfully!!");
        loadImages(f.comp_code);
      } else alert(errMsg(res.data) || "Delete failed");
    } finally { setBlocked(false); }
  };

  // ---------------- company save/update/delete ----------------
  const checkLogo = (): boolean => {
    if (!logoFile) return true;
    const ext = ("." + (logoFile.name.split(".").pop() ?? "")).toLowerCase();
    if (![".jpg", ".jpeg", ".png"].includes(ext)) {
      alert("Please select only JPG and PNG Images !!!");
      return false;
    }
    return true;
  };

  const payload = () => {
    const fd = new FormData();
    const put = (k: string, v: string) => fd.append(k, v);
    put("company_name", f.company_name.trim());
    put("address1", f.address1.trim());
    put("address2", f.address2.trim());
    put("emp_series_init", f.emp_series_init.trim());
    put("company_short_name", f.company_short_name.trim());
    put("state", f.state === "Select" ? "" : f.state);
    put("city", f.city === "Select" ? "" : f.city);
    put("pin", f.pin.trim());
    put("admin_user_id", f.admin_user_id.trim());
    put("admin_password", f.admin_password);
    put("file_no", f.file_no.trim());
    put("paypro_no", f.paypro_no);
    put("e_invoice_applicable", f.e_invoice_applicable);
    put("e_portal_id", f.portal_id.trim());
    put("portal_password", f.portal_password);
    put("pfx_password", f.pfx_pw);
    put("reason_for_updation", f.reason_for_updation.trim());
    put("pf_reg_no", f.pf_reg_no.trim());
    put("pf_reg_office", f.pf_reg_office.trim());
    put("esic_reg_no", "");
    put("company_website", f.website.trim());
    put("company_contact_no", f.contact_no.trim());
    put("company_cin_no", f.cin_no.trim());
    put("company_pan_no", f.pan_no.trim());
    put("company_tan_no", f.tan_no.trim());
    put("service_tax_reg_no", f.gst_no.trim());
    put("housekeeping_sac_code", f.sac_housekeeping.trim());
    put("security_sac_code", f.sac_security.trim());
    put("ds_applicable_flag", f.ds_applicable);
    // Staged child grids — bulk-saved with the company (legacy delete+insert).
    put("esic_rows", JSON.stringify(esicRows));
    put("lwf_rows", JSON.stringify(lwfRows.map((r) => ({ state: r.state, number: r.number, date: r.date, address: r.address }))));
    put("bank_rows", JSON.stringify(bankRows.map((r) => ({ name: r.name, account: r.account, ifsc: r.ifsc }))));
    put("branch_rows", JSON.stringify(branchRows.map((r) => ({ type: r.type, address: r.address, contact: r.contact, start: r.start, end: r.end }))));
    put("gst_rows", JSON.stringify(gstRows.map((r) => ({ state: r.state, address: r.address, gstin: r.gstin }))));
    put("minibank_rows", JSON.stringify(miniRows.map((r) => ({ description: r.description }))));
    put("reminder_rows", JSON.stringify(reminders.map((r) => ({
      department: r.department, email: r.email, password: r.password,
      contact_name: r.contact_name, designation: r.designation, mobile: r.mobile,
      to_addr: r.to_addr, cc: r.cc, bcc: r.bcc,
    }))));
    if (pfxFile) fd.append("pfx_upload", pfxFile);
    if (logoFile) fd.append("logo_upload", logoFile);
    return fd;
  };

  const postForm = async (id: number | null, isCreate: boolean) => {
    await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
    const url = isCreate ? `${BASE}/` : `${BASE}/${id}/`;
    return fetch(`${API_BASE_URL}${url}`, {
      method: isCreate ? "POST" : "PUT",
      credentials: "include",
      headers: { "X-CSRFToken": getCookie("csrftoken") ?? "" },
      body: payload(),
    });
  };

  const onSave = async () => {
    if (fail(validateSave())) return;
    // Legacy btn_add PFX gates (exact texts).
    if (f.ds_applicable !== "0" && f.ds_applicable !== "Select" && f.ds_applicable === "1") {
      if (!pfxFile) { alert("Please Upload PFX file!!"); return; }
      if (!f.pfx_pw.trim()) { alert("Please Enter PFX file paswword !!"); return; }
    }
    if (!checkLogo()) return;
    if (!f.admin_user_id.trim() || !f.admin_password.trim()) {
      alert("Please enter User id and Password!!");
      return;
    }
    setBusy(true); setBlocked(true);
    try {
      const r = await postForm(null, true);
      const b = await r.json().catch(() => ({}));
      if (r.ok) {
        alert("Company information added successfully!!");
        clearAll(); load(); loadApprovals();
      } else if (r.status === 403) alert("You do not have permission for this action.");
      else alert(errMsg(b) || "Company information adding failed...");
    } finally { setBusy(false); setBlocked(false); }
  };

  const onUpdate = async () => {
    if (!selected) return;
    if (fail(validateUpdate())) return;
    if (!checkLogo()) return;
    setBusy(true); setBlocked(true);
    try {
      const r = await postForm(selected.id, false);
      const b = await r.json().catch(() => ({}));
      if (r.ok) {
        alert("Company Information updated Successfully!!");
        clearAll(); load(); loadApprovals();
      } else if (r.status === 403) alert("You do not have permission for this action.");
      else alert(errMsg(b) || "Company information updation failed...");
    } finally { setBusy(false); setBlocked(false); }
  };

  const onDelete = async () => {
    if (!selected) { alert("Record not Available"); return; }
    if (!confirm("Are you Sure You Want to Delete Record")) return;
    setBusy(true); setBlocked(true);
    try {
      const res = await deleteItem(BASE, selected.id);
      if (res.ok) {
        alert("Company information deleted successfully!!");
        clearAll(); load();
      } else if (res.status === 403) alert("Only administrators can delete a record.");
      else alert(errMsg(res.data) || "Company information deletion failed...");
    } finally { setBusy(false); setBlocked(false); }
  };

  // ---------------- grid select: load everything (legacy load_fields + grids) ----------------
  const selectRow = async (r: Co) => {
    setBlocked(true);
    try {
      const full = await getJSON<Record<string, string | null>>(`${BASE}/${r.id}/`);
      setSelected(r);
      const einv = ge(full, "e_invoice_applicable") || "0";
      setF({
        ...EMPTY,
        comp_code: ge(full, "comp_code"), company_name: ge(full, "company_name"),
        address1: ge(full, "address1"), address2: ge(full, "address2"),
        emp_series_init: ge(full, "emp_series_init"), company_short_name: ge(full, "company_short_name"),
        state: ge(full, "state") || "Select", city: ge(full, "city") || "Select",
        pin: ge(full, "pin"), file_no: ge(full, "file_no"),
        paypro_no: ge(full, "paypro_no") || "Disable",
        e_invoice_applicable: einv === "Select" ? "0" : einv,
        portal_id: ge(full, "e_portal_id"),
        pf_reg_no: ge(full, "pf_reg_no"), pf_reg_office: ge(full, "pf_reg_office"),
        website: ge(full, "company_website"), contact_no: ge(full, "company_contact_no"),
        cin_no: ge(full, "company_cin_no"), pan_no: ge(full, "company_pan_no"),
        tan_no: ge(full, "company_tan_no"), gst_no: ge(full, "service_tax_reg_no"),
        sac_housekeeping: ge(full, "housekeeping_sac_code"),
        sac_security: ge(full, "security_sac_code"),
        ds_applicable: ge(full, "ds_applicable_flag") || "0",
      });
      // Password boxes always load blank (never cached into the form): on a
      // fresh add there is nothing stored, and on edit a blank box keeps the
      // stored password. The flags below tell validation which secrets exist.
      setStoredSecrets({
        portal: !!((full as Record<string, unknown> | null)?.["has_portal_password"]),
        pfx: !!((full as Record<string, unknown> | null)?.["has_pfx_password"]),
      });
      // Reason history (legacy lbx_reason_updation "1.  ..." from comments).
      const comments = ge(full, "comments");
      const hist: string[] = [];
      if (comments.includes("@#$%")) {
        let rest = comments, i = 0;
        while (rest.includes("@#$%")) {
          if (rest === "@#$%") break;
          const at = rest.indexOf("@#$%");
          hist.push(`${++i}.  ${rest.substring(0, at)}`);
          rest = rest.substring(at + 4);
        }
      }
      setReasonHistory(hist);
      const comp = ge(full, "comp_code");
      // Admin login id for the company (legacy fills txt_email_id).
      const adm = await getJSON<{ username: string } | null>(`${BASE}/${r.id}/admin-login/`);
      setF((p) => ({ ...p, admin_user_id: adm?.username ?? "" }));
      setLogoUrl((full?.logo_url as string) ?? "");
      setLogoFile(null); setPfxFile(null);
      // Child grids.
      const z = async (t: string) => {
        const d = await getJSON<{ results: Record<string, string>[] }>(
          `${ZONE}/?comp_code=${encodeURIComponent(comp)}&row_type=${t}`);
        return d?.results ?? [];
      };
      const [esic, lwf, bank, branch, gst, mini] = await Promise.all([
        z("ESIC"), z("LWF"), z("bank_details"), z("branch_details"), z("GST"), z("minibank"),
      ]);
      setEsicRows(esic.map((x) => ({ state: x.field1 ?? "", address: x.field2 ?? "", code: x.field3 ?? "" })));
      setLwfRows(lwf.map((x) => ({ state: x.field1 ?? "", number: x.field2 ?? "", date: x.field3 ?? "", address: x.field4 ?? "" })));
      setBankRows(bank.map((x) => ({ name: x.field1 ?? "", account: x.field2 ?? "", ifsc: x.field3 ?? "" })));
      setBranchRows(branch.map((x) => ({ type: x.field1 ?? "", address: x.field2 ?? "", contact: x.field3 ?? "", start: x.field4 ?? "", end: x.field5 ?? "" })));
      setGstRows(gst.map((x) => ({ state: x.region ?? "", address: x.field1 ?? "", gstin: x.field2 ?? "" })));
      setMiniRows(mini.map((x) => ({ description: x.field1 ?? "" })));
      // Reminders: 6 dept rows merged with stored.
      const rem = await getJSON<{ results: Record<string, string>[] }>(
        `/api/masters/company-reminder-emails/?comp_code=${encodeURIComponent(comp)}`);
      const byDept: Record<string, Record<string, string>> = {};
      (rem?.results ?? []).forEach((x) => { byDept[x.department] = x; });
      setReminders(REMINDER_DEPTS.map((d) => ({
        department: d, email: byDept[d]?.email ?? "", password: "",
        contact_name: byDept[d]?.contact_name ?? "", designation: byDept[d]?.designation ?? "",
        mobile: byDept[d]?.mobile ?? "", to_addr: byDept[d]?.to_addr ?? "",
        cc: byDept[d]?.cc ?? "", bcc: byDept[d]?.bcc ?? "",
      })));
      loadImages(comp);
      pickTab("home");
    } finally { setBlocked(false); }
  };

  if (authChecked && !me) {
    return <div className="container-fluid"><div className="panel panel-primary">
      <div className="panel-heading" style={{ textAlign: "center" }}>COMPANY MASTER</div>
      <div style={{ padding: 16 }}>Please sign in. <a href="/login">Go to login</a></div>
    </div></div>;
  }

  const Req = () => <span className="text-red" style={{ color: "#f00" }}>*</span>;
  const TH: React.CSSProperties = { backgroundColor: "#006699", color: "White", fontWeight: "bold" };
  const TD_DEL: React.CSSProperties = { border: "none", background: "transparent", cursor: "pointer", color: "#d9534f", fontSize: "14px" };
  const gridTable = (heads: string[], body: React.ReactNode) => (
    <div className="grid-view">
      <table className="table" style={{ backgroundColor: "White", borderColor: "#CCCCCC", width: "100%", fontSize: "X-Small", color: "#000066" }}>
        <thead><tr style={TH} className="text-uppercase">{heads.map((h) => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{body}</tbody>
      </table>
    </div>
  );

  const updReminder = (i: number, k: keyof ReminderRow, v: string) =>
    setReminders((p) => p.map((r, j) => (j === i ? { ...r, [k]: v } : r)));

  // Full-list server Excel (real .xlsx, all rows — fixes "Excel me data nahi dikha"
  // when only the visible page was exported or rows were empty client-side).
  const downloadServerExcel = async () => {
    setServerExporting(true);
    try {
      const r = await fetch(`${API_BASE_URL}${BASE}/?export=excel`, { credentials: "include" });
      if (!r.ok) { alert(`Excel download failed (HTTP ${r.status})`); return; }
      const blob = await r.blob();
      if (blob.size < 100) { alert("No data in the Excel — let the company list load first / check your login."); return; }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "companies.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch { alert("Excel download failed"); }
    finally { setServerExporting(false); }
  };

  return (
    <div className="container-fluid co-skin">
      {blocked && (
        <div style={{ position: "fixed", inset: 0, background: "#CCCCCC", opacity: 0.7, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
          Please wait...
        </div>
      )}
      <div className="panel panel-primary" style={{ backgroundColor: "white" }}>
        <div className="panel-heading">
          <div className="row">
            <div className="col-sm-1"></div>
            <div className="col-sm-9">
              <div style={{ textAlign: "center", color: "#fff", fontSize: "small" }}><b>COMPANY MASTER</b></div>
            </div>
            <div className="col-sm-2 text-right">
              <a href="#" onClick={(e) => { e.preventDefault(); window.open("html/CompanyMaster.html", "popUpWindow", "height=500,width=600,left=100,top=100"); }} style={{ fontSize: "10px", color: "#fff" }}>
                <img src="/Images/help_ico.png" alt="Help" width={20} height={20} title="Help" />
              </a>
            </div>
          </div>
        </div>
        <br />

        {selected && (
          <div className="container-fluid">
            <div className="panel panel-primary" style={{ backgroundColor: "#f3f1fe", borderRadius: "10px", border: "1px solid white" }}>
              <br />
              <div className="panel-body container">
                <div className="row">
                  <select className="form-control" multiple size={Math.max(reasonHistory.length, 3)} style={{ width: "100%" }} disabled>
                    {reasonHistory.map((h, i) => <option key={i}>{h}</option>)}
                  </select>
                  <textarea id="co_reason" className="form-control" rows={4} cols={50} style={{ width: "100%" }}
                    placeholder="Enter Reason for Updation" value={f.reason_for_updation}
                    onChange={(e) => set("reason_for_updation", e.target.value)} />
                </div>
              </div>
              <br />
            </div>
          </div>
        )}

        <div className="panel-body" style={{ borderBottomLeftRadius: "2px", borderBottomRightRadius: "2px", backgroundColor: "white" }}>
          <div className="container-fluid" style={{ background: "#f3f1fe", borderRadius: "10px", border: "1px solid white" }}>
            <br />
            <div className="row">
              <div className="col-sm-10 col-xs-12">
                <div className="row">
                  <div className="col-sm-2 col-xs-12" style={{ width: "12%" }}>
                    <b> Company Code </b>
                    <input className="form-control" value={f.comp_code} readOnly onChange={() => { }} />
                  </div>
                  <div className="col-sm-3 col-xs-12">
                    <b>Registered Company Name:</b><span className="text-red">*</span>
                    <input id="co_name" className="form-control" style={{ width: "100%" }} maxLength={100}
                      value={f.company_name} onChange={(e) => set("company_name", alphaAddr(e.target.value))} />
                  </div>
                  <div className="col-sm-3 col-xs-12">
                    <b>Registered Address1 :</b> <span className="text-red">*</span>
                    <input id="co_addr1" className="form-control" style={{ width: "100%" }}
                      value={f.address1} onChange={(e) => set("address1", alphaAddr(e.target.value))} />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b> Registered Address2 :</b>
                    <input className="form-control" style={{ width: "100%" }}
                      value={f.address2} onChange={(e) => set("address2", alphaAddr(e.target.value))} />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b> Employee Series :</b> <span className="text-red">*</span>
                    <input id="co_series" className="form-control" style={{ width: "100%" }} maxLength={1}
                      value={f.emp_series_init} readOnly={!!selected}
                      onChange={(e) => set("emp_series_init", seriesKeys(e.target.value))}
                      onBlur={onSeriesBlur} />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b> Company Short Name :</b>
                    <input id="co_short" className="form-control" style={{ width: "100%" }} maxLength={20}
                      value={f.company_short_name}
                      onChange={(e) => set("company_short_name", e.target.value.replace(/[^A-Za-z0-9]/g, "").toUpperCase())} />
                  </div>
                </div>
                <br />
                <div className="row">
                  <div className="col-sm-2 col-xs-12">
                    <b> Registered State :</b> <span className="text-red">*</span>
                    <select id="co_state" className="form-control" value={f.state} onChange={(e) => onStateChange(e.target.value)}>
                      {stOpts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                    </select>
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b>Registered City :</b> <span className="text-red">*</span>
                    <select id="co_city" className="form-control" value={f.city} onChange={(e) => set("city", e.target.value)}>
                      {cityOpts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                    </select>
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b>Registered Pin Code :</b> <span className="text-red">*</span>
                    <input id="co_pin" className="form-control" style={{ width: "100%" }} maxLength={6}
                      value={f.pin} onChange={(e) => onPinChange(e.target.value)}
                      onBlur={(e) => onPinBlur(e.target.value)} />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b>Admin User ID :</b> <span className="text-red">*</span>
                    <input id="co_adminid" className="form-control" style={{ width: "100%" }} maxLength={10}
                      value={f.admin_user_id} onChange={(e) => set("admin_user_id", alphaAddr(e.target.value))} />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b>Admin Password :</b> <span className="text-red">*</span>
                    <PasswordInput id="co_adminpw" autoComplete="new-password" className="form-control" style={{ width: "100%" }} maxLength={15}
                      value={f.admin_password} onChange={(e) => set("admin_password", alphaAddr1(e.target.value))} />
                  </div>
                </div>
                <br />
                <div className="row">
                  <div className="col-sm-2 col-xs-12">
                    <b>File No. :</b><span className="text-red">*</span>
                    <input id="co_file" className="form-control" style={{ width: "100%" }} maxLength={50}
                      value={f.file_no} onChange={(e) => set("file_no", alphaAddr(e.target.value))} />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b>PayPro No. : </b><span className="text-red">*</span>
                    <select className="form-control" value={f.paypro_no} onChange={(e) => set("paypro_no", e.target.value)}>
                      {PAYPRO.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                    </select>
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b>E-invoice Applicable : </b><span className="text-red">*</span>
                    <select id="co_einv" className="form-control" value={f.e_invoice_applicable} onChange={(e) => set("e_invoice_applicable", e.target.value)}>
                      {EINV.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                    </select>
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    {f.e_invoice_applicable === "YES" && <b>E Portal Id</b>}
                    {f.e_invoice_applicable === "YES" && (
                      <input id="co_portal" className="form-control" style={{ width: "100%" }} maxLength={10}
                        value={f.portal_id} onChange={(e) => set("portal_id", e.target.value)} />
                    )}
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    {f.e_invoice_applicable === "YES" && <b>E Portal Password</b>}
                    {f.e_invoice_applicable === "YES" && (
                      <PasswordInput id="co_portalpw" autoComplete="new-password" className="form-control" style={{ width: "100%" }} maxLength={15}
                        value={f.portal_password} onChange={(e) => set("portal_password", e.target.value)}
                        placeholder={storedSecrets.portal ? "Saved — leave blank to keep" : undefined} />
                    )}
                  </div>
                </div>
              </div>
              <div className="col-sm-2 col-xs-12" style={{ marginLeft: "-50px" }}>
                <table className="table table-striped" style={{ border: "double" }}>
                  <tbody>
                    <tr>
                      <td>
                        <img src={logoUrl ? `${API_BASE_URL}${logoUrl}` : "/logo.png"} alt="Company Logo"
                          width={92} height={92} style={{ objectFit: "contain" }} /><br />
                        <b> Company Logo :</b><br />
                        <input type="file" className="text_box" accept=".jpg,.jpeg,.png"
                          onChange={(e) => {
                            const fl = e.target.files?.[0] ?? null;
                            if (!fl) { setLogoFile(null); return; }
                            const ext = ("." + (fl.name.split(".").pop() ?? "")).toLowerCase();
                            if (![".jpg", ".jpeg", ".png"].includes(ext)) {
                              alert("Please select only JPG and PNG Images !!!");
                              e.target.value = "";
                              setLogoFile(null);
                              return;
                            }
                            setLogoFile(fl);
                          }} />
                        <b style={{ color: "#f00" }}>Note :</b> <b>Only JPG and PNG</b>
                        <br />
                        <b> files will be uploaded.</b>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          <br />

          <div id="tabs" style={{ background: "#f3f1fe" }}>
            <ul style={{ listStyle: "none", display: "flex", gap: "2px", flexWrap: "wrap", padding: "8px 8px 0 8px", margin: 0 }}>
              {TABS.map((t, i) => (
                <li key={t.id} className={tab === t.id && i === 0 ? "active" : ""}
                  style={{ background: tab === t.id ? "#fff" : "#e7e7fa", border: "1px solid #ccc", borderBottom: tab === t.id ? "1px solid #fff" : "1px solid #ccc", borderRadius: "4px 4px 0 0", padding: "6px 12px" }}>
                  <a href={`#${t.id}`} onClick={(e) => { e.preventDefault(); pickTab(t.id); }}
                    style={{ textDecoration: "none", color: "#333", fontWeight: tab === t.id ? "bold" : "normal" }}><b>{t.label}</b></a>
                </li>
              ))}
            </ul>

            {tab === "home" && (
              <div id="home">
                <br />
                <div className="row">
                  <div className="col-sm-2 col-xs-12">
                    <b>Description :</b>
                    <input id="doc_desc" className="form-control" maxLength={200}
                      value={doc.desc} onChange={(e) => setDoc({ ...doc, desc: alphaNum(e.target.value)})} />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b><span>File to Upload :</span></b>
                    <input ref={fileRef} id="doc_file" type="file" accept=".jpg,.jpeg,.png,.pdf"
                      onChange={(e) => setDocFile(e.target.files?.[0] ?? null)} />
                    <b style={{ color: "#f00", textAlign: "center" }}>Note :</b>{" "}
                    <span style={{ fontSize: "8px", fontWeight: "bold" }}>Only JPG, PNG and PDF files will be uploaded.</span>
                    {docFile && <div style={{ fontSize: "11px" }}>Selected: {docFile.name}</div>}
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b>Start Date :</b>
                    <input id="doc_from" className="form-control" style={{ width: "100%", display: "inline" }}
                      value={doc.from} onChange={(e) => setDoc({ ...doc, from: e.target.value })} placeholder="dd/mm/yyyy" />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b> End Date :</b>
                    <input id="doc_to" className="form-control text_box" style={{ display: "inline" }}
                      value={doc.to} onChange={(e) => setDoc({ ...doc, to: e.target.value })} placeholder="dd/mm/yyyy" />
                  </div>
                  <div className="col-sm-2 col-xs-12" style={{ marginTop: "2em" }}>
                    <button className="btn btn-primary" onClick={uploadDoc}>Upload</button>
                  </div>
                </div>
                <br /><br /><br /><br /><br /><br />
                <div className="container">
                  {gridTable(["No.", "ID", "Description", "Start Date", "End Date", "Download File", "Delete"], (
                    <>
                      {images.map((m, i) => (
                        <tr key={m.id}>
                          <td>{i + 1}</td>
                          <td style={{ display: "none" }}>{m.id}</td>
                          <td>{m.description}</td>
                          <td>{m.start_date}</td>
                          <td>{m.end_date}</td>
                          <td><button className="btn btn-link" style={{ padding: 0 }} onClick={() => downloadImg(m)}>Download</button></td>
                          <td><button className="btn btn-primary" onClick={() => deleteImg(m)}>Delete</button></td>
                        </tr>
                      ))}
                      {images.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "#777" }}>No files</td></tr>}
                    </>
                  ))}
                </div>
                <br />
              </div>
            )}

            {tab === "menu1" && (
              <div id="menu1">
                <br />
                <div className="row">
                  <div className="col-sm-3 col-xs-12">
                    <b>ESIC State:</b>
                    <select id="es_state" className="form-control" style={{ width: "100%" }}
                      value={esic.state} onChange={(e) => setEsic({ ...esic, state: e.target.value })}>
                      {stOpts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                    </select>
                  </div>
                  <div className="col-sm-3 col-xs-12">
                    <b>ESIC Office Address :</b>
                    <input id="es_addr" className="form-control" maxLength={250}
                      value={esic.address} onChange={(e) => setEsic({ ...esic, address: alphaAddr(e.target.value)})} />
                  </div>
                  <div className="col-sm-3 col-xs-12">
                    <b> ESIC Registration Code :</b>
                    <input id="es_code" className="form-control" maxLength={30}
                      value={esic.code} onChange={(e) => setEsic({ ...esic, code: alphaNum(e.target.value)})} />
                  </div>
                  <div className="col-sm-3 col-xs-12">
                    <br />
                    <button title="Add Item" onClick={addEsic}
                      style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
                  </div>
                </div>
                <br />
                <div className="container">
                  {gridTable(["", "Sr No.", "ESIC State", "ESIC ADDRESS", "ESIC CODE"], (
                    <>
                      {esicRows.map((r, i) => (
                        <tr key={i}>
                          <td><button style={TD_DEL} onClick={() => { if (confirmRow()) setEsicRows((p) => p.filter((_, j) => j !== i)); }}>✖</button></td>
                          <td style={{ width: "20px" }}>{i + 1}</td>
                          <td>{r.state}</td><td>{r.address}</td><td>{r.code}</td>
                        </tr>
                      ))}
                      {esicRows.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "#777" }}>No rows</td></tr>}
                    </>
                  ))}
                </div>
              </div>
            )}

            {tab === "menu10" && (
              <div id="menu10">
                <br /><br />
                <div className="row">
                  <div className="col-sm-2 col-xs-12">
                    <b> LWF State:</b>
                    <select id="lw_state" className="form-control" style={{ width: "100%" }}
                      value={lwf.state} onChange={(e) => setLwf({ ...lwf, state: e.target.value })}>
                      {stOpts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                    </select>
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b>LWF Registration No :</b>
                    <input id="lw_num" className="form-control" maxLength={40}
                      value={lwf.number} onChange={(e) => setLwf({ ...lwf, number: onlyNum(e.target.value)})} />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b>  LWF Registration Date :</b>
                    <input id="lw_date" className="form-control" style={{ width: "100%" }}
                      value={lwf.date} onChange={(e) => setLwf({ ...lwf, date: e.target.value })} placeholder="dd/mm/yyyy" />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b> LWF State Office Address  :</b>
                    <textarea className="form-control text_box" style={{ width: "100%" }}
                      value={lwf.address} onChange={(e) => setLwf({ ...lwf, address: alphaAddr(e.target.value)})} />
                  </div>
                  <div className="col-sm-3 col-xs-12">
                    <br />
                    <button title="Add Item" onClick={addLwf}
                      style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
                  </div>
                </div>
                <br /><br />
                <div className="container">
                  {gridTable(["", "Sr No.", "LWF STATE", "LWF NUMBER", "LWF DATE", "LWF STATE OFFICE ADDRESS"], (
                    <>
                      {lwfRows.map((r, i) => (
                        <tr key={i}>
                          <td><button style={TD_DEL} onClick={() => setLwfRows((p) => p.filter((_, j) => j !== i))}>✖</button></td>
                          <td style={{ width: "20px" }}>{i + 1}</td>
                          <td>{r.state}</td><td>{r.number}</td><td>{r.date}</td><td>{r.address}</td>
                        </tr>
                      ))}
                      {lwfRows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#777" }}>No rows</td></tr>}
                    </>
                  ))}
                </div>
              </div>
            )}

            {tab === "menu2" && (
              <div id="menu2">
                <br />
                <div className="row">
                  <div className="col-sm-3 col-xs-12">
                    <b> PF Registration Code :</b>
                    <input className="form-control text_box" maxLength={20}
                      value={f.pf_reg_no} onChange={(e) => set("pf_reg_no", alphaNumSlash(e.target.value))} />
                  </div>
                  <div className="col-sm-3 col-xs-12">
                    <b>PF Registration Office Address:</b>
                    <input className="form-control text_box" maxLength={20}
                      value={f.pf_reg_office} onChange={(e) => set("pf_reg_office", alphaAddr(e.target.value))} />
                  </div>
                </div>
                <br />
              </div>
            )}

            {tab === "menu3" && (
              <div id="menu3">
                <br />
                <div className="row">
                  <div className="col-sm-3 col-xs-12">
                    <b>Bank Name:</b>
                    <input id="bk_name" className="form-control text_box" maxLength={50}
                      value={bank.name} onChange={(e) => setBank({ ...bank, name: alphaAddr(e.target.value)})} />
                  </div>
                  <div className="col-sm-3 col-xs-12">
                    <b>Bank Account No. :</b>
                    <input id="bk_ac" className="form-control text_box" maxLength={30}
                      value={bank.account} onChange={(e) => setBank({ ...bank, account: onlyNum(e.target.value)})} />
                  </div>
                  <div className="col-sm-3 col-xs-12">
                    <b>IFSC Code :</b>
                    <input id="bk_ifsc" className="form-control text_box" maxLength={11}
                      value={bank.ifsc} onChange={(e) => setBank({ ...bank, ifsc: alphaNumSpace(e.target.value)})} />
                  </div>
                  <div className="col-sm-3 col-xs-12">
                    <br />
                    <button title="Add Item" onClick={addBank}
                      style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
                  </div>
                </div>
                <br />
                <div className="container">
                  {gridTable(["", "Sr No.", "Bank Name", "Account No.", "IFSC Code"], (
                    <>
                      {bankRows.map((r, i) => (
                        <tr key={i}>
                          <td><button style={TD_DEL} onClick={() => { if (confirmRow()) setBankRows((p) => p.filter((_, j) => j !== i)); }}>✖</button></td>
                          <td style={{ width: "20px" }}>{i + 1}</td>
                          <td>{r.name}</td><td>{r.account}</td><td>{r.ifsc}</td>
                        </tr>
                      ))}
                      {bankRows.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "#777" }}>No rows</td></tr>}
                    </>
                  ))}
                </div>
              </div>
            )}

            {tab === "menu4" && (
              <div id="menu4">
                <br />
                <div className="row">
                  <div className="col-sm-2 col-xs-12">
                    <b>  Office Type:</b>
                    <input id="br_type" className="form-control text_box" maxLength={30}
                      value={branch.type} onChange={(e) => setBranch({ ...branch, type: alphaAddr(e.target.value)})} />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b>Office Address :</b>
                    <input id="br_addr" className="form-control text_box" maxLength={250}
                      value={branch.address} onChange={(e) => setBranch({ ...branch, address: alphaAddr(e.target.value)})} />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b>Office Contact No. :</b>
                    <input id="br_contact" className="form-control text_box" maxLength={10}
                      value={branch.contact} onChange={(e) => setBranch({ ...branch, contact: onlyNum(e.target.value)})} />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b>Rent Agreement Start Date :</b>
                    <input id="br_start" className="form-control text_box" placeholder="Start Date :"
                      value={branch.start} onChange={(e) => setBranch({ ...branch, start: e.target.value })} />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b>Rent Agreement End Date :</b>
                    <input id="br_end" className="form-control text_box" placeholder="End Date :"
                      value={branch.end} onChange={(e) => setBranch({ ...branch, end: e.target.value })} />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <br />
                    <button title="Add Item" onClick={addBranch}
                      style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
                  </div>
                </div>
                <br />
                <div className="container">
                  {gridTable(["", "Sr No.", "Office Type", "Office Address", "Office Contact", "Rent Start Date", "Rent End Date"], (
                    <>
                      {branchRows.map((r, i) => (
                        <tr key={i}>
                          <td><button style={TD_DEL} onClick={() => { if (confirmRow()) setBranchRows((p) => p.filter((_, j) => j !== i)); }}>✖</button></td>
                          <td style={{ width: "20px" }}>{i + 1}</td>
                          <td>{r.type}</td><td>{r.address}</td><td>{r.contact}</td><td>{r.start}</td><td>{r.end}</td>
                        </tr>
                      ))}
                      {branchRows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "#777" }}>No rows</td></tr>}
                    </>
                  ))}
                </div>
              </div>
            )}

            {tab === "menu5" && (
              <div id="menu5">
                <br />
                <div className="row">
                  <div className="col-sm-3 col-xs-12">
                    <b>Company Website :</b>
                    <input className="form-control text_box" maxLength={50}
                      value={f.website} onChange={(e) => set("website", websiteKeys(e.target.value))} />
                  </div>
                  <div className="col-sm-3 col-xs-12">
                    <b> Company Contact No.:</b>
                    <input className="form-control text_box" maxLength={10}
                      value={f.contact_no} onChange={(e) => set("contact_no", onlyNum(e.target.value))} />
                  </div>
                  <div className="col-sm-3 col-xs-12">
                    <b>Company CIN Number :</b>
                    <input className="form-control text_box" maxLength={22}
                      value={f.cin_no} onChange={(e) => set("cin_no", alphaNumSlash(e.target.value))} />
                  </div>
                  <div className="col-sm-3 col-xs-12">
                    <b> Company PAN Number :</b>
                    <input className="form-control text_box" maxLength={12}
                      value={f.pan_no} onChange={(e) => set("pan_no", alphaNumSlash(e.target.value))} />
                  </div>
                </div>
                <div className="row">
                  <br />
                  <div className="col-sm-3 col-xs-12">
                    <b>Company TAN Number :</b>
                    <input className="form-control text_box" maxLength={12}
                      value={f.tan_no} onChange={(e) => set("tan_no", alphaNumSlash(e.target.value))} />
                  </div>
                  <div className="col-sm-3 col-xs-12">
                    <b> GST No :</b>
                    <input className="form-control text_box" maxLength={16}
                      value={f.gst_no} onChange={(e) => set("gst_no", alphaNumSpace(e.target.value.toUpperCase()))} />
                  </div>
                </div>
              </div>
            )}

            {tab === "item7" && (
              <div id="item7">
                <br />
                <div className="row">
                  <div className="col-sm-2 col-xs-12">
                    <b> GST State :</b>
                    <select id="gs_state" className="form-control" value={gst.state}
                      onChange={(e) => setGst({ ...gst, state: e.target.value })}>
                      {stOpts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                    </select>
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b> GST Address :</b>
                    <input id="gs_addr" className="form-control" maxLength={200}
                      value={gst.address} onChange={(e) => setGst({ ...gst, address: alphaAddr(e.target.value)})} />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b> GST IN :</b>
                    <input id="gs_gstin" className="form-control" maxLength={30}
                      value={gst.gstin} onChange={(e) => setGst({ ...gst, gstin: alphaNumSpace(e.target.value)})} />
                  </div>
                  <br />
                  <div className="col-sm-2 col-xs-12">
                    <button title="Add Item" onClick={addGst}
                      style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
                  </div>
                </div>
                <br />
                <div className="container">
                  {gridTable(["", "Sr No.", "GST State", "GST Address", "GST IN"], (
                    <>
                      {gstRows.map((r, i) => (
                        <tr key={i}>
                          <td style={{ width: "20px" }}><button style={TD_DEL} onClick={() => { if (confirmRow()) setGstRows((p) => p.filter((_, j) => j !== i)); }}>✖</button></td>
                          <td style={{ width: "20px" }}>{i + 1}</td>
                          <td style={{ width: "100px" }}>{r.state}</td>
                          <td>{r.address}</td>
                          <td>{r.gstin}</td>
                        </tr>
                      ))}
                      {gstRows.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "#777" }}>No rows</td></tr>}
                    </>
                  ))}
                </div>
              </div>
            )}

            {tab === "item8" && (
              <div id="item8">
                <br />
                <div className="row">
                  <div className="col-sm-2 col-xs-12">
                    <b>Housekeeping   SAC Code :</b>
                    <input className="form-control" maxLength={10}
                      value={f.sac_housekeeping} onChange={(e) => set("sac_housekeeping", alphaNumSpace(e.target.value))} />
                  </div>
                  <div className="col-sm-2 col-xs-12">
                    <b> Security SAC Code :</b>
                    <input className="form-control" maxLength={10}
                      value={f.sac_security} onChange={(e) => set("sac_security", alphaNumSpace(e.target.value))} />
                  </div>
                </div>
              </div>
            )}

            {tab === "item9" && (
              <div id="item9">
                <br />
                <div className="grid-view" style={{ overflowX: "auto" }}>
                  <table className="table" style={{ backgroundColor: "White", borderColor: "#CCCCCC", width: "100%", fontSize: "X-Small", color: "#000066" }}>
                    <thead><tr style={TH} className="text-uppercase">
                      <th>Department</th><th>Email</th><th>Password</th><th>Name</th>
                      <th>Mobile NUM</th><th>Designation</th><th>To-Invoice Mail</th>
                      <th>CC-Invoice Mail</th><th>BCC-Invoice Mail</th>
                    </tr></thead>
                    <tbody>
                      {reminders.map((r, i) => (
                        <tr key={r.department}>
                          <td style={{ width: "20px" }}>{r.department}</td>
                          <td><input className="form-control" style={{ width: "150px", textAlign: "left" }}
                            value={r.email} onChange={(e) => updReminder(i, "email", emailKeys(e.target.value))} /></td>
                          <td><PasswordInput autoComplete="new-password" className="form-control" style={{ width: "150px", textAlign: "left" }}
                            value={r.password} placeholder="Leave blank to keep saved"
                            onChange={(e) => updReminder(i, "password", e.target.value)} /></td>
                          <td><input className="form-control" style={{ width: "150px", textAlign: "left" }}
                            value={r.contact_name} onChange={(e) => updReminder(i, "contact_name", alphaOnly(e.target.value))} /></td>
                          <td><input className="form-control" style={{ width: "150px", textAlign: "left" }}
                            value={r.mobile} onChange={(e) => updReminder(i, "mobile", onlyNum(e.target.value))} /></td>
                          <td><input className="form-control" style={{ width: "150px", textAlign: "left" }}
                            value={r.designation} onChange={(e) => updReminder(i, "designation", alphaOnly(e.target.value))} /></td>
                          <td><input className="form-control" style={{ width: "150px", textAlign: "left" }}
                            value={r.to_addr} onChange={(e) => updReminder(i, "to_addr", emailKeys(e.target.value))} /></td>
                          <td><input className="form-control" style={{ width: "150px", textAlign: "left" }}
                            value={r.cc} onChange={(e) => updReminder(i, "cc", emailKeys(e.target.value))} /></td>
                          <td><input className="form-control" style={{ width: "150px", textAlign: "left" }}
                            value={r.bcc} onChange={(e) => updReminder(i, "bcc", emailKeys(e.target.value))} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === "item11" && (
              <div id="item11">
                <div className="row">
                  <div className="col-sm-2 col-xs-12">
                    <b>Description :</b>
                    <input className="form-control" maxLength={200}
                      value={miniDesc} onChange={(e) => setMiniDesc(alphaNum(e.target.value))} />
                  </div>
                  <div className="col-sm-3 col-xs-12">
                    <br />
                    <button title="Add Item" onClick={addMini}
                      style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" }}>＋</button>
                  </div>
                </div>
                <br />
                <div className="container">
                  {gridTable(["", "Sr No.", "CODE", "field1"], (
                    <>
                      {miniRows.map((r, i) => (
                        <tr key={i}>
                          <td style={{ width: "20px" }}><button style={TD_DEL} onClick={() => setMiniRows((p) => p.filter((_, j) => j !== i))}>✖</button></td>
                          <td style={{ width: "20px" }}>{i + 1}</td>
                          <td>{f.comp_code}</td>
                          <td>{r.description}</td>
                        </tr>
                      ))}
                      {miniRows.length === 0 && <tr><td colSpan={4} style={{ textAlign: "center", color: "#777" }}>No rows</td></tr>}
                    </>
                  ))}
                </div>
              </div>
            )}

            {tab === "item12" && (
              <div id="item12">
                <div className="row">
                  <div className="col-sm-2 col-xs-12">
                    <b>DS Applicable / Not Applicable :</b> <Req />
                    <select id="co_ds" className="form-control" value={f.ds_applicable}
                      onChange={(e) => set("ds_applicable", e.target.value)}>
                      {DS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                    </select>
                  </div>
                  {f.ds_applicable === "1" && (
                    <>
                      <div className="col-sm-2 col-xs-12">
                        <input type="file" className="text_box" accept=".pfx"
                          onChange={(e) => setPfxFile(e.target.files?.[0] ?? null)} />
                        <b style={{ color: "#f00" }}>Note :</b> <b>Only PFX files will be uploaded.</b>
                        {pfxFile && <div style={{ fontSize: "11px" }}>Selected: {pfxFile.name}</div>}
                      </div>
                      <div className="col-sm-2 col-xs-12">
                        <b>Password :</b> <Req />
                        <PasswordInput id="co_pfxpw" autoComplete="new-password" className="form-control" style={{ width: "100%" }} maxLength={100}
                          value={f.pfx_pw} onChange={(e) => set("pfx_pw", e.target.value)}
                          placeholder={storedSecrets.pfx ? "Saved — leave blank to keep" : undefined} />
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
          <br />
          <div className="row text-center">
            {canCreate && !selected && <button className="btn btn-primary" disabled={busy} onClick={onSave}>Save</button>}{" "}
            {canUpdate && selected && <button className="btn btn-primary" disabled={busy} onClick={onUpdate}> Update </button>}{" "}
            {canDelete && selected && <button className="btn btn-primary" disabled={busy} onClick={onDelete}> Delete </button>}{" "}
            <button className="btn btn-primary" disabled={busy} onClick={() => { setBlocked(true); try { clearAll(); } finally { setBlocked(false); } }}> Clear </button>{" "}
            <button className="btn btn-danger" onClick={() => router.push("/Home")}>Close</button>
          </div>
          <br />
          <br />

          {(apprPending.length > 0 || apprRejected.length > 0) && (
            <div className="container-fluid" style={{ background: "#f3f1fe", padding: "10px", borderRadius: "10px", border: "1px solid white", marginBottom: 12 }}>
              <h4 style={{ marginTop: 0 }}>Approval Requests</h4>
              {apprPending.length > 0 && (
                <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #ccc", marginBottom: 8 }}>
                  <table className="table table-bordered" style={{ marginBottom: 0, fontSize: 12 }}>
                    <thead><tr>
                      <th>COMP CODE</th><th>NAME</th><th>CITY</th><th>STATE</th><th>PF REGISTRATION NO</th><th>PAN NO</th>
                      <th>TAN NO</th><th>GST REGISTRATION NO</th><th>EMPLOYEE SERIES INIT</th><th>COMPANY CIN NO</th>
                      <th>COMPANY CONTACT NO</th><th>WEBSITE</th><th>REQUESTED BY</th><th></th>
                    </tr></thead>
                    <tbody>{apprPending.map((a) => (
                      <tr key={a.id}>
                        <td>{a.comp_code}</td><td>{a.company_name}</td><td>{a.city}</td><td>{a.state}</td>
                        <td>{a.pf_reg_no}</td><td>{a.company_pan_no}</td><td>{a.company_tan_no}</td>
                        <td>{a.service_tax_reg_no}</td><td>{a.emp_series_init}</td><td>{a.company_cin_no}</td>
                        <td>{a.company_contact_no}</td><td>{a.company_website}</td><td>{a.requested_by}</td>
                        <td style={{ whiteSpace: "nowrap" }}>
                          <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => approveReq(a.id)}> Approve </button>{" "}
                          <button className="btn btn-danger btn-sm" disabled={busy} onClick={() => rejectReq(a.id)}> Reject </button>
                        </td>
                      </tr>))}</tbody>
                  </table>
                </div>
              )}
              {apprRejected.length > 0 && (
                <div style={{ overflowX: "auto", background: "#fff", border: "1px solid #ccc" }}>
                  <table className="table table-bordered" style={{ marginBottom: 0, fontSize: 12 }}>
                    <thead><tr><th>ID</th><th>COMP CODE</th><th>STATUS</th><th>COMMENT</th><th>REJECTED BY</th></tr></thead>
                    <tbody>{apprRejected.map((a) => (
                      <tr key={a.id}><td>{a.id}</td><td>{a.comp_code}</td><td>Rejected</td><td>{a.comment}</td><td>{a.decided_by}</td></tr>))}</tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="container-fluid" style={{ background: "#f3f1fe", padding: "10px", borderRadius: "10px", border: "1px solid white" }}>
            <div style={{ marginBottom: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-success btn-sm" disabled={serverExporting} onClick={downloadServerExcel}>
                {serverExporting ? "Preparing Excel…" : "⭳ Full Excel (.xlsx)"}
              </button>
              <button type="button" className="btn btn-default btn-sm" disabled={loading} onClick={load}>↻ Refresh grid</button>
              {listError && <span style={{ color: "#a94442", fontSize: 12 }}>List error: {listError}</span>}
              {!loading && !listError && <span style={{ color: "#555", fontSize: 12 }}>{rows.length} companies</span>}
            </div>
            {loading ? <p>Loading…</p> : (
              // overflow wrapper = grid-lock fix: 13 columns scroll inside,
              // page never freezes; DataTable adds search/sort/pagination/CSV-Excel.
              <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 420, border: "1px solid #ccc", background: "#fff" }}>
                <DataTable<Co>
                  columns={[
                    { key: "comp_code", label: "CODE" },
                    { key: "company_name", label: "NAME" },
                    { key: "city", label: "CITY" },
                    { key: "state", label: "STATE" },
                    { key: "pf_reg_no", label: "PF REGISTRATION NO" },
                    { key: "pf_reg_office", label: "PF REGISTRATION OFFICE" },
                    { key: "company_pan_no", label: "PAN NO" },
                    { key: "company_tan_no", label: "TAN NO" },
                    { key: "service_tax_reg_no", label: "GST REGISTRATION NO" },
                    { key: "emp_series_init", label: "EMPLOYEE SERIES INIT" },
                    { key: "company_website", label: "COMPANY WEBSITE" },
                    { key: "company_contact_no", label: "COMPANY CONTACT NO" },
                    { key: "company_cin_no", label: "COMPANY CIN NO" },
                  ]}
                  rows={rows}
                  rowKey={(r) => r.id}
                  onRowClick={(r) => selectRow(r)}
                  selectedKey={selected?.id ?? null}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
