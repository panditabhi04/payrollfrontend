"use client";

// Legacy Itemmaster.aspx — "Item Master". Exact 1:1 port: panel-primary +
// heading (title + help icon), #f3f1fe form boxes, field rows with red *
// asterisks, per-type size labels, ADD NEW UNIT / ADD GST RATE links,
// Save / Update / Delete / Close buttons, DataTables-style grid
// (CSV / Print / Copy / colvis, search, full_numbers paging), legacy alerts
// with focus, $.blockUI overlay on postbacks.

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DataTable, { DTColumn } from "./DataTable";
import type { Opt } from "./formkit";
import { getJSON, mk, putJSON, rm } from "@/lib/api/legacy-fetch";

interface ItemRow {
  id: string | number;
  comp_code: string;
  item_code: string;
  item_name: string;
  unit: string;
  unit_per_piece: number | null;
  vat: number | null;
  product_service: string;
  item_description: string;
  sac_number: string;
  item_brand: string;
  hsn_number: string;
  purchase_rate: number | null;
  sales_rate: number | null;
  validity: string;
  size: string;
}

// Legacy ddl_product ListItems — exact Value/Text pairs. Validation compares
// the TEXT ("Select"); size binding keys on the VALUE.
const PRODUCT_OPTS: Opt[] = [
  { v: "Select", t: "Select" },
  { v: "chemicals", t: "Chemicals" },
  { v: "housekeeping_material", t: "Housekeeping Materials" },
  { v: "Uniform", t: "Uniform" },
  { v: "pantry_jacket", t: "Pantry Jacket" },
  { v: "Apron", t: "Apron" },
  { v: "Shoes", t: "Shoes" },
  { v: "ID_Card", t: "ID Card" },
  { v: "Machine", t: "Machine" },
  { v: "Other", t: "Other" },
];

const SIZED_PRODUCTS = ["Uniform", "pantry_jacket", "Shoes", "Apron"];

// Legacy per-type size labels (ChangeShow/hidde). Exact legacy texts.
const SIZE_LABELS: Record<string, string> = {
  Uniform: "Unifrom Size :",
  pantry_jacket: "Pantry Jacket Size :",
  Shoes: "Shoes Size :",
  Apron: "Apron Size :",
};

// Legacy AllowAlphabet1(event), second definition wins: letters, digits, space.
const allowAlphabet1 = (v: string) => v.replace(/[^A-Za-z0-9 ]/g, "");
// Legacy isNumber(evt): digits and dot.
const isNumber = (v: string) => v.replace(/[^0-9.]/g, "");

const str = (v: unknown) => (v === null || v === undefined ? "" : String(v));

interface FormState {
  item_code: string;
  product_service: string;
  item_name: string;
  item_brand: string;
  item_description: string;
  sac_number: string;
  hsn_number: string;
  vat: string;
  purchase_rate: string;
  sales_rate: string;
  unit_per_piece: string;
  validity: string;
  unit: string;
  size: string;
}

