"use client";

// Port of p_add_gst_rate.aspx (the "ADD GST RATE" popup of Item Master):
// one GST Rate box (keystroke mask digits/space/".", MaxLength 6), Save and
// the ID / GST RATE grid (ORDER BY id). Legacy has no update/delete.

import { useEffect, useState } from "react";
import DataTable, { DTColumn } from "./DataTable";
import { getJSON, mk } from "@/lib/api/legacy-fetch";

interface Row {
  id: number;
  gst_rate: string;
}

// Number_Percent(): 0-9, space and "." only.
const numberPercent = (v: string) => v.replace(/[^0-9 .]/g, "");

function bodyStrings(body: unknown): string[] {
  if (!body || typeof body !== "object") return [];
  const out: string[] = [];
  for (const v of Object.values(body as Record<string, unknown>)) {
    if (typeof v === "string") out.push(v);
    else if (Array.isArray(v)) for (const e of v) if (typeof e === "string") out.push(e);
  }
  return out;
}

export function GstRateMaster() {
  const [rows, setRows] = useState<Row[]>([]);
  const [rate, setRate] = useState("");

  const load = () =>
    getJSON<{ results: Row[] }>("/api/masters/gst-rates/?page_size=all").then((d) => setRows(d?.results ?? []));

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (rate === "") {
      alert("Please Enter Gst Rate!!!");
      return;
    }
    try {
      const res = await mk("/api/masters/gst-rates/", { gst_rate: rate });
      if (res.ok) {
        alert("add record succsefully");
        setRate("");
        load();
      } else {
        const body = await res.json().catch(() => null);
        alert(bodyStrings(body)[0] || " record  NOT succsefully !!!");
      }
    } catch {
      alert(" record  NOT succsefully !!!");
    }
  };

  const cols: DTColumn<Row>[] = [
    { key: "id", label: "ID", value: (d) => String(d.id ?? "") },
    { key: "gst_rate", label: "GST RATE", value: (d) => d.gst_rate || "" },
  ];

  return (
    <div className="lg-wrap">
      <div className="lg-hdr">Add GST Rate</div>
      <div className="lg-form-box">
        <div className="lg-row">
          <label className="lg-label">Gst Rate:</label>
          <input
            className="lg-control"
            maxLength={6}
            value={rate}
            onChange={(e) => setRate(numberPercent(e.target.value))}
          />
        </div>
        <div className="lg-row" style={{ justifyContent: "center", gap: "10px", marginTop: "10px" }}>
          <button className="btn btn-primary" onClick={save}>Save</button>
        </div>
      </div>
      <div className="lg-form-box">
        <DataTable rows={rows} columns={cols} rowKey={(r: Row) => r.id} />
      </div>
    </div>
  );
}
