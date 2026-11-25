"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getJSONStrict as apiGet, mk as apiPost, putJSON as apiPut, responseMessage } from "@/lib/api/legacy-fetch";
import Link from "next/link";
import { getMe, type Me } from "@/lib/api/auth";

const MENU = "Create Role";
// legacy getaccess(): I -> unauthorised, R -> Submit hidden; D is the highest level.
function levelFor(me: Me | null): number {
  if (!me) return 0;
  if (me.is_staff) return 4;
  const map: Record<string, number> = { R: 1, U: 2, C: 3, D: 4 };
  return me.permissions.filter((p) => p.menu === MENU && !p.needs_review)
    .reduce((mx, p) => Math.max(mx, map[p.permission] ?? 0), 0);
}

interface MenuItem {
  id: number;
  name: string;
  description?: string;
  legacy_menu_id?: number | null;
  click_evt: string | null;
}

interface RolePermission {
  menu_id: number;
  permission: "I" | "R" | "U" | "C" | "D";
}

interface Role {
  id: number;
  name: string;
  approval_level: string;
  permissions: RolePermission[];
}

export default function ManageRole() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [menus, setMenus] = useState<MenuItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);

  const [selectedRole, setSelectedRole] = useState<string>("Add New Role");
  const [roleName, setRoleName] = useState("");
  const [approvalLevel, setApprovalLevel] = useState("");
  const [roleSearch, setRoleSearch] = useState("");
  const [menuSearch, setMenuSearch] = useState("");

  // Local state for grid view permissions (menu_id -> permission)
  // legacy GridView2: four independent check boxes per menu row (saved with priority D > C > U > R)
  type Chk = { D?: boolean; C?: boolean; U?: boolean; R?: boolean };
  const [rolePermissions, setRolePermissions] = useState<Record<number, Chk>>({});

  useEffect(() => {
    getMe().then((m) => { setMe(m); setMeLoaded(true); }).catch(() => setMeLoaded(true));
    fetchInitialData();
  }, []);

  const level = levelFor(me);
  useEffect(() => {
    // legacy: access level 'I' (no row for this menu) -> unauthorised_access.aspx
    if (meLoaded && me && level === 0) router.push("/Home");
  }, [meLoaded, me, level, router]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [menusRes, rolesRes] = await Promise.all([
        apiGet("/api/auth/menus/?page_size=all"),
        apiGet("/api/auth/roles/?page_size=all")
      ]);
      function unwrapArr(r: unknown): never[] | unknown[] {
        if (Array.isArray(r)) return r;
        if (r && typeof r === "object" && Array.isArray((r as { results?: unknown }).results))
          return (r as { results: unknown[] }).results;
        return [];
      }
      // legacy: select Description from menus where click_evt is not null (order by id)
      const ml = (unwrapArr(menusRes) as MenuItem[]).filter((m) => m.click_evt);
      ml.sort((a, b) => (a.legacy_menu_id ?? 1e9) - (b.legacy_menu_id ?? 1e9) || a.id - b.id);
      setMenus(ml);
      setRoles(unwrapArr(rolesRes) as Role[]);
    } catch (err: any) {
      alert(err?.message || "Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  const handleRoleSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedRole(val);

    if (val === "Add New Role") {
      // legacy: Role Name box shows the dropdown text; grid reloaded with nothing ticked
      setRoleName(val);
      setRolePermissions({});
    } else {
      const role = roles.find(r => r.id.toString() === val);
      if (role) {
        setRoleName(role.name);
        // legacy: approval level is only replaced when the role has one
        if (role.approval_level) setApprovalLevel(role.approval_level);
        const perms: Record<number, Chk> = {};
        role.permissions?.forEach(p => {
          if (p.permission !== "I") perms[p.menu_id] = { [p.permission]: true };
        });
        setRolePermissions(perms);
      }
    }
  };

  const handlePermissionChange = (menuId: number, perm: "R" | "U" | "C" | "D", checked: boolean) => {
    setRolePermissions(prev => ({ ...prev, [menuId]: { ...prev[menuId], [perm]: checked } }));
  };

  const filteredMenus = menus.filter((m) => {
    if (!menuSearch.trim()) return true;
    const term = menuSearch.trim().toLowerCase();
    const name = (m.name || "").toLowerCase();
    const desc = (m.description || "").toLowerCase();
    return name.includes(term) || desc.includes(term);
  });

  const handleHeaderCheckbox = (perm: "R" | "U" | "C" | "D", checked: boolean) => {
    const newPerms = { ...rolePermissions };
    const targetMenus = menuSearch.trim() ? filteredMenus : menus;
    targetMenus.forEach(m => { newPerms[m.id] = { ...newPerms[m.id], [perm]: checked }; });
    setRolePermissions(newPerms);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName) {
      alert("Please Enter Role Name...!!!");
      return;
    }

    // Build permissions array
    // legacy btmSubmit_Click: Delete, else Create, else Update, else Read, else I - for every menu row
    const permsPayload = menus.map(m => {
      const c = rolePermissions[m.id] || {};
      return { menu_id: m.id, permission: c.D ? "D" : c.C ? "C" : c.U ? "U" : c.R ? "R" : "I" };
    });

    const payload = {
      name: roleName,
      approval_level: approvalLevel,
      permissions: permsPayload
    };

    try {
      setLoading(true);
      const res = selectedRole === "Add New Role"
        ? await apiPost("/api/auth/roles/", payload)
        : await apiPut(`/api/auth/roles/${selectedRole}/`, payload);
      if (!res.ok) {
        alert(await responseMessage(res, "Record Adding Failed..."));
        return;
      }
      alert("Record Adding Successfull...");
      // legacy page_refresh(): list reloaded, "Add New Role" selected, grid cleared (typed texts stay)
      fetchInitialData();
      setSelectedRole("Add New Role");
      setRolePermissions({});
    } catch (err) {
      alert("Record Adding Failed...");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid" style={{ maxWidth: "99%", margin: "0 auto", padding: "20px" }}>
      {loading && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(204, 204, 204, 0.7)", zIndex: 9999 }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>Loading...</div>
        </div>
      )}

      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "8.33%" }}></div>
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
            ROLE ACCESS FORM
          </div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); window.open("/html/Manage_Role.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }} style={{ color: "#fff", fontSize: "10px" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>

        <div className="panel-body" style={{ padding: "15px" }}>
          <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "15px", marginBottom: "20px", marginTop: "20px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "15px" }}>
              <div style={{ flex: "0 0 16.66%" }}>
                <b>Update Role :</b><span style={{ color: "red" }}> *</span>
                <input
                  type="text"
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  placeholder="Search Role..."
                  className="form-control"
                  style={{ width: "100%", marginTop: "7px", marginBottom: "5px", padding: "4px 8px", fontSize: "12px", border: "1px solid #ccc", borderRadius: "4px" }}
                />
                <select value={selectedRole} onChange={handleRoleSelect} className="form-control" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }}>
                  <option value="Add New Role">Add New Role</option>
                  {roles
                    .filter((r) => !roleSearch.trim() || r.id.toString() === selectedRole || (r.name || "").toLowerCase().includes(roleSearch.trim().toLowerCase()))
                    .map((r) => (
                      <option key={r.id} value={r.id.toString()}>{r.name}</option>
                    ))}
                </select>
              </div>
              <div style={{ flex: "0 0 16.66%" }}>
                <b>Role Name :</b><span style={{ color: "red" }}> *</span>
                <input type="text" value={roleName} onChange={e => setRoleName(e.target.value)} className="form-control" style={{ width: "100%", marginTop: "7px", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }} />
              </div>
              <div style={{ flex: "0 0 16.66%" }}>
                <b>Approval Levels :</b><span style={{ color: "red" }}> *</span>
                <input type="text" value={approvalLevel} onChange={e => setApprovalLevel(e.target.value)} className="form-control" style={{ width: "100%", marginTop: "7px", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }} />
              </div>
            </div>
          </div>

          <div style={{ textAlign: "center" }}>
            <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "15px", marginLeft: "100px", marginRight: "100px" }}>
              <div style={{ width: "70%", margin: "0 auto 12px auto", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: "1 1 300px", maxWidth: "380px" }}>
                  <input
                    type="text"
                    value={menuSearch}
                    onChange={(e) => setMenuSearch(e.target.value)}
                    placeholder="Search Menu Name..."
                    className="form-control"
                    style={{ width: "100%", padding: "6px 12px", border: "1px solid #3b82f6", borderRadius: "4px", fontSize: "13px", backgroundColor: "#fff" }}
                  />
                  {menuSearch && (
                    <button
                      type="button"
                      onClick={() => setMenuSearch("")}
                      className="btn btn-default btn-sm"
                      style={{ padding: "5px 10px", fontSize: "11px", cursor: "pointer", border: "1px solid #ccc", backgroundColor: "#fff" }}
                      title="Clear search"
                    >
                      ✕ Clear
                    </button>
                  )}
                </div>
                <div style={{ fontSize: "12px", color: "#555" }}>
                  Showing <b>{filteredMenus.length}</b> of <b>{menus.length}</b> menus
                </div>
              </div>
              <div style={{ maxHeight: "500px", overflowY: "auto" }}>
                <table style={{ width: "70%", margin: "0 auto", borderCollapse: "collapse", backgroundColor: "#fff" }} className="table">
                  <thead>
                    <tr style={{ backgroundColor: "#006699", color: "white", textTransform: "uppercase", fontWeight: "bold" }}>
                      <th style={{ padding: "8px", border: "1px solid #ddd", width: "250px", textAlign: "left" }}>Menu Name</th>
                      <th style={{ padding: "8px", border: "1px solid #ddd", width: "80px", textAlign: "center" }}>
                        <label style={{ fontWeight: "normal", margin: 0 }}><input type="checkbox" onChange={(e) => handleHeaderCheckbox("D", e.target.checked)} />Delete</label>
                      </th>
                      <th style={{ padding: "8px", border: "1px solid #ddd", width: "80px", textAlign: "center" }}>
                        <label style={{ fontWeight: "normal", margin: 0 }}><input type="checkbox" onChange={(e) => handleHeaderCheckbox("C", e.target.checked)} />Create</label>
                      </th>
                      <th style={{ padding: "8px", border: "1px solid #ddd", width: "80px", textAlign: "center" }}>
                        <label style={{ fontWeight: "normal", margin: 0 }}><input type="checkbox" onChange={(e) => handleHeaderCheckbox("U", e.target.checked)} />Update</label>
                      </th>
                      <th style={{ padding: "8px", border: "1px solid #ddd", width: "80px", textAlign: "center" }}>
                        <label style={{ fontWeight: "normal", margin: 0 }}><input type="checkbox" onChange={(e) => handleHeaderCheckbox("R", e.target.checked)} />Read</label>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMenus.map((m, idx) => {
                      const cur = rolePermissions[m.id] || {};
                      return (
                        <tr key={m.id} style={{ backgroundColor: idx % 2 === 0 ? "#ffffff" : "#f9f9f9", color: "#000066" }}>
                          <td style={{ padding: "8px", border: "1px solid #ddd", textAlign: "left" }}>{m.description || m.name}</td>
                          <td style={{ padding: "8px", border: "1px solid #ddd", textAlign: "center" }}>
                            <input type="checkbox" checked={!!cur.D} onChange={(e) => handlePermissionChange(m.id, "D", e.target.checked)} />
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #ddd", textAlign: "center" }}>
                            <input type="checkbox" checked={!!cur.C} onChange={(e) => handlePermissionChange(m.id, "C", e.target.checked)} />
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #ddd", textAlign: "center" }}>
                            <input type="checkbox" checked={!!cur.U} onChange={(e) => handlePermissionChange(m.id, "U", e.target.checked)} />
                          </td>
                          <td style={{ padding: "8px", border: "1px solid #ddd", textAlign: "center" }}>
                            <input type="checkbox" checked={!!cur.R} onChange={(e) => handlePermissionChange(m.id, "R", e.target.checked)} />
                          </td>
                        </tr>
                      );
                    })}
                    {filteredMenus.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ padding: "16px", textAlign: "center", color: "#888" }}>
                          No menus found matching &quot;{menuSearch}&quot;
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div style={{ textAlign: "center", marginTop: "20px" }}>
            {level >= 2 && <button onClick={handleSubmit} className="btn btn-primary" style={{ backgroundColor: "#428bca", borderColor: "#357ebd", color: "#fff", padding: "6px 12px", borderRadius: "4px", marginRight: "10px", cursor: "pointer" }}>Submit</button>}
            <button onClick={() => router.push("/Home")} className="btn btn-danger" style={{ backgroundColor: "#d9534f", borderColor: "#d43f3a", color: "#fff", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}> Close </button>
          </div>
        </div>
      </div>
    </div>
  );
}
