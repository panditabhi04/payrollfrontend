"use client";
import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getJSON, mk, rm, patchJSON } from "@/lib/api/legacy-fetch";
import { API_BASE_URL } from "@/lib/api/client";
import MaterialHoldPanel, { ProcessPrefill } from "@/components/MaterialHoldPanel";

// Legacy Transaction.aspx (Sales Order / sales invoice).
// Client -> State -> Branch cascade, customer GSTIN, Item Type -> Item Name -> HSN/GST/rate/stock autofill from
// the item master, stock check on quantity, line + header discount (% <-> Rs), extra charge with its own GST %,
// live totals + "GST Tax Details" popup, search by document no / customer, Get Details -> Update / Delete.
// Document numbers are I0001-style and assigned by the server. Every legacy alert is shown verbatim
// (client-side first, then the server's identical check). RBAC "Sales Order".
// Print = the legacy Crystal tax-invoice layout drawn by the backend (Rpt_Invoice / Rpt_InvoiceI); Save & Send Mail is not available (SMTP).
const INV = () => "/api/transactions/invoices/";

interface Line {
  particular: string; item_code?: string; description?: string; hsn_number?: string; item_type?: string;
  size_uniform?: string; size_shoes?: string; quantity: string; rate: string; discount_amt: string;
  discount_pct?: string; vat: string; amount?: string; stock?: number | null; emp_code?: string; emp_name?: string;
}
interface Invoice {
  id: number; doc_no: string; doc_date?: string; cust_name: string; cust_code?: string; customer_gst_no?: string;
  state?: string; branch_name?: string; gross_amount: string; discount: string; taxable_amt: string; tax_amt: string;
  final_price: string; extra_chrgs?: string; extra_chrgs_amt?: string; extra_chrgs_tax?: string; lines: Line[];
  [k: string]: any;
}
interface ClientOpt { client_code: string; client_name: string; gst_no?: string; }
interface UnitOpt { unit_code: string; unit_name: string; state_name: string; }
interface ItemOpt {
  item_code: string; item_name: string; product_service?: string; hsn_number?: string; sac_number?: string;
  vat?: number; sales_rate?: number; item_description?: string; stock?: number | null; size?: string;
}
interface Totals {
  gross_amount: string; discount: string; taxable_amt: string; tax_amt: string; extra_chrgs_tax_amt: string;
  final_price: string; gst_breakdown: { title: string; amount: string }[];
}

const emptyLine = (): Line => ({ particular: "", item_type: "", description: "", quantity: "1", rate: "0", discount_amt: "0", discount_pct: "0", vat: "18" });
const emptyHeader = () => ({
  cust_name: "", cust_code: "", customer_gst_no: "", state: "", branch_name: "", doc_date: "", expiry_date: "",
  bill_address: "", shipping_address: "", sales_person: "", sales_mobile_no: "", p_o_no: "", transport: "",
  freight: "", vehicle_no: "", category: "", narration: "", terms_conditions: "", customer_notes: "",
  discount_percent: "0", discount: "0", extra_chrgs: "", extra_chrgs_amt: "0", extra_chrgs_tax: "0",
});
const ZERO: Totals = { gross_amount: "0.00", discount: "0.00", taxable_amt: "0.00", tax_amt: "0.00", extra_chrgs_tax_amt: "0.00", final_price: "0.00", gst_breakdown: [] };

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
const num = (v: any) => { const n = parseFloat(String(v ?? "")); return isNaN(n) ? 0 : n; };
const r2 = (n: number) => Math.round(n * 100) / 100;

