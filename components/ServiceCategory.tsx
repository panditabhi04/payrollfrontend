"use client";

import { useState, useEffect } from "react";
import { Field, Txt } from "./formkit";
import { getJSON, mk } from "@/lib/api/legacy-fetch";

interface ServiceCategoryRow {
  id: number;
  service: string;
  category: string;
}

export function ServiceCategory() {
  const [data, setData] = useState<ServiceCategoryRow[]>([]);
  const [category, setCategory] = useState("");

  const loadGrid = () => {
    getJSON<{ results: ServiceCategoryRow[] }>(`/api/masters/service-categories/?page_size=all`)
      .then((d) => setData(d?.results ?? []));
  };

  useEffect(() => {
    loadGrid();
  }, []);

  const save = async () => {
    // Legacy Req_validation(): literal empty check, exact message.
    if (category === "") {
      alert("Please Enter Description !!");
      return;
    }
    try {
      const res = await mk("/api/masters/service-categories/", { category });
      const payload = await res.json().catch(() => null);
      // Legacy alerts unconditionally — the INSERT result is never checked.
      if (res.ok && payload?.message) {
        alert(payload.message);
        setCategory("");
        loadGrid();
      } else if (res.status === 403) {
        alert("You do not have permission for this action.");
      } else {
        alert(payload?.category?.[0] || "Please Enter Description !!");
      }
    } catch {
      // Transport failure: request never processed — no legacy text applies.
      return;
    }
  };

  return (
    <div className="lg-wrap">
      <div className="lg-hdr">Service Category</div>
      <div className="lg-form-box">
        <div className="dt-scroll"><table className="dt-grid">
          <thead><tr><th>No.</th><th>Services</th><th>Category</th></tr></thead>
          <tbody>
            {data.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td><td>{r.service || ""}</td><td>{r.category || ""}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
        <br />
        <div className="lg-row">
          <Field label="Category Desc :">
            <input className="lg-control" value={category}
              onChange={(e) => setCategory(e.target.value)} />
          </Field>
          <div className="text-center">
            <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={save}>
              Add Category
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
