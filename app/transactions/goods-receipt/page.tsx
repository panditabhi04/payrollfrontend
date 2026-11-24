"use client";

// Legacy InventoryPurchaseBill.aspx — "Purchase Bill" (Goods Received Note).
// Exact 1:1 port: tabs (Purchase Bill / Monthwise Purchase Repots), panel-
// primary headings, #f3f1fe boxes, search + estimate grid, full header form,
// item-entry table (maintable), staged items grid, notes + totals block with
// GST panel, vendor-invoice file upload + upload grid, Process / Send /
// Update / Delete / Print / Close buttons, monthwise report tab with XLS
// download. Legacy alerts (exact texts + focus), $.blockUI overlay,
// dd/mm/yyyy readonly dates, live cal() totals chain.

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getJSON, mk, putJSON, rm } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

const GRN = "/api/transactions/goods-receipts/";
const LK = "/api/transactions/grn-lookups/";

interface StagedLine {
  item_code: string; item_type: string; particular: string;
  size_uniform: string; size_shoes: string; size_pantry: string; size_apron: string;
  description: string; vat: string; hsn: string; unit: string;
  quantity: string; rate: string; discount: string; discount_amt: string;
  amount: string; vendor: string;
}
interface SearchRow {
  id: number; doc_no: string; doc_date?: string | null; cust_name: string;
  final_price: string | number; final_flag: number; purches_bill_reject?: string;
}
interface UploadRow { cust_code: string; cust_name: string; doc_no: string; vendor_upload?: string }
interface BillDetail extends Record<string, unknown> {
  id: number; doc_no: string;
  lines: Array<Record<string, unknown>>;
}

