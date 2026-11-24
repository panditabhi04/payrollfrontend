"use client";

/**
 * Branch Master — faithful 1:1 replica of legacy UnitMaster.aspx (menu label
 * "Branch Master"; DB table pay_unit_master / UNIT_CODE — "Unit" == "Branch").
 *
 * Same title "BRANCH MASTER", the same header block with the cascading
 * Client -> Branch State -> Branch City / Designation chain, the jQuery-UI tab
 * strip (Designation Details, Heads Info, Send Email, Approval Upload, Fire
 * Extinguisher Info, Bulk Branch Upload, RM Info, SO/JSO, Office Rent Info),
 * same labels, * markers, dropdown values, exact validation messages, buttons
 * and the UnitGridView columns.
 *
 * Persistence: core branch fields + the five Heads (operation/finance/location/
 * admin/other) -> /api/masters/units (server-validated). Child-list tabs with no
 * modern store yet render exactly as legacy with a note (not faked).
 */

import { useEffect, useState, useCallback, type CSSProperties } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import { API_BASE_URL } from "@/lib/api/client";
import { listItems, createItem, deleteItem } from "@/lib/api/crud";
import { Field, Sel, Txt, onlyNum, onlyDec, onlyAlpha, alnumSlash, alphaAddr, errMsg, type Opt } from "@/components/formkit";
import ExportButtons from "@/components/ExportButtons";

const BASE = "/api/masters/units";
const UROWS = "/api/masters/unit-zone-rows";
const IMGS = "/api/masters/company-images";
const SVC = "/api/masters/client-services";

const LOCATION_TYPES = ["Branch", "Regional Office", "Zonal Office", "Head Office"];
const BRANCH_TYPES = [{ v: "0", t: "Select" }, { v: "Metro", t: "Metro" }, { v: "Non Metro", t: "Non Metro" }];
const BRANCH_STATUS = [{ v: "0", t: "Active" }, { v: "1", t: "Closed" }, { v: "2", t: "Hold" }];
const SHIFT_TYPE = [{ v: "3", t: "Select" }, { v: "0", t: "Common" }, { v: "1", t: "Shift 1" }, { v: "2", t: "Shift 2" }];
const YESNO_SEL = [{ v: "Select", t: "Select" }, { v: "Yes", t: "Yes" }, { v: "No", t: "No" }];
const APPLICABLE = [{ v: "0", t: "Not Applicable" }, { v: "1", t: "Applicable" }];
const SHIFTWISE = [{ v: "0", t: "No" }, { v: "1", t: "Yes" }];
const TITLES = ["Select", "Mr.", "Mrs.", "Ms."];
const HALF_HOURS = Array.from({ length: 48 }, (_, i) => `${Math.floor(i / 2)}:${i % 2 ? "30" : "00"}`);
const IN_TIMES = ["Flexible", ...HALF_HOURS];

type Tab = "menu1" | "menu3" | "item9" | "item11" | "item12" | "menu2" | "item13" | "item14" | "item15" | "item10";
const TABS: { id: Tab; label: string }[] = [
  { id: "menu1", label: "Designation Details" },
  { id: "menu3", label: "Heads Info" },
  { id: "item9", label: "Send Email" },
  { id: "item11", label: "Approval Upload" },
  { id: "item12", label: "Fire Extinguisher Info" },
  { id: "menu2", label: "Bulk Branch Upload" },
  { id: "item13", label: "RM Info" },
  { id: "item14", label: "SO/JSO" },
  { id: "item15", label: "Office Rent Info" },
  { id: "item10", label: "Company" },
];

// Legacy dropdown values (UnitMaster.aspx).
const SENDMAIL_TYPES = [
  { v: "Select", t: "Select" }, { v: "Location_Head", t: "Location_Head" },
  { v: "Operation_Head", t: "Operation_Head" }, { v: "Finance_Head", t: "Finance_Head" },
  { v: "Admin_Head", t: "Admin_Head" }, { v: "Other_Head", t: "Other_Head" },
];
const SO_DESIGS = [{ v: "Select", t: "Select" }, { v: "SO", t: "SO" }, { v: "JSO", t: "JSO" }];
const FIRE_TYPES = [
  { v: "Select", t: "Select" }, { v: "Class_ABC", t: "Class_ABC" }, { v: "CO2", t: "CO2" },
  { v: "Clean_Agent", t: "Clean_Agent" },
];
const FIRE_WTS = [{ v: "Select", t: "Select" }, ...["1", "1.5", "2", "2.5", "3", "3.5", "4", "4.5", "5", "5.5", "6", "6.5", "7", "7.5", "8", "9", "9.5", "10"].map((w) => ({ v: w, t: w }))];
const PLUS: CSSProperties = { border: "none", background: "transparent", cursor: "pointer", fontSize: "22px", color: "#337ab7" };
const TH: CSSProperties = { backgroundColor: "#006699", color: "White", fontWeight: "bold" };
const TD_DEL: CSSProperties = { border: "none", background: "transparent", cursor: "pointer", color: "#d9534f", fontSize: "14px" };

const HEADS = [
  { key: "location", label: "Location Head" },
  { key: "operation", label: "Operation Head" },
  { key: "finance", label: "Finance Head" },
  { key: "admin", label: "Admin Head" },
  { key: "other", label: "Other" },
];
// Legacy send_mail_validation/rm_validation/so_validation email regex check.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Legacy hide_company_tab(): Company tab only for this client (display name).
const COMPANY_CLIENT = "Reliance Capital Ltd.";

interface Un {
  id: number; unit_code: string; client_code: string; state_name: string; unit_name: string;
  unit_add1: string; unit_add2: string; unit_city: string; emp_count: number | string; permanent_count?: number; reliever_count?: number; branch_status: string;
}
type Form = Record<string, string>;
const EMPTY: Form = {
  client_code: "", state_name: "", unit_city: "", unit_code: "", client_branch_code: "", opus_no: "",
  unit_name: "", unit_add1: "", unit_add2: "", pincode: "", unit_lattitude: "", unit_longtitude: "",
  area_meters: "0", zone: "", region: "", file_no: "0", unit_email_id: "", branch_cost_centre_code: "",
  pc_code: "", distinctive_code: "", location_type: "Branch", branch_type: "0", material_area: "0",
  branch_status: "0", branch_close_date: "", shift_type: "3", reporting_time: "0:00", in_time: "Flexible",
  out_time: "0:00", labour_office: "Select", budget_material: "", android_attendances: "Select",
  rm_service: "0", admin_expense: "0", shiftwise: "0",
  reason_for_updation: "", gst_row_id: "",
  // heads (5 x fields) filled dynamically head_<key>_name/mobile/email/title
};

function ge(o: Record<string, string | null> | null, k: string) { return (o?.[k] ?? "") as string; }
async function getJSON<T>(path: string): Promise<T | null> {
  try { const r = await fetch(`${API_BASE_URL}${path}`, { credentials: "include", headers: { Accept: "application/json" }, cache: "no-store" }); return r.ok ? (await r.json()) as T : null; }
  catch { return null; }
}

interface DesignationCount { state: string; designation: string; unit_code: string; hours: string; count?: string | number; branch_status?: string; category?: string; start_date?: string; end_date?: string }

async function listByUnit<T>(unitCode: string, rowType?: string): Promise<T[]> {
  const q = `?unit_code=${encodeURIComponent(unitCode)}${rowType ? `&row_type=${rowType}` : ""}`;
  const d = await getJSON<{ results: T[] }>(`${UROWS}/lookup/${q}`);
  return d?.results ?? [];
}

