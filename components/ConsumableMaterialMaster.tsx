"use client";

import { useState, useEffect } from "react";
import DataTable, { DTColumn } from "./DataTable";
import { Field, Sel, Txt, Opt, errMsg } from "./formkit";
import { getJSON, mk, putJSON, rm } from "@/lib/api/legacy-fetch";

interface Material {
  id: number;
  client_code: string;
  material_type: string;
  MATERIAL_NAME: string;
  unit: string;
  active: string;
}

const materialOpts: Opt[] = [
  { v: "Select", t: "Select" },
  { v: "Chemicals", t: "Chemicals" },
  { v: "Housekeeping Materials", t: "Housekeeping Materials" },
  { v: "Uniform", t: "Uniform" },
  { v: "Pantry Jacket", t: "Pantry Jacket" },
  { v: "Apron", t: "Apron" },
  { v: "Shoes", t: "Shoes" },
  { v: "ID Card", t: "ID Card" },
  { v: "Machine", t: "Machine" },
  { v: "Other", t: "Other" },
];

const unitOpts: Opt[] = [
  { v: "Select", t: "Select" },
  { v: "Bottle", t: "Bottle" },
  { v: "Box", t: "Box" },
  { v: "BUCKET", t: "BUCKET" },
  { v: "Can", t: "Can" },
  { v: "EA", t: "EA" },
  { v: "KG", t: "KG" },
  { v: "KM", t: "KM" },
  { v: "Liter", t: "Liter" },
  { v: "Millilitre", t: "Millilitre" },
  { v: "NA", t: "NA" },
  { v: "NO.", t: "NO." },
  { v: "PACKET", t: "PACKET" },
  { v: "Pair", t: "Pair" },
  { v: "PCS", t: "PCS" },
  { v: "PKT", t: "PKT" },
  { v: "QTY", t: "QTY" },
  { v: "RFT", t: "RFT" },
  { v: "SQFT", t: "SQFT" },
];