export default function SalesOrderPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [msg, setMsg] = useState("");
  const [header, setHeader] = useState(emptyHeader());
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [units, setUnits] = useState<UnitOpt[]>([]);
  const [states, setStates] = useState<string[]>([]);
  const [items, setItems] = useState<ItemOpt[]>([]);
  const [docNo, setDocNo] = useState("");
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [qNo, setQNo] = useState("");
  const [qName, setQName] = useState("");
  const [totals, setTotals] = useState<Totals>(ZERO);
  const [showGst, setShowGst] = useState(false);

  const load = useCallback(async (params = "") => {
    const d = await getJSON<{ results: Invoice[] } | Invoice[]>(INV() + params);
    setRows((Array.isArray(d) ? d : d?.results ?? []) as Invoice[]);
  }, []);
  const loadDocNo = useCallback(async () => {
    const d = await getJSON<{ doc_no: string }>(`${INV()}next-doc-no/`).catch(() => null);
    setDocNo(d?.doc_no ?? "");
  }, []);
  useEffect(() => { load(); loadDocNo(); }, [load, loadDocNo]);
  useEffect(() => {
    getJSON<{ results: ClientOpt[] }>("/api/masters/clients/?page_size=all").then((d) => setClients(d?.results ?? []));
    getJSON<{ results: ItemOpt[] }>("/api/masters/item-masters/?page_size=all").then((d) => setItems(d?.results ?? []));
  }, []);

  // legacy discount_calculate()/gst_calculate()/final_total(): totals refresh as the form changes (server arithmetic)
  useEffect(() => {
    const t = setTimeout(async () => {
      try {
        const r = await mk(`${INV()}preview-totals/`, {
          customer_gst_no: header.customer_gst_no, discount_percent: header.discount_percent,
          extra_chrgs_amt: header.extra_chrgs_amt, extra_chrgs_tax: header.extra_chrgs_tax,
          lines: lines.map((l) => ({ quantity: l.quantity, rate: l.rate, discount_amt: l.discount_amt, vat: l.vat })),
        });
        if (r.ok) setTotals(await r.json());
      } catch { /* totals stay */ }
    }, 300);
    return () => clearTimeout(t);
  }, [header.customer_gst_no, header.discount_percent, header.extra_chrgs_amt, header.extra_chrgs_tax, lines]);

  const loadUnits = async (code: string) => {
    setUnits([]); setStates([]);
    if (!code) return;
    const d = await getJSON<{ units: UnitOpt[]; states: string[] }>(`/api/masters/units/lookup/?client_code=${encodeURIComponent(code)}`);
    const us = d?.units ?? [];
    setUnits(us);
    setStates([...(d?.states ?? Array.from(new Set(us.map((u) => u.state_name).filter(Boolean))))].sort());
  };
  const pickClient = async (code: string) => {
    const c = clients.find((x) => x.client_code === code);
    setHeader({ ...header, cust_code: code, cust_name: c?.client_name ?? "", customer_gst_no: c?.gst_no ?? "", state: "", branch_name: "" });
    await loadUnits(code);
  };

  const itemTypes = Array.from(new Set(items.map((i) => (i.product_service || "").trim()).filter(Boolean))).sort();
  const itemsFor = (type?: string) => items.filter((i) => !type || (i.product_service || "") === type);
  const pickItem = (i: number, code: string) => {
    const it = items.find((x) => x.item_code === code);
    setLines(lines.map((l, idx) => idx !== i ? l : {
      ...l, item_code: code, particular: it?.item_name ?? "", description: it?.item_description ?? "",
      hsn_number: (it?.hsn_number || it?.sac_number || ""), vat: it?.vat != null ? String(it.vat) : l.vat,
      rate: it?.sales_rate != null ? String(it.sales_rate) : l.rate, stock: it?.stock ?? 0,
      quantity: "1", discount_amt: "0", discount_pct: "0",
    }));
  };
  const setLine = (i: number, k: keyof Line, v: string) => setLines(lines.map((l, idx) => idx === i ? { ...l, [k]: v } : l));
  // legacy txt_quantity_TextChanged: available stock must exceed the quantity
  const setQty = (i: number, v: string) => {
    const l = lines[i];
    const q = num(v);
    if (l.item_code && l.stock != null && !(l.stock > q) && q > 0) {
      window.alert(`Quantity must be Less Than  (${l.stock}) `);
      return;
    }
    if (v !== "" && q <= 0 && v !== "0") { window.alert("Quantity must be greater than 0"); return; }
    setLines(lines.map((x, idx) => idx === i ? { ...x, quantity: v, discount_amt: "0", discount_pct: "0" } : x));
  };
  // line discount: % <-> Rs against qty*rate
  const setLineDiscPct = (i: number, v: string) => setLines(lines.map((l, idx) => {
    if (idx !== i) return l;
    const base = num(l.quantity) * num(l.rate);
    return { ...l, discount_pct: v, discount_amt: String(r2(base * num(v) / 100)) };
  }));
  const setLineDiscAmt = (i: number, v: string) => setLines(lines.map((l, idx) => {
    if (idx !== i) return l;
    const base = num(l.quantity) * num(l.rate);
    return { ...l, discount_amt: v, discount_pct: base ? String(r2(num(v) * 100 / base)) : "0" };
  }));
  const addLine = () => setLines([...lines, emptyLine()]);
  const delLine = (i: number) => setLines(lines.length > 1 ? lines.filter((_, idx) => idx !== i) : [emptyLine()]);

  // Legacy Req_validation() + btn_validation(): same order, verbatim messages.
  const validate = (): string => {
    if (!header.cust_name.trim()) return "Please Enter Client Name!!!";
    if (!header.state) return "Please Select State Name!!!";
    if (!header.branch_name) return "Please Select Branch Name!!!";
    if (!header.customer_gst_no.trim()) return "Please Enter Client GST Number!!!";
    if (!lines.some((l) => l.particular.trim())) return "Please Click On the Add Button(Table) to calculate Gross Amount !!!";
    for (const l of lines) {
      const t = (l.item_type || "").toLowerCase();
      if (!l.item_type) return "Please Select Item Type !!!";
      if (!l.particular.trim()) return "Please Select Item Name !!!";
      if (t === "uniform" && (!l.size_uniform || l.size_uniform === "0")) return "Please Select Uniform Size";
      if (t === "shoes" && (!l.size_shoes || l.size_shoes === "0")) return "Please Select Shoes Size";
      if (!(l.description || "").trim()) return "Please Enter Description !!!";
      if (l.vat === "") return "Please Enter GST% Rate !!!";
      if (!(Number(l.quantity) > 0)) return "Please Enter Quantity  !!!";
      if (!(Number(l.rate) > 0)) return "Please Enter Rate  !!!";
    }
    return "";
  };

  const body = () => ({
    ...header, discount: totals.discount, extra_chrgs_amt: header.extra_chrgs_amt || "0",
    extra_chrgs_tax: header.extra_chrgs_tax || "0", doc_date: header.doc_date || null, expiry_date: header.expiry_date || null,
    lines: lines.map((l) => ({
      particular: l.particular, item_code: l.item_code || "", description: l.description || "", hsn_number: l.hsn_number || "",
      item_type: l.item_type || "", size_uniform: l.size_uniform || "", size_shoes: l.size_shoes || "",
      quantity: l.quantity || "0", rate: l.rate || "0", discount_amt: l.discount_amt || "0", vat: l.vat || "0",
      emp_code: l.emp_code || "", emp_name: l.emp_name || "",
    })),
  });
  const reset = () => {
    setEditing(null); setHeader(emptyHeader()); setLines([emptyLine()]); setUnits([]); setStates([]); setTotals(ZERO); loadDocNo();
  };

  const save = async () => {
    const v = validate();
    if (v) { setMsg(v); window.alert(v); return; }
    const r = editing ? await patchJSON(`${INV()}${editing.id}/`, body()) : await mk(INV(), body());
    if (r.ok) {
      const b = await r.json();
      const t = editing ? `Invoice (${b.doc_no}) updated successfully!` : `Invoice (${b.doc_no}) added successfully!`;
      setMsg(`${t} Total ${b.final_price}`); window.alert(t);
      reset(); load();
    } else { const t = await errText(r); setMsg(t); window.alert(t); }
  };
  const del = async () => {
    if (!editing) return;
    if (!window.confirm("Are you Sure You Want to Delete Record")) return;
    const r = await rm(`${INV()}${editing.id}/`);
    if (r.ok) { const t = `${editing.cust_name} Deleted Successfully`; setMsg(t); window.alert(t); reset(); load(); }
    else { const t = await errText(r, `Failed (${r.status})`); setMsg(t); window.alert(t); }
  };

  // Legacy btn_Print_Click -> Rpt_Invoice[I][_Discount].rpt (PDF drawn by the server on the same layout).
  const printInvoice = async () => {
    if (!editing) return;
    const w = window.open("", "_blank");
    try {
      const r = await fetch(`${API_BASE_URL}${INV()}${editing.id}/print/`, { credentials: "include" });
      if (!r.ok) { w?.close(); const t = await errText(r, `Print failed (${r.status})`); setMsg(t); window.alert(t); return; }
      const url = URL.createObjectURL(await r.blob());
      if (w) w.location.href = url; else window.location.href = url;
    } catch { w?.close(); window.alert("Print failed"); }
  };

  const search = async () => {
    const q = qNo.trim() || qName.trim();
    await load(q ? `?search=${encodeURIComponent(q)}` : "");
  };
  // btn "Get Details": load header + lines into the form (Update / Delete mode)
  const getDetails = async (o: Invoice) => {
    setEditing(o);
    setDocNo(o.doc_no);
    setHeader({
      ...emptyHeader(),
      cust_name: o.cust_name || "", cust_code: o.cust_code || "", customer_gst_no: o.customer_gst_no || "",
      state: o.state || "", branch_name: o.branch_name || "", doc_date: o.doc_date || "", expiry_date: o.expiry_date || "",
      bill_address: o.bill_address || "", shipping_address: o.shipping_address || "", sales_person: o.sales_person || "",
      sales_mobile_no: o.sales_mobile_no || "", p_o_no: o.p_o_no || "", transport: o.transport || "", freight: o.freight || "",
      vehicle_no: o.vehicle_no || "", category: o.category || "", narration: o.narration || "",
      terms_conditions: o.terms_conditions || "", customer_notes: o.customer_notes || "",
      extra_chrgs: o.extra_chrgs || "", extra_chrgs_amt: String(o.extra_chrgs_amt ?? "0"), extra_chrgs_tax: String(o.extra_chrgs_tax ?? "0"),
      discount: String(o.discount ?? "0"),
    });
    await loadUnits(o.cust_code || "");
    setLines((o.lines || []).map((l: any) => {
      const base = num(l.quantity) * num(l.rate);
      return {
        particular: l.particular || "", item_code: l.item_code || "", description: l.description || "", hsn_number: l.hsn_number || "",
        item_type: l.item_type || "", size_uniform: l.size_uniform || "", size_shoes: l.size_shoes || "",
        emp_code: l.emp_code || "", emp_name: l.emp_name || "",
        quantity: String(l.quantity ?? "0"), rate: String(l.rate ?? "0"), discount_amt: String(l.discount_amt ?? "0"),
        discount_pct: base ? String(r2(num(l.discount_amt) * 100 / base)) : "0", vat: String(l.vat ?? "0"), stock: null,
      };
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Material grid "Process" links (lnk_*_Click): fill the invoice form from the employee's document row + item master
  const applyProcess = async (p: ProcessPrefill) => {
    const c = clients.find((x) => x.client_code === p.client_code);
    setEditing(null);
    setHeader({ ...emptyHeader(), cust_code: p.client_code, cust_name: c?.client_name ?? "", customer_gst_no: c?.gst_no ?? "",
      state: p.state_name, branch_name: p.unit_code });
    await loadUnits(p.client_code);
    const it = items.find((x) => x.item_code === p.item_code);
    const type = p.item_type;
    setLines([{
      ...emptyLine(), item_type: type, item_code: p.item_code, particular: p.item_name || it?.item_name || "",
      description: p.description || it?.item_description || "", hsn_number: it?.hsn_number || it?.sac_number || "",
      vat: p.vat != null ? String(p.vat) : (it?.vat != null ? String(it.vat) : "18"),
      rate: it?.sales_rate != null ? String(it.sales_rate) : "0", stock: it?.stock ?? null,
      quantity: p.no_of_set || "1", emp_code: p.emp_code, emp_name: p.emp_name,
      size_uniform: type === "Uniform" ? p.size : "", size_shoes: type === "Shoes" ? p.size : "",
    }]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const H = (k: keyof ReturnType<typeof emptyHeader>, label: string, type = "text") => (
    <div><label>{label}: <input type={type} value={(header as any)[k]} onChange={(e) => setHeader({ ...header, [k]: e.target.value })} /></label></div>);

  return (
    <div className="lg-panel">
      <div className="lg-panel-head">Sales Order / Invoice</div>
      <div className="lg-panel-body">
      {msg && <div style={{ color: "#424D7A", margin: "8px 0" }}>{msg}</div>}
      <div style={{ border: "1px solid #ddd", padding: 10, marginBottom: 12 }}>
        <b>{editing ? `Invoice ${docNo}` : "New Invoice"}</b>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 6 }}>
          <div><label>Document No: <input value={docNo} readOnly /></label></div>
          <div><label>Client Name:{" "}
            <select value={header.cust_code} onChange={(e) => pickClient(e.target.value)}>
              <option value="">Select</option>
              {clients.map((c) => <option key={c.client_code} value={c.client_code}>{c.client_name}</option>)}
            </select></label></div>
          <div><label>State Name:{" "}
            <select value={header.state} onChange={(e) => setHeader({ ...header, state: e.target.value, branch_name: "" })}>
              <option value="">Select</option>
              {states.map((s) => <option key={s} value={s}>{s}</option>)}
            </select></label></div>
          <div><label>Branch Name:{" "}
            <select value={header.branch_name} onChange={(e) => setHeader({ ...header, branch_name: e.target.value })}>
              <option value="">Select</option>
              {units.filter((u) => !header.state || u.state_name === header.state).map((u) => <option key={u.unit_code} value={u.unit_name}>{u.unit_name}</option>)}
            </select></label></div>
          {H("customer_gst_no", "Client GST No")}{H("doc_date", "Invoice Date", "date")}{H("expiry_date", "Expiry Date", "date")}
          {H("bill_address", "Bill Address")}{H("shipping_address", "Ship Address")}
          {H("sales_person", "Sales Person")}{H("sales_mobile_no", "Sales Person Mobile")}
          {H("p_o_no", "P.O. No")}{H("transport", "Transport")}{H("freight", "Freight")}{H("vehicle_no", "Vehicle No")}
          {H("category", "Category")}{H("narration", "Narration")}
          {H("customer_notes", "Customer Notes")}{H("terms_conditions", "Terms & Conditions")}
        </div>
        <table className="dt-grid">
          <thead><tr><th>Sr</th><th>Item Type</th><th>Item Name</th><th>Description</th><th>HSN/SAC</th><th>Size</th><th>GST%</th><th>Qty (Stock)</th><th>Rate</th><th>Disc %</th><th>Disc Rs</th><th>Amount</th><th></th></tr></thead>
          <tbody>
            {lines.map((l, i) => {
              const t = (l.item_type || "").toLowerCase();
              const amt = r2(num(l.quantity) * num(l.rate) - num(l.discount_amt));
              return (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><select value={l.item_type || ""} onChange={(e) => setLines(lines.map((x, idx) => idx === i ? { ...emptyLine(), item_type: e.target.value } : x))}>
                  <option value="">Select</option>
                  {itemTypes.map((tt) => <option key={tt} value={tt}>{tt}</option>)}
                </select></td>
                <td><select value={l.item_code || ""} onChange={(e) => pickItem(i, e.target.value)}>
                  <option value="">Select</option>
                  {itemsFor(l.item_type).map((it) => <option key={it.item_code} value={it.item_code}>{it.item_name}</option>)}
                </select></td>
                <td><input value={l.description || ""} onChange={(e) => setLine(i, "description", e.target.value)} /></td>
                <td><input value={l.hsn_number || ""} readOnly size={8} /></td>
                <td>
                  {t === "uniform" && <input placeholder="Uniform size" value={l.size_uniform || ""} onChange={(e) => setLine(i, "size_uniform", e.target.value)} size={6} />}
                  {t === "shoes" && <input placeholder="Shoes size" value={l.size_shoes || ""} onChange={(e) => setLine(i, "size_shoes", e.target.value)} size={6} />}
                </td>
                <td><input value={l.vat} onChange={(e) => setLine(i, "vat", e.target.value)} size={4} /></td>
                <td><input value={l.quantity} onChange={(e) => setQty(i, e.target.value)} size={4} />
                  {l.item_code && l.stock != null ? <span style={{ fontSize: 11, color: "#666" }}> ({l.stock})</span> : null}</td>
                <td><input value={l.rate} onChange={(e) => setLine(i, "rate", e.target.value)} size={6} /></td>
                <td><input value={l.discount_pct || "0"} onChange={(e) => setLineDiscPct(i, e.target.value)} size={4} /></td>
                <td><input value={l.discount_amt} onChange={(e) => setLineDiscAmt(i, e.target.value)} size={5} /></td>
                <td>{amt.toFixed(2)}</td>
                <td>{lines.length > 1 && <button onClick={() => delLine(i)}>✕</button>}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
        <button onClick={addLine} style={{ marginTop: 6 }}>+ Add Line</button>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginTop: 10 }}>
          <div><label>Discount %: <input type="number" value={header.discount_percent} onChange={(e) => setHeader({ ...header, discount_percent: e.target.value })} /></label></div>
          <div><label>Discount Amount: <input value={totals.discount} readOnly /></label></div>
          <div><label>Gross Amount: <input value={totals.gross_amount} readOnly /></label></div>
          <div><label>Taxable Amount: <input value={totals.taxable_amt} readOnly /></label></div>
          <div><label>GST: <input value={totals.tax_amt} readOnly /></label>{" "}
            <button type="button" onClick={() => setShowGst(true)}>GST Tax Details</button></div>
          {H("extra_chrgs", "Extra Charges")}
          {H("extra_chrgs_amt", "Extra Charges Amount", "number")}
          {H("extra_chrgs_tax", "GST(%) on Charges", "number")}
          <div><label>GST on Charges: <input value={totals.extra_chrgs_tax_amt} readOnly /></label></div>
          <div><label><b>Final Total: <input value={totals.final_price} readOnly /></b></label></div>
        </div>

        <div style={{ marginTop: 8 }}>
          {!editing && <button onClick={save}>Save as Draft</button>}
          {editing && <>
            <button onClick={save}>Update</button>{" "}
            <button onClick={del}>Delete</button>{" "}
            <button onClick={printInvoice}>Print</button>{" "}
          </>}
          {" "}<button onClick={reset}>Clear</button>{" "}
          <button onClick={() => router.push("/")}>Close</button>
        </div>
        <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
          Save &amp; Send Mail is not available in this version.
        </div>
      </div>

      {showGst && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setShowGst(false)}>
          <div style={{ background: "#fff", padding: 16, minWidth: 320, borderRadius: 6 }} onClick={(e) => e.stopPropagation()}>
            <b>GST Tax Details</b>
            <table className="dt-grid" style={{ marginTop: 8 }}>
              <tbody>
                {totals.gst_breakdown.length === 0 && <tr><td>No GST</td></tr>}
                {totals.gst_breakdown.map((g) => <tr key={g.title}><td>{g.title}</td><td style={{ textAlign: "right" }}>{g.amount}</td></tr>)}
              </tbody>
            </table>
            <button style={{ marginTop: 8 }} onClick={() => setShowGst(false)}>Close</button>
          </div>
        </div>
      )}

      <MaterialHoldPanel onProcess={applyProcess} />
      <div style={{ border: "1px solid #ddd", padding: 10, marginBottom: 12 }}>
        <b>Search</b>{" "}
        <label>Document No: <input value={qNo} onChange={(e) => { setQNo(e.target.value); setQName(""); }} /></label>{" "}
        <label>Customer Name: <input value={qName} onChange={(e) => { setQName(e.target.value); setQNo(""); }} /></label>{" "}
        <button onClick={search}>Search</button>
      </div>
      <table className="dt-grid">
        <thead><tr><th>Invoice No</th><th>Date</th><th>Customer</th><th>Gross</th><th>Taxable</th><th>Tax</th><th>Total</th><th></th></tr></thead>
        <tbody>
          {rows.map((o) => (
            <tr key={o.id}>
              <td>{o.doc_no}</td><td>{o.doc_date}</td><td>{o.cust_name}</td><td>{o.gross_amount}</td>
              <td>{o.taxable_amt}</td><td>{o.tax_amt}</td><td>{o.final_price}</td>
              <td><button onClick={() => getDetails(o)}>Get Details</button></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center" }}>No invoices</td></tr>}
        </tbody>
      </table>
      </div>
    </div>
  );
}
