/**
 * Shared legacy-faithful helpers for the Travel / Expense Claim screens.
 *
 * Ports of the client + server rules in the legacy ASP.NET pages:
 * - apply_expencess.aspx(.cs)            — "Add Travel Plan" grid
 * - p_add_new_travel_plan2.aspx(.cs)     — "New Travelling Plan" popup
 * - p_add_expencess1.aspx(.cs)           — "New Claim Expense" popup
 * - app_rej_claim.aspx / p_app_rej_claim.aspx(.cs)
 * - app_rej_travelplan.aspx / p_app_rej_travelplan2.aspx(.cs)
 *
 * Alert/confirm strings are verbatim copies of the legacy JavaScript so not a
 * single validation message is lost in the modern port.
 */

export interface TravelPolicy {
  [k: string]: unknown;
  policy_name?: string;
  start_date?: string | null;
  end_date?: string | null;
  submit?: number;
  chk_air?: string; chk_bus?: string;
  chk_train_t1?: string; chk_train_t2?: string; chk_train_t3?: string;
  chk_cabtaxi?: string; chk_auto?: string; chk_owned_vehicle?: string;
  cb_ac?: string; cb_nonac?: string; cb_citybus?: string;
  ac?: number; nonac?: number; citybus?: number;
  cb_car?: string; v_car?: number; cb_bike?: string; v_bike?: number;
  cb_inside?: string; cb_outside?: string;
  per_day_limit?: number; outside_limit?: number;
  hotel_budget?: string; hotel_budget_from?: number; hotel_budget_to?: number;
  hotel_standard?: string; hotel_standard_from?: number; hotel_standard_to?: number;
  hotel_twostar?: string; hotel_twostar_from?: number; hotel_twostar_to?: number;
  hotel_threestar?: string; hotel_threestar_from?: number; hotel_threestar_to?: number;
  hotel_fivestar?: string; hotel_fivestar_from?: number; hotel_fivestar_to?: number;
  claim_max_days?: string;
}

export const isOn = (v: unknown) =>
  ["1", "true", "True", "Y", "y"].includes(String(v ?? ""));

export const ALL_MODES = [
  "Air", "Bus", "Train AC Tier1", "Train AC Tier2", "Train AC Tier3",
  "Cab/Taxi", "Auto", "Owned Vehicle",
] as const;

const MODE_FLAG: Record<string, keyof TravelPolicy> = {
  "Air": "chk_air", "Bus": "chk_bus",
  "Train AC Tier1": "chk_train_t1", "Train AC Tier2": "chk_train_t2",
  "Train AC Tier3": "chk_train_t3", "Cab/Taxi": "chk_cabtaxi",
  "Auto": "chk_auto", "Owned Vehicle": "chk_owned_vehicle",
};

/** Legacy load_mode(): without Exception -> only policy-allowed modes; with Exception -> only the rest. */
export function modeOptions(policy: TravelPolicy | null, exception: boolean): string[] {
  if (!policy) return [...ALL_MODES];
  return ALL_MODES.filter((m) => isOn(policy[MODE_FLAG[m]]) !== exception);
}

/** Legacy emp_category_SelectedIndexChanged / ddl_travelmode_SelectedIndexChanged. */
export function typeOptions(policy: TravelPolicy | null, mode: string): string[] {
  if (!policy) return [];
  if (mode === "Bus") {
    const out: string[] = [];
    if (isOn(policy.cb_ac)) out.push("AC");
    if (isOn(policy.cb_nonac)) out.push("NonAc");
    if (isOn(policy.cb_citybus)) out.push("CityBus");
    return out;
  }
  if (mode === "Owned Vehicle") {
    const out: string[] = [];
    if (isOn(policy.cb_car)) out.push("Car");
    // legacy quirk: Bike row is gated on CheckBox_car too — kept exactly
    if (isOn(policy.cb_car) || isOn(policy.cb_bike)) out.push("Bike");
    return out;
  }
  return [];
}

/** Legacy ddl_type_bus_SelectedIndexChanged: preset amount for a bus type. */
export function presetAmountForType(policy: TravelPolicy | null, type: string): string {
  if (!policy) return "";
  const map: Record<string, unknown> = { AC: policy.ac, NonAc: policy.nonac, CityBus: policy.citybus };
  const v = map[type];
  return v === undefined || v === null || v === "" ? "" : String(v);
}

/** Legacy load_city(): Inside City (1) / Outside City (2) from CheckBox_inside/outside. */
export function cityOptions(policy: TravelPolicy | null): { value: string; label: string }[] {
  if (!policy) return [{ value: "1", label: "Inside City" }, { value: "2", label: "Outside City" }];
  const out: { value: string; label: string }[] = [];
  if (isOn(policy.cb_inside)) out.push({ value: "1", label: "Inside City" });
  if (isOn(policy.cb_outside)) out.push({ value: "2", label: "Outside City" });
  return out;
}