export function ConsumableMaterialMaster() {
  const [clients, setClients] = useState<{ client_code: string; client_name: string }[]>([]);
  const [data, setData] = useState<Material[]>([]);
  const [f, setF] = useState({ client_code: "Select", material_type: "Select", MATERIAL_NAME: "", unit: "Select" });
  const [selected, setSelected] = useState<Material | null>(null);

  useEffect(() => {
    getJSON<{ results: { client_code: string; client_name: string }[] }>("/api/masters/consumable-materials/clients/")
      .then((d) => setClients((d?.results ?? []).map((c) => ({ client_code: c.client_code, client_name: c.client_name }))));
  }, []);

  const loadGrid = (client: string) => {
    if (!client || client === "Select") {
      setData([]);
      return;
    }
    getJSON<{ results: Material[] }>(`/api/masters/consumable-materials/?page_size=all&client_code=${encodeURIComponent(client)}`)
      .then((d) => setData(d?.results ?? []));
  };

  useEffect(() => {
    loadGrid(f.client_code);
  }, [f.client_code]);

  const clear = () => {
    setF(p => ({ ...p, material_type: "Select", MATERIAL_NAME: "", unit: "Select" }));
    setSelected(null);
  };

  const val = () => {
    if (f.client_code === "Select") return "Please Select Client Name";
    if (f.material_type === "Select") return "Please Select Material Type";
    if (!f.MATERIAL_NAME.trim()) return "Please Add MMaterial Name"; // Kept legacy typo "MMaterial"
    if (f.unit === "Select") return "Please Select Unit";
    return "";
  };

  const save = async () => {
    const err = val();
    if (err) return alert(err);
    try {
      const res = await mk("/api/masters/consumable-materials/", {
        client_code: f.client_code,
        material_type: f.material_type,
        MATERIAL_NAME: f.MATERIAL_NAME,
        unit: f.unit,
      });
      if (res.ok) {
        alert("Record Added Successfully !!!");
        loadGrid(f.client_code);
        clear();
      } else {
        const body = await res.json();
        if (body?.non_field_errors?.[0]) {
            alert(body.non_field_errors[0]);
        } else {
            alert(errMsg(body) || "Record Added Failed !!!");
        }
      }
    } catch {
      alert("Record Added Failed !!!");
    }
  };

  const update = async () => {
    const err = val();
    if (err) return alert(err);
    if (!selected) return;
    try {
      const res = await putJSON(`/api/masters/consumable-materials/${selected.id}/?client_code=${encodeURIComponent(selected.client_code)}`, {
        client_code: f.client_code,
        material_type: f.material_type,
        MATERIAL_NAME: f.MATERIAL_NAME,
        unit: f.unit,
      });
      if (res.ok) {
        alert("Record Updated Successfully !!!");
        loadGrid(f.client_code);   // legacy stays in edit mode (Update/Delete remain visible)
      } else {
        alert("Record Updated Failed !!!");
      }
    } catch {
      alert("Record Updated Failed !!!");
    }
  };

  const del = async () => {
    const err = val();
    if (err) return alert(err);
    if (!selected) return;
    try {
      const res = await rm(`/api/masters/consumable-materials/${selected.id}/?client_code=${encodeURIComponent(selected.client_code)}`);
      if (res.ok) {
        alert("Record Deleted Successfully !!!");
        loadGrid(f.client_code);
        clear();
      } else {
        alert("Record Deleted Failed !!!");
      }
    } catch {
      alert("Record Deleted Failed !!!");
    }
  };

  const clientOpts: Opt[] = [{ v: "Select", t: "Select" }, ...clients.map(c => ({ v: c.client_code, t: c.client_name }))];

  const cols: DTColumn<Material>[] = [
    { key: "sr_no", label: "Sr No", value: (d: Material) => String(data.indexOf(d) + 1) },
    { key: "client_name", label: "Client Name", value: (d: Material) => clients.find(c => c.client_code === d.client_code)?.client_name || d.client_code || "" },
    { key: "material_type", label: "Material Type", value: (d: Material) => d.material_type || "" },
    { key: "MATERIAL_NAME", label: "Material_Name", value: (d: Material) => d.MATERIAL_NAME || "" },
    { key: "unit", label: "Unit", value: (d: Material) => d.unit || "" },
  ];

  return (
    <div className="lg-wrap">
      <div className="lg-hdr">Consumable Material Master</div>
      <div className="lg-form-box">
        <div className="lg-row">
          <Sel label="Client Name :" req value={f.client_code} onChange={(v) => { setF(p => ({ ...p, client_code: v })); setSelected(null); }} opts={clientOpts} />
          <Sel label="Material Type :" req value={f.material_type} onChange={(v) => setF(p => ({ ...p, material_type: v }))} opts={materialOpts} />
          <Txt label="Material Name :" req value={f.MATERIAL_NAME} onChange={(v) => setF(p => ({ ...p, MATERIAL_NAME: v }))} />
          <Sel label="Unit :" req value={f.unit} onChange={(v) => setF(p => ({ ...p, unit: v }))} opts={unitOpts} />
        </div>
        <div className="lg-row" style={{ justifyContent: "center", gap: "10px", marginTop: "10px" }}>
          {!selected && <button className="btn btn-primary" onClick={save}> Save </button>}
          {selected && <button className="btn btn-primary" onClick={update}> Update </button>}
          {selected && <button className="btn btn-primary" onClick={del}> Delete </button>}
          <button className="btn btn-primary" onClick={() => { clear(); setF({ client_code: "Select", material_type: "Select", MATERIAL_NAME: "", unit: "Select" }); setData([]); }}>Clear</button>
        </div>
      </div>
      <div className="lg-form-box">
        <DataTable
          rows={data}
          columns={cols}
          rowKey={(r: Material) => r.id}
          onRowClick={(r: Material) => {
            setSelected(r);
            setF({ client_code: r.client_code || "Select", material_type: r.material_type || "Select", MATERIAL_NAME: r.MATERIAL_NAME || "", unit: r.unit || "Select" });
          }}
          selectedKey={selected?.id}
        />
      </div>
    </div>
  );
}