export default function BranchMaster() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [tab, setTab] = useState<Tab>("menu1");
  const [f, setF] = useState<Form>({ ...EMPTY });
  const [selected, setSelected] = useState<Un | null>(null);
  const [rows, setRows] = useState<Un[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clients, setClients] = useState<Opt[]>([]);
  // Zone / Region drop-downs: the zones (and, for the chosen zone, regions) defined for the client in Client Master.
  // Location-wise GST clients (Client Master > GST Info): the branch is billed under one of the client's GST rows.
  const [locwiseClients, setLocwiseClients] = useState<string[]>([]);
  const [gstRowsOfClient, setGstRowsOfClient] = useState<{ id: number; region: string; field1: string; field2: string; field5: string; field4: string }[]>([]);
  const [zoneOpts, setZoneOpts] = useState<Opt[]>([{ v: "", t: "Select" }]);
  const [regionOpts, setRegionOpts] = useState<Opt[]>([{ v: "", t: "Select" }]);
  const withCurrent = (opts: Opt[], cur: string): Opt[] =>
    cur && !opts.some((o) => o.v === cur) ? [...opts, { v: cur, t: cur }] : opts;
  useEffect(() => {
    if (!f.client_code) { setZoneOpts([{ v: "", t: "Select" }]); setRegionOpts([{ v: "", t: "Select" }]); return; }
    getJSON<{ zones: string[]; regions: string[] }>(
      `/api/masters/unit-zone-options/?client_code=${encodeURIComponent(f.client_code)}&zone=${encodeURIComponent(f.zone || "")}`)
      .then((d) => {
        setZoneOpts([{ v: "", t: "Select" }, ...(d?.zones ?? []).map((z) => ({ v: z, t: z }))]);
        setRegionOpts([{ v: "", t: "Select" }, ...(d?.regions ?? []).map((r) => ({ v: r, t: r }))]);
      });
  }, [f.client_code, f.zone]);
  const [designCounts, setDesignCounts] = useState<DesignationCount[]>([]);
  const [stateCities, setStateCities] = useState<Record<string, string[]>>({});
  const [listError, setListError] = useState("");
  const [serverExporting, setServerExporting] = useState(false);
  const [reasonHistory, setReasonHistory] = useState<string[]>([]);
  // Expired Unit List modal (legacy #attendance): agreement end-dates per client.
  const [expOpen, setExpOpen] = useState(false);
  const [expClient, setExpClient] = useState("");
  const [expState, setExpState] = useState("");
  const [expStates, setExpStates] = useState<string[]>([]);
  const [expSvc, setExpSvc] = useState<Record<string, string>[]>([]);
  // Staged child grids (legacy ViewState tables) — bulk-saved with the branch.
  const [desigRows, setDesigRows] = useState<Record<string, string>[]>([]);
  const [mailRows, setMailRows] = useState<Record<string, string>[]>([]);
  const [rmRows, setRmRows] = useState<Record<string, string>[]>([]);
  const [soRows, setSoRows] = useState<Record<string, string>[]>([]);
  const [fireRows, setFireRows] = useState<Record<string, string>[]>([]);
  const [rentRows, setRentRows] = useState<Record<string, string>[]>([]);
  const [compRows, setCompRows] = useState<Record<string, string>[]>([]);
  const [apprDocs, setApprDocs] = useState<Record<string, string | number>[]>([]);
  // Entry drafts per tab.
  const [dg, setDg] = useState({ designation: "Select", category: "", count: "", hours: "", start: "", end: "" });
  const [ml, setMl] = useState({ type: "Select", name: "", email: "", mobile: "" });
  const [rm, setRm] = useState({ cluster: "", name: "", email: "", mobile: "", code: "" });
  const [so, setSo] = useState({ rm: "Select", designation: "Select", name: "", email: "", mobile: "" });
  const [fr, setFr] = useState({ applicable: "Not Applicable", start: "", expiry: "", type: "Select", weight: "Select", vendor: "", vendorNo: "", report: "" });
  const [rt, setRt] = useState({ bank: "", holder: "", acno: "", ifsc: "" });
  const [cp, setCp] = useState({ name: "", gst: "", address: "", pct: "" });
  const [appr, setAppr] = useState({ desc: "", from: "", to: "" });
  const [apprFile, setApprFile] = useState<File | null>(null);
  const [bulkFile, setBulkFile] = useState<File | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  // Excel-grid search (filters the loaded rows client-side).
  const [gridQuery, setGridQuery] = useState("");

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  // legacy in_out_rpt()/in_out_rpt1(): compare the numeric value of "H:MM" (colon stripped).
  const tnum = (t: string) => parseInt((t || "").replace(":", ""), 10);
  const setTime = (k: "in_time" | "out_time", v: string) => {
    const n = { reporting_time: f.reporting_time, in_time: f.in_time, out_time: f.out_time, [k]: v };
    if (k === "in_time" && tnum(n.reporting_time) > tnum(n.in_time)) {
      alert("Reporting time should be less than Intime.");
      setF((p) => ({ ...p, in_time: "Flexible" }));
      return;
    }
    if (k === "out_time" && tnum(n.in_time) > tnum(n.out_time)) {
      alert("Out time should be less than In time.");
      setF((p) => ({ ...p, out_time: "0:00" }));
      return;
    }
    set(k, v);
  };

  useEffect(() => { getMe().then((m) => { setMe(m); setAuthChecked(true); }); }, []);
  useEffect(() => {
    getJSON<{ results: { client_code: string; client_name: string; gst_locationwise?: string }[] }>("/api/masters/clients/?page_size=all")
      .then((d) => {
        setClients((d?.results ?? []).map((c) => ({ v: c.client_code, t: c.client_name })));
        setLocwiseClients((d?.results ?? []).filter((c) => c.gst_locationwise === "1").map((c) => c.client_code));
      });
    // Unpaginated lookup (paginated list is capped at 200 of 5,393 rows).
    getJSON<{ states: string[]; cities: Record<string, string[]> }>("/api/masters/states/lookup/").then((d) => {
      if (d && d.cities) {
        setStateCities(d.cities);
      } else {
        getJSON<{ results: { state_name: string; city: string }[] }>("/api/masters/states/?page_size=all").then((f2) => {
          const cities: Record<string, string[]> = {};
          (f2?.results ?? []).forEach((s) => { (cities[s.state_name] ||= []).push(s.city); });
          setStateCities(cities);
        });
      }
    });
  }, []);

  useEffect(() => {
    if (!f.client_code || !locwiseClients.includes(f.client_code)) { setGstRowsOfClient([]); return; }
    getJSON<{ results: { id: number; region: string; field1: string; field2: string; field5: string; field4: string; row_type?: string }[] }>(
      `/api/masters/client-zone-rows/?client_code=${encodeURIComponent(f.client_code)}&row_type=GST&page_size=all`)
      .then((d) => setGstRowsOfClient((d?.results ?? []).filter((z) => (z.row_type || "GST").toUpperCase() === "GST")));
  }, [f.client_code, locwiseClients]);
  useEffect(() => {
    if (!f.client_code) { setDesignCounts([]); return; }
    getJSON<{ results: DesignationCount[] }>(`/api/masters/client-designation-counts/lookup/?client_code=${encodeURIComponent(f.client_code)}`)
      .then((d) => setDesignCounts(d?.results ?? []));
  }, [f.client_code]);

  const clientStates = Array.from(new Set(designCounts.map((d) => d.state).filter(Boolean))).sort();

  const load = useCallback(async () => {
    setLoading(true);
    setListError("");
    try {
      const all: Un[] = [];
      let page = 1;
      for (;;) {
        const res = await listItems<Un>(BASE, { page, pageSize: 200 });
        const batch = Array.isArray(res) ? (res as unknown as Un[]) : (res.results ?? []);
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
      if (/403/.test(msg)) setListError("Permission denied (403): this login does not have Read access to Branch Master.");
      else setListError(msg || "Branch list load failed.");
    } finally { setLoading(false); }
  }, []);

  // Free Count (legacy lnk_freecount): client + branch_status != 0, grouped by unit+designation
  const loadFreeCount = useCallback(async (clientCode: string) => {
    const d = await getJSON<{ results: { client_name: string; state_name: string; unit_name: string; designation: string; count: string }[] }>(
      `${SVC}/free-count/?client_code=${encodeURIComponent(clientCode)}`);
    return d?.results ?? [];
  }, []);

  // Expired Unit List (legacy #attendance modal): expired branch agreements per
  // client+state. Columns mirror the legacy gv_start_end_date_details grid; also
  // returns the client's distinct states for the modal State dropdown.
  const loadExpired = useCallback(async (clientCode: string, state: string) => {
    const d = await getJSON<{ results: { start_date: string; end_date: string; client_name: string; unit_name: string; designation: string }[]; states: string[] }>(
      `${SVC}/expired/?client_code=${encodeURIComponent(clientCode)}&state=${encodeURIComponent(state)}`);
    return { results: d?.results ?? [], states: d?.states ?? [] };
  }, []);
  useEffect(() => { if (authChecked && me) load(); }, [authChecked, me, load]);

  // next Branch Code (legacy auto U001..). Generated for new records; readonly.
  const nextUnitCode = () => {
    let mx = 0;
    rows.forEach((r) => { const m = /^[A-Za-z]*0*(\d+)$/.exec(r.unit_code || ""); if (m) mx = Math.max(mx, +m[1]); });
    return `U${String(mx + 1).padStart(3, "0")}`;
  };

  const clearForm = () => {
    setSelected(null); setF({ ...EMPTY }); setTab("menu1"); setReasonHistory([]);
    setExpOpen(false); setExpClient(""); setExpState(""); setExpStates([]); setExpSvc([]);
    setDesigRows([]); setMailRows([]); setRmRows([]); setSoRows([]); setFireRows([]);
    setRentRows([]); setCompRows([]); setApprDocs([]);
    setDg({ designation: "Select", category: "", count: "", hours: "", start: "", end: "" });
    setMl({ type: "Select", name: "", email: "", mobile: "" });
    setRm({ cluster: "", name: "", email: "", mobile: "", code: "" });
    setSo({ rm: "Select", designation: "Select", name: "", email: "", mobile: "" });
    setFr({ applicable: "Not Applicable", start: "", expiry: "", type: "Select", weight: "Select", vendor: "", vendorNo: "", report: "" });
    setRt({ bank: "", holder: "", acno: "", ifsc: "" });
    setCp({ name: "", gst: "", address: "", pct: "" });
    setAppr({ desc: "", from: "", to: "" }); setApprFile(null); setBulkFile(null);
  };
  const confirmRow = () => confirm("Are you Sure You Want to Delete Record");

  // Legacy ddl_desid (AutoPostBack): picking a Designation auto-fills Start /
  // End Date + Category + Working Hours from the client's designation row for
  // the branch state (pay_designation_count, unit_code null, limit 1). These
  // stay read-only exactly like legacy (End Date is ReadOnly there).
  const onDesignationPick = (v: string) => {
    const match = designCounts.find((d) =>
      d.designation === v && (!d.unit_code || !d.unit_code.trim()) &&
      (!f.state_name || !d.state || d.state === f.state_name))
      ?? designCounts.find((d) => d.designation === v && (!d.unit_code || !d.unit_code.trim()));
    setDg((p) => ({
      ...p,
      designation: v,
      category: match?.category ?? p.category,
      hours: String((match as Record<string, unknown> | undefined)?.hours ?? p.hours),
      start: String(match?.start_date ?? p.start),
      end: String(match?.end_date ?? p.end),
    }));
  };

  const selectRow = async (r: Un) => {
    const full = await getJSON<Record<string, string | null>>(`${BASE}/${r.id}/`);
    setSelected(r);
    const base: Form = {
      ...EMPTY,
      client_code: ge(full, "client_code"), state_name: ge(full, "state_name"), unit_city: ge(full, "unit_city"),
      unit_code: ge(full, "unit_code"), client_branch_code: ge(full, "client_branch_code"), opus_no: ge(full, "opus_no"),
      unit_name: ge(full, "unit_name"), unit_add1: ge(full, "unit_add1"), unit_add2: ge(full, "unit_add2"),
      pincode: ge(full, "pincode"), unit_lattitude: ge(full, "unit_lattitude"), unit_longtitude: ge(full, "unit_longtitude"),
      zone: ge(full, "zone"), file_no: ge(full, "file_no"), unit_email_id: ge(full, "unit_email_id"), gst_row_id: ge(full, "gst_row_id"),
      area_meters: ge(full, "area_meters") || "0", region: ge(full, "region") || "",
      material_area: ge(full, "material_area") || "0",
      branch_cost_centre_code: ge(full, "branch_cost_centre_code"), location_type: ge(full, "location_type") || "Branch",
      branch_type: ge(full, "branch_type") || "0", branch_status: ge(full, "branch_status") || "0",
      branch_close_date: ge(full, "branch_close_date"), reporting_time: ge(full, "reporting_time") || "0:00",
      pc_code: ge(full, "pc_code"), distinctive_code: ge(full, "distinctive_code"),
      labour_office: ge(full, "labour_office") || "Select", shift_type: ge(full, "shift_type") || "3",
      in_time: ge(full, "in_time") || "Flexible", out_time: ge(full, "out_time") || "0:00",
      android_attendances: ge(full, "android_attendances") || "Select",
      rm_service: ge(full, "rm_service") || "0", admin_expense: ge(full, "admin_expense") || "0",
      shiftwise: ge(full, "shiftwise") || "0", budget_material: ge(full, "budget_material") || "",
    };
    HEADS.forEach((h) => {
      base[`head_${h.key}_name`] = ge(full, `${h.key}_head_name`);
      base[`head_${h.key}_mobile`] = ge(full, `${h.key}_head_mobile`);
      base[`head_${h.key}_email`] = ge(full, `${h.key}_head_email`);
      base[`head_${h.key}_title`] = ge(full, `${h.key}_head_title`) || "Select";
      base[`head_${h.key}_pmobile`] = ge(full, `${h.key}_head_pmobile`);
      base[`head_${h.key}_pemail`] = ge(full, `${h.key}_head_pemail`);
      base[`head_${h.key}_birthdate`] = ge(full, `${h.key}_head_birthdate`);
      base[`head_${h.key}_anniversary`] = ge(full, `${h.key}_head_anniversary`);
    });
    setF(base);
    setTab("menu1");
    // Reason history (legacy lbx_reason_updation, @#$%-separated).
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
    // Child grids for this branch.
    const ucode = ge(full, "unit_code");
    if (ucode) {
      const [des, sen, rms, sos, fir, ren, com] = await Promise.all([
        listByUnit<Record<string, string>>(ucode, "DESIG"), listByUnit<Record<string, string>>(ucode, "SENDEMAIL"),
        listByUnit<Record<string, string>>(ucode, "RM"), listByUnit<Record<string, string>>(ucode, "SO"),
        listByUnit<Record<string, string>>(ucode, "FIRE"), listByUnit<Record<string, string>>(ucode, "RENT"),
        listByUnit<Record<string, string>>(ucode, "COMPANY"),
      ]);
      setDesigRows(des.map((z) => ({ designation: z.field1 || "", count: z.field2 || "", hours: z.field3 || "", start: z.field4 || "", end: z.field5 || "", category: z.field6 || "" })));
      setMailRows(sen.map((z) => ({ type: z.field1 || "", name: z.field2 || "", email: z.field3 || "", mobile: z.field4 || "" })));
      setRmRows(rms.map((z) => ({ cluster: z.field1 || "", name: z.field2 || "", email: z.field3 || "", mobile: z.field4 || "", code: z.field5 || "" })));
      setSoRows(sos.map((z) => ({ rm: z.field1 || "", designation: z.field2 || "", name: z.field3 || "", email: z.field4 || "", mobile: z.field5 || "" })));
      setFireRows(fir.map((z) => ({ applicable: z.field1 || "", start: z.field2 || "", expiry: z.field3 || "", type: z.field4 || "", weight: z.field5 || "", vendor: z.field6 || "", vendorNo: z.field7 || "", report: z.field8 || "" })));
      setRentRows(ren.map((z) => ({ bank: z.field1 || "", holder: z.field2 || "", acno: z.field3 || "", ifsc: z.field4 || "" })));
      setCompRows(com.map((z) => ({ name: z.field1 || "", gst: z.field2 || "", address: z.field3 || "", pct: z.field4 || "" })));
      const docs = await getJSON<{ results: Record<string, string | number>[] }>(
        `${IMGS}/?comp_code=${encodeURIComponent(me?.scope?.comp_code ?? "")}&unit_code=${encodeURIComponent(ucode)}`);
      setApprDocs(docs?.results ?? []);
    } else {
      setDesigRows([]); setMailRows([]); setRmRows([]); setSoRows([]); setFireRows([]); setRentRows([]); setCompRows([]); setApprDocs([]);
    }
  };

  // exact legacy Req_validation() for the stored core fields (client mirror of server).
  // Client Branch/Opus Code only for the 5 BAJAJ ALLIANZ clients, Zone/Region
  // only for BAJAJ ALLIANZ GENERAL INSURANCE COMPANY LTD./Piramal, Sq.Ft only
  // for RBL Bank Ltd (legacy compares the client NAME text). Labour-office
  // check is commented out in legacy, so it is intentionally not enforced.
  const clientName = clients.find((c) => c.v === f.client_code)?.t ?? "";
  const BAJAJ5 = ["BAJAJ ALLIANZ GENERAL INSURANCE CO. LTD TM", "BAJAJ ALLIANZ GENERAL INSURANCE COMPANY LIMITED HK", "BAJAJ ALLIANZ GENERAL INSURANCE COMPANY LIMITED SG", "BAJAJ ALLIANZ LIFE INSURANCE COMPANY LIMITED SG", "BAJAJ ALLIANZ LIFE INSURANCE COMPANY LIMITED HK"];
  const ZONE2 = ["BAJAJ ALLIANZ GENERAL INSURANCE COMPANY LTD.", "Piramal Capital & Housing Finance Limited"];
  const validate = (): string | null => {
    if (!f.client_code || f.client_code === "Select") return "Please Select Client.|un_client";
    if (!f.state_name || f.state_name === "Select") return "Please Branch State  !!!|un_state";
    if (!f.unit_city) return "Please Enter Branch City|un_city";
    if (BAJAJ5.includes(clientName) && !f.client_branch_code.trim()) return "Please Enter Client Branch  Code|un_cbcode";
    if (BAJAJ5.includes(clientName) && !f.opus_no.trim()) return "Please Enter Opus Code|un_opus";
    if (!f.unit_name.trim()) return "Please Enter Branch Name|un_name";
    if (!f.unit_add1.trim()) return "Please Enter Location|un_add1";
    if (!f.unit_add2.trim()) return "street/Road/Lane is Empty ! Please select it from Select Location|un_add2";
    if (f.pincode.trim().length !== 6) return "Please Enter Pin Number Minimum 6 Digits|un_pin";
    if (!f.unit_lattitude.trim()) return "Latitude is Empty ! Please select it from Select Location|un_lat";
    if (!f.unit_longtitude.trim()) return "Longitute is Empty ! Please select it from Select Location|un_lon";
    if (!f.area_meters.trim()) return "Area in Meters is Empty ! Please select it from Select Location|un_area";
    if (ZONE2.includes(clientName) && (!f.zone || f.zone === "Select")) return "Please Select ZONE.|un_zone";
    if (ZONE2.includes(clientName) && (!f.region || f.region === "Select") && f.zone && f.zone !== "Select") return "Please Select Region.|un_region";
    if (!f.file_no.trim() || f.file_no.trim() === "0") return "Please Enter File Number|un_file";
    if (clientName === "RBL Bank Ltd" && f.material_area.trim() === "0") return "Please Enter Area in Square Ft|un_matarea";
    if (f.branch_status === "1" && !f.branch_close_date) return "Please Enter Branch Close Date|un_closedate";
    // Legacy btn_edit_Click: state is frozen on edit (previousstate ViewState).
    if (selected && f.state_name !== selected.state_name) return "You Can Not Change Statename|un_state";
    // Legacy btn_add_Click/btn_edit_Click: `if (gv_itemslist.Rows.Count >= 1)`
    // else "Please Click on Add Button to add Designation" — no save/update
    // without at least one Designation Details row.
    if (desigRows.length === 0) return "Please Click on Add Button to add Designation|";
    // Legacy btn_add/btn_edit: Reliance company-group percentages must sum to 100.
    if (clientName === COMPANY_CLIENT && compRows.length > 0) {
      const sum = compRows.reduce((s, r) => s + (parseFloat(r.pct || "0") || 0), 0);
      if (sum !== 100) return "Company Percent Should be Equals To 100 !!|";
    }
    // Legacy r_val(): reason required when editing.
    if (selected && !f.reason_for_updation.trim()) return "Please Specify Reason For Updation !!!|un_reason";
    return null;
  };
  const fail = (err: string | null): boolean => {
    if (!err) return false;
    const idx = err.lastIndexOf("|");
    const msg = idx >= 0 ? err.slice(0, idx) : err;
    const id = idx >= 0 ? err.slice(idx + 1) : "";
    alert(msg);
    if (id) setTimeout(() => document.getElementById(id)?.focus?.(), 60);
    else if (msg.includes("Designation")) setTab("menu1");
    return true;
  };
  // Legacy pincode_validation() on change (exact text, note "Digit" singular).
  // (Attached on blur to avoid alerting on every keystroke.)

  const corePayload = () => {
    const p: Record<string, string> = {
      client_code: f.client_code, state_name: f.state_name, unit_city: f.unit_city,
      unit_code: f.unit_code || nextUnitCode(), client_branch_code: f.client_branch_code, opus_no: f.opus_no,
      unit_name: f.unit_name.trim(), unit_add1: f.unit_add1.trim(), unit_add2: f.unit_add2.trim(),
      pincode: f.pincode.trim(), unit_lattitude: f.unit_lattitude.trim(), unit_longtitude: f.unit_longtitude.trim(),
      area_meters: f.area_meters.trim(), region: f.region.trim(), material_area: f.material_area.trim(),
      zone: f.zone, file_no: f.file_no.trim(), unit_email_id: f.unit_email_id.trim(), gst_row_id: f.gst_row_id,
      branch_cost_centre_code: f.branch_cost_centre_code, location_type: f.location_type,
      branch_type: f.branch_type, branch_status: f.branch_status, branch_close_date: f.branch_close_date || "",
      reporting_time: f.reporting_time, shift_type: f.shift_type, in_time: f.in_time, out_time: f.out_time,
      android_attendances: f.android_attendances, rm_service: f.rm_service, admin_expense: f.admin_expense,
      shiftwise: f.shiftwise, budget_material: f.budget_material.trim(),
      pc_code: f.pc_code.trim(), distinctive_code: f.distinctive_code.trim(),
      labour_office: f.labour_office === "Select" ? "" : f.labour_office,
      reason_for_updation: f.reason_for_updation.trim(),
    };
    HEADS.forEach((h) => {
      p[`${h.key}_head_name`] = f[`head_${h.key}_name`] ?? "";
      p[`${h.key}_head_mobile`] = f[`head_${h.key}_mobile`] ?? "";
      p[`${h.key}_head_email`] = f[`head_${h.key}_email`] ?? "";
      p[`${h.key}_head_title`] = (f[`head_${h.key}_title`] ?? "Select") === "Select" ? "" : f[`head_${h.key}_title`];
      p[`${h.key}_head_pmobile`] = f[`head_${h.key}_pmobile`] ?? "";
      p[`${h.key}_head_pemail`] = f[`head_${h.key}_pemail`] ?? "";
      p[`${h.key}_head_birthdate`] = f[`head_${h.key}_birthdate`] ?? "";
      p[`${h.key}_head_anniversary`] = f[`head_${h.key}_anniversary`] ?? "";
    });
    return p;
  };

  // Branch + all child grids are saved by ONE server transaction (all or nothing).
  const onSave = async () => {
    if (fail(validate())) return;
    setBusy(true);
    try {
      const res = await createItem<Un>(`${BASE}/save-with-grids`, { core: corePayload(), grids: gridsPayload() });
      if (res.ok) {
        const tok = (res.data as { login_setup_token?: string } | null)?.login_setup_token;
        const ucode = (res.data as Un | null)?.unit_code || displayCode;
        alert("Record added successfully!!" + (tok ? `
Branch login "${ucode}" created. One-time password setup token (deliver securely): ${tok}` : "")); clearForm(); load();
      }
      else if (res.status === 403) alert("You do not have permission for this action.");
      else alert(errMsg(res.data) || "Record Adding Failed...");
    } finally { setBusy(false); }
  };
  const onUpdate = async () => {
    if (!selected) return;
    if (fail(validate())) return;
    setBusy(true);
    try {
      const res = await createItem<Un>(`${BASE}/save-with-grids`, { id: selected.id, core: corePayload(), grids: gridsPayload() });
      if (res.ok) { alert("Record updated successfully!!"); clearForm(); load(); }
      else if (res.status === 403) alert("You do not have permission for this action.");
      else alert(errMsg(res.data) || "Record updation failed!!");
    } finally { setBusy(false); }
  };
  const onDelete = async () => {
    if (!selected) { alert("Record not Available"); return; }
    if (!confirm("Are you Sure You Want to Delete Record")) return;
    setBusy(true);
    try {
      const res = await deleteItem(BASE, selected.id);
      if (res.ok) { alert("Record deleted successfully!!"); clearForm(); load(); }
      else if (res.status === 403) alert("Only administrators can delete a record.");
      else alert(errMsg(res.data) || "Record deletion failed !!");
    } finally { setBusy(false); }
  };
  // ---- child-grid staging (legacy ViewState tables, exact messages) ----
  const addDesig = () => {
    if (designCounts.length === 0) { alert("Please add Designation at Client level!!!"); return; }
    if (!dg.designation || dg.designation === "Select") { alert("Please Select Designation Name First!!!"); return; }
    if (!dg.count.trim() || dg.count.trim() === "0") { alert("Designation Count should be greater than zero (0)!!!"); return; }
    if (!dg.hours.trim()) { alert("Please Add Working Hours!!!"); return; }
    if (!dg.start) { alert("Please Select Start Date."); return; }
    if (!dg.end) { alert("Please Select End Date."); return; }
    // Legacy lnkbtn_addmoreitem_Click: same designation + same start date twice.
    if (desigRows.some((r) => r.designation === dg.designation && r.start === dg.start)) { alert("same starting date does not added"); return; }
    if (dg.start > dg.end) { alert("Start Date Cannot be Grater than  end date"); return; }
    // Legacy chkcount(): staged count must fit the client sanction
    // (pay_designation_count UNIT_CODE-null rows, branch_status 0).
    const num = (v: unknown) => { const n = parseInt(String(v ?? "0"), 10); return isNaN(n) ? 0 : n; };
    const sanction = designCounts
      .filter((d) => d.designation === dg.designation && (!d.unit_code || !d.unit_code.trim()) && (!d.branch_status || d.branch_status === "0"))
      .reduce((s, d) => s + num(d.count), 0);
    const staged = desigRows.filter((r) => r.designation === dg.designation).reduce((s, r) => s + num(r.count), 0);
    if (sanction > 0 && staged + num(dg.count) > sanction) { alert("For this designation,count limit already full fill."); return; }
    setDesigRows((p) => [...p, { ...dg }]);
    setDg({ designation: "Select", category: "", count: "", hours: "", start: "", end: "" });
  };
  const addMail = () => {
    if (!ml.type || ml.type === "Select") { alert("Please Select Send Email Type"); return; }
    if (!ml.name.trim()) { alert("Please Enter Head Name"); return; }
    if (!ml.email.trim()) { alert("Please Enter Head Email Id"); return; }
    if (!EMAIL_RE.test(ml.email.trim())) { alert("Please provide a valid email address"); return; }
    if (!ml.mobile.trim()) { alert("Please Enter Head Mobile Number"); return; }
    setMailRows((p) => [...p, { ...ml }]);
    setMl({ type: "Select", name: "", email: "", mobile: "" });
  };
  const addRm = () => {
    if (!rm.cluster.trim() || rm.cluster === "Select") { alert("Please Select Cluster Head"); return; }
    if (!rm.name.trim()) { alert("Please Enter RM Name"); return; }
    if (!rm.email.trim()) { alert("Please Enter RM Email Id"); return; }
    if (!EMAIL_RE.test(rm.email.trim())) { alert("Please provide a valid email address"); return; }
    if (!rm.mobile.trim()) { alert("Please Enter RM Mobile Number"); return; }
    setRmRows((p) => [...p, { ...rm }]);
    setRm({ cluster: "", name: "", email: "", mobile: "", code: "" });
  };
  const addSo = () => {
    if (!so.rm || so.rm === "Select") { alert("Please Select RM"); return; }
    if (!so.designation || so.designation === "Select") { alert("Please Select Designation"); return; }
    if (!so.name.trim()) { alert("Please Enter Name"); return; }
    if (!so.email.trim()) { alert("Please Enter Email Id"); return; }
    if (!EMAIL_RE.test(so.email.trim())) { alert("Please provide a valid email address"); return; }
    if (!so.mobile.trim()) { alert("Please Enter Mobile Number"); return; }
    setSoRows((p) => [...p, { ...so }]);
    setSo({ rm: "Select", designation: "Select", name: "", email: "", mobile: "" });
  };
  // Legacy fire_extinguisher() (exact order + texts, incl. trailing spaces).
  const addFire = () => {
    if (!fr.expiry) { alert("Please Enter Expiry Date"); return; }
    if (!fr.type || fr.type === "Select") { alert("Please Select Type Of Extinguisher "); return; }
    if (!fr.weight || fr.weight === "Select") { alert("Please Select Weight In KG "); return; }
    if (!fr.vendor.trim()) { alert("Please Enter Vendor Name"); return; }
    if (!fr.vendorNo.trim()) { alert("Please Enter Vendor Contact Number"); return; }
    if (!fr.report.trim()) { alert("Please Upload Fire Extinguisher Report"); return; }
    { const rp = fr.report.trim(); if (rp.includes(".") && !["JPG", "PNG", "JPEG"].includes((rp.split(".").pop() || "").toUpperCase())) { alert("Please select only JPG, PNG and JPEG Files !!!"); return; } }
    if (!f.client_code || f.client_code === "Select") { alert("Please Select Client"); return; }
    if (!f.state_name || f.state_name === "Select" || f.state_name === "0") { alert("Please Select State"); return; }
    if (!f.unit_city) { alert("Please Select State"); return; }
    if (!f.unit_name.trim()) { alert("Please Enter Branch Name "); return; }
    setFireRows((p) => [...p, { ...fr }]);
    setFr({ applicable: "Not Applicable", start: "", expiry: "", type: "Select", weight: "Select", vendor: "", vendorNo: "", report: "" });
  };
  const addRent = () => {
    if (!rt.bank.trim()) { alert("Please Enter Bank Name"); return; }
    if (!rt.acno.trim()) { alert("Please Enter Bank Account Number"); return; }
    if (!rt.ifsc.trim()) { alert("Please Enter IFSC Code"); return; }
    setRentRows((p) => [...p, { ...rt }]);
    setRt({ bank: "", holder: "", acno: "", ifsc: "" });
  };
  const addComp = () => {
    if (!cp.name.trim()) { alert("Please Enter Company Name"); return; }
    setCompRows((p) => [...p, { ...cp }]);
    setCp({ name: "", gst: "", address: "", pct: "" });
  };

  // All child grids, mapped to the typed rows the server stores (UnitZoneRow field1..8).
  const gridsPayload = () => ({
    DESIG: desigRows.map((r) => ({ field1: r.designation, field2: r.count, field3: r.hours, field4: r.start, field5: r.end, field6: r.category })),
    SENDEMAIL: mailRows.map((r) => ({ field1: r.type, field2: r.name, field3: r.email, field4: r.mobile })),
    RM: rmRows.map((r) => ({ field1: r.cluster, field2: r.name, field3: r.email, field4: r.mobile, field5: r.code })),
    SO: soRows.map((r) => ({ field1: r.rm, field2: r.designation, field3: r.name, field4: r.email, field5: r.mobile })),
    FIRE: fireRows.map((r) => ({ field1: r.applicable, field2: r.start, field3: r.expiry, field4: r.type, field5: r.weight, field6: r.vendor, field7: r.vendorNo, field8: r.report })),
    RENT: rentRows.map((r) => ({ field1: r.bank, field2: r.holder, field3: r.acno, field4: r.ifsc })),
    COMPANY: compRows.map((r) => ({ field1: r.name, field2: r.gst, field3: r.address, field4: r.pct })),
  });

  const getCookie = (name: string): string | null => {
    const m = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]+)"));
    return m ? decodeURIComponent(m[2]) : null;
  };

  const uploadAppr = async () => {
    if (!appr.desc.trim()) { alert("Please Enter Description"); return; }
    if (!apprFile) { alert("Please Upload File"); return; }
    if (!appr.from) { alert("Please Select Start Date"); return; }
    if (!appr.to) { alert("Please Select End Date"); return; }
    const ucode = selected ? f.unit_code : displayCode;
    if (!ucode) { alert("Save the branch first, then upload approval documents."); return; }
    setBusy(true);
    try {
      await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
      const fd = new FormData();
      fd.append("comp_code", me?.scope?.comp_code ?? "");
      fd.append("client_code", f.client_code);
      fd.append("unit_code", ucode);
      fd.append("description", appr.desc.trim());
      fd.append("start_date", appr.from);
      fd.append("end_date", appr.to);
      fd.append("file", apprFile);
      const res = await fetch(`${API_BASE_URL}${IMGS}/`, {
        method: "POST", credentials: "include",
        headers: { "X-CSRFToken": getCookie("csrftoken") ?? "" }, body: fd,
      });
      if (res.ok) {
        alert("Approval document uploaded!!");
        setAppr({ desc: "", from: "", to: "" }); setApprFile(null);
        const docs = await getJSON<{ results: Record<string, string | number>[] }>(
          `${IMGS}/?comp_code=${encodeURIComponent(me?.scope?.comp_code ?? "")}&unit_code=${encodeURIComponent(ucode)}`);
        setApprDocs(docs?.results ?? []);
      } else alert("Approval upload failed...");
    } finally { setBusy(false); }
  };

  const downloadAppr = async (id: string | number, name: string) => {
    const r = await fetch(`${API_BASE_URL}${IMGS}/${id}/download/`, { credentials: "include" });
    if (!r.ok) { alert("Download failed"); return; }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name || "file";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const deleteAppr = async (id: string | number) => {
    if (!confirmRow()) return;
    const res = await deleteItem(IMGS, id);
    if (res.ok) {
      alert("Record deleted successfully!!");
      setApprDocs((p) => p.filter((d) => String(d.id) !== String(id)));
    } else alert("Delete failed");
  };

  const downloadServerExcel = async () => {
    setServerExporting(true);
    try {
      const r = await fetch(`${API_BASE_URL}${BASE}/?export=excel`, { credentials: "include" });
      if (!r.ok) { alert(`Excel download failed (HTTP ${r.status})`); return; }
      const blob = await r.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "branches.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch { alert("Excel download failed"); }
    finally { setServerExporting(false); }
  };

  const fireReport = () => {
    const head = ["Sr No.", "Applicable", "Start Date", "Expiry Date", "Types Of Extinguisher", "Weight In KG", "Vendor Name", "Vendor Contact Number", "Report"];
    const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    const lines = [head.join(","), ...fireRows.map((r, i) =>
      [String(i + 1), r.applicable, r.start, r.expiry, r.type, r.weight, r.vendor, r.vendorNo, r.report].map((v) => esc(v ?? "")).join(","))];
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "fire_equipment_report.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  const bulkUpload = async () => {
    if (!bulkFile) { alert("Please select a CSV file first."); return; }
    setBulkBusy(true);
    try {
      await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
      const fd = new FormData();
      fd.append("file", bulkFile);
      const res = await fetch(`${API_BASE_URL}${BASE}/bulk-upload/`, {
        method: "POST", credentials: "include",
        headers: { "X-CSRFToken": getCookie("csrftoken") ?? "" }, body: fd,
      });
      const j = await res.json().catch(() => ({} as Record<string, unknown>));
      if (!res.ok) {
        alert(String(j.message ?? j.detail ?? errMsg(j) ?? "System Error - Please Try again...."));
        return;
      }
      // Legacy: failed rows come back as Branch_upload_issues (downloaded).
      const file = j.issues_file as { name: string; content_type: string; base64: string } | undefined;
      if (file) {
        const bin = atob(file.base64);
        const bytes = new Uint8Array(bin.length);
        for (let k = 0; k < bin.length; k++) bytes[k] = bin.charCodeAt(k);
        const a = document.createElement("a");
        a.href = URL.createObjectURL(new Blob([bytes], { type: file.content_type }));
        a.download = file.name;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      }
      if ((j.added as number) > 0) alert("New Branch Added Successfully... !!!");
      alert("File Uploaded Successfully...");
      setBulkFile(null);
      load();
    } finally { setBulkBusy(false); }
  };

  const onRecomputeEmpCount = async () => {    if (!selected) { alert("Select a branch first."); return; }
    setBusy(true);
    try {
      await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
      const m = document.cookie.match(/(^|; )csrftoken=([^;]+)/);
      const res = await fetch(`${API_BASE_URL}${BASE}/${selected.id}/recompute-emp-count/`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", "X-CSRFToken": m ? decodeURIComponent(m[2]) : "" },
      });
      const data = await res.json().catch(() => null) as { unit_code?: string; emp_count?: number } | null;
      if (res.ok && data) { alert(`Employee count recomputed for ${data.unit_code}: ${data.emp_count}`); load(); }
      else if (res.status === 403) alert("You do not have permission for this action.");
      else alert(errMsg(data) || "Recompute failed.");
    } finally { setBusy(false); }
  };

  const clientOpts: Opt[] = [{ v: "", t: "Select" }, ...clients];
  const stateOpts: Opt[] = [{ v: "", t: "Select" }, ...clientStates.map((s) => ({ v: s, t: s }))];
  const cityOpts: Opt[] = [{ v: "", t: "Select" }, ...(stateCities[f.state_name] ?? []).map((c) => ({ v: c, t: c }))];
  const displayCode = selected ? f.unit_code : (f.client_code ? nextUnitCode() : "");

  if (authChecked && !me) {
    return <div className="container-fluid"><div className="panel panel-primary">
      <div className="panel-heading" style={{ textAlign: "center" }}>BRANCH MASTER</div>
      <div style={{ padding: 16 }}>Please sign in. <Link href="/login">Go to login</Link></div>
    </div></div>;
  }

  return (
    <>
    <div className="container-fluid">
      {busy && (
        <div style={{ position: "fixed", inset: 0, background: "#CCCCCC", opacity: 0.7, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
          Please wait...
        </div>
      )}
      <div className="panel panel-primary" style={{ backgroundColor: "beige" }}>
        <div className="panel-heading">
          <div className="row">
            <div className="col-sm-1"></div>
            <div className="col-sm-9">
              <div style={{ textAlign: "center", color: "#fff", fontSize: "small" }}><b>BRANCH MASTER</b></div>
            </div>
            <div className="col-sm-2 text-right">
              <a href="#" onClick={(e) => { e.preventDefault(); window.open("html/UnitMaster.html", "popUpWindow", "height=500,width=600,left=100,top=100"); }} style={{ fontSize: "10px", color: "#fff" }}>
                <img src="/Images/help_ico.png" alt="Help" width={20} height={20} title="Help" />
              </a>
            </div>
          </div>
        </div>
        <br />
        <div className="panel-body" style={{ borderBottomLeftRadius: "2px", borderBottomRightRadius: "2px", backgroundColor: "beige" }}>
          <div className="container-fluid" style={{ background: "#f3f1fe", borderRadius: "10px", border: "1px solid white" }}>
            <br />
            <div className="lg-form cols3">
          <Sel label="Select Client :" req id="un_client" value={f.client_code} onChange={(v) => setF((p) => ({ ...p, client_code: v, state_name: "", unit_city: "" }))} opts={clientOpts} />
          <Sel label="Branch State :" req id="un_state" value={f.state_name} onChange={(v) => setF((p) => ({ ...p, state_name: v, unit_city: "" }))} opts={stateOpts} />
          <Sel label="Branch City :" req id="un_city" value={f.unit_city} onChange={(v) => set("unit_city", v)} opts={cityOpts} />
          <Field label="Branch Code :"><input className="lg-control" value={displayCode} readOnly /></Field>
          <Txt label="Client Branch Code :" id="un_cbcode" value={f.client_branch_code} onChange={(v) => set("client_branch_code", v)} maxLength={30} filter={alphaAddr} />
          <Txt label="Opus Code :" id="un_opus" value={f.opus_no} onChange={(v) => set("opus_no", v)} maxLength={30} filter={alphaAddr} />
          <Txt label="Branch Name :" req id="un_name" value={f.unit_name} onChange={(v) => set("unit_name", v)} maxLength={70} filter={alnumSlash} />
          <Txt label="Location(Place/City) :" req id="un_add1" value={f.unit_add1} onChange={(v) => set("unit_add1", v)} filter={alphaAddr} />
          <Txt label="Address(Street/Road/Lane) :" req id="un_add2" value={f.unit_add2} onChange={(v) => set("unit_add2", v)} maxLength={50} filter={alphaAddr} />
          <Field label="Pincode :" req><input id="un_pin" className="lg-control" maxLength={6} value={f.pincode}
            onChange={(e) => set("pincode", onlyNum(e.target.value))}
            onBlur={(e) => {
              if (onlyNum(e.target.value).length !== 6) {
                alert("Please Enter Pin Number Minimum 6 Digit");
                setTimeout(() => document.getElementById("un_pin")?.focus?.(), 50);
              }
            }} /></Field>
          <Txt label="Lattitude :" req id="un_lat" value={f.unit_lattitude} onChange={(v) => set("unit_lattitude", v)} filter={onlyDec} />
          <Txt label="Longitude :" req id="un_lon" value={f.unit_longtitude} onChange={(v) => set("unit_longtitude", v)} filter={onlyDec} />
          <Txt label="Area In Meters :" id="un_area" value={f.area_meters} onChange={(v) => set("area_meters", v)} filter={onlyNum} />
          <Sel label="Zone :" id="un_zone" value={f.zone} onChange={(v) => setF((p) => ({ ...p, zone: v, region: "" }))}
            opts={withCurrent(zoneOpts, f.zone)} />
          <Sel label="Region Name :" id="un_region" value={f.region} onChange={(v) => set("region", v)}
            opts={withCurrent(regionOpts, f.region)} />
          <Txt label="File No. :" req id="un_file" value={f.file_no} onChange={(v) => set("file_no", v)} maxLength={40} filter={alphaAddr} />
          <Txt label="Branch Email Id:" value={f.unit_email_id} onChange={(v) => set("unit_email_id", v)} maxLength={100} />
          {locwiseClients.includes(f.client_code) && <Sel label="GST Location :" value={f.gst_row_id} onChange={(v) => set("gst_row_id", v)}
            opts={[{ v: "", t: "Select" }, ...gstRowsOfClient.filter((z) => !f.state_name || (z.region || "").toLowerCase() === f.state_name.toLowerCase())
              .map((z, i) => ({ v: String(z.id), t: `${i + 1}. ${z.field5 ? z.field5 + " | " : ""}${z.field4 === "B2C" ? "B2C" : "CC/B2B"} | ${(z.field2 || "").trim()} | ${(z.field1 || "").replace(/\s+/g, " ").slice(0, 45)}` }))]} />}
          <Txt label="Branch Cost Centre Code :" value={f.branch_cost_centre_code} onChange={(v) => set("branch_cost_centre_code", v)} maxLength={14} filter={onlyNum} />
          <Txt label="PC Code :" value={f.pc_code} onChange={(v) => set("pc_code", v)} maxLength={14} filter={onlyNum} />
          <Txt label="Distictive Code :" value={f.distinctive_code} onChange={(v) => set("distinctive_code", v)} maxLength={14} filter={onlyNum} />
          <Sel label="Location Type :" value={f.location_type} onChange={(v) => set("location_type", v)} opts={LOCATION_TYPES.map((t) => ({ v: t, t }))} />
          <Sel label="Branch Type :" value={f.branch_type} onChange={(v) => set("branch_type", v)} opts={BRANCH_TYPES} />
          <Txt label="Area In Sqr.Ft :" id="un_matarea" value={f.material_area} onChange={(v) => set("material_area", v)} filter={onlyNum} />
          <Sel label="Branch Status :" value={f.branch_status} onChange={(v) => set("branch_status", v)} opts={BRANCH_STATUS} />
          <Field label="Branch Closeing Date :"><input id="un_closedate" type="date" className="lg-control" value={f.branch_close_date} onChange={(e) => set("branch_close_date", e.target.value)} /></Field>
          <Sel label="Shift Type :" value={f.shift_type} onChange={(v) => set("shift_type", v)} opts={SHIFT_TYPE} />
          <Sel label="Reporting Time :" value={f.reporting_time} onChange={(v) => set("reporting_time", v)} opts={HALF_HOURS.map((t) => ({ v: t, t }))} />
          <Sel label="IN Time :" value={f.in_time} onChange={(v) => setTime("in_time", v)} opts={IN_TIMES.map((t) => ({ v: t, t }))} />
          <Sel label="OUT Time :" value={f.out_time} onChange={(v) => setTime("out_time", v)} opts={HALF_HOURS.map((t) => ({ v: t, t }))} />
          <Sel label="Android Attendances :" value={f.android_attendances} onChange={(v) => set("android_attendances", v)} opts={YESNO_SEL} />
          <Sel label="R&M Service :" value={f.rm_service} onChange={(v) => set("rm_service", v)} opts={APPLICABLE} />
          <Sel label="Administrative Expenses :" value={f.admin_expense} onChange={(v) => set("admin_expense", v)} opts={APPLICABLE} />
          <Sel label="Only Shiftwise Employee:" value={f.shiftwise} onChange={(v) => set("shiftwise", v)} opts={SHIFTWISE} />
          <Txt label="Budget Materials :" value={f.budget_material} onChange={(v) => set("budget_material", v)} maxLength={6} filter={onlyNum} />
          </div>
          <br />
        </div>
        <br />

        <div id="tabs" style={{ background: "#f3f1fe" }}>
          <ul style={{ listStyle: "none", display: "flex", gap: "2px", flexWrap: "wrap", padding: "8px 8px 0 8px", margin: 0 }}>
            {TABS.filter((t) => t.id !== "item10" || clientName === COMPANY_CLIENT).map((t) => (
              <li key={t.id}
                style={{ background: tab === t.id ? "#fff" : "#e7e7fa", border: "1px solid #ccc", borderBottom: tab === t.id ? "1px solid #fff" : "1px solid #ccc", borderRadius: "4px 4px 0 0", padding: "6px 12px" }}>
                <a href={`#${t.id}`} onClick={(e) => { e.preventDefault(); setTab(t.id); }}
                  style={{ textDecoration: "none", color: "#333", fontWeight: tab === t.id ? "bold" : "normal" }}><b>{t.label}</b></a>
              </li>
            ))}
          </ul>
          <div className="em-tabpane" style={{ background: "#fff" }}>
          {tab === "menu3" && <HeadsInfoTab f={f} set={set} />}

          {tab === "menu1" && <div>
            <div className="lg-form cols3">
              <Sel label="Designation Name :" value={dg.designation} onChange={onDesignationPick}
                opts={[{ v: "Select", t: "Select" }, ...Array.from(new Set(designCounts.map((d) => d.designation).filter(Boolean))).map((d) => ({ v: d, t: d }))]} />
              <Txt label="Category :" value={dg.category} onChange={() => {}} readOnly />
              <Txt label="Count :" value={dg.count} onChange={(v) => setDg((p) => ({ ...p, count: onlyNum(v) }))} />
              <Txt label="Working Hours :" value={dg.hours} onChange={() => {}} readOnly />
              <Field label="Start Date :"><input type="date" className="lg-control" value={dg.start} readOnly title="Auto-filled from client designation (read-only, like legacy)" /></Field>
              <Field label="End Date :"><input type="date" className="lg-control" value={dg.end} readOnly title="Auto-filled from client designation (read-only, like legacy)" /></Field>
            </div>
            <div className="row text-center" style={{ margin: "8px 0" }}><button className="btn btn-primary" style={{ padding: "6px 28px", fontWeight: "bold" }} onClick={addDesig} >Add</button></div>
            <table className="table" style={{ backgroundColor: "White", borderColor: "#CCCCCC", width: "100%", fontSize: "X-Small", color: "#000066" }}><thead><tr style={TH} className="text-uppercase"><th></th><th>Sr No.</th><th>Designation</th><th>Employee Count</th><th>Working Hours</th><th>START DATE</th><th>END DATE</th><th>Category</th></tr></thead>
              <tbody>{desigRows.map((r, i) => (
                <tr key={i}><td><button style={TD_DEL} onClick={() => { if (confirmRow()) setDesigRows((p) => p.filter((_, j) => j !== i)); }}>✖</button></td>
                  <td>{i + 1}</td><td>{r.designation}</td><td>{r.count}</td><td>{r.hours}</td><td>{r.start}</td><td>{r.end}</td><td>{r.category}</td></tr>
              ))}
              {desigRows.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", color: "#777" }}>No rows</td></tr>}</tbody></table>
          </div>}

          {tab === "item9" && <div>
            <div className="lg-form cols3">
              <Sel label="Types :" value={ml.type} onChange={(v) => setMl((p) => ({ ...p, type: v }))} opts={SENDMAIL_TYPES} />
              <Txt label="Head Name :" value={ml.name} onChange={(v) => setMl((p) => ({ ...p, name: onlyAlpha(v) }))} />
              <Txt label="Head Email_Id :" value={ml.email} onChange={(v) => setMl((p) => ({ ...p, email: v }))} />
              <Txt label="Head Mobile No :" value={ml.mobile} onChange={(v) => setMl((p) => ({ ...p, mobile: onlyNum(v) }))} maxLength={10} />
            </div>
            <div className="row text-center" style={{ margin: "8px 0" }}><button className="btn btn-primary" style={{ padding: "6px 28px", fontWeight: "bold" }} onClick={addMail} >Add</button></div>
            <table className="table" style={{ backgroundColor: "White", borderColor: "#CCCCCC", width: "100%", fontSize: "X-Small", color: "#000066" }}><thead><tr style={TH} className="text-uppercase"><th></th><th>Sr No.</th><th>Head Type</th><th>Head Name</th><th>Head Email</th><th>Head Mobile No</th></tr></thead>
              <tbody>{mailRows.map((r, i) => (
                <tr key={i}><td><button style={TD_DEL} onClick={() => { if (confirmRow()) setMailRows((p) => p.filter((_, j) => j !== i)); }}>✖</button></td>
                  <td>{i + 1}</td><td>{r.type}</td><td>{r.name}</td><td>{r.email}</td><td>{r.mobile}</td></tr>
              ))}
              {mailRows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#777" }}>No rows</td></tr>}</tbody></table>
          </div>}

          {tab === "item11" && <div>
            <div className="lg-form cols3">
              <Txt label="Description :" value={appr.desc} onChange={(v) => setAppr((p) => ({ ...p, desc: v }))} />
              <Field label="File to Upload :"><input type="file" className="lg-control" onChange={(e) => setApprFile(e.target.files?.[0] ?? null)} />
                {apprFile && <div style={{ fontSize: "11px" }}>Selected: {apprFile.name}</div>}</Field>
              <Field label="Start Date :"><input type="date" className="lg-control" value={appr.from} onChange={(e) => setAppr((p) => ({ ...p, from: e.target.value }))} /></Field>
              <Field label="End Date :"><input type="date" className="lg-control" value={appr.to} onChange={(e) => setAppr((p) => ({ ...p, to: e.target.value }))} /></Field>
            </div>
            <button className="lg-btn lg-btn-green" disabled={busy} onClick={uploadAppr}>Upload</button>
            <table className="table" style={{ backgroundColor: "White", borderColor: "#CCCCCC", width: "100%", fontSize: "X-Small", color: "#000066" }}><thead><tr style={TH} className="text-uppercase"><th>No.</th><th>Description</th><th>Start Date</th><th>End Date</th><th>Download File</th><th>Delete</th></tr></thead>
              <tbody>{apprDocs.map((d, i) => (
                <tr key={String(d.id)}><td>{i + 1}</td><td>{String(d.description ?? "")}</td><td>{String(d.start_date ?? "")}</td>
                  <td>{String(d.end_date ?? "")}</td>
                  <td><button className="btn btn-link" style={{ padding: 0 }} onClick={() => downloadAppr(d.id as number, String(d.file_name ?? "file"))}>Download</button></td>
                  <td><button className="lg-btn lg-btn-red" onClick={() => deleteAppr(d.id as number)}>Delete</button></td></tr>
              ))}
              {apprDocs.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#777" }}>No files</td></tr>}</tbody></table>
          </div>}

          {tab === "menu2" && <div>
            <div className="lg-form cols3">
              <Field label="File Upload (CSV, no header row: Client Name, State, Branch City, Branch Name, Location, Address, Pincode, Latitude, Longitude, Area, File No, Designation, Designation Count, Designation End Date dd/mm/yyyy, Client Branch Code) :">
                <input type="file" accept=".csv" className="lg-control" onChange={(e) => setBulkFile(e.target.files?.[0] ?? null)} />
                {bulkFile && <div style={{ fontSize: "11px" }}>Selected: {bulkFile.name}</div>}
              </Field>
            </div>
            <button className="lg-btn lg-btn-green" disabled={bulkBusy} onClick={bulkUpload}>{bulkBusy ? "Uploading…" : "Upload"}</button>
          </div>}

          {tab === "item13" && <div>
            <div className="lg-form cols3">
              <Txt label="Cluster Head Name :" value={rm.cluster} onChange={(v) => setRm((p) => ({ ...p, cluster: v }))} />
              <Txt label="Enter RM Name :" value={rm.name} onChange={(v) => setRm((p) => ({ ...p, name: onlyAlpha(v) }))} />
              <Txt label="Email_Id :" value={rm.email} onChange={(v) => setRm((p) => ({ ...p, email: v }))} />
              <Txt label="Mobile No :" value={rm.mobile} onChange={(v) => setRm((p) => ({ ...p, mobile: onlyNum(v) }))} maxLength={10} />
              <Txt label="Client RM Code :" value={rm.code} onChange={(v) => setRm((p) => ({ ...p, code: v }))} />
            </div>
            <div className="row text-center" style={{ margin: "8px 0" }}><button className="btn btn-primary" style={{ padding: "6px 28px", fontWeight: "bold" }} onClick={addRm} >Add</button></div>
            <table className="table" style={{ backgroundColor: "White", borderColor: "#CCCCCC", width: "100%", fontSize: "X-Small", color: "#000066" }}><thead><tr style={TH} className="text-uppercase"><th></th><th>Sr No.</th><th>RM Name</th><th>RM Email</th><th>RM Mobile No</th><th>Cluster</th><th>RM Code</th></tr></thead>
              <tbody>{rmRows.map((r, i) => (
                <tr key={i}><td><button style={TD_DEL} onClick={() => { if (confirmRow()) setRmRows((p) => p.filter((_, j) => j !== i)); }}>✖</button></td>
                  <td>{i + 1}</td><td>{r.name}</td><td>{r.email}</td><td>{r.mobile}</td><td>{r.cluster}</td><td>{r.code}</td></tr>
              ))}
              {rmRows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "#777" }}>No rows</td></tr>}</tbody></table>
          </div>}

          {tab === "item14" && <div>
            <div className="lg-form cols3">
              <Sel label="Select RM :" value={so.rm} onChange={(v) => setSo((p) => ({ ...p, rm: v }))}
                opts={[{ v: "Select", t: "Select" }, ...rmRows.map((r) => ({ v: r.name, t: r.name }))]} />
              <Sel label="Select Designation:" value={so.designation} onChange={(v) => setSo((p) => ({ ...p, designation: v }))} opts={SO_DESIGS} />
              <Txt label="Enter Name :" value={so.name} onChange={(v) => setSo((p) => ({ ...p, name: onlyAlpha(v) }))} />
              <Txt label="Email_Id :" value={so.email} onChange={(v) => setSo((p) => ({ ...p, email: v }))} />
              <Txt label="Mobile No :" value={so.mobile} onChange={(v) => setSo((p) => ({ ...p, mobile: onlyNum(v) }))} maxLength={10} />
            </div>
            <div className="row text-center" style={{ margin: "8px 0" }}><button className="btn btn-primary" style={{ padding: "6px 28px", fontWeight: "bold" }} onClick={addSo} >Add</button></div>
            <table className="table" style={{ backgroundColor: "White", borderColor: "#CCCCCC", width: "100%", fontSize: "X-Small", color: "#000066" }}><thead><tr style={TH} className="text-uppercase"><th></th><th>Sr No.</th><th>RM Name</th><th>Designation</th><th>Name</th><th>Email</th><th>Mobile No</th></tr></thead>
              <tbody>{soRows.map((r, i) => (
                <tr key={i}><td><button style={TD_DEL} onClick={() => { if (confirmRow()) setSoRows((p) => p.filter((_, j) => j !== i)); }}>✖</button></td>
                  <td>{i + 1}</td><td>{r.rm}</td><td>{r.designation}</td><td>{r.name}</td><td>{r.email}</td><td>{r.mobile}</td></tr>
              ))}
              {soRows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "#777" }}>No rows</td></tr>}</tbody></table>
          </div>}

          {tab === "item12" && <div>
            <div className="lg-form cols3">
              <Sel label="Fire Extinguisher Applicable :" value={fr.applicable} onChange={(v) => setFr((p) => ({ ...p, applicable: v }))} opts={YESNO_SEL} />
              <Field label="Start Date :"><input type="date" className="lg-control" value={fr.start} onChange={(e) => setFr((p) => ({ ...p, start: e.target.value }))} /></Field>
              <Field label="Expiry Date :"><input type="date" className="lg-control" value={fr.expiry} onChange={(e) => setFr((p) => ({ ...p, expiry: e.target.value }))} /></Field>
              <Sel label="Types Of Extinguisher :" value={fr.type} onChange={(v) => setFr((p) => ({ ...p, type: v }))} opts={FIRE_TYPES} />
              <Sel label="Weight In KG :" value={fr.weight} onChange={(v) => setFr((p) => ({ ...p, weight: v }))} opts={FIRE_WTS} />
              <Txt label="Vendor Name :" value={fr.vendor} onChange={(v) => setFr((p) => ({ ...p, vendor: v }))} />
              <Txt label="Vendor Contact Number :" value={fr.vendorNo} onChange={(v) => setFr((p) => ({ ...p, vendorNo: onlyNum(v) }))} maxLength={10} />
              <Txt label="Fire Extinguisher Report :" value={fr.report} onChange={(v) => setFr((p) => ({ ...p, report: v }))} />
            </div>
            <div className="row text-center" style={{ margin: "8px 0" }}><button className="btn btn-primary" style={{ padding: "6px 28px", fontWeight: "bold" }} onClick={addFire} >Add</button></div>{" "}
            <button className="lg-btn lg-btn-green" onClick={fireReport}>Fire Equipment Report</button>
            <table className="table" style={{ backgroundColor: "White", borderColor: "#CCCCCC", width: "100%", fontSize: "X-Small", color: "#000066" }}><thead><tr style={TH} className="text-uppercase"><th></th><th>Sr No.</th><th>Applicable</th><th>Start Date</th><th>Expiry Date</th><th>Types Of Extinguisher</th><th>Weight In KG</th><th>Vendor Name</th><th>Vendor Contact</th><th>Report</th></tr></thead>
              <tbody>{fireRows.map((r, i) => (
                <tr key={i}><td><button style={TD_DEL} onClick={() => { if (confirmRow()) setFireRows((p) => p.filter((_, j) => j !== i)); }}>✖</button></td>
                  <td>{i + 1}</td><td>{r.applicable}</td><td>{r.start}</td><td>{r.expiry}</td><td>{r.type}</td><td>{r.weight}</td><td>{r.vendor}</td><td>{r.vendorNo}</td><td>{r.report}</td></tr>
              ))}
              {fireRows.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center", color: "#777" }}>No rows</td></tr>}</tbody></table>
          </div>}

          {tab === "item15" && <div>
            <div className="lg-form cols3">
              <Txt label="Bank Name :" value={rt.bank} onChange={(v) => setRt((p) => ({ ...p, bank: v }))} />
              <Txt label="Bank Account Holder Name :" value={rt.holder} onChange={(v) => setRt((p) => ({ ...p, holder: v }))} />
              <Txt label="Bank Account Number :" value={rt.acno} onChange={(v) => setRt((p) => ({ ...p, acno: onlyNum(v) }))} />
              <Field label="IFSC Code :"><input className="lg-control" value={rt.ifsc}
                onChange={(e) => setRt((p) => ({ ...p, ifsc: e.target.value }))}
                onBlur={(e) => { if (e.target.value.length !== 11) { alert("Please Enter Valid IFSC Code"); e.target.focus(); } }} /></Field>
            </div>
            <div className="row text-center" style={{ margin: "8px 0" }}><button className="btn btn-primary" style={{ padding: "6px 28px", fontWeight: "bold" }} onClick={addRent} >Add</button></div>
            <table className="table" style={{ backgroundColor: "White", borderColor: "#CCCCCC", width: "100%", fontSize: "X-Small", color: "#000066" }}><thead><tr style={TH} className="text-uppercase"><th></th><th>Sr No.</th><th>Bank Name</th><th>Holder Name</th><th>Account No</th><th>IFSC</th></tr></thead>
              <tbody>{rentRows.map((r, i) => (
                <tr key={i}><td><button style={TD_DEL} onClick={() => { if (confirmRow()) setRentRows((p) => p.filter((_, j) => j !== i)); }}>✖</button></td>
                  <td>{i + 1}</td><td>{r.bank}</td><td>{r.holder}</td><td>{r.acno}</td><td>{r.ifsc}</td></tr>
              ))}
              {rentRows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#777" }}>No rows</td></tr>}</tbody></table>
          </div>}

          {tab === "item10" && <div>
            <div className="lg-form cols3">
              <Txt label="Company Name :" value={cp.name} onChange={(v) => setCp((p) => ({ ...p, name: v }))} />
              <Txt label="GST No :" value={cp.gst} onChange={(v) => setCp((p) => ({ ...p, gst: v }))} />
              <Txt label="Address :" value={cp.address} onChange={(v) => setCp((p) => ({ ...p, address: v }))} />
              <Txt label="Percentage :" value={cp.pct} onChange={(v) => setCp((p) => ({ ...p, pct: v }))} />
            </div>
            <div className="row text-center" style={{ margin: "8px 0" }}><button className="btn btn-primary" style={{ padding: "6px 28px", fontWeight: "bold" }} onClick={addComp} >Add</button></div>
            <table className="table" style={{ backgroundColor: "White", borderColor: "#CCCCCC", width: "100%", fontSize: "X-Small", color: "#000066" }}><thead><tr style={TH} className="text-uppercase"><th></th><th>Sr No.</th><th>Comp Name</th><th>Gst No</th><th>Address</th><th>Percentage</th></tr></thead>
              <tbody>{compRows.map((r, i) => (
                <tr key={i}><td><button style={TD_DEL} onClick={() => { if (confirmRow()) setCompRows((p) => p.filter((_, j) => j !== i)); }}>✖</button></td>
                  <td>{i + 1}</td><td>{r.name}</td><td>{r.gst}</td><td>{r.address}</td><td>{r.pct}</td></tr>
              ))}
              {compRows.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#777" }}>No rows</td></tr>}</tbody></table>
          </div>}
          </div>
        </div>
        <br />

        <div className="row text-center">
          {!selected && <button className="btn btn-primary" disabled={busy} onClick={onSave}>Save</button>}{" "}
          {selected && <button className="btn btn-primary" disabled={busy} onClick={onUpdate}>Update</button>}{" "}
          {selected && <button className="btn btn-primary" disabled={busy} onClick={onDelete}>Delete</button>}{" "}
          {selected && <button className="btn btn-primary" disabled={busy} onClick={onRecomputeEmpCount}>Recompute Emp Count</button>}{" "}
          <button className="btn btn-warning" disabled={busy} onClick={clearForm}>Clear</button>{" "}
          <Link href="/" className="btn btn-danger" style={{ textDecoration: "none" }}>Close</Link>
        </div>
        <br />
        {/* Legacy client_strt_end_date panel: always available (not row-gated). */}
        <div className="row text-center" style={{ marginBottom: 12 }}>
          <button className="btn btn-link" style={{ color: "red", fontSize: 11 }} onClick={() => { setExpClient(f.client_code); setExpState(f.state_name); loadExpired(f.client_code, f.state_name).then((d) => { setExpSvc(d.results); setExpStates(d.states); }); setExpOpen(true); }}>
            <b>Expired Unit List</b>
          </button>
          {" | "}
          <button className="btn btn-link" onClick={() => loadFreeCount(f.client_code).then((d) => alert(`Free Count: ${d.length} records`))}>
            <b>Free Count</b>
          </button>
        </div>
        <br />
        {selected && (
          <div className="container-fluid">
            <div className="panel panel-primary" style={{ backgroundColor: "#f3f1fe", borderRadius: "10px", border: "1px solid white" }}>
              <br />
              <div className="panel-heading">
                <div style={{ color: "white", fontWeight: "bold", fontSize: "15px" }}>Reason for Updation</div>
              </div>
              <div className="panel-body container">
                <div className="row">
                  <select className="form-control" multiple size={Math.max(reasonHistory.length, 3)} style={{ width: "100%" }} disabled>
                    {reasonHistory.map((h, i) => <option key={i}>{h}</option>)}
                  </select>
                  <textarea id="un_reason" className="form-control" rows={4} cols={50} style={{ width: "100%" }}
                    placeholder="Enter Reason for Updation" value={f.reason_for_updation}
                    onChange={(e) => set("reason_for_updation", e.target.value)} />
                </div>
              </div>
              <br />
            </div>
          </div>
        )}
        <br />
        <br />

        <div style={{ marginBottom: 8, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 6, alignItems: "center", flex: "1 1 260px", minWidth: 220, maxWidth: 420 }}>
            <span style={{ fontWeight: "bold", fontSize: 12 }}>Search :</span>
            <input
              className="lg-control"
              placeholder="Branch Code / Name / Client / State / City…"
              value={gridQuery}
              onChange={(e) => setGridQuery(e.target.value)}
              style={{ flex: 1 }}
            />
            {gridQuery && (
              <button type="button" className="btn btn-default btn-sm" onClick={() => setGridQuery("")}>✖</button>
            )}
          </div>
          <div className="dt-btns no-print" style={{ marginBottom: 0 }}>
            <ExportButtons
              filename="branches"
              columns={[
                { key: "unit_code", label: "Branch Code" },
                { key: "unit_name", label: "Branch Name" },
                { key: "unit_add1", label: "Landmark" },
                { key: "unit_add2", label: "Street/Road/Lane" },
                { key: "unit_city", label: "Branch City" },
                { key: "state_name", label: "State Name" },
                { key: "emp_count", label: "Total Employee Count" },
              ]}
              rows={(() => {
                const q = gridQuery.trim().toLowerCase();
                if (!q) return rows;
                return rows.filter((r) =>
                  [r.unit_code, r.client_code, r.state_name, r.unit_name, r.unit_add1, r.unit_add2, r.unit_city, String(r.emp_count ?? "")]
                    .join(" ").toLowerCase().includes(q));
              })()}
            />
          </div>
          <button type="button" className="btn btn-primary" disabled={serverExporting} onClick={downloadServerExcel}>
            {serverExporting ? "Excel…" : "⭳ Full Excel (.xlsx)"}
          </button>
          <button type="button" className="btn btn-default" disabled={loading} onClick={load}>↻ Refresh grid</button>
          {listError && <span style={{ color: "#a94442", fontSize: 12 }}>{listError}</span>}
          {!loading && !listError && (
            <span style={{ color: "#555", fontSize: 12 }}>
              {(() => {
                const q = gridQuery.trim().toLowerCase();
                const shown = !q ? rows : rows.filter((r) =>
                  [r.unit_code, r.client_code, r.state_name, r.unit_name, r.unit_add1, r.unit_add2, r.unit_city, String(r.emp_count ?? "")]
                    .join(" ").toLowerCase().includes(q));
                return gridQuery.trim() ? `${shown.length} / ${rows.length} branches` : `${rows.length} branches`;
              })()}
            </span>
          )}
        </div>
        {loading ? <p>Loading…</p> : (
          <div className="grid-view">
          <table className="table" style={{ backgroundColor: "White", width: "100%", fontSize: "X-Small", color: "#333333" }}>
            <thead><tr style={TH} className="text-uppercase">
              <th>No.</th><th>Branch Code</th><th>Branch Name</th>
              <th>Landmark</th><th>Street/Road/Lane</th><th>Branch City</th><th>State Name</th><th>Total Employee Count</th>
            </tr></thead>
            <tbody>
              {(() => {
                const q = gridQuery.trim().toLowerCase();
                const shown = (!q ? rows : rows.filter((r) =>
                  [r.unit_code, r.client_code, r.state_name, r.unit_name, r.unit_add1, r.unit_add2, r.unit_city, String(r.emp_count ?? "")]
                    .join(" ").toLowerCase().includes(q)));
                if (shown.length === 0) return <tr><td colSpan={8} style={{ textAlign: "center", color: "#777" }}>{rows.length === 0 ? "No branches" : "No matching branches"}</td></tr>;
                return shown.map((r, i) => (
                <tr key={r.id}
                  style={{ cursor: "pointer", backgroundColor: selected?.id === r.id ? "#669999" : "#ffffff", color: selected?.id === r.id ? "White" : "#000066", fontWeight: selected?.id === r.id ? "bold" : "normal" }}
                  onMouseOver={(e) => { e.currentTarget.style.textDecoration = "underline"; }}
                  onMouseOut={(e) => { e.currentTarget.style.textDecoration = "none"; }}
                  onClick={() => selectRow(r)}>
                  <td>{i + 1}</td><td>{r.unit_code}</td><td>{r.unit_name}</td>
                  <td>{r.unit_add1}</td><td>{r.unit_add2}</td><td>{r.unit_city}</td><td>{r.state_name}</td><td>{r.emp_count}</td>
                </tr>
                ));
              })()}
            </tbody>
          </table>
          </div>
        )}
        </div>
      </div>
    </div>
    {expOpen && (
      <div id="attendance" onClick={() => setExpOpen(false)}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1050, overflowY: "auto", display: "flex", alignItems: "flex-start", justifyContent: "center" }}>
        <div onClick={(e) => e.stopPropagation()}
          style={{ width: "92%", maxWidth: 650, margin: "60px auto", background: "#fff", borderRadius: 6, boxShadow: "0 5px 25px rgba(0,0,0,0.4)", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#337ab7", color: "white", padding: "10px 15px" }}>
              <h4 style={{ margin: 0 }}>Expired Unit List</h4>
              <button type="button" onClick={() => setExpOpen(false)} style={{ border: "none", background: "transparent", color: "white", fontSize: 24, lineHeight: 1, cursor: "pointer" }}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="row" style={{ marginBottom: 12 }}>
                <div className="col-sm-3">
                  <b>Select Client:</b>
                  <select className="form-control" value={expClient}
                    onChange={(e) => { const c = e.target.value; setExpClient(c); setExpState(""); if (c) loadExpired(c, "").then((d) => { setExpSvc(d.results); setExpStates(d.states); }); else { setExpSvc([]); setExpStates([]); } }}>
                    <option value="">Select</option>
                    {clientOpts.filter((c) => c.v).map((c) => <option key={c.v} value={c.v}>{c.t}</option>)}
                  </select>
                </div>
                <div className="col-sm-3">
                  <b>State:</b>
                  <select className="form-control" value={expState}
                    onChange={(e) => { const s = e.target.value; setExpState(s); if (expClient) loadExpired(expClient, s).then((d) => setExpSvc(d.results)); }}>
                    <option value="">Select</option>
                    <option value="ALL">ALL</option>
                    {expStates.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <br />
              <div className="grid-view">
              <table className="table" style={{ backgroundColor: "White", borderColor: "#CCCCCC", width: "100%", fontSize: "X-Small", color: "#000066" }}>
                <thead><tr style={TH} className="text-uppercase">
                  <th>Start Date</th><th>End Date</th><th>Client Name</th><th>Unit Name</th><th>Designation</th>
                </tr></thead>
                <tbody>
                  {expSvc.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "#777" }}>Select Client and State to load</td></tr>}
                  {expSvc.map((r, i) => (
                    <tr key={i}><td>{r.start_date}</td><td>{r.end_date}</td><td>{r.client_name}</td><td>{r.unit_name}</td><td>{r.designation}</td></tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
            <div className="modal-footer" style={{ textAlign: "center", padding: 12 }}>
              <button type="button" className="btn btn-danger" onClick={() => setExpOpen(false)}>Close</button>
            </div>
        </div>
      </div>
    )}
    </>
  );
}

function HeadsInfoTab({ f, set }: { f: Form; set: (k: string, v: string) => void }) {
  const rowLabels: { k: string; suffix: string }[] = [
    { k: "title", suffix: "_title" }, { k: "name", suffix: "_name" }, { k: "mobile", suffix: "_mobile" }, { k: "email", suffix: "_email" },
  ];
  return (
    <table className="table" style={{ backgroundColor: "White", borderColor: "#CCCCCC", width: "100%", fontSize: "X-Small", color: "#000066" }}>
      <thead><tr style={TH} className="text-uppercase"><th></th>{HEADS.map((h) => <th key={h.key}>{h.label}</th>)}</tr></thead>
      <tbody>
        <tr><td><b>Title</b></td>{HEADS.map((h) => <td key={h.key}>
          <select className="lg-control" value={f[`head_${h.key}_title`] ?? "Select"} onChange={(e) => set(`head_${h.key}_title`, e.target.value)}>
            {TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select></td>)}</tr>
        <tr><td><b>Contact Person Name</b></td>{HEADS.map((h) => <td key={h.key}>
          <input className="lg-control" value={f[`head_${h.key}_name`] ?? ""} onChange={(e) => set(`head_${h.key}_name`, onlyAlpha(e.target.value))} /></td>)}</tr>
        <tr><td><b>Mobile No</b></td>{HEADS.map((h) => <td key={h.key}>
          <input className="lg-control" maxLength={10} value={f[`head_${h.key}_mobile`] ?? ""} onChange={(e) => set(`head_${h.key}_mobile`, onlyNum(e.target.value))} /></td>)}</tr>
        <tr><td><b>Email Id</b></td>{HEADS.map((h) => <td key={h.key}>
          <input className="lg-control" value={f[`head_${h.key}_email`] ?? ""} onChange={(e) => set(`head_${h.key}_email`, e.target.value)} /></td>)}</tr>
        <tr><td><b>Personal Mobile No</b></td>{HEADS.map((h) => <td key={h.key}>
          <input className="lg-control" maxLength={10} value={f[`head_${h.key}_pmobile`] ?? ""} onChange={(e) => set(`head_${h.key}_pmobile`, onlyNum(e.target.value))} /></td>)}</tr>
        <tr><td><b>Personal EmailID</b></td>{HEADS.map((h) => <td key={h.key}>
          <input className="lg-control" value={f[`head_${h.key}_pemail`] ?? ""} onChange={(e) => set(`head_${h.key}_pemail`, e.target.value)} /></td>)}</tr>
        <tr><td><b>BirthDate</b></td>{HEADS.map((h) => <td key={h.key}>
          <input type="date" className="lg-control" value={f[`head_${h.key}_birthdate`] ?? ""} onChange={(e) => set(`head_${h.key}_birthdate`, e.target.value)} /></td>)}</tr>
        <tr><td><b>Anniversary Date</b></td>{HEADS.map((h) => <td key={h.key}>
          <input type="date" className="lg-control" value={f[`head_${h.key}_anniversary`] ?? ""} onChange={(e) => set(`head_${h.key}_anniversary`, e.target.value)} /></td>)}</tr>
      </tbody>
      <tfoot><tr><td colSpan={6}><span className="em-hint">{rowLabels.length && "Heads persist with the branch record."}</span></td></tr></tfoot>
    </table>
  );
}
