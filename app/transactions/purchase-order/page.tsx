"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getJSON, mk, rm, patchJSON } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";

// Legacy purchase_order.aspx. Header pay_transaction_po + lines pay_transaction_po_details.
// PO_NO auto ("PO"+5 digits). Vendor Type -> Vendor Category -> Vendor Name cascade (vendor GST / address /
// mobile auto-filled), Item Type -> Item Name cascade (HSN / GST / rate auto-filled). Totals are
// server-computed (intra/inter-state GST split). Every legacy alert is shown verbatim (client-side first,
// then the server's identical check).
// final_po_flag: 0 Pending, 1 Approve By Jr Acc, 2 Approve By Sr Acc, 3 Rejected.
const PO = () => "/api/transactions/purchase-orders/";
const FLAGS: Record<number, string> = {
  0: "Pending", 1: "Approve By Jr Acc", 2: "Approve By Sr Acc", 3: "Rejected",
};
const VENDOR_CATEGORIES: [string, string][] = [
  ["Electrical", "Electrical"], ["Plumbing", "Plumbing"], ["Carpentry", "Carpentry"], ["Civil", "Civil"],
  ["Pest_Control", "Pest Control"], ["HVAC", "HVAC"], ["Stationery", "Stationery"],
  ["Chemical_Supplier", "Chemical Supplier"], ["Shoes", "Shoes"], ["Uniform", "Uniform"],
  ["courier_services", "Courier Services"], ["Housekeeping_services", "Housekeeping services"], ["Other", "Other"],
];
const ITEM_TYPES: [string, string][] = [
  ["chemicals", "Chemicals"], ["housekeeping_material", "Housekeeping Materials"], ["Shoes", "Shoes"],
  ["Uniform", "Uniform"], ["pantry_jacket", "Pantry Jacket"], ["Apron", "Apron"],
  ["courier_services", "Courier Services"], ["ID_Card", "ID Card"], ["Other", "Other"],
];

interface Line {
  particular: string; item_code?: string; description?: string; hsn_number?: string;
  vat: string; quantity: string; rate: string; amount?: string; item_type?: string;
  size_uniform?: string; size_shoes?: string; size_pantry?: string; size_apron?: string;
}
interface Order {
  id: number; po_no: string; po_date?: string; cust_name: string; cust_code?: string;
  customer_gst_no?: string; sub_total: string; cgst: string; sgst: string; igst: string;
  grand_total: string; advance_percentage: number; remaining_percentage: number;
  advance_payment: string; remaining_payment: string; final_po_flag: number;
  po_reject_reason?: string; lines: Line[];
}
interface VendorOpt { id: number; vend_id: string; vend_name: string; vendor_type?: string; gst?: string; vend_add1?: string; mobile?: string; txtbillattention?: string; txtbilladdress?: string; active_status?: string; }
interface ClientOpt { client_code: string; client_name: string; }
interface UnitOpt { unit_code: string; unit_name: string; }
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
interface ItemOpt { item_code: string; item_name: string; product_service?: string; hsn_number?: string; vat?: number; purchase_rate?: number; size?: string; item_description?: string; }

const emptyLine = (): Line => ({ particular: "", item_type: "", vat: "0", quantity: "1", rate: "0" });
const emptyHeader = () => ({
  cust_name: "", cust_code: "", customer_gst_no: "", address: "", shipping_to: "",
  po_generated_by: "", mobile_no: "", po_date: today(), advance_percentage: "25",
  remaining_percentage: "75", vendor_type: "", vendor_category: "", client_code: "", unit_code: "",
});

async function errText(r: Response, fallback = "Failed"): Promise<string> {
  try {
    const b = await r.json();
    if (typeof b === "string") return b;
    if (Array.isArray(b)) return b.map(String).join(" ");
    if (b && typeof b === "object") {
      if (typeof (b as any).detail === "string") return (b as any).detail;
      const parts = Object.entries(b as Record<string, unknown>).map(([k, v]) => {
        const t = Array.isArray(v) ? v.map(String).join(" ") : String(v);
        return k === "non_field_errors" ? t : `${k.replace(/_/g, " ")}: ${t}`;
      });
      if (parts.length) return parts.join(" ");
    }
  } catch { /* fall through */ }
  return fallback;
}

