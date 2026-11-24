"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DataTable, { DTColumn } from "./DataTable";
import { Sel, Txt, Opt } from "./formkit";
import { getJSON, mk, putJSON, rm } from "@/lib/api/legacy-fetch";

interface HsnRow {
  id: number;
  hsn_code: string;
  gst_rate: string;
  hsn_category: string;
}

interface GstRateRow {
  id: number;
  gst_rate: string;
}

// Legacy AllowAlphabet_address(event) keystroke mask (hsn_master.aspx),
// applied to HSN Code and HSN Category: A-Z a-z 0-9, space, and & , - . / : ; = \
// NOTE: the legacy ((keyEntry == '39') && (keyEntry == '34')) clause is dead
// (one key code can never equal both 39 and 34), so ' and " stay blocked —
// preserved exactly, not "fixed".
const allowAlphabetAddress = (v: string) => v.replace(/[^A-Za-z0-9\s&,.\-/:;=\\]/g, "");

const GUARD_MSG = "  first delete hsn code from item master...";

// Collect every string leaf from a DRF error body (detail / field lists).
function bodyStrings(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const out: string[] = [];
  for (const v of Object.values(body as Record<string, unknown>)) {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) for (const e of v) if (typeof e === "string") out.push(e);
  }
  return out;
}

export function HsnMaster() {
  const [data, setData] = useState<HsnRow[]>([]);
  const [rates, setRates] = useState<GstRateRow[]>([]);
  const [f, setF] = useState({ hsn_code: "", gst_rate: "Select", hsn_category: "" });
  const [selected, setSelected] = useState<HsnRow | null>(null);

  const loadGrid = () => {
    getJSON<{ results: HsnRow[] }>(`/api/masters/hsn-masters/?page_size=all`)
      .then((d) => setData(d?.results ?? []));
  };

  useEffect(() => {
    loadGrid();
    // GST dropdown source: real pay_gst_rate rows, DB order (ORDER BY id).
    // Duplicates and 3405 are preserved; "Select" is prepended like legacy.
    getJSON<{ results: GstRateRow[] }>(`/api/masters/gst-rates/?page_size=all`)
      .then((d) => setRates(d?.results ?? []));
  }, []);

  const clear = () => {
    // Legacy txt_clear(): both text boxes emptied, dropdown reset to "Select".
    setF({ hsn_code: "", gst_rate: "Select", hsn_category: "" });
    setSelected(null);
  };

  // Legacy validation(): exact messages. HSN Category has no validation.
  // No duplicate check (legacy's is commented out).
  const val = () => {
    if (!f.hsn_code) return "Please Enter HSN Code";
    if (!f.gst_rate || f.gst_rate === "Select") return "Please Select GST Rate";
    return "";
  };

  const save = async () => {
    const err = val();
    if (err) return alert(err);
    try {
      const res = await mk("/api/masters/hsn-masters/", {
        hsn_code: f.hsn_code,
        gst_rate: f.gst_rate,
        hsn_category: f.hsn_category,
      });
      if (res.ok) {
        alert("  Record  Add succsefully... !!!");
        loadGrid();
        clear();
      } else {
        const body = await res.json().catch(() => null);
        alert(bodyStrings(body)[0] || "  Record  Add faill.... !!!");
      }
    } catch {
      alert("  Record  Add faill.... !!!");
    }
  };

  const update = async () => {
    const err = val();
    if (err) return alert(err);
    if (!selected) return;
    if (!confirm("Are you sure,You want to update Record?")) return;
    try {
      const res = await putJSON(`/api/masters/hsn-masters/${selected.id}/`, {
        hsn_code: f.hsn_code,
        gst_rate: f.gst_rate,
        hsn_category: f.hsn_category,
      });
      if (res.ok) {
        alert("  Record  Update succsefully... !!!");
        loadGrid();
        clear();
      } else {
        const body = await res.json().catch(() => null);
        alert(bodyStrings(body)[0] || "  Record  Update faill.... !!!");
      }
    } catch {
      alert("  Record  Update faill.... !!!");
    }
  };

  const del = async () => {
    if (!selected) return;
    if (!confirm("Are you sure,You want to delete Record?")) return;
    try {
      const res = await rm(`/api/masters/hsn-masters/${selected.id}/`);
      if (res.ok) {
        alert("  Record  Deleted succsefully... !!!");
        loadGrid();
        clear();
      } else {
        const body = await res.json().catch(() => null);
        const msgs = bodyStrings(body);
        if (msgs.some((m) => m.includes("first delete hsn code from item master"))) {
          alert(GUARD_MSG);
        } else {
          alert(msgs[0] || "  Record  Deleted faill.... !!!");
        }
      }
    } catch {
      alert("  Record  Deleted faill.... !!!");
    }
  };

  const gstOpts: Opt[] = [
    { v: "Select", t: "Select" },
    ...rates.map((r) => ({ v: r.gst_rate ?? "", t: r.gst_rate ?? "" })),
  ];

  const cols: DTColumn<HsnRow>[] = [
    { key: "id", label: "ID", value: (d: HsnRow) => String(d.id ?? "") },
    { key: "hsn_code", label: "HSN CODE", value: (d: HsnRow) => d.hsn_code || "" },
    { key: "gst_rate", label: "GST RATE", value: (d: HsnRow) => d.gst_rate || "" },
    { key: "hsn_category", label: "HSN CATEGORY", value: (d: HsnRow) => d.hsn_category || "" },
  ];

  return (
    <div className="lg-wrap">
      <div className="lg-hdr">HSN Master</div>
      <div className="lg-form-box">
        <div className="lg-row">
          <Txt label="HSN Code :" req value={f.hsn_code} onChange={(v) => setF(p => ({ ...p, hsn_code: v }))} filter={allowAlphabetAddress} maxLength={100} />
          <Sel label="GST Rate :" req value={f.gst_rate} onChange={(v) => setF(p => ({ ...p, gst_rate: v }))} opts={gstOpts} />
          <Txt label="HSN Category :" value={f.hsn_category} onChange={(v) => setF(p => ({ ...p, hsn_category: v }))} filter={allowAlphabetAddress} maxLength={100} />
        </div>
        <div className="lg-row" style={{ justifyContent: "center", gap: "10px", marginTop: "10px" }}>
          {!selected && <button className="btn btn-primary" onClick={save}> Save </button>}
          {selected && <button className="btn btn-primary" onClick={update}> Update </button>}
          {selected && <button className="btn btn-primary" onClick={del}> Delete </button>}
          <Link href="/Home" className="btn btn-danger" style={{ textDecoration: "none" }}>Close</Link>
        </div>
      </div>
      <div className="lg-form-box">
        <DataTable
          rows={data}
          columns={cols}
          rowKey={(r: HsnRow) => r.id}
          onRowClick={(r: HsnRow) => {
            setSelected(r);
            setF({ hsn_code: r.hsn_code || "", gst_rate: r.gst_rate || "Select", hsn_category: r.hsn_category || "" });
          }}
          selectedKey={selected?.id}
        />
      </div>
    </div>
  );
}
