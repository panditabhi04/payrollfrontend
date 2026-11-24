"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import { listItems, createItem, updateItem, deleteItem, ApiError } from "@/lib/api/crud";
import DataTable, { type DTColumn } from "@/components/DataTable";

const BASE = "/api/masters/holidays";
const MENU = "Holiday Master";

interface Holiday {
  id: number;
  comp_code: string;
  dept_code: string;
  unit_code: string;
  dept_name?: string;
  unit_name?: string;
  occassion: string;
  holiday_date: string;
}

interface DropdownItem {
  value: string;
  label: string;
}

const DT_COLS: DTColumn<Holiday>[] = [
  { key: "id", label: "ID", value: (h) => String(h.id) },
  { key: "occassion", label: "OCCASSION", value: (h) => h.occassion },
  { key: "holiday_date", label: "DATE", value: (h) => (h.holiday_date ? h.holiday_date.split("-").reverse().join("/") : "") },
  { key: "dept_code", label: "DEPARTMENT", value: (h) => h.dept_name || h.dept_code || "" },
  { key: "unit_code", label: "UNIT", value: (h) => h.unit_name || h.unit_code || "" },
];

function levelFor(me: Me | null): number {
  if (!me) return 0;
  if (me.is_staff) return 4;
  const map: Record<string, number> = { R: 1, U: 2, C: 3, D: 4 };
  return me.permissions.filter((p) => p.menu === MENU && !p.needs_review)
    .reduce((mx, p) => Math.max(mx, map[p.permission] ?? 0), 0);
}

// Message out of a DRF error body ({detail}|{field:[msgs]}); legacy fallback text otherwise.
const apiMsg = (d: unknown, fallback: string): string => {
  const o = (d ?? {}) as Record<string, unknown>;
  if (typeof o.detail === "string") return o.detail;
  for (const v of Object.values(o)) {
    const m = Array.isArray(v) ? v[0] : v;
    if (typeof m === "string" && m) return m;
  }
  return fallback;
};

