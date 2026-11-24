"use client";
/* =====================================================================
 * BACKUP AND DOWNLOAD — 1:1 port of Backup_Page.aspx.
 * Header "BACKUP AND DOWNLOAD" (single heading),
 * backup form (User Id / Password / Backup / Close), password-generator row
 * (Employee Login Id / Password /
 * Generate Password), beige "Password Reset" tab (client dropdown + grid
 * with per-row New/Conform password + Reset Password). Exact validation
 * alert strings. Dates: none on this page.
 * Backup: User Id + Password (MySQL login) -> server runs mysqldump and the zip is downloaded
 * ("Please Enter User Id !!!" / "Please Enter Password !!!"). The password is never stored/logged.
 * Backend: /api/transactions/backup-portal/* (legacy DB). RBAC menu
 * "System Backup": Backup button only for full admins (legacy hides
 * btn_backup for R/U/C); I-level users are denied like unauthorised_access.
 * ===================================================================== */
import React, { useEffect, useRef, useState } from "react";
import { getJSON, mk } from "@/lib/api/legacy-fetch";
import { getMe, type Me } from "@/lib/api/auth";
import { levelForMenu } from "@/components/formkit";

const BASE = "/api/transactions/backup-portal";
const SEL = "Select";

type Row = Record<string, any>;

