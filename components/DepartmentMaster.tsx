"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import { listItems, createItem, updateItem, deleteItem, ApiError } from "@/lib/api/crud";
import DataTable, { type DTColumn } from "@/components/DataTable";

const BASE = "/api/masters/departments";
const MENU = "Department Master";

interface Department {
  id: number;
  dept_code: string;
  dept_name: string;
}

const DT_COLS: DTColumn<Department>[] = [
  { key: "dept_code", label: "DEPARTMENT CODE", value: (d) => d.dept_code },
  { key: "dept_name", label: "DEPARTMENT NAME", value: (d) => d.dept_name || "" },
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

export default function DepartmentMaster() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [rows, setRows] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Department | null>(null);
  
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const level = levelFor(me);
  const canCreate = level >= 3;
  const canUpdate = level >= 2;
  const canDelete = !!me?.is_staff || level >= 4;

  const loadGrid = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listItems<Department>(BASE, { pageSize: 500 });
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
      loadGrid();
    });
  }, [loadGrid]);

  const clearForm = () => {
    setSelected(null);
    setCode("");
    setName("");
    setNotice(null);
  };

  const selectRow = (d: Department) => {
    setSelected(d);
    setCode(d.dept_code);
    setName(d.dept_name);
    setNotice(null);
  };

  const validate = (): string | null => {
    if (!code.trim()) return "Please Enter Department Code";
    if (!name.trim()) return "Please Enter Department Name";
    return null;
  };

  const payload = () => ({
    dept_code: code.trim(),
    dept_name: name.trim(),
  });

  const onSave = async () => {
    const err = validate();
    if (err) {
      alert(err);
      return;
    }
    setNotice(null);
    try {
      const res = await createItem(BASE, payload());
      if (!res.ok) { alert(res.status === 403 ? "You do not have permission for this action." : apiMsg(res.data, "Failed to save.")); return; }
      alert("Record successfully saved.");
      clearForm();
      loadGrid();
    } catch (e: any) {
      if (e instanceof ApiError && e.data) {
        const msgs = Object.values(e.data).flat();
        alert(msgs[0] || "Failed to save.");
      } else {
        alert("An error occurred");
      }
    }
  };

  const onUpdate = async () => {
    if (!selected) return;
    const err = validate();
    if (err) {
      alert(err);
      return;
    }
    setNotice(null);
    try {
      const res = await updateItem(BASE, selected.id, payload());
      if (!res.ok) { alert(res.status === 403 ? "You do not have permission for this action." : apiMsg(res.data, "Failed to update.")); return; }
      alert("Record Updated Successfully.");
      clearForm();
      loadGrid();
    } catch (e: any) {
      if (e instanceof ApiError && e.data) {
        const msgs = Object.values(e.data).flat();
        alert(msgs[0] || "Failed to update.");
      } else {
        alert("An error occurred");
      }
    }
  };

  const onDelete = async () => {
    if (!selected) return;
    if (!confirm("Are you sure you want to delete this record?")) return;
    try {
      const res = await deleteItem(BASE, selected.id);
      if (!res.ok) { alert(res.status === 403 ? "Only administrators can delete a record." : apiMsg(res.data, "Cannot delete.")); return; }
      alert("Record Deleted successfully");
      clearForm();
      loadGrid();
    } catch (e: any) {
      if (e instanceof ApiError && e.data) {
        alert(e.data.detail || Object.values(e.data).flat()[0] || "Cannot delete.");
      } else {
        alert("An error occurred.");
      }
    }
  };

  if (!authChecked) return null;

  return (
    <div className="lg-panel dm-skin">
      <div className="lg-panel-head">
        <h2 className="dm-title">
          DEPARTMENT MASTER
        </h2>
        <div className="dm-head-actions">
          <Link href="/" className="lg-btn lg-btn-red dm-close">
            Close
          </Link>
        </div>
      </div>

      <div className="lg-panel-body">
        {level === 0 ? (
          <div className="dm-denied">
            You do not have permission to access Department Master.
          </div>
        ) : (
          <div className="dm-split">
            <div className="dm-form">
              {notice && <div className="dm-notice">{notice}</div>}
              
              <div className="dm-row">
                <label className="lg-label dm-label">
                  Department Code <span className="lg-req">*</span>
                </label>
                <div className="dm-field">
                  <input
                    type="text"
                    maxLength={3}
                    className="lg-control dm-short"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    disabled={!!selected}
                  />
                </div>
              </div>

              <div className="dm-row">
                <label className="lg-label dm-label">
                  Department Name <span className="lg-req">*</span>
                </label>
                <div className="dm-field">
                  <input
                    type="text"
                    maxLength={50}
                    className="lg-control"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div className="lg-btns center">
                <button
                  className="lg-btn lg-btn-primary"
                  onClick={() => clearForm()}
                >
                  New
                </button>
                {!selected ? (
                  <button
                    className="lg-btn lg-btn-green"
                    onClick={onSave}
                    disabled={!canCreate || !code.trim() || !name.trim()}
                  >
                    Save
                  </button>
                ) : (
                  <button
                    className="lg-btn lg-btn-green"
                    onClick={onUpdate}
                    disabled={!canUpdate || !code.trim() || !name.trim()}
                  >
                    Update
                  </button>
                )}
                <button
                  className="lg-btn lg-btn-red"
                  onClick={onDelete}
                  disabled={!selected || !canDelete}
                >
                  Delete
                </button>
                <button
                  className="lg-btn"
                  onClick={() => clearForm()}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="dm-grid">
              <DataTable<Department>
                columns={DT_COLS}
                rows={rows}
                rowKey={(r) => r.id}
                onRowClick={selectRow}
                selectedKey={selected?.id}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