// First human-readable message out of a DRF error body ({message}|{detail}|{field:[msgs]}).
const firstError = (d: any, fallback: string): string => {
  if (!d) return fallback;
  if (typeof d.message === "string") return d.message;
  if (typeof d.detail === "string") return d.detail;
  for (const v of Object.values(d)) {
    const m = Array.isArray(v) ? v[0] : v;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
};

export function ItemMaster() {
  const router = useRouter();
  const [blocked, setBlocked] = useState(false);
  const [data, setData] = useState<ItemRow[]>([]);
  const [hsnCodes, setHsnCodes] = useState<string[]>([]);
  const [gstRates, setGstRates] = useState<string[]>([]);
  const [unitNames, setUnitNames] = useState<string[]>([]);
  // Size options persist across product switches exactly like legacy ViewState:
  // rebound (reset to "Select") only when the new product is a sized type.
  const [sizeOpts, setSizeOpts] = useState<string[]>([]);
  const [f, setF] = useState<FormState>({
    item_code: "", product_service: "Select", item_name: "", item_brand: "0",
    item_description: "", sac_number: "", hsn_number: "Select", vat: "",
    purchase_rate: "0", sales_rate: "0", unit_per_piece: "0", validity: "0",
    unit: "", size: "",
  });
  const [selected, setSelected] = useState<ItemRow | null>(null);

  const productRef = useRef<HTMLSelectElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const hsnRef = useRef<HTMLSelectElement>(null);
  const vatRef = useRef<HTMLSelectElement>(null);
  const purchaseRef = useRef<HTMLInputElement>(null);
  const unitRef = useRef<HTMLSelectElement>(null);

  const loadGrid = () => {
    getJSON<{ results: ItemRow[] }>(`/api/masters/item-masters/?page_size=all`)
      .then((d) => setData(d?.results ?? []));
  };

  const fetchNewCode = () => {
    getJSON<{ item_code: string }>(`/api/masters/item-masters/new-code/`)
      .then((d) => setF(p => ({ ...p, item_code: d?.item_code ?? "" })));
  };

  const fetchGstRates = async (hsn: string): Promise<string[]> => {
    if (!hsn || hsn === "Select") return [];
    const d = await getJSON<{ gst_rate: string }[]>(
      `/api/masters/item-gst-rates/?hsn_code=${encodeURIComponent(hsn)}`);
    return (d ?? []).map((r) => r.gst_rate ?? "");
  };

  const fetchSizes = async (product: string): Promise<string[]> => {
    if (!SIZED_PRODUCTS.includes(product)) return [];
    const d = await getJSON<{ size: string }[]>(
      `/api/masters/item-sizes/?product_service=${encodeURIComponent(product)}`);
    return (d ?? []).map((r) => r.size ?? "");
  };

  useEffect(() => {
    loadGrid();
    fetchNewCode();
    // HSN dropdown: SELECT hsn_code ... GROUP BY hsn_code, DB order kept.
    getJSON<{ hsn_code: string }[]>(`/api/masters/item-hsn-codes/`)
      .then((d) => setHsnCodes((d ?? []).map((r) => r.hsn_code ?? "")));
    // Unit dropdown: SELECT item_unit_name ... ORDER BY item_unit_name,
    // NO company filter — "Select Unit" head carries the empty value.
    getJSON<{ unit_name: string }[]>(`/api/masters/item-units-lookup/`)
      .then((d) => setUnitNames((d ?? []).map((r) => r.unit_name ?? "")));
    // GST dropdown starts empty (legacy txt_vat unbound until HSN chosen).
  }, []);

  const onProductChange = async (v: string) => {
    setBlocked(true); // legacy ddl_product change posts back under blockUI
    try {
      setF(p => ({ ...p, product_service: v }));
      if (SIZED_PRODUCTS.includes(v)) {
        const sizes = await fetchSizes(v);
        setSizeOpts(sizes);
        setF(p => ({ ...p, size: "Select" }));
      }
      // Any other product: size list/selection untouched (legacy ViewState).
    } finally { setBlocked(false); } // unblock()
  };

  const onHsnChange = async (v: string) => {
    setBlocked(true); // legacy txt_hsn AutoPostBack under blockUI
    try {
      setF(p => ({ ...p, hsn_number: v }));
      setGstRates(await fetchGstRates(v));
    } finally { setBlocked(false); }
  };

  // Legacy validate(): six exact checks, literal comparisons, no trim —
  // with focus on the failed control.
  const validate = (): boolean => {
    const productText = PRODUCT_OPTS.find((o) => o.v === f.product_service)?.t ?? f.product_service;
    if (productText === "Select") { alert("Please Select Item Type !!!"); productRef.current?.focus(); return false; }
    if (f.item_name === "") { alert("Please Enter Item Name !!!"); nameRef.current?.focus(); return false; }
    if (f.hsn_number === "Select") { alert("Please Enter HSN Number !!!"); hsnRef.current?.focus(); return false; }
    if (f.vat === "") { alert("Please Select GST Rate !!!"); vatRef.current?.focus(); return false; }
    if (f.purchase_rate === "0" || f.purchase_rate === "") { alert("Please Enter Purches Rate !!!"); purchaseRef.current?.focus(); return false; }
    if (f.unit === "") { alert("Please Select Unit !!!"); unitRef.current?.focus(); return false; }
    return true;
  };

  // Legacy R_validation(): confirm, else "Record not Available".
  const confirmDelete = (): boolean => {
    const r = confirm("Are you Sure You Want to Delete Record");
    if (r) setBlocked(true); // $.blockUI
    else alert("Record not Available");
    return r;
  };

  const body = () => ({
    item_code: f.item_code,
    item_name: f.item_name,
    unit: f.unit,
    unit_per_piece: f.unit_per_piece,
    vat: f.vat,
    product_service: f.product_service,
    item_description: f.item_description,
    sac_number: f.sac_number,
    item_brand: f.item_brand,
    hsn_number: f.hsn_number,
    purchase_rate: f.purchase_rate,
    sales_rate: f.sales_rate,
    validity: f.validity,
    size: f.size,
  });

  // Legacy btn_cancel_Click field semantics + btn_new_Click (new code,
  // name "", brand "0"). HSN/size/GST untouched, exactly like legacy.
  const clear = () => {
    setF(p => ({
      ...p, item_name: "", item_brand: "", unit: "", unit_per_piece: "0",
      purchase_rate: "0", sac_number: "", sales_rate: "0", validity: "",
      product_service: "Select", item_description: "",
    }));
    setSelected(null);
    fetchNewCode();
  };

  const save = async () => {
    if (!validate()) return;
    setBlocked(true); // $.blockUI
    try {
      const res = await mk("/api/masters/item-masters/", body());
      const payload = await res.json().catch(() => null);
      if (payload?.silent) return; // legacy throw path: cleanup ran, no alert
      if (res.ok && payload?.message) {
        alert(payload.message);
        // Legacy btn_add success reset + btn_new_Click (new code).
        setF(p => ({
          ...p, item_name: "", item_brand: "", hsn_number: "Select", unit: "",
          unit_per_piece: "0", sales_rate: "0", purchase_rate: "0", validity: "",
          product_service: "Select", item_description: "", size: "Select", sac_number: "",
        }));
        setSelected(null);
        fetchNewCode();
        loadGrid();
      } else {
        alert(firstError(payload, "Material (" + f.item_name + ") adding failed..."));
      }
    } catch {
      alert("Material (" + f.item_name + ") adding failed...");
    } finally { setBlocked(false); }
  };

  const update = async () => {
    if (!validate()) return;
    if (!selected) return;
    setBlocked(true);
    try {
      const res = await putJSON(`/api/masters/item-masters/${selected.id}/`, body());
      const payload = await res.json().catch(() => null);
      if (res.ok) { if (payload?.message) alert(payload.message); }
      else alert(firstError(payload, "Material (" + f.item_name + ") updation failed..."));
      if (res.ok) {
        // Legacy btn_edit success reset + btn_new_Click. Description, SAC,
        // size and GST are NOT cleared here — preserved exactly.
        setF(p => ({
          ...p, item_name: "", item_brand: "", hsn_number: "Select", unit: "",
          product_service: "Select", unit_per_piece: "0", purchase_rate: "0",
          sales_rate: "0", validity: "",
        }));
        setSelected(null);
        fetchNewCode();
        loadGrid();
      }
    } catch {
      alert("Material (" + f.item_name + ") updation failed...");
    } finally { setBlocked(false); }
  };

  const del = async () => {
    if (!selected) return;
    if (!confirmDelete()) return;
    try {
      const res = await rm(`/api/masters/item-masters/${selected.id}/`);
      const payload = await res.json().catch(() => null);
      if (payload?.silent) return; // legacy swallowed-exception path
      if (res.ok) { if (payload?.message) alert(payload.message); }
      else alert(firstError(payload, "Record deletion failed..."));
      if (res.ok) {
        // Legacy btn_delete success reset + cancel/new cycle. Size and GST
        // are NOT cleared here — preserved exactly.
        setF(p => ({
          ...p, item_name: "", item_brand: "", unit: "", hsn_number: "Select",
          unit_per_piece: "0", purchase_rate: "0", sales_rate: "0", validity: "",
          product_service: "Select", item_description: "", sac_number: "",
        }));
        setSelected(null);
        fetchNewCode();
        loadGrid();
      }
    } catch {
      alert("Record deletion failed...");
    } finally { setBlocked(false); }
  };

  const onRowClick = async (row: ItemRow) => {
    // Legacy ItemGridView_SelectedIndexChanged field mapping (by column).
    // Postback order preserved: HSN change repopulates GST, product change
    // rebinds sizes — then the saved values are assigned with no guards.
    setBlocked(true); // legacy grid cell click posts back under blockUI
    try {
      setSelected(row);
      setF(p => ({
        ...p,
        item_code: row.item_code || "",
        item_name: row.item_name || "",
        unit_per_piece: str(row.unit_per_piece),
        product_service: row.product_service || "Select",
        unit: row.unit || "",
        item_description: row.item_description || "",
        sac_number: row.sac_number || "",
        item_brand: row.item_brand || "",
        hsn_number: row.hsn_number || "Select",
        purchase_rate: str(row.purchase_rate),
        sales_rate: str(row.sales_rate),
        validity: row.validity || "",
      }));
      const rates = await fetchGstRates(row.hsn_number || "");
      setGstRates(rates);
      setF(p => ({ ...p, vat: str(row.vat) }));
      if (SIZED_PRODUCTS.includes(row.product_service || "")) {
        const sizes = await fetchSizes(row.product_service || "");
        setSizeOpts(sizes);
      }
      setF(p => ({ ...p, size: row.size || "" }));
    } finally { setBlocked(false); }
  };

  const hsnOpts: Opt[] = [{ v: "Select", t: "Select" }, ...hsnCodes.map((c) => ({ v: c, t: c }))];
  const gstOpts: Opt[] = gstRates.map((g) => ({ v: g, t: g }));
  const unitOpts: Opt[] = [{ v: "", t: "Select Unit" }, ...unitNames.map((n) => ({ v: n, t: n }))];
  const sizeOptList: Opt[] = [{ v: "Select", t: "Select" }, ...sizeOpts.map((s) => ({ v: s, t: s }))];
  const showSize = SIZED_PRODUCTS.includes(f.product_service);

  // Legacy grid columns (SAC kept hidden): "<" select | ITEM CODE | PRODUCT |
  // ITEM NAME | ITEM_DESCRIPTION | UNIT OF MEASUREMENT | UNIT FOR PER PIECE |
  // GST RATE | ITEM BRAND | HSN CODE | PURCHASE RATE | SALES RATE | VALIDITY | SIZE.
  const cols: DTColumn<ItemRow>[] = [
    { key: "item_code", label: "ITEM CODE", value: (d: ItemRow) => d.item_code || "" },
    { key: "product_service", label: "PRODUCT", value: (d: ItemRow) => d.product_service || "" },
    { key: "item_name", label: "ITEM NAME", value: (d: ItemRow) => d.item_name || "" },
    { key: "item_description", label: "ITEM_DESCRIPTION", value: (d: ItemRow) => d.item_description || "" },
    { key: "unit", label: "UNIT OF MEASUREMENT", value: (d: ItemRow) => d.unit || "" },
    { key: "unit_per_piece", label: " UNIT FOR PER PIECE", value: (d: ItemRow) => str(d.unit_per_piece) },
    { key: "vat", label: "GST RATE", value: (d: ItemRow) => str(d.vat) },
    { key: "item_brand", label: "ITEM BRAND", value: (d: ItemRow) => d.item_brand || "" },
    { key: "hsn_number", label: "HSN CODE", value: (d: ItemRow) => d.hsn_number || "" },
    { key: "purchase_rate", label: "PURCHASE RATE", value: (d: ItemRow) => str(d.purchase_rate) },
    { key: "sales_rate", label: "SALES RATE", value: (d: ItemRow) => str(d.sales_rate) },
    { key: "validity", label: "VALIDITY", value: (d: ItemRow) => d.validity || "" },
    { key: "size", label: "SIZE", value: (d: ItemRow) => d.size || "" },
  ];

  const Req = () => <span style={{ color: "red" }}>*</span>;

  return (
    <div className="container" style={{ fontFamily: "Verdana", fontSize: "10px", fontWeight: "lighter", width: "100%" }}>
      {blocked && (
        <div style={{ position: "fixed", inset: 0, background: "#CCCCCC", opacity: 0.7, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "bold" }}>
          Please wait...
        </div>
      )}
      <div className="panel panel-primary" style={{ backgroundColor: "white" }}>
        <div className="panel-heading">
          <div className="row">
            <div className="col-lg-11 col-md-11 col-sm-11 col-xs-12">
              <div style={{ color: "#fff", fontSize: "small" }} className="text-center text-uppercase"><b>Item Master</b></div>
            </div>
            <div className="col-lg-1 col-md-1 col-sm-1 col-xs-12 text-right">
              <a href="#" onClick={(e) => { e.preventDefault(); window.open("html/Itemmaster3.html", "popUpWindow", "height=500,width=600,left=100,top=100"); }} style={{ color: "#fff" }}>
                <img src="/Images/help_ico.png" alt="Help" width={20} height={20} />
              </a>
            </div>
          </div>
        </div>
        <br />
        <div className="panel-body">
          <div className="container-fluid" style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "25px 25px 25px 25px", marginLeft: "5px", marginRight: "5px", marginBottom: "20px", marginTop: "20px" }}>
            <br />
            <div className="row">
              <div className="col-md-2 col-xs-12">
                <b> Item Code :</b> <Req />
                <input className="form-control" value={f.item_code} readOnly onChange={() => { }} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>  Item Type :</b> <Req />
                <select ref={productRef} className="form-control" style={{ width: "170px" }} value={f.product_service} onChange={(e) => onProductChange(e.target.value)}>
                  {PRODUCT_OPTS.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                </select>
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>  Item Name :</b> <Req />
                <input ref={nameRef} className="form-control" value={f.item_name} maxLength={70}
                  onChange={(e) => setF(p => ({ ...p, item_name: allowAlphabet1(e.target.value) }))} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b> Item Brand : </b>
                <input className="form-control" value={f.item_brand} maxLength={70}
                  onChange={(e) => setF(p => ({ ...p, item_brand: allowAlphabet1(e.target.value) }))} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b>  Item Specification :</b>
                <input className="form-control" value={f.item_description} maxLength={140}
                  onChange={(e) => setF(p => ({ ...p, item_description: allowAlphabet1(e.target.value) }))} />
              </div>
              {showSize && (
                <div className="col-sm-2 col-xs-12 ddl_hide_show">
                  <label>{SIZE_LABELS[f.product_service] ?? "Size :"}</label>
                  <select className="form-control" value={f.size} onChange={(e) => setF(p => ({ ...p, size: e.target.value }))}>
                    {sizeOptList.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                  </select>
                </div>
              )}
              <div className="col-sm-2 col-xs-12 slat2" style={{ display: "none" }}>
                <label>SAC Code :</label>
                <input className="form-control" value={f.sac_number} readOnly onChange={() => { }} />
              </div>
            </div>
            <br />
            <div className="row">
              <div className="col-sm-2 col-xs-12 slat1">
                <label style={{ fontWeight: "bold" }}>HSN Code :</label> <Req />
                <select ref={hsnRef} className="form-control" value={f.hsn_number} onChange={(e) => onHsnChange(e.target.value)}>
                  {hsnOpts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                </select>
              </div>
              <div className="col-sm-2 col-xs-12">
                <b> GST Rate :</b> <Req />
                <select ref={vatRef} className="form-control" value={f.vat} onChange={(e) => setF(p => ({ ...p, vat: e.target.value }))}>
                  {gstOpts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                </select>
              </div>
              <div className="col-sm-2 col-xs-12">
                <b> Purchase Rate :</b> <Req />
                <input ref={purchaseRef} className="form-control" value={f.purchase_rate} maxLength={9}
                  onChange={(e) => setF(p => ({ ...p, purchase_rate: isNumber(e.target.value) }))} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b> Sale Rate :</b>
                <input className="form-control" style={{ width: "100%" }} value={f.sales_rate} maxLength={7}
                  onChange={(e) => setF(p => ({ ...p, sales_rate: isNumber(e.target.value) }))} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b> Cost/Unit :</b>
                <input className="form-control" style={{ width: "100%" }} value={f.unit_per_piece} maxLength={7}
                  onChange={(e) => setF(p => ({ ...p, unit_per_piece: isNumber(e.target.value) }))} />
              </div>
              <div className="col-sm-2 col-xs-12">
                <b> Validity(In Days):</b>
                <input className="form-control" style={{ width: "100%" }} value={f.validity} maxLength={7}
                  onChange={(e) => setF(p => ({ ...p, validity: isNumber(e.target.value) }))} />
              </div>
              <br />
            </div>
            <br />
            <div className="row">
              <div className="col-sm-2 col-xs-12">
                <b> Unit:</b> <Req />
                <select ref={unitRef} className="form-control" value={f.unit} onChange={(e) => setF(p => ({ ...p, unit: e.target.value }))}>
                  {unitOpts.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                </select>
              </div>
            </div>
            <br />
            <div className="row">
              <div className="col-sm-2 col-xs-12">
                <table className="table table-striped">
                  <tbody>
                    <tr>
                      <th>
                        <span style={{ fontSize: "13px", fontWeight: "bolder", height: "20px", paddingLeft: "5px", paddingRight: "5px", color: "#337ab7", borderRadius: "20%" }}>+</span>{" "}
                        <Link href="/masters/item-unit" style={{ color: "#000" }}>ADD NEW UNIT</Link>
                      </th>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="col-sm-2 col-xs-12">
                <table className="table table-striped">
                  <tbody>
                    <tr>
                      <th>
                        <span style={{ fontSize: "13px", fontWeight: "bolder", height: "20px", paddingLeft: "5px", paddingRight: "5px", color: "#337ab7", borderRadius: "20%" }}>+</span>{" "}
                        <Link href="/masters/gst-rate" style={{ color: "#000" }}>ADD GST RATE</Link>
                      </th>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
            <br />
            <div className="row text-center">
              {!selected && <button className="btn btn-primary" onClick={save}> Save </button>}{" "}
              {selected && <button className="btn btn-primary" onClick={update}> Update </button>}{" "}
              {selected && <button className="btn btn-primary" onClick={del}> Delete </button>}{" "}
              <button className="btn btn-danger" onClick={() => router.push("/Home")}>Close</button>
            </div>
            <br />
          </div>
          <br />
          <div className="container-fluid" style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "25px 25px 25px 25px", marginLeft: "5px", marginRight: "5px", marginBottom: "20px", marginTop: "20px" }}>
            <div className="grid-view" style={{ overflowX: "auto", maxHeight: "250px", overflowY: "auto" }}>
              <DataTable
                rows={data}
                columns={cols}
                rowKey={(r: ItemRow) => r.id}
                onRowClick={onRowClick}
                selectedKey={selected?.id}
              />
            </div>
            <br />
          </div>
        </div>
      </div>
    </div>
  );
}
