"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import DataTable, { DTColumn } from "./DataTable";
import { Txt, errMsg } from "./formkit";
import { getJSON, mk, putJSON, rm } from "@/lib/api/legacy-fetch";

interface ItemUnit {
  id: number;
  item_unit_name: string;
  item_pieces: string;
}

// AllowAlphabet1 logic: A-Z, a-z, 0-9, space, and . (period)
const allowAlphabet1 = (v: string) => v.replace(/[^A-Za-z0-9\s.]/g, "");
// isNumber logic: 0-9 only
const isNumber = (v: string) => v.replace(/[^0-9]/g, "");

export function ItemUnitMaster() {
  const [data, setData] = useState<ItemUnit[]>([]);
  const [f, setF] = useState({ item_unit_name: "", item_pieces: "" });
  const [selected, setSelected] = useState<ItemUnit | null>(null);

  const loadGrid = () => {
    getJSON<{ results: ItemUnit[] }>(`/api/masters/item-units/?page_size=all`)
      .then((d) => setData(d?.results ?? []));
  };

  useEffect(() => {
    loadGrid();
  }, []);

  const clear = () => {
    setF({ item_unit_name: "", item_pieces: "" });
    setSelected(null);
  };

  const val = () => {
    if (!f.item_unit_name) return "Please Enter Unit Name";
    if (!f.item_pieces) return "Please Enter Piece per unit";
    return "";
  };

  const save = async () => {
    const err = val();
    if (err) return alert(err);
    try {
      const res = await mk("/api/masters/item-units/", {
        item_unit_name: f.item_unit_name,
        item_pieces: f.item_pieces,
      });
      if (res.ok) {
        alert("Record added successfully!!");
        loadGrid();
        clear();
      } else {
        const body = await res.json();
        alert(errMsg(body) || "Record adding failed...");
      }
    } catch {
      alert("Record adding failed...");
    }
  };

  const update = async () => {
    const err = val();
    if (err) return alert(err);
    if (!selected) return;
    try {
      const res = await putJSON(`/api/masters/item-units/${selected.id}/`, {
        item_unit_name: f.item_unit_name,
        item_pieces: f.item_pieces,
      });
      if (res.ok) {
        alert("Record updated successfully!!");
        loadGrid();
        clear();
      } else {
        alert("Record updation failed...");
      }
    } catch {
      alert("Record updation failed...");
    }
  };

  const del = async () => {
    if (!selected) return;
    if (!confirm("Are you sure you want to delete record?")) return;
    try {
      const res = await rm(`/api/masters/item-units/${selected.id}/`);
      if (res.ok) {
        alert("Record Delete successfully!!");
        loadGrid();
        clear();
      } else {
        alert("Record Delete failed...");
      }
    } catch {
      alert("Record Delete failed...");
    }
  };

  const cols: DTColumn<ItemUnit>[] = [
    { key: "item_unit_name", label: "Unit Name", value: (d: ItemUnit) => d.item_unit_name || "" },
    { key: "item_pieces", label: "Unit Pieces", value: (d: ItemUnit) => d.item_pieces || "" },
  ];

  return (
    <div className="lg-wrap">
      <div className="lg-hdr">Item Unit Master</div>
      <div className="lg-form-box">
        <div className="lg-row">
          <Txt label="Unit Name :" value={f.item_unit_name} onChange={(v) => setF(p => ({ ...p, item_unit_name: v }))} filter={allowAlphabet1} maxLength={50} />
          <Txt label="Piece per unit :" value={f.item_pieces} onChange={(v) => setF(p => ({ ...p, item_pieces: v }))} filter={isNumber} maxLength={10} />
        </div>
        <div className="lg-row" style={{ justifyContent: "center", gap: "10px", marginTop: "10px" }}>
          {!selected && <button className="btn btn-primary" onClick={save}> Save </button>}
          {selected && <button className="btn btn-primary" onClick={update}> Update </button>}
          {selected && <button className="btn btn-primary" onClick={del}> Delete </button>}
          <button className="btn btn-primary" onClick={clear}>Clear</button>
          <Link href="/" className="btn btn-danger" style={{ textDecoration: "none" }}>Close</Link>
        </div>
      </div>
      <div className="lg-form-box">
        <DataTable
          rows={data}
          columns={cols}
          rowKey={(r: ItemUnit) => r.id}
          onRowClick={(r: ItemUnit) => {
            setSelected(r);
            setF({ item_unit_name: r.item_unit_name || "", item_pieces: r.item_pieces || "" });
          }}
          selectedKey={selected?.id}
        />
      </div>
    </div>
  );
}