const num = (v: unknown): number => {
  const n = parseFloat(String(v ?? "").trim());
  return isNaN(n) ? 0 : n;
};
const r2 = (v: number): number => Math.round(v * 100) / 100;
const s2 = (v: number): string => String(r2(v));
const todayDMY = (): string => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
const isoToDmy = (iso?: string | null): string => {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};
const dmyToIso = (dmy: string): string => {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec((dmy || "").trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};
const STATUS_TEXT: Record<number, string> = {
  0: "Pending", 1: "Approve By Jr Acc", 2: "Approve By Sr Acc", 3: "Rejected",
};

// Legacy key filters.
const allowAlphabet1 = (v: string) => v.replace(/[^A-Za-z \t]/g, "");
const allowAlphabetNum = (v: string) => v.replace(/[^A-Za-z0-9 \t]/g, "");
const allowAddr = (v: string) => v.replace(/[^A-Za-z0-9 .,/#()&'\-:;]/g, "");
const isNumber = (v: string) => v.replace(/[^0-9]/g, "");
// Legacy isNumber_dot: digits + $ % & ' ( ) - . /
const isNumberDot = (v: string) => v.replace(/[^0-9$%&'()\-.\\/]/g, "");

const VALID_EXTS = [".jpg", ".jpeg", ".gif", ".pdf", ".png"];

export default function GoodsReceiptPage() {
  const router = useRouter();
  const [tab, setTab] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const focus = (id: string) => document.getElementById(id)?.focus?.();

  useEffect(() => {
    try {
      if (window.localStorage.getItem("grn_hidtab") === "1") setTab(1);
    } catch { /* ignore */ }
  }, []);
  const pickTab = (t: number) => {
    setTab(t);
    try { window.localStorage.setItem("grn_hidtab", String(t)); } catch { /* ignore */ }
  };

  // ---------------- search section ----------------
  const [schDoc, setSchDoc] = useState("P");
  const [schName, setSchName] = useState("");
  const [searchRows, setSearchRows] = useState<SearchRow[]>([]);
  const [searched, setSearched] = useState(false);
  const [sPage, setSPage] = useState(1);
  const [sSearch, setSSearch] = useState("");

  const doSearch = async () => {
    // Legacy: doc-no search first, then vendor-name search overwrites.
    const q = schName.trim() !== "" ? schName.trim() : schDoc.trim();
    if (!q) { setSearchRows([]); setSearched(true); return; }
    setBlocked(true);
    try {
      const d = await getJSON<{ results: SearchRow[] } | SearchRow[]>(
        `${GRN}?search=${encodeURIComponent(q)}`);
      const rows = (Array.isArray(d) ? d : (d?.results ?? [])) as SearchRow[];
      setSearchRows(rows);
      setSSearch("");
      setSPage(1);
      setSearched(true);
      if (rows.length === 0) alert("No Record Found for");
    } finally { setBlocked(false); }
  };

  // ---------------- header form ----------------
  const blankHeader = () => ({
    docno: "", vendorType: "Select", vendorId: "Select", vendorNameText: "",
    poNo: "Select", gstNo: "", gstReadonly: false,
    invDate: todayDMY(), invNo: "", bookingDate: todayDMY(), challan: "",
    billAddr: "", billReadonly: false, narration: "",
    bankAc: "", bankNo: "", ifsc: "", credit: "",
    bankReadonly: false, balancePO: "", billAgainstPO: "Select",
    tdsCode: "Select", tdsRate: "",
  });
  const [H, setH] = useState(blankHeader());
  const setHv = (k: keyof ReturnType<typeof blankHeader>, v: string | boolean) =>
    setH((p) => ({ ...p, [k]: v }));
  const [vendors, setVendors] = useState<{ value: string; text: string }[]>([]);
  const [poNos, setPoNos] = useState<{ value: string; text: string }[]>([]);
  const [invNos, setInvNos] = useState<{ value: string; text: string }[]>([]);
  const [tdsCodes, setTdsCodes] = useState<{ value: string; text: string }[]>([]);
  const [companyState, setCompanyState] = useState("");
  const [intraState, setIntraState] = useState(true); // txt_year C/I
  const [mode, setMode] = useState<"new" | "edit">("new");
  const [editId, setEditId] = useState<number | null>(null);

  const loadDocPreview = useCallback(async () => {
    const d = await getJSON<{ doc_no: string }>(`${GRN}next-doc-no/`);
    if (d?.doc_no) setH((p) => (mode === "new" ? { ...p, docno: d.doc_no } : p));
  }, [mode]);

  useEffect(() => {
    getJSON<{ value: string; text: string }[]>(`${LK}vendors/`).then((d) => setVendors(d ?? []));
    getJSON<{ state: string }>(`${LK}company-gst-state/`).then((d) => setCompanyState(d?.state ?? ""));
    loadDocPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onVendorType = (v: string) => {
    // Legacy ddl_vendortype_SelectedIndexchange.
    if (v === "Regular") {
      setH((p) => ({ ...p, vendorType: v, vendorNameText: "" }));
    } else {
      setH((p) => ({
        ...p, vendorType: v, vendorId: "Select", gstNo: "", gstReadonly: false,
        billAddr: "", billReadonly: false, bankAc: "", bankNo: "", ifsc: "",
        credit: "", bankReadonly: false, tdsCode: "Select", tdsRate: "",
        poNo: "Select",
      }));
      setPoNos([]); setInvNos([]);
    }
  };

  const onVendor = async (vid: string) => {
    // Legacy customer_details(): PO list + vendor autofill (readonly) + TDS codes.
    setH((p) => ({ ...p, vendorId: vid }));
    if (!vid || vid === "Select") {
      setH((p) => ({ ...p, gstNo: "", gstReadonly: false, billAddr: "", billReadonly: false }));
      setPoNos([]); setTdsCodes([]);
      return;
    }
    setBlocked(true);
    try {
      const [pos, det, tds] = await Promise.all([
        getJSON<{ value: string; text: string }[]>(`${LK}po-numbers/?vend_id=${encodeURIComponent(vid)}`),
        getJSON<Record<string, string>>(`${LK}vendor-detail/?vend_id=${encodeURIComponent(vid)}`),
        getJSON<{ value: string; text: string }[]>(`${LK}tds-codes/?vend_id=${encodeURIComponent(vid)}`),
      ]);
      setPoNos(pos ?? []);
      setTdsCodes(tds ?? []);
      setH((p) => ({
        ...p,
        gstNo: det?.gst ?? "", gstReadonly: true,
        billAddr: det?.bill_address ?? "", billReadonly: true,
        bankAc: det?.bank_ac ?? "", bankNo: det?.bank_no ?? "",
        ifsc: det?.ifc_code ?? "", credit: det?.credit_period ?? "",
        bankReadonly: true,
      }));
      gstCounter(det?.gst ?? "");
    } finally { setBlocked(false); }
  };

  const gstCounter = (gst: string) => {
    // Legacy gst_counter(): vendor GST state vs company state -> C/I.
    const st = (gst || "").substring(0, 2);
    setIntraState(!!st && !!companyState && st === companyState);
  };

  const onPO = async (po: string) => {
    // Legacy ddl_po_num_SelectedIndexChanged: item types + bill-against-PO + balance.
    setH((p) => ({ ...p, poNo: po, billAgainstPO: "Select" }));
    setItemTypes([]); setInvNos([]);
    if (!po || po === "Select") {
      setH((p) => ({ ...p, balancePO: "" }));
      setE((p) => ({ ...p, product: "Select" }));
      return;
    }
    setBlocked(true);
    try {
      const [types, invs, bal] = await Promise.all([
        getJSON<{ value: string; text: string }[]>(`${LK}po-item-types/?po_no=${encodeURIComponent(po)}`),
        getJSON<{ value: string; text: string }[]>(`${LK}invoice-nos/?po_no=${encodeURIComponent(po)}`),
        getJSON<{ balance: string }>(`${LK}balance-po/?po_no=${encodeURIComponent(po)}`),
      ]);
      setItemTypes(types ?? []);
      setInvNos(invs ?? []);
      setH((p) => ({ ...p, balancePO: bal?.balance ?? "" }));
      setE((p) => ({ ...p, product: "Select" }));
    } finally { setBlocked(false); }
  };

  const onTdsCode = async (code: string) => {
    // Legacy ddl_tds_code_SelectedIndexChanged.
    setH((p) => ({ ...p, tdsCode: code }));
    if (!code || code === "Select") { setH((p) => ({ ...p, tdsRate: "" })); return; }
    const d = await getJSON<{ rate: string }>(`${LK}tds-rate/?code=${encodeURIComponent(code)}`);
    setH((p) => ({ ...p, tdsRate: d?.rate ?? "0" }));
    recomputeAllRef.current?.();
  };

  // ---------------- item entry (maintable row) ----------------
  const blankEntry = () => ({
    product: "Select", itemCode: "", itemText: "Select",
    sizeU: "Select", sizeS: "Select", sizeP: "Select", sizeA: "Select",
    desc: "", gstPct: "0", hsn: "", hsnLabel: "HSN Code",
    unit: "Select", perUnit: "0", qty: "0", rate: "0",
    stockHint: "", lastRateHint: "", discPct: "0", discAmt: "0", amount: "0",
  });
  const [E, setE] = useState(blankEntry());
  const setEv = (k: keyof ReturnType<typeof blankEntry>, v: string) =>
    setE((p) => ({ ...p, [k]: v }));
  const [itemTypes, setItemTypes] = useState<{ value: string; text: string }[]>([]);
  const [poItems, setPoItems] = useState<{ value: string; text: string }[]>([]);
  const [unitOpts, setUnitOpts] = useState<string[]>([]);
  const [allUnits, setAllUnits] = useState<string[]>([]);
  const [sizeUOpts, setSizeUOpts] = useState<string[]>([]);
  const [sizeSOpts, setSizeSOpts] = useState<string[]>([]);
  const [sizePOpts, setSizePOpts] = useState<string[]>([]);
  const [sizeAOpts, setSizeAOpts] = useState<string[]>([]);
  const [discountBy, setDiscountBy] = useState<"RS" | "PER">("RS"); // Session DISCOUNT_BY

  useEffect(() => {
    getJSON<{ unit_name: string }[]>(`/api/masters/item-units-lookup/`)
      .then((d) => {
        const names = (d ?? []).map((r) => r.unit_name ?? "").filter(Boolean);
        setAllUnits(names);
        setUnitOpts(names);
      });
  }, []);

  const onQty = (v: string) => {
    const qty = isNumber(v);
    if (num(qty) > 0) {
      const gross = num(qty) * num(E.rate);
      if (discountBy === "PER") {
        const price = r2(num(E.discPct) * gross / 100);
        setE((p) => ({ ...p, qty, discAmt: s2(price), amount: s2(gross - price) }));
      } else {
        const pct = gross ? r2(num(E.discAmt) * 100 / gross) : 0;
        setE((p) => ({ ...p, qty, discPct: s2(pct), amount: s2(gross - num(E.discAmt)) }));
      }
    } else {
      // Legacy: alert + reset (rate change path stays silent like legacy).
      alert("Quantity must be greater than 0");
      setE((p) => ({ ...p, qty: "0" }));
    }
  };

  const onRate = (v: string) => {
    const rate = isNumberDot(v);
    if (rate !== "" && E.qty !== "" && num(E.qty) > 0) {
      const gross = num(E.qty) * num(rate);
      if (discountBy === "PER") {
        const price = r2(num(E.discPct) * gross / 100);
        setE((p) => ({ ...p, rate, discAmt: s2(price), amount: s2(gross - price) }));
      } else {
        const pct = gross ? r2(num(E.discAmt) * 100 / gross) : 0;
        setE((p) => ({ ...p, rate, discPct: s2(pct), amount: s2(gross - num(E.discAmt)) }));
      }
    } else {
      setE((p) => ({ ...p, rate }));
    }
  };

  const onDiscPct = (v: string) => {
    const pct = isNumberDot(v);
    const gross = num(E.qty) * num(E.rate);
    const price = r2(num(pct) * gross / 100);
    setDiscountBy("PER");
    setE((p) => ({ ...p, discPct: pct, discAmt: s2(price), amount: s2(gross - price) }));
  };

  const onDiscAmt = (v: string) => {
    const amt = isNumberDot(v);
    const gross = num(E.qty) * num(E.rate);
    const pct = gross ? r2(num(amt) * 100 / gross) : 0;
    setDiscountBy("RS");
    setE((p) => ({ ...p, discAmt: amt, discPct: s2(pct), amount: s2(gross - num(amt)) }));
  };

  const onProduct = async (prod: string) => {
    // Legacy fill_txt_particular(): items by PO+type, sizes, entry reset.
    setEntryReset(prod);
    if (!prod || prod === "Select") { setPoItems([]); return; }
    if (!H.poNo || H.poNo === "Select") { setPoItems([]); }
    else {
      setBlocked(true);
      try {
        const items = await getJSON<{ value: string; text: string }[]>(
          `${LK}po-items/?po_no=${encodeURIComponent(H.poNo)}&item_type=${encodeURIComponent(prod)}`);
        setPoItems(items ?? []);
        const sizes = await getJSON<{ size: string }[]>(
          `${LK}item-sizes/?product_service=${encodeURIComponent(prod)}`);
        const list = (sizes ?? []).map((s) => s.size).filter(Boolean);
        if (prod === "Uniform") setSizeUOpts(list);
        else if (prod === "Shoes") setSizeSOpts(list);
        else if (prod === "pantry_jacket") setSizePOpts(list);
        else if (prod === "Apron") setSizeAOpts(list);
      } finally { setBlocked(false); }
    }
  };
  const setEntryReset = (prod: string) =>
    setE((p) => ({
      ...p, product: prod, itemCode: "", itemText: "Select",
      sizeU: "Select", sizeS: "Select", sizeP: "Select", sizeA: "Select",
      desc: "", gstPct: "0", hsn: "", hsnLabel: "HSN Code", unit: "Select",
      perUnit: "0", qty: "0", rate: "0", stockHint: "", lastRateHint: "",
      discPct: "0", discAmt: "0", amount: "0",
    }));

  const onItem = async (code: string) => {
    // Legacy particular_hsn_sac_code(): full autofill + PO qty + last rate.
    const text = poItems.find((i) => i.value === code)?.text ?? "Select";
    setE((p) => ({ ...p, itemCode: code, itemText: text }));
    if (!code || code === "Select" || code === "0") return;
    setBlocked(true);
    try {
      const [det, qty] = await Promise.all([
        getJSON<Record<string, string>>(`${LK}item-detail/?item_code=${encodeURIComponent(code)}`),
        getJSON<{ quantity: string }>(
          `${LK}po-qty/?po_no=${encodeURIComponent(H.poNo)}&item_code=${encodeURIComponent(code)}`),
      ]);
      const units = (det?.unit ?? "").split(",").map((s) => s.trim()).filter(Boolean);
      setUnitOpts(units.length ? units : allUnits);
      const prod = det?.product_service ?? E.product;
      setE((p) => ({
        ...p,
        desc: det?.description ?? "",
        gstPct: det?.vat ?? "0",
        hsn: det?.hsn_sac ?? "",
        hsnLabel: det?.hsn_kind === "S" ? "SAC Code" : "HSN Code",
        unit: "Select", perUnit: det?.unit_per_piece ?? "0",
        stockHint: det?.stock ?? "", lastRateHint: det?.last_rate ?? "",
        qty: qty?.quantity ?? "0",
        rate: det?.last_rate ?? det?.purchase_rate ?? "0",
        sizeU: prod === "Uniform" ? (det?.size ?? "Select") : "Select",
        sizeS: prod === "Shoes" ? (det?.size ?? "Select") : "Select",
        sizeP: prod === "pantry_jacket" ? (det?.size ?? "Select") : "Select",
        sizeA: (prod === "Apron" || prod === "apron") ? (det?.size ?? "Select") : "Select",
        discPct: "0", discAmt: "0", amount: "0",
      }));
      // Legacy chains po_qty -> qty changed -> last rate -> rate changed.
      const q = num(qty?.quantity ?? "0"), r = num(det?.last_rate ?? det?.purchase_rate ?? "0");
      const gross = q * r;
      setE((p) => ({ ...p, amount: s2(gross) }));
    } finally { setBlocked(false); }
  };

  const onUnit = async (u: string) => {
    // Legacy unit_per_price_changes(): per-unit pieces for the unit.
    setE((p) => ({ ...p, unit: u }));
    if (!u || u === "Select") return;
    const d = await getJSON<{ pieces: string }>(`${LK}unit-pieces/?unit_name=${encodeURIComponent(u)}`);
    if (d?.pieces) setE((p) => ({ ...p, perUnit: d.pieces }));
  };

  // ---------------- staged items + totals ----------------
  const [staged, setStaged] = useState<StagedLine[]>([]);
  const [notes, setNotes] = useState("");
  const [terms, setTerms] = useState("");
  const [gross, setGross] = useState("0");
  const [hDiscPct, setHDiscPct] = useState("0");
  const [hDiscAmt, setHDiscAmt] = useState("0");
  const [hDiscOff, setHDiscOff] = useState(false);
  const [taxable, setTaxable] = useState("0");
  const [gstRows, setGstRows] = useState<{ label: string; amount: string }[]>([]);
  const [subA, setSubA] = useState("0");
  const [extraName, setExtraName] = useState("");
  const [extraAmt, setExtraAmt] = useState("0");
  const [extraTax, setExtraTax] = useState("0");
  const [extraTaxAmt, setExtraTaxAmt] = useState("0");
  const [subB, setSubB] = useState("0");
  const [finalTotal, setFinalTotal] = useState("0");
  const [otherDed, setOtherDed] = useState("0");
  const [tdsAmt, setTdsAmt] = useState("0");
  const [payable, setPayable] = useState("0");

  // Legacy discount_calculate(dt, choice) + gst_calculate + final_total.
  const recalc = (lines: StagedLine[], choice: 0 | 1, pctIn: string, amtIn: string, tdsRate: string, other: string, xAmt: string, xTax: string) => {
    let poolDisc = 0, poolNoDisc = 0, c = 0;
    for (const l of lines) {
      const a = num(l.amount);
      c += a;
      if (num(l.discount) <= 0) poolDisc += a;
      else poolNoDisc += a;
    }
    let pct = pctIn, amt = amtIn, off = false;
    if (c === poolNoDisc && lines.length > 0) {
      pct = "0"; amt = "0"; off = true; // every line carries its own discount
    } else if (lines.length > 0) {
      if (choice === 0) {
        const price = r2(num(pctIn) * poolDisc / 100);
        amt = s2(price);
      } else {
        pct = poolDisc ? s2(r2(num(amtIn) * 100 / poolDisc)) : "0";
      }
    }
    const discounted = poolDisc - num(amt);
    const tax = discounted + poolNoDisc;
    const tds = Math.round(tax * num(tdsRate) / 100);
    // GST panel per unique VAT (intra C: CGST/SGST @ v/2, else IGST @ v).
    const byVat = new Map<string, number>();
    for (const l of lines) {
      const k = String(num(l.vat));
      byVat.set(k, (byVat.get(k) ?? 0) + num(l.amount));
    }
    const rows: { label: string; amount: string }[] = [];
    let totalGst = 0;
    const intra = intraState;
    byVat.forEach((grpAmt, v) => {
      const vv = num(v);
      if (intra) {
        const half = vv / 2;
        const sub = r2(vv / 200 * grpAmt);
        totalGst += r2(vv / 100 * grpAmt);
        if (sub !== 0) {
          rows.push({ label: `CGST @ ${half} %`, amount: s2(sub) });
          rows.push({ label: `SGST @ ${half} %`, amount: s2(sub) });
        }
      } else {
        const sub = r2(vv / 100 * grpAmt);
        totalGst += sub;
        if (sub !== 0) rows.push({ label: `IGST @ ${vv} %`, amount: s2(sub) });
      }
    });
    const net = tax + totalGst;
    const xTaxAmt = num(xAmt) * num(xTax) / 100;
    const sb = num(xAmt) + xTaxAmt;
    const final = net + sb;
    let pay = Math.floor(final - num(other));
    if (String(tds) !== "0") pay = Math.floor(final - tds - num(other));
    setGross(s2(r2(c)));
    setHDiscPct(pct); setHDiscAmt(amt); setHDiscOff(off);
    setTaxable(s2(r2(tax)));
    setTdsAmt(String(tds));
    setGstRows(rows);
    setSubA(s2(r2(net)));
    setExtraTaxAmt(s2(r2(xTaxAmt)));
    setSubB(s2(r2(sb)));
    setFinalTotal(s2(r2(final)));
    setPayable(String(pay));
  };

  const recomputeAllRef = useRef<(() => void) | null>(null);
  recomputeAllRef.current = () =>
    recalc(staged, 1, hDiscPct, hDiscAmt, H.tdsRate, otherDed, extraAmt, extraTax);

  const onHDiscPct = (v: string) => {
    const p = isNumber(v);
    setHDiscPct(p);
    recalc(staged, 0, p, hDiscAmt, H.tdsRate, otherDed, extraAmt, extraTax);
  };
  const onHDiscAmt = (v: string) => {
    const a = isNumber(v);
    setHDiscAmt(a);
    recalc(staged, 1, hDiscPct, a, H.tdsRate, otherDed, extraAmt, extraTax);
  };
  const onExtra = (amt: string, tax: string) => {
    setExtraAmt(amt); setExtraTax(tax);
    recalc(staged, 1, hDiscPct, hDiscAmt, H.tdsRate, otherDed, amt, tax);
  };
  const onOther = (v: string) => {
    setOtherDed(v);
    recalc(staged, 1, hDiscPct, hDiscAmt, H.tdsRate, v, extraAmt, extraTax);
  };

  // Legacy link_valid_btn(): exact messages + focus, then blockUI.
  const linkValid = (): boolean => {
    const t = (id: string, msg: string) => { alert(msg); focus(id); return false; };
    if (H.vendorType === "Select") return t("it_vtype", "Please Select Vendor Type");
    if (H.vendorType === "Temporary" && H.vendorNameText.trim() === "") return t("it_vname", "Please Enter vendor name");
    if (H.vendorType === "Regular" && (H.vendorId === "Select" || !H.vendorId)) return t("it_vendor", "Please Select Vendor Name");
    if (H.gstNo.trim() === "") return t("it_gst", "Please Enter Gst Rate!!!");
    const prodText = E.product === "Select" ? "Select" : E.product;
    if (prodText === "Select") return t("en_product", "Please Select Item Type !!!");
    if (!E.itemCode || E.itemCode === "Select" || E.itemCode === "0") return t("en_item", "Please Select Item Name");
    if (E.product === "Uniform" && E.sizeU === "Select") return t("en_size", "Please Select Uniform Size");
    if (E.product === "Shoes" && E.sizeS === "Select") return t("en_size", "Please Select Shoes Size");
    if (E.desc.trim() === "") return t("en_desc", "Please Enter Description !!!");
    if (E.gstPct.trim() === "") return t("en_gst", "Please Enter GST% Rate !!!");
    if (E.unit === "Select" || !E.unit) return t("en_unit", "Please Select unit !!!");
    if (E.qty === "0" || E.qty === "") return t("en_qty", "Please Enter Quantity  !!!");
    if (E.rate === "0" || E.rate === "") return t("en_rate", "Please Enter Rate  !!!");
    if (H.tdsCode === "Select" || !H.tdsCode) return t("it_tdscode", "Please Select TDS Code");
    if (H.tdsRate.trim() === "") return t("it_tdsrate", "Please Enter TDS Rate!!!");
    return true;
  };

  const addItem = () => {
    if (!linkValid()) return;
    setBlocked(true);
    try {
      const vendorText = H.vendorType === "Regular"
        ? (vendors.find((v) => v.value === H.vendorId)?.text ?? H.vendorId)
        : H.vendorNameText.trim();
      const line: StagedLine = {
        item_code: E.itemCode, item_type: E.product, particular: E.itemText,
        size_uniform: E.sizeU === "Select" ? "" : E.sizeU,
        size_shoes: E.sizeS === "Select" ? "" : E.sizeS,
        size_pantry: E.sizeP === "Select" ? "" : E.sizeP,
        size_apron: E.sizeA === "Select" ? "" : E.sizeA,
        description: E.desc, vat: E.gstPct || "0", hsn: E.hsn,
        unit: E.unit === "Select" ? "" : E.unit,
        quantity: E.qty, rate: E.rate, discount: E.discPct, discount_amt: E.discAmt,
        amount: E.amount, vendor: vendorText,
      };
      const next = [...staged, line];
      setStaged(next);
      recalc(next, 1, hDiscPct, hDiscAmt, H.tdsRate, otherDed, extraAmt, extraTax);
      // Legacy entry reset after add (incl. vendor dropdown reset).
      setE(blankEntry());
      setPoItems([]);
      setH((p) => ({ ...p, vendorId: "Select" }));
      focus("en_product");
    } finally { setBlocked(false); }
  };

  const delStaged = (i: number) => {
    const next = staged.filter((_, j) => j !== i);
    setStaged(next);
    recalc(next, 1, hDiscPct, hDiscAmt, H.tdsRate, otherDed, extraAmt, extraTax);
  };

  // ---------------- file upload ----------------
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploads, setUploads] = useState<UploadRow[]>([]);

  const checkFile = (f: File | null): boolean => {
    if (!f) return true;
    const name = f.name;
    const ok = VALID_EXTS.some((e) => name.substr(name.length - e.length).toLowerCase() === e.toLowerCase());
    if (!ok) {
      alert(`Sorry, ${name} is invalid, allowed extensions are: ${VALID_EXTS.join(", ")}`);
      if (fileRef.current) fileRef.current.value = "";
      setFile(null);
      return false;
    }
    return true;
  };

  // Legacy r_validation(): Process/Update gate, exact messages + focus.
  const rValidation = (): boolean => {
    const t = (id: string, msg: string) => { alert(msg); focus(id); return false; };
    if (H.vendorType === "Select") return t("it_vtype", "Please Select Vendor Type");
    if (H.vendorType === "Regular" && (H.vendorId === "Select" || !H.vendorId)) return t("it_vendor", "Please Select Vendor Name");
    if (H.vendorType === "Temporary" && H.vendorNameText.trim() === "") return t("it_vname", "Please Enter vendor name");
    if (H.poNo === "Select" || !H.poNo) return t("it_po", "Please Select Purchase Order No");
    if (H.gstNo.trim() === "") return t("it_gst", "Please Enter Gst Rate!!!");
    if (H.invNo.trim() === "") return t("it_invno", "Please Enter Vendor Invoice Number!!!");
    if (H.tdsCode === "Select" || !H.tdsCode) return t("it_tdscode", "Please Select TDS Code");
    if (H.tdsRate.trim() === "") return t("it_tdsrate", "Please Enter TDS Rate!!!");
    if (gross === "0" || gross === "") return t("it_gross", " Please Click On the Add Button(Table) to calculate Gross Amount !!!!!!");
    if (!file) return t("file_input", "Please Upload Report");
    return true;
  };

  const confirmDelete = (msg: string): boolean => {
    // Legacy R_validation().
    const r = confirm(msg);
    if (!r) alert("Record not Available");
    return r;
  };

  const billBody = () => ({
    cust_code: H.vendorType === "Regular" ? H.vendorId : "",
    cust_name: H.vendorType === "Regular"
      ? (vendors.find((v) => v.value === H.vendorId)?.text?.split(" - ").slice(1).join(" - ") ?? "")
      : H.vendorNameText.trim(),
    customer_gst_no: H.gstNo.trim(),
    vendor_invoice_no: H.invNo.trim(),
    vendor_type: H.vendorType,
    pur_order_no: H.poNo === "Select" ? "" : H.poNo,
    doc_date: dmyToIso(H.invDate),
    booking_date: dmyToIso(H.bookingDate),
    bill_address: H.billAddr,
    narration: H.narration,
    bank_ac_name: H.bankAc, bank_ac_num: H.bankNo, ifc_code: H.ifsc, credit_period: H.credit,
    discount: hDiscPct || "0",
    extra_chrgs: extraName, extra_chrgs_amt: extraAmt || "0", extra_chrgs_tax: extraTax || "0",
    tax_code: H.tdsCode === "Select" ? "" : H.tdsCode,
    tds_rate: H.tdsRate || "0",
    other_deduction: otherDed || "0",
    customer_notes: notes, terms_conditions: terms,
    challan_no: H.challan, bill_against_po: H.billAgainstPO === "Select" ? "" : H.billAgainstPO,
    lines: staged.map((l, i) => ({
      sr_no: i + 1, item_code: l.item_code, particular: l.particular,
      description: l.description, hsn_number: l.hsn, designation: l.unit,
      vat: l.vat || "0", quantity: l.quantity || "0", rate: l.rate || "0",
      discount: l.discount || "0", discount_amt: l.discount_amt || "0",
      vendor: l.vendor, item_type: l.item_type,
      size_uniform: l.size_uniform, size_shoes: l.size_shoes,
      size_pantry: l.size_pantry, size_apron: l.size_apron,
    })),
  });

  const postBill = async (method: "POST" | "PUT", url: string) => {
    await fetch(`${API_BASE_URL}/api/auth/csrf/`, { credentials: "include" });
    const getCookie = (n: string) => {
      const m = document.cookie.match(new RegExp("(^|; )" + n + "=([^;]+)"));
      return m ? decodeURIComponent(m[2]) : "";
    };
    const fd = new FormData();
    const b = billBody();
    Object.entries(b).forEach(([k, v]) => {
      if (k !== "lines") fd.append(k, String(v ?? ""));
    });
    fd.append("lines", JSON.stringify(b.lines));
    if (file) fd.append("vendor_upload", file);
    return fetch(`${API_BASE_URL}${url}`, {
      method, credentials: "include",
      headers: { "X-CSRFToken": getCookie("csrftoken") ?? "" },
      body: fd,
    });
  };

  const errText = async (r: Response): Promise<string> => {
    try {
      const b = await r.json();
      if (typeof b === "string") return b;
      if (Array.isArray(b)) return b.join(" ");
      if (typeof b === "object" && b) {
        const o = b as Record<string, unknown>;
        if (typeof o.detail === "string") return o.detail;
        const vals = Object.values(o).flat().map(String);
        if (vals.length) return vals.join(" ");
      }
      return `Failed (${r.status})`;
    } catch { return `Failed (${r.status})`; }
  };

  const doProcess = async () => {
    if (!rValidation()) return;
    setBlocked(true);
    try {
      const r = await postBill("POST", GRN);
      if (r.ok) {
        const b = await r.json();
        alert(`Invoice (${b.doc_no}) added successfully!`);
        alert("Record Added Successfully !!!");
        loadUploads(b.doc_no, H.vendorType === "Regular" ? H.vendorId : "", H.vendorType);
      } else alert(await errText(r));
    } finally { setBlocked(false); }
  };

  const doUpdate = async () => {
    if (editId == null) return;
    if (!rValidation()) return;
    setBlocked(true);
    try {
      const r = await postBill("PUT", `${GRN}${editId}/`);
      if (r.ok) {
        const b = await r.json();
        alert(`Invoice (${b.doc_no}) Updated successfully!`);
        resetAfterWrite();
      } else alert(await errText(r));
    } finally { setBlocked(false); }
  };

  const doDelete = async () => {
    if (editId == null) return;
    if (!confirmDelete("Are you Sure You Want to Delete Record")) return;
    setBlocked(true);
    try {
      const r = await rm(`${GRN}${editId}/`);
      if (r.ok) {
        const b = await r.json().catch(() => ({}));
        alert(`${(b as { cust_name?: string }).cust_name ?? ""} Deleted Successfully`);
        resetAfterWrite();
      } else alert(await errText(r));
    } finally { setBlocked(false); }
  };

  const doFinalize = async () => {
    if (editId == null) return;
    if (!confirmDelete("Are you Sure You Want to Final This Invoice")) return;
    setBlocked(true);
    try {
      const r = await mk(`${GRN}${editId}/finalize/`, {});
      if (r.ok) { alert("Invoice finalized."); doPrint(); resetAfterWrite(); }
      else alert(await errText(r));
    } finally { setBlocked(false); }
  };

  const resetAfterWrite = () => {
    // Legacy post-update/delete cycle: clear + new doc no + Save mode.
    setH(blankHeader());
    setBookingToday();
    setE(blankEntry());
    setPoItems([]); setItemTypes([]); setInvNos([]); setTdsCodes([]);
    setStaged([]);
    setNotes(""); setTerms("");
    setGross("0"); setHDiscPct("0"); setHDiscAmt("0"); setHDiscOff(false);
    setTaxable("0"); setGstRows([]); setSubA("0");
    setExtraName(""); setExtraAmt("0"); setExtraTax("0"); setExtraTaxAmt("0");
    setSubB("0"); setFinalTotal("0"); setOtherDed("0"); setTdsAmt("0"); setPayable("0");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setUploads([]);
    setMode("new"); setEditId(null);
    loadDocPreview();
  };

  const setBookingToday = () => setH((p) => ({ ...p, bookingDate: todayDMY(), invDate: todayDMY() }));

  const loadUploads = async (docNo: string, custCode: string, vType: string) => {
    // Legacy vendor_upload_select(): rows for this vendor+doc (download grid).
    if (!docNo) { setUploads([]); return; }
    const d = await getJSON<{ results: UploadRow[] } | UploadRow[]>(
      `${GRN}?search=${encodeURIComponent(docNo)}`);
    const rows = (Array.isArray(d) ? d : (d?.results ?? [])) as (UploadRow & { vendor_upload?: string })[];
    setUploads(rows.filter((r) => r.doc_no === docNo).map((r) => ({
      cust_code: custCode, cust_name: H.vendorType === "Regular"
        ? (vendors.find((v) => v.value === custCode)?.text ?? "") : custCode,
      doc_no: r.doc_no, vendor_upload: (r as unknown as { vendor_upload?: string }).vendor_upload ?? "",
    })));
    void vType;
  };

  const downloadUpload = async (fname: string) => {
    if (!fname) { alert("Attachment File Cannot Be Uploaded !!!"); return; }
    const id = searchRows.find((r) => r.doc_no === H.docno)?.id ?? editId;
    if (!id) { alert("Attachment File Cannot Be Uploaded !!!"); return; }
    const r = await fetch(`${API_BASE_URL}${GRN}${id}/download/`, { credentials: "include" });
    if (!r.ok) { alert("Attachment File Cannot Be Uploaded !!!"); return; }
    const blob = await r.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fname;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  // Legacy lnk_button_Click "Get Details": load bill into the form.
  const getDetails = async (row: SearchRow) => {
    setBlocked(true);
    try {
      const b = await getJSON<BillDetail>(`${GRN}${row.id}/`);
      if (!b) return;
      const g = (k: string) => String(b[k] ?? "");
      const isReg = String(b.vendor_type ?? "Regular") === "Regular";
      setH({
        docno: String(b.doc_no ?? ""), vendorType: String(b.vendor_type ?? "Regular"),
        vendorId: isReg ? String(b.cust_code ?? "Select") : "Select",
        vendorNameText: isReg ? "" : String(b.cust_name ?? ""),
        poNo: String(b.pur_order_no ?? "Select") || "Select",
        gstNo: String(b.customer_gst_no ?? ""), gstReadonly: isReg,
        invDate: isoToDmy(String(b.doc_date ?? "")), invNo: String(b.vendor_invoice_no ?? ""),
        bookingDate: isoToDmy(String(b.booking_date ?? "")) || todayDMY(),
        challan: "", billAddr: String(b.bill_address ?? ""), billReadonly: isReg,
        narration: String(b.narration ?? ""),
        bankAc: String(b.bank_ac_name ?? ""), bankNo: String(b.bank_ac_num ?? ""),
        ifsc: String(b.ifc_code ?? ""), credit: String(b.credit_period ?? ""),
        bankReadonly: isReg, balancePO: "",
        billAgainstPO: "Select",
        tdsCode: String(b.tax_code ?? "Select") || "Select",
        tdsRate: String(b.tds_rate ?? ""),
      });
      setNotes(String(b.customer_notes ?? ""));
      setTerms(String(b.terms_conditions ?? ""));
      setExtraName(String(b.extra_chrgs ?? ""));
      setExtraAmt(String(b.extra_chrgs_amt ?? "0"));
      setExtraTax(String(b.extra_chrgs_tax ?? "0"));
      setOtherDed(String(b.other_deduction ?? "0"));
      setHDiscPct(String(b.discount ?? "0"));
      setHDiscAmt("0");
      const lines: StagedLine[] = (b.lines ?? []).map((l) => ({
        item_code: String(l.item_code ?? ""), item_type: String(l.item_type ?? ""),
        particular: String(l.particular ?? ""),
        size_uniform: String(l.size_uniform ?? ""), size_shoes: String(l.size_shoes ?? ""),
        size_pantry: String(l.size_pantry ?? ""), size_apron: String(l.size_apron ?? ""),
        description: String(l.description ?? ""), vat: String(l.vat ?? ""),
        hsn: String(l.hsn_number ?? ""), unit: String(l.designation ?? ""),
        quantity: String(l.quantity ?? ""), rate: String(l.rate ?? ""),
        discount: String(l.discount ?? ""), discount_amt: String(l.discount_amt ?? ""),
        amount: String(l.amount ?? ""), vendor: String(l.vendor ?? ""),
      }));
      setStaged(lines);
      // Legacy re-runs discount/gst calc on the loaded grid.
      setGstRows([]);
      setTimeout(() => {
        const pct = String(b.discount ?? "0");
        setHDiscPct(pct);
        recalc(lines, 0, pct, "0", String(b.tds_rate ?? ""),
          String(b.other_deduction ?? "0"), String(b.extra_chrgs_amt ?? "0"),
          String(b.extra_chrgs_tax ?? "0"));
        setHDiscAmt(String(b.discounted_price ?? "0"));
        setTaxable(String(b.taxable_amt ?? "0"));
        setTdsAmt(String(b.tds_amount ?? "0"));
        setSubA(String(b.net_total ?? "0"));
        setExtraTaxAmt(String(b.extra_chrgs_tax_amt ?? "0"));
        setSubB(s2(num(b.extra_chrgs_amt) + num(b.extra_chrgs_tax_amt)));
        setFinalTotal(String(b.final_price ?? "0"));
        setPayable(String(b.payable_amount ?? "0"));
        setGross(String(b.gross_amount ?? "0"));
      }, 0);
      // Cascades for the loaded vendor/PO.
      if (isReg && b.cust_code) {
        const vid = String(b.cust_code);
        getJSON<{ value: string; text: string }[]>(`${LK}po-numbers/?vend_id=${encodeURIComponent(vid)}`)
          .then((d) => setPoNos(d ?? []));
        getJSON<{ value: string; text: string }[]>(`${LK}tds-codes/?vend_id=${encodeURIComponent(vid)}`)
          .then((d) => setTdsCodes(d ?? []));
      }
      if (b.pur_order_no) {
        const po = String(b.pur_order_no);
        getJSON<{ value: string; text: string }[]>(`${LK}invoice-nos/?po_no=${encodeURIComponent(po)}`)
          .then((d) => setInvNos(d ?? []));
        getJSON<{ balance: string }>(`${LK}balance-po/?po_no=${encodeURIComponent(po)}`)
          .then((d) => setH((p) => ({ ...p, balancePO: d?.balance ?? "" })));
      }
      gstCounter(String(b.customer_gst_no ?? ""));
      setUploads([{
        cust_code: String(b.cust_code ?? ""), cust_name: String(b.cust_name ?? ""),
        doc_no: String(b.doc_no ?? ""),
        vendor_upload: String(b.vendor_upload ?? ""),
      }]);
      setMode("edit");
      setEditId(row.id);
      void g;
    } finally { setBlocked(false); }
  };

  // Legacy btn_print -> Rpt_PInvoice[I][_Discount].rpt: the server draws the PDF on the same layout; the HTML sheet below is the fallback.
  const doPrint = async () => {
    if (!H.docno) { alert("Please Select Purchase Bill"); return; }
    if (editId) {
      const w = window.open("", "_blank");
      try {
        const r = await fetch(`${API_BASE_URL}/api/transactions/goods-receipts/${editId}/print/`, { credentials: "include" });
        if (r.ok && (r.headers.get("content-type") || "").includes("pdf")) {
          const url = URL.createObjectURL(await r.blob());
          if (w) w.location.href = url; else window.location.href = url;
          return;
        }
      } catch { /* fall through to the HTML sheet */ }
      w?.close();
    }
    doPrintHtml();
  };
  const doPrintHtml = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    const lineRows = staged.map((l, i) =>
      `<tr><td>${i + 1}</td><td>${l.particular}</td><td>${l.description}</td><td>${l.vat}</td><td>${l.hsn}</td><td>${l.unit}</td><td>${l.quantity}</td><td>${l.rate}</td><td>${l.discount}</td><td>${l.discount_amt}</td><td>${l.amount}</td></tr>`).join("");
    const gst = gstRows.map((r) => `<tr><td>${r.label}</td><td>${r.amount}</td></tr>`).join("");
    w.document.write(`<html><head><title>Purchase Bill ${H.docno}</title></head><body style="font-family:Verdana;font-size:12px">` +
      `<h2 style="text-align:center">PURCHASE BILL - ${H.docno}</h2>` +
      `<p><b>Vendor:</b> ${H.vendorType === "Regular" ? H.vendorId : H.vendorNameText} &nbsp; <b>GST:</b> ${H.gstNo} &nbsp; <b>Invoice No:</b> ${H.invNo} &nbsp; <b>Date:</b> ${H.invDate}</p>` +
      `<p><b>PO:</b> ${H.poNo} &nbsp; <b>TDS:</b> ${H.tdsCode} @ ${H.tdsRate}</p>` +
      `<table border="1" cellpadding="4" cellspacing="0" width="100%"><thead><tr><th>Sr</th><th>Particular</th><th>Description</th><th>GST%</th><th>HSN</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Disc%</th><th>Disc Amt</th><th>Amount</th></tr></thead><tbody>${lineRows}</tbody></table>` +
      `<br/><table border="0" cellpadding="3" align="right"><tbody>` +
      `<tr><td><b>Gross Amount</b></td><td>${gross}</td></tr>` +
      `<tr><td><b>Discount (%)</b></td><td>${hDiscPct}</td></tr>` +
      `<tr><td><b>Discount (Rs.)</b></td><td>${hDiscAmt}</td></tr>` +
      `<tr><td><b>Taxable Amount</b></td><td>${taxable}</td></tr>${gst}` +
      `<tr><td><b>Sub Total(A)</b></td><td>${subA}</td></tr>` +
      `<tr><td><b>Sub Total(B)</b></td><td>${subB}</td></tr>` +
      `<tr><td><b>Total Amount (Inc GST)</b></td><td>${finalTotal}</td></tr>` +
      `<tr><td><b>Other Deduction(Hold)</b></td><td>${otherDed}</td></tr>` +
      `<tr><td><b>TDS Amount Deducted</b></td><td>${tdsAmt}</td></tr>` +
      `<tr><td><b>Payable Amount</b></td><td>${payable}</td></tr>` +
      `</tbody></table><p><b>Notes:</b> ${notes}<br/><b>Terms:</b> ${terms}</p>` +
      `</body></html>`);
    w.document.close();
    w.print();
  };

  // ---------------- report tab ----------------
  const [rpFrom, setRpFrom] = useState("");
  const [rpTo, setRpTo] = useState("");
  const [rpVendor, setRpVendor] = useState("Select");
  const [rpPO, setRpPO] = useState("ALL");
  const [rpInv, setRpInv] = useState("Select");
  const [rpVendors, setRpVendors] = useState<{ value: string; text: string }[]>([]);
  const [rpPOs, setRpPOs] = useState<{ value: string; text: string }[]>([]);
  const [rpInvs, setRpInvs] = useState<{ value: string; text: string }[]>([]);

  useEffect(() => {
    getJSON<{ value: string; text: string }[]>(`${LK}vendors/`).then((d) =>
      setRpVendors(d ?? []));
  }, []);

  const onRpVendor = async (v: string) => {
    setRpVendor(v);
    setRpPO("ALL"); setRpInv("Select");
    const q = `from_month=${encodeURIComponent(rpFrom)}&to_month=${encodeURIComponent(rpTo)}&vendor=${encodeURIComponent(v)}`;
    const [pos, invs] = await Promise.all([
      getJSON<{ value: string; text: string }[]>(`${LK}report-pos/?${q}`),
      getJSON<{ value: string; text: string }[]>(`${LK}report-invoices/?${q}`),
    ]);
    setRpPOs(pos ?? []); setRpInvs(invs ?? []);
  };

  const onRpPO = async (p: string) => {
    setRpPO(p);
    setRpInv("Select");
    const q = `from_month=${encodeURIComponent(rpFrom)}&to_month=${encodeURIComponent(rpTo)}&vendor=${encodeURIComponent(rpVendor)}&po_no=${encodeURIComponent(p)}`;
    const invs = await getJSON<{ value: string; text: string }[]>(`${LK}report-invoices/?${q}`);
    setRpInvs(invs ?? []);
  };

  const doReport = async () => {
    // Legacy report(): exact messages.
    if (rpFrom.trim() === "") { alert("Please Select From Bill Month"); focus("rp_from"); return; }
    if (rpTo.trim() === "") { alert("Please Select To Bill Month"); focus("rp_to"); return; }
    if (rpVendor === "Select") { alert("Please Select Vendor Name"); focus("rp_vendor"); return; }
    setBlocked(true);
    try {
      const q = `from_month=${encodeURIComponent(rpFrom)}&to_month=${encodeURIComponent(rpTo)}` +
        `&vendor=${encodeURIComponent(rpVendor)}&po_no=${encodeURIComponent(rpPO)}` +
        `&invoice_no=${encodeURIComponent(rpInv)}`;
      const d = await getJSON<{ results: Record<string, string>[] }>(`${GRN}report/?${q}`);
      const rows = d?.results ?? [];
      if (!rows.length) { alert("No Matching Records Found."); return; }
      // Legacy PURCHASE_EXPENSES_REGISTER_<vendor>.xls (HTML table, SUM formulas).
      const esc = (v: string) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
      const tr = rows.map((r, i) =>
        `<tr><td>${i + 1}</td><td>${esc(r.vendor_invoice_date)}</td><td>${esc(r.booked_date)}</td>` +
        `<td>${esc(r.vendor_invoice_no)}</td><td>${esc(r.vendor_name)}</td><td>${esc(r.customer_gst_no)}</td>` +
        `<td>${esc(r.vendor_type)}</td><td>${r.gross_amount}</td><td>${r.igst}</td><td>${r.cgst}</td>` +
        `<td>${r.sgst}</td><td>${r.total_invoice_value}</td><td>${esc(r.tax_code)}</td>` +
        `<td>${r.tds_amount}</td><td>${r.other_deduction}</td><td>${r.payable_amount}</td>` +
        `<td>${esc(r.narration)}</td></tr>`).join("");
      const n = rows.length;
      const total = `<tr><b><td align=center colspan=7>Total</td>` +
        `<td>=Round(SUM(H3:H${n + 2}),2)</td><td>=Round(SUM(I3:I${n + 2}),2)</td>` +
        `<td>=Round(SUM(J3:J${n + 2}),2)</td><td>=Round(SUM(K3:K${n + 2}),2)</td>` +
        `<td>=Round(SUM(L3:L${n + 2}),2)</td><td></td>` +
        `<td>=Round(SUM(N3:N${n + 2}),2)</td><td>=Round(SUM(O3:O${n + 2}),2)</td>` +
        `<td>=Round(SUM(P3:P${n + 2}),2)</td>`;
      const html = `<table border=1><tr><th bgcolor=yellow colspan=17>PURCHASE / EXPENSES REGISTER </th></tr>` +
        `<tr><th>SR NO.</th><th>VENDOR INVOICE DATE</th><th>BOOKED DATE</th><th>VENDOR INVOICE NO</th>` +
        `<th>VENDOR CODE</th><th>GST NO</th><th>PURCHES/EXP TYPE</th><th>GROSS AMOUNT</th><th>IGST AMOUNT</th>` +
        `<th>CGST AMOUNT</th><th>SGST AMOUNT</th><th>TOTAL INVOICE VALUE</th><th>U/S</th><th>TDS DEDUCTED</th>` +
        `<th> HOLD AMOUNT</th><th>PAYABLE AMOUNT</th><th>NARRATION</th></tr> ${tr}${total}</table>`;
      const blob = new Blob([`<style> .textmode { } </style>` + html], { type: "application/vnd.ms-excel" });
      const a = document.createElement("a");
      const vname = (rpVendors.find((v) => v.value === rpVendor)?.text ?? rpVendor).replace(/ /g, "_");
      a.href = URL.createObjectURL(blob);
      a.download = `PURCHASE_EXPENSES_REGISTER_${vname}.xls`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } finally { setBlocked(false); }
  };

  // ---------------- grid helpers (DataTables parity) ----------------
  const PAGE_SIZE = 10;
  const pager = (total: number) => (
    <div style={{ textAlign: "left", padding: "8px", background: "#2461BF", color: "#fff", fontWeight: "bold" }}>Total: {total} records</div>
  );
  const sFiltered = searchRows.filter((r) =>
    !sSearch || `${r.doc_no} ${r.cust_name}`.toLowerCase().includes(sSearch.toLowerCase()));
    const sPageRows = sFiltered; // all rows, no paging

  const Req = () => <span style={{ color: "red" }}>*</span>;
  const sizeVisible = (t: string) =>
    E.product === "Uniform" ? t === "U" : E.product === "Shoes" ? t === "S"
    : E.product === "pantry_jacket" ? t === "P" : E.product === "Apron" ? t === "A" : false;

  return (
    <div className="container-fluid">
      {blocked && (
        <div style={{ position: "fixed", inset: 0, background: "#CCCCCC", opacity: 0.7, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
          Please wait...
        </div>
      )}
      <div id="tabs" style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", marginBottom: "25px", marginTop: "25px", borderRadius: "10px" }}>
        <ul style={{ listStyle: "none", display: "flex", gap: "4px", padding: "8px 8px 0 8px", margin: 0 }}>
          <li style={{ background: tab === 0 ? "#fff" : "#e7e7fa", border: "1px solid #ccc", borderBottom: tab === 0 ? "1px solid #fff" : "1px solid #ccc", borderRadius: "4px 4px 0 0", padding: "6px 14px" }}>
            <a href="#menu1" onClick={(e) => { e.preventDefault(); pickTab(0); }} style={{ textDecoration: "none", color: "#333", fontWeight: tab === 0 ? "bold" : "normal" }}><b>Purchase Bill</b></a>
          </li>
          <li style={{ background: tab === 1 ? "#fff" : "#e7e7fa", border: "1px solid #ccc", borderBottom: tab === 1 ? "1px solid #fff" : "1px solid #ccc", borderRadius: "4px 4px 0 0", padding: "6px 14px" }}>
            <a href="#menu2" onClick={(e) => { e.preventDefault(); pickTab(1); }} style={{ textDecoration: "none", color: "#333", fontWeight: tab === 1 ? "bold" : "normal" }}><b>Monthwise Purchase Repots</b></a>
          </li>
        </ul>

        {tab === 0 && (
          <div id="menu1">
            <div className="panel panel-primary" style={{ backgroundColor: "white" }}>
              <div className="panel-heading">
                <div className="row">
                  <div className="col-sm-1"></div>
                  <div className="col-sm-9">
                    <div style={{ textAlign: "center", color: "#fff", fontSize: "16px" }} className="text-center text-uppercase"><b>PURCHASE BILL</b></div>
                  </div>
                  <div className="col-sm-2 text-right">
                    <a href="#" onClick={(e) => { e.preventDefault(); window.open("html/Quotation.html", "popUpWindow", "height=500,width=600,left=100,top=100"); }} style={{ fontSize: "10px", color: "#fff" }}>
                      <img src="/Images/help_ico.png" alt="Help" width={20} height={20} title="Help" />
                    </a>
                  </div>
                </div>
              </div>
              <div className="panel-body">
                <div className="container-fluid" style={{ background: "#f3f1fe", borderRadius: "10px", marginTop: "20px", border: "1px solid white" }}>
                  <br />
                  <div className="row">
                    <div className="col-sm-1 col-xs-12"></div>
                    <div className="col-sm-2 col-xs-12">
                      <b>  Purchase Bill Number :</b>
                      <input id="sch_doc" className="form-control text_box" maxLength={10} value={schDoc}
                        onChange={(e) => { setSchDoc(allowAlphabetNum(e.target.value)); setSchName(""); }} />
                    </div>
                    <div className="col-sm-3 col-xs-12">
                      <b> Vendor Name :</b>
                      <input id="sch_name" className="form-control text_box" maxLength={30} value={schName}
                        onChange={(e) => { setSchName(e.target.value); setSchDoc(""); }} />
                    </div>
                    <br />
                    <div className="col-sm-3 col-xs-12" style={{ marginTop: "9px" }}>
                      <button className="btn btn-primary" onClick={doSearch}> Search </button>{" "}
                      <button className="btn btn-danger" onClick={() => router.push("/Home")}>Close</button>
                    </div>
                  </div>
                  <br />
                  {searched && (
                    <div>
                      <div style={{ marginBottom: "8px", display: "flex", gap: "6px", alignItems: "center" }}>
                        <input className="form-control" style={{ width: "200px", display: "inline-block" }} placeholder="Search..." value={sSearch}
                          onChange={(e) => { setSSearch(e.target.value); setSPage(1); }} />
                      </div>
                      <div className="grid-view">
                        <table className="table" style={{ backgroundColor: "White", borderColor: "#CCCCCC", width: "100%" }}>
                          <thead>
                            <tr style={{ backgroundColor: "#507CD1", color: "White", fontWeight: "bold", fontSize: "11px" }}>
                              <th>Estimate No</th><th>Estimate Date</th><th>Vendor Name</th>
                              <th>Amount</th><th>Get Details</th><th>Status</th><th>Reject Reason</th>
                            </tr>
                          </thead>
                          <tbody>
                            {sPageRows.map((r) => (
                              <tr key={r.id} style={{ backgroundColor: "#EFF3FB" }}>
                                <td>{r.doc_no}</td>
                                <td>{isoToDmy(r.doc_date)}</td>
                                <td>{r.cust_name}</td>
                                <td>{String(r.final_price)}</td>
                                <td><button className="btn btn-primary" style={{ fontSize: "XX-Small", color: "white", width: "80%" }} onClick={() => getDetails(r)}>Get Details</button></td>
                                <td>{STATUS_TEXT[r.final_flag] ?? ""}</td>
                                <td>{r.purches_bill_reject ?? ""}</td>
                              </tr>
                            ))}
                            {sPageRows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center" }}>No records found</td></tr>}
                          </tbody>
                        </table>
                      </div>
                      {pager(sFiltered.length)}
                    </div>
                  )}
                  <br />
                </div>
                <br />

                <div className="container-fluid" style={{ background: "#f3f1fe", padding: "15px", borderRadius: "10px", border: "1px solid white" }}>
                  <br />
                  <div className="row">
                    <div className="col-sm-1 col-xs-12"></div>
                    <div className="col-sm-2 col-xs-12">
                      <b>System Purchase Bill Number :</b> <Req />
                      <input id="it_docno" className="form-control text_box" maxLength={10} value={H.docno} readOnly onChange={() => { }} />
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      <span><b>Vendor Type:</b> <span style={{ color: "red" }}>*</span></span>
                      <select id="it_vtype" className="form-control text_box" value={H.vendorType} onChange={(e) => onVendorType(e.target.value)}>
                        <option value="Select">Select</option>
                        <option value="Regular">Regular</option>
                        <option value="Temporary">Temporary</option>
                      </select>
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      <span><b>Vendor Name:</b> <Req /></span>
                      {H.vendorType !== "Temporary" ? (
                        <select id="it_vendor" className="form-control text_box" value={H.vendorId} onChange={(e) => onVendor(e.target.value)}>
                          <option value="Select">Select</option>
                          {vendors.map((v) => <option key={v.value} value={v.value}>{v.text}</option>)}
                        </select>
                      ) : (
                        <input id="it_vname" className="form-control text_box" maxLength={50} value={H.vendorNameText}
                          onChange={(e) => setHv("vendorNameText", allowAlphabetNum(e.target.value))} />
                      )}
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      <span><b>Purchase Order No:</b> <span style={{ color: "red" }}>*</span></span>
                      <select id="it_po" className="form-control text_box" value={H.poNo} onChange={(e) => onPO(e.target.value)}>
                        <option value="Select">Select</option>
                        {poNos.map((p) => <option key={p.value} value={p.value}>{p.text}</option>)}
                      </select>
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      <b>Vendor GST Number:</b><span style={{ color: "red" }}>*</span>
                      <input id="it_gst" className="form-control text_box" maxLength={30} value={H.gstNo} readOnly={H.gstReadonly}
                        onChange={(e) => setHv("gstNo", allowAlphabetNum(e.target.value))} />
                    </div>
                  </div>
                  <br />
                  <div className="row">
                    <div className="col-sm-1 col-xs-12"></div>
                    <div className="col-sm-2 col-xs-12">
                      <b>Vendor Invoice Date : </b>
                      <input id="it_invdate" className="form-control text_box" style={{ marginBottom: "0px" }} value={H.invDate}
                        onChange={(e) => setHv("invDate", e.target.value)} placeholder="dd/mm/yyyy" />
                    </div>
                    <div className="col-sm-2">
                      <b>Vendor Invoice No:</b><span style={{ color: "red" }}>*</span>
                      <input id="it_invno" className="form-control text_box" value={H.invNo}
                        onChange={(e) => setHv("invNo", allowAlphabetNum(e.target.value))} />
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      <b>Booking Date : </b>
                      <input className="form-control text_box" style={{ marginBottom: "0px" }} value={H.bookingDate} readOnly onChange={() => { }} />
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      <b>   Challan No :</b>
                      <input className="form-control" maxLength={10} value={H.challan}
                        onChange={(e) => setHv("challan", allowAlphabetNum(e.target.value))} />
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      <span><b>Bill Address :</b></span>
                      <textarea className="form-control text_box" rows={6} maxLength={200} value={H.billAddr}
                        readOnly={H.billReadonly} style={{ overflow: "hidden" }}
                        onChange={(e) => setHv("billAddr", allowAlphabetNum(e.target.value))} />
                    </div>
                  </div>
                  <br />
                  <div className="row">
                    <div className="col-sm-1"></div>
                    <div className="col-sm-2 col-xs-12">
                      <span><b>Narration :</b></span>
                      <textarea className="form-control text_box" maxLength={200} value={H.narration}
                        style={{ overflow: "hidden" }}
                        onChange={(e) => setHv("narration", allowAlphabet1(e.target.value))} />
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      <span><b>Bank A/C Name:</b></span>
                      <input className="form-control text_box" maxLength={30} value={H.bankAc} readOnly={H.bankReadonly}
                        onChange={(e) => setHv("bankAc", allowAlphabet1(e.target.value))} />
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      <span><b>Bank A/C No:</b></span>
                      <input className="form-control text_box" maxLength={30} value={H.bankNo} readOnly={H.bankReadonly}
                        onChange={(e) => setHv("bankNo", isNumber(e.target.value))} />
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      <span><b>IFSC Code:</b></span>
                      <input className="form-control text_box" maxLength={30} value={H.ifsc} readOnly={H.bankReadonly}
                        onChange={(e) => setHv("ifsc", allowAlphabetNum(e.target.value))} />
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      <span><b>Credit Period:</b></span>
                      <input className="form-control text_box" maxLength={30} value={H.credit} readOnly={H.bankReadonly}
                        onChange={(e) => setHv("credit", isNumber(e.target.value))} />
                    </div>
                  </div>
                  <br />
                  <div className="row">
                    <div className="col-sm-1"></div>
                    <div className="col-sm-2 col-xs-12">
                      <span><b>Balance PO Value:</b></span>
                      <input className="form-control text_box" maxLength={30} value={H.balancePO} readOnly onChange={() => { }} />
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      <span><b>Bill No Against PO:</b></span>
                      <select className="form-control" style={{ width: "100%" }} value={H.billAgainstPO}
                        onChange={(e) => setHv("billAgainstPO", e.target.value)}>
                        <option value="Select">Select</option>
                        {invNos.map((p) => <option key={p.value} value={p.value}>{p.text}</option>)}
                      </select>
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      <b>TDS Code:</b><span style={{ color: "red" }}>*</span>
                      <select id="it_tdscode" className="form-control" style={{ width: "100%" }} value={H.tdsCode}
                        onChange={(e) => onTdsCode(e.target.value)}>
                        <option value="Select">Select</option>
                        {tdsCodes.map((p) => <option key={p.value} value={p.value}>{p.text}</option>)}
                      </select>
                    </div>
                    <div className="col-sm-2 col-xs-12">
                      <b>TDS Rate :</b><span style={{ color: "red" }}>*</span>
                      <input id="it_tdsrate" className="form-control" value={H.tdsRate} readOnly onChange={() => { }} />
                    </div>
                  </div>
                  <br />
                </div>
                <br />
                <br />

                <div className="container-fluid" style={{ background: "#f3f1fe", borderRadius: "10px", border: "1px solid white" }}>
                  <br />
                  <div className="grid-view">
                    <table id="maintable" className="table table-striped" border={1} style={{ borderColor: "#d8d6d6" }}>
                      <thead>
                        <tr style={{ color: "#000", backgroundColor: "#D1D0CE", textAlign: "center" }}>
                          <th style={{ textAlign: "center" }}>Item Type</th>
                          <th style={{ textAlign: "center" }}>Item Name</th>
                          {sizeVisible("U") && <th style={{ textAlign: "center" }}>Uniform Size</th>}
                          {sizeVisible("S") && <th style={{ textAlign: "center" }}>Shoes Size</th>}
                          {sizeVisible("P") && <th style={{ textAlign: "center" }}>Pantry Jacket Size</th>}
                          {sizeVisible("A") && <th style={{ textAlign: "center" }}>Apron Size</th>}
                          <th style={{ textAlign: "center" }}>Description</th>
                          <th style={{ textAlign: "center" }}>GST(%)</th>
                          <th style={{ textAlign: "center" }}>{E.hsnLabel}</th>
                          <th style={{ textAlign: "center" }}>Unit</th>
                          <th style={{ textAlign: "center" }}>Per Unit</th>
                          <th style={{ textAlign: "center" }}>Quantity</th>
                          <th style={{ textAlign: "center" }}>Purchase Rate</th>
                          <th style={{ textAlign: "center" }}>Discount Rate (%)</th>
                          <th style={{ textAlign: "center" }}>Discount Amount</th>
                          <th style={{ textAlign: "center" }}>Total Amount</th>
                          <th style={{ textAlign: "center" }}>Table</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td>
                            <select id="en_product" className="form-control text_box" style={{ width: "70px" }}
                              value={E.product} onChange={(e) => onProduct(e.target.value)}>
                              <option value="Select">Select</option>
                              {itemTypes.map((t) => <option key={t.value} value={t.value}>{t.text}</option>)}
                            </select>
                          </td>
                          <td>
                            <select id="en_item" className="form-control text_box" style={{ width: "70px" }}
                              value={E.itemCode} onChange={(e) => onItem(e.target.value)}>
                              <option value="Select">Select</option>
                              {poItems.map((i) => <option key={i.value} value={i.value}>{i.text}</option>)}
                            </select>
                          </td>
                          {sizeVisible("U") && (
                            <td>
                              <select id="en_size" className="form-control text_box" style={{ width: "70px" }}
                                value={E.sizeU} onChange={(e) => setEv("sizeU", e.target.value)}>
                                <option value="Select">Select</option>
                                {sizeUOpts.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                          )}
                          {sizeVisible("S") && (
                            <td>
                              <select id="en_size" className="form-control text_box" style={{ width: "70px" }}
                                value={E.sizeS} onChange={(e) => setEv("sizeS", e.target.value)}>
                                <option value="Select">Select</option>
                                {sizeSOpts.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                          )}
                          {sizeVisible("P") && (
                            <td>
                              <select className="form-control text_box" style={{ width: "70px" }}
                                value={E.sizeP} onChange={(e) => setEv("sizeP", e.target.value)}>
                                <option value="Select">Select</option>
                                {sizePOpts.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                          )}
                          {sizeVisible("A") && (
                            <td>
                              <select className="form-control text_box" style={{ width: "70px" }}
                                value={E.sizeA} onChange={(e) => setEv("sizeA", e.target.value)}>
                                <option value="Select">Select</option>
                                {sizeAOpts.map((s) => <option key={s} value={s}>{s}</option>)}
                              </select>
                            </td>
                          )}
                          <td>
                            <textarea id="en_desc" className="form-control text_box" style={{ width: "70px", overflow: "hidden" }}
                              value={E.desc} onChange={(e) => setEv("desc", allowAlphabet1(e.target.value))} />
                          </td>
                          <td>
                            <input id="en_gst" className="form-control text_box" maxLength={10} value={E.gstPct}
                              onChange={(e) => setEv("gstPct", isNumberDot(e.target.value))} />
                          </td>
                          <td>
                            <input className="form-control text_box" maxLength={10} value={E.hsn}
                              onChange={(e) => setEv("hsn", allowAlphabetNum(e.target.value))} />
                          </td>
                          <td>
                            <select id="en_unit" className="form-control text_box" style={{ width: "70px" }}
                              value={E.unit} onChange={(e) => onUnit(e.target.value)}>
                              <option value="Select">Select Unit</option>
                              {unitOpts.map((u) => <option key={u} value={u}>{u}</option>)}
                            </select>
                          </td>
                          <td>
                            <input className="form-control text_box" maxLength={10} value={E.perUnit}
                              onChange={(e) => setEv("perUnit", isNumber(e.target.value))} />
                          </td>
                          <td>
                            <input id="en_qty" className="form-control text_box" maxLength={10} value={E.qty}
                              onChange={(e) => onQty(e.target.value)} />
                            {E.stockHint && <div style={{ color: "red" }}>{E.stockHint}</div>}
                            {E.lastRateHint && <div style={{ color: "blue", fontSize: "small" }}>In Stock</div>}
                          </td>
                          <td>
                            <input id="en_rate" className="form-control text_box" maxLength={10} value={E.rate}
                              onChange={(e) => onRate(e.target.value)} />
                            {E.lastRateHint && <div style={{ color: "red" }}>{E.lastRateHint}</div>}
                            {E.lastRateHint && <div style={{ color: "blue", fontSize: "small" }}>Last Purchase Rate</div>}
                          </td>
                          <td>
                            <input id="en_disc" className="form-control text_box" maxLength={10} value={E.discPct}
                              onChange={(e) => onDiscPct(e.target.value)} />
                          </td>
                          <td>
                            <input id="en_discamt" className="form-control text_box" maxLength={10} value={E.discAmt}
                              onChange={(e) => onDiscAmt(e.target.value)} />
                          </td>
                          <td>
                            <input id="en_amt" className="form-control text_box" maxLength={10} value={E.amount} readOnly onChange={() => { }} />
                          </td>
                          <td>
                            <button title="Add Item" onClick={addItem}
                              style={{ border: "none", background: "transparent", cursor: "pointer", fontSize: "20px", color: "#337ab7" }}>＋</button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <br />
                  <div className="grid-view">
                    <table className="table" style={{ backgroundColor: "White", borderColor: "#CCCCCC", width: "100%" }}>
                      <thead>
                        <tr style={{ backgroundColor: "#507CD1", color: "White", fontWeight: "bold" }}>
                          <th></th><th>Sr No.</th><th>CODE</th><th>Item Type</th><th>Particular</th>
                          <th>Uniform Size</th><th>Shoes Size</th><th>pantry_jacket Size</th><th>Apron Size</th>
                          <th>Description</th><th>GST</th><th>HSN_Code</th><th>Unit</th><th>Quantity</th>
                          <th>Rate</th><th>Discount Rate</th><th>Discount Price</th><th>Total Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {staged.map((l, i) => (
                          <tr key={i} style={{ backgroundColor: "#EFF3FB" }}>
                            <td><button title="Delete" onClick={() => delStaged(i)}
                              style={{ border: "none", background: "transparent", cursor: "pointer", color: "#d9534f" }}>✖</button></td>
                            <td>{i + 1}</td><td>{l.item_code}</td><td>{l.item_type}</td>
                            <td>{l.particular}</td><td>{l.size_uniform}</td><td>{l.size_shoes}</td>
                            <td>{l.size_pantry}</td><td>{l.size_apron}</td><td>{l.description}</td>
                            <td>{l.vat}</td><td>{l.hsn}</td><td>{l.unit}</td><td>{l.quantity}</td>
                            <td>{l.rate}</td><td>{l.discount}</td><td>{l.discount_amt}</td><td>{l.amount}</td>
                          </tr>
                        ))}
                        {staged.length === 0 && <tr><td colSpan={18} style={{ textAlign: "center" }}>No items added</td></tr>}
                      </tbody>
                    </table>
                  </div>
                  <br />
                  <hr />
                  <div className="row">
                    <div className="col-sm-8 col-xs-12">
                      <div className="row">
                        <div className="col-sm-5 col-xs-12">
                          <span><b>Customer Notes :</b></span>
                          <textarea className="form-control text_box" rows={6} maxLength={200} value={notes}
                            style={{ overflow: "hidden" }}
                            onChange={(e) => setNotes(allowAlphabet1(e.target.value))} />
                        </div>
                        <div className="col-sm-5 col-xs-12">
                          <span><b>Terms & Conditions :</b></span>
                          <textarea className="form-control text_box" rows={6} maxLength={200} value={terms}
                            style={{ overflow: "hidden" }}
                            onChange={(e) => setTerms(allowAlphabet1(e.target.value))} />
                        </div>
                      </div>
                    </div>
                    <div className="col-sm-4 col-xs-12">
                      <div className="row">
                        <div className="col-sm-6" style={{ textAlign: "right" }}><b>Gross Amount</b></div>
                        <div className="col-sm-6" style={{ textAlign: "right" }}>
                          <input id="it_gross" className="form-control text_box" value={gross} readOnly onChange={() => { }} />
                        </div>
                      </div>
                      <br />
                      <div className="row">
                        <div className="col-sm-6" style={{ textAlign: "right" }}>
                          <b> Discount (%)</b>
                          <input className="form-control text_box" value={hDiscPct} disabled={hDiscOff}
                            onChange={(e) => onHDiscPct(e.target.value)} />
                        </div>
                        <div className="col-sm-6">
                          <b>  Discount (Rs.)</b>
                          <input className="form-control text_box" value={hDiscAmt} disabled={hDiscOff}
                            onChange={(e) => onHDiscAmt(e.target.value)} />
                        </div>
                      </div>
                      <br />
                      <div className="row">
                        <div className="col-sm-6" style={{ textAlign: "right" }}><b>Taxable Amount</b></div>
                        <div className="col-sm-6" style={{ textAlign: "right" }}>
                          <input className="form-control" style={{ color: "#339966", fontWeight: "bold" }} value={taxable} readOnly onChange={() => { }} />
                        </div>
                      </div>
                      <br />
                      <div className="row">
                        <div className="col-sm-5"></div>
                        <div className="col-sm-7">
                          <table className="table table-responsive" style={{ width: "100%" }}>
                            <tbody>
                              {gstRows.map((r, i) => (
                                <tr key={i}><td style={{ border: "1px solid #ddd" }}>{r.label}</td>
                                  <td style={{ border: "1px solid #ddd", textAlign: "left" }}>{r.amount}</td></tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div className="row">
                        <div className="col-sm-6" style={{ textAlign: "right" }}><b>Sub Total(A)</b></div>
                        <div className="col-sm-6" style={{ textAlign: "right" }}>
                          <input className="form-control text_box" value={subA} readOnly onChange={() => { }} />
                        </div>
                      </div>
                      <br />
                      <div className="row">
                        <div className="col-sm-6" style={{ textAlign: "right" }}>
                          <b> Other Charges:</b>
                          <input className="form-control text_box" value={extraName}
                            onChange={(e) => setExtraName(allowAlphabet1(e.target.value))} />
                        </div>
                        <div className="col-sm-6" style={{ textAlign: "left" }}>
                          <b> Other Charges(IN Rs):</b>
                          <input className="form-control text_box" value={extraAmt}
                            onChange={(e) => onExtra(isNumber(e.target.value), extraTax)} />
                        </div>
                      </div>
                      <br />
                      <div className="row">
                        <div className="col-sm-6" style={{ textAlign: "right" }}>
                          <b> Other Charges GST(IN %):</b>
                          <input className="form-control text_box" placeholder="GST(%) on Charges" value={extraTax}
                            onChange={(e) => onExtra(extraAmt, e.target.value)} />
                        </div>
                        <div className="col-sm-6" style={{ textAlign: "left" }}>
                          <b> Total Other Charge(IN RS.):</b>
                          <input className="form-control text_box" value={extraTaxAmt} disabled onChange={() => { }} />
                        </div>
                      </div>
                      <br />
                      <div className="row">
                        <div className="col-sm-6" style={{ textAlign: "right" }}><b>Sub Total(B)</b></div>
                        <div className="col-sm-6" style={{ textAlign: "right" }}>
                          <input className="form-control text_box" value={subB} readOnly onChange={() => { }} />
                        </div>
                      </div>
                      <br />
                      <div className="row">
                        <div className="col-sm-6" style={{ textAlign: "right" }}><b>Total Amount (Inc GST)</b></div>
                        <div className="col-sm-6" style={{ textAlign: "right" }}>
                          <input className="form-control text_box" value={finalTotal} disabled onChange={() => { }} />
                        </div>
                      </div>
                      <br />
                      <div className="row">
                        <div className="col-sm-6" style={{ textAlign: "right" }}><b>Other Deduction(Hold) </b></div>
                        <div className="col-sm-6" style={{ textAlign: "right" }}>
                          <input className="form-control text_box" value={otherDed}
                            onChange={(e) => onOther(isNumber(e.target.value))} />
                        </div>
                      </div>
                      <br />
                      <div className="row">
                        <div className="col-sm-6" style={{ textAlign: "right" }}><b>TDS Amount Deducted</b></div>
                        <div className="col-sm-6" style={{ textAlign: "right" }}>
                          <input className="form-control text_box" value={tdsAmt} disabled onChange={() => { }} />
                        </div>
                      </div>
                      <br />
                      <div className="row">
                        <div className="col-sm-6" style={{ textAlign: "right" }}><b>Payable Amount</b></div>
                        <div className="col-sm-6" style={{ textAlign: "right" }}>
                          <input className="form-control text_box" value={payable} disabled onChange={() => { }} />
                        </div>
                      </div>
                      <br />
                    </div>
                  </div>
                </div>

                <div className="col-sm-4 col-xs-12" style={{ marginTop: "9px" }}>
                  <b>File Upload :</b><span style={{ color: "red" }}>*</span>
                  <input ref={fileRef} id="file_input" type="file" accept=".jpg,.jpeg,.gif,.pdf,.png"
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      if (checkFile(f)) setFile(f);
                    }} />
                  <b>JPEG JPG GIF PDF PNG</b>
                  {file && <div style={{ fontSize: "11px" }}>Selected: {file.name}</div>}
                </div>
                <br />
                <div className="container" style={{ width: "100%" }}>
                  <br />
                  <table className="table" style={{ backgroundColor: "White", borderColor: "#CCCCCC", width: "100%" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#507CD1", color: "White", fontWeight: "bold" }} className="text-uppercase">
                        <th>Sr No.</th><th>Vendor Name</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {uploads.map((u, i) => (
                        <tr key={i} style={{ backgroundColor: "#EFF3FB" }}>
                          <td>{i + 1}</td>
                          <td>{u.cust_name}</td>
                          <td>
                            {u.vendor_upload ? (
                              <button className="btn btn-primary" style={{ color: "white" }}
                                onClick={() => downloadUpload(u.vendor_upload ?? "")}>Download</button>
                            ) : "File Not Upload"}
                          </td>
                        </tr>
                      ))}
                      {uploads.length === 0 && <tr><td colSpan={3} style={{ textAlign: "center" }}>No uploads</td></tr>}
                    </tbody>
                  </table>
                </div>

                <div className="row text-center">
                  <div className="col-sm-2"></div>
                  <div className="col-sm-7">
                    {mode === "new" && <button className="btn btn-primary" style={{ width: "18%" }} onClick={doProcess}>Process</button>}{" "}
                    <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>Send</button>{" "}
                    {mode === "edit" && <button className="btn btn-primary" onClick={doUpdate}>Update</button>}{" "}
                    {mode === "edit" && <button className="btn btn-primary" onClick={doDelete}>Delete</button>}{" "}
                    <button className="btn btn-primary" onClick={doPrint}>Print</button>{" "}
                    <button className="btn btn-danger" onClick={() => router.push("/Home")}>Close</button>
                  </div>
                </div>
                <br />
                <br />
              </div>
            </div>
          </div>
        )}

        {tab === 1 && (
          <div id="menu2">
            <br />
            <div className="row">
              <div className="col-sm-2 col-xs-12">
                <b>From Booked Bill Month:</b>
                <input id="rp_from" className="form-control text_box" style={{ marginBottom: "0px" }}
                  value={rpFrom} onChange={(e) => setRpFrom(e.target.value)} placeholder="mm/yy" />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>To Booked Bill Month:</b>
                <input id="rp_to" className="form-control text_box" style={{ marginBottom: "0px" }}
                  value={rpTo} onChange={(e) => setRpTo(e.target.value)} placeholder="mm/yy" />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>  Vendor Name :</b>
                <select id="rp_vendor" className="form-control text_box" value={rpVendor}
                  onChange={(e) => onRpVendor(e.target.value)}>
                  <option value="Select">Select</option>
                  <option value="ALL">ALL</option>
                  {rpVendors.map((v) => <option key={v.value} value={v.value}>{v.text}</option>)}
                </select>
              </div>
              <div className="col-sm-2 col-xs-12">
                <span><b>Purchase Order No:</b> <span style={{ color: "red" }}>*</span></span>
                <select className="form-control text_box" value={rpPO}
                  onChange={(e) => onRpPO(e.target.value)}>
                  <option value="ALL">ALL</option>
                  {rpPOs.map((p) => <option key={p.value} value={p.value}>{p.text}</option>)}
                </select>
              </div>
              <div className="col-sm-2 col-xs-12">
                <span><b>Invoice no:</b> <span style={{ color: "red" }}>*</span></span>
                <select className="form-control text_box" value={rpInv}
                  onChange={(e) => setRpInv(e.target.value)}>
                  <option value="Select">Select</option>
                  <option value="ALL">ALL</option>
                  {rpInvs.map((p) => <option key={p.value} value={p.value}>{p.text}</option>)}
                </select>
              </div>
              <div className="col-sm-2 col-xs-12" style={{ marginTop: "25px" }}>
                <button className="btn btn-primary" onClick={doReport}> Report </button>
              </div>
              <br />
              <br />
            </div>
            <br />
          </div>
        )}
      </div>
    </div>
  );
}
