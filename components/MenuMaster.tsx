"use client";

/**
 * Menu Master — faithful 1:1 replica of legacy menuMaster.aspx.
 *
 * Exact validation messages, buttons, and grid columns.
 */

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";
import { listItems, createItem } from "@/lib/api/crud";
import DataTable, { type DTColumn } from "@/components/DataTable";

const BASE = "/api/auth/menus";
const MENU = "Menu Master";

interface MenuItemRow {
  id: number;
  name: string;
  parent: number | null;
  click_evt: string;
  sequence: string;
  description?: string;
}

export default function MenuMaster() {
  const [me, setMe] = useState<Me | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [rows, setRows] = useState<MenuItemRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Form fields
  const [menuName, setMenuName] = useState("");
  const [parentName, setParentName] = useState("Select");
  const [pageName, setPageName] = useState("");

  useEffect(() => { getMe().then((m) => { setMe(m); setAuthChecked(true); }); }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listItems<MenuItemRow>(BASE, { pageSize: 1000 });
      setRows(res.results);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (authChecked && me) load(); }, [authChecked, me, load]);

  // Exact legacy menus_val()
  const reqValidation = (): string | null => {
    if (!menuName.trim()) {
      return "Please Type Menu Name";
    }
    if (parentName === "Select") {
      return "Please Select Parent From List";
    }
    if (!pageName.trim()) {
      return "Please Enter Page Name in .aspx";
    }
    if (!/\.aspx/.test(pageName.trim())) {
      return " Please Enter Page Name in .aspx... !!!";
    }
    return null;
  };

  const payload = () => ({
    name: menuName.trim(),
    parent: parentName === "0" ? null : parseInt(parentName, 10),
    click_evt: pageName.trim().replace(/ /g, ""),
  });

  const onSave = async () => {
    const err = reqValidation();
    if (err) {
      alert(err);
      return;
    }
    
    // Front-end duplicate check, mirroring legacy
    if (rows.some((r) => r.name.toLowerCase() === menuName.trim().toLowerCase())) {
      alert(" Menu Name Already Exists... !!!");
      return;
    }

    const res = await createItem<MenuItemRow>(BASE, payload());
    if (res.ok) {
      alert(" Record  Added Successfully... !!!");
      setMenuName("");
      setParentName("Select");
      setPageName("");
      load();
    } else if (res.status === 400) {
      const data = res.data as any;
      if (data.name && Array.isArray(data.name)) alert(data.name[0]);
      else if (data.parent && Array.isArray(data.parent)) alert(data.parent[0]);
      else if (data.click_evt && Array.isArray(data.click_evt)) alert(data.click_evt[0]);
      else if (typeof data.detail === "string") alert(data.detail);
      else alert("Validation failed.");
    } else if (res.status === 403) {
      alert("You do not have permission for this action.");
    } else {
      alert("Record adding failed...");
    }
  };

  const alphabetOnly = (val: string) => val.replace(/[^A-Za-z ]/g, "");

  // Parent Dropdown list where parent is null
  const parentOptions = rows.filter((r) => r.parent === null).sort((a, b) => a.name.localeCompare(b.name));

  // The grid expects Sr No., Menu Name, Parent, Page Name, Description, sequence.
  // Legacy description column is just the menu name again during insert.
  const DT_COLS: DTColumn<MenuItemRow>[] = [
    { key: "name", label: "MENU NAME", value: (r) => r.name || "" },
    { key: "parent", label: "PARENT", value: (r) => r.parent ? (rows.find(p => p.id === r.parent)?.name || String(r.parent)) : "" },
    { key: "click_evt", label: "PAGE NAME", value: (r) => r.click_evt || "" },
    { key: "description", label: "DESCRIPTION", value: (r) => r.description || r.name },
    { key: "sequence", label: "SEQUENCE", value: (r) => r.sequence || "" },
  ];

  if (authChecked && !me) {
    return (
      <div className="lg-panel">
        <div className="lg-panel-head">Menu Master</div>
        <div style={{ padding: 16 }}>
          🔐 Sign in required. <Link href="/login">Go to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-fluid" style={{ maxWidth: "99%", margin: "0 auto", padding: "20px" }}>
      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "8.33%" }}></div>
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
            MENUS
          </div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); window.open("/html/MenuMaster.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }} style={{ color: "#fff", fontSize: "10px" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>
      </div>
      
      <div className="container-fluid" style={{ background: "#f3f1fe", borderRadius: "10px", border: "1px solid white", padding: "15px" }}>
        <br />
        <div className="row" style={{ display: "flex", alignItems: "flex-start", marginBottom: "15px", flexWrap: "wrap" }}>
          <div style={{ flex: "0 0 16.66%" }}></div>
          <div style={{ flex: "0 0 16.66%", textAlign: "left", paddingRight: "15px" }}>
            <b>Enter Menu Name</b><span style={{ color: "red" }}> *</span>
            <input
              className="form-control text_box"
              value={menuName}
              onChange={(e) => setMenuName(alphabetOnly(e.target.value))}
              style={{ width: "80%", marginTop: "7px" }}
            />
          </div>
          <div style={{ flex: "0 0 16.66%", textAlign: "left", paddingRight: "15px" }}>
            <b>Select Parent Name</b><span style={{ color: "red" }}> *</span>
            <select
              className="form-control"
              value={parentName}
              onChange={(e) => setParentName(e.target.value)}
              style={{ width: "80%", marginTop: "7px" }}
            >
              <option value="Select">Select</option>
              <option value="0"> </option>
              {parentOptions.map((p) => (
                <option key={p.id} value={String(p.id)}>{p.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: "0 0 16.66%", textAlign: "left" }}>
            <b>Enter Page Name</b><span style={{ color: "red" }}> *</span>
            <input
              className="form-control text_box"
              value={pageName}
              onChange={(e) => setPageName(e.target.value)}
              style={{ width: "80%", marginTop: "7px", marginBottom: "5px" }}
            />
            <b style={{ color: "#f00", textAlign: "left", fontSize: 12 }}>Note :</b> <span style={{ fontSize: 12 }}>Enter file name in .aspx</span>
          </div>
        </div>
        
        <div className="row" style={{ display: "flex", justifyContent: "center", marginBottom: "20px" }}>
          <button className="btn btn-primary" onClick={onSave} style={{ backgroundColor: "#428bca", borderColor: "#357ebd", color: "#fff", padding: "6px 12px", borderRadius: "4px" }}>Save</button>
        </div>
        <br />
        
        <div style={{ overflowX: "auto", height: "500px" }} className="table">
          {loading ? (
            <p>Loading…</p>
          ) : (
            <DataTable<MenuItemRow>
              columns={DT_COLS}
              rows={rows}
              rowKey={(r) => r.id}
            />
          )}
        </div>
      </div>
    </div>
  );
}
