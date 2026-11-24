"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { getJSON as apiGet, putJSON as apiPut } from "@/lib/api/legacy-fetch";
import Link from "next/link";
import PasswordInput from "./PasswordInput";

interface Role {
  id: number;
  name: string;
}

interface User {
  id: number;
  username: string;
  legacy_login_id: string;
  login_name: string;
  is_active: boolean;
  role_name?: string;
  current_role?: string;
}

// DRF list endpoints return paginated {count, results} — accept both shapes.
function asArray<T>(res: T[] | { results?: T[] } | null | undefined): T[] {
  if (Array.isArray(res)) return res;
  if (res && Array.isArray((res as { results?: T[] }).results)) return (res as { results: T[] }).results;
  return [];
}

export default function UserManagement() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<Role[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [userSearch, setUserSearch] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [isActive, setIsActive] = useState<boolean>(true);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [rolesRes, usersRes] = await Promise.all([
        apiGet("/api/auth/roles/?page_size=all"),
        apiGet("/api/auth/users/?page_size=all")
      ]);
      // legacy: SELECT DISTINCT role_name FROM pay_role_master (one entry per role name)
      const seen = new Set<string>();
      setRoles(asArray<Role>(rolesRes as Role[] | { results?: Role[] }).filter((r) => {
        if (seen.has(r.name)) return false;
        seen.add(r.name);
        return true;
      }));
      setUsers(asArray<User>(usersRes as User[] | { results?: User[] }));
    } catch (err) {
      alert("Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedUserId(val);
    
    if (val) {
      const user = users.find(u => u.id.toString() === val);
      if (user) {
        setSelectedRole(user.current_role || user.role_name || "");
        setIsActive(user.is_active);
      }
    } else {
      setSelectedRole("");
      setIsActive(true);
    }
    setPassword("");
    setConfirmPassword("");
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) {
      return;
    }

    if ((!password || !confirmPassword) && (password.length === 0 || confirmPassword.length === 0)) {
      alert("Please Fill Details Of all Fields...!!!");
      return;
    }

    if (password !== confirmPassword) {
      alert("New Password & Confirm New Password do not match.");
      return;
    }

    if (password.length <= 8 || confirmPassword.length <= 8) {
      alert("Please enter new password more than 8 bytes.");
      return;
    }

    if (!selectedRole || selectedRole === "0") {
      alert("Please Select Any Role!!!");
      return;
    }

    const payload = {
      password,
      confirm_password: confirmPassword,
      role_name: selectedRole,
      is_active: isActive
    };

    try {
      setLoading(true);
      const res = await apiPut(`/api/auth/users/${selectedUserId}/`, payload);
      if (!res.ok) {
        let msg = "Record Updating Failed...";
        try {
          const data = await res.json();
          if (data && typeof data === "object") {
            const firstError = Object.values(data)[0];
            msg = Array.isArray(firstError) ? String(firstError[0]) : JSON.stringify(data);
          } else if (typeof data === "string" && data) {
            msg = data;
          }
        } catch { /* keep default message */ }
        alert(msg);
        return;
      }
      alert("Record Updated Successfully...!!!");
      fetchInitialData();
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      alert("Record Updating Failed...");
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
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold" }}>
            USER MANAGEMENT FORM
          </div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); window.open("/html/Usermgm.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }} style={{ color: "#fff", fontSize: "10px" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>

        <div className="panel-body" style={{ padding: "15px" }}>
          <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "15px", marginBottom: "20px", marginTop: "20px" }}>
            
            <div className="row" style={{ display: "flex", alignItems: "center", marginBottom: "15px" }}>
              <div style={{ flex: "0 0 25%" }}></div>
              <div style={{ flex: "0 0 16.66%", textAlign: "right", paddingRight: "15px" }}>
                <b>Login Id :</b>
              </div>
              <div style={{ flex: "0 0 25%" }}>
                <input type="text" value={userSearch} onChange={e => setUserSearch(e.target.value)} placeholder="Search by name or Login Id" className="form-control" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px", marginBottom: "6px" }} />
                <select value={selectedUserId} onChange={handleUserSelect} className="form-control" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }}>
                  <option value="">--Select Login Id--</option>
                  {users.filter(u => !userSearch.trim() || u.id.toString() === selectedUserId || (u.login_name || "").toLowerCase().includes(userSearch.trim().toLowerCase())).map(u => (
                    <option key={u.id} value={u.id.toString()}>{u.login_name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="row" style={{ display: "flex", alignItems: "center", marginBottom: "15px" }}>
              <div style={{ flex: "0 0 25%" }}></div>
              <div style={{ flex: "0 0 16.66%", textAlign: "right", paddingRight: "15px" }}>
                <b>Password :</b>
              </div>
              <div style={{ flex: "0 0 25%" }}>
                <PasswordInput
                  value={password}
                  onChange={e => setPassword(e.target.value)} 
                  className="form-control" 
                  placeholder="Please Enter Password"
                  style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }} 
                  onCopy={e => e.preventDefault()}
                  onPaste={e => e.preventDefault()}
                  onCut={e => e.preventDefault()}
                />
              </div>
            </div>

            <div className="row" style={{ display: "flex", alignItems: "center", marginBottom: "15px" }}>
              <div style={{ flex: "0 0 25%" }}></div>
              <div style={{ flex: "0 0 16.66%", textAlign: "right", paddingRight: "15px" }}>
                <b>Confirm Password :</b>
              </div>
              <div style={{ flex: "0 0 25%" }}>
                <PasswordInput
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} 
                  className="form-control" 
                  placeholder="Please Enter Confirm Password"
                  style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }} 
                  onCopy={e => e.preventDefault()}
                  onPaste={e => e.preventDefault()}
                  onCut={e => e.preventDefault()}
                />
              </div>
            </div>

            <div className="row" style={{ display: "flex", alignItems: "center", marginBottom: "15px" }}>
              <div style={{ flex: "0 0 25%" }}></div>
              <div style={{ flex: "0 0 16.66%", textAlign: "right", paddingRight: "15px" }}>
                <b>Select Role :</b>
              </div>
              <div style={{ flex: "0 0 25%" }}>
                <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)} className="form-control" style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px" }}>
                  <option value="0">--Select Role--</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="row" style={{ display: "flex", alignItems: "center", marginBottom: "15px" }}>
              <div style={{ flex: "0 0 25%" }}></div>
              <div style={{ flex: "0 0 16.66%", textAlign: "right", paddingRight: "15px" }}>
                <b>Active Flag :</b>
              </div>
              <div style={{ flex: "0 0 8.33%", paddingLeft: "15px" }}>
                <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
              </div>
            </div>

            <div style={{ textAlign: "center", marginTop: "40px" }}>
              <button onClick={handleUpdate} className="btn btn-primary" style={{ backgroundColor: "#428bca", borderColor: "#357ebd", color: "#fff", padding: "6px 12px", borderRadius: "4px", marginRight: "10px", cursor: "pointer" }}>Update</button>
              <button onClick={() => router.push("/Home")} className="btn btn-danger" style={{ backgroundColor: "#d9534f", borderColor: "#d43f3a", color: "#fff", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>Close</button>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