export default function HolidayMaster() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [rows, setRows] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Holiday | null>(null);

  const [departments, setDepartments] = useState<DropdownItem[]>([]);
  const [units, setUnits] = useState<DropdownItem[]>([]);

  const [deptCode, setDeptCode] = useState("All");
  const [unitCode, setUnitCode] = useState("All");
  const [occassion, setOccassion] = useState("");
  const [date, setDate] = useState("");

  const level = levelFor(me);
  const canCreate = level >= 3;
  const canUpdate = level >= 2;
  const canDelete = !!me?.is_staff || level >= 4;

  const loadDropdowns = async () => {
    try {
      const dRes = await listItems<{ dept_code: string; dept_name: string }>("/api/masters/departments", { pageSize: 500 });
      setDepartments([{ value: "All", label: "All" }, ...dRes.results.map((d) => ({ value: d.dept_code, label: d.dept_name }))]);
    } catch { setDepartments([{ value: "All", label: "All" }]); }
    try {
      const uRes = await listItems<{ unit_code: string; unit_name: string }>("/api/masters/units", { pageSize: 500 });
      setUnits([{ value: "All", label: "All" }, ...uRes.results.map((u) => ({ value: u.unit_code, label: u.unit_name }))]);
    } catch { setUnits([{ value: "All", label: "All" }]); }
  };

  const loadGrid = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listItems<Holiday>(BASE, { pageSize: 500 });
      setRows(res.results);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getMe().then((m) => {
      setMe(m);
      setAuthChecked(true);
      loadDropdowns();
      loadGrid();
    });
  }, [loadGrid]);

  const clearForm = () => {
    setSelected(null);
    setDeptCode("All");
    setUnitCode("All");
    setOccassion("");
    setDate("");
  };

  const selectRow = (h: Holiday) => {
    setSelected(h);
    setDeptCode(h.dept_code || "All");
    setUnitCode(h.unit_code || "All");
    setOccassion(h.occassion);
    setDate(h.holiday_date);
  };

  const validate = (): string | null => {
    if (!occassion.trim()) return "Please select occassion";
    if (!date) return "Please select Date";
    if (deptCode === "Select Department") return " Select Department ";
    return null;
  };

  const payload = () => ({
    dept_code: deptCode,
    unit_code: unitCode,
    occassion: occassion.trim(),
    holiday_date: date,
  });

  const onSave = async () => {
    const err = validate();
    if (err) { alert(err); return; }
    try {
      const res = await createItem(BASE, payload());
      if (!res.ok) { alert(res.status === 403 ? "You do not have permission for this action." : apiMsg(res.data, "Failed to save.")); return; }
      alert("Holiday added successfully!");
      clearForm();
      loadGrid();
    } catch (e: any) {
      if (e instanceof ApiError && e.data) alert(Object.values(e.data).flat()[0] || "Failed to save.");
      else alert("An error occurred");
    }
  };

  const onUpdate = async () => {
    if (!selected) return;
    const err = validate();
    if (err) { alert(err); return; }
    try {
      const res = await updateItem(BASE, selected.id, payload());
      if (!res.ok) { alert(res.status === 403 ? "You do not have permission for this action." : apiMsg(res.data, "Failed to update.")); return; }
      alert("Holiday Updated Successfully...");
      clearForm();
      loadGrid();
    } catch (e: any) {
      if (e instanceof ApiError && e.data) alert(Object.values(e.data).flat()[0] || "Failed to update.");
      else alert("An error occurred");
    }
  };

  const onDelete = async () => {
    if (!selected) return;
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      const res = await deleteItem(BASE, selected.id);
      if (!res.ok) { alert(res.status === 403 ? "Only administrators can delete a record." : apiMsg(res.data, "Cannot delete.")); return; }
      alert("Holiday deleted successfully!!");
      clearForm();
      loadGrid();
    } catch (e: any) {
      if (e instanceof ApiError && e.data) alert(e.data.detail || Object.values(e.data).flat()[0] || "Record deletion failed...");
      else alert("Record deletion failed...");
    }
  };

  if (!authChecked) return null;

  return (
    <div className="container-fluid" style={{ fontFamily: "sans-serif" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px", backgroundColor: "#fff" }}>
        {/* ===== panel heading (legacy HolidayMaster.aspx Panel3 heading) ===== */}
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px" }}>
          <div className="row">
            <div className="col-sm-1 col-xs-12" />
            <div className="col-sm-9 col-xs-12 text-center text-uppercase" style={{ fontSize: "small", fontWeight: "bold" }}>
              Holiday Master
            </div>
            <div className="col-sm-2 col-xs-12 text-right">
              <Link href="#" onClick={(e) => e.preventDefault()} style={{ color: "#fff", fontSize: "10px" }}>
                <img src="/Images/help_ico.png" alt="Help" width={20} height={20} title="Help" />
              </Link>
            </div>
          </div>
        </div>

        <div className="panel-body" style={{ padding: "15px", background: "#fff", minHeight: "400px" }}>
          {level === 0 ? (
            <div className="text-red" style={{ fontWeight: "bold", padding: "16px" }}>
              You do not have permission to access Holiday Master.
            </div>
          ) : (
            <>
              {/* ===== input row (legacy col-sm-2 grid) ===== */}
              <div className="row">
                <div className="col-sm-3 col-xs-12 emf">
                  <b>Department :</b>
                  <select className="form-control" value={deptCode} onChange={(e) => setDeptCode(e.target.value)}>
                    {departments.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                  </select>
                </div>
                <div className="col-sm-3 col-xs-12 emf">
                  <b>Branch Name :</b>
                  <select className="form-control" value={unitCode} onChange={(e) => setUnitCode(e.target.value)}>
                    {units.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                  </select>
                </div>
                <div className="col-sm-3 col-xs-12 emf">
                  <b>Occassion :</b><span className="text-red"> *</span>
                  <input type="text" maxLength={50} className="form-control" value={occassion}
                    onChange={(e) => setOccassion(e.target.value)} />
                </div>
                <div className="col-sm-3 col-xs-12 emf">
                  <b>Date :</b><span className="text-red"> *</span>
                  <input type="date" className="form-control" value={date}
                    onChange={(e) => setDate(e.target.value)} />
                </div>
              </div>

              {/* ===== grid (legacy gvholiday DataTable) ===== */}
              <div className="grid-view" style={{ marginTop: 12, background: "#fff" }}>
                <DataTable<Holiday>
                  columns={DT_COLS}
                  rows={rows}
                  rowKey={(r) => r.id}
                  onRowClick={selectRow}
                  selectedKey={selected?.id}
                />
              </div>

              {/* ===== button row (legacy Save/Update/Delete/Clear/Close) ===== */}
              <div className="lg-btns center" style={{ marginTop: 16 }}>
                {!selected && canCreate && <button className="lg-btn lg-btn-green" onClick={onSave}>Save</button>}
                {selected && canUpdate && <button className="lg-btn lg-btn-green" onClick={onUpdate}>Update</button>}
                {selected && canDelete && <button className="lg-btn lg-btn-red" onClick={onDelete}>Delete</button>}
                <button className="lg-btn" onClick={clearForm}>Clear</button>
                <Link href="/" className="lg-btn lg-btn-red" style={{ textDecoration: "none" }}>Close</Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