function Msg({ text, ok }: { text: string; ok: boolean }) {
  if (!text) return null;
  return (
    <div style={{ margin: "0 0 10px", padding: "6px 12px", borderRadius: 4, fontSize: 12,
      color: ok ? "#2e7d32" : "#c62828", background: ok ? "#e8f5e9" : "#ffebee",
      border: `1px solid ${ok ? "#a5d6a7" : "#ef9a9a"}` }}>{text}</div>
  );
}
function val(r: Row, name: string): any {
  if (r[name] !== undefined && r[name] !== null) return r[name];
  const want = name.toLowerCase();
  for (const k of Object.keys(r)) {
    if (k.toLowerCase() === want) return (r as Row)[k];
  }
  return "";
}
async function errText(r: Response, fallback: string) {
  const e = await r.json().catch(() => ({} as any));
  return (e as any)?.detail || (e as any)?.non_field_errors?.[0] || (Array.isArray(e) ? (e as any)[0] : fallback);
}
/* AllowAlphabet_address(): letters + digits + space & ' " , - . / : ; = \  (plus _ and @, which real MySQL user ids need) */
function alphaKey(e: React.KeyboardEvent) {
  const k = e.key;
  if (k.length !== 1) return;
  if (/^[A-Za-z0-9 &'",\-./:;=?\\_@]$/.test(k)) return;
  e.preventDefault();
}

export default function BackupPortal() {
  const [me, setMe] = useState<Me | null>(null);
  const [userId, setUserId] = useState("");
  const [dbPass, setDbPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [genBusy, setGenBusy] = useState(false);
  const empRef = useRef<HTMLInputElement>(null);
  const pwRef = useRef<HTMLInputElement>(null);
  const [emp, setEmp] = useState("");
  const [npw, setNpw] = useState("");
  const [clients, setClients] = useState<{ v: string; t: string }[]>([{ v: SEL, t: SEL }]);
  const [client, setClient] = useState(SEL);
  const [rows, setRows] = useState<Row[]>([]);
  const [edits, setEdits] = useState<Record<number, { n: string; c: string }>>({});
  const [hidtab, setHidtab] = useState("menu0");
  const [msg, setMsg] = useState({ text: "", ok: true });
  const [denied, setDenied] = useState(false);
  const show = (text: string, ok = true) => setMsg({ text, ok });

  const level = levelForMenu(me?.permissions, "System Backup", !!me?.is_staff);
  const canBackup = level >= 4; // legacy: btn_backup hidden for R/U/C; I redirected

  useEffect(() => {
    getMe().then((m) => {
      setMe(m);
      if (!m) setDenied(true);
    });
  }, []);
  useEffect(() => {
    if (me && level < 1) setDenied(true);
  }, [me, level]);
  useEffect(() => {
    (async () => {
      if (!me || level < 1) return;
      const d = await getJSON<{ results: Row[] }>(`${BASE}/clients/`);
      const list = ((d?.results ?? []) as Row[]);
      setClients([{ v: SEL, t: SEL },
        ...list.map((c) => ({ v: String(val(c, "client_code")), t: String(val(c, "client_name")) }))]);
    })();
  }, [me, level]);

  const loadGrid = async (cc: string) => {
    if (!cc || cc === SEL || cc === "0") { setRows([]); return; }
    const d = await getJSON<{ results: Row[] }>(`${BASE}/reset-grid/?client_code=${encodeURIComponent(cc)}`);
    const list = ((d?.results ?? []) as Row[]);
    setRows(list);
    setEdits(Object.fromEntries(list.map((_, i) => [i, { n: "", c: "" }])));
  };

  const backup = async () => {
    // backup_validation()
    if (!userId) { window.alert("Please Enter User Id !!!"); return; }
    if (!dbPass) { window.alert("Please Enter Password !!!"); return; }
    setBusy(true);
    try {
      const r = await mk(`${BASE}/request-backup/`, { user_id: userId, password: dbPass });
      setDbPass("");                                   // never keep the database password on screen
      if (!r.ok) { const t = await errText(r, "Backup Failed"); window.alert(t); show(t, false); return; }
      const blob = await r.blob();                     // backup.zip
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "backup.zip";
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setUserId("");
      show("BackUp Done Successfully!", true);
    } catch (e: any) {
      const t = e?.message || "Backup Failed"; window.alert(t); show(String(t), false);
    } finally { setBusy(false); }
  };

  const generate = async () => {
    // generatepassword_validation(): alert + focus the offending box, stop at the first failure
    if (emp === "") { window.alert("Please enter employee code !!"); empRef.current?.focus(); return; }
    if (npw === "") { window.alert("Please enter password !!"); pwRef.current?.focus(); return; }
    setGenBusy(true);                                   // legacy: $.blockUI(...) while the postback runs
    try {
      const r = await mk(`${BASE}/generate-password/`, { emp_login_id: emp, password: npw });
      if (r.ok) {
        const d = await r.json().catch(() => ({} as any));
        // legacy fills then clears all four boxes before render
        setEmp(""); setNpw("");
        window.alert((d as any)?.message || "Employee password change successfully !!!");
        show((d as any)?.message || "Employee password change successfully !!!", true);
      } else { const t = await errText(r, "Failed"); window.alert(t); show(t, false); }
    } finally { setGenBusy(false); }
  };

  const reset = async (r: Row, i: number) => {
    const e = edits[i] ?? { n: "", c: "" };
    if (!e.n) { window.alert("Please Enter New Password Password... !!!"); return; }
    if (!e.c) { window.alert("Please Enter Conform Password... !!!"); return; }
    const resp = await mk(`${BASE}/reset-password/`, {
      client_code: client, login_id: val(r, "LOGIN_ID"), new_password: e.n, confirm_password: e.c,
    });
    if (resp.ok) {
      window.alert("Password Reset Successfully... !!!");
      show("Password Reset Successfully... !!!", true);
      setEdits((p) => ({ ...p, [i]: { n: "", c: "" } }));
    } else {
      const t = await errText(resp, "Reset failed");
      window.alert(t); show(t, false);
    }
  };

  const openHelp = () => {
    window.open("html/Backup_Page.html", "popUpWindow",
      "height=500,width=600,left=100,top=100,toolbar=no,menubar=no,location=no,directories=no,scrollbars=yes,status=No");
  };

  if (denied) {
    return (
      <div className="container-fluid itmaster">
        <div className="lg-panel"><div className="lg-panel-head">Backup And Download</div>
          <div className="lg-panel-body">
            <div style={{ color: "#c62828", fontWeight: 700, textAlign: "center", padding: 30 }}>
              You do not have access to 'System Backup'. (unauthorised_access)
            </div>
          </div>
        </div>
      </div>
    );
  }

  const cols = ["Sr No.", "Type", "User Name", "Login Id", "New Password", "Conform Password", "Reset"];
  return (
    <div className="container-fluid itmaster">
      <div className="lg-panel" style={{ marginBottom: 0 }}>
        <div className="lg-panel-head">
          <div className="row">
            <div className="col-sm-1"></div>
            <div className="col-sm-9">
              <div style={{ textAlign: "center", color: "#fff", fontSize: "small" }}><b>BACKUP AND DOWNLOAD</b></div>
            </div>
            <div className="col-sm-2 text-right">
              <button type="button" onClick={openHelp} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 10 }} title="Help">
                <img src="/Images/help_ico.png" width={20} height={20} alt="Help" />
              </button>
            </div>
          </div>
        </div>
        <div className="lg-panel-body">
          <Msg text={msg.text} ok={msg.ok} />
          <div className="container-fluid" style={{ background: "#f3f1fe", border: "1px solid #e2e2dd", borderRadius: 10, padding: "25px", marginBottom: 20, marginTop: 20 }}>
            <div className="row">
              <div className="col-sm-3 col-xs-12">
                <b> User Id :</b>
                <input type="text" className="form-control" value={userId} autoComplete="off"
                  onKeyPress={alphaKey} onChange={(e) => setUserId(e.target.value)} />
              </div>
              <div className="col-sm-3 col-xs-12">
                <b> Password :</b>
                <input type="password" className="form-control" value={dbPass} autoComplete="new-password"
                  onChange={(e) => setDbPass(e.target.value)} />
              </div>
              <br />
              {canBackup && <button type="button" className="it-btn" disabled={busy} onClick={backup}>{busy ? "Backing up..." : "Backup"}</button>}
              &nbsp;&nbsp;
              <button type="button" className="btn btn-danger" onClick={() => { window.location.href = "/Home"; }}>Close</button>
            </div>
            <br /><br />
            <div className="row">
              <div className="col-sm-3 col-xs-6">
                <b>  Employee Login Id:</b>
                <input type="text" ref={empRef} className="form-control" value={emp} onChange={(e) => setEmp(e.target.value)} />
              </div>
              <div className="col-sm-3 col-xs-12">
                <b>Password:</b>
                <input type="text" ref={pwRef} className="form-control" value={npw} onChange={(e) => setNpw(e.target.value)} />
              </div>
              <br />
              <button type="button" className="it-btn btn-large" disabled={genBusy} onClick={generate}>{genBusy ? "Please wait..." : "Generate Password"}</button>
            </div>
          </div>

          <div className="container-fluid">
            <div id="tabs" className="itmaster-tabs" style={{ borderColor: "gray" }}>
              <input type="hidden" id="hidtab" value={hidtab} readOnly />
              <ul>
                <li className={hidtab === "menu0" ? "active" : ""}>
                  <a id="A1" href="#menu0" onClick={(e) => { e.preventDefault(); setHidtab("menu0"); }}>
                    Password Reset
                  </a>
                </li>
              </ul>
              <div id="menu0" className="itmaster-body">
                <div className="row">
                  <div className="col-sm-2 col-xs-12">
                    <b>Client Name :</b> <span className="text-red" style={{ color: "red" }}>*</span>
                    <select className="form-control" value={client}
                      onChange={(e) => { const v = e.target.value; setClient(v); loadGrid(v); }}>
                      {clients.map((o) => <option key={o.v} value={o.v}>{o.t}</option>)}
                    </select>
                  </div>
                </div>
                <br />
                <div className="container-fluid">
                  <div className="grid-view">
                    <div className="row text-center"><h3>Password Reset</h3></div>
                    <br />
                    <div style={{ overflowX: "auto" }}>
                      <table id="gv_pass_reset" className="table dt-grid" style={{ width: "100%", background: "#fff" }}>
                        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                        <tbody>
                          {rows.map((r, i) => {
                            const e = edits[i] ?? { n: "", c: "" };
                            const set = (k: "n" | "c", v: string) => setEdits((p) => ({ ...p, [i]: { ...e, [k]: v } }));
                            return (
                              <tr key={val(r, "LOGIN_ID") || i}>
                                <td>{i + 1}</td>
                                <td>{val(r, "ROLE")}</td>
                                <td>{val(r, "USER_NAME")}</td>
                                <td>{val(r, "LOGIN_ID")}</td>
                                <td><input type="text" className="form-control" style={{ width: 180 }} value={e.n} onChange={(ev) => set("n", ev.target.value)} /></td>
                                <td><input type="text" className="form-control" style={{ width: 180 }} value={e.c} onChange={(ev) => set("c", ev.target.value)} /></td>
                                <td><button type="button" className="it-btn" style={{ width: "55%", color: "white" }} onClick={() => reset(r, i)}>Reset Password</button></td>
                              </tr>
                            );
                          })}
                          {rows.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", color: "#999", padding: 20 }}>No records</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