export default function PurchaseOrderPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Order[]>([]);
  const [msg, setMsg] = useState("");
  const [header, setHeader] = useState(emptyHeader());
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [vendors, setVendors] = useState<VendorOpt[]>([]);
  const [items, setItems] = useState<ItemOpt[]>([]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  // legacy search panel (PO number OR vendor name) + "Get Details" -> edit mode (Update / Delete / Final / Print)
  const [qNo, setQNo] = useState("");
  const [qName, setQName] = useState("");
  const [searched, setSearched] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);

  const load = useCallback(async (params = "") => {
    const data = await getJSON<{ results: Order[] } | Order[]>(PO() + params);
    const list = Array.isArray(data) ? data : (data?.results ?? []);
    setRows(list as Order[]);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    getJSON<{ results: VendorOpt[] }>("/api/masters/vendors/?page_size=all").then((d) => setVendors(d?.results ?? []));
    getJSON<{ results: ItemOpt[] }>("/api/masters/item-masters/?page_size=all").then((d) => setItems(d?.results ?? []));
    getJSON<{ results: ClientOpt[] }>("/api/masters/clients/?page_size=all").then((d) => setClients(d?.results ?? []));
  }, []);
  // legacy ddl_client_SelectedIndexChanged: branch list = units of the client, first option "ALL"
  useEffect(() => {
    if (!header.client_code) { setUnits([]); return; }
    getJSON<{ units: UnitOpt[] }>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(header.client_code)}`)
      .then((d) => setUnits(d?.units ?? []));
  }, [header.client_code]);

  const [totals, setTotals] = useState({ sub_total: "0.00", cgst: "0.00", sgst: "0.00", igst: "0.00", grand_total: "0.00", advance_payment: "0.00", remaining_payment: "0.00" });
  // legacy gst_calculate(): totals refresh as lines / GSTIN / percentages change (server-side arithmetic, nothing saved)
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const r = await mk(`${PO()}preview-totals/`, {
          customer_gst_no: header.customer_gst_no,
          advance_percentage: header.advance_percentage, remaining_percentage: header.remaining_percentage,
          lines: lines.map((l) => ({ quantity: l.quantity, rate: l.rate, vat: l.vat })),
        });
        if (r.ok) setTotals(await r.json());
      } catch { /* totals stay as they were */ }
    }, 300);
    return () => clearTimeout(t);
  }, [header.customer_gst_no, header.advance_percentage, header.remaining_percentage, lines]);
  // legacy add_percent/add_percent2: Advance + Remaining always add up to 100
  const setPct = (k: "advance_percentage" | "remaining_percentage", v: string) => {
    const n = Number(v);
    if (v !== "" && (isNaN(n) || n < 0 || n > 100)) { window.alert("Enter Percentage Less than 100 and Greater than 0"); return; }
    const other = v === "" ? "" : String(100 - n);
    setHeader({ ...header, [k]: v, [k === "advance_percentage" ? "remaining_percentage" : "advance_percentage"]: other });
  };

  const catVendors = vendors.filter((v) => (v.active_status || "A") === "A" &&
    (!header.vendor_category || (v.vendor_type || "") === header.vendor_category));
  // legacy customer_details(): GST + address = txtbillattention \n txtbilladdress; store text "VEND_ID - VEND_NAME"
  const pickVendor = (id: string) => {
    const v = vendors.find((x) => String(x.vend_id) === id);
    const addr = v ? [v.txtbillattention, v.txtbilladdress].filter(Boolean).join("\n") || v.vend_add1 || "" : "";
    setHeader({
      ...header, cust_code: id, cust_name: v ? `${v.vend_id} - ${v.vend_name}` : "",
      customer_gst_no: v ? (v.gst ?? "") : "", address: v ? addr : "", mobile_no: v?.mobile ?? header.mobile_no,
    });
  };
  const sizesFor = (type?: string) =>
    Array.from(new Set(itemsFor(type).map((it) => (it.size || "").trim()).filter(Boolean))).sort();
  const itemsFor = (type?: string) =>
    items.filter((it) => !type || (it.product_service || "").toLowerCase().replace(/_/g, " ") === type.toLowerCase().replace(/_/g, " "));
  const pickItem = (i: number, code: string) => {
    const it = items.find((x) => x.item_code === code);
    setLines(lines.map((l, idx) => idx !== i ? l : {
      ...l, item_code: code, particular: it?.item_name ?? "", hsn_number: it?.hsn_number ?? l.hsn_number ?? "",
      vat: it?.vat != null ? String(it.vat) : l.vat, rate: it?.purchase_rate != null ? String(it.purchase_rate) : l.rate,
      description: l.description || it?.item_description || "",
      size_uniform: l.item_type?.toLowerCase() === "uniform" ? (it?.size ?? "") : l.size_uniform,
      size_shoes: l.item_type?.toLowerCase() === "shoes" ? (it?.size ?? "") : l.size_shoes,
      size_pantry: (l.item_type || "").toLowerCase().replace(/_/g, " ") === "pantry jacket" ? (it?.size ?? "") : l.size_pantry,
      size_apron: l.item_type?.toLowerCase() === "apron" ? (it?.size ?? "") : l.size_apron,
    }));
  };

  const setLine = (i: number, k: keyof Line, v: string) =>
    setLines(lines.map((l, idx) => (idx === i ? { ...l, [k]: v } : l)));
  const addLine = () => setLines([...lines, emptyLine()]);
  const delLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i));

  // Legacy Req_validation()/btn_validation(): same order, verbatim messages.
  const validate = (): string => {
    if (!lines.some((l) => l.particular.trim())) return "Please Enter Sub Total";
    if (!header.vendor_type) return "Please Select Vendor Type";
    if (!header.vendor_category) return "Please Select Vendor Categories ";
    if (!header.cust_name.trim()) return "Please Select Vendor Name";
    if (!header.customer_gst_no.trim()) return "Please Enter Vendor GST Number";
    if (!header.po_generated_by.trim()) return "Please Enter P.O Generated By";
    if (!header.mobile_no.trim()) return "Please Enter Mobile Number";
    for (const l of lines) {
      const t = (l.item_type || "").toLowerCase().replace(/_/g, " ");
      if (!l.item_type) return "Please Select Item Type";
      if (!l.particular.trim()) return "Please Select Item Name";
      if (t === "uniform" && !l.size_uniform) return "Please Select Uniform Size";
      if (t === "shoes" && !l.size_shoes) return "Please Select Shoes Size";
      if (t === "pantry jacket" && !l.size_pantry) return "Please Select Shoes Size";
      if (t === "apron" && !l.size_apron) return "Please Select Apron Size";
      if (!(l.description || "").trim()) return "Please Enter Description";
      if (!(l.hsn_number || "").trim()) return "Please Enter HSN Code";
      if (!(Number(l.quantity) > 0)) return "Please Enter Quantity";
      if (!(Number(l.rate) > 0)) return "Please Enter Per Unit Rate";
      if (!(Number(l.quantity) * Number(l.rate) > 0)) return "Please Enter Amount";
    }
    const a = Number(header.advance_percentage), r2 = Number(header.remaining_percentage);
    if (a < 0 || a > 100 || r2 < 0 || r2 > 100) return "Enter Percentage Less than 100 and Greater than 0";
    return "";
  };

  const save = async () => {
    const v = validate();
    if (v) { setMsg(v); window.alert(v); return; }
    const body = {
      ...header,
      advance_percentage: Number(header.advance_percentage) || 0,
      remaining_percentage: Number(header.remaining_percentage) || 0,
      lines: lines.map((l) => ({
        particular: l.particular, item_code: l.item_code || "", description: l.description || "",
        hsn_number: l.hsn_number || "", vat: l.vat || "0", quantity: l.quantity || "0",
        rate: l.rate || "0", item_type: l.item_type || "", size_uniform: l.size_uniform || "",
        size_shoes: l.size_shoes || "", size_pantry: l.size_pantry || "", size_apron: l.size_apron || "",
      })),
    };
    const r = editing ? await patchJSON(`${PO()}${editing.id}/`, body) : await mk(PO(), body);
    if (r.ok) {
      const b = await r.json();
      const t = editing ? `Record Updated Successfully !!! (${b.po_no})` : `Invoice (${b.po_no}) added successfully!`;
      setMsg(`${t} Grand Total ${b.grand_total}`); window.alert(t);
      resetForm(); load();
    } else {
      const t = await errText(r); setMsg(t); window.alert(t);
    }
  };

  const resetForm = () => { setEditing(null); setHeader(emptyHeader()); setLines([emptyLine()]); };

  // legacy btn_searchvendor_Click: PO number OR vendor name (LIKE)
  const search = async () => {
    const q = qNo.trim() ? `?search=${encodeURIComponent(qNo.trim())}` : qName.trim() ? `?search=${encodeURIComponent(qName.trim())}` : "";
    await load(q); setSearched(true);
  };
  // legacy lnk_button_Click ("Get Details"): load header + lines, switch to Update / Delete / Final mode
  const getDetails = (o: Order) => {
    const any = o as any;
    setEditing(o);
    setHeader({
      cust_name: o.cust_name || "", cust_code: o.cust_code || "", customer_gst_no: o.customer_gst_no || "",
      address: any.address || "", shipping_to: any.shipping_to || "", po_generated_by: any.po_generated_by || "",
      mobile_no: any.mobile_no || "", po_date: o.po_date || today(),
      advance_percentage: String(o.advance_percentage ?? 25), remaining_percentage: String(o.remaining_percentage ?? 75),
      vendor_type: any.vendor_type || "", vendor_category: any.vendor_category || "",
      client_code: any.client_code || "", unit_code: any.unit_code || "",
    });
    setLines((o.lines || []).map((l: any) => ({
      particular: l.particular || "", item_code: l.item_code || "", description: l.description || "",
      hsn_number: l.hsn_number || "", vat: String(l.vat ?? 0), quantity: String(l.quantity ?? 0),
      rate: String(l.rate ?? 0), item_type: l.item_type || "", size_uniform: l.size_uniform || "",
      size_shoes: l.size_shoes || "", size_pantry: l.size_pantry || "", size_apron: l.size_apron || "",
    })));
    if (!(o.lines || []).length) setLines([emptyLine()]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const finalise = async () => {
    if (!editing) return;
    const r = await mk(`${PO()}${editing.id}/final/`, {});
    if (r.ok) { setMsg("PO finalised."); printPo(editing.id); resetForm(); load(); }
    else { const t = await errText(r, `Failed (${r.status})`); setMsg(t); window.alert(t); }
  };
  const printPo = (id: number) => window.open(`${API_BASE_URL}${PO()}${id}/print/`, "_blank");

  const act = async (id: number, action: "approve_jr" | "approve_sr" | "reject") => {
    let body: Record<string, string> = {};
    if (action === "reject") {
      const reason = window.prompt("Rejection reason") || "";
      if (!reason) return;
      body.po_reject_reason = reason;
    }
    const r = await mk(`${PO()}${id}/${action}/`, body);
    setMsg(r.ok ? "Updated" : await errText(r, `Failed (${r.status})`));
    load();
  };

  const del = async (id: number) => {
    if (!window.confirm("Delete this PO?")) return;
    const r = await rm(`${PO()}${id}/`);
    if (r.ok) { setMsg("Deleted Successfully"); window.alert("Deleted Successfully"); if (editing?.id === id) resetForm(); }
    else { const t = await errText(r, `Failed (${r.status})`); setMsg(t); window.alert(t); }
    load();
  };

  const H = (k: keyof ReturnType<typeof emptyHeader>, label: string, type = "text") => (
    <div><label>{label}: <input type={type} value={(header as any)[k]}
      onChange={(e) => setHeader({ ...header, [k]: e.target.value })} /></label></div>
  );

  return (
    <div className="lg-panel">
      <div className="lg-panel-head">Purchase Order</div>
      <div className="lg-panel-body">
      {msg && <div style={{ color: "#424D7A", margin: "8px 0" }}>{msg}</div>}

      <div style={{ border: "1px solid #ddd", padding: 10, marginBottom: 12 }}>
        <b>New Purchase Order</b>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 6 }}>
          <div><label>Vendor Type:{" "}
            <select value={header.vendor_type} onChange={(e) => setHeader({ ...header, vendor_type: e.target.value })}>
              <option value="">Select</option><option value="Regular">Regular</option>
            </select></label></div>
          <div><label>Vendor Categories:{" "}
            <select value={header.vendor_category} onChange={(e) => setHeader({ ...header, vendor_category: e.target.value, cust_code: "", cust_name: "" })}>
              <option value="">Select</option>
              {VENDOR_CATEGORIES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
            </select></label></div>
          <div><label>Vendor Name:{" "}
            <select value={header.cust_code} onChange={(e) => pickVendor(e.target.value)}>
              <option value="">Select</option>
              {catVendors.map((v) => <option key={v.id} value={v.vend_id}>{v.vend_id} - {v.vend_name}</option>)}
            </select></label></div>
          <div><label>Client:{" "}
            <select value={header.client_code} onChange={(e) => setHeader({ ...header, client_code: e.target.value, unit_code: "" })}>
              <option value="">Select</option>
              {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
            </select></label></div>
          <div><label>Branch:{" "}
            <select value={header.unit_code} onChange={(e) => setHeader({ ...header, unit_code: e.target.value })}>
              <option value="">ALL</option>
              {units.map((u) => <option key={u.unit_code} value={u.unit_code}>{u.unit_name}</option>)}
            </select></label></div>
          {H("customer_gst_no", "Vendor GSTIN")}
          {H("po_date", "PO Date", "date")}
          {H("po_generated_by", "P.O Generated By")}
          {H("mobile_no", "Mobile")}
          {H("address", "Address")}
          {H("shipping_to", "Shipping To")}
          <div><label>Advance %:{" "}
            <input type="number" value={header.advance_percentage} onChange={(e) => setPct("advance_percentage", e.target.value)} /></label></div>
          <div><label>Remaining %:{" "}
            <input type="number" value={header.remaining_percentage} onChange={(e) => setPct("remaining_percentage", e.target.value)} /></label></div>
        </div>
        <div style={{ marginTop: 6, fontSize: 13 }}>
          <b>Sub Total:</b> {totals.sub_total} &nbsp; <b>CGST:</b> {totals.cgst} &nbsp; <b>SGST:</b> {totals.sgst} &nbsp;
          <b>IGST:</b> {totals.igst} &nbsp; <b>Grand Total:</b> {totals.grand_total} &nbsp;
          <b>Advance:</b> {totals.advance_payment} &nbsp; <b>Remaining:</b> {totals.remaining_payment}
        </div>

        <table className="dt-grid">
          <thead><tr>
            <th>Sr</th><th>Item Type</th><th>Item Name</th><th>Size</th><th>Description</th><th>HSN</th>
            <th>GST %</th><th>Qty</th><th>Per Unit Rate</th><th></th>
          </tr></thead>
          <tbody>
            {lines.map((l, i) => {
              const t = (l.item_type || "").toLowerCase().replace(/_/g, " ");
              return (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><select value={l.item_type || ""} onChange={(e) => setLines(lines.map((x, idx) => idx === i ? { ...emptyLine(), item_type: e.target.value } : x))}>
                  <option value="">Select</option>
                  {ITEM_TYPES.map(([v, tt]) => <option key={v} value={v}>{tt}</option>)}
                </select></td>
                <td><select value={l.item_code || ""} onChange={(e) => pickItem(i, e.target.value)}>
                  <option value="">Select</option>
                  {itemsFor(l.item_type).map((it) => <option key={it.item_code} value={it.item_code}>{it.item_name}</option>)}
                </select></td>
                <td>
                  {t === "uniform" && <input placeholder="Uniform size" value={l.size_uniform || ""} onChange={(e) => setLine(i, "size_uniform", e.target.value)} size={6} />}
                  {t === "shoes" && <input placeholder="Shoes size" value={l.size_shoes || ""} onChange={(e) => setLine(i, "size_shoes", e.target.value)} size={6} />}
                  {t === "pantry jacket" && <input placeholder="Jacket size" value={l.size_pantry || ""} onChange={(e) => setLine(i, "size_pantry", e.target.value)} size={6} />}
                  {t === "apron" && <input placeholder="Apron size" value={l.size_apron || ""} onChange={(e) => setLine(i, "size_apron", e.target.value)} size={6} />}
                </td>
                <td><input value={l.description || ""} onChange={(e) => setLine(i, "description", e.target.value)} /></td>
                <td><input value={l.hsn_number || ""} onChange={(e) => setLine(i, "hsn_number", e.target.value)} size={6} /></td>
                <td><input value={l.vat} onChange={(e) => setLine(i, "vat", e.target.value)} size={4} /></td>
                <td><input value={l.quantity} onChange={(e) => setLine(i, "quantity", e.target.value)} size={4} /></td>
                <td><input value={l.rate} onChange={(e) => setLine(i, "rate", e.target.value)} size={6} /></td>
                <td>{lines.length > 1 && <button onClick={() => delLine(i)}>✕</button>}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
        <button onClick={addLine} style={{ marginTop: 6 }}>+ Add Line</button>{" "}
        {!editing && <button onClick={save} style={{ marginTop: 6 }}>Save</button>}
        {editing && <>
          <button onClick={save} style={{ marginTop: 6 }}>Update</button>{" "}
          <button onClick={() => del(editing.id)} style={{ marginTop: 6 }}>Delete</button>{" "}
          <button onClick={finalise} style={{ marginTop: 6 }}>Final</button>{" "}
          <button onClick={() => printPo(editing.id)} style={{ marginTop: 6 }}>Get P.O</button>{" "}
        </>}
        {" "}<button onClick={resetForm} style={{ marginTop: 6 }}>Clear</button>{" "}
        <button onClick={() => router.push("/")} style={{ marginTop: 6 }}>Close</button>
      </div>

      <div style={{ border: "1px solid #ddd", padding: 10, marginBottom: 12 }}>
        <b>Search</b>{" "}
        <label>PO Number: <input value={qNo} onChange={(e) => { setQNo(e.target.value); setQName(""); }} /></label>{" "}
        <label>Vendor Name: <input value={qName} onChange={(e) => { setQName(e.target.value); setQNo(""); }} /></label>{" "}
        <button onClick={search}>Search</button>
      </div>

      <table className="dt-grid">
        <thead><tr>
          <th>PO No</th><th>Date</th><th>Vendor</th><th>Sub Total</th><th>CGST</th><th>SGST</th>
          <th>IGST</th><th>Grand Total</th><th>Status</th><th>Action</th>
        </tr></thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td>{o.po_no}</td><td>{o.po_date}</td><td>{o.cust_name}</td>
              <td>{o.sub_total}</td><td>{o.cgst}</td><td>{o.sgst}</td><td>{o.igst}</td>
              <td>{o.grand_total}</td>
              <td>{FLAGS[o.final_po_flag]}{o.final_po_flag === 3 && o.po_reject_reason ? ` (${o.po_reject_reason})` : ""}</td>
              <td>
                <button onClick={() => getDetails(o)} style={{ marginRight: 4 }}>Get Details</button>
                {o.final_po_flag === 0 && <>
                  <button onClick={() => act(o.id, "approve_jr")} style={{ marginRight: 4 }}>Approve (Jr)</button>
                  <button onClick={() => act(o.id, "reject")} style={{ marginRight: 4 }}>Reject</button>
                  <button onClick={() => del(o.id)}>Delete</button>
                </>}
                {o.final_po_flag === 1 && <button onClick={() => act(o.id, "approve_sr")}>Approve (Sr)</button>}
              </td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center" }}>No purchase orders</td></tr>}
        </tbody>
      </table>
      </div>
    </div>
  );
}