/** Legacy per-day limit: txt_per_day_limit (inside) / Textbox_outside (outside). */
export function perDayLimit(policy: TravelPolicy | null, cityValue: string): number {
  if (!policy) return 0;
  const v = cityValue === "1" ? policy.per_day_limit : policy.outside_limit;
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function cityLabel(value: string): string {
  if (value === "1" || value === "Inside City") return "Inside City";
  if (value === "2" || value === "Outside City") return "Outside City";
  return value || "";
}

/* ---------------- dates (legacy grid shows dd/MM/yyyy) ---------------- */

export function fmtDDMMYYYY(iso?: string | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(String(iso));
  if (Number.isNaN(d.getTime())) return String(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function todayISO(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function daysBetween(fromISO: string, toISO: string): number {
  const a = new Date(`${fromISO}T00:00:00`).getTime();
  const b = new Date(`${toISO}T00:00:00`).getTime();
  return Math.round((b - a) / 86400000);
}

export function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}

/* ---------------- legacy key-press filters (verbatim behaviour) ---------------- */

export const isNumberKey = (ch: string) => /[0-9.]/.test(ch);
export const isLetterKey = (ch: string) => /[a-zA-Z]/.test(ch);
// Legacy AllowAlphabet_address: letters, digits, space and & ' " , - . / : ; = \
export const isAddressKey = (ch: string) =>
  /[a-zA-Z0-9 &'"\-.,/:;=\\]/.test(ch);

/* ---------------- legacy alert strings (verbatim) ---------------- */

export const MSG = {
  POLICY_MISSING: "Travel Policy not assigned / Expired. Please talk to your Manager.",
  DEST_FROM: "Please Enter Destination From",
  DEST_TO: "Please Enter Destination To",
  FROM_DATE: "Please Select From Date",
  TO_DATE: "Please Select To Date",
  CURRENCY: "Please Select Currency !!!",
  AMOUNT: "Please Enter Amount",
  CLAIM_DATE: "Please Select Date",
  MERCHANT: "Please Enter Merchant",
  CLAIM_DESC: "Please Enter The Description",
  SUBMIT_CONFIRM: "Once you Submit you cannot make changes?",
  DEL_PLAN: "Are you sure you want to delete this Travel Plan?",
  DEL_CLAIM: "Are you sure you want to delete this Claim?",
  REJECT_TRAVEL: "Are you sure you want to Reject?",
  REJECT_COMMENT: "Please Enter Comments for Rejection !!",
  REJECT_COMMENT_CLAIM: "Please Enter Comments for Rejection !!",
  CLAIM_SAVED: "Expenses Saved Successfully",
  PLAN_SAVED: "Travel Plan Saved Successfully",
  PLAN_SUBMITTED: "Travelling Plan Submitted Successfully",
  CLAIM_SUBMITTED: "Claim Submitted Successfully",
  CLAIM_UPDATED: "Claim Updated Successfully!!",
  CLAIM_UPDATE_FAIL: "Claim Updation Failed!!",
  RECORD_UPDATED: "Record updated successfully!!",
  RECORD_UPDATE_FAIL: "Record updation failed!!",
  ATTACH_TYPE: "Please select only JPG and PNG Images !!!",
  ATTACH_SIZE: "File size more than 5 MBs. Please select less size !!!",
  ATTACH_NOTE: "Note : Only JPG and PNG files with 5 MB size.",
  CLAIM_EXPIRED: "Claim Add Date Is Expired ",
  REQUIRED_FIRST: "Please Enter Required Fields First.",
} as const;

export const overLimit = (limit: string | number) =>
  `You can not exeed beyond the limit ${limit}`;
export const overPerDay = (limit: string | number) =>
  `You can not exeed beyond the per day limit ${limit}`;
export const overPerDay2 = (limit: string | number) =>
  `You can not exeed beyond the per day  limit ${limit}`;
export const actualOverPerDay = (limit: string | number) =>
  `Enter Claim Amount Less Than Per Day Limit Amount is '${limit}'  `;
export const hotelGreater = (limit: string | number) =>
  `Hotel Accomodation Limit is greater than ${limit}!!!`;
export const hotelLess = (limit: string | number) =>
  `Hotel Accomodation Limit is Less than ${limit} !!!`;
export const planExists = (from: string, to: string) =>
  `The Travel Plan already exist from ${from} to ${to}, Select another date.`;
export const claimDateExists = (date: string) =>
  `The Travel Plan already exist from ${date} Select another date.`;
export const policyBetween = (from: string, to: string) =>
  `The assigned Travel Policy is between ${from} to ${to}, Select another date.`;
