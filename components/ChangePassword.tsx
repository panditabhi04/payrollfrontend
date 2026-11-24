"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { mk as apiPost, responseMessage } from "@/lib/api/legacy-fetch";
import Link from "next/link";

export default function ChangePassword() {
  const router = useRouter();
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      alert("New Password & Confirm New Password do not match.");
      return;
    }

    if (newPassword === oldPassword) {
      alert("Old Password & New Password cannot be same.");
      return;
    }

    if (oldPassword.length === 0) {
      alert("Please enter Old Password.");
      return;
    }

    if (newPassword.length <= 8 || confirmPassword.length <= 8) {
      alert("Please enter new password more than 8 bytes.");
      return;
    }

    try {
      setLoading(true);
      const res = await apiPost("/api/auth/me/change-password/", {
        old_password: oldPassword,
        new_password: newPassword
      });
      if (!res.ok) {
        alert(await responseMessage(res, "Failed to change password."));
        return;
      }
      alert("Password changed successfully.");
      router.push("/login");
    } catch (err: any) {
      if (err.data && err.data.detail) {
        alert(err.data.detail);
      } else {
        alert("Failed to change password.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setOldPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleClose = () => {
    router.push("/");
  };

  return (
    <div className="container-fluid" style={{ maxWidth: "99%", margin: "0 auto", padding: "20px" }}>
      {loading && (
        <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(204, 204, 204, 0.7)", zIndex: 9999 }}>
          <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)" }}>Processing...</div>
        </div>
      )}

      <div className="panel panel-primary" style={{ border: "1px solid #428bca", borderRadius: "4px" }}>
        <div className="panel-heading" style={{ backgroundColor: "#428bca", color: "#fff", padding: "10px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ width: "8.33%" }}></div>
          <div style={{ width: "75%", textAlign: "center", fontSize: "small", fontWeight: "bold", textTransform: "uppercase" }}>
            CHANGE PASSWORD
          </div>
          <div style={{ width: "16.66%", textAlign: "right" }}>
            <Link href="#" onClick={(e) => { e.preventDefault(); window.open("/html/Change_password.html", "popUpWindow", "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No"); }} style={{ color: "#fff", fontSize: "10px" }}>
              <img src="/Images/help_ico.png" alt="Help" width="20" height="20" title="Help" />
            </Link>
          </div>
        </div>

        <div className="panel-body" style={{ padding: "15px" }}>
          <div style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: "10px", padding: "15px", marginBottom: "20px", marginTop: "20px" }}>
            
            <div className="row" style={{ display: "flex", alignItems: "center", marginBottom: "15px" }}>
              <div style={{ flex: "0 0 16.66%" }}></div>
              <div style={{ flex: "0 0 25%", textAlign: "right", paddingRight: "15px" }}>
                <b>Old Password :</b>
              </div>
              <div style={{ flex: "0 0 25%" }}>
                <input 
                  type="password" 
                  value={oldPassword} 
                  onChange={e => setOldPassword(e.target.value)} 
                  className="form-control" 
                  style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px", fontWeight: "bold" }} 
                />
              </div>
              <div style={{ flex: "0 0 16.66%" }}></div>
            </div>
            
            <div className="row" style={{ display: "flex", alignItems: "center", marginBottom: "15px" }}>
              <div style={{ flex: "0 0 16.66%" }}></div>
              <div style={{ flex: "0 0 25%", textAlign: "right", paddingRight: "15px" }}>
                <b>New Password :</b>
              </div>
              <div style={{ flex: "0 0 25%" }}>
                <input 
                  type="password" 
                  value={newPassword} 
                  onChange={e => setNewPassword(e.target.value)} 
                  className="form-control" 
                  style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px", fontWeight: "bold" }} 
                />
              </div>
              <div style={{ flex: "0 0 16.66%" }}></div>
            </div>

            <div className="row" style={{ display: "flex", alignItems: "center", marginBottom: "15px" }}>
              <div style={{ flex: "0 0 8.33%" }}></div>
              <div style={{ flex: "0 0 33.33%", textAlign: "right", paddingRight: "15px" }}>
                <b>Confirm New Password :</b>
              </div>
              <div style={{ flex: "0 0 25%" }}>
                <input 
                  type="password" 
                  value={confirmPassword} 
                  onChange={e => setConfirmPassword(e.target.value)} 
                  className="form-control" 
                  style={{ width: "100%", padding: "6px 12px", border: "1px solid #ccc", borderRadius: "4px", fontWeight: "bold" }} 
                />
              </div>
              <div style={{ flex: "0 0 16.66%" }}></div>
            </div>

          </div>

          <div style={{ textAlign: "center", marginTop: "40px", display: "flex", justifyContent: "center", gap: "10px" }}>
            <button onClick={handleSave} className="btn btn-primary" style={{ backgroundColor: "#428bca", borderColor: "#357ebd", color: "#fff", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>Save</button>
            <button onClick={handleClear} className="btn btn-primary" style={{ backgroundColor: "#428bca", borderColor: "#357ebd", color: "#fff", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>Clear</button>
            <button onClick={handleClose} className="btn btn-danger" style={{ backgroundColor: "#d9534f", borderColor: "#d43f3a", color: "#fff", padding: "6px 12px", borderRadius: "4px", cursor: "pointer" }}>Close</button>
          </div>
        </div>
      </div>
    </div>
  );
}
